/**
 * podcast-agent.ts
 *
 * Autonomous AI agent that:
 * 1. Fetches the latest Everyday AI Podcast episode
 * 2. Scrapes its transcript
 * 3. Sends it to Pi agent for analysis
 * 4. Agent identifies topics, researches sources, writes digest
 * 5. Script reads the saved digest
 *
 * Uses Pi CLI (which has all extensions loaded, including llama.cpp)
 * to run the autonomous agent.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RSS_FEED_URL = "https://feeds.buzzsprout.com/2175779.rss";
const DIGESTS_DIR = "./digests";
const MAX_TRANSCRIPT_CHARS = 999999; // Effectively unlimited; full transcripts are faster and more complete
const PI_TIMEOUT_MS = 300_000; // 5 minutes

// Pi CLI path
const PI_CLI = "/home/jgraver/.nvm/versions/node/v24.20.0/bin/pi";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  episodeUrl?: string;
  testMode?: boolean;
} {
  const args = process.argv.slice(2);
  const result: { episodeUrl?: string; testMode?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--episode" && i + 1 < args.length) {
      result.episodeUrl = args[i + 1];
      i++;
    } else if (args[i] === "--test") {
      result.testMode = true;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchLatestEpisode(): Promise<{
  title: string;
  pubDate: string;
  description: string;
}> {
  const response = await fetch(RSS_FEED_URL, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);
  const xml = await response.text();

  const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
  if (!itemMatch) throw new Error("No <item> found in RSS feed");

  const item = itemMatch[1];
  const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
  const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
  const descriptionMatch = item.match(/<description>([\s\S]*?)<\/description>/);

  return {
    title: titleMatch
      ? titleMatch[1].replace(/<[^>]*>/g, "").trim()
      : "Unknown",
    pubDate: pubDateMatch ? pubDateMatch[1].trim() : "Unknown",
    description: descriptionMatch
      ? descriptionMatch[1].replace(/<[^>]*>/g, "").trim().substring(0, 500)
      : "No description",
  };
}

async function scrapeTranscript(url: string): Promise<{
  title: string;
  transcript: string;
}> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Failed to fetch episode page: ${response.status}`);
  const html = await response.text();

  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
  const title = titleMatch
    ? titleMatch[1].replace(/<[^>]*>/g, "").trim()
    : "Unknown title";

  // Extract transcript: "Speaker [HH:MM:SS]:" pattern
  const transcriptRegex =
    /(\b[A-Z][a-zA-Z\s.]+?)\s*\[(\d{2}:\d{2}:\d{2})\]:\s*([\s\S]*?)(?=(?:\s*[A-Z][a-zA-Z\s.]+\s*\[\d{2}:\d{2}:\d{2}\]:)|$)/g;

  let transcript = "";
  let match;
  while ((match = transcriptRegex.exec(html)) !== null) {
    const speaker = match[1].replace(/<[^>]*>/g, "").trim();
    const timestamp = match[2];
    const text = match[3].replace(/<[^>]*>/g, "").trim();
    if (text.length > 10) {
      transcript += `${speaker} [${timestamp}]:\n${text}\n\n`;
    }
  }

  if (transcript.length < 50) {
    throw new Error("Could not extract transcript from episode page");
  }

  return { title, transcript };
}

function digestExists(episodeNum: string): boolean {
  const digestsPath = path.join(process.cwd(), DIGESTS_DIR);
  if (!fs.existsSync(digestsPath)) return false;
  const files = fs.readdirSync(digestsPath).filter((f) => f.endsWith(".md"));
  return files.some((f) => f.includes(`ep-${episodeNum}`));
}

// ---------------------------------------------------------------------------
// Pi CLI runner
// ---------------------------------------------------------------------------

function runPiAgent(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let output = "";
    let stderr = "";

    // Write prompt to temp file
    const tmpFile = path.join(process.cwd(), ".pi-agent-prompt.txt");
    fs.writeFileSync(tmpFile, prompt);

    const pi = spawn(PI_CLI, ["-p", "@" + tmpFile], {
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    pi.stdin.end();

    pi.stdout.on("data", (data) => {
      output += data.toString();
    });

    pi.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const cleanup = () => {
      try { fs.unlinkSync(tmpFile); } catch {}
    };

    pi.on("close", (code) => {
      cleanup();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(
          `Pi agent exited with code ${code} after ${elapsed}s. Stderr: ${stderr.substring(0, 500)}`
        ));
      }
    });

    pi.on("error", (err) => {
      cleanup();
      reject(new Error(`Failed to start Pi agent: ${err.message}`));
    });

    // Safety timeout
    const timer = setTimeout(() => {
      pi.kill("SIGTERM");
      cleanup();
      reject(new Error(`Pi agent timed out after ${PI_TIMEOUT_MS / 1000}s`));
    }, PI_TIMEOUT_MS);
    timer.unref();
  });
}

// ---------------------------------------------------------------------------
// Build agent prompt
// ---------------------------------------------------------------------------

function buildPrompt(
  episodeTitle: string,
  pubDate: string,
  transcript: string,
  episodeNum: string | null,
  episodeUrl: string | null
): string {
  const dateStr = pubDate !== "Unknown"
    ? new Date(pubDate).toISOString().split("T")[0]
    : "2026-08-14";
  const saveFile = `digests/${dateStr}-ep${episodeNum || "???"}.md`;
  return `You are a podcast research agent. Analyze this episode of the Everyday AI Podcast and create a structured digest.

## Episode Info
${episodeUrl ? `**URL:** ${episodeUrl}` : "**URL:** Not found"}
**Title:** ${episodeTitle}
**Date:** ${pubDate}
**Episode Number:** ${episodeNum || "Unknown"}

## Transcript
${transcript}

## Your Task

1. **Identify topics**: Go through the transcript and identify each major topic (5-8 topics).
2. **Research each topic**: Use the bash tool to search DuckDuckGo for official source links.
   Search format: curl -s -A "Mozilla/5.0" "https://html.duckduckgo.com/html/?q=QUERY"
   Be specific: include company name, product name, "announcement", "blog", "official".
3. **Compile the digest**: Write a structured Markdown digest.
4. **Save the digest**: Use the write tool to save it to the file:
${saveFile}

Write the digest in this exact structure:

# Episode NNN -- Short Title

**Episode Number:** NNN
**Date:** YYYY-MM-DD
**Source:** [Episode Page](URL)

## Topics Covered

### Topic Name 1
2-3 sentence summary with specific details (model names, pricing, benchmarks).
- [Source Title](URL) - brief note

### Topic Name 2
...

## Key Announcements
- **Product/Model**: One-line summary with link

## Links to Explore
(Optional) Tangentially related links from research

## Rules
- ZERO hallucinations: only include facts with real links
- Every claim must have at least one supporting link
- Be specific: exact model names, pricing, benchmark numbers
- Use bash tool for web searches (curl to DuckDuckGo)
- Use write tool to save the digest

Now begin. Identify topics, research each with web searches, compile the digest, and save it.`;
}

// ---------------------------------------------------------------------------
// Test mode
// ---------------------------------------------------------------------------

async function runTest(): Promise<void> {
  console.log("=== Podcast Agent -- Test Mode ===\n");

  console.log("Test 1: Fetching RSS feed...");
  const episode = await fetchLatestEpisode();
  console.log(`  Title: ${episode.title}`);
  console.log(`  Date: ${episode.pubDate}\n`);

  console.log("Test 2: Scraping transcript...");
  const testUrl = "https://youreverydayai.com/ep-841-chatgpt-computer-history-new-gemini-model-claude-flexes-on-the-browser-and-7-more-ai-updates-you-should-use-today/";
  const transcript = await scrapeTranscript(testUrl);
  const lines = transcript.transcript.split("\n").filter((l) => l.trim());
  console.log(`  Transcript: ${transcript.transcript.length} chars, ${lines.length} lines`);
  console.log(`  First 3 lines:`);
  lines.slice(0, 3).forEach((l) => console.log(`    ${l.substring(0, 100)}`));
  console.log();

  console.log("Test 3: Web search via curl...");
  const searchResult = await new Promise<string>((resolve, reject) => {
    const curl = spawn("curl", [
      "-s", "-A", "Mozilla/5.0",
      "https://html.duckduckgo.com/html/?q=" + encodeURIComponent("OpenAI GPT-5.6 announcement")
    ]);
    let out = "";
    curl.stdout.on("data", (d) => (out += d.toString()));
    curl.on("close", (code) => code === 0 ? resolve(out.substring(0, 300)) : reject(new Error(`curl exited ${code}`)));
  });
  console.log(`  Preview: ${searchResult.substring(0, 200)}...\n`);

  console.log("=== All tests passed ===");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runAgent(episodeUrl?: string): Promise<void> {
  console.log("=== Podcast Agent Starting ===\n");

  // Get episode info
  console.log("Step 1: Fetching episode info...");
  let episodeTitle: string;
  let pubDate: string;
  let episodeNum: string | null = null;

  if (episodeUrl) {
    const urlMatch = episodeUrl.match(/ep-(\d+)/);
    episodeNum = urlMatch ? urlMatch[1] : null;
    episodeTitle = "Specific episode (URL provided)";
    pubDate = "Unknown";
  } else {
    const episode = await fetchLatestEpisode();
    episodeTitle = episode.title;
    pubDate = episode.pubDate;
    const numMatch = episodeTitle.match(/(?:ep|episode)\s*(\d+)/i);
    episodeNum = numMatch ? numMatch[1] : null;
  }

  console.log(`  Episode: ${episodeTitle}`);
  console.log(`  Number: ${episodeNum || "Unknown"}`);
  console.log(`  Date: ${pubDate}\n`);

  // Check if already processed
  if (episodeNum && digestExists(episodeNum)) {
    console.log(`Digest for episode ${episodeNum} already exists. Skipping.`);
    return;
  }

  // Find episode URL
  let url = episodeUrl;
  if (!url) {
    console.log("Step 2: Finding episode page URL...");
    // Try DuckDuckGo search
    const searchQuery = episodeNum
      ? `Ep ${episodeNum} ${episodeTitle.replace(/Ep \d+:\s*/, "")} site:youreverydayai.com`
      : `${episodeTitle} site:youreverydayai.com`;
    const encodedQuery = encodeURIComponent(searchQuery);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    try {
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const html = await res.text();
        const resultMatch = html.match(
          /<a rel="nofollow" class="result__a[^"]*" href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/
        );
        if (resultMatch && resultMatch[1].includes("youreverydayai.com/ep-")) {
          url = resultMatch[1];
          console.log(`  Found: ${url}`);
        } else {
          console.log("  Not found via search. The episode page may not exist yet.");
        }
      }
    } catch {
      console.log("  Search failed. The episode page may not exist yet.");
    }
  } else {
    console.log(`Step 2: Using provided URL: ${url}\n`);
  }

  // Scrape transcript
  console.log("Step 3: Scraping transcript...");
  let transcript: string;

  if (url) {
    try {
      const result = await scrapeTranscript(url);
      transcript = result.transcript;
      console.log(`  Transcript: ${transcript.length} chars`);

      // Truncate if too large
      if (transcript.length > MAX_TRANSCRIPT_CHARS) {
        console.log(`  Truncating to ${MAX_TRANSCRIPT_CHARS} chars...`);
        transcript = transcript.substring(0, MAX_TRANSCRIPT_CHARS);
        transcript += "\n\n--- TRANSCRIPT TRUNCATED ---\n";
      }
    } catch (err: any) {
      console.log(`  Error: ${err.message}`);
      console.log("  The episode page may not exist yet. Check back later.");
      return;
    }
  } else {
    console.log("  No episode page URL found. Cannot proceed.");
    return;
  }

  // Run Pi agent
  console.log("\nStep 4: Running Pi agent...\n");
  const prompt = buildPrompt(episodeTitle, pubDate, transcript, episodeNum, url);

  try {
    await runPiAgent(prompt);

    // Get the digest (agent should have saved it)
    console.log("\nStep 5: Loading digest...");
    const digestsPath = path.join(process.cwd(), DIGESTS_DIR);
    fs.mkdirSync(digestsPath, { recursive: true });

    const files = fs.readdirSync(digestsPath)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.log("  No digest file found. Agent may not have saved it.");
      return;
    }

    // Find file matching this episode number first, then fall back to most recent
    let digestFile = files.find((f) => f.includes(`ep${episodeNum}`)) || files[0];
    const fullPath = path.join(digestsPath, digestFile);
    const digestContent = fs.readFileSync(fullPath, "utf-8");

    console.log(`  Loaded: ${fullPath}`);
    console.log(`  Size: ${digestContent.length} characters`);

    console.log("\n=== Agent Complete ===");
    console.log("\nDigest preview (first 500 chars):");
    console.log(digestContent.substring(0, 500));
    if (digestContent.length > 500) {
      console.log(`\n... (${digestContent.length - 500} more chars)`);
    }
  } catch (err: any) {
    console.error(`\n[ERROR] Agent failed: ${err.message}`);
    throw err;
  }
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.testMode) {
    await runTest();
    return;
  }

  if (args.episodeUrl) {
    try {
      new URL(args.episodeUrl);
      console.log(`Processing specific episode: ${args.episodeUrl}\n`);
    } catch {
      console.error(`Invalid episode URL: ${args.episodeUrl}`);
      process.exit(1);
    }
  }

  await runAgent(args.episodeUrl);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

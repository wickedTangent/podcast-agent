/**
 * podcast-agent.ts
 *
 * Generic autonomous AI agent that:
 * 1. Loads a podcast config from podcasts/<podcast>/config.json
 * 2. Fetches episode info (RSS or manual URL)
 * 3. Scrapes transcript (pattern configurable per podcast)
 * 4. Sends it to Pi agent for analysis
 * 5. Agent identifies topics, researches sources, writes digest
 * 6. Script reads the saved digest
 *
 * Usage:
 *   npx tsx podcast-agent.ts --podcast everyday-ai
 *   npx tsx podcast-agent.ts --podcast everyday-ai --episode <url>
 *   npx tsx podcast-agent.ts --podcast the-startup-ideas --episode <url>
 *   npx tsx podcast-agent.ts --podcast the-startup-ideas --latest
 *   npx tsx podcast-agent.ts --podcast the-startup-ideas --test
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Global config
// ---------------------------------------------------------------------------

const PI_TIMEOUT_MS = 300_000; // 5 minutes
const PI_CLI = "/home/jgraver/.nvm/versions/node/v24.20.0/bin/pi";
const PODCASTS_DIR = path.join(process.cwd(), "podcasts");

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  podcast?: string;
  episodeUrl?: string;
  latest?: boolean;
  testMode?: boolean;
} {
  const args = process.argv.slice(2);
  const result: {
    podcast?: string;
    episodeUrl?: string;
    latest?: boolean;
    testMode?: boolean;
  } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--podcast") {
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        result.podcast = args[i + 1];
        i++;
      }
    } else if (args[i] === "--episode" && i + 1 < args.length) {
      result.episodeUrl = args[i + 1];
      i++;
    } else if (args[i] === "--latest") {
      result.latest = true;
    } else if (args[i] === "--test") {
      result.testMode = true;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDigestsDir(config: PodcastConfig): string {
  const dir = config.digestsDir || config.name.toLowerCase().replace(/\s+/g, "-");
  return path.join(PODCASTS_DIR, dir);
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

interface TranscriptPattern {
  type: string;
  [key: string]: any;
}

interface PodcastConfig {
  name: string;
  host: string;
  website: string;
  rss: string | null;
  transcriptSource: string;
  transcriptPattern: TranscriptPattern;
  episodeNumberPattern: string | null;
  digestsDir?: string; // Override for where digests are saved (defaults to name converted to kebab-case)
  agentPrompt: {
    intro: string;
    format: string;
    sections: string[];
  };
}

function loadPodcastConfig(podcastName: string): PodcastConfig {
  const configPath = path.join(PODCASTS_DIR, podcastName, "config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Config not found: ${configPath}. Run with --podcast <directory-name>`
    );
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

// ---------------------------------------------------------------------------
// Episode finding
// ---------------------------------------------------------------------------

async function fetchLatestEpisode(config: PodcastConfig): Promise<{
  title: string;
  pubDate: string;
  description: string;
  url: string;
}> {
  if (!config.rss) {
    throw new Error("No RSS feed configured for this podcast");
  }

  const response = await fetch(config.rss, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);
  const xml = await response.text();

  const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
  if (!itemMatch) throw new Error("No <item> found in RSS feed");

  const item = itemMatch[1];
  const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
  const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
  const descriptionMatch = item.match(
    /<description>([\s\S]*?)<\/description>/
  );
  const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);

  return {
    title: titleMatch
      ? titleMatch[1].replace(/<[^>]*>/g, "").trim()
      : "Unknown",
    pubDate: pubDateMatch ? pubDateMatch[1].trim() : "Unknown",
    description: descriptionMatch
      ? descriptionMatch[1].replace(/<[^>]*>/g, "").trim().substring(0, 500)
      : "No description",
    url: linkMatch
      ? linkMatch[1].replace(/<[^>]*>/g, "").trim()
      : config.website,
  };
}

// ---------------------------------------------------------------------------
// Transcript scraping (configurable per podcast)
// ---------------------------------------------------------------------------

async function scrapeTranscriptWebsite(
  url: string,
  pattern: TranscriptPattern
): Promise<{ title: string; transcript: string }> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(`Failed to fetch episode page: ${response.status}`);
  const html = await response.text();

  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
  const title = titleMatch
    ? titleMatch[1].replace(/<[^>]*>/g, "").trim()
    : "Unknown title";

  // Extract transcript using configured regex pattern
  const regex = new RegExp(pattern.pattern, "g");
  let transcript = "";
  let match;
  while ((match = regex.exec(html)) !== null) {
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

async function scrapeTranscriptPodscripts(
  url: string,
  pattern: TranscriptPattern
): Promise<{ title: string; transcript: string }> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(`Failed to fetch episode page: ${response.status}`);
  const html = await response.text();

  // Extract title from HTML
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const title = titleMatch
    ? titleMatch[1].replace(/<[^>]*>/g, "").trim()
    : "Unknown title";

  // Extract transcript text from podscripts.co format
  // The HTML has newlines/whitespace between > and the text
  const regex =
    /class="pod_text seek_pod_segment sentence-tooltip transcript-text">\s*([\s\S]*?)\s*<\/span>/g;
  let transcript = "";
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]*>/g, "").trim();
    if (text.length > 10) {
      transcript += text + " ";
    }
  }

  if (transcript.length < 50) {
    throw new Error(
      "Could not extract transcript from podscripts.co page"
    );
  }

  return { title, transcript };
}

async function scrapeTranscript(
  url: string,
  config: PodcastConfig
): Promise<{ title: string; transcript: string }> {
  switch (config.transcriptSource) {
    case "website":
      return scrapeTranscriptWebsite(url, config.transcriptPattern);
    case "podscripts":
      return scrapeTranscriptPodscripts(url, config.transcriptPattern);
    default:
      throw new Error(
        `Unknown transcript source: ${config.transcriptSource}`
      );
  }
}

// ---------------------------------------------------------------------------
// Digest existence check
// ---------------------------------------------------------------------------

function digestExists(
  config: PodcastConfig,
  episodeNum: string | null
): boolean {
  const digestsPath = path.join(getDigestsDir(config), "digests");
  if (!fs.existsSync(digestsPath)) return false;
  const files = fs.readdirSync(digestsPath).filter((f) => f.endsWith(".md"));
  if (episodeNum) {
    return files.some((f) => f.includes(`ep-${episodeNum}`) || f.includes(`ep${episodeNum}`));
  }
  return files.length > 0;
}

// ---------------------------------------------------------------------------
// Pi CLI runner
// ---------------------------------------------------------------------------

function runPiAgent(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let output = "";
    let stderr = "";

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
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    };

    pi.on("close", (code) => {
      cleanup();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(
          new Error(
            `Pi agent exited with code ${code} after ${elapsed}s. Stderr: ${stderr.substring(0, 500)}`
          )
        );
      }
    });

    pi.on("error", (err) => {
      cleanup();
      reject(new Error(`Failed to start Pi agent: ${err.message}`));
    });

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
  config: PodcastConfig,
  episodeTitle: string,
  pubDate: string,
  transcript: string,
  episodeNum: string | null,
  episodeUrl: string | null
): string {
  const dateStr =
    pubDate !== "Unknown"
      ? new Date(pubDate).toISOString().split("T")[0]
      : "2026-08-14";

  const saveFile = path.join(getDigestsDir(config), "digests", `${dateStr}-ep${episodeNum || "???"}.md`);

  return `You are a podcast research agent. ${config.agentPrompt.intro}

## Episode Info
${episodeUrl ? `**URL:** ${episodeUrl}` : "**URL:** Not found"}
**Title:** ${episodeTitle}
**Date:** ${pubDate}
**Host:** ${config.host}
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

async function runTest(config: PodcastConfig): Promise<void> {
  console.log(`=== Podcast Agent -- Test Mode (${config.name}) ===\n`);

  console.log("Test 1: Loading config...");
  console.log(`  Name: ${config.name}`);
  console.log(`  Website: ${config.website}`);
  console.log(`  Transcript source: ${config.transcriptSource}\n`);

  console.log("Test 2: Scraping transcript...");
  const testUrl =
    config.transcriptSource === "podscripts"
      ? "https://podscripts.co/podcasts/the-startup-ideas-podcast/fde-the-1myear-ai-job-explained"
      : "https://youreverydayai.com/ep-841-chatgpt-computer-history-new-gemini-model-claude-flexes-on-the-browser-and-7-more-ai-updates-you-should-use-today/";
  const transcript = await scrapeTranscript(testUrl, config);
  const lines = transcript.transcript.split("\n").filter((l) => l.trim());
  console.log(`  Transcript: ${transcript.transcript.length} chars, ${lines.length} lines`);
  console.log(`  First 3 lines:`);
  lines.slice(0, 3).forEach((l) => console.log(`    ${l.substring(0, 100)}`));
  console.log();

  console.log("Test 3: Web search via curl...");
  const searchResult = await new Promise<string>((resolve, reject) => {
    const curl = spawn("curl", [
      "-s",
      "-A",
      "Mozilla/5.0",
      "https://html.duckduckgo.com/html/?q=" +
        encodeURIComponent("OpenAI GPT-5.6 announcement"),
    ]);
    let out = "";
    curl.stdout.on("data", (d) => (out += d.toString()));
    curl.on("close", (code) =>
      code === 0
        ? resolve(out.substring(0, 300))
        : reject(new Error(`curl exited ${code}`))
    );
  });
  console.log(`  Preview: ${searchResult.substring(0, 200)}...\n`);

  console.log("=== All tests passed ===");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runAgent(
  config: PodcastConfig,
  episodeUrl?: string
): Promise<void> {
  console.log(`=== Podcast Agent Starting (${config.name}) ===\n`);

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
    const episode = await fetchLatestEpisode(config);
    episodeTitle = episode.title;
    pubDate = episode.pubDate;
    const numMatch = episodeTitle.match(/(?:ep|episode)\s*(\d+)/i);
    episodeNum = numMatch ? numMatch[1] : null;
  }

  console.log(`  Episode: ${episodeTitle}`);
  console.log(`  Number: ${episodeNum || "Unknown"}`);
  console.log(`  Date: ${pubDate}\n`);

  // Check if already processed
  if (episodeNum && digestExists(config, episodeNum)) {
    console.log(`Digest for episode ${episodeNum} already exists. Skipping.`);
    return;
  }

  // Find episode URL
  let url = episodeUrl;
  if (!url) {
    console.log("Step 2: Finding episode page URL...");
    const searchQuery = episodeNum
      ? `Ep ${episodeNum} ${episodeTitle.replace(/Ep \d+:\s*/, "")} site:${config.website.replace("https://", "")}`
      : `${episodeTitle} site:${config.website.replace("https://", "")}`;
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
        if (resultMatch && resultMatch[1].includes(config.website.replace("https://", "").split("/")[0])) {
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
      const result = await scrapeTranscript(url, config);
      transcript = result.transcript;
      console.log(`  Transcript: ${transcript.length} chars`);
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
  const prompt = buildPrompt(config, episodeTitle, pubDate, transcript, episodeNum, url);

  try {
    await runPiAgent(prompt);

    // Get the digest (agent should have saved it)
    console.log("\nStep 5: Loading digest...");
    const digestsPath = path.join(getDigestsDir(config), "digests");
    fs.mkdirSync(digestsPath, { recursive: true });

    const files = fs
      .readdirSync(digestsPath)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.log("  No digest file found. Agent may not have saved it.");
      return;
    }

    // Find file matching this episode number first, then fall back to most recent
    let digestFile =
      files.find((f) =>
        episodeNum ? f.includes(`ep${episodeNum}`) : false
      ) || files[0];
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

  if (!args.podcast) {
    console.error("Usage: npx tsx podcast-agent.ts --podcast <podcast-dir> [--episode <url> | --latest | --test]");
    process.exit(1);
  }

  const config = loadPodcastConfig(args.podcast);

  if (args.testMode) {
    await runTest(config);
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

  await runAgent(config, args.episodeUrl);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

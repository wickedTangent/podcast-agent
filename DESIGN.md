# Podcast Agent -- Design Document & Session Summary

**Last updated:** 2026-09-13
**Project:** ~/code/podcast-agent/
**Purpose:** Autonomous AI agent that fetches, analyzes, and summarizes podcast episodes into structured digests

---

## 1. What This Is

A TypeScript script (`podcast-agent.ts`) that runs an autonomous AI agent to:

1. Fetch the latest Everyday AI Podcast episode from RSS
2. Scrape its timestamped transcript from the episode page
3. Send the transcript to the Pi agent (Qwen3.6-35B via llama.cpp)
4. Agent identifies topics, researches each with web searches, compiles a structured digest
5. Saves a .md digest with verified source links to `digests/`

Run via: `npx tsx podcast-agent.ts`
Schedule via cron: `0 6 * * 1-5 cd /home/jgraver/code/addAI/podcast-agent && npx tsx podcast-agent.ts >> cron.log 2>&1`

---

## 2. Architecture

### High-Level Flow

```
RSS Feed (feeds.buzzsprout.com/2175779.rss)
    → fetchLatestEpisode() → title, date, description
    → findEpisodeUrl() → DuckDuckGo search for episode page URL
    → scrapeTranscript(url) → timestamped transcript text
    → truncate to 8000 chars (keep beginning = most important content)
    → Pi CLI: pi -p "@.pi-agent-prompt.txt"
    → Agent identifies topics, researches with curl, writes digest
    → Script reads saved digest from digests/
```

### Why Pi CLI, Not SDK?

**This was the biggest technical hurdle.** The Pi SDK (`createAgentSession`) does NOT load the llama.cpp extension, so no models are available. The llama.cpp provider only appears when the extension is loaded by the full Pi process (TUI mode).

**Workaround:** Use `spawn()` to run the Pi CLI directly with `-p` (print mode) and `@file` (file-based prompt). The CLI has all extensions loaded.

**Key discovery:** The Pi CLI needs stdin closed (`.stdin.end()`) or it hangs. Also need the full path to the Pi binary: `/home/jgraver/.nvm/versions/node/v24.20.0/bin/pi`

### File Structure

```
~/code/podcast-agent/
├── podcast-agent.ts          # Generic runner (works with any podcast)
├── package.json              # Dependencies: typebox, tsx, @types/node
├── tsconfig.json             # TypeScript config (ES2022, NodeNext)
├── README.md                 # Usage documentation
├── DESIGN.md                 # This file
├── CLAUDE.md                 # Session context summary
├── .gitignore
├── podcasts/                 # Per-podcast configs and digests
│   ├── everyday-ai/
│   │   ├── config.json       # Podcast-specific settings
│   │   └── digests/          # 10 episode digests (ep831-840)
│   └── the-startup-ideas-podcast/
│       ├── config.json       # Podcast-specific settings
│       └── digests/          # FDE episode digest
├── .pi-agent-prompt.txt      # Temp file for Pi CLI (auto-deleted)
└── node_modules/
```

---

## 3. Key Technical Decisions & Learnings

### 3.1 Transcript Source

**Decision:** Scrape from `youreverydayai.com/ep-NNN-slug/` pages, NOT Spotify or YouTube.

**Why:**
- Episode pages have full timestamped transcripts as HTML
- No API keys needed
- Free and reliable
- Podcast is on YouTube (`@EverydayAI_`) but YouTube captions are harder to extract programmatically

**Problem discovered:** Episodes 842+ don't have individual pages on the website yet. The RSS feed lists them but the website hasn't created pages. The agent handles this gracefully by reporting "episode page may not exist yet" and skipping.

**RSS feed URL:** `https://feeds.buzzsprout.com/2175779.rss`
**Episodes listing:** `https://www.youreverydayai.com/episodes/` (but only shows up to ep-841)

### 3.2 Transcript Extraction

**Pattern:** `Speaker Name [HH:MM:SS]: transcript text`

**Regex:** `/(\b[A-Z][a-zA-Z\s.]+?)\s*\[(\d{2}:\d{2}:\d{2})\]:\s*([\s\S]*?)(?=(?:\s*[A-Z][a-zA-Z\s.]+\s*\[\d{2}:\d{2}:\d{2}\]:)|$)/g`

**HTML cleaning:** Remove `<script>`, `<style>`, and all other HTML tags before processing.

**Transcript truncation:** Limited to 8000 chars. The beginning of the transcript contains the most important content (intro, topic overview, first few topics). The agent still produces good digests with this truncated input.

### 3.3 Pi Agent Communication

**Method:** `spawn()` to run Pi CLI with file-based prompt.

```typescript
const pi = spawn(PI_CLI, ["-p", "@" + tmpFile], {
  env: { ...process.env },
  stdio: ["pipe", "pipe", "pipe"],
});
pi.stdin.end(); // CRITICAL: stdin must be closed
```

**Key findings:**
- `pi -p` (print mode) = single-shot: send prompt, get output, exit
- `@file` syntax = Pi reads prompt from file (avoids shell escaping issues)
- stdin MUST be closed with `.stdin.end()` or Pi hangs waiting for input
- Full path to Pi binary needed: `/home/jgraver/.nvm/versions/node/v24.20.0/bin/pi`
- Timeout is essential: 300 seconds, with `timer.unref()` to prevent keeping process alive

**Why not SDK?** The SDK's `createAgentSession()` doesn't load llama.cpp extension. The extension is registered by the Pi process at startup, not by the SDK. This means:
- SDK has 0 available models when llama.cpp is the only configured provider
- SDK works fine for API-based providers (Anthropic, OpenAI, etc.)
- For llama.cpp, must use CLI

### 3.4 Web Search

**Method:** DuckDuckGo HTML endpoint via curl (free, no API key).

```bash
curl -s -A "Mozilla/5.0" "https://html.duckduckgo.com/html/?q=QUERY"
```

**Agent uses bash tool** inside the Pi session to run curl for web searches. The prompt instructs the agent to search for:
- Company name + product name + "announcement" or "blog" or "official"
- Verify claims against real sources

### 3.5 Agent Prompt Design

**Prompt structure:**
1. Episode info (title, date, URL, episode number)
2. Transcript (truncated to 8000 chars)
3. Task instructions (identify topics, research, compile, save)
4. Output format template
5. Rules (zero hallucinations, real links only, be specific)

**Key prompt rules:**
- "ZERO hallucinations: only include facts with real links"
- "Every claim must have at least one supporting link"
- "Use bash tool for web searches (curl to DuckDuckGo)"
- "Use write tool to save the digest"

**Agent behavior:** The agent autonomously decides how many topics to cover, which sources to search for, and how to structure the output. It typically produces 7-9 topics per episode.

### 3.6 Digest Output Format

```markdown
# Episode NNN -- Short Title

**Episode Number:** NNN
**Date:** YYYY-MM-DD
**Source:** [Episode Page](URL)

## Topics Covered

### Topic Name
2-3 sentence summary with specific details (model names, pricing, benchmarks).
- [Source Title](URL) - brief note

## Key Announcements
- **Product/Model**: One-line summary with link

## Links to Explore
(Optional) Tangentially related links from research
```

### 3.7 Duplicate Detection

The script checks `digests/` for existing files matching the episode number before processing. If a digest already exists, it skips.

---

## 4. Pi Agent SDK Learnings

### 4.1 SDK vs CLI

| Feature | SDK (`createAgentSession`) | CLI (`pi -p`) |
|---------|---------------------------|---------------|
| llama.cpp models | NOT available | Available |
| Extension loading | Manual (must specify paths) | Automatic |
| Interactive mode | TUI | N/A |
| Print mode | `runPrintMode()` | `-p` flag |
| RPC mode | `runRpcMode()` | `--mode rpc` |
| Custom tools | Via `defineTool()` or extensions | Via agent's bash/write tools |
| Best for | Embedding in apps | Headless automation |

### 4.2 SDK Model Discovery

```typescript
const modelRuntime = await ModelRuntime.create();
const available = await modelRuntime.getAvailable();
```

- Returns models from providers with valid credentials
- llama.cpp provider is NOT in the list unless the extension is loaded
- llama.cpp is in `settings.json` under `packages`, not `extensions`
- Adding llama.cpp to `extensions` array in settings.json didn't help the SDK
- The extension only registers the provider when Pi's full startup process runs it

### 4.3 SDK ResourceLoader

```typescript
const loader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  systemPromptOverride: () => "...",
  settingsManager,
});
```

- `cwd` and `agentDir` are REQUIRED (SDK crashes without them)
- `getAgentDir()` returns `~/.pi/agent`
- SettingsManager must be inMemory for headless use
- Extensions are discovered from `settings.json` extensions array

### 4.4 AgentSession API

```typescript
const { session } = await createAgentSession({...});
session.subscribe((event) => { ... }); // Stream output
await session.prompt("text"); // Send prompt, wait for response
session.setModel(model); // Switch models
session.setThinkingLevel("max"); // Max thinking
session.dispose(); // Cleanup
```

### 4.5 Custom Tools (SDK)

```typescript
const myTool = defineTool({
  name: "my_tool",
  label: "My Tool",
  description: "...",
  parameters: Type.Object({ input: Type.String() }),
  execute: async (_toolCallId, params) => ({
    content: [{ type: "text", text: `Result: ${params.input}` }],
    details: {},
  }),
});
```

- Tools are registered via `customTools: [myTool]` in `createAgentSession()`
- Can also register via extension factory: `pi.registerTool({...})`
- Tool names must be unique

---

## 5. Troubleshooting Log

### Problem: Pi CLI hangs with no output
**Cause:** stdin not closed
**Fix:** `pi.stdin.end()` after spawn

### Problem: SDK returns 0 available models
**Cause:** llama.cpp extension not loaded by SDK
**Fix:** Use Pi CLI instead of SDK

### Problem: Pi CLI timeout (exit code 143)
**Cause:** Timeout too short or agent stuck
**Fix:** Increase timeout to 300s, use `timer.unref()`

### Problem: Agent response is 0 chars
**Cause:** Prompt too large or Pi CLI not receiving input
**Fix:** Use `@file` syntax for large prompts, truncate transcript to 8000 chars

### Problem: RSS feed URL extraction failed
**Cause:** Buzzsprout RSS doesn't have `<link>` tag for episode page URL
**Fix:** Parse description HTML for `youreverydayai.com/ep-NNN-slug/` pattern, or use DuckDuckGo search

### Problem: Episode pages don't exist for latest episodes
**Cause:** Website creates pages days after episode publishes
**Fix:** Agent reports this gracefully, user can retry later

### Problem: Pi CLI path not found in spawn
**Cause:** PATH not inherited or using `pi` instead of full path
**Fix:** Use full path: `/home/jgraver/.nvm/versions/node/v24.20.0/bin/pi`

---

## 6. Future Improvements

### 6.1 YouTube Transcript Fallback
When episode pages don't exist, try extracting YouTube captions from `@EverydayAI_` channel videos.

### 6.2 Cloudflare Cron Trigger
Replace WSL cron with Cloudflare Worker cron trigger. The Worker fetches RSS + transcript, then calls Pi via webhook (needs ngrok or similar to wake local machine).

### 6.3 Better Model Selection
If API models are configured, prefer them over Qwen for better autonomous reasoning. Make model configurable via environment variable.

### 6.4 Email Delivery
Integrate with existing `email-worker` to email digests instead of saving to disk.

### 6.5 Searchable Index
Maintain a master index file that maps topics to episodes, making it easy to find "which episode covered X".

### 6.6 SDK with API Models
If API keys are configured, the SDK approach would work and provide better custom tool integration. The CLI approach is a workaround specific to llama.cpp.

---

## 7. Configuration Reference

### Environment Variables
- None required. Uses local Pi configuration.

### Settings
- Pi model: Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf (via llama.cpp)
- Thinking level: default (medium) - agent takes its time with max thinking
- llama.cpp server: `http://192.168.3.189:8080` (SSH tunnel)

### Script Configuration (in podcast-agent.ts)
- `RSS_FEED_URL` - Podcast RSS feed
- `DIGESTS_DIR` - Output directory
- `MAX_TRANSCRIPT_CHARS` - Max transcript size (8000)
- `PI_TIMEOUT_MS` - Max agent execution time (300000)
- `PI_CLI` - Path to Pi CLI binary

---

## 8. Files Referenced

- `podcast-agent.ts` - Main script (14.8KB)
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript config
- `README.md` - Usage docs
- `DESIGN.md` - This file
- `digests/2026-08-14-ep841.md` - Sample output (9.3KB, 7 topics)

## 9. Session Summary

### What worked
- RSS feed parsing (Buzzsprout)
- Transcript scraping (timestamped speaker format)
- Pi CLI with file-based prompt (`-p @file`)
- DuckDuckGo web search via curl
- Agent producing structured digests with verified links
- Self-verification step catching unverified claims

### What didn't work
- SDK with llama.cpp (models not available)
- Large transcript prompts (agent overwhelmed)
- Direct stdin piping to Pi CLI (hangs)
- Episode URL discovery from RSS (Buzzsprout doesn't include page URLs)

### Key insight
The Pi ecosystem is designed around the TUI/interactive mode. Headless automation requires either:
1. Using the CLI (`pi -p`) which has all extensions loaded
2. Using the SDK with API-based models (no llama.cpp)
3. Building a custom extension that registers tools and runs headlessly

For this project, the CLI approach is the right choice because it works with llama.cpp and keeps things simple.

# Podcast Agent

Autonomous AI agent built on Pi Agent that fetches, analyzes, and summarizes the latest Everyday AI Podcast episode.

## What it does

1. Fetches the latest episode from the podcast RSS feed
2. Scrapes the full timestamped transcript from the episode page
3. Sends the transcript to the Pi agent (Qwen via llama.cpp)
4. Agent identifies topics, researches each with web searches, compiles digest
5. Saves a structured .md digest with verified source links

## Setup

```bash
cd ~/code/addAI/podcast-agent
npm install
```

## Usage

### Run against the latest episode

```bash
npx tsx podcast-agent.ts
```

### Run against a specific episode (for testing)

```bash
npx tsx podcast-agent.ts --episode https://youreverydayai.com/ep-841-chatgpt-computer-history/
```

### Test mode (verify tools work without the agent)

```bash
npx tsx podcast-agent.ts --test
```

### Output

Digests are saved to `digests/` as one `.md` file per episode:
- `digests/2026-08-14-ep841.md`
- `digests/2026-08-13-ep840.md`

Each digest contains:
- Episode metadata (number, date, source URL)
- Topic-by-topic summaries with specific details (model names, pricing, benchmarks)
- Verified source links for each claim
- Key announcements section
- Optional "links to explore" section

### Scheduling (WSL cron)

Add to crontab (`crontab -e`):

```cron
# Run every weekday at 6 AM
0 6 * * 1-5 cd /home/jgraver/code/addAI/podcast-agent && npx tsx podcast-agent.ts >> /home/jgraver/code/addAI/podcast-agent/cron.log 2>&1
```

## Architecture

- **TypeScript** script using Node.js spawn to run the Pi CLI
- **Pi CLI** (`pi -p`) runs the autonomous agent with all extensions loaded
- **Qwen3.6-35B** via llama.cpp at default thinking level
- **Custom tools**: agent uses bash tool for web searches (curl to DuckDuckGo) and write tool to save digests
- **8000 char transcript limit**: keeps prompts small for reliable agent responses
- **300 second timeout**: prevents runaway execution
- **Duplicate detection**: skips episodes already processed

## How the Agent Works

The agent receives the episode transcript and:

1. **Identifies topics** - Scans the transcript for major segments (typically 5-8 topics)
2. **Researches each topic** - Uses curl to search DuckDuckGo for official source links
3. **Compiles the digest** - Writes a structured Markdown document
4. **Self-verifies** - Checks every claim has a supporting link
5. **Saves the digest** - Writes to `digests/YYYY-MM-DD-epNNN.md`

## Configuration

Edit `podcast-agent.ts` to change:

- `RSS_FEED_URL` - the podcast RSS feed URL
- `DIGESTS_DIR` - output directory for digests
- `MAX_TRANSCRIPT_CHARS` - maximum transcript size sent to agent
- `PI_TIMEOUT_MS` - maximum agent execution time
- `PI_CLI` - path to Pi CLI binary

## Known Limitations

- **Episode pages**: Only episodes up to ~841 have individual pages with transcripts. Newer episodes (842+) don't have pages yet - the agent will report this and skip.
- **Transcript size**: Limited to 8000 chars for reliable agent responses. The beginning of the transcript (most important content) is kept.
- **Web search**: Uses DuckDuckGo HTML endpoint (free, no API key needed). May not find all sources.
- **Model**: Uses Qwen3.6-35B via llama.cpp. Strong for summarization but may miss nuanced details that stronger models (Claude, GPT) could catch.

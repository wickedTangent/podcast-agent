# Podcast Agent

Autonomous AI agent that fetches, analyzes, and summarizes podcast episodes into structured Markdown digests with verified source links.

## Architecture

- **Generic runner** (`podcast-agent.ts`) works with any podcast
- **Per-podcast configs** (`podcasts/<name>/config.json`) define podcast-specific settings
- **Per-podcast digests** (`podcasts/<name>/digests/`) store episode summaries

## Usage

```bash
# Process latest episode from a podcast
npx tsx podcast-agent.ts --podcast everyday-ai --latest

# Process a specific episode by URL
npx tsx podcast-agent.ts --podcast everyday-ai --episode <url>

# Process a specific episode from a different podcast
npx tsx podcast-agent.ts --podcast the-startup-ideas --episode <url>

# Test mode (verify config, transcript scraping, web search)
npx tsx podcast-agent.ts --podcast everyday-ai --test
```

## Adding a New Podcast

1. Create a directory: `mkdir -p podcasts/<podcast-name>/digests`
2. Create a config file: `podcasts/<podcast-name>/config.json`
3. Run the agent: `npx tsx podcast-agent.ts --podcast <podcast-name> --episode <url>`

### Config File Structure

```json
{
  "name": "Podcast Name",
  "host": "Host Name",
  "website": "https://example.com",
  "rss": "https://feeds.example.com/podcast.rss",
  "transcriptSource": "website|podscripts",
  "transcriptPattern": {
    "type": "regex",
    "pattern": "Your regex pattern here"
  },
  "episodeNumberPattern": "ep-(\\d+)",
  "agentPrompt": {
    "intro": "You are a podcast research agent...",
    "format": "markdown",
    "sections": ["topics", "announcements", "links"]
  }
}
```

## Transcript Sources

- **website** -- Transcript embedded in episode page HTML (e.g., Everyday AI Podcast)
- **podscripts** -- Transcript from podscripts.co (e.g., The Startup Ideas Podcast)

## Directory Structure

```
podcast-agent/
  podcast-agent.ts          # Generic runner
  package.json
  tsconfig.json
  podcasts/
    everyday-ai/
      config.json           # Podcast-specific settings
      digests/              # Episode digests
    the-startup-ideas-podcast/
      config.json
      digests/
```

## How It Works

1. **Fetch episode info** -- RSS feed or manual URL
2. **Scrape transcript** -- Extract text using configured pattern
3. **Run Pi agent** -- Full transcript sent to Qwen3.6 via Pi CLI
4. **Agent researches** -- Identifies topics, searches for sources, writes digest
5. **Save digest** -- Structured Markdown with verified links

## Constraints

- Uses Pi CLI (not SDK) for llama.cpp extension loading
- Full transcripts (no artificial truncation)
- Zero hallucinations: every claim must have a real link
- Local skip: skips episodes that already have a digest
- No em-dashes in code or output

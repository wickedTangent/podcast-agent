@AGENTS.md
@DESIGN.md

## Project Summary

Podcast Agent: Generic autonomous AI agent that fetches, analyzes, and summarizes podcast episodes into structured Markdown digests with verified source links.

**Run:** `npx tsx podcast-agent.ts --podcast <name> [--episode <url> | --latest | --test]`
**Test:** `npm test` (runs everyday-ai test)
**Specific episode:** `npx tsx podcast-agent.ts --podcast <name> --episode <url>`

**Key files:**
- `podcast-agent.ts` - Generic runner (all logic in one file)
- `DESIGN.md` - Full design doc, technical decisions, troubleshooting log, SDK learnings
- `CLAUDE.md` - Session context summary
- `podcasts/<name>/config.json` - Per-podcast configuration
- `podcasts/<name>/digests/` - Per-podcast episode digests

**Architecture:** TypeScript script spawns Pi CLI (`pi -p @file`) which runs Qwen3.6 via llama.cpp as an autonomous agent. Agent identifies topics from transcript, researches with web searches, compiles structured digest with verified links.

**Biggest lesson:** SDK doesn't load llama.cpp extension. Must use CLI for llama.cpp models. SDK works for API-based models.

**Current podcasts:**
- `everyday-ai` - Everyday AI Podcast (Jordan Wilson) - RSS feed + website transcript
- `the-startup-ideas-podcast` - The Startup Ideas Podcast (Greg) - podscripts.co transcript

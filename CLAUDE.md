@AGENTS.md
@DESIGN.md

## Project Summary

Podcast Agent: Autonomous AI agent that fetches, analyzes, and summarizes the Everyday AI Podcast.

**Run:** `npx tsx podcast-agent.ts`
**Test:** `npx tsx podcast-agent.ts --test`
**Specific episode:** `npx tsx podcast-agent.ts --episode <url>`

**Key files:**
- `podcast-agent.ts` - Main script (all logic in one file)
- `DESIGN.md` - Full design doc, technical decisions, troubleshooting log, SDK learnings
- `digests/` - Output directory (one .md per episode)

**Architecture:** TypeScript script spawns Pi CLI (`pi -p @file`) which runs Qwen3.6 via llama.cpp as an autonomous agent. Agent identifies topics from transcript, researches with web searches, compiles structured digest with verified links.

**Biggest lesson:** SDK doesn't load llama.cpp extension. Must use CLI for llama.cpp models. SDK works for API-based models.

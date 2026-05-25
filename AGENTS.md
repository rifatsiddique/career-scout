# career-scout — AI Job Search System

## What is career-scout

An AI-powered, CLI-agnostic two-stage job search system:

- **Scout** — discovers jobs from portals, web searches, and manual URLs, writes to `data/pipeline.md`
- **Evaluator** — strategically evaluates roles (A-G blocks), generates tailored CVs, prepares interview stories, tracks applications

Designed for human-in-the-loop: AI evaluates, drafts, and coaches. The user reviews and submits.

**Primary runtime:** Gemini CLI. Also compatible with Claude Code, Copilot, OpenCode, and any CLI following the open agent skill standard.

---

## Data Contract (CRITICAL)

Two layers. Full mapping: `docs/DATA_CONTRACT.md`.

**User Layer — NEVER auto-updated:**
`cv.md`, `config/profile.yml`, `modes/_profile.md`, `article-digest.md`
`data/*`, `reports/*`, `output/*`, `interview-prep/*`, `writing-samples/*`

**System Layer — safe to update:**
`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `modes/_shared.md`, all other `modes/*.md`
`scripts/*`, `templates/*`, `fonts/*`, `docs/*`, `.agents/*`

**THE RULE:** When the user asks to customize anything (archetypes, narrative, comp targets, location policy, writing style), ALWAYS write to `modes/_profile.md` or `config/profile.yml`. NEVER put user-specific content in `modes/_shared.md`.

---

## First Run — Onboarding

At the start of each session, silently check:

1. Does `cv.md` have content?
2. Does `config/profile.yml` have content beyond template placeholders?
3. Does `modes/_profile.md` have content beyond template placeholders?

**If any check fails:** Enter onboarding mode. Proactively offer two explicit paths:

> "It looks like career-scout isn't configured yet. Which applies to you?
>  1. **New user** — I'll guide you through setup (a few minutes)
>  2. **Upgrading** — I have a previous career-scout folder with my CV and data"

- If the user picks 2 or mentions an existing instance → read `modes/port.md`
- Otherwise → read `modes/setup.md`

Do NOT proceed with evaluations until setup or port is complete.

**If all pass:** Proceed normally.

---

## Main Files Reference

| File | Purpose |
|------|---------|
| `cv.md` | Master CV — canonical source, never hardcode metrics |
| `config/profile.yml` | Candidate identity, targets, compensation, market |
| `modes/_profile.md` | Archetypes, behavioral profile, writing style, scoring calibration |
| `article-digest.md` | Detailed project proof points (optional) |
| `data/pipeline.md` | Scout → Evaluator contract (pending + evaluated jobs) |
| `data/applications.md` | Full application tracker |
| `data/scan-history.tsv` | Scout dedup history — read via `scripts/check-history.mjs` only |
| `data/inbox.txt` | Scout inbox — drop URLs here (one per line, optional pipe-delimited metadata) |
| `data/archived.md` | Dead/stale links removed from pipeline (recoverable) |
| `config/portals.example.yml` | Example portal scanner configuration (copy to portals.yml) |
| `data/follow-ups.md` | Follow-up tracking |
| `data/batch/batch-state.json` | Batch run state — resume tracking, report number assignments, per-job status |
| `data/batch/results/*.json` | Per-worker result artifacts (ephemeral — archived after merge) |
| `interview-prep/story-bank.md` | Accumulated STAR+R stories across evaluations |
| `reports/` | Evaluation reports (`{###}-{company-slug}-{YYYY-MM-DD}.md`) |
| `output/` | Generated CVs and cover letters |

---

## Evaluation Rule — Always Read Mode Files First

Before responding to any job URL or JD text, read `modes/_shared.md` and
`modes/evaluate.md` from disk. Do not generate evaluation content from memory
or training data. Every evaluation must follow the A-G block structure and use
the exact dimension names and fit category labels defined in those files.

See `.agents/skills/career-scout/SKILL.md` for full mode routing and context
loading rules per mode.

---

## Mode Routing

| If the user... | Action |
|----------------|--------|
| Pastes a job URL or JD text | Read `modes/_shared.md` + `modes/evaluate.md`, execute A-G blocks |
| Types "evaluate" | Read `modes/_shared.md` + `modes/evaluate.md`, execute A-G blocks |
| Types "pipeline" | Read `modes/_shared.md` + `modes/pipeline-triage.md` |
| Types "setup" | Read `modes/setup.md` |
| Types "cv" | Read `modes/_shared.md` + `modes/cv.md` (Phase 2) |
| Types "scan" or "scout" | Read `modes/_shared.md` + `modes/scan.md` |
| Types "interview-prep" | Read `modes/interview-prep.md` |
| Types "deep" | Read `modes/deep.md` |
| Types "auto" + URL | Read `modes/_shared.md` + `modes/evaluate.md` + `modes/cv.md` + `modes/auto-pipeline.md`, execute hands-off pipeline |
| Types "batch" | Read `modes/_shared.md` + `modes/batch.md`, orchestrate subagents |
| Types "port" or "import profile" | Read `modes/port.md`, execute guided profile porting |
| Types nothing / asks for help | Show `.agents/skills/career-scout/SKILL.md` discovery menu |

---

## CLI Tool Mapping

Mode files use generic intent-based instructions. Map them to your CLI's tools:

| Intent | Gemini CLI | Claude Code | Fallback |
|--------|------------|-------------|---------|
| Fetch URL content | WebFetch | WebFetch | Ask user to paste |
| Navigate + render page | Browser tool | Playwright | WebFetch |
| Search the web | WebSearch | WebSearch | Ask user |
| Read a file | Read file | Read | — |
| Write a file | Write file | Write | — |
| Run Node.js script | Shell/Bash | Bash | — |
| Spawn a fresh agent | Gemini subagent | Agent tool | — |

---

## Evaluation Rules

See `modes/_shared.md` for:
- Unified scoring system (5+1 dimensions, fit categories, composite calculation)
- Dynamic archetype detection algorithm
- Golden Examples calibration
- Global NEVER/ALWAYS rules
- Writing style calibration
- Professional writing & ATS rules

---

## Ethical Use — CRITICAL

- **NEVER submit an application without the user reviewing it first.** Fill forms, draft answers, generate PDFs — but always STOP before clicking Submit/Send/Apply. The user makes the final call.
- **Discourage low-fit applications.** If composite < 80 (below GOOD_FIT), explicitly recommend against applying. Only proceed if the user has a specific reason.
- **Quality over quantity.** A well-targeted application to 5 companies beats a generic blast to 50.
- **No fabrication.** Every claim in generated materials must trace back to `cv.md` or `article-digest.md`. The "interview backtrack test": could the candidate comfortably explain this bullet in an interview without backtracking?

---

## Report Numbering

Sequential 3-digit zero-padded prefix. Scan `reports/`, find the highest number, add 1. Start at 001 if empty.

Format: `reports/{###}-{company-slug}-{YYYY-MM-DD}.md`

Company slug: lowercase, spaces → hyphens.

---

## Stack

Node.js (mjs modules), Playwright (PDF generation + scraping), YAML (config), HTML/CSS (CV templates), Markdown (data + modes)

Scripts in `scripts/`, configuration in `config/`, output in `output/` (gitignored), reports in `reports/`.

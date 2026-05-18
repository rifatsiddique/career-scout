---
name: career-scout
description: AI-powered job search system — evaluate offers, triage pipeline, configure profile
arguments: mode
user-invocable: true
argument-hint: "[evaluate | pipeline | setup | cv | scan | interview-prep | batch | auto]"
---

# career-scout — Router

## Mode Routing

Determine mode from `$mode`:

| Input | Mode |
|-------|------|
| (empty / no args) | `discovery` — show command menu |
| JD text or URL (no sub-command) | `evaluate` — auto-detected |
| `evaluate` | `evaluate` |
| `pipeline` | `pipeline-triage` |
| `setup` | `setup` |
| `cv` | `cv` (Phase 2) |
| `scan` or `scout` | `scan` |
| `interview-prep` | `interview-prep` (Phase 4) |
| `auto` | `auto-pipeline` (Phase 5) |
| `batch` | `batch` (Phase 5) |
| `followup` | `followup` (Phase 5) |

**Auto-detection:** If `$mode` is not a known sub-command AND contains a job
posting URL (path segments: jobs/, careers/, posting/, opening/) or JD text
(keywords: "responsibilities", "requirements", "qualifications", "about the
role", "we're looking for"), route to `evaluate`.

If `$mode` is unrecognized and doesn't look like a JD or URL, show discovery.

---

## Discovery Mode (no arguments)

Show this menu:

```
career-scout — Command Center

  /career-scout [URL or JD text]   → EVALUATE: full A-G analysis + report + tracker
  /career-scout evaluate           → Evaluation mode (same as pasting URL/JD directly)
  /career-scout pipeline           → Process pending URLs from data/pipeline.md
  /career-scout setup              → Guided profile creation / update archetypes / recalibrate
  /career-scout cv                 → Generate tailored PDF CV from latest evaluation
  /career-scout cv --fast          → Draft HTML only, no reviewer or PDF (for manual editing)

  /career-scout scan                  → Full discovery run (all configured companies)
  /career-scout scan --fast           → Priority run (companies marked priority: true)
  /career-scout scan --sources TYPE   → Scan specific portal types (greenhouse, ashby, lever)
  /career-scout scan --dry-run        → Preview without writing files
  /career-scout scan --import FILE    → Import jobs from CSV file
  /career-scout scan --company NAME   → Scan a single company only
  /career-scout scan --clean          → Force stale check now
  /career-scout scan --new-chapter    → Archive old data and start fresh search
  /career-scout scan --help           → Show flag reference

  Coming soon:
  /career-scout interview-prep     → STAR+R prep for a specific company (Phase 4)
  /career-scout auto               → Full pipeline: evaluate + CV + track (Phase 5)
  /career-scout batch              → Parallel evaluation of multiple URLs (Phase 5)

Inbox: add URLs to data/pipeline.md → /career-scout pipeline
```

---

## Context Loading by Mode

After routing, load the required files before executing:

### Modes that require `_shared.md` + their mode file

Read `modes/_shared.md` first, then `modes/{mode-file}`.

| Mode | Mode file |
|------|-----------|
| `evaluate` | `modes/evaluate.md` |
| `pipeline-triage` | `modes/pipeline-triage.md` |
| `cv` | `modes/cv.md` |
| `scan` | `modes/scan.md` |
| `auto-pipeline` | `modes/auto-pipeline.md` + `modes/evaluate.md` |
| `batch` | `modes/batch.md` |

### Standalone modes (mode file only)

Read only `modes/{mode-file}`.

| Mode | Mode file |
|------|-----------|
| `setup` | `modes/setup.md` |
| `interview-prep` | `modes/interview-prep.md` |
| `followup` | `modes/followup.md` |

### All modes: also read user data

Read `config/profile.yml` and `modes/_profile.md` as candidate context before
executing any mode. If either is missing or empty, prompt the user to run setup.

---

## Prerequisites

- Node.js >= 18 (`scripts/check-history.mjs` + Phase 2+ PDF generation)
- Playwright + Chromium — Phase 2+ only: `npx playwright install chromium`
- Profile configured: `config/profile.yml` + `modes/_profile.md`
- Master CV written: `cv.md`

## Phase Status

| Phase | Status | Modes available |
|-------|--------|----------------|
| 1: Foundation | **Active** | evaluate, pipeline, setup |
| 2: CV Generation | **Active** | cv, cv --fast |
| 3: Scout | **Active** | scan, scout |
| 4: Interview Prep | Planned | interview-prep |
| 5: Auto-Pipeline + Batch | Planned | auto, batch, followup |

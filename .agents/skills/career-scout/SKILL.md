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
| `interview-prep` | `interview-prep` |
| `deep` | `deep` |
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

  /career-scout [URL or JD text]   → Analyze this job — fit score, CV tips, interview prep
  /career-scout evaluate           → Analyze a job (same as pasting URL directly)
  /career-scout pipeline           → Review jobs in your queue (data/pipeline.md)
  /career-scout setup              → Set up your profile / update job types and targets
  /career-scout cv                 → Generate a tailored PDF resume for the last job you analyzed
  /career-scout cv --fast          → Quick editable draft (no PDF — for manual tweaks)

  /career-scout scan                  → Search all your companies for new jobs
  /career-scout scan --fast           → Quick check — your favorite companies only
  /career-scout scan --sources TYPE   → Search one job board type (greenhouse, ashby, lever)
  /career-scout scan --dry-run        → Preview what a search would find (nothing is saved)
  /career-scout scan --import FILE    → Add jobs from a spreadsheet or CSV
  /career-scout scan --company NAME   → Search just one company
  /career-scout scan --clean          → Check for dead/expired job links right now
  /career-scout scan --new-chapter    → Archive your old search history and start fresh
  /career-scout scan --discover       → Find companies that match your background
  /career-scout scan --discover --focus X  → Search for companies in a specific industry
  /career-scout scan --help           → Show all options with examples

  /career-scout interview-prep <company>            → Full interview prep doc — questions, story mapping, cheatsheet
  /career-scout interview-prep <company> --tldr     → Print Pre-Flight Cheatsheet to terminal (10-min pre-call review)
  /career-scout interview-prep --bank-review        → Curate story bank — dedup, sharpen weak stories, upgrade schema
  /career-scout interview-prep --debrief <company>  → Post-interview capture — what was asked, what worked, lessons
  /career-scout deep <company>                      → Strategic company research — direction, culture, candidate angle

  Coming soon:
  /career-scout auto               → Full pipeline: evaluate + CV + track (Phase 5)
  /career-scout batch              → Parallel evaluation of multiple URLs (Phase 5)

Drop job URLs in data/inbox.txt → run /career-scout scan → /career-scout pipeline to review
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
| `deep` | `modes/deep.md` |
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
| 4: Interview Prep | **Active** | interview-prep, deep |
| 5: Auto-Pipeline + Batch | Planned | auto, batch, followup |

# career-scout

AI-powered job search system with two stages: Scout (discovery) and Evaluator (analysis + CV + prep).

## Triggers

- User pastes a job URL or job description text
- User invokes a mode by name (evaluate, cv, scan, interview-prep, pipeline, batch, setup, auto)

## Mode Routing

| Input | Mode | Files loaded |
|-------|------|-------------|
| (empty / help) | discovery | Show AGENTS.md routing table |
| URL or JD text (Phase 1) | evaluate | `modes/_shared.md` + `modes/evaluate.md` |
| `evaluate` | evaluate | `modes/_shared.md` + `modes/evaluate.md` |
| `pipeline` | pipeline-triage | `modes/_shared.md` + `modes/pipeline-triage.md` |
| `setup` | setup | `modes/setup.md` |
| `cv` | cv (Phase 2) | `modes/_shared.md` + `modes/cv.md` |
| `scan` | scan (Phase 3) | `modes/_shared.md` + `modes/scan.md` |
| `interview-prep` | interview-prep (Phase 4) | `modes/interview-prep.md` |
| `auto` | auto-pipeline (Phase 5) | `modes/_shared.md` + `modes/auto-pipeline.md` + `modes/evaluate.md` |
| `batch` | batch (Phase 5) | `modes/_shared.md` + `modes/batch.md` |
| `followup` | followup (Phase 5) | `modes/followup.md` |

## Auto-Detection (Phase 1)

A URL or pasted JD text is routed to **evaluate** mode automatically. Do NOT auto-detect based on keywords alone (risk of false positives). Require either a URL or explicit `evaluate` command.

## Context Loading Rules

- **evaluate:** Read `modes/_shared.md` first (scoring system, archetype detection, global rules), then `modes/evaluate.md`
- **pipeline:** Read `modes/_shared.md` first, then `modes/pipeline-triage.md`
- **setup:** Read `modes/setup.md` only (self-contained)
- All modes: Read `config/profile.yml` and `modes/_profile.md` as context (user data)

## Prerequisites

- Node.js >= 18 (for `scripts/check-history.mjs` and future PDF generation)
- Playwright + Chromium (`npx playwright install chromium`) — required for Phase 2+ PDF generation
- Candidate profile configured (`config/profile.yml` + `modes/_profile.md`)
- Master CV written (`cv.md`)

## Phase Status

| Phase | Status | Modes |
|-------|--------|-------|
| Phase 1: Foundation | **Active** | evaluate, pipeline, setup |
| Phase 2: CV Generation | Planned | cv |
| Phase 3: Scout | Planned | scan |
| Phase 4: Interview Prep | Planned | interview-prep |
| Phase 5: Auto-Pipeline + Batch | Planned | auto, batch, followup |

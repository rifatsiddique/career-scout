# Plan: Phase 4 UX Retrofit Sweep

**Version:** 1.0
**Date:** 2026-05-22
**Parent Plan:** CONSOLIDATION-PLAN.md §11, Phase 4 retrofit sweep
**Depends on:** phase4-interview-prep.md v1.2 (P1-P6 conventions locked, documented in `modes/_shared.md`)

## Purpose

Apply UX Conventions P1-P6 (defined in `modes/_shared.md`) to the three existing modes
that predate Phase 4 and don't yet emit clickable paths, next-step blocks, or cross-mode nudges.

This is not a design pass — the conventions are already locked and Gemini-reviewed.
This is a mechanical application of known patterns to three files.

## Scope

| Mode file | What changes |
|-----------|-------------|
| `modes/cv.md` | P1 (PDF path), P2 (next steps: review PDF, then interview-prep after submit), P3 (interview-prep nudge when fit ≥ GOOD_FIT+) |
| `modes/scan.md` | P1 (pipeline.md path after scan), P2 (next step: pipeline → evaluate), no P3 |
| `modes/pipeline-triage.md` | P3 only: when scanning rows, detect Interview-status entries with no matching `interview-prep/{slug}.md` file → print single-line nudge |

Modes already handled in Phase 4 main commit:
- `modes/evaluate.md` — P1/P2/P3 added to end-of-mode output ✅
- `modes/setup.md` — P2 added ✅
- `modes/interview-prep.md` — all P1-P6 native ✅
- `modes/_shared.md` — P1-P6 documented ✅

Out of scope for this sweep:
- One-time editor-opening hint in setup.md (low value, deferred)
- `modes/deep.md` — new file, already has P1+P2 ✅

## Exact changes per file

### modes/cv.md

At the end of the CV generation workflow (after PDF is confirmed written), add:

```
📂 CV: file:///{absolute-path}/output/{cv-filename}.pdf

What to do next:
  1. Open the PDF above and review before submitting
  2. Submit your application — then update your status → pipeline
  3. Once they schedule an interview, run → interview-prep {company-slug}

💡 [P3 nudge — only if fit is GOOD_FIT+ (≥ 80)]:
   After submitting and landing an interview → interview-prep {company-slug}
```

Also add P6 if cv mode writes to any User Layer files mid-workflow (check for
any status updates it makes to applications.md).

### modes/scan.md

At the end of every scan run (after jobs are appended to pipeline.md), add:

```
📂 Pipeline: file:///{absolute-path}/data/pipeline.md

What to do next:
  1. Review new jobs → pipeline
  2. Evaluate a specific job → paste the URL or run evaluate
  3. Run again tomorrow → scan --fast (priority companies only)
```

Also: scan writes to pipeline.md (User Layer). If it appends new rows, wrap in P6:
```
⚠️ This will update data/pipeline.md (adding {N} new jobs).
   A backup has been saved to pipeline.md.bak.
   Proceed? [y/N]
```
Check current scan.md to see if it already has a confirmation pattern — if so, align it to P6 format.

### modes/pipeline-triage.md

Add P3 nudge logic at the scan/display step:

When reading `data/applications.md` rows, check each row where status = `Interview`:
- Compute the expected prep doc path: `interview-prep/{company-slug}-{role-slug}.md`
- If that file does not exist: print a single-line nudge (one per missing prep doc, max 3):

```
💡 {Company} is at Interview status — no prep doc yet. Run: interview-prep {company-slug}
```

Never stack more than 3 nudges. If there are 4+ missing prep docs, show 3 and add:
"... and {N} more. Run: pipeline to see all."

Also add P2 at the end of the triage run:
```
What to do next:
  1. Evaluate the top pending job → paste its URL
  2. Generate a CV for a role you're moving forward on → cv
  3. Update a job status → tell me: "move {company} to {status}"
```

## Testing

- T-cv-1: After `cv` completes, verify P1 path printed and P2 block has interview-prep hint.
- T-cv-2: Verify P3 nudge only appears for GOOD_FIT+ (≥ 80), not for PARTIAL or below.
- T-scan-1: After `scan` completes, verify P1 path is pipeline.md and P2 has pipeline as step 1.
- T-pt-1: Plant an Interview-status row in applications.md with no matching prep file. Run pipeline-triage. Verify single-line nudge appears.
- T-pt-2: All Interview rows have matching prep files. Run pipeline-triage. Verify no nudge appears.
- T-pt-3: 5 Interview rows missing prep docs. Verify exactly 3 nudges + "and N more" summary.

## Commit plan

Single commit: all three mode files + CONSOLIDATION-PLAN.md update (final Phase 4 items ticked).

No Gemini review needed — conventions are already locked and reviewed. The changes are
additive to existing mode files (new terminal output lines at the end of workflows,
one new conditional check in pipeline-triage). They do not touch the evaluation logic,
CV generation logic, or scan logic.

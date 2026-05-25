# Mode: auto-pipeline — Hands-Off Evaluate + CV + Track

Runs the full career-scout pipeline (evaluate → CV → tracker update → pipeline move) in one
unattended pass. The user reviews only the finished PDF; no interactive checkpoints.

**Loads (read before executing):**
`modes/_shared.md` → `modes/evaluate.md` → `modes/cv.md` → `modes/auto-pipeline.md`

---

## Flags

| Flag | Effect |
|------|--------|
| `--batch` | Non-interactive worker mode. Write result to `data/batch/results/{id}.json` and echo the same JSON as the final message. No prose output. Auto-confirm all User Layer writes (`.bak` still written). Do NOT write `applications.md` or `pipeline.md` directly. Requires `--report-num` and `--id`. Implies `--yes`. |
| `--report-num=NNN` | Use this pre-assigned report number instead of self-scanning `reports/`. Batch orchestrator sets this to avoid report-number races. Ignored in interactive mode (self-assigns). |
| `--id=N` | Worker ID — used to name the result file `data/batch/results/{id}.json`. Required with `--batch`. |
| `--yes` / `--no-confirm` | Auto-confirm P6 User Layer write prompts (`.bak` still written). |
| `--template=X` | Pass-through to cv step. |
| `--docx` / `--docx-only` | Pass-through to cv step. |

`--fast` is not supported. `auto` is the opposite intent — full review quality, not a quick draft.

---

## Step 0 — Setup

1. Parse flags from the invocation args.
2. Extract the JD (reuse evaluate.md Step 0b: URL → navigate+extract; text → use directly).
   - Note the source URL (or "pasted text").
3. Detect whether the URL exists in `data/pipeline.md` under `## Pending`.
   - Store boolean `URL_IN_PENDING` for use in Step 4.
4. If `--batch`:
   - Validate `--report-num` and `--id` are present. If either is missing, write a failed result and stop:
     `{"status":"failed","error":"--batch requires --report-num and --id",...}`
5. If not `--batch` and no `--report-num`: self-assign report number (scan `reports/`, find max prefix, add 1, zero-pad to 3 digits — same as evaluate.md Step 0d).

---

## Step 1 — Evaluate

Read and follow `modes/evaluate.md` in full.

- Execute all A–G blocks exactly as evaluate.md defines them.
- This step produces: report `.md` + HTML, `applications.md` row, composite score,
  fit category, archetype, legitimacy tier, and `REPORT_NUM`.
- Report number: use `--report-num` value if supplied, otherwise the self-assigned number from Step 0.
- Print the standard evaluation summary output (evaluate.md "Evaluation Complete" block).

---

## Step 2 — Score gate

Read `config/profile.yml → auto.min_cv_score`. If the key is absent, default to **80**.

| Condition | Action |
|-----------|--------|
| Location gate = FAIL | Stop after evaluation. No CV. State the location contradiction. Pipeline row still moved (Step 4). |
| composite < `auto.min_cv_score` | Skip CV. Print the educational skip note below. Pipeline row still moved (Step 4). |
| composite ≥ `auto.min_cv_score` | Proceed to Step 3 automatically — no interactive prompt. |

**Educational skip note** (print when composite < threshold):

```
⚠️  Scored {N}/100 ({CATEGORY}) — skipping CV generation.
    Why? auto defaults to a high bar ({min}+) so your effort and API spend
    go to high-fit roles, not long-shots.

    To proceed anyway:
      • One-off:    cv {company-slug}
      • Permanent:  set  auto.min_cv_score: 65  in config/profile.yml
```

(The config path is `auto.min_cv_score`, not `cv.*`.)

---

## Step 3 — Generate CV (non-interactive posture)

Read and follow `modes/cv.md`, with these posture changes:

### Contact audit
- cv.md Step 0d printout runs as normal.
- Run `node scripts/audit-contact.mjs` (cv.md Step 5a).
- **No pause on a clean audit (exit 0 or exit 1 warnings).** Continue automatically.
- If `audit-contact.mjs` exits **2** (fabrication or unfilled placeholder detected):
  - Halt CV generation immediately.
  - Keep the evaluation report, tracker row, and pipeline state intact.
  - Mark PDF as pending.
  - In interactive mode: print the failure and stop at Step 3.
  - In `--batch` mode: write `status:"failed"`, `error:"contact-audit-failed"` to the result JSON and stop.

### Drafter-reviewer
- Runs normally. The reviewer sub-agent is always active here because the score gate (≥ min_cv_score, default 80 = GOOD_FIT+) ensures reviewer quality.

### Review & Confirm (cv.md Step 4) — non-blocking
- Do NOT stop and wait for the user.
- Apply the draft as-is.
- Collect all flagged rewordings (items the reviewer marked as judgment-call changes).
- Write the flag list to report Section I (as cv.md Step 4 normally does).
- Carry the flags forward to Step 5 for the summary.

### PDF generation
- Run Playwright PDF generation + overflow handling per cv.md (max 2 runs).
- Run `cv-compare.mjs` and capture any added-bullet warnings.
- Update `applications.md` PDF column to ✅ on success (if not `--batch`).

---

## Step 4 — Move pipeline row

If `URL_IN_PENDING` is true (URL was in `data/pipeline.md` under `## Pending`):
- Move the row from `## Pending` to `## Evaluated` with updated columns:
  `# | URL | Company | Role | Score | Fit | Status=Evaluated | Report | PDF | Notes`
- **Idempotent:** search the whole file; if the URL is already in `## Evaluated`, no-op (no duplicate, no error).
- Write `.bak` of `pipeline.md` before modifying.
- In interactive mode: P6 write-confirm prompt is auto-confirmed (same as `--yes`). This is deliberate — `auto` is hands-off; the `.bak` provides the safety net.
- In `--batch` mode: skip this step. The batch orchestrator's `merge-tracker.mjs` handles the move.

---

## Step 5 — Final summary (interactive mode only)

Print once. This is the only review point.

```
## Auto-Pipeline Complete — {Company}: {Role}

Score: {N}/100 → {display}/5   Fit: {CATEGORY}   Legitimacy: {tier}

Top strengths: 1) … 2) … 3) …
Top gaps:      1) … (+mitigation) 2) … 3) …

CV: {pages}-page PDF
📂 Open: file:///{absolute-path}/output/cv-{lastname}-{slug}-{date}.pdf
   Path: output/cv-{lastname}-{slug}-{date}.pdf

⚠️ Flagged rewordings (your call):
   1. '{reworded}' ← original: '{cv.md text}'
   2. …
   (or: none — all rewording passed the backtrack test)

⚠️ Added content not in master CV (cv-compare): {n items, or none}

Contact audit: passed

💡 To change any wording or add detail (two paths):
   • Quick:  edit output/draft-{slug}.html, then recompile only:
             node scripts/generate-pdf.mjs output/draft-{slug}.html output/cv-{lastname}-{slug}-{date}.pdf
   • Full:   re-run  cv {slug}  (re-runs drafter-reviewer from the report)

What to do next:
  1. Open the PDF above and review before submitting
  2. Submit your application, then update status → pipeline
  3. [if ≥80] Once they schedule an interview → interview-prep {slug}

Reminder: nothing was submitted. You make the final call.
```

Omit sections that do not apply (e.g. if no flags, omit the flags block; if no added content, state "none").

---

## Step 6 — Write result JSON (`--batch` mode only)

Build the result object from all data gathered in Steps 0–4:

```json
{
  "status": "completed",
  "id": "{id}",
  "report_num": "{NNN}",
  "date": "{YYYY-MM-DD}",
  "company": "{company}",
  "role": "{role}",
  "score": {composite},
  "display": "{x.x}",
  "fit": "{FIT_CATEGORY}",
  "legitimacy": "{tier}",
  "status_label": "Evaluated",
  "pdf": "output/cv-{lastname}-{slug}-{date}.pdf",
  "pdf_ok": true,
  "report": "reports/{NNN}-{slug}-{date}.md",
  "url": "{source-url}",
  "notes": "{top strength or reason for skip}",
  "flags": {count-of-flagged-rewordings},
  "error": null
}
```

On any failure (contact audit exit 2, PDF error, unrecoverable exception):
- Set `"status": "failed"`, populate `"error"` with a brief reason, null the pdf/pdf_ok fields.
- Keep `"report"` if the `.md` was written before the failure.

Steps:
1. Write the JSON object to `data/batch/results/{id}.json`. Create parent dirs if needed.
2. Echo the same JSON object as the final message (fallback channel for the orchestrator).
3. Write no other prose output.

---

## Global rules (always apply)

- **Never auto-submit.** No form fills, no submit/apply button clicks. The user makes the final call.
- **No fabrication.** Every claim in generated CV materials must trace back to `cv.md` or `article-digest.md`.
- **Contact-info fabrication is a hard stop.** Audit exit 2 halts CV generation in all modes.
- **Backtrack-test "Never" items** are silently removed (already automatic in cv.md Step 1k).
- **P6 User Layer write confirmation** is auto-confirmed in `auto` (`.bak` written). Interactive users who want explicit confirmation should use `cv` directly.

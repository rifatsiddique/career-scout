# Phase 5: Auto-Pipeline + Batch

**Version:** 1.4 (profile preflight gate + scope split)
**Last Updated:** 2026-05-25 — (1) added batch profile-completeness preflight (§4.3 Step 0) — fail fast before dispatch if the profile isn't set up; (2) split the two cross-phase Phase 2 touch-ups (`generate-pdf.mjs` launch-retry, `cv.md` Step 3a fuzzy-match) out of Phase 5 into a deferred follow-up (§10). Prior: v1.3 round-3 runtime hardening.
**Status:** Reviewed (3 rounds) — ready to implement
**Depends on:** Phases 1-4 (evaluate, cv, scan, interview-prep) — all complete
**Scope:** `modes/auto-pipeline.md`, `modes/batch.md`, `scripts/merge-tracker.mjs`, `scripts/verify-pipeline.mjs`, routing + config + docs

> **Note:** `followup` mode is listed alongside auto/batch in SKILL.md's "coming soon" but is NOT in scope here. The consolidation plan Phase 5 section covers only auto + batch + verify-pipeline. Followup is tracked separately.

---

## 1. Goal

Close the loop on the "one command does everything" vision:

- **`auto <url>`** — paste a job URL, get a full evaluation + tailored CV + tracker update + pipeline move, hands-off, ending at a single review of the finished PDF.
- **`batch`** — process ~10 pending URLs in parallel via fresh-context subagents, then merge results into the trackers.

---

## 2. Decisions locked with the user (before this draft)

These two forks were decided in conversation; Gemini should review the *consequences* in the design, not relitigate the choices unless a hard problem surfaces.

### Decision A — `auto` is hands-off (review only the final PDF)

The user does NOT want a checkpoint gate between evaluate and cv. `auto` runs end-to-end; the user reviews the finished PDF, not intermediate steps.

cv.md today has two interactive STOP points. In `auto` they change posture:

| cv.md mechanism | Interactive cv behavior | `auto` behavior |
|-----------------|------------------------|-----------------|
| Contact audit (`audit-contact.mjs`, exit 2 = fabrication/placeholder) | Pause + ask user to continue/pause | **Runs, but no pause.** Only halts CV generation if the script exits 2 (real fabrication). Clean audit → silent continue. |
| Review & Confirm (Step 4) | STOP, wait for user decisions on flagged rewordings | **Non-blocking.** Apply the draft as-is, write flagged rewordings to report Section I, and surface the flag list in the final summary for post-hoc veto. No mid-run pause. |

**Non-negotiable safety preserved:**
- Never auto-submits (the absolute ethical rule).
- Contact-info fabrication still hard-stops the CV step (audit exit 2).
- Backtrack-test "Never" items are still silently removed (already automatic in cv.md Step 1k).
- "Flag" items (judgment-call rewordings) are kept but listed prominently so the user can veto by re-running `cv`.
- cv-compare.mjs still runs; fabrication-candidate (added) bullets are surfaced in the summary.

### Decision B — `batch` is mode-driven subagents (CLI-agnostic)

Usage is ~90% Gemini CLI, ~10% Claude Code, ~10 URLs at a time. A career-ops-style bash runner (`claude -p` workers) is Claude-only — it cannot run on the primary CLI and would serve almost nothing. So:

- batch is a **markdown mode** that orchestrates fresh-context subagents (per the existing "Spawn a subagent" intent in `_shared.md` / AGENTS.md), one per URL.
- Each subagent runs `auto --batch` (non-interactive) on a single URL.
- The bash runner (`batch-runner.sh`) is **NOT ported.** True OS-level parallelism is unnecessary at 10 URLs and conflicts with CLI-agnosticism. If a power-user parallel runner is ever needed, it becomes a deferred 5b item.

---

## 3. Part A — `auto-pipeline` mode

**File:** `modes/auto-pipeline.md` (new)
**Loads:** `_shared.md` + `auto-pipeline.md` + `evaluate.md` + `cv.md` (orchestrates both).

### 3.1 Flags

| Flag | Effect |
|------|--------|
| `--batch` | Non-interactive worker mode: no prose, write the result to `data/batch/results/{id}.json` (and echo it as the final message), auto-confirm User Layer writes, do NOT write applications.md/pipeline.md directly. Implies `--yes`. Requires `--report-num` and `--id`. |
| `--report-num=NNN` | Use this pre-assigned report number instead of self-scanning `reports/` (set by the batch orchestrator to avoid races). Interactive mode ignores it and self-assigns. |
| `--yes` / `--no-confirm` | Auto-confirm P6 User Layer write prompts (`.bak` still written). |
| `--template=X` | Pass-through to cv. |
| `--docx` / `--docx-only` | Pass-through to cv. |

`--fast` is intentionally NOT supported — `auto` is the opposite intent. Users wanting a quick draft run `cv --fast` directly.

### 3.2 Flow (interactive / non-batch)

**Step 0 — Setup**
- Parse flags.
- Extract JD (reuse `evaluate.md` Step 0b: URL → navigate+extract; text → use directly).
- Detect whether the URL exists in `data/pipeline.md` Pending (store a flag for the Step 4 move).

**Step 1 — Evaluate (delegate to evaluate.md)**
- Execute the full A-G evaluation exactly as `evaluate.md` defines it. Do not re-implement the blocks here — read and follow `evaluate.md`.
- This yields: report `.md` + HTML (via md-to-html.mjs), an `applications.md` row, the composite score, fit category, archetype, legitimacy tier, and `REPORT_NUM`.
- Print the standard evaluate summary (Block-level "Evaluation Complete" output).

**Step 2 — Score gate (routing, no interactive prompt)**

Read `config/profile.yml → auto.min_cv_score` (default **80**).

| Condition | Action |
|-----------|--------|
| Location = FAIL | Stop after eval. No CV. Note the contradiction. |
| composite < `auto.min_cv_score` | Skip CV. Print the **educational skip note** below. |
| composite ≥ `auto.min_cv_score` | Proceed to Step 3 automatically (hands-off). |

This replaces a checkpoint gate with a configurable threshold — fully hands-off, while still honoring "discourage low-fit applications / don't waste effort."

**Educational skip note (beginner-UX, from Gemini review).** A dry "Skipping CV" reads like a bug to a new user. Explain *why* and *how to override* — turn the gate into coaching:

```
⚠️  Scored {N}/100 ({CATEGORY}) — skipping CV generation.
    Why? auto defaults to a high bar ({min}+) so your effort and API spend
    go to high-fit roles, not long-shots.

    To proceed anyway:
      • One-off:    cv {company-slug}
      • Permanent:  set  auto.min_cv_score: 65  in config/profile.yml
```

(Note the config path is `auto.min_cv_score`, NOT `cv.*`.) The pipeline row is still moved to Evaluated.

**Step 3 — Generate CV (delegate to cv.md, non-interactive posture)**
- Execute `cv.md`, with these posture changes (per Decision A):
  - Contact audit (cv Step 0d printout + Step 5a script) runs. **No pause on clean audit.** If `audit-contact.mjs` exits 2 → halt CV, keep report + tracker + pipeline state intact, mark PDF pending, report the failure. (In interactive auto: print the failure and stop; the eval is still saved.)
  - Drafter-reviewer runs normally (reviewer always active here since the gate ≥ 80 = GOOD_FIT+).
  - **Review & Confirm (cv Step 4) is non-blocking:** apply the draft, write flags to report Section I, collect the flag list for Step 5. Do NOT STOP-and-wait.
  - PDF generation + overflow handling per cv.md (max 2 Playwright runs).
  - cv-compare.mjs runs; capture added-bullet warnings.
  - applications.md PDF column → ✅.

**Step 4 — Move pipeline row**
- If the URL was in `pipeline.md` Pending: move it to Evaluated with `# | URL | Company | Role | Score | Fit | Status=Evaluated | Report | PDF | Notes`.
- P6 write: auto-confirmed in `auto` (`.bak` written). Recommendation flagged in Open Questions (#4).

**Step 5 — Single hands-off summary (the only review point)**

```
## Auto-Pipeline Complete — {Company}: {Role}

Score: {N}/100 → {display}/5   Fit: {CATEGORY}   Legitimacy: {tier}

Top strengths: 1) … 2) … 3) …
Top gaps:      1) …(+mitigation) 2) … 3) …

CV: {pages}-page PDF
📂 Open: file:///…/output/cv-{lastname}-{slug}-{date}.pdf
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

The explicit veto path (Gemini beginner-UX): a new user who dislikes a flagged rewording must know *exactly* how to fix it. The "Quick" path edits the existing draft HTML and recompiles the PDF only (no re-review); the "Full" path re-runs `cv`. Both are surfaced.

### 3.3 Flow (`--batch` worker mode)

Same Steps 0-3, but:
- Report number comes from `--report-num` (do not self-scan).
- No prose summary.
- All User Layer writes auto-confirmed (`.bak` written).
- **Do NOT write `applications.md` or `pipeline.md` directly** (race safety).
- **Write a single result artifact:** `data/batch/results/{id}.json` (see contract below). This ONE file is the worker's complete output — it serves both the orchestrator's status tracking AND `merge-tracker.mjs`'s input. Also echo the same JSON to stdout as a fallback channel.
- Contact audit exit 2 → result `status: "failed"`, do not throw; the report `.md` is still saved.

**Why a file, not just stdout (Gemini Q2+Q3, consolidated).** Subagents return a prose message, not a clean shell stream — parsing a JSON line out of conversational text is fragile. A worker-written file that the orchestrator `Read`s is deterministic. We merge Gemini's two suggestions (isolated TSV tracker line + results JSON) into **one JSON file per worker**: it preserves the write-isolation principle (each worker owns its own file — zero concurrent writes to shared markdown), and JSON avoids the tab/pipe-escaping that complicated career-ops's TSV runner. `merge-tracker.mjs` reads these JSON files directly; there is no separate TSV.

**Result contract — `data/batch/results/{id}.json`:**
```json
{"status":"completed","id":"3","report_num":"021","date":"2026-05-24","company":"Acme","role":"Senior AI Eng","score":84,"display":"4.2","fit":"GOOD_FIT","legitimacy":"High Confidence","status_label":"Evaluated","pdf":"output/cv-doe-acme-2026-05-24.pdf","pdf_ok":true,"report":"reports/021-acme-2026-05-24.md","url":"https://...","notes":"strong match","flags":2,"error":null}
```
The fields above `flags` are exactly what `merge-tracker.mjs` needs to build the applications.md row + move the pipeline.md row. On failure: `status:"failed"`, null score/pdf, `error` populated, `report` present if the `.md` was written before the failure.

---

## 4. Part B — `batch` mode

**File:** `modes/batch.md` (new)
**Loads (orchestrator):** `_shared.md` + `batch.md`. Subagents load `_shared.md` + `evaluate.md` + `cv.md` + `auto-pipeline.md` in their own fresh context.

### 4.1 Inputs (priority order)

1. URLs pasted/listed by the user in the invocation.
2. `data/batch/batch-input.tsv` if present.
3. Default: the `## Pending` rows of `data/pipeline.md`.

### 4.2 Flags

| Flag | Effect |
|------|--------|
| `--dry-run` | List pending jobs + would-be report numbers; process nothing. |
| `--retry-failed` | Process only jobs marked `failed` in state (within `--max-retries`, default 2). |
| `--limit N` | Process only the first N pending jobs. |
| `--parallel N` | Hint for concurrent subagents (CLI-dependent; **default 3**). Each worker launches its own headless Chromium for the PDF — keep this conservative to avoid local CPU/RAM spikes and Playwright launch timeouts (Gemini round 3). |
| `--min-score N` | Override `auto.min_cv_score` for this run (passed to workers). |

### 4.3 Flow (orchestrator, in-context)

**Step 0 — Profile preflight (fail fast, before any dispatch).** batch is high-volume and high-cost; against an unconfigured profile it would spawn N workers that each independently hit evaluate/cv's dependency stop — wasting N spawns and producing N generic outputs. So the orchestrator runs the **standard onboarding completeness check ONCE up front** (same signals as AGENTS.md First-Run): `cv.md` has real content, `config/profile.yml` is beyond placeholders, `modes/_profile.md` is beyond placeholders. If any fails, refuse — do NOT assign report numbers or dispatch workers:
```
⚠️  Batch needs a complete profile first (it generates an evaluation + CV for every job).
    Missing: {cv.md / profile.yml / _profile.md — whichever}
    Run  setup  to finish your profile, then re-run  batch.
```
The bar is the existing onboarding bar — NOT a stricter "all contact fields filled" check (optional contact fields are legitimately omitted per the data contract). `auto` (single URL) needs no preflight: evaluate's own dependency check already fails fast and cheaply for one job.

1. **Gather URLs** → build job list `{id, url, company?, role?}`. **If no jobs are found** (empty Pending + no args + no batch-input.tsv), print the empty-queue on-ramp instead of erroring (beginner-UX, Gemini):
   ```
   Nothing to batch — your pending queue is empty. To run a batch:
     1. Paste job URLs under the "## Pending" section of data/pipeline.md, or
     2. Run specific URLs now:  batch <url1> <url2> <url3>, or
     3. Drop URLs into data/inbox.txt and run:  scan   (drains inbox → pipeline)
   ```
2. **Init/read state** `data/batch/batch-state.json` (`{id, url, status, report_num, score, error, retries}`). Skip `completed` (resumability). Check `data/batch/.batch.lock`; warn if a run is already active (stale-lock recovery note).
3. **Pre-assign report numbers (race fix).** Scan `reports/` for the max prefix; assign a contiguous block (max+1, max+2, …) to pending jobs and record in state. Because the orchestrator assigns up front, parallel workers never collide — no file locking needed (this is the key simplification over career-ops's lock-based `reserve_report_num`).
4. **Dispatch workers.** For each pending job, spawn a fresh-context subagent with a **thin** prompt (points to modes — does NOT re-implement evaluation, so it can never drift from evaluate.md/cv.md). State the read order explicitly (Gemini Q5):
   > "Run career-scout's auto-pipeline non-interactively on ONE job. **Read in this order:** `modes/_shared.md` first, then `modes/evaluate.md`, then `modes/cv.md`, then `modes/auto-pipeline.md`. Then execute `auto --batch --yes --report-num={NNN}` for URL `{url}` (batch ID `{id}`). Write your result to `data/batch/results/{id}.json`. Do NOT edit applications.md or pipeline.md. Echo the same JSON as your final message."
   - Respect `--parallel` as a dispatch hint; the CLI parallelizes as it can.
5. **Collect results.** For each job, `Read` `data/batch/results/{id}.json` (primary — clean by construction, since a file write carries no conversational wrapping). If the file is missing/corrupt, fall back to the subagent's final message — but **never `JSON.parse` it raw** (LLMs prefix prose / wrap in ```json fences, and Node/Playwright noise can leak). Extract the object first (first `{` to last `}`) then parse:
   ```js
   const m = msg.match(/\{[\s\S]*\}/);
   const data = m ? JSON.parse(m[0]) : null;   // null → mark failed
   ```
   If both channels fail → mark `failed` (the report .md may still exist, recoverable via `--retry-failed`). Update `batch-state.json`.
6. **Merge** → `node scripts/merge-tracker.mjs` → reads `data/batch/results/*.json` → upsert applications.md rows + **idempotently** move pipeline.md Pending→Evaluated (`.bak` both). "Idempotent" = if the URL is already in Evaluated, no-op rather than duplicating (Gemini Q4).
7. **Verify** → `node scripts/verify-pipeline.mjs` → report integrity issues (warn-only).
8. **Summary:**
   ```
   Batch complete: {total} | ✅ {completed} | ❌ {failed} | ⏭ {skipped}
   Avg score (completed): {x}/100
   Top fits: {company (score), …}
   Failed: #{id} {url} — {error}   → retry: batch --retry-failed
   What to do next:
     1. Review high-fit PDFs in output/
     2. pipeline → triage the newly-evaluated rows
   ```

### 4.4 Context safety + subagent-unavailable fallback

**Primary path (both Gemini CLI and Claude Code): subagent dispatch keeps the orchestrator light.** Each worker runs in an isolated context and returns only a compact `results/{id}.json` — the orchestrator never accumulates the full evaluate+cv reasoning of every job. This holds whether workers run in parallel (Gemini `invoke_subagent`) or one-at-a-time (Claude Code Task/Agent tool). **Bloat is avoided by isolation, not by parallelism** — even serial subagent dispatch stays clean.

> Premise correction (Gemini protocol): Claude Code *does* support fresh-context subagents (the Task/Agent tool). It is NOT forced into in-context processing, and the orchestrator stays light on Claude Code too. The fallback below is only for a CLI with no subagent support at all.

**True fallback (no subagent support whatsoever):** only then does the orchestrator process jobs in its own context, which *does* accumulate tokens. To prevent API-cost shock and context dilution, it runs a **checkpoint** (Gemini round-2 idea, corrected):

- Process at most `batch.sequential_checkpoint` jobs (default **3**) per invocation.
- Save progress to `batch-state.json` (the existing resumability mechanism), then pause and exit cleanly:

```
⏸️  Batch paused at 3/{total} jobs — keeping context clean and API cost predictable.
    Progress saved to data/batch/batch-state.json.

    To continue the remaining {n} jobs:
      • Claude Code:  type  /clear  to reset history, then run  batch
      • Gemini CLI:   just run  batch  again (fresh process starts clean)
    (Completed jobs are skipped automatically — resumability.)
```

**Two corrections to the original round-2 suggestion** (investigated, not accepted at face value):
1. Claude Code's history-reset command is **`/clear`**, not `/clean` (`/clean` is not a Claude Code command).
2. The resume command is plain **`batch`** (resumes pending, skips completed), NOT `batch --retry-failed`. `--retry-failed` only reprocesses jobs marked *failed*; the un-started jobs are *pending*, so `--retry-failed` would skip them. Reserve `--retry-failed` for re-running jobs that actually errored.

**Per-job context isolation (sequential fallback only — Gemini round 3, "lost in the middle").** When jobs share one context, by job 3 the window is saturated with jobs 1-2's JDs and scores; attention degrades in the middle and keywords can cross-contaminate (job 1's terms bleeding into job 3's CV). The 3-job checkpoint bounds this, but additionally, before each job the orchestrator must:
- Reset focus explicitly: *"Starting a fresh evaluation. Disregard all previous JDs, companies, and scores in this session. Use only the CV and JD below."*
- Structure the working prompt so reference material (`cv.md`) sits near the top and the active JD + task instructions sit at the very bottom — the two positions where attention is highest.

(This does not apply to the subagent path: each worker already starts with a clean context.)

---

## 5. Part C — New scripts

### 5.1 `scripts/merge-tracker.mjs`

- Reads every `data/batch/results/*.json` (one file per completed job — the worker's result artifact from §3.3). Skips files with `status: "failed"`.
- For each result with `status: "completed"`:
  - Upsert into `data/applications.md` — match by `company`+`role`; update the row if present, else append. Build the row from JSON fields: `# | date | company | role | {score}/100 ({display}/5) | fit | status_label | [report_num](report) | pdf_ok?✅:❌ | notes`. Renumber the `#` column sequentially.
  - **Idempotently** move the matching `url` in `data/pipeline.md` from `## Pending` to `## Evaluated` (Gemini Q4): search the whole file; if the URL is already in Evaluated, no-op (no duplicate row, no error).
- Writes `.bak` of both files before modifying.
- After a successful merge, archive consumed results (move `results/*.json` → `results/processed/`) so a re-run is a clean no-op.
- Emits a summary + P1 `📂 Open:` lines for both updated files.
- JSON over TSV: no tab/pipe escaping (company/role/notes can contain either); `JSON.parse` is trivial in Node. This is the consolidation of Gemini Q2 (isolation) + Q3 (robust channel).

### 5.2 `scripts/verify-pipeline.mjs`

Standalone integrity checker (also runs at the end of batch). Parses `pipeline.md` + `applications.md` and checks:

| Check | Severity |
|-------|----------|
| Duplicate `#` in applications.md | error |
| Report link points to a non-existent `reports/` file | error |
| Score not well-formed (`N/100 (N/5)` or `N/100 → N/5`) | error |
| Fit category not in the known set (`_shared.md` table) | error |
| Same URL in both pipeline Pending and Evaluated | error |
| Status not canonical (cross-ref `templates/states.yml` if present) | warn |
| PDF=✅ row with no matching `output/` file | warn |

- Exit 0 if no errors; exit 1 if any error (warn-only by default). `--strict` promotes warnings to errors.
- Prints a per-check report.

### 5.3 (moved)

The `generate-pdf.mjs` launch-retry hardening is **split out of Phase 5** into a deferred follow-up — see §10. Phase 5 keeps the contention mitigation that lives in *new* files only: the conservative `--parallel 3` default in `batch.md` (§4.2).

---

## 6. Part D — Config, data, docs

| Change | File |
|--------|------|
| Add `auto:` block → `min_cv_score: 80` | `config/profile.yml` (User layer — add to template with comment, do NOT overwrite existing) |
| Add `batch:` block → `sequential_checkpoint: 3` (only used on the no-subagent fallback path; ignored when subagents are available) | `config/profile.yml` (User layer) |
| Create `data/batch/` (`batch-state.json`, `results/` + `results/processed/`, optional `batch-input.tsv`, `.batch.lock`) | new dir (gitignored, ephemeral system state) |
| Gitignore `data/batch/` | `.gitignore` |
| Register `data/batch/*` as ephemeral system layer; note merge-tracker writes to applications.md + pipeline.md (User layer, `.bak`) | `docs/DATA_CONTRACT.md` |
| Move auto/batch from "coming soon" to active; document flags + recipes | `.agents/skills/career-scout/SKILL.md` |
| Confirm `auto`/`batch` routing rows; remove any stale "see Headless table" assumption (no bash runner) | `AGENTS.md` |
| Add "Run the full pipeline" + "Process a batch" Quick Start sections | `README.md` |
| Mark Phase 5 items complete; bump version/date | `plan_rs/CONSOLIDATION-PLAN.md` (only after Gemini review + approval) |

*(The `cv.md` Step 3a fuzzy-match hardening is split out — see §10.)*

---

## 7. Implementation order + test gates

Each step is verified before the next begins (per CLAUDE.md planning rule). Modes are markdown → scenario tests (Gemini-run, like Phase 1); the two scripts are unit-testable with fixtures.

**Step 1 — auto-pipeline.md (interactive) + profile.yml `auto` block**
Verify with scenarios T1-T5, T7 below. **Gate: must pass before batch design depends on it.**

**Step 2 — auto `--batch` JSON contract**
Verify with T6.

**Step 3 — merge-tracker.mjs + verify-pipeline.mjs (with fixtures)**
Verify with the script unit tests below.

**Step 4 — batch.md orchestrator**
Verify with T8-T14.

**Step 5 — routing + docs (SKILL.md, AGENTS.md, README.md, DATA_CONTRACT.md, .gitignore)**

**Step 6 — update CONSOLIDATION-PLAN.md** (after review + approval).

### 7.1 auto mode scenario tests

| # | Scenario | Expected |
|---|----------|----------|
| T1 | GOOD_FIT URL (≥80) | eval + CV + tracker + pipeline move; hands-off; ends at PDF + flag summary; no mid-run pauses |
| T2 | HARD_MISMATCH (<65) | eval only; CV skipped with note; no PDF; pipeline row still moved to Evaluated |
| T3 | PARTIAL (65-79), default `min_cv_score=80` | CV skipped. Then set `min_cv_score=65` → CV generated single-pass |
| T4 | Location FAIL | eval stops; no CV; contradiction stated |
| T5 | Contact fabrication (draft has a value for an empty profile field) | audit exit 2 → CV halts; report + tracker intact; PDF pending |
| T6 | `--batch --report-num=021` | writes `data/batch/results/{id}.json` (valid, complete contract); no prose; does NOT touch applications.md/pipeline.md; uses report 021 |
| T7 | Any path | no submit action anywhere; final reminder present |

### 7.2 batch mode scenario tests

| # | Scenario | Expected |
|---|----------|----------|
| T8 | 3 pending URLs | 3 subagents → 3 reports + PDFs; merged into applications.md; pipeline rows moved; summary printed |
| T9 | `--dry-run` | lists jobs + report numbers; processes nothing |
| T10 | one worker fails | marked failed; others complete; `--retry-failed` reprocesses just it |
| T11 | interrupt + re-run | completed jobs skipped (resumability via batch-state.json) |
| T12 | report-number pre-assignment | no collisions across parallel workers |
| T13 | subagent-unavailable CLI | sequential fallback engages; processes up to `sequential_checkpoint` (3) then pauses cleanly |
| T14 | CLI parity | subagent dispatch works on both Gemini CLI (invoke_subagent) and Claude Code (Task/Agent); orchestrator context stays light on both |
| T15 | sequential fallback, 10 jobs, checkpoint=3 | processes 3 → saves state → prints pause note with `/clear`(Claude)/`batch`(Gemini) resume; re-running `batch` processes the next 3; completed skipped; never suggests `--retry-failed` for pending jobs |
| T16 | worker returns JSON wrapped in prose / ```json fence (fallback channel) | orchestrator extracts the object (first `{`→last `}`) and parses successfully — job marked completed, not failed |
| T17 | `--parallel 3` on a 6-job batch | at most 3 concurrent Chromium launches at any time (the cap holds). *(The launch-retry behavior is validated in the §10 follow-up, not here.)* |
| T18 | `batch` with placeholder/empty profile | preflight refuses ONCE with a `setup` nudge; no report numbers assigned, no workers dispatched |

### 7.3 script unit tests

- **merge-tracker.mjs:** sample `data/batch/results/*.json` + fixture applications.md/pipeline.md →
  - rows upserted; duplicate company+role updates (not appends); `#` sequential
  - matching pipeline Pending rows moved to Evaluated
  - **idempotency:** URL already in Evaluated → no-op (no duplicate); re-running merge after archive → clean no-op
  - `status:"failed"` results skipped (no row written)
  - `.bak` created for both files; consumed results archived to `results/processed/`
  - empty results dir → clean no-op
- **verify-pipeline.mjs:** fixtures seeded with each defect (dup `#`, dead report link, malformed score, URL in both sections, non-canonical status, missing PDF file) → each flagged at the right severity; clean fixture → exit 0; `--strict` promotes warns.

---

## 8. Resolved decisions (post-Gemini review)

All seven open questions are resolved. Gemini's full review was investigated per the project's Gemini protocol; findings adopted are noted, and the one deliberate deviation is flagged.

1. **PARTIAL (65-79) in hands-off auto** → **Configurable `auto.min_cv_score` (default 80); skip CV by default below it, no interactive gate.** Gemini concurred — auto-generating CVs for partial matches would encourage low-fit submissions, against the "quality over quantity" ethic. Mitigated for beginners by the educational skip note (§3.2 Step 2).
2. **Worker write isolation** → **Mandatory; kept.** Workers never write applications.md/pipeline.md directly. (Format changed — see #3.)
3. **Subagent result channel** → **Filesystem JSON, consolidated.** Each worker writes ONE `data/batch/results/{id}.json` (primary), echoes it as its final message (fallback). *Deliberate deviation:* Gemini suggested keeping a separate TSV tracker line **and** a results JSON; that's two files with overlapping data. We merged them into a single JSON artifact that serves both orchestrator status and merge-tracker input — same isolation guarantee, no tab/pipe escaping, fewer moving parts (§3.3, §5.1).
4. **Pipeline-row move** → **Idempotent.** Both `auto` and `merge-tracker.mjs` move Pending→Evaluated; the move searches the whole file and no-ops if the URL is already Evaluated. Prevents duplicates across interrupted/partial runs and avoids conflict with pipeline-triage (§3.2 Step 4, §5.1).
5. **Thin worker prompt** → **Kept, with explicit read order** (`_shared.md` → `evaluate.md` → `cv.md` → `auto-pipeline.md`). Single source of truth, no drift (§4.3 Step 4).
6. **Bash runner** → **Deferred entirely** (not even 5b). Mode-driven subagents + sequential fallback cover 90% Gemini + ~10 URLs and avoid Windows/Unix environment friction. Removed from the roadmap unless a future need for true OS-level parallelism appears.
7. **`auto` context budget** → **Orchestrate in main context; delegate the CV review pass to a subagent** (cv.md Step 2 already spawns a fresh-context reviewer). The orchestrator only coordinates; the heaviest reasoning is already offloaded. No change needed.

### Beginner-UX polishes adopted (Gemini Part 1)
- **Educational skip note** for sub-threshold scores — explains *why* the gate exists + how to override (§3.2 Step 2). *Correction applied:* override config path is `auto.min_cv_score`, not `cv.*`.
- **Explicit veto path** in the final summary — quick (edit draft HTML + recompile) and full (`cv {slug}`) routes spelled out (§3.2 Step 5).
- **Empty-queue on-ramp** for `batch` — guides a first-time user to fill the pipeline instead of erroring (§4.3 Step 1).

### Sequential-fallback context safety (Gemini round 2)
- **Adopted:** a checkpoint capping the no-subagent fallback at `batch.sequential_checkpoint` (default 3) jobs per invocation, saving state and pausing cleanly to keep context small and API spend predictable (§4.4).
- **Corrected before adopting:** (a) reset command is `/clear`, not `/clean`; (b) resume is plain `batch`, not `batch --retry-failed` (pending ≠ failed); (c) premise fix — Claude Code supports subagents, so the orchestrator stays light there too; bloat comes from lack of isolation, not lack of parallelism. The checkpoint applies ONLY to the genuine no-subagent case.

### Runtime hardening (Gemini round 3, LLM-physics)
**In Phase 5 (new files only):**
- **Robust result parsing.** Primary file channel is clean by construction; the *fallback* message-parse extracts the object (first `{`→last `}`) before `JSON.parse`, so conversational slop / Playwright log leakage never falsely fails a worker (§4.3 Step 5, T16).
- **Parallel Chromium cap.** `--parallel` default → 3 in `batch.md` (§4.2, T17).
- **Sequential context isolation.** Per-job focus reset + reference-at-top/task-at-bottom prompt structure in the no-subagent fallback (§4.4). The subagent path is already isolated.

**Split out to the §10 follow-up (modify completed Phase 2 files):**
- `generate-pdf.mjs` browser-launch retry, and `cv.md` Step 3a fuzzy edit-matching. Low-risk and additive, but deferred per the user's decision to keep Phase 5 to new files.

### Profile preflight gate (user-originated, v1.4)
- batch refuses up front if the profile isn't set up (the existing onboarding bar), preventing N wasted worker spawns and N low-quality outputs against a placeholder profile (§4.3 Step 0, T18). auto relies on evaluate's existing fail-fast check.

---

## 9. Out of scope (this phase)

- `followup` mode (separate track).
- BrightData / LinkedIn batch sources (Phase 3b).
- `batch-runner.sh` bash parallel runner (deferred entirely — resolved Q6).
- Cross-batch analytics / scoring dashboards.
- The two Phase 2 hardening touch-ups → see §10.

---

## 10. Deferred follow-up — Phase 2 robustness (split out)

Two round-3 hardenings touch *completed Phase 2 files*. Per the user's decision, they ship as a **separate, small follow-up** (own commit/PR) after Phase 5 lands — not entangled with the new-file work. They are low-risk and additive; `batch`/`auto` are what expose the failure modes.

| # | Change | File | Why |
|---|--------|------|-----|
| F1 | Wrap `chromium.launch()` (browser launch only, not the render) in a one-shot retry: on resource-lock / launch-timeout, wait ~1.5s and try exactly once more before failing | `scripts/generate-pdf.mjs` | Concurrent batch workers each launch Chromium; transient launch races shouldn't fail an otherwise-good job |
| F2 | Step 3a: apply Reviewer Part A edits by locating the unique core phrase in the *actual* HTML (tags/whitespace differ from the reviewer's plain-text quote) — fuzzy/locate, not a literal paste of the quote as the search string | `modes/cv.md` | A literal Edit can mismatch on HTML tags/whitespace and stall the edit loop; non-interactive `auto`/batch can't recover from a stuck loop |

**Verification (in the follow-up, not Phase 5):**
- F1: simulate a launch failure → assert one retry then success; assert a genuinely unavailable Chromium still fails cleanly after the retry.
- F2: reviewer quotes "Led team" but HTML is `Led</span> team` → edit still applies (locates core phrase); no infinite retry.

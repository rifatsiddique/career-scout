# Mode: batch — Parallel Batch Pipeline Orchestrator

Processes multiple pending job URLs in one command by dispatching fresh-context
subagents — one per job — then merging all results into the trackers.

**Loads (orchestrator):** `modes/_shared.md` + `modes/batch.md`

**Each subagent loads (in order):**
`modes/_shared.md` → `modes/evaluate.md` → `modes/cv.md` → `modes/auto-pipeline.md`

---

## Flags

| Flag | Effect |
|------|--------|
| `--dry-run` | List pending jobs + would-be report numbers. Process nothing. |
| `--retry-failed` | Reprocess only jobs marked `failed` in `batch-state.json`. (For jobs that errored, not un-started pending jobs — those resume with plain `batch`.) |
| `--limit N` | Process only the first N pending jobs this run. |
| `--parallel N` | Hint: how many subagents to dispatch concurrently. **Default: 3.** Each worker launches its own headless Chromium; keep conservative to avoid CPU/RAM spikes and Playwright launch timeouts. |
| `--min-score N` | Override `auto.min_cv_score` for this run (passed through to workers). |

---

## Step 0 — Profile preflight (fail fast)

Before doing anything else, run the **standard onboarding completeness check**
(same signals as AGENTS.md First-Run):

1. `cv.md` — has real content (not empty, not template placeholders)
2. `config/profile.yml` — filled beyond placeholders (candidate fields have real values)
3. `modes/_profile.md` — filled beyond placeholders (archetypes defined)

If **any** check fails, print this message and stop. Do NOT assign report numbers
or dispatch any workers:

```
⚠️  Batch needs a complete profile first (it generates an evaluation + CV for every job).
    Missing: {cv.md / profile.yml / _profile.md — whichever failed}
    Run  setup  to finish your profile, then re-run  batch.
```

The bar is the **onboarding bar** — not a stricter "all contact fields filled"
check. Optional contact fields (phone, LinkedIn, etc.) are legitimately left
blank per the data contract; that is not a preflight failure.

---

## Step 1 — Gather jobs

**Input priority order:**

1. URLs listed directly in the invocation (e.g., `batch <url1> <url2>`)
2. `data/batch/batch-input.tsv` — if the file exists, read it.
   Format: one job per line, tab-separated: `url\tcompany\trole` (company and role are optional).
   Lines starting with `#` are comments.
3. Default: read `data/pipeline.md` and collect all rows under `## Pending`.

Build a job list: `[{id, url, company?, role?}]`
Assign sequential IDs starting from 1 (or continue from `batch-state.json` if resuming).

Apply `--limit N` if set: take only the first N jobs from the list.

If `--retry-failed`: replace the job list with only the entries from
`batch-state.json` where `status === "failed"` (up to their `retries` count
against `--max-retries`, default 2).

**Empty queue on-ramp.** If the final job list is empty after all sources,
print this instead of erroring:

```
Nothing to batch — your pending queue is empty. To run a batch:
  1. Paste job URLs under the "## Pending" section of data/pipeline.md, or
  2. Run specific URLs now:  batch <url1> <url2> <url3>, or
  3. Drop URLs into data/inbox.txt and run:  scan   (drains inbox → pipeline)
```

---

## Step 2 — Init / read state

1. Read `data/batch/batch-state.json` if it exists. State schema per job entry:
   ```json
   {"id":"1","url":"https://...","company":"Acme","role":"...","status":"pending","report_num":"021","score":null,"error":null,"retries":0}
   ```
   Valid statuses: `pending`, `completed`, `failed`.

2. **Resumability:** skip any job whose ID already has `status: "completed"` in state.
   Print: `⏭  Skipping completed: {company} — {role}` for each skipped job.

3. **Lock check.** Check for `data/batch/.batch.lock`.
   If it exists: warn that a run may already be active (could be stale after a crash).
   Print:
   ```
   ⚠️  Lock file found: data/batch/.batch.lock
       A batch run may already be active. If the previous run crashed,
       delete the lock file and re-run: batch
   ```
   Then stop. Do not proceed until the user clears the lock.

4. Write `data/batch/.batch.lock` (contents: current timestamp + total job count).

---

## Step 3 — Pre-assign report numbers

Scan `reports/` for all files matching the `###-*` prefix pattern.
Find the highest 3-digit numeric prefix. New block starts at `max + 1`.

Assign report numbers sequentially to every **pending** job (not yet completed):
- job[0] → `max + 1` (zero-padded to 3 digits)
- job[1] → `max + 2`
- … and so on

Record each assignment in `batch-state.json` immediately (before dispatching any worker).

This pre-assignment means parallel workers never scan `reports/` themselves and
can never collide — no file locking needed.

If `--dry-run`: print the job list with assigned report numbers and stop:

```
Dry run — {N} jobs would be processed:

  #  Report  Company                Role
  1  021     Acme                   Senior AI Engineer
  2  022     Beta Corp              Staff PM
  …

No jobs were processed. Remove --dry-run to execute.
```

---

## Step 4 — Dispatch workers

For each pending job, spawn a fresh-context subagent with the following **thin
prompt** (the prompt points to modes and does NOT re-implement evaluation logic —
this is intentional so workers can never drift from evaluate.md/cv.md):

```
Run career-scout's auto-pipeline non-interactively on ONE job.

Read in this order:
  1. modes/_shared.md
  2. modes/evaluate.md
  3. modes/cv.md
  4. modes/auto-pipeline.md

Then execute auto-pipeline in --batch mode for this job:
  URL:        {url}
  Batch ID:   {id}
  Report num: {NNN}

Flags: --batch --yes --report-num={NNN} --id={id}

Write your result to data/batch/results/{id}.json.
Do NOT edit applications.md or pipeline.md directly.
Echo the same JSON object as your final message (fallback channel).
```

Pass `--min-score` through to the worker if it was supplied:
add `--min-score={N}` to the flags line.

**Parallelism:** Dispatch up to `--parallel` workers concurrently (default 3).
The CLI orchestrates as it can; the `--parallel` value is a dispatch hint.
Wait for the current wave to complete before dispatching the next.

**Sequential fallback** (if the CLI has no subagent support — see §Fallback below):
Process jobs one at a time in the orchestrator's own context instead of spawning.

---

## Step 5 — Collect results

For each dispatched job:

1. **Primary channel:** Read `data/batch/results/{id}.json`.
   This file is written by the worker directly; its contents are clean JSON with
   no conversational wrapping.

2. **Fallback channel** (file missing or corrupt): inspect the subagent's return
   message. Extract the JSON object before parsing — never `JSON.parse` the raw
   message directly (LLMs may wrap in prose, ` ```json ` fences, or Playwright
   log lines may leak):
   ```js
   const m = msg.match(/\{[\s\S]*\}/);
   const data = m ? JSON.parse(m[0]) : null;
   ```
   If both channels fail → mark the job `failed` in state with
   `error: "no result"`.

3. Update `data/batch/batch-state.json` with the result: set `status` to
   `"completed"` or `"failed"`, record `score`, `error`.

---

## Step 6 — Merge

Run: `node scripts/merge-tracker.mjs`

This reads `data/batch/results/*.json`, upserts rows into `applications.md`,
and idempotently moves pipeline.md Pending→Evaluated (`.bak` written for both).

---

## Step 7 — Verify

Run: `node scripts/verify-pipeline.mjs`

Reports any integrity issues. Warn-only (does not abort the batch).

---

## Step 8 — Cleanup + summary

1. Delete `data/batch/.batch.lock`.
2. Print the summary:

```
Batch complete: {total} | ✅ {completed} | ❌ {failed} | ⏭ {skipped}
Avg score (completed): {x}/100
Top fits: {company} ({score}), {company} ({score}), …

{If any failed:}
Failed jobs:
  #{id} {url} — {error}
  → Retry:  batch --retry-failed

What to do next:
  1. Review high-fit PDFs in output/
  2. pipeline → triage the newly-evaluated rows
```

---

## Sequential fallback (no subagent support)

This path applies **only** when the CLI cannot spawn subagents. On Gemini CLI
and Claude Code, use the subagent path (Step 4) — those CLIs support it and the
orchestrator stays light via context isolation.

When there is genuinely no subagent support:

- Process jobs **one at a time** inside the orchestrator's own context.
- Read `config/profile.yml → batch.sequential_checkpoint` (default: **3**).
- After processing that many jobs, save state and **stop**:

```
⏸️  Batch paused at {done}/{total} jobs — keeping context clean and API cost predictable.
    Progress saved to data/batch/batch-state.json.

    To continue the remaining {n} jobs:
      • Claude Code:  type  /clear  to reset history, then run  batch
      • Gemini CLI:   just run  batch  again (fresh process starts clean)
    (Completed jobs are skipped automatically — resumability.)
```

**Do NOT suggest `batch --retry-failed` for resuming.** `--retry-failed` only
reprocesses jobs that *errored*; un-started pending jobs resume with plain `batch`.

**Per-job context isolation** (sequential fallback only). Before processing each
job, reset focus explicitly to prevent keyword cross-contamination across jobs:

> "Starting a fresh evaluation. Disregard all previous JDs, companies, and
> scores in this session. Use only the CV and JD below."

Structure the working prompt so:
- Reference material (`cv.md` content) is near the **top** of the prompt.
- The active JD + task instructions are at the **bottom** of the prompt.

(These positions have the highest attention weight; placing both anchors here
reduces the "lost in the middle" degradation on long contexts.)

---

## Global rules (always apply)

- **Never auto-submit.** No form fills, no apply button clicks. The user reviews all materials before submitting.
- **No fabrication.** Every claim in generated CV materials traces back to `cv.md` or `article-digest.md`.
- **Batch is read-only on pipeline.md/applications.md during dispatch.** Workers write only their own `results/{id}.json`. The orchestrator's merge step (Step 6) is the single writer to shared trackers.
- **Respect the data contract.** `data/batch/` is ephemeral system state. `applications.md`, `pipeline.md`, `reports/`, and `output/` are User layer (`.bak` written before any modification).

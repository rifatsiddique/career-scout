# Mode: pipeline — Triage Pending Jobs

Processes pending job URLs from `data/pipeline.md`. The user adds URLs to the Pending table at any time, then runs this mode to evaluate them all.

---

## Workflow

### Step 1: Read the Pending Table

Read `data/pipeline.md` → find all rows in the **Pending** table (rows where the URL has not yet been moved to Evaluated).

If no pending rows, print this instead of a bare "empty" message:

```
Your pipeline is empty — nothing to triage right now.

Here's how to fill it:

  1. Run a scan          → 'scan'               Searches portals + web for new roles
  2. Set up Advanced Scout → 'scan --setup'     Enables priority company checking + smart filtering
  3. Drop URLs manually  → data/inbox.txt       Paste links from LinkedIn, email, referrals (one per line)
  4. Evaluate directly   → paste any job URL    Skip the queue and evaluate a role right now
```

Then stop.

### Step 1b: Smart Curation (fires before evaluation begins)

Count the pending rows. Check whether any have a quick-pass score in their Notes column (format: `score:NN`).

**If ≥ 4 pending rows:** Offer to batch-evaluate all at once:
```
You have {N} jobs queued. I can evaluate them all in one go — want me to process
the full list now? [y/n]
```
- **yes** → read `modes/batch.md` and execute immediately
- **no** → continue with the smart curation below

**If 1–3 pending rows (or user said no to batch):** Sort by quick-pass score (Notes column) descending; rows without scores go last. Pitch the top match by name:
```
Your best queued match looks like {Company} — {Role} ({score}/100 quick-pass score).
Want to start there? [y/n]
```
- **yes** → process that URL first (then continue with remaining rows below)
- **no** → ask "Which one would you like to start with?" and let the user name one, OR proceed in queue order

If no entries have a score: skip the pitch and proceed in queue order.

---

### Step 2: For Each Pending URL

Process sequentially (parallel processing is a Phase 5 enhancement):

**a. Determine report number**
- List all files in `reports/`
- Extract the highest 3-digit prefix
- New report number = highest + 1 (zero-padded to 3 digits)
- If `reports/` is empty: start at 001

**b. Extract JD**

Try in order:
1. Navigate to the URL and extract the job description content
2. If inaccessible (login wall, SPA content not visible): try fetching as a static page
3. If still inaccessible: try searching the web for the company + role from the URL
4. If all fail: mark the row with error note `[FETCH_ERROR: login required / URL dead]` and skip to next URL

**Special cases:**
- LinkedIn URLs: often require login → try fetch, note if unavailable, ask user to paste JD
- Local file references (e.g., `local:jds/filename.md`): read the local file directly
- PDF URLs: read PDF content directly

**c. Run evaluate mode**

Execute the full A-G evaluation (blocks A through G) per `modes/evaluate.md`.

**d. Save report and update tracker**

Follow the post-evaluation steps from `modes/evaluate.md`:
- Save report to `reports/{###}-{company-slug}-{YYYY-MM-DD}.md`
- Register in `data/applications.md`

**e. Move row from Pending to Evaluated**

In `data/pipeline.md`:
- Remove the row from the Pending table
- Add a new row to the Evaluated table:

```
| {###} | {URL} | {Company} | {Role} | {composite}/100 ({display}/5) | {CATEGORY} | Evaluated | [{###}](reports/{###}-slug-date.md) | ❌ | |
```

### Step 3: Summary Report

After processing all pending URLs, output a summary table:

```
## Triage Complete

| # | Company | Role | Score | Fit | Legitimacy | Action |
|---|---------|------|-------|-----|-----------|--------|
| {###} | {company} | {role} | {score}/5 | {category} | {tier} | {Apply/Consider/Skip} |
```

Show totals: `{N} evaluated, {M} recommended to apply, {K} skipped`.

**P3 nudge — Interview-status rows without a prep doc:**
After the summary table, scan `data/applications.md` for rows where Status = `Interview`.
For each, check whether `interview-prep/{company-slug}-{role-slug}.md` exists.
For each missing prep doc (max 3 shown):
```
💡 {Company} is at Interview status — no prep doc yet. Run: interview-prep {company-slug}
```
If more than 3 are missing: add one line `... and {N} more Interview rows without prep docs.`
If all Interview rows have prep docs: print nothing (no nudge).

**Post-triage CV offer (fires when ≥ 1 GOOD_FIT+ result exists):**

Find the highest-scoring GOOD_FIT+ result from the triage. Ask:
```
{Company} ({score}/100) looks like your best bet. Want me to generate a tailored CV
for it right now? [y/n]
```
- **yes** → read `modes/cv.md` and execute for that company's report
- **no** → show "What to do next" and stop

```
What to do next:
  1. Generate a CV for a role you're moving forward on → just say "cv for {company}"
  2. Tell me to update a status → "move {company} to Applied"
  3. Prep for an interview → "interview prep for {company}"
```

---

## Pipeline File Format Reference

```markdown
## Pending
| URL | Company | Role | Source | Found | Notes |
|-----|---------|------|--------|-------|-------|
| https://boards.greenhouse.io/acme/jobs/123 | Acme Corp | Senior Engineer | greenhouse | 2026-05-14 | |
| https://jobs.lever.co/openai/456 | OpenAI | ML Platform | manual | 2026-05-14 | |

## Evaluated
| # | URL | Company | Role | Score | Fit | Status | Report | PDF | Notes |
|---|-----|---------|------|-------|-----|--------|--------|-----|-------|
| 001 | https://... | Acme | AI PM | 82/100 (4.1/5) | GOOD_FIT | Applied | [001](reports/001-acme-2026-05-10.md) | ❌ | |
```

---

## Error Handling

| Error | Action |
|-------|--------|
| URL returns 404 | Add note "[URL_DEAD]" in Notes, remove from Pending, do NOT add to Evaluated |
| Login required | Add note "[LOGIN_REQUIRED — paste JD text]", leave in Pending |
| JD text too short (<100 words) | Note "[INCOMPLETE_JD]", ask user to verify URL |
| company + role already in applications.md | Update existing tracker row, still create new report |

# Mode: pipeline — Triage Pending Jobs

Processes pending job URLs from `data/pipeline.md`. The user adds URLs to the Pending table at any time, then runs this mode to evaluate them all.

---

## Workflow

### Step 1: Read the Pending Table

Read `data/pipeline.md` → find all rows in the **Pending** table (rows where the URL has not yet been moved to Evaluated).

If no pending rows: report "Pipeline is empty — no pending URLs to process" and stop.

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

```
What to do next:
  1. Evaluate the top pending job → paste its URL
  2. Generate a CV for a role you're moving forward on → cv
  3. Update a status → tell me: "move {company} to {status}"
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

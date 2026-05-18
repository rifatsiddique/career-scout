# Plan: Phase 3 — Scout (Job Discovery)

## Context

career-scout is a two-stage job search system: Scout (discovery) → Evaluator (analysis + CV).
Phases 1-2 are complete (evaluate, pipeline-triage, setup, CV generation). Phase 3 adds the
discovery side — scanning portal APIs, draining an inbox file, and writing new jobs to
`data/pipeline.md` for later evaluation.

**User's core concerns:**
- Running scout again must NOT lose previous jobs (append-only, dedup prevents re-adding)
- Scout discovers. It does NOT score, rank, or recommend — that's Evaluator's job
- Minimal user intervention: run `scan` (or `scout`), get a count, done
- Plan for LinkedIn/browser extension later, don't build it now
- Support importing from CSV files
- Stale/dead links shouldn't clutter pipeline indefinitely (automated weekly cleanup)
- Starting a new search chapter should be a clean slate (explicit reset command)
- Daily "dream company" check should be fast, not a full 50-company scan
- Tool should guide users through complexity — contextual prompts over documentation

**Source project:** `C:/Work/Local_GitClones/career-ops/scan.mjs` (399 lines) — proven
zero-token scanner for Greenhouse/Ashby/Lever APIs.

---

## Architecture Decisions

### D1: scan.mjs outputs JSON to stdout; agent writes pipeline.md tables

career-ops scan.mjs writes directly to pipeline.md (checkbox format `- [ ] url | company | title`
under `## Pendientes`). career-scout uses a different format (markdown table under `## Pending`).

Split:
- **scan.mjs:** fetch APIs → filter → dedup → append scan-history.tsv → print JSON to stdout
- **modes/scan.md:** agent parses JSON → appends rows to pipeline.md Pending table → drains inbox

Rationale: scan.mjs becomes a pure data tool (like check-history.mjs). Testable with `jq`.
Agent handles markdown formatting — small, deterministic task.

scan.mjs still writes scan-history.tsv directly (stable TSV format, no reason to push to agent).
Human-readable summary goes to stderr so it doesn't contaminate stdout JSON.

### D2: Single inbox — `data/inbox.txt` with smart line parsing

One inbox file. No "which file do I use?" question.

```
# Drop job URLs here, one per line. Scout drains on every run.
# Add metadata with pipes: URL | Company | Role | Source

https://boards.greenhouse.io/stripe/jobs/123
https://jobs.lever.co/openai/456 | OpenAI | ML Platform | browser-ext
https://example.com/jobs/789 | Acme | Sr. Engineer | referral
```

**Parsing rules:**
- Lines starting with `#` → ignored (comments)
- Empty lines → ignored
- Lines containing ` | ` (space-pipe-space) → split as `URL | Company | Role | Source`
  - Missing fields default to empty (e.g., `URL | Stripe` → Role="", Source="manual")
  - If Role is empty, agent fetches page for it
  - Split on ` | ` not bare `|` — avoids false splits on URLs with query params like `?filter=eng|mgr`
- Lines without ` | ` → URL only, agent fetches page for metadata

Browser extension writes either format. CSV import goes through scan.mjs.
Scout drains all entries, then resets file to comment-only header.

### D3: Stale/dead link handling — `data/archived.md` + weekly check

Dead and zombie jobs are moved from pipeline.md Pending → `data/archived.md`.
Pipeline.md stays clean and active-only.

**`data/archived.md`** format:
```markdown
# Archived Jobs

Jobs removed from pipeline due to expired or unreachable postings.
To restore: move the row back to data/pipeline.md Pending table.

| URL | Company | Role | Source | Found | Archived | Reason |
|-----|---------|------|--------|-------|----------|--------|
```

**Weekly stale check** (agent-driven, not scan.mjs):
- Runs automatically when last_clean in `data/.scout-state.json` is >7 days
- Also triggered by `scout --clean` explicit flag
- For each Pending item older than `stale_threshold_days` (default 21, configurable in portals.yml):
  1. Agent fetches URL via WebFetch (captures final URL + body content)
  2. Applies liveness classification (same logic as liveness-core.mjs):
     - Hard 404/410 → **Archive** with reason `[HTTP 404]`
     - Final URL redirected to careers homepage → **Archive** with reason `[REDIRECT — job closed]`
     - Body text contains expiry phrases ("job no longer available", "position filled") → **Archive** with reason `[EXPIRED TEXT]`
     - Apply button missing, content < 300 chars → **Archive** with reason `[NO APPLY BUTTON]`
     - Apply button missing but content present → **Flag** in Notes: `[AGE: N days — verify manually]`
     - Apply button present → leave in Pending, no action
- Archive moves row from pipeline.md Pending → archived.md
- Appends a NEW row to scan-history.tsv with status `archived` and today's date
  (append-only — never modify existing rows; dedup reads column 0 = URL regardless of status)
- Summary is **explicit and noisy** — user sees exactly what moved and why, with manual recovery instructions

**Conservative archiving rule:** Only archive on hard signals. When uncertain, flag but don't archive.
Transient errors (network timeouts, server errors) → skip, try next week.

### D4: WebSearch (Level 3) deferred to Phase 3b

Level 2 (ATS APIs) covers the main case: 50+ companies, zero LLM tokens. WebSearch is
noisy, costs tokens, and requires liveness checking (Playwright per result). Ships in Phase 3b
alongside Playwright direct scraping (Level 1).

### D5: Playwright direct scraping (Level 1) deferred to Phase 3b

Same rationale. API scanning covers the core value. Playwright scraping is the most fragile
level (SPAs, pagination, anti-bot). Phase 3b adds Levels 1+3 together since both need
liveness-core.mjs.

### D6: portals.yml population — example file + setup extension

Ship `config/portals.example.yml` (ported from career-ops, 50+ companies). User copies to
`config/portals.yml` and customizes. Also add a Step 8 to `modes/setup.md` that offers to
populate portals.yml from the example if it's still empty.

**New fields added to portals.yml schema (Phase 3):**
```yaml
# Per-company field
priority: true          # Mark as dream company. Included in 'scout --fast' runs.

# Global scanner config
stale_threshold_days: 21   # Pending items older than this get stale-checked
lookback_days: 180          # Ignore scan-history entries older than this for dedup
```

### D7: `scout --fast` — Priority-only daily run

Mark dream companies with `priority: true` in portals.yml. `scout --fast` only scans
those companies — a quick daily check without waiting for all 50+.

```
scout         → full discovery run (all enabled companies)
scout --fast  → priority run (priority: true companies only)
```

Implemented in scan.mjs: after API detection, filter `targets` to `priority === true`
when `--fast` flag is present. Zero extra logic.

**`--fast` also skips the weekly stale check.** The whole point of `--fast` is speed.
Stale check runs on the next full `scout` or with explicit `--clean`.
`--fast` still drains inbox (reading a local file is instant — don't sacrifice inbox URLs).

### D8: `scout --new-chapter` — Clean slate for a new search

Explicitly resets the search state. Requires `--confirm` flag — no accidental nukes.

**What it does:**
1. Creates `data/archive/YYYY-MM-DD/` directory
   - If directory already exists (ran twice same day): append suffix → `YYYY-MM-DD-2/`, `-3/`, etc.
2. Moves `data/pipeline.md` → archive
3. Moves `data/applications.md` → archive
4. Moves `data/scan-history.tsv` → archive
5. Moves `data/archived.md` → archive (if it exists)
6. Moves `data/follow-ups.md` → archive (if it exists — follow-ups reference applications.md entries)
7. Creates fresh empty versions of all files (same headers/format as originals)
8. Resets `data/.scout-state.json` with `last_clean` and `last_scan` set to TODAY
   (not null — prevents an immediate stale check on an empty pipeline)

**NOT archived:** `data/inbox.txt` — pending inbox items carry forward to the new chapter.
User wants those URLs in the new search, not buried in the archive.

**Why rotate scan-history.tsv:** Starting fresh means seeing jobs again, including roles
at companies you passed on a year ago. The old history is safe in the archive folder.

**Safety gate:** `scout --new-chapter` without `--confirm` shows:
```
This will archive:
  data/pipeline.md       (N pending, M evaluated rows)
  data/applications.md   (K entries)
  data/scan-history.tsv  (J entries)
  data/archived.md       (L entries)
  data/follow-ups.md     (F entries)

Archive destination: data/archive/2026-05-18/

NOT archived: data/inbox.txt (pending items carry forward)
NOT touched:  reports/, output/, config/

Run 'scout --new-chapter --confirm' to proceed.
```

This is agent-driven (modes/scan.md), not scan.mjs — requires file moves and user
confirmation interaction.

### D9: `data/.scout-state.json` — Lightweight scan state

Tracks last stale check, last scan, and consecutive dry runs.

```json
{
  "last_clean": "2026-05-11",
  "last_scan": "2026-05-18",
  "consecutive_empty_scans": 0
}
```

- `last_clean` — date of last stale check. Used to trigger weekly auto-check.
- `last_scan` — date of last scan. Used for "Welcome Back" intercept (>60 days).
- `consecutive_empty_scans` — increments each run with 0 new jobs; resets to 0 on any new jobs. Used for "Dry Spell" nudge at ≥3.

User layer (don't gitignore — useful to share state between machines).

### D10: Command alias — `scout` routes to `scan` mode

Users naturally say "run scout" but the command is `scan`. Add `scout` as an alias in
all routing tables (AGENTS.md, GEMINI.md, SKILL.md). Both `scan` and `scout` load
`modes/scan.md`. Zero extra logic — just routing table entries.

### D11: Contextual guidance over documentation

Users returning after months forget flags. The mode file handles this by intercepting
at Step 0 and guiding contextually:
- Long absence (>60 days): suggest --new-chapter before running
- Dry spell (3+ consecutive empty runs): nudge to broaden filters
- Volume-aware next steps: different advice for 0 / 1-4 / 5+ new jobs
- `scan --help`: show clean flag reference inline

### D12: js-yaml dependency

scan.mjs needs `js-yaml` for portals.yml parsing. Add to package.json.

---

## Data Flow

```
config/portals.yml          data/.scout-state.json
(companies, filters,         (last_clean, last_scan)
 priority flags)                     │
        │                            │
        ▼                            ▼
  scripts/scan.mjs          modes/scan.md (agent)
        │                            │
        ├─ Hit APIs (all or          ├─ Step 1: Run scan.mjs → parse JSON
        │  --fast priority only)     ├─ Step 2: Drain data/inbox.txt
        ├─ Apply filters             ├─ Step 3: Append rows → pipeline.md Pending
        ├─ Dedup (with lookback)     ├─ Step 4: Print summary + update state
        ├─ Write scan-history.tsv   ├─ Step 5: Stale check (if due, AFTER discovery)
        └─ JSON → stdout             │   ├─ Fetch old Pending URLs (WebFetch)
                                     │   ├─ Classify liveness (zombie/dead/active)
                                     │   └─ Move dead → data/archived.md
                                     └─ Done
                                              │
                                              ▼
                                     data/pipeline.md (Pending)
                                              │
                                              ▼  (user runs 'pipeline')
                                     pipeline-triage → Evaluated + applications.md

  scout --new-chapter --confirm
        │
        └─ Archive pipeline.md + applications.md + scan-history.tsv + archived.md
           → data/archive/YYYY-MM-DD/
           Create fresh empty files. Reset .scout-state.json.
```

### Data persistence guarantees

- **pipeline.md Pending** — Scout appends. Stale check moves dead rows to archived.md.
  Evaluator moves live rows to Evaluated. Nothing silently deleted.
- **scan-history.tsv** — Append-only during normal operation. Rotated on `--new-chapter`.
- **data/archived.md** — Append-only. Stale check adds rows. User can restore manually.
- **Running scout twice** — 0 new rows on second run (dedup catches everything).
- **Dedup lookback** — scan-history.tsv entries older than `lookback_days` (default 180)
  are excluded from the dedup set, allowing re-discovery of old roles after a long break.
  pipeline.md and applications.md dedup is never windowed (always checked).

---

## Deliverables

### 1. NEW: `scripts/scan.mjs` (~320 lines)

Port from `career-ops/scan.mjs` (399 lines).

**Keep verbatim:**
- `detectApi()` — Greenhouse/Ashby/Lever URL pattern matching (lines 37-73)
- `parseGreenhouse()`, `parseAshby()`, `parseLever()` — API response parsers (lines 77-107)
- `fetchJson()` with AbortController timeout (lines 111-121)
- `buildTitleFilter()` — positive/negative keyword matching (lines 125-135)
- `buildLocationFilter()` — allow/block with empty-passes-through (lines 146-158)
- `parallelFetch()` with concurrency limit (lines 259-273)
- `loadSeenUrls()` — 3-source dedup set (lines 162-191, adapted)
- `loadSeenCompanyRoles()` — company::role pair dedup (lines 193-207)
- `appendToScanHistory()` — TSV append (lines 242-255)

**Change:**
| What | career-ops | career-scout |
|------|-----------|--------------|
| Paths | `portals.yml`, `data/` at root (CWD-relative) | `config/portals.yml`, `data/` resolved via `import.meta.url` (CWD-independent, matches generate-pdf.mjs pattern) |
| Pipeline.md URL regex | `- \[[ x]\] (https?:\/\/\S+)` (checkboxes) | `https?:\/\/[^\s\|)]+` (general URL match from table cells) |
| `appendToPipeline()` | Writes checkbox lines to `## Pendientes` | **REMOVED** — agent handles this |
| Output | Human summary to stdout | JSON to stdout, human summary to stderr |
| New flag: `--sources` | N/A | Filter by API type: `--sources greenhouse,ashby` |
| New flag: `--import` | N/A | Read CSV, auto-map columns, output JSON |
| New flag: `--fast` | N/A | Only scan companies with `priority: true` in portals.yml |
| Dedup lookback | Always uses full scan-history | Ignores entries older than `lookback_days` |
| Discord link | In summary | Removed |
| Language | Mixed Spanish/English | English only |

**`--fast` implementation:** After API detection, filter `targets` to those where
`company.priority === true`. Single filter call, no other changes.

**JSON stdout format:**
```json
{
  "date": "2026-05-18",
  "stats": {
    "companies_scanned": 42,
    "total_found": 380,
    "filtered_title": 290,
    "filtered_location": 15,
    "duplicates": 35,
    "new_offers": 40,
    "errors": 2
  },
  "offers": [
    { "url": "https://...", "company": "Anthropic", "title": "AI Engineer",
      "location": "Remote", "source": "greenhouse-api" }
  ],
  "errors": [
    { "company": "OpenAI", "error": "HTTP 403" }
  ]
}
```

**Exit codes:** 0 = success, 1 = fatal error (portals.yml missing), 2 = CSV column mapping failed (agent takes over)

**`--import` column mapping (deterministic):**
Try common header names case-insensitively: `url`/`link`/`job_url`/`posting_url` → URL,
`company`/`employer`/`organization` → Company, `title`/`role`/`position`/`job_title` → Title,
`location`/`city` → Location. If URL column not found → exit code 2 with headers in stderr
so agent can LLM-map.

**`--sources` flag:**
`--sources greenhouse` → only scan Greenhouse-type portals.
`--sources ashby,lever` → scan Ashby and Lever only.
If not provided, scan all. Applied after API detection, before fetching.

### 2. NEW: `modes/scan.md` (~180 lines)

Agent mode instructions for the discovery workflow.

**Structure:**
```
# Mode: scan — Job Discovery (Scout)

## Flag Routing

Parse flags from user input before doing anything:

| Input | Action |
|-------|--------|
| scan / scout                | Full discovery run (both aliases work) |
| scan --fast                 | Priority-only run (priority: true companies) |
| scan --sources greenhouse   | API-type filter |
| scan --company Anthropic    | Single company |
| scan --dry-run              | Preview only — zero file writes (see below) |
| scan --import jobs.csv      | CSV import, then drain |
| scan --clean                | Force stale check now |
| scan --new-chapter          | Show impact, require --confirm |
| scan --new-chapter --confirm | Execute new chapter rotation |
| scan --help                 | Show flag reference (see below) |

## --help Output

When --help flag detected, print and stop:

  career-scout scan — Job Discovery

  COMMANDS
    scan / scout              Full discovery run (all companies)
    scan --fast               Priority run (companies marked priority: true)
    scan --sources TYPE       Only scan portals of type: greenhouse, ashby, lever
    scan --company NAME       Scan a single company only
    scan --dry-run            Preview results without writing any files
    scan --import FILE        Import jobs from a CSV file
    scan --clean              Run stale check now (don't wait for weekly trigger)
    scan --new-chapter        Archive current data and start fresh (shows impact first)
    scan --help               Show this help

  INBOX
    data/inbox.txt            Drop URLs here, one per line
                              Optional metadata: URL | Company | Role | Source
                              Drained on every scan run.

  KEY FILES
    config/portals.yml        Companies to scan + title/location filters
    data/pipeline.md          Pending jobs (Scout writes, Evaluator processes)
    data/archived.md          Dead links removed from pipeline (recoverable)
    data/.scout-state.json    Scan state (last run, dry spell counter)

## Step 0: Preflight
- Check config/portals.yml exists and has tracked_companies
  - If empty/missing: guide user to copy from config/portals.example.yml
    or offer to populate it from their target roles
- Check Node.js available (needed for scan.mjs)
- Read data/.scout-state.json if it exists

## Step 0a: Welcome Back Notice (non-blocking)

**First run** (no .scout-state.json): Skip this notice entirely. This is onboarding,
not a "welcome back." The preflight check in Step 0 handles first-run guidance.

**Returning user** (.scout-state.json exists AND last_scan is older than 60 days):

  "Note: You haven't run Scout in {N} days. If you're starting a
   fresh search, run 'scan --new-chapter' to archive old data first."

No question, no prompt, no blocking. User reads the tip and acts on it or ignores it.
The scan continues normally. Consistent with "minimal intervention" principle.

Skip this notice if --clean, --new-chapter, --dry-run, or --import flags are present
(user already knows what they're doing).

## Step 0b: New Chapter (if --new-chapter flag)
- Compute row counts for pipeline.md, applications.md, scan-history.tsv, archived.md
- Show impact summary (see D8 above)
- If --confirm not present: STOP after showing impact
- If --confirm present:
  - Create data/archive/YYYY-MM-DD/ directory
  - Move all four data files into it
  - Create fresh empty versions (same headers/format as originals)
  - Reset data/.scout-state.json (last_clean + last_scan = today, consecutive_empty_scans = 0)
  - Confirm: "New chapter started. Data archived to data/archive/YYYY-MM-DD/"
  - STOP (don't run discovery after reset)

## --dry-run Behavior

`--dry-run` means ZERO file writes anywhere in the pipeline:
- scan.mjs: scans APIs but does NOT write scan-history.tsv
- Agent: does NOT drain inbox (draining = resetting the file = a write)
- Agent: does NOT append to pipeline.md
- Agent: does NOT update .scout-state.json
- Agent: does NOT run stale check
- Agent: DOES show scan.mjs JSON results (what WOULD be added)

## Step 1: Run Portal Scanner
- Execute: node scripts/scan.mjs [--fast] [--sources X] [--company X]
           [--dry-run] [--import FILE]
- Capture stdout (JSON) and stderr (human summary to user)
- If exit code 1: show error, stop
- If exit code 2 (CSV mapping failed): read CSV headers, LLM-map columns,
  construct normalized JSON, continue to Step 3 with source = "csv-import"
- Store parsed JSON as SCAN_RESULTS
- If --fast and stats.companies_scanned == 0: warn
  "No companies marked priority: true in portals.yml.
   Mark dream companies with 'priority: true' to use --fast mode."

## Step 2: Drain Inbox
- Skip entirely if --dry-run
- Read data/inbox.txt:
  - Lines starting with # → skip (comments)
  - Empty lines → skip
  - Lines containing ` | ` → split as URL | Company | Role | Source
    (missing fields default to empty; if Role empty, agent fetches page)
  - Lines without ` | ` → URL only; agent fetches page to extract company + title
- For each inbox entry:
  a. Dedup against scan-history.tsv + pipeline.md + applications.md
  b. Add valid entries to SCAN_RESULTS.offers
     (source from parsed Source field, default "manual")
- Append drained entries to scan-history.tsv
- Do NOT reset inbox.txt yet — wait until after pipeline.md is written (Step 3)

## Step 3: Append to pipeline.md + Reset Inbox
- Skip entirely if --dry-run (show what WOULD be added instead)
- Read data/pipeline.md
- For each offer in SCAN_RESULTS.offers:
  | {url} | {company} | {title} | {source} | {YYYY-MM-DD} | |
- Append to Pending table. Write updated file.
- CRITICAL: Append only. Never remove or modify existing rows.
- AFTER pipeline.md is written: reset inbox.txt to comment-only header.
  (This ordering prevents data loss: if crash before Step 3, inbox.txt still
  has entries and dedup prevents duplicates on next run.)

## Step 4: Update State + Print Summary

Update data/.scout-state.json:
- last_scan = today
- If new offers > 0: consecutive_empty_scans = 0
- If new offers = 0: consecutive_empty_scans += 1

Print:

  Scout Complete — {date} [{PRIORITY RUN | full run}]
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Companies scanned:     {n}
  Jobs found:            {n}
  Filtered (title):      {n}
  Filtered (location):   {n}
  Duplicates:            {n}
  From inbox:            {n}
  ────────────────────────────────────────
  New in pipeline:       {n}

  [if new offers > 0: list each: + Company | Title | source-tag]
  [if errors: list per-company API errors]

**Conditional next-step message (based on new offer count):**

  0 new jobs:
    "Pipeline is up to date."
    [if consecutive_empty_scans >= 3:]
      "Note: Scout hasn't found new jobs in {n} consecutive runs.
       Consider broadening title_filter in config/portals.yml
       or adding more companies."

  1–4 new jobs:
    "Run 'pipeline' to evaluate the new offers."

  5+ new jobs:
    "Run 'pipeline' to evaluate the new offers — you have a solid
     batch to work through."

## Step 5: Weekly Stale Check (if due — runs AFTER discovery)

**Why after discovery:** User's primary intent is "find new jobs." Give them results
first. Housekeeping runs at the end. If they Ctrl+C, no harm — stale check runs next time.

**Skip if:** `--fast`, `--dry-run`, or `--import` flag is set.
**Run if:** `last_clean` in .scout-state.json is >7 days ago OR `--clean` flag present.

For each row in pipeline.md Pending where Found date is older than stale_threshold_days:
  - If Found date is missing or unparseable → skip that row (don't crash, don't archive)
  a. Fetch URL via WebFetch (captures final URL + response body)
  b. Classify liveness:
     - HTTP 404/410           → Archive: [HTTP {code}]
     - Final URL ≠ input URL
       AND final URL matches base portal pattern  → Archive: [REDIRECT — job closed]
     - Body contains expiry phrases               → Archive: [EXPIRED TEXT]
     - Body < 300 chars, no apply button          → Archive: [NO APPLY BUTTON]
     - Body present, no apply button              → Flag Notes: [AGE: N days — verify]
     - Apply button found                         → No action
     - Network error / timeout                   → Skip (retry next week)
  c. Archive: remove row from pipeline.md Pending, append to data/archived.md,
     append NEW row to scan-history.tsv with status "archived" and today's date
     (append-only — never modify existing rows)

After stale check, print noisy summary:
  Stale Check
  ━━━━━━━━━━━
  Checked:   {n} pending items older than {stale_threshold_days} days
  Archived:  {n} dead links
    - Company | Role | Reason
    - ...
  Flagged:   {n} uncertain (check Notes column in pipeline.md)
  Active:    {n} confirmed live

  Archived items are in data/archived.md.
  To restore: move the row back to data/pipeline.md Pending.

Update last_clean in .scout-state.json.

## Error Handling
- portals.yml missing/empty → guide to copy example or populate via setup
- scan.mjs not found → "scripts/scan.mjs not found. Verify installation."
- Node.js unavailable → "Node.js 18+ required."
- inbox URL fetch fails → skip that entry, note in summary

## Pipeline Format Reference
  ## Pending
  | URL | Company | Role | Source | Found | Notes |
  |-----|---------|------|--------|-------|-------|
  | https://... | Acme | Sr. Engineer | greenhouse-api | 2026-05-18 | |

  ## Evaluated
  | # | URL | Company | Role | Score | Fit | Status | Report | PDF | Notes |

## Deferred — Phase 3b
- Level 1: Playwright direct scraping of careers pages
- Level 3: WebSearch broad discovery with liveness checking
- LinkedIn integration via browser extension writing to inbox
- BrightData LinkedIn API
```

**LLM-Physics Reminders (append to mode file):**
- Do NOT score, rank, or recommend jobs. That is pipeline-triage's job.
- Do NOT modify the Evaluated section of pipeline.md.
- Do NOT read job descriptions or evaluate fit during scanning.
- scan.mjs is a zero-token tool. Do not replicate its work with LLM calls.
- Discovery first, housekeeping last. Steps 1-4 (scan + inbox + append + summary) run
  before Step 5 (stale check). User sees new jobs fast.
- scan-history.tsv is append-only. Never modify existing rows. Append new rows for
  status changes (e.g., status "archived" for stale links).
- Malformed dates in scan-history.tsv or pipeline.md: skip the row, don't crash.
  Default to including in dedup set (over-dedup is safer than under-dedup).

### 3. NEW: `data/inbox.txt`

Single inbox file. Drop URLs, optionally with metadata via pipes.

```
# Drop job URLs here. Scout drains this file on every run.
# Add metadata with pipes: URL | Company | Role | Source

https://boards.greenhouse.io/stripe/jobs/123
https://jobs.lever.co/openai/456 | OpenAI | ML Platform | browser-ext
```

User layer. Scout parses each non-comment line:
- Has ` | ` (space-pipe-space) → split as `URL | Company | Role | Source`
  (missing fields default to empty; empty Role → agent fetches; empty Source → "manual")
- No ` | ` → URL only, agent fetches page for metadata

After draining, file is reset to comment-only header.

### 4. NEW: `data/archived.md`

Human-readable record of dead/expired links removed from pipeline.

```markdown
# Archived Jobs

Jobs removed from pipeline.md due to expired or unreachable postings.
To restore: move the row back to data/pipeline.md Pending table.

| URL | Company | Role | Source | Found | Archived | Reason |
|-----|---------|------|--------|-------|----------|--------|
```

User layer. Append-only during normal operation. Rotated on `--new-chapter`.

### 5. NEW: `data/.scout-state.json`

Lightweight state file tracking scan cadence and dry spell counter.

```json
{
  "last_clean": "2026-05-11",
  "last_scan": "2026-05-18",
  "consecutive_empty_scans": 0
}
```

User layer. Do not gitignore (useful to share state across machines).

### 6. NEW: `config/portals.example.yml`

Port from `career-ops/templates/portals.example.yml` (977 lines, 50+ companies).

Changes:
- Header: `# EXAMPLE — Copy to config/portals.yml and customize`
- English-only comments
- `[CUSTOMIZE]` markers on title_filter fields
- Add `priority: true` field to a few example entries with explanation
- Add `stale_threshold_days` and `lookback_days` global config fields with defaults
- Remove `scan_method: playwright` / `scan_method: websearch` fields (not supported yet)
- Keep all 50+ company entries as reference
- Keep `search_queries` section with note "Phase 3b — not yet used by scanner"

### 7. NEW: `scripts/liveness-core.mjs` (~80 lines)

Direct port from `career-ops/liveness-core.mjs`. Pure function module:
`export function classifyLiveness(...)`. No file I/O, no dependencies.

Shipped in Phase 3 for free — costs nothing, unblocks Phase 3b, and useful standalone.

### 8. NEW: `scripts/check-liveness.mjs` (~120 lines)

Port from `career-ops/check-liveness.mjs`. Update import path:
`import { classifyLiveness } from './liveness-core.mjs'`

CLI utility: `node scripts/check-liveness.mjs <url1> [url2...]` or `--file urls.txt`

### 9. MODIFY: `modes/setup.md`

Add Step 8 (after existing steps, before "Ready"):

```
## Step 8: Portal Scanner Configuration (recommended)

If config/portals.yml is still the empty template:

"I can set up your job scanner with 50+ pre-configured companies
(Greenhouse, Ashby, Lever portals). Want me to customize the search
keywords for your target roles?"

If yes:
1. Copy config/portals.example.yml → config/portals.yml
2. Update title_filter.positive with keywords from profile.yml target_roles
3. Update location_filter with user's location preferences
4. Confirm: "Scanner configured with {N} companies. Run 'scan' to discover jobs."

If no: skip. User can copy the example file manually later.

Also add callout: "Keep title_filter broad — the Evaluator does fine-grained scoring,
not the Scanner. A broad filter catches both AI Engineer AND Technical PM roles."
```

### 10. MODIFY: Routing files

**AGENTS.md** (line 85):
```diff
-| Types "scan" | Read `modes/_shared.md` + `modes/scan.md` (Phase 3) |
+| Types "scan" | Read `modes/_shared.md` + `modes/scan.md` |
```
Add to Main Files Reference:
```
| `data/inbox.txt` | Scout inbox — drop URLs here, Scout drains on every run |
| `data/archived.md` | Dead/stale links archived from pipeline (recoverable) |
| `config/portals.example.yml` | Example portal configuration (copy to portals.yml) |
```

**GEMINI.md** (line 42):
```diff
-| `scan` | Read `modes/_shared.md`, then `modes/scan.md`. (Phase 3 — not yet implemented) |
+| `scan` | Read `modes/_shared.md`, then `modes/scan.md`. Execute job discovery. |
```

**SKILL.md:**
- Phase 3 status: `Planned` → `**Active**`
- Add `scout` as alias alongside `scan` in mode routing table
- Move `scan` / `scout` from "Coming soon" to active commands:
  ```
  /career-scout scan                  → Full discovery run (all companies)
  /career-scout scan --fast           → Priority run (dream companies only)
  /career-scout scan --sources X      → Scan specific portal types (greenhouse, ashby, lever)
  /career-scout scan --dry-run        → Preview without writing files
  /career-scout scan --import F       → Import jobs from CSV file
  /career-scout scan --company X      → Scan a single company only
  /career-scout scan --clean          → Force stale check now
  /career-scout scan --new-chapter    → Start a new search (shows impact, requires --confirm)
  /career-scout scan --help           → Show flag reference
  ```

**AGENTS.md and GEMINI.md:** Add `scout` as alias for `scan` in routing table:
```
| Types "scan" or "scout" | Read `modes/_shared.md` + `modes/scan.md` |
```

### 11. MODIFY: `package.json`

```diff
 "dependencies": {
+  "js-yaml": "^4.1.0",
   "playwright": "^1.60.0"
 }
```

### 12. MODIFY: `docs/DATA_CONTRACT.md`

Add to User layer:
```
| data/inbox.txt         | Job inbox — URLs + optional metadata, Scout drains on every run |
| data/archived.md       | Stale/dead links removed from pipeline (recoverable) |
| data/.scout-state.json | Scout state (last_clean, last_scan, dry spell counter) |
```
Add to System layer: `| config/portals.example.yml | Example portal scanner configuration |`

### 13. MODIFY: `plan_rs/CONSOLIDATION-PLAN.md`

Update Phase 3 checklist to reflect actual implementation. Add Phase 3b section for
deferred work (Levels 1+3, LinkedIn, BrightData).

### 14. MODIFY/CREATE: `README.md`

Add "Discovery (Scout)" section covering:
- How `scan` and `scan --fast` differ (daily habit vs full sweep)
- How to use `data/inbox.txt` (drop URLs with optional pipe-delimited metadata)
- When to use `scan --new-chapter` (starting a new search)
- Where found jobs go (`data/pipeline.md` Pending → run `pipeline` to evaluate)

---

## UX Flow

### Typical daily run

```
> scout

Scanning 42 companies via API (8 skipped — no API detected)

Scout Complete — 2026-05-18
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Companies scanned:     42
Jobs found:            380
Filtered (title):      290
Filtered (location):   15
Duplicates:            35
From inbox:            2
────────────────────────────
New in pipeline:       42

New offers:
  + Anthropic | AI Engineer | greenhouse-api
  + Retool | Forward Deployed Engineer | ashby-api
  + Stripe | Senior Systems Engineer | lever-api
  ...

Run 'pipeline' to evaluate the new offers.
```

### Second run same day — dedup catches everything

```
> scout

Scout Complete — 2026-05-18
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Companies scanned:     42
Jobs found:            380
Duplicates:            380
────────────────────────────
New in pipeline:       0

Pipeline is up to date. No new offers found.
```

### Inbox drain — user saved a job from browser

```
# User (or browser extension) added to data/inbox.md:
| https://boards.greenhouse.io/stripe/jobs/123 | Stripe | Sr. Engineer | browser-ext | |
```

```
> scout

Scout Complete — 2026-05-18
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Companies scanned:     42
From inbox:            1
────────────────────────────
New in pipeline:       1

New offers:
  + Stripe | Sr. Engineer | browser-ext

Run 'pipeline' to evaluate the new offers.
```

### Priority-only daily run

```
> scout --fast

[Priority run — 6 companies marked priority: true]

Scout Complete — 2026-05-18 [PRIORITY RUN]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Companies scanned:     6
Jobs found:            48
Duplicates:            45
────────────────────────────────────────────
New in pipeline:       3

New offers:
  + Anthropic | Research Engineer | greenhouse-api
  + Stripe | Platform Engineer | ashby-api
  + Apple | ML Engineer | lever-api

Run 'pipeline' to evaluate the new offers.
```

### Weekly stale check (auto, or scout --clean)

Stale check runs AFTER discovery results (Step 5, not Step 1):

```
> scout

Scout Complete — 2026-05-18
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Companies scanned:     42
Jobs found:            380
Duplicates:            372
From inbox:            0
────────────────────────────
New in pipeline:       8

New offers:
  + Anthropic | Research Engineer | greenhouse-api
  + Stripe | Platform Engineer | ashby-api
  ...

Run 'pipeline' to evaluate the new offers.

Stale Check
━━━━━━━━━━━
Checked:   12 pending items older than 21 days
Archived:  3 dead links
  - Acme Corp | AI Lead | [HTTP 404]
  - BigCo | Staff Engineer | [REDIRECT — job closed]
  - OldCo | ML Platform | [EXPIRED TEXT]
Flagged:   2 uncertain (check Notes column in pipeline.md)
Active:    7 confirmed live

Archived items are in data/archived.md.
To restore: move the row back to data/pipeline.md Pending.
```

### CSV import

```
> scout --import referrals.csv

Scout Complete — 2026-05-18
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Imported from CSV:     8
Duplicates:            2
────────────────────────────
New in pipeline:       6
```

### New chapter (fresh search)

```
> scout --new-chapter

This will archive:
  data/pipeline.md       (14 pending, 38 evaluated rows)
  data/applications.md   (38 entries)
  data/scan-history.tsv  (4,218 entries)
  data/archived.md       (67 entries)
  data/follow-ups.md     (5 entries)

Archive destination: data/archive/2026-05-18/

NOT archived: data/inbox.txt (pending items carry forward)
NOT touched:  reports/, output/, config/

Run 'scout --new-chapter --confirm' to proceed.
```

```
> scout --new-chapter --confirm

New chapter started. Data archived to data/archive/2026-05-18/
Fresh pipeline.md, applications.md, scan-history.tsv created.
Scout state reset.

Run 'scout' to begin your new search.
```

---

## Dedup Logic (3 layers + lookback window)

1. **URL match** — Collect all URLs from scan-history.tsv + pipeline.md + applications.md
   into a Set. Any URL already in the set is skipped.

2. **Company+Role match** — Extract company::role pairs from applications.md (normalized
   lowercase). Catches re-posts with different URLs on different ATS platforms.

3. **Intra-scan dedup** — During a single scan run, newly discovered URLs and pairs are
   added to the sets as processed. Prevents same job appearing twice from multiple sources.

4. **Lookback window** — When loading scan-history.tsv, ignore entries where `first_seen`
   is older than `lookback_days` (default 180, configurable in portals.yml). This allows
   re-discovery of roles at companies you visited long ago without requiring `--new-chapter`.
   pipeline.md and applications.md are always fully checked (never windowed) — you don't
   want to re-evaluate something still in your active pipeline.

---

## Future Integration Points (designed but not built)

### Browser Extension (separate project, future)
Two write paths, both work without a running daemon:
- **inbox.txt** — extension appends a URL on one line (simplest possible)
- **inbox.md** — extension appends a structured table row with metadata
Scout drains both on next run. LinkedIn covered naturally: user is logged in,
browses, clicks extension button, URL lands in inbox.

### LinkedIn API (Phase 3b or later)
- BrightData integration, pay-as-you-go
- Placeholder in portals.yml: `api_provider: brightdata-linkedin`
- Not designed, not built, just acknowledged

### WebSearch Discovery (Phase 3b)
- Uses `search_queries` from portals.yml
- Agent constructs queries from profile + domain pack keywords
- Results validated with liveness-core.mjs (already shipped in Phase 3)
- liveness-core.mjs + check-liveness.mjs ready for Phase 3b use

---

## Implementation Sequence

1. **Dependencies + templates** — Add js-yaml to package.json, npm install, create
   data/inbox.txt, data/archived.md, data/.scout-state.json,
   create config/portals.example.yml, update config/portals.yml header
2. **Liveness modules** — Port scripts/liveness-core.mjs + scripts/check-liveness.mjs
   (standalone, no integration needed)
3. **scan.mjs** — Port from career-ops, adapt paths/output/flags. Add --fast, --sources,
   --import, lookback window. Remove appendToPipeline. JSON stdout. Test with --dry-run.
4. **modes/scan.md** — Full mode file: flag routing, --new-chapter, stale check, inbox
   drain, pipeline append, summary. Follow existing mode patterns (evaluate.md, cv.md).
5. **setup.md** — Add Step 8 for portals configuration + title_filter callout
6. **Routing + docs** — AGENTS.md, GEMINI.md, SKILL.md, DATA_CONTRACT.md,
   CONSOLIDATION-PLAN.md
7. **End-to-end testing** — Full scan, --fast, inbox drain, stale check, --new-chapter
   impact display, CSV import, idempotency

## Testing

| Test | Method | Expected |
|------|--------|----------|
| Empty portals.yml | `node scripts/scan.mjs` | Empty JSON, no crash |
| Dry run | `--dry-run` with real portals | JSON stdout, scan-history.tsv untouched |
| Dedup | Run scan twice | Second run: 0 new offers |
| Title filter | Set positive: ["Nonexistent"] | All jobs filtered, 0 new |
| Sources flag | `--sources greenhouse` | Only Greenhouse portals scanned |
| Fast flag | `--fast` with some priority:true | Only priority companies scanned |
| Company flag | `--company Anthropic` | Only Anthropic scanned |
| JSON validity | Pipe stdout to `node -e "JSON.parse(...)"` | Valid JSON, no crash |
| TSV format | After scan, check scan-history.tsv | 7 columns, valid dates |
| Lookback window | Set lookback_days:1, run scan | Old entries ignored in dedup |
| Pipeline append | After scan | New rows in Pending, Evaluated untouched |
| inbox.txt URL-only | Add bare URLs to inbox.txt, run scan | Rows in pipeline.md, inbox.txt cleared |
| inbox.txt with pipes | Add `URL | Co | Role | src` lines | Metadata used directly, no fetch |
| Idempotency | Scan, drain, scan again | 0 new on second run |
| CSV import | `--import test.csv` with standard headers | Results in pipeline.md |
| CSV unmappable | CSV with unrecognised headers | Exit code 2, agent LLM-maps |
| Stale check | Add 22-day-old row, run `--clean` | Row fetched, classified, archived or flagged |
| Archive format | After stale check | archived.md has correct 7-column format |
| New chapter dry | `scout --new-chapter` (no --confirm) | Impact shown, no files moved |
| Weekly auto | Set last_clean to 8 days ago | Stale check runs automatically |

## Critical Files

| File | Action | Lines (est.) |
|------|--------|-------------|
| `scripts/scan.mjs` | Create (port from career-ops + --fast + lookback) | ~340 |
| `modes/scan.md` | Create (full workflow: stale check, new-chapter, intercepts) | ~260 |
| `data/inbox.txt` | Create (template with comments) | ~4 |
| `data/archived.md` | Create (template) | ~8 |
| `data/.scout-state.json` | Create (initial state with all 3 fields) | ~6 |
| `config/portals.example.yml` | Create (port from career-ops + new fields) | ~920 |
| `scripts/liveness-core.mjs` | Create (port) | ~80 |
| `scripts/check-liveness.mjs` | Create (port) | ~120 |
| `modes/setup.md` | Add Step 8 + title_filter callout | +25 |
| `AGENTS.md` | Update routing + `scout` alias + file reference | ~10 lines |
| `GEMINI.md` | Update routing + `scout` alias + new commands | ~6 lines |
| `SKILL.md` | Phase status + expanded menu + `scout` alias | ~22 lines |
| `docs/DATA_CONTRACT.md` | Add inbox + archived + state + example | ~6 lines |
| `package.json` | Add js-yaml | ~1 line |
| `README.md` | Add "Discovery (Scout)" section | ~40 lines |
| `plan_rs/CONSOLIDATION-PLAN.md` | Phase 3 checklist + 3b section | ~25 lines |

## Gemini Review Log

| Round | Finding | Decision | Rationale |
|-------|---------|----------|-----------|
| R1 | Stale pipeline clutters pipeline.md over time | Adopt | Weekly HEAD+content check, auto-archive dead links |
| R1 | 1-year reset loses dedup protection | Adopt (modified) | Lookback window on scan-history.tsv + --new-chapter |
| R1 | inbox.txt simpler than inbox.md for raw dumps | Adopt | Support both formats |
| R1 | Source tagging in pipeline.md | Already in plan | No change needed |
| R1 | Multi-archetype filter confusion | Adopt as docs | setup.md Step 8 callout, not a design change |
| R2 | Archived section in pipeline.md becomes graveyard | Adopt (modified) | Separate data/archived.md instead |
| R2 | Stale check on every scan causes hidden latency | Adopt | Weekly check via .scout-state.json |
| R2 | lookback_days config is forgettable | Adopt (modified) | Keep + add --new-chapter as explicit reset |
| R2 | Silent archiving loses trust | Adopt | Noisy explicit summary with recovery instructions |
| R3 | Rotate scan-history.tsv on --new-chapter | Adopt | Truly fresh = truly fresh; archive preserves old data |
| R3 | Zombie jobs (200 OK redirects) not caught by 404 check | Adopt | WebFetch + URL redirect + content check in stale step |
| R3 | priority: true + scout --fast for daily habit | Adopt | Trivial to implement, great UX |
| R3 | --new-chapter needs --confirm safety gate | Adopt | Show impact, require explicit flag |
| R4 | "Welcome Back" intercept for long absences | Adopt | Check last_scan > 60 days in Step 0a |
| R4 | "Dry Spell" nudge for consecutive empty runs | Adopt | consecutive_empty_scans counter in state |
| R4 | README.md + scout --help for human discoverability | Adopt | Deliverable 15 + --help flag in mode routing |
| R4 | Smart next-step message based on job volume | Adopt | 0 / 1-4 / 5+ different messages; batch deferred |
| R4 | Archiving visibility already good | Confirmed | No change |
| Meta | `scout` vs `scan` naming confusion | Adopt alias | Both words route to scan mode |
| Self | .scout-state.json deliverable missing consecutive_empty_scans | Fix | Updated deliverable 5 |
| Self | Stale check runs BEFORE discovery — wrong priority | Fix | Moved to Step 5 (after summary) |
| Self | scan-history.tsv status update is modify-in-place | Fix | Append-only event log instead |
| Self | --import flag skips inbox drain | Fix | Removed skip — both coexist |
| Self | Welcome Back intercept blocks with question | Fix | Non-blocking one-liner notice |
| Self | Two inbox files is one too many | Simplify | Merged into single inbox.txt with smart parsing |
| Self | --fast doesn't skip stale check | Simplify | --fast skips stale check for speed |
| Self | Deliverable numbering jumbled | Fix | Renumbered 1-14 |
| Eng | First-run Welcome Back triggers with no state file | Fix | Distinguish first run (no file) from returning user (>60 days) |
| Eng | inbox.txt reset before pipeline write → data loss window | Fix | Move reset to after Step 3 |
| Eng | --dry-run behavior underspecified | Fix | Explicit: zero writes anywhere |
| Eng | --fast + no priority companies → silent empty | Fix | Detect and warn in Step 1 |
| Eng | --new-chapter date collision | Fix | Append suffix if directory exists |
| Eng | UX stale check example showed wrong ordering | Fix | Discovery first, stale after |
| Eng | scan.mjs CWD-dependent paths | Fix | Use import.meta.url resolution |
| Eng | --new-chapter missing follow-ups.md + inbox carry-forward | Fix | Added to rotation, inbox excluded |
| Eng | Pipe parsing on bare \| splits URLs with query params | Fix | Split on ` \| ` (space-pipe-space) |
| Eng | Pipe parsing: fewer than 4 fields | Fix | Default to empty, fetch missing Role |
| Eng | Stale check: rows with missing Found date | Fix | Skip row, don't crash |
| Eng | Malformed dates in scan-history.tsv | Document | Skip row, default to including in dedup |
| R5 | Batch stale check for performance | Note | Implementation detail, not plan-level — agent decides parallelism |
| R5 | --new-chapter resets last_clean to null → triggers stale on empty | Fix | Set last_clean + last_scan to today on reset |
| R5 | scout --list-priority command | Defer | User can grep portals.yml; not worth a new flag in Phase 3 |
| R5 | Additional "burial phrases" for zombie detection | Already covered | D3 + liveness-core.mjs already handle expiry phrases |

## Known Limitations (not worth engineering for)

- **scan-history.tsv unbounded growth:** Append-only file grows ~27MB/year at scale.
  Fine for Node.js memory. Mitigated by `--new-chapter` which rotates the file.
- **URL normalization:** Same job with different query params (e.g., `?gh_jid=456`)
  is not deduplicated by URL. Partially mitigated by Company+Role dedup (Layer 2).
  Full fix (stripping tracking params) deferred to Phase 3b.
- **Concurrent scan invocations:** Two terminals running `scout` simultaneously could
  cause TSV corruption or pipeline.md conflicts. Single-user CLI tool — user error.
- **Stale check redirect heuristics:** "Base portal pattern" detection is fuzzy.
  Agent uses judgment: fewer path segments, known portal roots, no job-specific paths.
  Good enough for an LLM agent. Not worth codifying exact regex patterns.

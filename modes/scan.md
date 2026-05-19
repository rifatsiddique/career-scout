# Mode: scan — Job Discovery (Scout)

Discovers new jobs from portal APIs and the inbox file, writes them to
`data/pipeline.md` for later evaluation via `pipeline` mode.

---

## Flag Routing

Parse flags from user input before doing anything:

| Input | Action |
|-------|--------|
| `scan` / `scout` | Full discovery run (both aliases work) |
| `scan --fast` | Priority-only run (`priority: true` companies) |
| `scan --sources TYPE` | Only scan portals of type: greenhouse, ashby, lever |
| `scan --company NAME` | Scan a single company only |
| `scan --dry-run` | Preview only — zero file writes anywhere |
| `scan --import FILE` | Import jobs from a CSV file |
| `scan --clean` | Force stale check now (don't wait for weekly trigger) |
| `scan --new-chapter` | Show impact summary, require `--confirm` to proceed |
| `scan --new-chapter --confirm` | Archive all data files and start fresh |
| `scan --discover` | Find new companies based on your CV and add to portals.yml |
| `scan --discover --focus TOPIC` | Focus discovery on a specific domain (overrides CV) |
| `scan --help` | Show flag reference |

---

## --help Output

When `--help` flag detected, print and stop:

```
career-scout scan — Job Discovery

COMMANDS
  scan / scout              Full discovery run (all enabled companies)
  scan --fast               Priority run (companies marked priority: true)
  scan --sources TYPE       Only scan portals of type: greenhouse, ashby, lever
  scan --company NAME       Scan a single company only
  scan --dry-run            Preview results without writing any files
  scan --import FILE        Import jobs from a CSV file
  scan --clean              Run stale check now (don't wait for weekly trigger)
  scan --new-chapter        Archive current data and start fresh (shows impact first)
  scan --discover           Find new companies based on your CV and add to portals.yml
  scan --discover --focus X Focus discovery on a specific domain (e.g., "medical devices")
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

RECIPES
  Discover based on my CV:        scan --discover
  Discover for a specific niche:  scan --discover --focus "Robotics startups in Munich"
  Daily habit (dream companies):  scan --fast
  Import from recruiter email:    Paste URLs in data/inbox.txt, then: scan
  Full sweep (all companies):     scan
  Start a fresh search:           scan --new-chapter
```

---

## --dry-run Behavior

`--dry-run` means ZERO file writes anywhere in the pipeline:
- scan.mjs: scans APIs but does NOT write scan-history.tsv
- Agent: does NOT drain inbox (draining = resetting the file = a write)
- Agent: does NOT append to pipeline.md
- Agent: does NOT update .scout-state.json
- Agent: does NOT run stale check
- Agent: DOES show scan.mjs JSON results (what WOULD be added)

---

## Step 0: Preflight

1. Check `config/portals.yml` exists:
   - If missing: "Run `setup` to configure the scanner, or copy `config/portals.example.yml`."
   - If present but `tracked_companies` is empty: "No companies configured. Run `setup` or
     edit `config/portals.yml` directly. See `config/portals.example.yml` for examples."
2. Check Node.js is available (required for scan.mjs).
3. Read `data/.scout-state.json` if it exists.

## Step 0a: Welcome Back Notice (non-blocking)

**First run** (no `.scout-state.json`): Skip this notice. This is onboarding, not a return.

**Returning user** (`.scout-state.json` exists AND `last_scan` > 60 days ago):

  > "Note: You haven't run Scout in {N} days. If you're starting a fresh search,
  >  run `scan --new-chapter` to archive old data first."

No question, no blocking. The scan continues regardless.

Skip this notice if `--clean`, `--new-chapter`, `--dry-run`, or `--import` flags are present.

## Step 0b: New Chapter (if `--new-chapter` flag)

**Without `--confirm`:** Read row counts from all data files, show impact and stop:

```
This will archive:
  data/pipeline.md       (N pending, M evaluated rows)
  data/applications.md   (K entries)
  data/scan-history.tsv  (J entries)
  data/archived.md       (L entries)
  data/follow-ups.md     (F entries)

Archive destination: data/archive/YYYY-MM-DD/
  (If directory exists, append suffix: -2, -3, ...)

NOT archived: data/inbox.txt (pending items carry forward)
NOT touched:  reports/, output/, config/

Run `scan --new-chapter --confirm` to proceed.
```

**With `--confirm`:**
1. Create `data/archive/YYYY-MM-DD/` (append `-2`, `-3` if it already exists)
2. Move all five data files into the archive directory
3. Create fresh empty versions of all files (same headers/format as originals)
4. Reset `data/.scout-state.json`:
   ```json
   { "last_clean": "YYYY-MM-DD", "last_scan": "YYYY-MM-DD", "consecutive_empty_scans": 0 }
   ```
   Set `last_clean` AND `last_scan` to TODAY — prevents an immediate stale check on an empty pipeline.
5. Print: "New chapter started. Data archived to data/archive/YYYY-MM-DD/. Run `scan` to begin."
6. STOP (don't run discovery after reset).

---

## Step 0d: Discover Companies (if `--discover` flag)

**STOP after this step** — don't run the normal portal scan.

### Phase 1: Extract profile signals

**If `--focus TOPIC` provided:** Use the topic as the primary domain. Skip CV-derived
domains. Still use market/location from profile.

**Otherwise:** Read `cv.md`, `config/profile.yml`, `modes/_profile.md`. Extract:

- **Past employers** — company names from Work Experience in cv.md
- **Target role keywords** — from `target_roles.primary` in profile.yml
- **Domain signals** — domain keywords from archetype table in _profile.md
- **Market/location** — `location.market` + `location.country` from profile.yml;
  ALSO `location_filter.allow/block` from portals.yml for geographic constraints
- **Existing companies (dedup set)** — build two sets from portals.yml `tracked_companies`:
  - Normalized names: lowercase, strip "Inc"/"Corp"/"Ltd"/"GmbH"/"AG"/"SE"/"S.A." suffixes
  - URL slugs: extract slug from `careers_url` (e.g., `jobs.ashbyhq.com/wolfspeed` → `wolfspeed`)
  - A discovered company is duplicate if EITHER normalized name OR URL slug matches

**Guard:** If cv.md is empty or has no Work Experience content, stop:
> "Your CV doesn't have enough content for discovery. Add your work experience to cv.md first."

Show the user what was derived before searching:
```
Based on your profile, I'll search for companies in:
  1. {Domain A} — from your experience at {Employer 1}, {Employer 2}
  2. {Domain B} — from your archetype '{Archetype Name}'
  3. Market: {market}, {location}
  [if --focus: "Focus: '{TOPIC}' (overriding profile domains)"]

Searching for companies with Greenhouse, Ashby, or Lever portals...
```

### Phase 2: WebSearch for companies

Build 4-6 WebSearch queries. Include market/geography in EVERY query.

Query patterns:
- `"top {domain} companies hiring {role keywords} {market/region}"`
- `"{past employer} competitors {domain} {market/region}"`
- `"{domain} startups {market/region} careers site:jobs.ashbyhq.com OR site:jobs.lever.co OR site:job-boards.greenhouse.io"`
- `"best {domain} companies {year} {market/region}"`

**Market-aware language:** For non-US markets, include local-language queries:
- DACH: `"Top {domain} Arbeitgeber {city}"` or `"{domain} Unternehmen {region} Karriere"`
- France: `"{domain} entreprises qui recrutent {city}"`
- Remote: `"remote-first companies hiring {role keywords}"`

**If `--focus TOPIC`:** Replace `{domain}` with the user-provided topic.

**Batching:** Prefer list-returning queries ("top 20 {domain} companies") over individual
lookups. Extract unique company names from results. Remove duplicates against the dedup
set. Target: 10–20 candidate companies.

### Phase 3: Resolve ATS portal URLs

Batch 3–5 companies per WebSearch for efficiency:
`"{Company A}" OR "{Company B}" OR "{Company C}" careers site:jobs.ashbyhq.com OR site:jobs.lever.co OR site:job-boards.greenhouse.io`

For each company, classify the careers portal:

| URL pattern | Result |
|-------------|--------|
| `jobs.ashbyhq.com/{slug}` | Ashby — enabled: true |
| `jobs.lever.co/{slug}` | Lever — enabled: true |
| `job-boards.greenhouse.io/{slug}` or `job-boards.eu.greenhouse.io/{slug}` | Greenhouse — enabled: true (also construct api: field) |
| `*.wd1.myworkdayjobs.com` or `*.wd5.myworkdayjobs.com` | enabled: false, "Uses Workday — add jobs via inbox.txt" |
| `*.taleo.net` | enabled: false, "Uses Taleo — add jobs via inbox.txt" |
| `*.icims.com` | enabled: false, "Uses iCIMS — add jobs via inbox.txt" |
| `apply.workable.com/*` | enabled: false, "Uses Workable — add jobs via inbox.txt" |
| Other / not found | enabled: false, "No scannable portal — add jobs via inbox.txt" |

### Phase 4: Present results

Split into two sections. Numbering is continuous across both sections.

```
Scannable (Greenhouse / Ashby / Lever — zero-token scanning):

  #   Company              Why                                       Portal
  1   Wolfspeed            Uses same SiC stack as your ADI work     jobs.ashbyhq.com/wolfspeed
  2   Navitas Semi         GaN pioneer, peer group to Delta         jobs.lever.co/navitas
  3   Infineon             Direct competitor of Analog Devices       job-boards.greenhouse.io/infineon

Manual only (no scannable API — add jobs via data/inbox.txt):

  #   Company              Why                                       ATS
  8   Eaton                Power management, peer to Delta           Uses Workday
  9   Texas Instruments    Analog/mixed-signal competitor            Uses Workday

Skipped {N} companies already in portals.yml.
```

**"Why" column:** Reference the specific connection — not generic labels:
- "Uses same GaN/SiC stack as your work at ADI" (tech stack)
- "Peer group to your Delta Electronics role" (past employer peer)
- "Direct competitor of Analog Devices" (market competitor)
- "Berlin-based, matches your DACH market" (geography)

If any company is a direct competitor of a past employer, flag it:
> "Infineon is a direct competitor of your past employer Analog Devices.
>  Marking as priority: true for --fast daily scans. (Change anytime in portals.yml.)"

Ask:
> "Add to portals.yml? Type 'all', specific numbers '1,3,5', or 'none'."

### Phase 5: Write to portals.yml

For each selected company, append to `tracked_companies` in portals.yml.
Include a YAML comment so the user remembers WHY it's there weeks later:

```yaml
# Discovery: SiC power specialist — competitor to Analog Devices (2026-05-18)
- name: Wolfspeed
  careers_url: https://jobs.ashbyhq.com/wolfspeed
  notes: "SiC power specialist, competitor to Analog Devices"
  enabled: true
```

Fields: name, careers_url, api (Greenhouse only), notes, enabled, priority (if competitor).

**Contextual next-step (user never wonders "now what?"):**

- Companies added:
  > "Added {N} companies to config/portals.yml ({M} scannable, {K} manual-only).
  >  Next: Run 'scan' to search these new companies for open roles."

- 0 found (all deduped):
  > "No new companies found — your portals.yml already covers this space.
  >  Try: scan --discover --focus '{different domain}'"

- 0 found (search empty):
  > "Couldn't find matching companies. Try broadening:
  >  scan --discover --focus '{broader domain or region}'"

- User said "none":
  > "No companies added. Run 'scan --discover' anytime to try again."

---

## Step 1: Run Portal Scanner

Execute: `node scripts/scan.mjs [--fast] [--sources TYPE] [--company NAME] [--dry-run] [--import FILE]`

- Capture stdout (JSON result) and stderr (human summary — display to user)
- If exit code 1: show error message from stderr, stop
- If exit code 2 (CSV column mapping failed):
  - Read the CSV headers from stderr output
  - Use LLM to determine column mapping (which column is URL, Company, Title, Location)
  - Construct normalized JSON offers array with source = "csv-import"
  - Continue to Step 3 with these offers as SCAN_RESULTS
- Parse stdout JSON → store as SCAN_RESULTS

---

## Step 2: Drain Inbox

Skip entirely if `--dry-run`.

Read `data/inbox.txt`:
- Lines starting with `#` → skip (comments)
- Empty lines → skip
- Lines containing ` | ` (space-pipe-space) → parse as `URL | Company | Role | Source`
  - Missing fields default to empty string
  - If Role is empty: agent fetches page to extract it
  - If Source is empty: default to "manual"
- Lines without ` | ` → URL only; agent fetches page to extract company + title

For each inbox entry:
a. Dedup: check URL against scan-history.tsv + pipeline.md + applications.md (simple string search)
b. Valid entries → add to SCAN_RESULTS.offers with appropriate source tag

Append drained entries to scan-history.tsv (status "added").
Do NOT reset inbox.txt yet — wait until after pipeline.md is written (Step 3).

---

## Step 3: Append to pipeline.md + Reset Inbox

Skip entirely if `--dry-run` (show what WOULD be added instead).

1. Read `data/pipeline.md`
2. For each offer in SCAN_RESULTS.offers, append to the Pending table:
   ```
   | {url} | {company} | {title} | {source} | {YYYY-MM-DD} | |
   ```
3. Write updated pipeline.md
4. CRITICAL: Append only. Never remove or modify existing rows.
   Preserve the Evaluated section exactly as-is.
5. AFTER pipeline.md is written: reset inbox.txt to comment-only header.
   (This ordering prevents data loss: if crash before Step 3, inbox.txt still has entries
   and dedup prevents duplicates on next run.)

---

## Step 4: Update State + Print Summary

Skip state update if `--dry-run`.

Update `data/.scout-state.json`:
- `last_scan` = today
- If new offers > 0: `consecutive_empty_scans` = 0
- If new offers = 0: `consecutive_empty_scans` += 1

Print:

```
Scout Complete — {date} [{PRIORITY RUN | full run}]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Companies scanned:     {n}
Jobs found:            {n}
Filtered (title):      {n}
Filtered (location):   {n}
Duplicates:            {n}
From inbox:            {n}
────────────────────────────────────────────
New in pipeline:       {n}

[if new offers > 0: list each: + Company | Title | source-tag]
[if errors: list per-company API errors from SCAN_RESULTS.errors]
```

**Conditional next-step message:**

| Condition | Message |
|-----------|---------|
| 0 new jobs | "Pipeline is up to date." |
| 0 new jobs AND consecutive_empty_scans >= 3 | "Note: Scout hasn't found new jobs in {n} consecutive runs. Consider broadening title_filter in config/portals.yml or adding more companies." |
| 1–4 new jobs | "Run 'pipeline' to evaluate the new offers." |
| 5+ new jobs | "Run 'pipeline' to evaluate the new offers — you have a solid batch to work through." |

---

## Step 5: Weekly Stale Check (runs AFTER discovery)

**Why after discovery:** User's primary intent is "find new jobs." Give them results first.
Housekeeping runs at the end. If they Ctrl+C, no harm — stale check runs next time.

**Skip if:** `--fast`, `--dry-run`, or `--import` flag is set.
**Run if:** `last_clean` in `.scout-state.json` is >7 days ago OR `--clean` flag present.
**First run** (no state file): skip stale check (nothing old to check).

Read `stale_threshold_days` from portals.yml (default: 21).

For each row in pipeline.md Pending table:
- If Found date is missing or unparseable → **skip that row** (don't crash)
- If Found date < today - stale_threshold_days → check liveness:

  a. Fetch URL via WebFetch (captures final URL + response body)
  b. Classify liveness:
     - HTTP 404/410 → **Archive**: `[HTTP {code}]`
     - Final URL ≠ input URL AND final URL matches base portal pattern → **Archive**: `[REDIRECT — job closed]`
     - Body contains expiry phrases ("job no longer available", "position filled", "this role is closed", etc.) → **Archive**: `[EXPIRED TEXT]`
     - Body < 300 chars, no apply button → **Archive**: `[NO APPLY BUTTON]`
     - Body present, no apply button → **Flag** Notes column: `[AGE: N days — verify manually]`
     - Apply button found → no action (leave in Pending)
     - Network error / timeout → **skip** (retry next week)

  c. Archive:
     - Remove row from pipeline.md Pending table
     - Append row to `data/archived.md` with today's date and reason
     - Append NEW row to scan-history.tsv with status `archived` and today's date
       (append-only — never modify existing rows; dedup reads column 0 regardless of status)

After stale check, print noisy summary:

```
Stale Check
━━━━━━━━━━━
Checked:   {n} pending items older than {stale_threshold_days} days
Archived:  {n} dead links
  - Company | Role | Reason
  - ...
Flagged:   {n} uncertain (check Notes column in pipeline.md)
Active:    {n} confirmed live

Archived items are in data/archived.md.
To restore: move the row back to data/pipeline.md Pending table.
```

Update `last_clean` in `.scout-state.json` to today.

---

## Error Handling

| Error | Action |
|-------|--------|
| portals.yml missing | Guide to copy example or run setup |
| portals.yml has no tracked_companies | Show which file to edit, link to example |
| scan.mjs not found | "scripts/scan.mjs not found. Verify installation." |
| Node.js unavailable | "Node.js 18+ required to run the scanner." |
| inbox URL fetch fails | Skip that entry, note in summary |
| pipeline.md Pending section missing | Create it with correct headers before appending |

---

## Pipeline Format Reference

```markdown
## Pending
| URL | Company | Role | Source | Found | Notes |
|-----|---------|------|--------|-------|-------|
| https://boards.greenhouse.io/acme/jobs/123 | Acme Corp | Senior Engineer | greenhouse-api | 2026-05-18 | |
| https://jobs.ashbyhq.com/stripe/456 | Stripe | Platform Engineer | ashby-api | 2026-05-18 | |

## Evaluated
| # | URL | Company | Role | Score | Fit | Status | Report | PDF | Notes |
|---|-----|---------|------|-------|-----|--------|--------|-----|-------|
```

---

## LLM-Physics Reminders

- Do NOT score, rank, or recommend jobs. That is pipeline-triage's job.
- Do NOT modify the Evaluated section of pipeline.md.
- Do NOT read job descriptions or evaluate fit during scanning.
- scan.mjs is a zero-token tool. Do not replicate its work with LLM calls.
- Discovery first, housekeeping last. Steps 1-4 (scan + inbox + append + summary) run
  BEFORE Step 5 (stale check). User sees new jobs fast.
- scan-history.tsv is append-only. Never modify existing rows. Append new rows for
  status changes (e.g., status "archived" for stale links).
- Malformed dates in scan-history.tsv or pipeline.md: skip the row, don't crash.
  Default to including in dedup set (over-dedup is safer than under-dedup).

---

## Deferred — Phase 3b

- Level 1: Playwright direct scraping of careers pages (non-API portals)
- Level 3: WebSearch broad discovery using `search_queries` from portals.yml
- Liveness verification for Level 3 results (liveness-core.mjs + check-liveness.mjs already shipped)
- LinkedIn integration via browser extension writing to inbox.txt
- BrightData LinkedIn API

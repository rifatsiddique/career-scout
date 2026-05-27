# Mode: scan — Job Discovery (Scout)

Discovers new jobs from portal APIs, priority company career pages, web search, niche
boards, and the inbox file. Writes qualifying roles to `data/pipeline.md`.

**Two tiers of capability:**
- **Portal-only mode** (Phase 3): if `config/scout-preferences.yml` is empty/missing, runs
  the portal API scanner + inbox drain only. All existing functionality preserved.
- **Advanced Scout mode** (Phase 7B): if preferences are configured, adds P0 priority-company
  scraping, P1/P2 web search discovery, auto-filtering, and quick-pass scoring.

---

## Flag Routing

Parse flags from user input before doing anything. Handle these before running any discovery:

| Input | Action |
|-------|--------|
| `scan` / `scout` | Full discovery run |
| `scan --setup` | Interactive preference setup → STOP after setup |
| `scan --rejected` | Show last 15 auto-rejected roles for audit → STOP |
| `scan --add-city "X"` | Add city to markets.active permanently → confirm + STOP |
| `scan --remove-city "X"` | Remove city from markets.active → confirm + STOP |
| `scan --add-company "X"` | Add company to target-companies.yml (AI finds URL) → confirm + STOP |
| `scan --remote` | Set remote_preference: remote-first → confirm + STOP |
| `scan --hybrid` | Set remote_preference: remote-friendly → confirm + STOP |
| `scan --onsite` | Set remote_preference: onsite-only → confirm + STOP |
| `scan --international active\|passive` | Set international mode → confirm + STOP |
| `scan --rigour high\|moderate\|explorer` | Set rigour level → confirm + STOP |
| `scan --confirm` | Re-enable the per-scan check-in (set auto_confirm: false) → confirm + STOP |
| `scan --fast` | Priority-only run (`priority: true` in portals.yml) |
| `scan --sources TYPE` | Only scan portals of type: greenhouse, ashby, lever |
| `scan --company NAME` | Scan a single portal company only |
| `scan --dry-run` | Preview only — zero file writes |
| `scan --force` | Bypass 24h scrape cache for priority company career pages |
| `scan --auto` | Skip the per-scan confirm block, run on stored prefs (same as auto_confirm:true for one run) |
| `scan --import FILE` | Import jobs from a CSV file |
| `scan --clean` | Force stale check now |
| `scan --new-chapter` | Show impact summary, require `--confirm` to proceed |
| `scan --new-chapter --confirm` | Archive all data files and start fresh |
| `scan --discover` | Find new companies based on your CV and add to portals.yml |
| `scan --discover --focus TOPIC` | Focus discovery on a specific domain |
| `scan --help` | Show flag reference |

**Combined flags:** `--add-city` combined with `--once` (e.g. `scan --add-city "Denver CO" --once`) applies only to this scan without persisting. `--auto` is an alias for `auto_confirm: true` for one run.

---

## --help Output

When `--help` flag detected, print and stop:

```
career-scout scan — Job Discovery

COMMANDS
  scan / scout                    Search all your configured sources for new jobs
  scan --setup                    Configure your scout preferences (runs first time automatically)
  scan --fast                     Quick check — favorite companies in portals.yml only
  scan --sources TYPE             Search one portal type: greenhouse, ashby, or lever
  scan --company NAME             Search just one portal company
  scan --force                    Re-scrape all priority company pages (bypass 24h cache)
  scan --auto                     Skip the check-in prompt, run on stored preferences
  scan --dry-run                  Preview what a search would find (nothing is saved)
  scan --import FILE              Add jobs from a spreadsheet or CSV
  scan --clean                    Check for dead/expired job links right now
  scan --new-chapter              Archive your old search history and start fresh
  scan --discover                 Find companies that match your background (adds to portals.yml)
  scan --discover --focus X       Search for companies in a specific area (e.g. "medical devices")
  scan --rejected                 Audit the last 15 auto-rejected roles (catch false negatives)
  scan --help                     Show this help

DOMAIN EXPANSION (permanent, one-line updates)
  scan --add-city "Denver CO"     Add a new target market
  scan --remove-city "Austin TX"  Remove a target market
  scan --add-company "Tesla"      Add to your priority company list (AI finds the careers URL)
  scan --remote                   Set search to remote-first
  scan --hybrid                   Set search to hybrid OK (default)
  scan --onsite                   Set search to on-site only
  scan --international active     Include international markets in every scan
  scan --rigour high              Only surface high-confidence matches (≥75)
  scan --rigour explorer          Surface everything ≥50, maximum coverage
  scan --confirm                  Re-enable the per-scan check-in prompt

INBOX (manual job entry)
  data/inbox.txt                  Paste job URLs here — one per line
                                  Optional: add company name, title, source (separated by |)
                                  Picked up automatically on your next scan.

KEY FILES
  config/scout-preferences.yml    Your scout strategy (markets, roles, auto-reject rules)
  config/target-companies.yml     Priority company list with career page URLs
  config/portals.yml              Portal API watch list (Greenhouse/Ashby/Lever)
  data/pipeline.md                Your job queue — new jobs land here after scanning
  data/scout-reject-log.md        Audit log of auto-rejected roles
  data/archived.md                Expired or dead job links (recoverable)
  data/.scout-state.json          Scan history (last run date, consecutive empty runs)
```

---

## --dry-run Behavior

`--dry-run` means ZERO file writes anywhere:
- scan.mjs: scans APIs but does NOT write scan-history.tsv
- Agent: does NOT drain inbox, write pipeline.md, update .scout-state.json, update scout-preferences.yml, or write scout-reject-log.md
- Agent: DOES show what WOULD be added (portal results, P0/P1/P2 results, filtered/scored)
- Agent: DOES run auto-filtering and scoring logic (to show the full would-be output)

---

## Step 0: Preflight

1. Check `config/portals.yml` exists (for portal scanner):
   - Missing: "Run `setup` to configure the scanner, or copy `config/portals.example.yml`."
   - Present but `tracked_companies` is empty: "No portal companies configured. Edit portals.yml or run `scan --discover`."
   - Note: portals.yml absence does NOT block advanced scout (P0/P1/P2). Both are independent.

2. Check Node.js is available (required for scan.mjs).

3. Read `data/.scout-state.json` if it exists.

4. Read `config/scout-preferences.yml` if it exists. Store as PREFS.
   - If missing or all fields empty/default: advanced scout is DISABLED for this run.
   - If populated: advanced scout is ENABLED.

5. Read `config/target-companies.yml` if it exists. Store as TARGET_COS.

---

## Step 0a: Welcome Back Notice (non-blocking)

**First run** (no `.scout-state.json`): Skip.

**Returning user** (`.scout-state.json` exists AND `last_scan` > 60 days ago):
> "Note: You haven't run Scout in {N} days. Starting a new job search?
>  Run 'scan --new-chapter' to save your old search history and start clean."

Skip if `--clean`, `--new-chapter`, `--dry-run`, `--import`, `--setup`, or `--rejected` flags.

---

## Step 0b: New Chapter (if `--new-chapter` flag)

**Without `--confirm`:** Show impact and stop:

```
This will save your old search history to a folder and start fresh.

What gets saved:
  Your job queue        (data/pipeline.md — N waiting, M reviewed)
  Your application log  (data/applications.md — K entries)
  Your scan history     (data/scan-history.tsv — J entries)
  Your archived links   (data/archived.md — L entries)
  Your follow-up notes  (data/follow-ups.md — F entries)

Saved to: data/archive/{today's date}/

NOT saved: data/inbox.txt (pending URLs carry forward)
NOT touched: reports/, output/, config/, data/scout-reject-log.md

Run 'scan --new-chapter --confirm' to proceed.
```

**With `--confirm`:**
1. Create `data/archive/YYYY-MM-DD/` (append `-2`, `-3` if exists)
2. Move all five data files into archive
3. Create fresh empty versions (same headers)
4. Reset `data/.scout-state.json` (last_clean = today, last_scan = today, consecutive_empty_scans = 0)
5. Print: "New chapter started. Archived to data/archive/YYYY-MM-DD/. Run `scan` to begin."
6. STOP.

---

## Step 0c: Quick Domain Expansion Commands

If any of these flags are detected, execute and STOP (unless `--once` is also present, in which case apply as an ephemeral override and continue to the scan):

**`scan --add-city "Denver CO"` (or `--once` variant):**
- Append to `PREFS.markets.active`
- Write updated scout-preferences.yml
- Set `last_reviewed` to today
- Print: `✅ Added Denver CO. Markets: Boston MA, San Jose CA, Austin TX, Denver CO, Remote.`

**`scan --remove-city "Austin TX"`:**
- Remove from `PREFS.markets.active`
- Write updated scout-preferences.yml, set `last_reviewed` to today
- Print: `✅ Removed Austin TX. Markets: Boston MA, San Jose CA, Remote.`

**`scan --add-company "Tesla"` (or `--once` variant):**
- Search the web for Tesla's careers page URL
- Show: `Found: https://www.tesla.com/careers — add to your priority list? [Y/n]`
- If confirmed: append to target-companies.yml with tier: 1, added: today
- Print: `✅ Added Tesla (tier 1). Career page: https://www.tesla.com/careers`
- If user provides a URL directly (`scan --add-company "Tesla" --url "https://..."`) use that URL.

**`scan --remote` / `--hybrid` / `--onsite`:**
- Set `remote_preference` in scout-preferences.yml accordingly
- Print: `✅ Remote preference set to remote-first.`

**`scan --international active` / `passive`:**
- Set `markets.international` in scout-preferences.yml
- Print: `✅ International mode set to active.`

**`scan --rigour high` / `moderate` / `explorer`:**
- Set `rigour` in scout-preferences.yml
- Print: `✅ Scout rigour set to high (only surfaces matches ≥75).`

**`scan --confirm`:**
- Set `auto_confirm: false` in scout-preferences.yml
- Print: `✅ Check-in prompt re-enabled. You'll see a brief strategy summary before each scan.`

**Natural-language equivalents:** If the user types "add Denver to my search" or "include remote roles", map these to the same operations above.

---

## Step 0d: Discover Companies (if `--discover` flag) — STOP after

See original discover flow below. Unchanged from Phase 3.

### Phase 1: Extract profile signals

**If `--focus TOPIC` provided:** Use topic as primary domain. Skip CV-derived domains.

**Otherwise:** Read `cv.md`, `config/profile.yml`, `modes/_profile.md`. Extract:
- **Past employers** — company names from Work Experience in cv.md
- **Target role keywords** — from `target_roles.primary` in profile.yml
- **Domain signals** — archetype keywords from _profile.md
- **Market/location** — `location.market` + `location.country` from profile.yml
- **Existing companies (dedup set)** — from portals.yml tracked_companies (normalized name + URL slug)

**Guard:** If cv.md is empty or has no Work Experience:
> "Your CV needs more content before I can search for matching companies. Add your work experience to cv.md first."

Show derived signals before searching:
```
Based on your CV and profile, I'll search for companies in:
  1. {Domain A} — from your experience at {Employer 1}, {Employer 2}
  2. {Domain B} — from your target job type '{Archetype Name}'
  Focusing on: {market}, {location preferences}

Searching for companies with job boards I can search automatically...
```

### Phase 2: WebSearch for companies

Build 4-6 queries. Include market in every query:
- `"top {domain} companies hiring {role keywords} {market/region}"`
- `"{past employer} competitors {domain} {market/region}"`
- `"{domain} startups {market/region} careers site:jobs.ashbyhq.com OR site:jobs.lever.co OR site:job-boards.greenhouse.io"`
- `"best {domain} companies {year} {market/region}"`

### Phase 3: Resolve ATS portal URLs

Batch 3-5 companies per search for efficiency. Classify each by ATS type:

| URL pattern | Result |
|-------------|--------|
| `jobs.ashbyhq.com/{slug}` | Ashby — enabled: true |
| `jobs.lever.co/{slug}` | Lever — enabled: true |
| `job-boards.greenhouse.io/{slug}` | Greenhouse — enabled: true |
| `*.myworkdayjobs.com` | enabled: false, "Uses Workday — add jobs via inbox.txt" |
| `*.taleo.net` | enabled: false, "Uses Taleo — add jobs via inbox.txt" |
| `*.icims.com` | enabled: false, "Uses iCIMS — add jobs via inbox.txt" |
| Other / not found | enabled: false, "No scannable portal — add jobs via inbox.txt" |

### Phase 4: Present results

```
Can search automatically:
  #  Company          Why                                      Portal
  1  Wolfspeed        Uses same SiC stack as your ADI work     jobs.ashbyhq.com/wolfspeed

Requires manual browsing (paste URLs into data/inbox.txt):
  #  Company          Why                                      Job system
  8  Eaton            Power management peer                    Uses Workday
```

Flag direct competitors of past employers. Ask which to add. Proceed to Phase 5.

### Phase 5: Write to portals.yml

Append selected companies with a YAML comment explaining why. STOP after writing.

---

## Step 0e: Preference Setup (if `--setup` flag) — STOP after

Read `config/profile.yml` and `cv.md` for defaults. Walk through the setup conversation below.
Pre-populate each prompt with values from the profile so the user confirms rather than types from scratch.

```
👋 Advanced Scout Setup — takes about 2 minutes.
   Saves to config/scout-preferences.yml. Run again anytime to update.

Target roles:
  From your profile: {target_roles.primary from profile.yml, or empty if not set}
  [Enter] Use these   [e] Edit list   [blank if none found, ask user to type]
  →

Target markets:
  From your profile: {location.market from profile.yml}
  Add more cities/metros? (comma-separated, or press Enter)
  Examples: Boston MA, San Jose CA, Austin TX, Remote
  →

Remote preference:
  [1] Remote-first — prioritise fully remote roles
  [2] Hybrid OK    — remote + hybrid roles (default)
  [3] On-site only — no remote
  →

International:
  [1] Passive — only surface exceptional roles outside your markets (default)
  [2] Active  — include international markets in every scan
  →

Priority companies (optional — your dream employer list):
  The scout checks these career pages every scan and always surfaces their roles,
  even if the match is borderline. Add more anytime with 'scan --add-company "Name"'.
  Type company names, one per line. Leave blank to skip.
  →

Auto-reject rules:
  I'll silently filter these out (not shown, logged to data/scout-reject-log.md):
  [Enter] Use defaults   [e] Customise
  Defaults:
    ✗ Contract / C2C / freelance roles
    ✗ Roles requiring active security clearance
    ✗ Roles more than 1 level below your target seniority
    ✗ Companies with fewer than 20 employees (unless on your priority list)
  Note: "contract" means C2C/freelance, NOT term contracts with benefits.
  →

Scout strictness — how many results do you want to see?
  [1] Strict   — Only show me high-confidence matches (≥75). Less noise, fewer results.
  [2] Moderate — Show strong matches (≥70), flag borderline ones. (Default)
  [3] Explorer — Show everything above 50, including uncertain matches. Maximum coverage.
  Priority companies always surface regardless of this setting.
  →

Career pivot search (optional — skip if applying within your current field):
  If you're pivoting to a new field (e.g., hardware EE → firmware), I can run parallel
  searches targeting bridge roles.
  [Enter] Skip   [y] Enable
  →   (if y: ask for pivot_role and bridge_keywords)
```

After all fields collected:
1. Write to `config/scout-preferences.yml` (set `last_reviewed` to today)
2. If any companies were named in the priority list: run `--add-company` flow for each
3. Print:
   ```
   ✅ Scout preferences saved.

   Your strategy:
     🎯 Roles: {target_roles}
     📍 Markets: {active markets}
     🏢 Priority companies: {N companies} (career pages checked every scan)
     ⛔ Auto-reject: contract, clearance-required, below-level, <20 employees
     📊 Rigour: {level}

   💡 You can set this scan to run automatically on a schedule — check your CLI's
      scheduling or cron support and point it at the 'scan' command.
   ```
4. Ask: `Want me to run your first scout scan now? [y/n]`
   - `y` / `yes`: proceed immediately to Step 1 (skip confirm block — prefs were just set)
   - `n` / `no` / empty: print "Run 'scan' whenever you're ready." and STOP.
5. STOP (if user said no).

---

## Step 0f: Advanced Scout Confirm Block

Skip entirely if: `--setup`, `--discover`, `--rejected`, `--new-chapter`, `--import`, or any domain-expansion flag.

**If PREFS is empty or unpopulated:** Advanced scout is disabled. Instead of a terse one-liner, offer a brief warm invitation — this fires at most once per session:

```
👋 Looks like Advanced Scout isn't configured yet.

Here's what it adds on top of the portal scanner you already have:
  🏢 Priority companies — I check their career pages every scan and always surface their
     roles, even if the match is borderline. Add your dream employers once; I handle the rest.
  🔍 Web search discovery — I query LinkedIn, Indeed, Glassdoor, and niche boards for your
     target roles across your target markets. No job board account needed.
  ⛔ Smart filtering — contract/C2C roles, clearance-required postings, and ghost jobs are
     silently filtered out and logged so you can audit them anytime.

Takes about 2 minutes to set up. Run 'scan --setup' whenever you're ready.
```

Then proceed directly to Step 1.

**If PREFS is populated AND `auto_confirm: true` OR `--auto` flag:** Skip the confirm block, proceed directly to Step 1.

**If PREFS is populated AND `auto_confirm: false`:** Show the confirm block and wait for input:

```
📡 Scout check-in  ·  preferences last updated: {last_reviewed or "never"}  ·  last scan: {last_scan or "never"}

Current strategy:
  🎯 Roles:    {target_roles joined}
  📍 Markets:  {active markets joined} + {international mode}
  🏢 Priority: {company names, truncated to 5 + "(+N more)" if >5}
  ⛔ Filters:  {auto_reject summary}
  📊 Rigour:   {rigour level}

[Enter]     Run with these settings
+<city>     Add a market just for this scan  (e.g. +Denver CO)
+co:<name>  Add a company just for this scan (e.g. +co:Tesla)
[remote]    Toggle remote-only for this scan
[u]         Permanently update a setting
[full]      Run full preference setup (scan --setup)
[quiet]     Stop showing this check-in from now on
```

**Handle input:**
- `[Enter]`: proceed to Step 1
- `+<city>`: add to active markets for THIS run only (no file write), proceed
- `+co:<name>`: add to priority list for THIS run only, proceed
- `[remote]`: set remote_preference to remote-first for THIS run only, proceed
- `[u]`: ask which setting to update, apply change (write to scout-preferences.yml, set last_reviewed), proceed
- `[full]`: run Step 0e (preference setup), then proceed with updated prefs
- `[quiet]`: set `auto_confirm: true` in scout-preferences.yml, print "✅ Got it — I'll stop asking and just run.", proceed

**Drift detection:** After handling input, check drift:
- If `(today - last_reviewed) > alert_after_days` AND `last_alerted < last_reviewed` (i.e., not already alerted this stale period): show drift warning once and set `last_alerted = today`.

```
⏱  It's been {N} days since you last reviewed your scout preferences.
   Markets, target roles, or priority companies may have shifted.
   Run 'scan --setup' to refresh, or press Enter to continue with current settings.
```

---

## Step 1: Run Portal Scanner

Execute: `node scripts/scan.mjs [--fast] [--sources TYPE] [--company NAME] [--dry-run] [--import FILE]`

Skip if portals.yml is missing or has no tracked_companies.

- Capture stdout (JSON) and stderr (human summary — display to user)
- Exit code 1: show error, stop
- Exit code 2 (CSV column mapping failed): read CSV headers from stderr, use LLM to map columns, build normalized JSON offers array, continue to Step 1e with these as PORTAL_RESULTS
- Parse stdout JSON → store as PORTAL_RESULTS

---

## Step 1b: P0 — Priority Company Career Page Scraping

Skip if: `target-companies.yml` is missing, or `companies` list is empty, or `--fast` / `--import` / `--dry-run` flags.

For each company in TARGET_COS.companies:

1. **24h cache check:** If `last_scraped` is within the last 24 hours, skip this company (roles from last scrape are already in pipeline.md). Continue to next. Override with `--force`.

2. **Browser launch guard:** Attempt to start the Playwright browser. If the browser fails to launch (missing Chromium binary, group-policy block, Node version mismatch), print once:
   ```
   ⚠️  Direct scraping browser unavailable — skipping all career-page scans, continuing with web search.
   ```
   Skip all remaining P0 companies and proceed to Step 1c.

3. **Scrape the careers page:** Navigate to `company.careers_url`. Capture the full visible inner-text and all `<a href>` anchor links from the page. Do NOT attempt to parse by CSS class names — ATS DOM structures change and hardcoded selectors break silently. Pass the text + anchor list to LLM extraction.

4. **LLM extraction:** From the captured text and links, identify:
   - Job titles
   - Locations
   - Direct apply/job URLs
   Report only roles where the title fuzzy-matches one of `PREFS.target_roles` (at least one meaningful word in common, ignoring seniority and common qualifiers). For priority companies, ALSO note any open roles that do NOT match, with a "open role at priority company — low match" flag.

5. **Per-page anti-bot fallback:** If Playwright times out, CAPTCHA fires, or extraction yields zero results (empty page or JS-rendered with no content), fall back to a targeted web search:
   `"{company.name}" "{target_role}" site:{careers_domain} OR "{company.name}" jobs careers {year}`
   Parse snippet results for matching roles. Note in summary: `⚠️ {Company}: Playwright blocked → web search fallback`.

6. **Update `last_scraped`** to now in target-companies.yml (skip if `--dry-run`).

7. **Throttle:** Add a brief pause between companies. Never scrape more than one at a time.

Store all P0 results in P0_RESULTS with `source: "priority-co"` and `priority: true` flag.

---

## Step 1c: P1/P2 — Web Search Discovery + Niche Boards

Skip if: PREFS is unpopulated, or `--fast` / `--import` flags.

### Query construction

Build 3-5 search queries from PREFS:
- **Roles:** from `PREFS.target_roles`
- **Markets:** from `PREFS.markets.active` — combine cities with OR in a single consolidated query first. If the consolidated query yields fewer than 5 unique results, fall back to individual per-city queries.
- **Archetype keywords:** read `modes/_profile.md`, extract domain-specific terms from the candidate's archetype (e.g. for hardware EE: "GaN", "LLC", "buck-boost", "PCB"; for biotech: "IND", "CRISPR", "bioreactor")
- **Negative keywords:** from `PREFS.auto_reject.keywords` (appended as `-keyword`)

Example queries:
```
"Senior Power Electronics Engineer" (Boston OR "San Jose" OR Austin OR remote) -contract -clearance site:linkedin.com/jobs
"Hardware Design Engineer" GaN OR LLC OR buck-boost (Boston OR Austin OR remote) site:indeed.com
"Power Electronics Engineer" senior 2026 site:wellfound.com
```

Run queries. Parse results: title, company, location, URL, snippet text. Deduplicate across queries by normalized key (see Step 1d) before proceeding.

### P2 — Niche board targeting

Append 1-2 niche board queries based on archetype from `modes/_profile.md`:

| Archetype | Niche boards |
|-----------|-------------|
| Hardware / EE | EE Times Jobs, IEEE Job Site, SemiWiki Jobs, Embedded.com Jobs |
| Hardware / EE + clearance: true | + ClearanceJobs |
| Software / ML | HackerNews "Who's Hiring", Stack Overflow Jobs, RemoteOK |
| Biotech / Life Sciences | BioSpace, MassBio, FierceBiotech Jobs, Science Careers (AAAS) |
| Academic / Research | HigherEdJobs, Academic Positions, Nature Jobs |
| General / PM | Built In (city-specific), Product Hunt Jobs |

If PREFS.niche_boards is a list (not "auto"): use that list instead. If "none": skip P2.
If multiple archetypes: union of boards.

### Exploration/pivot mode

If `PREFS.exploration_mode.enabled: true`:
- Run an additional set of queries using `pivot_role` + `bridge_keywords` instead of archetype keywords
- Store pivot-query results separately, tag as `[pivot]`
- Apply `score_tolerance` during scoring (Step 1e) to lower the pipeline threshold for these results

Store all P1/P2 results in WEB_RESULTS with `source: "web-search"` or `source: "niche-board"`.

---

## Step 1d: Advanced Scout Auto-Filtering

Apply to P0_RESULTS + WEB_RESULTS. Portal API results (PORTAL_RESULTS) are already filtered by portals.yml and are NOT re-filtered here.

### Normalized dedup key

Generate a dedup key for each role: `[lowercase-company-slug]::[lowercase-title-slug]`
- Company slug: lowercase, replace spaces/punctuation with hyphens, strip common suffixes ("Inc", "Corp", "LLC", "Ltd", "GmbH")
- Title slug: lowercase, replace spaces/punctuation with hyphens

Example: Vicor Corporation + Senior Power Electronics Engineer → `vicor-corporation::senior-power-electronics-engineer`

**Dedup checks (in order — discard on any match):**
1. Key already in `data/scan-history.tsv` (any status)
2. Key already in `data/pipeline.md` Pending or Evaluated sections
3. Key found in `data/applications.md` or `data/archived.md` in terminal state (Applied, Rejected, Archived, Withdrawn)

If the same role appears from multiple sources (e.g., P0 + P1), keep the one from the highest-trust source: P0 > P2 > P1.

### Auto-reject rules

Apply silently. Log each rejected role to `data/scout-reject-log.md` with the reason. Rolling 200-entry cap — when adding a new entry, if the log has ≥200 data rows, delete the oldest before appending.

| Rule | Detection |
|------|-----------|
| Contract / C2C / freelance | Title or snippet contains "contract", "C2C", "corp-to-corp", "freelance", "1099" |
| Requires active clearance | Snippet contains "active TS/SCI", "active Secret clearance", "clearance required" |
| Below target level | Title has junior/associate/entry-level when target is senior/staff/principal (max_level_drop: 1) |
| Company too small | Headcount < min_company_size (estimated from web search or snippet) |
| Duplicate | Normalized key matches any of the dedup checks above |
| Expired posting | Posting date > max_posting_age_days (if extractable from snippet) |
| Excluded company | Company name in PREFS.auto_reject.excluded_companies |
| Also check: PREFS.auto_reject.keywords | Any keyword in title or snippet |

**Priority companies are NEVER auto-rejected by company-size or level rules.** They can still be deduped or rejected for expired/contract reasons.

Reject log format per row (append to data/scout-reject-log.md):
```
| {YYYY-MM-DD} | {Company} | {Title} | {Location} | {URL} | {Reason} |
```

---

## Step 1e: Quick-Pass Scoring + Pipeline Routing

Applied to the surviving (non-rejected) P0/P1/P2 results.

### Scoring (3 signals)

| Signal | Weight | Method |
|--------|--------|--------|
| **Role title match** | 40% | Fuzzy match: title vs PREFS.target_roles. Exact or near-exact = 1.0; adjacent role, same domain, different focus = 0.6; different function = 0.0 |
| **Keyword coverage** | 40% | Count archetype keywords from _profile.md appearing in snippet/JD. Score = matches / total archetype keywords (cap at 1.0) |
| **Location match** | 20% | City in PREFS.markets.active = 1.0; "Remote" role = 0.9; unknown/unlisted = 0.5; international (passive mode) = 0.2 |

`quick_score = round((title × 0.4 + keywords × 0.4 + location × 0.2) × 100)`

**Exploration/pivot results:** Score against bridge_keywords (not archetype keywords) for the keyword signal.

### Routing by score + rigour level

| Score | rigour: high | rigour: moderate (default) | rigour: explorer |
|-------|-------------|---------------------------|-----------------|
| ≥ 75 | Add to pipeline | Add to pipeline | Add to pipeline |
| 70-74 | Discard (log) | Add to pipeline | Add to pipeline |
| 50-69 | Discard (log) | Add, `[LOW-CONF]` tag | Add, `[LOW-CONF]` tag |
| < 50 | Discard (log) | Discard (log) | Discard (log) |
| Priority company (tier 1-2, any score) | Always add, `[PRIORITY]` tag | Always add | Always add |
| Tier 3 company (any score) | Add if ≥ 50, `[PRIORITY-CO]` tag | Add if ≥ 50 | Add if ≥ 50 |
| Pivot result | Apply score minus score_tolerance for threshold | Same | Same |

Discard means: log to scout-reject-log.md with reason "score:{N} below {rigour} threshold".

### Full JD enrichment (non-walled sources only)

For roles that pass the threshold with a score ≥ 65 AND whose URL is NOT from LinkedIn/Indeed (which require login), attempt a second fetch to capture the full job description. Store in the Notes column or a sidecar. LinkedIn/Indeed URLs stay snippet-only — the user reads the full JD via the link during `evaluate`.

Store qualified results in ADVANCED_RESULTS as pipeline-ready rows.

---

## Step 2: Drain Inbox (P3)

Skip if `--dry-run`.

Read `data/inbox.txt`:
- Lines starting with `#` → skip (comments)
- Empty lines → skip
- Lines with ` | ` → parse as `URL | Company | Role | Source`; missing fields default to empty
- Lines without ` | ` → URL only; fetch page to extract company + title

For each inbox entry:
a. Dedup: check URL against scan-history.tsv + pipeline.md + applications.md
b. Valid entries → add to INBOX_RESULTS with `source: "manual"` or specified source

Append drained entries to scan-history.tsv (status "added"). Do NOT reset inbox.txt yet.

---

## Step 3: Append to pipeline.md + Reset Inbox

Skip if `--dry-run` (show what WOULD be added).

Collect all sources into FINAL_RESULTS:
- PORTAL_RESULTS (portal API scanner — no score metadata)
- ADVANCED_RESULTS (P0/P1/P2 with scores — include score and tags in Notes)
- INBOX_RESULTS (P3 inbox drain — no score)

1. Read `data/pipeline.md`
2. For each entry in FINAL_RESULTS, append to the Pending table:
   ```
   | {url} | {company} | {title} | {source} | {YYYY-MM-DD} | {score_and_tags} |
   ```
   Score/tags in Notes column: e.g. `score:88 [PRIORITY]` or `score:54 [LOW-CONF]`
   Rows with no score (portal results, inbox): Notes column left blank or with existing content.

3. Pre-write confirmation:
   ```
   ⚠️ This will update data/pipeline.md (adding {N} new jobs).
      A backup has been saved to pipeline.md.bak. Proceed? [y/N]
   ```
   Bypass with `--yes` or `--auto`.

4. Write updated pipeline.md. **CRITICAL: Append only. Never remove or modify existing rows.**
5. AFTER writing: reset inbox.txt to comment-only header.

---

## Step 4: Update State + Print Summary

Skip state update if `--dry-run`.

Update `data/.scout-state.json`: `last_scan` = today; update consecutive_empty_scans.
Update `config/scout-preferences.yml`: `last_scan` = now (if PREFS is populated).

Print the summary. If advanced scout ran (ADVANCED_RESULTS has entries), use the 7B format:

```
📡 Scout complete — {date} {time}

   🆕 {N} new roles since your last scan ({elapsed} ago).{if priority: " {M} at a priority company."}

Sources checked:
  {✅ or ⚠️}  Priority companies ({scraped}/{total} career pages checked{if any fallback: ", {K} via web search fallback"})
  ✅  Web search — LinkedIn, Indeed, Glassdoor, Wellfound ({raw_web_count} results)
  ✅  Niche boards — {boards used} ({raw_niche_count} results)
  ✅  Portal scanner — {portal_count} API companies ({portal_new} new)
  ✅  Inbox drain — {inbox_count} new URLs

Funnel:
  {total_found} roles found → {auto_rejected} auto-rejected → {duplicates} duplicates → {scored} evaluated

Added to pipeline:
  {for each entry in ADVANCED_RESULTS, sorted by: priority-co first, then by score desc}
  🏢 [PRIORITY] {Company} — {Title} · {Location} (score: {N})
  ✅ {Company} — {Title} · {Location} (score: {N})
  ⚠️  [LOW-CONF] {Company} — {Title} · {Location} (score: {N} — "{reason}")
  {for portal/inbox entries, list without score}
  + {Company} | {Title} | {source}

🚫 Auto-rejected ({auto_rejected}): {breakdown by reason, e.g. "9 contract, 4 clearance-required, 3 below-level, 2 expired"}
   Tip: run 'scan --rejected' to audit the last 15 discards and catch any false negatives.
Duplicates skipped ({duplicates}): already in pipeline or scan history

Run 'pipeline' to triage the new entries.
Run 'evaluate <url>' on any role to get the full A-G report.
```

**No new roles variant:**
```
📡 Scout complete — {date}

   🆕 No new roles since your last scan ({elapsed} ago) — your pipeline is current.

{Sources checked block}
{Auto-reject tip if any were rejected this run}
```

**Portal-only summary** (advanced scout disabled): use the existing Phase 3 format:
```
Scan Complete — {date}
━━━━━━━━━━━━━━━━━━━━━
Companies searched:    {n}
Jobs found:            {n}
...
New in your pipeline:  {n}
```

**Conditional next-step:**

| Condition | Message |
|-----------|---------|
| 0 new jobs | "Your job queue is up to date." |
| 0 new jobs + consecutive_empty_scans ≥ 3 | See empty-scan guidance below. |
| 1-4 new | "Run 'pipeline' to review." |
| 5+ new | "Run 'pipeline' to review — you have a good batch." |

**Empty-scan guidance (consecutive_empty_scans ≥ 3):** Instead of a generic broadening tip, offer three concrete options:

```
No new roles in {n} consecutive scans — your current settings may be too narrow, or the market
is quiet right now. A few things that often help:

  1. Widen your geography    → scan --add-city "Austin TX"   (adds a new target market)
  2. Switch to explorer mode → scan --rigour explorer        (surfaces ≥50-score matches, max coverage)
  3. Add a priority company  → scan --add-company "Tesla"    (checks their career page every scan)

Or, if the market feels genuinely quiet, try again in a few days — scout will keep checking.
```

---

## Step 5: Weekly Stale Check

**Skip if:** `--fast`, `--dry-run`, `--import` flag. **Run if:** `last_clean` > 7 days ago OR `--clean` flag.

Read `stale_threshold_days` from portals.yml (default: 21).

For each row in pipeline.md Pending table older than stale_threshold_days:
- Fetch URL (WebFetch)
- Classify: 404/410 → Archive [HTTP {code}]; redirect to portal home → Archive [REDIRECT]; expiry phrases in body → Archive [EXPIRED TEXT]; no apply button → Flag [AGE: N days]; apply button found → leave

Archive: remove from pipeline.md Pending, append to data/archived.md, append status "archived" row to scan-history.tsv.

Print stale check summary. Update `last_clean` in .scout-state.json.

---

## Step 6: scan --rejected Handler

When `--rejected` flag detected: read `data/scout-reject-log.md`, show the last 15 data rows (newest first) in a compact table. STOP.

```
🔍 Last 15 auto-rejected roles — run again to dismiss or tweak your filters.

  Date       Company                   Title                                Reason
  ---------- ------------------------- ------------------------------------ ----------------------------
  2026-05-26 Vicor Corporation         Power Electronics Contractor Lead    contract
  2026-05-26 Raytheon                  Senior Systems Engineer              clearance required
  2026-05-25 Tiny Startup Inc          Hardware Engineer                    <20 employees
  ...

To stop rejecting a category: run 'scan --setup' and edit the auto-reject rules.
To add a role manually:       paste its URL into data/inbox.txt
```

---

## Error Handling

| Error | Action |
|-------|--------|
| portals.yml missing | Guide to copy example or run setup |
| portals.yml has no tracked_companies | Show which file to edit |
| scout-preferences.yml missing | Note that advanced scout is disabled; suggest 'scan --setup' |
| target-companies.yml missing | Skip P0 tier silently |
| Playwright browser fails to launch | Skip all P0, warn once, continue with P1/P2/P3 |
| Single company Playwright fails | Web search fallback for that company; note in summary |
| Web search returns 0 results for a query | Skip that query, note in summary |
| scout-reject-log.md missing | Create it with header before writing |
| scan.mjs not found | "scripts/scan.mjs not found. Verify installation." |
| Node.js unavailable | "Node.js 18+ required." |
| inbox URL fetch fails | Skip that entry, note in summary |
| pipeline.md Pending section missing | Create it with correct headers before appending |

---

## Pipeline Format Reference

```markdown
## Pending
| URL | Company | Role | Source | Found | Notes |
|-----|---------|------|--------|-------|-------|
| https://boards.greenhouse.io/acme/jobs/123 | Acme Corp | Senior Engineer | greenhouse-api | 2026-05-26 | |
| https://www.vicorpower.com/careers/456 | Vicor Corporation | Power Systems Engineer | priority-co | 2026-05-26 | score:88 [PRIORITY] |
| https://linkedin.com/jobs/view/789 | Bel Fuse | Hardware Design Engineer | web-search | 2026-05-26 | score:74 |

## Evaluated
| # | URL | Company | Role | Score | Fit | Status | Report | PDF | Notes |
|---|-----|---------|------|-------|-----|--------|--------|-----|-------|
```

Source values: `greenhouse-api`, `ashby-api`, `lever-api`, `priority-co`, `web-search`, `niche-board`, `manual`, `csv-import`

---

## LLM-Physics Reminders

- Do NOT score, rank, or evaluate job fit beyond the 3-signal quick-pass (Step 1e). Full A-G evaluation is pipeline-triage's job.
- Do NOT modify the Evaluated section of pipeline.md.
- Quick-pass scoring uses snippet/title only — do NOT fetch or read full JDs during scanning (except for the ≥65 enrichment fetch in Step 1e, which is a single targeted fetch).
- scan.mjs is a zero-token tool. Do not replicate its work with LLM calls.
- LLM text extraction (Step 1b) reads visible inner-text — do not attempt to parse CSS classes.
- Reject log is append-only, rolling 200-entry cap. Delete the oldest row when at limit.
- scan-history.tsv is append-only. Never modify existing rows.
- Malformed dates in scan-history.tsv or pipeline.md: skip the row, don't crash.
- Discovery first, housekeeping last. Steps 1-4 (scan + inbox + append + summary) run BEFORE Step 5 (stale check). User sees new jobs fast.
- Data contract: scout-preferences.yml and target-companies.yml are USER LAYER files. Do not reset or overwrite them except when the user explicitly runs --setup or a domain-expansion command.

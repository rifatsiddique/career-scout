# Plan: Phase 7B — Advanced Scout

**Version:** 1.1
**Last Updated:** 2026-05-26 -- Gemini Round 1 incorporated: rigour levels (§5.3), pivot/exploration mode (§9.1), OR-consolidated query strategy (§4.2), niche board additions (§4.3), reject log rolling cap (§5.2), full-JD enrichment (§6.3), anti-bot fallback explicit (Step 5), idle nudge (§11.11)
**Parent Plan:** CONSOLIDATION-PLAN.md §Phase 7, item 7b
**Depends on:** Phase 3 (scan mode baseline — web search, inbox drain, portal scanner, scan-history.tsv dedup)

---

## 1. Problem Statement

The current `scan` mode is **reactive and narrow**. It checks configured portal URLs and drains the inbox. The user must know where to look and manually feed it sources.

The target user is actively searching across multiple cities, has a handful of dream companies whose career pages don't reliably appear on aggregators, and wants the AI to do the discovery legwork — not just process a list they built themselves.

Three specific failure modes Phase 7B fixes:

1. **The missed direct posting.** A dream company posts a perfect role on their own careers page. It never hits LinkedIn or Indeed. The user doesn't notice for 3 weeks. Role is filled.
2. **The signal/noise problem.** LinkedIn surfaces 80 roles. 70 are obviously wrong. The user spends 30 minutes sorting through them instead of that time going to applications.
3. **The drift problem.** The user's search strategy made sense 6 weeks ago. Their situation has shifted (relocated, changed target level, new companies entered the picture). The AI keeps running the old strategy until the user remembers to update it.

---

## 2. Goals

| # | Goal | How we know it's done |
|---|------|-----------------------|
| G1 | Cover sources the user can't manually monitor | Scan runs web search across job boards + scrapes priority company career pages directly |
| G2 | Priority companies always surface | Any open role at a priority company is added to pipeline even if the match is borderline |
| G3 | AI makes the filtering decisions | Auto-reject criteria applied silently; user only sees curated results |
| G4 | Minimal intervention during discovery | After a brief upfront confirm (30 seconds), the scan runs unattended |
| G5 | Preferences persist and drift is caught | Scout preferences stored; AI flags when the strategy hasn't been reviewed in 2+ weeks |
| G6 | Works without LinkedIn API | Discovery uses web search (Google/Bing targeting LinkedIn/Indeed URLs), not direct scraping of walled-garden sites |

---

## 3. User Journey

### 3.1 First run (preference setup)

On the first scan after 7B is live, or when `scan --setup` is run:

```
👋 Let's set up your scout preferences. I'll ask a few questions — takes about 2 minutes.
   Answers are saved to config/scout-preferences.yml so future scans don't repeat this.

Target roles (from your profile):
  Suggested: "Senior Power Electronics Engineer", "Hardware Design Engineer"
  [Enter] Use these  [e] Edit

Target markets:
  Type cities/metros you're actively targeting, one per line.
  Example: Boston MA, San Jose CA, Austin TX, Remote
  → 

Remote preference:
  [1] Remote-first (remote + remote-friendly roles)
  [2] Hybrid OK
  [3] On-site only
  →

International:
  [1] Passive — only surface exceptional roles outside your target markets
  [2] Active — include international markets in every scan
  →

Priority companies (your dream employer list):
  Type company names, one per line. I'll find their career pages.
  These are checked every scan and always surface even if the role match is borderline.
  Leave blank to skip.
  →

Auto-reject — I'll silently filter these out without showing them to you:
  [Enter to accept defaults, or type 'edit' to customise]
  Default filters:
    ✗ Contract / C2C / freelance roles
    ✗ Roles requiring active security clearance
    ✗ Roles more than 1 level below your target (junior/mid when targeting senior)
    ✗ Very small companies (fewer than 20 employees) — unless on your priority list

Scout strictness — how many results do you want to see?
  [1] Strict   — Only show me high-confidence matches (≥ 75). Less noise, fewer results.
  [2] Moderate — Show strong matches (≥ 70) and flag borderline ones. (Default)
  [3] Explorer — Show everything above 50, including uncertain matches. Maximum coverage.
  (Priority companies always surface regardless of this setting.)
  →
```

All answers saved to `config/scout-preferences.yml`.

### 3.2 Every subsequent scan (Option C confirm + Option B execution)

```
📡 Scout check-in (preferences last reviewed: 3 days ago)

Current strategy:
  🎯 Roles: Senior Power Electronics Engineer, Hardware Design Engineer
  📍 Markets: Boston MA, San Jose CA, Austin TX + Remote
  🌍 International: passive
  🏢 Priority companies: Vicor, Analog Devices, TI, Murata, Bel Fuse (+3 more)
  ⛔ Auto-reject: contract, clearance-required, < Senior level, < 20 employees

[Enter] Run with these settings
[u]     Update a setting
[full]  Run full preference setup
```

If the user hits Enter: runs fully autonomously. AI makes all filtering and ranking decisions. User sees only the curated summary at the end.

### 3.3 Drift detection

After 3 consecutive scans with identical settings AND more than 14 days since the last manual update:

```
⏱  It's been 3 weeks since you last reviewed your scout preferences.
   Markets, target roles, or priority companies may have changed.

   Run 'scan --setup' to refresh, or [Enter] to continue with current settings.
```

This fires once per drift period — not on every scan.

---

## 4. Discovery Sources & Strategy

### 4.1 Source tiers

| Tier | Source | Method | Frequency |
|------|--------|--------|-----------|
| **P0: Priority companies** | Direct career pages of companies in `target-companies.yml` | Playwright scrape (direct URL) | Every scan |
| **P1: Web search — job boards** | LinkedIn Jobs, Indeed, Glassdoor, Wellfound/AngelList | Web search with targeted queries | Every scan |
| **P2: Niche boards** | Archetype-driven (see §4.3) | Web search targeting specific boards | Every scan |
| **P3: Inbox drain** | `data/inbox.txt` — user-dropped URLs | Existing mechanism | Every scan |

### 4.2 Web search query construction

The AI constructs search queries from the user's preferences. Example for hardware EE:

```
"Senior Power Electronics Engineer" (Boston OR "San Jose" OR Austin OR remote) -contract -clearance site:linkedin.com/jobs
"Hardware Design Engineer" GaN LLC converter (Boston OR Austin OR remote) site:indeed.com
"Power Electronics" engineer senior 2026 site:wellfound.com
```

Queries are constructed dynamically from:
- `scout-preferences.yml → target_roles`
- `scout-preferences.yml → markets`
- `scout-preferences.yml → auto_reject` (negative keywords appended)
- `_profile.md` archetype keywords (adds domain-specific terms like "GaN", "LLC", "buck-boost")

**Multi-city strategy:** Run a consolidated OR query first — `"Target Role" ("City A" OR "City B" OR Remote)` — rather than separate queries per city. If the consolidated result set has fewer than 5 results, fall back to individual per-city queries. This avoids 4× API calls for the common case while preserving coverage when OR queries underperform.

Run 3-5 queries per scan. Deduplicate results across queries before scoring.

### 4.3 Niche board selection (archetype-driven)

| Archetype | Niche boards added |
|-----------|-------------------|
| Hardware / EE | EE Times Jobs, IEEE Job Site, EEWeb, EDN Jobs, SemiWiki Jobs, Embedded.com Jobs |
| Hardware / EE (cleared, opt-in) | ClearanceJobs — only included if `scout-preferences.yml → clearance: true` |
| Software / ML | HackerNews "Who's Hiring", Stack Overflow Jobs, RemoteOK |
| Biotech / Life Sciences | BioSpace, MassBio, FierceBiotech Jobs, BioPharma Dive Jobs, Science Careers (AAAS) |
| Academic / Research | HigherEdJobs, Academic Positions, Nature Jobs |
| General / PM | Built In (city-specific), Product Hunt Jobs |

Archetype read from `modes/_profile.md`. If multiple archetypes, union of boards used.

### 4.4 Priority company career page scraping

For each company in `config/target-companies.yml`:
1. Read the career page URL (user-provided or AI-discovered during setup)
2. Playwright scrapes the careers page
3. Extract open roles (title, location, posting date) using DOM selectors or text extraction
4. Any role matching target_roles (fuzzy match) → add to results with `priority: true` flag
5. Roles at priority companies with ANY match → surface (even borderline); roles with NO match → surface with a note "open role at priority company — low match"

**LinkedIn/Indeed scraping caveat:** These sites actively block Playwright. P0 (direct career pages) uses Playwright. P1/P2 (aggregators) use web search — we search Google/Bing for the job posting, which returns the LinkedIn/Indeed URL without directly scraping the protected site.

---

## 5. Auto-Filtering (Silent Reject)

Applied after discovery, before dedup and fit scoring. No user prompt — results are logged to `data/scout-reject-log.md` for audit but not shown in the summary.

### 5.1 Default auto-reject rules

| Rule | Detection method |
|------|-----------------|
| Contract / C2C / freelance | Title or description contains "contract", "C2C", "corp-to-corp", "freelance", "1099" |
| Requires active clearance | Description contains "active TS/SCI", "active Secret clearance", "clearance required" |
| Below target level | Title contains junior/associate/entry-level when target is senior/staff/principal |
| Company too small | Headcount < 20 employees (estimated from web search if not known) |
| Duplicate | URL or (company + title) already in `data/scan-history.tsv` |
| Expired posting | Posting date > 60 days ago (if extractable) |

### 5.2 User-customisable rules

Additional rules stored in `config/scout-preferences.yml → auto_reject`. Examples:
```yaml
auto_reject:
  keywords: ["contract", "C2C", "clearance required", "entry level"]
  min_company_size: 20       # estimated headcount
  max_posting_age_days: 60
  excluded_companies: []     # companies the user has already rejected/burned bridges
```

**Reject log cap:** `data/scout-reject-log.md` is capped at the most recent **200 entries** (rolling). When the limit is hit, the oldest entries are removed. This keeps the file auditable without growing unboundedly over months of scanning.

### 5.3 Scout Rigour Levels

Configurable via `scout-preferences.yml → rigour`. Controls how aggressively the quick-pass filter cuts borderline roles.

| Level | Config value | General roles shown | Low-confidence (50-69) | Priority companies |
|-------|-------------|--------------------|-----------------------|-------------------|
| Strict | `high` | ≥ 75 only | Silently discarded | Always shown |
| Moderate | `moderate` (default) | ≥ 70 | Shown with `[low-confidence]` tag | Always shown |
| Explorer | `explorer` | ≥ 50 | Shown with `[low-confidence]` tag | Always shown |

Priority companies **always bypass the rigour threshold** — a tier-1 priority company with a borderline match is always shown, regardless of rigour setting. The rigour level only filters general (non-priority) roles.

---

## 6. Fit Scoring (Quick Pass)

NOT a full A-G evaluation — that runs later when the user explicitly evaluates a role. This is a lightweight triage: "is it worth adding to the pipeline?"

### 6.1 Quick-pass dimensions (3 signals, no subagent)

| Signal | Weight | Method |
|--------|--------|--------|
| **Role title match** | 40% | Fuzzy match between job title and `target_roles`. Exact = 1.0; adjacent = 0.6; different function = 0.0 |
| **Keyword coverage** | 40% | Count of archetype keywords from `_profile.md` appearing in job description. Score = matching / total archetype keywords (capped at 1.0) |
| **Location match** | 20% | City in `target_markets` = 1.0; remote = 0.9; unknown = 0.5; different country (passive) = 0.2 |

**Composite quick score = (title × 0.4) + (keywords × 0.4) + (location × 0.2) × 100**

### 6.2 Routing by quick score

Score thresholds are determined by `scout-preferences.yml → rigour` (see §5.3).

| Score | Moderate (default) | High rigour | Explorer |
|-------|--------------------|-------------|----------|
| ≥ 75 | Add to pipeline | Add to pipeline | Add to pipeline |
| 70-74 | Add to pipeline | Discard (logged) | Add to pipeline |
| 50-69 | Pipeline, `[low-confidence]` tag | Discard (logged) | Pipeline, `[low-confidence]` tag |
| < 50, non-priority | Discard (logged) | Discard (logged) | Discard (logged) |
| Priority company (any score) | Always add, `[priority-co]` tag | Always add | Always add |

### 6.3 Full JD enrichment (non-walled sources)

For roles that pass the quick-pass threshold with a score ≥ 65, the scout attempts a second fetch to capture the full job description — enabling richer A-G evaluation when the user later runs `evaluate`.

**Source constraints:**
- **P0 (priority company career pages):** Always enriched — Playwright already fetched the full page.
- **P1/P2 web search results pointing to non-walled pages** (company careers, Wellfound, Glassdoor with preview): Playwright enrichment attempted.
- **LinkedIn/Indeed URLs:** Not enriched. Both sites require authenticated sessions that Playwright can't replicate. The snippet captured during web search is stored as-is; the user reads the full JD via the URL during evaluation.

The enriched JD text is stored in the pipeline.md entry (or a sidecar file in `data/`) and passed to `evaluate` automatically when the user evaluates the role.

---

## 7. Output & Summary

After the scan completes, show a structured summary. Example:

```
📡 Scout complete — 2026-05-26 14:32

Sources checked:
  ✅ Priority companies (8/8 career pages scraped)
  ✅ Web search — LinkedIn, Indeed, Glassdoor (42 results)
  ✅ Niche boards — EE Times, IEEE Job Site (11 results)
  ✅ Inbox drain — 0 new URLs

Funnel:
  54 roles found → 18 auto-rejected → 11 duplicates → 25 evaluated

Added to pipeline:
  🏢 [PRIORITY] Vicor Corp — Senior Power Electronics Engineer · Andover, MA (score: 88)
  🏢 [PRIORITY] Analog Devices — RF Power Amplifier Design Engineer · Wilmington, MA (score: 61 — low match, priority co.)
  ✅ Bel Fuse — Power Systems Engineer · San Jose, CA (score: 79)
  ✅ Monolithic Power Systems — Senior IC Design Engineer · San Jose, CA (score: 74)
  ⚠️  [LOW-CONF] GaN Systems — Applications Engineer · Austin, TX (score: 54 — "Applications" vs. "Design")

Auto-rejected (18): 9 contract roles, 4 clearance-required, 3 below-level, 2 expired
Duplicates skipped (11): already in pipeline or scan history

Run 'pipeline' to triage the new entries.
Run 'evaluate <url>' on any role to get the full A-G report.
```

---

## 8. New Files

| File | Layer | Purpose |
|------|-------|---------|
| `config/scout-preferences.yml` | **User layer** | Persisted scout strategy — markets, target roles, auto-reject rules, international mode, last-reviewed date |
| `config/target-companies.yml` | **User layer** | Priority company list — name, tier, career page URL, last-scraped date |
| `data/scout-reject-log.md` | **User layer** | Audit log of auto-rejected roles (silent discards) — allows user to review what was filtered |
| `modes/scan.md` | System layer (update) | Add advanced scout flow — preference check (Step 0), query construction (Step 1), priority company scrape (Step 2), quick-pass scoring (Step 3), summary output (Step 4) |
| `config/port-manifest.yml` | System layer (update) | Add `config/scout-preferences.yml` and `config/target-companies.yml` to core group |

---

## 9. `config/scout-preferences.yml` Schema

```yaml
# career-scout advanced scout preferences
# Populated by 'scan --setup'. Edit directly or re-run setup to change.

version: 1
last_reviewed: ""              # ISO date — used for drift detection
last_scan: ""                  # ISO datetime of last scan run

target_roles:
  - ""                         # e.g. "Senior Power Electronics Engineer"

markets:
  active: []                   # e.g. ["Boston MA", "San Jose CA", "Austin TX", "Remote"]
  international: "passive"     # "passive" (exceptional only) or "active"

remote_preference: "remote-friendly"   # "remote-first" | "remote-friendly" | "onsite-only"

niche_boards: "auto"           # "auto" (archetype-driven) | list of board names | "none"
clearance: false               # set true to include ClearanceJobs in HW/EE niche boards

rigour: "moderate"             # "high" (≥75, strict) | "moderate" (≥70, default) | "explorer" (≥50, wide net)

auto_reject:
  keywords: ["contract", "C2C", "corp-to-corp", "freelance", "1099", "clearance required", "active TS", "active Secret"]
  min_company_size: 20
  max_posting_age_days: 60
  excluded_companies: []       # companies to always skip (burned bridges, bad culture, etc.)
  max_level_drop: 1            # reject if role is more than N levels below target

exploration_mode:              # Optional — for career pivoters targeting a new field
  enabled: false
  pivot_role: ""               # e.g. "Embedded Systems Engineer"
  bridge_keywords: []          # e.g. ["C++", "RTOS", "microcontroller", "SPI", "I2C"]
  score_tolerance: 15          # lower the pipeline threshold by this many points for pivot roles
  # When enabled: a parallel query runs using pivot_role + bridge_keywords.
  # Scoring for pivot results uses bridge_keywords instead of legacy archetype keywords.
  # score_tolerance prevents bridge roles from being silently rejected by the keyword signal.

drift_check:
  scan_count: 0                # increments each scan; resets when preferences updated
  alert_after_scans: 3         # trigger drift warning after this many scans without update
  alert_after_days: 14         # also trigger if > N days since last_reviewed
```

### 9.1 Exploration Mode — How It Works

When `exploration_mode.enabled: true`:

1. **Parallel pivot query:** The query constructor generates an additional search using `pivot_role` + `bridge_keywords` (instead of archetype keywords from `_profile.md`).
2. **Adjusted scoring:** Pivot-query results are scored against `bridge_keywords` for the keyword signal — not the candidate's legacy archetype keywords. This prevents a hardware EE's pivot to firmware roles from being knocked down by low C++/RTOS keyword coverage.
3. **Score tolerance:** The pipeline threshold is lowered by `score_tolerance` points for pivot results only. With `score_tolerance: 15` and `rigour: moderate` (threshold 70), pivot roles are added at ≥ 55 instead of ≥ 70.
4. **Labelling:** Pivot roles added to pipeline get a `[pivot]` tag in the summary so the user knows they came from the exploration query.

**Implementation note:** This is an optional enhancement — implement after core 7B (Steps 1-10) is working and tested. The schema is defined now so the preference setup can ask about it without a code change later.

---

## 10. `config/target-companies.yml` Schema

```yaml
# career-scout priority company list
# Add companies you'd seriously consider regardless of the specific role.
# The scout checks these career pages every scan.

companies:
  - name: "Vicor Corporation"
    tier: 1                    # 1 = dream (always surface), 2 = strong interest, 3 = open to
    careers_url: "https://www.vicorpower.com/careers"
    notes: "Prefer Andover MA office. Know 2 engineers there."
    added: "2026-05-26"
    last_scraped: ""

  - name: "Analog Devices"
    tier: 1
    careers_url: "https://www.analog.com/en/about-adi/careers.html"
    notes: ""
    added: "2026-05-26"
    last_scraped: ""
```

---

## 11. Implementation Steps

### Step 1: Add scout-preferences.yml + target-companies.yml templates

Create template files in `config/`. Both start empty/placeholder so setup mode populates them.

**Verify:** Files exist. port-manifest.yml picks them up. `scan` mode can read them without error when empty.

### Step 2: Build preference setup flow (`scan --setup`)

Write the interactive preference conversation to `modes/scan.md`. Reads existing `profile.yml` (target_roles, location) as suggested defaults. Writes to `scout-preferences.yml`.

**Verify:** Run `scan --setup` from scratch. All 5 preference fields populated. `scout-preferences.yml` written with correct schema. Re-running offers to update, not overwrite.

### Step 3: Add Step 0 confirm block to every scan

At the start of each `scan` run (when not in `--setup` mode): read `scout-preferences.yml`, print the 30-second confirm block (§3.2), wait for input, then proceed or branch to setup.

**Verify:** `scan` with empty preferences → routes to setup. `scan` with populated preferences → shows confirm block. User edits a setting mid-confirm → preference file updated, scan continues with new value.

### Step 4: Build query constructor

Function (in `modes/scan.md` as drafter instructions) that builds 3-5 web search queries from scout-preferences + archetype keywords from `_profile.md`.

**Verify:** For a hardware EE archetype with 3 target markets, the AI generates queries that include domain-specific terms (GaN, LLC, buck-boost or equivalent) and negative keywords from auto_reject. Queries are logged to terminal so user can see what was searched.

### Step 5: Priority company career page scraping

For each company in `target-companies.yml`: run Playwright to fetch the careers page, extract role listings (title + location + URL), fuzzy-match against target_roles. Update `last_scraped` date.

**Anti-bot fallback:** If Playwright fails (timeout, CAPTCHA, JS-heavy ATS that blocks headless), automatically fall back to a targeted web search: `"{Company Name}" "{target_role}" careers 2026`. Parse the snippet results for matching roles. Note the fallback in the summary (`⚠️ Vicor: Playwright blocked → web search fallback`).

**Verify:** Given a company with a known open role, the scraper finds it. Given a company with no open roles, it returns empty cleanly (no crash). Given a simulated Playwright failure, the fallback web search runs and its results appear in the summary with the fallback note.

### Step 6: Web search discovery + niche boards

Run constructed queries. Parse results (title, company, URL, location, posting snippet). Deduplicate across queries and against scan-history.tsv.

**Verify:** 3 searches produce a deduplicated list. Roles already in scan-history.tsv are excluded. Roles from different queries for the same posting are merged.

### Step 7: Auto-filtering

Apply auto-reject rules from `scout-preferences.yml`. Log discarded roles to `data/scout-reject-log.md` with the rejection reason.

**Verify:** A seeded contract role is rejected silently. A seeded clearance-required role is rejected. The reject log entry shows the URL, title, and reason. Non-matching roles pass through.

### Step 8: Quick-pass scoring + pipeline routing

Apply the 3-signal quick-pass score (§6.1) to each remaining role. Route to pipeline (≥70), low-confidence pipeline (50-69), or discard (<50). Priority company roles always go to pipeline regardless of score.

**Verify:** A high-match role (title exact, 80% keyword coverage, correct city) scores ≥70 and lands in pipeline. A priority company role with score 30 still lands in pipeline with `[priority-co]` tag. A non-priority role with score 40 is discarded to reject log.

### Step 9: Summary output + drift detection

Print the structured summary (§7). After writing to pipeline, update `scout-preferences.yml → scan_count` and `last_scan`. If drift threshold met, show the drift warning.

**Verify:** Summary shows correct counts. After 3 scans with unchanged settings and 14+ days elapsed, drift warning fires. After user updates any preference, `scan_count` resets to 0.

### Step 10: Update port-manifest.yml + CONSOLIDATION-PLAN.md

Add `config/scout-preferences.yml` and `config/target-companies.yml` to the core port group. Mark Phase 7B implemented in CONSOLIDATION-PLAN.md.

### Step 11: Idle nudge + post-setup automation hint

**11.1 Idle nudge:** At session start (when the user opens career-scout and runs any mode other than `scan`), silently check `scout-preferences.yml → last_scan`. If it is more than 4 days ago and scout-preferences.yml is populated, append a low-profile nudge at the end of the response:

```
💡 It's been X days since your last scout run. Type 'scan' to discover new openings.
```

This check runs at most once per session and only if scout is configured.

**11.2 Post-setup automation hint:** After `scan --setup` completes, suggest that the user set up a recurring scan via their CLI's scheduling feature. Keep the language CLI-agnostic — describe the concept without naming a specific command:

```
💡 Tip: You can automate this scan to run on a schedule (e.g., every weekday morning)
   so you never miss a fresh posting. Check your CLI's scheduling or cron support
   to set it up — just point it at the 'scan' command.
```

This is informational only — career-scout does not set up cron jobs itself.

---

## 12. What Is NOT Changing

- `data/pipeline.md` format — same schema, just new source for entries
- `data/scan-history.tsv` — same dedup mechanism
- Full A-G evaluation — not triggered by the scout. Scout adds to pipeline; user runs `evaluate` separately
- `data/inbox.txt` drain — kept as-is (P3 tier, runs at the end of every scan)
- Existing portal scanner (Phase 3) — still runs if `config/portals.yml` is present

---

## 13. Open Questions

All 6 original questions resolved in Round 1 (2026-05-26). See §14 for Gemini's answers and the resolution applied.

---

## 14. Gemini Review Log

| Date | Round | Summary |
|------|-------|---------|
| 2026-05-26 | Round 1 | 3 persona lenses (Busy/Efficiency, Pivot Seeker, Non-Technical). Q1-Q6 all answered. Incorporated: rigour levels (§5.3), pivot/exploration mode (§9.1, schema + how-it-works), OR-consolidated query strategy (§4.2), niche board additions (HW/EE: SemiWiki, Embedded.com, ClearanceJobs opt-in; Biotech: MassBio, FierceBiotech), reject log rolling 200-entry cap (§5.2), full-JD enrichment with login-wall caveat (§6.3), anti-bot fallback explicit in Step 5, idle nudge + post-setup automation hint (Step 11). |

**Q1 resolution:** Keep 3-signal scoring. "Systems Engineer" title ambiguity makes keyword coverage essential; latency of reading `_profile.md` is negligible (cached in session).

**Q2 resolution:** Enrich on score ≥ 65 for non-walled sources only. LinkedIn/Indeed URLs stay snippet-only — login wall prevents Playwright enrichment. Full JD available to user via URL during `evaluate`. See §6.3.

**Q3 resolution:** Anti-bot fallback made explicit in Step 5: Playwright failure → targeted web search with `"{Company}" "{role}" careers {year}`. Noted in summary with ⚠️ tag.

**Q4 resolution:** Added SemiWiki, Embedded.com, ClearanceJobs (opt-in via `clearance: true`) for HW/EE. Added MassBio, FierceBiotech for Biotech. See §4.3.

**Q5 resolution:** Rolling 200-entry cap on `scout-reject-log.md`. Oldest entries dropped when limit hit. See §5.2.

**Q6 resolution:** Consolidated OR query first; fall back to individual per-city queries if < 5 results. See §4.2.

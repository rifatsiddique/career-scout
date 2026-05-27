# Plan: Phase 7B — Advanced Scout

**Version:** 1.0
**Last Updated:** 2026-05-26 -- Initial draft, ready for Gemini review
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
    ✗ Companies with < 20 employees (unless priority list)
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

Run 3-5 queries per scan. Deduplicate results across queries before evaluation.

### 4.3 Niche board selection (archetype-driven)

| Archetype | Niche boards added |
|-----------|-------------------|
| Hardware / EE | EE Times Jobs, IEEE Job Site, EEWeb, EDN Jobs |
| Software / ML | HackerNews "Who's Hiring", Stack Overflow Jobs, RemoteOK |
| Biotech / Life Sciences | BioSpace, BioPharma Dive Jobs, Science Careers (AAAS) |
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

| Score | Action |
|-------|--------|
| ≥ 70 | Add to `data/pipeline.md` as `Pending` — shown in summary |
| 50-69 | Add to pipeline with `[low-confidence]` tag — shown in summary with flag |
| Priority company (any score) | Add to pipeline with `[priority-co]` tag — always shown |
| < 50 (non-priority) | Silently discard — logged to `data/scout-reject-log.md` |

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

auto_reject:
  keywords: ["contract", "C2C", "corp-to-corp", "freelance", "1099", "clearance required", "active TS", "active Secret"]
  min_company_size: 20
  max_posting_age_days: 60
  excluded_companies: []       # companies to always skip (burned bridges, bad culture, etc.)
  max_level_drop: 1            # reject if role is more than N levels below target

drift_check:
  scan_count: 0                # increments each scan; resets when preferences updated
  alert_after_scans: 3         # trigger drift warning after this many scans without update
  alert_after_days: 14         # also trigger if > N days since last_reviewed
```

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

**Verify:** Given a company with a known open role, the scraper finds it. Given a company with no open roles, it returns empty cleanly (no crash). Playwright timeout handled gracefully (note "could not scrape" in summary, continue).

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

---

## 12. What Is NOT Changing

- `data/pipeline.md` format — same schema, just new source for entries
- `data/scan-history.tsv` — same dedup mechanism
- Full A-G evaluation — not triggered by the scout. Scout adds to pipeline; user runs `evaluate` separately
- `data/inbox.txt` drain — kept as-is (P3 tier, runs at the end of every scan)
- Existing portal scanner (Phase 3) — still runs if `config/portals.yml` is present

---

## 13. Open Questions for Gemini Review

**Q1 — Quick-pass scoring vs. keyword match only:** Is the 3-signal quick score (§6.1) the right heuristic, or should we simplify to just title match + location match? The keyword coverage signal requires reading archetype keywords from `_profile.md`, which adds latency but improves signal. Is the added complexity worth it?

**Q2 — LinkedIn/Indeed web search approach:** Searching Google for `site:linkedin.com/jobs ...` returns job previews but not full JD text — only the snippet and title. Is the snippet enough for quick-pass scoring, or do we need a second Playwright pass to fetch the full JD? If so, how do we handle LinkedIn's login wall?

**Q3 — Playwright anti-bot for company career pages:** Some large companies (Google, Apple, Nvidia) use JS-heavy career pages or Workday/Greenhouse/Lever ATS embeds that Playwright may struggle to scrape. Should we have a fallback: if Playwright fails on a priority company page, run a web search targeting that company's career page domain instead?

**Q4 — Niche board list completeness:** The archetype-to-board mapping in §4.3 covers the main cases. Are there important boards missing for hardware EE specifically? (e.g., semiconductor-specific job boards, IEEE member job board, defense/aerospace job boards)

**Q5 — scout-reject-log.md size:** The reject log could grow large over time (dozens of rejects per scan × many scans). Should we cap it (keep last 500 entries), or is it fine to let it grow? The user may want to audit it occasionally to verify the AI isn't over-filtering.

**Q6 — Multi-city query strategy:** For a user with 4 target cities, do we run 1 query with all cities OR-ed together, or 4 separate queries per city? OR-ed queries are faster but may miss city-specific results that search engines don't surface well for OR queries.

---

## 14. Gemini Review Log

| Date | Round | Summary |
|------|-------|---------|
| (pending) | Round 1 | — |

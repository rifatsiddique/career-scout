# Plan: Plain-English UX — Make Prompts Human-Readable

## Context

The system uses technical file names, jargon, and system-centric language in user-facing
prompts. A job-seeker who doesn't know what "portals.yml", "ATS", or "zero-token scanning"
means will feel confused at exactly the moments the system is trying to help.

**Scope:** Only user-facing text — prompts, menus, output blocks, messages.
Internal agent instructions (logic, file operations) stay technical.
**Rule:** Plain English first → technical detail in parentheses after, if needed at all.

---

## Vocabulary Substitutions (apply everywhere they appear in user-facing text)

These are the 10 core translations. Apply consistently across all files:

| Technical | Human-readable |
|-----------|---------------|
| `portals.yml` (user-facing) | "your company watch list (portals.yml)" |
| `pipeline.md` (user-facing) | "your job queue (pipeline.md)" |
| `data/inbox.txt` (user-facing) | "your URL inbox (data/inbox.txt)" |
| `data/archived.md` (user-facing) | "your archive (data/archived.md)" |
| "ATS" or "ATS portal" | "job board system" |
| "Greenhouse / Ashby / Lever" first mention | "Greenhouse, Ashby, and Lever (job boards)" |
| "zero-token" / "zero-token scanning" | "automatically, without using AI credits" |
| "stale" links/check | "expired" links / "dead link check" |
| "archetype" in user prompts | "job type" |
| "comp target" / "compensation target" | "salary target" |
| "blocks A–G" | "7-step analysis" |
| "drain inbox" / "drained" | "process your URL inbox" / "picked up" |

---

## File 1: `SKILL.md` — Discovery Menu

This is the first thing the user sees when they ask for help. It must be instantly clear.

**Change: Command descriptions**

```diff
-  /career-scout [URL or JD text]   → EVALUATE: full A-G analysis + report + tracker
+  /career-scout [URL or JD text]   → Analyze this job — fit score, CV tips, interview prep

-  /career-scout pipeline           → Process pending URLs from data/pipeline.md
+  /career-scout pipeline           → Review jobs in your queue (data/pipeline.md)

-  /career-scout setup              → Guided profile creation / update archetypes / recalibrate
+  /career-scout setup              → Set up your profile / update job types and targets

-  /career-scout cv                 → Generate tailored PDF CV from latest evaluation
+  /career-scout cv                 → Generate a tailored PDF resume for the last job you analyzed

-  /career-scout cv --fast          → Draft HTML only, no reviewer or PDF (for manual editing)
+  /career-scout cv --fast          → Quick editable draft (no PDF — for manual tweaks)

-  /career-scout scan                  → Full discovery run (all configured companies)
+  /career-scout scan                  → Search all your companies for new jobs

-  /career-scout scan --fast           → Priority run (companies marked priority: true)
+  /career-scout scan --fast           → Quick check — your favorite companies only

-  /career-scout scan --sources TYPE   → Scan specific portal types (greenhouse, ashby, lever)
+  /career-scout scan --sources TYPE   → Search one job board type (greenhouse, ashby, lever)

-  /career-scout scan --dry-run        → Preview without writing files
+  /career-scout scan --dry-run        → Preview what a search would find (nothing is saved)

-  /career-scout scan --import FILE    → Import jobs from CSV file
+  /career-scout scan --import FILE    → Add jobs from a spreadsheet or CSV

-  /career-scout scan --company NAME   → Scan a single company only
+  /career-scout scan --company NAME   → Search just one company

-  /career-scout scan --clean          → Force stale check now
+  /career-scout scan --clean          → Check for dead job links right now

-  /career-scout scan --new-chapter    → Archive old data and start fresh search
+  /career-scout scan --new-chapter    → Archive old search history and start fresh

-  /career-scout scan --discover       → Find new companies based on your CV
+  /career-scout scan --discover       → Find companies to add to your watch list (based on your CV)

-  /career-scout scan --discover --focus X  → Focus discovery on a specific domain
+  /career-scout scan --discover --focus X  → Search for companies in a specific industry

-  /career-scout scan --help           → Show flag reference (includes recipes)
+  /career-scout scan --help           → Show all options with examples

-  Inbox: add URLs to data/pipeline.md → /career-scout pipeline
+  Add job URLs to data/inbox.txt → run /career-scout scan to pick them up → /career-scout pipeline to review
```

---

## File 2: `modes/scan.md` — User-Facing Prompts Only

Only the output blocks and quoted prompts change. Internal logic is left alone.

### 2a. --help output (lines ~32-68)

**Change: COMMANDS section descriptions**

```diff
-  scan / scout              Full discovery run (all enabled companies)
+  scan / scout              Search all your companies for new jobs

-  scan --fast               Priority run (companies marked priority: true)
+  scan --fast               Quick check — your favorite companies only

-  scan --sources TYPE       Only scan portals of type: greenhouse, ashby, lever
+  scan --sources TYPE       Search one job board type: greenhouse, ashby, or lever

-  scan --company NAME       Scan a single company only
+  scan --company NAME       Search just one company

-  scan --dry-run            Preview results without writing any files
+  scan --dry-run            Preview what a search would find (nothing is saved)

-  scan --import FILE        Import jobs from a CSV file
+  scan --import FILE        Add jobs from a spreadsheet or CSV

-  scan --clean              Run stale check now (don't wait for weekly trigger)
+  scan --clean              Check for dead/expired job links right now

-  scan --new-chapter        Archive current data and start fresh (shows impact first)
+  scan --new-chapter        Archive your old search history and start fresh

-  scan --discover           Find new companies based on your CV and add to portals.yml
+  scan --discover           Find companies that match your background (adds to your watch list)

-  scan --discover --focus X Focus discovery on a specific domain (e.g., "medical devices")
+  scan --discover --focus X Search for companies in a specific industry (e.g., "medical devices")
```

**Change: INBOX description**

```diff
-  INBOX
-    data/inbox.txt            Drop URLs here, one per line
-                              Optional metadata: URL | Company | Role | Source
-                              Drained on every scan run.
+  INBOX
+    data/inbox.txt            Paste job URLs here — one per line
+                              Optional: add company name, job title, source (separated by |)
+                              Picked up automatically on your next scan.
```

**Change: KEY FILES descriptions**

```diff
-    config/portals.yml        Companies to scan + title/location filters
+    config/portals.yml        Your company watch list + job title and location filters

-    data/pipeline.md          Pending jobs (Scout writes, Evaluator processes)
+    data/pipeline.md          Your job queue — new jobs land here after scanning

-    data/archived.md          Dead links removed from pipeline (recoverable)
+    data/archived.md          Expired or dead job links (you can restore them anytime)

-    data/.scout-state.json    Scan state (last run, dry spell counter)
+    data/.scout-state.json    Scan history (last run date, consecutive empty runs)
```

### 2b. Welcome Back notice (Step 0a)

```diff
-  "Note: You haven't run Scout in {N} days. If you're starting a
-   fresh search, run 'scan --new-chapter' to archive old data first."
+  "Note: You haven't run Scout in {N} days. Starting a new job search?
+   Run 'scan --new-chapter' to save your old search history and start clean."
```

### 2c. --new-chapter impact display (Step 0b)

```diff
-  This will archive:
-    data/pipeline.md       (N pending, M evaluated rows)
-    data/applications.md   (K entries)
-    data/scan-history.tsv  (J entries)
-    data/archived.md       (L entries)
-    data/follow-ups.md     (F entries)
-
-  Archive destination: data/archive/YYYY-MM-DD/
-    (If directory exists, append suffix: -2, -3, ...)
-
-  NOT archived: data/inbox.txt (pending items carry forward)
-  NOT touched:  reports/, output/, config/
+  This will save your old search history to a folder and start fresh.
+
+  What gets saved:
+    Your job queue        (data/pipeline.md — {N} waiting, {M} reviewed)
+    Your application log  (data/applications.md — {K} entries)
+    Your scan history     (data/scan-history.tsv — {J} entries)
+    Your archived links   (data/archived.md — {L} entries)
+    Your follow-up notes  (data/follow-ups.md — {F} entries)
+
+  Saved to: data/archive/{today's date}/
+
+  NOT archived: data/inbox.txt (your pending URLs carry forward to the new search)
+  NOT touched:  reports/, output/, config/
```

### 2d. --discover: profile signal display (Step 0d Phase 1)

```diff
-  "Based on your profile, I'll search for companies in:
-   1. {Domain A} — from your experience at {Employer 1}, {Employer 2}
-   2. {Domain B} — from your archetype '{Archetype Name}'
-   3. Market: {market}, {location}
-
-   Searching for companies with Greenhouse, Ashby, or Lever portals..."
+  "Based on your CV and profile, I'll search for companies in:
+   1. {Domain A} — from your experience at {Employer 1}, {Employer 2}
+   2. {Domain B} — from your target job type '{Archetype Name}'
+   3. Focusing on: {market}, {location preferences}
+
+   Searching for companies with job boards I can search automatically..."
```

### 2e. --discover: presentation table (Step 0d Phase 4)

```diff
-  Scannable (Greenhouse / Ashby / Lever — zero-token scanning):
+  Can search automatically (Greenhouse, Ashby, and Lever job boards):

-  Manual only (no scannable API — add jobs via data/inbox.txt):
+  Requires manual browsing (paste job URLs into data/inbox.txt):

-  "Add to portals.yml? Type 'all', specific numbers '1,3,5', or 'none'."
+  "Add these to your company watch list? (portals.yml)
+   Type 'all' to add everything, '1,3,5' for specific ones, or 'none' to skip."
```

### 2f. --discover: next-step messages (Step 0d Phase 5)

```diff
-  "Added {N} companies to config/portals.yml ({M} scannable, {K} manual-only).
-   Next: Run 'scan' to search these new companies for open roles."
+  "Added {N} companies to your watch list ({M} auto-searchable, {K} need manual browsing).
+   Next: Run 'scan' to search your new companies for open roles."

-  "No new companies found — your portals.yml already covers this space.
-   Try a different angle: scan --discover --focus '{different domain}'"
+  "No new companies found — your watch list already covers this area.
+   Try a different angle: scan --discover --focus '{different domain}'"

-  "Couldn't find matching companies. Try broadening:
-   scan --discover --focus '{broader domain or region}'"
+  "Couldn't find matching companies — try casting a wider net:
+   scan --discover --focus '{broader domain or region}'"

-  "No companies added. Run 'scan --discover' anytime to try again."
+  "Nothing added. You can run 'scan --discover' anytime to try again."
```

### 2g. --fast: no priority companies warning

```diff
-  Warning: No companies marked priority: true in config/portals.yml.
-  Mark dream companies with "priority: true" to use --fast mode.
+  No companies are marked as favorites yet.
+  Open config/portals.yml and add "priority: true" to your top companies,
+  then run 'scan --fast' for a quick daily check on just those.
```

### 2h. Stale check summary (Step 5)

```diff
-  Stale Check
-  ━━━━━━━━━━━
-  Checked:   {n} pending items older than {stale_threshold_days} days
-  Archived:  {n} dead links
+  Expired Link Check
+  ━━━━━━━━━━━━━━━━━━
+  Checked:   {n} jobs older than {stale_threshold_days} days
+  Removed:   {n} dead or expired links

-  Flagged:   {n} uncertain (check Notes column in pipeline.md)
+  Flagged:   {n} links to verify manually (see Notes column in your job queue)

-  Active:    {n} confirmed live
+  Still open: {n} confirmed active

-  Archived items are in data/archived.md.
-  To restore: move the row back to data/pipeline.md Pending table.
+  Removed links are saved in data/archived.md.
+  Changed your mind? Move the row back to your job queue (data/pipeline.md).
```

### 2i. Scout Complete summary (Step 4)

```diff
-  Scout Complete — {date} [{PRIORITY RUN | full run}]
+  Scan Complete — {date} [{Favorites only | All companies}]

-  Duplicates:            {n}
+  Already seen:          {n}
```

---

## File 3: `modes/setup.md` — Wizard Prompts

Only the quoted prompts and user-facing messages change.

### 3a. Step 9 portals invitation

```diff
-  "I can set up the job scanner with 50+ pre-configured companies (Greenhouse, Ashby, Lever portals).
-   Want me to customize the search keywords for your target roles and populate portals.yml?"
+  "I can add 50+ companies to your job search watch list — major companies on
+   Greenhouse, Ashby, and Lever job boards, customized to your target roles.
+   Want me to set that up? (saves to portals.yml)"

-  Confirm: "Scanner configured with {N} companies. Run 'scan' to discover jobs."
+  Confirm: "Done! {N} companies added to your watch list. Run 'scan' to search for open roles."

-  "Keep `title_filter` broad — the Evaluator does fine-grained scoring, not the Scanner.
-   A broad filter catches both 'AI Engineer' AND 'Technical PM' roles at the same companies.
-   You can always tighten filters later if you're getting too many irrelevant results."
+  "Tip: Keep job title keywords broad here — the job analysis step does the fine matching.
+   For example, a broad filter catches both 'AI Engineer' and 'Technical PM' at the same companies.
+   You can always narrow things down later if the results feel too scattered."
```

### 3b. Step 9 discovery invitation

```diff
-  "Your portals.yml has {N} companies. Want me to find more based on your background?
-   I'll search for competitors of your past employers, companies in your domain,
-   and industry players with scannable career portals."
+  "Your watch list has {N} companies. Want me to find more?
+   I'll search for competitors of your past employers and companies in your field
+   that have job boards I can search automatically."
```

### 3c. Step 10 completion summary

```diff
-  > "Setup complete! Here's what's configured:
-  > - **{N} archetypes** defined: {archetype names}
-  > - **Market:** {market value}
-  > - **Comp target:** {range}
-  > - **Scoring calibration:** {N} Golden Examples
-  > - **Portal scanner:** {N} companies configured ({M} from discovery / not configured}
+  > "Setup complete! Here's what's ready:
+  > - **Job types you're targeting:** {archetype names}
+  > - **Your market:** {market value}
+  > - **Salary target:** {range}
+  > - **Scoring calibrated** with {N} examples from your feedback
+  > - **Company watch list:** {N} companies to search ({M} found via discovery)
```

### 3d. Step 10 "what you can do now"

```diff
-  > You can now:
-  > - Paste a job URL or JD text to evaluate it
-  > - Type 'scan' to discover new jobs from {N} configured portals
-  > - Type 'scan --fast' to check only your priority (dream) companies
-  > - Type 'pipeline' to process your pending URL queue
-  > - Type 'setup' again to update your profile at any time
+  > You can now:
+  > - Paste a job URL or description to get a full analysis
+  > - Type 'scan' to search your {N} companies for open roles
+  > - Type 'scan --fast' to quickly check only your favorite companies
+  > - Type 'pipeline' to review jobs you've already found
+  > - Type 'setup' again anytime to update your profile
```

---

## File 4: `README.md` — Quick Start Section

### 4a. Job analysis step (Step 4)

```diff
-  You get blocks A–G, a saved report in `reports/`, and a tracker row in `data/applications.md`.
+  You get a full analysis (fit score, salary context, CV tips, interview prep), a saved report,
+  and a row added to your application tracker automatically.
```

### 4b. CV mode description

```diff
-  Or for a quick HTML draft you'll edit manually:
+  Or for a quick editable version before generating a PDF:
```

### 4c. Scout section flag descriptions

```diff
-  scan --sources greenhouse    # Only Greenhouse portals
+  scan --sources greenhouse    # Only search Greenhouse-based companies

-  scan --company Anthropic     # Single company
+  scan --company Anthropic     # Search just this one company

-  scan --import referrals.csv  # Import from CSV file
+  scan --import referrals.csv  # Add jobs from a spreadsheet

-  scan --dry-run               # Preview without writing files
+  scan --dry-run               # See what a search would find (nothing saved)

-  scan --clean                 # Force stale link check now
+  scan --clean                 # Check for expired/dead links right now

-  scan --new-chapter           # Archive old data and start a fresh search
+  scan --new-chapter           # Save your old history and start a fresh search

-  scan --discover              # Find new companies based on your CV
+  scan --discover              # Find companies that match your background

-  scan --discover --focus X    # Focus discovery on a specific domain
+  scan --discover --focus X    # Search for companies in a specific industry

-  scan --help                  # Show full flag reference (includes recipes)
+  scan --help                  # Show all options with examples
```

### 4d. Inbox description

```diff
-  Optional metadata via pipes:
+  Optional: add company name, title, and source (separated by |):
```

### 4e. Stale link section

```diff
-  **Stale link cleanup:** Scout automatically checks old pending jobs weekly and
-  archives dead links to `data/archived.md`. To restore a job: move the row back
-  to `data/pipeline.md`.
+  **Expired link cleanup:** Scout automatically checks old jobs weekly and
+  removes dead links to your archive (data/archived.md). Changed your mind?
+  Move the row back to your job queue (data/pipeline.md).
```

### 4f. Discovery callout

```diff
-  **Don't know which companies to track?** Run `scan --discover`
+  **Don't know which companies to search?** Run `scan --discover`
```

### 4g. Fit categories (Scoring section)

```diff
-  **Fit categories:** PERFECT_MATCH (90–100) → GOOD_FIT (80–89) → PARTIAL_MATCH (65–79) → HARD_MISMATCH (40–64) → POOR_FIT (0–39)
-  Soft overrides: TOO_JUNIOR / OVERQUALIFIED (score still shown, category overridden)
-  **Apply bar: 80/100**
+  **Match levels:**
+  Perfect match (90–100) · Good fit (80–89) · Partial match (65–79) · Poor fit (40–64) · Not a match (0–39)
+  Special cases: Too junior or Overqualified — score shown, with a note explaining why.
+  **Recommended minimum score to apply: 80/100**
```

### 4h. Troubleshooting table

```diff
-  | Archetype shows "Unclassified" | Run `setup` to define archetypes in `_profile.md` |
+  | Job type shows "Unclassified" | Run `setup` to define your target job types |

-  | Block G signal 4 says "no history" | Expected on fresh install — scan-history.tsv is empty |
+  | Legitimacy check says "no history" | Normal on first use — your scan history is still empty |
```

---

## What NOT to change

- Internal agent logic (file paths in instructions like "append to scan-history.tsv")
- YAML configuration examples (user expects to see file syntax there)
- Technical step numbers and internal step logic
- LLM-physics reminders (only read by the agent, not shown to user)
- Archetype/scoring system field names inside profile.yml/YAML blocks

---

## Files modified

| File | Lines changed (est.) |
|------|---------------------|
| `.agents/skills/career-scout/SKILL.md` | Discovery menu, ~15 lines |
| `modes/scan.md` | --help, prompts, summaries, ~30 lines |
| `modes/setup.md` | Steps 9-10 prompts, ~20 lines |
| `README.md` | Quick Start, flags, scoring, ~20 lines |

Total: ~85 line changes, 0 new files, 0 logic changes.

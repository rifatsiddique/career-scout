# Plan: `scan --discover` — Auto-discover companies from your profile

## Context

Users suffer from "brand blindness" — they only track the 5-10 companies they already know.
Their CV contains signal about their domain, peer companies, and the type of work they do.
`scan --discover` uses that signal to find companies the user wouldn't have thought of,
resolve their ATS career portal URLs, and add them to `config/portals.yml` for zero-token
scanning.

**This is agent intelligence, not engineering.** No new scripts, no new files. The agent
already has WebSearch, already reads cv.md/profile.yml, already writes YAML. The "code" is
~40 lines of agent instructions added to `modes/scan.md`.

---

## What the User Experiences

```
> scan --discover

Reading your profile...

Based on your CV and target roles, I'll search for companies in these areas:
  1. Power Electronics / SiC / GaN — from your experience at Analog Devices, Delta Electronics
  2. Mixed-Signal IC Design — from your archetype "Analog IC Design Engineer"
  3. Industrial Automation — from your archetype "Controls & Systems"
  4. Market: US, remote-friendly

Searching for companies with Greenhouse, Ashby, or Lever career portals...

Found 14 companies not yet in your portals.yml:

Scannable (Greenhouse / Ashby / Lever):

  #   Company              Why                                     Portal
  1   Wolfspeed            Uses same SiC stack as your ADI work    jobs.ashbyhq.com/wolfspeed
  2   Navitas Semi         GaN pioneer, peer group to Delta        jobs.lever.co/navitas
  3   Infineon             Direct competitor of Analog Devices      job-boards.greenhouse.io/infineon
  4   Schneider Electric   Energy management, DACH presence        job-boards.greenhouse.io/schneiderelectric
  ...

Manual only (add jobs via data/inbox.txt):

  #   Company              Why                                     ATS
  12  Eaton                Power management, peer to Delta          Uses Workday
  13  Texas Instruments    Analog/mixed-signal competitor           Uses Workday
  ...

  Infineon is a direct competitor of your past employer Analog Devices.
  Marking as priority: true for --fast daily scans.

Add to portals.yml? (all / 1,3,5 / none)

> all

Added 14 companies to config/portals.yml.
  11 with ATS APIs (scannable now), 1 marked priority
  3 disabled (no scannable API — use inbox.txt)

Run 'scan' to discover jobs at your new companies.
```

---

## UX Design Decisions

### U1: Zero setup required

The user types `scan --discover`. That's it. The agent figures out what to search for
by reading files that already exist (cv.md, profile.yml, _profile.md). No questions
before starting. No configuration needed.

### U2: Show reasoning before searching

Before the WebSearch calls, the agent shows what it derived from the user's profile:
domains, past employers, archetypes. This lets the user verify the agent understood
their background correctly. If the agent got it wrong, the user can correct inline
("also search for robotics companies") and the agent adjusts.

### U3: Batch presentation, fast selection

All results in one numbered table. User picks with "all", "1,3,5", or "none". No
per-company yes/no prompts. One interaction, not fourteen.

### U4: Graceful handling of non-ATS companies

Many companies use Workday, Taleo, or custom portals that don't have public APIs.
These are still valuable to know about. Add them to portals.yml with `enabled: false`
and a note explaining why — the user can still add jobs from these companies via
`data/inbox.txt` manually. Don't silently skip them.

### U5: Dedup against existing portals.yml

Before presenting results, check each discovered company against existing
`tracked_companies` in portals.yml (case-insensitive name match). Skip any
already-tracked companies. Tell the user: "Skipped 3 companies already in portals.yml."

### U6: Repeatable

Running `--discover` again is safe. The dedup catches previously added companies.
The user might add new experience to their CV and want to re-run discovery —
they should get new results, not duplicates.

---

## Implementation — What Changes

### 1. MODIFY: `modes/scan.md`

**Add to flag routing table:**
```
| `scan --discover` | Find new companies based on your CV and add to portals.yml |
| `scan --discover --focus TOPIC` | Discover companies in a specific area (overrides profile) |
```

**Add to --help output (with RECIPES section):**
```
  scan --discover           Find new companies based on your CV and add to portals.yml
  scan --discover --focus X Focus discovery on a specific domain (e.g., "medical devices")

RECIPES
  Discover based on my CV:        scan --discover
  Discover for a specific niche:  scan --discover --focus "Robotics startups in Munich"
  Daily habit (dream companies):  scan --fast
  Import from recruiter email:    Paste URLs in data/inbox.txt, then: scan
  Full sweep (all companies):     scan
  Start a fresh search:           scan --new-chapter
```

**Add new section — Step 0d: Discover Companies (if --discover flag):**

```
## Step 0d: Discover Companies (if --discover flag)

### Phase 1: Extract profile signals

**If `--focus TOPIC` is provided:** Use the topic as the primary domain. Skip CV-derived
domains but still use market/location from profile. Example: `scan --discover --focus "medical devices"`
overrides domains without the user editing their CV.

**Otherwise:** Read cv.md, config/profile.yml, and modes/_profile.md. Extract:

a. **Past employers** — company names from Work Experience section of cv.md
b. **Target role keywords** — from target_roles.primary in profile.yml
c. **Domain signals** — from archetype table in _profile.md (domain signals column)
d. **Market/location** — from profile.yml location.market AND location.country
   ALSO read location_filter from portals.yml (allow/block lists) to constrain geography
e. **Existing companies** — names AND careers_url domains from portals.yml tracked_companies (for dedup)

**Dedup set construction:** Build two sets from existing portals.yml:
- Normalized names: lowercase, strip trailing "Inc", "Corp", "Ltd", "GmbH", "AG", "SE", "S.A."
  Example: "Analog Devices, Inc." → "analog devices"
- URL domains: extract domain from careers_url
  Example: "https://jobs.ashbyhq.com/wolfspeed" → "jobs.ashbyhq.com/wolfspeed"
A discovered company is a duplicate if EITHER its normalized name OR its resolved URL
matches an existing entry.

Show the user what you derived:

  "Based on your profile, I'll search for companies in:
   1. {Domain A} — from your experience at {Employer 1, Employer 2}
   2. {Domain B} — from your archetype '{Archetype Name}'
   3. Market: {market}, {location preferences}
   [if --focus: "Focus: {TOPIC} (overriding profile domains)"]

   Searching for companies with Greenhouse, Ashby, or Lever career portals..."

### Phase 2: WebSearch for companies

Build 4-6 targeted WebSearch queries. Include market/geography in EVERY query to
avoid returning companies in irrelevant locations.

Query patterns:
  - "top {domain} companies hiring {target role keywords} {market/region}"
  - "{past employer} competitors {domain} {market/region}"
  - "companies with {archetype keywords} roles {market/region}"
  - "{domain} startups {market/region} site:jobs.ashbyhq.com OR site:jobs.lever.co OR site:job-boards.greenhouse.io"
  - "best {domain} companies to work for {year} {market/region}"

If `--focus TOPIC`: replace {domain} with the user-provided topic.

**Market-aware query language:** When the user's market is non-US, include local-language
queries to surface companies that don't appear on English-language "Top N" lists:
  - DACH: "Top {domain} Arbeitgeber {city}" or "{domain} Unternehmen {region} Karriere"
  - France: "{domain} entreprises qui recrutent {city}"
  - Remote: "remote-first companies hiring {role keywords}" or "async-first {domain} companies"
The agent picks the right language from profile.yml `location.market`. No rules needed —
the agent naturally adapts. These are examples, not an exhaustive list.

**Batching for efficiency:** Combine multiple company name searches where possible.
Prefer queries that return lists ("top 20 {domain} companies") over individual lookups.

From the search results, extract unique company names. Remove duplicates against
the dedup set (normalized name OR URL domain match). Target: 10-20 companies per run.

### Phase 3: Resolve ATS portal URLs

For each discovered company, find their career portal URL.

**Batch for efficiency:** Search 3-5 companies per WebSearch call where possible:
`"{Company A} OR {Company B} OR {Company C}" careers site:jobs.ashbyhq.com OR site:jobs.lever.co OR site:job-boards.greenhouse.io`

For each company:
  a. WebSearch: `"{company name}" careers greenhouse.io OR ashbyhq.com OR lever.co`
  b. If result contains `jobs.ashbyhq.com/{slug}` → Ashby (API auto-detected by scan.mjs)
  c. If result contains `jobs.lever.co/{slug}` → Lever (API auto-detected by scan.mjs)
  d. If result contains `job-boards.greenhouse.io/{slug}` or `job-boards.eu.greenhouse.io/{slug}` → Greenhouse
     Also construct api: field: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs`
  e. If no ATS URL found → WebSearch: `"{company name}" careers page`
     Identify the ATS from the URL pattern and set enabled: false with specific note:
       - `*.wd1.myworkdayjobs.com` or `*.wd5.myworkdayjobs.com` → "Uses Workday — add jobs via inbox.txt"
       - `*.taleo.net` → "Uses Taleo — add jobs via inbox.txt"
       - `*.icims.com` → "Uses iCIMS — add jobs via inbox.txt"
       - `apply.workable.com/*` → "Uses Workable — add jobs via inbox.txt"
       - Other/unknown → "No scannable portal found — add jobs via inbox.txt"

### Phase 4: Present results

Split results into two sections for clarity:

```
Scannable (Greenhouse / Ashby / Lever — zero-token scanning):

  #   Company              Why                                     Portal
  1   Wolfspeed            Uses same SiC stack as your ADI work    jobs.ashbyhq.com/wolfspeed
  2   Navitas Semi         GaN pioneer, peer group to Delta        jobs.lever.co/navitas
  3   Infineon             Direct competitor of Analog Devices     job-boards.greenhouse.io/infineon
  ...

Manual only (no scannable API — add jobs via data/inbox.txt):

  #   Company              Why                                     ATS
  8   Eaton                Power management, peer to Delta          Uses Workday
  9   Texas Instruments    Analog/mixed-signal, former competitor   Uses Workday
  ...

Skipped {N} companies already in portals.yml.
```

**"Why" column guidance:** Don't write generic labels like "Competitor." Reference the
specific connection to the user's profile:
  - "Uses same GaN/SiC stack as your work at ADI" (tech stack match)
  - "Their battery team has many ex-Delta engineers" (peer group)
  - "Direct competitor of Analog Devices" (market competitor)
  - "Berlin-based, matches your DACH market" (geography match)

Then ask:
  "Add to portals.yml? Type 'all', specific numbers '1,3,5', or 'none'."
  (Numbers work across both sections — the numbering is continuous.)

### Phase 5: Write to portals.yml

For each selected company, append to the tracked_companies section of portals.yml.
Include a YAML comment above each entry so the user remembers WHY it's there weeks later:

```yaml
  # Discovery: SiC power specialist — competitor to Analog Devices (2026-05-18)
  - name: Wolfspeed
    careers_url: https://jobs.ashbyhq.com/wolfspeed
    notes: "SiC power specialist, competitor to Analog Devices"
    enabled: true
```

Fields:
  - name: {Company Name}
  - careers_url: {ATS URL}
  - api: {Greenhouse API URL, if applicable}
  - notes: "{synergy reason from Phase 4 table}"
  - enabled: {true if ATS URL found, false otherwise}
  - priority: true (only if marked as priority — direct competitor of past employer)

**Priority suggestion:** If any discovered company is a direct competitor of a past employer
(determined during Phase 2 search), proactively suggest marking it as priority:

  "Infineon is a direct competitor of your past employer Analog Devices.
   Marking as priority: true for --fast daily scans. (Change anytime in portals.yml.)"

Don't auto-mark silently. State the reasoning, then mark it. User can always edit portals.yml.

**Contextual next-step report (user should never wonder "now what?"):**

If companies were added:
  "Added {N} companies to config/portals.yml ({M} scannable, {K} manual-only).
   Next: Run 'scan' to search these new companies for open roles."

If 0 companies found (all filtered by dedup):
  "No new companies found — your portals.yml already covers this space.
   Try a different angle: scan --discover --focus '{different domain}'"

If 0 companies found (WebSearch returned nothing):
  "Couldn't find companies matching your profile in this search.
   Try broadening: scan --discover --focus '{broader domain or region}'"

STOP after discovery (don't run the normal scan — user may want to review portals.yml).
```

### 2. MODIFY: `SKILL.md`

Add to the discovery menu:
```
/career-scout scan --discover              → Find new companies based on your CV
/career-scout scan --discover --focus X    → Focus discovery on a specific domain
```

### 3. MODIFY: `modes/setup.md`

**Step 9 update:** After the portals.yml configuration step, if portals.yml is still
empty or has very few companies (<5), make it an actionable invitation, not a tip:

```
"Your portals.yml has {N} companies. Want me to find more based on your CV?
 I can search for competitors of your past employers, companies in your domain,
 and industry players with scannable career portals.

 Run 'scan --discover' now? (yes/no)"

If yes: execute Step 0d (discover) inline within setup — don't make the user
type a separate command. They just said yes, so do it.

If no: "No problem. Run 'scan --discover' anytime to find companies later."
```

**Step 10 update:** Add discovery status to the ready confirmation:

```
> - **Portal scanner:** {N} companies configured ({M} from discovery)
```

**Key principle:** The user just finished a 10-step setup wizard. They're engaged
and ready. This is the BEST moment to offer discovery — don't defer it to a tip
they'll forget.

### 4. MODIFY: `README.md`

Add to the scout flags section:
```
scan --discover              Find new companies based on your CV and add to portals.yml
scan --discover --focus X    Focus discovery on a specific domain (e.g., "medical devices")
```

Add a "Discovery" callout in the Quick Start section, after "7. Discover new jobs":
```
**Don't know which companies to track?** Run `scan --discover` — the agent reads your CV,
finds competitors, peer companies, and niche players, resolves their career portals, and
adds them to your config. You approve each one before it's added.

Want to explore a different domain? `scan --discover --focus "robotics"` pivots your
search without changing your CV.
```

---

## What NOT to Build

- **No new scripts.** WebSearch + file read/write are agent capabilities.
- **No new files.** Writes to existing portals.yml.
- **No new modes.** It's a flag on the existing scan command.
- **No company database.** The agent uses live WebSearch — always current.
- **No automatic re-runs.** User triggers discovery manually when they want it.

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| portals.yml doesn't exist | Error: "Run setup first to create portals.yml" |
| portals.yml has no tracked_companies section | Create the section, then append |
| CV is empty/template | "Your CV doesn't have enough content for discovery. Add your work experience to cv.md first." |
| WebSearch finds no ATS URLs for any company | Still present the list. All entries get enabled: false. User adds jobs via inbox.txt. |
| User says "none" | "No companies added. Run 'scan --discover' anytime to try again." |
| Same company found via multiple search queries | Dedup by normalized name + URL domain |
| Company already in portals.yml | Skip (matched by normalized name OR careers_url domain). Report: "Skipped N already tracked" |
| "Apple" vs "Apple Inc." in portals.yml | Normalized name match: strip Inc/Corp/Ltd/GmbH/AG/SE/S.A., lowercase |
| All discovered companies use Workday/Taleo | Still present list, all disabled, with specific ATS identified. User uses inbox.txt |
| User in DACH market, search finds US-only companies | WebSearch queries include market/region in every query |
| `--focus "medical devices"` used | Overrides CV-derived domains, keeps market/location from profile |
| Direct competitor of past employer found | Suggest marking as priority: true with reasoning |
| Second run of --discover | Safe. Dedup catches previously added companies. New CV content may yield new results. |

---

## Testing

| Test | Expected |
|------|----------|
| `scan --discover` with populated CV | Shows domains derived from profile, presents companies, appends to portals.yml |
| `scan --discover` with empty CV | Error message directing user to fill in cv.md |
| `scan --discover` twice | Second run finds fewer/no new companies (dedup) |
| `scan --discover` then `scan` | New companies are scanned, jobs appear in pipeline |
| User selects "1,3,5" | Only those 3 appended to portals.yml |
| User selects "none" | No changes to portals.yml |
| Company without ATS portal | Added with enabled: false and explanatory note |

---

## Verification Checklist

- [ ] `scan --discover` appears in scan.md flag routing table
- [ ] `scan --discover` appears in scan.md --help output
- [ ] Step 0d is fully specified with all 5 phases
- [ ] SKILL.md discovery menu includes --discover
- [ ] setup.md Step 9 mentions --discover as a tip
- [ ] README.md scout flags section includes --discover
- [ ] Edge cases for empty CV, empty portals.yml, dedup all documented
- [ ] `--focus` flag documented in routing, help, SKILL.md, README.md

## Gemini Review Log

| Finding | Decision | Rationale |
|---------|----------|-----------|
| Name dedup bug: "Apple" vs "Apple Inc." | Adopt | Normalize names (strip suffixes, lowercase) + URL domain match |
| Geography gap: US results for DACH user | Adopt | Include market/region in every WebSearch query + use location_filter |
| Workday/Custom frustration: generic "no API" message | Adopt | Identify ATS from URL pattern, show specific system name |
| Token/time: individual WebSearch per company | Adopt | Batch 3-5 companies per query, prefer list-returning queries |
| `--focus` flag for pivoting without CV edit | Adopt | Simple, high value. Overrides profile domains, keeps market |
| Priority detection for competitors | Adopt | Suggest with reasoning, don't auto-mark silently |
| Stale portal re-check for disabled companies | Defer | Rare case. User notices when scan returns nothing. Not worth building |
| R2: Local language queries for non-US markets | Adopt | Added DACH/France/remote query examples in Phase 2 |
| R2: Discovery profiles by archetype | Reject | Agent handles this naturally from archetype signals. Rules are rigid and often wrong |
| R2: Fuzzy-domain dedup | Already done | Normalized name + URL domain matching added in R1 |
| R2: Better "Why" column with profile synergy | Adopt | Added guidance: reference specific tech stack, peer group, competitor connections |
| R2: Manual seed / string override | Already done | `--focus` flag covers this, added in R1 |
| R2: Split table: scannable vs manual | Adopt | Clearer presentation — two sections by ATS compatibility |
| R3: Setup handoff — active invitation not passive tip | Adopt | If portals.yml empty after setup, offer to run --discover inline |
| R3: RECIPES in --help output | Adopt | Shows intent-based workflows, not just flags |
| R3: Contextual next-step CTA after discovery | Adopt | Different messages for success / dedup-empty / search-empty |
| R3: YAML comments with reasoning in portals.yml | Adopt | User remembers why a company was added weeks later |
| R3: README discovery callout | Adopt | Prominent placement in Quick Start section |

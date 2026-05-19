# Mode: setup — Guided Profile Creation

Guides the user through configuring career-scout for the first time (or updating an existing profile). Populates `config/profile.yml` and `modes/_profile.md`.

**User layer safety:** This mode writes to User-layer files. Before overwriting any existing content, it backs up the file to `{filename}.bak`. The backup is never auto-deleted.

---

## When to Run Setup

- First-time use (profile.yml or _profile.md are empty templates)
- When the user wants to update their profile, archetypes, or scoring calibration
- When archetype detection is returning poor results

## Incremental Updates (Without Full Setup)

The user can request surgical changes at any time without re-running setup. Handle these directly:

- **"Update my comp target to X"** → edit `config/profile.yml → compensation`
- **"Add a new archetype: [name]"** → append a row to the archetype table in `modes/_profile.md`
- **"Change my market to UK"** → edit `config/profile.yml → location.market`
- **"Add this to my CV: [content]"** → append to the relevant section in `cv.md`
- **"Recalibrate my scores"** → run only Step 8 (Golden Examples) and update the `## Scoring Calibration` section in `_profile.md`

## Starting Over (Full Reset)

If the user wants to wipe their profile and start completely fresh:

1. Confirm they understand this removes their archetype table, behavioral profile, scoring calibration, and all profile.yml values (NOT their CV, reports, or story bank)
2. Delete `config/profile.yml` and `modes/_profile.md` (and any `.bak` files if they want a clean slate)
3. Run setup from Step 1 — the system detects missing files and rebuilds from `cv.md`

`cv.md`, `data/`, `reports/`, and `interview-prep/story-bank.md` are never touched by reset.

---

## Step 1: Check Prerequisites

Check if `cv.md` has content (more than just headers):

- **If cv.md is empty or missing:**
  > "I need your CV to set up the system. You can:
  > 1. Paste your CV text here and I'll format it
  > 2. Describe your experience and I'll draft a CV
  >
  > Which do you prefer?"
  
  Create or populate `cv.md` from what the user provides. Format as clean markdown with sections: Professional Summary, Work Experience, Projects, Education, Skills.

- **If cv.md has content:** Proceed.

---

## Step 2: Extract Profile Data from CV

Read `cv.md` and extract:
- Full name, email, phone (if present)
- Location (city, country)
- LinkedIn URL, portfolio/GitHub (if mentioned)
- Current/most recent role and seniority level
- Skills and experience domains
- Career trajectory (what they've been doing, what direction they're going)
- Notable achievements and metrics

Also read any files in `writing-samples/` if they exist.

---

## Step 3: Domain Pack Selection

Present the available domain packs and ask the user to select their primary domain:

> "What's your primary professional domain? I have starter archetype kits for some domains that will save setup time:"

Check `templates/domain-packs/` for available packs. Present them as options. Also offer "None of these — build from scratch."

**If user selects a Domain Pack:**
- Load the pack from `templates/domain-packs/{pack-name}.yml`
- Extract the archetype list as a starting template
- Display to the user: "Here are the archetypes from the {pack-name} starter kit. Let's customize them for you."

**If no pack matches or user chooses scratch:**
- Extract 3-5 archetype suggestions from the CV's domains and career trajectory
- Present them as starting points

---

## Step 4: Confirm Basic Profile Values

Present extracted profile.yml values for confirmation. Ask the user to correct or fill in any blanks:

> "Based on your CV, here's what I've extracted. Please correct anything that's wrong or fill in blanks:"

```
Name: {extracted or "?"}
Email: {extracted or "?"}
Location: {extracted or "?"}
Market: {inferred or "? — options: US-West, US-East, DACH, UK, Japan, other"}
Target roles: {extracted or "?"}
Target salary range: {extracted or "? (e.g. $150K-200K)"}
Currency: {inferred from location or "USD"}
Minimum salary: {extracted or "?"}
Remote preference: {extracted or "?"}
Visa status: {extracted or "?"}
LinkedIn URL: {extracted or "?"}
```

Write confirmed values to `config/profile.yml`.

---

## Step 5: Build the Archetype Table

Show the starter archetypes (from Domain Pack or CV extraction) and guide the user through refining them.

Use expert-intent framing — don't just ask for keywords:

> "For each archetype, I need to understand:
> 1. **What signals tell you this role was written for you?** Not just keywords — think about patterns, combinations, context. For example: 'the JD mentions cross-functional stakeholders AND technical depth — that's my sweet spot'
> 2. **What do they buy from you?** What's the specific value you deliver in this archetype?
> 3. **Which experiences in your CV are the strongest proof points?**"

Work through each archetype interactively. The goal is a table like:

```markdown
| Archetype | Domain signals | What they buy | Proof point sources |
|-----------|---------------|---------------|---------------------|
| {name} | {signals — phrases, patterns, context clues} | {value you deliver} | {cv.md section, article-digest.md} |
```

For each archetype: ask, confirm, refine. Don't rush this step — quality here drives every future evaluation.

---

## Step 6: Behavioral Profile (Optional)

> "Knowing your behavioral profile helps me evaluate culture fit and write more authentic materials. This is optional but valuable. Can you tell me:
> - How do you prefer to work? (e.g., deep solo work vs. high collaboration; fast-moving vs. deliberate)
> - What keywords in a JD signal a great fit for you? (e.g., 'ownership', 'autonomy', 'cross-functional')
> - What keywords signal potential friction? (e.g., 'matrix org', 'heavy process', 'lots of meetings')
> - Any absolute deal-breakers? (e.g., no on-site, no Java, no companies under 20 people)"

Store answers in `_profile.md` under `## Behavioral Profile`.

---

## Step 7: Writing Style (Optional)

**If `writing-samples/` contains files:** Read them and extract writing style markers per `_shared.md` guidelines. Cache in `_profile.md` under `## Writing Style`.

**If no samples exist:**
> "Adding a writing sample (past cover letter, LinkedIn About section, any professional writing) lets me match your voice. You can skip this and add samples later — just tell me when you do."

---

## Step 7b: CV Generation Rules (Optional)

Ask the user for standing CV preferences. These are stored as absolute constraints
that override default CV tailoring behavior.

> "Any standing rules for how your CVs should be generated? For example:
> - Always include: 'my patent count', 'publications section', 'specific award'
> - Never remove: 'publications', 'thesis section', 'certifications'
> - Language: 'minimize rewording — preserve my exact phrasing for achievements'
> - Format: 'max 5 bullets per role', 'summary under 3 lines', 'every bullet needs a metric'
> - Priority: 'lead with hardware experience regardless of role', 'cut Projects section first if tight'
>
> Skip this if you don't have preferences yet — you can add rules anytime by saying
> 'add to my CV rules: ...' "

If user provides rules: store them in `modes/_profile.md → ## CV Generation Rules` under the appropriate subsections.
If user skips: leave the template placeholders in place.

---

## Step 8: Scoring Calibration via Golden Examples

**CRITICAL — THIS IS A CONVERSATIONAL STATE MACHINE. Read carefully.**

This step requires 3 separate user interactions. You MUST pause and wait for
real user input after presenting each requirement. Do NOT hallucinate user
responses. Do NOT proceed to the next requirement or write anything to disk
until the user has responded to the current one.

### 8a. Introduce the calibration

Say to the user:
> "I'm going to show you 3 hypothetical JD requirements — one that's a perfect
> fit for you, one with a real gap, and one that's clearly not your area.
> For each, tell me how you'd score your match (0-100) and your reasoning.
> This calibrates my scoring to your judgment."

### 8b. Generate the 3 requirements from the user's CV

Internally draft 3 requirements (do not show them yet):
- **Example 1 (ceiling):** A near-perfect match — core skill they use daily, right level, domain they love.
- **Example 2 (gap):** Domain match but with a significant tool or stack gap they'd need to learn.
- **Example 3 (floor):** Clear mismatch — wrong domain or technology stack they've never touched.

### 8c. Present Example 1 — STOP AND WAIT

Present only Example 1:
> "Requirement 1 of 3: '{requirement}'"
> "How would you score your match (0-100)? What's your reasoning?"

**STOP. Do not continue. Wait for the user's score and reasoning.**
**Do not write anything to disk yet.**

Record their response as: `Score_1` and `Reasoning_1`.

### 8d. Present Example 2 — STOP AND WAIT

Present only Example 2:
> "Requirement 2 of 3: '{requirement}'"
> "Score (0-100) and reasoning?"

**STOP. Wait for the user's response.**

Record: `Score_2` and `Reasoning_2`.

### 8e. Present Example 3 — STOP AND WAIT

Present only Example 3:
> "Requirement 3 of 3: '{requirement}'"
> "Score (0-100) and reasoning?"

**STOP. Wait for the user's response.**

Record: `Score_3` and `Reasoning_3`.

### 8f. Confirm before writing

Show the user the 3 collected examples and ask:
> "Here's what I've recorded. Does this look right?
> [show examples with their scores and reasoning]
> Should I save these to your profile?"

**STOP. Wait for confirmation before writing to disk.**

Only write the Golden Examples to `_profile.md` after the user confirms.

Store under `## Scoring Calibration`:

```markdown
## Scoring Calibration

_Calibrated {date}. Re-run setup to recalibrate._

**Example 1 (ceiling):**
Requirement: "{requirement}"
User Score: {Score_1}
Reasoning: "{Reasoning_1}"

**Example 2 (gap):**
Requirement: "{requirement}"
User Score: {Score_2}
Reasoning: "{Reasoning_2}"

**Example 3 (floor):**
Requirement: "{requirement}"
User Score: {Score_3}
Reasoning: "{Reasoning_3}"
```

```markdown
## Scoring Calibration

_Calibrated {date}. Re-run setup to recalibrate._

**Example 1 (ceiling):**
Requirement: "{requirement}"
User Score: {N}
Reasoning: "{user's reasoning}"

**Example 2 (gap):**
Requirement: "{requirement}"
User Score: {N}
Reasoning: "{user's reasoning}"

**Example 3 (floor):**
Requirement: "{requirement}"
User Score: {N}
Reasoning: "{user's reasoning}"
```

---

## Step 9: Backup and Write

**Before writing any file that has existing non-template content:**

1. Check if `config/profile.yml` has content beyond template placeholders → if yes, copy to `config/profile.yml.bak`
2. Check if `modes/_profile.md` has content beyond template placeholders → if yes, copy to `modes/_profile.md.bak`
3. Inform the user: "Backed up existing files to .bak before writing new profile."

**Then write:**
- `config/profile.yml` — all confirmed values from Step 4
- `modes/_profile.md` — archetype table (Step 5) + behavioral profile (Step 6) + writing style (Step 7) + scoring calibration (Step 8)

---

## Step 9: Portal Scanner Configuration (Recommended)

Check if `config/portals.yml` still contains only the empty template (no `tracked_companies` entries).

If empty:

> "I can add 50+ companies to your job search watch list — major companies on
>  Greenhouse, Ashby, and Lever job boards, customized to your target roles.
>  Want me to set that up? (saves to portals.yml)"

If yes:
1. Copy `config/portals.example.yml` → `config/portals.yml` (overwriting the empty template)
2. Update `title_filter.positive` with keywords derived from `target_roles.primary` in profile.yml
   (e.g., "AI Engineer" → add "AI", "Engineer"; "Technical PM" → add "Product Manager", "Technical PM")
3. Update `location_filter` to match the user's location/remote preferences from profile.yml
4. Confirm: "Done! {N} companies added to your watch list. Run 'scan' to search for open roles."

If no: skip. User can copy the example file manually later.

> **Tip:** Keep job title keywords broad here — the job analysis step does the fine matching.
>  For example, a broad filter catches both "AI Engineer" and "Technical PM" at the same companies.
>  You can always narrow things down later if the results feel too scattered.

If portals.yml is already configured with 5+ companies: skip this step silently.

**After portals.yml is set up** (whether from example file or already had entries),
if total `tracked_companies` count is still low (fewer than 5 enabled companies),
make it an active invitation:

> "Your watch list has {N} companies. Want me to find more?
>  I'll search for competitors of your past employers and companies in your field
>  that have job boards I can search automatically. You'll approve each one before it's added."
>
> Find more companies now? (yes/no)

**If yes:** Execute Step 0d from `modes/scan.md` inline — the user just said yes,
don't make them type a separate command. They're engaged now.

**If no:** "No problem — run 'scan --discover' anytime to find companies later."

---

## Step 10: Confirm Ready

> "Setup complete! Here's what's ready:
> - **Job types you're targeting:** {archetype names}
> - **Your market:** {market value}
> - **Salary target:** {range}
> - **Scoring calibrated** with {N} examples from your feedback
> - **Company watch list:** {N} companies to search ({M} found via discovery)
> 
> You can now:
> - Paste a job URL or description to get a full analysis
> - Type 'scan' to search your {N} companies for open roles
> - Type 'scan --fast' to quickly check only your favorite companies
> - Type 'pipeline' to review jobs you've already found
> - Type 'setup' again anytime to update your profile
>
> Tip: Add writing samples to `writing-samples/` for better-matched cover letters and application answers."

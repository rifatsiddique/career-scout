# Mode: interview-prep — Company-Specific Interview Intelligence

Trigger: user types `interview-prep <company>`, `interview-prep <company> <role>`,
`prep for {company}`, or `interview prep {company} {role}`.

Sub-modes:
- `interview-prep <company> --tldr` → print Pre-Flight Cheatsheet to terminal, no file write
- `interview-prep --bank-review` → curate the story bank (dedup, strengthen weak stories, upgrade legacy schema)
- `interview-prep --debrief <company>` → post-interview capture: what was asked, what worked, lessons into bank
- `interview-prep --deep <company>` → shortcut that runs `modes/deep.md` for this company
- `--yes` / `--no-confirm` → skip P6 confirmation prompts (batch/headless mode only)

## NEVER Rules

- **NEVER invent interview questions and attribute them to sources.** Inferred questions must be labeled `[inferred from JD]`.
- **NEVER fabricate Glassdoor ratings, review counts, or statistics.** If data isn't there, write "unknown — not enough data."
- **NEVER use hedged language to wrap a guess.** "Multiple reports suggest..." with no citation is fabrication in disguise.
- **Cite everything.** Every question, stat, and claim gets a source or an `[inferred from JD]` label.

---

## Step 0: Data Gathering (all reads before any output)

### 0a. Parse arguments
Extract: company name, role title (optional), and flags (`--tldr`, `--bank-review`, `--debrief`, `--deep`, `--yes`).
If no company is provided, ask: "Which company and role are you prepping for?"

### 0b. Route sub-modes
- `--bank-review` → skip to **Sub-mode: --bank-review** section below
- `--debrief <company>` → skip to **Sub-mode: --debrief** section below
- `--deep <company>` → read `modes/deep.md` and run it for this company
- `--tldr` → proceed through all steps in-memory, then print cheatsheet block only (no file write)

### 0c. Dependency check
- Does `data/applications.md` exist? If not, interview date will be unavailable — note this.
- Does `interview-prep/story-bank.md` exist with any stories? If not, story mapping will have all "none" rows — still proceed.
- Does `reports/` have any files? If not, ask for JD text or URL to use in place of an evaluation report.

### 0d. Locate the evaluation report
- If user gave a report number → use `reports/{NNN}-*`.
- Else: scan `reports/` for slugs matching the company name. If multiple matches → ask which.
- If none → ask: "Paste the JD text or URL and I'll use that in place of an evaluation report."

### 0e. Read all inputs
Read these files before generating any output:
- `config/profile.yml` — candidate identity, comp targets, market
- `modes/_profile.md` — archetypes, behavioral profile, writing style
- `cv.md` — proof points, experience, skills
- `article-digest.md` — if the file exists, extended proof points
- The evaluation report from 0d (Block A archetype, Block B fit, Block E personalization, Block F existing stories)
- `interview-prep/story-bank.md` — all current stories (new and legacy schemas — see Story Bank Parser section)
- `data/applications.md` — look up interview date for this company+role if present

### 0f. Read compensation context
From the evaluation report: Block D comp & demand analysis, regional market data.
From `config/profile.yml`: `compensation.target_range`, `compensation.minimum`, `currency`.
Cache for Step 7b Compensation Calibration.

---

## Step 1: Research

If the host CLI supports subagent spawning (Claude Code: Agent tool; Gemini CLI: subagent invoke),
delegate this step to a fresh-context research subagent. The subagent receives: company name, role,
and JD text. It returns a clean structured fact list. This keeps the parent context clean of raw
Glassdoor/Blind/LeetCode markup.

**Fallback:** if subagent spawning is unavailable, run queries inline, cap at top-5 results per
query, and discard raw page bodies after extracting structured data.

**Queries:**
- `"{company} {role} interview questions site:glassdoor.com"`
- `"{company} interview process site:teamblind.com"`
- `"{company} {role} interview site:leetcode.com/discuss"`
- `"{company} engineering blog"`
- `"{company} interview process {role}"`

**Structured data to extract:**
```
rounds: [{type, duration, evaluators, reported_questions: [{q, source}]}]
difficulty: {avg, n_reviews, source}
positive_experience: {pct, n_reviews, source}
quirks: [{quirk, source}]
values_screened: [{value, source}]
vocabulary: [{term, source}]
anti_patterns: [{pattern, source}]
source_count: {glassdoor: N, blind: N, leetcode: N, other: N}
```

If total source count < 3: note "Intel is sparse for this company. Consider running
`deep {company}` for broader strategic context." Still proceed with whatever was found.

---

## Step 2: Process Overview

### 2a. Interview Vibe (3 sentences max, cited)
Synthesize the overall feel from Step 1 research. Each sentence cites at least one source.
Structure: (1) what interviewers actually evaluate / primary bar, (2) format tone (pair vs. whiteboard,
collaborative vs. grilling), (3) one standout quirk or recent pattern.

This is synthesis only — it does not replace the structured fields in 2b.

### 2b. Structured fields

```markdown
## Process Overview

### Vibe
{3-sentence cited synthesis}

- **Rounds:** {N} rounds, ~{X} days end-to-end [source] or "unknown — not enough data"
- **Format:** {recruiter screen → technical phone → onsite → HM} [source]
- **Difficulty:** {X}/5 ({N} reviews) [Glassdoor] or "unknown — not enough data"
- **Positive experience rate:** {X}% ({N} reviews) [source] or "unknown — not enough data"
- **Known quirks:** {e.g., "pair programming over whiteboard"} [source] or "unknown — not enough data"
- **Sources:** {N} Glassdoor, {N} Blind, {N} LeetCode, {N} other
```

---

## Step 3: Round-by-Round Breakdown

For each discovered round:

```markdown
### Round {N}: {Type}
- **Duration:** {X} min [source] or "unknown"
- **Conducted by:** {peer / manager / skip-level / recruiter} [source] or "unknown"
- **What they evaluate:** {specific skills/traits} [source / inferred from JD]
- **Reported questions:**
  - {question} — [source: Glassdoor 2026-Q1]
  - {question} — [inferred from JD]
- **How to prepare:** {1-2 concrete actions}
```

If round structure is unknown: state that, provide best-available intel on typical round types
for this company's size, stage, and role level — labeled `[inferred]`.

---

## Step 4: Likely Questions

### 4a. Technical
System design, coding, architecture, domain knowledge. For each: the question, source tag,
and what a strong answer looks like for this specific candidate (reference CV proof points).

### 4b. Behavioral
Leadership, conflict, collaboration, failure. For each: the question, source tag, and which
story from `story-bank.md` maps best.

### 4c. Role-Specific
Questions tied to the JD requirements — archetype-aware (use Block A's detected archetype
from the evaluation report). For each: the question, which JD requirement it probes, and the
candidate's best angle from their CV.

### 4d. Background Red Flags
Questions the interviewer will probably ask about gaps, transitions, or unusual elements.

Scan lens (use these as a checklist):
- "Why did you leave [company]?" — for any recent departure
- "You don't have [required skill/experience]." — for any JD-vs-CV gap from Block B
- "Where do you see yourself in 5 years?" — if role has unusual growth trajectory
- "What's your biggest weakness?" — always in scope
- "Why this company specifically?" — needs a specific, researched answer
- Any career gap > 6 months in `cv.md`
- Any career transition changing domain, level, or role type

For each identified red flag: the likely question, why it comes up, and a prepared response
(honest, specific, forward-looking — never defensive).

---

## Step 5: Story Bank Mapping

```markdown
## Story Bank Mapping

| # | Likely question / topic | Best story from bank | Fit | Gap? |
|---|------------------------|---------------------|-----|------|
| 1 | {question topic} | Story #{NN}: {title} | strong / partial / none | |
```

Fit definitions:
- **strong** — story directly answers the question with minimal reframing
- **partial** — story is adjacent; include a reframing note in the Gap? column
- **none** — no existing story covers this; flag as a gap

For each gap: "You need a story about {topic}. Consider: {specific experience from cv.md that
could become a STAR+R story}."

After the table, offer: "I found {N} story gaps. Want me to draft them now? [y/N]"
(Only prompt if gaps > 0. Apply P6 before appending to story-bank.md.)

---

## Step 5b: Pre-Flight Cheatsheet

Compose AFTER Steps 1-5 (draws from them). Insert at the top of the output file, below the
metadata header, above Process Overview.

In `--tldr` mode: print just this block to terminal and exit without writing the file.

```markdown
## ⚡ Pre-Flight Cheatsheet

**Big 3 Themes** (what they actually care about)
1. {Theme} — {one-sentence why, cited}
2. {Theme} — {one-sentence why, cited}
3. {Theme} — {one-sentence why, cited}

**Top 3 Go-To Stories** (have these on the tip of your tongue)
1. Story #{NN} — {title} — covers: {themes}
2. Story #{NN} — {title} — covers: {themes}
3. Story #{NN} — {title} — covers: {themes}

**Most Likely Red Flag**
- Q: "{the question they'll probably ask about a gap or transition}"
- A: {1-sentence prepared response — honest and forward-looking}

**Top 3 Questions to Ask Them**
1. {sharp question tied to recent news/blog or specific team detail} [source]
2. {sharp question tied to recent news/blog or specific team detail} [source]
3. {sharp question tied to recent news/blog or specific team detail} [source]

**Lessons from Last Time** ← CONDITIONAL: omit this block if no debrief history exists
- At {company} on {date}: faced "{question}" — {reflection summary}. Be ready.
```

Cheatsheet composition rules:
| Field | Drawn from |
|-------|-----------|
| Big 3 Themes | Step 4's most-frequent question clusters + Step 7's values screened — distilled to 3 |
| Top 3 Stories | Step 5 mapping: strongest-fit stories ranked by (a) fit=strong, (b) theme coverage breadth, (c) recency from story's Date Lived |
| Red Flag | Step 4d's highest-signal question + a freshly drafted 1-sentence response |
| Questions to Ask | Step 7's "Questions to ask them" — the 3 most specific to recent/concrete company intel |
| Lessons from Last Time | Search `interview-prep/*.md` for `## Debrief` sections from this company OR same-archetype roles at other companies. Extract up to 3 Q+reflection pairs. Tone: informational ("At Stripe last cycle, you faced X — be ready"), not alarmist. Omit block entirely if no debriefs found. |
| Compensation Line | §7b output (only if profile.yml comp fields are populated) |

Constraints:
- **Three of each.** Not "3-5." Fixed cardinality is mentally scannable.
- **One sentence per item.** Two sentences belongs deeper in the doc.
- **Every claim is grounded.** Themes cite Step 4/7, stories cite Story #NN, questions cite Step 7.
- On re-run for the same company: replace the `## ⚡ Pre-Flight Cheatsheet` block; preserve Steps 2-7.

`--tldr` footer: "For the full prep doc, run: interview-prep {company}"

---

## Step 6: Technical Prep Checklist

```markdown
## Technical Prep Checklist

- [ ] {topic} — why: "{cited evidence from research}"
- [ ] {topic} — why: "{evidence from company blog or JD}"
- [ ] {topic} — why: "{asked in N/M recent Glassdoor reviews}"
```

Prioritize by: frequency in research × relevance to this candidate's gap areas. Max 10 items.

---

## Step 7: Company Signals

```markdown
## Company Signals

**Values they screen for:**
- {value} [source: careers page / Glassdoor]

**Vocabulary to use** (terms the company uses internally):
- {term} — {context} [source: blog / careers page]

**Anti-patterns to avoid:**
- {pattern} [source: interview reviews]

**Questions to ask them**

*Role*
- {question referencing specific team context}

*Team*
- {question referencing org structure or process detail}

*Tech*
- {question referencing tech stack or recent technical decision}

*Culture*
- {question referencing a specific company value or Glassdoor theme}
```

Use the Role / Team / Tech / Culture grouping. Prioritize questions that reference the most
specific company intel from Step 1. Generic questions ("how's the culture here?") are worse
than asking nothing — they signal the candidate didn't do research.

---

## Step 7b: Compensation Calibration

Emit only if `profile.yml` has `compensation.target_range` populated.

```markdown
## 💰 Compensation Calibration

- **Your Target:** {currency}{target_range} (from profile.yml)
- **Your Walk-Away:** {currency}{minimum} (from profile.yml — DO NOT volunteer this)
- **Market Context:** {Block D summary or "market context unavailable"}
- **Recruiter Script:** "I'm targeting {lower}-{upper} {currency} depending on the overall
  package — base, equity, bonus, and benefits all factor in."
```

If target is significantly above Block D's market range: offer two variants —
anchored (state target first) vs. exploratory (ask for their range first). User picks per call.

Skip conditions:
- `compensation.target_range` empty → omit section; add hint to cheatsheet:
  "💰 Set compensation.target_range in profile.yml to enable comp guidance."
- Report has no Block D → use profile.yml only; note "market context unavailable — run evaluate
  with a JD to get Block D comp data."

**Never invent a market number.** If Block D says "unknown — not enough data," the Market Context
line says the same.

---

## Step 7c: Time-Bracketed Priority (CONDITIONAL)

Read `data/applications.md` for an interview date matching this company+role.

If found and date is in the future: compute days remaining. Emit a priority block drawn from
THIS prep doc's actual content (top tech checklist items, top story gaps, key company signals).

```markdown
## Priority for the Next {N} Days

**{N} days remaining**

{<= 2 days — focus:}
1. Rehearse Top 3 Go-To Stories out loud (not in your head)
2. {Top 1 tech checklist item by frequency × gap}
3. Read Company Signals — know their vocabulary cold

{3-5 days — also cover:}
1. {Top 3 tech checklist items}
2. Draft {N} story gaps from Story Bank Mapping
3. Run `deep {company}` if intel was sparse in Step 1

{6+ days — full prep:}
1. All tech checklist items
2. All story gaps drafted and rehearsed
3. One out-loud run of each Go-To Story
4. Research the interviewers on LinkedIn if names are known
```

If no interview date is found, or date is in the past: **skip this section entirely.**
Do NOT emit a generic study timeline.

---

## Step 8: Output

### Pre-write citation lint sweep

Before writing the file, scan every line that:
- Lives under Step 3 "Reported questions:"
- Lives under Step 4 (any bucket) AND ends in `?`

For each such line, check that one of these citation markers appears on the same line or the
line immediately following: `[source: ...]`, `[Glassdoor]`, `[Blind]`, `[LeetCode]`,
`[inferred from JD]`, `[careers page]`, `[eng blog]`, or any `[bracketed citation]`.

Accumulate failures. If non-empty, print before writing (do NOT block):
```
⚠️ Citation lint: {N} entries lack a source tag. Review:
  Step 4a: "How would you scale this from 100 to 100M users?"  ← no citation
  Step 4b: "Tell me about a time you failed."                   ← no citation
The file was still written. Edit these lines to add [source: ...] or [inferred from JD].
```

### Write the prep doc

Write `interview-prep/{company-slug}-{role-slug}.md`.

Header:
```markdown
# Interview Intel: {Company} — {Role}

| | |
|---|---|
| **Company / Role** | {company} — {role} |
| **Evaluation Report** | file:///{PROJECT_ROOT}/reports/{NNN}-{company}-{date}.md |
| **Researched** | {YYYY-MM-DD} |
| **Source Count** | {N} Glassdoor, {N} Blind, {N} LeetCode, {N} other |
```

File section order:
1. Metadata header
2. `## ⚡ Pre-Flight Cheatsheet`
3. `## Process Overview` (Steps 2a+2b)
4. `## Round-by-Round Breakdown` (Step 3)
5. `## Likely Questions` (Step 4 — 4a/4b/4c/4d subsections)
6. `## Story Bank Mapping` (Step 5)
7. `## Technical Prep Checklist` (Step 6)
8. `## Company Signals` (Step 7)
9. `## 💰 Compensation Calibration` (Step 7b — if applicable)
10. `## Priority for the Next N Days` (Step 7c — if interview date known)

### Generate HTML viewer

After writing the .md file, run:
```
node scripts/md-to-html.mjs interview-prep/{company-slug}-{role-slug}.md
```
This produces `interview-prep/{company-slug}-{role-slug}.html` with styled tables, interactive checkboxes, and localStorage persistence.

### Terminal output (UX Conventions P1+P2)

Relay the `📂 Open:` line from the md-to-html.mjs stdout (P1 pattern):

```
{relay "📂 Open: file:///..." line from md-to-html.mjs stdout}
{relay "   Path: ..." line from md-to-html.mjs stdout}

What to do next:
  1. Open the HTML prep doc above — interactive checklist with persistent state
  2. Need deeper company research? → deep {company}
  3. After the interview, run → interview-prep --debrief {company}
```

If the HTML was not generated, show the .md path instead:
```
📂 Prep doc: interview-prep/{company-slug}-{role-slug}.md
```

Follow-up prompts (print after the above, when applicable):
- If story gaps > 0: "I found {N} story gaps. Want me to draft them now? [y/N]"
- If source count < 3: "Intel was thin ({N} sources total). Want to run deep mode for
  broader strategic context? [y/N]"

---

## Story Bank Parser

Accept both schemas when reading `interview-prep/story-bank.md`.

**New schema (Phase 4+):**
```markdown
### Story {NN}: {Title}
| | |
|---|---|
| **Themes** | ... |
| **Source** | ... |
| **Date Lived** | ... |
| **Status** | active |
| **Best for** | ... |

- **Situation:** ...
```

**Legacy schema (career-ops format):**
```markdown
### [Theme] Story Title
**Source:** Report #NNN — ...
**S (Situation):** ...
**T (Task):** ...
**A (Action):** ...
**R (Result):** ...
**Reflection:** ...
**Best for questions about:** ...
```

Detection rule: `### ` heading followed within 6 lines by a `|` table row → new schema.
Followed instead by `**Source:**` and bold `**S (Situation):**` body keys → legacy schema.

Both normalize to the same in-memory structure for Story Bank Mapping. The user is unaware of
mixed formats until `--bank-review` offers per-entry upgrade.

---

## Sub-mode: --bank-review

A structured curation pass over `interview-prep/story-bank.md`. Interactive — every change
requires P6 confirmation.

### Step 1: Load and index
Parse every story block using the Story Bank Parser above. Build an in-memory index of all stories.

### Step 2: Dedup detection (Jaccard heuristic)
For every pair of active stories (i, j):
1. Extract Situation + Task text from each
2. Tokenize: lowercase, strip punctuation, split whitespace, remove stopwords (the, a, an, in,
   on, at, to, for, of, and, or, but, with, that, this, was, were, had, has, have, been, be,
   is, are, it, I, my, we, our, their, his, her, its)
3. Compute Jaccard = |tokens_i ∩ tokens_j| / |tokens_i ∪ tokens_j|
4. If Jaccard >= 0.55: surface with side-by-side snippets:

```
Story #04 and Story #11 look ~62% similar.
  #04: "Migrated 40M-row Postgres table to a sharded layout..."
  #11: "Led shard migration of legacy user table at Acme..."
  (m) Merge into one   (k) Keep both   (s) Mark one superseded   (skip)
```

(0.55 threshold is tunable based on user feedback.)

### Step 3: Flag weak Reflections
Heuristic: Reflection field < 80 characters OR matches generic patterns:
"learned to communicate", "improved my skills", "got better at", "stronger team player",
"more confident".

For each: show it, ask user to sharpen it or mark `status: draft` until they have time.

### Step 4: Flag missing quantified Results
Heuristic: Result field has no number (`\d+`), percentage, scale word (thousand, million,
billion, k, M, B), or duration unit (hour, day, week, month, year).

For each: show the Result field and prompt for a metric. If the user can't recall one, offer
to mark `status: draft`.

### Step 5: Legacy → new schema upgrade prompts
For every story parsed as legacy schema, offer per-story upgrade (one at a time):
```
Story #07 is in the legacy format. Convert to new schema?

Before:  **S (Situation):** Led migration of core billing service...
         **Best for questions about:** scaling, cross-team coordination

After:   | **Themes** | scaling, cross-team |
         | **Status** | active |
         | **Best for** | "tell me about scaling something" |
         - **Situation:** Led migration...

(y) Convert   (n) Keep legacy   (skip-all)
```

### Step 6: Confirm and write (P6)
For every edit — merge, mark superseded, Reflection update, schema upgrade:
```
⚠️ This will update story-bank.md ({what's changing in 1 line}).
   A backup has been saved to story-bank.md.bak.
   Proceed? [y/N]
```
Default N — user must type y or yes.
After all edits: append `<!-- Last curated: {YYYY-MM-DD} -->` to the file.

---

## Sub-mode: --debrief

### Step 1: Locate the prep doc
Find `interview-prep/{company-slug}-{role-slug}.md`.
If missing: ask for company + role inline, create a minimal file with just the debrief section.

### Step 2: Walk the user through capture
Ask:
- "Which questions were actually asked?" (compare against Step 4 predictions)
- "Which stories from Step 5's mapping did you use?"
- "What surprised you? What worked? What fell flat?"
- "How did the compensation conversation go, if there was one?" (if §7b was in the prep doc)

### Step 3: Append debrief section
```markdown
## Debrief — {YYYY-MM-DD}

**Questions that came up:**
- {actual question} [predicted / new — not predicted]

**Stories used:**
- Story #{NN} — {title} — {worked well / needs reframing / fell flat}

**Surprises:**
- {anything unexpected}

**What worked:**
- {specific observations}

**What to improve:**
- {specific things for next time}
```

Apply P6 before writing:
```
⚠️ This will update interview-prep/{file} (appending Debrief section).
   A backup has been saved to {file}.bak.
   Proceed? [y/N]
```

### Step 4: Offer story Reflection updates
For each story used, ask: "Story #{NN} — {title}: want me to add a note to its Reflection?"
Example addition: "Strong for system-design rounds — verified {company} {YYYY-MM-DD}."
Apply P6 per story update.

### Step 5: Capture new stories
"Did any questions come up with no matching story? Want to draft them now?"
If yes: draft in STAR+R new schema format. Apply P6 before appending to story-bank.md.

---

## UX Conventions (P1–P6)

**P1 — Artifact Paths Are Clickable**
Print absolute paths with `file://` prefix for every file the user needs to open.

**P2 — Every Mode Ends with Next Steps**
Three or fewer numbered items. Runnable commands only — no prose explanations.

**P3 — Cross-Mode Nudges**
This mode receives nudges from pipeline-triage (Interview-status rows without a prep doc).
This mode nudges evaluate: after generating a prep doc for a first-time company, no nudge
needed here — the P2 block already covers next steps.

**P4 — `--tldr` Variant**
Runs Steps 0-7 in-memory. Prints Pre-Flight Cheatsheet block. Footer: "For the full prep doc,
run: interview-prep {company}". Exits without writing any file.

**P5 — Compact Path Display**
When reporting multiple files in one terminal block, use definition-list style:
```
Generated:
  Prep doc    file:///.../interview-prep/{slug}.md
```

**P6 — User Layer Write Confirmation**
Before writing to any User Layer file (`story-bank.md`, `applications.md`, etc.):
```
⚠️ This will update {file} ({what's changing}).
   A backup has been saved to {file}.bak.
   Proceed? [y/N]
```
Default N. Recognize `--yes` / `--no-confirm` flags to bypass (batch mode only).

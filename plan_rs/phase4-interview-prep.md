# Plan: Phase 4 — Interview Prep + Story Bank

**Version:** 1.2
**Last Updated:** 2026-05-22 -- v1.2: Incorporated Gemini review round 2 — Q2-Q10 resolved, UX Pattern P6 (User Layer Write Confirmation), research subagent with fallback, dedup heuristic specified (Jaccard), post-check lint, debrief-history injection into cheatsheet.
**Parent Plan:** CONSOLIDATION-PLAN.md, Section 11, Phase 4
**Depends on:** Phase 1 (evaluate mode — Block F already drafts STAR+R stories), Phase 2 (cv mode — reuses _profile.md, archetype detection)

---

## 1. Context

Phases 1-3c are complete:
- **evaluate** mode runs A-G blocks; Block F already drafts 4-8 STAR+R stories per evaluation and appends them to `interview-prep/story-bank.md`
- **cv** mode generates tailored CVs with drafter-reviewer
- **scan** mode discovers jobs (portal APIs, inbox drain, `--discover` for new companies)

The story bank is **born during evaluation**, but career-scout has no mode that helps the user **convert a successful application into an interview win**. That is the gap Phase 4 closes.

The pivotal moment is when an application moves from "applied" to "interview scheduled." At that point the user needs:

1. **Company-specific intel** — actual interview questions reported on Glassdoor/Blind/LeetCode, round structure, difficulty, what they screen for
2. **A mapping from likely questions to existing stories** in the bank — so the user is not memorizing fresh material, but rehearsing what they already lived
3. **Gaps named explicitly** — if there is no story for "tell me about a conflict with a senior stakeholder," flag it and help draft one
4. **A useful Story Bank, not a graveyard** — Block F has been appending stories for months by this point. Without curation the bank becomes a pile of duplicates and one-off anecdotes

Phase 4 ships an `interview-prep` mode that handles (1)-(3), plus a Story Bank schema and a curation pass that handles (4).

### What the user wrote in the brain dump (paraphrased)

> Block F already produces stories. Good. But when I actually have an interview I need *that company's* questions, not generic STAR. And my story-bank.md has been growing for weeks and is starting to feel like a junk drawer. Phase 4 should fix both.

---

## 2. Goals

| # | Goal | How we know it's done |
|---|------|----------------------|
| G1 | Run `interview-prep <company>` and get a company-specific prep doc | File written to `interview-prep/{company-slug}-{role-slug}.md`, contains process overview + reported questions + story mapping + prep checklist |
| G2 | Stories from the bank are mapped to likely questions | Story Bank Mapping table in the prep doc shows strong/partial/none per likely question |
| G3 | Identified story gaps lead to drafting new STAR+R stories | When the mode finds a gap and the user opts in, a new story is appended to `story-bank.md` |
| G4 | Story Bank schema is standardized | Every story has the same front-matter-style header fields so dedup and search work |
| G5 | Story Bank can be curated | `interview-prep --bank-review` consolidates duplicates and flags weak stories |
| G6 | Mode does not fabricate intel | Every claim is cited or labeled `[inferred from JD]`; missing data is reported as "unknown — not enough data" |
| G7 | Mode works on Gemini CLI, Claude Code, and other agent CLIs | Mode file is CLI-agnostic (no Claude-specific tool names); CLI mapping handled by AGENTS.md |

---

## 3. What to Reuse from Source Projects

### From career-ops (primary source — ~80% of mode logic)

| Component | File | Change needed |
|-----------|------|---------------|
| **interview-prep mode** | `modes/interview-prep.md` (142 lines) | Port the 7-step structure verbatim (Research → Process → Rounds → Likely Questions → Story Mapping → Tech Checklist → Company Signals). Translate Spanish examples if any remain. Generalize archetype references. |
| **Story bank format** | `interview-prep/story-bank.md` | career-scout already has the file (different header text). Standardize the per-story schema (see §5.2). |
| **NEVER rules** | Block at end of `modes/interview-prep.md` | Port verbatim — "NEVER invent interview questions and attribute them to sources," "Cite everything." |
| **deep mode (research prompt)** | `modes/deep.md` | Optional: port as `interview-prep --deep` sub-flag, or leave it as a separate mode. Defer to §4 D4. |

### From ai-job-search (UX patterns, not the file)

| Component | Source | How to adapt |
|-----------|--------|--------------|
| **"Common Tough Questions" prompts** | `07-interview-prep.md` lines 38-54 | Use as a checklist the mode runs against the user's profile: "Why did you leave?", "You don't have X", "Where in 5 years?", etc. Do not copy the template's empty answer placeholders — those are generic. Use the question list to drive Step 4d (Background Red Flags). |
| **"Questions to ask interviewers"** | `07-interview-prep.md` lines 56-79 | The career-ops mode already has Step 7 (Company Signals → "Questions to ask them"). ai-job-search's grouping (Role / Team / Tech / Culture) is a better organizing scheme — adopt the groups. |
| **Roleplay protocol** | `07-interview-prep.md` lines 101-110 | Net-new for career-scout. Ship as **Phase 4b** (see §8) — not blocking. |

### From job-search-toolkit

Nothing directly portable for this phase. The fit-category labels are already in `_shared.md` from Phase 1.

### From LangHire

Nothing for this phase. Self-learning memory (track which stories actually worked in past interviews) is a Phase 5+ enhancement.

---

## 3.5 UX Conventions (Project-Wide)

These conventions came out of Gemini's review of v1.0. They are not Phase-4-specific — they apply to every mode in career-scout. Phase 4 ships them first; the next polish sweep retrofits evaluate, cv, scan, and pipeline-triage to follow the same patterns.

The goal: a brand-new user should never hit a dead end. Every mode tells the user where the artifact landed, what's in it, and what to do next.

### Pattern P1: Artifact Paths Are Always Clickable

When a mode writes a file the user needs to open (report, prep doc, CV PDF, archived list), output it as an **absolute path**. Most modern terminals (Windows Terminal, VS Code integrated, modern macOS, JetBrains) auto-linkify absolute paths. When the path is to a file the user is expected to *open*, prefix with `file://` — that triggers reliable linkification in the broadest set of terminals.

```
Format:
  📂 {Artifact name}: file:///absolute/path/to/artifact.ext

Example:
  📂 Prep doc: file:///C:/Work/Git-Python/career-scout/interview-prep/acme-senior-eng.md
```

Use forward slashes in the URL portion even on Windows; the `file://` URI spec requires it.

### Pattern P2: Every Mode Ends with "Next Steps"

After the artifact path, print a short numbered list of likely next actions, written as runnable commands. Three or fewer items. No prose — just the command and a one-line description.

```
What to do next:
  1. Open the prep doc above to review questions and story mappings
  2. Need deeper company research? → deep acme
  3. After the interview, run → interview-prep --debrief acme
```

This pattern applies to evaluate (next step: cv or interview-prep), cv (next step: review PDF or apply), scan (next step: pipeline-triage), pipeline-triage (next step: evaluate the top row), and setup (next step: scan or evaluate).

### Pattern P3: Cross-Mode Nudges

Modes that detect a missing-but-expected artifact in another mode's territory print a single-line nudge — not an interrupt, not a multi-paragraph warning.

| Detected condition | Mode that prints the nudge | Nudge format |
|--------------------|---------------------------|--------------|
| applications.md has a row with status `Interview` but no matching file in `interview-prep/` | pipeline-triage | `💡 Stripe is at Interview status — no prep doc yet. Run: interview-prep stripe` |
| cv mode finishes generating a PDF and the report's fit category is GOOD_FIT+ | cv | `📄 CV ready. After you submit and they schedule an interview, run: interview-prep {company}` |
| evaluate finishes a report with fit GOOD_FIT+ | evaluate | `Next: generate a tailored CV → cv {report-number}` |
| setup finishes and pipeline.md is empty | setup | `Next: discover companies → scan --discover` |

One nudge per condition. Never stack nudges. The nudge is informational, not an interrupt — the mode still completes whatever it was doing.

### Pattern P4: Long Outputs Have a `--tldr` Variant

Any mode that writes a long markdown artifact (interview-prep, evaluate, deep) supports a `--tldr` flag that:
- Prints a compact summary directly to the terminal
- Skips file generation entirely
- Is safe to pipe (`| less`, `| head`)

For Phase 4 this means `interview-prep <company> --tldr` prints the Pre-Flight Cheatsheet (see §5.6) and exits without writing the full prep doc.

Future application: `evaluate <url> --tldr` could print just the fit score + top 3 gaps; `cv --tldr` doesn't apply because CVs are inherently file artifacts.

### Pattern P5: Compact Path Display in Long Outputs

When a mode mentions multiple files in a single message, use a definition-list style instead of inline prose:

```
Generated:
  Report     file:///.../reports/018-acme-2026-05-22.md
  CV PDF     file:///.../output/cv-jane-acme-2026-05-22.pdf
  Prep doc   file:///.../interview-prep/acme-senior-eng.md
```

This is more scannable than "Generated the report at ... and the CV at ... and the prep doc at ..."

### Pattern P6: User Layer Write Confirmation

Any mode that writes to a User Layer file (`story-bank.md`, `applications.md`, `pipeline.md`, `_profile.md`, `cv.md`, `archived.md`, `follow-ups.md`, `inbox.txt`) must surface a confirmation prompt before writing. The Data Contract already forbids silent auto-writes; P6 makes the protection **visible** in terminal output instead of buried in instructions.

```
Format:
  ⚠️ This will update {file} ({what's changing in 1 line}).
  A backup has been saved to {file}.bak.
  Proceed? [y/N]
```

Rules:
- **Backup before write** — `.bak` files are written automatically. Already in `.gitignore`. Old `.bak` is replaced; we don't keep history beyond the previous version.
- **Show what changes** — "adding 3 stories", "marking 2 stories superseded", "appending debrief section" — concrete, not "updating file."
- **One confirmation per logical change** — `--bank-review` may show one confirmation per merge decision, not one bulk confirmation at the end. The user needs to see what they're approving.
- **Default is N (cancel)** — typo safety. The user must affirmatively type y or yes.
- **Skippable in CI/headless mode** — recognize a `--yes` or `--no-confirm` flag for batch operations. Default: confirmation always on.

This pattern applies to: `--bank-review` (every merge/edit), `--debrief` (every story Reflection update), Block F appends to story-bank.md during evaluate (one confirmation per append batch), and any future User Layer writers.

### What's NOT a UX convention

A few things I considered and rejected:

- **Emoji-only output** — emojis as accents (📂, 💡) are fine; emoji-only outputs are not. Some terminals render them as boxes.
- **Color codes** — career-scout outputs go through different CLIs (Claude Code, Gemini CLI). Color escape codes don't render consistently. Keep output plain.
- **Animation / spinners** — modes run inside the agent CLI's own progress UI. Adding our own would conflict.
- **Verbose explanations after every step** — the patterns above are short and dense. Adding "Here's what I just did and why" between every step bloats the output.

### Retrofitting plan

After Phase 4 ships, run a small polish sweep:
- evaluate.md → add P1/P2/P3 to end-of-mode output (next step: cv or interview-prep, depending on fit)
- cv.md → add P1/P2/P3 (next step: review PDF, then interview-prep after submission)
- scan.md → add P1/P2 (next step: pipeline-triage)
- pipeline-triage.md → add P3 (interview-prep nudge for Interview-status rows)
- setup.md → add P2 (next step: scan --discover or paste a URL to evaluate)

Track this as a follow-up item in CONSOLIDATION-PLAN.md under §11, after Phase 4 completion.

---

## 4. Architecture Decisions

### D1: `interview-prep` is a separate mode, not a step inside `evaluate`

`evaluate.md` Block F drafts STAR+R stories during evaluation. That's the bank-population step and stays as-is.

`interview-prep` runs **later**, only when the user has a confirmed interview. Different inputs (company is known and confirmed), different outputs (company-specific intel doc, not a general report), different cadence (per-interview, not per-evaluation).

Keeping them separate avoids bloating every evaluation with WebSearch traffic for companies the user may never actually apply to.

### D2: Trigger is manual, not auto-triggered by status change

Considered: auto-fire `interview-prep` when applications.md status flips to "Interview." Rejected because:
- The user may already have done the research manually
- WebSearch traffic costs tokens; should be explicit
- The user often knows the interview date before the next scan run; auto-fire would not catch the right window

Trigger: user types `interview-prep <company>`, `prep for {company}`, or `interview prep {company} {role}`.

Open for Gemini review: should we add a **soft nudge** — when `pipeline-triage` notices an Interview-status row that has no `interview-prep/` file yet, mention it once?

### D3: Output file naming — `interview-prep/{company-slug}-{role-slug}.md`

Same slug convention as `reports/` (lowercase, spaces → hyphens), but no number prefix because there is exactly one prep doc per company+role. If the user interviews at the same company twice, append a date suffix: `interview-prep/{company}-{role}-{YYYY-MM-DD}.md`.

### D4: `deep` mode lives separately; `interview-prep` calls it as a sub-step when intel is thin

career-ops ships `modes/deep.md` — a 6-axis research prompt (AI strategy, recent moves, eng culture, challenges, competitors, candidate angle). It is structurally distinct from `interview-prep`:
- `deep` = strategic/cultural research, useful at the decision-to-apply moment
- `interview-prep` = tactical interview intel, useful at the post-application moment

Decision: port `modes/deep.md` as-is to career-scout. `interview-prep` Step 1 mentions it: "if research yields little, run `deep <company>` first." Do not collapse them.

### D5: Story Bank schema is standardized; every story has a frontmatter-style header

career-ops format:
```
### [Theme] Story Title
**Source:** Report #NNN — Company — Role
**S/T/A/R/Reflection:** ...
**Best for questions about:** [list]
```

This works but is hard to dedupe, search, or programmatically reason about. Phase 4 standardizes:

```markdown
### Story {NN}: {Title}

| | |
|---|---|
| **Themes** | leadership, conflict, scaling |
| **Source** | Report #017 — Acme Corp — Senior Eng |
| **Date Lived** | 2024 Q3 |
| **Status** | active / superseded / draft |
| **Best for** | "tell me about a conflict", "describe a time you scaled something" |

- **Situation:** ...
- **Task:** ...
- **Action:** ...
- **Result:** ...
- **Reflection:** ...
```

Why a small table:
- Themes are searchable by grep
- Status field lets the curation pass mark stories as `superseded` without deleting them (preserves history)
- Date Lived helps the user pick recent stories over stale ones in interviews

### D6: Story Bank curation is a separate sub-mode, not auto-run

`interview-prep --bank-review` opens a structured pass over `story-bank.md`:
- Lists stories grouped by theme
- Flags pairs that overlap by 70%+ (same Situation/Task pair) and suggests merge or supersede
- Flags stories with weak Reflection ("learned to communicate better" = generic) and asks the user to sharpen
- Flags stories without quantified Results

Curation is explicit because it modifies the User Layer (`story-bank.md`). Per the Data Contract, no auto-overwrite of User Layer files. Curation always confirms each change.

### D7: Mode is CLI-agnostic; tool calls use intent verbs

Per CLAUDE.md "Multi-CLI Compatibility":
- "Search the web for {query}" not "use WebSearch"
- "Read the evaluation report" not "use the Read tool"
- "Write the file" not "use the Write tool"

Same rule as `evaluate.md`, `cv.md`, `scan.md`.

### D8: Anti-fabrication is enforced at three layers

LLM-physics: models love to invent plausible interview questions. We need three guards:
1. **Source tagging** — every question in the prep doc has a citation OR an `[inferred from JD]` tag. No bare claims.
2. **Citation honesty** — if WebSearch returned 2 Glassdoor reviews, we say "2 Glassdoor reviews." Not "according to multiple sources."
3. **Missing-data honesty** — if a field has no data, we write "unknown — not enough data." Not a guess wrapped in hedged language.

These three are stated as NEVER rules at the top of `modes/interview-prep.md`.

### D9: Post-interview debrief is in scope; uses the same file

After the interview, the user can run `interview-prep --debrief <company>` to:
- Capture which questions were actually asked
- Note which stories worked and which fell flat
- Append a `## Debrief` section to the existing prep doc
- Optionally feed lessons back into the story bank (update Reflection)

This is small and high-value — closes the loop and improves the bank over time. Net-new for career-scout (career-ops doesn't have it).

---

## 5. Mode Specification

### 5.1 `modes/interview-prep.md` workflow

```
Step 0: Data Gathering (all reads before any output)
  0a. Parse args → company, role, --debrief, --bank-review, --deep, --tldr
  0b. Dependency check:
        - applications.md exists?
        - story-bank.md exists?
        - reports/ has anything?
  0c. Locate the evaluation report
        - if user gave a report number → use that
        - else search reports/ for matching company-slug
        - if multiple matches → ask user which one
        - if none → ask for the JD URL or text inline
  0d. Read inputs:
        - profile.yml, _profile.md, cv.md, article-digest.md (if exists)
        - the evaluation report (Block A archetype, Block B fit, Block E personalization, Block F existing stories)
        - story-bank.md (all current stories)
        - applications.md (look up status, interview date if known)
  0e. Read Compensation context:
        - From the report: Block D (comp & demand analysis, regional market data)
        - From profile.yml: compensation.target_range, compensation.minimum, currency
        - Cache for §5.7 "Compensation Calibration" section

Step 1: Research (delegated to fresh-context subagent when supported)
  If the host CLI supports subagent spawning (Claude Code: Agent tool;
  Gemini CLI: subagent invoke), delegate this step to a research subagent.
  The subagent receives the company name, role, and JD; returns a clean
  structured fact list (no raw HTML, no chatter). This keeps the parent
  context from being polluted by Glassdoor/Blind/LeetCode raw markup.

  Fallback: if subagent spawning is not available, run the queries inline
  but cap each at top-N results and discard raw page bodies after extraction.

  Queries (port career-ops table verbatim):
    - "{company} {role} interview questions site:glassdoor.com"
    - "{company} interview process site:teamblind.com"
    - "{company} {role} interview site:leetcode.com/discuss"
    - "{company} engineering blog"
    - "{company} interview process {role}"

  Subagent return contract (JSON or structured markdown):
    - rounds: [{type, duration, evaluators, reported_questions: [{q, source}]}]
    - difficulty: {avg, n_reviews, source}
    - positive_experience: {pct, n_reviews, source}
    - quirks: [{quirk, source}]
    - values_screened: [{value, source}]
    - vocabulary: [{term, source}]
    - anti_patterns: [{pattern, source}]
    - source_count: {glassdoor: N, blind: N, leetcode: N, other: N}

  Extract structured facts. If results thin (source_count total < 3) →
  note "intel is sparse" and offer to run deep mode first.

Step 2: Process Overview
  2a. Vibe (3 sentences max, cited):
      Synthesize the overall feel from Step 1 research. Example:
        "Highly technical but collaborative; interviewers look for systemic thinking
        over memorized algorithms [Glassdoor, 4 reviews]. Strong focus on
        leadership principles even for IC roles [Blind, 2 posts]. Multiple reports
        of pair programming over whiteboards [Glassdoor]."
      This is a synthesis section — it does NOT replace the structured fields below.
  2b. Structured fields:
      Rounds, format, difficulty, positive-experience rate, known quirks, sources.
      Every field gets a source citation or "unknown — not enough data."

Step 3: Round-by-Round Breakdown
  For each discovered round: duration, conducted-by, what they evaluate, reported questions (with sources), 1-2 prep actions.

Step 4: Likely Questions (4 buckets)
  4a. Technical — system design, coding, architecture, domain.
  4b. Behavioral — leadership, conflict, collaboration, failure.
  4c. Role-Specific — tied to JD requirements (archetype-aware).
  4d. Background Red Flags — gaps, transitions, unusual elements in the user's CV.

Step 5: Story Bank Mapping
  Table: # | Likely question | Best story from bank | Fit (strong/partial/none) | Gap?
  For each "none" → suggest a specific experience from cv.md that could become a STAR+R story.
  Ask: "Want me to draft these missing stories now?" → if yes, append to story-bank.md.

Step 5b: Pre-Flight Cheatsheet generation
  See §5.6 for the full schema. Compose AFTER Steps 1-5 because it draws from them:
    - Big 3 Themes — derived from Step 4 (Likely Questions) and Step 7 (Company Signals: Values)
    - Top 3 Go-To Stories — from Step 5 (strongest-fit stories that cover the most themes)
    - Top Red Flag + 1-sentence defense — from Step 4d (Background Red Flags)
    - Top 3 Killer Questions to ask them — from Step 7 (Questions to ask)
  This block is INSERTED AT THE TOP of the output file (below the metadata header, above Step 2).
  In --tldr mode: print just this block to terminal and exit (skip file write).

Step 6: Technical Prep Checklist
  - [ ] {topic} — why: "{cited evidence}"
  Max 10 items, prioritized by frequency × relevance.

Step 7: Company Signals
  - Values they screen for (cited)
  - Vocabulary to use (cited from careers page / blog)
  - Anti-patterns to avoid (cited from interview reviews)
  - Questions to ask them (grouped: Role / Team / Tech / Culture — adopted from ai-job-search)

Step 7b: Compensation Calibration
  See §5.7. Composed AFTER Step 7 because it reads Block D context + profile.yml comp targets.
  Output a short block: target range + suggested recruiter script line.
  Skip if profile.yml compensation fields are empty.

Step 7c: Time-Bracketed Priority (CONDITIONAL — only if interview date known)
  Read applications.md for an interview date matching this company+role.
  If found: compute days remaining and emit a "Priority for the next {N} days" block
  drawn from THIS prep doc's actual content (top tech checklist items, top story gaps,
  top company-signal items). Three brackets: <= 2 days, 3-5 days, 6+ days.
  If no date or date is in the past: skip entirely. Do NOT emit a generic timeline.

Step 8: Output
  Pre-write lint sweep (Q7 — resolves anti-fabrication post-check):
    For every line in the assembled draft that:
      (a) lives under Step 3 "Round-by-Round" → "Reported questions:" OR
      (b) lives under Step 4 "Likely Questions" (any sub-bucket) AND ends in '?'
    Confirm that one of these citation markers appears on the same line or
    the line immediately following:
      [source: ...], [Glassdoor], [Blind], [LeetCode], [inferred from JD],
      [careers page], [eng blog], or any bracketed citation matching /\[[^\]]+\]/.
    For any line failing the check, accumulate into a soft warning block.
    If warning block is non-empty: print it before the file write, but do NOT block.
    Format:
      ⚠️ Citation lint: {N} entries in the draft lack a source tag. Review:
        Step 4a: "How would you scale this from 100 to 100M users?"  ← no citation
        Step 4b: "Tell me about a time you failed."                   ← no citation
      The file was still written. Edit these lines to add [source: ...] or [inferred from JD].

  Write interview-prep/{company-slug}-{role-slug}.md with the full report.
  Header (Q6 — evaluation report is referenced, not embedded):
    | | |
    |---|---|
    | **Company / Role** | {company} — {role} |
    | **Evaluation Report** | file:///{absolute-path}/reports/{NNN}-{company}-{date}.md |
    | **Researched** | {YYYY-MM-DD} |
    | **Source Count** | {N} Glassdoor, {N} Blind, {N} LeetCode, {N} other |

  Cheatsheet block (§5.6) sits at the TOP of the file, below the header.

  Terminal output follows UX Conventions §3.5:
    P1 — Print the clickable absolute path:
         📂 Prep doc: file:///{absolute-path}.md
    P2 — Print Next Steps block (max 3 items, runnable commands):
         What to do next:
           1. Open the prep doc to review questions and story mappings
           2. Need deeper company research? → deep {company}
           3. After the interview, run → interview-prep --debrief {company}
    Post-research follow-ups (offer inline if relevant):
      - "I found {N} story gaps. Want me to draft them now? [y/N]"
      - "Intel was thin (only {N} sources). Want me to run deep mode? [y/N]"
```

### 5.2 Story Bank schema (revised `interview-prep/story-bank.md`)

Replace the current template with:

```markdown
# Interview Story Bank

Accumulated STAR+R stories. Block F in evaluate.md appends new stories here.
Run `interview-prep --bank-review` to consolidate duplicates and sharpen weak stories.

## How it works

Each story uses STAR+R with a small header for searchability. The header drives:
- **Themes** — what the story is about (used by interview-prep Story Bank Mapping)
- **Status** — `active` is the default; `superseded` stories are kept for history but ignored when mapping; `draft` is a story that needs the user to flesh it out
- **Source** — the evaluation report that surfaced this story (so you can re-read context)

## Stories

<!-- Stories appended below by Block F. -->
<!-- Schema:

### Story {NN}: {Title}

| | |
|---|---|
| **Themes** | comma-separated tags |
| **Source** | Report #NNN — Company — Role |
| **Date Lived** | YYYY or YYYY Q{N} |
| **Status** | active |
| **Best for** | "literal question phrasings" |

- **Situation:** ...
- **Task:** ...
- **Action:** ...
- **Result:** quantified outcome
- **Reflection:** what you learned / what you'd do differently

-->
```

#### Legacy schema parser (Q5 — resolves "no auto-migrate")

The mode's parser MUST accept both schemas when reading story-bank.md:

- **New schema** (§5.2 above) — header table + STAR+R body
- **Legacy schema** (career-ops format):
  ```markdown
  ### [Theme] Story Title
  **Source:** Report #NNN — Company — Role
  **S (Situation):** ...
  **T (Task):** ...
  **A (Action):** ...
  **R (Result):** ...
  **Reflection:** ...
  **Best for questions about:** [list]
  ```

Detection rule: if a `### ` heading is followed within the next 6 lines by a `|` table row OR a bullet starting `- **Situation:**`, parse as new schema. If instead followed by `**Source:**` and bold `**S (Situation):**` body keys, parse as legacy.

Internally both formats are normalized to the same in-memory structure so Story Bank Mapping (Step 5 of the main mode) treats them identically. The user is unaware their bank has mixed formats until `--bank-review` offers to upgrade legacy entries to the new schema, one at a time, with P6 confirmation per entry.

### 5.3 `interview-prep --bank-review` sub-mode

```
Step 1: Load story-bank.md, parse every story block (new and legacy schemas
        per §5.2 parser), build an in-memory index.

Step 2: Dedup heuristic (Q4 — Jaccard on Situation ∪ Task word tokens):
        For every pair of active stories (i, j):
          tokens_i = lowercase, strip-punct, split-whitespace, drop stopwords
                     applied to (Situation + " " + Task) of story i
          tokens_j = same for story j
          jaccard  = |tokens_i ∩ tokens_j| / |tokens_i ∪ tokens_j|
          If jaccard >= 0.55:
            Surface to user with snippets side-by-side:
              "Story #04 and Story #11 look ~62% similar.
               #04: 'Migrated 40M-row Postgres table to a sharded layout...'
               #11: 'Led shard migration of legacy user table at Acme...'
               (m) Merge into one  (k) Keep both  (s) Mark one superseded  (skip)"
        Threshold 0.55 chosen as v1 — tunable per user feedback.

Step 3: Flag weak Reflections.
        Heuristic: Reflection field < 80 chars OR matches generic templates
        ("learned to communicate", "improved my skills", "got better at",
        "stronger team player", "more confident"). Show each → ask user to
        sharpen or mark `status: draft` until they have time.

Step 4: Flag missing quantified Results.
        Heuristic: Result field has no number (\d+), percentage (\d+%),
        scale word (thousand|million|billion|k|M|B), or duration unit.
        Surface for user to add a metric.

Step 5: Legacy → new schema upgrade prompts.
        For every story parsed as legacy schema, offer one-by-one upgrade:
          "Story #07 is in the legacy format. Convert to new schema?"
          Show side-by-side before/after.
          (y) Convert  (n) Skip — keep legacy  (skip-all)

Step 6: P6 confirmation per edit before writing (see §3.5).
        Backup story-bank.md.bak before any write.
        Append a "<!-- Last curated: {YYYY-MM-DD} -->" timestamp at the bottom.
```

This sub-mode is interactive — the user is in the loop on every change. No silent rewrites.

### 5.4 `interview-prep --debrief <company>` sub-mode

```
Step 1: Locate interview-prep/{company}-{role}.md.
        If missing → ask for company + role inline, create the file with just the debrief section.
Step 2: Walk the user through:
        - Which questions were actually asked? (compared against Step 4 predictions)
        - Which stories did you use? (compared against Step 5 mapping)
        - What surprised you? What worked? What fell flat?
Step 3: Append a `## Debrief — {YYYY-MM-DD}` section to the file.
Step 4: Offer to update story Reflection fields based on what worked/didn't.
        E.g., "Story 7 — you said it landed well in the system-design round. Want me to add
        'Strong for system-design rounds — verified Acme 2026-05-22' to the Reflection?"
Step 5: If a question came up that has no story, prompt the user to draft one now.
```

The debrief is the closing of the feedback loop. Without it, the story bank just accumulates without ever being validated against reality.

### 5.6 Pre-Flight Cheatsheet block

The 10-minute-before-the-Zoom-call problem. The full prep doc is 200-400 lines; a candidate sitting in their car opening it on a phone needs a top-of-file summary that captures the irreducible essentials.

The cheatsheet sits at the **top of the prep file**, directly below the metadata header and above Step 2's Process Overview. It's also what `--tldr` prints to the terminal.

#### Schema

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
- A: {1-sentence prepared response, honest and forward-looking}

**Top 3 Questions to Ask Them**
1. {sharp question tied to recent news/blog post or specific team detail}
2. {sharp question tied to recent news/blog post or specific team detail}
3. {sharp question tied to recent news/blog post or specific team detail}

**Lessons from Last Time** (conditional — only if debrief history exists)
- At {company} on {date}: you faced "{question}" and reflected "{reflection-summary}". Be ready for it.
- {up to 2 more lessons from same-company or same-archetype debriefs}

**Compensation Line** (if they ask)
- {one-sentence target + flexibility framing, from §5.7}
```

#### How it's composed

| Cheatsheet field | Drawn from |
|------------------|-----------|
| Big 3 Themes | Step 4 (most-frequent likely questions) + Step 7 (Values they screen for) — distilled to 3 |
| Top 3 Go-To Stories | Step 5 Story Bank Mapping, ranked by: (a) fit = strong, (b) theme coverage breadth, (c) recency from story's Date Lived field |
| Red Flag | Step 4d's strongest-signal question + the user's prepared response from `_profile.md` exit_story or a freshly drafted line |
| Top 3 Questions to Ask | Step 7's "Questions to ask them" group — pick the 3 that reference the most recent / most specific company intel from Step 1 |
| Lessons from Last Time | **Conditional** — only if a `## Debrief` section exists in (a) this exact company's prior prep file, or (b) a prep file for a same-archetype role at another company. Search `interview-prep/*.md` for `## Debrief` sections, extract the most surprising/uncomfortable Q+reflection pairs, surface up to 3. Skip the block entirely if no debrief history exists. Tone: informational, not alarmist (e.g., "At Stripe last cycle, you faced X and noted Y — be ready" — NOT "⚠️ REHEARSAL WARNING"). |
| Compensation Line | Generated by §5.7 (only if profile.yml comp is populated) |

#### Hard constraints

- **Three of each thing.** Not four, not "3-5." A fixed-cardinality summary is mentally scannable; a variable one isn't.
- **One sentence per item.** If a theme needs two sentences to explain, it's not a cheatsheet entry — it belongs deeper in the doc.
- **Every claim is grounded.** Themes cite Step 4/7, stories cite Story #NN, questions cite Step 7. No new uncited content.
- **The cheatsheet is regenerated, not edited.** If the user runs `interview-prep` again on the same company, the cheatsheet rewrites; the user's edits to Steps 2-7 are preserved (idempotent block replacement keyed off the `## ⚡ Pre-Flight Cheatsheet` heading).

#### `--tldr` mode

`interview-prep <company> --tldr`:
- Runs Steps 0-7 normally (in memory, no file write)
- Composes the Cheatsheet block (§5.6)
- Prints it directly to the terminal
- Does NOT write the prep doc to disk
- Footer line: `For the full prep doc, run: interview-prep {company}`

Use case: user has 10 minutes before a call, just needs the highlights, doesn't want to open a file.

### 5.7 Compensation Calibration block

Recruiters ask "what are your expectations?" in nearly every first-round screen. The user has already analyzed market comp during evaluate (Block D), and has comp targets in profile.yml. The prep doc should surface both as a ready-to-deliver line, so the user doesn't fumble through it live.

#### Schema (appears after Step 7, before Time-Bracketed Priority)

```markdown
## 💰 Compensation Calibration

- **Your Target:** {currency}{target_range} (from profile.yml)
- **Your Walk-Away:** {currency}{minimum} (from profile.yml — DO NOT volunteer this)
- **Market Context:** {Block D summary — what the role typically pays in this market}
- **Recruiter Script:** "{one-sentence framing: target + flexibility hook}"
```

#### Recruiter Script generation

The script line is the high-value output. Format:
> "I'm targeting roles in the {target lower bound}-{target upper bound} {currency} range, depending on the overall package — base, equity, bonus, and benefits all factor in."

If the user's target is significantly above Block D's market range, the mode notes it and offers two variants — anchored (state the target) vs. exploratory (ask for the range first). User picks per call.

#### Skip conditions

- If `profile.yml` `compensation.target_range` is empty → omit this section entirely, print a note in the cheatsheet "💰 Set compensation.target_range in profile.yml to enable comp guidance."
- If the report has no Block D (older reports from before market awareness was added) → use profile.yml only, note that market context is missing.

#### Anti-fabrication

- **Never invent a market number.** If Block D says "unknown — not enough data," the Market Context line says the same.
- **Never pressure the user toward a specific number.** The script is a framing tool; the actual number comes from profile.yml.

### 5.8 Updates to existing files

| File | Change |
|------|--------|
| `modes/evaluate.md` Block F | Update story-append format to match new schema (table header). No change to story generation logic. End-of-mode output gets UX P1+P2 (clickable report path + next-step hint: cv or interview-prep depending on fit). |
| `modes/cv.md` | End-of-mode output gets UX P1+P2+P3 (clickable PDF path + next-step nudge to interview-prep after submission). |
| `modes/pipeline-triage.md` | Add UX P3 nudge: when scanning rows, detect Interview-status entries that lack a matching `interview-prep/{slug}.md` file. Print a single-line tip (resolves v1.0 Q1). |
| `modes/scan.md` | End-of-mode output gets UX P1+P2 (clickable pipeline.md path + next-step: pipeline-triage). |
| `modes/setup.md` | Add a brief step explaining that story-bank.md is populated by evaluate runs; nothing to do at setup time. End-of-mode UX P2 (next-step: scan --discover or paste a URL to evaluate). |
| `interview-prep/story-bank.md` | Replace existing template with §5.2 version. **User Layer** — only do this on a brand-new install. If existing user has stories, write a migration note in setup that walks them through reformatting. |
| `AGENTS.md` Mode Routing | Update "Types 'interview-prep'" row from "(Phase 4)" → just link the mode. |
| `.agents/skills/career-scout/SKILL.md` | Add interview-prep to discovery menu. Mention `--debrief`, `--bank-review`, `--deep`, `--tldr`. |
| `docs/DATA_CONTRACT.md` | Confirm `interview-prep/*` is User Layer. Add per-file note: prep docs are user-editable, bank is appended by evaluator but curated by user. |
| `README.md` | Add `interview-prep` to mode list. Add new "Prepare for an Interview" section to Quick Start with the four commands (`<company>`, `--tldr`, `--bank-review`, `--debrief`). Adapt Gemini's proposed copy (Phase 4 review v1) to career-scout's existing voice. |

---

## 6. Implementation Tasks

### 6a. Mode file + schema (core deliverables)

- [ ] Port `modes/interview-prep.md` from career-ops, adapted to career-scout conventions
- [ ] Add Step 0e — Read Block D + profile.yml compensation targets (§5.7)
- [ ] **Add Step 1 subagent delegation** — research subagent contract + fallback (Q2)
- [ ] Add Step 2a — Interview "Vibe" 3-sentence synthesis (cited)
- [ ] Add Step 4d — Background Red Flags (uses ai-job-search "Common Tough Questions" as a checklist source)
- [ ] Adopt ai-job-search's Role/Team/Tech/Culture grouping in Step 7's "Questions to ask them"
- [ ] Add Step 5b — Pre-Flight Cheatsheet block generation (§5.6) — including conditional "Lessons from Last Time" sub-block (Q10)
- [ ] Add Step 7b — Compensation Calibration block (§5.7)
- [ ] Add Step 7c — Time-Bracketed Priority block (conditional on interview date in applications.md)
- [ ] **Add Step 8 citation lint sweep** — regex check + soft warning (Q7)
- [ ] **Add Step 8 referenced report header** — `file:///` link to evaluation report, not embedded (Q6)
- [ ] Port `modes/deep.md` from career-ops (small file, useful standalone)
- [ ] Update `interview-prep/story-bank.md` template to the new schema (§5.2)
- [ ] **Implement legacy-schema parser** that accepts both new (§5.2) and old (career-ops) formats during read (Q5)
- [ ] Update `modes/evaluate.md` Block F to append in the new schema

### 6b. Sub-modes & flags

- [ ] Implement `interview-prep <company> --tldr` — print cheatsheet to terminal, skip file write (§5.6)
- [ ] Implement `interview-prep --bank-review` (§5.3) — including Jaccard >= 0.55 dedup (Q4) and legacy schema upgrade prompts (Q5)
- [ ] Implement `interview-prep --debrief <company>` (§5.4)
- [ ] Implement `interview-prep --deep <company>` as a thin wrapper that calls deep mode
- [ ] Implement `--yes` / `--no-confirm` flag for batch operations (P6 escape hatch)

### 6c. UX Conventions (Phase 4 ships, retrofit after)

- [ ] **Phase 4 ships P1-P6 in interview-prep mode** — clickable paths, next steps, --tldr, compact path display, User Layer Write Confirmation
- [ ] **Retrofit sweep** (separate commit, after Phase 4 main):
  - [ ] `modes/evaluate.md` — add P1+P2 to end-of-mode output, full P2 block (Q9), Block F append uses P6
  - [ ] `modes/cv.md` — add P1+P2+P3 (next-step nudge to interview-prep after submission)
  - [ ] `modes/scan.md` — add P1+P2 (next-step: pipeline-triage); pipeline.md appends use P6
  - [ ] `modes/pipeline-triage.md` — add P3 (interview-prep nudge for Interview-status rows; resolves v1.0 Q1); any in-place edits use P6
  - [ ] `modes/setup.md` — add P2 (next-step: scan --discover or paste a URL); first-run output includes a one-time editor-opening hint (ctrl+click in VS Code, etc.) — only on first run, never repeated
- [ ] Document P1-P6 in `modes/_shared.md` so all future modes inherit them

### 6d. Routing + docs

- [ ] Update `AGENTS.md` mode routing (drop "(Phase 4)" marker)
- [ ] Update `.agents/skills/career-scout/SKILL.md` discovery menu (add `--tldr`, `--bank-review`, `--debrief`, `--deep`)
- [ ] Update `docs/DATA_CONTRACT.md` with `interview-prep/*` per-file notes
- [ ] Update `README.md` mode list + Quick Start (new "Prepare for an Interview" section, adapted from Gemini's review draft)
- [ ] Update `modes/setup.md` with a one-line mention of the story bank

### 6e. Tests

- [ ] **T1: Cold start.** Fresh story-bank.md with one story. Run `interview-prep` for a tech company with public Glassdoor presence. Verify: prep doc written, story mapping shows 1 "strong" + several "none" gaps, citations present, cheatsheet at top of file.
- [ ] **T2: Mapping accuracy.** With 5+ stories in bank, run `interview-prep`. Verify mapping table picks the best story per question, not random.
- [ ] **T3: Citation honesty.** Force a scenario with very thin web data (obscure startup). Verify the mode says "unknown — not enough data" instead of fabricating questions.
- [ ] **T4: Bank curation.** Plant 2 overlapping stories in bank. Run `--bank-review`. Verify it detects the overlap and asks the user before merging.
- [ ] **T5: Debrief loop.** Generate a prep doc, then run `--debrief`. Verify append (not overwrite), verify story Reflection update offer.
- [ ] **T6: CLI parity.** Run the whole flow on Gemini CLI AND Claude Code. Verify same output structure (citations, sections, file naming).
- [ ] **T7: Block F migration.** Run an evaluate on a fresh report. Verify the appended story matches the new schema, not the old one.
- [ ] **T8: --tldr terminal output.** Run `interview-prep <company> --tldr`. Verify: cheatsheet prints to terminal, no file written, footer line points to full-doc command.
- [ ] **T9: Compensation skip path.** Run `interview-prep` with profile.yml comp fields empty. Verify §5.7 block is omitted, cheatsheet shows the "set comp targets" hint instead.
- [ ] **T10: UX P1+P2.** Verify the end-of-mode output prints the `file://` absolute path and a max-3-item Next Steps block with runnable commands.
- [ ] **T11: Cross-mode nudge.** Plant a row in applications.md with status `Interview` for a company with no prep file. Run `pipeline-triage`. Verify single-line nudge appears.
- [ ] **T12: Subagent path (Q2).** Run `interview-prep` on Claude Code (Agent tool available). Verify Step 1 spawns a research subagent. Then run on a CLI without subagent support (mocked) — verify inline fallback works with same output shape.
- [ ] **T13: Jaccard dedup (Q4).** Plant 2 stories with Situation/Task token-overlap ~0.6 (above threshold) and 2 with ~0.4 (below). Run `--bank-review`. Verify exactly the >= 0.55 pair surfaces.
- [ ] **T14: Legacy schema co-existence (Q5).** Story-bank.md with mixed legacy + new entries. Run `interview-prep` (regular). Verify Story Bank Mapping treats both formats identically. Run `--bank-review`. Verify legacy entries are offered for upgrade one at a time.
- [ ] **T15: Citation lint sweep (Q7).** Manually plant an unverified question line in the in-memory draft. Verify the soft warning lists it before file write, AND the file is still written.
- [ ] **T16: Lessons from Last Time (Q10).** Generate one debrief file for Company A. Run `interview-prep` on Company B with same archetype. Verify the cheatsheet "Lessons from Last Time" block appears with Company A's data. Then delete the debrief, re-run — verify block disappears.
- [ ] **T17: P6 confirmation default.** Run any sub-mode that writes to User Layer. Hit enter (no input). Verify nothing was written (default N).

---

## 7. Open Questions for Gemini Review

These are calls the user should make before this plan is locked. Listing here so Gemini can push back on any of them.

| # | Question | Status | My current lean |
|---|----------|--------|-----------------|
| ~~Q1~~ | ~~Pipeline-triage nudge for Interview rows without prep doc?~~ | **Resolved (v1.1)** — UX Pattern P3 in §3.5. |
| ~~Q2~~ | ~~Spawn fresh-context research subagent in Step 1?~~ | **Resolved (v1.2)** — YES by default, with graceful fallback. Spec lifted into §5.1 Step 1 (sub-step). Mode delegates Glassdoor/Blind/LeetCode raw scraping to a subagent that returns a clean structured fact list; if subagent spawning unsupported by the host CLI, fall back to inline WebSearch. |
| ~~Q3~~ | ~~Roleplay/practice mode — Phase 4 or 4b?~~ | **Resolved (v1.2)** — 4b. Already in §8 future work. |
| ~~Q4~~ | ~~Story Bank dedup — embeddings or string overlap?~~ | **Resolved (v1.2)** — String overlap. Concrete heuristic: **Jaccard similarity on word-token sets of (Situation ∪ Task), >= 0.55** flags a pair for user-confirmed merge. Spec lifted into §5.3. |
| ~~Q5~~ | ~~Auto-migrate legacy story-bank.md or interactive?~~ | **Resolved (v1.2)** — Interactive via `--bank-review`. Mode parser must accept BOTH legacy (career-ops `### [Theme] Story Title` + bold-key body) and new (§5.2 table header) schemas at read time. `--bank-review` offers per-story reformat to new schema. Spec lifted into §5.2 and §5.3. |
| ~~Q6~~ | ~~Embed full evaluation report or reference?~~ | **Resolved (v1.2)** — Reference via clickable `file:///` path in the prep doc's metadata header (UX P1). Spec lifted into §5.1 Step 8. |
| ~~Q7~~ | ~~Soft post-check that every Likely Question has a citation?~~ | **Resolved (v1.2)** — YES. Concrete regex check at end of Step 8: for every line in Steps 3-4 that ends in `?` or is a bullet under "Reported questions:", look for `[source: ...]`, `[Glassdoor]`, `[Blind]`, `[LeetCode]`, or `[inferred from JD]` within the same line or the line directly below. Print a soft warning listing any unverified entries before exit; do NOT block the write. Spec lifted into §5.1 Step 8. |
| ~~Q8~~ | ~~Cover letter step in interview-prep?~~ | **Resolved (v1.2)** — No. Separation of concerns: cover letters are pre-submission (cv mode, Phase 2); interview-prep is post-submission. |
| ~~Q9~~ | ~~Full P2 block in evaluate.md retrofit, or one-line?~~ | **Resolved (v1.2)** — Full P2 block in every mode. Consistency beats brevity. Already tracked in §6c retrofit list. |
| ~~Q10~~ | ~~Cheatsheet cite earlier --debrief data when available?~~ | **Resolved (v1.2)** — YES, with toned-down framing (rebut to Gemini's "⚠️ Rehearsal Warning"). Add a 4th cheatsheet sub-block "Lessons from Last Time" that fires only when an interview-prep file for this company or a same-archetype role exists with a `## Debrief` section. Format: informational, not alarmist. Spec lifted into §5.6. |

**All Q1-Q10 are now resolved.** Specs have been lifted into the relevant sections (§5.1, §5.2, §5.3, §5.6, §6c). New questions surfaced in subsequent reviews go below as Q11+.

---

## 8. Future Work (Phase 4b)

Items deferred from Phase 4 core:

- **Roleplay mode** (`interview-prep --practice`) — interactive Q&A drill, gives per-answer feedback, suggests stories from bank. (ai-job-search lines 101-110.)
- **Pre-interview countdown** — if applications.md has an interview date, surface "Interview in 3 days — review prep doc" on next `pipeline-triage` run.
- **Cross-interview pattern detection** — after 3+ debriefs, analyze which stories consistently work and which fall flat. Update the story bank with `validated: N times` metadata.
- **Mock-interview transcript scoring** — paste a transcript of a practice answer; get specific feedback against the STAR+R framework.
- **Self-learning memory** (from LangHire) — track per-ATS / per-company patterns across debriefs. Confidence-decayed knowledge base of "what actually works."

---

## 9. Plan Versioning

| Version | Date | Note |
|---------|------|------|
| 1.0 | 2026-05-22 | Initial draft for Gemini review |
| 1.1 | 2026-05-22 | Incorporated Gemini round 1: Pre-Flight Cheatsheet (§5.6), `--tldr` flag, Compensation block (§5.7), UX Conventions P1-P5 (§3.5, project-wide), cross-mode nudges (resolves Q1), conditional Time-Bracketed Priority (rebut to Gemini's generic study-timeline proposal). New tests T8-T11. New open questions Q9-Q10. |
| 1.2 | 2026-05-22 | Incorporated Gemini round 2: All Q2-Q10 resolved with specs lifted into §5.1, §5.2, §5.3, §5.6. UX Pattern P6 (User Layer Write Confirmation). Research subagent contract with graceful fallback (Q2). Jaccard ≥ 0.55 dedup heuristic (Q4). Legacy schema co-existence parser (Q5). Referenced report header, not embedded (Q6). Citation lint sweep regex (Q7). "Lessons from Last Time" cheatsheet sub-block (Q10), reframed from Gemini's "⚠️ Rehearsal Warning" to informational tone. Editor-opening hint reframed to setup-once instead of per-message (rebut to Gemini's per-message proposal). New tests T12-T17. |

---

## 10. Acceptance Criteria for Phase 4 Complete

Phase 4 is done when:

1. `interview-prep <company>` produces a prep doc on the first try for a real company with public Glassdoor presence, with every claim cited or labeled inferred
2. The output file has the Pre-Flight Cheatsheet block at the top (§5.6), with all 4 sub-blocks present (Themes, Stories, Red Flag, Questions to Ask), each at fixed cardinality 3
3. `interview-prep <company> --tldr` prints the cheatsheet to terminal, writes no file, and ends with the full-doc command hint
4. Story bank schema is the new format; Block F appends in the new format; legacy stories coexist without breaking the mapping step
5. `--bank-review` and `--debrief` sub-modes work end-to-end on Gemini CLI and Claude Code
6. UX Conventions P1-P5 are implemented in `interview-prep` mode (and documented in `modes/_shared.md` for future modes to inherit)
7. Pipeline-triage nudge (P3) fires on Interview-status rows without a matching prep file
8. Compensation Calibration block emits when profile.yml comp fields are populated; gracefully skips with a hint otherwise
9. CONSOLIDATION-PLAN.md Phase 4 checklist is fully ticked
10. Tests T1-T11 pass on Gemini CLI manual run
11. No User Layer files (`story-bank.md`, `applications.md`, `_profile.md`, `cv.md`) are auto-overwritten — every modification confirms with the user first

12. Research subagent (Q2) is invoked when host CLI supports it; inline fallback produces equivalent structured output when not
13. `--bank-review` Jaccard ≥ 0.55 dedup (Q4) detects planted overlaps and surfaces them with side-by-side snippets
14. Legacy and new schema entries (Q5) coexist in story-bank.md; both work in Story Bank Mapping; bank-review offers per-entry upgrade
15. Citation lint sweep (Q7) prints soft warnings for unverified questions before file write, does not block
16. Cheatsheet "Lessons from Last Time" block (Q10) appears only when relevant debrief data exists; tone is informational
17. UX Pattern P6 (User Layer Write Confirmation) fires before every modification to story-bank.md, applications.md, and pipeline.md edits inside this phase's work

**Out of scope (deferred to retrofit sweep, post-Phase 4 main):**
- Applying UX P1-P6 to evaluate, cv, scan, pipeline-triage, setup mode files. These get a separate commit referenced from §6c.
- Editor-opening hint in setup mode's first-run output (rebut to Gemini's per-message proposal).

---

## 11. Response to Gemini Review Round 1

This section documents what was adopted, modified, and pushed back on from Gemini's review of v1.0. Kept in the plan so future readers (including future Gemini reviewers) understand the reasoning behind v1.1's additions.

### Adopted in full

| Gemini point | Where it landed |
|--------------|-----------------|
| Clickable `file:///` paths in mode output | UX Pattern P1 (§3.5) — project-wide convention |
| "Next step" action hints after every mode | UX Pattern P2 (§3.5) — project-wide convention |
| Cross-mode nudges (pipeline → prep, cv → prep) | UX Pattern P3 (§3.5) — and resolves v1.0 open question Q1 |
| Pre-Flight Cheatsheet at top of output file | §5.6 — full spec with fixed-cardinality schema |
| `--tldr` flag to print cheatsheet to terminal | UX Pattern P4 (§3.5) — extended as project-wide for long-output modes; §5.6 spec; T8 test |
| Compensation context section (Block D + profile.yml) | §5.7 — full spec including skip path; Steps 0e, 7b in §5.1; T9 test |
| Implementation task additions (0e, 5b, --tldr, nudges) | §6a, §6b, §6c, §6d expanded |
| README Phase 4 section | §5.8 row noting adaptation of Gemini's draft to career-scout's voice |

### Adopted with modification

| Gemini point | What changed | Why |
|--------------|--------------|-----|
| "Interview Vibe" as a section | Adopted as **3-sentence synthesis at top of Step 2** (Process Overview), not a separate section | Career-ops Step 2 (Process Overview difficulty/quirks) and Step 7 (Company Signals values/vocab/anti-patterns) already cover the structured data. A standalone Vibe section would either duplicate them or push them out. A 3-sentence cited synthesis at the top of Step 2 captures the qualitative feel without duplication. |
| "Recommended Study Timeline" | Reframed as **conditional Time-Bracketed Priority block** (Step 7c), only emitted if interview date is known in applications.md, and drawing from the prep doc's actual content (not generic Day 1-2 templates) | A canned "Day 1-2 Technical, Day 5 Read blog & relax" timeline is generic — it doesn't know what the candidate's actual gaps are. If the date is unknown, emitting fluff is worse than emitting nothing. The conditional version pulls from the user's real prep content and only fires when it can be specific. |
| `file://` prefix as universal recommendation | Refined to: print **absolute path always, with `file://` prefix when it reliably linkifies in target terminals** (Windows Terminal, VS Code, modern macOS, JetBrains) | Some Linux terminals don't auto-linkify; `file://` looks like noise there. Absolute path is the floor; `file://` is the ceiling. Implementation detail noted in P1. |

### Considered, deferred to Phase 4b

| Gemini point | Why deferred |
|--------------|--------------|
| Roleplay/practice mode | Already in v1.0 §8 as Phase 4b. Gemini's review reinforces the value but doesn't change the scope decision — it's orthogonal to the company-intel core. |

### Net effect on plan size

v1.0 → v1.1: ~360 → ~750 lines. The growth is overwhelmingly the project-wide UX Conventions section (§3.5), which earns its place because it sets a standard the rest of the codebase will inherit during the post-Phase-4 polish sweep. The user explicitly flagged this as the priority: *"some UX stuff might be applicable for beyond the interview portion. I am really trying to make it very intuitive for a new user."*

---

## 12. Response to Gemini Review Round 2

Gemini Round 2 was overwhelmingly approval — all three v1.1 push-backs (Vibe synthesis, conditional Time-Bracketed Priority, context-aware `file://`) were endorsed, and Q2-Q10 received concrete recommendations. This section documents how v1.2 incorporated them.

### Adopted in full

| Gemini point | Where it landed | Concrete spec added |
|--------------|-----------------|---------------------|
| Q2: Always use research subagent | §5.1 Step 1 | Subagent return contract spelled out (rounds, difficulty, quirks, values, vocabulary, anti-patterns, source counts); fallback path when host CLI lacks subagent support |
| Q3: Roleplay → 4b | §8 Future Work | (Already in v1.0) |
| Q4: String overlap, not embeddings | §5.3 Step 2 | Jaccard ≥ 0.55 on word-token sets of (Situation ∪ Task), with stopword strip and case folding |
| Q5: No auto-migrate, bank-review handles it | §5.2 legacy parser block + §5.3 Step 5 | Detection rule: `### ` heading followed within 6 lines by `\|` table row (new) vs `**Source:**` (legacy). Both formats normalize to same in-memory structure. Per-entry P6 upgrade in `--bank-review`. |
| Q6: Reference, not embed | §5.1 Step 8 | Metadata header table with `file:///` link to evaluation report |
| Q7: Soft post-check lint sweep | §5.1 Step 8 | Regex check for `[source: ...]` / `[Glassdoor]` / `[Blind]` / `[LeetCode]` / `[inferred from JD]` within same-or-next line of any question. Soft warning, does not block write. |
| Q8: No cover letter step | (no change needed — already excluded in v1.0) | — |
| Q9: Full P2 block in evaluate.md | §6c retrofit list | Every retrofitted mode emits the standard 3-item P2 "What to do next" block |
| 3.1: Idempotence & Safety Warnings | UX Pattern P6 in §3.5 | `.bak` backup + concrete change description + default-N prompt + `--yes`/`--no-confirm` escape hatch |

### Adopted with modification

| Gemini point | What changed | Why |
|--------------|--------------|-----|
| Q10: "⚠️ Rehearsal Warning" framing for debrief-injected cheatsheet block | Adopted the **data** (cite past debrief Q+reflection in cheatsheet), rebutted the **tone**. Reframed as "Lessons from Last Time" — informational, not alarmist. | The value is in the personalization, not the urgency. A candidate sitting in their car 10 minutes before a Zoom call doesn't need an alarm — they need a calm, specific reminder. The same data delivered with informational tone is more usable. |
| 3.2: Per-message editor-opening hint ("(Tip: In VS Code, ctrl+click...)") | Moved to **setup mode first-run output, once**. Not in every mode's output. | A per-message tip is helpful for 3 minutes and noise for the rest of a user's life with the tool. First-run-only or `--help`-only is the right cadence. Already in the §6c retrofit list for setup.md. |

### Rebutted (none)

Round 2 had no push-backs that I rejected. Every recommendation was adopted, either as Gemini proposed or with a refinement on tone or placement.

### Resolved open questions

All Q1-Q10 are now resolved. The §7 table has been updated to strike them through with resolution links to the relevant spec sections. New questions that arise in Round 3 will start at Q11.

### Net effect on plan size

v1.1 → v1.2: ~750 → ~900 lines. The growth is concentrated in three places:
- §5.1 Step 1 (subagent contract, ~25 lines)
- §5.1 Step 8 (citation lint regex + referenced report header, ~25 lines)
- §5.2/§5.3 (legacy parser + Jaccard dedup spec, ~50 lines)
- §3.5 Pattern P6 (~20 lines)

Every addition is a concrete implementation spec, not prose. Ratio of spec-to-prose has improved across the v1.0 → v1.1 → v1.2 progression.

### Plan is ready to execute

After two rounds of Gemini review:
- Architecture decisions are locked (D1-D9)
- UX Conventions are locked (P1-P6)
- All open questions are resolved (Q1-Q10)
- Implementation tasks are concrete and check-list-able (§6a-§6e)
- Acceptance criteria cover every claim in the plan (§10, 17 items)
- 17 tests cover the workflow paths, schema edge cases, anti-fabrication guards, and CLI parity (T1-T17)

Round 3 review, if desired, should focus on: (a) any concrete spec that is still ambiguous, (b) execution sequencing within §6, (c) whether the retrofit sweep should be its own plan document. Otherwise: ship it.

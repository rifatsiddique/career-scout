# Phase 2: CV Generation — Multi-Template + Drafter-Reviewer

**Version:** 2.2
**Last Updated:** 2026-05-15 -- v2.2: Gemini round 3 — Playwright loop collapse, reviewer text-only input + PII guard, merged Review & Confirm step, --fast flag, market-aware formatting.
**Parent Plan:** CONSOLIDATION-PLAN.md, Section 11, Phase 2
**Depends on:** Phase 1 (evaluate mode — produces the scoring and gap analysis that drive CV tailoring)

---

## 1. Context

Phase 1 established the evaluation pipeline: the user pastes a JD, gets a 7-block
analysis with scoring, gap analysis, and personalization recommendations (Block E).

Phase 2 turns Block E's recommendations into an actual tailored CV PDF. Three major
enhancements over career-ops:

1. **Multi-template support** — 2 HTML templates for Phase 2 (ATS-Optimized + Classic Professional),
   with 2 more (Academic, Technical) added in a follow-up. Career-ops had one template.
2. **Drafter-reviewer workflow** — for GOOD_FIT+ (≥80), a fresh-context reviewer agent
   critiques the draft before PDF generation (from ai-job-search, career-ops didn't have this)
3. **Iterative refinement** — after initial generation, user can review a discard summary
   and request changes in a conversational loop. CV Rules can be overridden during
   user-directed modifications.

---

## 2. What to Reuse from Source Projects

### From career-ops (direct port, minimal changes)

| Component | File | Change needed |
|-----------|------|---------------|
| `generate-pdf.mjs` | 183 lines — HTML→Playwright→PDF | **None.** Script is template-agnostic (takes `<input.html> <output.pdf>`). ATS normalization, font rewriting, and page counting are all reusable as-is. |
| `fonts/` (Space Grotesk + DM Sans) | 4 woff2 files | **None** for Template 1. Other templates need their own fonts. |
| `cv-template.html` | 419 lines — ATS single-column | Becomes Template 1. Remove any career-ops-specific examples in comments. Add `{{TEMPLATE_ID}}` metadata tag. |
| `templates/cv/manifest.yml` | Already scaffolded | Populate with 2 active templates + 2 planned |
| Placeholder system | `{{NAME}}`, `{{EXPERIENCE}}`, etc. | **Reuse as-is.** All templates share the same placeholder vocabulary. |

### From ai-job-search (adapt patterns, not code)

| Component | What to take | How to adapt |
|-----------|-------------|--------------|
| Drafter-reviewer 2-agent workflow | Reviewer is fresh-context, receives draft + JD + profile only | Implement via subagent spawn (Gemini: invoke_agent). Reviewer returns markdown edit descriptions (not JSON patches — see LLM-physics notes). |
| Interview backtrack test | 3-zone rule (OK / Flag / Never) | Port the rule verbatim into `modes/cv.md`. Apply to every generated bullet. |
| Relevance-weighted cutting | Score each line: relevance + uniqueness + narrative load | Port the scoring heuristic and cut priority order into `modes/cv.md`. |

---

## 3. Template Design

### Shared across all templates

- Same `{{PLACEHOLDER}}` vocabulary — `{{NAME}}`, `{{SUMMARY}}`, `{{COMPETENCIES}}`, `{{EXPERIENCE}}`, `{{PROJECTS}}`, `{{EDUCATION}}`, `{{SKILLS}}`, `{{CERTIFICATIONS}}`
- Same `generate-pdf.mjs` pipeline (ATS normalization, font loading, PDF generation)
- Same CSS rules: `break-inside: avoid`, `orphans: 2`, `widows: 2`, print color-adjust
- **Target: 2 pages.** Use narrow margins by default to maximize content space.
- **CSS variables for deterministic overflow fallbacks** (Gemini review):
  ```css
  :root {
    --base-font-size: 11pt;
    --margins: 0.5in;           /* narrow by default */
    --bullet-spacing: 0.15em;
  }
  ```
  If PDF overflows 2 pages, the LLM follows a deterministic fallback chain (see Section 6).

### Template 1: ATS-Optimized (port from career-ops)

- **Source:** `cv-template.html` from career-ops (419 lines)
- **Design:** Single column, Space Grotesk headings, DM Sans body, teal/gradient header
- **Best for:** Most applications — passes ATS parsing reliably
- **Fonts:** Space Grotesk + DM Sans (already in `fonts/`)
- **File:** `templates/cv/ats-optimized.html`

### Template 2: Classic Professional (new)

- **Design:** Conservative serif (Source Serif Pro or EB Garamond), minimal color, traditional two-column header, lots of whitespace
- **Best for:** Finance, consulting, enterprise, government, regulated industries
- **Fonts:** Source Serif Pro (heading) + Inter (body) — need to source woff2 files
- **File:** `templates/cv/classic-professional.html`
- **Differentiation:** No gradient, no color accents. Understated professionalism. Slightly larger margins.

### Template 3: Academic/Research (DEFERRED — Phase 2b)

Deferred per Gemini recommendation: prove the pipeline with 2 templates first.

- Publications-forward layout, EB Garamond, education near top, DOI links
- File: `templates/cv/academic-research.html`

### Template 4: Technical/Engineering (DEFERRED — Phase 2b)

Deferred per Gemini recommendation.

- Project-forward layout, JetBrains Mono + Inter, skills grid, project cards
- File: `templates/cv/technical-engineering.html`

### Template Selection Logic

```
1. Check: does the evaluation report specify a template override? (per-evaluation)
2. Check: does profile.yml → cv.template_overrides have a mapping for the detected archetype?
3. Fall back to profile.yml → cv.default_template (default: "ats-optimized")
```

---

## 4. CV Generation Rules (User Preferences in `_profile.md`)

Every user has different preferences for how their CV should be tailored.
These standing instructions are stored in `modes/_profile.md` under a new
`## CV Generation Rules` section — User layer, never auto-updated.

### What goes in this section

| Category | Examples |
|----------|---------|
| **Content rules** | "Always include my patent count (9 US patents) — never cut this", "Always mention IEEE award", "Publications: keep all 10" |
| **Language rules** | "Minimize rewording — reorder and emphasize, don't rewrite my phrasing", "Use my exact wording for achievements" |
| **Section priorities** | "Lead with hardware experience regardless of role", "Projects section is optional — cut first if space tight" |
| **Formatting rules** | "No more than 5 bullets per role", "Every bullet must have a metric", "Summary: 3 lines max" |
| **Never rules** | "Never use the word 'leverage'", "Never list GPA", "Never include references section" |

### How it's populated

- **During setup (Phase 1, modes/setup.md):** Add an optional step after Writing Style:
  "Any standing rules for how your CVs should be generated? For example: always include
  certain achievements, never remove certain sections, limit bullet count per role, etc."
- **Incrementally:** User can say "add to my CV rules: always lead with power electronics"
  at any time → agent appends to the section in `_profile.md`
- **Can be empty:** If the user has no preferences, the section is blank and the drafter
  uses its default behavior.

### How it's used in the workflow

1. **Drafter (Step 1):** Before filling any template placeholder, read `_profile.md →
   CV Generation Rules`. These rules are hard constraints — they override the drafter's
   default decisions. Example: if rules say "never cut publications", the relevance-weighted
   cutting logic skips that section entirely.
2. **Reviewer (Step 2):** The reviewer also receives CV Generation Rules in its prompt.
   Part of its job is to verify the draft respects all user rules. If the drafter violated
   a rule (e.g., cut a "never cut" section), the reviewer flags it in Part A edits.
3. **Cutting logic (Section 5):** Before applying cuts, check CV Generation Rules for
   protected content. Items marked "always include" or "never cut" are excluded from
   the cutting pool.

### Template for `_profile.md`

```markdown
## CV Generation Rules

_Your standing instructions for CV tailoring. These override default behavior.
Edit anytime — tell Gemini "add to my CV rules: ..." or edit this section directly._

### Content Rules
- (none yet — add rules like "always include X" or "never remove Y")

### Language Rules
- (none yet — add rules like "minimize rewording" or "use my exact phrasing for...")

### Section Priorities
- (none yet — add rules like "lead with X experience" or "cut Y section first")

### Formatting
- (none yet — add rules like "max 5 bullets per role" or "summary under 3 lines")
```

---

## 5. The Drafter-Reviewer Workflow

### When it activates

- **`cv --fast` (or `cv --draft-only`):** Skip reviewer, backtrack test, and PDF generation.
  Drafter fills the template, writes `output/draft-{company-slug}.html`, and exits.
  For power users who want the tedious placeholder mapping done by AI but will hand-edit
  the HTML in their IDE before generating the PDF themselves.
- **Composite score ≥ 80 (GOOD_FIT+):** Full drafter-reviewer workflow
- **Composite score 65–79 (PARTIAL_MATCH):** Single-pass generation (no reviewer). Worth generating a CV but not worth the extra agent cost.
- **Composite score < 65:** No CV generated. Block E recommendations only.

### Step 1: DRAFTER generates tailored CV

The drafter (main agent) has full context: evaluation report, `cv.md`, `_profile.md`,
`article-digest.md`, JD text, detected archetype.

**CV Generation Rules precedence (Gemini review):** Read `_profile.md → CV Generation
Rules` FIRST. These rules are ABSOLUTE — they override default template behavior. If a
"never cut" rule conflicts with the 2-page limit, the "never cut" rule wins. The user
chose to protect that content explicitly.

Actions:
1. Select template (per selection logic above)
2. Read the template HTML file
3. Read `_profile.md → CV Generation Rules` — absolute precedence over defaults
4. **Read Block C (Level & Strategy) from the evaluation report.** The positioning
   strategy is a hard constraint that overrides keyword relevance scoring:
   - **Aligned (≤ 1 level gap):** Normal keyword-driven tailoring. Emphasize what Block C recommends.
   - **OVERQUALIFIED (downlevel strategy):** De-emphasize seniority signals. Management achievements,
     team-size metrics, and org-level scope must be suppressed even if they match JD keywords.
     Focus on IC contributions, hands-on technical work.
   - **TOO_JUNIOR (promotion framing):** Emphasize stretch evidence, adjacent experience,
     and growth trajectory. Don't hide the level gap — frame it as readiness.
5. **Check `profile.yml → location.market`** for locale-aware formatting:
   - `DACH`: DD.MM.YYYY dates, metric units, German spelling for bilingual CVs
   - `US-West` / `US-East`: MM/YYYY dates, US English spelling
   - `UK`: DD/MM/YYYY dates, British English spelling
   - `Japan`: YYYY/MM dates, consider bilingual formatting
   - Not set: default to US English conventions
6. Extract 15–20 ATS keywords from the JD
7. For each `{{PLACEHOLDER}}`:
   - `{{SUMMARY}}`: Rewrite professional summary using archetype framing + Block C positioning, inject top 5 keywords
   - `{{COMPETENCIES}}`: Build grid from JD requirements mapped to candidate skills
   - `{{EXPERIENCE}}`: Reorder bullets by JD relevance, **filtered through Block C positioning strategy**.
     A keyword-matching bullet that contradicts the positioning strategy is cut, not promoted.
   - `{{PROJECTS}}`: Select top 3–4 projects by JD relevance
   - `{{SKILLS}}`: Reorder by JD match, add any JD-mentioned tools the candidate has
8. Apply deterministic cutting first, then relevance-weighted cutting if still overflowing (see Section 6). "Never cut" items excluded from cutting pool.
9. Apply interview backtrack test to every generated bullet (respect Language Rules — if user says "use my exact phrasing", backtrack test thresholds adjust)
10. **Write draft to disk** at `output/draft-{company-slug}.html` — LLMs do not have "working memory" that can hold 400+ lines of HTML reliably (Gemini review Bug #1)
11. **If `--fast` flag:** Tell user "Draft written to `output/draft-{company-slug}.html`" and stop. No reviewer, no backtrack, no PDF.

### Step 2: REVIEWER critiques (fresh-context subagent)

Spawn a subagent (Gemini: `invoke_agent`; Claude: `Agent` tool) with NO access
to the drafter's conversation.

**Pass text content, not HTML.** The reviewer critiques content (tone, keywords,
fabrication), not layout. The drafter extracts the plain text from each filled
placeholder and passes it inline in the reviewer prompt. This eliminates:
- A tool-call roundtrip (subagent reading a file)
- Hundreds of wasted tokens on HTML tags, CSS, and layout divs
- Risk of the subagent getting confused by HTML formatting

**PII guard:** Before passing CV text to the reviewer, strip contact info
(phone number, email address, physical address). The reviewer doesn't need
these to critique tone and keywords, and they prevent accidental PII leakage
if the reviewer's web searches include fragments of the prompt.

**Reviewer prompt — tell the subagent:**
> "Act as a CV Reviewer. Below is the CV text content, JD text, and candidate
> profile. Provide your critique."
>
> [CV text content — plain text, no HTML]
> [JD text]
>
> "Also read `config/profile.yml` and `modes/_profile.md` for candidate data
> and CV Generation Rules."

**Given to reviewer:**
- CV text content (inline in prompt — plain text extracted from filled placeholders)
- JD text (inline in prompt)
- `config/profile.yml` — candidate data (via file read)
- `modes/_profile.md` — behavioral profile, writing style, **CV Generation Rules** (via file read)

**NOT given to reviewer:**
- Raw HTML (reviewer judges content, not layout)
- Template HTML (reviewer judges content, not layout)
- Evaluation report (reviewer forms its own opinion independently)
- `article-digest.md` (reviewer can't verify proof points — drafter's job)
- Candidate contact info (phone, email, address — PII guard)

**Reviewer instructions:**
1. Verify every claim maps to real candidate data (no fabrication)
2. Check keyword coverage — are there JD requirements with no corresponding CV bullet?
3. Assess tone against writing style in `_profile.md`
4. **Verify CV Generation Rules compliance** — check that all "always include" items are present, all "never cut" sections survived, formatting rules respected. Flag violations.
5. Apply the interview backtrack test independently
6. Search the web to verify any company-specific claims (partnerships, products, tech) —
   **search for the company/technology, not the candidate.** Do not include candidate
   name, employer, or personal details in search queries.

**Reviewer output format — markdown descriptions, NOT JSON patches (Gemini review Bug #2):**

LLMs are bad at exact multiline string matches. Asking for JSON `{"old_string": "...",
"new_string": "..."}` fails ~50% of the time due to spacing/indentation/HTML tag mismatches.

Instead, the reviewer outputs:

**Part A — Required edits (markdown list):**
```
1. Under VoltTech Experience, third bullet: change "improved efficiency" to
   "improved conversion efficiency from 92% to 95%" — adds the specific metric
   from cv.md and matches JD's emphasis on efficiency targets.
2. In Summary: add "9 US patents" — required by CV Generation Rules ("always
   include patent count").
```
The drafter applies these using its standard intelligence and the file edit tool.

**Part B — Narrative suggestions** (four mandatory categories, even if "no issues"):
1. Missed keywords — JD terms not reflected in CV
2. Company-specific angles — research-based suggestions
3. Action-oriented reframing — passive → active, vague → specific
4. Tone/style alignment — matches `_profile.md` writing style?

### Step 3: DRAFTER revises

1. Read the reviewer's Part A edits — apply each using the file edit tool on `output/draft-{company-slug}.html`
2. Evaluate Part B suggestions — apply with judgment, skip if they violate the backtrack test
3. **Log the reviewer's critique to the evaluation report:** Append a `## I) CV Tailoring Critique`
   section to `reports/{REPORT_NUM}-{slug}-{date}.md` containing:
   - All Part B suggestions (applied and not applied)
   - For each suggestion the drafter chose NOT to apply: state the reason (e.g., "skipped — violates backtrack test", "skipped — contradicts CV Generation Rules")
   - This makes the critique permanent and co-located with the evaluation, not transient console output
4. WebSearch-verify any new company-specific claims before including
5. Re-check: does the revised draft still fit in 2 pages? If not, apply overflow fallback chain (Section 6).

### Step 4: Review & Confirm (single interaction point)

Present everything the user needs to decide on in ONE prompt — do not split
into multiple sequential pauses (Gemini round 3: merging backtrack + discard
summary eliminates the "double pause" friction).

Print the following to the console as a single block, then STOP and wait:

```
## CV Review & Confirm

### What was included (key additions for this role):
- Added "48V bus architecture" to Summary — direct JD keyword match
- Promoted IEEE Future Energy Challenge to top of Projects — JD values academic collaboration
- Reordered Experience to lead with VoltTech power electronics work

### What was discarded (and why):
- CurrentInnovations "Python scripting for test automation" — not relevant to this hardware design role
- Education coursework details (10+ year old degree) — space constraint, low relevance
- Certification: LabVIEW Associate — not mentioned in JD, cut for space

### Protected by CV Rules (never cut):
- Patent count (9 US patents) — per your "always include" rule
- IEEE publication list — per your "never cut publications" rule

### Flagged rewording (needs your decision):
1. ❓ 'Led PCB thermal analysis' — original: 'Supported PCB thermal review'
2. ❓ 'Designed 48V bus architecture' — original: 'Contributed to bus design'

For flagged items: **Keep**, **Soften**, **Drop**, or provide exact text
(e.g. '2: "Contributed to 48V bus architecture design"').

**Draft HTML:** `output/draft-{company-slug}.html` — you can review or edit
this file directly before I generate the PDF.

Reply with your decisions, request changes, or say "go" to generate the PDF.
```

**STOP. Wait for user response.** This is a conversational interaction — the
user replies naturally (e.g., "1: keep, 2: drop, also add back the Python
bullet") and the agent parses the response with its intelligence.

**If the user provides exact replacement text for any item, use it verbatim** — do
not "improve" or rephrase it. The user knows what they want to say.

If no flagged items: omit the "Flagged rewording" section. The prompt still
includes the discard summary and draft path.

If user says "go" or similar → proceed to Step 5.
If user requests changes → enter Iterative Modification (Step 6).

### Step 5: Generate PDF + Verify

1. Run: `node scripts/generate-pdf.mjs output/draft-{company-slug}.html output/cv-{candidate}-{company}-{date}.pdf`
2. Read the output to verify:
   - Page count (should be 1–2)
   - No orphaned sections (check `generate-pdf.mjs` output for page count)
3. **If overflows 2 pages** — apply ALL CSS fallbacks at once and regenerate ONE time
   (do not loop Playwright — each invocation spins up headless Chromium, 3-8s per run):
   a. Cut the lowest-relevance unprotected bullet
   b. Apply all CSS overrides in a single edit: `--margins: 0.4in`, `--base-font-size: 10pt`, `--bullet-spacing: 0.1em`
   c. Regenerate PDF once
   d. If still overflows: accept 3 pages — tell user why
   **Maximum 2 Playwright invocations total** (initial + one retry).
4. Update `data/applications.md` — set PDF column to ✅
5. Tell user: "CV generated: `output/cv-{candidate}-{company}-{date}.pdf`"
6. Clean up: keep `output/draft-{company-slug}.html` for potential iterative edits

### Step 6: Iterative Modification (user-driven changes)

After the initial generation (Steps 1–5), the user can request further changes
in a conversational loop:

> "Add back the Python scripting bullet"
> "Make the summary longer — I want to mention my thesis topic"
> "Switch to the classic-professional template"
> "Remove the competencies grid, I don't like it"

**During iterative modification, CV Generation Rules can be overridden** — the
user is explicitly directing changes, which takes precedence over standing rules.
For example, if rules say "max 5 bullets per role" but the user says "add a 6th
bullet about X", add it. The user's real-time instruction overrides the standing rule.

**Flow:**
1. Apply the user's requested edit to `output/draft-{company-slug}.html`
2. If template change requested: re-fill the new template with existing content
3. Regenerate PDF (single Playwright invocation)
4. Show updated discard summary if content was added/removed
5. Ask: "Anything else to change?"
6. Repeat until user is satisfied

**No reviewer for iterative edits** — the user IS the reviewer at this point.

### `--fast` / `--draft-only` mode

Bypasses Steps 2–5 entirely. The drafter fills the template (Step 1), writes
the HTML to disk, reports the file path, and exits. No reviewer, no backtrack
test, no PDF generation. For power users who will hand-edit the HTML and run
`node scripts/generate-pdf.mjs` themselves.

---

## 6. Cutting and Overflow Strategy

### Layer 1: Deterministic cuts (always apply first — Gemini review)

Before any LLM-driven scoring, apply these hard rules automatically. This saves
tokens and produces consistent results:

| Rule | Rationale |
|------|-----------|
| Max 5 bullets for most recent role | Prevents bloat in the role with most content |
| Max 3 bullets for roles older than the most recent | Older roles need less detail |
| Hide roles older than 10 years entirely | Unless protected by CV Generation Rules |
| Remove GPA for degrees older than 5 years | Low value signal after early career |
| Collapse coursework into a single line | Rarely relevant for experienced candidates |

**Exception:** Any item protected by `_profile.md → CV Generation Rules` is exempt
from deterministic cuts. "Never cut" wins.

### Layer 2: Relevance-weighted cutting (LLM-driven, if still overflowing)

After deterministic cuts, if content still exceeds 2 pages, score each remaining
line on 3 axes:

| Axis | Weight | What it measures |
|------|--------|-----------------|
| **Relevance** | High | Does this line match a JD keyword, tool, or responsibility? |
| **Uniqueness** | Medium | Is this claim made elsewhere in the CV? Redundant lines cut first. |
| **Narrative load** | Low | Does the cover letter or Block F story depend on this line? |

Cut the lowest-total-score line first. Repeat until content fits.

**Cut priority (least painful → last resort):**
1. Redundant entries across sections (same achievement mentioned twice)
2. Profile-statement filler ("passionate about", "results-oriented")
3. Low-relevance experience bullets from any section
4. Low-relevance certifications, languages, minor publications
5. Structural cuts (collapse sections, remove section headers)

**Key rule:** An older-role bullet that hits JD keywords survives over a recent-role
bullet that does not. Relevance beats recency.

### Layer 3: CSS fallback chain (if still overflowing after content cuts)

If content cuts alone don't achieve 2 pages (e.g., too many protected items):

1. Reduce `--margins` from `0.5in` to `0.4in`
2. Reduce `--base-font-size` from `11pt` to `10pt`
3. Reduce `--bullet-spacing` from `0.15em` to `0.1em`
4. If still overflows: accept 3 pages — tell user why ("your CV Generation Rules
   protect more content than fits in 2 pages at readable font sizes")

---

## 7. Interview Backtrack Test

Applied to every bullet in the generated CV. Three zones:

| Zone | Rule | Example |
|------|------|---------|
| **OK** | Reordering, natural synonyms, emphasizing one facet of a broad role | "Built" → "Developed"; emphasizing the ML aspect of a data engineering role |
| **Flag** | Merging academic + industry into industry-sounding claim; using JD's exact terminology for adjacent work | "Designed PCBs" when actual work was "reviewed PCB designs" → Flag, present to user: "keep, soften, or drop?" |
| **Never** | Fabricating experience or implying work in an untouched domain | Adding "Kubernetes" when candidate has never used it |

**Enforcement:** After filling all placeholders and before PDF generation, scan every
bullet. Any "Flag" items are collected and presented to the user with the choice to
keep, soften, or drop. "Never" items are silently removed and logged.

---

## 8. Files to Create / Modify

### New files

| File | Lines (est.) | Description |
|------|-------------|-------------|
| `modes/cv.md` | ~300 | CV generation mode — template selection, drafter, reviewer spawn, revision, discard summary, iterative modification, PDF generation, backtrack test, cutting logic |
| `scripts/generate-pdf.mjs` | ~183 | Port from career-ops — no changes needed |
| `templates/cv/ats-optimized.html` | ~420 | Template 1 — port from career-ops. Add CSS variables for overflow fallbacks. |
| `templates/cv/classic-professional.html` | ~350 | Template 2 — new, conservative serif. CSS variables included. |
| Font files for Template 2 | varies | Source Serif Pro + Inter woff2 files |
| *(Templates 3-4 deferred to Phase 2b)* | | |

### Existing files to update

| File | Change |
|------|--------|
| `templates/cv/manifest.yml` | Populate with all 4 templates (currently has placeholders) |
| `.agents/skills/career-scout/SKILL.md` | Add `cv` mode routing — `_shared.md` + `cv.md` |
| `GEMINI.md` | Add cv mode trigger to routing table |
| `modes/evaluate.md` Block E | Add: "To generate a tailored CV, run `cv` mode" suggestion for GOOD_FIT+ scores |
| `modes/_profile.md` | Add `## CV Generation Rules` section template (empty, user fills in) |
| `modes/setup.md` | Add optional step after Writing Style: ask user for CV generation preferences |
| `README.md` | Add CV Generation section: how to set rules, how to update them, how to run cv mode |

---

## 9. Implementation Steps + Verification

### Step 1: Port `generate-pdf.mjs` and fonts

Copy `generate-pdf.mjs` from career-ops to `scripts/`. Copy `fonts/` directory.
Verify the script runs and produces a PDF from a test HTML file.

**Verify:**
```bash
echo '<html><body><h1>Test</h1></body></html>' > /tmp/test.html
node scripts/generate-pdf.mjs /tmp/test.html /tmp/test.pdf
# Should produce a 1-page PDF
```

**Prerequisite check:** `npx playwright install chromium` (if not already installed).

### Step 2: Port Template 1 (ATS-Optimized)

Copy `cv-template.html` from career-ops to `templates/cv/ats-optimized.html`.
Remove career-ops-specific comments. Ensure all placeholders use the standard vocabulary.

**Verify:** Fill placeholders with mock data by hand, run `generate-pdf.mjs`,
inspect the output PDF visually.

### Step 3: Create Template 2 (Classic Professional)

Design the conservative serif template:
1. Write HTML/CSS with the same placeholder vocabulary and CSS variables
2. Source and add Source Serif Pro + Inter woff2 font files to `fonts/`
3. Test with mock data via `generate-pdf.mjs`
4. Verify ATS compatibility: single text flow in DOM order, no tables for layout

**Verify:** Generate a PDF, copy-paste all text into a text editor. If garbled or
out of order, the template fails ATS parsing.

*(Templates 3-4 deferred to Phase 2b — prove the pipeline with 2 templates first.)*

### Step 4: Update `templates/cv/manifest.yml`

Populate the manifest with all 4 templates, including: name, file path, description,
best-for use case, required fonts.

**Verify:** Read manifest programmatically — all 4 templates resolve to existing HTML files.

### Step 5: Create `modes/cv.md`

Write the full CV generation mode with:
- Template selection logic (override → archetype mapping → default)
- Drafter workflow (placeholder filling, keyword injection, cutting, backtrack test)
- Reviewer spawn (fresh-context, JSON edits + narrative feedback)
- Revision and PDF generation steps
- Intent-based tool instructions (no CLI-specific tool names)

**Verify:** Read the file. Confirm no CLI-specific tool names. Confirm drafter-reviewer
is conditional on score ≥ 80. Confirm backtrack test is applied.

### Step 6: Update SKILL.md, GEMINI.md, evaluate.md

- SKILL.md: add `cv` mode to routing and context loading (reads `_shared.md` + `cv.md`)
- GEMINI.md: add `cv` trigger to mode routing table
- evaluate.md Block E: add suggestion to run `cv` mode for GOOD_FIT+ evaluations

**Verify:** Invoke `/career-scout cv` — should load the correct files.

### Step 7: End-to-end test

1. Evaluate a real job posting (Phase 1 flow)
2. Run `cv` mode for that evaluation
3. Verify: template selected correctly, draft HTML written to `output/draft-*.html`
4. Verify: reviewer subagent spawned (if GOOD_FIT+), returned markdown edits
5. Verify: discard summary shown with included/discarded/protected items
6. Verify: PDF generated in `output/`, applications.md updated with ✅
7. Open the PDF — check layout, fonts, content accuracy, 2-page target
8. Copy-paste PDF text into editor — verify ATS readability
9. Test iterative modification: request a change, verify PDF regenerated

### Step 8: Template comparison test

Generate a CV for the same JD with both templates (ats-optimized and classic-professional).
Compare:
- ATS text extraction works for both
- Visual design matches the template's intended audience
- Same content, different presentation
- CSS variables (margins, font size) are consistent

---

## 10. Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Playwright not installed on user's machine | HIGH | Check in Step 0 of cv.md. If missing, tell user to run `npx playwright install chromium`. Do not silently fail. |
| Font files missing for Templates 2-4 | MEDIUM | Download during implementation. Include in commit. Manifest validates font paths. |
| Reviewer agent not available (Gemini subagent support) | MEDIUM | Make reviewer step conditional: if subagent spawn fails, fall back to single-pass with a note. |
| 2-page overflow after cutting | LOW | Cutting heuristic is aggressive. If still overflows: reduce margins slightly (0.5in), then font size (10pt → 9.5pt). Document the fallback chain. |
| Template HTML breaks on edge-case Unicode | LOW | `generate-pdf.mjs` ATS normalization handles this. Verified in career-ops across 100+ CVs. |
| Drafter-reviewer adds latency (~30-60s extra) | LOW | Only activates for GOOD_FIT+ (≥80). Worth the quality improvement for high-value applications. |

---

## 11. LLM-Physics Considerations

Lessons from Phase 1 applied here:

1. **Data gathering before output.** The cv.md mode must read all input files
   (template HTML, cv.md, _profile.md, evaluation report, JD text) before writing
   any filled HTML content. Same pattern as evaluate.md Step 0.

2. **Reviewer is a separate agent, not an "internal pass."** The reviewer must be
   a genuinely separate subagent spawn with its own context window. Asking the same
   agent to "pretend to be a reviewer" doesn't produce independent critique.

3. **Backtrack test requires user interaction for "Flag" items.** The mode must
   STOP and present flagged items to the user before generating the PDF. Same state
   machine pattern as setup.md's Golden Examples.

4. **Template filling is deterministic work.** Don't ask the LLM to "fill the template" —
   give it explicit instructions for each placeholder. `{{SUMMARY}}` = "rewrite
   professional summary using archetype framing + top 5 JD keywords." etc.

5. **Keyword relevance ≠ strategic relevance.** A bullet can match JD keywords yet
   contradict the positioning strategy from Block C. Example: management achievements
   match "cross-functional leadership" keywords but must be suppressed during a downlevel
   strategy. The positioning strategy is a hard constraint that overrides keyword scoring.

6. **Heavy tools are not loop conditions.** Playwright spins up headless Chromium
   (3-8s per invocation). Using it in a retry loop (generate → check → tweak → generate)
   burns 30+ seconds. Apply all fixes in one pass and regenerate once. Maximum 2
   invocations: initial + one retry.

---

## 12. Gemini Review Log

**Reviewer:** Gemini CLI — Phase 2 review (2026-05-15)

| # | Finding | Type | Decision | Fix |
|---|---------|------|----------|-----|
| 1 | **Subagent support confirmed:** Gemini CLI supports `invoke_agent`. Drafter-reviewer architecture fully validated. | **Answer** | Confirmed | No change needed |
| 2 | **Font licensing confirmed:** OFL fonts safe to include in git repo. | **Answer** | Confirmed | No change needed |
| 3 | **Start with 2 templates:** 4 simultaneous templates + drafter-reviewer debugging = too much surface area. | **Recommendation** | **Accepted** | Templates 3-4 deferred to Phase 2b. Section 3 updated. |
| 4 | **Add deterministic cutting layer:** LLM-only cutting is token-expensive and inconsistent. Hard rules first. | **Recommendation** | **Accepted** | Section 6 rewritten with 3 layers: deterministic → relevance-weighted → CSS fallback |
| 5 | **Bug: "Working Memory" trap:** Draft HTML can't be held in LLM memory and passed inline to subagent. | **LLM-physics bug** | **Accepted** | Draft written to disk (`output/draft-{slug}.html`). Reviewer reads from disk via file tool. |
| 6 | **Bug: JSON find-and-replace fantasy:** LLMs can't produce exact multiline string matches for JSON patches. | **LLM-physics bug** | **Accepted** | Reviewer outputs markdown edit descriptions. Drafter applies with intelligence + edit tool. |
| 7 | **Bug: Sequential backtrack flag loop:** Asking 4 sequential yes/no questions is a state machine nightmare. | **LLM-physics bug** | **Accepted** | All flags presented in one batch interaction. User responds once. |
| 8 | **Bug: "Fix HTML issues" too vague:** LLM can't reliably "make it shorter" on raw HTML. | **LLM-physics bug** | **Accepted** | CSS variables added to templates. 3-step deterministic fallback chain (margins → font size → spacing). |
| 9 | **CV Rules need absolute precedence preamble:** LLM's 2-page rule may override user's "never cut" rules. | **Refinement** | **Accepted** | Step 1: CV Generation Rules explicitly stated as ABSOLUTE, override page limit if needed. |

**User additions (2026-05-15):**

| # | Feature | Description |
|---|---------|-------------|
| 10 | **Narrow margins by default** | CSS variable `--margins: 0.5in` (was 0.6in in career-ops). Maximizes content space. |
| 11 | **Discard summary** | Step 5: after generation, show what was included, what was discarded with reasons, and what was protected by CV Rules. User reviews before PDF. |
| 12 | **Iterative modification** | Step 7: after initial generation, user can request changes in a conversational loop. CV Rules can be overridden during user-directed modifications — user's real-time instruction takes precedence. |

**Gemini round 2 review (2026-05-15):**

| # | Finding | Type | Decision | Fix |
|---|---------|------|----------|-----|
| 13 | **Block C positioning strategy not enforced by drafter.** Keywords matching management achievements could surface during downlevel strategy, contradicting Block C. | **Logic bug** | **Accepted** | Step 1 action 4: Block C positioning is a hard constraint. Keyword-matching bullets that contradict the positioning strategy are cut, not promoted. |
| 14 | **Reviewer Part B critique is transient.** Console output lost after session. Separate file is messy. | **Design gap** | **Accepted (Gemini's fix)** | Append `## I) CV Tailoring Critique` to the existing evaluation report. All intelligence in one permanent file. |
| 15 | **"Soften" is a black box.** User can't provide exact replacement text during backtrack interaction. | **UX gap** | **Accepted** | Backtrack prompt updated: user can provide exact text. Drafter uses it verbatim. |
| 16 | **Draft path not communicated.** User doesn't know they can edit `output/draft-*.html` directly. | **UX gap** | **Accepted** | Step 5 discard summary explicitly states the draft file path. |
| 17 | **Archetype-scoped CV Rules.** Per-archetype rule filtering (e.g., PM rules vs. Engineering rules). | **Feature request** | **Rejected** | Over-engineering. Global rules cover 80% case. Iterative modification handles the rest. Users can naturally scope with markdown headers if they want — no new logic needed. |
| 18 | **"Draft Intercept" mandatory pause.** Third formal interaction point for manual HTML editing. | **Feature request** | **Rejected** | Draft already on disk. Two interaction points (Step 4, Step 5) already exist. Step 7 handles post-generation edits. Adding a third pause is friction without value. |
| 19 | **Report format rigidity.** LLM improvised format in simulation. | **Concern** | **Already covered** | evaluate.md report template is a rigid markdown code block. Runtime compliance issue, not a plan gap. |

**Gemini round 3 review (2026-05-15):**

| # | Finding | Type | Decision | Fix |
|---|---------|------|----------|-----|
| 20 | **Playwright Loop of Death.** CSS fallback chain triggers 3-4 Playwright invocations (3-8s each = 30s staring at spinner). | **System-physics bug** | **Partially accepted** | Collapsed to single retry: apply all CSS fallbacks at once, regenerate once. Max 2 Playwright invocations. Rejected auto-resize observer (unpredictable font sizing). |
| 21 | **Subagent HTML token waste.** Reviewer reads 400+ lines of HTML when it only needs ~150 lines of text content. Extra tool-call roundtrip. | **Optimization** | **Accepted** | Drafter passes plain text content inline in reviewer prompt (same pattern as JD text). Saves tokens and eliminates file-read turn. |
| 22 | **Subagent PII leak.** Reviewer does web searches with CV text in context — could leak candidate name/employer to search engines. | **Security concern** | **Partially accepted** | Strip contact info (phone, email, address) from reviewer input. Reviewer web searches must target company/technology, not candidate. |
| 23 | **Double pause friction.** Backtrack test (Step 4) and discard summary (Step 5) are two pauses in 10 seconds. | **UX issue** | **Accepted** | Merged into single "Review & Confirm" step. One conversational prompt, one response. |
| 24 | **`--fast` flag.** Power users want to skip reviewer/backtrack/PDF and just get the HTML draft. | **Feature request** | **Accepted** | Added `cv --fast` mode. Drafter fills template, writes HTML, exits. Simple conditional branch. |
| 25 | **Market-specific date/spelling formatting.** DACH uses DD.MM.YYYY, US uses MM/YYYY, etc. | **Functional gap** | **Accepted** | Step 1 action 5: check profile.yml market key, apply locale-aware formatting to dates and spelling. |
| 26 | **ask_user tool for batch interaction.** Structured choice tool can't handle mixed responses. | **Concern** | **Already covered** | Plan uses CLI-agnostic conversational language, not structured tools. No change needed. |
| 27 | **Grouped edits for file I/O.** Applying Part A edits one-by-one is slow. | **Optimization** | **Rejected (plan level)** | Implementation detail for modes/cv.md, not a plan-level decision. Plan is CLI-agnostic. |
| 28 | **Part B persistence confirmation.** Ensure critique is appended to report, not just console. | **Concern** | **Already done (v2.1)** | Step 3 item 3 already appends `## I) CV Tailoring Critique` to evaluation report. |
| 29 | **Shadow CV / `--source` flag.** Support multiple master CV files per archetype. | **Feature request** | **Rejected (Phase 2)** | Scope creep. One `cv.md` is enough. Users can rename files or edit cv.md. Consider for Phase 2b+. |

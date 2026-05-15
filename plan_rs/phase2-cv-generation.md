# Phase 2: CV Generation — Multi-Template + Drafter-Reviewer

**Version:** 1.0
**Last Updated:** 2026-05-15 -- initial draft for Gemini review
**Parent Plan:** CONSOLIDATION-PLAN.md, Section 11, Phase 2
**Depends on:** Phase 1 (evaluate mode — produces the scoring and gap analysis that drive CV tailoring)

---

## 1. Context

Phase 1 established the evaluation pipeline: the user pastes a JD, gets a 7-block
analysis with scoring, gap analysis, and personalization recommendations (Block E).

Phase 2 turns Block E's recommendations into an actual tailored CV PDF. Two major
enhancements over career-ops:

1. **Multi-template support** — 4 HTML templates selectable by archetype or user override
   (career-ops had one template)
2. **Drafter-reviewer workflow** — for GOOD_FIT+ (≥80), a fresh-context reviewer agent
   critiques the draft before PDF generation (from ai-job-search, career-ops didn't have this)

---

## 2. What to Reuse from Source Projects

### From career-ops (direct port, minimal changes)

| Component | File | Change needed |
|-----------|------|---------------|
| `generate-pdf.mjs` | 183 lines — HTML→Playwright→PDF | **None.** Script is template-agnostic (takes `<input.html> <output.pdf>`). ATS normalization, font rewriting, and page counting are all reusable as-is. |
| `fonts/` (Space Grotesk + DM Sans) | 4 woff2 files | **None** for Template 1. Other templates need their own fonts. |
| `cv-template.html` | 419 lines — ATS single-column | Becomes Template 1. Remove any career-ops-specific examples in comments. Add `{{TEMPLATE_ID}}` metadata tag. |
| `templates/cv/manifest.yml` | Already scaffolded | Populate with 4 templates + metadata |
| Placeholder system | `{{NAME}}`, `{{EXPERIENCE}}`, etc. | **Reuse as-is.** All templates share the same placeholder vocabulary. |

### From ai-job-search (adapt patterns, not code)

| Component | What to take | How to adapt |
|-----------|-------------|--------------|
| Drafter-reviewer 2-agent workflow | Reviewer is fresh-context, receives draft + JD + profile only | Implement via subagent spawn (CLI-agnostic). Reviewer returns JSON edits + narrative suggestions. |
| Interview backtrack test | 3-zone rule (OK / Flag / Never) | Port the rule verbatim into `modes/cv.md`. Apply to every generated bullet. |
| Relevance-weighted cutting | Score each line: relevance + uniqueness + narrative load | Port the scoring heuristic and cut priority order into `modes/cv.md`. |

---

## 3. Template Design

### Shared across all templates

- Same `{{PLACEHOLDER}}` vocabulary — `{{NAME}}`, `{{SUMMARY}}`, `{{COMPETENCIES}}`, `{{EXPERIENCE}}`, `{{PROJECTS}}`, `{{EDUCATION}}`, `{{SKILLS}}`, `{{CERTIFICATIONS}}`
- Same `generate-pdf.mjs` pipeline (ATS normalization, font loading, PDF generation)
- Same CSS rules: `break-inside: avoid`, `orphans: 2`, `widows: 2`, print color-adjust
- Target: 2 pages max. If overflow, apply relevance-weighted cutting.

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

### Template 3: Academic/Research (new)

- **Design:** Publications-forward layout. Education near top. Research experience before industry. Conference presentations and DOI links styled.
- **Best for:** Research, academic, R&D lab, PhD-heavy roles
- **Fonts:** EB Garamond (heading + body) — academic tone
- **File:** `templates/cv/academic-research.html`
- **Differentiation:** Publications section with journal, year, DOI. "Selected Talks" section. Thesis title visible. Skills as a compact tag grid rather than a full section.

### Template 4: Technical/Engineering (new)

- **Design:** Project-forward layout. Competency grid prominent. Monospace accents for technical terms. Skills organized by category.
- **Best for:** IC engineering, embedded, hardware, systems, DevOps, SRE
- **Fonts:** JetBrains Mono (code/skills) + Inter (body) — technical aesthetic
- **File:** `templates/cv/technical-engineering.html`
- **Differentiation:** Prominent skills grid with categories (Languages, Tools, Domains). Project cards with metrics. GitHub/portfolio links styled. No color — clean engineering aesthetic.

### Template Selection Logic

```
1. Check: does the evaluation report specify a template override? (per-evaluation)
2. Check: does profile.yml → cv.template_overrides have a mapping for the detected archetype?
3. Fall back to profile.yml → cv.default_template (default: "ats-optimized")
```

---

## 4. The Drafter-Reviewer Workflow

### When it activates

- **Composite score ≥ 80 (GOOD_FIT+):** Full drafter-reviewer workflow
- **Composite score 65–79 (PARTIAL_MATCH):** Single-pass generation (no reviewer). Worth generating a CV but not worth the extra agent cost.
- **Composite score < 65:** No CV generated. Block E recommendations only.

### Step 1: DRAFTER generates tailored CV

The drafter (main agent) has full context: evaluation report, `cv.md`, `_profile.md`,
`article-digest.md`, JD text, detected archetype.

Actions:
1. Select template (per selection logic above)
2. Read the template HTML file
3. Extract 15–20 ATS keywords from the JD
4. For each `{{PLACEHOLDER}}`:
   - `{{SUMMARY}}`: Rewrite professional summary using archetype framing, inject top 5 keywords
   - `{{COMPETENCIES}}`: Build grid from JD requirements mapped to candidate skills
   - `{{EXPERIENCE}}`: Reorder bullets by JD relevance. Inject keywords into first bullet of each role.
   - `{{PROJECTS}}`: Select top 3–4 projects by JD relevance
   - `{{SKILLS}}`: Reorder by JD match, add any JD-mentioned tools the candidate has
5. Apply relevance-weighted cutting if content exceeds 2 pages
6. Apply interview backtrack test to every generated bullet
7. Hold the filled HTML in working memory (no disk write yet)

### Step 2: REVIEWER critiques (fresh-context agent)

Spawn a subagent with NO access to the drafter's conversation. The reviewer receives
only these inputs, inline in its prompt:

**Given to reviewer:**
- The complete draft HTML text
- The JD text (full)
- `config/profile.yml` candidate data
- `modes/_profile.md` behavioral profile and writing style

**NOT given to reviewer:**
- Template HTML (reviewer judges content, not layout)
- Evaluation report (reviewer forms its own opinion)
- `article-digest.md` (reviewer can't verify proof points — drafter's job)

**Reviewer instructions:**
1. Verify every claim maps to real candidate data (no fabrication)
2. Check keyword coverage — are there JD requirements with no corresponding CV bullet?
3. Assess tone against writing style in `_profile.md`
4. Apply the interview backtrack test independently
5. Search the web to verify any company-specific claims (partnerships, products, tech)

**Reviewer output format (two parts in one response):**

**Part A — Structured edits:**
```json
[
  {"old_string": "exact text from draft", "new_string": "replacement", "reason": "why"}
]
```
Drafter applies these mechanically.

**Part B — Narrative suggestions** (four mandatory categories, even if "no issues"):
1. Missed keywords — JD terms not reflected in CV
2. Company-specific angles — research-based suggestions
3. Action-oriented reframing — passive → active, vague → specific
4. Tone/style alignment — matches `_profile.md` writing style?

### Step 3: DRAFTER revises

1. Apply Part A edits directly (find-and-replace in HTML)
2. Evaluate Part B suggestions — apply with judgment, skip if they violate the backtrack test
3. WebSearch-verify any new company-specific claims before including
4. Re-check: does the revised CV still fit in 2 pages? Re-cut if needed.

### Step 4: Generate PDF + Verify

1. Write the finalized HTML to a temp file: `output/temp-{company}-{date}.html`
2. Run: `node scripts/generate-pdf.mjs output/temp-{company}-{date}.html output/cv-{candidate}-{company}-{date}.pdf`
3. Read the PDF to verify layout:
   - Page count (should be 1–2)
   - No orphaned sections
   - Fonts rendered correctly
   - No blank pages
4. If broken: fix HTML issues, regenerate, re-verify
5. Delete temp HTML file
6. Update `data/applications.md` — set PDF column to ✅
7. Tell user: "CV generated: `output/cv-{candidate}-{company}-{date}.pdf`"

---

## 5. Relevance-Weighted Cutting

When the filled CV exceeds 2 pages, score each content line on 3 axes:

| Axis | Weight | What it measures |
|------|--------|-----------------|
| **Relevance** | High | Does this line match a JD keyword, tool, or responsibility? |
| **Uniqueness** | Medium | Is this claim made elsewhere in the CV? Redundant lines cut first. |
| **Narrative load** | Low | Does the cover letter or Block F story depend on this line? |

**Cut priority (least painful → last resort):**
1. Redundant entries across sections (same achievement mentioned twice)
2. Profile-statement filler ("passionate about", "results-oriented")
3. Low-relevance experience bullets from any section
4. Low-relevance certifications, languages, minor publications
5. Oldest education details (GPA, coursework for 10+ year old degrees)
6. Structural cuts (collapse sections, remove section headers)

**Key rule:** An older-role bullet that hits JD keywords survives over a recent-role
bullet that does not. Relevance beats recency.

---

## 6. Interview Backtrack Test

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

## 7. Files to Create / Modify

### New files

| File | Lines (est.) | Description |
|------|-------------|-------------|
| `modes/cv.md` | ~250 | CV generation mode — template selection, drafter, reviewer spawn, revision, PDF generation, backtrack test, cutting logic |
| `scripts/generate-pdf.mjs` | ~183 | Port from career-ops — no changes needed |
| `templates/cv/ats-optimized.html` | ~420 | Template 1 — port from career-ops |
| `templates/cv/classic-professional.html` | ~350 | Template 2 — new, conservative serif |
| `templates/cv/academic-research.html` | ~380 | Template 3 — new, publications-forward |
| `templates/cv/technical-engineering.html` | ~360 | Template 4 — new, project-forward |
| Font files for Templates 2-4 | varies | Source Serif Pro, EB Garamond, JetBrains Mono, Inter woff2 files |

### Existing files to update

| File | Change |
|------|--------|
| `templates/cv/manifest.yml` | Populate with all 4 templates (currently has placeholders) |
| `.agents/skills/career-scout/SKILL.md` | Add `cv` mode routing — `_shared.md` + `cv.md` |
| `GEMINI.md` | Add cv mode trigger to routing table |
| `modes/evaluate.md` Block E | Add: "To generate a tailored CV, run `cv` mode" suggestion for GOOD_FIT+ scores |

---

## 8. Implementation Steps + Verification

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

### Step 3: Create Templates 2-4

Design each template HTML. For each:
1. Write HTML/CSS with the same placeholder vocabulary
2. Source and add the required woff2 font files to `fonts/`
3. Test with mock data via `generate-pdf.mjs`
4. Verify ATS compatibility: single text flow in DOM order, no tables for layout,
   no images replacing text

**Verify per template:** Generate a PDF, copy-paste all text from the PDF into
a text editor. If the text is garbled or out of order, the template fails ATS parsing.

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
3. Verify: template selected correctly, HTML filled, drafter-reviewer ran (if GOOD_FIT+),
   PDF generated in `output/`, applications.md updated with ✅
4. Open the PDF — check layout, fonts, content accuracy, 2-page max
5. Copy-paste PDF text into editor — verify ATS readability

### Step 8: Template comparison test

Generate a CV for the same JD with all 4 templates. Compare:
- ATS text extraction works for all 4
- Visual design matches the template's intended audience
- Same content, different presentation — no content leakage between templates

---

## 9. Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Playwright not installed on user's machine | HIGH | Check in Step 0 of cv.md. If missing, tell user to run `npx playwright install chromium`. Do not silently fail. |
| Font files missing for Templates 2-4 | MEDIUM | Download during implementation. Include in commit. Manifest validates font paths. |
| Reviewer agent not available (Gemini subagent support) | MEDIUM | Make reviewer step conditional: if subagent spawn fails, fall back to single-pass with a note. |
| 2-page overflow after cutting | LOW | Cutting heuristic is aggressive. If still overflows: reduce margins slightly (0.5in), then font size (10pt → 9.5pt). Document the fallback chain. |
| Template HTML breaks on edge-case Unicode | LOW | `generate-pdf.mjs` ATS normalization handles this. Verified in career-ops across 100+ CVs. |
| Drafter-reviewer adds latency (~30-60s extra) | LOW | Only activates for GOOD_FIT+ (≥80). Worth the quality improvement for high-value applications. |

---

## 10. LLM-Physics Considerations

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

---

## 11. Questions for Gemini Review

1. **Subagent support:** Can Gemini CLI spawn a subagent for the reviewer step?
   If not, what's the best fallback — a second `gemini -p` call, or a structured
   self-review in the same context?

2. **Font licensing:** Source Serif Pro, EB Garamond, JetBrains Mono, and Inter are
   all open-source (OFL). Confirm this is compatible with including woff2 files in
   a git repo.

3. **Template complexity:** Is 4 templates the right number for Phase 2? Or should
   we ship 2 (ATS + one alternative) and add the others in a follow-up?

4. **Cutting heuristic:** The relevance-weighted cutting is LLM-driven (scoring each
   line's relevance). Should any of this be deterministic (e.g., always cut lines
   older than 10 years first)?

5. **Anything missing from the drafter-reviewer flow?** Does the interaction pattern
   between drafter and reviewer look correct for Gemini CLI's tool model?

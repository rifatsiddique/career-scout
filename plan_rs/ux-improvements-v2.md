# Plan: UX Improvements v2

**Version:** 3.1
**Date:** 2026-05-24
**Status:** Locked — Gemini review rounds 1 + 2 incorporated; ready for implementation
**Author:** Claude Sonnet 4.6

**Changelog:**
- v3.1 (2026-05-24): Gemini round 2 incorporated. Both push-backs approved. Resolutions
  for Q1-Q4: ship as one unified batch; `.feature-hints.json` registered as system layer;
  PERFECT_MATCH threshold lowered from 90 to 85 (captures upper-tier GOOD_FIT); added
  `.warning-block` CSS in viewer.html + cv-compare.mjs emits inline `<div>` wrapper for
  ⚠️ blocks (CSS-styled fabrication highlight).
- v3.0 (2026-05-24): Gemini round 1 incorporated. Improvement 5 rewritten — high-fidelity
  programmatic DOCX via `docx` npm package (no pandoc, no html-to-docx). ATS normalization
  refactored to shared module. Added §6 (UX hints — conservative pattern, not aggressive
  promotion). Open Questions replaced with Resolved Decisions. Jaccard threshold made
  configurable. Honest scope-setting on DOCX fidelity (high but not pixel-perfect).
- v2.0 (2026-05-23): Senior engineer self-review. Moved AI-prone work into scripts.
  New helpers: cv-compare.mjs, audit-contact.mjs. Script-emits-URI pattern for links.
- v1.0 (2026-05-23): Initial draft.

Five improvements based on user testing feedback from Gemini CLI ("antigravity") sessions.

This plan is written with one principle in mind: **do not ask the LLM to do work that
a script can do deterministically**. Every place where the AI is currently "supposed to"
remember a rule, fill a field correctly, or compute a derivation by hand is a place where
the AI will eventually fail. Move that work to scripts; let the AI orchestrate.

---

## Overview

| # | Improvement | Priority | Effort | Strategy |
|---|-------------|----------|--------|----------|
| 1 | Clickable file links (Bug A revisit — didn't work) | P0 | Low | Scripts print canonical URI; AI just relays |
| 2 | Side-by-side CV comparison | P1 | Medium | Deterministic diff via `cv-compare.mjs` + AI fills only paragraph diffs |
| 3 | HTML for evaluation reports by default | P1 | Low | Reuse md-to-html.mjs pattern |
| 4 | Contact info vetting — no fabrication | P0 | Low | Early validation + post-gen deterministic audit |
| 5 | DOCX export (opt-in, high-fidelity) | P2 | Medium-Large | Programmatic `docx` builder reading CSS tokens; visually mirrors PDF |
| 6 | Contextual UX hints (added v3) | P2 | Low | Tier-2 P3 nudge (PERFECT_MATCH only) + Tier-3 first-time hint |

---

## Improvement 1: Clickable File Links — Bug A Revisit

### Why the previous fix failed

The Phase 4 fix added a rule to `_shared.md` P1 saying "derive PROJECT_ROOT from a file
you already read or wrote; print as `file:///{root}/{rel}`." This is a **two-step
derivation** the LLM has to do at output time, hundreds of lines after the rule was last
seen, while it is mid-stream emitting the final response.

This is the worst possible design for LLM reliability:

1. **Recall the rule** (ambient context, prone to omission)
2. **Derive the project root** from a path it wrote earlier (requires correct path arithmetic)
3. **Construct the URI** with correct slash direction (Windows path → forward slashes)
4. **Format it correctly** for the specific terminal (`file:///` vs bare path)

Every step is a place to fail. And the user said it does, in Gemini CLI / Antigravity.

### Fix: Move the work out of the LLM

The scripts already know the absolute path of the file they wrote (it's a parameter or
a derived path inside the script). **Have the scripts print the canonical clickable URI
on stdout, in a structured format the AI relays verbatim.**

`md-to-html.mjs` already does this:

```js
console.log(`✅ HTML written: ${outPath}`);
console.log(`📂 Open: file:///${outPath.replace(/\\/g, '/')}`);
```

Do the same in `generate-pdf.mjs`, `generate-docx.mjs`, and any future writer scripts.
Format the output so it is unambiguous and the AI knows to surface it.

#### Standard stdout format for all writer scripts

```
✅ {ARTIFACT_TYPE} written: {abs_path_native_slashes}
📂 Open: file:///{abs_path_forward_slashes}
```

Examples:
```
✅ PDF written: C:\Work\Git-Python\career-scout\output\cv-acme-2026-05-23.pdf
📂 Open: file:///C:/Work/Git-Python/career-scout/output/cv-acme-2026-05-23.pdf
```

#### LLM-side instruction (minimal, at every output block)

```
After running any writer script (generate-pdf.mjs, md-to-html.mjs, generate-docx.mjs),
the script's stdout contains a line starting with "📂 Open: file:///...". Surface this
line verbatim in your output. Do NOT reconstruct the URI yourself. Do NOT print a
relative path next to it. If the line is missing from script output, report the script
failed and ask the user to check.
```

This collapses 4 steps of LLM work into 1: copy a line from script output.

### What about modes that write files directly (no script)?

Modes that write `.md` files using the AI's file-write tool (e.g., evaluate.md writes a
report `.md`, interview-prep.md writes a prep `.md`) should follow this rule:

1. Write the `.md` file (uses an absolute path passed to the write tool)
2. **Immediately run `md-to-html.mjs` on that file** (this is also Improvement 3)
3. Surface the script's "📂 Open: ..." line for the `.html`
4. Then add `(Markdown source: {rel_path})` on a second line if useful

This way, every user-facing artifact goes through a script that prints its own URI. The
AI is never asked to construct a `file:///` URI from path arithmetic.

### Belt-and-suspenders for terminals that don't auto-link

Some terminals (older Windows cmd, some SSH sessions) don't make `file:///` URIs
clickable. To maximize compatibility, print BOTH formats on adjacent lines:

```
📂 Open: file:///C:/Work/Git-Python/career-scout/output/cv-acme-2026-05-23.pdf
   Path: output/cv-acme-2026-05-23.pdf
```

VS Code's integrated terminal makes relative paths clickable (Ctrl+Click). Windows
Terminal and most modern terminals make `file:///` clickable. Printing both costs nothing.

### Files to change

| File | Change |
|------|--------|
| `scripts/generate-pdf.mjs` | After writing PDF, print the standard stdout format |
| `scripts/generate-docx.mjs` | New (Improvement 5) — print standard format on success |
| `scripts/md-to-html.mjs` | Already does it — verify format matches the standard |
| `modes/_shared.md` | Replace P1 with simplified rule: "Scripts print URIs; relay verbatim" |
| `modes/cv.md` | Output block: relay script output verbatim |
| `modes/evaluate.md` | Same — and run md-to-html.mjs (Improvement 3) on report.md to get the URI |
| `modes/interview-prep.md` | Verify md-to-html.mjs output is relayed (already does this) |
| `modes/deep.md` | Same |
| `modes/scan.md` | pipeline.md is AI-written; have the mode run md-to-html.mjs on it OR just print relative path (skim use, not browsable) |

### Tests

- T1.1: Run `cv` → terminal contains a line starting `📂 Open: file:///`
- T1.2: Same line in `evaluate`, `interview-prep`, `deep`
- T1.3: Ctrl+Click the URI in VS Code terminal → opens the file in associated app
- T1.4: In a terminal without link detection (e.g., raw cmd.exe), the relative path is
  still visible and copy-pasteable
- T1.5: No relative-only paths appear in user-facing output blocks

### Failure modes considered

| Failure | Mitigation |
|---------|-----------|
| Script fails silently → no URI to relay | Scripts exit non-zero on failure; AI reports error |
| Path contains spaces | `file:///` URIs handle spaces fine in modern terminals; if issue arises, %20-encode in script |
| Windows path with `C:\` printed instead of `C:/` | Scripts always convert to forward slashes |
| User runs in cmd.exe (no link detection) | Print relative path on a second line for copy-paste |
| AI ignores the relay rule | Hard to mitigate completely, but moving the work to scripts removes most of the failure surface |

---

## Improvement 2: Side-by-Side CV Comparison

### Why a naive "AI generates a diff" approach is dangerous

The obvious design — "have the AI write a comparison.md describing what changed" —
fails in two predictable ways:

1. **False UNCHANGED labels.** AI confidently labels a section UNCHANGED when it
   actually swapped one bullet for a similar-sounding one. We want exactly the OPPOSITE
   of false confidence here, since this comparison is the user's fabrication-detection tool.

2. **Fabricated change rationale.** AI invents reasons like "Reframed for Platform
   archetype" when the change was just a word swap. The rationale sounds principled but
   is post-hoc rationalization.

The user is reading this comparison precisely to verify the AI didn't fabricate. Having
that same AI also write the comparison is a conflict of interest.

### Design: Deterministic structure + AI fills only what scripts can't

A new helper, `scripts/cv-compare.mjs`, does the parts that can be deterministic, and
the AI fills only the semantic gaps.

#### What the script does (deterministic)

1. **Parse `cv.md`** into sections (h2/h3 headers) and bullets (`- ` lines under each)
2. **Parse the filled CV HTML** (the same HTML that goes to Playwright) into the same
   structure: sections → bullets/text
3. **Match sections** by header name (case-insensitive, fuzzy: "Work Experience" ≈
   "Experience" ≈ "Professional Experience")
4. **For each section, compute:**
   - Set of bullets in master (normalized: lowercase, whitespace-collapsed)
   - Set of bullets in tailored
   - `kept_verbatim` = intersection (exact match after normalization)
   - `removed` = in master, not in tailored
   - `added` = in tailored, not in master
   - For each `added` bullet, find the closest master bullet by token-Jaccard
     (≥ 0.5 = probably a rewrite of that master bullet)
5. **Emit a structured `compare-{slug}-{date}.md`** with the deterministic findings
6. **Print to stdout** a one-page summary table and the `file:///` URI for the .md and the
   `.html` (after running md-to-html.mjs on the .md)

#### What the AI does (the small remainder)

For sections the script flagged as "non-bullet" (Professional Summary — a paragraph),
the AI writes a one-paragraph "before / after" block. It does NOT write change rationale.
It does NOT label sections UNCHANGED/MODIFIED — the script already did.

The AI's contribution is bounded to: "for the Summary section, paste the master text,
paste the tailored text, no commentary." This is something LLMs do reliably.

#### Comparison document format

```markdown
# CV Comparison: {Candidate Name} → {Company} ({Date})

> Generated by scripts/cv-compare.mjs at {timestamp}
> Master: cv.md  |  Tailored: output/cv-{slug}-{date}.html

## Summary

| Section | Kept Verbatim | Rewritten | Removed | Added | Status |
|---------|--------------:|----------:|--------:|------:|--------|
| Professional Summary | n/a | n/a | n/a | n/a | (see below) |
| Core Competencies | 8 | 0 | 4 | 0 | TRIMMED |
| Bosch (2022–present) | 1 | 2 | 1 | 0 | EDITED |
| Siemens (2018–2022) | 3 | 0 | 0 | 0 | UNCHANGED |
| Education | 2 | 0 | 0 | 0 | UNCHANGED |
| Skills | 12 | 0 | 3 | 1 | TRIMMED+ADDED |

---

## Professional Summary

**Master:**
> {paragraph from cv.md verbatim}

**Tailored:**
> {paragraph from filled CV verbatim}

---

## Core Competencies

**Removed (4):** LabVIEW, Signal Integrity, FMEA Facilitation, Six Sigma
**Added (0):** —
**Kept (8):** LLC Topology, PSFB Design, DAB Converters, Magnetics Design, ...

---

## Bosch (2022–present)

**Kept verbatim (1):**
- Reduced switching losses by 23% through soft-switching optimization on LLC topology

**Rewritten (2):**

| Master | Tailored |
|--------|----------|
| Led development of 3.3 kW onboard charger for EV platform | Delivered 3.3 kW OBC for EV platform — zero field failures across 18-month production |
| Coordinated cross-team integration of charging subsystem | Drove cross-team integration of charging subsystem across firmware, mechanical, and validation |

**Removed (1):**
- Coordinated with 12-person procurement team on BOM optimization

**Added (0):** —

---

## Skills

**Removed (3):** LabVIEW, Verilog, MATLAB Stateflow
**Added (1):** Kubernetes
**Kept (12):** Python, C++, Altium, SPICE simulation, ...

⚠️  **ADDED ITEMS REQUIRE VERIFICATION** — the script detected "Kubernetes" was added
to your Skills section but does not appear in master cv.md. Verify this is accurate
and not a fabrication. If you have Kubernetes experience, add it to cv.md.
```

The script flags any `added` item with a warning, since added content is the most
common fabrication path.

#### Warning highlight in the HTML viewer (added v3.1)

When `cv-compare.mjs` emits a warning block in the comparison markdown, it wraps it in
an inline `<div class="warning-block">` so the HTML viewer can style it for visual
emphasis. The markdown looks like:

```markdown
<div class="warning-block">

⚠️ **ADDED ITEMS REQUIRE VERIFICATION**

The script detected "Kubernetes" was added to your Skills section but does not appear
in master cv.md. Verify this is accurate and not a fabrication. If you have Kubernetes
experience, add it to cv.md.

</div>
```

`marked` (the markdown→HTML converter used by `md-to-html.mjs`) preserves inline HTML
blocks by default. The `<div>` passes through to the rendered HTML, where the viewer's
CSS styles it.

**New CSS in `templates/docs/viewer.html`:**

```css
.warning-block {
  background-color: #fffbeb;   /* warm amber tint */
  border-left: 4px solid #d97706;   /* solid amber border */
  padding: 12px 16px;
  margin: 16px 0;
  border-radius: 4px;
}
.warning-block strong {
  color: #92400e;   /* darker amber for emphasis */
}
```

The terminal output is unaffected — the `<div>` tag is invisible in raw markdown; only
the HTML viewer renders it with the highlight. In the terminal, the user sees the ⚠️
emoji and text, which is sufficient signal there.

**Rationale (from Gemini round 2):** A fabricated bullet or skill addition is a security
risk for the candidate. The HTML viewer is where the user reviews the comparison most
carefully (browser, full screen). Drawing the eye to fabrication candidates with a
clear visual highlight is a vital safety feature, not just nice-to-have.

### Terminal output

The user said: "Always open the md file content in the terminal." I read this literally
— print the full comparison `.md` content to terminal, not just a summary.

But for long comparisons (8 sections × 5 lines each = 40+ lines), this fills the screen.
Compromise:

- **Print the Summary table** in full
- **Print the Professional Summary diff** (it's the most important / most rewritten)
- **Print any sections with `added` items flagged with ⚠️**
- For other sections, print one line: `Bosch (2022–present): EDITED — 1 kept, 2 rewritten, 1 removed. See full diff in compare-*.md`
- Then the `📂 Open` line for the `.html`

This honors the user intent (visible in terminal) without spamming the screen.

### Skip conditions

- `cv --fast` → skip (consistent with skipping reviewer)
- `cv --docx-only` → still generate comparison (DOCX is a format, comparison is content)

### Files to change

| File | Change |
|------|--------|
| `scripts/cv-compare.mjs` | New — deterministic section parser + bullet matcher; emits `<div class="warning-block">` wrapper around ⚠️ blocks |
| `templates/docs/viewer.html` | Add `.warning-block` CSS (amber tint + left border) for fabrication-warning highlight |
| `modes/cv.md` | New Step 5: call the comparison script; AI fills paragraph diffs only |
| `package.json` | No new deps (`marked` already there; for parsing HTML use Node built-in or `node-html-parser`) |
| `modes/_shared.md` | Document the comparison artifact in P1/P2 outputs |

### Dependency note

The script needs to parse HTML. Options:
- `node-html-parser` (small, fast, no JSDOM weight) — recommended
- Regex-based extraction (works for our controlled template structure, brittle if templates change)

Choose `node-html-parser` (~50 KB, MIT, zero sub-deps).

### Tests

- T2.1: Generate CV with no changes (passthrough) → all sections show UNCHANGED
- T2.2: Generate CV where one bullet was removed → script correctly counts `removed: 1`
- T2.3: Generate CV where AI rewrote a bullet → script matches it as "Rewritten"
  (Jaccard ≥ 0.5), not as separate Removed + Added
- T2.4: Generate CV where AI added an entirely new bullet (not derived from master) →
  script flags ⚠️ "ADDED ITEMS REQUIRE VERIFICATION"
- T2.5: Generate CV with `--fast` → no comparison file produced
- T2.6: Open `compare-*.html` in browser → tables render, scrollable
- T2.7: When the comparison contains an ⚠️ added-item warning → the corresponding block
  in the HTML viewer has the amber `.warning-block` background and left border (visible
  fabrication-check highlight)
- T2.8: When the comparison contains no warnings → no `.warning-block` divs appear in
  the HTML (clean rendering, no empty styled boxes)

### Failure modes

| Failure | Mitigation |
|---------|-----------|
| HTML structure changes break parser | Pin to known section classes (`.work-experience`, `.competencies-list`); fail loudly if parser finds nothing |
| Section names don't match across cv.md and HTML | Fuzzy matcher with a fallback "Unmatched sections" block |
| Jaccard threshold too lax/strict | Make threshold tunable; start at 0.5; iterate based on real evals |
| Master cv.md doesn't have clean section structure | Document required structure in setup; degrade gracefully if violated |
| Performance on large cv.md | Cap at typical CV size (~1000 lines); profile if needed |

---

## Improvement 3: HTML for Evaluation Reports by Default

This one is straightforward. Run `md-to-html.mjs` on the report after writing it. The
mode pattern was already established for Bug D (interview-prep, deep).

### Fix

In `modes/evaluate.md`, after writing `reports/{###}-{slug}-{date}.md`:

```
Run: node scripts/md-to-html.mjs reports/{###}-{slug}-{date}.md

The script prints "📂 Open: file:///..." — surface that line in your output as the
canonical report link. If the script fails, fall back to printing the .md relative path.
```

Update Block G's output block and the P2 "What to do next" block to reference the
script's output line rather than constructing paths.

### Scope

- ✅ `reports/*.md` — this improvement
- ✅ `interview-prep/*.md` — already done (Bug D)
- ✅ `interview-prep/*-deep-research.md` — already done (Bug D)
- ✅ `output/compare-*.md` — added by Improvement 2
- ❌ `data/pipeline.md` — AI contract; skip (not user-reading)
- ❌ `interview-prep/story-bank.md` — append-only AI artifact; skip

### Viewer template considerations

Eval reports are denser than prep docs. Block B has a 6-row scoring grid; Block G has
a tier classification. Verify `templates/docs/viewer.html`:
- Tables render with alternating row shading
- Long cell content wraps cleanly (no horizontal scroll on small screens)
- `h2`/`h3` headings are visually distinct (block-level navigation)

If viewer.html needs polish for reports, that's a follow-up — don't block Improvement 3.

### Files to change

| File | Change |
|------|--------|
| `modes/evaluate.md` | After report write, run md-to-html.mjs; relay output |
| `docs/DATA_CONTRACT.md` | Add: reports/*.html are auto-generated companions, .md is source of truth |

### Tests

- T3.1: Run `evaluate <url>` → `reports/{###}-*.html` exists alongside `.md`
- T3.2: Open the `.html` → Block B scoring grid renders as a table, not raw `|` chars
- T3.3: Block G ghost tier table renders correctly
- T3.4: Terminal output P1 link points to `.html`, not `.md`
- T3.5: Delete `node_modules/marked` → script fails gracefully → mode falls back to .md link

---

## Improvement 4: Contact Info Vetting — No Fabrication

### Threat model

The AI is the threat actor here. We are not trying to detect a malicious AI — we're
trying to prevent helpful-but-wrong behavior where the AI fills in plausible-looking
contact details when the source data is incomplete. This is the most dangerous failure
mode because the result LOOKS correct but isn't.

Example failure: profile.yml has `linkedin: ""`. AI thinks: "the candidate's name is
Rifat Siddique; LinkedIn URLs are usually linkedin.com/in/firstname-lastname; let me
fill in `linkedin.com/in/rifat-siddique`." This LOOKS plausible and might even be
correct — but if it's wrong, it goes on every submitted CV.

### Defense in depth: 3 layers

**Layer 1 (early warning, Step 0d):** When the mode reads profile.yml, immediately
audit which contact fields are populated. If any are empty, print a warning BEFORE
spending time on generation:

```
⚠️  Contact info status (from config/profile.yml):
  ✅ Name: Rifat Siddique
  ✅ Email: rifatalam99@gmail.com
  ❌ Phone: missing — will be OMITTED from CV (not fabricated)
  ✅ Location: Vienna, Austria
  ❌ LinkedIn: missing — will be OMITTED from CV
  ❌ Portfolio: missing — will be OMITTED from CV
  ✅ Work Auth: EU Work Permit

To add missing fields, edit config/profile.yml and re-run.
Type 'continue' to generate the CV with these fields omitted, or 'pause' to fill in profile.yml first.
```

This sets correct expectations and gives the user a chance to stop and fill in.

**Layer 2 (drafter sourcing rule, in cv.md Step 1/2 — placeholder filling):**

```
CONTACT INFO SOURCING — ABSOLUTE RULE:

Contact placeholders ({{NAME}}, {{EMAIL}}, {{PHONE}}, {{LOCATION}}, {{LINKEDIN}},
{{PORTFOLIO_URL}}, {{GITHUB}}, {{WORK_AUTH}}) are filled EXCLUSIVELY from the
corresponding field in config/profile.yml → candidate.*.

NEVER use cv.md, article-digest.md, the JD, or any other source for contact fields.
NEVER infer or construct a value (no "guess the LinkedIn URL from the name").
NEVER leave a template placeholder string ("+1-555-0123", "your@email.com", "username")
in the rendered output.

If profile.yml has the field empty (""): omit the entire <span class="contact-item">
for that field. Do not emit "N/A" or "TBD" — just omit.

{{HEADLINE}} is the only contact-area placeholder that may be derived (from cv.md
+ _profile.md), and only if profile.yml → candidate.headline is empty.
```

**Layer 3 (deterministic post-gen audit, new):**

After the HTML is rendered (before PDF generation), a new helper
`scripts/audit-contact.mjs` parses the filled HTML, extracts each contact field, and
verifies it byte-for-byte against profile.yml:

```
For each contact field present in the HTML:
  if value matches profile.yml exactly → ✅
  if value matches profile.yml after whitespace normalization → ✅
  if profile.yml field is empty AND HTML field is present → ❌ FABRICATION
  if value is in a known-bad placeholder list (+1-555-0123, etc.) → ❌ PLACEHOLDER LEAKED
  otherwise → ❌ MISMATCH

Exit 0 if all pass; exit 2 if any fabrication/leak detected.
Print a structured report.
```

If the audit fails: STOP. Do not generate the PDF. Print the audit report. Ask the AI
to regenerate or ask the user to intervene. This is the only deterministic backstop
against AI fabrication — we cannot rely on the AI to audit itself.

### Reviewer involvement

Drop the "have the reviewer check contact info" idea. The reviewer is also an AI; it
has the same failure mode. The audit script is more reliable. Reviewer time is better
spent on body content (which the script CAN'T check semantically).

### Known-bad placeholder list

Maintain in `scripts/audit-contact.mjs`:
```js
const PLACEHOLDER_VALUES = new Set([
  '+1-555-0123', '+1 (555) 555-5555', 'your@email.com', 'name@example.com',
  'linkedin.com/in/yourname', 'github.com/username', 'yourdomain.com',
  'City, State', 'Your Name', 'TBD', 'N/A', 'TODO', '',
]);
```

This catches template defaults that slip through if profile.yml itself has placeholders.

### Files to change

| File | Change |
|------|--------|
| `scripts/audit-contact.mjs` | New — parses HTML, audits against profile.yml |
| `modes/cv.md` | Step 0d: early warning audit; Step 1/2: absolute sourcing rule; Step 4 (before PDF): run audit; halt on failure |
| `modes/_shared.md` | Add a global NEVER: "Never fabricate contact details — see modes/cv.md sourcing rule" |
| `config/profile.yml` | Add comments next to each contact field: "Leave empty if not applicable — will be omitted, not fabricated" |

### Tests

- T4.1: Set `phone: ""` → no phone span in HTML; audit passes; PDF generated
- T4.2: Set `linkedin: ""` → no LinkedIn span; audit passes
- T4.3: Manually inject `<span class="contact-item">linkedin.com/in/fake</span>` into a
  filled HTML; run audit; verify exit code 2 and clear error message
- T4.4: Set `phone: "+1-555-0123"` (literal placeholder value) → audit flags PLACEHOLDER LEAKED
- T4.5: Run `cv` with all contact fields empty → early warning shows all ❌; user pauses;
  fills profile.yml; reruns → early warning shows all ✅
- T4.6: Audit script fails (e.g., HTML missing) → mode halts before PDF, surfaces error

### Failure modes

| Failure | Mitigation |
|---------|-----------|
| AI bypasses the rule and fabricates anyway | Audit script catches it deterministically |
| Audit has false positive (legit value mismatched) | Normalize whitespace + case-insensitive email + trim trailing slashes on URLs |
| profile.yml has whitespace-padded values | Audit script trims before compare |
| New contact field added without updating audit | Audit reads the list of fields from profile.yml schema dynamically, not a hardcoded list |

---

## Improvement 5: DOCX Export (Opt-in, High-Fidelity)

### Decision: programmatic high-fidelity DOCX, not lossy conversion

The first draft of this plan proposed pandoc + html-to-docx fallback. Gemini's review
rejected this as defeatist, and on reflection it was — both pandoc and html-to-docx
strip the design tokens (accent color, spacing, justified layout) that make the CV
look polished.

**Revised approach: build the DOCX programmatically with the `docx` npm package**,
reading content from the filled CV HTML and reading design tokens (accent color,
margins, font sizes, line spacing) from the same template's `:root` CSS variables.
This gives us a Word document that visually mirrors the PDF.

### Honest scope of "high fidelity"

DOCX cannot render every CSS construct. Setting expectations correctly:

| What WILL match the PDF | What WON'T |
|-------------------------|------------|
| Accent color (h1, section titles, dividers) | Custom @font-face fonts — DOCX uses font names, not files |
| Margins (read from `--margins` CSS variable) | Pseudo-elements (`::before` separators) — replaced with literal `\|` chars |
| Section structure (headings, sub-headings) | Flexbox/Grid layouts — replaced with borderless tables |
| Bullets, bold, italic | Some `letter-spacing` and micro-typography |
| Line spacing within paragraphs | Exact line breaks (DOCX flows naturally on page width) |
| Borderless tables for contact row + competencies | CSS filter/transform/animation (none in our templates anyway) |
| Bottom border under section headings | CSS-only icons or background images |
| Justified column layout for job-company / dates | Strict 1-page constraint (DOCX flow is page-relative) |

This produces a Word document that looks professional and on-brand — close enough that
a recruiter glancing at it sees the same visual language as the PDF.

### Architecture

```
output/cv-{slug}.html  ─┐
                        ├─→  scripts/generate-docx.mjs  ─→  output/cv-{slug}.docx
templates/cv/{T}.html  ─┘    (reads :root CSS vars + parses
                              content with node-html-parser;
                              builds DOCX via docx package)
```

**Why not parse arbitrary CSS?** We control the template structure. The script
hardcodes the mapping from our known classes (`.header`, `.contact-row`, `.section-title`,
`.work-entry`, `.competencies-list`, etc.) to DOCX constructs. New templates require
updating this mapping — small cost, big quality win.

**Why not parse style values?** Only the design tokens that vary across templates
(`--accent`, `--accent-muted`, `--margins`, `--base-font-size`) need to be read. Static
styles (font weight on headings, spacing after bullets) are constants in the script.

### Style token extraction

The HTML template's `:root` block defines design tokens:

```css
:root {
  --accent: #1e3a5f;
  --accent-muted: #4a6985;
  --margins: 0.5in;
  --base-font-size: 11px;
  --line-height: 1.45;
}
```

`generate-docx.mjs` reads these with a simple regex (same approach `generate-pdf.mjs`
already uses for `--margins`). Default values if any token is absent. No CSS parser needed.

### Script outline: `scripts/generate-docx.mjs`

```
Usage: node scripts/generate-docx.mjs <input.html> <output.docx>

Steps:
1. Read input.html
2. Extract design tokens (regex over :root block) → STYLE object
3. Parse content with node-html-parser:
   - Header block (name, headline, contact items)
   - Each <section> with h2 → title + body
   - Work entries (company, dates, bullets)
   - Education entries
   - Competencies list
   - Skills section
4. Pass content through normalizeTextForATS() (shared with generate-pdf.mjs — see below)
5. Build DOCX with `docx` package using STYLE tokens:
   - Document section: margins from --margins (convert in→dxa: 720 = 0.5in)
   - Header: 1-row borderless table {Name left | (empty right)}, accent color on Name
   - Contact row: paragraph with literal " | " between items
   - Section heading: bold, accent color, paragraph bottom border in accent
   - Work entry header: 1-row 2-col borderless table {Company bold accent | Dates right}
   - Bullets: ListParagraph style, 4pt after-spacing
   - Competencies: 3-col borderless table grid
6. Write output.docx
7. Print:
   ✅ DOCX written: {abs_path}
   📂 Open: file:///{abs_path_forward_slashes}
   ℹ️  Style tokens applied: accent={hex}, margins={value}
8. Exit 0 success, 1 failure
```

### Refactor: shared ATS normalization

Currently `generate-pdf.mjs` has its own `normalizeTextForATS()` (strips smart quotes,
em-dashes, non-breaking spaces, etc.). Extract this into `scripts/lib/normalize-text.mjs`
and import it from both `generate-pdf.mjs` and `generate-docx.mjs`. This guarantees the
DOCX is exactly as ATS-safe as the PDF.

This refactor is small (extract a function), but important — without it, the DOCX could
contain smart quotes that the PDF stripped, producing divergent ATS behavior.

### Trigger

User must explicitly request DOCX. NOT generated by default.

- `cv --docx` → generate PDF + DOCX (PDF still primary)
- `cv --docx-only` → DOCX only, skip PDF
- After a CV completes: user types "also generate docx" → run the DOCX step against
  the existing output/{slug}.html

### What about Word's own font fallback?

Fonts referenced in the DOCX (`Source Serif Pro`, `Space Grotesk`) are font *names*, not
*files*. If the user's Word installation has the font installed, it's used; otherwise
Word substitutes a similar font. We don't ship font files inside the DOCX (would bloat
the file). Acceptable — corporate Word users typically have system serif/sans fonts that
look close enough.

For users who want exact font match: document that they can install the fonts on their
system (the fonts are MIT/OFL-licensed and already in `fonts/`).

### Dependencies

```
npm install docx node-html-parser
```

- `docx` (~150 KB, MIT) — well-maintained programmatic OOXML library
- `node-html-parser` (~50 KB, MIT) — also used by Improvement 2

Drop `html-to-docx`. Drop pandoc detection. Zero external system dependencies.

### Files to change

| File | Change |
|------|--------|
| `scripts/generate-docx.mjs` | New — programmatic DOCX builder |
| `scripts/lib/normalize-text.mjs` | New — shared ATS text normalization |
| `scripts/generate-pdf.mjs` | Refactor: import normalize-text from shared module |
| `modes/cv.md` | Step 0a: parse `--docx` / `--docx-only`; new DOCX step; honest scope note |
| `package.json` | Add `docx`, `node-html-parser` dependencies |
| `.agents/skills/career-scout/SKILL.md` | Document `--docx` / `--docx-only` |
| `README.md` | Add: "DOCX export: `cv --docx` — high-fidelity Word version matching PDF design" |
| `docs/DATA_CONTRACT.md` | output/*.docx is a generated artifact, same as .pdf |

### Tests

- T5.1: `cv --docx` → both .pdf and .docx exist in output/
- T5.2: `cv --docx-only` → only .docx, no .pdf
- T5.3: `cv` (no flag) → no .docx
- T5.4: Open .docx in Word: header name is in accent color; section titles have bottom
  border in accent; competencies render as a 3-col grid; work-entry company/dates
  appear on same line, company left, dates right
- T5.5: Open .docx in LibreOffice: same visual structure (cross-platform sanity check)
- T5.6: Copy DOCX content → paste into Notepad → all content present, no special chars
  (em-dashes, smart quotes) — confirms ATS normalization
- T5.7: Change `--accent: #b00020` (red) in template → regenerate DOCX → accent color
  in Word is red, not the default navy (confirms dynamic style reading)
- T5.8: Manually missing `docx` dependency → script exits 1 with clear "run npm install"

### Failure modes

| Failure | Mitigation |
|---------|-----------|
| `docx` package not installed | Script catches require error, prints install instruction |
| `node-html-parser` fails on malformed HTML | Same template that Playwright accepts; failure here means PDF would also fail |
| User has custom non-standard CSS variable name | Document the expected variables in template developer notes; defaults if missing |
| Word doesn't have the named font | Word's font substitution kicks in — acceptable for most users; document workaround |
| Future template adds a layout we don't map | Script logs unknown section name as warning; section included as plain paragraphs (lossy fallback for the new bit, rest still high-fidelity) |
| Generated DOCX is broken (invalid OOXML) | `docx` package emits valid XML by construction; verified by opening in Word during T5.4/T5.5 |

### Scope boundary: this is medium-large effort

This is the biggest piece of work in the plan. Honest estimate:

- `scripts/lib/normalize-text.mjs`: 30 min (extract existing function)
- `scripts/generate-docx.mjs`: 6-10 hours initial build, depending on `docx` library
  familiarity
- `modes/cv.md` integration: 30 min
- Testing across templates (classic-professional + ats-optimized): 2-3 hours
- Documentation: 30 min

**Total ~10-14 hours.** If timeline is tight, this can be deferred to a separate phase
after Improvements 1-4 ship. Improvements 1-4 deliver immediate user value with smaller
implementation cost.

---

## Improvement 6 (added in v3): Contextual UX Hints — Conservative Pattern

### Why this needs deliberate design

Gemini's review recommended adding hints in evaluate.md, cv.md, AGENTS.md, and SKILL.md
to "make the AI feel intelligent and helpful" by promoting the DOCX capability. The
intent is good — discoverability matters — but aggressive tipping has downsides:

- **Hint fatigue.** A tip shown on every CV generation becomes noise after 2 runs.
- **Conflicts with user intent.** User said DOCX should be opt-in. Tipping on every
  GOOD_FIT eval ("you can generate DOCX!") pushes against that intent.
- **Hard-coded triggers age poorly.** Today the new feature is DOCX. In 3 months it's
  something else. Each new feature would want its own tip in every mode = noise compounds.

### Adopted approach: 3-tier discoverability, not aggressive promotion

**Tier 1 — Discovery surfaces (always visible).** Document `--docx` and `--docx-only`
in:
- `README.md` under "Generate a CV" section
- `.agents/skills/career-scout/SKILL.md` discovery menu (cv mode entry)
- `cv --help` output (if/when we add a help flag)

This is the standard place to find features. No promotion needed.

**Tier 2 — Cross-mode P3 nudges (existing convention, light touch).** The Phase 4 P3
pattern (cross-mode nudges) already covers contextual prompts. Extend P3 in `cv.md`'s
"What to do next" block to mention DOCX **only when the composite score is ≥ 85 AND
the user did not invoke `--docx` or `--docx-only`** (upper-tier GOOD_FIT and above —
the range where extra polish is worth the effort):

```
What to do next:
  1. Open the PDF and review before submitting
  2. Submit your application — then update status → pipeline
  3. When interview scheduled → interview-prep {company-slug}

💡 High-fit role — consider also generating a DOCX for ATS upload portals:
   cv --docx-only   (creates output/cv-{slug}.docx alongside the PDF)
```

**Trigger logic:** `composite ≥ 85 AND NOT --docx AND NOT --docx-only`

For composite 80-84 (lower GOOD_FIT): no DOCX hint. PDF is enough for most ATS systems
at this tier.
For PARTIAL_MATCH (< 80): no DOCX hint. Spending more polish on a marginal app is
counter to "quality over quantity" core philosophy.

**Rationale for 85 (not 90):** v3.0 proposed 90 (PERFECT_MATCH only). Gemini's round 2
review pushed for 85 — many high-quality solid target roles fall in the 85-89 range
(upper GOOD_FIT). Reserving the nudge for composite ≥ 90 would miss most of the roles
worth polishing. Adopted.

**Tier 3 — First-time hint (show once, then quiet).** On the user's first CV run after
installing the feature, show a one-time hint in the cv mode output:

```
ℹ️  New: you can now generate a high-fidelity Word version with `cv --docx`.
   (This message shows once; see README.md for full options.)
```

Persistence: write a marker to `data/.feature-hints.json` once shown. The mode checks
this file in Step 0 and skips the hint if already shown. Simple, no tip fatigue.

### What I'm declining from Gemini's review

- ❌ Hint in `evaluate.md` Block G for every GOOD_FIT+ role. Reason: evaluate.md is
  the strategic-thinking output; loading it with feature ads breaks the focus. The CV
  mode is where the DOCX decision is made — keep the hint there.
- ❌ Hint in cv.md Step 4 every time a draft is generated without --docx. Reason: tip
  fatigue. Use the Tier 2/3 pattern instead.

### Files to change (Improvement 6 only)

| File | Change |
|------|--------|
| `modes/cv.md` | Step 0: check `data/.feature-hints.json` for first-time hint; "What to do next" P3 block adds DOCX nudge ONLY when composite ≥ 90 AND --docx not used |
| `data/.feature-hints.json` | New (auto-created on first cv run); tracks shown hints |
| `README.md` | Already covered by Improvement 5 — DOCX in CV section |
| `.agents/skills/career-scout/SKILL.md` | Already covered by Improvement 5 — flag docs |

### Test

- T6.1: First `cv` run after install → first-time hint appears in output
- T6.2: Second `cv` run → no first-time hint
- T6.3: `cv` for an 87-composite role (upper GOOD_FIT) → P3 nudge mentions `cv --docx-only`
- T6.4: `cv` for a 92-composite role (PERFECT_MATCH) → P3 nudge mentions `cv --docx-only`
- T6.5: `cv` for an 82-composite role (lower GOOD_FIT) → no DOCX nudge in P3
- T6.6: `cv` for a 70-composite role (PARTIAL_MATCH) → no DOCX nudge in P3
- T6.7: `cv --docx` for a 92-composite role → no DOCX nudge (user already opted in)
- T6.8: `cv --docx-only` for an 87-composite role → no DOCX nudge (user already opted in)
- T6.9: Delete `.feature-hints.json` → next `cv` shows the first-time hint again
  (acceptable — file is local state, not a guarantee)

---

## AI Failure Modes Considered (Cross-Cutting)

| Risk class | Where it could bite us | Defense |
|-----------|----------------------|---------|
| AI forgets ambient rules | Improvement 1 (link format), Improvement 4 (no fabrication) | Move work to scripts; deterministic audit |
| AI hallucinates plausible content | Improvement 4 (contact), Improvement 2 (comparison rationale) | Audit script (Imp. 4); deterministic diff (Imp. 2) |
| AI self-verification is weak | Reviewer checking its own contact details | Use scripts for verification, not AI-on-AI review |
| AI labels wrong things UNCHANGED | Improvement 2 (lazy diff) | Script computes UNCHANGED deterministically |
| AI invents change rationale | Improvement 2 ("Reframed for Platform archetype" when it just trimmed) | Script presents data; AI doesn't write rationale |
| AI mishandles Windows paths | Improvement 1 | Scripts emit canonical forward-slash URIs |
| AI omits things it was supposed to add | All improvements | Tests verify presence, not just absence |

---

## Implementation Order

| Order | Item | Risk | Reason |
|-------|------|------|--------|
| 1 | Improvement 1: clickable links (script-emits-URI pattern) | Low | Foundation for all other links; do first so later improvements use it |
| 2 | Improvement 4: contact vetting | Low | Pure script + mode rules; highest user trust impact |
| 3 | Improvement 3: HTML for eval reports | Low | One mode change, reuses existing script |
| 4 | Improvement 2: CV comparison | Medium | New script with HTML parser; biggest new code (excl. DOCX) |
| 5 | Improvement 5: DOCX (high-fidelity) | Medium-Large | Largest piece — programmatic builder + CSS token reader; can ship in a follow-up phase if needed |
| 6 | Improvement 6: UX hints | Low | Depends on #5 (DOCX must exist before nudging users to it) |

**Commits:**
- Commit A: Improvements 1 + 3 (link pattern + eval report HTML) — both touch link rendering
- Commit B: Improvement 4 (contact vetting) — standalone safety change
- Commit C: Improvement 2 (CV comparison) — new feature
- Commit D: Improvement 5 (DOCX) — biggest commit; refactors normalize-text into shared module
- Commit E: Improvement 6 (UX hints) — small follow-up after DOCX merged

---

## Files Summary

### New files

| File | Improvement | Purpose |
|------|-------------|---------|
| `scripts/cv-compare.mjs` | #2 | Deterministic CV diff helper |
| `scripts/audit-contact.mjs` | #4 | Verify contact fields against profile.yml |
| `scripts/generate-docx.mjs` | #5 | Programmatic high-fidelity DOCX builder |
| `scripts/lib/normalize-text.mjs` | #5 (refactor) | Shared ATS text normalization |
| `data/.feature-hints.json` | #6 | Auto-created marker file for first-time hints |

### Modified files

| File | Improvements |
|------|-------------|
| `scripts/generate-pdf.mjs` | #1 (add canonical URI stdout line), #5 (import shared normalize-text) |
| `scripts/md-to-html.mjs` | #1 (verify URI format matches standard) |
| `templates/docs/viewer.html` | #2 (add `.warning-block` CSS for fabrication-warning highlight) |
| `modes/_shared.md` | #1 (simplified P1: relay script URIs), #4 (NEVER fabricate contact) |
| `modes/cv.md` | #1, #2, #4, #5, #6 (all improvements touch cv mode) |
| `modes/evaluate.md` | #1, #3 (md-to-html on report; relay URI) |
| `modes/interview-prep.md` | #1 (relay URI from script) |
| `modes/deep.md` | #1 (relay URI from script) |
| `modes/scan.md` | #1 (URI for pipeline.md) |
| `docs/DATA_CONTRACT.md` | #3 (reports/*.html as system-generated companion), #5 (output/*.docx as system-generated artifact), #6 (`data/.feature-hints.json` registered as **system layer** — auto-created, not user data, never auto-cleaned) |
| `config/profile.yml` | #4 (comments on contact fields), #2 (`cv.diff_threshold: 0.5`) |
| `package.json` | #2/#5 (`docx`, `node-html-parser`) |
| `.agents/skills/career-scout/SKILL.md` | #5 (--docx flag docs) |
| `README.md` | #5 (DOCX export note — "high-fidelity Word version matching PDF design") |

---

## Resolved Decisions (from Gemini Review Round 1)

| Q | Decision | Notes |
|---|----------|-------|
| Q1 Jaccard threshold | **Configurable.** Default 0.5 in `config/profile.yml` → `cv.diff_threshold`. Token-normalize (lowercase, strip punctuation) before computing. | Gemini's recommendation adopted. |
| Q2 Contact audit halt behavior | **Halt completely.** No auto-regeneration. Print structured diagnostic, let user fix profile.yml. | Aligns with human-in-the-loop philosophy and avoids wasted tokens on retry loops. |
| Q3 DOCX reference.docx | **No reference.docx.** Programmatic builder generates all styles in memory from CSS tokens read at runtime. | Pivoting to programmatic `docx` package eliminates the need. |
| Q4 P1 backwards compat | **Clean cut.** Update all mode files in the same commit; remove legacy P1 wording from `_shared.md`. | Half-and-half would clutter LLM context and produce inconsistent output. |
| Q5 Section parser lenience | **Lenient.** Match h1/h2/h3 by keyword (`experience`, `summary`, `education`, `skills`, `competencies`, `projects`). Fall back to literal-name matching. | Robust against template variation; documented in cv-compare.mjs source. |
| Q6 Pandoc detection on Windows | **Moot — pandoc eliminated.** Native Node-only stack via `docx` + `node-html-parser`. Zero external system deps. | Big win for Windows users. |

### Push-back on Gemini's review

Two items where I disagreed and went a different direction. Documenting so Gemini can
respond in round 2:

**Push-back 1: "modern Word document generators can replicate complex CSS layouts with
near-perfect accuracy"** — overstated. They replicate STRUCTURED layouts (tables, lists,
headings, simple styles) very well. They cannot replicate flexbox, grid, pseudo-elements,
or exact pixel positioning. I've documented an honest scope table in Improvement 5
("What WILL match" vs "What WON'T"). Setting realistic expectations prevents user
disappointment when the DOCX is "very close but not pixel-identical" — which is the
truthful description.

**Push-back 2: aggressive UX hints in evaluate.md Block G and cv.md Step 4** — would
cause hint fatigue and conflict with the "DOCX is opt-in" intent. Adopted the spirit
(discoverability) via a 3-tier approach: README/SKILL.md docs (Tier 1), Tier-2 P3 nudge
restricted to PERFECT_MATCH (composite ≥ 90), and a one-time first-run hint (Tier 3
with persistence in `data/.feature-hints.json`). See Improvement 6 for details.

## Resolved Decisions (Gemini Round 2)

| Q | Decision | Implementation |
|---|----------|----------------|
| R2-Q1 DOCX effort: ship in batch or phase? | **Ship in one unified batch.** All 6 improvements release together. | Implementation Order kept as-is (commits A-E in one release) |
| R2-Q2 `.feature-hints.json` mechanism? | **Approved as designed.** | Add explicit DATA_CONTRACT.md entry: `data/.feature-hints.json` is system layer (auto-generated, not user data, not cleaned up) |
| R2-Q3 DOCX nudge threshold? | **Lower to composite ≥ 85** (was 90). | Captures upper-tier GOOD_FIT roles where extra polish is worth it; trigger: `composite ≥ 85 AND NOT --docx AND NOT --docx-only` |
| R2-Q4 Warning-block styling? | **Implement as CSS class.** | `cv-compare.mjs` wraps ⚠️ blocks in `<div class="warning-block">`; viewer.html gets `.warning-block` CSS (amber tint + left border) |

### Push-back resolutions (Gemini Round 2)

- **Push-back 1 (honest DOCX scope table):** Fully approved. The What-WILL-match /
  What-WON'T-match table stays as-is.
- **Push-back 2 (3-tier conservative UX hints):** Fully approved. No hints added to
  `evaluate.md`; cv.md hints follow the 3-tier pattern.

### No remaining open questions

The plan is locked. Implementation can begin in the order specified in §
"Implementation Order".

---

## Acceptance Criteria

### Improvement 1 (clickable links)
- [ ] Every writer script (`generate-pdf.mjs`, `md-to-html.mjs`, `generate-docx.mjs`,
      `cv-compare.mjs`) prints `📂 Open: file:///...` on stdout
- [ ] All affected modes relay this line verbatim in their output
- [ ] No mode constructs a `file:///` URI from path arithmetic
- [ ] In Gemini CLI / Antigravity: the URI is rendered as a clickable hyperlink
- [ ] In raw cmd.exe: relative path is visible on a second line for copy-paste

### Improvement 2 (CV comparison)
- [ ] `cv-compare.mjs` exists and produces `output/compare-{slug}-{date}.md`
- [ ] `compare-*.html` generated alongside via md-to-html.mjs
- [ ] Sections with `added` content are flagged with ⚠️ for verification
- [ ] Terminal output shows summary table + Professional Summary diff + flagged sections
- [ ] `cv --fast` skips comparison entirely
- [ ] UNCHANGED sections are correctly identified (deterministic, not AI-judged)
- [ ] AI does NOT write change rationale in the comparison

### Improvement 3 (HTML for eval reports)
- [ ] `reports/*.html` auto-generated after every `evaluate` run
- [ ] Block B scoring grid and Block G ghost tier render as proper tables in browser
- [ ] Evaluate P1 link points to `.html`, not `.md`
- [ ] Graceful fallback to `.md` link if script fails
- [ ] DATA_CONTRACT.md updated

### Improvement 4 (contact vetting)
- [ ] Early warning printed in Step 0d when any contact field is empty in profile.yml
- [ ] Empty fields → omitted from HTML, NOT fabricated
- [ ] `audit-contact.mjs` runs before PDF generation; halts on failure
- [ ] Known-bad placeholder values (`+1-555-0123` etc.) are detected
- [ ] Manually injected fabricated value triggers audit failure with clear error
- [ ] CV generated successfully when all fields are validly populated

### Improvement 5 (DOCX export — high-fidelity)
- [ ] `cv --docx` generates both PDF and DOCX
- [ ] `cv --docx-only` generates only DOCX
- [ ] `cv` (no flag) does NOT generate DOCX
- [ ] DOCX opens cleanly in Word AND LibreOffice (cross-platform sanity)
- [ ] DOCX header uses accent color from template's `--accent` CSS variable
- [ ] DOCX section titles have bottom border in accent color
- [ ] DOCX competencies render as a 3-column borderless table grid
- [ ] DOCX work-entry header has Company (bold, accent) left + Dates right on same line
- [ ] DOCX margins match `--margins` value from template
- [ ] Changing `--accent` in template → DOCX accent changes accordingly (T5.7 dynamic test)
- [ ] DOCX content passes ATS normalization (no smart quotes, em-dashes, etc.)
- [ ] Plain-text paste from DOCX preserves all content (T5.6)
- [ ] README and SKILL.md document the flag
- [ ] Honest scope note in mode output: "high fidelity for colors/spacing/structure; flexbox quirks won't transfer"

### Improvement 6 (contextual UX hints)
- [ ] First-time hint appears in first `cv` run after install
- [ ] Subsequent `cv` runs do NOT show first-time hint (`.feature-hints.json` tracks shown hints)
- [ ] P3 nudge mentions `cv --docx-only` ONLY when composite ≥ 85
- [ ] No DOCX nudge for composite < 85
- [ ] No DOCX nudge when user already used `--docx` or `--docx-only`
- [ ] No new hints added to `evaluate.md` Block G (intentional — keep eval focused)
- [ ] `data/.feature-hints.json` registered as system-layer in DATA_CONTRACT.md
      (auto-generated; not user data; not deleted by cleanup scripts)

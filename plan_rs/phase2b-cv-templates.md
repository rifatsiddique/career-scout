# Phase 2b: CV Templates 3 & 4 (Academic/Research + Technical/Engineering)

**Version:** 1.0
**Last Updated:** 2026-05-26 -- Initial plan, ready for Gemini review
**Parent Plan:** CONSOLIDATION-PLAN.md §11 Phase 2 (deferred items)
**Depends on:** Phase 2 complete — `modes/cv.md`, `scripts/generate-pdf.mjs`, `templates/cv/manifest.yml`, and the two existing templates are all in place. No infrastructure changes needed.

---

## 1. Context & Scope

Phase 2 shipped Templates 1 (ATS-Optimized) and 2 (Classic Professional), validated the pipeline end-to-end, and deferred Templates 3 and 4.

Both templates are already registered in `templates/cv/manifest.yml` with `status: planned`. This phase builds them.

**What does NOT change:**
- `modes/cv.md` template selection logic — already supports arbitrary templates via profile.yml mapping and per-evaluation overrides
- `scripts/generate-pdf.mjs` — template-agnostic, takes any HTML in
- The `{{PLACEHOLDER}}` vocabulary shared across all templates
- The drafter-reviewer workflow

**What changes:**
- Two new HTML template files
- New font woff2 files in `fonts/`
- `manifest.yml` status updates + new placeholder fields
- Minor `modes/cv.md` placeholder table additions for template-conditional fields
- `config/profile.yml` archetype-to-template mappings (if not already set)

---

## 2. Template 3: Academic / Research

### 2.1 Target Audience

A researcher, PhD candidate, postdoc, or industry scientist applying to academic positions, R&D labs, pharmaceutical research, national labs, or any role where publications, grants, and research pedigree matter more than corporate job titles.

### 2.2 Design Brief

| Element | Choice | Rationale |
|---------|--------|-----------|
| Primary font | EB Garamond | Classic academic serif — signals scholarly credibility. Used by major journals. |
| Body font | Source Sans Pro | Clean sans-serif for readability; complements Garamond without visual clash |
| Color | No accent color — all black/grey | Academic CVs (curriculum vitae) avoid decorative color. Hiring committees in academia treat color as a signal of non-academic origin. |
| Section order | Header → Research Interests → Education → Publications → Research Experience → Industry Experience → Skills → Grants & Awards | Education and Publications near the top — the primary credentials in academia |
| Layout | Single column, generous line height | Academic CVs are often longer (3-5 pages); clarity at length matters |
| Contact row | Email + Google Scholar + ORCID + institution affiliation | Google Scholar profile is a first-class link in academic contexts |

### 2.3 New Placeholders (Template 3 only)

These are **in addition to** the shared vocabulary (`{{NAME}}`, `{{EXPERIENCE}}`, `{{EDUCATION}}`, `{{SKILLS}}`, `{{CERTIFICATIONS}}`, `{{PROJECTS}}`):

| Placeholder | Description | Source | Required? |
|-------------|-------------|--------|-----------|
| `{{RESEARCH_INTERESTS}}` | 2-3 sentence research statement (replaces Summary for this template) | cv.md research section / drafter synthesises from cv.md | Yes |
| `{{PUBLICATIONS}}` | Publication list — journal articles, conference papers, preprints. Each entry: authors, title, venue, year, DOI link | cv.md publications section | Optional — section omitted if empty |
| `{{EDUCATION_FEATURED}}` | Full education block near top: degree, institution, year, thesis title, advisor name, GPA (if relevant) | cv.md education section | Yes |
| `{{GRANTS_AWARDS}}` | Academic awards, fellowships, grants, travel awards | cv.md awards section | Optional — section omitted if empty |
| `{{GOOGLE_SCHOLAR_URL}}` | Link to Google Scholar profile | `config/profile.yml → candidate.google_scholar` | Optional |
| `{{ORCID}}` | ORCID identifier | `config/profile.yml → candidate.orcid` | Optional |

**Drafter rule:** If `{{PUBLICATIONS}}` or `{{GRANTS_AWARDS}}` source is empty, completely omit the section and its heading — do not render an empty section.

### 2.4 Publication Entry Format

```html
<!-- Within {{PUBLICATIONS}} block, each entry renders as: -->
<div class="pub-entry">
  <span class="pub-authors">Smith J., Doe J., Johnson K.</span>
  <span class="pub-title">"Deep Learning for Protein Folding Prediction"</span>
  <span class="pub-venue">Nature Methods, 2024</span>
  <a class="pub-doi" href="https://doi.org/10.1038/...">DOI</a>
</div>
```

ATS note: DOI links must be plain `<a href>` tags, not JavaScript. The text content must include the full citation without depending on the hyperlink.

### 2.5 CSS Variables (must match existing pattern)

```css
:root {
  --base-font-size: 11pt;
  --margins: 0.6in;        /* wider than T1/T2 — academic CVs have more breathing room */
  --bullet-spacing: 0.2em; /* more generous line spacing for long-form reading */
  --accent: #000000;       /* no color accent */
  --accent-muted: #555555; /* institution/role line color */
}
```

### 2.6 ATS Verification

After generating a PDF with this template, the copy-paste text extraction must produce content in this logical order:

```
[Name]
[Contact line: email | google scholar | orcid | affiliation]
[Research Interests paragraph]
[Education — full entry with thesis]
[Publications list]
[Research Experience entries]
[Industry Experience entries]
[Skills]
[Grants & Awards]
```

If the paste order differs significantly, the CSS layout is creating reading-order confusion and must be fixed before the template can be marked `status: ready`.

### 2.7 Fonts

| Font | Files needed | Source | License |
|------|-------------|--------|---------|
| EB Garamond | `eb-garamond-latin-400.woff2`, `eb-garamond-latin-700.woff2` | Google Fonts | OFL — safe to commit |
| Source Sans Pro | `source-sans-pro-latin-400.woff2`, `source-sans-pro-latin-600.woff2` | Google Fonts | OFL — safe to commit |

Download via: `https://fonts.google.com/download?family=EB+Garamond` and `https://fonts.google.com/download?family=Source+Sans+Pro` — extract woff2 files from the zip.

---

## 3. Template 4: Technical / Engineering

### 3.1 Target Audience

An individual-contributor engineer (software, ML, hardware, embedded, systems) applying to technical IC roles where they want to show depth in tools, frameworks, and concrete project outcomes — not managerial scope. The template signals "builder" not "manager."

### 3.2 Design Brief

| Element | Choice | Rationale |
|---------|--------|-----------|
| Heading font | JetBrains Mono | Monospace for skill tags and section labels signals technical identity without being gimmicky |
| Body font | Inter | Clean, highly legible, designed for screens/print. Widely used in technical contexts |
| Accent color | `#0a7ea4` (teal) | Professional but distinct from T1 navy; evokes technical clarity |
| Section order | Header → Skills Grid → Projects → Experience → Education → Certifications | Skills and Projects lead — the primary signals for IC roles |
| Skills display | Compact tag cloud, monospace font, teal border | Tags are visually scannable; hiring managers skim for tool names |
| Projects | Project cards: name + tech stack line + outcome metric + 2-3 bullets | Outcome-first presentation; shows what was built and measured |
| GitHub/Portfolio | Styled as `⌥ github.com/user` and `⌥ user.dev` in header | Makes the profile link visually distinct from plain contact info |

### 3.3 New Placeholders (Template 4 only)

| Placeholder | Description | Source | Required? |
|-------------|-------------|--------|-----------|
| `{{TECH_STACK}}` | Primary technologies as compact tags (languages, frameworks, tools, platforms) | cv.md skills section — drafter selects JD-relevant subset | Yes |
| `{{GITHUB_URL}}` | GitHub profile URL | `config/profile.yml → candidate.github` | Optional — omit tag if empty |
| `{{PORTFOLIO_URL}}` | Personal site / portfolio URL | `config/profile.yml → candidate.portfolio_url` | Optional — omit tag if empty |

**Drafter rule for `{{TECH_STACK}}`:** Select 12-18 items from the candidate's full skills list, prioritising items that appear in the JD. Order: programming languages first, then frameworks, then tools/platforms. If more than 18 items, cut lowest-relevance items (not alphabetically — by JD match).

### 3.4 Project Card Format

```html
<!-- Within {{PROJECTS}} block, each card: -->
<div class="project-card">
  <div class="project-header">
    <span class="project-title">Distributed Training Harness</span>
    <span class="project-stack">PyTorch · NCCL · Kubernetes · AWS</span>
  </div>
  <div class="project-metric">Reduced training time 40% across 8-GPU cluster</div>
  <ul class="project-bullets">
    <li>...</li>
  </ul>
</div>
```

ATS note: project title and stack must be plain text in DOM. The `project-stack` line often confuses parsers if done with CSS columns — use `·` bullet separators in a single `<span>`, not a grid.

### 3.5 Skills Tag Rendering

```html
<!-- {{TECH_STACK}} renders as: -->
<div class="skills-grid">
  <span class="skill-tag">Python</span>
  <span class="skill-tag">PyTorch</span>
  <span class="skill-tag">Kubernetes</span>
  <!-- ... -->
</div>
```

CSS: flexbox wrap, not CSS columns (columns create multi-column paste order in PDF extraction). Each tag: `font-family: var(--mono-font)`, `border: 1px solid var(--accent)`, `padding: 2px 6px`, `border-radius: 3px`.

### 3.6 CSS Variables

```css
:root {
  --base-font-size: 10.5pt;  /* slightly smaller — projects + skills need more room */
  --margins: 0.45in;
  --bullet-spacing: 0.12em;
  --accent: #0a7ea4;
  --accent-muted: #5a9db5;
  --mono-font: "JetBrains Mono", "Courier New", monospace;
}
```

### 3.7 ATS Verification

Copy-paste extraction must show:

```
[Name]
[Contact: email | github.com/user | user.dev | location]
[Skills: Python PyTorch Kubernetes ...]  ← flat text, not garbled
[Project Title]
[Stack line: PyTorch · NCCL · Kubernetes]
[Project metric]
[Project bullets]
[Experience entries]
[Education]
```

The skills tag section is the highest ATS risk. If tags render as a CSS grid, copy-paste may read column-by-column instead of row-by-row. Must verify.

### 3.8 Fonts

| Font | Files needed | Source | License |
|------|-------------|--------|---------|
| JetBrains Mono | `jetbrains-mono-latin-400.woff2`, `jetbrains-mono-latin-700.woff2` | JetBrains GitHub releases | OFL — safe to commit |
| Inter | `inter-latin-400.woff2`, `inter-latin-600.woff2` | Google Fonts or rsms/inter GitHub | OFL — safe to commit |

---

## 4. Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `templates/cv/academic-research.html` | **Create** | ~380-420 lines |
| `templates/cv/technical-engineering.html` | **Create** | ~350-380 lines |
| `fonts/eb-garamond-latin-400.woff2` | **Add** | Template 3 |
| `fonts/eb-garamond-latin-700.woff2` | **Add** | Template 3 |
| `fonts/source-sans-pro-latin-400.woff2` | **Add** | Template 3 |
| `fonts/source-sans-pro-latin-600.woff2` | **Add** | Template 3 |
| `fonts/jetbrains-mono-latin-400.woff2` | **Add** | Template 4 |
| `fonts/jetbrains-mono-latin-700.woff2` | **Add** | Template 4 |
| `fonts/inter-latin-400.woff2` | **Add** | Template 4 |
| `fonts/inter-latin-600.woff2` | **Add** | Template 4 |
| `templates/cv/manifest.yml` | **Update** | Set `status: ready` for both; add `font_files` arrays; add placeholder notes |
| `modes/cv.md` | **Update** | Add new template-conditional placeholders to fill-logic table (§ placeholder map); add orcid/google_scholar contact fields to Step 0 contact audit section |
| `config/profile.yml` | **Update** | Add `orcid: ""` field under candidate; confirm `google_scholar` and `github` and `portfolio_url` already present |
| `CONSOLIDATION-PLAN.md` | **Update** | Phase 2b checklist, mark ✅ |

---

## 5. Implementation Steps + Verification

Each step has a concrete verification gate — do not proceed to the next step until the gate passes.

### Step 1: Source and commit font files

Download all 10 woff2 files listed in Section 4. Place in `fonts/`. Each file must be the correct format (a woff2, not renamed from another format — woff2 has a specific binary header).

**Verify:** Write a minimal HTML test file that references all 4 font families. Run `node scripts/generate-pdf.mjs test.html test.pdf`. Open the PDF — each font name must render visibly in its own weight. If a font falls back to the system default, the woff2 download was wrong.

### Step 2: Build Template 3 (Academic/Research)

Write `templates/cv/academic-research.html`. Structure:
1. Copy the CSS variable block from `classic-professional.html` as a starting point
2. Replace font declarations with EB Garamond + Source Sans Pro
3. Remove accent color — set `--accent: #000`, `--accent-muted: #555`
4. Build the section order: Research Interests → Education Featured → Publications → Research Experience → Industry Experience → Skills → Grants & Awards
5. Add publication entry CSS (`.pub-entry`, `.pub-doi`)
6. Add `{{GOOGLE_SCHOLAR_URL}}` and `{{ORCID}}` to contact row (omit if empty — use conditional comments in HTML for the drafter to handle)

**Verify (visual):** Fill all placeholders with mock academic data (PhD in computational biology, 3 publications, 2 grants). Generate PDF. Confirm:
- EB Garamond renders for headings
- No accent color anywhere
- Publications section shows DOI as clickable link
- Education appears above Experience

**Verify (ATS):** Copy all text from the PDF. Paste into a plain text editor. Confirm reading order matches Section 2.6. No garbled characters.

### Step 3: Build Template 4 (Technical/Engineering)

Write `templates/cv/technical-engineering.html`. Structure:
1. Copy CSS variable block from `ats-optimized.html` as a starting point
2. Replace fonts with JetBrains Mono + Inter
3. Set `--accent: #0a7ea4`
4. Build skills tag section (flexbox wrap, not grid, not columns)
5. Build project cards with stack line and metric
6. Add GitHub/portfolio styled links to contact row
7. Section order: Skills Grid → Projects → Experience → Education → Certifications

**Verify (visual):** Fill with mock data (ML engineer: Python/PyTorch/K8s, 3 projects with metrics). Generate PDF. Confirm:
- JetBrains Mono renders on skill tags
- Teal accent on section headers and tag borders
- Project cards show stack line and metric above bullets
- GitHub link styled distinctly

**Verify (ATS):** Copy all text. Paste into editor. Skills must read as flat text (not column-by-column), project names must appear before bullets.

### Step 4: Update manifest.yml

For both templates:
- Set `status: "ready"`
- Add `font_files` array with exact filenames
- Add `conditional_placeholders` note listing the template-specific fields

**Verify:** Read `templates/cv/manifest.yml`. All 4 templates have `status: "ready"`. Font file names listed match actual files in `fonts/`.

### Step 5: Update modes/cv.md placeholder table

In `modes/cv.md`, find the placeholder map table (Step 1 of the drafter workflow). Add rows for:
- `{{RESEARCH_INTERESTS}}` — Template 3 only; synthesise from cv.md research section
- `{{PUBLICATIONS}}` — Template 3 only; from cv.md publications; omit section if empty
- `{{EDUCATION_FEATURED}}` — Template 3 only; full education entry from cv.md
- `{{GRANTS_AWARDS}}` — Template 3 only; from cv.md; omit section if empty
- `{{GOOGLE_SCHOLAR_URL}}` — Template 3 only; from profile.yml
- `{{ORCID}}` — Template 3 only; from profile.yml
- `{{TECH_STACK}}` — Template 4 only; 12-18 JD-relevant skills from cv.md skills section
- `{{GITHUB_URL}}` — Template 4 only; from profile.yml
- `{{PORTFOLIO_URL}}` — Template 4 only; from profile.yml

Also: add `orcid` to the contact audit step (Step 0d) so `scripts/audit-contact.mjs` knows it exists.

**Verify:** Read the placeholder table in `modes/cv.md`. All 9 new entries present with correct template scope labels.

### Step 6: Update config/profile.yml

Add `orcid: ""` field under `candidate:` with an inline comment (leave blank to omit from CV). Confirm `google_scholar`, `github`, and `portfolio_url` are already present from Phase 2 polish.

**Verify:** Read `config/profile.yml`. All contact fields present. No duplicate keys.

### Step 7: All-4-templates comparison test

Using a single evaluation report, generate CVs in all 4 templates for the same JD. Compare:
- Content is the same (same bullets, same keywords) — only layout differs
- All 4 PDFs are 1-2 pages
- ATS text extraction works for all 4
- Each template's visual design clearly matches its intended audience
- Template 3: publications section renders correctly with mock DOI data
- Template 4: skills tags render as flat text in ATS extraction, not garbled

**Final gate:** If all 7 steps pass, update `CONSOLIDATION-PLAN.md` Phase 2b checklist to ✅.

---

## 6. Open Questions for Gemini Review

These are genuine design decisions — not rhetorical. Please investigate and give a recommendation with reasoning.

**Q1 — Publication entry format:** Should `{{PUBLICATIONS}}` be a structured format (the drafter builds each entry from parsed citation fields: authors / title / venue / year / DOI) or free-form markdown (drafter copies the candidate's publication list from cv.md and reformats lightly)? Structured gives richer HTML; free-form is simpler and less likely to introduce drafter hallucinations on citation details.

**Q2 — Skills grid layout for Template 4:** CSS flexbox wrap vs. CSS multi-column for skill tags. Flexbox wraps naturally and produces correct left-to-right paste order. CSS columns are simpler CSS but produce column-by-column paste order in many PDF viewers. Is there a CSS approach that gets the visual layout of columns with the paste order of flexbox?

**Q3 — Education placement in Template 4:** For senior IC engineers (10+ YOE), Education is low-signal — it belongs at the bottom. For early-career engineers (0-5 YOE), it belongs near the top. Should the template have a fixed order, or should `modes/cv.md` instruct the drafter to move Education based on the candidate's experience level?

**Q4 — Font fallback chain for Template 3:** If `eb-garamond-latin-400.woff2` is missing or fails to load, Playwright will fall back to a system font. The fallback should be: EB Garamond → Georgia → Times New Roman. Is this acceptable, or should `generate-pdf.mjs` detect missing custom fonts and warn before PDF generation?

**Q5 — Port manifest:** Do the new woff2 font files belong in `config/port-manifest.yml`? They are system layer files (always re-cloned from the repo), so users should NOT need to port them. But if a user has customised font files (e.g., added a proprietary corporate font for their employer's brand), those should be portable. Recommendation: system fonts stay system layer; add a note in port-manifest.yml that `fonts/` is system layer but user-added fonts should be manually noted.

**Q6 — `{{PUBLICATIONS}}` and the reviewer:** The reviewer currently receives plain text content from the drafter. For publications, the reviewer can't verify DOI links or check whether citation details are accurate (that would require the reviewer to cross-reference external databases). Should the reviewer skip publication verification entirely, or add a specific instruction to "flag any publication entry where the author list, year, or venue looks inconsistent with the rest of the CV"?

**Q7 — Template 3 page count:** Academic CVs are commonly 2-5 pages (unlike industry CVs which target 1-2). Should Template 3 have a different `target_pages` setting, or should it still cap at 2 pages by default? If we relax the page limit, the cutting logic in `modes/cv.md` needs a conditional.

---

## 7. What Is NOT Changing

To be explicit — the following are **in scope for Gemini to verify the plan does not accidentally break**:

- `modes/cv.md` drafter-reviewer workflow — no structural changes, only additions to the placeholder table
- `scripts/generate-pdf.mjs` — zero changes
- Template 1 and Template 2 — zero changes
- The scoring system, evaluation blocks — not touched
- `config/port-manifest.yml` — only the note about `fonts/` may be added; no structural change

---

## 8. Gemini Review Log

_(to be filled after Gemini review)_

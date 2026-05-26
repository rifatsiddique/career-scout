# Phase 2b: CV Templates 3 & 4 (Academic/Research + Technical/Engineering)

**Version:** 1.3
**Last Updated:** 2026-05-26 -- v1.3: Incorporated Gemini review round 3 (HM perspective) — tech stack proficiency split (Core/Production vs Tools/Exposure), Problem→Technical Choice→Result project card structure, Lab & Debugging subsection for T4B, physical metrics in hardware cards, patents-first ordering in biotech layouts
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
| `templates/cv/manifest.yml` | **Update** | Set `status: ready` for both; add `font_files` arrays; add `max_pages: 4` for Template 3; add placeholder notes |
| `modes/cv.md` | **Update** | Add new template-conditional placeholders to fill-logic table; add orcid/google_scholar/work_auth/patent_url contact fields to Step 0 contact audit; add archetype-aware template selector (Step 0a) with sub-layout recommendation; add page-count conditional for Template 3; add reviewer scope boundary for publications; add T4B hardware sub-layout drafter instructions; add T3B biotech sub-layout drafter instructions; add T1B PhD-transition drafter instructions |
| `config/profile.yml` | **Update** | Add `orcid: ""`, `work_authorization: ""`, `patent_url: ""` fields under candidate; confirm `google_scholar`, `github`, `portfolio_url` already present |
| `fonts/user/.gitkeep` | **Create** | Empty placeholder so the user/ subdirectory exists in the repo |
| `config/port-manifest.yml` | **Update** | Add `fonts/user/` as a portable path with a note explaining user-added fonts live here |
| `modes/port.md` | **Update** | Mention `fonts/user/` in the file migration checklist |
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
- `{{TECH_STACK}}` — Template 4A only; 12-18 JD-relevant skills from cv.md skills section
- `{{GITHUB_URL}}` — Template 4A only; from profile.yml
- `{{PORTFOLIO_URL}}` — Template 4A only; from profile.yml
- `{{HARDWARE_PROJECTS}}` — Template 4B only; tape-outs, board designs, shipped products from cv.md
- `{{PATENT_URL}}` — Template 4B, 2B only; from profile.yml (omit if empty)
- `{{PATENT_LIST}}` — Template 4B, 2B only; curated patent entries from cv.md; omit section if empty

Also: add `orcid`, `patent_url` to the contact audit step (Step 0d).

**Verify:** Read the placeholder table in `modes/cv.md`. All 12 new entries present with correct template scope labels.

### Step 6: Update config/profile.yml

Add `orcid: ""`, `work_authorization: ""`, and `patent_url: ""` fields under `candidate:` with inline comments (leave blank to omit from CV). Confirm `google_scholar`, `github`, and `portfolio_url` are already present from Phase 2 polish.

**Verify:** Read `config/profile.yml`. All contact fields present. No duplicate keys.

### Step 7: All-4-templates + sub-layout comparison test

Using a single evaluation report, generate CVs in all 4 templates for the same JD. Also generate T4B (hardware) and T3B (biotech industry) with domain-appropriate mock data. Compare:
- Content is the same across T1A/T2A/T3A/T4A — only layout differs
- T3A: up to 4 pages; all others 1-2 pages
- ATS text extraction works for all templates — no garbled skills, no column-order issues
- T4A: teal accent, flat software tags, GitHub link visible
- T4B: copper-bronze accent, 3-category hardware matrix, no GitHub, patent link visible
- T3A: EB Garamond, education above experience, full publication list
- T3B: 2-page cap enforced, experience above education, condensed pubs at bottom
- T1B: PhD dissertation rendered as an Experience entry, not under Education
- Template selector shows archetype-aware recommendation with correct sub-layout detected

**Final gate:** If all 7 steps pass, update `CONSOLIDATION-PLAN.md` Phase 2b checklist to ✅.

---

## 6. Gemini Review — Resolved Questions

All Q1-Q7 resolved. Implementation decisions locked.

**Q1 ✅ — Publication entry format:** Use **hybrid format**: the drafter receives free-form publication text from cv.md and reformats it into the `<div class="pub-entry">` HTML structure without parsing individual citation fields. This avoids hallucination risk on author names, years, and DOIs — the drafter copies, not constructs. The reviewer checks internal consistency only (Q6 answer).

**Q2 ✅ — Skills grid layout:** **Flexbox wrap confirmed** — `display: flex; flex-wrap: wrap` on the container. No CSS columns. Left-to-right paste order is guaranteed. Each `<span class="skill-tag">` is a self-contained flex item. Already reflected in §3.5.

**Q3 ✅ — Education placement in Template 4:** **Dynamic placement by experience level.** `modes/cv.md` instructs the drafter:
- 0-4 YOE (inferred from graduation year and experience entries): place Education after Skills and Projects but before Experience
- 5+ YOE: place Education after Experience (near bottom)
The template HTML will have an `<!-- EDUCATION_BLOCK -->` comment as a placeholder; the drafter fills it at the correct position.

**Q4 ✅ — Font fallback chain:** Fallback chain: `"EB Garamond", "Georgia", "Times New Roman", serif`. Additionally, `generate-pdf.mjs` logs a warning (not error) when a woff2 file is not found at the expected path before launching Playwright. Generation continues but the operator knows the PDF may use fallback fonts.

**Q5 ✅ — Port manifest and fonts:** System-layer fonts (`fonts/*.woff2` committed to the repo) do NOT go in port-manifest.yml — they re-clone with the repo. Create a `fonts/user/` subdirectory for any fonts the user adds that are not part of the repo (e.g., proprietary employer branding fonts). Add `fonts/user/` to port-manifest.yml as a portable path. Update `modes/port.md` to mention `fonts/user/` with instructions.

**Q6 ✅ — Reviewer and publications:** The reviewer does an **internal consistency audit only** — it checks that author names and institutions are consistent with the Experience section, that years are plausible, and that the venue name looks like a real journal/conference. The reviewer explicitly does NOT fetch DOIs or cross-reference external databases. Add this scope boundary to `modes/cv.md`.

**Q7 ✅ — Template 3 page count:** Lift the cap to **4 pages** for Template 3. Add a `max_pages: 4` field to the manifest entry. Update the cutting logic in `modes/cv.md` with a conditional: `if template == "academic-research": target 2-4 pages; else: target 1-2 pages`. Anything beyond 4 pages still triggers a warning asking the user to review and trim.

---

## 6b. Additional Gemini Findings

These were not in the original open questions but Gemini flagged them as high-value additions.

### 6b.1 Domain-Specific Skill Splits for Template 4

Generic "Skills" as a flat tag cloud loses signal for domain experts. Gemini recommends category groupings by domain:

**Electrical / Hardware engineering:**
- "Design & Simulation Tools" — SPICE, MATLAB/Simulink, Altium, KiCad, ANSYS
- "Hardware & Lab Equipment" — oscilloscopes, power analyzers, bench power supplies, soldering
- "Standards & Protocols" — IEC 61000, IEEE 802.3, MISRA C, ISO 26262

**Software / ML engineering (existing):**
- Languages → Frameworks → Tools/Platforms (existing order, keep)

**Biotech / Life sciences:**
- "Computational Tools" — Python, R, BioPython, Seurat, DESeq2
- "Wet Lab Techniques" — PCR, FACS, CRISPR, cell culture
- "Instruments" — flow cytometers, mass spectrometers, sequencers

**Implementation:** `modes/cv.md` drafter instruction: "If the archetype is hardware/EE or biotech, split Skills into sub-groups using `<h4>` headings within the `{{TECH_STACK}}` block. If archetype is SWE/ML, use flat tags." The HTML template must support both — `{{TECH_STACK}}` can be either flat `<span>` tags or grouped `<h4>` + `<span>` blocks.

### 6b.2 Work Authorization Placement

Work auth is legally sensitive and easily triggers recruiter bias if placed prominently. Recommended approach:
- Do NOT add a `{{WORK_AUTH}}` placeholder to the template header
- If the user's profile.yml has `work_authorization: "US Citizen"` or similar: the drafter includes a single line at the bottom of the contact row — `"Authorization: US Citizen"` or `"Open to visa sponsorship"`
- If `work_authorization` is blank/empty: omit the field entirely — no mention
- Update `modes/cv.md` Step 0 contact audit to check for this field and apply the conditional

### 6b.3 Interactive Template Selector

When `cv` mode is run without a template override, present the user with a concise selection prompt before generating:

```
Which CV template?
  1. ATS-Optimized      — keyword density, plain layout, beats Lever/Greenhouse parsers
  2. Classic Professional — clean traditional layout, strong for consulting/finance roles
  3. Academic/Research   — EB Garamond, publications + research focus, up to 4 pages
  4. Technical/Engineering — skills grid + project cards, signals IC builder
  [Default: profile.yml archetype-to-template mapping → Template 1]
```

If the user types a number, override the profile.yml default for this run only. If the user presses Enter, use the profile.yml default. Implement in `modes/cv.md` as a new Step 0a before the drafter starts.

### 6b.4 Biotech Bridge Section (Template 3 Extension)

For biotech researchers applying to industry roles, academic CVs often need an "Industry Translation" section that reframes academic accomplishments in business language. This is NOT a new placeholder — it's a drafter instruction in `modes/cv.md`: if archetype includes "biotech" or "life-sciences" and the target role is "industry" (not academic), the drafter adds a brief (2-3 sentence) bridge paragraph to the Research Interests section explaining how the research translates to industry impact.

---

## 6c. Gemini Review Round 2 — Sub-Layout Architecture

### Findings accepted

**Core finding:** Template 4 is SWE-biased; Template 3 is academia-biased; neither serves the mid-senior EE or the PhD-to-industry transitioner well.

**Gemini's recommendation:** A "polymorphic template" system — 4 base templates × 2 sub-layouts each via CSS body class + conditional sections. No new HTML files.

**Our acceptance:** Yes, with one adjustment to Gemini's `{{#if}}` syntax — we don't have a Handlebars engine. Sub-layouts are implemented via:
1. CSS `body.layout-X` class (the drafter injects this into the HTML)
2. Drafter instructions in `modes/cv.md` specify which sections to include/omit/reorder per sub-layout
3. The HTML templates include all sections; CSS hides unused ones via `body.layout-software .hardware-only { display: none; }` and vice versa

### Sub-layout map (final decisions)

| Template | Sub-layout A (default) | Sub-layout B (variant) |
|----------|------------------------|------------------------|
| T1: ATS-Optimized | General Corporate | PhD-to-Industry Transition |
| T2: Classic Professional | Business & Leadership | Biotech Industry Specialist |
| T3: Academic/Research | Pure Academia / Postdoc | Biotech R&D / Lab Scientist |
| T4: Technical/Engineering | Software & ML Engineer | Hardware & Systems EE |

### 6c.1 T4B — Hardware & Systems EE sub-layout

**Body class:** `<body class="layout-hardware-ee">`

**Changes from T4A (Software/ML):**
- Accent color: `#8c6239` (copper-bronze) instead of teal `#0a7ea4`
- Contact row: LinkedIn link + `{{PATENT_URL}}` (if set) instead of GitHub + portfolio
- Skills section: 3-category hardware matrix (see §6b.1) instead of flat tag cloud
- Projects section renamed to "Tape-outs, Board Designs & Shipped Products" — uses new placeholder `{{HARDWARE_PROJECTS}}`
- No GitHub or portfolio links

**New placeholders for T4B:**

| Placeholder | Description | Source | Required? |
|-------------|-------------|--------|-----------|
| `{{HARDWARE_PROJECTS}}` | Tape-outs, board designs, shipped products — each with: product name, technology node / layer count, key metric (yield, EMC class, production volume) | cv.md projects/products section | Yes for T4B; omit for T4A |
| `{{PATENT_URL}}` | Link to Google Patents or USPTO profile | `config/profile.yml → candidate.patent_url` | Optional — omit if empty |
| `{{PATENT_LIST}}` | Curated patent list (1-4 entries): number, title, filing year | cv.md patents section | Optional — section omitted if empty |

**Hardware project card format:**
```html
<div class="project-card">
  <div class="project-header">
    <span class="project-title">48V-to-1V Intermediate Bus Converter ASIC</span>
    <span class="project-stack">TSMC 28nm · 12-layer PCB · DDR4 routing</span>
  </div>
  <div class="project-metric">Taped out Q3 2023 — 94% first-silicon yield; production at 50k units/yr</div>
  <ul class="project-bullets">
    <li>...</li>
  </ul>
</div>
```

**CSS hiding strategy:**
```css
body.layout-software .hardware-only { display: none; }
body.layout-hardware-ee .software-only { display: none; }
```

All hardware-specific sections/elements get `class="hardware-only"`. All software-specific sections get `class="software-only"`. The drafter picks the body class; the CSS hides the rest.

### 6c.2 T3B — Biotech R&D / Lab Scientist sub-layout

**Body class:** `<body class="layout-biotech-industry">`

**Changes from T3A (Pure Academia):**
- Page cap: **2 pages** (not 4) — industry biotech hiring managers reject long academic CVs
- Section order: Header → R&D & Pipeline Experience → Scientific Skills Matrix → Education → Selected Patents & Publications (condensed, 3 entries max) → Grants & Awards
- Research Interests section replaced by a Pipeline Impact statement (2-3 sentences, pipeline progression framing)
- Publications: moved to bottom, max 3 entries, condensed format (no full author list — just "Smith J. et al.")

**Drafter instruction addition to `modes/cv.md`:** If archetype includes "biotech" or "life-sciences" AND target role is "industry" (not "academic"), suggest T3B by default instead of T3A. Show this in the template selector with a justification line.

### 6c.3 T1B — PhD-to-Industry Transition sub-layout

**Body class:** `<body class="layout-phd-transition">`

**Changes from T1A (General Corporate):**
- Dissertation promoted to Experience section: rendered as a work experience entry ("Graduate Researcher, [University], [start]–[end]") with engineering-metric bullets, not a sub-bullet under Education
- Education section: condensed to degree + year only (thesis title moved to the Experience entry)
- Skills section elevated above Experience — PhD candidates need skills visibility since Experience looks thin

**Drafter instruction:** If candidate has `education.degree` containing "PhD" or "Doctorate" AND `work_experience` has ≤1 entry (0-2 YOE industry), default to T1B and note this in the template selector.

**No new placeholders needed** — uses existing `{{EDUCATION}}` and `{{EXPERIENCE}}` with a different drafter composition rule.

### 6c.4 T2B — Biotech Industry Specialist sub-layout

**Body class:** `<body class="layout-biotech-business">`

**Changes from T2A (Business & Leadership):**
- Bottom section: "Selected Patents & Publications" (condensed, using `{{PATENT_LIST}}`)
- Scientific credibility line added to Summary/Profile section (e.g., "Inventor on 3 US patents; senior author on Nature Methods paper")
- Uses `{{PATENT_LIST}}` placeholder (shared with T4B)

### 6c.5 Updated template selector (replaces §6b.3)

The selector now recommends a specific sub-layout based on archetype detection, not just a numbered list:

```
Recommended template (based on your archetype):
  🎯 Template 4 — Hardware & Systems EE layout
     Why: Hardware EE archetype detected. This layout uses a copper-bronze theme,
     suppresses GitHub links, and renders your skills as a lab/simulation matrix
     instead of a software tag cloud.

  [Enter] Accept recommendation
  [1]  T1A: ATS-Optimized — General Corporate
  [1b] T1B: ATS-Optimized — PhD-to-Industry (promotes dissertation to Experience)
  [2]  T2A: Classic Professional — Business & Leadership
  [2b] T2B: Classic Professional — Biotech Industry Specialist
  [3]  T3A: Academic/Research — Pure Academia / Postdoc (up to 4 pages)
  [3b] T3B: Academic/Research — Biotech R&D Industry (2-page cap, experience-first)
  [4]  T4A: Technical/Engineering — Software & ML Engineer
  [4b] T4B: Technical/Engineering — Hardware & Systems EE
```

The recommendation is a single line added before the list. The user can always override by typing a number.

### 6c.6 What was pushed back from Gemini round 2

- `{{#if}}` Handlebars syntax: not implemented — we use CSS body-class hiding + drafter conditional instructions instead. Simpler, no new engine, same result.
- "Massive library" of 8+ separate HTML files: not implemented — 2 HTML files with CSS sub-layouts.
- Per-template accent colors are accepted (copper-bronze for T4B) but the exact hex is ours to set, not Gemini's.

## 6d. Gemini Review Round 3 — Hiring Manager Perspective

### Findings accepted

**Source:** Gemini evaluated templates through 3 HM personas — SWE/ML, Electrical Engineering, and Biotech/Pharma R&D.

---

### 6d.1 Tech Stack Proficiency Split (T4A — SWE/ML)

**Problem:** A flat tag cloud of 18 tools signals keyword-stuffing to a technical HM. They can't tell if the candidate uses Python in production or completed a weekend tutorial.

**Fix:** Split `{{TECH_STACK}}` into two tiers instead of a flat list:

```html
<!-- {{TECH_STACK}} renders as two labeled rows: -->
<div class="skills-section">
  <div class="skills-tier">
    <span class="skills-tier-label">Core / Production</span>
    <div class="skills-grid">
      <span class="skill-tag skill-core">Python</span>
      <span class="skill-tag skill-core">PyTorch</span>
      <span class="skill-tag skill-core">Kubernetes</span>
    </div>
  </div>
  <div class="skills-tier">
    <span class="skills-tier-label">Tools / Exposure</span>
    <div class="skills-grid">
      <span class="skill-tag skill-exposure">Go</span>
      <span class="skill-tag skill-exposure">Terraform</span>
    </div>
  </div>
</div>
```

**Drafter instruction (addition to `modes/cv.md`):** When filling `{{TECH_STACK}}` for T4A, split skills into two groups. "Core / Production": technologies used in the candidate's primary work (daily use, shipped code). "Tools / Exposure": technologies used in side projects, course work, or occasional scripts. Cap Core at 10 items, Exposure at 8 items. If the distinction can't be determined from cv.md, ask the user before generating.

**CSS:** `skill-core` tags: solid teal border. `skill-exposure` tags: dashed teal border (visually lighter but still scannable).

---

### 6d.2 Project Card Structure Update (T4A and T4B)

**Problem:** "Metric + bullets" is still too shallow for a technical HM. They want to know *why* the candidate made the choices they did — what tradeoffs were considered.

**Updated project card format** (replaces §3.4 for T4A, and the hardware format in §6c.1 for T4B):

```html
<div class="project-card">
  <div class="project-header">
    <span class="project-title">Distributed Training Harness</span>
    <span class="project-stack">PyTorch · NCCL · Kubernetes · AWS</span>
  </div>
  <div class="project-problem">Problem: single-GPU training bottleneck at 100M parameter models</div>
  <div class="project-choice">Decision: NCCL ring-allreduce over parameter server — 3× better bandwidth at 8 GPUs</div>
  <div class="project-metric">Result: training time reduced 40% across 8-GPU cluster</div>
  <ul class="project-bullets">
    <li>...</li>
  </ul>
</div>
```

**Fields:**
- `project-problem` — one line: what was broken, slow, or missing (factual, no buzzwords)
- `project-choice` — one line: the architectural or technical decision made and why (must name the alternative considered)
- `project-metric` — one line: quantified outcome
- `project-bullets` — 2-3 supporting details

**Drafter rule:** All three primary fields (problem, choice, metric) are required. If cv.md doesn't have enough information to fill `project-choice`, prompt the user with a specific question: "For project [name]: what was the key technical decision you made, and what alternative did you reject?"

**ATS note:** `project-problem`, `project-choice`, and `project-metric` are plain `<div>` with text content — safe for extraction.

---

### 6d.3 Lab & Debugging Capabilities Subsection (T4B — Hardware EE)

**Problem:** Hardware HMs want to know the candidate can debug in the lab at 2am, not just design on paper. The T4B skills matrix (§6b.1) doesn't explicitly call out debugging tools.

**Fix:** Add a fourth category to the hardware skills matrix:

**Updated T4B skills matrix (4 categories, not 3):**
- "Design & Simulation Tools" — Altium, Cadence, LTspice, ANSYS, MATLAB/Simulink
- "Hardware & Lab Equipment" — oscilloscopes, power analyzers, bench supplies, VNAs, soldering stations
- **"Debug & Bring-Up"** — TDR oscilloscopes, spectrum analyzers, thermal cameras, logic analyzers, signal integrity tools, JTAG debuggers
- "Standards & Protocols" — IEC 61000, PCIe Gen 4, DDR4, MISRA C, ISO 26262

This is a CSS/HTML addition within the existing `layout-hardware-ee` body class section. The drafter populates "Debug & Bring-Up" from cv.md tools/equipment mentions; if absent, the category is omitted (same rule as other optional sections).

---

### 6d.4 Physical Metrics in Hardware Project Cards (T4B)

**Problem:** Hardware projects without physical specs look like student projects. A HM expects to see layer counts, power levels, and speed standards.

**Updated hardware project card format** (extends §6c.1, applies §6d.2 problem/choice/result structure):

```html
<div class="project-card hardware-only">
  <div class="project-header">
    <span class="project-title">48V-to-1V Intermediate Bus Converter ASIC</span>
    <span class="project-stack">TSMC 28nm · 12-layer PCB · DDR4/PCIe Gen 4</span>
  </div>
  <div class="project-specs">10W · 94% efficiency · −40°C to 125°C operating range</div>
  <div class="project-problem">Problem: discrete solution exceeded board area budget by 40%</div>
  <div class="project-choice">Decision: integrated ASIC over module — met thermal envelope without heatsink at production volume</div>
  <div class="project-metric">Result: taped out Q3 2023; 94% first-silicon yield; 50k units/yr production</div>
  <ul class="project-bullets"><li>...</li></ul>
</div>
```

`project-specs` is a new line (physical parameters: power, efficiency, temperature, layer count, voltage rails). Required for T4B; omitted for T4A.

---

### 6d.5 Patents-First Ordering in Biotech Layouts (T3B and T2B)

**Problem:** Publications are currently listed before patents in the T3B/T2B condensed bottom section. Biotech HMs at pharma/startup value patents higher — they represent commercial IP, not academic output.

**Fix:** Section order in T3B and T2B biotech layouts: "Patents" subsection (styled with a distinct label) appears before "Selected Publications." If no patents exist, the subsection is omitted without affecting the Publications block.

**Updated bottom-of-CV section structure (T3B and T2B):**
```
Patents (if any) — {{PATENT_LIST}}
Selected Publications (max 3, condensed) — {{PUBLICATIONS}} (capped)
```

**`{{RESEARCH_INTERESTS}}` forward-looking instruction (T3A and T3B):** Add drafter rule to `modes/cv.md`: the Research Interests section must be written as a forward-looking scientific thesis statement — i.e., what problem the candidate intends to solve and why it matters commercially or scientifically. It must NOT be a backward-looking summary of past work (that belongs in Experience). Ask the user: "What research direction are you most actively pursuing?" if cv.md only describes completed work.

---

### 6d.6 What was pushed back from Gemini round 3

- `templates/writing-rules.md` reference: Gemini invented this filename. Anti-slop rules live in `modes/_shared.md`. No new file needed.
- General validation of Anti-Slop rules: confirmed, no plan change required.

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

| Date | Round | Summary |
|------|-------|---------|
| 2026-05-26 | Round 1 | All Q1-Q7 resolved. Added domain-specific skill splits (6b.1), work auth placement strategy (6b.2), interactive template selector (6b.3), biotech bridge section (6b.4). Plan updated to v1.1. |
| 2026-05-26 | Round 2 | Persona analysis (Mid-Senior EE, Biotech Specialist, PhD Transitioner). Sub-layout architecture adopted: T4B Hardware EE (copper-bronze, hardware projects, lab matrix), T3B Biotech Industry (2-page, experience-first, condensed pubs), T1B PhD-to-Industry (dissertation→Experience block), T2B Biotech Business (patent list at bottom). CSS body-class hiding strategy. `{{GITHUB_URL}}` syntax rejected for T4B. New placeholders: {{HARDWARE_PROJECTS}}, {{PATENT_URL}}, {{PATENT_LIST}}. Handlebars `{{#if}}` syntax rejected — drafter instructions + CSS used instead. Plan updated to v1.2. |
| 2026-05-26 | Round 3 | HM perspective (SWE/ML HM, EE HM, Biotech/Pharma HM). Tech stack proficiency split: Core/Production vs Tools/Exposure tiers (§6d.1). Project card updated to Problem→Technical Choice→Result structure, drafter must name the alternative rejected (§6d.2). T4B: Lab & Debugging subsection added as 4th skills category (§6d.3). Hardware project cards get physical specs line (§6d.4). Biotech layouts: Patents subsection before Publications, {{RESEARCH_INTERESTS}} must be forward-looking not backward-looking (§6d.5). `templates/writing-rules.md` filename rejected — anti-slop lives in `modes/_shared.md`. Plan updated to v1.3. |

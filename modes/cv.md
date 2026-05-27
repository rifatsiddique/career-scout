# Mode: cv — Tailored CV Generation

Generates a tailored PDF CV from the evaluation report, master CV, and candidate profile.
Uses a drafter-reviewer workflow for high-fit applications.

---

## Step 0: Data Gathering (ALL reads before any output)

LLM streaming cannot pause mid-output. Complete ALL reads here before writing anything.

### 0a. Parse flags

Check for these flags in the user's invocation:

| Flag | Effect |
|------|--------|
| `--fast` / `--draft-only` | Set `FAST_MODE = true` — skips reviewer, backtrack test, and PDF |
| `--docx` | Set `DOCX_MODE = pdf_and_docx` — generate both PDF and DOCX |
| `--docx-only` | Set `DOCX_MODE = docx_only` — generate DOCX only, skip PDF |

Defaults: `FAST_MODE = false`, `DOCX_MODE = none`

If `--fast` is set:
- FAST_MODE skips the reviewer, backtrack test, and PDF generation
- The drafter fills the template, writes HTML to disk, reports the path, and exits
- Proceed to Step 1 with `FAST_MODE` set

### 0b. Dependency check

| File | Action if missing |
|------|-------------------|
| `cv.md` | Stop. Tell user: "cv.md is empty — run setup first or paste your CV." |
| `config/profile.yml` | Stop. Tell user: "profile.yml not configured — run setup first." |
| `modes/_profile.md` | Warn, continue with reduced tailoring |

### 0c. Locate the evaluation report

The cv mode operates on a specific evaluation report. Determine which one:
1. If user specified a report number or company name → find the matching file in `reports/`
2. If no report specified → use the most recently modified file in `reports/`
3. If `reports/` is empty → stop: "No evaluation reports found. Evaluate a job posting first."

Read the evaluation report. Extract and store:
- Company name and role title (for filename slugging)
- Composite score (for workflow routing)
- Block C content (Level & Strategy — positioning constraint)
- Block E content (Personalization Plan — top CV changes)
- Report file path (for appending Section I later)
- Report number (3-digit prefix)
- JD text or URL (from report header)

If the report does not contain JD text: read the source URL if available,
or note "JD not available in report — tailoring will rely on Block E only."

**Score gate:** If composite score < 65:
> "This role scored {N}/100 — below the recommended threshold for CV generation (65+).
> Generating a CV for a poor-fit role wastes your time and the reviewer's.
> Type 'yes' to proceed anyway, or 'no' to cancel."
> **STOP. Wait for user confirmation before continuing.**
> If user says no: exit. If user says yes: proceed with a note in the discard summary.

### 0d. Read user context files

1. `config/profile.yml` — candidate identity, market, comp targets
2. `modes/_profile.md` — archetypes, behavioral profile, **CV Generation Rules**, writing style
3. `cv.md` — master CV (full content)
4. `article-digest.md` — if it exists, read for proof point details

**After reading profile.yml, immediately print the contact audit report:**

```
⚠️  Contact info status (from config/profile.yml):
  ✅ Name: {full_name value}
  ✅ Email: {email value}
  ❌ Phone: not set — will be OMITTED from CV (not fabricated)
  ✅ Location: {location value}
  ❌ LinkedIn: not set — will be OMITTED from CV
  ❌ Google Scholar: not set — will be OMITTED (Template 3 contact row)
  ❌ ORCID: not set — will be OMITTED (Template 3 contact row)
  ❌ GitHub: not set — will be OMITTED (Template 4A contact row)
  ❌ Portfolio URL: not set — will be OMITTED (Template 4A contact row)
  ❌ Patent URL: not set — will be OMITTED (Template 4B contact row)
  ❌ Work Authorization: not set — will be OMITTED from CV
  ...
```

Only show the fields relevant to the selected template. Template 3: show Google Scholar + ORCID. Template 4A: show GitHub + Portfolio. Template 4B: show Patent URL. Always show: Name, Email, Phone, Location, LinkedIn, Work Auth.

Print ✅ for any field that has a non-empty value; ❌ for any field that is empty.
If ANY contact field is empty, ask the user:
> "Some contact fields are missing (see above). Type **continue** to generate the CV with
> those fields omitted, or **pause** to add them to config/profile.yml first."
> **STOP. Wait for response before proceeding.**

If all fields are populated: skip the prompt and continue silently.
If user responds "pause": exit and let them fill in profile.yml before re-running.

### 0e. Determine template and sub-layout

**Step 1 — Resolve template:**
```
1. If user explicitly named a template (e.g., "use academic-research" or "use T4B") → use that
2. Check profile.yml → cv.template_overrides for a mapping matching the detected archetype
3. Fall back to profile.yml → cv.default_template (default: "classic-professional")
```

Read `templates/cv/manifest.yml` to validate the selected template file exists and has `status: "ready"`.
If status is "planned": tell user this template is not yet implemented, fall back to "classic-professional".

**Step 2 — Determine sub-layout** (Templates 3 and 4 only):

For Template 3 (`academic-research`):
- Default sub-layout: `layout-academic` (Pure Academia)
- Override to `layout-biotech-industry` if archetype includes "biotech" or "life-sciences" AND the target role appears to be industry (not academic). Apply automatically if the JD mentions GMP/GLP, pipeline, IND, or clinical. Confirm with user if ambiguous.

For Template 4 (`technical-engineering`):
- Default sub-layout: `layout-software` → set `{{SUBLAYOUT}}` to `layout-software`
- Override to `layout-hardware-ee` → set `{{SUBLAYOUT}}` to `layout-hardware-ee` if archetype includes "hardware", "EE", "electrical", "embedded", "RF", or "semiconductor"

**Step 3 — Show archetype-aware recommendation prompt** (only if template not explicitly specified by user):

```
📐 Recommended template (based on your archetype):
  🎯 {Template Name} — {Sub-layout Name}
     Why: {one sentence citing something specific from the JD that makes this template the right fit
           — e.g. "The JD emphasises hardware bring-up and Altium, so T4b's hardware skills matrix
           and project cards lead with exactly what this hiring manager is scanning for."
           Do NOT give a generic reason. Anchor it to a word or phrase from the actual job description.}

  [Enter] Accept recommendation
  [1]  T1: ATS-Optimized — General Corporate (keyword density, Lever/Greenhouse safe)
  [1b] T1b: ATS-Optimized — PhD-to-Industry (dissertation promoted to Experience block)
  [2]  T2: Classic Professional — Business & Leadership (consulting, finance, enterprise)
  [2b] T2b: Classic Professional — Biotech Industry (patents + condensed pubs at bottom)
  [3]  T3: Academic/Research — Pure Academia (EB Garamond, full pubs, up to 4 pages)
  [3b] T3b: Academic/Research — Biotech R&D Industry (experience-first, 2-page cap)
  [4]  T4: Technical/Engineering — Software & ML (teal, GitHub, tiered skill tags)
  [4b] T4b: Technical/Engineering — Hardware & Systems EE (copper-bronze, hardware matrix)
```

**STOP. Wait for user input.** If the user presses Enter: use the recommendation. If the user types a number/letter: switch to that template and sub-layout. Store the result as `TEMPLATE_ID` and `SUBLAYOUT`.

**Special sub-layout instructions triggered by SUBLAYOUT value:**

- `T1b` (PhD-to-Industry): drafter must promote the candidate's PhD research entry from Education into the Experience section as "Graduate Researcher, [University], [dates]" with engineering-metric bullets. Education section is condensed to degree + year only. Skills section moved above Experience.
- `T3b` (Biotech Industry): 2-page cap enforced (pass `--max-pages=2` to generate-pdf.mjs instead of `--max-pages=4`). Section order: Header → R&D Experience → Scientific Skills Matrix → Education → Patents → Selected Publications (max 3, condensed).
- `T4b` (Hardware EE): set `{{SUBLAYOUT}}` = `layout-hardware-ee`. Use `{{TECH_STACK_HARDWARE}}` and `{{HARDWARE_PROJECTS}}` placeholders instead of `{{TECH_STACK}}` and `{{PROJECTS}}`. Include `{{PATENT_LIST}}` section.

Store final: `TEMPLATE_ID`, `TEMPLATE_FILE`, `SUBLAYOUT`, `MAX_PAGES` (default 2; 4 for T3/T3a; 2 for T3b).

### 0f. Check Playwright prerequisite (skip if FAST_MODE)

If not FAST_MODE: verify Node.js is available by noting that the script requires Node >= 18.
If the user has not installed Playwright: `npx playwright install chromium` is required.
Do not silently fail — if the install check is uncertain, note it for the user.

### 0g. Check first-time hint state

Read `data/.feature-hints.json` if it exists.

- If the file does not exist OR `hints.docx_export` is not `true`: set `SHOW_DOCX_HINT = true`
- Otherwise: set `SHOW_DOCX_HINT = false`

If `DOCX_MODE` is not `none` (user already used --docx/--docx-only): set `SHOW_DOCX_HINT = false` (they know about DOCX).

This check is silent — do not print anything here. The hint is shown in post-generation output.

### 0h. Determine output paths

- Draft HTML: `output/draft-{company-slug}.html`
- Final PDF: `output/cv-{candidate-last-name}-{company-slug}-{YYYY-MM-DD}.pdf`

Company slug: lowercase, spaces → hyphens.
Candidate last name: from `profile.yml → candidate.full_name`.

**Now begin Step 1. All reads are complete.**

---

## Step 1: DRAFTER — Generate Tailored CV HTML

### 1a. Read CV Generation Rules (absolute precedence)

From `_profile.md` already read in Step 0d, extract the `## CV Generation Rules` section.
Do not re-read the file — use the content already loaded. These rules are ABSOLUTE constraints:
- "Never cut" items are excluded from the cutting pool entirely
- "Always include" items must appear even if it costs space
- "Never cut" wins over the 2-page limit if there is a conflict
- Language rules override the drafter's default rewording behavior
- Formatting rules (max bullets, summary length) are hard limits

Tip: Users may scope rules with archetype headers (e.g., `### Content Rules (Archetype: Technical AI PM)`).
If scoped rules are present, only apply them when the detected archetype matches.

### 1b. Read Block C positioning strategy (hard constraint)

From the evaluation report Block C:

| Block C result | Constraint on experience bullets |
|----------------|----------------------------------|
| Aligned (≤1 level gap) | Normal tailoring — emphasize what Block C recommends |
| OVERQUALIFIED (downlevel) | Suppress management scope, team-size metrics, org-level achievements — even if they match JD keywords. Focus on IC contributions and hands-on technical work. |
| TOO_JUNIOR (promotion framing) | Emphasize stretch evidence, adjacent experience, growth trajectory. Don't hide the gap — frame it as readiness. |

**Keyword-matching bullets that contradict the positioning strategy are cut, not promoted.**
Example: OVERQUALIFIED + JD mentions "cross-functional leadership" → do NOT surface management bullets.

### 1c. Check market locale (from profile.yml)

Read `config/profile.yml → location.market` and apply:

| Market | Date format | Spelling |
|--------|-------------|----------|
| DACH | DD.MM.YYYY | German/English per application |
| UK | DD/MM/YYYY | British English |
| US-West / US-East | MM/YYYY | US English |
| Japan | YYYY/MM | Japanese conventions |
| Not set | MM/YYYY | US English default |

Apply the correct format to all date placeholders in the template.

### 1d. Read the selected template HTML

Read `TEMPLATE_FILE`. This is the base HTML you will fill in.

**CRITICAL: Do NOT generate HTML from scratch.** Fill ONLY the `{{PLACEHOLDER}}` values in the
existing template. Preserve all CSS, class names, and structure exactly. The templates contain
CSS variables (`:root { --margins; --base-font-size; --bullet-spacing }`) that control overflow
behavior — regenerating the HTML would break this mechanism. The template's `.page { padding: var(--margins); }`
approach is intentional (reliable across all renderers; `@page { margin: var(--margins) }` is not).

### 1e. Read Anti-Slop Writing Rules

Read `templates/writing-rules.md`. These rules apply to every bullet, summary, and
competency description you generate. Key constraints:

- **No zombie bullets** — every bullet must be specific to this candidate. Apply the
  Substitution Test: replace company name with ___ — if the bullet still works for
  anyone, rewrite it with technical specifics.
- **No banned words** (53 words: "leverage", "spearheaded", "utilize", "synergies", etc.)
- **No banned phrases** ("proven track record", "cross-functional collaboration", etc.)
- **Stats must be specific** — include units, conditions, methodology. "Improved performance
  by 30%" is vague; "Reduced switching losses from 12W to 3.8W at 500kHz" is specific.
- **Vary bullet lengths** — don't make every bullet 15-22 words. Mix: 8, 22, 14, 9.
- **Max 1 em dash** in the entire CV. Use commas.
- **No tidy summary closers** — summary just stops when the content is done.

These rules are enforced by the Reviewer in Step 2. Violations will be flagged.

### 1f. Extract ATS keywords from JD (15-20 keywords)

From the JD text (or Block E if JD unavailable): extract the 15-20 most important
keywords for ATS optimization. These are specific technologies, methodologies,
tools, and role-specific terms — not generic words like "communication" or "leadership".

Store as `ATS_KEYWORDS`.

### 1g. Fill each placeholder

**CONTACT INFO SOURCING — ABSOLUTE RULE (read before filling any placeholder):**

Contact placeholders are filled EXCLUSIVELY from `config/profile.yml → candidate.*`.

| Placeholder | Source field | If empty in profile.yml |
|-------------|-------------|------------------------|
| `{{NAME}}` | `candidate.full_name` | Stop — name is required |
| `{{EMAIL}}` | `candidate.email` | Stop — email is required |
| `{{PHONE}}` | `candidate.phone` | Omit the entire `<span class="contact-item">` for phone |
| `{{LOCATION}}` | `candidate.location` | Omit the span |
| `{{LINKEDIN_URL}}`, `{{LINKEDIN_DISPLAY}}` | `candidate.linkedin` | Omit the entire `<a>` anchor |
| `{{GOOGLE_SCHOLAR_URL}}`, `{{GOOGLE_SCHOLAR_DISPLAY}}` | `candidate.google_scholar` | Omit the entire `<a>` anchor |
| `{{PORTFOLIO_URL}}`, `{{PORTFOLIO_DISPLAY}}` | `candidate.portfolio_url` | Omit the entire `<a>` anchor |
| `{{GITHUB}}` | `candidate.github` | Omit the span |
| `{{WORK_AUTH}}` | `candidate.work_authorization` | Omit the span |

**Complete-tag omission rule:** When any optional contact field is empty, delete the **entire HTML element** from the output — not just the placeholder text inside it. The contact row uses `.contact-item + .contact-item::before` to render `|` separators via CSS. An empty element still triggers the selector and produces a stray `|`. The element must be completely absent.

**Empty parent container rule:** If all child elements inside a parent container are optional AND all are omitted, the parent container itself must also be removed. An empty `<div>` or `<span>` with `display: flex` or margin/padding will still render visible whitespace (phantom gaps) in the PDF even with no visible content. Check: if every child of a container block was omitted, delete the containing block too.

```
✅ Field empty → omit:  <a class="contact-item" href="...">...</a>  (entire tag removed)
❌ Field empty → leave: <a class="contact-item" href=""></a>         (causes stray |)
```

**Short display URLs:** Use the display form of each link (e.g. `linkedin.com/in/name`, `scholar.google.com/citations?user=XXXXX`). If the contact line looks visually crowded, prompt the user to shorten their URLs before generating the PDF.

**NEVER:**
- Use `cv.md`, `article-digest.md`, the JD, or any other source for contact fields
- Infer or construct a value (no "guess the LinkedIn URL from the name")
- Leave a template placeholder string (e.g., "+1-555-0123", "your@email.com") in output
- Emit `N/A` or `TBD` for missing fields — only omit

For each `{{PLACEHOLDER}}` in the template, generate the content:

**`{{NAME}}`** — candidate's full name from `profile.yml`

**`{{PHONE}}`, `{{EMAIL}}`, `{{LINKEDIN_URL}}`, `{{LINKEDIN_DISPLAY}}`, `{{GOOGLE_SCHOLAR_URL}}`, `{{GOOGLE_SCHOLAR_DISPLAY}}`, `{{PORTFOLIO_URL}}`, `{{PORTFOLIO_DISPLAY}}`, `{{LOCATION}}`** — from `profile.yml`. Apply market date format to any date fields.

**`{{WORK_AUTH}}`** — work authorization status from `profile.yml → candidate.work_authorization` (e.g. "Authorized to work in EU", "Requires H-1B sponsorship"). If blank/unset, omit — do NOT output `{{WORK_AUTH}}` literally.

**`{{LANG}}`** — `en` for English, `de` for DACH German CV, etc.

**`{{SECTION_SUMMARY}}`** — localized section heading (e.g., "Professional Summary" / "Professionelles Profil")
**`{{SECTION_COMPETENCIES}}`** — "Core Competencies" or equivalent
**`{{SECTION_EXPERIENCE}}`** — "Work Experience" / "Berufserfahrung"
**`{{SECTION_PROJECTS}}`** — "Projects" / "Projekte"
**`{{SECTION_EDUCATION}}`** — "Education" / "Ausbildung"
**`{{SECTION_CERTIFICATIONS}}`** — "Certifications" / "Zertifizierungen"
**`{{SECTION_SKILLS}}`** — "Technical Skills" / "Technische Fähigkeiten"

**`{{SUMMARY_TEXT}}`** — Rewrite the professional summary:
- Use the archetype framing from `_profile.md` for this role
- Apply Block C positioning (OVERQUALIFIED: de-emphasize seniority; TOO_JUNIOR: emphasize readiness)
- Inject top 5 ATS keywords naturally
- Respect Language Rules from CV Generation Rules (e.g., "minimize rewording")
- Match writing style from `_profile.md → ## Writing Style`

**`{{COMPETENCIES}}`** — Build a grid of competency tags:
- For `ats-optimized.html`: wrap each in `<span class="competency-tag">...</span>`
- For `classic-professional.html`: wrap each in `<span class="competency-item">...</span>`
- Map JD requirements to candidate skills. Lead with highest-impact ATS keywords that match actual skills.
- 12-15 items maximum. Order by JD relevance (most important first). No skills the candidate doesn't have.
- If the candidate has more than 15 qualifying skills, select the 12-15 that appear in or most closely mirror the JD language.

**`{{EXPERIENCE}}`** — For each role from `cv.md`, generate:

```html
<div class="job">
  <div class="job-header">
    <span class="job-company">{Company Name}</span>
    <span class="job-period">{date range — formatted per market locale}</span>
  </div>
  <div class="job-role">{Role Title} <span class="job-location">· {City, Country}</span></div>
  <ul>
    <li>{bullet}</li>
    ...
  </ul>
</div>
```

Bullet ordering rules (apply BOTH together):
1. **Relevance**: Reorder bullets within each role so JD-matching bullets appear first
2. **Block C filter**: Remove bullets that contradict the positioning strategy, even if they match keywords
3. Inject 1-2 ATS keywords into the first bullet of the most recent role (naturally, not keyword-stuffing)

**`{{PROJECTS}}`** — Top 3-4 projects by JD relevance:

```html
<div class="project">
  <span class="project-title">{Project Name}</span>
  <span class="project-badge">{type: Open Source | Personal | Academic | Professional}</span>
  <div class="project-desc">{1-2 sentence description emphasizing JD-relevant aspects}</div>
  <div class="project-tech">{Technologies: comma-separated}</div>
</div>
```

**`{{EDUCATION}}`** — Education entries:

```html
<div class="edu-item">
  <div class="edu-header">
    <span class="edu-title">{Degree} — <span class="edu-org">{Institution}</span></span>
    <span class="edu-year">{year — formatted per market locale}</span>
  </div>
  <div class="edu-desc">{relevant coursework or thesis, if applicable}</div>
</div>
```

**`{{CERTIFICATIONS}}`** — Relevant certifications (skip if none match JD):

```html
<div class="cert-item">
  <span class="cert-title">{Cert Name} — <span class="cert-org">{Issuer}</span></span>
  <span class="cert-year">{year}</span>
</div>
```

**`{{SKILLS}}`** — Technical skills organized by category:

```html
<div class="skills-grid">
  <span><span class="skill-category">Power Systems:</span> <span class="skill-item">48V architecture, GaN, SiC, LLC converters</span></span>
  <span><span class="skill-category">Tools:</span> <span class="skill-item">SPICE, LTspice, Altium, MATLAB</span></span>
</div>
```

Reorder skill categories so JD-matching categories appear first.

---

**Template 3 (Academic/Research) — additional placeholders:**

**`{{RESEARCH_INTERESTS}}`** — Forward-looking scientific thesis statement (2-4 sentences). Must state what the candidate intends to study/solve and why it matters, NOT a backward-looking summary of past work. Source from cv.md research section. If cv.md only contains past work descriptions, ask the user: "What research direction are you actively pursuing?" before generating.

**`{{PUBLICATIONS}}`** — Publication list. Drafter copies free-form citations from cv.md and reformats each entry into:
```html
<div class="pub-entry">
  <span class="pub-authors">{Author list — copy verbatim from cv.md, do not construct}</span>
  <span class="pub-title">"{Title}"</span>
  <span class="pub-venue">{Journal/Conference, Year}</span>
  <a class="pub-doi" href="https://doi.org/{DOI}">DOI</a>
</div>
```
Copy author names and DOIs verbatim from cv.md — do NOT infer, reconstruct, or complete partial citations. If a field is missing from cv.md, omit that field (do not fabricate). Omit the entire section if cv.md has no publications. Order: newest first.

**`{{EDUCATION_FEATURED}}`** — Full education block using the `edu-item` class:
```html
<div class="edu-item">
  <div class="edu-header">
    <span class="edu-degree">{Degree} — <span class="edu-institution">{Institution}</span></span>
    <span class="edu-year">{Year or expected date}</span>
  </div>
  <div class="edu-details">Advisor: {Name} · GPA: {if relevant and recent}</div>
  <div class="edu-thesis">Thesis: <em>{Title}</em></div>
</div>
```
Omit `edu-details` or `edu-thesis` lines if the information is not in cv.md.

**`{{GRANTS_AWARDS}}`** — Academic awards, fellowships, grants:
```html
<div class="award-item">
  <div class="award-header">
    <span class="award-title">{Award Name} — <span class="award-org">{Granting Body}</span></span>
    <span class="award-year">{Year}</span>
  </div>
  <div class="award-desc">{Brief description, 1 line max — optional}</div>
</div>
```
Omit the entire section if empty.

**`{{AFFILIATION}}`** — Current institution or department (e.g., "Department of Chemistry, MIT"). From cv.md most recent role/affiliation. Omit if empty.

**`{{RESEARCH_EXPERIENCE}}`** — Research roles and lab positions. Uses the same `job` / `job-header` HTML structure as `{{EXPERIENCE}}`.

**`{{INDUSTRY_EXPERIENCE}}`** — Industry (non-academic) roles. Same `job` structure. Omit the entire section if the candidate has no industry experience.

**Reviewer instruction for Template 3 publications:** The reviewer checks publications for internal consistency only — do author names appear elsewhere in cv.md consistently? Does the year range make sense? Does the venue name look like a real journal or conference? The reviewer does NOT fetch DOIs, verify author lists against external databases, or cross-reference citation counts. Explicitly note this scope boundary in the reviewer prompt.

---

**Template 4 (Technical/Engineering) — additional placeholders:**

**`{{TECH_STACK}}`** — T4A (Software/ML) only. Two-tier tag cloud:
```html
<div class="skills-tiers">
  <div class="skills-tier">
    <span class="skills-tier-label">Core / Production</span>
    <div class="skills-grid">
      <span class="skill-tag skill-core">Python</span>
      <span class="skill-tag skill-core">PyTorch</span>
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
"Core / Production": daily-use tools present in shipped work. Cap at 10. "Tools / Exposure": side projects, learning, occasional scripts. Cap at 8. Order: languages first, then frameworks, then tools/platforms. If the distinction cannot be inferred from cv.md, ask the user: "Which of these tools do you use daily in production vs. occasionally?" before generating. Prioritise JD-matching tools for Core tier.

**`{{TECH_STACK_HARDWARE}}`** — T4B (Hardware EE) only. 4-category matrix:
```html
<div class="skills-matrix">
  <div class="skill-category-row">
    <span class="skill-category-label">Design & Simulation</span>
    <span class="skill-category-items">Altium, Cadence Allegro, LTspice, ANSYS Maxwell, MATLAB/Simulink</span>
  </div>
  <div class="skill-category-row">
    <span class="skill-category-label">Hardware & Lab</span>
    <span class="skill-category-items">VNAs, oscilloscopes, power analyzers, bench supplies, soldering stations</span>
  </div>
  <div class="skill-category-row">
    <span class="skill-category-label">Debug & Bring-Up</span>
    <span class="skill-category-items">TDR oscilloscopes, spectrum analyzers, thermal cameras, JTAG debuggers, logic analyzers</span>
  </div>
  <div class="skill-category-row">
    <span class="skill-category-label">Standards & Protocols</span>
    <span class="skill-category-items">IEC 61000, PCIe Gen 4, DDR4, MISRA C, ISO 26262</span>
  </div>
</div>
```
Populate from cv.md skills section. Omit any category that has no matching items from cv.md.

**`{{PROJECTS}}`** — T4A (Software/ML) only. Problem → Decision → Result project cards:
```html
<div class="project-card">
  <div class="project-header">
    <span class="project-title">{Project Name}</span>
    <span class="project-stack">{Tech1} · {Tech2} · {Tech3}</span>
  </div>
  <div class="project-problem">{What was broken, slow, or missing — one line, factual}</div>
  <div class="project-choice">{The architectural/technical decision made AND the alternative rejected — one line}</div>
  <div class="project-metric">{Quantified outcome — must include a number}</div>
  <ul>
    <li>{Supporting detail}</li>
  </ul>
</div>
```
All three fields (problem, choice, metric) are required. If cv.md lacks the technical decision or the rejected alternative for a project, prompt the user: "For project [{name}]: what was the key technical decision you made, and what did you choose NOT to do?" before generating.

**`{{HARDWARE_PROJECTS}}`** — T4B only. Same Problem → Decision → Result structure with added physical specs line:
```html
<div class="project-card">
  <div class="project-header">
    <span class="project-title">{Product/Design Name}</span>
    <span class="project-stack">{Technology node · Layer count · Key standard}</span>
  </div>
  <div class="project-specs">{Power · Efficiency · Temperature range · Other physical params}</div>
  <div class="project-problem">{What was broken, slow, or missing}</div>
  <div class="project-choice">{Technical decision made and alternative rejected}</div>
  <div class="project-metric">{Quantified outcome}</div>
  <ul>
    <li>{Supporting detail}</li>
  </ul>
</div>
```
`project-specs` is hardware-specific — omit if physical parameters are not in cv.md.

**`{{GITHUB_URL}}`, `{{GITHUB_DISPLAY}}`** — T4A only. From `profile.yml → candidate.github`. Display: strip `https://` prefix. Omit entire element if empty.

**`{{PORTFOLIO_URL}}`, `{{PORTFOLIO_DISPLAY}}`** — T4A only. From `profile.yml → candidate.portfolio_url`. Display: strip `https://` prefix. Omit entire element if empty.

**`{{PATENT_URL}}`** — T4B only. From `profile.yml → candidate.patent_url`. Omit element if empty.

**`{{PATENT_LIST}}`** — T4B and T2b only. Curated patent list (max 4 entries):
```html
<div class="patent-item">
  <div class="patent-header">
    <span class="patent-title">{Patent Title}</span>
    <span class="patent-number">{Patent Number — e.g. US11234567B2}</span>
  </div>
  <span class="patent-year">{Filing or grant year}</span>
</div>
```
Copy patent numbers and titles verbatim from cv.md. Do NOT infer or construct patent numbers. Omit section if cv.md has no patents. Order: most recent first.

**`{{SECTION_HARDWARE_PROJECTS}}`** — Localized heading for T4B projects section: "Tape-outs, Board Designs & Shipped Products"

**`{{SECTION_PATENTS}}`** — "Patents" (T4B) or "Selected Patents" (T2b/T3b)

**`{{SECTION_RESEARCH_INTERESTS}}`** — "Research Interests" (T3)

**`{{SECTION_PUBLICATIONS}}`** — "Publications" (T3)

**`{{SECTION_RESEARCH_EXPERIENCE}}`** — "Research Experience" (T3)

**`{{SECTION_INDUSTRY_EXPERIENCE}}`** — "Industry Experience" (T3 — only used if section is present)

**`{{SECTION_GRANTS_AWARDS}}`** — "Grants & Awards" (T3)

---

### 1h. Apply deterministic cuts (Layer 1)

Before rendering final HTML, apply these hard rules — UNLESS an item is protected by CV Generation Rules:

| Rule | Override? |
|------|-----------|
| Max 5 bullets for most recent role | Yes — if CV Rules say "keep all" |
| Max 3 bullets for roles older than most recent | Yes — if CV Rules say otherwise |
| Hide roles older than 10 years entirely | Yes — if CV Rules protect them |
| Remove GPA for degrees older than 5 years | Yes — if CV Rules say "always include GPA" |
| Collapse coursework to one line | Yes — if CV Rules protect coursework |

### 1i. Apply underflow expansion (Layer 0.5, if content is significantly under target)

**Cutting and padding are mutually exclusive.** This step only runs if the content after
Layer 1 is estimated to be *under* `profile.yml → cv.target_pages`. Skip entirely if content
is already at or near the target — proceed directly to Layer 2 cutting.

**Gate 1 — Hard early-career stop (checked first, always):**

Count the total number of bullets across all roles in `cv.md` (before any cuts).
If the raw total is **< 10 bullets**: do NOT pad. The candidate genuinely has a short career.
Target 1 page instead — produce a dense, tight layout. Tell the reviewer:
> *"Underflow: cv.md has < 10 total bullets — targeting 1 page (tight layout), not padding to 2."*

This gate fires regardless of `target_pages`.

**Gate 2 — target_pages check:**

Read `profile.yml → cv.target_pages` (default: `2`).
- If `target_pages: 1`: skip padding entirely. Produce the best 1-page layout.
- If `target_pages: 2` AND Gate 1 did not fire: proceed to the padding trigger.

**Padding trigger:**

After Layer 1 cuts, estimate whether the remaining content fills < ~1.5 pages.
Heuristic proxy: if total remaining bullet count across all roles is **< 12**, treat as underflow.

If triggered, expand in this order until estimated 2-page fill is reached:
1. **Recent role bullets** — be more verbose: add context, method, outcome, or scope that is
   in `cv.md` but was condensed in the first pass. No fabrication.
2. **Thin recent roles** (< 4 bullets after Layer 1) — add bullets from `cv.md` that were
   not included due to low JD-relevance, but are real and accurate.
3. **Project descriptions** — expand to 2–3 sentences rather than 1.
4. **Professional summary** — allow up to 5–6 sentences rather than 3–4.
5. **Skills and certifications** — include all qualifying items rather than a curated subset.

Per-role bullet caps during padding (override Layer 1 caps):
- Most recent role: up to **7 bullets** (Layer 1 cap: 5)
- Second role: up to **5 bullets** (Layer 1 cap: 3)
- Older roles: up to **4 bullets** (Layer 1 cap: 3) if space permits

**Hard constraints on padding:**
- All added content must trace to `cv.md` or `article-digest.md`. No fabrication.
- CV Generation Rules (`_profile.md → ## CV Generation Rules`) take absolute precedence —
  e.g. if rules say "max 5 bullets", that cap holds even during padding.
- Stop at estimated 2 pages. The overflow fallback chain (Layers 1–3) remains as backstop.

**Reviewer note:** When a padding pass ran, flag it in the reviewer prompt. The reviewer
must apply the Substitution Test to all padded bullets — padding cannot introduce zombie
bullets that sound generic.

### 1j. Apply relevance-weighted cutting (Layer 2, if content exceeds target pages estimate)

Estimate content length. If clearly overflowing (experienced engineers with 3+ roles and 20+ bullets often will):

Score each remaining (unprotected) line on:
1. **Relevance** (high weight): matches a JD keyword, tool, or responsibility?
2. **Uniqueness** (medium): same claim made elsewhere in CV? Redundant = cut first.
3. **Narrative load** (low): does a Block F story depend on this line?

Cut the lowest-scoring lines. Relevance beats recency — an older-role bullet that matches JD keywords survives over a recent-role bullet that doesn't.

### 1k. Apply interview backtrack test (skip if FAST_MODE)

**If FAST_MODE: skip this step entirely — proceed to 1l.**

For every generated bullet, classify:

| Zone | Rule |
|------|------|
| **OK** | Reordering, natural synonyms, emphasizing one real facet of broad work |
| **Flag** | Merging academic + industry into industry-sounding claim; using JD's terminology for adjacent work | 
| **Never** | Fabricating experience or implying work in an untouched domain |

Collect all "Flag" items with their original wording for Step 4.
Silently remove "Never" items and note them in the discard log.

### 1l. Write draft to disk

Write the filled, cut, and cleaned HTML to `output/draft-{company-slug}.html`.

**If FAST_MODE is set:** Tell the user:
> "Draft written to `output/draft-{company-slug}.html`. --fast mode: no reviewer, no PDF generated.
> Edit the file, then run:
> `node scripts/generate-pdf.mjs output/draft-{company-slug}.html output/cv-{lastname}-{company-slug}-{YYYY-MM-DD}.pdf --max-pages={MAX_PAGES}`"

**STOP. Do not proceed to Step 2.**

---

## Step 2: REVIEWER — Fresh-Context Critique (skip if FAST_MODE or score < 80)

**If FAST_MODE:** Step 1k already exited — this step is never reached.

**If composite score < 80 (PARTIAL_MATCH, 65-79):** Skip to Step 4. Before skipping, tell the user:
> "Running single-pass draft mode (score: {N}/100 — PARTIAL_MATCH). The Drafter-Reviewer loop
> activates for GOOD_FIT+ scores ≥ 80. Proceeding to Review & Confirm."

**If composite score ≥ 80 (GOOD_FIT+):** Proceed with full reviewer workflow below.

Spawn a **fresh-context subagent** with NO access to the drafter's conversation.
This is a genuinely separate agent — not an "internal review pass."

### What to pass to the reviewer

**Pass CV text content inline — NOT the raw HTML.**

The reviewer critiques content (tone, keywords, fabrication), not layout.
Extract the plain text from each filled placeholder and include it in the reviewer prompt.
This saves hundreds of tokens on HTML tags/CSS and eliminates a file-read roundtrip.

**PII guard:** Before passing CV text to the reviewer, strip contact info:
- Phone number
- Email address
- Physical address

The reviewer doesn't need these to critique tone and keywords.

**Reviewer prompt structure:**
```
Act as a CV Reviewer. Your job is to critique CV content for a job application.

JD: [paste full JD text]

CV content (plain text — not HTML):
[NAME]: {candidate name}
[SUMMARY]: {summary text}
[COMPETENCIES]: {competency list}
[EXPERIENCE — {Company}, {Role}, {Date}]: {bullets as text}
[EXPERIENCE — {Company}, {Role}, {Date}]: {bullets as text}
... (all roles)
[PROJECTS]: {project titles and descriptions}
[EDUCATION]: {education entries}
[SKILLS]: {skills}

Also read config/profile.yml and modes/_profile.md for candidate data and CV Generation Rules.

Provide your critique in the format below.
```

### Reviewer instructions

1. Verify every claim maps to real candidate data — flag any fabrication
2. Check keyword coverage — which JD requirements have no corresponding CV bullet?
3. Assess tone against writing style in `_profile.md`
4. **Verify CV Generation Rules compliance** — check "always include" items are present, "never cut" sections survived, formatting rules respected. Flag violations.
5. Apply the interview backtrack test independently
6. Search the web to verify company-specific claims (partnerships, products, technologies) — **search for the company/technology, not the candidate. Do not include candidate name, employer, or personal details in search queries.**
7. **Anti-slop audit** (per `templates/writing-rules.md`):
   - **Substitution Test:** Replace each company name with ___. Any bullet that still sounds generic → flag as zombie bullet.
   - **Banned words scan:** Flag any of the 53 banned words (delve, leverage, spearheaded, utilize, synergies, etc.)
   - **Banned phrases scan:** Flag boilerplate ("proven track record", "cross-functional collaboration", etc.)
   - **AI Bingo Test:** Count: banned words + em dashes + uniform bullet lengths + rule-of-three. If 3+ hits → request a rewrite pass.
   - **Stats specificity:** Flag vague metrics ("improved by 30%") — stats need units, conditions, or methodology.

### Reviewer output format

**Part A — Required edits (numbered list, natural language):**
```
1. Under {Company} Experience, {Nth} bullet: change "{current text}" to
   "{proposed text}" — {reason: specific keyword gap, missing metric, CV Rules violation}
2. In Summary: add "{phrase}" — {reason}
```

**Part B — Narrative suggestions (four categories, even if "no issues"):**
1. Missed keywords — JD terms not reflected anywhere in CV
2. Company-specific angles — research-based suggestions
3. Action-oriented reframing — passive → active, vague → specific
4. Tone/style alignment — matches `_profile.md` writing style?

---

## Step 3: DRAFTER — Revise and Log

### 3a. Apply Part A edits

For each Part A edit, apply it to `output/draft-{company-slug}.html` using the file edit tool.
Apply intelligence — don't literally copy the reviewer's text if it violates CV Generation Rules
or the backtrack test. Note any edits you choose not to apply and the reason.

**Locating the edit target (fuzzy match — required).** The reviewer quotes plain text; the HTML
contains inline tags, entities, and whitespace that make a literal match fail. Do NOT use the
reviewer's full quoted string as the search target. Instead:
1. Extract 3–5 consecutive unique words from the core of the reviewer's "current text" quote
   (avoid common words like "the", "and", "to"; pick words that uniquely identify the sentence).
2. Search the HTML for that short phrase — it will be present even across tag boundaries.
3. Identify the full surrounding sentence or bullet in the HTML.
4. Apply the edit to that region.

Example: reviewer quotes `"Led team to improve system performance"` → search for
`"improve system performance"` → find the `<li>` containing it → replace the full bullet.
This works even when the HTML reads `Led<span> team</span> to improve system performance`.

**Merge reviewer flags:** The reviewer may have identified additional "Flag" items during its
independent backtrack test. Merge these into the flag list from Step 1j. Present all flags
together in Step 4 — do not show drafter flags and reviewer flags separately.

### 3b. Evaluate Part B suggestions

Apply Part B suggestions with judgment:
- Apply if they improve keyword coverage or tone without violating backtrack test
- Skip if they contradict CV Generation Rules
- Skip if they require fabricating experience

### 3c. Log critique to evaluation report

Append a new section to `reports/{REPORT_NUM}-{slug}-{date}.md`:

```markdown
## I) CV Tailoring Critique

*Added {date} — reviewer subagent feedback for CV generation*

### Part A — Applied Edits
{list of Part A edits that were applied}

### Part B — Narrative Suggestions
{all Part B suggestions, even if not applied}

### Suggestions Not Applied
{list any reviewer suggestions skipped, with reason:
 "Skipped — violates backtrack test: ..."
 "Skipped — contradicts CV Generation Rules: ..."}
```

### 3d. Verify and re-check

- WebSearch-verify any new company-specific claims before including
- Check: does the revised draft still look like it fits 2 pages?
  If clearly overflowing: apply one more pass of relevance-weighted cutting (Layer 2)

---

## Step 4: Review & Confirm (single interaction point)

Present everything in ONE conversational prompt. Print to the console, then STOP and wait.
**Do NOT use structured choice tools** — this must be a conversational response
so the user can reply naturally (e.g., "1: keep, 2: change to exactly 'Led thermal review process', and also add back the LabVIEW cert").

```
## CV Review & Confirm — {Company}: {Role}

### What was included (key additions for this role):
{list of notable additions — keywords injected, bullets promoted, sections reordered}

### What was discarded (and why):
{list of items cut, each with reason: "not relevant to {role type}", "space constraint", "contradicts downlevel strategy", etc.}

### Protected by CV Rules (never cut):
{list any items explicitly protected — "per your 'always include patent count' rule", etc.}
{or: "(none — no CV Generation Rules are set)"}

### Flagged rewording (needs your decision):
{If flags exist:}
1. [FLAG] '{reworded text}' — original: '{original cv.md text}'
2. [FLAG] '{reworded text}' — original: '{original cv.md text}'

For each flagged item: Keep | Soften | Drop
Or provide exact text: '2: "exact replacement here"'
{If no flags:}
(No flagged items — all rewording passed the backtrack test.)

**Draft HTML:** output/draft-{company-slug}.html — you can edit this file directly before I generate the PDF.

Reply with your decisions, request any changes, or say "go" to generate the PDF.
```

**STOP. Wait for user response.**

**Before making any edits after this pause:** Re-read `output/draft-{company-slug}.html` from disk.
The user may have manually edited the file in their IDE during the pause. Do NOT use the cached
version from Step 1k — always read fresh before editing. This prevents overwriting the user's changes.

**If the user provides exact replacement text for any flagged item, use it verbatim.**
Do not "improve" or rephrase it. The user knows what they want to say.

If user says "go" or similar → proceed to Step 5 (no re-read needed — no edits to make).
If user requests changes → re-read draft from disk, apply edits, then proceed to Step 5.

---

## Step 5: Generate PDF + Verify

### 5a. Contact info audit (MANDATORY — runs before PDF)

Run the contact audit script against the filled draft HTML:

```
node scripts/audit-contact.mjs output/draft-{company-slug}.html config/profile.yml
```

The script prints a contact summary and exits with:
- `0` → audit passed; proceed to PDF generation
- `1` → script error; show the error message and stop
- `2` → **FABRICATION or PLACEHOLDER DETECTED** — do NOT generate PDF
  Show the audit output, then:
  > "The contact audit failed (see above). Fix the issues in the draft HTML or in
  > config/profile.yml and re-run. PDF generation is blocked until the audit passes."
  **STOP. Do not run generate-pdf.mjs.**

### 5b. PDF generation

Run the PDF generation script. Suppress stderr to avoid Playwright/Chromium noise in the terminal:

```
node scripts/generate-pdf.mjs output/draft-{company-slug}.html output/cv-{lastname}-{company-slug}-{YYYY-MM-DD}.pdf --max-pages={MAX_PAGES} 2>/dev/null
```

Capture stdout and exit code from generate-pdf.mjs. The script prints: `Pages: {N}`, `Size: {N} KB`, `OVERFLOW: ...` if applicable, and the canonical URI lines:
```
✅ PDF written: {abs_path}
📂 Open: file:///{abs_path_forward_slashes}
   Path: {relative_path}
```

Check the exit code:
- Exit code 0: success, ≤2 pages — proceed
- Exit code 2: OVERFLOW (>2 pages) — apply overflow fix (see below)
- Exit code 1: error — report to user with the error message from stdout (not suppressed stderr)

### Overflow fix (max 2 Playwright invocations total)

If overflow (exit code 2):

1. Apply ONE content cut: remove the lowest-relevance unprotected bullet
2. Apply ALL CSS fallbacks in a single edit to `output/draft-{company-slug}.html`:
   - Change `--margins: 0.5in` → `--margins: 0.4in`
   - Change `--base-font-size: 11px` → `--base-font-size: 10px`
   - Change `--bullet-spacing: 0.15em` → `--bullet-spacing: 0.1em`
3. Regenerate PDF once (second and final Playwright invocation)
4. If still overflow: accept 3 pages. Tell the user:
   > "Your CV is 3 pages. This is because your CV Generation Rules protect more content
   > than fits in 2 pages at readable sizes. You can: (a) remove a 'never cut' rule,
   > (b) edit the draft HTML directly, or (c) keep it as 3 pages."

### 5c. CV comparison (skip if FAST_MODE)

Run the deterministic comparison between master cv.md and the tailored draft HTML.
This detects any content the AI added that does not appear in the master CV (fabrication candidates).

```
node scripts/cv-compare.mjs cv.md output/draft-{company-slug}.html {company-slug}
```

The script:
1. Parses `cv.md` into sections/bullets
2. Parses the draft HTML into the same structure
3. Computes kept/rewritten/removed/added bullets via Jaccard similarity (threshold from profile.yml)
4. Emits `output/compare-{slug}-{date}.md` with amber-highlighted warning blocks for added items
5. Runs `md-to-html.mjs` on the comparison file
6. Prints a terminal summary table and the `📂 Open:` line

Relay the script's `📂 Open:` line verbatim. If the script reports added items (⚠️), surface the
warning in your output so the user sees it before they review the PDF.

If the script fails to run, note: "[comparison unavailable — run manually: node scripts/cv-compare.mjs cv.md output/draft-{company-slug}.html {company-slug}]" and continue.

### 5d. DOCX generation (only if --docx or --docx-only)

If `DOCX_MODE` is `none`: skip this step.

Run the DOCX builder against the draft HTML:

```
node scripts/generate-docx.mjs output/draft-{company-slug}.html output/cv-{lastname}-{company-slug}-{YYYY-MM-DD}.docx
```

The script prints the canonical URI lines on success:
```
✅ DOCX written: {abs_path}
📂 Open: file:///{abs_path_forward_slashes}
   Path: {relative_path}
   ℹ️  Style tokens applied: accent={hex}, margins={value}
```

Relay the `📂 Open:` and `   Path:` lines verbatim.

If the script exits non-zero: report the error. If `docx` or `node-html-parser` are not installed, tell the user: "Run `npm install` in the project root, then retry."

**FIDELITY NOTE (surface once, on first DOCX generation):**
> The DOCX mirrors the PDF's visual structure — accent color, section headings, bullet layout,
> and margins are applied. CSS-only constructs (flexbox separators, @font-face files) fall back
> to DOCX equivalents. The result is a polished Word document, not a pixel-perfect replica.

### Post-generation

Update `data/applications.md`:
- Find the row for this company + role
- Set the PDF column to ✅ and note the filename

Relay the script's `📂 Open:` and `   Path:` lines from stdout:

```
{relay "📂 Open: file:///..." line from generate-pdf.mjs stdout}
{relay "   Path: ..." line from generate-pdf.mjs stdout}

What to do next:
  1. Open the PDF above and review before submitting
  2. Submit your application — then update status → pipeline
  3. Once they schedule an interview → interview-prep {company-slug}
```

[First-time hint — only if SHOW_DOCX_HINT is true]:
```
ℹ️  New: you can now generate a high-fidelity Word version with `cv --docx`.
   (This message shows once — see README.md for full DOCX options.)
```
After printing this hint: write `{"hints": {"docx_export": true}}` to `data/.feature-hints.json`
(create the file if it doesn't exist). This is a P6 User Layer write — no backup/confirmation needed
(the file is system state, not user content).

[P3 nudge — only if composite ≥ 85 AND user did NOT invoke --docx or --docx-only]:
```
💡 High-fit role — consider also generating a DOCX for ATS upload portals:
   cv --docx-only   (creates output/cv-{slug}.docx alongside the PDF)
```

---

## Step 6: Iterative Modification

After PDF generation, the user can request changes in a conversational loop.

**CV Generation Rules can be overridden during iterative modification.** The user's
real-time instruction takes precedence over standing rules. If rules say "max 5 bullets"
but the user says "add back the 6th bullet", add it.

**Flow:**
1. **Re-read `output/draft-{company-slug}.html` from disk before every edit** — the user may have modified it in their IDE between interactions
2. Apply the requested edit
3. If template switch requested: re-fill the new template with current content
4. Regenerate PDF: `node scripts/generate-pdf.mjs ... 2>/dev/null`
5. Show updated summary of what changed
6. Ask: "Anything else to change?"
7. Repeat until user says done

No reviewer for iterative edits — the user IS the reviewer at this point.

---

## Cutting Reference (Layers 0.5, 1, 2, 3)

### Layer 0.5: Underflow expansion (if content is under target — see Step 1i)
Runs ONLY when content is under target. Mutually exclusive with Layer 2.
Early-career hard stop: < 10 bullets in cv.md → target 1 page, no padding.

### Layer 1: Deterministic (always apply first)
Hard rules, applied before any LLM scoring. Protected items exempt.

### Layer 2: Relevance-weighted (if overflowing after Layer 1)
Score each unprotected line: Relevance (high) + Uniqueness (medium) + Narrative load (low).
Cut lowest score first. Relevance beats recency.

Cut priority order:
1. Redundant entries (same achievement mentioned twice)
2. Profile filler ("passionate about", "results-oriented")
3. Low-relevance experience bullets
4. Low-relevance certifications, minor publications
5. Structural cuts (collapse sections, remove headers)

### Layer 3: CSS fallback (if overflow persists after content cuts)
Apply all CSS changes at once — do not loop. Single regeneration.

---

## Placeholder Vocabulary Reference

| Placeholder | Content | Notes |
|-------------|---------|-------|
| `{{NAME}}` | Full name | from profile.yml |
| `{{PHONE}}` | Phone number | stripped from reviewer prompt |
| `{{EMAIL}}` | Email address | stripped from reviewer prompt |
| `{{LINKEDIN_URL}}` | Full URL for href | omit entire `<a>` if blank |
| `{{LINKEDIN_DISPLAY}}` | Display text | e.g., "linkedin.com/in/name" |
| `{{GOOGLE_SCHOLAR_URL}}` | Full URL for href | omit entire `<a>` if blank |
| `{{GOOGLE_SCHOLAR_DISPLAY}}` | Display text | e.g., "scholar.google.com/citations?user=..." |
| `{{PORTFOLIO_URL}}` | Portfolio URL for href | omit entire `<a>` if blank |
| `{{PORTFOLIO_DISPLAY}}` | Display text | |
| `{{LOCATION}}` | City, State/Country | |
| `{{WORK_AUTH}}` | Work authorization status | omit if blank |
| `{{LANG}}` | HTML lang attribute | "en", "de", "ja" |
| `{{SECTION_*}}` | Section headings | localized per market |
| `{{SUMMARY_TEXT}}` | Professional summary | rewritten, archetype-framed |
| `{{COMPETENCIES}}` | Competency tags HTML | |
| `{{EXPERIENCE}}` | Full experience HTML | all roles |
| `{{PROJECTS}}` | Projects HTML | top 3-4 by relevance |
| `{{EDUCATION}}` | Education HTML | |
| `{{CERTIFICATIONS}}` | Certifications HTML | optional |
| `{{SKILLS}}` | Skills grid HTML | |
| `{{#if PROJECTS}}...{{/if}}` | Conditional section | If no relevant projects exist, remove the entire `<div class="section">` block for Projects from the HTML before writing to disk. Same for Certifications. These are not Handlebars templates — the LLM removes the conditional block manually. |

---

## LLM-Physics Reminders

1. **All file reads in Step 0** — before any output
2. **Reviewer is a separate agent** — not an "internal pass"
3. **Draft to disk before reviewer** — never pass 400+ lines of HTML inline
4. **Text to reviewer, not HTML** — saves tokens, eliminates file-read turn
5. **Single merged interaction** — Step 4 combines backtrack flags + discard summary
6. **Max 2 Playwright invocations** — initial + one retry with all CSS fallbacks at once
7. **Verbatim text** — if user provides exact replacement wording, use it as-is

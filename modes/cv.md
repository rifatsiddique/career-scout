# Mode: cv — Tailored CV Generation

Generates a tailored PDF CV from the evaluation report, master CV, and candidate profile.
Uses a drafter-reviewer workflow for high-fit applications.

---

## Step 0: Data Gathering (ALL reads before any output)

LLM streaming cannot pause mid-output. Complete ALL reads here before writing anything.

### 0a. Check for --fast flag

If the user invoked `cv --fast` or `cv --draft-only`:
- Set `FAST_MODE = true`
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

### 0e. Determine template

```
1. If user specified a template override (e.g., "use ats-optimized") → use that
2. Check profile.yml → cv.template_overrides for a mapping matching the detected archetype
3. Fall back to profile.yml → cv.default_template (default: "classic-professional")
```

Read `templates/cv/manifest.yml` to validate the selected template file exists and has status "ready".
If status is "planned": tell user this template is not yet implemented, fall back to "classic-professional".

Store: `TEMPLATE_ID`, `TEMPLATE_FILE` path (e.g., `templates/cv/classic-professional.html`).

### 0f. Check Playwright prerequisite (skip if FAST_MODE)

If not FAST_MODE: verify Node.js is available by noting that the script requires Node >= 18.
If the user has not installed Playwright: `npx playwright install chromium` is required.
Do not silently fail — if the install check is uncertain, note it for the user.

### 0g. Determine output paths

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

For each `{{PLACEHOLDER}}` in the template, generate the content:

**`{{NAME}}`** — candidate's full name from `profile.yml`

**`{{CURRENT_TITLE}}`** — current/target role title (used in classic-professional template header)

**`{{PHONE}}`, `{{EMAIL}}`, `{{LINKEDIN_URL}}`, `{{LINKEDIN_DISPLAY}}`, `{{PORTFOLIO_URL}}`, `{{PORTFOLIO_DISPLAY}}`, `{{LOCATION}}`** — from `profile.yml`. Apply market date format to any date fields.

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
- Map JD requirements to candidate skills. Lead with ATS keywords that match actual skills.
- 8-14 competencies. No skills the candidate doesn't have.

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

### 1h. Apply deterministic cuts (Layer 1)

Before rendering final HTML, apply these hard rules — UNLESS an item is protected by CV Generation Rules:

| Rule | Override? |
|------|-----------|
| Max 5 bullets for most recent role | Yes — if CV Rules say "keep all" |
| Max 3 bullets for roles older than most recent | Yes — if CV Rules say otherwise |
| Hide roles older than 10 years entirely | Yes — if CV Rules protect them |
| Remove GPA for degrees older than 5 years | Yes — if CV Rules say "always include GPA" |
| Collapse coursework to one line | Yes — if CV Rules protect coursework |

### 1i. Apply relevance-weighted cutting (Layer 2, if content exceeds 2 pages estimate)

Estimate content length. If clearly overflowing (experienced engineers with 3+ roles and 20+ bullets often will):

Score each remaining (unprotected) line on:
1. **Relevance** (high weight): matches a JD keyword, tool, or responsibility?
2. **Uniqueness** (medium): same claim made elsewhere in CV? Redundant = cut first.
3. **Narrative load** (low): does a Block F story depend on this line?

Cut the lowest-scoring lines. Relevance beats recency — an older-role bullet that matches JD keywords survives over a recent-role bullet that doesn't.

### 1j. Apply interview backtrack test (skip if FAST_MODE)

**If FAST_MODE: skip this step entirely — proceed to 1j.**

For every generated bullet, classify:

| Zone | Rule |
|------|------|
| **OK** | Reordering, natural synonyms, emphasizing one real facet of broad work |
| **Flag** | Merging academic + industry into industry-sounding claim; using JD's terminology for adjacent work | 
| **Never** | Fabricating experience or implying work in an untouched domain |

Collect all "Flag" items with their original wording for Step 4.
Silently remove "Never" items and note them in the discard log.

### 1k. Write draft to disk

Write the filled, cut, and cleaned HTML to `output/draft-{company-slug}.html`.

**If FAST_MODE is set:** Tell the user:
> "Draft written to `output/draft-{company-slug}.html`. --fast mode: no reviewer, no PDF generated.
> Edit the file, then run:
> `node scripts/generate-pdf.mjs output/draft-{company-slug}.html output/cv-{lastname}-{company-slug}-{YYYY-MM-DD}.pdf`"

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

Run the PDF generation script. Suppress stderr to avoid Playwright/Chromium noise in the terminal:

```
node scripts/generate-pdf.mjs output/draft-{company-slug}.html output/cv-{lastname}-{company-slug}-{YYYY-MM-DD}.pdf 2>/dev/null
```

Capture stdout and exit code. The script prints: `Pages: {N}`, `Size: {N} KB`, and `OVERFLOW: ...` if applicable.

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

### Post-generation

Update `data/applications.md`:
- Find the row for this company + role
- Set the PDF column to ✅ and note the filename

Tell the user:
> "CV generated: output/{filename}.pdf
> {N} pages | {size} KB
> Report: reports/{REPORT_NUM}-{slug}-{date}.md (Section I has reviewer critique)"

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

## Cutting Reference (Layers 1-3)

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
| `{{CURRENT_TITLE}}` | Current/target role title | classic-professional only |
| `{{PHONE}}` | Phone number | stripped from reviewer prompt |
| `{{EMAIL}}` | Email address | stripped from reviewer prompt |
| `{{LINKEDIN_URL}}` | Full URL | |
| `{{LINKEDIN_DISPLAY}}` | Display text | e.g., "linkedin.com/in/name" |
| `{{PORTFOLIO_URL}}` | Portfolio/GitHub URL | |
| `{{PORTFOLIO_DISPLAY}}` | Display text | |
| `{{LOCATION}}` | City, State/Country | |
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

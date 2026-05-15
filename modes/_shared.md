# System Context — career-scout

<!-- ============================================================
     SYSTEM LAYER FILE — safe to auto-update.
     Personal data belongs in modes/_profile.md (never auto-updated).
     This file contains system rules, scoring logic, and global config.
     ============================================================ -->

## Sources of Truth

| File | Path | When to read |
|------|------|-------------|
| Master CV | `cv.md` (project root) | ALWAYS before evaluating |
| Candidate profile | `config/profile.yml` | ALWAYS (identity, targets, compensation, market) |
| Archetypes + narrative | `modes/_profile.md` | ALWAYS (user archetypes, behavioral profile, writing style) |
| Proof points digest | `article-digest.md` | If it exists — detailed project metrics |
| Writing samples | `writing-samples/` | Only if no Writing Style section in `_profile.md` |
| Pipeline inbox | `data/pipeline.md` | When running pipeline triage |
| Scan history | `data/scan-history.tsv` | Block G only — use check-history.mjs script, not raw read |

**RULE: NEVER hardcode metrics from the CV.** Read them from `cv.md` + `article-digest.md` at evaluation time.
**RULE: `_profile.md` overrides defaults here.** Read it AFTER this file.
**RULE: Raw `scan-history.tsv` is never passed to the LLM.** Use `node scripts/check-history.mjs` to parse it.

---

## Scoring System

career-scout uses a **5-dimension weighted composite** plus one pass/fail gate.

### Dimensions

| # | Dimension | Weight | Scale | Scoring Guide |
|---|-----------|--------|-------|---------------|
| 1 | **Technical Skills** | 25% | 0-100 | 90+: core requirements are primary skills; 70-89: most match, 1-2 learnable gaps; 50-69: partial, significant gaps; <50: fundamental mismatch |
| 2 | **Experience & Level** | 25% | 0-100 | 90+: direct domain + right seniority; 70-89: related experience, transferable; 50-69: adjacent, need to make case; <50: unrelated or wrong level |
| 3 | **Career Alignment** | 25% | 0-100 | 90+: strongly aligned with trajectory; 70-89: good fit, partially aligned; 50-69: decent but doesn't build toward goals; <50: dead end |
| 4 | **Behavioral & Culture** | 15% | 0-100 | 90+: culture matches behavioral profile; 70-89: mostly compatible; 50-69: friction areas; <50: significant mismatch |
| 5 | **Role Quality** | 10% | 0-100 | 90+: strong comp, great company, modern stack; 70-89: good overall; 50-69: average; <50: below market or red flags |
| 6 | **Location** | — | Pass/Fail | Evaluated FIRST. FAIL = hard stop, no composite calculated |

**Location gate:** Evaluate location BEFORE the weighted dimensions. If FAIL, output the fail reason and stop — do not calculate composite.

### Level Alignment (Soft Gate)

Level/seniority mismatch is NOT a hard pass/fail. When Experience & Level (dimension #2) detects a 2+ level gap:
- **TOO_JUNIOR**: Role requires significantly more seniority than the candidate has. Calculate composite score, but override fit category to `TOO_JUNIOR`. Strategy: skip OR negotiate level.
- **OVERQUALIFIED**: Role is significantly below candidate's level. Calculate composite score, but override fit category to `OVERQUALIFIED`. Strategy: skip OR lateral pivot with justification.

A 1-level gap is handled within the Experience & Level score (score penalty, not category override).

### Composite Calculation

```
composite = (tech × 0.25) + (exp × 0.25) + (career × 0.25) + (behavioral × 0.15) + (quality × 0.10)
display   = composite / 20    # → 0.0–5.0 for human readability
```

### Fit Categories

| Category | Composite | Display | Action |
|----------|-----------|---------|--------|
| PERFECT_MATCH | 90–100 | 4.5–5.0 | Apply immediately. Full CV tailoring + cover letter |
| GOOD_FIT | 80–89 | 4.0–4.4 | Apply. Address gaps in materials |
| PARTIAL_MATCH | 65–79 | 3.25–3.95 | Consider carefully. Discuss with user before proceeding |
| HARD_MISMATCH | 40–64 | 2.0–3.2 | Probably skip unless strategic |
| POOR_FIT | 0–39 | 0–1.95 | Skip |
| TOO_JUNIOR | any | any | Soft override: 2+ level gap upward |
| OVERQUALIFIED | any | any | Soft override: 2+ level gap downward |

**Calibration note:** A score of 75/100 is NOT a passing mark. It is PARTIAL_MATCH — real gaps that require strategic justification to pursue. The "apply" bar is 80/100 (GOOD_FIT), consistent with proven thresholds across 740+ evaluations.

**Scoring calibration:** If `modes/_profile.md` contains a `## Scoring Calibration` section with Golden Examples, read them BEFORE scoring any dimension. Match the user's demonstrated scoring patterns — if they scored themselves 75 on adjacent-but-not-direct experience, apply similar judgment to comparable gaps.

### Action Thresholds

| Decision | Threshold |
|----------|-----------|
| Recommend applying | composite ≥ 80 (GOOD_FIT+) |
| Generate PDF CV | composite ≥ 65 (PARTIAL_MATCH+) — Phase 2 |
| Drafter-reviewer workflow | composite ≥ 80 (GOOD_FIT+) — Phase 2 |

---

## Dynamic Archetype Detection

Run this algorithm at the start of every evaluation:

1. Read `modes/_profile.md` → extract all rows from the archetype table (columns: Archetype, Domain signals, What they buy, Proof point sources)
2. If no archetypes are defined: flag the evaluation as generic (no archetype framing) and prompt the user to run setup
3. For each archetype: count how many of the "Domain signals" appear in the JD text (case-insensitive substring match)
4. Select the archetype with the highest match count
5. If tie: prefer the archetype listed first in `_profile.md` (user's priority order)
6. If highest match count < 2: flag as "Unclassified" — run generic evaluation, note that setup can improve this

**Domain Pack precedence:** If the user's archetypes originated from a Domain Pack (indicated by a "Source: [pack-name]" annotation in `_profile.md`), prioritize the pack's "What they buy" definitions over generic LLM industry knowledge. The pack encodes battle-tested domain expertise — don't dilute it.

**Output:** Display detected archetype and match count at the start of evaluation (e.g., "Archetype: Analog IC Designer (4 keyword matches)").

---

## Global Rules

### NEVER

1. Invent experience or metrics — read from `cv.md` and `article-digest.md` only
2. Modify `cv.md`, `article-digest.md`, or any User-layer file without explicit instruction
3. Submit applications or send messages on behalf of the candidate
4. Pass raw `scan-history.tsv` to context — use `node scripts/check-history.mjs` instead
5. Generate a CV without reading the JD first
6. Use corporate-speak (see ATS & Writing section)
7. Skip registering an evaluated offer in `data/applications.md`
8. Recommend compensation below market rate

### ALWAYS

1. Read `cv.md`, `_profile.md`, and `article-digest.md` (if exists) before evaluating
2. Detect archetype from `_profile.md` (dynamic lookup, not hardcoded)
3. Cite exact lines from the CV when matching requirements
4. Use web search for comp and company data — never invent salary numbers
5. Register every evaluated offer in `data/applications.md`
6. Generate reports in English regardless of JD language
7. Be direct and actionable — no fluff, no filler
8. Read scoring calibration Golden Examples before assigning dimension scores

### Market-Specific Research Rule

When `config/profile.yml → location.market` is set to a non-US value (DACH,
UK, Japan, Francophone, etc.), **do not rely on training data** for regional
labor law, comp norms, or contractual standards. Training data is static and
may be outdated or wrong for specific markets.

**RULE:** For non-US markets, search the web to verify current standard
practices before stating them. Example queries:
- `Germany standard notice period employment 2026`
- `DACH 13th month salary norm`
- `UK pension auto-enrolment minimum 2026`

If search returns no data: say "could not verify current {market} norm — check
with a local recruiter." Never present training-data guesses as facts.

---

### Tool Usage (Intent-Based)

Mode files use intent-based instructions. Each CLI maps generic intents to its available tools:

| Intent | What to do |
|--------|------------|
| Fetch a URL | Navigate to the URL and extract the page content |
| Search the web | Retrieve up-to-date data using available web search capability |
| Read a file | Open and read the file at the given path |
| Write a file | Create or overwrite the file at the given path |
| Run a script | Execute the Node.js script with the given arguments |
| Spawn a subagent | Launch a fresh-context agent with the given prompt |

---

## Posting Legitimacy (Block G)

Block G assesses whether a posting is likely a real, active opening. It does NOT affect the composite score — it is a separate qualitative assessment.

**Three tiers:**
- **High Confidence** — Multiple signals suggest a real, active opening
- **Proceed with Caution** — Mixed signals worth noting
- **Suspicious** — Multiple ghost job indicators; user should investigate before investing time

**Signal reliability table:**

| Signal | Source | Reliability |
|--------|--------|-------------|
| Posting age / date posted | Page content | High |
| Apply button state | Page content | High |
| JD technical specificity | JD text | Medium |
| Requirements realism | JD text | Medium |
| Recent layoffs / hiring freeze | Web search | Medium |
| Reposting pattern (is_repost) | check-history.mjs output | Medium |
| Evergreen posting (is_evergreen) | check-history.mjs output | Medium |
| Salary transparency | JD text | Low (jurisdiction-dependent) |

**Repost vs. Evergreen distinction (from check-history.mjs):**
- `is_evergreen: true` — Exact same URL seen 3+ months apart. Company is always hiring for this role (pipeline role). Usually legitimate but low-urgency.
- `is_repost: true` — Same company + role title but different URL. Role was re-listed, which could indicate failed search or ghost posting. Stronger caution signal.

**Ethical framing (mandatory):** Present observations, not accusations. Every signal has legitimate explanations. The user decides how to weigh them.

---

## Writing Style Calibration

**Check `_profile.md` first.** If a `## Writing Style` section exists, use it directly without re-scanning samples. Re-scan only when new samples are added or user explicitly asks.

**When to apply:** Before generating text the user will send — cover letters, LinkedIn outreach, application answers, follow-ups. Does NOT apply to internal evaluation reports.

**If no cached style:** Read all files in `writing-samples/` (skip `README.md`). If no samples exist, skip calibration and note once that adding a writing sample would help.

### What to extract

- **Tone:** Formal vs. conversational, confident vs. hedging, degree of self-promotion
- **Sentence structure:** Average length, fragment use, how sentences open
- **Punctuation:** Em dashes, Oxford comma, ellipses, exclamation marks
- **Vocabulary:** Technical density, preferred synonyms, words used repeatedly
- **Structure:** Bullet-heavy or prose-heavy, result-first or chronological
- **Voice:** First-person patterns, active vs. passive ratio

**Rules:**
- Only extract what is demonstrably present — no inferences from single data points
- Idiosyncratic choices are intentional — preserve them
- If samples conflict, weight the most recent or most similar-context file
- Never copy verbatim text or retain personal identifiers from samples

**Persist to `_profile.md`** under `## Writing Style` after scanning. One canonical section.

---

## Professional Writing & ATS Compatibility

Applies to ALL candidate-facing text (CVs, cover letters, LinkedIn, form answers). Does NOT apply to evaluation reports.

### Avoid cliché phrases
- "passionate about" / "results-oriented" / "proven track record"
- "leveraged" (use "used" or name the tool)
- "spearheaded" (use "led" or "ran")
- "facilitated" (use "ran" or "set up")
- "synergies" / "robust" / "seamless" / "cutting-edge"
- "demonstrated ability to" / "best practices" (name the practice)

### Specifics beat abstractions
- "Cut p95 latency from 2.1s to 380ms" beats "improved performance"
- "Postgres + pgvector over 12k docs" beats "scalable RAG architecture"
- Name tools, projects, and customers when allowed

### Vary structure
- Don't start every bullet with the same verb
- Mix sentence lengths: short. Then longer with context. Short again.
- No passive voice in CV bullets

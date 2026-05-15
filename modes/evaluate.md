# Mode: evaluate — Full A-G Evaluation

When the user pastes a job URL or JD text, complete the Data Gathering Phase
first, then deliver ALL blocks (A through G + optional H) in a single pass.

---

## Step 0 — Data Gathering Phase (ALL tool calls happen here)

**Complete every step below BEFORE writing any block output.**
LLM streaming cannot pause mid-output to execute tools. Gather all data first.

### 0a. Dependency check

| File | Action if missing |
|------|-------------------|
| `cv.md` | Stop. Tell user: "cv.md is empty — run setup first or paste your CV." |
| `config/profile.yml` | Stop. Tell user: "profile.yml not configured — run setup first." |
| `modes/_profile.md` | Warn, continue with generic evaluation (no archetype framing) |
| `article-digest.md` | Skip silently — optional |

### 0b. Extract JD

- **URL given:** Navigate to the URL and extract the full job description text.
  If inaccessible (login wall, SPA): inform user, ask them to paste JD text.
  LinkedIn often requires login — note this and fall back gracefully.
- **Text pasted:** Use directly.

Record: source URL or "pasted text".

### 0c. Run reposting detection script

Execute: `node scripts/check-history.mjs "{url}" "{company}" "{role title}"`

Capture the full JSON output. Store for use in Block G Signal 4.
If the script is unavailable or returns an error: note "check-history unavailable" and skip Signal 4.

### 0d. Determine next report number

List all files in `reports/`. Extract the highest 3-digit numeric prefix.
New report number = highest + 1, zero-padded to 3 digits. If `reports/` is empty: use 001.
Store: `REPORT_NUM`.

### 0e. Read user context files

Read these files now; do not re-read them mid-output:
1. `config/profile.yml` — candidate identity, comp targets, market
2. `modes/_profile.md` — archetypes, behavioral profile, scoring calibration
3. `cv.md` — master CV
4. `article-digest.md` — if it exists, read it for proof point details

### 0f. Detect archetype

From `modes/_profile.md` archetype table:
1. For each archetype, count "Domain signals" keyword matches in the JD (case-insensitive)
2. Select highest-match archetype (ties → first in table)
3. If match count < 2: flag "Unclassified"
4. If no archetypes defined: note "No archetypes configured — run setup for better framing"

Store: detected archetype name and match count.

**Now begin writing output. All tool calls are complete.**

---

## Block A — Role Summary

Output: `Archetype: {name} ({N} keyword matches)`

Then a compact table:

| Field | Value |
|-------|-------|
| Archetype | {detected or "Unclassified"} |
| Domain | {e.g., hardware, biotech, software, finance} |
| Function | {e.g., build / consult / manage / research} |
| Seniority | {e.g., Senior, Staff, Principal, Director} |
| Remote Policy | {Remote / Hybrid / Onsite} |
| Team Size | {if stated, else "not mentioned"} |
| TL;DR | {one-sentence role summary} |

---

## Block B — CV Match + Fit Score

### Part 1: Gap Analysis (reasoning first)

Map each JD requirement to specific lines from `cv.md`. Cite exact text.
Use the archetype's "What they buy" column to prioritize which matches to lead with.

| JD Requirement | CV Match | Gap Type | Mitigation |
|----------------|----------|----------|------------|
| {requirement} | {exact cv.md line or "No match"} | None / Nice-to-have / Hard blocker | {strategy} |

For each gap:
1. Hard blocker or nice-to-have?
2. Adjacent experience that covers it?
3. Portfolio project that addresses it?
4. Mitigation: phrase for cover letter, quick project, or honest disclosure

### Part 2: Level Alignment Check (do this before scoring)

Compare the JD's required seniority level against the candidate's current level
(from `_profile.md` or `profile.yml`):

- **Gap ≤ 1 level:** Normal. Score Experience & Level accordingly.
- **Gap 2+ levels upward (candidate below role):** Candidate is significantly
  under-leveled. Set fit category override to `TOO_JUNIOR` after calculating composite.
- **Gap 2+ levels downward (candidate above role):** Candidate is significantly
  over-leveled. Set fit category override to `OVERQUALIFIED` after calculating composite.

Record: level gap direction and magnitude. Apply override to Fit Category below.

### Part 3: Scoring Table (grounded in gap analysis above)

Now that the gap analysis and level check are complete, assign dimension scores:

**Golden Examples:** If `_profile.md` has a `## Scoring Calibration` section,
read those examples before scoring. Calibrate scores to the user's demonstrated judgment.

```
| Dimension | Score | Weight | Notes |
|-----------|-------|--------|-------|
| Technical Skills | X/100 | 25% | {grounded in gap analysis} |
| Experience & Level | X/100 | 25% | {includes level gap assessment} |
| Career Alignment | X/100 | 25% | {grounded in gap analysis} |
| Behavioral & Culture | X/100 | 15% | {grounded in gap analysis} |
| Role Quality | X/100 | 10% | {comp, company, stack} |
| Location | PASS/FAIL | — | {match or deal-breaker} |

Composite: (tech×0.25) + (exp×0.25) + (career×0.25) + (behavioral×0.15) + (quality×0.10)
= {calculated}/100 → {display}/5
```

**Location gate:** If FAIL, stop. State reason. Do not calculate composite.

**Fit Category:**
- If level override triggered: `TOO_JUNIOR` or `OVERQUALIFIED` (composite still shown)
- Otherwise: map composite to category per `_shared.md` fit categories table

**Output:**
```
**Composite:** {N}/100 → {N}/5
**Fit Category:** {CATEGORY}
```

---

## Block C — Level & Strategy

*(Level determination already done in Block B. This block is strategic advice only.)*

**If aligned (≤ 1 level gap):**
- What to emphasize in materials and interviews
- How to frame this as the right next step

**If TOO_JUNIOR (2+ levels up):**
- Acknowledge the gap directly — don't minimize it
- Provide strategy IF user wants to pursue: evidence to build, how to negotiate title
- Recommended action: skip unless strategic reason

**If OVERQUALIFIED (2+ levels down):**
- Provide downlevel negotiation strategy if user wants to pursue
- How to de-emphasize seniority signals in materials
- Recommended action: skip unless specific reason (comp, lifestyle, pivot)

---

## Block D — Comp & Demand

Search the web for salary data. Target: Glassdoor, Levels.fyi, Blind, Payscale, LinkedIn Salary.

| Source | Role | Location | Range | Notes |
|--------|------|----------|-------|-------|
| {source} | {title} | {location} | {range} | {context} |

Compare against `config/profile.yml → compensation.target_range` and `compensation.minimum`.

**Market-aware analysis** — read `location.market` from `config/profile.yml`:

- **Non-US markets (DACH, UK, Japan, Francophone, etc.):** Do NOT rely on training
  data for regional labor law specifics. Search the web for current standard practices:
  `"{market}" standard notice period {year}`, `"{market}" 13th month salary norm`.
  Verify before stating. If no data found: say so.
- `DACH`: confirm 13th-month salary, notice periods, works council implications
- `US-West`: base + equity splits, RSU vesting, at-will employment context
- `US-East`: bonus structures (finance/pharma), non-compete enforceability
- `UK`: pension matching, notice periods
- `Japan`: seniority-based comp, bonus weight, negotiation culture
- Market not set: generic analysis; note that setting `location.market` improves accuracy

**If no salary data found:** Say so explicitly — never invent numbers.

---

## Block E — Personalization Plan

Top 5 CV changes for this specific role, using the archetype's "What they buy"
and "Proof point sources" from `_profile.md`:

| # | Section | Current State | Proposed Change | Why |
|---|---------|---------------|-----------------|-----|
| 1 | {section} | {current} | {proposed} | {reason tied to JD} |

If composite ≥ 80 (GOOD_FIT+): also include 2-3 cover letter angles.

---

## Block F — Interview Prep

Generate 4-8 STAR+R stories mapped to JD requirements. Use archetype's "Proof
point sources" from `_profile.md` to select experiences.

| # | JD Requirement | Story Summary | S | T | A | R | Reflection |
|---|---------------|---------------|---|---|---|---|------------|
| 1 | {requirement} | {title} | {situation} | {task} | {action} | {result} | {lesson / what you'd do differently} |

**Reflection** signals seniority — extract lessons, not just events.

**Story Bank:** Read `interview-prep/story-bank.md`. Skip stories already there.
Append new ones — builds the bank across evaluations.

Also include:
- 1 portfolio project / case study recommendation (which to lead with and why)
- 2-3 red-flag questions and prepared responses

---

## Block G — Posting Legitimacy

Assess whether this is a real, active opening.
**Three tiers:** High Confidence | Proceed with Caution | Suspicious

### Signal 1: Posting Freshness
*(From JD page content captured in Step 0b)*
- Date posted or "X days ago"
- Apply button state (active / closed / missing / redirects to generic page)
- Thresholds: < 30 days = positive; 30-60 days = neutral; 60+ = concerning
- Exceptions: government/academic (90 days normal), executive/Staff+ (months normal), evergreen roles

### Signal 2: Description Quality
*(From JD text)*
- Names specific technologies, frameworks, tools?
- Mentions team size, reporting structure, org context?
- Requirements realistic? (e.g., "5 years exp with a 3-year-old technology")
- Clear scope for first 6-12 months?
- Ratio of role-specific vs. generic boilerplate?
- Internal contradictions? (entry-level title + staff requirements)

### Signal 3: Company Hiring Signals
*(From web search in Step 0 — if not already done, search now)*
- `"{company name}" layoffs {current year}`
- `"{company name}" hiring freeze {current year}`
- If layoffs found: scale, date, affected departments

### Signal 4: Reposting Detection
*(Use data already captured in Step 0c — do NOT run the script again)*

Use the stored check-history.mjs JSON output:
- `is_evergreen: true`: pipeline/always-hiring role — legitimate, lower urgency
- `is_repost: true`: re-listed — stronger caution signal
- appearances ≥ 3 over 2+ months: auto-trigger Proceed with Caution minimum
- No history / script unavailable: note "no history available" — skip signal

### Signal 5: Role Market Context
*(Qualitative, no additional queries)*
- Common role that fills in 4-6 weeks?
- Role makes sense for this company's business?
- Seniority level that legitimately takes longer to fill?

### Output

**Tier:** High Confidence | Proceed with Caution | Suspicious

| Signal | Finding | Weight |
|--------|---------|--------|
| Posting Freshness | {finding} | Positive / Neutral / Concerning |
| Description Quality | {finding} | Positive / Neutral / Concerning |
| Company Hiring Signals | {finding} | Positive / Neutral / Concerning |
| Reposting Detection | {finding} | Positive / Neutral / Concerning |
| Market Context | {finding} | Positive / Neutral / Concerning |

**Context Notes:** Caveats explaining signals (niche role, government timeline, evergreen, etc.).

---

## Block H — Draft Application Answers *(conditional: composite ≥ 90 only)*

Only execute this block if the final composite score is 90 or above (PERFECT_MATCH).

Draft answers to the 3-5 most common application form questions for this role type.
Base all answers on `cv.md` and `article-digest.md` — no fabrication.

For each question:
- **Q:** {question}
- **Draft:** {answer, 2-4 sentences, in candidate's voice per `_profile.md` Writing Style}

Typical questions to cover (select most relevant to this JD):
1. "Why do you want to work at {company}?" — tie to company mission, products, team
2. "Why are you leaving your current role?" — use exit narrative from `_profile.md`
3. "Describe your most relevant experience for this role" — top archetype proof point
4. "What's your biggest professional achievement?" — highest-impact metric from cv.md
5. "What questions do you have for us?" — 2 thoughtful questions about the role/team

---

## Post-Evaluation

### 1. Save Report

Save to `reports/{REPORT_NUM}-{company-slug}-{YYYY-MM-DD}.md`
(use `REPORT_NUM` determined in Step 0d — do not re-scan `reports/`).

Company slug: lowercase, spaces → hyphens.

```markdown
# Evaluation: {Company} — {Role}

**Date:** {YYYY-MM-DD}
**URL:** {source URL or "pasted text"}
**Archetype:** {detected archetype}
**Score:** {composite}/100 → {display}/5
**Fit Category:** {CATEGORY}
**Legitimacy:** {tier}
**PDF:** Pending

---

## A) Role Summary
{Block A content}

## B) CV Match + Fit Score
{Block B content — gap analysis, then scoring table}

## C) Level & Strategy
{Block C content}

## D) Comp & Demand
{Block D content}

## E) Personalization Plan
{Block E content}

## F) Interview Prep
{Block F content}

## G) Posting Legitimacy
{Block G content}

## H) Draft Application Answers
{Block H content — only if composite ≥ 90}

---

## Keywords Extracted
{15-20 ATS keywords from the JD for CV optimization}
```

### 2. Register in Tracker

Check `data/applications.md` for existing company + role entry.
- If exists: update the row (status, score, report link).
- If not: append a new row.

```
| {#} | {YYYY-MM-DD} | {Company} | {Role} | {composite}/100 ({display}/5) | {CATEGORY} | Evaluated | ❌ | [{REPORT_NUM}](reports/{REPORT_NUM}-{slug}-{date}.md) | |
```

### 3. Present Summary

```
## Evaluation Complete

**Score:** {composite}/100 → {display}/5
**Fit:** {CATEGORY}
**Legitimacy:** {tier}

**Top 3 Strengths:**
1. {strength}
2. {strength}
3. {strength}

**Top 3 Gaps:**
1. {gap + mitigation}
2. {gap + mitigation}
3. {gap + mitigation}

**Recommended Action:** {Apply immediately / Apply with gap strategy / Consider carefully / Skip}
**Report:** reports/{REPORT_NUM}-{slug}-{date}.md
```

# Mode: evaluate — Full A-G Evaluation

When the user pastes a job URL or JD text, deliver ALL seven blocks (A through G) plus post-evaluation steps.

---

## Step 0 — Dependency Check

Before evaluating, verify these files exist and have content:

| File | Action if missing |
|------|-------------------|
| `cv.md` | Stop. Tell user: "cv.md is empty — run setup first or paste your CV." |
| `config/profile.yml` | Stop. Tell user: "profile.yml not configured — run setup first." |
| `modes/_profile.md` | Warn and continue with generic evaluation (no archetype framing) |
| `article-digest.md` | Skip silently — optional proof points file |

---

## Step 1 — Extract JD

**If URL given:**
1. Navigate to the URL and extract the full job description text
2. If the page is inaccessible (login wall, redirect to generic careers page): inform the user and ask them to paste the JD text directly
3. Note: LinkedIn often requires login — fall back to "please paste the JD text"

**If text pasted:** Use directly.

**Record:** Note the source URL (or "pasted text") for the report.

---

## Step 2 — Detect Archetype

Run dynamic archetype detection per `_shared.md`:

1. Read `modes/_profile.md` → extract archetype table
2. Match "Domain signals" column keywords against JD text (case-insensitive)
3. Select highest-match archetype (ties → first in table)
4. If match count < 2: flag as "Unclassified", continue with generic evaluation
5. If no archetypes defined: note "No archetypes configured — run setup for better framing"

**Display:** `Archetype: {name} ({N} keyword matches)`

---

## Block A — Role Summary

Output a compact table:

| Field | Value |
|-------|-------|
| Archetype | {detected archetype or "Unclassified"} |
| Domain | {e.g., hardware, biotech, software, finance} |
| Function | {e.g., build / consult / manage / research} |
| Seniority | {e.g., Senior, Staff, Principal, Director} |
| Remote Policy | {Remote / Hybrid / Onsite} |
| Team Size | {if stated in JD, else "not mentioned"} |
| TL;DR | {one-sentence role summary} |

---

## Block B — Fit Assessment + CV Match

### Part 1: Structured Fit Score

**Internal reasoning first (not displayed):** Analyze the JD against `cv.md` and `article-digest.md`. Identify gaps and strengths for each dimension before assigning scores.

**Then output the scoring table:**

```
### Fit Assessment

| Dimension | Score | Weight | Notes |
|-----------|-------|--------|-------|
| Technical Skills | X/100 | 25% | {brief justification} |
| Experience & Level | X/100 | 25% | {brief justification} |
| Career Alignment | X/100 | 25% | {brief justification} |
| Behavioral & Culture | X/100 | 15% | {brief justification} |
| Role Quality | X/100 | 10% | {brief justification} |
| Location | PASS/FAIL | — | {location match or deal-breaker} |

**Composite:** {calculated}/100 → **{display}/5**
**Fit Category:** {CATEGORY}
```

**Location gate:** If Location is FAIL, output the reason, do not calculate composite, and recommend skipping unless the user overrides.

**Level alignment soft gate:** If Experience & Level score reflects a 2+ level gap:
- Above candidate's level → set fit category to `TOO_JUNIOR` regardless of composite score
- Below candidate's level → set fit category to `OVERQUALIFIED` regardless of composite score
- Still show composite score — it signals technical/domain fit even when level is wrong

**Golden Examples:** If `_profile.md` has a `## Scoring Calibration` section, read it before scoring. Calibrate scores to match the user's demonstrated judgment.

### Part 2: Requirement-by-Requirement Gap Analysis

Map each stated JD requirement to specific lines from `cv.md`. Cite exact text.

| JD Requirement | CV Match | Gap Type | Mitigation |
|----------------|----------|----------|------------|
| {requirement} | {exact cv.md line} | None / Nice-to-have / Hard blocker | {strategy} |

Use the detected archetype's "What they buy" column to prioritize which matches to highlight — lead with the proof points most relevant to this archetype.

For each gap:
1. Is it a hard blocker or nice-to-have?
2. Can adjacent experience cover it?
3. Is there a portfolio project that addresses it?
4. Mitigation plan: specific phrase for cover letter, quick portfolio project, or honest disclosure strategy

---

## Block C — Level & Strategy

State the detected seniority level vs. the candidate's current level (from `_profile.md` or `profile.yml`).

**If aligned (≤ 1 level gap):**
- What to emphasize in materials and interviews
- How to frame this role as the right next step

**If under-leveled (1 level — candidate below role):**
- Specific phrases and proof points to demonstrate readiness
- What metrics / scope of work to highlight

**If under-leveled (2+ levels — TOO_JUNIOR):**
- State clearly: this role requires significantly more seniority
- Provide strategy IF user wants to pursue (how to negotiate title, what evidence to build)
- Recommended action: skip unless specific strategic reason

**If over-leveled (1 level — candidate above role):**
- Frame as lateral move with growth rationale
- What to de-emphasize to avoid "overqualified" concern

**If over-leveled (2+ levels — OVERQUALIFIED):**
- State clearly: this role is significantly below candidate's level
- Provide downlevel negotiation strategy if user wants to pursue
- Recommended action: skip unless specific strategic reason (compensation, lifestyle, pivot)

---

## Block D — Comp & Demand

Search for salary data using available web search tools. Target: Glassdoor, Levels.fyi, Blind, Payscale, LinkedIn Salary.

Output:

| Source | Role | Location | Range | Notes |
|--------|------|----------|-------|-------|
| {source} | {title} | {location} | {range} | {context} |

**Compare against candidate's comp targets from `config/profile.yml`** (compensation.target_range and compensation.minimum).

**Market-aware analysis** — check `config/profile.yml → location.market` and adapt:
- `DACH`: note 13th-month salary, 3-month notice periods, works council implications
- `US-West`: focus on base + equity splits, RSU vesting schedules, at-will employment
- `US-East`: note finance/pharma bonus structures, non-compete enforceability
- `UK`: check pension matching, notice periods
- `Japan`: note seniority-based comp, bonus weight, limited negotiation culture
- If market not set: use generic analysis, note that setting `location.market` in profile.yml improves accuracy

**If no salary data found:** Say so explicitly — never invent numbers.

---

## Block E — Personalization Plan

Top 5 CV changes for this specific role, using the archetype's "What they buy" and "Proof point sources" from `_profile.md`:

| # | Section | Current State | Proposed Change | Why |
|---|---------|---------------|-----------------|-----|
| 1 | {section} | {current} | {proposed} | {reason tied to JD} |

If composite score ≥ 80 (GOOD_FIT+): also include 2-3 cover letter angles.

---

## Block F — Interview Prep

Generate 4-8 STAR+R stories mapped to JD requirements. Use the archetype's "Proof point sources" column from `_profile.md` to select which experiences to frame as stories.

| # | JD Requirement | Story Summary | S | T | A | R | Reflection |
|---|---------------|---------------|---|---|---|---|------------|
| 1 | {requirement} | {title} | {situation} | {task} | {action} | {result} | {what you learned / would do differently} |

**Reflection** signals seniority — senior candidates extract lessons, junior candidates describe events.

**Story Bank:** Read `interview-prep/story-bank.md` if it exists. Check for overlapping stories. Append new stories that don't already exist — build the bank over time.

Also include:
- 1 portfolio project / case study recommendation (which one to lead with and why)
- 2-3 red-flag questions and prepared responses (e.g., "Why are you leaving?", "Why do you want this role?")

---

## Block G — Posting Legitimacy

Assess whether this is likely a real, active opening. Three tiers: **High Confidence** | **Proceed with Caution** | **Suspicious**.

### Signal 1: Posting Freshness

From the page content captured in Step 1:
- Date posted or "X days ago"
- Apply button state (active / closed / missing / redirects to generic page)
- Age thresholds: under 30 days = positive; 30-60 days = neutral; 60+ days = concerning (adjusted for role type)
- **Exception:** Government/academic (60-90 days normal), niche/executive/Staff+ roles (months are normal), evergreen roles (explicitly ongoing)

### Signal 2: Description Quality

From the JD text:
- Does it name specific technologies, frameworks, tools?
- Does it mention team size, reporting structure, org context?
- Are requirements realistic? (e.g., "5 years of experience with a 3-year-old technology")
- Is there a clear scope for the first 6-12 months?
- What ratio is role-specific vs. generic boilerplate?
- Any internal contradictions? (entry-level title + staff requirements)

### Signal 3: Company Hiring Signals

Search the web for:
- `"{company name}" layoffs {current year}`
- `"{company name}" hiring freeze {current year}`
- If layoffs found: note scale, date, and whether this department is affected

### Signal 4: Reposting Detection

Run: `node scripts/check-history.mjs "{url}" "{company}" "{role title}"`

Read the JSON output:
```json
{
  "appearances": N,
  "first_seen": "YYYY-MM-DD",
  "last_seen": "YYYY-MM-DD",
  "is_repost": false,
  "is_evergreen": false,
  "verdict": "..."
}
```

- `is_evergreen: true` (same URL, 3+ months apart): Likely a pipeline role — company always hiring. Usually legitimate. Lower urgency, not a ghost signal.
- `is_repost: true` (same company+title, different URL): Role was re-listed. Could indicate failed search or ghost posting. Stronger caution signal.
- If script returns 0 appearances or scan-history.tsv is empty: skip this signal, note "no history available"
- If appearances ≥ 3 over 2+ months: auto-trigger **Proceed with Caution** minimum tier

### Signal 5: Role Market Context

Qualitative assessment (no additional queries):
- Is this a common role that typically fills in 4-6 weeks?
- Does the role make sense for this company's business?
- Is the seniority level one that legitimately takes longer to fill?

### Output Format

**Assessment tier:** High Confidence | Proceed with Caution | Suspicious

| Signal | Finding | Weight |
|--------|---------|--------|
| Posting Freshness | {finding} | Positive / Neutral / Concerning |
| Description Quality | {finding} | Positive / Neutral / Concerning |
| Company Hiring Signals | {finding} | Positive / Neutral / Concerning |
| Reposting Detection | {finding} | Positive / Neutral / Concerning |
| Market Context | {finding} | Positive / Neutral / Concerning |

**Context Notes:** Any caveats explaining signals (niche role, government timeline, evergreen role, etc.).

---

## Post-Evaluation

### 1. Save Report

Save the complete evaluation to `reports/{###}-{company-slug}-{YYYY-MM-DD}.md`.

**Report number:** List all files in `reports/`, extract the highest 3-digit prefix, add 1. If `reports/` is empty, start at 001.

**Company slug:** Lowercase company name, spaces → hyphens (e.g., "Acme Corp" → "acme-corp").

**Report format:**

```markdown
# Evaluation: {Company} — {Role}

**Date:** {YYYY-MM-DD}
**URL:** {source URL or "pasted text"}
**Archetype:** {detected archetype}
**Score:** {composite}/100 → {display}/5
**Fit Category:** {CATEGORY}
**Legitimacy:** {High Confidence | Proceed with Caution | Suspicious}
**PDF:** Pending

---

## A) Role Summary
{Block A content}

## B) Fit Assessment + CV Match
{Block B content — scoring table + gap analysis}

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

---

## Keywords Extracted
{15-20 ATS keywords from the JD for CV optimization}
```

### 2. Register in Tracker

Append a new row to `data/applications.md`:

```
| {#} | {YYYY-MM-DD} | {Company} | {Role} | {composite}/100 ({display}/5) | {CATEGORY} | {Fit} | Evaluated | ❌ | [{###}](reports/{###}-{slug}-{date}.md) | |
```

**RULE: NEVER create a duplicate entry.** Check if company + role already exists. If yes, update the existing row instead.

### 3. Present Summary

Output a concise summary to the user:

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
**Report:** reports/{###}-{slug}-{date}.md
```

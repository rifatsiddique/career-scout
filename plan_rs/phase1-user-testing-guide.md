# Phase 1 User Testing Guide — Gemini CLI

**Version:** 1.0
**Date:** 2026-05-14
**Scope:** Testing evaluate, pipeline, and setup modes using Gemini CLI
**Reference:** Full technical test plan → `plan_rs/phase1-test-plan.md`

---

## Before You Start

### Prerequisites

From `C:/Work/Git-Python/career-scout/`:

```bash
# Verify Node.js >= 18
node --version

# Verify check-history script loads correctly
node scripts/check-history.mjs
# Should print: Usage: node scripts/check-history.mjs <url> [company] [role-title]
```

Start Gemini CLI from the project root:

```bash
cd C:/Work/Git-Python/career-scout
gemini
```

---

## Test 1: Setup (First Run)

**Purpose:** Populate your profile so evaluations are personalized.

**Trigger:**
```
setup
```

**Walk through the wizard:**

1. System checks if `cv.md` has content. If empty, paste your CV or describe your experience.
2. You'll be asked to select your domain — if you work in AI/ML, select the AI/ML starter kit. Otherwise choose "build from scratch."
3. For each archetype, answer the expert-intent questions:
   - *"What signals in a JD tell you this role was written for you?"* — describe patterns, not just keywords
   - *"What do they buy from you?"* — your specific value in that archetype
   - *"Which experiences are your best proof points?"* — point to cv.md sections
4. Behavioral profile: working style, fit/friction keywords, deal-breakers (optional but valuable)
5. Writing style: if you have any files in `writing-samples/`, they'll be read automatically
6. **Golden Examples calibration** — the system generates 3 sample JD requirements:
   - One that's a near-perfect match for you
   - One where you have a domain match but a tool/stack gap
   - One that's clearly not your area
   
   For each, answer with a score (0-100) and explain your reasoning. This calibrates the LLM to your scoring judgment.

**After setup, verify:**

```bash
# Profile should have your real data
cat config/profile.yml

# Should have archetype table + Scoring Calibration section
cat modes/_profile.md
```

Check that `_profile.md` contains:
- [ ] `## Your Target Roles` table with at least 1 archetype
- [ ] `## Scoring Calibration` section with 3 Golden Examples

---

## Test 2: Evaluate a Real Job

**Purpose:** Confirm the A-G evaluation pipeline works end-to-end.

**Option A — paste a URL:**
```
https://boards.greenhouse.io/{company}/jobs/{id}
```

**Option B — type evaluate then paste JD text:**
```
evaluate
[paste the full JD text here]
```

**What you should see (in order):**

1. `Archetype: {name} ({N} keyword matches)` — check this matches the right archetype from your `_profile.md`
2. **Block A** — Role Summary table (archetype, domain, seniority, remote, TL;DR)
3. **Block B** — Fit Assessment scoring table with 5 dimensions + Location, then gap analysis with exact CV citations
4. **Block C** — Level & Strategy (should say "aligned", "TOO_JUNIOR", or "OVERQUALIFIED" based on your level vs. the role)
5. **Block D** — Salary data from web search (will note your market if set in profile.yml)
6. **Block E** — 5 CV personalization recommendations
7. **Block F** — 4-8 STAR+R stories mapped to JD requirements
8. **Block G** — Posting legitimacy tier + signal table (Signal 4 runs `check-history.mjs` — on a fresh install it will say "no history available", which is correct)
9. Summary: Score, Fit Category, Legitimacy, Top 3 strengths/gaps, Recommended Action

**After evaluation, verify these files were updated:**

```bash
# Report saved
ls reports/

# Tracker row added
cat data/applications.md
```

**Quality spot-checks:**
- [ ] Fit category matches composite score (e.g., 83/100 → GOOD_FIT)
- [ ] CV citations in Block B are real lines from your cv.md, not invented
- [ ] Block D doesn't invent salary numbers if no data found (should say "no data available")
- [ ] Archetype detection used your `_profile.md` archetypes, not hardcoded AI/ML ones

---

## Test 3: Pipeline Triage

**Purpose:** Confirm batch URL processing works.

**Step 1:** Add 2 real job URLs to `data/pipeline.md` under the Pending table:

```markdown
## Pending
| URL | Company | Role | Source | Found | Notes |
|-----|---------|------|--------|-------|-------|
| https://boards.greenhouse.io/{company1}/jobs/{id} | Company1 | Role Title | manual | 2026-05-14 | |
| https://jobs.lever.co/{company2}/{id} | Company2 | Role Title | manual | 2026-05-14 | |
```

**Step 2 — Trigger:**
```
pipeline
```

**What you should see:**
- Sequential evaluation of both URLs (full A-G for each)
- Summary table at the end with scores and recommended actions

**After triage, verify:**

```bash
# Pending table should be empty, Evaluated table should have 2 rows
cat data/pipeline.md

# 2 new reports
ls reports/

# 2 new rows in tracker
cat data/applications.md
```

---

## Test 4: Edge Cases

Test these after Tests 1-3 pass.

### Login-gated URL (LinkedIn)
```
https://www.linkedin.com/jobs/view/{any-id}/
```
Expected: Gemini says it can't access the page and asks you to paste the JD text.

### Role significantly above your level
Paste a JD for a level 2+ above your current level (e.g., if you're Senior, use a VP/Director JD).
Expected: Block B shows TOO_JUNIOR category. Score is still calculated and shown.

### Role significantly below your level
Paste a JD for a level 2+ below your current level.
Expected: Block B shows OVERQUALIFIED. Score still shown. Block C provides downlevel strategy.

### Remote-only candidate, on-site role
If your profile says "Remote only" and the JD says "onsite required":
Expected: Location: FAIL. No composite score calculated.

---

## Known Behaviors to Expect

| Behavior | Why it's correct |
|----------|-----------------|
| Block G signal 4 says "no history available" on first run | scan-history.tsv is empty — correct, not a bug |
| Scores vary slightly between runs (±3-5 points) | LLM non-determinism — inherent to LLM scoring. Fit categories absorb small variance |
| Setup creates `.bak` files | Safety net in case you re-run setup — your manual edits are preserved |
| Gemini asks permission before running `node scripts/check-history.mjs` | Shell execution permission prompt — approve it |
| "Unclassified" archetype if no keyword matches | Your `_profile.md` archetypes don't match this JD — run setup to add more archetypes |

---

## Reporting Issues

Note the following for each issue found:
1. Which test (1-4 or edge case)
2. What you typed / what URL you used
3. What you expected vs. what happened
4. The relevant section of the output (Block B, Block G, etc.)

Save issues in a note and bring to the next session.

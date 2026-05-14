# Phase 1 Test Plan

**Version:** 1.0
**Date:** 2026-05-14
**Scope:** check-history.mjs script (automated) + Gemini CLI end-to-end (manual)

---

## Automated Tests: check-history.mjs

Run from `C:/Work/Git-Python/career-scout/`:

```bash
node scripts/check-history.mjs
# Expected: Usage error message, exit 1

node scripts/check-history.mjs "https://nonexistent.com/job" "Acme" "Eng"
# Expected: appearances=0, verdict contains "No prior appearances found"
```

**Seed test data then verify signals:**

```js
// Seed into data/scan-history.tsv (run once):
const rows = [
  'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation',
  'https://greenhouse.io/acme/jobs/123\t2026-01-10\tgreenhouse\tSenior Engineer\tAcme Corp\tnew\tRemote',
  'https://greenhouse.io/acme/jobs/123\t2026-04-15\tgreenhouse\tSenior Engineer\tAcme Corp\tnew\tRemote',
  'https://greenhouse.io/beta/jobs/555\t2026-02-01\tgreenhouse\tML Engineer\tBeta Inc\tnew\tSF',
  'https://greenhouse.io/beta/jobs/777\t2026-03-15\tgreenhouse\tML Engineer\tBeta Inc\tnew\tSF',
  'https://lever.co/gamma/jobs/999\t2026-05-10\tlever\tProduct Manager\tGamma Co\tnew\tNY',
].join('\n');
require('fs').writeFileSync('data/scan-history.tsv', rows);
```

| Test | Command | Expected `is_evergreen` | Expected `is_repost` | Expected `appearances` |
|------|---------|------------------------|----------------------|------------------------|
| Evergreen detection | `node scripts/check-history.mjs "https://greenhouse.io/acme/jobs/123" "Acme Corp" "Senior Engineer"` | `true` | `false` | 2 |
| Repost detection | `node scripts/check-history.mjs "https://greenhouse.io/beta/jobs/777" "Beta Inc" "ML Engineer"` | `false` | `true` | 2 |
| Fresh/single | `node scripts/check-history.mjs "https://lever.co/gamma/jobs/999" "Gamma Co" "Product Manager"` | `false` | `false` | 1 |
| No match | `node scripts/check-history.mjs "https://unknown.com/job" "Unknown" "Engineer"` | `false` | `false` | 0 |

**Restore:** `printf 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\n' > data/scan-history.tsv`

**All 4 tests verified passing: 2026-05-14**

---

## Manual Tests: Gemini CLI End-to-End

### Pre-conditions

- [ ] `gemini` CLI installed and authenticated
- [ ] `cv.md` populated with real content
- [ ] `config/profile.yml` and `modes/_profile.md` filled in (or plan to test setup mode first)

### Test 1: setup mode (first-time onboarding)

**Trigger:**
```
gemini
> setup
```

**Verify:**
- [ ] System asks for cv.md content if empty, OR confirms it found cv.md
- [ ] Domain Pack list presented (should include "AI/ML Engineering")
- [ ] Archetype table built with expert-intent framing questions
- [ ] Behavioral profile captured
- [ ] 3 Golden Examples collected (ceiling, gap, floor)
- [ ] `config/profile.yml` written with name/email/location/market/compensation
- [ ] `modes/_profile.md` written with archetype table + scoring calibration section
- [ ] If .bak needed: backup files created

### Test 2: evaluate mode with a real job URL

**Trigger:**
```
gemini
> https://boards.greenhouse.io/{any-company}/jobs/{any-id}
```
OR
```
> evaluate
> [paste a real JD]
```

**Verify:**
- [ ] Block A: Role Summary table produced with archetype detected
- [ ] Block B Part 1: Scoring table with 5 dimensions + Location + composite
- [ ] Block B Part 2: Gap analysis with CV citations
- [ ] Block C: Level analysis (aligned, under, or over)
- [ ] Block D: Salary data from web search, market-aware notes
- [ ] Block E: 5 personalization recommendations
- [ ] Block F: STAR+R stories (4-8) mapped to JD requirements
- [ ] Block G: Legitimacy tier + signal table (check-history.mjs runs for signal 4)
- [ ] Report saved to `reports/001-{slug}-{date}.md`
- [ ] Row added to `data/applications.md`
- [ ] Summary shown at end

**Spot-check report quality:**
- [ ] No hardcoded AI/ML assumptions if JD is non-AI domain
- [ ] Fit category matches composite score (e.g., 83 → GOOD_FIT)
- [ ] CV citations are real lines from cv.md, not invented

### Test 3: pipeline triage mode

**Setup:** Add 2 URLs to `data/pipeline.md` Pending table:
```markdown
## Pending
| URL | Company | Role | Source | Found | Notes |
|-----|---------|------|--------|-------|-------|
| https://boards.greenhouse.io/acme/jobs/1 | Acme | Engineer | manual | 2026-05-14 | |
| https://jobs.lever.co/beta/2 | Beta | PM | manual | 2026-05-14 | |
```

**Trigger:**
```
> pipeline
```

**Verify:**
- [ ] Both URLs evaluated
- [ ] Both rows moved from Pending to Evaluated table
- [ ] Reports created in `reports/`
- [ ] Rows added to `data/applications.md`
- [ ] Summary table shown at end

### Test 4: edge cases

| Scenario | Input | Expected behavior |
|----------|-------|-------------------|
| No cv.md content | `evaluate` with empty cv.md | Clear error: "cv.md is empty — run setup first" |
| Login-gated URL | LinkedIn URL | Graceful fallback: "Please paste the JD text" |
| No archetypes in _profile.md | evaluate with empty _profile.md | Generic evaluation, note to run setup |
| Empty pipeline | `pipeline` with no Pending rows | "Pipeline is empty — no pending URLs to process" |
| 2+ level seniority gap | Evaluate a Staff role as a Junior candidate | TOO_JUNIOR category, score still shown |
| Location mismatch | Evaluate on-site role when profile says Remote Only | Location: FAIL, no composite calculated |

---

## Senior Engineer Review Notes

### What looks solid

1. **`check-history.mjs` is deterministic and correct.** All 4 signal cases verified. The is_repost vs is_evergreen distinction is implemented correctly per the plan. URL normalization strips tracking params and trailing slashes. Edge cases handled (missing TSV, empty TSV, no args).

2. **`modes/_shared.md` is genuinely CLI-agnostic.** No Claude/Gemini tool names. The "Tool Usage (Intent-Based)" table correctly abstracts the tool layer. Writing style calibration section ported accurately from career-ops.

3. **`modes/evaluate.md` follows the A-G structure faithfully** with the enhancements: structured scoring table before gap analysis, soft level gate, market-aware Block D, check-history.mjs in Block G, proper report numbering logic.

4. **`modes/setup.md` has the safety .bak step** (Step 9) and the Golden Example boundary testing (Step 8 generates ceiling/gap/floor requirements).

5. **Domain pack is clean YAML** that can be loaded and injected into `_profile.md` during setup. Source annotation preserved for Domain Pack precedence detection.

### Known limitations / risks for testing

1. **Gemini's native tools vs. check-history.mjs:** Gemini CLI must be able to execute `node scripts/check-history.mjs`. This requires Node.js 18+ in PATH and shell execution permissions in Gemini's tool context. If Gemini can't execute shell commands, Block G signal 4 will silently fail — the mode should handle this gracefully.

2. **Context window and file loading:** `evaluate.md` (12KB) + `_shared.md` (11KB) + `cv.md` (user content) + `_profile.md` (user content) loaded together. For a Gemini 1M context model this is fine, but verify the skill loads all files before evaluating.

3. **LLM hallucination risk in scoring:** The 5-dimension scores are LLM-generated. Non-determinism means the same JD could score 78 or 83 on different runs. The 80-point fit category boundary is guidance, not a hard gate. Document this to the user.

4. **setup.md .bak logic:** The mode describes checking for "content beyond template placeholders" before backing up. This is an LLM judgment call — it may not always correctly distinguish a filled profile from an empty template. Low risk but worth noting.

5. **Report numbering race condition:** If two evaluations run simultaneously (not yet supported, but future-proofed), both might pick the same report number. Phase 5 parallel processing will need atomic numbering. For Phase 1 sequential mode, this is fine.

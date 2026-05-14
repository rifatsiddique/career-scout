# Phase 1: Foundation — Evaluate + Pipeline Modes

**Version:** 1.3
**Last Updated:** 2026-05-14 16:00 -- incorporated Gemini CLI final review (5/5 accepted: Golden Example boundaries, is_evergreen distinction, Domain Pack precedence, market behavioral switch, .bak safety). Architectural approval granted.
**Parent Plan:** CONSOLIDATION-PLAN.md, Section 11, Phase 1
**Goal:** Paste a job URL or JD text into Gemini CLI → get a full A-G evaluation with structured scoring

---

## 1. Context

Phase 1 establishes the core evaluation loop — the single most important capability in career-scout. Everything else (CV generation, Scout, interview prep) builds on top of this.

We're porting from career-ops, but this is NOT a copy-paste job. Three major adaptations are required:

1. **Language:** career-ops evaluation modes (`oferta.md`, `pipeline.md`, `auto-pipeline.md`) are written in **Spanish**. career-scout is English-only.
2. **Domain:** career-ops hardcodes 6 AI/ML archetypes everywhere. career-scout must be domain-agnostic (user-defined archetypes).
3. **Scoring:** The consolidation plan merges scoring from two incompatible systems (see Section 3 below).

---

## 2. Pre-Implementation Bugs & Conflicts

### Bug 1: Scoring Scale Mismatch (CRITICAL)

The consolidation plan (Section 5) proposes merging ai-job-search's 5-dimension scoring into career-ops's Block B. But the two systems use **incompatible scales and thresholds.**

| System | Scale | "Good" threshold | "Strong" threshold |
|--------|-------|-------------------|---------------------|
| ai-job-search | 0-100 per dimension, weighted composite | 60/100 | 75/100 |
| career-ops | 1-5 global | 4.0/5 (= 80/100) | 4.5/5 (= 90/100) |
| Consolidation plan | Both (82/100 → 4.1/5) | 70/100 (GOOD_FIT) | 85/100 (PERFECT_MATCH) |

**The conversion `score/20 = 1-5 equivalent` creates a threshold conflict:**
- Plan says GOOD_FIT = 70-84 → converts to 3.5-4.2 on 1-5 scale
- But career-ops treats 3.5-3.9 as "decent but not ideal, apply only if specific reason"
- So a GOOD_FIT (70/100) under the plan maps to a "meh, probably skip" under career-ops's original thresholds

**Resolution (proposed):** Use career-ops's more selective thresholds as the standard, since quality > quantity is the stated philosophy. Adjust the fit category ranges:

| Category | 0-100 range | 1-5 equivalent | Action |
|----------|-------------|----------------|--------|
| PERFECT_MATCH | 90-100 | 4.5-5.0 | Apply immediately, full tailoring |
| GOOD_FIT | 80-89 | 4.0-4.4 | Apply, address gaps in materials |
| PARTIAL_MATCH | 65-79 | 3.25-3.9 | Consider carefully, discuss with user |
| HARD_MISMATCH | 40-64 | 2.0-3.2 | Probably skip unless strategic |
| TOO_JUNIOR | any | any | Specific: insufficient seniority |
| OVERQUALIFIED | any | any | Specific: role below candidate level |
| POOR_FIT | 0-39 | 0-1.9 | Skip |

This keeps the "apply" bar at 4.0/5 (= 80/100), consistent with career-ops's proven thresholds from 740+ evaluations.

### Bug 2: Dimension Weight Mismatch

The plan uses ai-job-search's weights: Technical 30%, Experience 25%, Behavioral 15%, Career 30%.

But career-ops's proven 10-dimension model weights things differently. Most critically:
- career-ops gives "Level/Seniority" 15% weight — ai-job-search doesn't have this as a dimension at all (it's folded into Experience Match)
- career-ops treats Company Reputation, Tech Stack Modernity, and Time-to-Offer as separate dimensions (5% each) — ai-job-search ignores these entirely

**Resolution (proposed):** Expand to 5+1 dimensions that cover both systems:

| Dimension | Weight | What it captures | Source |
|-----------|--------|-----------------|--------|
| Technical Skills | 25% | Skills match, tools, domain knowledge | ai-job-search (was 30%) |
| Experience & Level | 25% | Years, seniority, direct domain experience | merged from both |
| Career Alignment | 25% | Growth trajectory, motivation, target role fit | ai-job-search (was 30%) |
| Behavioral & Culture | 15% | Working style, management fit, team dynamics | ai-job-search (unchanged) |
| Role Quality | 10% | Comp, company reputation, tech stack, growth path | career-ops unique dimensions condensed |
| Location | Pass/Fail | Deal-breaker check, not weighted | ai-job-search (unchanged) |

This preserves career-ops's seniority signal (now in Experience & Level) and its company/comp awareness (now in Role Quality) while keeping ai-job-search's behavioral framework.

### Bug 3: Archetype Detection is Hardcoded (CRITICAL)

career-ops's `_shared.md` (lines 76-86) has this hardcoded table:

```
| AI Platform / LLMOps | "observability", "evals", "pipelines" |
| Agentic / Automation | "agent", "HITL", "orchestration" |
| Technical AI PM      | "PRD", "roadmap", "discovery" |
| ...
```

Every evaluation mode (oferta.md blocks A, B, F) references these archetypes for framing. If we port the evaluation mode, every archetype reference must be replaced with a dynamic lookup against the user's `_profile.md` archetype table.

**Resolution:** The evaluate mode must:
1. Read `modes/_profile.md` → extract the user's archetype table
2. Match JD keywords against the user's "Domain signals" column
3. Select the best-match archetype
4. Use that archetype's "What they buy" and "Proof point sources" for adaptive framing

If `_profile.md` has no archetypes defined yet (first run), the evaluate mode should prompt the user to run `setup` first, or fall back to a generic evaluation without archetype framing.

### Bug 4: Spanish Content Cannot Be Copy-Pasted

These files are in Spanish and must be rewritten in English:
- `oferta.md` (216 lines) — the core evaluation mode
- `pipeline.md` (57 lines) — pipeline triage
- `auto-pipeline.md` (72 lines) — deferred to Phase 5, but referenced in Phase 1

This is NOT a translation task. The modes contain domain-specific AI/ML instructions that must also be made domain-agnostic simultaneously. **Rewrite from scratch using the Spanish modes as structural reference.**

### Bug 5: Tool Name References

career-ops's `AGENTS.md` and `SKILL.md` reference Claude-specific tools:
- `Agent` tool with `run_in_background` parameter
- `/loop` and `/schedule` skills
- `Playwright` via `browser_navigate` / `browser_snapshot`

For CLI-agnostic mode files, use generic verbs:
- "spawn a subagent" not "use the Agent tool"
- "navigate to the URL in a browser" not "use browser_navigate"
- "search the web for..." not "use WebSearch"

`AGENTS.md` can have a CLI-specific tool mapping table, but mode files stay generic.

### Bug 6: Pipeline.md Name Collision

The project has `data/pipeline.md` (the data file — Scout-Evaluator contract) AND `modes/pipeline.md` (the mode instructions). Same filename in different directories.

This is technically fine (different paths) but could cause confusion when discussing "pipeline.md" in instructions, documentation, or conversation.

**Resolution:** Rename the mode file to `modes/pipeline-triage.md` (describes what it actually does — triaging the pipeline inbox). Update SKILL.md routing accordingly. The mode is still invoked as `pipeline` by the user, but the file is `pipeline-triage.md` to avoid ambiguity.

### Issue 7: Consolidated Plan's Block B vs. Career-ops's Block B

The consolidation plan says Block B should have the structured fit scoring table BEFORE the gap analysis. But career-ops's oferta.md Block B goes straight into CV line matching with no numeric scoring — the 1-5 global score is assigned at the end (post-Block G).

**Resolution:** In career-scout, Block B produces the structured scoring table FIRST (dimensions + fit category), THEN continues with the requirement-by-requirement gap analysis. The gap analysis informs the scores, not the other way around. The global 1-5 score displayed in reports is the composite from Block B's dimension table.

---

## 3. Unified Scoring System Design

Based on the conflict analysis above, here is the definitive scoring system for career-scout:

### 3.1 Dimensions

| # | Dimension | Weight | Scale | Scoring Guide |
|---|-----------|--------|-------|---------------|
| 1 | **Technical Skills** | 25% | 0-100 | 90+: core requirements are primary skills; 70-89: most match, 1-2 learnable gaps; 50-69: partial, significant gaps; <50: fundamental mismatch |
| 2 | **Experience & Level** | 25% | 0-100 | 90+: direct domain + right seniority; 70-89: related experience, transferable; 50-69: adjacent, need to make case; <50: unrelated or wrong level |
| 3 | **Career Alignment** | 25% | 0-100 | 90+: strongly aligned with trajectory; 70-89: good fit, partially aligned; 50-69: decent but doesn't build toward goals; <50: dead end |
| 4 | **Behavioral & Culture** | 15% | 0-100 | 90+: culture matches behavioral profile; 70-89: mostly compatible; 50-69: friction areas; <50: significant mismatch |
| 5 | **Role Quality** | 10% | 0-100 | 90+: strong comp, great company, modern stack; 70-89: good overall; 50-69: average; <50: below market or red flags |
| 6 | **Location** | — | Pass/Fail | PASS: within constraints; FAIL: deal-breaker (hard stop, no composite score calculated) |

**Location gate:** Location is evaluated BEFORE the weighted dimensions. If FAIL, the composite score is not calculated. The report shows the fail reason and recommends skipping unless the user explicitly overrides.

**Level Alignment — soft gate (Gemini review #2):** Level/seniority mismatch is NOT a hard pass/fail. Instead, when the Experience & Level dimension (dimension #2) detects a 2+ level gap, the system auto-assigns the appropriate override category:
- **TOO_JUNIOR:** Role requires significantly more seniority than candidate has (e.g., Junior → Staff). Composite score is still calculated but the fit category is overridden.
- **OVERQUALIFIED:** Role is significantly below candidate's level (e.g., Staff → Junior). Composite score is still calculated but the fit category is overridden.
- The composite score is still shown (it provides useful signal about technical/domain fit even when level is wrong), but the fit category override makes the mismatch visible and adjusts the recommended action.
- **Why soft instead of hard:** A hard gate discards roles where the candidate might negotiate level, where the title doesn't reflect actual scope, or where a lateral move serves a strategic career pivot. Career-ops's experience with 740+ evals showed that level mismatches are common in postings and often misleading — a "Senior" title at a startup may be "Mid" at a FAANG. Let the user decide.

**Calibration note:** A score of 75/100 is NOT a "C grade" passing mark. It is a PARTIAL_MATCH — a role with real gaps that requires strategic justification to pursue. The scoring rubric is calibrated so that 80/100 is the "apply" bar, consistent with career-ops's selectivity over 740+ evaluations.

### 3.2 Composite Score

```
composite = (tech * 0.25) + (exp * 0.25) + (career * 0.25) + (behavioral * 0.15) + (quality * 0.10)
display_score = composite / 20    # → 0.0-5.0 scale for human readability
```

### 3.3 Fit Categories

| Category | Composite Range | Display (1-5) | Recommended Action |
|----------|-----------------|---------------|-------------------|
| PERFECT_MATCH | 90-100 | 4.5-5.0 | Apply immediately. Full CV tailoring + cover letter |
| GOOD_FIT | 80-89 | 4.0-4.4 | Apply. Address gaps in materials |
| PARTIAL_MATCH | 65-79 | 3.25-3.95 | Consider carefully. Discuss with user before proceeding |
| HARD_MISMATCH | 40-64 | 2.0-3.2 | Probably skip unless strategic reasons |
| POOR_FIT | 0-39 | 0-1.95 | Skip |
| TOO_JUNIOR | any | any | Soft override: 2+ level gap upward. Score still calculated, category overridden. Strategy: skip OR negotiate level |
| OVERQUALIFIED | any | any | Soft override: 2+ level gap downward. Score still calculated, category overridden. Strategy: skip OR lateral pivot |

### 3.4 Where Scores Are Used

| Decision point | Threshold | Source phase |
|---------------|-----------|-------------|
| Generate PDF CV | composite >= 65 (PARTIAL_MATCH+) | Phase 2 (cv mode) |
| Drafter-reviewer workflow | composite >= 80 (GOOD_FIT+) | Phase 2 (cv mode) |
| Draft application answers | composite >= 90 (PERFECT_MATCH) | Phase 5 (auto mode) |
| Recommend applying | composite >= 80 (GOOD_FIT+) | Phase 1 (evaluate mode) |

### 3.5 Domain Packs (Starter Kits)

Domain Packs solve the **generalization penalty** — making the system domain-agnostic doesn't mean throwing away battle-tested domain expertise. Career-ops's 6 AI/ML archetypes represent 740+ evaluations of refinement. Instead of deleting them, they ship as a selectable starter template.

**Available Domain Packs (Phase 1):**

| Pack | Source | Archetypes Included |
|------|--------|---------------------|
| **AI/ML Engineering** | career-ops (6 archetypes, adapted to English) | AI Platform / LLMOps, Agentic / Automation, Technical AI PM, ML Infrastructure, Applied ML / Data Science, AI Research Engineering |

**Future Domain Packs (community-contributed, Phase 5+):**

| Pack | Archetypes (examples) |
|------|----------------------|
| Electrical Engineering | Analog IC Design, Digital ASIC/FPGA, Power Electronics, RF/Wireless, Embedded Systems |
| Biotech / Pharma | Clinical Research, Bioprocess Engineering, Regulatory Affairs, Computational Biology |
| Product Management | Technical PM, Growth PM, Platform PM, Enterprise PM |
| Software Engineering | Backend / Infrastructure, Frontend / UI, Full-Stack, DevOps / SRE, Security |

**How Domain Packs work:**
1. Each pack is a YAML file in `templates/domain-packs/` (e.g., `ai-ml.yml`)
2. Contains: archetype names, domain signals (keywords/phrases), "what they buy" descriptions, and suggested proof point sources
3. During setup, if user selects a pack, the archetypes are injected into `_profile.md` as editable starting material
4. User customizes freely — the pack is a scaffold, not a constraint
5. If user's domain isn't covered by any pack, setup falls back to extracting archetypes from cv.md

**Phase 1 scope:** Only the AI/ML pack ships (ported from career-ops). The infrastructure for loading packs from YAML is built. Other packs are documented as future contributions.

---

## 4. Files to Create / Modify

### 4.1 New Files (write from scratch)

| File | Lines (est.) | Description |
|------|-------------|-------------|
| `AGENTS.md` | ~200 | CLI-agnostic system instructions. Rewritten from career-ops, English, domain-agnostic |
| `GEMINI.md` | ~5 | Gemini CLI wrapper, imports AGENTS.md |
| `modes/_shared.md` | ~180 | Global rules, scoring system (Section 3 above), dynamic archetype detection, writing rules |
| `modes/evaluate.md` | ~250 | A-G evaluation blocks. Rewritten from career-ops `oferta.md`, English, domain-agnostic |
| `modes/pipeline-triage.md` | ~60 | Pipeline triage mode. Rewritten from career-ops `pipeline.md`, English |
| `modes/setup.md` | ~120 | Guided profile creation + archetype suggestion |
| `scripts/check-history.mjs` | ~40 | TSV parser for scan-history.tsv. Takes URL or company slug, returns structured JSON with appearance count and repost verdict |
| `templates/domain-packs/ai-ml.yml` | ~60 | AI/ML Domain Pack — 6 archetypes ported from career-ops with English signals, "what they buy", proof sources |
| `data/follow-ups.md` | ~5 | Empty tracker with headers |

### 4.2 Existing Files to Update

| File | Change |
|------|--------|
| `.agents/skills/career-scout/SKILL.md` | Add Phase 1 mode routing (evaluate, pipeline, setup). Update context loading rules |
| `CLAUDE.md` | Add reference to AGENTS.md import pattern |
| `modes/_profile.md` | Already created — verify it works with dynamic archetype detection |
| `config/profile.yml` | Add `market` key (Gemini review #2) — regional context for comp/labor law adaptation (e.g., `DACH`, `US-West`, `Francophone`, `Japan`). Used by Block D (Comp & Demand) to contextualize salary data and by Block E to adapt CV conventions |
| `data/pipeline.md` | Already created — no changes needed |
| `data/applications.md` | Already created — no changes needed |
| `templates/states.yml` | Already created — no changes needed |

### 4.3 Files NOT Touched in Phase 1

| File | Why deferred |
|------|-------------|
| `scripts/generate-pdf.mjs` | Phase 2 (CV generation) |
| `scripts/scan.mjs` | Phase 3 (Scout) |
| `templates/cv/*.html` | Phase 2 |
| `templates/prompts/*` | Phase 2 (externalized prompts for CV tailoring) |
| `modes/cv.md` | Phase 2 |
| `modes/scan.md` | Phase 3 |
| `modes/interview-prep.md` | Phase 4 |
| `modes/auto-pipeline.md` | Phase 5 |
| `modes/batch.md` | Phase 5 |

---

## 5. Implementation Steps + Verification

### Step 1: Create `modes/_shared.md`

**What:** Global rules, unified scoring system, dynamic archetype detection, writing guidelines.

**Source reference:** career-ops `modes/_shared.md` (239 lines). Rewrite entirely.

**Content outline:**
1. Sources of Truth — file reference table (adapted paths)
2. Unified Scoring System — dimensions, weights, categories (from Section 3 above)
3. Dynamic Archetype Detection — algorithm:
   - Read `modes/_profile.md` → extract archetype table rows
   - For each archetype: count keyword matches between JD and "Domain signals" column
   - Select highest-match archetype; if tie, prefer primary fit over secondary
   - If no archetype matches (< 2 keyword hits), flag as "Unclassified" and evaluate generically
   - If no archetypes defined, prompt user to run setup
   - **Domain Pack precedence rule** (Gemini final review): If a Domain Pack is active (detected via archetypes in `_profile.md` that originated from a pack), prioritize the pack's "What they buy" definitions over generic LLM industry knowledge. This ensures the battle-tested domain expertise in the pack isn't diluted by the LLM's broader but shallower training data.
4. Global Rules — NEVER/ALWAYS (ported from career-ops, made domain-agnostic)
5. Tool Usage — **intent-based instructions** (Gemini review): Use "Retrieve current market salary data for this role and location using available search tools" NOT "Run WebSearch for salary." This lets each CLI decide which tool to invoke. Never name specific tools in mode files.
6. Writing Style Calibration — reusable as-is from career-ops
7. Professional Writing & ATS Compatibility — reusable as-is

**What to change from career-ops:**
- Remove all 6 hardcoded AI/ML archetypes → replace with dynamic lookup algorithm
- Remove Canva MCP references
- Remove `node cv-sync-check.mjs` from ALWAYS rules (Phase 2)
- Remove LaTeX references
- Remove Spanish-specific rules (JD language detection → English only)
- Remove tracker TSV batch rules (Phase 5)
- Make tool references generic

**Verify:** Read the file. Confirm no hardcoded archetypes, no Spanish, no Claude-specific tool names, no AI/ML-specific language.

### Step 2: Create `modes/evaluate.md`

**What:** The A-G evaluation block instructions. The core mode.

**Source reference:** career-ops `modes/oferta.md` (216 lines, Spanish). Rewrite in English.

**Content outline:**

**Step 0 — Extract JD**
- If URL: fetch the page content (browser or web fetch)
- If pasted text: use directly
- If inaccessible (login wall, etc.): ask user to paste JD text

**Step 1 — Detect Archetype**
- Run dynamic archetype detection from `_shared.md`
- Display detected archetype + confidence (keyword match count)

**Block A — Role Summary**
- Table: Archetype Detected, Domain, Function, Seniority, Remote Policy, Team Size (if stated), TL;DR
- Domain-agnostic: don't assume AI/ML fields — detect from JD text

**Block B — Fit Assessment + CV Match** (ENHANCED)
- Part 1: Structured scoring table (5 dimensions + Location pass/fail)
  - For each dimension: score 0-100 with brief justification
  - Calculate weighted composite → display as X/100 → Y/5
  - Assign fit category
- Part 2: Requirement-by-requirement gap analysis
  - Map each JD requirement to specific CV lines (cite exact text from cv.md)
  - For each gap: classify as hard blocker vs. nice-to-have
  - For each gap: suggest mitigation (adjacent experience, portfolio project, cover letter)
  - Use archetype's "What they buy" column to prioritize which matches to highlight

**Block C — Level & Strategy**
- Detected seniority level vs. candidate's target level
- If aligned: positioning advice (what to emphasize)
- If under-leveled (1 level): strategy to demonstrate readiness (portfolio, metrics, scope of work)
- If under-leveled (2+ levels): auto-assign TOO_JUNIOR category. Still provide strategy, but flag clearly
- If over-leveled (1 level): positioning to frame as lateral growth
- If over-leveled (2+ levels): auto-assign OVERQUALIFIED category. Provide downlevel negotiation strategy (career-ops pattern) if user wants to pursue

**Block D — Comp & Demand**
- Web search for salary data (Glassdoor, Levels.fyi, Blind, Payscale)
- Table: estimated range, company comp reputation, market demand
- Compare against candidate's comp targets from profile.yml
- **Market key as behavioral switch** (Gemini final review): When `profile.yml → location.market` is set, adapt comp analysis to regional norms:
  - `DACH`: check for 13th-month salary, 3-month notice periods, works council implications
  - `US-West`: focus on base+equity splits, at-will employment, RSU vesting schedules
  - `US-East`: note finance/pharma bonus structures, non-compete enforceability
  - `UK`: check pension matching, notice periods, IR35 for contracts
  - `Japan`: note seniority-based comp, limited negotiation culture, bonus weight
  - If market not set: use generic comp analysis, note that setting `market` improves accuracy
- If no data found: say so explicitly — never invent numbers

**Block E — Personalization Plan**
- Table: Section | Current State | Proposed Change | Why
- Top 5 CV changes for this specific role
- If score >= 80: also suggest cover letter angles

**Block F — Interview Prep**
- 4-8 STAR+R stories mapped to JD requirements
- Use archetype's "Proof point sources" to select which experiences to format as stories
- Append new stories to `interview-prep/story-bank.md`
- 1 case study / portfolio project recommendation
- 2-3 red-flag questions + prepared responses

**Block G — Posting Legitimacy**
- Three tiers: High Confidence | Proceed with Caution | Suspicious
- 5 signal categories (ported from career-ops — these are domain-agnostic):
  1. Posting Freshness (date posted, apply button state)
  2. Description Quality (specificity, realism, contradictions, boilerplate ratio)
  3. Company Hiring Signals (web search for layoffs, freezes)
  4. Reposting Detection — **use `scripts/check-history.mjs` script** (Gemini review #2). Do NOT pass raw TSV data to the LLM. Instead:
     - Run: `node scripts/check-history.mjs <url-or-company-slug>`
     - Script reads `data/scan-history.tsv`, parses it, and returns structured JSON:
       ```json
       {
         "appearances": N,
         "first_seen": "date",
         "last_seen": "date",
         "is_repost": true,       // same company+title, different URLs
         "is_evergreen": false,    // exact same URL across 3+ months
         "verdict": "..."
       }
       ```
     - **Repost vs Evergreen distinction** (Gemini final review): Same URL across 3+ months = evergreen role (company always hiring, possibly a pipeline role). Same company+title but different URLs = repost (re-listed, possibly ghost or failed previous search). The LLM needs to know the difference because the recommended action differs — evergreen roles are often legitimate but low-priority; reposts are a stronger ghost-job signal.
     - If appearances >= 3 over 2+ months → auto-trigger "Proceed with Caution" tier (likely evergreen or ghost posting)
     - On fresh installations with empty scan-history or if the script returns 0 appearances, this signal is skipped (noted in report as "no history available")
     - **Why script instead of raw TSV:** TSV files can grow to thousands of rows. Passing raw TSV to an LLM wastes tokens, risks parsing errors, and asks the LLM to do what a 20-line Node script does perfectly. The script returns only the relevant signal.
     - **Note:** `check-history.mjs` is created during Phase 1 implementation (add to files list in Section 4.1)
  5. Role Market Context (typical fill times for this type of role)
- Edge cases: government/academic (long timelines normal), evergreen (ongoing), niche/executive

**Post-Evaluation:**
1. Save report to `reports/{###}-{company-slug}-{YYYY-MM-DD}.md`
2. Append row to `data/applications.md`
3. Present summary: Score, Fit Category, Legitimacy Tier, Top 3 strengths, Top 3 gaps

**What to change from career-ops oferta.md:**
- Translate all Spanish → English
- Replace hardcoded archetype framing in Blocks A, B, F with dynamic lookup
- Add structured scoring table in Block B (new — career-ops doesn't have this)
- Remove career-ops-specific file references (article-digest.md — keep but make optional)
- Remove `batch/tracker-additions/` TSV writing (Phase 5)
- Add fit category assignment logic
- Make all tool references generic

**Verify:**
1. Read the file. Confirm no Spanish, no hardcoded archetypes, no Claude-specific tools.
2. Test: paste a real job posting URL into Gemini CLI → should produce A-G evaluation with scoring table.
3. Check: report file created in `reports/`, row added to `data/applications.md`.
4. Check: if `_profile.md` has no archetypes, mode should gracefully handle with generic evaluation.

### Step 3: Create `modes/pipeline-triage.md`

**What:** Pipeline inbox processing — read pending URLs from `data/pipeline.md`, evaluate each.

**Source reference:** career-ops `modes/pipeline.md` (57 lines, Spanish). Rewrite in English.

**Content outline:**
1. Read `data/pipeline.md` → find rows in Pending table
2. For each pending URL:
   - Fetch JD (browser → web fetch → web search fallback)
   - Run evaluate mode (blocks A-G)
   - Move row from Pending to Evaluated with score, fit category, report link
3. If URL inaccessible: mark with error note, leave in Pending
4. Show summary when done

**Simplifications vs. career-ops:**
- No parallel agent spawning (Phase 5)
- No batch TSV writing (Phase 5)
- No `cv-sync-check.mjs` dependency
- Sequential processing only

**Verify:** Add 2-3 test URLs to `data/pipeline.md` Pending section. Run triage mode. Confirm rows move to Evaluated, reports created.

### Step 4: Create `modes/setup.md`

**What:** Guided onboarding — populate profile.yml and _profile.md from user's CV.

**Source reference:** career-ops's onboarding in AGENTS.md (6 steps) + ai-job-search's setup command. Combine.

**Content outline:**
1. Check if `cv.md` has content. If not → ask user to fill it in first (or paste their CV text).
2. Read `cv.md` → extract:
   - Name, location, contact info → suggest for `config/profile.yml`
   - Skills, experience domains → suggest 3-5 archetypes for `modes/_profile.md`
   - Career trajectory → suggest exit narrative
3. **Domain Pack selection** (Gemini review #2 — prevents generalization penalty):
   - Ask: "What's your primary professional domain?" Present options including available Domain Packs
   - If user selects a domain with a Starter Kit available → pre-populate `_profile.md` archetype table with the kit's archetypes as a starting template
   - User then customizes: rename, remove, add, adjust signals and proof points
   - If no Domain Pack matches → start from scratch (extract archetypes from cv.md as before)
   - See Section 3.5 below for available Domain Packs
4. Present suggested profile.yml values. User confirms/edits.
5. Present suggested archetype table. **Use expert-intent framing** (Gemini review):
   - Don't just ask for keywords. Ask: "What are the 3-5 key signals in a JD that tell you this role was written for you?"
   - For each archetype, capture: name, expert signals (not just keywords — phrases, patterns, context clues), what they buy from you, proof point sources from cv.md
   - This captures nuance that raw keyword matching misses (e.g., "the JD mentions cross-functional stakeholders AND technical depth — that's my sweet spot")
6. Ask about behavioral profile (optional):
   - Working style preferences
   - Keywords that signal fit vs. friction
7. Ask about writing style (optional):
   - Read `writing-samples/` if any files exist → extract tone/register
   - Or user describes their style
8. **Scoring calibration via Golden Examples** (Gemini review #2 — replaces math-offset approach):
   - Generate 3 sample JD requirements from the user's cv.md, **specifically chosen to test scoring boundaries** (Gemini final review):
     - **Example 1:** A near-perfect match for their CV (tests the user's ceiling — do they give 95 or 80?)
     - **Example 2:** A domain match but with a significant tool/stack gap (tests mid-range calibration — is this a 70 or a 55?)
     - **Example 3:** A clear mismatch for their background (tests the floor — do they give 30 or 50?)
   - This prevents the "yes-man" problem where a user scores themselves too highly across the board. By forcing scores at perfect/gap/mismatch boundaries, the LLM learns where the user draws their lines.
   - For each requirement, ask the user: "How would you score your match? What's your reasoning?"
   - The user's score + reasoning become **Golden Examples** — few-shot demonstrations stored in `_profile.md` under a "Scoring Calibration" section
   - Format: `Requirement: "..." → User Score: 75 → Reasoning: "I have adjacent experience in X but haven't directly done Y"`
   - During evaluation, the LLM reads these Golden Examples as calibration anchors — they show the LLM what a 75, 85, or 60 looks like *for this specific user*
   - **Why Golden Examples instead of math offsets:** LLMs are bad at consistent arithmetic on calibration deltas ("add 12 points to compensate for conservative bias"). They're good at pattern matching from examples ("this user scored themselves 75 when they had adjacent-but-not-direct experience, so I should score similarly for comparable gaps"). Few-shot examples leverage what LLMs do best — in-context learning — instead of asking them to do what they do worst (reliable math)
9. **User-layer backup before write** (Gemini final review safety):
   - Before writing to `config/profile.yml` or `modes/_profile.md`, check if either file has existing content beyond the template
   - If yes: copy the existing file to `{filename}.bak` (e.g., `profile.yml.bak`, `_profile.md.bak`)
   - This prevents accidental data loss if the user re-runs setup and overwrites manual refinements
   - The `.bak` files are User layer — never auto-deleted
10. Write finalized values to `config/profile.yml` and `modes/_profile.md`

**Verify:** Run setup with a populated cv.md. Confirm profile.yml and _profile.md are populated with reasonable suggestions. Confirm archetypes use expert-intent phrasing. Confirm Golden Examples are collected and stored in _profile.md under "Scoring Calibration" section with requirement + score + reasoning format.

### Step 5: Create `AGENTS.md`

**What:** CLI-agnostic system instructions. The master file imported by CLAUDE.md and GEMINI.md.

**Source reference:** career-ops `AGENTS.md` (332 lines). Rewrite — keep structure, make domain-agnostic.

**Content outline:**
1. Project identity (career-scout — AI-powered job search evaluation system)
2. Data Contract summary (User vs System layers — reference docs/DATA_CONTRACT.md)
3. Main Files reference table (adapted for career-scout paths)
4. First Run Onboarding (→ run setup mode)
5. Skill Modes routing table (evaluate, pipeline, setup for Phase 1)
6. CV Source of Truth (cv.md is canonical — never invent content)
7. Ethical Use guidelines (never auto-submit, never fabricate experience)
8. CLI Tool Mapping table:
   - Generic action → Claude Code tool → Gemini CLI tool → fallback
   - e.g., "fetch URL" → WebFetch → WebFetch → ask user to paste
9. Evaluation rules (reference modes/_shared.md)

**What to remove from career-ops AGENTS.md:**
- Creator backstory ("Head of Applied AI")
- Update system (node update-system.mjs) — not needed for monorepo
- Language mode variants (German, French, Japanese)
- Community/Governance/Discord links
- Batch mode details (Phase 5)
- All AI/ML-specific examples
- LaTeX references

**Verify:** Read the file. Confirm no career-ops-specific references, no Spanish, no AI/ML assumptions.

### Step 6: Update `CLAUDE.md` and create `GEMINI.md`

**CLAUDE.md:** Already exists. Add a line importing AGENTS.md (same pattern as career-ops).

**GEMINI.md:** Create minimal wrapper.

**Verify:** Both files reference AGENTS.md correctly.

### Step 7: Update `.agents/skills/career-scout/SKILL.md`

**What:** Update mode routing for Phase 1 modes.

**Changes:**
- Update mode routing table to include: evaluate, pipeline (→ pipeline-triage.md), setup
- Add auto-detection: JD text or URL → auto-evaluate
- Add context loading rules: evaluate loads `_shared.md` + `evaluate.md`; pipeline loads `_shared.md` + `pipeline-triage.md`
- Remove modes not yet implemented (cv, scan, interview-prep, batch, auto, followup) — list as "coming in Phase 2-5"

**Verify:** Invoke skill with a URL → should route to evaluate mode. Invoke with "pipeline" → should route to triage mode.

### Step 8: Create `data/follow-ups.md`

**What:** Empty follow-up tracker.

**Content:** Header row only (Date | Company | Role | Action | Notes).

**Verify:** File exists, valid markdown table.

### Step 9: End-to-End Test

**Test 1 — Fresh setup:**
1. Start with empty profile.yml and _profile.md (template only)
2. Fill in cv.md with real content
3. Run setup mode → verify profile populated with archetypes

**Test 2 — Evaluate a real job:**
1. Paste a real job URL (e.g., from Greenhouse or LinkedIn)
2. Verify: A-G blocks produced
3. Verify: Structured scoring table with 5 dimensions + fit category
4. Verify: Report saved to `reports/001-{company}-{date}.md`
5. Verify: Row added to `data/applications.md`
6. Verify: Archetype detection used user's archetypes from _profile.md

**Test 3 — Pipeline triage:**
1. Add 2 URLs to `data/pipeline.md` Pending section
2. Run pipeline/triage mode
3. Verify: Both URLs evaluated, moved to Evaluated section
4. Verify: Reports created for both

**Test 4 — Edge cases:**
1. Paste a JD with no archetype match → verify generic evaluation (no crash)
2. Try a URL behind a login wall → verify graceful error with "paste JD text" prompt
3. Try with empty _profile.md → verify prompt to run setup first

---

## 6. Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Gemini CLI doesn't support `.agents/skills/` pattern | HIGH | Verify before writing mode files. If not supported, use Gemini's native command pattern |
| Dynamic archetype detection is too slow (reads _profile.md every eval) | LOW | File is small (<100 lines). Read once at mode start, cache in context |
| Scoring dimensions produce inconsistent results across evaluations | MEDIUM | Include calibration notes in _shared.md. User can adjust weights in profile.yml (future) |
| JD extraction fails for SPAs without Playwright | MEDIUM | Fallback chain: browser → web fetch → web search → ask user to paste. Document in mode |
| pipeline.md markdown table parsing breaks with special characters in URLs | LOW | Escape pipe characters in URLs. Document edge cases |
| Mode files too long for LLM context window | MEDIUM | Keep each mode under 300 lines. Split if needed |

---

## 7. Architect Review (20-Year SW Architect Perspective)

### What's Good

1. **Clean separation of concerns.** Scout and Evaluator are genuinely independent stages with a well-defined contract (pipeline.md). This is the right architectural boundary.

2. **Data contract (User/System layer)** is well-defined and critical. Most projects get this wrong by mixing user data with system config. The explicit layer separation will prevent data loss during updates.

3. **Domain-agnostic archetype system** is a sound design. User-defined keyword matching is simple, testable, and extensible. The fallback to generic evaluation when no archetypes match prevents hard failures.

4. **The scoring system unification** (5+1 dimensions with composite) is the right call. Both source systems had good ideas but were solving slightly different problems. The merged system captures both "can I do this job?" and "do I want this job?" which is what candidates actually need.

### What Needs Attention

1. **Mode file coupling.** `evaluate.md` references `_shared.md` rules, `_profile.md` archetypes, `cv.md` content, `profile.yml` config, and writes to `applications.md` and `reports/`. That's 6 file dependencies for one mode. If any is missing or malformed, the evaluation could produce partial or broken output.

   **Recommendation:** Step 0 of evaluate.md should be a **dependency check** — verify all required files exist and have content before starting. Fail fast with clear message ("cv.md is empty — run setup first") rather than producing a half-evaluation.

2. **Markdown table as database.** pipeline.md and applications.md as markdown tables work well for human readability and git diffability, but they're fragile for machine parsing. A row with a `|` character in the Notes column breaks the table. A URL containing `|` (rare but possible) does too.

   **Recommendation:** Add a note in _shared.md: "NEVER put pipe characters in table cells. Use commas or semicolons for lists in Notes columns." Also consider URL-encoding pipe characters if they appear.

3. **No schema validation.** career-ops operates for 740+ evaluations without schema validation because the same person maintains the data. For a multi-user tool, malformed profile.yml or _profile.md will cause silent evaluation failures.

   **Recommendation for Phase 1:** Don't build validation tooling yet — but DO write clear error messages in the setup and evaluate modes for common malformation cases (missing archetype table, empty profile.yml, missing cv.md content).

4. **LLM scoring non-determinism.** The 5-dimension scoring is done by the LLM, which means the same JD could get 78 or 83 on different runs. The fit category boundary at 80 means one run says GOOD_FIT, another says PARTIAL_MATCH.

   **Recommendation:** Accept this as inherent to LLM-based evaluation. Document it. The 1-5 display score reduces the impact (78 and 83 both round to ~4.0). The fit category is guidance, not a hard gate. Don't add complexity (voting, multi-eval averaging) to solve a problem that isn't critical.

5. **SKILL.md auto-detection heuristic.** Detecting "is this a JD?" by keyword matching ("responsibilities", "requirements", "qualifications") could false-positive on random text that happens to contain these words (e.g., a user asking about their own project requirements).

   **Recommendation:** Require URL OR explicit `evaluate` command for Phase 1. Don't auto-detect JD from pasted text yet — add that in Phase 5 (auto-pipeline mode) after the system is battle-tested.

### What I'd Push Back On

1. **"Externalized prompt templates" (from job-search-toolkit) deferred to Phase 2 is correct.** Extracting prompts into `templates/prompts/` adds indirection that only pays off when you have multiple templates sharing the same prompts. Phase 1 has one evaluation mode. Keep prompts inline in the mode file. Extract when there's actual duplication (Phase 2+).

2. **Mode file named `pipeline-triage.md` invoked as `pipeline`.** Keeps the "pipeline" prefix for discoverability while disambiguating from `data/pipeline.md`.

### Additional Observations (second-pass review)

1. **Block G Playwright dependency.** Posting Legitimacy checks "Apply button state" and "posting freshness" — these require browser access. Gemini CLI may not have Playwright. The evaluate mode must document a fallback: if browser not available, skip signal #1 (posting freshness) and note "unverified — browser not available" in the report. Don't block the entire evaluation on one signal.

2. **Report numbering.** Reports use `{###}` prefix (e.g., `001-acme-2026-05-14.md`). The evaluate mode must scan `reports/` directory for the highest existing number and increment by 1. Edge case: if `reports/` is empty, start at 001. Document this in the mode file.

3. **`article-digest.md` is referenced but not scaffolded.** The consolidation plan mentions it as a User layer file for project proof-points. The evaluate mode references it in Block F (STAR+R stories). It's not in the scaffolded project yet. **Resolution:** Make it optional — evaluate mode checks if it exists, uses it if present, skips gracefully if not. Add it to cv.md as a comment suggesting users create it for richer evaluations.

4. **Scoring table evaluation order vs. display order.** The plan says "scoring table FIRST, then gap analysis." But the LLM needs to analyze gaps to produce scores. Clarification: the LLM should analyze the JD against the CV internally first (gap analysis reasoning), THEN produce the scoring table as the first displayed section, THEN present the detailed gap analysis. The scoring table is a summary of the gap analysis, displayed first for quick scanning.

5. **Consolidation plan needs updating.** This Phase 1 plan changes several things from the parent CONSOLIDATION-PLAN.md:
   - Scoring thresholds adjusted (GOOD_FIT from 70-84 → 80-89)
   - Dimension weights adjusted (Technical from 30% → 25%, added Role Quality at 10%)
   - Added POOR_FIT category
   - Mode file renamed to `pipeline-triage.md`
   - Auto-detection deferred from Phase 1 to Phase 5
   - Level Alignment changed from hard pass/fail to soft category override (Gemini review #2)
   - Scoring calibration uses Golden Examples instead of math offsets (Gemini review #2)
   - Added `scripts/check-history.mjs` for TSV parsing (Gemini review #2)
   - Added Domain Packs / Starter Kits concept + `templates/domain-packs/` directory (Gemini review #2)
   - Added `market` key to `config/profile.yml` (Gemini review #2)
   - Golden Example boundary testing: samples at ceiling/gap/mismatch (Gemini final review)
   - check-history.mjs: `is_evergreen` vs `is_repost` distinction (Gemini final review)
   - Domain Pack precedence rule in _shared.md (Gemini final review)
   - Market key as behavioral switch with per-region instructions (Gemini final review)
   - User-layer .bak backup before setup overwrites (Gemini final review)
   
   **Action:** Plan approved by Gemini. Update CONSOLIDATION-PLAN.md now to reflect all Phase 1 deviations.

---

## 8. Dependency Graph

```
Step 1: modes/_shared.md          (no dependencies)
Step 2: modes/evaluate.md         (depends on: _shared.md)
Step 3: modes/pipeline-triage.md  (depends on: _shared.md, evaluate.md)
Step 4: modes/setup.md            (depends on: _profile.md template, profile.yml template)
Step 5: AGENTS.md                 (depends on: all mode files, file structure)
Step 6: CLAUDE.md + GEMINI.md     (depends on: AGENTS.md)
Step 7: SKILL.md update           (depends on: all mode files)
Step 8: data/follow-ups.md        (no dependencies)
Step 9: End-to-end test           (depends on: everything above)
```

Steps 1 and 8 can run in parallel.
Steps 5 and 6 can run in parallel after steps 1-4.
Step 7 depends on 5.
Step 9 is always last.

---

## 9. Gemini Review Incorporation Log

**Reviewer:** Gemini CLI (2026-05-14)

| # | Gemini Suggestion | Decision | Where Applied |
|---|-------------------|----------|---------------|
| 1 | Add calibration note: "75/100 is PARTIAL_MATCH, not passing" | **Accepted** | Section 3.1 (below dimension table) |
| 2 | Make Seniority a pass/fail gate, not just a weighted dimension | **Accepted → Revised in review #2** | Section 3.1 (originally added as pass/fail dimension #7, changed to soft category override in review #2 item #10) |
| 3 | Use expert-intent framing for archetype setup | **Accepted** | Step 4, setup.md outline (ask "what signals tell you this role was written for you?") |
| 4 | Rename to `skill-pipeline.md` / `pipeline-db.md` | **Partially rejected** | Mode renamed to `pipeline-triage.md` (accepted). Data file stays `data/pipeline.md` (rejected — full-path references are sufficient to disambiguate, renaming the data file breaks consistency with career-ops's proven format) |
| 5 | Use intent-based instructions in mode files | **Accepted** | Step 1, _shared.md outline (tool usage section) |
| 6 | Block G: 3+ scan-history appearances → auto "Proceed with Caution" | **Accepted** | Step 2, evaluate.md Block G signal #4 |
| 7 | Add scoring calibration test in setup | **Accepted → Revised in review #2** | Step 4, setup.md outline (step 8: Golden Examples replace math-offset calibration) |

**Reviewer:** Gemini CLI — second review (2026-05-14)

| # | Gemini Suggestion | Decision | Where Applied |
|---|-------------------|----------|---------------|
| 8 | **Calibration hallucination trap:** LLMs can't reliably do math on score deltas. Replace calibration thermometer with Golden Examples (few-shot) | **Accepted** | Step 4 step 8 rewritten: user provides score + reasoning for 3 sample JD requirements → stored as few-shot examples in _profile.md. LLM pattern-matches from examples instead of computing offsets |
| 9 | **TSV parsing bomb:** Don't pass raw scan-history.tsv to LLM. Use a script | **Accepted** | Step 2 Block G signal #4: added `scripts/check-history.mjs` requirement. Script parses TSV and returns structured JSON. Added to Section 4.1 file list |
| 10 | **Level Alignment brittleness:** Hard pass/fail on seniority discards viable roles | **Accepted** | Section 3.1: removed Level Alignment as pass/fail dimension #7. Seniority mismatch now auto-assigns TOO_JUNIOR/OVERQUALIFIED categories (soft gate). Composite score still calculated. Block C updated with 2+ level threshold |
| 11 | **Generalization penalty:** Deleting career-ops AI/ML archetypes wastes 740+ evals of refinement | **Accepted** | New Section 3.5 (Domain Packs / Starter Kits). AI/ML archetypes ship as selectable template during setup. Infrastructure for loading YAML packs built in Phase 1. Step 4 adds domain pack selection as step 3 |
| 12 | **Market context deletion:** Don't remove localization — abstract it | **Accepted** | Section 4.2: `config/profile.yml` gets `market` key for regional comp/labor law context. Block D and E reference it for salary contextualization and CV convention adaptation |

**Reviewer:** Gemini CLI — final review (2026-05-14) — **Architectural approval granted**

| # | Gemini Suggestion | Decision | Where Applied |
|---|-------------------|----------|---------------|
| 13 | Golden Examples should test boundaries: perfect match, gap, mismatch — prevents "yes-man" scoring | **Accepted** | Step 4 step 8: 3 sample requirements now explicitly generated at ceiling/mid/floor boundaries |
| 14 | check-history.mjs should distinguish `is_evergreen` (same URL, 3+ months) from `is_repost` (same company+title, different URLs) | **Accepted** | Step 2 Block G signal #4: script JSON output expanded with `is_evergreen` boolean + distinction rationale |
| 15 | Domain Pack precedence: _shared.md should prioritize pack's "What they buy" over generic LLM knowledge | **Accepted** | Step 1 _shared.md outline item #3: added Domain Pack precedence rule |
| 16 | Market key should be a behavioral switch with per-market instructions (DACH: 13th-month salary, US-West: equity splits, etc.) | **Accepted** | Step 2 Block D: added market-specific comp analysis examples for 5 regions |
| 17 | Setup mode should .bak User-layer files before overwriting (safety net for re-runs) | **Accepted** | Step 4 step 9: backup existing profile.yml and _profile.md to .bak before writing |

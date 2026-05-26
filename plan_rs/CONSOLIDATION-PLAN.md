# Consolidation Plan: career-scout

**Version:** 1.31
**Last Updated:** 2026-05-26 -- Phase 2b implemented: fonts downloaded, academic-research.html + technical-engineering.html built (T4A/T4B sub-layouts via CSS body class), manifest.yml updated, generate-pdf.mjs --max-pages flag added, modes/cv.md updated with all new placeholders + archetype-aware template selector, profile.yml updated, fonts/user/ created, port-manifest.yml updated.
**Project name:** career-scout
**Source projects:** LangHire, ai-job-search, career-ops, job-search-toolkit

---

## 1. Vision

A **CLI-agnostic, two-stage job search system** that separates **job discovery** (Scout) from **strategic evaluation and CV generation** (Evaluator). Human-in-the-loop — AI evaluates, drafts, and coaches; you review and submit.

Built as agent skills that work with **Gemini CLI** (primary) and any other agent CLI (Claude Code, Copilot, OpenCode, etc.).

**Audience:** Multi-user, multi-domain. Engineers (EE, CS, systems), scientists (biotech, research), PMs, and other technical professionals. The archetype/framing system is user-configurable, not hardcoded to any single field.

**Philosophy:** Quality over quantity. Filter hard, apply thoughtfully, prepare deeply.

---

## 2. Two-Stage Architecture

```
┌─────────────────────────────────┐       ┌──────────────────────────────────────┐
│           SCOUT                 │       │           EVALUATOR                  │
│                                 │       │                                      │
│  Job discovery & aggregation    │       │  Strategic evaluation + CV + prep    │
│                                 │       │                                      │
│  Sources:                       │       │  Modes:                              │
│  • Portal APIs (GH/Ashby/Lever) │       │  • evaluate  (A-G blocks)            │
│  • Playwright scraping          │       │  • cv        (multi-template PDF)    │
│  • WebSearch queries            │       │  • interview (STAR+R + research)     │
│  • Manual URL paste             │       │  • pipeline  (triage & track)        │
│  • BrightData LinkedIn (opt.)   │       │  • batch     (parallel eval)         │
│                                 │       │  • setup     (profile calibration)   │
│  Output: pipeline.md            │       │  • auto      (URL → eval+CV+track)  │
│  Dedup:  scan-history.tsv       │       │                                      │
└────────────┬────────────────────┘       └──────────────┬───────────────────────┘
             │                                           │
             │         ┌─────────────────────┐           │
             └────────►│   pipeline.md       │◄──────────┘
                       │   (common contract) │
                       └─────────────────────┘
```

### Why separate them?

- **Different cadences.** Scout runs daily/weekly on schedule; Evaluator runs on-demand per job.
- **Different tools.** Scout needs HTTP clients and Playwright; Evaluator needs LLM + PDF generation.
- **Composable.** Any Scout source feeds the same pipeline. You can add a new job board without touching evaluation logic.
- **Testable.** Each stage can be validated independently.

---

## 3. What to Reuse from Each Project

### From career-ops (Foundation — ~70% of the new system)

| Component | What to take | Why |
|-----------|-------------|-----|
| **Skill/mode architecture** | `AGENTS.md` + `SKILL.md` routing pattern | Proven CLI-agnostic design, works with Gemini CLI |
| **A-G evaluation blocks** | Full framework from `modes/oferta.md` | Best strategic evaluation of all 4 projects |
| **Ghost job detection (Block G)** | Posting legitimacy tier system | Unique — no other project has this |
| **Portal scanner** | `scan.mjs` + Greenhouse/Ashby/Lever/BambooHR APIs | Zero-token job discovery, 45+ pre-configured companies |
| **ATS PDF generation** | `generate-pdf.mjs` + `cv-template.html` + Playwright pipeline | Production-tested, Unicode normalization, ATS-safe |
| **STAR+R story bank** | `interview-prep/story-bank.md` + accumulation pattern | Builds reusable interview prep over time |
| **User/System layer split** | `DATA_CONTRACT.md` separation | Protects user data during system updates |
| **Archetype detection** | Adaptive framing per role type (Platform/Agentic/PM/SA/FDE/Transformation) | Smart proof-point selection |
| **Writing style calibration** | One-time extraction from samples, cached in `_profile.md` | Consistent voice across applications |
| **Data formats** | `applications.md`, `pipeline.md`, `scan-history.tsv`, `portals.yml`, `profile.yml` | Proven at 740+ entries |
| **Canonical states** | `templates/states.yml` with aliases | Clean status tracking |
| **Batch processing** | Parallel evaluation with headless workers | Scale when needed |

### From ai-job-search (Improve CV quality — ~15%)

| Component | What to take | Why |
|-----------|-------------|-----|
| **Drafter-reviewer workflow** | Step 3-4 pattern: fresh-context reviewer agent critiques drafts | Prevents single-pass blindness; genuine quality improvement |
| **Relevance-weighted CV cutting** | Score each line by (posting relevance + uniqueness + narrative load), cut lowest first | Smarter than static section priorities |
| **Deep candidate profiling** | Behavioral profile (02) + writing style guide (03) concepts | Career-ops has `_profile.md` but lacks behavioral framework |
| **Mandatory PDF verification** | Compile → inspect → fix → recompile loop | Career-ops mentions this but ai-job-search formalizes it better |
| **Token-efficient patterns** | Never re-read files already in context; keep drafts in working memory | Reduces cost, speeds up workflow |
| **5-dimension fit scoring** | Technical (30%), Experience (25%), Behavioral (15%), Career (30%) + Location (pass/fail) | Merge into career-ops Block B as structured scoring. **Weights adjusted in Phase 1:** Tech 25%, Exp 25%, Career 25%, Behavioral 15%, Role Quality 10% |
| **Fabrication gates** | "Interview backtrack test" — could you explain this bullet without backtracking? | Strong anti-hallucination heuristic |

### From job-search-toolkit (Improve engineering — ~10%)

| Component | What to take | Why |
|-----------|-------------|-----|
| **Externalized prompt templates** | Jinja2/markdown prompt files instead of inline instructions | Enables multi-template support and easier iteration |
| **Structured fit categories** | `TOO_JUNIOR`, `OVERQUALIFIED`, `HARD_MISMATCH`, `PARTIAL_MATCH`, `GOOD_FIT`, `PERFECT_MATCH` | More nuanced than 1-5 score alone; combine WITH score |
| **4-phase coaching structure** | Extract requirements → Analyze gaps → Tailor sections → Verify | Useful mental model even in markdown-skill context |
| **BrightData LinkedIn scraping** | Optional Scout source for broad LinkedIn search | Pay-as-you-go, ~$2/1000 jobs |
| **Checkpoint/cache pattern** | Resume interrupted batch operations from last success | Robustness for long-running scans |

### From LangHire (Future enhancements — ~5%)

| Component | What to take | Why |
|-----------|-------------|-----|
| **YAML plugin architecture** | Declarative job source definitions | Easy to add new portals without code |
| **Self-learning memory** | Per-ATS procedural knowledge with confidence decay | Future: system gets smarter over time |
| **Multi-country field formats** | 18-country address/work-auth templates | When expanding beyond one market |

---

## 4. Multi-Template CV System

Career-ops currently ships one HTML template (Space Grotesk + DM Sans → Playwright → PDF). The new system supports **up to 5 templates**, selectable per application.

### Template 1: Classic Professional ⭐ DEFAULT

- **Stack:** HTML → Playwright → PDF
- **Design:** Conservative serif (Source Serif Pro / Georgia), deep-navy (`#1e3a5f`) accent on h1, section titles, dividers, job-company, and edu-title. Body text stays dark for ATS safety.
- **Best for:** Default template — works for finance, consulting, enterprise, government, and most general applications
- **Differentiation:** Understated, no gradient, more whitespace, navy accent gives polish without sacrificing ATS parsing
- **Accent override:** `--accent` and `--accent-muted` CSS variables — swap to burgundy/forest green per use case

### Template 2: ATS-Optimized (from career-ops)

- **Source:** `cv-template.html` from career-ops
- **Stack:** HTML → Playwright → PDF
- **Design:** Single column, Space Grotesk headings, DM Sans body, teal/purple gradient header
- **Best for:** Applications with heavy automated screening or stated ATS-only requirements
- **Placeholders:** `{{NAME}}`, `{{SUMMARY_TEXT}}`, `{{COMPETENCIES}}`, `{{EXPERIENCE}}`, etc.

### Template 3: Academic/Research (inspired by ai-job-search)

- **Stack:** HTML → Playwright → PDF (not LaTeX — avoids lualatex dependency)
- **Design:** Publications-forward layout, research sections prominent, education near top
- **Best for:** Research, academic, R&D, lab positions
- **Differentiation:** Publications section with DOI links, thesis topics, conference presentations

### Template 4: Technical/Engineering (new)

- **Stack:** HTML → Playwright → PDF
- **Design:** Monospace accents (e.g., JetBrains Mono for skill tags), project-forward layout, competency grid prominent
- **Best for:** IC engineering roles (software, ML, hardware, systems)
- **Differentiation:** Skills grid, project cards with metrics, GitHub/portfolio links styled

### Template Selection

```yaml
# In profile.yml
cv:
  default_template: "ats-optimized"   # default for all evals
  template_overrides:                  # per-archetype override
    academic: "academic-research"
    platform: "technical-engineering"
```

Or override per-evaluation: `evaluate <url> --template=classic-professional`

### Implementation

All templates share:
- Same placeholder system (`{{NAME}}`, `{{EXPERIENCE}}`, etc.)
- Same `generate-pdf.mjs` pipeline (Unicode normalization, font embedding, margin control)
- Same keyword injection and relevance-weighted cutting logic
- Templates stored in `templates/cv/` as separate `.html` files
- Template metadata in `templates/cv/manifest.yml` (name, description, best-for, fonts needed)

---

## 5. Enhanced Evaluation: A-G Blocks + Structured Scoring

Keep career-ops A-G block structure, but enhance Block B with structured scoring from ai-job-search and fit categories from job-search-toolkit.

### Block A — Role Summary (unchanged from career-ops)
Table: Archetype, Domain, Function, Seniority, Remote, Team Size, TL;DR

### Block B — CV Match + Structured Fit Score (enhanced)

**New addition:** Before the gap analysis, produce a structured score:

```markdown
### Fit Assessment

| Dimension | Score | Weight | Notes |
|-----------|-------|--------|-------|
| Technical Skills | 78/100 | 25% | Strong Python/ML, gap: Kubernetes |
| Experience & Level | 85/100 | 25% | Direct domain experience, right seniority |
| Career Alignment | 90/100 | 25% | Strong growth trajectory |
| Behavioral & Culture | 70/100 | 15% | Collaborative culture matches, pace concern |
| Role Quality | 75/100 | 10% | Good comp, solid company, decent stack |
| Location | PASS | — | Remote OK |

**Weighted Score:** 81/100 → **4.1/5**
**Fit Category:** GOOD_FIT
```

**Dimensions** (5 weighted + 1 gate, unified from career-ops + ai-job-search — see Phase 1 plan Section 3.1 for full scoring guide):
- Technical Skills (25%), Experience & Level (25%), Career Alignment (25%), Behavioral & Culture (15%), Role Quality (10%)
- Location: Pass/Fail gate — if FAIL, composite not calculated
- Level Alignment: **soft gate** — 2+ level gap auto-assigns TOO_JUNIOR/OVERQUALIFIED category, but composite is still calculated

**Fit categories** (from job-search-toolkit, calibrated to career-ops's selectivity):
- `PERFECT_MATCH` (90-100) — Apply immediately, full CV tailoring + cover letter
- `GOOD_FIT` (80-89) — Apply, address gaps in materials
- `PARTIAL_MATCH` (65-79) — Consider carefully, discuss with user
- `HARD_MISMATCH` (40-64) — Probably skip unless strategic
- `POOR_FIT` (0-39) — Skip
- `TOO_JUNIOR` / `OVERQUALIFIED` — Soft override: score calculated, category overridden. Strategy: skip OR negotiate level / lateral pivot

**Scoring calibration:** Uses Golden Examples (few-shot) stored in `_profile.md`, not math offsets. See Phase 1 plan Section 3 for full details.

Then continues with career-ops gap analysis (requirements → CV lines mapping, mitigation plans).

### Block C — Level & Strategy (updated)
Soft seniority gate: 2+ level gap auto-assigns TOO_JUNIOR/OVERQUALIFIED but still provides strategy (negotiate level / lateral pivot). No hard pass/fail.

### Block D — Comp & Demand (updated)
Market-aware: uses `profile.yml → location.market` key to adapt comp analysis to regional norms (DACH: 13th-month salary; US-West: equity splits; etc.).

### Block E — Personalization Plan (unchanged)

### Block F — Interview Prep + STAR+R (unchanged)
Story bank accumulation continues as-is.

### Block G — Posting Legitimacy (updated)
Three-tier ghost job detection remains a unique differentiator. Reposting detection uses `scripts/check-history.mjs` (deterministic TSV parser) instead of passing raw scan-history.tsv to the LLM. Script distinguishes `is_evergreen` (same URL, 3+ months) from `is_repost` (same company+title, different URLs).

---

## 6. Drafter-Reviewer Workflow for CV Generation

Adapt ai-job-search's two-agent pattern into career-ops's mode system.

### When it activates

The `cv` mode (or the CV generation step within `auto` mode) uses the drafter-reviewer pattern **when the evaluation score is >= 4.0/5** (high-value applications deserve the extra quality pass).

For scores < 4.0 (exploratory applications), single-pass CV generation is sufficient.

### Flow

```
Step 1: DRAFTER generates tailored CV
        ├─ Reads: profile.yml, cv.md, _profile.md, article-digest.md
        ├─ Applies: archetype framing, keyword injection, relevance-weighted cutting
        ├─ Renders: selected HTML template with {{PLACEHOLDERS}}
        └─ Keeps draft in working memory (token-efficient, no disk write yet)

Step 2: REVIEWER critiques (fresh-context agent)
        ├─ Receives: draft HTML inline in prompt + JD text + profile.yml
        ├─ Performs: company research (WebSearch), keyword gap analysis
        ├─ Validates: behavioral profile alignment, no fabrications
        ├─ Returns:
        │   Part A: JSON array of specific edits [{old_string, new_string, reason}]
        │   Part B: Narrative suggestions (missed keywords, angles, tone)
        └─ Does NOT have access to templates or mode instructions (independence)

Step 3: DRAFTER revises
        ├─ Applies Part A edits directly
        ├─ Applies Part B suggestions with judgment
        ├─ Verifies company-specific claims via WebSearch before including
        └─ Applies "interview backtrack test" — could candidate explain every bullet?

Step 4: Generate PDF + Verify
        ├─ node generate-pdf.mjs <input.html> <output.pdf>
        ├─ Read PDF to verify layout (page count, no orphans, fonts render)
        ├─ If broken: fix HTML → regenerate → re-verify
        └─ Clean up temp files
```

### Fabrication safeguards (from ai-job-search)

- **Interview backtrack test:** Every bullet must be something the candidate can comfortably explain in an interview without saying "well, what I actually meant was..."
- **Reformulation, not invention:** OK to reorder, emphasize, use domain synonyms. NOT OK to claim experience you don't have.
- **Verify before including:** Company-specific claims (partnerships, products, tech stack) must be WebSearch-verified before inclusion.

---

## 7. Common Data Contract: `pipeline.md`

The **single file** that Scout writes to and Evaluator reads from.

### Format

```markdown
# Pipeline

## Pending
| URL | Company | Role | Source | Found | Notes |
|-----|---------|------|--------|-------|-------|
| https://boards.greenhouse.io/anthropic/jobs/123 | Anthropic | Senior AI Eng | greenhouse-api | 2026-05-14 | |
| https://jobs.lever.co/openai/456 | OpenAI | ML Platform | lever-api | 2026-05-14 | |
| https://linkedin.com/jobs/view/789 | Stripe | Staff Eng | brightdata | 2026-05-13 | |

## Evaluated
| # | URL | Company | Role | Score | Fit | Status | Report | PDF | Notes |
|---|-----|---------|------|-------|-----|--------|--------|----|-------|
| 1 | https://... | Acme | AI PM | 4.2/5 | GOOD_FIT | Applied | [1](reports/001-acme-2026-05-10.md) | Yes | Strong match |
```

### Rules

- Scout **only appends** to the Pending section
- Evaluator **moves rows** from Pending to Evaluated after processing
- Deduplication: Scout checks URL against both sections + `scan-history.tsv`
- Manual additions: User can paste URLs directly into Pending section

---

## 8. Candidate Profile (Enhanced)

Merge career-ops `profile.yml` + `_profile.md` with ai-job-search behavioral profiling concepts.

### config/profile.yml (structured data)

```yaml
candidate:
  full_name: "Your Name"
  email: "you@example.com"
  phone: "+1-555-0123"           # optional
  location: "City, State"
  linkedin: "linkedin.com/in/you"
  portfolio_url: "https://you.dev"
  github: "github.com/you"

target_roles:
  primary: ["Senior AI Engineer", "Staff ML Engineer"]
  archetypes:
    - name: "AI/ML Engineer"
      level: "Senior/Staff"
      fit: "primary"
    - name: "Technical PM"
      level: "Senior"
      fit: "secondary"

narrative:
  headline: "Your one-liner"
  exit_story: "Why you're looking, what makes you unique"
  superpowers: ["Ability 1", "Ability 2"]
  proof_points:
    - name: "Project X"
      url: "https://..."
      hero_metric: "Shipped to 10K users in 3 months"

compensation:
  target_range: "$150K-200K"
  currency: "USD"
  minimum: "$120K"

location:
  country: "United States"
  city: "San Francisco"
  timezone: "PST"
  visa_status: "No sponsorship needed"
  onsite_availability: "1 week/month"
  market: "US-West"                  # Regional context for comp/labor law (DACH, US-West, UK, Japan, etc.)

cv:
  default_template: "ats-optimized"
  template_overrides:
    academic: "academic-research"
    platform: "technical-engineering"
```

### modes/_profile.md (narrative + behavioral + style)

Enhanced with behavioral profiling concepts from ai-job-search:

```markdown
## Your Target Roles
| Archetype | Thematic axes | What they buy |
|-----------|---------------|---------------|

## Your Adaptive Framing
| If role is... | Emphasize about you... | Proof point sources |
|---------------|------------------------|---------------------|

## Your Exit Narrative
(Why you're looking, bridge story)

## Your Behavioral Profile
(Inspired by ai-job-search's 02-behavioral-profile.md)
### Core Drives
| Drive | Level | What this means for applications |
|-------|-------|----------------------------------|
### Keywords that signal strong fit
### Keywords that signal friction
### How to present in cover letters vs. interviews

## Your Writing Style
(Calibrated from writing-samples/, cached here)
### Tone & Register
### Critical Rules
- NO em-dashes
- NO cliches ("passionate about", "leverage", "synergies")
- NO unverified company claims
- Every claim needs a concrete backing
### Forward-Looking Framing
(Focus on what you'll solve for employer, not CV repetition)

## Your Comp Targets
## Your Negotiation Scripts
## Your Location Policy
```

---

## 9. Directory Structure

```
project-root/
├── AGENTS.md                           # CLI-agnostic system instructions
├── CLAUDE.md                           # Claude Code wrapper (imports AGENTS.md)
├── GEMINI.md                           # Gemini CLI wrapper (imports AGENTS.md)
│
├── modes/                              # Agent skill modes
│   ├── _shared.md                      # Global rules, scoring system, archetype detection
│   ├── _profile.md                     # User's narrative + behavioral + style (USER layer)
│   ├── evaluate.md                     # A-G evaluation blocks
│   ├── cv.md                           # CV generation (multi-template + drafter-reviewer)
│   ├── scan.md                         # Scout instructions
│   ├── interview-prep.md               # STAR+R + company research
│   ├── pipeline-triage.md              # Pipeline triage & management (renamed to avoid collision with data/pipeline.md)
│   ├── auto-pipeline.md                # Hands-off orchestrator: eval → CV → track (Phase 5) ✅
│   ├── batch.md                        # Parallel subagent orchestrator (Phase 5) ✅
│   ├── setup.md                        # Profile creation & calibration
│   └── followup.md                     # Post-application follow-up
│
├── config/
│   ├── profile.yml                     # Candidate identity & targets (USER layer)
│   └── portals.yml                     # Tracked companies + title/location filters
│
├── templates/
│   ├── cv/
│   │   ├── manifest.yml                # Template registry (name, description, best-for)
│   │   ├── ats-optimized.html          # Template 1 (from career-ops)
│   │   ├── classic-professional.html   # Template 2 (new)
│   │   ├── academic-research.html      # Template 3 (inspired by ai-job-search)
│   │   └── technical-engineering.html  # Template 4 (new)
│   ├── states.yml                      # Canonical status definitions
│   ├── domain-packs/                   # Domain-specific archetype starter kits
│   │   └── ai-ml.yml                  # AI/ML pack (6 archetypes from career-ops)
│   └── prompts/                        # Externalized prompt templates (from job-search-toolkit)
│       ├── evaluate-system.md          # Evaluation system prompt
│       ├── cv-tailor-user.md           # CV tailoring user prompt template
│       ├── reviewer-system.md          # Reviewer agent system prompt
│       └── scoring-rubric.md           # Structured scoring criteria
│
├── data/                               # All persistent state (USER layer)
│   ├── pipeline.md                     # The common Scout ↔ Evaluator contract
│   ├── applications.md                 # Full application tracker
│   ├── scan-history.tsv                # Scout deduplication log
│   ├── follow-ups.md                   # Follow-up tracking
│   └── batch/                          # Ephemeral batch state (gitignored contents) (Phase 5) ✅
│       ├── batch-state.json            # Resume state: per-job status + report numbers
│       ├── results/                    # Per-worker JSON results
│       └── results/processed/          # Archived after merge
│
├── cv.md                               # Your master CV (USER layer)
├── article-digest.md                   # Your proof points / project deep-dives (USER layer)
├── writing-samples/                    # Your writing for style calibration (USER layer)
│
├── interview-prep/
│   ├── story-bank.md                   # Accumulated STAR+R stories (USER layer)
│   └── {company}-{role}.md             # Per-company interview prep (generated)
│
├── reports/                            # Evaluation reports (generated)
│   └── {###}-{company}-{date}.md
│
├── output/                             # Generated CVs and cover letters
│   └── cv-{candidate}-{company}-{date}.pdf
│
├── fonts/                              # Self-hosted fonts for PDF generation
│
├── scripts/
│   ├── generate-pdf.mjs                # HTML → PDF via Playwright (from career-ops)
│   ├── scan.mjs                        # Portal scanner (from career-ops)
│   ├── check-history.mjs               # TSV parser for scan-history.tsv (repost/evergreen detection)
│   ├── merge-tracker.mjs               # Merge batch results → applications.md + pipeline.md (Phase 5) ✅
│   └── verify-pipeline.mjs             # Pipeline + tracker integrity checker (Phase 5) ✅
│
├── .agents/                            # Skill registration
│   └── skills/
│       └── {skill-name}/
│           └── SKILL.md
│
└── docs/
    ├── SETUP.md                        # Getting started guide
    └── DATA_CONTRACT.md                # User vs. System layer definition
```

---

## 10. Mode Reference

| Mode | Trigger | What it does |
|------|---------|-------------|
| `evaluate` | URL or JD text | Full A-G evaluation + structured scoring |
| `cv` | After evaluation, or standalone with job context | Multi-template CV generation with drafter-reviewer |
| `scan` | On-demand or scheduled | Run Scout: portal APIs + Playwright + WebSearch |
| `interview-prep` | Company + role | STAR+R mapping + Glassdoor/Blind research + story bank |
| `pipeline` | On-demand | Triage pending jobs, update statuses, health check (file: `pipeline-triage.md`) |
| `auto` | URL or JD text | Full pipeline: evaluate → CV → track (one command) |
| `batch` | Multiple URLs or pipeline.md | Parallel evaluation with headless workers |
| `setup` | First run or profile update | Guided profile creation + calibration |
| `followup` | After application | Generate follow-up messages with timing guidance |

---

## 11. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Working evaluate + pipeline mode on Gemini CLI.
**Detailed plan:** `plan_rs/phase1-foundation.md` (v1.3, approved)

- [x] Set up project structure (directory layout above)
- [x] Create `modes/_shared.md` (global rules, 5+1 scoring system, dynamic archetype detection, Domain Pack precedence)
- [x] Create `modes/evaluate.md` (A-G blocks, English, domain-agnostic, soft level gate, market-aware Block D)
- [x] Create `modes/pipeline-triage.md` (renamed from pipeline.md to avoid collision with data/pipeline.md)
- [x] Create `modes/setup.md` (guided profile creation, Domain Pack selection, Golden Examples calibration, .bak safety)
- [x] Create `AGENTS.md` (CLI-agnostic system instructions)
- [x] Create `GEMINI.md` (Gemini CLI wrapper)
- [x] Update `CLAUDE.md` (add AGENTS.md import)
- [x] Update `.agents/skills/career-scout/SKILL.md` (Phase 1 mode routing)
- [x] Create `scripts/check-history.mjs` (TSV parser for Block G repost/evergreen detection — all 4 signal cases verified)
- [x] Create `templates/domain-packs/ai-ml.yml` (AI/ML archetype starter kit from career-ops, 6 archetypes)
- [x] Update `config/profile.yml` (add `market` key)
- [x] Create `data/follow-ups.md` (empty tracker)
- [x] Test: paste a job URL → get full A-G evaluation with structured score *(Gemini tested 2026-05-15 — passed)*
- [x] Test: pipeline triage + setup flow end-to-end *(Gemini tested 2026-05-15 — passed)*

**Testing docs:** `plan_rs/phase1-test-plan.md` (automated) + `plan_rs/phase1-user-testing-guide.md` (Gemini manual)

### Phase 2: CV Generation ✅ Complete (2026-05-15)

**Goal:** Multi-template CV generation with drafter-reviewer.

- [x] Port `generate-pdf.mjs` and `fonts/` from career-ops — adapted paths, 0-margin, exit code 2 for overflow
- [x] Port `cv-template.html` as Template 1 (ATS-Optimized) — CSS variables, career-scout vocab
- [x] Create Template 2 (Classic Professional) — system serif fonts, same CSS variables
- [ ] Create Template 3 (Academic/Research) — deferred to Phase 2b
- [ ] Create Template 4 (Technical/Engineering) — deferred to Phase 2b
- [x] Create `templates/cv/manifest.yml` for template registry — Templates 1-2 marked ready
- [x] Write `modes/cv.md` — full v2.2 workflow: --fast flag, Block C constraint, PII-guarded reviewer, merged Review & Confirm, max 2 Playwright runs, re-read-before-edit guard
- [x] Add drafter-reviewer workflow — text-only reviewer prompt, PII stripped, fresh-context subagent
- [x] Add relevance-weighted cutting logic — 3-layer: deterministic → relevance-weighted → CSS fallback
- [x] Add CV Generation Rules — absolute precedence in `_profile.md`, setup wizard step added
- [x] Implement template selection (default + per-archetype + per-evaluation override)
- [x] Add `--fast` flag — skips reviewer, backtrack test, PDF; dumps HTML for manual editing
- [x] Test: Generac simulation — TOO_JUNIOR promotion framing, backtrack catch ("Led high volume manufacturing" reverted), Section I appended to report, PDF generated (1 page, 68.2 KB)

**Spec:** `plan_rs/phase2-cv-generation.md` (v2.2 — 4 Gemini review rounds, 4 Claude architect fixes)

#### Phase 2 post-launch polish v2 (2026-05-24)

- [x] **CV header polish — 3 fixes** (`plan_rs/cv-header-fixes.md` v1.2, 2 Gemini review rounds):
  - [x] **A: Drop headline line.** Removed `.header-headline` div + CSS from classic-professional.html. `narrative.headline` retained in profile.yml for evaluation context. `{{HEADLINE}}` removed from modes/cv.md placeholder table and fill logic.
  - [x] **B: Visible links + Google Scholar.** `.contact-row a` CSS updated to `color: inherit; text-decoration: underline; text-decoration-color: #ccc; text-underline-offset: 2.5px; text-decoration-thickness: 1px` in both templates. `google_scholar` optional field added to profile.yml + both templates + audit-contact.mjs. Complete-tag-omission rule documented in modes/cv.md Step 1g.
  - [x] **C: 2-page padding rule (Layer 0.5).** Added underflow expansion logic in modes/cv.md Step 1i. Gate 1: hard early-career stop (< 10 raw bullets in cv.md → target 1 page). Gate 2: `target_pages` config (1 or 2, default 2). Padding caps: 7/5/4 bullets per role. `target_pages: 2` field added to profile.yml cv block.

#### Phase 2 post-launch polish (2026-05-22)

- [x] **PDF multi-page top-margin fix.** Switched margin model from `.page { padding: var(--margins) }` (which only applied padding at the top of page 1 and the bottom of the last page) to Playwright's page-level margin option. `generate-pdf.mjs` now reads the `--margins` value from the template's `:root` block and passes it to `page.pdf({ margin: ... })`, so margins repeat on every page in multi-page PDFs. Both templates updated to set `.page { padding: 0 }`.
- [x] **classic-professional becomes default.** Added `--accent` (`#1e3a5f` deep navy) + `--accent-muted` CSS variables. Accent applied to h1, section titles, section underlines, job-company, project-title, edu-title, skill-category. Body text stays `#1c1c1c` for ATS safety. `profile.yml` default_template, `modes/cv.md`, `README.md`, and `manifest.yml` updated. Manifest entry order reflects new default.

### Phase 3: Scout ✅ Complete (2026-05-18)

**Goal:** API-based job discovery + inbox drain, writing to pipeline.md.
**Spec:** `plan_rs/phase3-scout.md` (v1.0 — 5 Gemini review rounds + 1 self-review)

- [x] Port `scripts/scan.mjs` — JSON stdout, --fast, --sources, --import, lookback window, CWD-independent paths
- [x] Create `config/portals.example.yml` — 50+ companies, new fields: priority, stale_threshold_days, lookback_days
- [x] Port dedup logic — 3-source + lookback window on scan-history only
- [x] Port title/location filtering — positive/negative/boost keywords
- [x] Create `modes/scan.md` — full workflow: stale check, inbox drain, --new-chapter, contextual guidance
- [x] Create `data/inbox.txt` — smart-parsed inbox (URL-only or pipe-delimited metadata)
- [x] Create `data/archived.md` — human-readable archive for stale/dead links
- [x] Create `data/.scout-state.json` — scan state tracker
- [x] Port `scripts/liveness-core.mjs` + `scripts/check-liveness.mjs` — shipped for Phase 3b
- [x] Add Step 9 to `modes/setup.md` — guided portals.yml configuration
- [x] Update routing: AGENTS.md, GEMINI.md, SKILL.md (scan + scout aliases, Phase 3 Active)
- [x] Update DATA_CONTRACT.md, package.json (js-yaml)
- [x] Test: scan --dry-run → valid JSON *(verified 2026-05-18)*
- [x] Test: --fast + no priority companies → clear warning *(verified 2026-05-18)*

### Phase 3c: scan --discover ✅ Complete (2026-05-20)

**Goal:** Auto-discover companies from the user's CV and add to portals.yml.
**Spec:** `plan_rs/phase3-discover.md` (3 Gemini review rounds)

- [x] Add `--discover` and `--discover --focus TOPIC` to `modes/scan.md` flag routing
- [x] Add Step 0d to `modes/scan.md` — 5-phase discovery: extract signals → WebSearch → resolve ATS URLs → split table (scannable/manual) → write portals.yml with YAML comments
- [x] Market-aware queries (DACH/France/remote local-language examples)
- [x] Dedup by normalized name + URL slug (catches "Apple" vs "Apple Inc.")
- [x] ATS identification for disabled companies (Workday/Taleo/iCIMS/Workable named)
- [x] Priority suggestion for direct competitors of past employers
- [x] RECIPES block added to `scan --help` output
- [x] Setup Step 9 active invitation (offer to run --discover inline if <5 companies)
- [x] Update SKILL.md discovery menu, README.md Quick Start

### Phase 3b: Advanced Discovery (deferred)

- [ ] Level 1: Playwright scraping of careers pages (non-API portals)
- [ ] Level 3: WebSearch broad discovery using search_queries from portals.yml
- [ ] Liveness verification for Level 3 (liveness-core.mjs already shipped)
- [ ] LinkedIn integration via browser extension writing to inbox.txt
- [ ] BrightData LinkedIn API (optional)

### Phase 4: Interview Prep + Story Bank (✅ main implementation 2026-05-22)

**Goal:** Company-specific interview prep + curated Story Bank + post-interview debrief loop.
**Detailed plan:** `plan_rs/phase4-interview-prep.md` (v1.2, locked — 2 Gemini review rounds, all open questions resolved)

Core deliverables:

- [x] Port `modes/interview-prep.md` from career-ops, adapted to career-scout conventions
- [x] Add Pre-Flight Cheatsheet block (top of output, fixed cardinality 3 across all sub-blocks)
- [x] Add Compensation Calibration block (reads Block D + profile.yml comp targets)
- [x] Add citation lint sweep + referenced report header (not embedded)
- [x] Implement `interview-prep --tldr` (cheatsheet to terminal, no file write)
- [x] Implement `interview-prep --bank-review` (Jaccard ≥ 0.55 dedup, weak-Reflection flag, legacy schema upgrade)
- [x] Implement `interview-prep --debrief <company>` (post-interview close-the-loop)
- [x] Port `modes/deep.md` (standalone, called by interview-prep when intel is thin)
- [x] Update story-bank.md schema (table header per story) + legacy-schema co-existence parser
- [x] Update evaluate.md Block F to append in new schema + P6 confirmation prompt

UX Conventions (P1-P6) — project-wide standards introduced in this phase:

- [x] P1: Clickable `file:///` artifact paths
- [x] P2: "What to do next" block at end of every mode
- [x] P3: Cross-mode nudges (evaluate → cv/interview-prep)
- [x] P4: `--tldr` variant for long-output modes
- [x] P5: Compact path display for multi-file output
- [x] P6: User Layer Write Confirmation (`.bak` + default-N prompt + `--yes` escape hatch)
- [x] Document P1-P6 in `modes/_shared.md`
- [x] AGENTS.md routing updated — `deep` mode added, `(Phase 4)` marker removed
- [x] SKILL.md discovery menu updated — all interview-prep sub-commands + deep listed
- [x] DATA_CONTRACT.md updated — per-file notes for interview-prep/ files
- [x] README.md updated — Phase 4 status, new "Prepare for an Interview" Quick Start section
- [x] setup.md updated — story bank mention + P2 next steps

Retrofit sweep (✅ complete 2026-05-22):

- [x] `modes/evaluate.md` — P1 (report path), P2 (next steps), P3 (interview-prep nudge for GOOD_FIT+), Block F P6 prompt
- [x] `modes/cv.md` — P1 (PDF path), P2 (next steps: review, submit, interview-prep), P3 (GOOD_FIT+ nudge)
- [x] `modes/scan.md` — P1 (pipeline.md path), P2 (next steps), P6 (pipeline.md write confirmation)
- [x] `modes/pipeline-triage.md` — P3 (Interview-status nudge for missing prep docs), P2 (next steps)
- [ ] One-time editor-opening hint in setup.md first-run output (deferred — low value)

Phase 4b (deferred):

- [ ] Roleplay/practice mode (`interview-prep --practice`)
- [ ] Pre-interview countdown reminder
- [ ] Cross-interview pattern detection (after 3+ debriefs)
- [ ] Mock-interview transcript scoring
- [ ] Self-learning memory from LangHire

Tests (T1-T17, see plan §6e — workflow paths, schema edge cases, anti-fabrication, CLI parity):

- [ ] Cold start, mapping accuracy, citation honesty, bank curation, debrief loop, CLI parity, Block F migration
- [ ] --tldr, comp skip path, UX P1+P2, cross-mode nudge
- [ ] Subagent path with fallback (Q2), Jaccard dedup (Q4), legacy schema co-existence (Q5)
- [ ] Citation lint sweep (Q7), "Lessons from Last Time" (Q10), P6 default-N safety

### UX Bug Fixes ✅ Complete

**Bug A — P1 paths not clickable**:
- [x] `modes/_shared.md` P1: file-context PROJECT_ROOT derivation (no shell commands); fallback message if unknown
- [x] `modes/cv.md`: `{absolute-path}` → `{PROJECT_ROOT}`; P1 derivation note added
- [x] `modes/interview-prep.md`: PROJECT_ROOT derivation note added before terminal output block

**Bug B — Classic-professional header**:
- [x] `{{CURRENT_TITLE}}` → `{{HEADLINE}}` in classic-professional.html + `modes/cv.md` fill logic + placeholder table
- [x] `{{WORK_AUTH}}` added to both templates (classic-professional.html + ats-optimized.html) + `modes/cv.md` + `config/profile.yml`
- [x] CSS `::before` separator on both templates; old `.separator` span pattern removed
- [x] `config/profile.yml`: `work_authorization: ""` field added under `candidate:`

**Bug C — Core Competencies constraint (stays in original position)**:
- [x] classic-professional.html: `max-height: 64px; overflow: hidden; justify-content: space-between`
- [x] ats-optimized.html: `max-height: 88px; overflow: hidden; justify-content: space-between`
- [x] `modes/cv.md`: 12–15 items max, JD-priority order, selection rule for overflow

**Bug D — HTML viewer for user-facing report docs**:
- [x] `npm install marked` — added to dependencies
- [x] `scripts/md-to-html.mjs` — MD → HTML conversion script with title extraction, date, source path
- [x] `templates/docs/viewer.html` — styled viewer (tables, interactive checkboxes, localStorage persistence, print-friendly)
- [x] `modes/interview-prep.md` Step 8 — run script after .md write; P1 → .html + .md dual links
- [x] `modes/deep.md` Step 3 — same pattern
- Note: `docs/DATA_CONTRACT.md` .html companion note deferred (minor; not user-blocking)

### UX Improvements v2 (plan_rs/ux-improvements-v2.md — in progress)

**Improvement 1 — Script-emits-URI pattern (Bug A revisit)**:
- [x] `scripts/generate-pdf.mjs`: prints `📂 Open: file:///...` + `   Path: ...` on stdout after write
- [x] `modes/_shared.md` P1: rewrote rule — scripts emit URI, AI relays verbatim; fallback for AI-written files
- [x] `modes/evaluate.md`: md-to-html.mjs call after report write; relay `📂 Open:` line
- [x] `modes/interview-prep.md`: relay pattern (md-to-html.mjs stdout)
- [x] `modes/deep.md`: relay pattern (md-to-html.mjs stdout)
- [x] `modes/cv.md`: relay generate-pdf.mjs stdout verbatim; P3 nudge threshold → 85

**Improvement 2 — CV comparison (deterministic diff)**:
- [x] `scripts/cv-compare.mjs`: parses cv.md + tailored HTML, Jaccard bullet matching (threshold from profile.yml), emits compare-{slug}-{date}.md + runs md-to-html.mjs
- [x] `templates/docs/viewer.html`: `.warning-block` CSS (amber highlight for fabrication-candidate items)
- [x] `modes/cv.md` Step 5c: call cv-compare.mjs after audit + PDF; relay `📂 Open:` + surface any ⚠️ warnings
- [x] `config/profile.yml`: `cv.diff_threshold: 0.5` (Jaccard threshold, configurable)

**Improvement 3 — HTML for evaluation reports**:
- [x] `modes/evaluate.md`: md-to-html.mjs called after report write; HTML is the primary link
- [ ] `modes/scan.md`: pipeline.md HTML — deferred (skim use, not browsable)

**Improvement 4 — Contact info vetting (anti-fabrication)**:
- [x] `scripts/audit-contact.mjs`: deterministic contact field audit against profile.yml; exits 2 on fabrication
- [x] `modes/cv.md` Step 0d: early contact audit printout (✅/❌ per field) + pause prompt
- [x] `modes/cv.md` Step 1g: CONTACT INFO SOURCING rule table (absolute precedence)
- [x] `modes/cv.md` Step 5a: run audit-contact.mjs before PDF; halt on exit code 2
- [x] `modes/_shared.md` NEVER #9: never fabricate contact details
- [x] `config/profile.yml`: contact field comments updated (never fabricated, leave blank to omit)
- [x] `docs/DATA_CONTRACT.md`: reports/*.html + interview-prep/*.html entries added

**Improvement 5 — DOCX export (opt-in)**:
- [x] `scripts/lib/normalize-text.mjs`: shared ATS text normalization extracted from generate-pdf.mjs
- [x] `scripts/generate-pdf.mjs`: refactored to import from lib/normalize-text.mjs
- [x] `scripts/generate-docx.mjs`: programmatic DOCX builder — reads :root CSS tokens (accent, margins), parses content with node-html-parser, builds OOXML via `docx` npm package
- [x] `modes/cv.md` Step 0a: parse --docx / --docx-only flags; Step 5d: DOCX generation step + fidelity note
- [x] `package.json`: added `docx` + `node-html-parser` dependencies (npm installed)
- [x] `.agents/skills/career-scout/SKILL.md`: --docx / --docx-only documented in discovery menu
- [x] `README.md`: DOCX export section added under "Generate a CV"

**Improvement 6 — UX hints (conservative)**:
- [x] `modes/cv.md` Step 0g: check `data/.feature-hints.json` for `hints.docx_export` flag; set SHOW_DOCX_HINT
- [x] `modes/cv.md` post-generation: show first-time hint if SHOW_DOCX_HINT; write marker to `data/.feature-hints.json`
- [x] `modes/cv.md` P3 nudge: already in place (composite ≥ 85 + not --docx)
- [x] `docs/DATA_CONTRACT.md`: `.feature-hints.json` registered as system layer

### Phase 5: Auto-Pipeline + Batch ✅ Complete (2026-05-25)

**Goal:** One-command end-to-end workflow + parallel batch processing.
**Spec:** `plan_rs/phase5-auto-batch.md` (v1.4 — 3 Gemini review rounds, profile-preflight gate, scope split for Phase 2 hardening)

New modes:
- [x] `modes/auto-pipeline.md` — hands-off orchestrator: evaluate → score gate → CV (non-interactive) → pipeline move → single summary. Decision A: no mid-run checkpoints, review only the final PDF. Contact audit hard-stops on exit 2 only; Review & Confirm non-blocking (flags collected for summary). `--batch` worker mode writes `data/batch/results/{id}.json` + echoes JSON. Report number from `--report-num` (pre-assigned by orchestrator, no race).
- [x] `modes/batch.md` — parallel subagent orchestrator: profile preflight → gather URLs (inline / batch-input.tsv / pipeline.md Pending) → pre-assign report numbers → dispatch thin-prompt workers (`--parallel 3` default) → collect results (file primary, regex-extract fallback) → merge → verify → summary. Sequential fallback checkpoint (`batch.sequential_checkpoint: 3`) for no-subagent CLIs with per-job context isolation and `/clear` resume path.

New scripts:
- [x] `scripts/merge-tracker.mjs` — reads `data/batch/results/*.json`, upserts applications.md rows (company+role dedup, sequential renumber), idempotently moves pipeline.md Pending→Evaluated, archives consumed results to `results/processed/`. `.bak` written for both User layer files.
- [x] `scripts/verify-pipeline.mjs` — 7 integrity checks (5 errors: dup `#`, dead report link, malformed score, unknown fit, URL in both sections; 2 warns: non-canonical status, PDF=✅ with no output file). `--strict` promotes warns. Exit 0/1.
- [x] `scripts/_test-step3.mjs` — 20-fixture unit test runner for both scripts (M1-M6, V1-V7). All 20 pass. *(System layer; can be removed post-review.)*

Config changes:
- [x] `config/profile.yml` — added `auto: {min_cv_score: 80}` and `batch: {sequential_checkpoint: 3}` blocks with inline documentation.

Gitignore + directory:
- [x] `.gitignore` — added `data/batch/` runtime file patterns (contents ignored, directory structure tracked)
- [x] `data/batch/results/processed/.gitkeep` — directory skeleton committed

Routing + docs:
- [x] `SKILL.md` — auto/batch promoted from "Coming soon" to active; Phase 5 → Active; flags documented
- [x] `AGENTS.md` — auto routing row added; `data/batch/` entries added to files reference
- [x] `README.md` — Phase 5 → ✅ Complete; §7 (`auto`) + §8 (`batch`) Quick Start added; file structure + system layer list updated
- [x] `docs/DATA_CONTRACT.md` — `data/batch/` registered as ephemeral system layer (all 5 files documented); Rule 4 added (merge-tracker authorized write exception with `.bak`)

Key architectural decisions locked in Phase 5:
- **auto is hands-off**: no interactive gates; review only the finished PDF
- **batch uses mode-driven subagents** (not bash runner): CLI-agnostic, works on Gemini + Claude Code
- **JSON result artifacts** (not TSV): one `results/{id}.json` per worker — clean primary channel, regex-extract fallback
- **Pre-assigned report numbers**: orchestrator blocks upfront, workers never scan reports/
- **Idempotent pipeline moves**: URL-in-Evaluated → no-op in both auto and merge-tracker
- **Profile preflight in batch** (user-originated): fail fast with `setup` nudge before any dispatch

§10 deferred follow-up (separate commit, after Phase 5):
- [x] F1: `scripts/generate-pdf.mjs` Chromium launch-retry (one-shot retry on resource-lock)
- [x] F2: `modes/cv.md` Step 3a fuzzy edit-matching (locate core phrase in HTML, not literal paste)

### Phase 6: Profile Porting ✅ Complete (2026-05-25)

**Goal:** A user can clone a new version of career-scout and safely migrate all their
personal data (CV, profile, reports, story bank, pipeline, scan history, custom templates)
from their old instance — without any merge conflicts or data loss.

**Approach:** "Fresh clone + port" — user clones the new repo, then runs `port` to
import their data. Avoids all git merge complexity. Old instance is never modified.

**Design decisions locked:**
- Git users only (primary audience clones the repo)
- No .gitignore on user-layer files (users want git history on their data)
- No separate data directory — keep the single-folder model
- No VERSION file — not needed for this porting approach
- Schema migration: textual injection preserving YAML comments (not yaml.dump)
- Backups: timestamped .bak files (not simple .bak) to survive multiple port runs

**Deliverables:**
- [x] `config/port-manifest.yml` — living registry of user-layer files with strategies
- [x] `scripts/port-profile.mjs` — deterministic porting engine (375 lines)
  - Dependency check (dynamic import + clean error)
  - Case-insensitive source validation on Windows
  - New-instance baseline for unrecognized file scan (recursive, no hardcoded list)
  - Continue-on-failure with per-file try/catch (EBUSY/EPERM on Windows)
  - Timestamped .bak backups (cv.md.20260525-143000.bak)
  - Binary file support (readFileSync with encoding: null for PDF/DOCX)
  - TSV header validation before append-dedup merge
  - Comment-aware YAML injection (upward scan for preceding # blocks)
  - Granular summary (Created / Updated / Merged / Failures)
- [x] `modes/port.md` — guided AI mode (Step 0: npm check, git commit baseline, rollback)
- [x] `AGENTS.md` — port routing + onboarding branch
- [x] `GEMINI.md` — port routing + onboarding branch
- [x] `.agents/skills/career-scout/SKILL.md` — Phase 6 Active, routing, discovery menu
- [x] `docs/DATA_CONTRACT.md` — port-manifest.yml system layer entry + Rule 5
- [x] `README.md` — "Upgrading from a Previous Version" section

**Spec:** `plan_rs/phase6-port-profile.md` (v1.4 — 4 Gemini review rounds, 10/10 final)

### Phase 2b: Templates 3 & 4 (next up)

**Goal:** Build Academic/Research and Technical/Engineering templates to complete the 4-template CV system.
**Detailed plan:** `plan_rs/phase2b-cv-templates.md` (v1.3, 3 Gemini review rounds complete — ready for implementation)

- [x] Source and commit font woff2 files (EB Garamond, Source Sans Pro, JetBrains Mono, Inter) ✅ 2026-05-26
- [x] Build `templates/cv/academic-research.html` — EB Garamond, no accent, Research Interests → Education → Publications → Research/Industry Experience → Skills → Grants & Awards ✅ 2026-05-26
- [x] Build `templates/cv/technical-engineering.html` — JetBrains Mono + Inter, T4A (software, teal) + T4B (hardware, copper-bronze) via CSS body class; Problem→Decision→Result project cards; hardware skills matrix ✅ 2026-05-26
- [x] Update `templates/cv/manifest.yml` — status: ready, font_files arrays, max_pages:4 for T3, sub_layouts, conditional_placeholders ✅ 2026-05-26
- [x] Add `--max-pages` flag to `scripts/generate-pdf.mjs` — allows T3 up to 4 pages ✅ 2026-05-26
- [x] Update `modes/cv.md` — archetype-aware template selector (Step 0e), all new T3/T4 placeholders, publication reviewer scope boundary, sub-layout drafter instructions ✅ 2026-05-26
- [x] Update `config/profile.yml` — add orcid and patent_url fields ✅ 2026-05-26
- [x] Create `fonts/user/.gitkeep` ✅ 2026-05-26
- [x] Update `config/port-manifest.yml` — add fonts/user/ as portable path ✅ 2026-05-26
- [ ] Update `modes/port.md` — mention fonts/user/ in migration checklist (minor, can be done next session)
- [ ] Test: all-4-templates comparison — same JD, Template 3 up to 4 pages, ATS extraction clean on all (requires populated cv.md — run when user has real content)

### Phase 7: Future Concepts (not scheduled — captured here to avoid losing them)

**Goal:** Capture post-Phase-6 ideas with enough detail that they can be planned when the time comes.
**Status:** Concept only. No implementation timeline. Items are independent — any can be prioritised without doing the others.
**Priority order (top candidates first):** 7a → 7b → 7c → 7d → 7e → 7f → 7g → 7h → 7i
**Detailed spec:** Phase 7 items each warrant their own plan file when scheduled.

---

#### 7a: Shadow CV / Per-Archetype Master CVs ⭐ TOP PRIORITY

**What it is:** Some candidates genuinely have two different careers on one person — for example, a technical founder equally applying for CTO roles (leadership-heavy CV) and Staff Engineer roles (IC-heavy CV). A single `cv.md` forces a compromise; a shadow CV system lets them maintain separate master CVs per track.

**How it works:**
- `cv.md` remains the default master
- Additional master CVs: `cv-pm.md`, `cv-hardware.md`, `cv-academic.md` (user-named)
- Profile.yml maps archetypes to master CVs:
  ```yaml
  cv:
    master: cv.md               # default
    archetype_overrides:
      pm: cv-pm.md
      academic: cv-academic.md
  ```
- During CV generation: `cv` mode selects the master based on detected archetype before applying JD-specific tailoring
- Per-evaluation override: `cv <url> --source=cv-pm.md`

**Implementation scope:** Add `--source` flag to `modes/cv.md`. Update `config/port-manifest.yml` to port all `cv-*.md` files (glob pattern, not hardcoded list). Update the drafter to read the correct master file. Low-complexity addition.

**Why deferred:** For most users, `cv.md` + good tailoring is sufficient. The complexity of maintaining multiple master CVs is only worth it for genuinely bifurcated career tracks. Rejected in Phase 2 (Item 29 in Gemini log) — revisit when a user requests it.

---

#### 7b: Advanced Scout — Playwright Scraping + LinkedIn ⭐ TOP PRIORITY

**What it is:** Extending Scout beyond API portals to cover companies that don't offer Greenhouse/Ashby/Lever APIs. Three levels, each independently shippable:

**Level 1 — Playwright scraping of custom career pages:**
Companies like Apple, Boeing, Lockheed, many mid-size firms, and government contractors run their own careers pages (often Workday, Taleo, iCIMS, or fully custom). These can't be queried via an API but can be scraped.

Playwright navigates to `careers.example.com`, clicks "Search Jobs", applies filters (location, keyword), extracts job titles and URLs, runs them through the same dedup/filter logic as API results, and writes matching jobs to `pipeline.md`.

The challenge: these sites are rate-sensitive, login-walled (LinkedIn, most government portals), or heavily JavaScript-rendered. Playwright handles the JS rendering, but CAPTCHA and login walls require human intervention.

**Level 2 — WebSearch broad discovery:**
Use `profile.yml → target_roles.primary` to generate search queries and find jobs at companies not in `portals.yml`. Example: `"Senior ML Engineer" site:greenhouse.io OR site:lever.co`. Results are filtered by the same title/location rules, deduped, and added to pipeline.md. (Note: `scan --discover` already does company discovery — Level 2 targets job listings, not company portal URLs.)

**Level 3 — LinkedIn integration:**
A browser extension that watches the user's LinkedIn job search tab and writes matching job URLs to `data/inbox.txt` in real time. When the user runs `scan`, the inbox is drained first. No API key needed — the extension piggybacks on the user's authenticated session.

**BrightData API (optional, paid):** Programmatic LinkedIn search via BrightData's proxy network. ~$2/1000 results. For users who want full LinkedIn coverage without the browser extension. Requires a BrightData account.

**Why deferred:** Level 1 Playwright scraping requires site-specific selectors (each ATS has a different DOM structure — Workday alone has 3 variants). The `liveness-core.mjs` script shipped in Phase 3 is the foundation. Level 3 browser extension is a separate engineering project entirely.

---

#### 7c: TUI Dashboard ⭐ TOP PRIORITY

**What it is:** A terminal user interface (TUI) for managing the pipeline without opening markdown files manually. A read-only management view baked into the CLI — navigate jobs, see stats, open reports, all from the terminal.

**What it would show:**
- Pipeline.md: pending jobs as a scrollable list with company/role/score/fit/status columns
- Applications.md: submitted applications with follow-up due dates highlighted
- Summary stats: X pending, Y evaluated this week, Z applied this month, average composite score
- Quick filters: `t` for GOOD_FIT+, `r` for "awaiting response", `f` for "follow-up due"
- Navigation: arrow keys to browse, `enter` to open the HTML report for a row in the browser, `q` to quit

**Architecture concept:** A Node.js TUI using the `blessed` library (terminal box drawing) or `ink` (React-like, terminal-native). A single script `scripts/tui.mjs` — reads `data/pipeline.md` and `data/applications.md`, parses the markdown tables, renders the dashboard. Read-only — no writes from the TUI. All modifications still happen through agent modes.

**Trigger:** `npm run tui` or a `tui` slash command alias.

**Smaller precursor — pipeline.md HTML view (scan.md improvement 3, explicitly deferred):** Before a full TUI, a simpler win is running `md-to-html.mjs` on `data/pipeline.md` after each Scout run and surfacing the HTML link in the terminal. The infrastructure already exists (`md-to-html.mjs` + `viewer.html` from Phase 4). This is a one-liner addition to `modes/scan.md` Step 9 — can ship independently of the full TUI and satisfies most of the browsability need without the blessed/ink complexity.

**Why deferred:** Quality-of-life feature, not a core workflow enabler. The existing `pipeline` mode handles all the same information through natural language. A TUI adds developer complexity (blessed/ink dependencies, terminal compatibility testing across Windows/Mac/Linux) for convenience that the current system doesn't lack. High "cool factor," moderate utility gain.

---

#### 7d: Interview Practice / Roleplay Mode ⭐ TOP PRIORITY

**What it is:** An interactive session where the AI plays the role of an interviewer and the user practices answering questions. Builds on the story-bank and company research from Phase 4.

**How it works:**
1. User types `interview-prep --practice <company>` after running full interview-prep
2. The AI loads: the company research doc, the story bank, the evaluation report's Block F STAR+R stories
3. AI plays the interviewer: asks behavioural questions ("Tell me about a time you..."), technical questions drawn from the JD, and company-specific questions from the research doc
4. User answers in natural language (typed)
5. AI gives structured feedback per answer: what landed well, what lacked specificity, which story bank entry fits better, whether the answer drifted from STAR+R structure
6. After 4-5 questions, AI shows a coaching summary: patterns observed, recommended story bank additions, suggested stronger framing for weak answers

**Why this is valuable:** Reading STAR+R stories and actually rehearsing them in dialogue are different skills. The practice loop closes the gap between prepared and delivered. The AI can catch "I helped with..." when the story bank says "I led...". It surfaces stock answers that sound rehearsed vs. ones that land naturally.

**Mock transcript scoring (Phase 4b add-on):** After a practice session, the AI scores the full conversation transcript: STAR+R structure adherence per answer, specificity score (1-5), confidence signals (hedging language count, passive voice ratio), and an overall session grade. The scoring summary is appended to the company prep doc as `## Practice Session Debrief`. This turns a qualitative practice loop into measurable progress over repeated sessions.

**Why deferred:** Requires a robust multi-turn session state machine — the AI must remember previous answers within the session to catch repetition and give meaningful cumulative feedback. The current mode architecture is request-response, not multi-turn. This is a meaningful architectural addition. Likely Phase 4b.

---

#### 7e: Offer Letter Analysis ⭐ TOP PRIORITY

**What it is:** A new mode (`offer`) where the user pastes an offer letter or compensation details and gets a structured analysis and negotiation plan.

**What it produces:**
- **Total comp breakdown:** base + target bonus (target % vs. actual payout history if known) + equity (4-year value at current valuation + vesting schedule) + benefits (401k match, PTO days, health premium) = real annual comp number
- **Market comparison:** WebSearch of Levels.fyi / Glassdoor / Blind for the role, level, and location — positioned against market P25/P50/P75
- **Red flag detection:** Non-compete scope and enforceability, IP assignment breadth ("all inventions" clauses), clawback provisions, vesting cliff, garden leave, at-will employment nuances for the jurisdiction
- **Negotiation script:** 3 specific asks with exact framing, ordered by negotiation strength (highest-leverage first). Includes "BATNA anchor" — what to say if they push back
- **Accept/decline recommendation:** Compared to `profile.yml → compensation.minimum` and `compensation.target_range`

**Why this is valuable:** Candidates often accept offers without understanding total comp, without identifying negotiable elements, or without realising a clause limits future employment. The system already does comp analysis in Block D (evaluate mode) — offer analysis is Block D applied to an actual offer rather than a posted range.

**Why deferred:** Offer letter parsing is complex (PDFs, scanned documents, inconsistent formats across companies and countries). Requires real-time market data (WebSearch at time of offer). Legal clause detection needs careful calibration to avoid false confidence ("this clause is probably fine" when it isn't). Worth building carefully — needs its own design phase. Phase 8 candidate.

---

#### 7f: Protected System Files — Guardrails ⭐ HIGH PRIORITY

**What it is:** A mechanism to prevent the AI agent from accidentally modifying system-critical files during normal operation — `modes/_shared.md`, `modes/evaluate.md`, `AGENTS.md`, `templates/cv/manifest.yml`, and the scoring rubric. Currently these files are protected only by convention (the Data Contract rule). A hard technical guardrail would catch cases where an AI agent, confused about context, attempts to "update" a system file when it should only be touching user-layer files.

**Why this matters:** The scoring system, A-G block definitions, and fit category labels in `_shared.md` and `evaluate.md` are the integrity core of the whole system. If an AI agent silently rewrites them during a session (e.g., while "fixing" something it misidentified as broken), evaluations from that point forward produce inconsistent results — and the user may not notice until they've applied to 10 jobs with a corrupted scoring baseline.

**Layered approach (three levels, independently useful):**

**Layer 1 — OS read-only flags (strongest, immediate):**
After initial setup, mark critical system files as read-only at the OS level:
```
# Windows (run once after cloning):
attrib +R modes\_shared.md modes\evaluate.md AGENTS.md templates\cv\manifest.yml

# Mac/Linux:
chmod 444 modes/_shared.md modes/evaluate.md AGENTS.md templates/cv/manifest.yml
```
The AI agent gets an immediate write error if it attempts to touch these files. Cannot silently overwrite. Can be reversed with `attrib -R` / `chmod 644` when a legitimate version update is being made.

**Layer 2 — Protected file registry in AGENTS.md:**
Add a `## Protected System Files` section to `AGENTS.md` (and `CLAUDE.md`) that lists files the agent must NEVER write during a session. Any plan that modifies one of these files must explicitly call it out as a deliberate system-layer change, not a session edit. This is the documentation layer — the AI reads it and respects it by convention.

**Layer 3 — Git pre-commit hook (audit trail):**
A `scripts/check-protected.mjs` that runs as a git pre-commit hook. It does not block the commit, but prints a prominent warning if any protected file is in the staged changes:
```
⚠️  WARNING: Protected system file(s) in this commit:
   - modes/_shared.md
   - modes/evaluate.md
   These files define core evaluation logic. Verify this change is intentional.
   Proceed? [y/N]
```
This catches legitimate version-release changes (good to review) and catches accidental modifications before they enter git history.

**Implementation scope:**
- `scripts/check-protected.mjs` — ~40 lines, reads a hardcoded list of protected files, checks `git diff --cached --name-only`, prints warning + prompts
- `.git/hooks/pre-commit` — shell script that calls `node scripts/check-protected.mjs`
- `AGENTS.md` — add `## Protected System Files` section with the registry
- `CLAUDE.md` — same registry section
- `docs/DATA_CONTRACT.md` — note the OS read-only recommendation and the protected file list
- `README.md` — add a "Setup: protecting system files" step in the getting-started section

**Port-manifest note:** The `.git/hooks/pre-commit` hook is not ported (it's regenerated from `scripts/check-protected.mjs` after a fresh clone). Add a setup step to `modes/setup.md` Step 0 that installs the hook automatically.

**Why deferred from earlier phases:** The Data Contract + AGENTS.md conventions have been sufficient so far. This becomes more important as the project gains more users who may be less familiar with the file architecture. Low implementation cost, high protection value.

---

#### 7g: Self-Learning Memory

**What it is:** The system accumulates knowledge from past application cycles and applies it automatically in future sessions. Think of it as the system getting smarter the more you use it.

**Concrete examples of what it would learn:**
- "Workday application forms always ask for a salary expectation on page 3 — have your number ready before starting"
- "When you interview at companies using Greenhouse, the hiring manager typically receives your Block F story bank summary — make sure the stories are tight before applying"
- "Your last 3 rejections came from roles where Block D flagged a comp mismatch — consider adjusting your floor or filtering harder on comp"
- "The phrase 'distributed systems at scale' in a JD has correlated with GOOD_FIT for you 80% of the time — treat it as a strong positive signal"

**Architecture concept (from LangHire):** A `data/memory.json` file that stores procedural observations as key-value entries. Each entry has: `type` (ats_tip, pattern, company_note), `content` (the observation), `confidence` (0.0–1.0), `evidence_count` (how many times observed), `last_updated`. Confidence decays if contradicting evidence accumulates.

**Integration points:** The evaluate mode reads relevant memories before producing Block G and the recommendation. The cv mode reads ATS-specific memories before generating. The debrief command (interview-prep --debrief) writes new memories from the post-interview reflection.

**Why deferred:** Requires persistent state management. The current system is stateless per session (intentional — avoids stale context). Self-learning memory is a fundamental architecture shift, not an add-on. Warrants its own design phase.

---

#### 7h: Community Domain Packs

**What it is:** Beyond the AI/ML domain pack that ships with career-scout, a library of starter kits for other professional domains. Each pack is a YAML file in `templates/domain-packs/` that pre-populates `_profile.md` archetypes, suggests scoring calibration examples, and recommends CV template defaults.

**Planned packs and their archetypes:**

| Pack | Archetypes (examples) | Notes |
|------|-----------------------|-------|
| `ee-power.yml` | Power Electronics IC, Power Systems Architect, Hardware Systems Engineer, EMC/Signal Integrity | EE-specific: gate competencies (magnetics, simulation tools like LTspice/ANSYS), comp benchmarked to hardware market |
| `biotech-lifesci.yml` | Research Scientist, Bioinformatics Engineer, Medical Science Liaison, Regulatory Affairs | Publications-heavy; Academic template default; emphasis on wet lab vs computational split |
| `pm-product.yml` | Technical PM, AI/ML PM, Platform PM, Consumer PM | Outcome-framing: ARR, DAU, NPS; no patents/publications; narrative-heavy |
| `swe-backend.yml` | Backend Engineer, Distributed Systems, Platform/Infra, Security Engineer | Stack-depth signals; system design stories; open source contributions |
| `finance-quant.yml` | Quantitative Analyst, Algorithmic Trader, Risk Model Developer | Sharpe ratios, alpha generation; regulatory knowledge (FCA/SEC) as gate |

**How users access packs:** During `setup`, the system asks "Which domain best describes your work?" and offers the pack list. The selected pack's archetypes are injected into `_profile.md` as editable starting material. Users can mix packs (e.g., someone who crosses EE and ML).

**Why deferred:** Each pack needs domain expertise to calibrate correctly. An EE pack with wrong archetype signals is worse than no pack at all. This is a community-contribution model — the infrastructure exists (setup.md + domain-packs/ directory), but the packs themselves need domain-expert authors.

---

#### 7j: Phase 4 Test Suite — T1-T17 (Quality Debt)

**What it is:** 17 manual tests for the interview-prep mode documented in `plan_rs/phase4-interview-prep.md §6e` that were never executed after Phase 4 shipped. These are not unit tests — they require actually running the mode with real or seeded data and verifying the output shape, citation behaviour, and safety guards.

**Why it's debt, not deferred:** The implementation is complete. These tests validate that what was built actually matches the spec. Running them now would catch any spec-vs-reality gaps before Phase 2b and before a new user onboards.

**Test inventory (full descriptions in phase4-interview-prep.md §6e):**

| Test | What it checks | Data needed |
|------|---------------|-------------|
| T1 | Cold start — fresh bank, one story, public company | 1 story in story-bank.md, real company URL |
| T2 | Mapping accuracy — best story selected, not random | 5+ stories in bank |
| T3 | Citation honesty — obscure startup, thin web data | Any obscure company URL |
| T4 | Bank curation — `--bank-review` detects overlapping stories | 2 planted overlapping stories |
| T5 | Debrief loop — `--debrief` appends, doesn't overwrite | Existing prep doc |
| T6 | CLI parity — same output structure on Gemini + Claude Code | Both CLIs available |
| T7 | Block F migration — evaluate produces new story schema | Fresh evaluate run |
| T8 | `--tldr` prints to terminal, no file write | Any company |
| T9 | Comp skip path — block omitted when profile.yml comp fields empty | Blank comp fields |
| T10 | UX P1+P2 — `file://` path + Next Steps block present | Any run |
| T11 | Cross-mode nudge — pipeline-triage surfaces missing prep doc | `Interview` status row in applications.md with no prep file |
| T12 | Subagent path — Agent tool spawned on Claude Code; inline fallback on no-subagent CLI | Claude Code (Agent available) |
| T13 | Jaccard dedup — `--bank-review` hits ≥0.55 pairs, misses <0.55 | 4 stories with known overlap levels |
| T14 | Legacy schema co-existence — old + new stories handled by both modes | Mixed-format story-bank.md |
| T15 | Citation lint sweep — unverified question flagged, file still written | Manually planted unverified question |
| T16 | Lessons from Last Time — debrief injection appears/disappears correctly | 1 debrief file, then deleted |
| T17 | P6 default-N safety — enter with no input writes nothing | Any User Layer write prompt |

**Approach when scheduling:** Run T1, T3, T8, T10, T17 first (no synthetic data needed, highest risk coverage). Then set up seeded data for T4, T13, T14. T6 and T12 require both CLIs — can split across sessions.

**Why deferred from Phase 4:** Phase 4 shipped under momentum and the tests were left as a TODO. They remain valid and the mode hasn't changed since shipping.

---

#### 7i: Cross-Interview Pattern Detection

**What it is:** After 3 or more `--debrief` sessions, the system analyses all debriefs together to surface patterns the user can't see in individual sessions.

**What patterns it detects:**
- **Consistent weak spots:** "In 4 of your last 5 interviews, you were asked about conflict resolution and rated it as 'could have been stronger.' Your story bank has 2 conflict stories — consider preparing a 3rd with a cleaner resolution arc."
- **Winning patterns:** "Roles where you led with the IEEE award story in your intro have moved to next rounds 80% of the time. Roles where you led with the startup story have not."
- **ATS-interviewer divergence:** "Your CV scores well on system design keywords, but interviewers at 3 companies asked system design questions that your story bank doesn't cover. Consider adding a distributed systems STAR+R."
- **Company culture patterns:** "You consistently rate culture fit as 'uncertain' at companies >5000 employees. Consider filtering harder on company size."

**Integration:** A new `interview-prep --patterns` command that reads all debrief files from `interview-prep/` and applies the analysis. Output is a coaching memo appended to `interview-prep/story-bank.md`.

**Why deferred:** Requires enough historical data to be meaningful (3+ debriefs). Also requires a reliable parsing strategy across multiple debrief files. Phase 4b.

---

## 12. Key Design Decisions

**What it is:** The system accumulates knowledge from past application cycles and applies it automatically in future sessions. Think of it as the system getting smarter the more you use it.

**Concrete examples of what it would learn:**
- "Workday application forms always ask for a salary expectation on page 3 — have your number ready before starting"
- "When you interview at companies using Greenhouse, the hiring manager typically receives your Block F story bank summary — make sure the stories are tight before applying"
- "Your last 3 rejections came from roles where Block D flagged a comp mismatch — consider adjusting your floor or filtering harder on comp"
- "The phrase 'distributed systems at scale' in a JD has correlated with GOOD_FIT for you 80% of the time — treat it as a strong positive signal"

**Architecture concept (from LangHire):** A `data/memory.json` file that stores procedural observations as key-value entries. Each entry has: `type` (ats_tip, pattern, company_note), `content` (the observation), `confidence` (0.0–1.0), `evidence_count` (how many times observed), `last_updated`. Confidence decays if contradicting evidence accumulates.

**Integration points:** The evaluate mode reads relevant memories before producing Block G (posting legitimacy) and the recommendation. The cv mode reads ATS-specific memories before generating. The debrief command (interview-prep --debrief) writes new memories from the post-interview reflection.

**Why deferred:** Requires persistent state management. The current system is stateless per session (intentional — avoids stale context). Self-learning memory is a fundamental architecture shift, not an add-on. Warrants its own design phase.

---

#### 7b: Community Domain Packs

**What it is:** Beyond the AI/ML domain pack that ships with career-scout, a library of starter kits for other professional domains. Each pack is a YAML file in `templates/domain-packs/` that pre-populates `_profile.md` archetypes, suggests scoring calibration examples, and recommends CV template defaults.

**Planned packs and their archetypes:**

| Pack | Archetypes (examples) | Notes |
|------|-----------------------|-------|
| `ee-power.yml` | Power Electronics IC, Power Systems Architect, Hardware Systems Engineer, EMC/Signal Integrity | EE-specific: gate competencies (magnetics, simulation tools like LTspice/ANSYS), comp benchmarked to hardware market |
| `biotech-lifesci.yml` | Research Scientist, Bioinformatics Engineer, Medical Science Liaison, Regulatory Affairs | Publications-heavy; Academic template default; emphasis on wet lab vs computational split |
| `pm-product.yml` | Technical PM, AI/ML PM, Platform PM, Consumer PM | Outcome-framing: ARR, DAU, NPS; no patents/publications; narrative-heavy |
| `swe-backend.yml` | Backend Engineer, Distributed Systems, Platform/Infra, Security Engineer | Stack-depth signals; system design stories; open source contributions |
| `finance-quant.yml` | Quantitative Analyst, Algorithmic Trader, Risk Model Developer | Sharpe ratios, alpha generation; regulatory knowledge (FCA/SEC) as gate |

**How users access packs:** During `setup`, the system asks "Which domain best describes your work?" and offers the pack list. The selected pack's archetypes are injected into `_profile.md` as editable starting material. Users can mix packs (e.g., someone who crosses EE and ML).

**Why deferred:** Each pack needs domain expertise to calibrate correctly. An EE pack with wrong archetype signals is worse than no pack at all. Contributions should come from practitioners, not be invented. This is a community-contribution model — the infrastructure exists (setup.md + domain-packs/ directory), but the packs themselves need domain-expert authors.

---

#### 7c: TUI Dashboard

**What it is:** A terminal user interface (TUI) for managing the pipeline without opening markdown files manually. Think of it as a read-only management view baked into the CLI.

**What it would show:**
- Pipeline.md: pending jobs as a scrollable list with company/role/score/fit/status columns
- Applications.md: submitted applications with follow-up due dates highlighted
- Summary stats: X pending, Y evaluated this week, Z applied this month, average composite score
- Quick filters: `t` for GOOD_FIT+, `r` for "awaiting response", `f` for "follow-up due"
- Navigation: arrow keys to browse, `enter` to open the report for a row, `q` to quit

**Architecture concept:** A Node.js TUI using the `blessed` library (terminal box drawing) or `ink` (React-like, terminal-native). A single script `scripts/tui.mjs` that reads `data/pipeline.md` and `data/applications.md`, parses the markdown tables, and renders the dashboard. Read-only — no writes from the TUI. All modifications still happen through agent modes.

**Why deferred:** It's a quality-of-life feature, not a core workflow enabler. The existing `pipeline` mode handles all the same information through natural language. A TUI adds developer complexity (blessed/ink dependencies, terminal compatibility) for convenience that the current system doesn't lack. High "cool factor," moderate utility.

---

#### 7d: Advanced Scout — Playwright Scraping + LinkedIn

**What it is:** Extending Scout beyond API portals to cover companies that don't offer Greenhouse/Ashby/Lever APIs. Two levels:

**Level 1 — Playwright scraping of custom career pages:**
Companies like Apple, Boeing, Lockheed, many mid-size firms, and government contractors run their own careers pages (often Workday, Taleo, iCIMS, or fully custom). These can't be queried via an API but can be scraped.

Playwright navigates to `careers.example.com`, clicks "Search Jobs", applies filters (location, keyword), extracts job titles and URLs, runs them through the same dedup/filter logic as API results, and writes matching jobs to `pipeline.md`.

The challenge: these sites are rate-sensitive, login-walled (LinkedIn, most government portals), or heavily JavaScript-rendered. Playwright handles the JS rendering, but CAPTCHA and login walls require human intervention.

**Level 2 — WebSearch broad discovery:**
Use `profile.yml → target_roles.primary` to generate search queries and find jobs at companies not in `portals.yml`. Example: `"Senior ML Engineer" site:greenhouse.io OR site:lever.co`. Results are filtered by the same title/location rules, deduped, and added to pipeline.md.

**Level 3 — LinkedIn integration:**
A browser extension that watches the user's LinkedIn job search tab and writes matching job URLs to `data/inbox.txt` in real time. When the user runs `scan`, the inbox is drained first. No API key needed — the extension piggybacks on the user's authenticated session.

**BrightData API (optional, paid):** Programmatic LinkedIn search via BrightData's proxy network. ~$2/1000 results. For users who want full LinkedIn coverage without the browser extension. Requires a BrightData account.

**Why deferred:** Level 1 Playwright scraping requires site-specific selectors (each ATS has a different DOM structure). The `liveness-core.mjs` script shipped in Phase 3 is the foundation. Level 2 WebSearch discovery is in `scan --discover` already. Level 3 browser extension is a separate engineering project. Each level is independently shippable.

---

#### 7e: Interview Practice / Roleplay Mode

**What it is:** An interactive session where the AI plays the role of an interviewer and the user practices answering questions out loud (typed). Builds on the story-bank and company research from Phase 4.

**How it works:**
1. User types `interview-prep --practice <company>` after running full interview-prep
2. The AI loads: the company research doc, the story bank, the evaluation report's Block F STAR+R stories
3. AI plays the interviewer: asks behavioural questions ("Tell me about a time you..."), technical questions drawn from the JD, and company-specific questions from the research doc
4. User answers in natural language
5. AI gives structured feedback: what landed well, what lacked specificity, which story bank entry fits better
6. After 4-5 questions, AI shows a coaching summary: patterns observed, recommended story bank additions, suggested stronger framing for weak answers

**Why this is valuable:** Reading STAR+R stories and actually saying them out loud are different. The practice loop closes the gap between prepared and delivered. The AI can catch "I helped with..." when the story bank says "I led...".

**Why deferred:** Requires a robust session state machine (multi-turn roleplay with memory of previous answers within the session). The current mode architecture is request-response, not multi-turn roleplay. This is a meaningful architectural addition. Phase 4b.

---

#### 7f: Cross-Interview Pattern Detection

**What it is:** After 3 or more `--debrief` sessions, the system analyses all debriefs together to surface patterns the user can't see in individual sessions.

**What patterns it detects:**
- **Consistent weak spots:** "In 4 of your last 5 interviews, you were asked about conflict resolution and rated it as 'could have been stronger.' Your story bank has 2 conflict stories — consider preparing a 3rd with a cleaner resolution arc."
- **Winning patterns:** "Roles where you led with the IEEE award story in your intro have moved to next rounds 80% of the time. Roles where you led with the startup story have not."
- **ATS-interviewer divergence:** "Your CV scores well on system design keywords, but interviewers at 3 companies asked system design questions that your story bank doesn't cover. Consider adding a distributed systems STAR+R."
- **Company culture patterns:** "You consistently rate culture fit as 'uncertain' at companies >5000 employees. Consider filtering harder on company size."

**Integration:** A new `interview-prep --patterns` command that reads all debrief files from `interview-prep/` and applies the analysis. Output is a coaching memo appended to `interview-prep/story-bank.md`.

**Why deferred:** Requires enough historical data to be meaningful (3+ debriefs). Currently the user may not have that volume. Also requires a reliable parsing strategy across multiple debrief files — not trivial. Phase 4b.

---

#### 7g: Shadow CV / Per-Archetype Master CVs

**What it is:** Some candidates genuinely have two different careers on one person — for example, a technical founder who is equally applying for CTO roles (leadership-heavy CV) and Staff Engineer roles (IC-heavy CV). A single `cv.md` forces a compromise; a shadow CV system lets them maintain separate master CVs per track.

**How it works:**
- `cv.md` remains the default master
- Additional master CVs: `cv-pm.md`, `cv-hardware.md`, `cv-academic.md` (user-named)
- Profile.yml maps archetypes to master CVs:
  ```yaml
  cv:
    master: cv.md               # default
    archetype_overrides:
      pm: cv-pm.md
      academic: cv-academic.md
  ```
- During CV generation: `cv` mode selects the master based on detected archetype before applying JD-specific tailoring
- Per-evaluation override: `cv <url> --source=cv-pm.md`

**Why deferred:** For most users, `cv.md` + good tailoring is sufficient. The complexity of maintaining multiple master CVs is only worth it for genuinely bifurcated career tracks. Implementing this requires adding `--source` flag to `modes/cv.md`, updating port-manifest.yml to port all `cv-*.md` files, and updating the drafter to read the correct master. Low-complexity addition but low-priority for most users. Rejected in Phase 2 (Item 29 in Gemini log) — revisit when a user requests it.

---

#### 7h: Offer Letter Analysis

**What it is:** A new mode (`offer`) where the user pastes an offer letter or compensation details and gets:
- Market comparison: base vs. Levels.fyi / Glassdoor / Blind for the role, level, and location
- Total comp breakdown: base + bonus (target vs. actual) + equity (4-year value at current valuation) + benefits
- Red flag detection: non-compete clauses, IP assignment scope, clawback provisions, vesting cliff, at-will employment nuances
- Negotiation script: 3 specific asks with framing, ordered by negotiation strength (highest-leverage first)
- Accept/decline recommendation based on profile.yml compensation targets

**Why this is valuable:** Candidates often accept offers without understanding total comp or without identifying negotiable elements. The system already does comp analysis in Block D (evaluate mode) — offer analysis is Block D applied to an actual offer rather than a posted range.

**Why deferred:** Offer letter parsing is complex (PDFs, scanned documents, inconsistent formats). Requires real-time market data (WebSearch of Levels.fyi at time of offer). Legal clause detection needs careful calibration to avoid false confidence ("this clause is fine" when it isn't). Worth building — but needs its own careful plan. Phase 8 candidate.

---

## 12. Key Design Decisions

### Decision 1: HTML templates over LaTeX
**Rationale:** LaTeX requires lualatex/xelatex installation (heavy dependency), has brittle page-break behavior, and compiler differences across platforms (MiKTeX vs TeX Live). HTML → Playwright → PDF is consistent cross-platform, requires only Node.js + Chromium, and Playwright is already needed for Scout. All 4 templates use the same pipeline.

**Trade-off:** LaTeX produces slightly better typography (kerning, ligatures). If the user needs a LaTeX template later, it can be added as Template 5 without changing the architecture.

### Decision 2: Drafter-reviewer only for high-value applications (score >= 4.0)
**Rationale:** The reviewer step spawns a separate agent with fresh context, which costs tokens and time. For exploratory applications (score < 4.0), single-pass generation is good enough.

### Decision 3: Externalized prompt templates
**Rationale:** Career-ops embeds all instructions inline in mode markdown files. This works but makes it hard to iterate on prompts independently or support multiple templates. Extracting key prompts (scoring rubric, CV tailoring instructions, reviewer prompt) into `templates/prompts/` enables easier tuning without touching mode logic.

### Decision 4: Fit categories alongside numeric scores
**Rationale:** A score of 45/100 from a `TOO_JUNIOR` posting is very different from 45/100 from a `HARD_MISMATCH`. The category explains *why* the score is low, which changes the response (downlevel strategy vs. skip). Categories come from job-search-toolkit; numeric scoring comes from career-ops. Both are valuable together.

### Decision 5: Keep pipeline.md as markdown table (not JSON/YAML)
**Rationale:** Human-readable, git-diffable, editable by hand, proven at 740+ entries in career-ops. The user can open it in any editor, add URLs manually, or review at a glance. Scripts can parse markdown tables with simple regex.

---

## 13. What We're NOT Taking (and Why)

| Dropped | Source | Why |
|---------|--------|-----|
| Tauri desktop app | LangHire | User wants CLI + agent skills, not a desktop app |
| Auto-submission (browser form filling) | LangHire | User chose human-in-the-loop |
| Self-learning memory (SQLite) | LangHire | Future enhancement, not MVP. Core eval framework is more valuable first |
| Danish job portal CLIs | ai-job-search | Market-specific tooling, not generalizable |
| LaTeX CV generation | ai-job-search | HTML → PDF is simpler, more portable (see Decision 1). Can revisit as Template 5 |
| Notion integration | job-search-toolkit | Nice-to-have, not must-have. pipeline.md + applications.md are the source of truth |
| Pydantic/mypy strict typing | job-search-toolkit | Architecture is agent skills (markdown), not Python library |
| Python services layer | job-search-toolkit | Over-engineered for a markdown-skills system |
| Go TUI dashboard | career-ops | CLI pipeline view (`pipeline` mode) is sufficient for now |
| Canva CV integration | career-ops | Template system covers the use case more simply |

---

## 14. Gemini CLI Compatibility Notes

Career-ops is already CLI-agnostic (works with Claude Code, Gemini, Copilot, etc.). The new system inherits this design.

**Gemini CLI specifics:**
- Skill registration: `.agents/skills/{name}/SKILL.md` (same as career-ops)
- Agent spawning for reviewer: Gemini CLI supports `gemini -p` for headless workers (batch mode)
- WebSearch: Available natively in Gemini CLI
- WebFetch: Available natively
- File I/O: Standard Read/Write/Edit tools
- Playwright: Requires Node.js + `npx playwright install chromium`

**What needs adaptation:**
- `AGENTS.md` references to Claude-specific tool names (Agent, Bash, Read, etc.) need to be made generic or have Gemini equivalents documented
- Batch mode: `gemini -p` instead of `claude -p`
- Tool calling syntax may differ — keep mode instructions tool-agnostic where possible

---

## 15. Finalized Decisions

| Question | Decision | Notes |
|----------|----------|-------|
| **Project name** | `career-scout` | |
| **Cover letters** | CV-focused; cover letter generated only when the posting asks for one or user explicitly requests | Borrow ai-job-search's cover letter workflow for when it's needed |
| **Language** | English only | Keeps system simple; multi-language can be added later |
| **Portals** | Start with career-ops's 45+ companies | Users customize `portals.yml` for their own industry |
| **Salary benchmarking** | WebSearch-based (career-ops pattern) | Real-time Glassdoor/Levels.fyi/Blind lookup in Block D |
| **Target audience** | Multi-user, multi-domain | EE, CS, biotech, PM, etc. — archetypes are user-defined, not hardcoded |

---

## 16. Domain-Agnostic Archetype System

Career-ops ships 6 hardcoded AI/ML archetypes (Platform, Agentic, PM, SA, FDE, Transformation). Since career-scout serves multiple domains, archetypes must be **user-defined in `_profile.md`**.

### How it works

The user defines their own archetypes during `setup`:

```markdown
## Your Target Roles

| Archetype | Domain signals (keywords in JD) | What they buy from you | Proof point sources |
|-----------|--------------------------------|------------------------|---------------------|
| Analog IC Designer | "analog", "mixed-signal", "CMOS", "PLL", "ADC/DAC" | Tape-out experience, silicon-proven designs | cv.md section 3, article-digest.md |
| Systems Engineer | "systems engineering", "V-model", "requirements", "integration" | End-to-end system lifecycle, cross-domain | cv.md section 2 |
| Controls Engineer | "control systems", "PID", "state-space", "Simulink" | Mathematical modeling, real-time implementation | cv.md section 4, article-digest.md |
```

Or for a biotech scientist:

```markdown
| Archetype | Domain signals | What they buy | Proof point sources |
|-----------|---------------|---------------|---------------------|
| Research Scientist | "assay", "NGS", "CRISPR", "cell culture" | Publication record, lab technique breadth | cv.md, publications |
| Bioinformatics | "pipeline", "genomics", "R/Python", "sequencing" | Computational biology + wet lab understanding | cv.md, github |
| Medical Science Liaison | "KOL", "clinical", "therapeutic area" | Deep domain + communication skills | cv.md, article-digest.md |
```

### What the system does with archetypes

1. **Detection:** When evaluating a JD, the system matches keywords against the user's archetype table to identify the best-fit archetype
2. **Adaptive framing:** Block B uses the "What they buy" column to prioritize which CV lines to highlight
3. **CV tailoring:** The `cv` mode uses "Proof point sources" to select which experiences to emphasize
4. **Template selection:** `profile.yml` can map archetypes to CV templates (e.g., `academic → academic-research`)

### Domain Packs (Starter Kits)

To avoid the **generalization penalty** of stripping career-ops's battle-tested AI/ML archetypes, they ship as a selectable **Domain Pack** — a YAML file in `templates/domain-packs/` that pre-populates `_profile.md` during setup.

- **Phase 1:** AI/ML pack ships (6 archetypes ported from career-ops, adapted to English)
- **Future:** Community-contributed packs for EE, Biotech, PM, SWE, etc.
- User selects a pack during setup, customizes freely — the pack is a scaffold, not a constraint
- If no pack matches, setup extracts archetypes from cv.md

See `plan_rs/phase1-foundation.md` Section 3.5 for full details.

### Seed archetypes

During `setup`, the system reads the user's `cv.md` and suggests 3-5 archetypes based on their background. If a Domain Pack is selected, its archetypes are injected as editable starting material. The user refines from there.

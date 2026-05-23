# Consolidation Plan: career-scout

**Version:** 1.14
**Last Updated:** 2026-05-22 20:00 -- UX bugs A-D implemented: P1 file-context path resolution in _shared.md, Bug B {{HEADLINE}}/{{WORK_AUTH}} on both templates + cv.md, Bug C 3-line competencies on both templates + 12-15 JD-priority in cv.md, Bug D md-to-html.mjs + viewer.html + interview-prep/deep output HTML links.
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
│   ├── auto-pipeline.md                # URL → eval + CV + track in one command
│   ├── batch.md                        # Parallel evaluation
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
│   └── follow-ups.md                   # Follow-up tracking
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
│   └── verify-pipeline.mjs             # Data integrity checks
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

### Phase 5: Auto-Pipeline + Batch (Week 8)

**Goal:** One-command end-to-end workflow + parallel processing.

- [ ] Port `auto-pipeline.md` from career-ops
- [ ] Port `batch.md` for parallel evaluation
- [ ] Add `verify-pipeline.mjs` integrity checks
- [ ] Integration test: paste URL → evaluation + CV + tracker update + interview prep in one flow
- [ ] Test batch: feed 5 URLs → parallel evaluation with reports

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

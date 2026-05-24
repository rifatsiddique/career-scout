# career-scout

AI-powered job search system. Two stages: **Scout** (job discovery) and **Evaluator** (strategic evaluation + CV generation + interview prep).

Human-in-the-loop: AI evaluates and drafts. You review and submit.

**Primary runtime:** Gemini CLI. Also works with Claude Code, Copilot, and any CLI following the open agent skill standard.

---

## What It Does

1. **Evaluates jobs** against your CV and profile with 7 structured blocks (A–G): role summary, fit scoring, level strategy, comp data, CV personalization plan, STAR+R interview stories, and posting legitimacy check
2. **Tracks your pipeline** — a common markdown file that Scout writes to and Evaluator reads from
3. **Grows with you** — story bank accumulates across evaluations, scoring calibrates to your judgment

---

## Current Status

| Phase | Status | Capabilities |
|-------|--------|-------------|
| Phase 1: Foundation | ✅ Complete | evaluate, pipeline triage, setup |
| Phase 2: CV Generation | ✅ Complete | Multi-template PDF CVs + drafter-reviewer |
| Phase 3: Scout | ✅ Complete | Portal API scanning, inbox drain, stale cleanup, --fast priority run |
| Phase 4: Interview Prep | ✅ Complete | Company-specific prep docs, story bank mapping, Pre-Flight Cheatsheet, post-interview debrief |
| Phase 5: Auto-Pipeline | Planned | One-command end-to-end + batch |

---

## Prerequisites

- **Node.js >= 18** — for `scripts/check-history.mjs` (and Phase 2+ PDF generation)
- **Gemini CLI** — primary runtime (`gemini` command in PATH)
- *(Phase 2+)* Playwright + Chromium: `npx playwright install chromium`
- *(Phase 4+)* `marked` (MD→HTML viewer): `npm install` (already in `package.json`)

Verify:
```bash
node --version    # >= 18.0.0
gemini --version  # any version
```

---

## Quick Start

### 1. Clone / copy the project

```bash
# The project lives inside the Git-Python monorepo
cd C:/Work/Git-Python/career-scout
```

### 2. Write your CV

Open `cv.md` and paste your CV content. Standard sections: Professional Summary, Work Experience, Projects, Education, Skills.

### 3. Run setup

```bash
gemini
```

```
> setup
```

The wizard will:
- Ask for your domain (select a Domain Pack starter kit if available)
- Build your archetype table with expert-intent framing
- Capture your behavioral profile and comp targets
- Run a 3-example scoring calibration (ceiling / gap / floor)
- Write `config/profile.yml` and `modes/_profile.md`

### 4. Evaluate a job

Paste a URL:
```
> https://boards.greenhouse.io/{company}/jobs/{id}
```

Or paste JD text:
```
> evaluate
[paste full JD]
```

You get a full analysis (fit score, salary context, CV tips, interview prep), a saved report, and a row added to your application tracker automatically.

### 5. Process queued jobs

Add URLs to `data/pipeline.md` → Pending table, then:
```
> pipeline
```

### 6. Generate a tailored CV

After evaluating a job (score ≥ 65):
```
> cv
```

Or for a quick editable version before generating a PDF:
```
> cv --fast
```

To also generate a Word document (for ATS portals that require DOCX):
```
> cv --docx          (PDF + DOCX)
> cv --docx-only     (DOCX only)
```

The cv mode:
1. Reads your latest evaluation report for scoring, gap analysis, and level strategy
2. Tailors your master `cv.md` to the specific JD using Block C positioning + Block E changes
3. For GOOD_FIT+ (≥80): spawns a reviewer agent that critiques the draft independently
4. Presents a discard summary and any flagged rewording — you approve before PDF generation
5. Generates a PDF via Playwright to `output/cv-{name}-{company}-{date}.pdf`
6. DOCX export (opt-in): `--docx` or `--docx-only` — high-fidelity Word version matching PDF design (accent color, margins, layout). Requires `npm install` in project root.
7. Supports iterative changes after initial generation

### 7. Discover new jobs

Run a full scan of all configured company portals:
```
> scan
```

Or a quick daily check of your dream companies only:
```
> scan --fast
```

Scout scans Greenhouse, Ashby, and Lever APIs (zero LLM tokens), deduplicates against
your history, and appends new jobs to `data/pipeline.md`. Then run `pipeline` to evaluate.

**Inbox — drop URLs from any source:**

Add URLs to `data/inbox.txt` (one per line). Scout drains this file on every run.
Optional: add company name, title, and source (separated by |):
```
https://boards.greenhouse.io/stripe/jobs/123
https://jobs.lever.co/openai/456 | OpenAI | ML Platform | browser-ext
```

**Other scan flags:**
```
scan --sources greenhouse    # Only search Greenhouse-based companies
scan --company Anthropic     # Search just this one company
scan --import referrals.csv  # Add jobs from a spreadsheet
scan --dry-run               # See what a search would find (nothing saved)
scan --clean                 # Check for expired/dead job links right now
scan --new-chapter           # Save your old history and start a fresh search
scan --discover              # Find companies that match your background
scan --discover --focus X    # Search for companies in a specific industry
scan --help                  # Show all options with examples
```

**Not sure which companies to search?** Run `scan --discover` — the agent reads your CV,
finds competitors, peer companies, and niche players in your domain, resolves their career
portals, and adds them to your config. You approve each one before it's added.

Want to explore a different area without editing your CV? `scan --discover --focus "robotics"`
pivots the search to any domain you name.

**Expired link cleanup:** Scout automatically checks old jobs weekly and removes
dead links to your archive (`data/archived.md`). Changed your mind? Move the row
back to your job queue (`data/pipeline.md`).

---

## Prepare for an Interview

When an application moves from "applied" to "interview scheduled":

```
> interview-prep {company}
```

This generates a company-specific prep doc at `interview-prep/{company}-{role}.md` with:
- **Process overview** — rounds, format, difficulty, positive experience rate (from Glassdoor/Blind)
- **Round-by-round breakdown** — what each round tests, reported questions with citations
- **Likely questions** — technical, behavioral, role-specific, and background red flags
- **Story bank mapping** — your existing STAR+R stories matched to each likely question, gaps flagged
- **Pre-Flight Cheatsheet** — at the top of the file: the irreducible 10-minute pre-call summary
- **Technical prep checklist** — what this company actually tests (not generic advice)
- **Company signals** — values they screen for, vocabulary to use, anti-patterns to avoid
- **Compensation guidance** — ready-to-deliver recruiter script from your profile targets + Block D market data

**10 minutes before the call:**
```
> interview-prep {company} --tldr
```
Prints just the Pre-Flight Cheatsheet to your terminal. No file written.

**Curate your story bank:**
```
> interview-prep --bank-review
```
Finds duplicate stories (Jaccard similarity), flags weak Reflections, flags unquantified Results.
Interactive — you approve every change.

**Close the loop after the interview:**
```
> interview-prep --debrief {company}
```
Captures what was actually asked, which stories landed, and what to do differently. Updates story
Reflections. Lessons are injected into future cheatsheets for the same company or same-archetype roles.

**Strategic company research** (before applying or when intel is thin):
```
> deep {company}
```
Covers 6 axes: strategic direction, recent moves, engineering culture, likely challenges,
competitive landscape, and candidate angle. Separate from interview-prep — covers the
decision-to-apply moment, not the tactical prep pass.

---

## File Structure

```
career-scout/
├── cv.md                         # Your master CV (USER layer — fill this in)
├── AGENTS.md                     # CLI-agnostic system instructions
├── CLAUDE.md                     # Claude Code wrapper
├── GEMINI.md                     # Gemini CLI wrapper
│
├── modes/
│   ├── _shared.md                # Scoring system, archetype detection, global rules
│   ├── _profile.md               # YOUR archetypes, behavioral profile, writing style (USER layer)
│   ├── evaluate.md               # A-G evaluation blocks
│   ├── cv.md                     # CV generation workflow (Phase 2)
│   ├── scan.md                   # Job discovery workflow (Phase 3)
│   ├── pipeline-triage.md        # Pipeline inbox processing
│   └── setup.md                  # Guided profile creation
│
├── config/
│   ├── profile.yml               # YOUR identity, targets, comp, market (USER layer)
│   ├── portals.yml               # YOUR tracked companies + title/location filters (USER layer)
│   └── portals.example.yml       # Example with 50+ pre-configured companies
│
├── data/
│   ├── pipeline.md               # Scout ↔ Evaluator contract (Pending + Evaluated)
│   ├── applications.md           # Full application tracker
│   ├── scan-history.tsv          # Scout dedup log (append-only)
│   ├── inbox.txt                 # Drop job URLs here — Scout drains on every run
│   ├── archived.md               # Dead/stale links removed from pipeline (recoverable)
│   ├── .scout-state.json         # Scan state (last run, dry spell counter)
│   └── follow-ups.md             # Follow-up tracker
│
├── scripts/
│   ├── scan.mjs                  # Zero-token portal scanner (Greenhouse/Ashby/Lever)
│   ├── check-history.mjs         # TSV parser for Block G repost/evergreen detection
│   ├── generate-pdf.mjs          # Playwright HTML→PDF (Phase 2)
│   ├── md-to-html.mjs            # Markdown → styled HTML viewer (Phase 4)
│   ├── liveness-core.mjs         # Job posting expiry/zombie detection
│   └── check-liveness.mjs        # CLI liveness checker
│
├── templates/
│   ├── domain-packs/
│   │   └── ai-ml.yml             # AI/ML archetype starter kit (6 archetypes)
│   ├── cv/                       # CV HTML templates (Phase 2)
│   └── states.yml                # Canonical application statuses
│
├── reports/                      # Evaluation reports (generated)
├── output/                       # Generated CVs (Phase 2)
├── interview-prep/
│   └── story-bank.md             # Accumulated STAR+R stories
└── plan_rs/                      # All planning documents
```

---

## User vs System Layer

Two types of files. **Never mix them up.**

**User layer** — your personal data, never auto-updated:
`cv.md`, `config/profile.yml`, `config/portals.yml`, `modes/_profile.md`, `data/*`, `reports/*`, `output/*`, `interview-prep/story-bank.md`, `writing-samples/*`

**System layer** — instructions and tooling, safe to update:
`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `modes/_shared.md`, `modes/evaluate.md`, `modes/cv.md`, `modes/scan.md`, `modes/pipeline-triage.md`, `modes/setup.md`, `scripts/*`, `templates/*`, `config/portals.example.yml`

Full mapping: `docs/DATA_CONTRACT.md`

---

## Scoring System

5 weighted dimensions + 1 location gate:

| Dimension | Weight |
|-----------|--------|
| Technical Skills | 25% |
| Experience & Level | 25% |
| Career Alignment | 25% |
| Behavioral & Culture | 15% |
| Role Quality | 10% |
| Location | Pass/Fail (gate) |

**Match levels:**
Perfect match (90–100) · Good fit (80–89) · Partial match (65–79) · Poor fit (40–64) · Not a match (0–39)

Special cases: Too junior or Overqualified — score still shown, with a note explaining why.

**Recommended minimum score to apply: 80/100** — consistent with 740+ evaluations in the source project (career-ops).

---

## Domain Packs (Starter Kits)

During setup, you can select a domain pack that pre-populates your archetype table:

| Pack | File | Archetypes |
|------|------|------------|
| AI/ML Engineering | `templates/domain-packs/ai-ml.yml` | AI Platform/LLMOps, Agentic/Automation, Technical AI PM, ML Infrastructure, Applied ML/Data Science, AI Research Engineering |

You customize freely after injection — the pack is a scaffold. More packs planned for Phase 5+.

---

## Configuration Reference

### config/profile.yml — key fields

```yaml
candidate:
  full_name: ""
  email: ""
  location: ""

location:
  market: ""   # US-West | US-East | DACH | UK | Japan — drives Block D comp analysis

compensation:
  target_range: ""   # e.g. "$150K-200K"
  minimum: ""        # walk-away number

cv:
  default_template: "classic-professional"   # classic-professional | ats-optimized
  template_overrides: {}                      # archetype → template mapping, e.g. "Technical AI PM": "ats-optimized"
```

### modes/_profile.md — key sections

- `## Your Target Roles` — archetype table (signals, what they buy, proof points)
- `## Behavioral Profile` — fit/friction keywords, working style
- `## Writing Style` — tone, structure, vocabulary (auto-extracted from writing-samples/)
- `## Scoring Calibration` — 3 Golden Examples that calibrate LLM scoring to your judgment
- `## CV Generation Rules` — your standing instructions for CV tailoring (Phase 2+)

---

## Managing Your Profile Over Time

### Updating preferences, archetypes, or comp targets

**Small changes** — tell Gemini directly:
```
> update my comp target to $180K-220K
> add a new archetype: Embedded Systems Engineer
> change my location to London, market to UK
```
Gemini edits `config/profile.yml` or `modes/_profile.md` in place.

### CV Generation Rules

Your standing instructions for how CVs should be tailored live in `modes/_profile.md`
under `## CV Generation Rules`. These override default CV generation behavior.

**Add rules anytime:**
```
> add to my CV rules: always include my patent count
> add to my CV rules: never remove publications section
> add to my CV rules: max 5 bullets per role
> add to my CV rules: minimize rewording — use my exact phrasing for achievements
> add to my CV rules: lead with power electronics experience regardless of role
```

**Or edit the section directly** in `modes/_profile.md` — it's just markdown.

Both the drafter and the reviewer respect these rules. If you say "never cut
publications", the cutting logic skips that section entirely, and the reviewer
flags it if the drafter violated the rule.

**Set rules during setup** — the setup wizard asks for CV preferences after writing
style. Or skip it and add rules later as you learn what you want.

**Template CSS variables** — all templates expose CSS variables at the top of the file
for hands-on tweaking:
```css
:root {
  --base-font-size: 11px;   /* body text size */
  --margins: 0.5in;          /* page padding — narrow by default */
  --bullet-spacing: 0.15em;  /* gap between bullets */
}
```
Edit these in `templates/cv/ats-optimized.html` or `templates/cv/classic-professional.html`
to permanently adjust the template's defaults. The AI uses these variables for overflow
control (reduces them in order if CV overflows 2 pages).

**Full profile refresh** — re-run setup:
```
> setup
```
Setup backs up your existing files to `.bak` before writing new ones, so nothing is lost.

### Updating your CV incrementally

`cv.md` is a plain markdown file — edit it in any text editor (or in Gemini) at any time. Every evaluation reads it fresh, so additions are picked up immediately.

For detailed proof points (project metrics, case study narratives) that are too long for the CV itself, use `article-digest.md` in the project root. The evaluate mode reads it automatically if it exists.

### Starting from scratch

If you want to wipe your profile completely and start over:

1. Delete your profile files:
   ```bash
   # From C:/Work/Git-Python/career-scout/
   rm config/profile.yml modes/_profile.md
   rm -f config/profile.yml.bak modes/_profile.md.bak
   ```
2. Run `setup` — it detects missing files and starts fresh from your `cv.md`

Your `cv.md`, `reports/`, `data/`, and `interview-prep/story-bank.md` are **not** affected — only the profile configuration is wiped.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Job type shows "Unclassified" | Run `setup` to define your target job types |
| Legitimacy check says "no history" | Normal on first use — your scan history is still empty |
| LinkedIn URL fails | LinkedIn requires login — paste the JD text instead |
| Score feels too high/low | Re-run `setup` and redo the Golden Examples calibration |
| `.bak` files appearing | Setup backed up your profile before writing — safe to delete after verifying new content |

---

## Architecture Reference

Full architecture, design decisions, and implementation phases: `plan_rs/CONSOLIDATION-PLAN.md`

Phase 1 detailed spec: `plan_rs/phase1-foundation.md`

Phase 2 detailed spec: `plan_rs/phase2-cv-generation.md`

Phase 3 detailed spec: `plan_rs/phase3-scout.md`

Testing guide: `plan_rs/phase1-user-testing-guide.md`

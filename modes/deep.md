# Mode: deep — Strategic Company Research

Trigger: user types `deep <company>`, `deep research <company>`, or
`interview-prep --deep <company>`.

Produces a structured research prompt for a research agent or AI assistant
covering 6 strategic axes: direction, recent moves, engineering culture,
challenges, competitive landscape, and candidate angle.

## When to use

- At the **decision-to-apply moment** — understand whether this company and
  role align with your trajectory before investing time in applications
- When `interview-prep` Step 1 returns thin intel (< 3 sources) — use deep
  first to understand the company's strategy before the tactical prep pass
- Before a hiring-manager or executive interview round where company strategy
  will likely come up

`deep` = strategic/cultural research. `interview-prep` = tactical interview
intel. They complement each other; do not collapse them.

## Step 0: Read context

Before generating the research prompt, read:
- `config/profile.yml` — candidate's domain, role targets, location
- `modes/_profile.md` — archetypes and "what they buy" column
- `cv.md` — recent projects and proof points for the Candidate Angle axis
- The evaluation report for this company (if one exists in `reports/`) —
  Block A archetype, Block C positioning, Block E personalization angles

## Step 1: Generate the research prompt

Produce a structured research document the user can run in any research tool
(Perplexity, a web search session, another AI assistant, or directly within
this CLI's web search). Personalize each axis using the context read in Step 0.

Replace `[Company]` and `[Role]` with the actual names.

---

```markdown
## Deep Research: [Company] — [Role]

Context: Evaluating a [role] opportunity at [Company]. Goal: actionable
intelligence for the interview and the apply/pass decision.

### Axis 1: Strategic Direction
- What is [Company]'s stated 2-3 year product or market bet?
- Have they published a roadmap, engineering blog posts, or public talks about
  where they're heading?
- What does their hiring pattern suggest about strategic priorities?
  (Look at the last 6 months of job postings.)
- Is the [Role] area growing or contracting?

### Axis 2: Recent Moves (last 6 months)
- Key hires or departures (leadership, eng, product)?
- Acquisitions, partnerships, or integrations?
- Product launches, pivots, or notable feature announcements?
- Funding rounds, valuation changes, or ownership changes?
- Any public incidents (outages, controversies, layoffs)?

### Axis 3: Engineering Culture
- How do they ship? (deploy cadence, CI/CD posture, monorepo vs. multi-repo)
- Primary languages, frameworks, and platforms for [Role]-adjacent work?
- Remote-first, hybrid, or office-first — and what do employees actually report?
- What does Glassdoor/Blind say about engineering culture specifically?
- Do they contribute to open source? What does their public repo activity look like?

### Axis 4: Likely Challenges
- What scaling or reliability challenges does [Company] probably face at this stage?
- Are they migrating infrastructure, replatforming, or retiring legacy systems?
- What pain points do employees or users mention in reviews?
- Where does [Company] lag competitors technically or operationally?

### Axis 5: Competitive Landscape
- Who are [Company]'s main competitors?
- What is [Company]'s stated differentiator / moat?
- Where do they win and where do they lose vs. the competition?
- Any competitor moves in the last 6 months that [Company] must respond to?

### Axis 6: Candidate Angle
Given the candidate's background in [read from cv.md: 2-3 most relevant areas]:
- Which of [Company]'s stated challenges maps most directly to their experience?
- Which projects or proof points from their CV would resonate most in the interview?
- What is the strongest 1-sentence positioning for this candidate at this company?
- What gap in their background is [Company] most likely to probe?
```

---

## Step 2: Run the research

If web search is available: run each axis as a targeted search query.
Extract structured facts — not summaries. Cite sources for every claim.

If web search is unavailable: generate the prompt document above and tell the
user to run it in their preferred research tool.

## Step 3: Output

Write a research document to `interview-prep/{company-slug}-deep-research.md`
with the populated 6-axis structure. This file is separate from the
`interview-prep/{company-slug}-{role-slug}.md` prep doc — they cover different
questions and are used at different moments.

Header:
```markdown
# Deep Research: {Company} — {Role}

| | |
|---|---|
| **Researched** | {YYYY-MM-DD} |
| **Purpose** | Strategic research — decision-to-apply and pre-interview strategy |
| **Related prep doc** | interview-prep/{company-slug}-{role-slug}.md (if exists) |
```

### Generate HTML viewer

After writing the .md file, run:
```
node scripts/md-to-html.mjs interview-prep/{company-slug}-deep-research.md
```
This produces `interview-prep/{company-slug}-deep-research.html` with styled tables and readable formatting.

**Deriving PROJECT_ROOT:** Use the absolute path of a file already read/written this session. Strip from `/cv.md` or `/data/…` onwards. Never run a shell command.

### Terminal output (UX P1+P2)

```
📂 Deep research (HTML): file:///{PROJECT_ROOT}/interview-prep/{company-slug}-deep-research.html
📄 Deep research (MD):   file:///{PROJECT_ROOT}/interview-prep/{company-slug}-deep-research.md

What to do next:
  1. Review Axis 6 (Candidate Angle) — refine your positioning before the interview
  2. Run interview-prep {company} to map your stories to likely questions
  3. If you decide to apply, run evaluate {company} to get fit score + CV tips
```

## Rules

- **NEVER invent statistics.** If a fact is inferred from the job posting or engineering
  blog, label it `[inferred]`. If data is unavailable, say "unknown — not enough data."
- Be direct and dense. This is a working research document, not a narrative.
- Generate in the language the user wrote in (not the JD language).

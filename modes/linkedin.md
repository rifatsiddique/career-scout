# Mode: linkedin — Profile Optimization for Target Roles

<!-- ============================================================
     SYSTEM LAYER FILE — safe to auto-update.
     Contains LinkedIn optimization rules and audit logic only.
     The user's profile text and generated rewrites are User layer:
       data/linkedin-profile.md   (captured current profile)
       output/linkedin/*.md       (generated rewrites)
     ============================================================ -->

Trigger: user types `linkedin`, `linkedin --audit`, `linkedin --rewrite`,
`linkedin --keywords`, `linkedin --headline`, or pastes a LinkedIn **profile**
URL (`linkedin.com/in/...`).

**Routing guard — read this first.** A `linkedin.com/jobs/view/...` URL is a JOB
POSTING and routes to `modes/evaluate.md`, NOT here. Only `/in/` profile URLs
route to this mode. If the input is ambiguous, ask before proceeding.

Optimizes a LinkedIn profile for discovery by recruiters hiring for the user's
target roles. Produces copy-paste-ready rewrites; never edits LinkedIn directly.

## What this mode does NOT do

- Does not log into, scrape, or modify LinkedIn. Everything is copy-paste.
- Does not use the 5-dimension job-fit composite from `_shared.md`. This mode has
  its own Visibility Score with different labels — do not conflate the two, and
  never report a LinkedIn score using fit-category names (GOOD_FIT etc.).
- Does not generate any claim that is not traceable to `cv.md` or `stories.md`.

## Step 0: Load context

Read, in order:
1. `config/profile.yml` — candidate identity, target roles, location, market
2. `cv.md` — the authoritative record of what may be claimed publicly
3. `modes/_profile.md` — archetypes, "what they buy" column, writing style
4. `stories.md` — if present, for quantified proof-point depth. `cv.md` is a
   compressed cut whose bullets state outcomes but not the detail that makes an
   About-section proof point land; `stories.md` holds that depth in curated form.
5. `data/linkedin-profile.md` — if present, the previously captured profile text

Do NOT read `modes/_shared.md`. This mode does not need it.

Do NOT read `career-log.md`. Only `curate`/`fix` read the log. It is raw and
uncurated — anything in it that belongs on a public profile has already been
promoted into `cv.md` or `stories.md`.

## Step 1: Acquire the current profile

LinkedIn blocks unauthenticated fetching, so a pasted `/in/` URL usually cannot be
read directly. Attempt a fetch once; if it returns a login wall or empty content, do
not retry — ask the user instead:

> "LinkedIn blocks automated reads, so I need the text. Easiest path:
>  open your profile → **More → Save to PDF**, then paste the text here.
>  Or paste each section directly — Headline, About, Experience, Skills.
>  If you'd rather start from scratch, say `linkedin --rewrite` and I'll draft
>  everything from your CV."

Save whatever the user provides verbatim to `data/linkedin-profile.md` with a
capture-date header. This file is **User layer** — append new captures as dated
sections, never overwrite prior ones. It lets later runs show before/after diffs.

**This write requires confirmation.** Because this mode does not load `_shared.md`,
it does not inherit UX Convention P6 automatically — the rule is restated in the
Rules section below and MUST be followed. Before writing, surface:

```
⚠️ This will update data/linkedin-profile.md (appending a {YYYY-MM-DD} profile capture).
   A backup has been saved to data/linkedin-profile.md.bak.
   Proceed? [y/N]
```

Default is N. Honor `--yes` / `--no-confirm`.

If the user has no existing profile text and wants a from-scratch draft, skip to
Step 4 and generate all sections from `cv.md`.

## Step 2: Establish the target

Ask, or infer from `config/profile.yml` if unambiguous:

> "Which target role should I optimize for? (One primary — a profile optimized for
>  two unrelated roles ranks for neither.)"

Record: primary target title, 1–2 acceptable adjacent titles, target seniority,
target location/metro, and whether the user is currently employed (this drives the
Open-to-Work recommendation in Step 4e).

**Single-target rule:** LinkedIn's semantic ranking rewards coherence. If the user
names two unrelated targets, say so plainly and ask them to pick a primary; offer
to note the secondary in the About section's "direction" paragraph only.

## Step 3: Build the keyword corpus

The corpus is only as good as the postings it comes from. **The user's own choice of
target postings is the primary source** — it is far more targeted than anything
inferable from history, because only the user knows which of the roles they have
looked at actually represent where they want to go next.

**3a. Ask the user for target postings — but show them the shortcut first.**

Before asking, do the cheap work: list `reports/`, take the **5 most recent** reports
whose filename company/role matches the target, and pull **only the Fit Assessment
section** from each — never the whole report. Extract it with a bounded range read, so
the surrounding blocks never enter context:

```
sed -n '/^## B)/,/^## C)/p' reports/{file}.md
```

Reports run 55–95 lines, so five bounded extracts cost roughly 1–2k tokens. If a
report has no `## B)` section (older schema), skip it rather than falling back to a
full read. If fewer than 2 usable reports remain after filtering, suppress Option B
and go straight to Option A.

Present the result as a ready-to-accept option:

> "To target your profile properly I need to see the kind of roles you're aiming for.
>
>  **Option A — paste 2–5 job postings** that best describe what you want next
>  (URLs or pasted text, they don't need to be roles you applied to — aspirational
>  postings are fine, and often better). This gives the most targeted result.
>
>  **Option B — use what I already have.** From your last 5 evaluations
>  ({company}, {company}, {company}...) I extracted:
>
>    Titles:  {top 3 title variants}
>    Skills:  {top 10 recurring hard skills}
>    Domain:  {top 8 recurring domain/method terms}
>
>  Say **'use those'** to go with Option B, or paste postings to override or add to it."

Handle the reply:
- **User pastes postings** → those become the corpus. Use the report-derived terms only
  as a cross-check; mention any strong term the reports had that the pasted postings
  lack, and ask whether to keep it.
- **User says "use those" / "go with that"** → proceed on the report-derived terms alone.
- **User pastes postings AND says to keep the extracted set** → merge, deduplicate,
  and rank by frequency across the combined set.
- **No reports exist yet** → skip the Option B preview entirely and ask for postings
  directly. If the user has none to hand, fall back to 3c.

**Aspirational-target caution:** if the pasted postings sit clearly above the user's
current level or in an adjacent domain, say so once, plainly, and continue. The
verification gate below already prevents unsupported keywords from reaching the
profile — this is a positioning note, not a blocker.

**3b. Archetype signals.** From `modes/_profile.md`, pull the "Domain signals" and
"What they buy" columns for the archetype matching the target role. Use these to
resolve ambiguity and fill thin categories — never as the primary source.

**3c. Live search (fallback, if web search is available).** Only when 3a produced
fewer than 15 distinct terms — i.e. the user had no postings to paste and no matching
report history. Search for 3–5 current postings for the target title in the target
market and extract recurring skill nouns and tool names.

Then classify every term into three tiers:

| Tier | Definition | Placement requirement |
|---|---|---|
| **P1 — Primary** | The target role title and its 2–3 closest variants | Headline front + current job title + About first 300 chars |
| **P2 — Core skills** | Hard skills / tools appearing in a majority of target JDs | Headline tail + About body + ≥1 Experience bullet + pinned Skills |
| **P3 — Supporting** | Domain terms, methods, standards, adjacent tools | Experience bullets + Skills list |

**Verification gate — do this before writing anything.** For each P1/P2 term, check
it against `cv.md`. If the user has no demonstrable experience with a term, it goes
into a separate **"Gap keywords"** list and is NOT placed in the profile. Report gaps
to the user as an honest development list. Never place a keyword the user could not
defend in an interview.

## Step 4: Rewrite each section

Apply the **exact string, natural context** rule throughout: every P1/P2 keyword must
appear at least once as an exact literal string (Boolean searches and third-party
sourcing tools still match literally) inside a sentence that supplies real context
(LinkedIn's semantic ranking rewards coherence and penalizes stuffing). Never a
trailing tag dump inside Experience bullets.

### 4a. Headline (limit 220 chars)

Formula: `[P1 target title] | [2–4 P2 keywords] | [quantified proof or specialty]`

- Front-load the target title — only ~40 characters render in search results and mobile.
- Use 150+ characters. A bare job title wastes the single highest-weighted field.
- If the user's current scope does not honestly support the target title, use the
  bridging form: `Senior [current] moving into [target]` — still literal-matches the target.
- Never: "Seeking new opportunities", "Results-driven professional", emoji clusters.
- Produce **3 variants** at different aggressiveness levels (conservative / balanced /
  keyword-forward) with the character count shown for each. Let the user pick.

### 4b. About (limit 2,600 chars; target 1,500–2,200)

Four movements, first person:
1. **Hook (2–3 sentences)** — the problem the user solves, in the target domain's
   language, containing the P1 title verbatim. Must land inside the first 300
   characters along with one quantified achievement — that is all that shows above
   the mobile "…see more" fold.
2. **Proof (3–5 sentences or short bullets)** — quantified wins pulled from `cv.md`
   and `stories.md`. Every one carries a number.
3. **How they work (2–3 sentences)** — approach, methods, tooling. Natural home for P2/P3 terms.
4. **Direction + CTA (1–2 sentences)** — what they want next, how to reach them.

Optional final line: a compact `Core: term | term | term` list for Boolean coverage —
permitted **only** for terms genuinely demonstrated above it.

Match the user's writing style from `modes/_profile.md`. Report the character count.

### 4c. Experience

For the current role and the 2 most recent prior roles:

- **Title field:** if the internal title is non-standard, propose the searchable
  equivalent in parentheses: `Engineer III (Power Electronics Design Engineer)`.
  Flag this as the highest-leverage single edit — the current title is a top-weighted
  ranking field. Note the honesty boundary: the parenthetical must describe the work
  actually done, not a promotion the user did not have.
- **One scope line** — team, product, scale, domain.
- **3–5 achievement bullets**, each with a number, %, $, time, unit count, or a
  comparative qualifier. 2–3 sentences per bullet is fine here — LinkedIn has no page budget.
- Every bullet traces to a line in `cv.md`. Cite the source line when presenting it.
- Distribute P2/P3 keywords across bullets inside outcome sentences.

### 4d. Skills

Produce a ranked list of **40–50** skills:
- **Top 3 = pinned**, chosen to match the P1 target exactly.
- Next ~15 = P2 core skills.
- Remainder = P3 supporting terms, tools, standards, methods.
- Prefer canonical LinkedIn taxonomy strings. Warn the user: *"If a skill doesn't
  appear in LinkedIn's picker, it isn't in their taxonomy — pick the nearest
  suggested entry, since free-text skills carry less weight in structured search."*
- Drop anything the user cannot defend. Irrelevant skills dilute semantic coherence.
- Recommend seeking 5+ endorsements on the pinned three specifically — not chasing
  volume across the whole list.

### 4e. Supporting surfaces

Generate concrete recommendations, not generic advice:

- **Open to Work:** recruiter-only if employed, public banner if openly searching.
  Supply the exact 5 target titles to enter (P1 + variants) — these feed recruiter
  filters directly.
- **Location:** must be set to the target metro if relocating. Recruiter location
  filters are hard filters, not ranking nudges. Read `config/profile.yml → location`.
- **Custom URL:** `linkedin.com/in/firstname-lastname`.
- **Featured:** name 2–4 specific items from the user's actual work.
- **Recommendations:** suggest 3 specific people/relationships from `cv.md` roles, and
  draft a short request message for each.
- **Banner:** 1584×396, domain-relevant.
- **Activity:** ~2 posts or substantive comments per week; suggest 3 concrete topics
  drawn from the user's archetype and recent projects.

## Step 5: Score the CURRENT profile, and check the rewrite

Two different things happen here, and conflating them is the trap:

**Never score your own generated text.** A "projected score" for a rewrite this mode
just produced is self-grading and will always come back near-perfect. Do not compute
one. Do not present a before/after score pair.

**5a. Visibility Score — applies ONLY to the profile the user already has.** This is
the whole point of `linkedin --audit`: it measures LinkedIn's current state, which
the mode did not write, so it is a real measurement. Skip this step entirely on
`--rewrite` (there is no existing profile to score).

**5b. Rewrite compliance checklist — applies to generated sections.** No score, no
arithmetic. Just a constraint check the user can verify by eye:

```
☑ Target title front-loaded in headline (first 40 chars)
☑ Headline 150+ / 220 chars
☑ Target role + one metric inside About's first 300 chars
☑ Every Experience bullet carries a number
☑ Top 3 skills pinned to target role
☐ Current job title still non-searchable — see the Title field recommendation in Step 4c
```

### 5a — Visibility Score (existing profile only)

Score the profile 0–100 across six dimensions. **These labels are specific to this
mode — do NOT reuse the job-fit categories from `_shared.md`.**

| # | Dimension | Weight | What full marks looks like |
|---|---|---|---|
| 1 | **Headline strength** | 25% | Target title front-loaded, 150+ chars, 2+ P2 keywords, quantified proof |
| 2 | **Keyword coverage** | 20% | All P1 present in top-weighted fields; ≥80% of P2 placed somewhere legitimate |
| 3 | **About effectiveness** | 20% | Target role + a metric inside first 300 chars; 1,500+ chars; first person; CTA |
| 4 | **Experience quality** | 15% | Searchable titles; every bullet quantified; keywords inside outcome sentences |
| 5 | **Skills configuration** | 10% | 40+ skills, top 3 pinned to target, taxonomy-canonical |
| 6 | **Completeness & signals** | 10% | Photo, banner, custom URL, Featured, 3+ recommendations, recent activity, correct location |

```
visibility = (headline × 0.25) + (keywords × 0.20) + (about × 0.20)
           + (experience × 0.15) + (skills × 0.10) + (signals × 0.10)
```

| Band | Score | Meaning |
|---|---|---|
| **DISCOVERABLE** | 85–100 | Profile will surface for target-role searches. Maintain and stay active. |
| **COMPETITIVE** | 70–84 | Surfaces, but ranks below better-optimized peers. Fix the lowest dimension. |
| **UNDERINDEXED** | 50–69 | Present but rarely surfaced. Headline and About need real work. |
| **INVISIBLE** | 0–49 | Effectively unsearchable for the target role. Full rewrite recommended. |

These weights are heuristics, not LinkedIn's published ranking function — LinkedIn
does not publish one. Say so when reporting the score. Never state the "60% of
ranking weight" figure to the user: it is an unverified vendor claim. Say "the
headline and current job title are the highest-weighted fields" instead, which is
well-supported and drives the same prioritization.

Report the current score once. Do not project a post-rewrite score — see the rule at
the top of Step 5.

## Step 6: Output

Write to `output/linkedin/linkedin-{target-role-slug}-{YYYY-MM-DD}.md`.

Structure the file for copy-paste — each section in its own block so the user can
copy it straight into LinkedIn without stripping commentary:

```markdown
# LinkedIn Optimization — {Target Role}

| | |
|---|---|
| **Target role** | {title} |
| **Optimized** | {YYYY-MM-DD} |
| **Current profile score** | {current} ({band}) — audit runs only; omit on `--rewrite` |

## 1. Headline — pick one
### Variant A — Conservative ({N}/220 chars)
### Variant B — Balanced ({N}/220 chars)
### Variant C — Keyword-forward ({N}/220 chars)

## 2. About ({N}/2600 chars)

## 3. Experience — {Company}
**Title:** ...

## 4. Skills (pin the first 3)

## 5. Settings & Supporting Surfaces

## 6. Keyword Coverage Map
| Keyword | Tier | Placed in | CV backing |

## 7. Gap Keywords — appear in target JDs, NOT in your background
| Keyword | Frequency in target JDs | Honest options |

## 8. Rewrite Compliance Checklist
☑ / ☐ per constraint — see Step 5b

## 9. Current Profile Score Breakdown  (audit runs only — omit on --rewrite)
| Dimension | Score | Why |
```

Then generate the HTML viewer:
```
node scripts/md-to-html.mjs output/linkedin/linkedin-{target-role-slug}-{YYYY-MM-DD}.md
```

Relay the `📂 Open:` and `   Path:` lines from stdout, then:

```
What to do next:
  1. Copy the headline variant you like into LinkedIn (highest-leverage edit)
  2. Update your current job title if a searchable equivalent was suggested
  3. Paste the About section, then pin your top 3 skills
  4. Review Section 7 — those keywords are real gaps, not oversights
```

## Sub-commands

| Command | Behavior |
|---|---|
| `linkedin` | Full flow — Steps 0–6 |
| `linkedin --audit` | Steps 0–3 + Step 5 only. Scores the existing profile, no rewrites. Fast. |
| `linkedin --rewrite` | Skips capture; drafts every section from `cv.md` for a new/blank profile |
| `linkedin --headline` | Headline variants only. Cheapest useful run. |
| `linkedin --keywords` | Step 3 only — outputs the tiered corpus + gap list, no rewrites |

*Cut from v1: `linkedin --for <company>`. It coupled the mode to `reports/` file
structure for a case the user can already cover by pasting that company's JD at
Step 3a. Revisit only if the paste path proves annoying in practice.*

## Rules

- **NEVER fabricate.** Every claim traces to `cv.md` or `stories.md`. Cite the
  source line when presenting a rewritten bullet.
- **NEVER read `career-log.md`.** The log is raw and uncurated; only `curate`/`fix`
  read it. Material fit for a public profile has already been promoted into `cv.md`
  or `stories.md`. Reading the log here would leak unvetted content onto a permanent
  public record — exactly the integrity failure the no-fabrication rule above
  exists to prevent.
- **NEVER place a keyword the user cannot defend in an interview.** Unsupported terms
  go to the Gap Keywords list. A LinkedIn profile is a persistent public record that
  is cross-checked against the CV during hiring — divergence is an integrity risk,
  not a growth hack.
- **NEVER stuff.** LinkedIn's ranking penalizes unnatural repetition. One contextualized
  use beats five.
- **NEVER edit LinkedIn.** Output is copy-paste; the user makes every change.
- **NEVER report a LinkedIn score using job-fit category names** (PERFECT_MATCH,
  GOOD_FIT, etc.). Use the Visibility bands.
- `data/linkedin-profile.md` and `output/linkedin/*` are **User layer** — append, never overwrite.
- **User Layer write confirmation is MANDATORY.** This mode deliberately does not load
  `modes/_shared.md`, so it does not inherit UX Convention P6 (`_shared.md` §P6) by
  reference. The rule is restated here in full and carries the same force: before any
  write to `data/linkedin-profile.md` or `output/linkedin/*`, write a `.bak` first,
  state in one line what is changing, and prompt `Proceed? [y/N]` with N as the
  default. Recognize `--yes` / `--no-confirm`. **Maintenance note:** if P6 changes in
  `_shared.md`, this block must be updated to match — it is an intentional duplication,
  not an oversight.
- State the source and confidence when citing a ranking mechanism. LinkedIn does not
  publish its algorithm; most public figures are vendor estimates. Say so rather than
  presenting heuristics as facts.
- Generate in the language the user wrote in.

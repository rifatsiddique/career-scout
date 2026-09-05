# LinkedIn Profile Optimization Mode for career-scout

| | |
|---|---|
| **Status** | IMPLEMENTED 2026-09-05 (v1.1). All 6 open questions resolved; §5 executed except steps 7/7a/7b. |
| **Author** | Claude Code |
| **Date** | 2026-08-21 (drafted) · 2026-09-05 (Q6 staleness fix §6c; implemented, §8) |
| **Scope** | New lazy-loaded mode `modes/linkedin.md` + routing updates to `AGENTS.md`, `GEMINI.md`, `.agents/skills/career-scout/SKILL.md`, `docs/DATA_CONTRACT.md` |
| **Open questions** | All 6 resolved — see §6b (Q1–Q5, Gemini round) and §6c (Q6, source-of-truth fix) |

> **Status note:** implemented 2026-09-05. The Gemini review round (§6b) and the
> post-review staleness fix (§6c) are both applied, and §5 was executed in order.
> §8 records what deviated from this spec during implementation. Three verification
> steps (7, 7a, 7b) remain — they require a live session with real profile data.

---

## 1. Research Findings — LinkedIn Optimization for Target Job Roles

All findings below were gathered 2026-08-21. Sources listed in §7. Confidence
labels: **[High]** = corroborated across 3+ independent sources or LinkedIn's own
documentation; **[Medium]** = 2 sources, plausible mechanism; **[Low]** =
single-source or vendor-marketing claim, treat as heuristic not fact.

### 1.1 How recruiter discovery actually works (the mechanism that matters)

The single most important shift for 2025–2026: **LinkedIn Recruiter has moved from
Boolean keyword matching to LLM-backed semantic retrieval.** Profiles are scored as
holistic entities — the engine reasons about relationships between titles, skills,
and industries rather than counting exact-string hits. **[High]**

Practical consequences, and they invert some older advice:

| Old advice (pre-2024) | 2026 reality |
|---|---|
| Repeat your target keyword 5–7 times | Keyword *stuffing is actively penalized* — it reads unnatural and depresses recruiter conversion **[Medium]** |
| Exact-match the JD phrasing everywhere | Semantic coherence beats density; one clear, contextualized use outranks five stuffed ones **[High]** |
| Skills list = keyword dumping ground | Skills are a *structured* signal — pinned + endorsed + verified skills are weighted separately from free text **[High]** |

**But** Boolean has not disappeared. Many recruiters still run literal searches
(`"Python" AND "AWS"`, `"Power Electronics" AND "LLC"`), and third-party sourcing
tools scraping LinkedIn are almost entirely literal. The correct 2026 strategy is
therefore **dual-target**: every priority keyword must appear *at least once as an
exact literal string* (for Boolean/scraper coverage) *inside a natural sentence that
supplies context* (for semantic ranking). This "exact string, natural context" rule
is the design centerpiece of the proposed mode.

### 1.2 Section weighting

LinkedIn's Recruiter search guidance indicates **the headline plus current position
title carry roughly 60% of search ranking weight** **[Medium — widely repeated,
attributed to LinkedIn's Recruiter Search Guide; treat the figure as directional,
not literal]**. Remaining weight distributes across About, Experience descriptions,
Skills, Education, and Certifications.

Secondary ranking inputs, independent of text:

- **Profile completeness** — "All-Star" completeness materially increases surfacing **[High]**
- **Activity recency** — profiles that post or comment weekly rank above dormant profiles with identical credentials **[Medium]**
- **Endorsement counts** — a skill with 50+ endorsements outranks the same skill at 0 **[Medium]**
- **Verified skills** — vendor sources claim ~30% higher ranking for that skill **[Low — single-source figure; the directional effect is real, the number is not verifiable]**
- **Connection degree / shared network** — recruiters see 1st/2nd degree higher in results **[High]**

### 1.3 Headline

- **Hard limit: 220 characters.** Most guidance recommends actually using 150+ of them; a bare job title wastes ~85% of the highest-weighted field on the profile. **[High]**
- Only the **first ~40 characters** render in search-result lists, comment feeds, and mobile previews. The target role title must sit at the front. **[High]**
- Working formula: `[Target Role Title] | [2–4 hard-skill keywords] | [Quantified proof or specialty]`
- Example: `Power Electronics Engineer | LLC, PSFB, DAB Converters | 3 kW/L density, 12 designs to production`
- Anti-patterns: `Seeking new opportunities` (burns prime real estate, signals nothing searchable), `Results-driven professional` (zero keyword value), emoji-heavy headlines (dilute the searchable field).
- Note the **title-mirroring tension**: mirroring the exact target title ranks better but can misrepresent current seniority. Resolution: use the target title only when the user's actual current scope supports it; otherwise use the bridging form `Senior X moving into Y` — which still literal-matches Y.

### 1.4 About section

- **Hard limit: 2,600 characters.** Recommended usable range 1,500–2,200. **[High]**
- **Only the first ~300 characters (≈3 lines on mobile) show before the "…see more" fold.** Target role, strongest quantified achievement, and the searchable keyword cluster must all appear above the fold. **[High]**
- Structure that consistently performs:
  1. **Hook (2–3 sentences)** — the problem you solve, framed in the target domain's language, containing the target role title verbatim.
  2. **Proof (3–5 sentences or short bullets)** — quantified wins. Numbers, %, $, scale, "first/largest/3x".
  3. **How you work (2–3 sentences)** — approach, methods, tooling. This is the natural home for secondary keywords.
  4. **Direction + CTA (1–2 sentences)** — what you're looking for next and how to reach you.
- First person. Third-person bio prose ("Rifat is a...") reads as dated and reduces reply rates. **[Medium]**
- A plain-text **skills/keyword line** at the end (e.g. `Core: LLC | PSFB | DAB | GaN | magnetics design | PSpice`) is a legitimate Boolean-coverage device *provided* the keywords are genuinely represented above it. This is the one place a compact keyword list is not stuffing.

### 1.5 Experience section

- Each role: **one-sentence scope/context line, then 3–5 achievement bullets.**
- **Every bullet needs a number** — %, $, time, unit count, scale, or a comparative qualifier ("first", "largest", "3x").
- Bullets can be slightly longer than CV bullets (2–3 sentences is acceptable) because there is no page budget — but density still wins.
- **The current-position job title is a top-weighted ranking field.** Where the internal title is non-standard ("Member of Technical Staff", "Engineer III"), the profile title should carry a searchable equivalent alongside it: `Engineer III (Power Electronics Design Engineer)`. This is the highest-leverage single edit available to most users. **[High]**
- Keyword placement in Experience must be **inside outcome sentences**, never as trailing tag lists.

### 1.6 Skills section

- **Add 40–50 skills.** Ceiling is 100; the ranking benefit flattens well before that, and irrelevant skills dilute semantic coherence. **[High]**
- **Pin the top 3** to the target role — these are weighted heaviest and are what a recruiter sees without expanding. **[High]**
- Skills should be **selected from LinkedIn's controlled taxonomy** wherever a canonical entry exists — free-text skills that don't map to a taxonomy node are worth materially less in structured search. This is a real constraint the mode must respect: it can only recommend skill *strings*, and the user must confirm the picker offered them.
- Endorsements matter, with sharply diminishing returns; the practical target is 5+ on the pinned three, not chasing 50.
- **Profiles with at least one skill listed receive up to 2x profile views and 4x recruiter messages** — the floor effect is much larger than the marginal effect. **[Medium]**

### 1.7 Supporting surfaces

| Surface | Recommendation | Impact |
|---|---|---|
| **Open to Work** | Recruiter-only mode if currently employed; public green banner only if unemployed or openly searching. Up to 5 target titles + workplace type. **Set the titles to literal target-role strings** — they feed the recruiter-side filter directly. | High |
| **Custom URL** | `linkedin.com/in/firstname-lastname` — improves Google indexing of the profile and looks professional on the CV | Medium |
| **Banner** | 1584×396 px, domain-relevant. Any custom banner beats the default gradient | Low |
| **Featured** | 2–4 items — portfolio, publications, a strong post. Recruiters spend measurably longer on profiles with tangible proof | Medium |
| **Recommendations** | 3+ from managers/peers. Also a free keyword surface — recommenders' text is indexed | Medium |
| **Activity** | Post or comment ~2x/week. Affects passive-search surfacing, not just feed reach | Medium |
| **Location** | Must be set to the *target* metro if relocating — recruiter location filters are hard filters, not soft ranking | High |

### 1.8 Ethics boundary (non-negotiable for this system)

Everything above is **presentation optimization**, not fabrication. `AGENTS.md`
already binds the system: every claim must trace to `cv.md` or `stories.md`,
and must pass the interview-backtrack test. LinkedIn adds a sharper constraint than
the CV does — **a LinkedIn profile is a persistent public record that gets cross-checked
against the CV during hiring.** Any divergence between the two is a live integrity
risk. The proposed mode therefore treats `cv.md` as authoritative and *flags* any
suggested LinkedIn claim that has no CV backing, rather than generating it.

---

## 2. Token-Efficiency Design

The constraint: `career-scout` must not carry LinkedIn knowledge in its default
context. The design satisfies this as follows.

1. **All LinkedIn knowledge lives in `modes/linkedin.md` and nowhere else.** No LinkedIn
   best practices, character limits, or scoring rubrics are added to `_shared.md`,
   `AGENTS.md`, `GEMINI.md`, or `SKILL.md`.
2. **The routing tables gain one row each** — approximately 25 tokens per file,
   ~100 tokens total across all four routing surfaces. This is the entire
   always-loaded cost.
3. **`modes/linkedin.md` does NOT read `modes/_shared.md`.** This mode does not score
   job fit, does not use the 5-dimension composite, and does not need archetype
   detection beyond an optional keyword hint. It follows the `recruiter.md`
   precedent of *lazy* shared-context loading — and goes further by not needing it
   at all in the default path. Estimated saving vs. eager loading: ~4,500 tokens.
4. **The keyword corpus is user-supplied first, and report-mining is bounded.** The
   primary source is 2–5 target postings the user pastes. As a shortcut, the mode also
   reads at most the 5 most recent `reports/*.md` requirement sections — not whole
   reports, and only when evaluations exist — and offers the extracted terms as a
   one-word-accept alternative. Bounded by construction either way.
5. **Estimated `modes/linkedin.md` size:** ~380 lines / ~5,000 tokens — comparable to
   `recruiter.md` (393 lines), well under `scan.md` (836) and `cv.md` (1,174).

**Net effect on a session that never mentions LinkedIn: ~100 tokens.**

---

## 3. Proposed Content — `modes/linkedin.md`

> Reviewer note: this is the full proposed file body. It is written CLI-agnostically
> per the Multi-CLI Compatibility rule — no Claude-specific tool names.

~~~markdown
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
☐ Current job title still non-searchable — see recommendation in §3
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
  public record — the exact failure §1.8 exists to prevent.
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
~~~

---

## 4. Proposed Routing Updates

### 4.1 `AGENTS.md` — Mode Routing table

Insert one row, after the `deep` row and before the `auto` row:

```markdown
| Types "linkedin" or pastes a LinkedIn profile URL (`/in/`) | Read `modes/linkedin.md` (does NOT load `_shared.md`) |
```

**Also required — a disambiguation guard.** `AGENTS.md` currently routes any
job-shaped URL to `evaluate`. `linkedin.com/jobs/view/...` must keep doing that.
Add immediately below the routing table:

```markdown
**LinkedIn URL disambiguation:** `linkedin.com/in/...` is a PROFILE → route to
`modes/linkedin.md`. `linkedin.com/jobs/...` is a JOB POSTING → route to
`modes/evaluate.md`. Never load both mode files for one input.
```

Also add one row to the **Main Files Reference** table:

```markdown
| `data/linkedin-profile.md` | Captured LinkedIn profile text (dated snapshots, append-only) |
```

### 4.2 `GEMINI.md` — Mode Routing table

Insert after the `recruiter` row:

```markdown
| `linkedin` (or pastes a `linkedin.com/in/` profile URL) | Read `modes/linkedin.md`. Do NOT read `modes/_shared.md` — this mode does not use the job-fit composite. Execute the profile optimization flow. |
```

**Critical — GEMINI.md needs a carve-out inside the CRITICAL MANDATE block.** That
block is written to override all default behavior and fires on any URL containing
`jobs/`. It currently gives Gemini no instruction to distinguish a LinkedIn profile
URL from a LinkedIn job URL. Add to the "How to detect a job URL or JD text" list:

```markdown
**Exception — LinkedIn profile URLs.** A URL matching `linkedin.com/in/...` is a
PROFILE, not a job posting. Do NOT trigger the A-G evaluation mandate. Read
`modes/linkedin.md` instead. This exception is narrow: it applies ONLY to
`linkedin.com/in/...`. Every other job URL — including `linkedin.com/jobs/...`
and all external ATS links (Greenhouse, Lever, Ashby, Workday, company career
pages) — continues to trigger evaluation exactly as before.
```

Also extend GEMINI.md's System Layer list to include `modes/linkedin.md`, and its
User Layer list to include `data/linkedin-profile.md`.

### 4.3 `.agents/skills/career-scout/SKILL.md`

Frontmatter `argument-hint` — add `linkedin`:
```
argument-hint: "[evaluate | pipeline | setup | cv | scan | interview-prep | recruiter | linkedin | batch | auto]"
```

Routing table — add:
```markdown
| `linkedin` | `linkedin` |
```

Auto-detection paragraph — add a preceding clause:
```markdown
**LinkedIn profile URLs:** if `$mode` contains `linkedin.com/in/`, route to
`linkedin` — NOT `evaluate`. Check this BEFORE the job-URL auto-detection below,
since `linkedin.com/jobs/` must still route to `evaluate`.
```

Discovery menu — add a block after the recruiter block:
```
  /career-scout linkedin              → Optimize your LinkedIn profile for your target role
  /career-scout linkedin --audit      → Score your current profile, no rewrites (fast)
  /career-scout linkedin --headline   → Just the headline — 3 variants, highest-leverage edit
  /career-scout linkedin --keywords   → What recruiters search for in your target role + your gaps
  /career-scout linkedin --rewrite    → Draft a full profile from scratch from your CV
```

### 4.4 `docs/DATA_CONTRACT.md`

User Layer table — add:
```markdown
| `data/linkedin-profile.md` | Captured LinkedIn profile text — dated snapshots, append-only, never overwritten |
| `output/linkedin/*.md` | Generated LinkedIn rewrites and audits |
| `output/linkedin/*.html` | Auto-generated HTML companions to `output/linkedin/*.md` — regenerated each run; safe to delete; `.md` is source of truth; do not edit directly |
```

The `*.html` row must use the same wording as the existing `reports/*.html` and
`interview-prep/*.html` rows so the lifecycle rules stay identical across all three.

System Layer table — add:
```markdown
| `modes/linkedin.md` | LinkedIn profile optimization mode instructions |
```

### 4.5 `modes/port.md`

Per the CLAUDE.md **Port-profile file tracking** rule, this plan introduces two new
User layer paths, so `modes/port.md` must be updated to carry them across migrations:

- `data/linkedin-profile.md` — copy strategy: **copy-if-absent, merge-append if present**
- `output/linkedin/*` — copy strategy: **copy whole directory** (matches existing `output/*` handling)

If `config/port-manifest.yml` drives porting declaratively, add the same two entries there.

### 4.6 `plan_rs/CONSOLIDATION-PLAN.md`

Per the Commit Discipline and Keeping the Plan Current rules, the consolidation plan
must be updated in the same commit: add `linkedin` to the mode roster, note the new
User layer files, and bump `Version:` (minor) and `Last Updated:` with a timestamp.
**Not done in this draft** — it is a `plan_rs/` edit and this document is review-only.

---

## 5. Implementation Steps & Verification

Per CLAUDE.md planning rules, each step states how it is verified before moving on.

| # | Step | Verification before proceeding |
|---|---|---|
| 1 | Create `modes/linkedin.md` from §3 | File exists; contains no Claude-specific tool names (`grep -iE 'WebFetch\|WebSearch\|Bash tool\|Read tool' modes/linkedin.md` returns nothing); does not instruct reading `_shared.md` |
| 2 | Add routing row + disambiguation guard to `AGENTS.md` | Fresh session: paste a `linkedin.com/in/` URL → agent reads `modes/linkedin.md` only. Paste a `linkedin.com/jobs/view/` URL → agent reads `_shared.md` + `evaluate.md`. Both must hold. |
| 3 | Add routing row + mandate carve-out to `GEMINI.md` | Same two-URL test run under Gemini CLI. This is the highest-risk step — the CRITICAL MANDATE is deliberately overriding, so confirm the carve-out actually wins. |
| 4 | Update `SKILL.md` (hint, table, auto-detect, menu) | `/career-scout` with no args shows the linkedin block; `/career-scout linkedin --audit` routes correctly |
| 5 | Update `docs/DATA_CONTRACT.md` | New paths present in the correct layer tables |
| 6 | Update `modes/port.md` (+ `config/port-manifest.yml` if applicable) | Dry-run `node scripts/port-profile.mjs` against a scratch instance; confirm both new paths are listed and backed up |
| 7 | End-to-end smoke test | Run `linkedin --headline` with a real target role. Confirm: 3 variants produced, each ≤220 chars with counts shown, every keyword traceable to `cv.md`, gap keywords listed separately, no fit-category labels used |
| 7a | P6 write-confirmation test | Run `linkedin` and supply profile text. Confirm a `[y/N]` prompt appears before `data/linkedin-profile.md` is written, that `.bak` exists afterward, and that answering N writes nothing. This is the isolation decision's main failure mode — do not skip it. |
| 7b | Corpus-source branch test | Run `linkedin --keywords` three ways: (a) paste 3 postings → corpus comes from them; (b) reply "use those" → corpus comes from the report preview, no further prompting; (c) with an empty `reports/` → Option B preview is suppressed, not shown empty |
| 8 | Token-cost check | Measure context size of a session that never invokes linkedin, before vs. after. Delta should be ≤150 tokens. If higher, knowledge has leaked out of the mode file — fix before commit. |
| 9 | Update `plan_rs/CONSOLIDATION-PLAN.md` + bump version | Version and `Last Updated` reflect this change; linkedin appears in the mode roster |
| 10 | Update `README.md` if it lists modes | README mode list matches the SKILL.md menu |

---

## 6. Open Questions for the Reviewer

1. **Is `data/linkedin-profile.md` worth the file?** It enables before/after diffs and
   avoids re-pasting on every run, but it adds a User layer file and therefore a
   port-manifest entry. The alternative is holding the pasted profile in-session only.
   *My recommendation: keep it* — repeat runs are the common case, and re-pasting a
   2,600-character About section is real friction.
2. **Should the Visibility Score exist at all?** It is unavoidably a heuristic — LinkedIn
   does not publish its ranking function, and precise-looking weights on estimated
   mechanisms can read as more authoritative than they are. *My recommendation: keep it,
   because it drives prioritization*, but the mode must state plainly that the weights
   are heuristics. §3 Step 5 and the Rules block both do this.
3. **`--for <company>` coupling.** This sub-command reads `reports/` to target a
   specific role. It is genuinely useful before a referral or an interview, but it
   creates a dependency on report format. *Recommend keeping, but treat as optional
   scope — cut it if the reviewer wants a tighter v1.*
4. **The 60% headline-weight figure.** Widely repeated and attributed to LinkedIn's
   Recruiter Search Guide, but I could not verify it against LinkedIn's own published
   documentation. The mode does not depend on the exact number — only on "headline and
   current title are top-weighted", which is solid. Flagging so it is not restated as fact.
5. **Should `linkedin` hook into `auto-pipeline`?** E.g. after a PERFECT_MATCH
   evaluation, offer a LinkedIn tune-up for that role family. *Recommend deferring* —
   it adds cross-mode coupling for marginal benefit, and `auto-pipeline.md` is already
   the most complex orchestration path in the system.
6. **Which file supplies proof-point depth, now that the career-log architecture has
   landed?** *(Raised 2026-09-05, after the Gemini round — this question did not exist
   at review time.)* The draft was written against `article-digest.md`, which was
   retired two days later when `career-log.md` became canonical. See §6c.

---

## 6b. Gemini Review — Resolutions (2026-08-21)

Findings investigated per the CLAUDE.md Gemini Review Protocol. Verified before accepting.

| # | Finding | Verdict | Action taken |
|---|---|---|---|
| 1 | Routing carve-out wording disables evaluation for non-LinkedIn job URLs | **Accepted** | §4.2 exception rewritten to scope narrowly to `/in/` and explicitly preserve `linkedin.com/jobs/` + all external ATS links |
| 2 | "Extract without loading" is unimplementable; report-mining blows the budget | **Partly accepted — severity rejected** | Instruction was genuinely unimplementable as written. Fixed by specifying a bounded `sed -n '/^## B)/,/^## C)/p'` extract. **Rejected the BLOCKER rating and the proposed cut:** measured reports are 55–95 lines, so 5 bounded extracts cost ~1–2k tokens, not a budget blowout. Rejected the `scripts/extract-keywords.mjs` proposal as over-engineering for ~400 lines of text. Option B stays — the user explicitly requested it. |
| 3 | Mode skips `_shared.md`, so it never inherits P6 write confirmation | **Accepted in full** | Verified: P6 is real, at `modes/_shared.md:332`. This is the genuine cost of the isolation decision. P6 restated verbatim in Step 1 and in the Rules block, with a maintenance note flagging the duplication as intentional. |
| 4 | `output/linkedin/*.html` lifecycle undocumented | **Accepted** | §4.4 now splits `*.md` and `*.html` rows, `*.html` worded identically to the existing `reports/*.html` row |
| 5 | Visibility Score is self-grading; cut it | **Partly accepted** | The self-grading critique is correct **for the projected score only** — that is now explicitly forbidden. **Rejected the full cut:** scoring the user's *existing* profile is measuring LinkedIn's state, not the mode's own output, and `--audit` has no reason to exist without it. Score is now audit-path-only; the rewrite path gets a checklist (Step 5b) instead. |

Open questions resolved: Q1 keep the file (agreed); Q2 see finding 5 — split rather than
cut; Q3 `--for <company>` cut from v1 (agreed); Q4 the 60% figure is now banned from
user-facing text while the directional guidance stays (agreed); Q5 `auto-pipeline` hook
deferred (agreed).

---

## 6c. Post-Review Staleness Fix (2026-09-05)

**Q6 resolved.** The draft was written 2026-08-21 against `article-digest.md`. The
career-log architecture landed 2026-08-23 (`plan_rs/career-log-architecture.md` v2.0),
which retired `article-digest.md` and absorbed it into `career-log.md` + `stories.md`.
Verified against the working tree: `article-digest.md` does not exist; `career-log.md`,
`cv.md` and `stories.md` do.

**Resolution — mirror `evaluate.md` Block E.** That block faced the identical problem
and was re-pointed at `stories.md` with an explicit "never read `career-log.md` here"
guard (`modes/evaluate.md:283-286`). This mode adopts the same three-way split, which
also matches AGENTS.md's provenance rule ("every claim must trace back to `cv.md` or
`stories.md`"):

| File | Role in this mode |
|---|---|
| `cv.md` | Authoritative record of what may be claimed publicly |
| `stories.md` | Proof-point depth for the About section and Experience bullets |
| `career-log.md` | **Never read.** Raw and uncurated; `curate`/`fix` only |

The log guard matters more here than in `evaluate`. A LinkedIn profile is a permanent
public record, so leaking unvetted log material onto it is the concrete form of the
integrity risk §1.8 was written to prevent.

**Edits applied to this document:**

| Location | Change |
|---|---|
| §1.8 ethics boundary | `article-digest.md` → `stories.md` |
| §3 "What this mode does NOT do" | `article-digest.md` → `stories.md` |
| §3 Step 0 load list | Item 4 re-pointed to `stories.md` with the compressed-cut rationale; explicit `career-log.md` prohibition added |
| §3 Step 4 About/Proof | Proof pulled from `cv.md` + `stories.md` |
| §3 Rules block | `NEVER fabricate` re-pointed; new `NEVER read career-log.md` rule added |

**No change to scope, sub-commands, routing, or verification steps.** This is a
source-of-truth correction, not a design change. §5's step table is unaffected —
Step 1's grep check should simply also confirm `grep -c 'career-log' modes/linkedin.md`
finds only the prohibition.

**Status after this fix:** all six open questions resolved. The draft is
implementation-ready; §5 remains the execution order. (Implemented 2026-09-05 — see §8.)

---

## 7. Sources

- [LinkedIn Keywords: The Ultimate 2026 List of Keywords That Get You Found by Recruiters — The Interview Guys](https://blog.theinterviewguys.com/linkedin-keywords/)
- [LinkedIn Profile Tips for Job Seekers 2026: 17 Examples & SEO Checklist — OphyAI](https://ophyai.com/blog/resume-writing/linkedin-profile-optimization-job-search)
- [LinkedIn Profile Optimization in 2026: The Complete Guide for Job Seekers — OphyAI](https://ophyai.com/blog/resume-writing/linkedin-profile-optimization-2026)
- [LinkedIn Profile Optimization: 2026 Best Practices for Every Section — CareerBldr](https://careerbldr.com/blog/linkedin-profile-optimization-guide/)
- [LinkedIn Open to Work (2026): Settings, Privacy & When to Use It — CareerBldr](https://careerbldr.com/blog/linkedin-open-to-work-settings/)
- [LinkedIn Open to Work: The Complete 2026 Guide — The Interview Guys](https://blog.theinterviewguys.com/linkedin-open-to-work-guide/)
- [LinkedIn Skills & Endorsements: Rank in Recruiter Searches (2026) — cv4me](https://cv4me.pro/blog/linkedin-skills-endorsements-strategy)
- [Best LinkedIn Skills Keywords to Add in 2026 — LinkedInRank](https://linkedinrank.com/blogs/linkedin-skills-keywords-2026)
- [LinkedIn Profile Optimization 2026: 10x Your Views — ResumeVera](https://resumevera.com/blogs/linkedin-profile-optimization-guide-2026)
- [The 2026 LinkedIn SEO Checklist — Brandinning](https://brandinning.com/the-2026-linkedin-seo-checklist-every-profile-section-you-need-to-optimize/)
- [LinkedIn SEO: How to Rank Your Profile — OrangeMonke](https://orangemonke.com/blogs/linkedin-seo-how-to-rank-your-profile-on-top-searches/)
- [LinkedIn Profile Optimization for Recruiters in 2026 — RecruitBPM](https://recruitbpm.com/blog/10-strategies-to-maximize-your-linkedin-profiles)
- [How to Optimise Your LinkedIn Profile for Recruiter Visibility: 8 Proven Steps in 2026 — BestJobSearchApps](https://bestjobsearchapps.com/articles/en/how-to-optimise-your-linkedin-profile-for-recruiter-visibility-8-proven-steps-in-2026)
- [LinkedIn Featured Section: What to Pin + Examples 2026 — Ligo Social](https://ligosocial.com/blog/linkedin-featured-section-guide-how-to-showcase-your-best-work-in-2025)

**Source-quality caveat:** LinkedIn does not publish its ranking algorithm. The
sources above are career-services and SEO-vendor blogs, which have a commercial
interest in claiming precise, quantified effects. Character limits and UI behaviors
(220 / 2,600 / 300-char fold / 5 Open-to-Work titles) are directly observable and
reliable. Percentage claims about ranking lift are not independently verifiable and
are marked **[Low]** or **[Medium]** in §1 accordingly.


---

## 8. Implementation Record (2026-09-05)

§5 executed in order. Steps 1–6 and 8–10 complete; steps 7, 7a and 7b deferred.

### Deviations from this spec

| # | Spec said | What shipped | Why |
|---|---|---|---|
| 1 | §4.5: `data/linkedin-profile.md` uses "copy-if-absent, merge-append if present" | `strategy: copy-missing` | `merge-append` is not a real strategy. `scripts/port-profile.mjs` supports `overwrite`, `copy-missing`, and `append-dedup` (TSV rows keyed by column index — wrong shape for dated markdown sections). `copy-missing` preserves the safe half of the intent; `modes/port.md` now documents the manual append for the both-populated case. |
| 2 | §4.5: `output/linkedin/*` "copy whole directory (matches existing `output/*` handling)" | Explicit `output/linkedin/*.md` + `*.html` globs, plus `exclude: ["linkedin"]` on `output/*` | `expandGlob` uses a non-recursive `readdirSync` and passes every match to `copyFileSync`. The existing `output/*` handling does not cover subdirectories — it would have handed the `linkedin` directory to `copyFileSync` as a file. See the latent-bug note below. |
| 3 | §5 step 8: always-loaded delta ≤150 tokens | AGENTS.md +108 ✅ · GEMINI.md +185 ⚠️ | Accepted deliberately. The overage is entirely the CRITICAL MANDATE carve-out, which is routing safety, not leaked LinkedIn knowledge — the step-8 criterion ("knowledge has leaked out of the mode file") does not apply. Trimming it risks reintroducing Gemini finding 1: evaluation silently disabled for non-LinkedIn job URLs. |
| 4 | §3 body used `§3` and `§1.8` cross-references | Rewritten as "Step 4c" and an inline restatement | Those numbers address sections of *this plan*, not of the mode file. Extracted verbatim they would have been dangling pointers in a file a fresh-context agent reads alone. |

### Latent bug found and fixed

`config/port-manifest.yml`'s bare `output/*` glob was already unsafe for any
subdirectory; Phase 9 was simply the first change to create one. Fixed here.
**Any future `output/` subdirectory must add both an `exclude` entry and its own
explicit glob** — the manifest now carries a comment saying so.

### Verified

| Check | Result |
|---|---|
| §5 step 1 — no CLI-specific tool names in `modes/linkedin.md` | Pass (grep empty) |
| §5 step 1 — mode never instructs reading `_shared.md` | Pass (all 6 mentions are prohibitions or rationale) |
| §5 step 1 — `career-log.md` appears only as a prohibition | Pass (2 mentions, both "do NOT read") |
| §5 step 6 — port dry-run lists both new paths | Pass (scratch instance; `output/*` correctly skipped the `linkedin` directory) |
| §5 step 8 — always-loaded delta | AGENTS.md +108 tokens (budget 150) |

### Not yet run

Steps 7, 7a and 7b need a live session with real profile data: the end-to-end
`--headline` smoke test, the P6 write-confirmation test (the isolation decision's
main failure mode — do not skip it), and the three-way corpus-source branch test.

# Career-Log-and-Fan-Out Architecture

| | |
|---|---|
| **Status** | DESIGN — for review. No system files modified. |
| **Version** | 0.1 |
| **Date** | 2026-08-21 |
| **Depends on** | `plan_rs/linkedin-mode.md` (drafted, unimplemented — §11 reconciles the two) |
| **Supersedes** | `article-digest.md` (absorbed — §9), `interview-prep/story-bank.md` (renamed/absorbed — §8) |

---

## 1. The architecture in one paragraph

The user stops maintaining a CV and starts keeping a **career log**: one append-only
plain-English file (`career-log.md`) where they dump milestones and accomplishments the
moment they happen, with zero structure required. A new `curate` mode reads only what's
new since the last run, uses a compact **thread index** as its memory of everything it
curated before, and folds the new material into three sibling build artifacts —
`cv.md`, `linkedin.md`, `stories.md` — which are the same facts cut three ways. Those
three files are yours to edit whenever you like — the system detects your edits,
marks what you touched as user-owned, and never overwrites it again; every write it
makes is confirmed `[y/N]` with a `.bak`. All existing modes keep reading the curated files exactly as they read `cv.md`
today, so the fan-out is invisible to the rest of the system. When a target job
appears, Stage 3 (the existing `cv`, `linkedin`, `interview-prep` modes) tailors from
whichever curated file fits. Corrections flow through a `fix` command that routes the
change to the right place — the user never decides which file to edit.

---

## 2. Target file tree

```
career-scout/
├── career-log.md               ← STAGE 1. Canonical. User-owned, append-only.
│                                 The ONLY place truth originates.
├── cv.md                       ← STAGE 2. Build artifact (curated master CV).
├── linkedin.md                 ← STAGE 2. Build artifact (LinkedIn-shaped master).
├── stories.md                  ← STAGE 2. Build artifact (STAR+R story bank).
│                                 Replaces interview-prep/story-bank.md.
├── data/
│   ├── career-log-index.md     ← Curator's memory: threads, gists, watermark,
│   │                             generated-state hashes. DERIVED, rebuildable.
│   ├── career-log-decisions.md ← Roles + ownership records. USER, never rebuilt.
│   └── ...                     (existing files unchanged)
├── modes/
│   ├── curate.md               ← NEW. The only new mode file: curate + fix + log.
│   └── ...                     (existing modes: read-side changes only, §8)
├── .curated/                   ← Snapshots for edit detection (§7b). Gitignored.
├── output/                     ← STAGE 3. Disposable per-target artifacts.
└── (article-digest.md)         ← RETIRED. Career log absorbs its role. §9.
```

One new mode file, two new data files, one new root file, two retirements. Nothing else
is added. This is deliberate: the system already has 13 modes and ~5,900 lines of
instructions; the career log layer must not become a fourth subsystem with its own
gravity.

---

## 3. Career log format — engineered for zero-friction writing

The user appends to `career-log.md` in any editor, or says `log <text>` in a session
(which appends after a `[y/N]` confirm). The ONLY convention asked of the user is a
date heading, and even that is optional — the curator infers a date from git or asks.

```markdown
## 2026-02-12
Got the 3kW LLC prototype to 97.2% peak efficiency. First board spin,
planar transformer. Team of 2, I did the magnetics and loop comp.

## 2026-08-14
That LLC design went into production this month — 10k units/yr. Also
presented it at APEC, got good questions about the synchronous rectification.
```

No IDs, no tags, no categories, no templates. Sloppy grammar is fine. The second
entry doesn't need to reference the first by any key — noticing that they are the
same thread of work is the **curator's** job, not the user's (§5).

**No employer tagging either.** The user never writes which company or role an entry
belongs to. The curator resolves that from the date against a role timeline it keeps
in the index, and asks only in the handful of cases where the date is misleading
(§5b).

**Corrections are entries too** (§7): a dated entry starting `CORRECTION:` supersedes
earlier facts. The file stays append-only even when the past was wrong.

**What does NOT go in the career log:** contact details, comp targets, archetypes,
behavioral profile — those stay in `config/profile.yml` and `modes/_profile.md`,
which already have well-defined owners and consumers. The career log is accomplishments
and milestones only. Mixing identity config into a prose log would force every
curation pass to re-parse it and would break the existing contact-audit pipeline
(`modes/cv.md` 0d, `audit-contact.mjs`), which is built around `profile.yml`.

---

## 4. Data flow and triggers

```
                 user appends (editor, or `log` + confirm)
                              │
                              ▼
   STAGE 1   ┌───────────  career-log.md  ───────────┐   canonical, append-only
             │                                    │
             │   `curate` (user-invoked, never automatic)
             │   reads: delta + index + touched threads only
             ▼                                    ▼
   STAGE 2   cv.md      linkedin.md      stories.md        data/career-log-index.md
             (build artifacts; every write = [y/N] + .bak)   + career-log-decisions.md
             │              │                 │              (updated in the same pass)
             │              │                 │
             │   existing modes, triggered per job target
             ▼              ▼                 ▼
   STAGE 3   modes/cv.md   modes/linkedin.md  modes/interview-prep.md
             tailored PDF  profile rewrite    prep docs, story mapping
             output/*      output/linkedin/*  interview-prep/*
```

Triggers, explicitly:

| Hop | Trigger | Never triggered by |
|---|---|---|
| user → career log | The user, whenever something happens | The system never writes here except `log` and `fix` appends, both `[y/N]`-confirmed |
| career log → curated | User types `curate` (or accepts the nudge below) | Never automatic on career log change — that would violate P6's spirit and surprise the user mid-task |
| curated → per-target | Existing mode commands (`cv`, `linkedin`, `interview-prep`), unchanged | — |

**Staleness nudge (cheap, no career log read):** any mode that reads a curated file
compares mtimes: if `career-log.md` is newer than `cv.md`, print one line —
`"ℹ career-log.md has entries newer than your curated CV. Run 'curate' first? [y/n]"` —
and proceed with the stale file if declined. This is a file-stat check, ~0 tokens,
and it is the mechanism that keeps the curated layer honest without automation.

---

## 5. The hard problem: delta-only reading vs. cross-time linking

### 5.1 Chosen mechanism: a thread index as the curator's memory

The curator maintains **two** files, split by lifecycle — this separation is
load-bearing and is explained in §10.

**`data/career-log-index.md`** — purely derived. System layer. Blown away and rebuilt
by `curate --full` without consequence, because nothing here is a user decision:

```markdown
# Career Log Index — DERIVED. Rebuilt wholesale by `curate --full`.
# Contains no user decisions; safe to delete. See career-log-decisions.md for those.

**Watermark:** curated through `## 2026-08-14` (career log line 214)

## Threads
### T03 — LLC 3kW converter
- roles: R3
- entries: E07 (2026-02-12), E12 (2026-08-14)
- gist: 3kW LLC, 97.2% peak, planar magnetics, production 10k/yr, APEC talk
- outputs: cv.md#exp-generac-b3, linkedin.md#exp-generac-b2, stories.md#S04
- relation: — (see §5.2b: extends / supersedes / new)

## Entry log
- E07 | 2026-02-12 | R3 | LLC proto 97.2% eff, planar xfmr, magnetics + loop comp | → T03
- E12 | 2026-08-14 | R3 | LLC to production 10k/yr; APEC talk on SR | → T03
- E13 | 2026-08-14 | R3 | CORRECTION: supersedes E07 metric (97.2 not 97.8) | → T03

## Last generated  (edit detection, §7b — snapshots live in .curated/)
- cv.md        | written 2026-08-21 | .curated/cv.md.generated
- linkedin.md  | written 2026-08-21 | .curated/linkedin.md.generated
- stories.md   | written 2026-08-21 | .curated/stories.md.generated
```

**`data/career-log-decisions.md`** — user decisions only. User layer, never
auto-overwritten, never rebuilt. Small, slow-growing, and the only file whose loss
costs the user something they cannot recover:

```markdown
# Career Log Decisions — USER LAYER. Confirmed facts and preferences.
# `curate --full` never touches this file.

## Roles
- R1 | Acme Power | Design Engineer       | 2016-06 → 2019-03 |
- R2 | Generac    | Senior Engineer       | 2019-04 → 2024-01 |
- R3 | Generac    | Senior Staff Engineer | 2024-02 → present | promoted_from: R2 | CURRENT
- R0 | (none)     | unaffiliated          | —                 | side projects, talks, publications

## Owned  (see §7b — user-edited regions, never overwritten)
- cv.md#exp-generac-b3 | edited 2026-08-22 | wording
  "Led a team of 4 through the LLC bring-up (97.2% peak efficiency)."
- cv.md#exp-acme-b2    | deleted 2026-08-22 | suppressed — do not regenerate
```

Roles live here because they are user-*confirmed* employment facts, not model
inferences — a rebuild must never silently re-derive your job history. Ownership
records live here because they are unrecoverable by definition: nothing can
reconstruct the fact that you deliberately deleted a bullet.

Entry IDs (`E07`) are assigned **by the curator at curation time** and live only in
the index — the career log itself is never stamped, tagged, or modified. Entries are
anchored by their date heading plus a one-line gist; career log line numbers are recorded
as an accelerator only (valid because appends never shift earlier lines) and are
verified against the heading before use.

**An incremental `curate` run loads:**
1. The delta — everything in `career-log.md` after the watermark (the only career log read)
2. The full index — one line per entry plus thread summaries; compact by construction
3. For each thread the delta plausibly touches: that thread's existing curated
   bullets (located by the `outputs:` anchors), read as bounded extracts

The August entry never needs February's full text to be linked to it — the index gist
(`3kW LLC, 97.2% peak, planar magnetics...`) is enough for the curator to recognize
"that LLC design went into production" as thread T03, merge the two facts into one
strengthened bullet, and propose the edit. If the gist is ambiguous, the curator may
read the specific referenced entries (bounded, by anchor) — still never the whole
career log.

**Budget:** delta (typically 1–3 entries, ~100–400 tokens) + index (~15 tokens/entry;
200 entries ≈ 3k tokens) + touched bullets (~200–600 tokens). An incremental pass
stays under ~4–5k tokens of data regardless of career log size. The index grows linearly
but at one line per entry; a decade of active logging (~500 entries) is ~8k tokens,
at which point thread summaries can be compacted — noted as future work, not designed
now (constraint 5 says the career log stays manageable).

### 5.2 Alternatives rejected

| Alternative | Why rejected |
|---|---|
| **IDs stamped into the career log itself** | Violates the zero-friction contract and turns the user's file into a system-annotated file. Every stamp is a write to the canonical User file. The index gets the same addressing power without touching the career log. |
| **Provenance metadata on curated bullets only** (HTML comments in cv.md pointing at career log dates) | Solves "where did this bullet come from" but not the actual problem: at delta time, nothing maps a *new* entry to an *old* thread without scanning either the whole career log or all three curated files. Provenance is necessary but not sufficient — so it is kept (as the index's `outputs:` anchors) and the thread layer is added on top. |
| **Periodic full reconciliation as the primary mechanism** | Makes the common case expensive and the linking quality dependent on how recently the heavy pass ran. Wrong as primary; kept as the safety net (`curate --full`, §5.3). |
| **Semantic clustering at curation time** | "Cluster related entries" without stored state means re-reading everything every time — this is the full-scan in disguise. |
| **Embeddings / vector index** | The right tool at 10,000 entries, absurd machinery at 200. A one-line-per-entry gist index does the same retrieval job at this scale with zero infrastructure, and stays human-inspectable. |

### 5.2b Threads relate in more than one way — name the relation

The design so far assumes a new entry either **extends** an existing thread or starts a
new one. That binary is too coarse, and the failure it produces is subtle enough to
survive review: *"Optimized Postgres queries"* in March and *"Migrated off Postgres to
DynamoDB"* in September share heavy vocabulary but are not the same accomplishment —
one is tuning, the other is a decision to abandon the thing that was tuned. A curator
matching on gist similarity alone will merge them into one bullet that reads as
continuous progress and is, in substance, false.

So thread assignment resolves to one of four relations, recorded on the thread:

| Relation | Meaning | Curated effect |
|---|---|---|
| `extends` | Same work, further along — adds facts | Merge into one strengthened bullet (the LLC case) |
| `supersedes` | Later work replaced or reversed the earlier approach | Two bullets, or one that states the arc honestly. Never a silent merge. |
| `new` | Anything else, including same-subject-different-accomplishment | New thread |

Three, not four. An earlier draft had a `pivot` relation for "shares subject matter,
different accomplishment," distinguished from `new` only by a cross-reference.
Review was right that a weaker model cannot reliably tell `pivot` from `new`, and the
cross-reference did not earn a category that gets misclassified. Same-subject work
that is a different accomplishment is simply `new`.

`curate.md` must require this classification explicitly rather than defaulting to
`extends`, and must **ask when the relation is not obvious** — the ask is cheap, and
the vocabulary that makes `extends` and `supersedes` look alike is exactly the
vocabulary that makes the mistake invisible afterwards. The distinction that matters
is only ever "does this add to the earlier claim, or undercut it?".

### 5.3 Where the chosen mechanism breaks, honestly

1. **Missed links.** If the August entry shares no vocabulary with the February gist
   ("the resonant project" vs. a gist that says "LLC"), the curator may open a new
   thread and produce two disconnected bullets. *Mitigations:* the curator is
   instructed to ask when thread assignment is uncertain rather than guess
   ("Is this the same work as T03 — LLC 3kW? [y/n]"); and `curate --full` re-reads
   the entire career log, rebuilds threads from scratch, and diffs against the current
   index — recommended after every ~20 entries or when the user suspects a miss.
   Constraint 5 makes the full pass affordable (a whole career of prose is a few
   thousand tokens).
2. **Retroactive career log edits.** The user owns the file and may fix a typo in an old
   entry. Line anchors survive (appends don't shift lines; in-place edits usually
   don't either), but the gist may go stale. The curator verifies the date-heading
   anchor before trusting a line number; on mismatch it falls back to `--full`.
   This is self-healing, not fatal.
3. **Index loss or corruption.** `career-log-index.md` is fully rebuildable by
   `curate --full` — it holds no user decisions. `career-log-decisions.md` (roles,
   ownership records) is NOT rebuildable, which is why it is a separate User-layer file, backed up
   on every write, and in the port manifest (§10). Splitting these was a review
   finding; a single mixed-lifecycle file made every rebuild a chance to eat user edits.
4. **The gist is written by the same model that later reads it.** A lazy gist today
   is a missed link in six months. `curate.md` therefore specifies gist content
   concretely: project noun, headline metric, distinguishing nouns — not a vibe
   summary.

---

## 5b. Role attribution — tying entries to where they happened

A thread is a *line of work*. A role is the *employment context it happened under*.
These are different axes, and the CV needs both: `## Work Experience` is organized by
employer, and every bullet must sit under exactly one of them. A thread index alone
cannot say which heading a bullet belongs to.

**The user must never tag entries with a role.** That would break the zero-friction
contract on the very first day. Instead the role is **ambient state the curator
resolves**, using the `## Roles` timeline in `data/career-log-decisions.md` (see §5.1).

### How attribution works

1. **The role table is seeded free from the CV.** The Work Experience section already
   contains company, title, and date ranges for the whole career — that is the role
   table, and setup's SEED curation (§8b) extracts it at no extra cost to the user.
2. **Entries attribute by date.** An entry dated 2026-08-14 falls inside R3's range,
   so it is stamped `R3`. Automatic, silent, correct in the overwhelmingly common
   case of logging something that just happened.
3. **The curator asks only when the date is not enough** — see the three cases below.

### The four cases that need real handling

**(a) Backdated entries — the common failure.** The user writes today about something
from two jobs ago ("just remembered the Acme thermal redesign — cut junction temp
18°C"). Date-based attribution would file it under the current role, which is a
factual error that lands in a CV and is *very* hard to spot later.

Rule: when an entry's content names a prior employer, product, or teammate, or uses
past-perfect framing ("back when I", "at my old job"), the curator does not trust the
date. It asks:

> "Which role was this under? I'd guess **R1 — Acme Power (2016–2019)**. [y / pick another]"

Cheap to answer, and the guess is usually right because the content named Acme.

**Scope note (review finding):** case (a) is about *entries* logged out of order, which
is common and silently corrupts a CV. It stays. There is deliberately **no retroactive
role wizard** — if the user forgot to log a promotion three years ago, they add a
normal log entry (`[BACKDATED 2021-05] Promoted to Senior`) and the curator opens the
role from that. Backfilling employment history is a once-a-decade event and does not
justify a guided flow.

**(b) Role changes.** The user logs "started at Volt Systems as Principal Engineer
this week." That is a role-boundary event, not an accomplishment. The curator detects
it, and confirms rather than assuming:

> "Looks like a new role. Close **R3 — Generac, Senior Staff (2024-02 → present)**
>  as of 2026-08-21 and open **R4 — Volt Systems, Principal Engineer**? [y/N]
>  (This also affects config/profile.yml — I'll point you at that after.)"

On confirm: R3 gets an end date, R4 opens as CURRENT, and everything logged from then
on attributes to R4 with no further thought from the user. This is the whole answer to
"how do we track as I move to a different company" — you log the move once, in plain
English, and the system re-points the ambient default.

**(c) Promotions and title changes at the same employer.** A new title at the same
company is a new role record with `promoted_from: R2`, not a new company. Curated CVs
render this as a title progression under one employer heading (which is what a reader
expects and what the existing CV templates already do) rather than duplicating the
company. Same confirm flow as (b), lighter wording.

**(d) Threads that span a role boundary.** This one refines §5's model. If work
continues across a job change — or more often across a promotion — the thread stays
ONE thread (it is one line of work, and the story is one story), but its curated
output **splits per role**: separate bullets under each employer heading, because a CV
bullet cannot straddle two companies. `stories.md` does the opposite and keeps it as a
single story, since an interview answer follows the work, not the org chart.

This is the one place the design's "one thread → one bullet per sibling" rule does not
hold, and `curate.md` must state the exception explicitly or the model will merge
across employers and produce a bullet that misrepresents where the work happened.

**Metric attribution is the specific hallucination risk here.** Splitting one cohesive
narrative into two employer-scoped bullets invites the model to carry a metric
achieved at the later employer back into the earlier bullet, or to duplicate the same
number under both. `curate.md` must require, as a hard check before writing a split
thread: every metric in a role's bullet must trace to an entry attributed to *that*
role. A metric that cannot be attributed to the role it appears under is dropped, not
guessed. This is the CV equivalent of claiming someone else's result, and it is the
kind of error that surfaces in an interview.

### Entries with no employer at all

Publications, conference talks, patents, open-source, side projects, and
certifications are career material but not employment. They attribute to **R0
(unaffiliated)** and land in the CV's Projects / Publications / Certifications
sections rather than Work Experience. Threads record which destination they resolved
to via their existing `outputs:` anchors — no new taxonomy is needed.

Note the overlap case: a conference talk *about work done at an employer* (the APEC
talk in T03) attributes to the employing role, because the underlying work did. Only
genuinely independent output is R0.

### Cost of this addition

One `## Roles` block in the index (a handful of lines, seeded free from the CV) and
one `role:` field per entry-log line (~3 tokens each). No new file, no new command, no
user-facing tagging burden. It is the smallest thing that makes employer-correct CV
generation possible, and without it the architecture cannot produce a valid CV at all
— so it is not optional scope.

---

## 6. Curation pass — what `curate` actually does

1. Read `data/career-log-index.md`. If missing → first run → full pass over the career log,
   build the index from scratch.
2. Read the career log delta past the watermark. If empty: report "nothing new" and stop.
3. Segment the delta into entries (date headings; multiple topics under one date may
   split into multiple entries). Assign IDs, write gists.
4. **Attribute each entry to a role** (§5b): stamp by date from the `## Roles`
   timeline in `career-log-decisions.md`; handle role-boundary events and backdated entries by asking. Do this
   BEFORE thread assignment — a thread's role set depends on its entries', and an
   entry filed under the wrong employer produces a bullet under the wrong CV heading.
5. Assign each entry to an existing thread (via index gists), a new thread, or —
   when uncertain — **ask the user**. `CORRECTION:` entries attach to the thread they
   supersede and mark the old entry superseded in the index.
6. For each touched thread, draft the updated cut for each of the three curated
   files. One thread → up to three sibling edits, **except threads spanning a role
   boundary, which split per role in `cv.md` and `linkedin.md` but stay single in
   `stories.md`** (§5b(d)). **Skip every user-owned region** (§7b) — those are never
   rewritten, only proposed against.
7. Present ONE consolidated diff-and-confirm per curated file (P6: what's changing
   in one line each, `.bak` first, `[y/N]`, default N, `--yes` honored):

   ```
   Curated 2 new entries into 1 thread (T03 — LLC 3kW converter).

   cv.md — 1 bullet strengthened:
     - "Designed 3kW LLC prototype reaching 97.2% peak efficiency..."
     + "Designed 3kW LLC converter (97.2% peak efficiency) and took it to
        production at 10k units/yr; presented the SR scheme at APEC 2026."
   Apply to cv.md? [y/N]
   ```

8. On confirm, write the files, update the index (roles, entry log, thread, outputs
   anchors, new watermark) in the same pass. On decline, write nothing — including
   the index, so the entries remain "new" next time.

Not designed in (argued against): auto-curation on a schedule, career log linting,
quality scoring of the user's own log, a career log query language. The career log is a
notebook, not a database.

---

## 7. Correction workflow (Q6 — the load-bearing answer)

Requirement: fixing a wrong metric must cost the user **one sentence**, not "append a
correction paragraph and re-run curation." The user tells the system what's wrong;
the system does the bookkeeping.

The user types `fix <description>` — or just says it in plain English
("the efficiency number is wrong, it's 97.2 not 97.8"), which routes to the same
flow. Steps:

1. **Locate.** Find the offending text in the curated file(s); follow the index
   `outputs:` anchors back to the thread and source entries.
2. **Classify — this is the fork that makes or breaks the UX:**

   **(a) Fact error, career log is wrong** (the log itself said 97.8):
   The truth must change at the source. The system DRAFTS the correction entry —
   `CORRECTION (2026-08-21): LLC peak efficiency was 97.2%, not 97.8% (supersedes
   2026-02-12 entry)` — shows it, appends to `career-log.md` on `[y/N]`, then
   immediately regenerates the affected bullets in all three curated files (each
   with its own P6 confirm). One user sentence → career log corrected → every derived
   cut corrected → provenance intact. Total user actions: the sentence + 2–4 confirms.

   **(b) Fact error, career log was right, curation garbled it:**
   No career log write at all. Regenerate the affected bullets from the correct source
   facts. (The system checks the source entries first, which is how it tells (a)
   from (b) — and it says which case it found.)

   **(c) Wording/style, no fact involved** ("don't say 'spearheaded'",
   "lead with the production number"):
   Not a milestone — it must NOT go in the career log, or the log becomes a config file.
   Two sub-routes:
   - *Generalizable rule* → propose appending to CV Generation Rules in
     `modes/_profile.md` (existing home for exactly this, P6 confirm).
   - *This-bullet-only preference* → reword now and mark that bullet **user-owned**
     (§7b), so no future curation pass rewrites it. Identical in effect to the user
     having made the edit in their editor — the two paths converge on the same
     ownership record.

3. **Never ask the user which file to edit.** The classification is the system's
   job; the user only confirms.

Note (a) and (b) are separated by a *mechanical check, not a judgment call*: the
system reads the source entries and compares them to what the user said. If the log
says 97.8 and the user says 97.2, that is case (a) — checkable, not inferred. Only
(c) requires judgment, and (c) is the case where being wrong is cheapest.

Failure mode to guard in `curate.md`: the model taking the lazy path and treating
every fix as case (c). The mode text requires checking the source entries before
classifying, and stating the classification aloud ("The career log itself says 97.8 —
correcting at the source.").

**Escape hatch for users who would rather route it themselves:** `log "<text>"` always
appends to the career log with no classification, and `fix --wording "<text>"` forces
case (c). Classification is the default because it is less to remember, not because
the explicit path is discouraged.

### 7b. Hand-editing is a first-class workflow — and your edits are permanent

`cv.md`, `linkedin.md`, and `stories.md` are yours to edit in any editor, any time.
The career log remains canonical for *facts*; the curated file is authoritative for
*presentation*. Once you touch something, it is yours and the system stops rewriting
it. That guarantee has to hold for more than rewording, so it is built on ownership
rather than on a list of edit types.

**The rule, in one line: curate never overwrites a region the user has edited. It may
only propose.**

#### Anchors: stable IDs embedded in the file

Everything in this section rests on being able to name a region and have that name
survive edits around it. Positional anchors (`the third bullet`) break the moment a
bullet above is inserted or deleted — the ownership record would then protect the
wrong bullet and overwrite the right one. Content hashes break on the exact edit that
creates them.

So the anchor is **an invisible stable ID written into the file itself**, as an HTML
comment immediately above the region it names:

```markdown
### Generac — Waukesha, WI
<!-- id:T03 -->
- Led a team of 4 through the LLC bring-up (97.2% peak efficiency); now in
  production at 10k units/yr.
<!-- id:T07 -->
- Cut EMI filter volume 30% by moving to a two-stage common-mode design.
```

Properties this buys:

- IDs are **thread IDs** for generated content, so the mapping to
  `career-log-index.md` is direct and needs no lookup table.
- Insertions and deletions anywhere else in the file do not move an ID relative to
  its own content — the comment travels with the bullet because it sits inside the
  same block.
- A user who **writes a new bullet** has no ID; curate assigns one on the next run
  (`<!-- id:user-a3f1 -->`) and records it as authored. Un-IDed content is therefore
  a positive signal ("the human wrote this"), not an error state.
- A user who **deletes a bullet** deletes its ID with it. The diff shows the ID
  disappearing, which is exactly the suppression signal.

They render as nothing in markdown, and never reach a generated PDF — `modes/cv.md`
composes template placeholders from `cv.md` rather than passing it through, and
`generate-pdf.mjs` already has a leak gate. `curate.md` must still state explicitly
that IDs are stripped from every Stage-3 artifact.

Edge case to handle in `curate.md`: a user copy-pasting a bullet duplicates its ID.
On duplicate detection, keep the first occurrence's ownership and assign the copy a
fresh `user-*` ID.

#### How ownership is detected

After every confirmed write, curate saves a copy of exactly what it generated to
`.curated/{file}.generated` (System layer, gitignorable). At the start of the next
`curate` or `fix`, a plain `diff` compares the live file against that snapshot. This
is a shell operation, not a model operation — only the changed hunks reach the model,
so detection is reliable and costs almost nothing regardless of file size.

Each changed hunk maps to the nearest ID above it, and that ID is recorded in
`career-log-decisions.md`:

```markdown
## Owned
- cv.md#exp-generac-b3 | edited 2026-08-22 | wording
  "Led a team of 4 through the LLC bring-up…"
- cv.md#exp-acme-b2    | deleted 2026-08-22 | suppressed — do not regenerate
- cv.md#exp-generac    | reordered 2026-08-22 | bullet order is user-set
- cv.md#proj-b1        | authored 2026-08-22 | user-written, no thread
```

#### What each kind of edit does

| You did this | System does this | Comes back? |
|---|---|---|
| **Reworded** a bullet | Marks the anchor owned; keeps your text verbatim forever | Never rewritten |
| **Changed a number** | Marks owned, and proposes a career-log `CORRECTION:` so the fact reaches `linkedin.md` and `stories.md` too | Your text stays; the *fact* propagates outward |
| **Deleted** a bullet | Records `suppressed` against that thread's output anchor | **Never regenerated** — this is the case a naive design gets wrong |
| **Reordered** bullets | Records the order as user-set for that section | Order preserved on every future write |
| **Wrote a new** bullet with no thread behind it | Records `authored`; offers once to back it into the career log so the other two siblings can use it. Declining is fine and never re-asked | Never removed |
| **Edited a whole section** heading or structure | Same ownership rule at section granularity | Preserved |

#### Three failure modes that must be handled explicitly

**Concurrent edit (write race).** The user may edit `cv.md` in their editor *after*
curate diffed it but *before* they answer `[y]`. Writing the in-memory generation at
that point destroys the edit. So: immediately after the confirmation and before the
write, re-stat the file. If mtime changed since the diff was taken, **abort the write**
and say so — "cv.md changed while I was waiting; re-run curate so I can see your
edit." Aborting is always safe; overwriting never is.

**Missing snapshot.** If `.curated/{file}.generated` is absent (deleted, fresh clone,
first run after upgrade), curate cannot tell generated content from user content. It
must fail toward preservation: **treat the entire live file as user-owned**, write
nothing over it, and offer a `--full` reconciliation that proposes changes rather than
applying them. Never treat a missing snapshot as "the file is unmodified."

**Merged or split bullets.** The most destructive edit and the easiest to get wrong:
the user merges two bullets into one, or splits one into two. The diff shows a
deletion plus an insertion spanning multiple IDs. Rule: when a hunk spans more than
one ID, mark the resulting block `authored` with a fresh ID, and record the original
IDs as `suppressed` so their threads never regenerate them. The user's composition
wins whole; curate does not try to reconstruct which half came from which thread.

#### When new log material affects something you own

This is the only genuinely hard case, and it must never resolve silently. It also
must not default the same way in both directions — a blanket "keep mine" would slowly
rot the CV, because every bullet you ever fixed a typo in would stop receiving new
facts forever, silently. The governing principle from §7b applies: **the log is
authoritative for facts, you are authoritative for presentation.** So the default
follows what the new material actually contains:

| New material is… | Default | Why |
|---|---|---|
| **A new fact** (metric, scope, outcome, date) | **merge** — your wording, their fact folded in | Losing a real accomplishment because you once fixed a typo is the worse error |
| **Rewording only**, no new fact | **keep mine** | Presentation is yours; there is nothing to gain |

```
New log entry adds a FACT to T03, and you've edited that bullet by hand.

  Yours:    "Led a team of 4 through the LLC bring-up (97.2% peak efficiency)."
  New fact: now in production at 10k units/yr
  Merged:   "Led a team of 4 through the LLC bring-up (97.2% peak efficiency);
             now in production at 10k units/yr."

  [merge (default) / keep mine / let me edit it]
```

Declining is remembered per-proposal, so you are not re-asked about the same fact on
every run. Note the asymmetry this creates deliberately: you can always decline, but
you are never *silently* denied a fact you logged.

#### The guarantee survives everything, including `--full`

`curate --full` rebuilds threads and gists from scratch, but it reads
`career-log-decisions.md` first and honors every ownership record. A full rebuild
can never resurrect a bullet you deleted or revert wording you set — that file is
User layer, is never rebuilt, gets a `.bak` on every write, and is always ported.
This is precisely why the index was split in two (§10).

#### What this replaces

Pins are gone as a separate concept — ownership subsumes them. A `fix --wording`
request and a hand edit now converge on the same ownership record, which means one
mechanism to reason about instead of two, and one fewer place for the two to
disagree.

**Cost:** one snapshot file per curated file (a few KB, never loaded into context),
one `diff` per run, and model attention only on actual changed hunks.
**Residual risk:** an edit that is simultaneously a fact change and a rewording needs
splitting — curate keeps your wording and proposes the `CORRECTION:` for the fact
half separately, rather than trying to do both in one move.

---

## 8. Per-mode impact (Q8)

Governing rule, added to `_shared.md`'s sources-of-truth table: **modes read curated
files; only `curate`/`fix` read the career log.** No exceptions. The career log is
Stage-1 raw material — letting evaluation or CV modes read it directly would
reintroduce the unbounded-read problem the index exists to prevent, and would let
uncurated (unverified, possibly superseded) facts leak into applications. An earlier
draft carved out one exception for proof-point depth; review correctly identified it
as the first leak that would justify others, and it has been removed — `stories.md`
serves that need from inside the curated layer.

| Mode | Change | Detail |
|---|---|---|
| `evaluate` | **Read-side swap + Block E re-point** | Still reads `cv.md` (now a build artifact — same content contract). `article-digest.md` references removed (§9). Block F stops appending to `story-bank.md` and proposes appends to `stories.md` instead (same P6 flow, new path). **Block E (Personalization Plan) now reads `stories.md` for proof-point depth, not `cv.md`** — cv.md is by design a compressed cut, and evaluations would get shallower if Block E only saw bullets. `stories.md` is where the depth already lives, in a curated file. *This replaces both article-digest's role and the career-log-anchor exception in the previous draft — no mode reads the career log. The rule is now absolute.* |
| `cv` (Stage 3) | **None functionally** | Reads `cv.md` exactly as today. Drops `article-digest.md` read (0d); gains the mtime staleness nudge (§4). |
| `linkedin` (drafted) | **Shrinks** | Becomes the Stage-3 consumer of `linkedin.md` — see §11. |
| `interview-prep` | **Path rename** | `story-bank.md` → `stories.md` everywhere (Step 5 mapping, `--bank-review`, debrief appends). No logic change. |
| `scan` | **None** | Doesn't read cv.md deeply; unaffected. |
| `recruiter` | **None** | Reads cv.md lazily for fit checks; the swap is invisible. |
| `batch` / `auto-pipeline` | **None** | Orchestrate evaluate/cv, inherit their changes. Workers read curated files — never the career log, never the index (avoids concurrent-write questions entirely; only `curate` writes the index, and `curate` is not a batch operation). |
| `deep` | **None** | Reads cv.md for the candidate angle; unaffected. |
| `setup` | **Rewired Step 1–2** | The pasted CV no longer becomes `cv.md` directly. It is written to `career-log.md` as the seed entry (`## 2026-08-21 — SEED: imported CV`, verbatim), then an inline first curation pass builds `cv.md` + index from it. Steps 2–10 (profile extraction, archetypes, calibration) then run against the curated `cv.md` unchanged. Net: setup gains one internal hop, the user experience is identical. |
| `port` | **Manifest additions + legacy path** | Port `career-log.md`, `data/career-log-decisions.md`, and the three curated files. `career-log-index.md` is derived — do NOT port it; it regenerates on first curate. Legacy instance (no career log): import old `cv.md` + `article-digest.md` + `story-bank.md` each as dated SEED entries in the new career log, port old cv.md as the initial curated file, and flag `curate --full` as the first post-port step. |
| **`curate` (NEW)** | New file `modes/curate.md` | Contains `curate`, `fix`, and `log`. One file, three verbs, because they share the index machinery and are meaningless apart. Estimated ~350 lines — mid-pack for this repo. |

---

## 8b. Cold start — how the career log gets its first content

The obvious move at setup is to stop asking for a CV and instead ask for "everything
about your career." **That is the wrong shape, and it will make setup worse.**

Two reasons. First, cold-start friction: a new user has their CV to hand and can paste
it in five seconds; asking them to compose their whole career in prose is an
open-ended writing assignment at the exact moment they have the least investment in
the tool. Most will paste the CV anyway, or abandon. Second, and more important, the
two inputs carry *different things*, and asking for one blurred blob gets neither
cleanly:

| Input | Gives you | Costs the user |
|---|---|---|
| The CV | **Breadth** — every role, employer, date, title, the full skeleton | Nothing. It already exists. |
| Plain-English telling | **Depth** — the metric that didn't fit, why it was hard, what they actually did, the story shape | Real effort, and only worth spending on things that matter |

So: **take breadth from the CV, take depth from targeted questions, and never ask for
both at once.** The CV is a lossy compression of a career; the fix is not to refuse it
but to selectively decompress the parts that will earn their keep.

### The three-part seeding flow

**1. Seed from the CV (unchanged friction, ~5 seconds).**
Setup Step 1 takes the pasted CV exactly as today, writes it verbatim to
`career-log.md` as a dated SEED entry, and curates it into `cv.md`. If the user stops
here, the system works — this path must never be blocked or nagged into.

**2. Bounded depth pass (optional, skippable, ~5 minutes).**
Immediately after, the system reads what it just curated, picks the **3–5 items most
likely to matter** — most recent role, the two or three bullets carrying the biggest
metrics, anything matching the user's archetype "what they buy" column — and asks
about them one at a time, in plain English:

> "Your CV says *'Designed 3kW LLC converter, 97.2% peak efficiency.'*
>  Tell me about that one like you'd tell a colleague — what was hard, what you
>  actually did, how it ended up. Two or three sentences is plenty.
>  (Or say **skip** for this one, or **skip all** to finish setup now.)"

Each answer is appended to `career-log.md` as its own entry and threaded to the same
thread as the CV bullet it expands. Skipping is free and never re-prompted during
setup. This is the step that turns a compressed CV line back into usable material —
and it fits the pattern setup already uses, where Golden Examples calibration stops
and waits three times (`modes/setup.md` Steps 8c–8e).

**3. Ongoing enrichment (the real mechanism, ~0 friction).**
A thread is "thin" when its only entries came from the SEED import — meaning nobody
ever told the story, only the CV line exists. This is **derived on the spot from the
entry log, not stored as a flag.** (An earlier draft tracked `fidelity: thin|told` as
state; review flagged it as state that would drift, and it is redundant — the entry
list already says everything the flag would.)

Thin threads are enriched opportunistically, in the moment the depth is actually
needed and the user is already thinking about that project:

- `interview-prep` maps a thin thread to a likely question → "I only have the CV line
  for this. Want to tell me the story properly? It'll go in your log."
- `cv` generation cuts a thin bullet for weak content → offers the same.

Critically, enrichment is offered **only for threads relevant to a live opportunity**
— never as a standing backlog. A ten-year-old role nobody is asking about is never
raised. Once a story is told, the thread has a non-SEED entry and stops reading as
thin, with no flag to clear.

**Why this is better than a big upfront dump:** it spends the user's effort only on
material the system has evidence someone will read, it spreads that effort across
months instead of front-loading it, and it asks at the moment of maximum context —
when they're preparing for an interview about that exact project, not during setup
when they just want the tool working. The career log still ends up rich; it just gets
there by accretion, which is the same premise the whole architecture rests on.

**Setup Step 1 rewrite (replaces the §8 `setup` row detail):**
paste CV → SEED entry → inline curate → **offer** the bounded depth pass → continue to
Step 2 (profile extraction) against the curated `cv.md`. The "describe your experience
instead" branch already in Step 1 stays, and becomes strictly better: that prose now
lands in the career log as a first-class entry rather than being flattened into a CV.

---

## 9. `article-digest.md` is absorbed — retired

Its role ("detailed project proof points behind the CV bullets") is exactly what
career log entries plus index anchors now provide, with provenance instead of a parallel
hand-maintained file. Keeping both would mean two places for the same depth and an
eternal sync question. Retirement plan: remove from `_shared.md` sources-of-truth
table, `evaluate` 0e, `cv` 0d, `AGENTS.md` file table, DATA_CONTRACT, port manifest
(replaced by career log import, §8). The evaluate Block E exception in §8 is the
functional replacement.

---

## 10. Data contract placement (Q9)

"Derived" and "User layer" are orthogonal: User layer means *the system must not
write it without explicit confirmation*, not *the user typed it*. All four new/changed
files are User layer; what differs is whether they're rebuildable.

| File | Layer | Rebuildable? | Rationale |
|---|---|---|---|
| `career-log.md` | **User — canonical** | No — it IS the truth | Written only by the user, plus `log`/`fix` appends behind `[y/N]` (documented as an exception, like `merge-tracker.mjs`). Ported always. |
| `cv.md`, `linkedin.md`, `stories.md` | **User — co-authored** (confirmed coherent in review: every system write is P6-confirmed, so the "never auto-updated" rule holds) | Partially — user-owned regions (§7b) are never regenerated | Generated content the user has approved, plus regions the user wrote or edited directly. Never auto-overwritten; every system write is P6-confirmed and skips owned regions. Always ported. |
| `data/career-log-index.md` | **System — derived** | Yes, fully (`curate --full`) | Threads, gists, entry log, watermark, generated-state hashes. No user decisions live here, so a rebuild costs nothing. Safe to delete; safe to gitignore. Not ported (regenerated on first curate). |
| `data/career-log-decisions.md` | **User — decisions** | **No** | Roles timeline (user-confirmed employment facts) and ownership records (§7b: what you edited, deleted, reordered, or authored). Unrecoverable if lost — nothing can reconstruct a deliberate deletion. `.bak` on every write; always ported. |
| `.curated/*.generated` | **System — ephemeral** | Yes (rewritten every curate) | Snapshots of what curate last generated, used only for diff-based edit detection. Gitignored, never ported, never read into context. |
| `article-digest.md` | removed from contract | — | §9 |
| `interview-prep/story-bank.md` | removed (renamed) | — | Becomes root `stories.md`; DATA_CONTRACT row carries over. |

DATA_CONTRACT.md also gains a short "Derivation map" note: career log → (curate) →
cv/linkedin/stories, so future contributors don't mistake the curated files for
independently editable sources.

---

## 11. Reconciliation with `plan_rs/linkedin-mode.md` (Q12)

The drafted linkedin mode was designed against a world where `cv.md` was the only
master. With a curated `linkedin.md` existing, the mode **shrinks and clarifies**
rather than being replaced:

- **Step 4 (rewrite)** now starts from `linkedin.md` — the material is already
  LinkedIn-shaped (first person, semantic-keyword-aware, About/Experience cuts).
  The mode's job reduces to *targeting*: reordering, keyword placement for the
  specific target role, headline variants. Its `--rewrite` sub-command (draft a
  whole profile from cv.md) becomes largely redundant — `curate` builds
  `linkedin.md`; `--rewrite` degrades to "run curate first, then target." Cut it.
- **Step 3 (keyword set)** — unchanged. Note the unfortunate name collision:
  that plan's "keyword set" is unrelated to `career-log.md`. Rename to "keyword set"
  in that plan when implementing.
- **`--audit` and `data/linkedin-profile.md`** — unchanged and still necessary.
  `linkedin.md` is the *intended* profile; the pasted capture is the *actual* one.
  The audit's job becomes a diff: actual vs. intended vs. target-role keywords.
  This is a cleaner three-way framing than the draft had.
- **Verification traceability** — the draft's "every claim traces to cv.md" becomes
  "traces to `linkedin.md`, which traces to the career log via the index" — strictly
  stronger provenance.
- The draft's routing (`linkedin` trigger, `/in/` URL disambiguation, GEMINI.md
  mandate carve-out) is untouched by this architecture.

Sequencing recommendation: **implement this architecture first**, then the linkedin
mode against the settled world — otherwise the linkedin mode ships reading cv.md and
gets rewired weeks later. The linkedin plan's §6b review resolutions all survive.

---

## 12. Token budget (Q10)

| Operation | Cost | Notes |
|---|---|---|
| Dumping to career log | **0** | User edits the file directly. `log` via chat costs one confirm exchange. |
| Sessions that never curate | **~30 tokens** | One routing row per routing surface. All career log knowledge lives in `modes/curate.md`, lazy-loaded — same discipline as every other mode. |
| Staleness nudge | **~0** | mtime comparison, one printed line. |
| `curate` (incremental) | mode file (~4k) + delta (0.1–0.4k) + index (≈15/entry; 3k at 200 entries) + decisions file (~0.3k) + touched bullets (0.2–0.6k) | Independent of career log size. This is the payoff of the index. Curated files are read as bounded extracts at the `outputs:` anchors — never whole-file, which matters most for `stories.md`, the largest sibling. |
| `curate --full` | mode file + whole career log + whole index | Bounded by constraint 5; a full career log ≈ 5–15k tokens. Run rarely, deliberately. |
| `fix` | index lookup + affected thread entries + affected bullets | Bounded by anchors; no scans. |
| Stage 3 modes | **unchanged** | They read the same-sized curated files they read today. |
| Evaluate proof-point exception | + the specific anchored entries only | Replaces reading all of article-digest.md — usually cheaper than today. |

---

## 13. Command surface (Q11)

Three verbs, one new mode file, and that is the whole surface:

| Command | Does |
|---|---|
| `log <text>` | Append a dated entry to `career-log.md` (drafted, shown, `[y/N]`). Convenience only — editing the file directly is equally supported and costs no tokens. |
| `curate` | Incremental pass (§6). Flags: `--full` (rebuild threads + index from whole career log), `--cv` / `--linkedin` / `--stories` (limit which siblings are updated), `--yes`. |
| `fix <description>` | Correction flow (§7). Also reachable conversationally — "that number is wrong" routes here. |

Routing additions (one row each; exact text at implementation):
- **AGENTS.md** Mode Routing: `log` / `curate` / `fix` → read `modes/curate.md`. Plus
  Main Files rows for `career-log.md`, `data/career-log-index.md`, `stories.md`; retire
  `article-digest.md` and `story-bank.md` rows.
- **GEMINI.md** routing table: same one row. No CRITICAL-MANDATE interaction — none
  of these verbs collide with URL/JD detection.
- **SKILL.md**: routing rows + three discovery-menu lines
  (`log` — "jot down a win while it's fresh"; `curate` — "fold recent wins into your
  CV, LinkedIn, and story bank"; `fix` — "correct anything that's wrong in your
  curated files").

Rejected: a `career log` umbrella command with sub-flags (worse discoverability for a
daily-use verb like `log`), and separate mode files per verb (they share all their
machinery).

---

## 14. Implementation phases with verification

Per CLAUDE.md: every step lists how it is verified before moving on.

| # | Phase | Verification gate |
|---|---|---|
| 1 | **Scaffold**: create `career-log.md` (header comment explaining the contract + one example entry), empty-state `data/career-log-index.md`, rename `story-bank.md` → `stories.md` | Files exist; `grep -rn "story-bank" modes/ AGENTS.md` returns only lines slated for Phase 5's rewiring list (inventory captured now) |
| 2 | **`modes/curate.md`** — curate + fix + log per §5–§7 | CLI-agnosticism: `grep -iE "WebFetch|WebSearch|Read tool|Bash tool" modes/curate.md` empty. Dry test: seed career log with 2 same-thread entries dated months apart → `curate` produces ONE merged bullet per sibling file, index has one thread with both entries. Decline test: answer N → all four files (3 siblings + index) unchanged, entries still pending next run |
| 3 | **Thread-linking hard cases** | (a) Vague follow-up entry ("that project shipped") → curator ASKS rather than opening a new thread. (b) `CORRECTION:` entry → old entry marked superseded, bullets regenerate with new fact. (c) Delete the index → `curate --full` rebuilds it; diff shows threads/gists rebuilt identically and nothing user-owned lost. (d) Backdated entry naming a prior employer → curator ASKS for the role instead of stamping today's. (e) "started at NewCo" entry → role-boundary confirm fires, prior role gets an end date, new role becomes CURRENT, subsequent entries attribute to it. (f) Thread spanning a role boundary → cv.md and linkedin.md produce one bullet per employer, stories.md keeps a single story |
| 3b | **Edit ownership (§7b) — the load-bearing test** | Nine cases, each followed by TWO further `curate` runs to prove permanence, not just first-run correctness: (i) reword a bullet → kept verbatim, marked owned; (ii) change a number → kept, and a career-log CORRECTION proposed so linkedin.md/stories.md get the fact; (iii) **delete a bullet → never regenerated**; (iv) reorder bullets → order preserved; (v) write a brand-new bullet with no thread → gets a `user-*` ID assigned, preserved, offered once to back into the log, never re-asked after declining; (vi) new log entry adds a FACT to an owned bullet → defaults to **merge**; a rewording-only proposal against an owned bullet → defaults to **keep mine**; (vii) **merge two bullets into one** → new block marked authored, both original IDs suppressed, neither regenerates; (viii) **insert a bullet above an owned one** → ownership still protects the correct bullet (the anchor-stability regression test); (ix) duplicate a bullet by copy-paste → first keeps ownership, copy gets a fresh ID. |
| 3d | **Failure-mode tests (§7b)** | (a) Edit cv.md between the diff and the `[y]` → write ABORTS with an explanation, nothing overwritten. (b) Delete `.curated/` → next curate treats the whole file as user-owned and writes nothing over it. (c) Run curate on a cv.md it has never written → same safe fallback. |
| 3c | **Decisions/index split + `--full` safety** | Delete `career-log-index.md` entirely → `curate --full` rebuilds it, `career-log-decisions.md` untouched, every role and ownership record intact. Then re-run `--full` with a deleted bullet on record → it stays deleted. A full rebuild must never resurrect suppressed content or revert owned wording. |
| 4 | **`fix` classification fork** | Three scripted cases: wrong-in-career log → correction entry drafted + appended + bullets regenerated; wrong-in-curation-only → NO career log write, bullets regenerated; style-only → ownership record written, career log untouched. Each case: verify the system STATED its classification before acting |
| 5 | **Rewire read-side** — evaluate (Block F target, drop article-digest, Block E anchor exception), cv 0d, interview-prep paths, `_shared.md` sources table, staleness nudge | `grep -rn "article-digest" modes/ AGENTS.md GEMINI.md` empty. Run one full `evaluate` on a test JD → report generates, stories propose-append to `stories.md`, no career log read appears in the transcript |
| 6 | **setup + port rewiring** (§8 rows, §8b seeding flow) | Fresh-instance walkthrough: paste a CV at setup → lands in career log as SEED → curated cv.md built → setup Steps 2+ proceed against it. **Depth-pass tests:** "skip all" exits immediately to Step 2 and is never re-prompted; answering 2 of 4 writes exactly 2 new entries, threaded to the matching CV bullets, and flips those threads to `fidelity: told` while the rest stay `thin`. Port dry-run: legacy fixture (cv.md + article-digest.md + story-bank.md, no career log) → all three arrive as SEED entries, `curate --full` flagged as next step |
| 7 | **Routing + contracts**: AGENTS.md, GEMINI.md, SKILL.md rows; DATA_CONTRACT.md per §10; port-manifest | Paste-URL smoke test still routes to evaluate (no routing regression); `log`/`curate`/`fix` each route to `modes/curate.md`; DATA_CONTRACT lists all four files with the §10 layer labels |
| 8 | **Token audit** | Session that never curates: context delta vs. pre-change baseline ≤ 50 tokens. Incremental `curate` on a 20-entry fixture career log: verify via transcript that career log reads = delta only |
| 9 | **CONSOLIDATION-PLAN.md + README** update, same commit | Version bumped, `Last Updated` current, career log architecture in the roadmap; README file-table matches reality |

Sequencing note: Phases 1–4 are self-contained (nothing else reads the new files
yet), so the riskiest machinery is proven before any existing mode is touched.
`plan_rs/linkedin-mode.md` implementation follows Phase 9 (§11).

---

## 14b. Gemini Review — Resolutions (2026-08-22)

Findings investigated per the CLAUDE.md Gemini Review Protocol.

| # | Finding | Verdict | Action |
|---|---|---|---|
| 1 | `[pin]` is too heavy for typo fixes; models won't honor pins; detect manual edits and absorb them instead | **Accepted — best finding in the review** | New §7b. **The user has since gone further and made hand-editing a first-class supported workflow, so §7b was rewritten around per-region ownership rather than pins.** Diff-against-snapshot detects edits; the touched region becomes user-owned and is never rewritten. This covers what pins could not: deletions that must not come back, user-set ordering, and bullets the user writes from scratch. |
| 2 | Gist lookup will merge unrelated threads; must prompt when ambiguous | **Partly accepted** | The "must prompt" fix was already the design (§5.3, §6, §15 Q4) — rejected as new. But the Postgres tune-then-migrate example exposed a real gap: the model was binary (extends / new) and had no way to express *supersedes*. New §5.2b adds four relation kinds and requires explicit classification. |
| 3 | Index mixes User pins with derived data; a rebuild destroys pins | **Accepted, renamed** | The literal claim was wrong — §10 already made the whole index User layer precisely so rebuilds preserve pins. But the underlying smell is real: one file, two lifecycles, and any partial-rebuild bug eats unrecoverable data. Split into derived `career-log-index.md` (System, freely rebuilt, not ported) and `career-log-decisions.md` (User: roles + ownership records, never rebuilt, always ported). This split became load-bearing once hand-editing was made first-class — it is what guarantees `--full` cannot undo a user edit. Rejected the proposed JSON format — every other state file here is human-inspectable markdown. Rejected `curate-overrides.yml` as a name: roles are core career facts, not overrides. |
| 4 | Block E will get shallower reading only cv.md; re-point it at stories.md | **Accepted — and it removed a leak** | Better than the previous draft, which let Block E follow index anchors into the raw career log. That exception was the one place the "no mode reads the log" rule bent. `stories.md` supplies the same depth from inside the curated layer, so the rule is now absolute. |
| 5 | `fidelity: thin/told` is state that will drift; cut it | **Partly accepted** | Cut the stored flag — it is redundant, since a thread whose only entries are SEED imports is thin by inspection. Kept the enrichment behavior, and tightened it per the reviewer's second point: enrichment is offered only for threads tied to a live opportunity, never as a standing backlog, so nobody gets interrogated about a ten-year-old job. |
| 6 | The model will mis-route corrections; make the user specify intent | **Partly accepted** | Rejected mandatory manual routing — "the user never decides which file to edit" is the point of §7, and the (a)/(b) split is a *mechanical* check (read the source entry, compare values), not a judgment call. Made that explicit. Added `log` and `fix --wording` as escape hatches for users who prefer to route it themselves. §7b also shrinks this surface: most corrections now arrive as detected file edits, which carry their own evidence. |
| 7 | Pass only relevant sections when updating stories.md | **Accepted** | Already the intent via `outputs:` anchors; now stated explicitly in the §12 budget row, since `stories.md` is the largest sibling and the most likely to be read whole by accident. |
| 8 | Cut backdated role prompting; keep the timeline append-only | **Split** | Accepted for role *boundaries* — no retroactive wizard; a `[BACKDATED 2021-05]` log entry is enough, now stated in §5b. Rejected for *entries*: a backdated entry attributed to the wrong employer produces a factually wrong CV that is very hard to catch later. That ask stays. The reviewer conflated two different backdating problems. |

---

## 14c. Gemini Review Round 2 — Resolutions (2026-08-22)

Reviewed against the ownership rewrite. This round was accepted almost in full; the
two refusals are refinements, not rejections.

| # | Finding | Verdict | Action |
|---|---|---|---|
| 1 | Positional/hash anchors break; inject stable IDs into the files | **Accepted — the load-bearing fix** | §7b now specifies HTML-comment IDs (`<!-- id:T03 -->`) written into the curated files, using thread IDs for generated content and `user-*` IDs for user-authored blocks. Added the two consequences the finding implied but did not state: un-IDed content is a positive "human wrote this" signal, and duplicate IDs from copy-paste need explicit handling. Confirmed IDs cannot reach a PDF — `modes/cv.md` composes placeholders rather than passing `cv.md` through, and `generate-pdf.mjs` has a leak gate. |
| 2 | Write race between diff and confirm | **Accepted** | Re-stat after `[y]`, abort on mtime change. Aborting is always safe; overwriting never is. Phase 3d test (a). |
| 3 | "Keep mine" default rots the CV | **Accepted, refined** | Correct diagnosis. Rather than defaulting to merge universally, the default now follows the §7b principle already in the design — log owns facts, user owns presentation: a proposal carrying a **new fact** defaults to merge; a **rewording-only** proposal defaults to keep mine. You can always decline, but you are never *silently* denied a fact you logged. |
| 4 | Merge/split bullets missing from tests | **Accepted** | It was missing from the design, not just the tests. §7b now has an explicit rule (hunk spanning multiple IDs → new block authored, originals suppressed) and Phase 3b case (vii). |
| 5 | Four relations is too many; cut `pivot` | **Accepted** | `pivot` was distinguished from `new` only by a cross-reference, which does not earn a category that gets misclassified. Down to three: extends / supersedes / new. The distinction that matters is only "does this add to the earlier claim, or undercut it?" |
| 6 | `curate --release` is dead scope | **Accepted** | Cut. Releasing a bullet means deleting its row in `career-log-decisions.md` — which is exactly why that file is human-readable markdown and not JSON. An interactive picker is the answer if this turns out to be common; a flag taking an ID the user would have to look up is not. |
| 7 | Cross-employer splits will misattribute metrics | **Accepted** | Added a hard check to §5b: every metric in a role's bullet must trace to an entry attributed to *that* role; unattributable metrics are dropped, not guessed. Framed as what it is — claiming someone else's result, and the kind of error that surfaces in an interview. |
| 8 | Missing snapshot fallback | **Accepted** | Fail toward preservation: treat the entire live file as user-owned, write nothing, offer `--full` as proposal-only. Never treat a missing snapshot as "unmodified." Phase 3d tests (b) and (c). |
| 9 | Sibling divergence is fine; one line confirming | **Accepted** | §15.6 now records that no current consumer cross-reads, so divergence breaks nothing today, and that the exposure is to future features only. |
| 10 | "User — co-authored" is coherent under P6 | **Accepted** | Noted inline in the §10 table. |

---

## 15. Open questions

1. ~~Naming.~~ **RESOLVED 2026-08-21: `career-log.md`** (chosen over `corpus.md`).
   The index follows suit as `data/career-log-index.md`. Applied throughout this
   document.
2. **Should evaluate's Block F write stories into the career log instead of
   `stories.md`?** Argument for: interview stories are career material. Argument
   against (stronger): Block F stories are *derived* from career log facts + a JD —
   putting derived material into the canonical source creates a cycle and pollutes
   the log with system output. *Recommendation: no. Career log is human-authored only.*
3. ~~Constraint 2 (cv.md not hand-editable).~~ **RESOLVED 2026-08-22: reversed by
   the user — curated files are hand-editable and edits are permanent.** §7b is
   rewritten around per-region ownership. The remaining open sub-question is
   **ownership granularity**: anchoring at the bullet is right for `cv.md` and
   `linkedin.md`, but `stories.md` entries are multi-paragraph STAR blocks where a
   one-sentence edit probably should not freeze the whole story against future
   updates. *Recommendation: bullet-level for cv/linkedin, section-level for
   stories.* Worth confirming during Phase 3b testing rather than deciding now.
   **Releasing ownership** needs no command: `career-log-decisions.md` is
   human-readable markdown, so handing a bullet back to the system means deleting
   its row. An earlier draft proposed `curate --release <anchor>`; review correctly
   called it dead scope — nobody types an anchor ID they would have to look up in
   the very file they could just edit. If releasing turns out to be common, the
   answer is an interactive picker, not a flag.

6. **Divergence between siblings is now possible by design.** If the user edits a CV
   bullet's wording but not the matching `linkedin.md` bullet, the two drift. That
   is correct — they are different documents with different voices — but it means
   "the three files always say the same thing" is no longer true, and any future
   feature that assumes parity will break. *Recommendation: accept the drift, and
   have `curate` report it as information ("3 bullets differ between cv.md and
   linkedin.md") rather than trying to reconcile it.* **Confirmed in review:** no
   current consumer cross-reads — `evaluate`/`cv` read `cv.md`, `linkedin` reads
   `linkedin.md`, `interview-prep` reads `stories.md` — so divergence causes no
   technical break today. The risk is only to future features; this note is the
   record that it was a deliberate choice.
4. **Multi-user question none of the constraints raised:** `curate` quality depends
   on the model asking good thread-assignment questions. Weaker models (this system
   also targets Gemini CLI and Copilot) may guess instead of asking. Mitigation
   already in the design — the ask-when-uncertain rule is a MUST in `curate.md` —
   but *recommendation:* add a "threads touched" line to every curate summary so a
   silent wrong guess is at least visible.
5. **Comp/identity drift.** Role changes and promotions are now first-class in the
   index (§5b), but they ALSO touch `config/profile.yml` (current title, seniority)
   and potentially `modes/_profile.md` (archetypes, if the move changes domain) —
   files curation deliberately does not write.
   *Recommendation:* on a confirmed role-boundary event, curate prints a one-line
   pointer ("R4 opened — this also affects config/profile.yml → run setup's
   incremental update") rather than gaining write access to config. Keeps the write
   graph simple and one-directional. Open sub-question: whether that pointer is
   enough, or whether a stale profile.yml after a job change is severe enough
   (it feeds comp targets and level gating in every evaluation) to justify a
   blocking prompt. *Leaning: pointer now, revisit if it gets missed in practice.*

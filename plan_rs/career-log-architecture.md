# Career-Log-and-Fan-Out Architecture

| | |
|---|---|
| **Status** | DESIGN v2 — simplified after three review rounds. No system files modified. |
| **Version** | 2.0 |
| **Last Updated** | 2026-08-22 — rewritten from v1 (977 lines) after a cold architectural review |
| **Supersedes** | `plan_rs/archive/career-log-architecture-v1-superseded.md`, `article-digest.md` (retired — §10) |
| **Related** | `plan_rs/linkedin-mode.md` — implement AFTER this (§9, §15) |

> **Why v2 exists.** v1 designed an incremental-curation engine: a thread index, entry
> IDs, gists, embedded anchor comments, generated-state snapshots, and an ownership
> ledger. A cold review established that (a) the whole apparatus existed to avoid
> re-reading a file smaller than the mode instructions for reading it, and (b) it
> specified a state machine in prose for an LLM to execute, on durable files where a
> skipped step is silent corruption — a mistake this repo already made once and fixed
> with `resolve-template.mjs`. v2 keeps the premise and deletes the machinery. §15
> records what was cut and why, so nobody re-proposes it.

---

## 1. The architecture in one paragraph

You stop maintaining a CV and start keeping a **career log**: one append-only
plain-English file where you dump milestones the moment they happen, with zero
structure and zero confirmation. A `curate` mode reads the whole log, compares it to
your curated files, and **proposes minimal diffs** — it never regenerates a file from
scratch, so anything you have edited by hand survives by construction rather than by
bookkeeping. Two curated files exist today: `cv.md` (master CV) and `stories.md`
(STAR+R interview stories), the same material cut two ways. Every existing mode reads
them exactly as it reads `cv.md` today. When a job target appears, the existing `cv`
and `interview-prep` modes tailor from them into `output/`. Corrections go through
`fix`, which routes a wrong metric back to the log and a wording preference to your
CV rules — you never decide which file to edit.

---

## 2. Target file tree

```
career-scout/
├── career-log.md              ← STAGE 1. Canonical. Append-only. The only source of truth.
├── cv.md                      ← STAGE 2. Curated master CV. Yours to edit freely.
├── stories.md                 ← STAGE 2. Curated STAR+R stories. Replaces story-bank.md.
├── data/
│   └── curate-state.md        ← Watermarks, suppressions, declined proposals. ~20 lines.
├── modes/
│   └── curate.md              ← NEW. ~200 lines. log + curate + fix.
├── scripts/
│   └── curate-state.mjs       ← NEW. Backup, watermark advance, dated append. Invariants in code.
└── output/                    ← STAGE 3. Disposable per-target artifacts. Unchanged.
```

One mode file, one script, one log, one small state file. Two retirements
(`article-digest.md`, `interview-prep/story-bank.md`). **No `linkedin.md` yet** — it
arrives with `modes/linkedin.md`, generated retroactively from the log (§9).

---

## 3. Career log format

Append in any editor, or say `log <text>`. The only convention is a date heading, and
the curator will infer or ask if it's missing.

```markdown
## 2026-02-12
Got the 3kW LLC prototype to 97.2% peak efficiency. First board spin,
planar transformer. Team of 2, I did the magnetics and loop comp.

## 2026-08-14
That LLC design went into production this month — 10k units/yr. Also
presented it at APEC, got good questions about the synchronous rectification.
```

No IDs, no tags, no employer labels, no templates. Sloppy grammar is fine. Noticing
that the August entry continues the February one is the curator's job (§5).

**Corrections are entries too.** A dated entry beginning `CORRECTION:` supersedes
earlier facts. The file stays append-only even when the past was wrong.

**What does not go here:** contact details, comp targets, archetypes, writing style.
Those stay in `config/profile.yml` and `modes/_profile.md`, which already have owners
and consumers. Mixing them in would break the existing contact-audit pipeline
(`modes/cv.md` 0d, `audit-contact.mjs`).

---

## 4. Data flow and triggers

```
        you append (editor, or `log` — no confirmation, see below)
                              │
                              ▼
  STAGE 1   ─────────── career-log.md ───────────   canonical, append-only
                              │
                    `curate`  │  reads the WHOLE log + the live curated files,
                   (you type) │  proposes minimal diffs. Never regenerates.
                              ▼
  STAGE 2          cv.md          stories.md          data/curate-state.md
                   (each write = [y/N] + .bak, per file, independent)
                              │
                    existing mode commands, per job target
                              ▼
  STAGE 3      modes/cv.md    modes/interview-prep.md
               output/*       interview-prep/*
```

| Hop | Trigger |
|---|---|
| you → log | You, whenever something happens. `log` appends **without confirmation** — see below. |
| log → curated | You type `curate`. Never automatic. |
| curated → per-target | Existing `cv` / `interview-prep` commands, unchanged. |

**`log` is deliberately confirmation-free.** P6 exists to protect against destructive
writes; an append to an append-only file cannot destroy anything. Gating the one verb
whose entire value is "jot it down before you forget" teaches you that jotting has a
toll, and you stop jotting — which starves the whole architecture. `log` echoes what
it appended and tells you how to undo it. That is enough.

**Staleness nudge.** Any mode reading a curated file compares mtimes; if
`career-log.md` is newer, it prints one line — `"ℹ career-log.md has entries newer
than cv.md. Run curate first? [y/n]"` — and proceeds with the current file if
declined. A file-stat check, ~0 tokens.

---

## 5. How curation works

### 5.1 Read the whole log. Every time.

`curate` reads `career-log.md` in full, plus the live `cv.md` and `stories.md`, and
proposes diffs. There is no incremental-processing machinery, and this is a deliberate
inversion of v1.

The arithmetic: a whole career of plain-English milestones is **5–15k tokens**
(§12). `modes/cv.md` alone is 1,174 lines. v1 built an index, entry IDs, gists, and a
watermark protocol to avoid re-reading a file substantially cheaper than the
instructions for reading it.

Reading everything also **solves the cross-time linking problem outright** rather than
working around it. The original hard case — an entry in February and its continuation
in August must become one CV bullet — is trivial when February's actual text is in
context in August. v1's index tried to substitute a one-line gist for that text, which
introduced its own worst failure modes: missed links from stale gists, gist quality
decay, and index/log drift. All three vanish.

**The watermark that remains** is a per-file hint, not a correctness mechanism:

```markdown
## Watermarks
- cv.md: proposed through 2026-08-14
- stories.md: proposed through 2026-02-12
```

It tells curate what to *lead with*, not what it is allowed to read. Per-file, because
you can accept a `cv.md` proposal and decline a `stories.md` one in the same run —
each advances independently. (v1 had a single shared watermark plus per-file confirms,
which made partial acceptance undefined: either the declined file silently never got
the fact, or the accepted one was re-proposed forever. No review round caught it.)

### 5.2 Never regenerate — only propose

**The rule that makes hand-editing safe: curate never rewrites a curated file from
scratch. It reads the file as you last left it and proposes the smallest change that
folds in new material.**

This is the whole of the edit-permanence guarantee. Your edits survive because nothing
ever overwrites them, not because a detection chain noticed them. v1 preserved edits
via snapshot → diff → anchor → ownership ledger → honor-on-write; any link failing
lost your work, and one link (comment-based anchors) had a catastrophic mode where
tidying the "weird comments" out of your CV read as mass suppression.

Consequences worth stating in `curate.md` explicitly:

- If you reworded a bullet, the proposal builds on **your** wording, not the original.
- If you reordered bullets, order is whatever the file says. Nothing to preserve.
- If you wrote a bullet by hand with no log entry behind it, it is simply text in the
  file. Curate leaves it alone and may offer once to back it into the log.
- If you merged or split bullets, curate sees the result and works from it.
- The **only** intent that cannot be recovered by reading the file is deletion — you
  removed a bullet and it must not come back. That needs the one piece of persisted
  state in §5.3.

### 5.3 The state file

`data/curate-state.md` — small, human-readable, and the only thing whose loss costs
you something:

```markdown
# Curate state — written by curate mode. Human-readable on purpose: edit or delete
# any line to change curate's behavior.

## Watermarks
- cv.md: proposed through 2026-08-14
- stories.md: proposed through 2026-02-12

## Suppressed — do not propose these again
- Acme thermal redesign (deleted from cv.md 2026-08-22)

## Declined — offered and turned down; don't re-ask
- stories.md: APEC talk as a standalone story (declined 2026-08-22)
```

Suppressions are matched **by topic in plain language**, not by ID. Honest about the
tradeoff: this is fuzzy matching, so curate may occasionally re-propose something you
killed. That failure is visible and one keystroke to decline again. v1's alternative
failed the other way — silently freezing regions of your CV against all future
updates, invisibly. Prefer the annoying failure to the corrupting one.

Releasing something: delete its line. That is why this file is readable markdown and
why there is no `--release` command.

### 5.4 Relating entries: guidance, not stored state

When a new entry touches work an existing bullet already covers, the distinction that
matters is only:

- **extends** — adds facts to the earlier claim → fold into one strengthened bullet
- **supersedes** — replaced or reversed the earlier approach → never silently merge;
  two bullets, or one that states the arc honestly
- otherwise it is simply new

The motivating case: *"Optimized Postgres queries"* in March and *"Migrated off
Postgres"* in September share heavy vocabulary but are not one accomplishment. A
curator matching on similarity alone merges them into a bullet that reads as
continuous progress and is, in substance, false.

This lives in `curate.md` as instruction. It is **not** persisted as a relation field
on a thread record — v1 stored it, which meant a misclassification became permanent
data rather than a one-off proposal you could decline.

---

## 5b. Role attribution

CV bullets sit under employer headings, so every entry needs an employer — but you
never tag one.

**The CV is the role timeline.** `cv.md`'s Work Experience section already carries
company, title, and date ranges for your whole career. That is the authoritative
record, it is human-visible, and you can correct it by editing the file. v1 kept a
second copy in a decisions file; two copies of employment history with no adjudication
rule is a failure mode, not a feature.

Attribution rules for `curate.md`:

1. **By date, silently.** An entry dated 2026-08-14 falls inside the current role's
   range → it belongs there. Correct in the overwhelmingly common case.
2. **Ask when content contradicts the date.** If an entry names a prior employer,
   product, or teammate, or uses past framing ("back when I…"), do not trust the date:
   *"Which role was this under? I'd guess Acme Power (2016–2019). [y / pick another]"*
   This is the most valuable ask in the design — a backdated entry filed under the
   wrong employer produces a factually wrong CV that is very hard to catch later.
3. **Role changes are entries.** "Started at Volt Systems as Principal this week" is a
   boundary event. Curate confirms, adds the new role heading to `cv.md`, closes the
   previous one, and points at `config/profile.yml` (§9). No retroactive wizard: a
   forgotten promotion from three years ago is handled by a normal
   `[BACKDATED 2021-05] Promoted to Senior` entry.
4. **Not everything has an employer.** Talks, patents, open-source, side projects and
   certifications land in Projects / Publications / Certifications rather than Work
   Experience. A talk *about employer work* belongs to that employer, because the
   underlying work did.
5. **Work spanning a job change** produces one bullet under each employer in `cv.md`
   (a bullet cannot straddle two companies) but stays a single story in `stories.md`,
   because an interview answer follows the work, not the org chart.

**Metric attribution is a hard check, not a stylistic note.** When splitting work
across employers, every metric in a role's bullet must trace to an entry attributed to
*that* role. A metric that cannot be attributed to the role it appears under is
dropped, not guessed. This is the CV equivalent of claiming someone else's result, and
it surfaces in interviews.

---

## 6. The curate pass

1. `scripts/curate-state.mjs read` → watermarks, suppressions, declined proposals.
2. Read `career-log.md` in full. Read the live `cv.md` and `stories.md`.
3. If nothing is newer than both watermarks, report "nothing new" and stop.
4. Attribute new entries to roles (§5b), asking where the date is not trustworthy.
5. For each new entry, decide what it changes in each curated file: extend an existing
   bullet, add a new one, or nothing. Honor the suppression and declined lists. Build
   proposals **against the live file's current text**, never against a remembered
   earlier version.
6. Present one diff per file, confirmed separately:

   ```
   cv.md — 1 bullet strengthened (T: LLC converter)
     - "Designed 3kW LLC prototype reaching 97.2% peak efficiency…"
     + "Designed 3kW LLC converter (97.2% peak efficiency) and took it to
        production at 10k units/yr; presented the SR scheme at APEC 2026."
   Apply to cv.md? [y/N]
   ```

7. Per file: on accept, `curate-state.mjs write` performs `.bak` → write → advance
   that file's watermark, as one operation. On decline, record it under `## Declined`
   and leave that file's watermark where it was.
8. Report what happened in one block, including any role changes and any
   `config/profile.yml` mismatch (§9).

**Why the mechanical steps are a script.** Backup-before-write, watermark advance,
dated append, and state-file parsing are invariants. This repo already learned that
invariants in prose fail — `modes/cv.md:243` records that hand-editing template fences
"is what historically leaked `{{#if CERTIFICATIONS}}` into shipped PDFs," which is why
`resolve-template.mjs` exists and runs twice. `check-history.mjs`, `merge-tracker.mjs`
and `verify-pipeline.mjs` are the same lesson. `curate-state.mjs` follows the pattern:
the model decides *what* to write, the script guarantees *how*.

---

## 7. Corrections — the `fix` flow

You spot something wrong in `cv.md`. You can just fix it in the file — nothing will
overwrite it (§5.2). But if the error is *factual*, editing only `cv.md` leaves the
log still wrong, so the fix will not reach `stories.md` or any future CV. That is what
`fix` is for.

Type `fix <description>`, or just say it ("the efficiency number is wrong, it's 97.2
not 97.8"). Curate locates the text, reads the relevant log entries, and classifies:

**(a) The log itself is wrong.** Draft a `CORRECTION:` entry, show it, append on
`[y/N]`, then propose the corrected bullets in both curated files. One sentence from
you → truth fixed at the source → every cut corrected.

**(b) The log was right; curation garbled it.** No log write. Propose corrected
bullets only.

**(c) Wording or style, no fact involved.** Must not go in the log, or the log becomes
a config file. Generalizable rule ("never say 'spearheaded'") → propose appending to
CV Generation Rules in `modes/_profile.md`. One-off preference → just change the
wording in the file; §5.2 means it stays.

(a) and (b) are separated by a **mechanical comparison** — read the source entry, see
whether it says 97.8 or 97.2 — not by judgment. `curate.md` requires stating the
classification aloud before acting ("The log itself says 97.8 — correcting at the
source"), which makes a wrong route visible rather than silent.

Escape hatches for anyone who would rather route it themselves: `log "<text>"` always
appends without classification, and `fix --wording` forces case (c).

---

## 8. Cold start — seeding the log

Asking a new user to write their whole career in prose is an open-ended writing
assignment at the moment they are least invested. Most would paste their CV anyway.
And the two inputs carry different things:

| Input | Gives | Costs you |
|---|---|---|
| Your CV | **Breadth** — every role, date, title | Nothing; it exists |
| Telling the story | **Depth** — the metric that didn't fit, why it was hard | Real effort |

So: **breadth from the CV, depth from targeted questions, never both at once.**

**1. Seed from the CV.** Setup Step 1 takes the pasted CV as today, writes it verbatim
to `career-log.md` as a dated SEED entry, and curates it into `cv.md`. If you stop
here, the system works. This path is never blocked.

**2. Bounded depth pass — optional, skippable.** Immediately after, the system picks
the 3–5 items most likely to matter (most recent role, biggest metrics, archetype
matches) and asks one at a time:

> "Your CV says *'Designed 3kW LLC converter, 97.2% peak efficiency.'* Tell me about
>  that one like you'd tell a colleague — what was hard, what you actually did.
>  Two or three sentences is plenty. (**skip**, or **skip all** to finish setup.)"

Each answer is appended as its own entry. Skipping is free and never re-prompted. This
matches a pattern setup already uses — Golden Examples calibration stops and waits
three times (`modes/setup.md` 8c–8e).

**3. Ongoing enrichment.** A thread whose only source is the SEED import has never
been told properly. That is derived by looking at the log, not tracked as a flag.
Enrichment is offered **only against a live opportunity** — `interview-prep` hits a
thin area while mapping a likely question, or `cv` cuts a thin bullet for weak content
— never as a standing backlog. Nobody gets interrogated about a ten-year-old job.

---

## 9. Per-mode impact

**Governing rule** for `_shared.md`'s sources-of-truth table: *modes read curated
files; only `curate` and `fix` read the career log.* No exceptions.

| Mode | Change |
|---|---|
| `evaluate` | Reads `cv.md` as today (same content contract). Drop `article-digest.md`. Block F proposes appends to `stories.md` instead of `story-bank.md`. **Block E reads `stories.md` for proof-point depth** — `cv.md` is a compressed cut, and evaluations get shallower if Block E only sees bullets. **New:** hard-compare `config/profile.yml`'s current role against `cv.md`'s current heading; on mismatch, say so before scoring rather than quietly using stale comp targets and level gating. |
| `cv` (Stage 3) | Functionally unchanged. Drops the `article-digest.md` read (0d); gains the staleness nudge. |
| `interview-prep` | Path rename `story-bank.md` → `stories.md` (Step 5 mapping, `--bank-review`, debrief appends). No logic change. |
| `setup` | Step 1 rewired per §8: pasted CV → SEED entry → inline curate → offer the depth pass → Steps 2+ proceed against the curated `cv.md`. |
| `port` | Port `career-log.md`, `cv.md`, `stories.md`, `data/curate-state.md`. Legacy instance: import old `cv.md` + `article-digest.md` + `story-bank.md` as dated SEED entries. |
| `scan`, `recruiter`, `deep`, `batch`, `auto-pipeline` | No change. |
| `linkedin` (planned) | Ships later per `plan_rs/linkedin-mode.md`. When it does, `curate` gains `linkedin.md` as a third sibling — generated retroactively from the log, so deferring costs nothing. That plan's `--rewrite` sub-command becomes redundant and should be cut; its `--audit` (comparing your live LinkedIn against the intended one) stays and gets better. |
| **`curate` (NEW)** | `modes/curate.md`, ~200 lines: `log`, `curate`, `fix`. One file — the three verbs share all their machinery and are meaningless apart. |

---

## 10. `article-digest.md` is retired

Its role — "the detail that didn't fit the CV" — is what the career log now holds,
with the log as canonical instead of a second hand-maintained file that silently
drifts from `cv.md`. Depth that used to live there is served by `stories.md` (Block E,
above) and by the log itself for `curate`/`fix`. Remove from `_shared.md`,
`evaluate` 0e, `cv` 0d, `AGENTS.md`, DATA_CONTRACT, and the port manifest.

---

## 11. Data contract

| File | Layer | Rationale |
|---|---|---|
| `career-log.md` | **User — canonical** | Written by you, plus `log`/`fix` appends. Append-only. Always ported. |
| `cv.md`, `stories.md` | **User — co-authored** | Generated content you have approved, plus anything you wrote or edited directly. Every system write is P6-confirmed with `.bak`, so the "never auto-updated" rule holds. Always ported. |
| `data/curate-state.md` | **User — decisions** | Suppressions and declines are unrecoverable intent — nothing can reconstruct that you deliberately deleted a bullet. `.bak` on write; always ported. |
| `modes/curate.md`, `scripts/curate-state.mjs` | System | Instructions and tooling. |
| `article-digest.md`, `interview-prep/story-bank.md` | removed | §10, and renamed to `stories.md` |

DATA_CONTRACT.md also gains a one-line derivation note: career-log → (curate) →
cv.md + stories.md, so nobody mistakes the curated files for independent sources.

---

## 12. Token budget

| Operation | Cost |
|---|---|
| Appending to the log | **0** — you edit the file; `log` is one echo |
| Sessions that never curate | **~30 tokens** — one routing row per surface; `curate.md` is lazy-loaded like every other mode |
| Staleness nudge | ~0 — mtime check |
| `curate` | mode file (~2.5k) + whole log (2–15k) + live `cv.md` and `stories.md` (~3–6k) ≈ **8–24k** |
| `fix` | Same shape, usually smaller |
| Stage 3 modes | Unchanged |

A full `curate` costs roughly what one `cv` generation costs today, and runs far less
often. Revisit incremental reading if the log ever passes ~500 entries — with real
usage data rather than the guesswork v1 was built on.

---

## 13. Command surface

| Command | Does |
|---|---|
| `log <text>` | Append a dated entry. **No confirmation** (§4). Echoes what it wrote. |
| `curate` | Full pass (§6). Flags: `--cv` / `--stories` to limit scope, `--yes`. |
| `fix <description>` | Correction flow (§7). Also reachable conversationally. `--wording` forces case (c). |

Routing: one row each in `AGENTS.md`, `GEMINI.md`, and
`.agents/skills/career-scout/SKILL.md`, plus three discovery-menu lines. No collision
with the URL/JD detection mandate.

---

## 14. Implementation phases and verification

| # | Phase | Verification gate |
|---|---|---|
| 1 | Scaffold: `career-log.md` with a header + example entry; `data/curate-state.md`; rename `story-bank.md` → `stories.md` | Files exist; `grep -rn "story-bank" modes/ AGENTS.md` inventoried for Phase 5 |
| 2 | `scripts/curate-state.mjs` — read state, `.bak`+write, advance watermark, dated append | Unit-level: append is atomic and idempotent on re-run; a write failure leaves the `.bak` intact and the watermark unadvanced; malformed state file exits non-zero rather than silently resetting |
| 3 | `modes/curate.md` — log + curate + fix | CLI-agnostic: `grep -iE "WebFetch\|WebSearch\|Read tool\|Bash tool"` empty. Two entries months apart on one topic → ONE merged bullet. `log` appends with no confirm prompt. |
| 4 | Edit permanence — the load-bearing test | Reword a bullet, then run `curate` twice: your wording survives and later proposals build on **your** text. Delete a bullet → recorded as suppressed, never returns across two runs. Reorder → order untouched. Hand-write a bullet with no log entry → left alone. Accept `cv.md` but decline `stories.md` → watermarks diverge correctly, `cv.md` is not re-proposed, `stories.md` still receives that fact next run. |
| 5 | Hard cases | Backdated entry naming a prior employer → curator ASKS. "Started at NewCo" → role added to `cv.md`, previous closed, `profile.yml` mismatch reported. Work spanning a job change → one bullet per employer, no metric appearing under the wrong role. `supersedes` case (Postgres tune → migrate) → not silently merged. |
| 6 | Rewire read-side: `evaluate` (Block E/F, profile.yml check), `cv` 0d, `interview-prep` paths, `_shared.md` sources table, staleness nudge | `grep -rn "article-digest"` empty. One full `evaluate` run: report generates, stories propose-append to `stories.md`, no log read in the transcript, role mismatch surfaces when `profile.yml` is stale |
| 7 | `setup` + `port` (§8, §9) | Fresh instance: paste CV → SEED → curated `cv.md` → depth pass offered → "skip all" exits cleanly to Step 2. Port dry-run from a legacy fixture → three SEED entries |
| 8 | Routing + contracts: `AGENTS.md`, `GEMINI.md`, `SKILL.md`, DATA_CONTRACT, port manifest | Paste-URL smoke test still routes to `evaluate`; `log`/`curate`/`fix` route to `modes/curate.md`; contract lists all four files |
| 9 | `CONSOLIDATION-PLAN.md` + README, same commit | Version and date bumped; mode roster and file tables match reality |

Phases 1–5 touch nothing else in the system, so the risky machinery is proven before
any existing mode is rewired.

---

## 15. What v1 had and v2 cut — do not re-propose

| Cut | Why |
|---|---|
| Thread index (entry IDs, gists, thread records, output anchors) | Existed to avoid reading a log cheaper than the mode file that reads it. Created its own worst failures: missed links from stale gists, gist decay, index/log drift. Reading the whole log solves cross-time linking *better*. |
| HTML-comment anchors (`<!-- id:T03 -->`) | Defaced a file explicitly promised as "yours to edit," survived copy-paste into places they shouldn't, and had a catastrophic mode: tidying the comments out read as mass suppression of the entire CV. |
| Snapshot / diff / ownership-ledger chain | Preserved edits through five fragile links. §5.2 preserves them with none, by never regenerating. |
| Separate roles table in a decisions file | Duplicated what `cv.md`'s Work Experience headings already state, with no adjudication rule between the copies. |
| `curate --full` as a distinct mode | Every run is a full read now. |
| `curate --release <anchor>` | Nobody types an ID they'd have to look up in the file they could just edit. Delete the line instead. |
| Persisted thread `relation` field | A misclassification became permanent data instead of a decline-able proposal. Kept as instruction (§5.4). |
| `fidelity: thin/told` flag | Derivable from the log. (v1 cut the flag but left a phase test asserting it — the spec contradicted itself after two adversarial reviews, which is the clearest evidence the design had outgrown its medium.) |
| `linkedin.md` as a third sibling now | Its only consumer is unimplemented. Derived, so deferring loses nothing — it regenerates from the log when `modes/linkedin.md` ships. |
| `[y/N]` on `log` | Gated the one zero-friction verb the architecture depends on. |

---

## 16. Open questions

1. **Suppression matching is fuzzy.** Topic-in-plain-language may occasionally
   re-propose something you deleted. *Recommendation: accept.* The failure is visible
   and costs one keystroke; the alternative failed invisibly. Revisit if it happens
   more than rarely in Phase 4 testing.
2. **`profile.yml` drift after a job change.** §9 upgrades this from a printed pointer
   to a hard check in `evaluate`, because stale seniority silently corrupts comp
   targets and level gating in every evaluation. *Open:* whether `cv` and `recruiter`
   should carry the same check, or whether one loud check at evaluation time is
   enough. *Leaning: evaluate only — more checks, more prompt fatigue.*
3. **How many prompts is one `curate` run?** The abandonment risk is a gauntlet
   between you and a PDF. Current design: up to two file confirms plus occasional
   role/relation asks. *Recommendation: instrument this in Phase 4 — if a routine run
   exceeds three interactions, batch the asks into one screen before any writes.*
4. **`log` undo.** Confirmation-free appends need a trivial undo. *Recommendation:*
   `curate-state.mjs` keeps the last append's byte range so `log --undo` is exact,
   rather than asking a model to remove "the last entry."

# Mode: curate — Career Log → CV + Stories

<!-- ============================================================
     SYSTEM LAYER FILE — safe to auto-update.
     The user's career log and curated files are User layer:
       career-log.md, cv.md, stories.md, data/curate-state.md
     ============================================================ -->

Trigger: user types `log`, `curate`, or `fix` (or says something that is plainly one
of those — "jot this down", "that number is wrong", "fold in my recent wins").

Three verbs over one pipeline:

| Verb | Does |
|---|---|
| `log <text>` | Append a dated entry to `career-log.md`. **No confirmation.** |
| `curate` | Read the whole log, propose minimal diffs into `cv.md` and `stories.md`. |
| `fix <description>` | Route a correction to the right place (§ Fix). |

`career-log.md` is canonical. `cv.md` and `stories.md` are curated cuts of the same
material. `linkedin.md` is **not** part of this system yet — it arrives with
`modes/linkedin.md`. If the user asks for LinkedIn help before then, read
`career-log.md` + `cv.md` + `stories.md` and answer directly; do not create
`linkedin.md`.

---

## THE TWO RULES THAT MATTER MOST

**1. Never regenerate a curated file. Only propose changes to it.**
Read `cv.md` and `stories.md` as the user last left them and propose the smallest edit
that folds in new material. If the user reworded a bullet, build on *their* wording. If
they reordered bullets, that order is correct. If they wrote a bullet by hand, leave it
alone. Never reconstruct a file from the log and overwrite what is there — that is how
a user's edits get destroyed, and it is the single worst failure this mode can have.

**2. All state writes go through the script. Never by hand.**
`scripts/curate-state.mjs` owns backup, watermark advance, dated append, and state
parsing. Do not write `career-log.md` or `data/curate-state.md` with file-write tools,
and do not advance a watermark yourself. The script guarantees a `.bak` exists before
any write and that a watermark only advances after a successful write. Prose cannot
guarantee that; code can.

---

## `log` — append an entry

1. Run: `node scripts/curate-state.mjs append "<the user's text>"`
   Add `--date YYYY-MM-DD` only if the user gave a date for something that happened
   earlier. Otherwise the script uses today.
2. **Do not ask for confirmation.** An append to an append-only file cannot destroy
   anything, and gating this verb teaches the user that jotting has a toll.
3. Echo what was written and how to undo it:

```
📝 Logged to career-log.md (2026-08-22):
   "Got the 3kW LLC prototype to 97.2% peak efficiency…"

   Undo: node scripts/curate-state.mjs undo-append
   Run `curate` when you want this in your CV.
```

If the script reports `appended: false` (identical entry already present), say so
plainly rather than claiming a write happened.

**Demote headings inside an entry.** `## ` at entry level delimits entries, so any
`#`/`##` heading in pasted content (a CV, a story bank, a doc) must be demoted to
`###` or deeper before appending. Otherwise `## Work Experience` reads as an entry
boundary and the log fragments into nonsense. Applies to `log`, to setup's SEED
import, and to port's legacy migration.

---

## `curate` — fold the log into the curated files

### Step 1. Read state and inputs

1. `node scripts/curate-state.mjs read` → watermarks, suppressed, declined.
   If it exits 2, the state file is malformed — show the error and stop. Do not
   repair it by guessing.
2. Read `career-log.md` **in full**. Not a slice, not a tail. The whole file is a few
   thousand tokens and reading all of it is what makes cross-time linking work: an
   entry from February and its continuation in August become one bullet only if both
   texts are actually in front of you.
3. Read the live `cv.md` and `stories.md` in full.
4. Flags: `--cv` / `--stories` limit which files are touched. `--yes` skips confirms.

If no entry is newer than both watermarks, say "nothing new since {date}" and stop.

### Step 2. Attribute new entries to roles

`cv.md`'s Work Experience headings are the role timeline — company, title, date range.
That is the authoritative record; there is no separate roles file.

1. **By date, silently.** An entry whose date falls inside a role's range belongs to
   that role. This is right almost every time.
2. **Ask when the content contradicts the date.** If an entry names a prior employer,
   product, or teammate, or uses past framing ("back when I…", "at my old job"), do
   not trust the date:
   > "Which role was this under? I'd guess **Acme Power (2016–2019)**. [y / pick another]"

   This is the most valuable question in this mode. An entry filed under the wrong
   employer produces a CV that is factually wrong in a way nobody catches until an
   interview.
3. **Role changes are entries.** "Started at Volt Systems as Principal this week" is a
   boundary event, not an accomplishment. Confirm, then propose adding the new role
   heading to `cv.md` and closing the previous one's date range. Also check
   `config/profile.yml` — if its current role/seniority no longer matches, say so:
   > "Your profile.yml still says Senior Staff Engineer at Generac. That feeds comp
   >  targets and level gating in every evaluation — run setup's incremental update."

   No retroactive wizard. A forgotten promotion from years back is handled by a normal
   `[BACKDATED 2021-05] Promoted to Senior` log entry.
4. **Not everything has an employer.** Talks, patents, open-source, side projects,
   certifications → Projects / Publications / Certifications sections, not Work
   Experience. A talk *about* employer work belongs to that employer, because the
   underlying work did.

### Step 3. Decide what each entry changes

For each new entry, decide per curated file: extend an existing bullet, add a new one,
or do nothing.

**Relating an entry to existing content** — the distinction that matters is only:

- **extends** — adds facts to a claim already there → fold into one strengthened bullet
- **supersedes** — replaced or reversed the earlier approach → **never silently merge**;
  either two bullets, or one that states the arc honestly

Worked example of the trap: *"Optimized Postgres queries"* in March and *"Migrated off
Postgres to DynamoDB"* in September share heavy vocabulary but are not one
accomplishment. Merging them produces a bullet that reads as continuous progress and
is, in substance, false. When the relation is not obvious, **ask** — it is one cheap
question, and the vocabulary that makes these look alike is exactly what makes the
mistake invisible afterwards.

**Honor the state file.** Skip anything matching a `Suppressed` line (the user deleted
it; it must not come back). Skip anything matching a `Declined` line (already offered
and turned down). Matching is by topic in plain language — if you are unsure whether a
proposal matches a suppression, do not propose it.

**Work spanning a job change** produces one bullet under each employer in `cv.md` — a
bullet cannot straddle two companies — but stays a **single story** in `stories.md`,
because an interview answer follows the work, not the org chart.

**Metric attribution is a hard check.** Every metric in a role's bullet must trace to
an entry attributed to *that* role. A metric you cannot attribute to the role it sits
under is dropped, not guessed. This is the CV equivalent of claiming someone else's
result.

### Step 4. Propose, one file at a time

Build the full proposed content for a file, then show only what changed:

```
cv.md — 1 bullet strengthened (LLC converter)

  - "Designed 3kW LLC prototype reaching 97.2% peak efficiency."
  + "Designed 3kW LLC converter (97.2% peak efficiency) and took it to production
     at 10k units/yr; presented the synchronous rectification scheme at APEC 2026."

Apply to cv.md? [y/N]
```

Rules for this step:
- **One confirm per file**, and the files are independent. Accepting `cv.md` and
  declining `stories.md` in the same run is normal and must work.
- Default is **N**. Honor `--yes` / `--no-confirm`.
- Show diffs, never whole files.
- **Batch the questions.** If Step 2 or 3 raised asks, put them all in one screen
  *before* any writes rather than interleaving them with confirms. A user who faces
  six sequential prompts between them and a finished CV starts declining everything.

### Step 5. Commit or record the decline

**On accept**, pipe the full proposed file content to the script:

```
node scripts/curate-state.mjs commit cv.md --through <date of newest entry folded in>
```
(content on stdin). This backs up, writes, and advances **only that file's** watermark
— in that order, so a failed write leaves the backup intact and the watermark
unadvanced.

**On decline:**
```
node scripts/curate-state.mjs decline cv.md --note "<one line on what was declined>"
```
The watermark stays put, so the material is offered again next run unless the user
declined it explicitly.

**If the user says a bullet should be gone for good:**
```
node scripts/curate-state.mjs suppress --note "<topic>"
```

### Step 6. Report

```
Curated 2 new entries.

  ✅ cv.md      — 1 bullet strengthened          (watermark → 2026-08-14)
  ⏭️  stories.md — 1 story proposed, declined     (watermark stays 2026-02-12)

  ⚠️  config/profile.yml still says "Senior Engineer" but your CV now shows
     "Senior Staff Engineer" — run setup's incremental update.

Next: `cv` to generate a tailored CV, or keep logging.
```

---

## `fix` — corrections

The user can always just edit `cv.md` themselves; nothing overwrites it. But a
*factual* error fixed only in `cv.md` leaves the log still wrong, so it never reaches
`stories.md` or any future CV. That is what `fix` is for.

Locate the text, read the relevant log entries, then classify:

**(a) The log itself is wrong.** Draft a `CORRECTION:` entry, show it, append via the
script on `[y/N]`, then propose corrected bullets in both curated files.

**(b) The log was right; curation garbled it.** No log write. Propose corrected
bullets only.

**(c) Wording or style, no fact involved.** Must NOT go in the log, or the log becomes
a config file. A generalizable rule ("never say 'spearheaded'") → propose appending to
CV Generation Rules in `modes/_profile.md`. A one-off preference → just change the
wording; Rule 1 means it stays.

(a) and (b) are separated by a **mechanical comparison** — read the source entry and
see whether it says 97.8 or 97.2. This is not a judgment call, so do not treat it as
one. **State the classification aloud before acting:**

> "The log itself says 97.8% — correcting at the source so it reaches your stories too."

That sentence is what makes a wrong route visible instead of silent.

Escape hatches: `log "<text>"` appends with no classification; `fix --wording` forces
case (c).

---

## Rules

- **NEVER regenerate a curated file.** Propose diffs against what is on disk.
- **NEVER write `career-log.md` or `data/curate-state.md` directly.** Use the script.
- **NEVER confirm a `log` append.** It cannot destroy anything.
- **NEVER invent facts.** Every curated bullet traces to a log entry. If the log
  doesn't say it, it doesn't go in the CV.
- **NEVER put wording preferences or config in the career log.**
- **NEVER propose something matching a `Suppressed` line.**
- **ALWAYS read the whole log**, not a slice.
- **ALWAYS ask** when role attribution or an extends/supersedes relation is unclear.
- **ALWAYS batch questions** ahead of writes, never interleaved with confirms.
- Generate in the language the user wrote in.

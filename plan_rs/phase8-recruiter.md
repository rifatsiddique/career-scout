# Phase 8 — Recruiter Relationship Manager

**Status:** ✅ Implemented 2026-06-23 (steps 1–5 done; §8.6 scenario tests pending real recruiter messages). Hardened after a 3rd Gemini pass (post-implementation review) — see §10 Pass 3.
**Version:** 0.4
**Last Updated:** 2026-06-23 -- Gemini pass 2: lazy-load pipeline (roster out of hot path, gatekeeper short-circuit), message-intent (networking vs job-pitch), name normalization, multi-job threads, dead-thread compaction, terser low-fit defaults + skip approve gate
**Owner:** rifat
**Depends on:** Phase 1 (evaluate / `_shared.md` scoring), `_profile.md` writing style, interview-prep per-entity doc pattern

---

## 1. Problem & Goal

The user receives frequent unsolicited recruiter outreach via LinkedIn and email.
These messages are sporadic in quality: sometimes a full JD link, often just
"great opportunity, are you open?" The user wants help **drafting fit-aware
replies** they can copy-paste, while **accumulating knowledge about each
recruiter over time** so later messages get smarter, better-grounded responses.

Key realities that drive the design:

- **The recruiter's name is the only stable, always-present datum.** Company,
  role, comp, location, and JD are sporadic — present in a mix, absent in a mix.
- **One recruiter reaches out about multiple jobs, at different times, sometimes
  overlapping.** A flat per-message log loses the thread; a per-recruiter dossier
  with internal *threads* (one per job) models reality.
- **Information accrues through engagement.** Each message enriches what we know
  about the recruiter (who they recruit for, comp ranges they float, their
  responsiveness) and about each job thread.

**Goal:** A new `recruiter` mode that, given a pasted message + recruiter name,
identifies/creates the recruiter dossier, locates or opens the right job thread,
runs a lightweight fit check, drafts a fit-aware reply for copy-paste, and
persists the enriched knowledge — all as pure prompt + markdown data (no new
scripts), CLI-agnostic.

---

## 2. Resolved Design Decisions

Captured from user Q&A on 2026-06-23:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Reply strategy vs. fit | **Fit-aware** | Warm/engaged on good matches; polite-decline-but-door-open on poor; ask-for-info when vague. |
| Fit analysis depth | **Lightweight check, offer to escalate** | Recruiter pings are usually thin. Quick archetype/comp/location/seniority read; full A-G `evaluate.md` only when a real JD/link is present and the user opts in. |
| Typical input | **Name always; rest sporadic (mix)** | Name is the dossier key. Everything else is parsed best-effort and flagged when missing. |
| Knowledge model | **Progressive enrichment** | Each message updates accumulated facts + the relevant thread. |
| Identity | **Name-based slug + confirm on collision** | No recruiter-ID system (over-engineering). Disambiguate only when genuinely ambiguous. |
| Code footprint | **No new scripts** | Pure mode + markdown data, like interview-prep. Keeps it CLI-agnostic. |
| Recruiter type | **Agency vs. in-house drives reply bias; `unknown` defaults firm-but-warm** | In-house @ a target company = bridge-build even on misfit; agency = firm criteria-wall (require company/JD/comp before a call). Type often unknowable from the message, so `unknown` is a first-class state. |
| Pipeline coupling | **Opt-in only, never auto-push** | `pipeline.md` stays a sacred list of roles the user explicitly chose to spend energy on. |
| Context strategy | **Lazy-load; roster out of the hot path** | Don't read the roster on every call (O(N) tokens). List dossier filenames (cheap), read only the matched dossier. Read heavy fit inputs (`cv.md`) only after the gate passes. |
| Low-fit UX | **Terse + no approve gate; voice from `_profile.md`** | INSUFFICIENT-INFO/WEAK → 1–2 sentences, output immediately for copy-paste. Reserve confirmation for STRONG/WORTH. No hardcoded persona — length/voice calibrate from the user's writing style. |

All §10 open questions are resolved (Gemini review, 2026-06-23) — see §10.

---

## 3. Data Model (both User Layer)

### 3.1 `data/recruiters/{name-slug}.md` — per-recruiter dossier

One file per recruiter. `name-slug` = lowercased full name, spaces → hyphens
(`jane-smith.md`). Collisions handled at write time (see §4 Step 1).

```markdown
# Jane Smith

- **Type:** agency   <!-- agency | in-house | unknown -->
- **Agency/Employer:** Acme Tech Recruiting   <!-- agency name, or "in-house @ Foo", or "unknown" -->
- **Contact:** linkedin.com/in/jane-smith  |  jane@acme.example
- **First contact:** 2026-06-23
- **Last contact:** 2026-06-23
- **Relationship notes:** Responsive; mostly fintech backend roles.

## Known Facts (accumulated)

<!-- Appended/updated each message. Keep terse, bulleted, deduped. -->
- Companies pitched: Foo, Bar
- Domains/levels: senior backend, fintech
- Comp ranges floated: $X–$Y (Foo, 2026-06)
- Standing answers I've given: not relocating; targeting $X base; open to remote

## Threads

### Thread 1 — Foo / Senior Backend Engineer   `[status: open]`
<!-- status: open | exploring | declined | interviewing | applied | dead -->
- `2026-06-23` ⟵ **inbound:** "Great opportunity at Foo, are you open?" (no JD/comp/location)
- **Fit:** INSUFFICIENT-INFO — no JD, comp, or location provided
- `2026-06-23` ⟶ **my reply:** Asked for JD link, comp range, and location/remote policy

### Thread 2 — Bar / Staff Platform Engineer   `[status: exploring]`
- `2026-07-02` ⟵ **inbound:** JD link + $180–210k, remote-US
- **Fit:** WORTH-EXPLORING — comp in range, remote OK; seniority slightly above target
- `2026-07-02` ⟶ **my reply:** Expressed interest, asked 2 clarifying questions, proposed a call

## Historical Threads

<!-- Dead/closed threads compressed to one line each (see Schema rules). -->
- Baz / Backend Lead — declined 2025-09 (comp below floor)
```

**Schema rules:**
- Header fields are stable keys; update in place (don't duplicate).
- "Known Facts" is consolidate-and-dedup — cap ~7 bullets, replace superseded
  facts; never let it bloat or contradict itself.
- Each thread has a status tag and a reverse-chronological-friendly dated log
  using `⟵ inbound` / `⟶ my reply` markers.
- A thread's `[status]` is the single source of truth for that job's state.
- **One thread per distinct role.** If a single message pitches multiple roles
  (e.g., "a Head of Eng *and* a VP Eng — open to either?"), create a separate
  thread for each, and note in each that they arrived in the same message.
- **Dead-thread compaction.** When a thread reaches `dead` (or a closed/lost
  state), collapse it on the next save into a one-line entry under a trailing
  `## Historical Threads` section, e.g. `- Foo / Senior Backend — declined 2026-07 (comp below floor)`.
  This keeps active context small as a dossier ages over years.

### 3.2 `data/recruiters.md` — roster index

One row per recruiter for an at-a-glance view.

```markdown
# Recruiters

Roster of recruiter contacts. One row per recruiter; details live in
`data/recruiters/{slug}.md`. Updated by `recruiter` mode.

| Recruiter | Agency/Employer | Threads | Open | Last Contact | Dossier |
|-----------|-----------------|---------|------|--------------|---------|
| Jane Smith | Acme (agency) | 2 | 1 | 2026-07-02 | `recruiters/jane-smith.md` |
```

---

## 4. Mode Spec — `modes/recruiter.md`

**Triggers:** user types `recruiter`, or pastes a recruiter message and indicates
it's recruiter outreach (e.g., "reply to this recruiter:").

**Sub-modes:**
- `recruiter` + pasted message → main draft flow (default)
- `recruiter <name>` → print that recruiter's dossier (read-only)
- `recruiter --list` → print the roster from `data/recruiters.md`
- `recruiter --log <name>` → record an inbound/outbound message WITHOUT drafting
  (for when the user already replied and just wants it captured)
- `--yes` / `--no-confirm` → skip the confirmation prompt (headless)

### Step 0 — Minimal gather (lazy-load; do NOT read everything up front)
Read only what's needed to identify and parse:
- `modes/_profile.md` (writing style — needed for any reply).
- A **filename listing** of `data/recruiters/*.md` (cheap; no contents).
- After Step 1 resolves the slug, read the **one** matched dossier's contents.

**Do NOT read** `data/recruiters.md` (the roster) — it's O(N) and write-mostly,
only consulted by `recruiter --list`. **Do NOT read** `cv.md` /
`config/profile.yml` / `article-digest.md` yet — those heavy fit inputs load
lazily in Step 4, and only if the Step 2.5 gate passes.

### Step 1 — Identify recruiter
- **Normalize the name first.** Users paste from LinkedIn — strip emojis, titles,
  credentials, parentheticals, and suffixes (`Jane Smith (Hiring!) 🚀` → `Jane
  Smith`; `John Doe, CIR, PRC` → `John Doe`). Slug = `first-last`, lowercased.
- Match the slug against the dossier **filename listing** (in-memory fuzzy match
  also catches `Jon`/`Jonathan`). Read contents of the matched file only.
- **If exactly one confident match** → load it.
- **If multiple matches or a same-name-different-agency collision** → ask the
  user which (show agency/employer + last contact to disambiguate). On a true
  duplicate-name collision, suffix the slug with agency (`jane-smith-acme.md`).
- **If no match** → new recruiter; will create dossier on persist.
- **Determine recruiter `Type`** (agency / in-house / unknown): infer from the
  message (named hiring company + first-person "we/our team" → in-house;
  third-party framing, obscured company, "my client" → agency). If a dossier
  already records the type, trust it. If undeterminable → `unknown`. Type drives
  reply bias in Step 5.

### Step 2 — Parse the message
Extract best-effort and **emit a visible Analysis line before drafting anything**
(forcing explicit extraction makes the reply actually ask for what's missing):

```
[Analysis] Intent: job-pitch | Type: agency | Company: unknown | Role: Senior Backend | Comp: missing | Location: missing | Ask: are-you-open | Missing: company, JD, comp, location]
```

Fields: `Intent` (**job-pitch | networking** — see below), recruiter `Type`
(agency / in-house / unknown — see Step 1), company, role/title, JD link or
pasted JD text, comp, location/remote, seniority signal, and **what the recruiter
is asking for** (are-you-open / scheduling / asking for CV / follow-up). The
`Missing` list is the gating set the reply must request when info is thin.

**Intent classification:** if the message is a relationship touch with no role
("been a year, how are things at {Co}? Let's grab coffee") → `networking`.
Otherwise → `job-pitch`. (Multiple roles in one message is still `job-pitch` —
see Step 3.)

### Step 2.5 — Gate (short-circuit before loading fit machinery)
- **If `Intent: networking`** → skip the fit check entirely. Draft a short, warm,
  human catch-up reply from `_profile.md` voice. Log as a lightweight `networking`
  entry (not a job thread). Go to Step 6. **Do not** ask for a JD.
- **If `Intent: job-pitch` but no role/JD AND no comp** → verdict is
  `INSUFFICIENT-INFO` by definition; the fit check is vacuous. **Skip the heavy
  reads** (`cv.md` etc.); go straight to the Step 5 INSUFFICIENT-INFO reply.
- **Otherwise** → proceed to Step 3 → Step 4 (fit check).

### Step 3 — Match to a thread
- Compare parsed company+role against existing threads in the dossier.
- **Match** → this is a continuation; append to that thread.
- **No match** → new thread (next number, status `open`).
- **Multiple distinct roles in one message** → one thread *per role* (see §3.1
  schema rule); the single reply can address all of them.
- **Ambiguous** (same company, unclear if same role) → ask the user.

### Step 4 — Fit check (lightweight) — *reached only if the Step 2.5 gate passes*
**Now** lazily read the fit inputs: `config/profile.yml` (targets/comp/location)
and `cv.md` (archetype evidence). Using `_shared.md` heuristics (archetype match,
comp vs. targets, location policy, seniority), produce one verdict:

| Verdict | Meaning |
|---------|---------|
| `STRONG` | Clear archetype + comp/location/seniority all check out |
| `WORTH-EXPLORING` | Promising but with one or more open questions/mismatches |
| `WEAK` | Clear misfit (comp too low, wrong domain, location blocker, seniority off) |
| `INSUFFICIENT-INFO` | Not enough to judge — missing JD/comp/location/title |

If a **real JD link or full JD text is present**, offer to escalate:
> "There's a real JD here — want me to run a full A-G evaluation and save a
>  report before replying? [y/n]" → if yes, route through `modes/evaluate.md`
>  and feed its composite/fit into the reply.

### Step 5 — Draft the reply (fit-aware)
Tone and voice come from `_profile.md` writing style (no hardcoded persona).
Output a clean, ready-to-paste block. Length scales *down* with fit — protect the
user's time. Strategy by verdict:

- **STRONG** → warm, express genuine interest; propose a concrete next step
  (short call); ask only the 1–2 still-missing facts. (Up to ~6 sentences.)
- **WORTH-EXPLORING** → interested-but-qualifying; ask the key gating questions
  (comp / location / scope) before committing time. (~2–4 sentences.)
- **WEAK** → terse, gracious decline (**1–2 sentences**); keep the door open.
  **Mandatory:** restate the user's actual boundaries from `profile.yml` — level,
  comp floor, location — so the recruiter can re-target ("Not a fit right now —
  please keep me in mind for Staff+ roles at $X+ base, remote-US"). A decline must
  *train the recruiter*, never just close the door.
- **INSUFFICIENT-INFO** → terse ask for the missing specifics (**1–2 sentences**),
  e.g. "Sounds interesting — send the JD and comp band and I'll take a look."
- **networking** (from Step 2.5) → short, warm, human catch-up; no fit talk, no
  JD demand.

**Recruiter-type bias (applies across all verdicts):**
- **in-house** (recruiter sits inside a target company) → bias toward
  bridge-building. Even on a WEAK fit, stay warm, explain what you *are* looking
  for, and ask them to keep you in mind. Protect this relationship.
- **agency** (third-party) → polite but establish a firm criteria-wall: company
  name, JD, and comp band are required before any intro call. Don't soften this.
- **unknown** → firm-but-warm default (treat closer to agency for time-protection
  until the type is learned).

Reply must reuse any **standing answers** already in the dossier (don't re-ask
"are you open to relocation?" if the dossier records "not relocating").

### Step 6 — Confirm & persist
- **Approval gate scales with stakes:** for **STRONG / WORTH-EXPLORING** show the
  draft and let the user edit/approve before persisting (a call/commitment is at
  stake). For **WEAK / INSUFFICIENT-INFO / networking**, output the copy-paste
  text immediately with no yes/no gate (`--yes` forces no-gate everywhere).
- **Persist regardless of gate.** The thread entry is logged either way; the
  reply is recorded as *drafted* (the user may send something slightly different —
  `recruiter --log <name>` reconciles after the fact).
- **Write safety (User Layer — critical):** never blind-overwrite and never rely
  on a naive "append". **Read the entire existing dossier, regenerate the full
  updated markdown preserving every historical thread, then write the whole file
  back.** On CLIs that support precise edit blocks (e.g., Claude Code's edit), an
  in-place targeted edit is preferred and even safer. Before writing, verify no
  prior thread was dropped or truncated.
- The regenerated dossier must:
  - Append the inbound summary, the Fit verdict, and the drafted reply to the matched thread.
  - **Compact dead threads:** collapse any thread now in a `dead`/closed state to a
    one-line entry under `## Historical Threads` (§3.1 schema rule).
  - Update **Known Facts** — **consolidate, don't just append**: keep it under ~7
    concise bullets; *replace* superseded facts rather than stacking them
    (e.g., overwrite "Targeting $200k (2025)" with "Targeting $220k (2026)").
  - Update header `Last contact` (and `First contact` / `Type` / agency if newly learned).
- **Then** update/insert the roster row in `data/recruiters.md` (threads count,
  open count, last contact). This is the *only* step that touches the roster —
  it's never read in the hot path.
- **Offer bridges** (non-blocking):
  - STRONG / WORTH-EXPLORING with a real role → "Add this to your pipeline for a
    full evaluation? [y/n]" → append a row to `data/pipeline.md` Pending.
  - If it becomes an application → suggest logging in `data/applications.md`.

---

## 5. Tone & Safety Rules (mode NEVER/ALWAYS)

- **NEVER fabricate enthusiasm or qualifications.** Replies trace to `cv.md`/profile.
- **NEVER auto-send.** Mode produces copy-paste text only; the user sends it.
- **NEVER commit the user to comp/availability they haven't stated** — ask, don't assume.
- **NEVER overwrite a dossier wholesale** — always append/update in place (User Layer).
- **ALWAYS** label inferred fit (`[inferred from JD]` / `[no JD — inferred]`).
- **ALWAYS** keep a graceful, professional register even on declines (recruiters
  recur; today's misfit is next year's STRONG).

**Anti-verbosity drafting constraints (counter LLM sycophancy):**
- **Length:** default 2–4 sentences; hard ceiling ~6 even when asking questions.
  No filler, no throat-clearing, no restating their message back to them.
- **No exclamation points** unless the fit is STRONG and the enthusiasm is genuine.
- **Never apologize for declining.** Senior ICs say "I'll pass" / "not the right
  fit right now," not "I'm so sorry but I have to decline."
- **No invented enthusiasm or qualifications** — every claim traces to `cv.md`/profile.

---

## 6. Integrations

- **Fit scoring:** reuse `_shared.md` dimension heuristics for the lightweight read; do not invent a parallel scoring scheme.
- **Full eval bridge:** `modes/evaluate.md` when the user opts to escalate a real JD.
- **Pipeline bridge:** append to `data/pipeline.md` Pending on user opt-in.
- **Applications bridge:** suggest `data/applications.md` logging when a thread reaches applied/interviewing.
- **Writing voice:** `modes/_profile.md` writing style section.

---

## 7. Data Contract & Porting (CRITICAL)

New files are **User Layer** (personal, accumulated, never auto-overwritten):
- `data/recruiters.md` (roster)
- `data/recruiters/*.md` (dossiers)

Three places must be updated so this data is recognized and **ported on upgrade**:

### 7.1 `config/port-manifest.yml` — add a `recruiters` group
The port script is manifest-driven; without this, dossiers are silently left
behind on migration. Add:

```yaml
  - id: recruiters
    name: "Recruiters"
    description: "Recruiter dossiers and roster (per-recruiter history + reply log)"
    files:
      - path: "data/recruiters.md"
        strategy: overwrite
        required: false
        description: "Recruiter roster index"

      - path: "data/recruiters/*.md"
        strategy: copy-missing
        glob: true
        required: false
        description: "Per-recruiter dossiers (history, known facts, job threads) — user-editable, never overwritten"
```
Rationale for strategies: roster is a regenerable index (`overwrite` is safe on a
clean migration); dossiers are hand-accumulated and user-editable, so
`copy-missing` (same as interview-prep per-company docs) protects them.

### 7.2 `modes/port.md` — add to the group list
Add a `[8] recruiters` line to the Step 3 group menu and mention recruiter
dossiers in the "What gets ported" summary at the top.

### 7.3 `docs/DATA_CONTRACT.md` — add to the User Layer table
Add rows for `data/recruiters.md` and `data/recruiters/{slug}.md` with purpose
notes ("appended by recruiter mode, never auto-overwritten").

---

## 8. Implementation Steps + Verification

Each step states how it is verified before moving on (per project planning rule).

1. **Write `modes/recruiter.md`** (full mode spec from §4–§5).
   *Verify:* load the file into a fresh-context agent and dry-run a sample
   pasted message end-to-end; confirm it asks for nothing already in profile and
   produces a copy-paste reply block.

2. **Create roster scaffold + dossier template.** Add `data/recruiters.md` header
   (empty table) and document the dossier schema (in the mode file or a
   `templates/` example, TBD — see §10).
   *Verify:* a freshly created dossier renders correctly; slug rules produce no
   ambiguous filenames for two sample names.

3. **Wire routing.** Add a row to the AGENTS.md Mode Routing table
   (`recruiter` → read `_shared.md` + `recruiter.md`) and add the command to the
   `.agents/skills/career-scout/SKILL.md` discovery menu + routing.
   *Verify:* typing `recruiter` and `recruiter --list` route to the new mode;
   help menu lists it.

4. **Update Data Contract + Porting** (§7.1 manifest group, §7.2 port.md,
   §7.3 DATA_CONTRACT.md).
   *Verify:* grep `port-manifest.yml`, `port.md`, and `DATA_CONTRACT.md` each
   list `data/recruiters`; run `node scripts/port-profile.mjs --source=<a test
   instance with a dossier> --dry-run` and confirm the recruiters group + files
   appear in the plan.

5. **Update `plan_rs/CONSOLIDATION-PLAN.md`** — add Phase 8 to the roadmap,
   reference this spec, bump version + timestamp. *(Do this after Gemini review +
   user approval, not before — the plan is a living doc and shouldn't carry
   unreviewed scope.)*
   *Verify:* version/timestamp updated; Phase 8 entry present and accurate.

6. **End-to-end scenario tests** (manual, fresh context each):
   - (a) New recruiter, vague "are you open?" → `INSUFFICIENT-INFO` reply asking
     for JD/comp/location; new dossier + roster row created.
   - (b) Returning recruiter, **new** job, good fit → `STRONG` warm reply;
     new thread appended; Known Facts updated; roster threads count incremented.
   - (c) Returning recruiter, **same** job follow-up → appends to the existing
     thread (no duplicate thread created).
   - (d) Weak fit (comp far below target) → polite decline, door open; thread
     status reflects decline.
   - (e) Real JD link present → escalation offer fires; on "yes" routes to
     `evaluate.md` and folds the composite into the reply.
   - (f) `recruiter --list` and `recruiter <name>` render roster / dossier read-only.
   - (g) Name collision (two "Jane Smith", different agencies) → disambiguation
     prompt; agency-suffixed slug on confirm.
   - (h) **In-house** recruiter, WEAK fit → warm bridge-building reply (keep-me-in-mind),
     NOT a flat decline; **agency** WEAK fit → polite firm decline with boundaries restated.
   - (i) Drafting discipline → reply is ≤6 sentences, no exclamation on a non-STRONG
     reply, no apology on a decline; a visible `[Analysis]` line precedes the draft.
   - (j) Persistence integrity → after a 3rd message to a recruiter with 2 prior
     threads, all prior threads survive intact and Known Facts stays ≤7 deduped bullets.
   - (k) Networking msg ("been a year, coffee?") → warm catch-up reply, NO JD
     demand, no fit check; logged as a networking touch, not a job thread.
   - (l) Contaminated name (`Jane Smith (Hiring!) 🚀`) → normalizes to `jane-smith`;
     a later plain "Jane Smith" hits the same dossier (no duplicate).
   - (m) Multi-job pitch (two roles in one message) → two threads created, one
     reply addresses both.
   - (n) Gate efficiency → an INSUFFICIENT-INFO ping does NOT read `cv.md`/roster
     (verify via the reads the agent actually performs).
   - (o) Dead-thread compaction → marking a thread `dead` collapses it to one line
     under `## Historical Threads` on the next save; active threads unaffected, and
     its durable facts are hoisted into Known Facts (not lost).
   - (p) Roster dedup → a 2nd message from an existing recruiter updates that
     recruiter's single roster row (Threads/Open/Last Contact), not a duplicate row.
   - (q) Pasted transcript → the reply targets the most recent inbound message;
     earlier messages are used only as context.
   - (r) Accented name (`José André`) → slugs to `jose-andre`; a later `Jose Andre`
     hits the same dossier (no duplicate).

---

## 9. File Change List

**New (System Layer):**
- `modes/recruiter.md`

**New (User Layer — created at runtime, scaffolded empty):**
- `data/recruiters.md`
- `data/recruiters/` (dir; dossiers created per recruiter)

**Modified (System Layer):**
- `AGENTS.md` — Mode Routing row
- `.agents/skills/career-scout/SKILL.md` — discovery menu + routing
- `config/port-manifest.yml` — new `recruiters` group
- `modes/port.md` — group menu + "what gets ported"
- `docs/DATA_CONTRACT.md` — User Layer rows
- `plan_rs/CONSOLIDATION-PLAN.md` — Phase 8 entry (post-approval)

---

## 10. Resolved Questions (Gemini review, 2026-06-23)

### Pass 3 — post-implementation review (operational bugs)

Applied directly to `modes/recruiter.md` (the implemented mode):

14. **Roster blind-write bug → read-before-write in Step 6.** Step 0 defers the
    roster read for tokens, so the agent reached the write step with no table in
    context and would blind-append duplicate rows. Step 6 now explicitly reads
    `data/recruiters.md`, finds-or-inserts the row, and rewrites — the deferred
    cost is paid once, at the end. (mode Step 0 / Step 6.)
15. **Passive Step-0 listing → active directory listing.** "A filename listing of
    …" risked the agent hallucinating names instead of invoking a tool. Reworded
    to an active "list the directory" instruction — kept CLI-agnostic (no tool
    names). (mode Step 0.)
16. **Unknown-type stays unknown → resolve it.** On WORTH-EXPLORING /
    INSUFFICIENT-INFO replies, fold in a brief "internal or representing a client?"
    ask so the next interaction can set `Type`. Not added to STRONG/WEAK. (mode Step 5.)
17. **Lossy dead-thread compaction → hoist facts first.** Before collapsing a dead
    thread to one line, hoist durable facts (comp ceilings, constraints, misfit
    reason, responsiveness) into Known Facts. (mode Step 6.)
18. **Unicode accents → fold to ASCII before slugging** (`José André` →
    `jose-andre`) to avoid Windows filesystem/search mismatches. (mode Step 1.)
19. **Pasted transcripts → reply to latest inbound.** Multi-message paste: target
    the most recent inbound; treat earlier messages as context. (mode Step 2.)

### Pass 2 — token-scaling & edge cases

7. **O(N) roster in hot path → Removed.** Roster is write-mostly (Step 6 / `--list`
   only). Identity uses a cheap dossier-filename listing + read of the single
   matched file. (§4 Steps 0/1.)
8. **Vacuous fit checks → Gatekeeper short-circuit.** No JD/role + no comp ⇒
   INSUFFICIENT-INFO without reading `cv.md`. Fit inputs load lazily in Step 4.
   (§4 Steps 2.5/4.)
9. **Networking messages → New `Intent` field.** "Been a year, coffee?" skips the
   fit check and gets a human catch-up reply, not a JD demand. (§4 Steps 2/2.5/5.)
10. **Contaminated names → Normalize before slugging.** Strip emojis/titles/
    creds/parentheticals first. (§4 Step 1.)
11. **Multi-job pitch → One thread per role.** (§3.1 schema, §4 Step 3.)
12. **Dossier bloat → Status-driven compaction** (not date-based): dead/closed
    threads collapse to one line under `## Historical Threads`. (§3.1, §4 Step 6.)
13. **Director verbosity → Terser low-fit defaults + skip approve gate**, but voice
    stays from `_profile.md` (no hardcoded persona). (§2 decisions, §4 Steps 5/6.)

### Pass 1 — design questions

1. **Auto-push to pipeline → Opt-in only, never auto-push.** `pipeline.md` stays a
   sacred list of roles the user explicitly chose to spend energy on. (§4 Step 6.)
2. **Dossier template location → Inside `recruiter.md`.** One less file; puts the
   structural constraints directly in the system prompt where the LLM generates.
   (§4, §8 Step 2.)
3. **Name collisions & renames → Agency-suffixed slug for v1; no merge/rename
   feature.** Names are unique enough 95% of the time; updating the `Type`/
   `Agency` header covers agency changes. Don't build merge until users complain.
   (§4 Step 1.)
4. **Agency vs. in-house → Model them differently; `unknown` is first-class.**
   New `Type` field drives reply bias: in-house = bridge-build even on misfit;
   agency = firm criteria-wall; unknown = firm-but-warm default. (§3.1, §4 Steps 1/5.)
5. **Known-Facts bloat → Consolidation rule.** Cap ~7 concise bullets; replace
   superseded facts instead of stacking. (§4 Step 6.)
6. **LLM-physics → Stricter write guardrail adopted.** Read the entire dossier,
   regenerate full content preserving all history, write the whole file back
   (or use precise edit blocks where supported); verify no thread dropped.
   Step 2 also emits a visible `[Analysis]` extraction line before drafting.
   (§4 Steps 2/6.)

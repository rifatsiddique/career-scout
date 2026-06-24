# Mode: recruiter — Recruiter Relationship Manager

Helps the user reply to recruiter outreach (LinkedIn, email) with a fit-aware,
copy-paste-ready draft, while accumulating per-recruiter knowledge over time so
later messages get smarter, better-grounded responses.

Trigger: user types `recruiter`, or pastes a recruiter message and indicates it's
recruiter outreach (e.g., "reply to this recruiter:", "a recruiter sent me this").

The recruiter's **name** is the stable key. Everything else (company, role, comp,
location, JD) is sporadic — parsed best-effort and requested when missing.

## Sub-modes

- `recruiter` + pasted message → main draft flow (default)
- `recruiter <name>` → print that recruiter's dossier (read-only, no write)
- `recruiter --list` → print the roster from `data/recruiters.md`
- `recruiter --log <name>` → record an inbound/outbound message WITHOUT drafting
  (for when the user already replied and just wants it captured, or to reconcile
  a reply that differed from the drafted one)
- `--yes` / `--no-confirm` → skip all confirmation prompts (headless)

## NEVER / ALWAYS Rules

- **NEVER auto-send.** Produce copy-paste text only — the user sends it.
- **NEVER fabricate enthusiasm or qualifications.** Every claim traces to `cv.md`
  or `config/profile.yml`. The interview-backtrack test applies.
- **NEVER commit the user to comp or availability they haven't stated** — ask, don't assume.
- **NEVER overwrite a dossier wholesale.** Read the whole file, regenerate it
  preserving every historical thread, write it back (see Step 6).
- **ALWAYS** reuse standing answers already in the dossier (don't re-ask "open to
  relocation?" if it records "not relocating").
- **ALWAYS** keep a graceful, professional register, even on declines — recruiters
  recur; today's misfit is next year's strong match.

### Anti-verbosity (counter LLM over-eagerness)

- Length scales **down** with fit. Default 2–4 sentences; hard ceiling ~6 even
  when asking questions. No filler, no throat-clearing, no parroting their message back.
- **No exclamation points** unless the fit is STRONG and the enthusiasm is genuine.
- **Never apologize for declining.** "Not the right fit right now" — not "I'm so
  sorry but I have to pass."
- Voice and register come from `modes/_profile.md` writing style. No hardcoded persona.

---

## Step 0 — Minimal gather (lazy-load — do NOT read everything up front)

Read only what's needed to identify and parse:
- `modes/_profile.md` — writing style **and the `## Your Recruiter Handling`
  section if present** (your saved reply stance — see Step 5). If the section is
  absent, the stance defaults to `warm-open`.
- **List the `data/recruiters/` directory** to see the existing dossier filenames
  (slugs). Do this actively — list the directory; do not read the dossier contents
  yet, and do not guess the names from memory.

After Step 1 resolves the slug, read the contents of the **one** matched dossier only.

**Do NOT read** `data/recruiters.md` (the roster) here — it grows O(N) and is
write-mostly; it's read only by `recruiter --list` and during the Step 6 write
phase. **Do NOT read** `cv.md`,
`config/profile.yml`, or `article-digest.md` yet — those heavy fit inputs load
lazily in Step 4, and only if the Step 2.5 gate passes.

### Sub-mode short-circuits (handle before Step 1)

- `--list` → read `data/recruiters.md` and print the roster table. Stop.
- `<name>` with no pasted message → resolve the dossier (Step 1 identity logic)
  and print it read-only. Stop. Do not write.
- `--log <name>` → run Steps 1–3 to locate recruiter + thread, capture the
  message/reply the user provides, then persist (Step 6). Skip Steps 4–5 (no draft).

---

## Step 1 — Identify the recruiter

1. **Normalize the name first.** Users paste from LinkedIn, so the raw name is
   often contaminated. Strip emojis, titles, credentials, parentheticals, and
   suffixes before slugging, and fold Unicode accents to their ASCII equivalents
   (avoids filesystem/search mismatches on Windows):
   - `Jane Smith (Hiring!) 🚀` → `Jane Smith`
   - `John Doe, CIR, PRC` → `John Doe`
   - `José André` → `Jose Andre`
   - Slug = `first-last`, lowercased, spaces → hyphens (`jane-smith`).
2. **Match** the slug against the dossier filename listing. Also fuzzy-match for
   nicknames (`Jon` ↔ `Jonathan`, `Liz` ↔ `Elizabeth`).
   - **Exactly one confident match** → read that dossier's contents; load it.
   - **Multiple matches / same name, different agency** → ask the user which,
     showing agency/employer + last contact to disambiguate. On a true
     duplicate-name collision, suffix the slug with the agency
     (`jane-smith-acme.md`).
   - **No match** → this is a new recruiter; the dossier is created on persist (Step 6).
3. **Determine the recruiter `Type`** (drives reply bias in Step 5):
   - **in-house** — named hiring company + first-person framing ("we", "our team", "I'm on the talent team at Foo").
   - **agency** — third-party framing, obscured company, "my client", "a company I'm working with".
   - **unknown** — undeterminable from the message.
   - If the dossier already records a `Type`, trust it unless this message clearly contradicts it.

---

## Step 2 — Parse the message

If the user pastes a multi-message transcript rather than a single message, the
**target of your reply is the most recent inbound message**; treat the earlier
messages as context (already-discussed facts, prior asks) — don't reply to them.

Extract best-effort and **emit a visible Analysis line before drafting anything**.
Forcing explicit extraction makes the reply actually ask for what's missing:

```
[Analysis] Intent: job-pitch | Type: agency | Company: unknown | Role: Senior Backend | Comp: missing | Location: missing | Ask: are-you-open | Missing: company, JD, comp, location
```

Fields:
- **Intent** — `job-pitch` or `networking` (see below).
- **Type** — `agency` / `in-house` / `unknown` (from Step 1).
- **Company, Role/title, JD** (link or pasted text), **Comp, Location/remote, Seniority signal**.
- **Ask** — what the recruiter wants: `are-you-open` / `scheduling` / `asking-for-CV` / `follow-up`.
- **Missing** — the gating facts absent from the message. This list drives the
  reply when info is thin.

**Intent classification:** if the message is a relationship touch with no role
("been a year — how are things at {Co}? Let's grab coffee") → `networking`.
Otherwise → `job-pitch`. Multiple roles in one message is still `job-pitch`
(see Step 3).

---

## Step 2.5 — Gate (short-circuit before loading the fit machinery)

- **`Intent: networking`** → skip the fit check entirely. Draft a short, warm,
  human catch-up reply in `_profile.md` voice. Log it as a lightweight
  `networking` entry (not a job thread). Go to Step 6. **Do not ask for a JD.**
- **`Intent: job-pitch` but no role/JD AND no comp** → the verdict is
  `INSUFFICIENT-INFO` by definition; a fit check would be vacuous. **Skip the
  heavy reads** (`cv.md`, `profile.yml`). Go straight to the Step 5
  INSUFFICIENT-INFO reply, then Step 6.
- **Otherwise** → proceed to Step 3, then Step 4.

---

## Step 3 — Match to a thread

Compare the parsed company + role against existing threads in the dossier.

- **Match** → this is a continuation; append to that thread.
- **No match** → open a new thread (next number, status `open`).
- **Multiple distinct roles in one message** → create one thread **per role**;
  a single reply can address all of them. Note in each that they arrived together.
- **Ambiguous** (same company, unclear if same role) → ask the user.

---

## Step 4 — Fit check (lightweight) — *reached only if the Step 2.5 gate passes*

**Now** lazily read the fit inputs: `config/profile.yml` (targets / comp /
location policy) and `cv.md` (archetype evidence). Apply the `modes/_shared.md`
fit heuristics (archetype match, comp vs. targets, location policy, seniority).
Do **not** invent a parallel scoring scheme — reuse `_shared.md`.

Produce exactly one verdict:

| Verdict | Meaning |
|---------|---------|
| `STRONG` | Clear archetype match + comp/location/seniority all check out |
| `WORTH-EXPLORING` | Promising but with one or more open questions/mismatches |
| `WEAK` | Clear misfit (comp too low, wrong domain, location blocker, seniority off) |
| `INSUFFICIENT-INFO` | Not enough to judge — missing JD / comp / location / title |

Label any inferred judgement (`[inferred from JD]` / `[no JD — inferred]`).

**Escalation offer** — if a real JD link or full JD text is present:

> "There's a real JD here — want me to run a full A-G evaluation and save a
>  report before replying? [y/n]"

If yes → read `modes/_shared.md` + `modes/evaluate.md`, run the evaluation, and
fold its composite/fit into the reply and the thread note.

---

## Step 5 — Draft the reply (fit-aware)

Voice and register come from `modes/_profile.md`. Output a clean, ready-to-paste
block. Length scales down with fit.

### Reply stance (the tone layer — resolve this first)

The **stance** sets how warm, brief, and forward-leaning the reply is. Resolve it
by precedence — **lowest scope wins**:

```
one-off (this draft)  >  per-recruiter (dossier Known Facts)  >  global (_profile.md → Your Recruiter Handling)  >  default: warm-open
```

The four presets:
- **warm-open** *(default)* — friendly and open; share the resume on request; ask
  for the JD politely; propose a call only for strong-fit roles.
- **eager** — friendly and proactive; offer the resume *and* propose a call right
  away on anything plausible.
- **curt** — brief and businesslike; minimal pleasantries.
- **gatekeeper** — firm; require company + JD + comp before any intro call.

If the user has no saved stance, use **warm-open** — never default to a cold or
demanding tone. A `Stance-Agency` / `Stance-InHouse` value (if set) overrides the
base `Stance` for that recruiter type.

**Stance bounds delivery, never content.** It changes warmth and how readily you
offer the resume or a call — it does **not** license embellishment. `eager` never
invents experience, enthusiasm, or skills the user lacks; every claim still traces
to `cv.md` / `config/profile.yml` (the NEVER rules hold at every stance).

**Treat the presets as equally valid** — `eager` is a legitimate market-entry
strategy, not desperation; `gatekeeper` is not "more professional." Never profile
the user's career stage to pick a stance.

### Per-verdict strategy (what to communicate)

Apply the resolved stance to each verdict:

- **STRONG** → warm; express genuine interest; propose a concrete next step (a
  short call); ask only the 1–2 still-missing facts. (Up to ~6 sentences.)
- **WORTH-EXPLORING** → interested-but-qualifying; ask the key gating questions
  (comp / location / scope) before committing time. (~2–4 sentences.)
- **WEAK** → terse, gracious decline (**1–2 sentences**); keep the door open.
  **Mandatory:** restate the user's actual boundaries from `config/profile.yml`
  — level, comp floor, location — so the recruiter can re-target. A decline must
  *train the recruiter*, never just close the door. (e.g. "Not a fit right now —
  please keep me in mind for Staff+ roles at $X+ base, remote-US.")
- **INSUFFICIENT-INFO** → terse ask for the missing specifics (**1–2 sentences**).
  (e.g. "Sounds interesting — send the JD and comp band and I'll take a look.")
- **networking** (from Step 2.5) → short, warm, human catch-up. No fit talk, no JD demand.

### Recruiter-type bias (shapes content, NOT tone)

Type informs *what* you ask about; the **stance** owns the tone. Do not let Type
turn a reply cold unless the resolved stance is `gatekeeper`.

- **in-house** (recruiter sits inside a target company) → bias toward
  bridge-building. Even on a WEAK fit, stay warm, explain what you *are* looking
  for, and ask them to keep you in mind. Protect this relationship.
- **agency** (third-party) → the client is usually hidden, so it's fair to ask
  *which company* the role is with (alongside the JD). Keep the tone set by the
  stance — `warm-open` stays warm; only `gatekeeper` makes company/JD/comp a hard
  precondition for a call.
- **unknown** → use the resolved stance as-is. When you're already asking for
  missing info (WORTH-EXPLORING / INSUFFICIENT-INFO), also fold in a brief ask
  whether they're an internal talent partner or representing a client — the answer
  resolves the `Type` for next time. Don't add this to a STRONG or WEAK reply.

Always reuse standing answers from the dossier rather than re-asking settled questions.

---

## Step 6 — Confirm & persist

**Approval gate scales with stakes:**
- **STRONG / WORTH-EXPLORING** → show the draft and let the user edit/approve
  before persisting (a call or commitment may be at stake).
- **WEAK / INSUFFICIENT-INFO / networking** → output the copy-paste text
  immediately, no yes/no gate.
- `--yes` / `--no-confirm` → no gate anywhere.

**Persist regardless of the gate.** The thread entry is logged either way; the
reply is recorded as *drafted* (the user may send something slightly different —
`recruiter --log <name>` reconciles after the fact).

**Write safety (User Layer — critical):**
- Never blind-overwrite and never rely on a naive append.
- Read the entire existing dossier, regenerate the full updated markdown
  **preserving every prior thread**, then write the whole file back. (On CLIs
  that support precise in-place edits, a targeted edit block is preferred and
  even safer.) Before writing, verify no prior thread was dropped or truncated.
- For a **new** recruiter, create `data/recruiters/{slug}.md` from the dossier
  schema below.

The regenerated dossier must:
- Append to the matched thread: the inbound summary, the **Fit** verdict, and the
  drafted **my reply** line, each dated `YYYY-MM-DD`.
- **Compact dead threads:** collapse any thread now in a `dead`/closed state into
  a one-line entry under `## Historical Threads`. **Before collapsing, hoist any
  durable facts** from that thread (comp ceilings floated, tech-stack/location
  constraints, why it was a misfit, the recruiter's responsiveness) up into
  **Known Facts** so they survive the compaction.
- **Consolidate Known Facts** (don't just append): keep it under ~7 concise
  bullets; *replace* superseded facts rather than stacking (e.g. overwrite
  "Targeting $200k (2025)" with "Targeting $220k (2026)").
- Update the header `Last contact` (and `First contact` / `Type` / agency if newly learned).

**Then** update the recruiter's row in `data/recruiters.md` — and do it
**read-before-write** (this is where the deferred roster read is finally paid):
1. **Read** `data/recruiters.md` to load the current table.
2. Find the recruiter's existing row, or add a new one if absent (never blind-append).
3. Update that row's Threads / Open / Last Contact columns.
4. Write the whole table back, leaving every other recruiter's row intact.

This is the only place the roster is touched — it stays out of the Step 0–5 hot path.

### Offer bridges (non-blocking)

- STRONG / WORTH-EXPLORING with a real role:
  > "Add this to your pipeline for a full evaluation? [y/n]"
  If yes → append a row to the **Pending** table in `data/pipeline.md`.
- If a thread reaches applied/interviewing → suggest logging it in `data/applications.md`.

---

## Step 6.5 — Learn the user's stance (debounced)

If the user reacts to a draft with a tone/handling preference, capture it — but
**debounce**: a single offhand reaction must not silently rewrite their global
outward persona. Classify the signal first:

- **Explicit calibration command** — "always be eager", "never demand comp up
  front", "use a curt tone from now on". The command *is* the consent → **write
  it directly** to the stance field, then confirm in one line.
- **Inferred from a reaction** — "that felt cold", "I'd have shared my resume",
  "too pushy". Apply it to the **current draft only**, then offer to make it
  permanent with an inline gate, showing the exact rule:
  > "Want me to make 'warm-open, share resume readily' your default from now on? [y/n]"
  Write only on `y`.
- **One-off** — "just this time, propose a call" → apply to this draft, persist nothing.

**Where a confirmed write lands (scope):**
- General ("…with recruiters") → global `Stance` in `_profile.md` →
  `## Your Recruiter Handling`. Create the section if it doesn't exist yet
  (this is a User-layer write — announce it; never silent).
- Type-specific and explicitly stated ("…with **agency** recruiters") →
  `Stance-Agency` / `Stance-InHouse` in that section.
- About one named recruiter → that recruiter's dossier `Known Facts` as a
  per-recruiter stance override (e.g. "Stance for this recruiter: curt").

**Never** let a global stance write overwrite an explicit per-recruiter override
(precedence: one-off > per-recruiter > global).

---

## `## Your Recruiter Handling` schema (in `modes/_profile.md`)

Written by Step 6.5 once a stance is learned — does not exist until then.

```markdown
## Your Recruiter Handling
- Stance: warm-open                 <!-- warm-open | eager | curt | gatekeeper -->
- Resume: share readily on request
- Calls: selective — strong-fit roles only
- Ask-first: JD (politely); don't demand comp/company up front
- Stance-Agency: (unset → use Stance)
- Stance-InHouse: (unset → use Stance)
- Notes: <edge-case routing only — NOT core tone>
```

Core behavior always resolves to one of the four presets; `Notes` is for narrow
edge-case routing, never a place to stack contradictory tone instructions.

---

## Dossier schema — `data/recruiters/{slug}.md`

```markdown
# {Recruiter Name}

- **Type:** agency            <!-- agency | in-house | unknown -->
- **Agency/Employer:** {agency name, or "in-house @ Foo", or "unknown"}
- **Contact:** {linkedin url}  |  {email}
- **First contact:** {YYYY-MM-DD}
- **Last contact:** {YYYY-MM-DD}
- **Relationship notes:** {one-line read on them — responsiveness, specialties}

## Known Facts (accumulated)

<!-- Consolidate-and-dedup. Cap ~7 bullets. Replace superseded facts. -->
- Companies pitched: {...}
- Domains/levels: {...}
- Comp ranges floated: {...}
- Standing answers I've given: {...}

## Threads

### Thread 1 — {Company} / {Role}   `[status: open]`
<!-- status: open | exploring | declined | interviewing | applied | dead -->
- `{YYYY-MM-DD}` ⟵ **inbound:** {one-line summary of their message}
- **Fit:** {VERDICT} — {one-line why}
- `{YYYY-MM-DD}` ⟶ **my reply:** {one-line summary of the drafted reply}

## Historical Threads

<!-- Dead/closed threads compressed to one line each. -->
- {Company} / {Role} — {outcome} {YYYY-MM} ({short reason})
```

For `networking` touches with no role, log under a single `### Thread — General /
Networking` block rather than a job thread.

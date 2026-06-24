# Phase 8b — Recruiter Reply Stance (learned, soft by default)

**Status:** ✅ Implemented 2026-06-23 (mode + spec reconciliation done; §6 scenario tests pending real messages)
**Version:** 0.2
**Last Updated:** 2026-06-23 -- debounced learning loop (explicit→direct write, inferred→confirm, transient→RAM), explicit shadowing precedence, 4-preset lock + constrained Notes, fabrication guard under Eager, type-split on explicit mention; §8 decisions resolved
**Owner:** rifat
**Extends:** Phase 8 (`plan_rs/phase8-recruiter.md`, `modes/recruiter.md`)

---

## 1. Problem

Phase 8 hardcoded a single reply posture — the firm "agency criteria-wall"
(demand company + JD + comp before any call), inherited from Gemini's
"Senior Director" review persona — as the **universal default**. On a real
dry-run (Tom Poole, agency, undisclosed power-semi client, VP S&A role), the
drafted reply came out cold and demanding: it listed four things the recruiter
must provide before the user would even talk.

That is wrong as a default. The actual user is **open**: happy to send a resume
on request, wants the JD asked for *politely*, and is selective only about
*calls* (reserved for strong-fit roles). And different users want different
things — some want curt replies, some want to share the resume and book a call
immediately. The posture must be **per-user data, learned over time**, not a
hardcoded persona. Critically: it must **not** be pre-seeded — the system should
learn it as it works with the user.

---

## 2. Goal

- **Default reply tone = warm-open** (friendly, open, resume-on-request, polite
  JD ask, calls only for strong fits) when nothing is recorded.
- **Support the full spectrum** of stances (warm-open / eager / curt / gatekeeper
  / custom) so any user fits.
- **Learn the stance from user feedback** and persist it to the User layer
  (`modes/_profile.md`), nothing pre-seeded.
- **Demote** the firm agency-wall from default to an opt-in stance.

---

## 3. Design — a 3-tier stance model

Stance becomes **data, not code**, with a soft default and three scopes:

| Scope | Lives in | Example |
|-------|----------|---------|
| **Global stance** (the user's baseline) | `modes/_profile.md` → new `## Your Recruiter Handling` section | "warm-open; share resume readily; selective on calls" |
| **Per-recruiter override** | that recruiter's dossier `Known Facts` | "For Tom's agency specifically, stay curt" |
| **One-off** | just this draft | "this time, propose a call" — not stored |

When no stance is recorded anywhere → **default = warm-open**. The
`## Your Recruiter Handling` section does not exist until the AI learns something.

### 3.0 Shadowing precedence (resolve overrides deterministically)

The mode must apply stance in strict priority order — **lowest scope wins**:

```
One-off (this draft)  >  Per-recruiter (dossier)  >  Global (_profile.md)  >  built-in warm-open default
```

Rules:
- A **global** stance update must NEVER overwrite an explicit **per-recruiter**
  override. They live in different places (dossier vs `_profile.md`) and the
  dossier value shadows the global at draft time.
- A **one-off** instruction affects only the current draft and is never written
  anywhere.
- Per-recruiter overrides depend on a stable slug — rely on the Phase 8 name
  normalization (strip titles/emojis, Unicode→ASCII) so `Jane Smith` and
  `Jane Smith, PMP` map to the same dossier and don't fork the override.

### 3.1 Named presets (the mode understands these)

- **warm-open** *(default)* — friendly, open; share resume on request; ask JD
  politely; calls only for strong-fit roles.
- **eager** — share resume *and* propose a call right away on anything plausible.
- **curt** — brief, businesslike, minimal pleasantries.
- **gatekeeper** — the firm "company + JD + comp before any intro call" wall
  (the old Phase 8 default, now opt-in).
- **custom** — free-text nuance layered on top of any preset.

### 3.2 `## Your Recruiter Handling` schema (written only after it's learned)

```markdown
## Your Recruiter Handling
- Stance: warm-open                 <!-- one of: warm-open | eager | curt | gatekeeper -->
- Resume: share readily on request
- Calls: selective — strong-fit roles only
- Ask-first: JD (politely); don't demand comp/company up front
- Stance-Agency: (unset → use Stance)    <!-- optional type split, only when user splits -->
- Stance-InHouse: (unset → use Stance)   <!-- optional type split, only when user splits -->
- Notes: <edge-case routing only — NOT core behavior>
```

**Locked-state rule (no analog drift):** the core behavior always resolves to
exactly one of the four presets. `Notes` is for narrow edge-case routing
("for repeat hardware roles, mention the patent"), never a place to accumulate
contradictory tone instructions. If a note would change the core tone, it should
instead change the `Stance` field.

This is a new **section** inside the existing `modes/_profile.md` (User layer).
It is therefore **already covered by porting** — `_profile.md` ports under the
`core` group (overwrite). **No `port.md` / `port-manifest.yml` change needed.**

---

## 4. The learning loop (how the AI "knows to update")

A standing behavior in `modes/recruiter.md` (new Step 6.5). The loop is
**debounced** — a single transient reaction must not rewrite the user's global
outward persona. Writes to `_profile.md` (the "non-volatile" layer) happen under
exactly two conditions; everything else stays in the current draft only.

1. **Detect** a preference signal from the user's reaction or instruction.
2. **Classify by source (debounce):**
   - **Explicit calibration command** ("always be eager", "never demand comp
     up front", "use a curt tone from now on") → the command *is* the consent.
     **Write directly** to the appropriate stance field, then notify in one line.
   - **Inferred from a reaction** ("this felt cold", "I'd have shared my resume")
     → apply it to the **current draft only** (transient / RAM), then **offer**
     to make it permanent with an inline gate:
     > "Want me to make 'share resume readily, warmer tone' your default from now
     >  on? [y/n]" → write only on `y`.
   - **One-off** ("just this time, propose a call") → apply to this draft, persist nothing.
3. **Classify by scope** (where a confirmed write lands):
   - General ("…with recruiters") → global `Stance` in `_profile.md`.
   - Type-specific, explicitly stated ("…with agency recruiters") → `Stance-Agency`
     / `Stance-InHouse` split in `_profile.md`.
   - About one named recruiter → that recruiter's dossier `Known Facts` (per-recruiter override).
4. **Transparency guard:** before any `_profile.md` write that wasn't an explicit
   command, show the exact rule being saved and get `[y/n]`. Never silently change
   the face presented to the market.

---

## 5. Mode changes (`modes/recruiter.md`)

- **Step 0** already reads `_profile.md`; also parse the
  `## Your Recruiter Handling` section if present (no extra read cost).
- **Step 5 default flips to warm-open.** Apply the recorded stance if present;
  else warm-open. Length/verbosity rules still apply within the stance.
- **Demote the agency wall (Step 5 type-bias block).** Recruiter `Type`
  (agency / in-house) still shapes **content** — e.g. agencies hide the client,
  so politely asking "which company?" remains fair, and in-house at a target
  company still biases toward bridge-building — but Type no longer forces a cold,
  demanding **tone**. Tone is owned by the learned stance.
- **Resolve stance by precedence** (§3.0) before drafting: one-off → per-recruiter
  → global → warm-open.
- **Add Step 6.5** — the debounced learning loop from §4.

**Stance bounds content NEVER, only delivery (critical):** a stance changes
warmth, brevity, and how readily the reply offers the resume or a call. It must
**never** change the truthfulness or scope of claims. `eager` does **not** license
embellishment, invented experience, or keyword-matching skills the user lacks —
the Phase 8 NEVER rules ("never fabricate enthusiasm or qualifications") hold at
every stance. Getting caught overstating in an intro call is a worse outcome than
a missed reply.

**Neutral framing (no career-stage profiling):** present all four presets as
equally legitimate strategies. `eager` (share resume + propose a call on anything
plausible) is a valid market-entry play, not desperation; `gatekeeper` is not
"more professional." Do **not** auto-classify the user's seniority/career stage to
pick a stance — that's presumptuous and brittle. Instead, `setup` MAY *offer* a
starting stance (optional integration); otherwise the default is warm-open until
the user says otherwise.

No change to the lazy-load pipeline, the gate, `[Analysis]`, fit verdicts, or the
write-safety / roster / compaction logic from Phase 8.

---

## 6. Implementation Steps + Verification

1. **Flip default + read stance** in `recruiter.md`.
   *Verify:* dry-run the Tom Poole message with an empty profile → produces a
   warm, resume-friendly, polite-JD reply (no four-item wall).
2. **Add presets.**
   *Verify:* dry-run the same message under each preset → curt = terse;
   eager = resume + call proposed; gatekeeper = the old wall; warm-open = soft.
3. **Add the debounced learning loop + `## Your Recruiter Handling` schema.**
   *Verify (debounce):*
   - Inferred reaction ("too cold") → applies to the current draft, then asks
     `[y/n]` before writing; on `n`, nothing is persisted.
   - Explicit command ("always be eager") → writes directly, no confirm.
   - One-off ("just this time, propose a call") → persists nothing.
4. **Scope routing + precedence.**
   *Verify:* "for Tom, stay curt" lands in Tom's dossier `Known Facts`, not the
   global profile; a later global change does NOT override Tom's curt setting
   (precedence: per-recruiter > global). "I share my resume with **agency**
   recruiters" writes `Stance-Agency`, leaving `Stance-InHouse` on default.
5. **Fabrication guard under stance.**
   *Verify:* under `eager`, a vague pitch still produces a reply with zero invented
   experience or unclaimed skills (claims trace to `cv.md`).
6. **Update spec + roadmap.**
   *Verify:* `phase8-recruiter.md` notes the soft default + stance learning;
   `CONSOLIDATION-PLAN.md` version/timestamp bumped, Phase 8b recorded.
   *(Done after review/approval — not while this is a draft.)*

---

## 7. File Change List

**Modified (System Layer):**
- `modes/recruiter.md` — soft default, stance presets, demoted agency wall, Step 6.5 learning loop
- `plan_rs/phase8-recruiter.md` — cross-reference + soft-default note
- `plan_rs/CONSOLIDATION-PLAN.md` — Phase 8b entry (post-approval)

**Touched at runtime (User Layer — by the mode, with notification):**
- `modes/_profile.md` — new `## Your Recruiter Handling` section (learned)
- `data/recruiters/{slug}.md` — per-recruiter stance overrides in `Known Facts`

No new files. No porting changes (the learned stance rides inside `_profile.md`).

---

## 8. Resolved Decisions (Gemini review — EE + recent-grad personas, 2026-06-23)

1. **Learning autonomy → Hybrid (debounced).** Explicit calibration commands write
   directly (the command is the consent); preferences *inferred* from a reaction
   apply to the current draft only and require an inline `[y/n]` before any
   `_profile.md` write; one-offs persist nothing. Reconciles the user's "update as
   it works" intent (AI still drives it) with the EE/grad stability + transparency
   concerns. (§4.) **Note:** this shifts the v0.1 recommendation from auto-save to
   confirm-on-inferred — user may override toward fuller autonomy if desired.
2. **Default scope of a first correction → Global, with explicit type-split.**
   Default writes the global `Stance`; only when the user explicitly references a
   recruiter type ("…with agency recruiters") does it write `Stance-Agency` /
   `Stance-InHouse`. (§3.2, §4.)
3. **Preset count → Keep four** (warm-open / eager / curt / gatekeeper) + a
   constrained `Notes` field for edge-case routing only. Unanimous across both
   personas; maps to real career-stage realities without rule sprawl. (§3.1, §3.2.)

### Deliberately rejected
- **Auto-nudging by career stage** (grad persona's "detect grad → push eager"):
  declined as presumptuous and brittle. Presets are framed neutrally and `setup`
  may *offer* a starting stance instead. (§5.)

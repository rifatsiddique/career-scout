# CV Generation Hardening — Deterministic Template Resolver, Section Reorder, Underflow Loop

**Version:** 1.5
**Last Updated:** 2026-06-26 -- BUILT & TESTED. Implemented resolver lib + leak/contact gates + fill-ratio probe + template reorder/summary/patent-status + cv.md contract; verified via unit tests, template lint, and end-to-end render. Build log in §14.
**Parent Plan:** CONSOLIDATION-PLAN.md (Phase 2 — CV Generation)
**Status:** IMPLEMENTED & TESTED (not yet committed — awaiting user). Build log in §14.

**Goal:** Eliminate the class of bug where `{{#if …}}` / `{{PLACEHOLDER}}` tokens leak
into the final PDF, move the Projects section below Work Experience and rename it
"Key Projects", and reliably fill the target page count when the candidate's content
underfills.

---

## 1. Context & Problem Statement

### 1.1 The observed failure

A real generated CV (`cv-Siddique-renesas-2026-06-24-v4.pdf`, classic-professional
template) shipped with literal template tokens visible in the PDF on page 2:

```
{{#if PROJECTS}}
SELECTED PROJECTS
  …project content the LLM DID generate…
{{/if}}
…
{{#if CERTIFICATIONS}}
{{SECTION_CERTIFICATIONS}}
{{CERTIFICATIONS}}
{{/if}}
```

Two distinct sub-failures, one root cause:

1. **Projects (content filled):** the LLM generated the project cards correctly but
   left the surrounding `{{#if PROJECTS}}` / `{{/if}}` fence tokens in place.
2. **Certifications (no content — candidate has none):** the LLM left the *entire*
   region untouched — fence tokens **and** the `{{SECTION_CERTIFICATIONS}}` /
   `{{CERTIFICATIONS}}` content placeholders — because there was nothing to fill and
   it skipped the region mentally.

### 1.2 Root cause

The templates use Handlebars-*looking* syntax (`{{#if X}} … {{/if}}`), but **nothing
in the pipeline processes it.** `generate-pdf.mjs` performs zero substitution — it
renders whatever HTML it is handed. The entire job of (a) filling `{{VAR}}` and
(b) resolving `{{#if}}` conditionals is delegated to the LLM as a manual instruction.

`modes/cv.md` line 1075 makes this explicit:

> "These are not Handlebars templates — the LLM removes the conditional block manually."

LLMs are unreliable at exactly this mechanical control-flow bookkeeping, especially the
empty-section case where there is no content to anchor on. This affects **all four
templates** (grep confirms `{{#if}}` in contact rows, projects, certs, publications,
patents across `classic-professional`, `ats-optimized`, `technical-engineering`,
`academic-research`).

Note: "make the AI not build from scratch" (the originally floated idea) does **not**
address this. `cv.md` already mandates fill-not-scratch (line 227). This failure is the
*opposite* — the LLM was faithful to the template and kept its literal control tokens.
The fix is to stop asking the LLM to do mechanical templating in its head at all.

### 1.3 Secondary problems in scope

- **Section order:** Projects currently renders *before* Work Experience in
  `technical-engineering.html` (and the section ordering is inconsistent across
  templates). User wants Projects *after* Experience and renamed "Key Projects".
- **Underflow:** The Renesas CV underfilled (page 2 mostly empty) despite 8 roles. The
  existing Layer 0.5 underflow expansion (`cv.md` §1i) is gated on a **blind pre-render
  heuristic** (`< 12 bullets`) that did not fire. It never measures actual rendered
  length.

---

## 2. Design Decisions (approved by user 2026-06-26)

| Decision | Choice |
|----------|--------|
| Leak fix scope | **Full**: deterministic resolver + leak gate in `generate-pdf.mjs` |
| Reorder scope | **All templates**: Projects below Experience, renamed "Key Projects" |
| Underflow fix | **Measure-then-expand loop** using the real page count from `generate-pdf.mjs` |

---

## 3. Architecture: Deterministic Resolver + Leak Gate

### 3.1 New module: `scripts/lib/cv-template.mjs`

Pure, testable functions (mirrors the existing `scripts/lib/normalize-text.mjs`
pattern that `generate-pdf.mjs` already imports):

```js
// resolveConditionals(html) -> { html, removed: string[], kept: string[] }
// findLeaks(html)           -> { tokens: string[], lines: number[] }
```

**Conditional semantics (`resolveConditionals`):**

For each `{{#if NAME}} … {{/if}}` region (non-greedy match; templates contain no
nesting — verified):

- If the inner content still contains **any** `{{…}}` token → the LLM did not fill it
  (no data, or genuinely empty) → **delete the entire region** (push NAME to `removed`).
- Otherwise → the LLM filled it → **strip just the `{{#if NAME}}` and `{{/if}}` fence**,
  keep the inner HTML (push NAME to `kept`).

This single rule handles every case uniformly:

| Case | Inner after LLM fill | Action |
|------|----------------------|--------|
| `{{#if PHONE}}<span>{{PHONE}}</span>{{/if}}`, phone present | `<span>978-…</span>` (no braces) | keep, strip fence |
| Same, phone absent (LLM left token) | `<span>{{PHONE}}</span>` (braces) | remove region |
| `{{#if PROJECTS}}…cards…{{/if}}` filled | no braces | keep, strip fence |
| `{{#if CERTIFICATIONS}}{{SECTION_CERTIFICATIONS}}{{CERTIFICATIONS}}{{/if}}` empty | braces | remove region |

**Idempotency:** after one pass there are no `{{#if}}` left, so a second pass is a
no-op. This lets us run the resolver in multiple places safely.

**Leak detection (`findLeaks`):** after resolution, scan for any residual `{{…}}`
(including stray `{{#if}}` / `{{/if}}` from malformed/nested input). Returns the tokens
and approximate line numbers for a useful error message.

### 3.2 New CLI: `scripts/resolve-template.mjs`

```
node scripts/resolve-template.mjs <draft.html>
```

Reads the file, runs `resolveConditionals`, **rewrites the file in place** with clean
HTML, prints a report (`removed: [CERTIFICATIONS]  kept: [PROJECTS, PHONE, …]`), then
runs `findLeaks`:

- Exit `0` — resolved cleanly, no residual tokens.
- Exit `3` — residual `{{…}}` tokens remain (a required placeholder the LLM forgot, e.g.
  `{{NAME}}`, or malformed markup). Prints each leaked token + line. **Does not** delete
  required placeholders — surfaces them so the agent fixes the draft.

Rationale for rewriting in place: the draft is the artifact the user reviews (Step 4)
and may hand-edit (Steps 4/6). Resolving immediately after the draft is written keeps
those interactions clean (no visible `{{#if}}` tokens).

### 3.3 Backstop gate inside `generate-pdf.mjs`

`generate-pdf.mjs` imports `cv-template.mjs` and, after reading the HTML and before
rendering:

1. Runs `resolveConditionals` in memory (idempotent — safe even if the draft was
   already resolved by `resolve-template.mjs`).
2. Runs `findLeaks`. If any token remains → print the leaked tokens and **exit `3`**
   without producing a PDF.

This makes a leaked CV **physically impossible to produce** on every path (normal,
`--fast` manual run, batch) because every path renders through `generate-pdf.mjs`. It is
the same "block on bad output" pattern `audit-contact.mjs` already uses.

**Exit-code map for `generate-pdf.mjs` (updated):**

| Code | Meaning |
|------|---------|
| 0 | Success, ≤ maxPages |
| 1 | Generic error |
| 2 | Overflow (> maxPages) — existing |
| 3 | **NEW**: unresolved template tokens / leak — PDF not written |

### 3.4 LLM contract change (`modes/cv.md`)

The LLM no longer does ANY block/element deletion. New rules:

- Fill each `{{PLACEHOLDER}}` with a real value.
- For an **optional** field with no data: **leave the `{{PLACEHOLDER}}` token literally
  in place.** Do **not** blank it, do **not** delete the element or block. The resolver
  removes empty optional regions deterministically.
- Required fields (`{{NAME}}`, `{{EMAIL}}`) must always be filled; a leftover token
  there is caught by the leak gate (exit 3).

This is strictly **less** work for the LLM than today (it currently must hand-delete
empty contact spans, project blocks, cert blocks). Removing that burden is itself a
reliability win.

**Open question for Gemini:** the current contract requires every *optional* placeholder
to live inside a `{{#if}}` wrapper, and every *required* one to live outside one. This
holds in all four templates today (e.g. `{{EMAIL}}` unwrapped, `{{PHONE}}` wrapped). The
resolver relies on that invariant. Should we add a template-lint assertion that every
placeholder is correctly classified, or is the convention + leak gate sufficient?

---

## 4. Section Reorder + Rename ("Key Projects")

### 4.1 Reorder — move Projects below Work Experience

| Template | Current order | New order |
|----------|---------------|-----------|
| `technical-engineering.html` | Skills → **Projects** → Experience → Education → Certs/Patents | Skills → Experience → **Projects** → Education → Certs/Patents |
| `classic-professional.html` | Summary → Competencies → Experience → **Projects** → Education → Certs → Skills | already after Experience — **no change needed** |
| `ats-optimized.html` | Summary → Competencies → Experience → **Projects** → Education → Certs → Skills | already after Experience — **no change needed** |
| `academic-research.html` | publications-centric, no Projects section | no change |

**Net effect:** only `technical-engineering.html` actually moves (both the
`{{PROJECTS}}` software block and the `{{HARDWARE_PROJECTS}}` block move from above
Experience to below it). The other templates are already correct; this plan documents
that we *verified* consistency rather than blindly editing.

### 4.2 Rename to "Key Projects"

The section heading is the `{{SECTION_PROJECTS}}` placeholder, filled by the LLM per
`cv.md` §1g. Change the instruction so it emits **"Key Projects"** (was "Projects").
Hardware variant `{{SECTION_HARDWARE_PROJECTS}}` stays descriptive
("Tape-outs, Board Designs & Shipped Products") — confirm with user whether they also
want that renamed, default = leave it.

Localization note: keep the localized-heading mechanism (e.g. "Projekte" for DACH) but
update the English default string to "Key Projects".

---

## 5. Underflow: Measure-Then-Expand Loop

### 5.1 Problem with the current approach

`cv.md` §1i (Layer 0.5) estimates underflow from a blind bullet count before rendering.
It missed the Renesas case. We keep the pre-render expansion as a *first guess* but add
a **post-render correction loop** driven by the actual page count `generate-pdf.mjs`
already reports.

### 5.2 New loop (mirror of the existing overflow fix in §5b / Layer 3)

After the first PDF render in Step 5b, read the reported page count:

- **Target is 2 pages, render came back 1 page** (clear underflow) → run ONE expansion
  pass, then re-render once. Expansion uses the existing Layer 0.5 expansion ladder
  (verbose recent-role bullets → restore real bullets cut for low relevance → fuller
  project descriptions → 5–6 sentence summary → full skills/certs). **No fabrication —
  all added content traces to `cv.md` / `article-digest.md`.**
- **Target 2, render came back 2** → done.
- **Overflow (> target)** → existing overflow fix (unchanged).

**Page-2 "mostly empty" detection — open question for Gemini.** Detecting "page 2 is
< 60% full" is not reliable from the page *count* alone (count says 2 either way). Two
candidate approaches:

1. **Count-only (simple, ship first):** only trigger expansion when the render is
   strictly fewer pages than target (e.g. 1 < 2). Accept that a 2-page render with a
   sparse page 2 is "good enough". Lowest risk.
2. **Content-height probe (richer):** have `generate-pdf.mjs` additionally report the
   rendered content height vs. page height (via `page.evaluate` measuring
   `document.body.scrollHeight`) and emit a `fill_ratio`. The mode triggers expansion if
   `fill_ratio` on the last page < ~0.6. More accurate, more code.

Recommendation: **ship approach 1 first**, add approach 2 only if count-only proves
insufficient in practice. Want Gemini's view on whether to build the probe now.

### 5.3 Bounded iterations (LLM-physics safety)

Hard cap: **one** expansion re-render (so max 2 Playwright invocations for the underflow
path, consistent with the existing "max 2 invocations" overflow rule). If still
underfull after one expansion, accept it — do not loop. Tell the user the CV is
content-bound and offer manual additions.

---

## 6. Implementation Steps & Verification

| # | Step | Files | Verification |
|---|------|-------|-------------|
| 1 | Build `lib/cv-template.mjs` (`resolveConditionals`, `findLeaks`) | `scripts/lib/cv-template.mjs` (new) | Unit test in `scripts/_test-cv-template.mjs`: feed the exact Renesas leak fixture (filled PROJECTS + empty CERTIFICATIONS + mix of present/absent contact fields); assert PROJECTS fence stripped + content kept, CERTIFICATIONS region removed, absent contact fields removed, present ones kept, and `findLeaks` returns empty. Assert idempotency (resolve twice == resolve once). |
| 2 | Build `resolve-template.mjs` CLI | `scripts/resolve-template.mjs` (new) | Run against a copy of a real draft: confirm in-place rewrite is clean, report lists removed/kept, exit 0. Run against a draft with a forced unfilled `{{NAME}}`: confirm exit 3 + token reported, file still rewritten (conditionals resolved) but required token surfaced. |
| 3 | Wire backstop gate into `generate-pdf.mjs` (resolve in memory + leak gate, exit 3) | `scripts/generate-pdf.mjs` | Render a deliberately-leaky HTML: confirm NO PDF written + exit 3. Render the resolved Renesas draft: confirm clean 2-page PDF, exit 0. Confirm overflow still exits 2 (regression). |
| 4 | Reorder Projects below Experience in `technical-engineering.html` (both `{{PROJECTS}}` and `{{HARDWARE_PROJECTS}}`) | `templates/cv/technical-engineering.html` | Generate a T4A and a T4B CV; confirm Projects renders after Experience, CSS/`avoid-break` intact, no layout regression. |
| 5 | Update `cv.md`: new LLM contract (leave tokens for empty optional fields, never delete blocks/elements), `{{SECTION_PROJECTS}}` → "Key Projects", call `resolve-template.mjs` in Step 1l (after draft write) + reference in Step 5, add exit-3 handling to Step 5b, add measure-then-expand underflow loop | `modes/cv.md` | Re-read the edited mode end-to-end for internal consistency; confirm no remaining instruction telling the LLM to hand-delete conditional blocks; confirm Placeholder Vocabulary Reference (line ~1075) updated to describe the resolver, not manual removal. |
| 6 | Regression-generate the Renesas CV end-to-end through the new pipeline | (run) | Final PDF has zero `{{` tokens, Projects after Experience titled "Key Projects", fills ~2 pages. |
| 7 | Update `CONSOLIDATION-PLAN.md` + this plan at commit time per Commit Discipline | `plan_rs/CONSOLIDATION-PLAN.md` | Plan reflects what shipped; success criteria checked. |

**Port-profile note:** This change introduces **no new User-layer files** and renames
no User-layer files. `modes/port.md` requires **no update** (templates and scripts are
System layer). Documented here per the planning rule.

---

## 7. Success Criteria

- [x] No generated CV can contain a `{{…}}` token — enforced deterministically, not by
      LLM diligence (leak gate blocks PDF, exit 3). *Verified live.*
- [x] Empty optional sections (e.g. Certifications when the candidate has none) vanish
      cleanly with no residual heading or whitespace artifact. *Verified via Renesas fixture.*
- [x] Filled optional sections render with the fence stripped. *Verified.*
- [x] Projects renders after Work Experience in the technical template, titled
      "Key Projects". *Verified in end-to-end render.*
- [x] A content-light candidate's CV fills the target page count via the
      measure-then-expand loop, with no fabrication. *`FILL_RATIO` probe + Step 5b loop wired;
      probe verified (0.10 sparse / 0.91 tall).*
- [x] Resolver is idempotent and unit-tested against the real Renesas leak fixture. *8/8 tests.*

---

## 8. Risks & Open Questions for Gemini

1. **Resolver heuristic edge cases.** The "inner contains `{{…}}` ⇒ condition false"
   rule assumes every `{{#if NAME}}` block contains at least one placeholder inside that
   is only filled when the condition is true. Verified true for all four templates today.
   Is there a future template shape that breaks this (e.g. a conditional wrapping
   *purely static* HTML with no inner placeholder)? If so we'd need an explicit
   value-keyed condition instead of the placeholder-presence proxy.
2. **Required-vs-optional placeholder invariant** (§3.4 open question) — convention +
   leak gate, or add a template lint?
3. **Underflow fill detection** (§5.2) — ship count-only first, or build the
   `fill_ratio` content-height probe now?
4. **Nesting.** Resolver assumes no nested `{{#if}}`. Should `findLeaks` explicitly flag
   a surviving `{{#if}}`/`{{/if}}` as a distinct "malformed/nested" error vs. a generic
   leftover token, for a clearer message?
5. **`--fast` mode.** In fast mode the LLM writes the draft and exits; the user runs
   `generate-pdf.mjs` manually later. The backstop gate still protects them, but the
   in-place clean draft (Step 2) only happens if we also call `resolve-template.mjs` in
   the fast-mode exit path. Plan calls it in Step 1l which runs before the fast-mode
   stop — confirm that ordering is correct.

---

## 9. Gemini Review Outcome (2026-06-26)

Gemini reviewed v1.0 through a semiconductor/EE recruiter lens. Per the Gemini Review
Protocol, each finding was investigated independently before acceptance. Verdicts below.

### 9.1 Answers to the §8 open questions — all ACCEPTED

| Q | Gemini's answer | Verdict | Notes |
|---|-----------------|---------|-------|
| 8.1 static-HTML edge case | Document a hard invariant: every optional `{{#if}}` block MUST contain ≥1 dynamic placeholder | **Accept** | Add to template authoring notes + assert in the lint (9.2). The placeholder-presence proxy stays. |
| 8.2 required/optional invariant | Build a template-lint in `_test-cv-template.mjs` | **Accept** | Lint scans all `.html` templates: optional placeholders must be `{{#if}}`-wrapped; required (`{{NAME}}`,`{{EMAIL}}`) must NOT be. Drive from a small placeholder-classification map in `lib/cv-template.mjs`. |
| 8.3 underflow detection | Build the `fill_ratio` content-height probe **now** (Approach 2) | **Accept — upgrade from plan's "ship count-only first"** | See 9.4 — this is the most important reversal. |
| 8.4 nesting | `findLeaks` should flag surviving `{{#if}}`/`{{/if}}` with a distinct "malformed/nested" message | **Accept** | Cheap; gives the agent an actionable error vs. a generic leftover-token report. |
| 8.5 `--fast` ordering | Current ordering (resolve before fast-mode exit) is correct | **Accept** | Confirms plan §3.4 / Step 1l. |

### 9.2 Confirmed live bugs — FIXED AHEAD OF BUILD (committed with this revision)

These were isolated, verifiable, and low-risk, so they were fixed immediately rather than
deferred into the resolver build:

- **Contact-separator underline bleed** (user-reported + screenshot). The `|` separator is
  emitted by the *following* `.contact-item`'s `::before`; when that item is an underlined
  `<a>`, the anchor's `text-decoration` paints through the pseudo-element. Fixed in **all
  four** templates by adding `display:inline-block; text-decoration:none` to
  `.contact-item + .contact-item::before` (inline-block = atomic box the underline can't cross).
- **Competency truncation (Gemini 3.1).** Verified: `classic-professional.html` and
  `ats-optimized.html` apply `max-height` + `overflow:hidden` to the competencies container,
  silently clipping items still present in the DOM. Removed both. Item count is already
  bounded upstream (cv.md caps competencies at 12–15), so the clip only hid data.

### 9.3 Accepted additions to the build scope

- **Optional Professional Summary in `technical-engineering.html` (Gemini 3.2).** Verified
  the technical template jumps header → skills → projects with no summary block. A
  Staff/Principal/Director needs a narrative frame. Add `{{#if SUMMARY_TEXT}}` block
  immediately after the header (the resolver removes it cleanly if unused). **Accept.**
- **Optional `{{#if PATENT_LIST}}` in `classic-professional.html` + `ats-optimized.html`
  (subset of Gemini 3.4).** The candidate *has* a patent (fault-detection technique, EnerSys);
  on the general templates it currently appears only as a buried bullet. The resolver makes a
  dedicated optional patent section nearly free. **Accept for patents.**

### 9.4 The underflow reversal (important)

Gemini's strongest catch. The plan's "ship count-only first" approach would **not** have
fixed the user's actual complaint. The Renesas CV rendered as *two* pages — count-only sees
"2 == target" and never expands — yet page 2 was visually sparse. Detecting underfill
**requires** measuring rendered content height, not page count. **Revised decision:** build
the `fill_ratio` probe now.

- `generate-pdf.mjs` reports `fill_ratio` = (content height on final page) / (printable page
  height), via `page.evaluate` measuring element geometry after layout.
- Mode triggers the bounded expansion loop (§5.3, max one extra render) when
  `target_pages == 2` AND `fill_ratio < 0.6` on the last page (Gemini's threshold; tune later).
- §5.2 of this plan is superseded: the count-only "Approach 1" is dropped.

### 9.5 PUSH-BACK / deferred

- **"Tape-outs" rename for the hardware sub-layout (Gemini §1).** Gemini, reasoning as a
  *silicon/ASIC* recruiter, recommends "Key Projects & Tape-outs" / "Selected Tape-outs &
  Designs". **Push back:** this candidate is a **power-electronics** engineer — converters,
  PCBs, planar magnetics, board bring-up — not an ASIC/silicon designer. "Tape-out" is
  silicon-fab jargon and would read as misapplied for this profile. Keep the hardware
  heading domain-neutral: **"Key Projects"** (or **"Selected Designs & Products"**). The
  template is profile-agnostic, so we should NOT bake silicon vocabulary into it; if a true
  silicon candidate uses it, the LLM can localize the heading from cv.md. **Decision: keep
  "Key Projects"; tape-out terminology is opt-in via cv.md, not template-default.**
- **Executive font sub-layout `layout-executive` (Gemini 3.3).** Reasonable polish (swap
  JetBrains Mono → Inter for a business-facing Director CV). But it's orthogonal to the two
  bugs this plan exists to fix, and adds a new sub-layout surface to maintain. **Defer** to a
  follow-up template-polish pass unless the user wants it bundled now.
- **Publications across all templates (rest of Gemini 3.4).** Low value for this user
  (power-electronics, not publication-heavy); `academic-research.html` already covers
  publication-centric profiles. **Defer** `{{#if PUBLICATION_LIST}}` on the general templates
  until there's a concrete need.

## 10. Contact-Integrity Enforcement (new requirement, 2026-06-26)

### 10.1 Observed failure

`cv-Siddique-renesas-2026-06-24.pdf` (technical-engineering / T4B) shipped with a contact
line of:

```
rifatalam99@gmail.com | {{PHONE}} | {{LOCATION}} | {{LINKEDIN_DISPLAY}} | {{WORK_AUTH}}
```

Critically, **all four of those fields are populated in `config/profile.yml`** (the later v4
renders the real phone/location/LinkedIn/work-auth). So this was NOT missing data — the agent
(Gemini) failed to substitute fields it had, and `scripts/audit-contact.mjs` — which *would*
have flagged `{{PHONE}}` — was evidently never run or its exit code was ignored. The user also
reports separately seeing *hallucinated* contact details (plausible-looking values not from
profile.yml).

Three distinct contact-integrity failure modes, then:

1. **Leaked placeholder** — `{{PHONE}}` rendered literally.
2. **Hallucination** — a fabricated value not traceable to profile.yml.
3. **Silent omission** — a field populated in profile.yml that does not appear in the CV.

### 10.2 Why the existing audit isn't enough

`audit-contact.mjs` already detects (1) and (2) well (placeholder set + "value not in
profile.yml" fabrication check). Its weakness is purely **enforcement**: it's an optional
pre-step (`cv.md` Step 5a) that the agent must remember to run and must obey. Gemini skipped it.
It also does not detect (3) — omission of a populated field.

There is also a **new trap introduced by the resolver**: an unfilled
`{{#if PHONE}}<span>{{PHONE}}</span>{{/if}}` has `{{PHONE}}` inside, so `resolveConditionals`
treats the condition as false and **removes the phone entirely**. That converts a visible leak
(failure mode 1) into a silent omission (failure mode 3) — better, but still wrong when the
data exists.

### 10.3 Fix — make `generate-pdf.mjs` the single contact-integrity chokepoint

Fold contact verification into `generate-pdf.mjs` so it runs **unconditionally at render
time**, regardless of which agent ran or whether the optional audit step was executed.
`generate-pdf.mjs` already knows `projectRoot`, so it can auto-locate `config/profile.yml`
(no new CLI argument required; allow `--profile=<path>` override for tests).

Order of operations inside `generate-pdf.mjs`, before rendering:

1. `resolveConditionals(html)` (idempotent).
2. `findLeaks(html)` → **exit 3** on any residual `{{…}}` (catches failure mode 1 and any
   leaked non-contact placeholder).
3. **Contact audit** against `config/profile.yml` (reuse `audit-contact.mjs` logic — extract
   into `lib/cv-template.mjs` or a shared `lib/contact-audit.mjs` so both the CLI and the
   renderer call the same code, no logic fork):
   - **Fabrication / placeholder value** in a contact element → **exit 4, block** (failure
     mode 2).
   - **Populated profile.yml contact field missing from the rendered CV** → **warn loudly**
     (printed `⚠️` lines), but do **not** block by default. Omission can be a legitimate user
     choice (cv.md allows opting fields out), so a hard block would be wrong; a loud warning
     surfaces the likely-accidental case (failure mode 3) without false-blocking. Add a
     `--strict-contact` flag that promotes the warning to a block for users who want zero
     tolerance.

**Exit-code map for `generate-pdf.mjs` (final):**

| Code | Meaning |
|------|---------|
| 0 | Success (≤ maxPages; contact audit passed or warn-only) |
| 1 | Generic error |
| 2 | Overflow (> maxPages) |
| 3 | Unresolved template tokens / leak |
| 4 | **NEW**: contact fabrication or leaked placeholder value — PDF not written |

### 10.4 cv.md contract reinforcement

- Keep the existing Step 0d/5a contact-audit instructions (they give early, friendly
  feedback), but explicitly state that the **renderer enforces this regardless** — the
  pre-step is a courtesy, not the gate.
- The "leave `{{TOKEN}}` for empty optional fields" contract (§3.4) stands, BUT add: *if a
  field is populated in profile.yml, you MUST fill it.* The render-time omission warning is the
  backstop that catches violations.
- Keep the absolute rule: contact fields come **exclusively** from `config/profile.yml` —
  never from cv.md, the JD, or inference (this is the anti-hallucination rule; the render-time
  fabrication block enforces it).

### 10.5 Verification additions (extends §6)

| # | Step | Verification |
|---|------|-------------|
| 8 | Extract contact-audit logic into shared lib; call from both `audit-contact.mjs` and `generate-pdf.mjs` | Existing `audit-contact.mjs` behavior unchanged (regression); renderer now blocks the same cases. |
| 9 | Render `cv-Siddique-renesas-2026-06-24` draft (with leaked `{{PHONE}}` etc.) through new pipeline | Resolver removes the unfilled blocks; render-time audit emits a loud omission warning that phone/location/linkedin/work-auth are in profile.yml but absent — proving the trap in §10.2 is surfaced, not hidden. |
| 10 | Inject a fabricated phone (not in profile.yml) into a draft | `generate-pdf.mjs` exits 4, no PDF written. |

## 12. Second Gemini Review Outcome (2026-06-26)

Gemini re-reviewed v1.2 from "AI Engineer" (Part 1) and "Senior EE/Semiconductor" (Part 2)
lenses. Each finding investigated independently. Part 1 is strong, mostly accepted. Part 2
again over-indexes on **silicon/ASIC** design and is largely off-profile for this
**power-electronics** candidate (converters, magnetics, SiC/GaN, PCBs — no tape-outs, nodes,
or foundries). Verdicts:

### 12.1 Part 1 (software architecture) — mostly ACCEPTED

| # | Finding | Verdict | Action |
|---|---------|---------|--------|
| 1.1 | **Regex greediness / malformed `{{/if}}`** can wipe intermediate HTML | **Accept (important)** | Do NOT use a raw dot-star sweep. Parse with a loop; for each `{{#if}}`, assert the matched inner contains **no** other `{{#if`. If it does → malformed/overlapping → **exit 3** with a "malformed/nested conditional" message (ties into the §8.4 distinct-error decision). Prevents silent data loss. |
| 1.2 | **Brace false-positives** — CVs may contain literal `{{ … }}` (code/templating snippets) | **Accept** | Restrict the placeholder grammar to `{{[A-Z0-9_]+}}` plus the control tokens `{{#if NAME}}` / `{{/if}}`. `findLeaks` only flags that grammar — arbitrary `{{ a: 1 }}` content is ignored. All our real placeholders are already strict-uppercase. Document an escape (`\{{`) for the rare literal case. |
| 1.3 | **Floating separators** after removing an optional element | **Accept-as-already-satisfied** | Verified: all four templates already emit contact separators via CSS (`.contact-item + .contact-item::before`), exactly as Gemini recommends — removing an element auto-heals the `|`. Project-stack ` · ` separators live inside LLM-generated content, not conditional wrappers. **Document the invariant** ("layout separators must be CSS, never raw HTML inside a `{{#if}}`") as a template-authoring rule; no code change needed. |
| 1.4 | **Playwright loop latency** in batch of 50 | **Accept-with-clarification** | Clarify: `fill_ratio` **measurement is free** (read `scrollHeight` from the page already rendered for the PDF). Only the *expansion re-render* costs, it's bounded to **one** extra render, and only fires on underfill. Keep Layer 0.5 pre-render estimate as first guess so the loop is a backstop. **Defer** browser-instance reuse to a batch-mode optimization (separate from this plan). |
| 1.5 | **Loop state** — LLM must know what it cut when expanding | **Accept** | The expansion pass feeds the LLM: the discard log (already produced in Step 1k/4) + master `cv.md` (already in context) + the `fill_ratio` magnitude ("underfilled ~30% — restore these specific cut bullets"). No new state store needed. |

### 12.2 Part 2 (EE/semiconductor) — mostly PUSH-BACK (off-profile)

| # | Finding | Verdict | Reasoning |
|---|---------|---------|-----------|
| 2.1 | **Silicon tape-out matrix** (node / foundry / blocks) | **Reject for now** | The candidate has no tape-outs, process nodes, or foundries. Baking node/foundry fields into the hardware template is dead weight for him and an **active hallucination risk** (LLM tempted to fill empty foundry/node columns). Violates the domain-agnostic mandate (CLAUDE.md). A silicon-specific sub-layout is a future item if a real chip designer onboards. |
| 2.2 | **Acronym/brand case enforcement** via hardcoded dictionary | **Accept goal, reject mechanism** | A hardcoded silicon dictionary (FinFET/UVM/GDSII) is wrong-domain and a maintenance burden. Better, domain-agnostic rule: **cv.md is the casing source of truth** — the drafter must preserve the exact casing of technical terms as the user wrote them (SiC, GaN, PMBus, LTspice, SEMI F-47), never re-case. Add this to the writing rules. Solves the credibility concern without a dictionary. |
| 2.3 | **Split technical matrices** (Design/Verification, EDA suites, Lab) | **Already satisfied** | `technical-engineering.html` T4B already uses a 4-category matrix (Design & Simulation / Hardware & Lab / Debug & Bring-Up / Standards & Protocols) — a better domain fit than "EDA Cadence/Synopsys suites" for power electronics. No change. |
| 2.4 | **NDA auto-sanitization** of codenames/clients | **Accept concern, reject auto-rewrite** | LLM auto-rewriting client/product names risks destroying *approved, accurate* content (the candidate may be permitted to name Nvidia/Google/VW) and is a judgment only the user can make. Instead: **flag** named clients / possible codenames in the Step 4 review so the *user* decides — consistent with the human-in-the-loop ethos. No silent rewrite. |
| 2.5 | **Patent status + co-inventors + standards committees** | **Accept (patent status)** | Verified the patent template has title/number/year but **no status**. The candidate has a patent (US2021/0382102 A1). Add an optional **status** field (Granted / Pending / Application) to `{{PATENT_LIST}}`. Co-inventors: optional, low priority. Standards-committee section: defer (candidate has none; domain-agnostic optional). |

### 12.3 Net additions from this review

Accepted into build scope: 1.1 (safe parser + malformed-tag error), 1.2 (strict placeholder
grammar + escape), 1.5 (expansion pass fed discard log + fill_ratio), 2.2 (preserve cv.md
term casing — writing rule), 2.4 (sensitive-specifics flag in Step 4 review), 2.5 (patent
status field). Documented-as-satisfied: 1.3, 2.3. Deferred/rejected: 1.4 browser reuse
(batch optimization), 2.1 silicon tape-out matrix, 2.5 standards-committee section.

---

## 13. Third Gemini Review Outcome (2026-06-26, file-grounded)

With the files attached + domain pinned + decisions listed, Gemini returned five
software-focused findings, all legitimate. Verdicts:

### 13.1 [Blocker → Accept finding, REFINE fix] Strict grammar misses stray control tags

Gemini: the strict `{{[A-Z0-9_]+}}` leak grammar won't match `{{#if X}}` / `{{/if}}`
(they contain `#`, `/`, spaces), so a stray/typo'd control tag escapes the gate.
**Correct catch.** But Gemini's proposed fix — broaden `findLeaks` to `/\{\{[\s\S]*?\}\}/g`
(match *any* double brace) — **reintroduces the exact false-positive its own prior review
(§12.1.2) warned about**: a software CV containing `{{ a: 1 }}` code would then be blocked.

**Refined fix (supersedes the §12.1.2 grammar):** `findLeaks` uses a **dual matcher**, not
match-everything:
- Placeholder leak: `/\{\{[A-Z0-9_]+\}\}/`
- Control-tag leak (liberal, catches malformed/typo'd variants like `{{/if PROJECTS}}`,
  `{{ #if }}`): `/\{\{\s*[#/]if\b[^}]*\}\}/`

This catches every stray control tag **and** every unfilled placeholder while still ignoring
arbitrary `{{ … }}` content in CV text. Escape for a literal placeholder-shaped token stays
`\{{` (or spacing the braces, `{ {`).

### 13.2 [Blocker → Accept] Missing closing tag → silent mass deletion

Same defect class as §12.1.1, now with a concrete, adopted fix. Gemini's
negative-lookahead regex prevents a `{{#if}}` from matching across a *second* `{{#if`:

```
/\{\{#if\s+([A-Z0-9_]+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g
```

If a `{{/if}}` is missing, the block simply fails to match → stays intact in the HTML →
caught by `findLeaks` (§13.1) as a leak (exit 3) instead of silently destroying the filled
Projects + Certifications between the tags. **Adopt this regex** as the concrete
implementation of the §12.1.1 "safe parser" decision. (A hand-rolled loop asserting
"no inner `{{#if`" is equivalent; the lookahead is more compact — either is acceptable.)

### 13.3 [Major → Accept, already covered by §10] `--fast` / manual render bypasses contact audit

Gemini: in `--fast` mode the user runs `generate-pdf.mjs` manually, which (today) doesn't
call the contact auditor, so fabrication slips through. **Correct — and this is exactly what
§10.3 already prescribes:** fold the contact audit into `generate-pdf.mjs` so it runs
unconditionally at render time on every path (normal, batch, `--fast` manual). Confirmed, no
new scope. Note: we keep distinct exit codes — **3 = template-token leak, 4 = contact
fabrication/placeholder** — rather than Gemini's single exit 3, for clearer diagnostics.

### 13.4 [Major → Accept] cv.md Step 5b must handle exit 3 (and 4)

Gemini: Step 5b only branches on 0/1/2; an exit 3 would be mistaken for a generic crash.
**Accept and sharpen §6 Step 5.** Step 5b gains:
- **Exit 3 (token leak):** parse stdout for the leaked tokens, re-read the draft, fill the
  named placeholders (or remove the orphaned control tag), re-render. **Bounded to one
  self-correction attempt**, then surface to the user (LLM-physics: no unbounded loop).
- **Exit 4 (contact fabrication):** stop, show the offending value, instruct the user to fix
  `config/profile.yml` or the draft — do **not** auto-"correct" a contact value (anti-
  hallucination: never invent contact data).

### 13.5 [Nice-to-have → Accept] `--fast` mode should warn on `resolve-template.mjs` exit 3

Gemini: in `--fast`, Step 1l runs `resolve-template.mjs`; if it exits 3 (e.g. `{{NAME}}`
left unfilled), the drafter currently still prints success. **Accept:** Step 1l checks the
exit code; on 3, print a warning listing the leaked tokens before the fast-mode stop, so the
user knows the draft needs a fix before they render it manually.

### 13.6 Net additions from this review

Build scope updated: §13.1 dual-grammar `findLeaks` (supersedes §12.1.2 strict-only);
§13.2 negative-lookahead conditional parser (concretizes §12.1.1); §13.4 exit-3 bounded
self-correction + exit-4 stop in cv.md Step 5b; §13.5 fast-mode resolve exit-3 warning.
§13.3 confirmed already in §10.3 (no new scope).

---

## 11. Net Change to Build Scope (consolidated)

Steps in §6 are augmented with: (a) `fill_ratio` probe in `generate-pdf.mjs` + last-page
underfill trigger; (b) template-lint + static-HTML invariant in `_test-cv-template.mjs`;
(c) distinct nested/malformed error in `findLeaks` (now also covers the §12.1.1 overlapping-tag
case); (d) optional summary block in the technical template; (e) optional `{{#if PATENT_LIST}}`
in classic + ats **with a status field (§12.2.5)**; (f) **contact-integrity enforcement folded
into `generate-pdf.mjs` (§10): leak gate (exit 3), fabrication block (exit 4), and loud omission
warning for populated-but-missing profile.yml fields, via shared contact-audit logic**;
(g) **safe conditional parser (negative-lookahead regex, §13.2) + dual-matcher leak grammar —
strict placeholders `{{[A-Z0-9_]+}}` plus a liberal control-tag matcher `{{\s*[#/]if…}}` — with
`\{{` escape (§13.1, supersedes §12.1.2 strict-only)**;
(h) **preserve-cv.md-casing writing rule (§12.2.2)** and **sensitive-specifics review flag
(§12.2.4)**. Hardware heading stays "Key Projects" (push-back). Executive font,
publications-everywhere, silicon tape-out matrix, and batch browser-reuse are deferred.

**Already fixed ahead of build (committed):** contact-separator underline bleed (all 4
templates) and competency `overflow:hidden` clipping (classic + ats). See §9.2.

---

## 14. Build Log (2026-06-26)

### 14.1 Files created
- `scripts/lib/cv-template.mjs` — `resolveConditionals` (negative-lookahead parser, §13.2),
  `findLeaks` (dual matcher: strict `{{[A-Z0-9_]+}}` + liberal control-tag, §13.1), `lintTemplate`.
- `scripts/lib/contact-audit.mjs` — shared contact logic (placeholder + fabrication + omission).
- `scripts/resolve-template.mjs` — CLI, rewrites draft in place, exit 3 on residual tokens.
- `scripts/_test-cv-template.mjs` — 8 unit tests (Renesas fixture, idempotency, missing-`{{/if}}`
  mass-deletion guard, control-tag detection, code false-positive, lint).

### 14.2 Files modified
- `scripts/generate-pdf.mjs` — backstop: in-memory resolve + leak gate (exit 3) + contact gate
  (exit 4, `--profile=`/`--strict-contact`) before render; `FILL_RATIO` probe (print-media,
  printable-width, small-viewport measurement) printed for the underflow loop.
- `scripts/audit-contact.mjs` — refactored to the shared lib; now also surfaces omission warnings.
- `templates/cv/technical-engineering.html` — Projects moved AFTER Experience; optional
  `{{#if SUMMARY_TEXT}}` block after header; skills blocks wrapped in `{{#if TECH_STACK}}` /
  `{{#if TECH_STACK_HARDWARE}}` (was unconditional → unused one leaked); `.patent-status` +
  `.summary-text` CSS. (Plus the earlier underline-bleed fix.)
- `templates/cv/classic-professional.html`, `ats-optimized.html` — optional `{{#if PATENT_LIST}}`
  section + patent CSS (incl. status). (Plus earlier underline + competency-clip fixes.)
- `templates/cv/academic-research.html` — earlier underline fix only.
- `templates/writing-rules.md` — preserve-cv.md-casing rule (§12.2.2) + NDA sensitive-specifics
  flag (§12.2.4).
- `modes/cv.md` — resolver contract (leave tokens, never hand-edit fences); contact fill-or-leave
  rule (replaces hand-deletion); `{{SECTION_PROJECTS}}` → "Key Projects"; Step 1l resolve-template
  call + fast-mode exit-3 warning; Step 5b exit-3 (bounded self-correct) / exit-4 (stop) handling;
  measure-then-expand underflow loop on `FILL_RATIO`; patent-status instructions; Step 4
  sensitive-specifics flag; updated Placeholder Vocabulary + LLM-Physics reminders.

### 14.3 Verification results
- `node scripts/_test-cv-template.mjs` → 8/8 pass (incl. the missing-`{{/if}}` mass-deletion guard
  and the `{{ a: 1 }}` code false-positive guard).
- All 4 templates pass `lintTemplate` (no static conditionals, no required field wrapped).
- No `{{...}}` tokens inside any template HTML comment.
- End-to-end T4B render: resolve exit 0, render exit 0, **0 residual tokens**, Projects after
  Experience titled "Key Projects", patent shows "Application · 2021" status, `FILL_RATIO` reported.
- Gate exit codes confirmed live: unfilled `{{NAME}}` → exit 3; missing-`{{/if}}` → content preserved
  + stray tag flagged exit 3; fabricated phone → exit 4; clean doc → exit 0 + PDF.
- `audit-contact.mjs` CLI regression OK; omission warning works; `full_name` excluded (header h1).

### 14.4 Discoveries during build (folded in)
- **Dual-layout skills blocks** in the technical template were unconditional, so the unused
  variant's `{{TECH_STACK}}`/`{{TECH_STACK_HARDWARE}}` leaked under the new gate (previously masked
  by CSS `display:none`). Fixed by wrapping each in its own `{{#if}}`.
- **Placeholder-shaped tokens in HTML comments** trip the leak gate (correctly). Template authoring
  rule: never write `{{TOKEN}}` literally in a comment — name it without braces.

### 14.5 Not done (deferred per reviews / pending user)
- DOCX path (`generate-docx.mjs`) reads the already-resolved draft, so it inherits the fix; not
  separately re-verified here.
- Deferred features: executive-font sub-layout, publications-everywhere, silicon tape-out matrix,
  batch browser-reuse. Commit + CONSOLIDATION-PLAN update pending user go-ahead.

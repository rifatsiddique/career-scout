# CV Header Polish: Three Targeted Fixes

**Version:** 1.2
**Last Updated:** 2026-05-24 -- Gemini round 2: premium link typography (text-underline-offset, muted color, 1px thickness); complete-tag-omission rule for empty contact fields
**Parent Plan:** CONSOLIDATION-PLAN.md, Section 11, Phase 2 post-launch polish
**Scope:** Templates, modes/cv.md, config/profile.yml — no pipeline or evaluation logic touched

---

## 1. Context

Three isolated user-reported issues with the CV header and page-fill behavior.
All three are confined to the CV generation subsystem (templates + `modes/cv.md`).
No changes to evaluation logic, Scout, or data files.

---

## 2. Change A — Drop the Headline Line

### Problem

The `{{HEADLINE}}` row (`.header-headline` div in classic-professional; absent in ats-optimized)
adds a line between the candidate's name and the contact row. The user no longer wants this line.

### What changes

| File | Change |
|------|--------|
| `templates/cv/classic-professional.html` | Remove `<div class="header-headline">{{HEADLINE}}</div>` and the `.header-headline` CSS rule |
| `templates/cv/ats-optimized.html` | Verify it has no headline row (it does not — no change needed, confirm only) |
| `modes/cv.md` | Remove `{{HEADLINE}}` from placeholder table; remove fill logic in Step 1g; remove `{{HEADLINE}}` from contact audit section in Step 0d |
| `config/profile.yml` | `narrative.headline` field stays — it is used internally by the evaluate workflow, not only for CV display. Do not remove. |

The `narrative.headline` field in `profile.yml` is left intact — it still has value for
evaluation context (Block A role summary) and may be used by future modes. Only the
CV template display is removed.

### Verification

Generate a draft CV. Confirm the header renders:
- Line 1: Candidate name (large, accented)
- Line 2: Contact row (phone | email | LinkedIn | portfolio | location | work auth)
- No headline row between name and contact row.

---

## 3. Change B — Visible Links in the Contact Row

### Problem

Links in the contact row (`<a href="{{LINKEDIN_URL}}">{{LINKEDIN_DISPLAY}}</a>`) use
`color: #555` with no underline — the same visual style as the surrounding plain text.
In PDF output, these anchors are visually indistinguishable from plain text, so the user
reports that links "sometimes don't show up properly."

### Fix (updated after Gemini review)

Keep the `<a href>` anchors — they preserve click-to-open functionality in PDF readers,
which most recruiters rely on. The fix is CSS-only: override the link style in the
contact row to make links visually distinct while staying typographically clean.

```css
.contact-row a {
  color: inherit;                     /* matches surrounding text color */
  text-decoration: underline;
  text-decoration-color: #ccc;        /* muted line — text stays the focal point */
  text-underline-offset: 2.5px;       /* clears descenders (g, y, p) in serif fonts */
  text-decoration-thickness: 1px;     /* clean, thin line */
}
```

The muted underline signals "clickable" without competing with the surrounding text.
The offset and thickness prevent the line from cutting through letter descenders, which
matters especially for the classic-professional serif font stack.

> **Why not a colored underline?** The contact row uses `#555` on white. Using `--accent`
> navy for links would introduce a second color at the very top of the CV — distracting.
> Muted gray underline is the typographically quieter choice.

Google Scholar is **optional** — if `candidate.google_scholar` is blank in profile.yml,
it is silently omitted from the CV (same pattern as phone, github, work_authorization).

A note in `modes/cv.md` advises the user to use short display-form URLs
(e.g. `linkedin.com/in/name`, not the full `https://www.linkedin.com/in/name/`) so the
line does not spill. If the contact line is getting long, the mode prompts the user to
shorten their URLs before PDF generation.

### What changes

**`config/profile.yml`** — append one field under `candidate:`:
```yaml
  google_scholar: ""                  # (optional) e.g. "scholar.google.com/citations?user=XXXXX" — leave blank to omit
```

**`templates/cv/classic-professional.html`** — contact row CSS:
- Replace `.contact-row a { color: #555; text-decoration: none; }` with:
  `.contact-row a { color: inherit; text-decoration: underline; }`
- Add `<a class="contact-item" href="{{GOOGLE_SCHOLAR_URL}}">{{GOOGLE_SCHOLAR_DISPLAY}}</a>` after the portfolio anchor
- Keep existing LinkedIn and portfolio anchors unchanged (only CSS changes)

**`templates/cv/ats-optimized.html`** — same CSS change + google_scholar anchor.

**`modes/cv.md`** — placeholder table and Step 1g:
- Add `{{GOOGLE_SCHOLAR_URL}}` entry: source `candidate.google_scholar`; omit entire anchor if empty
- Add `{{GOOGLE_SCHOLAR_DISPLAY}}` entry: display text derived from the URL (strip `https://`); omit if empty
- Step 1g contact rule table: add Google Scholar row — omit entire `<a>` if field empty
- Step 0d contact audit: add Google Scholar to the audit list (✅/❌ report; blank = ✅ omitted)
- Add a note in Step 1g: *"Use the short display form of each link (e.g. `linkedin.com/in/name`). If the contact line is visually crowded, prompt the user to shorten their URLs before PDF generation."*

**Critical omission rule (all contact fields, all templates):**

When a contact field is empty, remove the **entire HTML element** — not just the
placeholder text inside it. The contact row uses the CSS sibling selector
`.contact-item + .contact-item::before` to render `|` separators. If an empty element
remains in the DOM (even with no visible text), the selector still fires and produces a
stray separator. The element must be completely absent from the output HTML.

```
✅ Field empty → omit: <a class="contact-item" href="...">...</a>  (entire tag gone)
❌ Field empty → leave: <a class="contact-item" href=""></a>        (causes stray |)
```

This rule applies to all optional contact items: phone, google_scholar, portfolio,
github, work_authorization. It was already the intended behavior (modes/cv.md Step 1g
says "omit the entire `<span class="contact-item">`") — this note makes the HTML-level
consequence explicit for the LLM filling the template.

**`scripts/audit-contact.mjs`** — add `google_scholar` to the field audit list.
Optional field: blank = ✅ (will be omitted), not ❌ (missing/required).

### Placeholder table delta

| Placeholder | Before | After |
|-------------|--------|-------|
| `{{LINKEDIN_URL}}` | Full URL for href | Unchanged |
| `{{LINKEDIN_DISPLAY}}` | Display text in anchor | Unchanged |
| `{{PORTFOLIO_URL}}` | Full URL for href | Unchanged |
| `{{PORTFOLIO_DISPLAY}}` | Display text in anchor | Unchanged |
| `{{GOOGLE_SCHOLAR_URL}}` | Did not exist | New — full URL for href; omit anchor if blank |
| `{{GOOGLE_SCHOLAR_DISPLAY}}` | Did not exist | New — display text; omit anchor if blank |

### Verification

1. Set `linkedin`, `portfolio_url`, and `google_scholar` in profile.yml with short URLs.
   Generate a draft. Confirm all three links are underlined and visually distinct in the
   contact row.
2. Clear `google_scholar`. Regenerate. Confirm it is absent from the contact row with no
   empty separator.
3. Inspect the HTML source — confirm all three links remain `<a href>` anchors.
4. Open the PDF in a browser tab — confirm links are clickable.
5. Run `node scripts/audit-contact.mjs` — confirm google_scholar appears in the report.

---

## 4. Change C — Page Target + Underflow Expansion

### Problem

The current cutting logic handles overflow (content too long → cut to fit 2 pages).
There is no complementary rule for underflow: a CV with moderate experience may render
as 1.2 pages, leaving awkward whitespace that signals a thin application.

However, forcing every CV to 2 pages is wrong for early-career candidates (< 3 roles,
< 10 total bullets in `cv.md`). A padded 2-page CV for a short career looks artificially
bloated to recruiters. The fix must be career-stage-aware.

### What changes (updated after Gemini review)

**`config/profile.yml`** — add `target_pages` under the `cv:` block:
```yaml
cv:
  default_template: "classic-professional"
  target_pages: 2          # Options: 1 or 2. Default: 2. Set to 1 for early-career candidates.
  diff_threshold: 0.5
```

**`modes/cv.md`** — add **Layer 0.5: Underflow expansion** between Step 1h (deterministic
cuts) and Step 1i (relevance-weighted cutting). The padding pass is gated by two checks:

#### Gate 1: Hard early-career stop (always checked first)

Count total bullets across all roles in `cv.md` (before any cuts).

- If total bullets in `cv.md` < 10: **do not pad.** The candidate genuinely has a short
  career. Target 1 page instead — apply tighter cuts to produce a dense, polished 1-pager.
  Tell the reviewer: *"Underflow detected but cv.md has < 10 total bullets — targeting
  1 page (tight layout) instead of padding."*
- This gate fires regardless of the `target_pages` setting.

#### Gate 2: target_pages check

- If `profile.yml → cv.target_pages` is `1`: skip the padding pass. Generate the most
  polished 1-page layout possible (same behavior as the early-career stop above).
- If `target_pages` is `2` (default) AND Gate 1 did not fire: proceed to the padding
  trigger check below.

#### Padding trigger

After Layer 1 deterministic cuts, estimate whether the content fills < ~1.5 pages.
Heuristic: if total remaining bullet count across all roles is < 12, treat as underflow.

If triggered, expand:
- Most recent role(s): be more verbose in bullets — add context, method, outcome, or
  scope present in `cv.md` but condensed in the first pass. No fabrication.
- Recent roles with < 4 bullets: add bullets from `cv.md` not included initially
  (low JD-relevance but real, accurate content).
- Project descriptions: expand to 2-3 sentences rather than 1.
- Professional summary: allow up to 5-6 sentences rather than 3-4.
- Skills and certifications: include all qualifying items rather than a curated subset.

Per-role bullet caps during padding:
- Most recent role: up to 7 bullets (normal cap is 5)
- Second role: up to 5 bullets (normal cap is 3)
- Older roles: up to 4 bullets (normal cap is 3) if space permits

**Constraints (all cases):**
- All added content must come from `cv.md` or `article-digest.md`. No fabrication.
- CV Generation Rules (`_profile.md → ## CV Generation Rules`) still take absolute
  precedence — e.g. if rules say "max 5 bullets", honor it over the padding caps.
- Stop expanding at estimated 2 pages — the overflow fallback chain (Layers 1-3)
  remains as backstop if the estimate is off.

**Reviewer note (Step 2):** When a padding pass ran, the reviewer must check all added
bullets with the Substitution Test. Padding cannot introduce zombie bullets.

**`modes/cv.md`** — update Step 1i (relevance-weighted cutting): clarify it only triggers
if content exceeds `target_pages`. Cutting and padding are mutually exclusive.

### Verification

1. **Early-career hard stop:** Simulate a `cv.md` with 2 jobs and 6 total bullets, `target_pages: 2`.
   Confirm Gate 1 fires, padding does not run, and the mode targets a tight 1-page layout.
2. **Normal padding:** Simulate a `cv.md` with 3 jobs and 14 total bullets, `target_pages: 2`,
   where Layer 1 cuts produce ~10 bullets. Confirm padding runs and the draft is expanded
   toward 2 pages with no fabricated content.
3. **1-page opt-in:** Set `target_pages: 1` in profile.yml. Confirm padding never runs
   regardless of bullet count.
4. **Full CV (no change):** A `cv.md` with 4+ roles and 20+ bullets should produce a draft
   that goes straight to overflow logic (Layer 1 → relevance-weighted cuts). Padding pass
   does not fire.

---

## 5. Files Changed (Summary)

| File | Layer | Change type |
|------|-------|-------------|
| `templates/cv/classic-professional.html` | System | Remove headline div + CSS; update `.contact-row a` CSS; add google_scholar anchor |
| `templates/cv/ats-optimized.html` | System | Update `.contact-row a` CSS; add google_scholar anchor |
| `modes/cv.md` | System | Remove headline logic; add google_scholar placeholders; add Layer 0.5 padding rule with gates |
| `config/profile.yml` | **User** | Append `google_scholar: ""` and `target_pages: 2` fields — explicit user request |
| `scripts/audit-contact.mjs` | System | Add google_scholar to field audit list (optional field) |

No changes to: evaluate.md, pipeline-triage.md, scan.md, setup.md, data files, reports,
CONSOLIDATION-PLAN.md (will be updated at commit time per commit discipline rules).

---

## 6. Implementation Order

1. Change A (template + cv.md headline removal) — simplest, isolated to one element
2. Change B (plain-text links + google_scholar field) — builds on cleaned-up template
3. Change C (padding rule) — purely additive to cv.md logic, no template changes

Each change is independently verifiable. Implement and verify A, then B, then C before commit.

---

## 7. Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| `config/profile.yml` User layer edits could surprise users | LOW | Two-field append with comments; both fields are blank/default, zero impact if ignored |
| Padding pass overshoots into overflow | LOW | Padding stops at estimated target_pages; overflow fallback chain (Layers 1-3) is backstop |
| Padding pass adds low-specificity bullets | LOW | Reviewer Substitution Test audits all bullets including padded ones; zombie bullets get flagged |
| Early-career hard stop misfires for senior candidate with sparse cv.md | LOW | Hard stop triggers only when cv.md itself has < 10 bullets — a senior candidate would have many bullets even if some roles are short |
| google_scholar field treated as required in audit | LOW | Field is optional — audit treats blank as ✅ (omitted), not ❌ |
| CSS underline on contact links looks wrong on a serif template | LOW | `.contact-row a { text-decoration: underline }` is standard and font-agnostic; visually tested at classic-professional font sizes |

---

## 8. Gemini Review Log

**Reviewer:** Gemini CLI — 2026-05-24

| # | Finding | Type | Decision | Fix |
|---|---------|------|----------|-----|
| 1 | **Change A approved.** Retaining `narrative.headline` in profile.yml is the correct design choice — high-value context for Block A evaluation framing. | Approval | Accepted | No change |
| 2 | **Change B: keep `<a>` anchors.** Stripping to `<span>` loses click-to-open in PDF readers (majority of recruiters read on screen). CSS-only fix is sufficient. | Design concern | **Accepted** | Changed to CSS fix: `.contact-row a { color: inherit; text-decoration: underline; }`. Anchors retained. |
| 3 | **Change C: 1-page is correct for early-career.** Forcing 2 pages for a candidate with < 3 roles / < 10 bullets produces a bloated CV recruiters notice negatively. | Standards concern | **Accepted** | Added hard early-career stop (< 10 bullets in cv.md → target 1 page). Added `target_pages` config option. |
| 4 | **Change C: add `target_pages` configuration.** Candidates should be able to opt in to 1-page explicitly. | Feature refinement | **Accepted** | `target_pages: 2` default added to `profile.yml` under `cv:`. Modes/cv.md padding gates respect this value. |

**Round 2 — Gemini CLI — 2026-05-24**

| # | Finding | Type | Decision | Fix |
|---|---------|------|----------|-----|
| 5 | **Change B fully approved.** CSS-only underline + retained anchors is the correct compromise. | Approval | — | — |
| 6 | **Premium link typography.** Standard browser underline cuts through descenders and looks heavy on serif fonts. Recommend `text-decoration-color: #ccc`, `text-underline-offset: 2.5px`, `text-decoration-thickness: 1px`. | Typography refinement | **Accepted** | CSS block updated in both templates with all three properties. |
| 7 | **Complete-tag omission for empty contact fields.** The `.contact-item + .contact-item::before` sibling selector fires on any DOM-present element — even an empty one. Empty fields must delete the entire `<a>` or `<span>` tag, not just blank the placeholder text. | Implementation correctness | **Accepted** | Explicit rule added to modes/cv.md Step 1g. ✅/❌ example added to make the HTML-level requirement unambiguous for the LLM filling the template. |
| 8 | **Change C fully approved.** Two-stage gating (hard early-career stop + target_pages config) and reviewer Substitution Test on padded bullets are correct design patterns. | Approval | — | — |

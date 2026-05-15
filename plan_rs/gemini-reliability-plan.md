# Plan: Ensure Evaluate Mode is Always Followed

**Version:** 1.0
**Date:** 2026-05-14
**Status:** Awaiting Gemini review — please recommend the best option or combination
**Problem:** When user pastes a job URL or JD text, Gemini may respond with a
freeform evaluation instead of following `modes/evaluate.md`. The A-G block
structure, specific scoring dimensions, fit categories, and post-evaluation
steps are skipped or improvised.

---

## Evidence of the Problem

First real evaluation (report: `reports/001-generac-2026-05-14.md`) showed:
- Wrong fit category label ("STRONG FIT" instead of "PERFECT_MATCH")
- Wrong dimension names (improvised rather than the 5 specified dimensions)
- Block D (Comp & Demand web search) not executed
- Block F (STAR+R stories) not executed
- Block G (Posting Legitimacy) not executed
- Report format didn't match the spec in `modes/evaluate.md`

Root cause: Gemini responded from AGENTS.md context + profile.yml data +
training knowledge, without reading `modes/_shared.md` or `modes/evaluate.md`
from disk first.

---

## What Must Always Happen

When the user pastes a job URL or JD text, Gemini must:

1. Read `modes/_shared.md` (scoring system, dimensions, archetype detection)
2. Read `modes/evaluate.md` (A-G block instructions)
3. Execute all 7 blocks in order (A through G)
4. Use the exact 5 dimension names and fit category labels from _shared.md
5. Run post-evaluation steps (save report, update tracker, show summary)

This must happen even if the user forgets to type `evaluate` — a raw URL paste
should trigger the same behavior.

---

## Options

### Option A — Inline the Evaluation Skeleton in AGENTS.md

Embed the critical structure directly in AGENTS.md so it is always in context
from session start, requiring no runtime file reads:

- The 7 block names (A through G) and their one-line purpose
- The exact 5 dimension names, weights, and fit category thresholds
- The post-evaluation steps (report format, tracker update, summary)
- A hard rule: "Output must follow this exact structure. Do not improvise."

The detailed sub-instructions remain in `modes/evaluate.md` as the reference,
but the skeleton is inlined so it cannot be skipped.

**Pros:** Zero dependency on runtime file reads. Structure always in context.
Cannot be forgotten or skipped.

**Cons:** Duplicates content between AGENTS.md and evaluate.md. If evaluate.md
changes, AGENTS.md must also be updated. Makes AGENTS.md larger.

---

### Option B — Mandatory File-Read Directive with Visible Checkpoint

Add a strong directive to AGENTS.md that forces Gemini to read the mode files
before producing any evaluation output:

```
MANDATORY RULE — URL or JD Detection:
When the user input contains a job URL or JD text, your FIRST action MUST be:
1. Read modes/_shared.md
2. Read modes/evaluate.md
3. Confirm you have read them by stating: "Loaded: _shared.md + evaluate.md"
4. Then and only then produce the A-G evaluation output.
Do NOT produce evaluation content before completing steps 1-3.
```

The visible confirmation step ("Loaded: ...") creates an observable checkpoint
that lets the user verify the files were read.

**Pros:** Keeps separation of concerns. Mode files remain single source of truth.
Visible checkpoint makes it easy to spot when the step is skipped.

**Cons:** Depends on Gemini obeying the MUST instruction. Under fast-response
pressure, LLMs can sometimes bypass mandatory instructions. The confirmation
line adds minor noise to output.

---

### Option C — Session Pre-Load at Startup

Add an instruction to AGENTS.md to silently read the evaluation mode files
at the very start of every session, before any user input:

```
SESSION INITIALIZATION (run once at session start, silently):
1. Read modes/_shared.md — internalize scoring system and rules
2. Read modes/evaluate.md — internalize A-G block structure
These files are now in context for the entire session.
```

**Pros:** Files are loaded once upfront. No per-message overhead. Reliable if
Gemini respects session initialization instructions.

**Cons:** Loads evaluate.md even when doing setup or pipeline triage (wasted
context). Startup adds latency. Does not help if Gemini ignores initialization.

---

### Option D — Multiple File Imports in GEMINI.md

Extend GEMINI.md from a single `@AGENTS.md` import to also import mode files:

```
@AGENTS.md
@modes/_shared.md
@modes/evaluate.md
```

If Gemini CLI supports multiple `@file` imports, all three files would be
injected into the system context at session start — guaranteed to be present
without any runtime read instructions.

**Pros:** Simplest and most reliable if supported. No instruction-following
dependency. Files are just part of the system prompt.

**Cons:** Unknown if Gemini CLI supports multiple `@` imports. Loads evaluate.md
for every session including pipeline and setup sessions (unnecessary context).

**Gemini: please confirm whether multiple `@file` imports work in GEMINI.md.**

---

### Option E — Combination: Inline Skeleton + Mandatory Read

Combines Option A and Option B:

- Inline the structural skeleton in AGENTS.md (block names, dimensions,
  categories, post-eval steps) — guarantees correct structure even if file
  read fails
- Add the mandatory file-read directive — fills in detailed sub-instructions
  from the mode files when they are read

This is belt-and-suspenders: the skeleton can't be missed, and the detailed
instructions are loaded when possible.

**Gemini: is this overkill, or is the redundancy warranted?**

---

## Specific Questions for Gemini

1. **Multiple @ imports:** Does GEMINI.md support `@modes/_shared.md` and
   `@modes/evaluate.md` alongside `@AGENTS.md`? If yes, Option D is probably
   the cleanest solution.

2. **MUST instruction reliability:** How reliably does Gemini CLI follow a
   "MUST read file before responding" directive in AGENTS.md? Is Option B
   dependable in practice, or does it get skipped under fast response?

3. **Session initialization:** Does Gemini CLI honor "run at session start"
   instructions in AGENTS.md? Is Option C a reliable pattern?

4. **Recommended option:** Given the above, which option (or combination) do
   you recommend? The goal is that pasting a job URL always produces a correct
   A-G evaluation with the right dimensions, fit categories, and all blocks
   executed — without the user needing to remember a command.

5. **Anything we missed?** Is there a Gemini-native pattern for enforcing
   consistent mode execution that isn't covered in the options above?

---

## Constraints

- Must work with Gemini CLI as primary runtime
- Solution should also work with Claude Code (secondary runtime)
- Mode files must remain CLI-agnostic (no Gemini-specific tool names in
  modes/*.md)
- GEMINI.md and CLAUDE.md are the CLI-specific wrappers where CLI-specific
  patterns are acceptable
- Prefer the simplest solution that is reliably correct over a complex one
  that is fragile

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-14 | Plan created, awaiting Gemini recommendation | — |
| 2026-05-14 | **Option D ruled out** | Gemini confirmed: no `@file` import syntax in Gemini CLI. `@AGENTS.md` in GEMINI.md was never being processed — Gemini had been running with almost no system context. |
| 2026-05-14 | **Option C ruled out** | Session initialization works but is inefficient — loads evaluate.md even for pipeline/setup sessions, consumes permanent context tokens. |
| 2026-05-14 | **Option B implemented (modified)** — placed in GEMINI.md | Gemini confirmed GEMINI.md has "Contextual Precedence" — instructions there take absolute priority. URL paste defined as a strict Directive (not Inquiry). Mandatory read_file steps before any evaluation output. |
| 2026-05-14 | **AGENTS.md also updated** | Added the same CRITICAL MANDATE section to AGENTS.md for Claude Code compatibility (Claude Code processes @AGENTS.md correctly). |
| 2026-05-14 | **GEMINI.md fully rewritten** | Was just `@AGENTS.md` (never processed). Now a self-contained routing file with: critical mandate, mode routing, data contract, session checks, ethical use, report numbering. |

# career-scout -- Claude Code Instructions

@AGENTS.md

## Project Reference

- **Consolidation Plan**: `plan_rs/CONSOLIDATION-PLAN.md` — the single source of truth for architecture, phases, reuse decisions, and roadmap.
- **Phase 1 Plan**: `plan_rs/phase1-foundation.md` (v1.3, approved) — detailed implementation spec for evaluate, pipeline, setup modes.
- **Data Contract**: `docs/DATA_CONTRACT.md` — defines which files are User layer vs System layer.
- **Plans folder**: `plan_rs/` — all planning documents live here. Gemini CLI may also review files in this folder.

## Data Contract: User vs System Layer

**This is the most important rule in this project.**

- **User layer files** (`cv.md`, `config/profile.yml`, `modes/_profile.md`, `data/*`, `interview-prep/story-bank.md`, `writing-samples/*`, `reports/*`, `output/*`) contain the user's personal data and accumulated work.
- **NEVER overwrite, reset, or auto-update User layer files.** Only append to or modify them when explicitly instructed by the user.
- **System layer files** (`modes/*.md` except `_profile.md`, `templates/*`, `scripts/*`, `fonts/*`, `docs/*`, `AGENTS.md`, `.agents/*`) contain instructions and tooling. These are safe to update.
- When in doubt about a file's layer, treat it as User layer.
- See `docs/DATA_CONTRACT.md` for the full mapping.

## Planning Rules

- When asked for a plan, ALWAYS include:
  1. The implementation steps
  2. How each step will be tested/verified before moving on
- Save all plans to `plan_rs/` with descriptive filenames (e.g., `plan_rs/phase1-evaluation-modes.md`).
- After every plan is finalized, review `plan_rs/CONSOLIDATION-PLAN.md` and update it if the plan introduces new roadmap items, changes to architecture, or scope additions.

## Commit Discipline

- Before every commit (when the user says they are ready to commit or asks to commit):
  1. Re-read `plan_rs/CONSOLIDATION-PLAN.md`
  2. Update the plan to reflect what was actually implemented — mark completed items, correct any deviations, add new discoveries or decisions
  3. If success criteria were met, check them off
  4. Bump the version or date if significant changes were made
  5. Then proceed with the commit (include the plan update in the same commit)

## Keeping the Plan Current

- The plan is a living document. It should always reflect the current state of the project.
- If during implementation we discover something new (a better approach, a new dependency, an additional feature), add it to the appropriate section of the plan.
- Never let the plan go stale — if it says something that is no longer true, fix it immediately.

## Plan Versioning

- Every time `plan_rs/CONSOLIDATION-PLAN.md` is modified, update BOTH fields in the header:
  1. `Version:` — increment the minor version (e.g., 1.2 -> 1.3). Major version bumps (2.0, 3.0) only for fundamental architecture changes.
  2. `Last Updated:` — set to the current date AND time (e.g., `2026-05-14 14:30 -- brief description of change`).
- The version and timestamp must always reflect the most recent edit.

## Multi-CLI Compatibility

- This project is **CLI-agnostic**. Mode instructions and agent files must work on Gemini CLI, Claude Code, Copilot, and other agent CLIs.
- **Do NOT use Claude-specific tool names** in mode files (`modes/*.md`). Use generic descriptions instead:
  - "Read the file" not "use the Read tool"
  - "Search the web" not "use WebSearch"
  - "Run the command" not "use Bash"
- CLI-specific wrappers (`CLAUDE.md`, `GEMINI.md`) handle tool mapping. Mode files stay generic.
- The `AGENTS.md` file (when created) is the CLI-agnostic system prompt. `CLAUDE.md` and `GEMINI.md` import it.

## Mode File Conventions

- Each mode is a standalone markdown file in `modes/`.
- `modes/_shared.md` contains global rules loaded by all modes (scoring system, archetype detection, safety rules).
- `modes/_profile.md` is the **only** User layer file in `modes/` — it contains the user's archetypes, behavioral profile, and writing style.
- Mode files should be self-contained: a mode loaded into a fresh-context agent should have everything it needs to execute.
- Modes reference data files by relative path (e.g., `config/profile.yml`, `cv.md`).

## Archetype System

- Archetypes are **user-defined** in `modes/_profile.md`, not hardcoded.
- The system is domain-agnostic — it works for EE, biotech, CS, PM, and any other field.
- During `/setup`, the system reads the user's `cv.md` and suggests archetypes. The user refines.
- Mode files must never assume a specific set of archetypes. They should read from `_profile.md`.

## CV Templates

- All CV templates live in `templates/cv/` and are registered in `templates/cv/manifest.yml`.
- Templates use a shared placeholder system (`{{NAME}}`, `{{EXPERIENCE}}`, etc.).
- All templates go through the same `generate-pdf.mjs` pipeline (HTML -> Playwright -> PDF).
- Template selection: `profile.yml` sets defaults; per-evaluation overrides are supported.

## README Maintenance

- When `README.md` is created, keep it up to date whenever setup steps, dependencies, project structure, or configuration change.
- If you add a new dependency or change scripts, update the README to match.
- Include the README update in the same commit as the change that triggers it.

## Source Projects

This project consolidates work from 4 repositories. When porting code or patterns:

| Source | Location | What to port |
|--------|----------|-------------|
| career-ops | `C:/Work/Local_GitClones/career-ops` | A-G eval blocks, portal scanner, PDF pipeline, STAR+R, data formats |
| ai-job-search | `C:/Work/Local_GitClones/ai-job-search` | Drafter-reviewer workflow, relevance-weighted cutting, behavioral profiling |
| job-search-toolkit | `C:/Work/Local_GitClones/job-search-toolkit` | Externalized prompts, fit categories, coaching pipeline patterns |
| LangHire | `C:/Work/Local_GitClones/LangHire` | Plugin architecture (future), self-learning memory (future) |

Always adapt ported code to career-scout's conventions rather than copying verbatim.

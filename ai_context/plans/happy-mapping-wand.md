# Phase 6: Profile Porting — Implementation Plan

**Version:** 1.4
**Date:** 2026-05-25
**Status:** Approved — 4 Gemini review rounds (10/10 final rating)
**Spec file for Gemini:** `plan_rs/phase6-port-profile.md`

---

## Context — Why This Feature Exists

career-scout is a personal job search system where users accumulate significant
data over time: their CV, behavioral profile, evaluation reports, interview
stories, generated CVs, pipeline tracker, scan history, etc. This data is the
user's work product — irreplaceable and hard to recreate.

**The problem:** When we publish a new version of career-scout (new modes,
script fixes, template improvements), users need to upgrade. But the user's
personal data lives alongside the system files in the same repo. A naive
`git pull` would conflict with or overwrite their data.

**The user's distribution model:**
- The developer maintains a private monorepo, then pushes updates to a
  **separate published repo** that users clone
- Users are **git users only** — they clone the repo
- Users want to **keep git history** on their own data (so we do NOT
  gitignore user-layer files)

**The chosen approach — "fresh clone + port":**
Instead of in-place `git pull` upgrades (which require merge resolution),
the user clones the new version to a new folder, then **ports** their profile
and accumulated data from the old instance. This is clean, safe, and avoids
all git merge complexity.

The old instance is never modified — files are copied, not moved.

---

## Architecture — Three Deliverables

```
config/port-manifest.yml          <- Living manifest: which files to port, how
scripts/port-profile.mjs          <- Deterministic engine: scan, plan, execute
modes/port.md                     <- AI mode: guided UX for the user
```

**Why this split:**
- The **manifest** is the single source of truth. When future phases add new
  user-layer files, they add a line here. No script changes needed.
- The **script** does the heavy lifting deterministically. File operations
  shouldn't depend on LLM interpretation — a script is reliable, testable,
  and produces consistent results.
- The **mode** handles UX: asks the user for the source path, shows the
  checklist, lets them select groups, explains schema migrations. The AI
  calls the script, the script does the work.

---

## Deliverable 1: `config/port-manifest.yml`

A machine-readable YAML file listing every user-layer file, grouped logically,
with a porting strategy for each. This is the **living registry** the user
asked for — when we add new user-layer files in the future, we add a line here.

### Porting Strategies

| Strategy | Meaning | Use case |
|----------|---------|----------|
| `overwrite` | Copy old -> new, creating `.bak` of existing | Core profile files, data trackers |
| `copy-missing` | Copy only if file doesn't exist in new instance | Reports, prep docs, writing samples |
| `append-dedup` | Merge rows, deduplicate by key column | scan-history.tsv (union by URL) |
| `skip` | Never port | Ephemeral/regenerated files |

### Manifest Structure

```yaml
# config/port-manifest.yml — Profile porting manifest
# This file defines which user-layer files to port between career-scout instances.
# When adding new user-layer files in future phases, add an entry here.

version: 1

groups:
  - id: core
    name: "Core Profile"
    description: "Your identity, CV, and behavioral profile"
    files:
      - path: "cv.md"
        strategy: overwrite
        required: true
        description: "Master CV"
      - path: "config/profile.yml"
        strategy: overwrite
        required: true
        description: "Candidate identity, targets, compensation"
        schema_migrate: true
      - path: "config/portals.yml"
        strategy: overwrite
        required: false
        description: "Custom company list for scanner"
      - path: "modes/_profile.md"
        strategy: overwrite
        required: true
        description: "Archetypes, behavioral profile, writing style, CV rules"
      - path: "article-digest.md"
        strategy: overwrite
        required: false
        description: "Proof points and project deep-dives"

  - id: pipeline
    name: "Pipeline & Tracking"
    description: "Job pipeline, applications, follow-ups, and scan history"
    files:
      - path: "data/pipeline.md"
        strategy: overwrite
        description: "Job pipeline tracker"
      - path: "data/applications.md"
        strategy: overwrite
        description: "Application tracker"
      - path: "data/scan-history.tsv"
        strategy: append-dedup
        description: "Scanner dedup history (merged by URL)"
        dedup_column: 0
      - path: "data/inbox.txt"
        strategy: overwrite
        description: "Pending URLs to scan"
      - path: "data/archived.md"
        strategy: overwrite
        description: "Dead/stale links archive"
      - path: "data/.scout-state.json"
        strategy: overwrite
        description: "Scout runtime state"
      - path: "data/follow-ups.md"
        strategy: overwrite
        description: "Follow-up tracking"

  - id: reports
    name: "Reports"
    description: "Evaluation reports and their HTML companions"
    files:
      - path: "reports/*.md"
        strategy: copy-missing
        glob: true
        description: "Evaluation reports (markdown source)"
      - path: "reports/*.html"
        strategy: copy-missing
        glob: true
        description: "HTML companions (avoids regeneration; new ones take over naturally)"

  - id: interview
    name: "Interview Prep"
    description: "Story bank and company-specific prep docs"
    files:
      - path: "interview-prep/story-bank.md"
        strategy: overwrite
        description: "Accumulated STAR+R stories"
      - path: "interview-prep/*.md"
        strategy: copy-missing
        glob: true
        description: "Per-company interview prep and research docs"
        exclude: ["story-bank.md"]
      - path: "interview-prep/*.html"
        strategy: copy-missing
        glob: true
        description: "HTML companions (avoids regeneration)"

  - id: writing
    name: "Writing Samples"
    description: "Your writing for style calibration"
    files:
      - path: "writing-samples/*"
        strategy: copy-missing
        glob: true
        description: "Writing samples for style extraction"

  - id: customizations
    name: "Custom Templates"
    description: "User-created CV templates and domain packs (system defaults are not overwritten)"
    files:
      - path: "templates/cv/*.html"
        strategy: copy-missing
        glob: true
        description: "Custom CV templates (system-shipped templates already exist, so copy-missing only ports user-created ones)"
      - path: "templates/domain-packs/*.yml"
        strategy: copy-missing
        glob: true
        description: "Custom domain packs (e.g., product-management.yml)"

  - id: output
    name: "Output"
    description: "Generated CVs, cover letters, and comparison reports"
    files:
      - path: "output/*"
        strategy: copy-missing
        glob: true
        description: "Generated PDFs, HTML drafts, DOCX exports"
```

### Design Decisions

- **No `data/batch/*` group.** Batch state is ephemeral (gitignored). Nothing
  to port.
- **HTML companions (`*.html`) ARE ported** via `copy-missing`. They save
  the user from regenerating dozens of reports just to browse history. Old
  HTML may use the old viewer CSS, but content is identical. New
  regenerations take over naturally since `copy-missing` skips existing files.
- **No catch-all `data/*` glob.** The data/ directory is well-structured —
  all files are explicitly listed in DATA_CONTRACT.md. A catch-all would
  also grab system-layer files we don't want (`data/.feature-hints.json`,
  batch state). Instead, the script performs an **unrecognized file scan**
  (see Deliverable 2, Section 4b) that warns the user about files in key
  directories that aren't in the manifest, so they can copy manually.
- **`data/.feature-hints.json` not listed.** System layer, trivially
  regenerated (hints just re-show once).
- **`data/batch/batch-input.tsv` not listed.** Ephemeral manual input file,
  rarely meaningful across instances.
- **`story-bank.md` gets its own `overwrite` entry** separate from the
  `interview-prep/*.md` glob. It's accumulated work, not a one-off generated
  doc. The glob has `exclude: ["story-bank.md"]` to avoid double-processing.
- **`required: true`** only on the 3 core files (cv.md, profile.yml,
  _profile.md). If these are missing from the source, the script warns
  prominently — the user probably pointed to the wrong folder.
- **Custom templates use `copy-missing`** so system-shipped templates
  (ats-optimized.html, classic-professional.html) already exist in the new
  instance and are skipped — only user-created custom templates are ported.
- **`templates/prompts/*` not listed.** These are system-layer files authored
  by the developer, not user-created content. No porting needed.
- **Always create `.bak` when overwriting** — no "smart" template detection
  heuristics. Storage is cheap; losing user data because a heuristic
  misfired is not. If the destination is a blank template, the .bak just
  contains the template — harmless.

---

## Deliverable 2: `scripts/port-profile.mjs`

Deterministic Node.js script. No new npm dependencies (uses `js-yaml` already
in package.json + built-in `fs`/`path`).

### CLI Interface

```
node scripts/port-profile.mjs --source=<path> [--dry-run] [--yes] [--groups=core,pipeline,reports] [--skip=output]

Flags:
  --source=PATH     Path to old career-scout instance (required)
  --dry-run         Show what would be ported without writing anything
  --yes             Skip confirmation prompt (for AI mode / scripted use)
  --groups=a,b,c    Only port these group IDs (comma-separated)
  --skip=a,b        Skip these group IDs even if selected
```

### Exit Codes

- `0` — success (ported files, or nothing to port)
- `1` — error (bad source path, manifest parse error, write failure)

### Script Sections (following project conventions)

The script follows the section-separator convention from `merge-tracker.mjs`
and `verify-pipeline.mjs`:

```
// ── Dependencies ──────────────────────────  (dynamic import + clean error)
// ── Args ──────────────────────────────────
// ── Validate Source ───────────────────────  (case-insensitive on Windows)
// ── Read Manifest ─────────────────────────
// ── Scan Source ───────────────────────────
// ── Unrecognized File Scan ────────────────  (new-instance baseline)
// ── Build Plan ────────────────────────────
// ── Display Plan ──────────────────────────
// ── Execute ───────────────────────────────  (continue-on-failure)
// ── Schema Migration ──────────────────────  (comment-aware injection)
// ── Summary ───────────────────────────────  (granular action breakdown)
```

### Section Details

**0. Dependency Check** — Use dynamic `import('js-yaml')` in a try/catch
instead of a static top-level import. ESM imports are hoisted, so a static
`import` would crash with a cryptic `ERR_MODULE_NOT_FOUND` before any of
our code runs. The dynamic import gives us a clean error:
```javascript
let yaml;
try { yaml = await import('js-yaml'); }
catch { console.error('❌ Dependencies not found. Run: npm install'); process.exit(1); }
```

**1. Args** — Parse CLI args using the existing `process.argv.slice(2)` +
`.find(a => a.startsWith(...))` pattern. Resolve `--source` to absolute path.
Validate `--source` is provided.

**2. Validate Source** — Check that `--source` exists and is a career-scout
folder. Detection: look for `AGENTS.md` OR `modes/` directory. If neither
found, print clear error and exit 1. Also detect source === destination
(both resolved to absolute paths, **case-insensitive on Windows**) and
refuse:
```javascript
const srcNorm = resolve(source).toLowerCase();
const dstNorm = resolve(projectRoot).toLowerCase();
if (srcNorm === dstNorm) {
  console.error('❌ Source and destination are the same folder.');
  process.exit(1);
}
```
This prevents the Windows gotcha where `C:\Work\Career-Scout` and
`c:\work\career-scout` are the same directory but differ as strings.

**3. Read Manifest** — Load `config/port-manifest.yml` from the current
working directory (the NEW instance) using `js-yaml`. Apply `--groups` and
`--skip` filters.

**4. Scan Source** — For each file entry in the manifest:
- **Fixed path** (no glob): check if `resolve(source, entry.path)` exists.
  If file is 0 bytes, treat as "not found" (empty template, not worth porting).
- **Glob pattern**: `readdirSync` on the source directory, filter by
  extension pattern, apply `exclude` list. No external glob library needed —
  all our patterns are simple `dir/*.ext`.

Record for each file: found (bool), source size, source path, destination
path, whether destination already exists.

**4b. Unrecognized File Scan** — After scanning manifest entries, check for
user files in the source that are NOT matched by any manifest entry.

**Approach — new-instance baseline (no hardcoded exclusion list):**
For each scanned directory, list files in BOTH the source and the new
instance. A file is "unrecognized" if it exists in the source but:
- does NOT exist in the new instance (i.e., not a shipped system file), AND
- is NOT matched by any manifest entry

This is self-maintaining — when we add new system files in future phases,
they exist in the new instance and are automatically excluded. No
hardcoded list to keep in sync.

**Directories to scan:**
- Project root (non-directory files only)
- `data/`, `config/`, `interview-prep/`, `writing-samples/`
- `scripts/`, `templates/` (catches user-created helper scripts and
  nested template folders like `templates/cv/experimental/`)

**Skip directories entirely:** `node_modules/`, `.git/`, `.gemini/`,
`.claude/`, `data/batch/` (ephemeral)

If unrecognized files are found, collect them for a warning in the plan:
```
ℹ️ Found 4 files in source not covered by the porting manifest:
     resume_final_v3.pdf (245 KB)
     scripts/my-parser.mjs (3.1 KB)
     data/company-research.txt (1.2 KB)
     templates/cv/experimental/custom.html (8.4 KB)
   These will NOT be ported automatically. Copy them manually if needed.
```
This catches the "junk drawer" case (users treat project folders like
desktops) AND custom scripts/templates, without a catch-all glob that
would grab system-layer files we don't want.

**5. Build Plan** — For each found file, determine concrete action:
- `overwrite`: file will replace destination. `.bak` always created if
  destination exists (no template heuristics — always back up).
  **Non-template content warning:** If the destination file has content
  beyond the template header (e.g., pipeline.md has data rows, not just
  the empty table header), emit a prominent warning in the plan:
  `⚠️ data/pipeline.md has content (5 rows). Overwriting will replace it. Saved to .bak.`
  This catches the scenario where a user evaluated a job in the new
  instance before remembering to port.
- `copy-missing`: file will be copied only if destination does not exist.
  If destination exists, action = "skip (already exists)".
- `append-dedup`: both files will be merged (scan-history.tsv specific).
- Record whether `schema_migrate: true` for post-copy processing.

**6. Display Plan** — Print formatted output with group headers:

```
── Port Plan ─────────────────────────────────

Group: Core Profile
  ✅ cv.md                       → overwrite (3.2 KB)
  ✅ config/profile.yml          → overwrite (2.1 KB) ⚠️ schema migration
  ⏭  config/portals.yml          → not found in source
  ✅ modes/_profile.md           → overwrite (4.5 KB)
  ⏭  article-digest.md           → not found in source

Group: Reports
  ➕ reports/001-acme-2026-05-10.md    → copy (new, 8.1 KB)
  ➕ reports/002-openai-2026-05-11.md  → copy (new, 6.4 KB)
  ⏭  reports/003-stripe-2026-05-12.md → already exists (skip)

Group: Output
  ⏭  output/* → skipped by --skip

── Summary ───────────────────────────────────
Files to port:    12
Schema migrations: 1 (profile.yml)
Skipped:           3 (not found)
Already exist:     1 (skipped by copy-missing)
```

If `--dry-run`, print this and exit 0.

**7. Execute** — If not `--dry-run`:
- If not `--yes`, print P6-style confirmation:
  `⚠️ This will write 12 files. Existing files will be backed up to .bak. Proceed? [y/N]`
  Read stdin. Default N.

- **Continue-on-failure:** Each file operation is wrapped in `try/catch`.
  If a file fails (EBUSY from OneDrive sync, EPERM from antivirus lock,
  any other I/O error), the script:
  1. Logs: `❌ FAILED: cv.md — EBUSY: resource busy or locked`
  2. Records the failure in a `failures[]` array
  3. Continues with the next file

  This prevents a single locked file from leaving the user in a
  "half-ported" state. The summary reports both successes and failures.

  **Why this matters on Windows:** Users clone repos into OneDrive-synced
  folders. OneDrive scans/locks files mid-sync. Windows Defender does the
  same. Rapid read/write/rename across 15 files will occasionally hit a
  lock. The script must not crash.

- For each planned action:
  - Create parent directories with `mkdirSync(dir, { recursive: true })`
  - `overwrite`: use `writeWithTimestampedBak()` (see .bak Policy above).
    For binary files (.pdf, .docx), read/write without encoding (Buffer).
    For text files, use `'utf8'`.
  - `copy-missing`: simple `readFileSync` + `writeFileSync` (no .bak needed
    since destination doesn't exist).
  - `append-dedup` (scan-history.tsv):
    - Read both old and new TSV files
    - **Header validation:** Verify old TSV's first line has the same
      column count (tab-split) as the new TSV's header. If not, treat
      old file as malformed — warn and skip:
      `⚠️ scan-history.tsv: header mismatch (old has 5 cols, new has 7). Skipping merge — copy manually.`
    - Parse: split by `\n`, header on line 0, data from line 1+
    - Build a Set of URLs from the new file (column 0, normalized:
      lowercase, strip trailing slash)
    - For each row in old file: if URL not in Set, append
    - Write merged result with `writeWithTimestampedBak()`
    - Log: `"✅ scan-history.tsv: merged {N} new entries ({M} duplicates skipped)"`

**8. Schema Migration** — For files with `schema_migrate: true` (currently
only `config/profile.yml`):

**The YAML comment problem:** `js-yaml.load()` + `js-yaml.dump()` destroys
all comments. The current `profile.yml` has extensive inline comments
explaining each field. Losing these is unacceptable.

**Solution — structural detection, textual injection:**
1. Parse both the old (now ported) file and the new template (read into
   memory BEFORE the overwrite step) with `js-yaml.load()` to get key trees.
2. Compare top-level keys. For each key present in template but missing in
   the ported file, record it as "needs injection".
3. For each missing key: find the raw text section in the template file
   (from `^{key}:` to the next top-level `^[a-z]` key or EOF). **Also
   scan upward** from the `^{key}:` line to include preceding `#` comment
   lines (stop at the first non-comment, non-blank line). This preserves
   the documentation that describes the key:
   ```yaml
   # Settings for the automatic evaluator       ← included
   auto:                                         ← key line
     min_cv_score: 80    # composite threshold   ← included
   ```
4. Append the extracted section to the end of the ported file with a comment:
   ```yaml

   # ── Added by port (new in this version) ──────────────────
   auto:
     min_cv_score: 80    # composite threshold for CV generation in auto mode
   ```
5. Log the **exact content** that was injected (not just the key name) so
   the user can visually verify:
   ```
   ⚠️ Injected missing section into profile.yml:
   ───
   auto:
     min_cv_score: 80    # composite threshold for CV generation in auto mode
   ───
   Please verify config/profile.yml is still valid YAML.
   ```

This preserves all original comments and formatting while adding new sections.

**Nesting limitation (documented in code):** The textual injection only
handles top-level block additions (e.g., a new `auto:` block). If a future
version adds a nested key inside an existing block (e.g., `candidate.social.bluesky`),
the current logic won't detect or inject it. The script should include a
`// TODO: deep key injection if profile.yml gains nested additions` comment.
This is acceptable for MVP — all schema changes so far have been top-level
blocks (`auto`, `batch`), and new nested keys can be handled by mode files
defaulting gracefully when keys are absent.

**Implementation detail:** The template must be read into memory in step 7
BEFORE overwriting profile.yml. Sequence:
```
templateText = readFileSync('config/profile.yml', 'utf8')  // read template
templateKeys = yaml.load(templateText)                     // parse structure
writeWithBak('config/profile.yml', oldContent)             // overwrite with old
portedKeys = yaml.load(oldContent)                         // parse old
missingKeys = findMissing(templateKeys, portedKeys)        // compare
if (missingKeys.length > 0) {
  sections = extractSections(templateText, missingKeys)    // get raw text
  appendToFile('config/profile.yml', sections)             // inject
}
```

**9. Summary** — Print success/failure report:

Success case:
```
── Port Summary ──────────────────────────────
Source: C:/Work/old-career-scout

  Files ported:     12
    Created:         5  (copy-missing)
    Updated:         6  (overwrite + .bak)
    Merged:          1  (append-dedup)
  Schema migrations: 1  (profile.yml)
  Failures:          0

⚠️ profile.yml: 1 section injected — verify YAML is valid
ℹ️ _profile.md ported — review for any new sections added in this version

📂 Open: file:///C:/Work/Git-Python/career-scout/config/profile.yml
   Path: config/profile.yml
📂 Open: file:///C:/Work/Git-Python/career-scout/cv.md
   Path: cv.md

💡 Next: lock in your ported data with:
   git add . && git commit -m "Port profile from old instance"
```

Partial failure case (continue-on-failure):
```
── Port Summary (with errors) ────────────────
Source: C:/Work/old-career-scout

  Files ported:     11
    Created:         5  (copy-missing)
    Updated:         6  (overwrite + .bak)
    Merged:          0  (append-dedup)
  Failures:          1
    ❌ data/scan-history.tsv — EBUSY: resource busy or locked

  Try closing OneDrive/file sync, then re-run the port.

💡 Next: lock in your ported data with:
   git add . && git commit -m "Port profile from old instance"
```

The `_profile.md` warning is conditional — only shown when that file was
actually ported. It reminds the user that markdown files don't get schema
migration (unlike profile.yml), so they should manually check for new
sections.

Exit code: `0` if all files succeeded, `1` if any file failed (even if
the rest succeeded). This lets the AI mode detect partial failures.

### .bak Policy — Timestamped Backups

**Always create `.bak`** when overwriting an existing file, regardless of
content. No template detection heuristics — they are brittle and the cost
of a false negative (losing real data) far exceeds the cost of a false
positive (a .bak containing a blank template). Storage is cheap.

**Timestamped naming:** Unlike the rest of the project's simple `.bak`
convention (merge-tracker.mjs, P6), port uses timestamped backups:

```javascript
function backupPath(p) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  return p + '.' + stamp + '.bak';
  // e.g. cv.md.20260525-143000.bak
}

function writeWithTimestampedBak(dest, content, binary = false) {
  if (existsSync(dest)) writeFileSync(backupPath(dest), readFileSync(dest));
  writeFileSync(dest, content, binary ? undefined : 'utf8');
}
```

**Why timestamped (not simple `.bak`):** Port is a one-shot migration that
a confused user might run twice. With simple `.bak`, the second run
overwrites the first run's backup with post-port data — destroying the
original. Timestamped backups never clobber each other. The `.bak` files
are gitignored project-wide so they don't pollute git status.

### Reused Patterns

| Pattern | Source | Lines |
|---------|--------|-------|
| `writeWithBak()` | `scripts/merge-tracker.mjs` | 44-48 |
| Project root resolution | `scripts/merge-tracker.mjs` | 24-25 |
| Arg parsing | `scripts/merge-tracker.mjs` | 29-32 |
| TSV parsing | `scripts/check-history.mjs` | Row-split pattern |
| Section separators (`── Name ──`) | `scripts/verify-pipeline.mjs` | Convention |
| Emoji output (✅❌⚠️⏭➕) | All scripts | Convention |
| `📂 Open: file:///` URI | `scripts/generate-pdf.mjs` | P1 convention |
| `js-yaml` | Already in `package.json` | No new dependency |

### Estimated Size

~250-350 lines. Comparable to `merge-tracker.mjs` (243 lines) with the
addition of manifest parsing and schema migration.

---

## Deliverable 3: `modes/port.md`

AI mode file following existing conventions (setup.md structure, P6
confirmation, P2 next steps). This is a **standalone mode** (no `_shared.md`
needed — it's a utility mode like `setup.md`).

### Mode Content (outline)

```
# Mode: port — Profile Porting

Import your profile and accumulated data from a previous career-scout instance.

## When to Use
- Upgrading to a new version (cloned fresh repo, need your old data)
- The AI detects an empty profile and the user says they have an old instance

## User Layer Safety
- The porting script creates .bak backups before overwriting any existing content
- The old instance is never modified (files are copied, not moved)
- The user chooses which file groups to port

## Important: What is NOT ported
Only your personal data and custom-named files are brought over. If you
directly modified system files in your old instance (default templates,
mode instructions, scripts), those changes are NOT ported — the new version's
system files take precedence. This is by design: system files contain bug
fixes and improvements that you want.

## Step 0: Prerequisites
Check that `npm install` has been run (node_modules/ exists).
If not: "Run `npm install` first — the porting script needs it."

## Step 1: Get Source Path
Ask the user for the path to their old career-scout folder.
Validate: check for AGENTS.md or modes/ directory.
**Windows paths:** The user may paste paths with spaces (e.g.,
`C:\Users\John Doe\Documents\career-scout`). When constructing the
script command, always wrap the --source value in quotes.

## Step 2: Preview
Run: node scripts/port-profile.mjs --source=<path> --dry-run
Show the plan output to the user.

## Step 3: User Selection
Present groups as a numbered checklist. Default: all selected.
Let the user type 'all' or list group numbers.

## Step 4: Execute
Run: node scripts/port-profile.mjs --source=<path> --groups=<selected> --yes
Show the output as the script runs.

## Step 5: Schema Migration Review
If the script reports schema migrations, explain what keys were added
and why. Offer to open profile.yml for review.

## Step 6: Lock In + Next Steps (P2)
> **First: lock in your ported data.**
> Run: git add . && git commit -m "Port profile from old instance"
> This creates a clean baseline you can always return to.
>
> Then:
> 1. Review your profile: open config/profile.yml
> 2. Paste a job URL to start evaluating
> 3. Type 'scan' to search for new jobs
> 4. Type 'setup' to tweak any profile settings
>
> 💡 If something looks wrong before you commit:
>    git checkout -- . && git clean -fd
>    If you already committed, reset to clone state:
>    git reset --hard HEAD~1 && git clean -fd
>
> ℹ️ Note: Your AI CLI's project memory (Gemini's .gemini/, Claude Code's
>    .claude/) is tied to the directory path. If you had project-specific
>    notes or memories in your old instance, copy those folders manually.
```

### Integration with First-Run Detection

AGENTS.md currently checks if cv.md, profile.yml, _profile.md have content.
If any fail, it enters setup mode. We add a branch:

```
If any check fails: Enter onboarding mode.
- If the user mentions an existing instance → route to port mode
- Otherwise → run setup mode
```

This is a small text update to AGENTS.md, not a structural change.

---

## Routing and Documentation Updates

### Files to Update

| File | Change |
|------|--------|
| `AGENTS.md` | Add `port` row to Mode Routing table + update onboarding block |
| `GEMINI.md` | Add `port` routing row (if GEMINI.md has its own routing table) |
| `.agents/skills/career-scout/SKILL.md` | Add `port` to routing table + discovery menu + Phase 6 Active |
| `docs/DATA_CONTRACT.md` | Add `config/port-manifest.yml` to System Layer table + Rule 5 for port-profile.mjs |
| `README.md` | Add "Upgrading from a Previous Version" section |
| `plan_rs/CONSOLIDATION-PLAN.md` | Update Phase 6: mark items, add deliverables, bump version |

### AGENTS.md Mode Routing Addition

Add after the "batch" row:
```
| Types "port" or "import profile" | Read `modes/port.md` |
```

### SKILL.md Additions

Routing table — add:
```
| `port` | `port` |
```

Discovery menu — add after batch section:
```
  /career-scout port              → Import profile from a previous career-scout instance
  /career-scout port --dry-run    → Preview what would be imported (via script)
```

Standalone modes table — add:
```
| `port` | `modes/port.md` |
```

Phase Status — add:
```
| 6: Profile Porting | **Active** | port |
```

### DATA_CONTRACT.md

System Layer table — add:
```
| `config/port-manifest.yml` | Profile porting manifest — defines which user-layer files to port and how |
```

Rules — add:
```
5. **Exception — `port-profile.mjs`:** This script writes user-layer files
   into the current instance as part of profile porting. It always writes a
   `.bak` backup first, and only runs when explicitly invoked by the user.
```

### README.md

Add a new section:
```markdown
## Upgrading from a Previous Version

If you have an existing career-scout instance with your profile and data:

1. Clone the new version to a fresh folder
2. `cd` into the new folder and run `npm install`
3. Open your AI CLI and type `port`
4. Paste the path to your old career-scout folder
5. Select which data to bring over (default: everything)

Or use the script directly:
  node scripts/port-profile.mjs --source=/path/to/old --dry-run   # preview
  node scripts/port-profile.mjs --source=/path/to/old             # execute

Your old instance is never modified — files are copied, not moved.
```

---

## Implementation Sequence

| Step | Deliverable | Depends on |
|------|-------------|------------|
| 0 | Save spec to `plan_rs/phase6-port-profile.md` for Gemini review | — |
| 1 | `config/port-manifest.yml` | — |
| 2 | `scripts/port-profile.mjs` | Step 1 (reads the manifest) |
| 3 | `modes/port.md` | Step 2 (calls the script) |
| 4 | Routing updates (AGENTS.md, SKILL.md, GEMINI.md) | Step 3 |
| 5 | Documentation (DATA_CONTRACT.md, README.md) | Step 4 |
| 6 | `plan_rs/CONSOLIDATION-PLAN.md` update | Step 5 |

Steps 4+5 can be done in parallel.

---

## Edge Cases and Error Handling

| Case | Handling |
|------|----------|
| Source = destination (same folder) | Detect via resolved absolute paths, **case-insensitive on Windows** (`.toLowerCase()`), refuse with error |
| Source has no AGENTS.md or modes/ | Clear error: "This doesn't look like a career-scout folder" |
| File exists in manifest but not in source | `⏭ not found in source` — graceful skip |
| Source file is 0 bytes | Treat as "not found" (empty template, not worth porting) |
| Destination already has content (copy-missing) | Skip: "already exists" — no overwrite |
| Destination has non-template data (overwrite) | Prominent ⚠️ warning showing row count. Timestamped `.bak` preserves existing data. User can merge from `.bak` afterward. |
| Source path has spaces (Windows) | `path.resolve()` handles it. Mode instructs AI to quote `--source` value. |
| Unrecognized files in source (root + data/) | Warning listing files not in manifest. User copies manually if needed. |
| File locked by OneDrive / antivirus (EBUSY/EPERM) | Per-file try/catch. Log `❌ FAILED`, continue with remaining files. Summary reports failures. Exit 1 if any failed. |
| User runs port twice (confused) | Timestamped `.bak` files never clobber each other. Second run is safe — each run creates its own dated backups. |
| Binary files (.pdf, .docx) | Read/write as Buffer (no encoding), not utf8 |
| scan-history.tsv malformed rows | Skip rows with < 1 column, log warning |
| scan-history.tsv header mismatch | Compare column count of old vs new header. If different, warn and skip merge (schema changed between versions). |
| js-yaml not installed (npm install skipped) | Dynamic `import('js-yaml')` in try/catch. Clean error: "Run npm install first." |
| Custom scripts/templates in source | Unrecognized file scan uses new-instance baseline — flags files in source that don't exist in new instance and aren't in manifest. |
| profile.yml missing new keys | Schema migration injects sections from template |
| profile.yml has keys the template doesn't | Preserved — never remove user keys |
| Permission errors (Windows file locking) | try/catch per operation, clear error message |
| Running port twice (idempotent) | overwrite: new timestamped .bak each time; copy-missing: skips existing; append-dedup: URL dedup prevents duplicates |
| Required file missing from source | Prominent warning: "⚠️ cv.md not found — is this the right folder?" |
| Custom template has same name as system template | `copy-missing` skips it — system version wins. User's custom template was actually a modified system file, not a true custom addition. The "What is NOT ported" warning covers this. |
| _profile.md ported from older version | Summary warns user to check for new sections. No automated markdown schema migration — manual review only. |
| User wants to undo the port | Rollback via `git checkout -- . && git clean -fd` (fresh clone, nothing committed yet). Documented in mode Step 6 and script summary. |

---

## What This Plan Does NOT Include (explicitly deferred)

- Non-git distribution (zip/tarball) — user said git-only
- .gitignore on user-layer files — user explicitly rejected
- Separate data directory (`~/career-scout-data/`) — deferred
- VERSION file / version awareness — not needed for MVP porting
- Automated upgrade detection ("your version is out of date")
- `git pull` upgrade path — the whole point is to avoid this

---

## Verification Plan

1. **Setup test environment:** Copy current career-scout to a temp folder
   (simulating an "old instance" with real data)

2. **Dry-run test:** Run `port-profile.mjs --source=<temp> --dry-run`.
   Verify plan lists all expected files with correct strategies.

3. **Full port test:** Run without `--dry-run`. Verify:
   - Files copied to correct locations
   - `.bak` created for non-template destinations
   - Parent directories created as needed

4. **Schema migration test:** Remove `auto` and `batch` keys from old
   profile.yml. Port it. Verify those sections appear at the end of the
   ported file with template defaults and preserved comments.

5. **Append-dedup test:** Create scan-history.tsv with overlapping rows in
   both old and new. Verify merged result has no duplicates, preserves the
   new instance's header row.

6. **Idempotency test:** Run port again. Verify no duplicate copies, .bak
   updated, scan-history.tsv not double-appended.

7. **Group selection test:** Run with `--groups=core,reports`. Verify only
   those groups are ported.

8. **Edge case tests:** Missing source files, same-folder detection, 0-byte
   files, binary PDF copy.

9. **AI mode test:** Type "port" in the CLI, walk through guided flow end
   to end.

---

## Critical Files Reference

| File | Why it matters |
|------|---------------|
| `scripts/merge-tracker.mjs` | `writeWithBak()` pattern, arg parsing, section separators |
| `scripts/check-history.mjs` | TSV parsing pattern for scan-history.tsv merge |
| `scripts/verify-pipeline.mjs` | Output format conventions, summary section |
| `scripts/audit-contact.mjs` | Per-field ✅/❌ reporting pattern |
| `scripts/generate-pdf.mjs` | `📂 Open: file:///` URI output pattern (P1) |
| `modes/setup.md` | Step-numbered mode structure, P6 confirmation, P2 next steps |
| `modes/_shared.md` | P1-P6 UX conventions |
| `config/profile.yml` | Template whose schema must survive migration |
| `docs/DATA_CONTRACT.md` | Authoritative user vs system layer mapping |

---

## Gemini Review — Round 1 (2026-05-25)

| # | Finding | Verdict | Action taken |
|---|---------|---------|--------------|
| 1 | Custom CV templates and domain packs should be ported | **Accept (partial)** | Added `customizations` group with `copy-missing` for `templates/cv/*.html` and `templates/domain-packs/*.yml`. Rejected `templates/prompts/*` — those are system-layer, not user-created. |
| 2 | `.env` / API keys should be ported | **Reject** | career-scout has no `.env` file. API keys are managed by CLI tools (Gemini CLI, Claude Code) in the user's home directory (`~/.claude/`, `~/.gemini/`), not in the project folder. Cloning a new repo doesn't affect them. |
| 3 | Assets / media files (profile pictures, custom fonts) should be ported | **Reject** | No `assets/` directory exists. CV templates are text-only, ATS-optimized (photos discouraged). Fonts are system-managed in `fonts/`. Speculative addition without evidence. |
| 4 | Schema migration for `_profile.md` (markdown tables may gain columns) | **Accept (modified)** | Added conditional warning in port summary when `_profile.md` is ported: "review for any new sections." No markdown parser — manual review only. Mode files already handle missing `_profile.md` sections gracefully. |
| 5 | Warn users that modified system files are NOT ported | **Accept** | Added "What is NOT ported" section to `modes/port.md` explaining that system file modifications stay in the old instance by design. |
| 6 | Rollback / undo story | **Accept** | Added `git checkout -- . && git clean -fd` guidance to both the script summary and mode Step 6. Safe in the fresh-clone context (nothing committed yet). |

## Gemini Review — Round 2 (2026-05-25)

| # | Finding | Verdict | Action taken |
|---|---------|---------|--------------|
| 1 | pipeline.md / applications.md overwrite risks wiping new-instance data | **Accept (modified)** | Not building markdown table merge logic (pipeline.md has 2 sections with different schemas — over-engineering for MVP). Instead: script emits a prominent `⚠️` warning when destination has content beyond the template header, showing the row count. The `.bak` preserves everything. User can merge from `.bak` manually. The first-run onboarding flow in AGENTS.md also pushes users to port before evaluating, reducing this scenario's likelihood. |
| 2 | Port `*.html` companions via `copy-missing` instead of skipping them | **Accept** | Added `reports/*.html` and `interview-prep/*.html` entries with `copy-missing`. No downside — old HTML may use old viewer CSS but content is identical. New regenerations take over naturally since `copy-missing` skips existing files. |
| 3 | Catch-all `data/*` glob for "junk drawer" files | **Reject (with enhancement)** | The data/ directory is well-structured — all files listed in DATA_CONTRACT.md. A catch-all would also grab system-layer files we don't want (`data/.feature-hints.json`, batch state). Instead: added **unrecognized file scan** (Section 4b) that warns the user about files in key directories that aren't in the manifest, so they can copy manually. |
| 4 | Schema migration nesting limitation | **Accept** | Added note to schema migration section documenting that textual injection only handles top-level blocks. Added TODO marker for the script code. Acceptable for MVP — all schema changes so far have been top-level blocks, and mode files default gracefully when keys are absent. |
| 5 | Windows paths with spaces | **Accept** | Added note to modes/port.md Step 1: AI wraps `--source` value in quotes. Node.js `path.resolve()` handles spaces natively in the script. |
| 6 | Remove "Smart .bak" heuristics — always create .bak | **Accept** | Removed Template Detection section entirely. Replaced with simple `.bak Policy`: always create `.bak` when overwriting an existing file. Simpler code, safer behavior, no heuristic edge cases. |
| 7 | CLI project memory tied to directory path | **Accept (documentation only)** | Added one-line note to modes/port.md Step 6 reminding users that `.gemini/` and `.claude/` project memory is tied to directory path and may need manual copying. No code changes — these are managed by CLI tools, not career-scout. |

## Gemini Review — Round 3: Senior Engineer (2026-05-25)

Reviewer framing: 15 years of field experience with local file-manipulation
tools on Windows. Architecture rated 9/10, defensive file ops rated 6/10.

| # | Finding | Verdict | Action taken |
|---|---------|---------|--------------|
| 1 | "Smart Template" heuristic is a data-loss trap | **Already fixed in R2** | Template Detection was removed in v1.2 — plan already says "always create `.bak`." Cleaned up one stale edge case row that still referenced "Overwrite without .bak." |
| 2 | Windows file locks (EBUSY/EPERM) from OneDrive/antivirus | **Accept** | Added continue-on-failure behavior to Execute section. Per-file `try/catch`, collect failures in array, continue with remaining files. Summary explicitly reports successes AND failures. Exit code 1 if any file failed. |
| 3 | Backup clobbering — second run overwrites first run's .bak | **Accept** | Switched from simple `.bak` to **timestamped backups** (`cv.md.20260525-143000.bak`). Each run creates its own dated backups, never clobbering previous ones. Documented why this diverges from the project's simple `.bak` convention (port is a retry-prone one-shot migration, not a routine operation). |
| 4 | Regex YAML injection — print exact injected content | **Accept (modified)** | Changed log from one-line summary to full injected-content dump with `───` delimiters + "Please verify" prompt. Keeps V1 regex approach (already documented as fragile in R2 nesting limitation note). |
| 5 | Unmanaged cruft at project root (resume_final_v3.pdf, etc.) | **Accept (extend existing)** | Extended R2's unrecognized file scan (Section 4b) from just data/config directories to also include the **project root** (with a known-system-files exclusion list). Users treat project folders like desktops. |
| 6 | Git commit after port — establish clean baseline | **Accept** | Added `git add . && git commit -m "Port profile from old instance"` as Step 0 in the Next Steps block. This gives the user a post-port baseline to `git checkout` back to if they mess up their next step. Rollback guidance updated for both pre-commit and post-commit scenarios. |

**Post-R3 defensive ops rating:** The plan now handles: file lock failures
(continue-on-failure), backup clobbering (timestamped .bak), partial
failures (explicit reporting), user cruft (root + dir scan), and rollback
(git commit baseline). All 6 findings addressed.

## Gemini Review — Round 4: Bug-Hunting (2026-05-25)

Reviewer rated plan 8.5/10 after R3 hardening. Focus: subtle technical
risks and "Day 1" improvements.

| # | Finding | Verdict | Action taken |
|---|---------|---------|--------------|
| 1 | scripts/ and templates/ excluded from unrecognized file scan — user-created helpers/templates silently lost | **Accept (modified)** | Extended scan to include `scripts/` and `templates/`. Replaced hardcoded exclusion list with **new-instance baseline** approach: list files in both source and new instance; if a file exists in source but not in new instance and isn't in manifest, it's user-created. Self-maintaining — no exclusion list to update when we add system files. |
| 2 | Case-insensitive path comparison on Windows — `C:\Work\Career-Scout` vs `c:\work\career-scout` | **Accept** | Added `.toLowerCase()` on both resolved paths for same-directory detection. Real Windows bug — simple fix. |
| 3 | YAML injection misses preceding `#` comment blocks | **Accept** | Updated extraction logic: scan upward from `^{key}:` line to include preceding `#` comment lines. Stops at first non-comment, non-blank line. User gets both the config AND its documentation. |
| 4 | Script crashes with cryptic error if npm install not run | **Accept** | Switched to dynamic `import('js-yaml')` in try/catch for clean error message. Also added npm install prerequisite check to modes/port.md Step 1. |
| 5 | TSV header fragility — empty/corrupted old scan-history.tsv | **Accept** | Added header validation: compare column count of old vs new TSV. If mismatch, warn and skip merge instead of blindly appending. |
| 6 | Summary too vague ("12 files ported") — should show action breakdown | **Accept** | Summary now shows per-action-type counts: Created (copy-missing), Updated (overwrite + .bak), Merged (append-dedup), Failures. Clear at a glance what happened. |

**Post-R4 status:** All known technical risks addressed. The new-instance
baseline approach for unrecognized file scanning is cleaner than the
previous hardcoded exclusion list and eliminates a maintenance burden.

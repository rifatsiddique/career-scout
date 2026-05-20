# Plan: Standalone Deployment — career-scout as a distributable repo

## Context

Currently career-scout lives inside the Git-Python monorepo. The developer works there
and updates their personal copy manually. The goal:

1. career-scout gets its own GitHub repo (the "product")
2. Developer still works in the monorepo — pushes to the standalone repo when ready to release
3. User data (cv.md, portals.yml, profile.yml, etc.) is gitignored — `git pull` never
   touches personal files
4. End users update with one command, no Git knowledge needed, automatic backup first

---

## Decision: Public vs Private

**Decision: Private (invite-only).** You add each user as a GitHub collaborator.
They authenticate once and can clone/pull indefinitely.

### How access works

1. You go to `github.com/YOU/career-scout → Settings → Collaborators`
2. Add the user's GitHub username or email
3. They get a GitHub invite → accept it
4. They clone using their GitHub credentials (HTTPS or SSH)

### What users need

- A free GitHub account
- Git installed on their machine
- Your invite accepted

### Clone command for invited users

```bash
# HTTPS (simplest — GitHub will prompt for credentials once)
git clone https://github.com/YOU/career-scout.git

# Or with GitHub CLI (if they have it)
gh repo clone YOU/career-scout
```

GitHub stores credentials after first login — subsequent `git pull` needs no password.

---

## Architecture

```
C:/Work/Git-Python/career-scout/   ← Developer works here (monorepo)
        │
        │  git subtree push --prefix=career-scout release main
        ▼
github.com/YOU/career-scout        ← Standalone repo (what users clone)
        │
        │  git clone / git pull
        ▼
~/career-scout/                    ← User's installed copy
  ├── (system files — tracked)
  │     modes/, scripts/, templates/, fonts/, config/portals.example.yml, ...
  └── (user files — gitignored, never touched by git pull)
        cv.md, config/portals.yml, config/profile.yml,
        modes/_profile.md, data/*, reports/*, output/*, ...
```

---

## Part 1: What goes in the standalone repo

### System layer (tracked — in GitHub)

Everything from the current System layer in DATA_CONTRACT.md:

```
AGENTS.md, CLAUDE.md, GEMINI.md
modes/_shared.md, modes/evaluate.md, modes/cv.md, modes/scan.md,
modes/pipeline-triage.md, modes/setup.md
scripts/scan.mjs, scripts/generate-pdf.mjs, scripts/check-history.mjs,
scripts/liveness-core.mjs, scripts/check-liveness.mjs
templates/cv/*.html, templates/cv/manifest.yml, templates/prompts/
templates/domain-packs/, templates/states.yml
config/portals.example.yml
fonts/
.agents/skills/career-scout/SKILL.md
docs/DATA_CONTRACT.md, docs/
plan_rs/   (planning docs — helpful for contributors)
package.json, package-lock.json, .gitignore
README.md
```

### User layer (gitignored — never in GitHub)

```
cv.md
article-digest.md
config/profile.yml
config/portals.yml
modes/_profile.md
data/pipeline.md, data/applications.md, data/scan-history.tsv
data/inbox.txt, data/archived.md, data/.scout-state.json
data/follow-ups.md
data/.backups/         (update backups — always local)
reports/
output/
writing-samples/
interview-prep/story-bank.md    ← gitignored (user fills this in; template in templates/)
interview-prep/*-*.md          (company-specific interview notes)
```

### Gitkeep files (preserve directory structure without content)

Empty directories need a `.gitkeep` file so git tracks the folder:
```
data/.gitkeep
reports/.gitkeep
output/.gitkeep
writing-samples/.gitkeep
interview-prep/.gitkeep
```

---

## Part 2: The .gitignore update

Replace the current minimal `.gitignore` with a complete user-layer exclusion list:

```gitignore
# Dependencies
node_modules/

# Generated output (always local)
output/
*.bak
*.backup

# Environment / secrets (just in case)
.env
.env.*

# ── USER LAYER — personal data, never committed ──────────────────────────────
# These files are created during setup and contain your personal information.
# git pull will NEVER touch these files.

# Master CV and proof points
cv.md
article-digest.md

# Profile configuration
config/profile.yml
config/portals.yml
modes/_profile.md

# Job data (all subdirectory contents, keep folder structure via .gitkeep)
data/*
!data/.gitkeep

# Reports, CVs, interview notes (generated, personal)
reports/*
!reports/.gitkeep
writing-samples/*
!writing-samples/.gitkeep

# Interview prep — gitignore user's story bank and company notes
# Template lives at templates/story-bank.template.md
# Setup creates interview-prep/story-bank.md from template on first run
interview-prep/*
!interview-prep/.gitkeep
```

**Note on story-bank.md (Gemini-flagged bug, now fixed):**
~~Keep it in the repo as an empty template~~ → **Gitignore it.**

If story-bank.md is git-tracked and the user fills it in, `git pull` creates a conflict
or overwrites their work. The fix:
- Ship `templates/story-bank.template.md` (empty template, tracked in repo)
- Gitignore `interview-prep/story-bank.md`
- Onboarding check (AGENTS.md) already has: "if story-bank.md missing → guide user to create it"
  → Update this to: "if missing → copy from templates/story-bank.template.md silently"

---

## Part 3: Release mechanism — developer workflow

### Setup (one-time)

In the monorepo, add the standalone repo as a second remote:

```bash
cd C:/Work/Git-Python
git remote add career-scout-release git@github.com:YOU/career-scout.git
```

### Releasing an update

A `scripts/release.mjs` script in the monorepo (NOT shipped to users) handles the full
release flow. Run from the monorepo root:

```bash
node career-scout/scripts/release.mjs
```

**What it does:**

```
1. Pre-release safety check — verify no personal files are staged:
   - git ls-files career-scout/cv.md → should return NOTHING
   - git ls-files career-scout/config/portals.yml → should return NOTHING
   - git ls-files career-scout/modes/_profile.md → should return NOTHING
   If any return results: STOP and warn. Personal data would be pushed.

2. Confirm: "Ready to push to career-scout-release/main? (yes/no)"

3. git subtree push --prefix=career-scout career-scout-release main

4. Prompt for version bump: "Version? (current: x.y.z) → "
   Update package.json version field

5. git tag -a vX.Y.Z -m "Release vX.Y.Z" (on monorepo)

6. Report: "Released vX.Y.Z to github.com/YOU/career-scout"
```

**Uses `import.meta.url` for all path resolution** — works regardless of where the
script is called from. Hard rule: all scripts use `import.meta.url`, never `process.cwd()`.

### Manual release (if preferred)

```bash
cd C:/Work/Git-Python
git subtree push --prefix=career-scout career-scout-release main
```

This pushes only the `career-scout/` subfolder as if it were the root of the standalone
repo. Users see a normal single-project repo, not a monorepo.

**What the developer sees vs what users see:**

```
Developer (monorepo):          User (standalone clone):
career-scout/                  career-scout/
├── modes/                     ├── modes/
├── scripts/                   ├── scripts/
├── cv.md  ← dev's own CV      ├── (cv.md doesn't exist yet — setup creates it)
├── config/portals.yml ← dev's ├── (portals.yml doesn't exist yet — setup creates it)
└── data/                      └── data/  (empty, .gitkeep only)
```

The developer's personal files (cv.md, portals.yml, etc.) exist in the monorepo
but are NOT pushed to the standalone repo (gitignored from the standalone repo's
perspective).

---

## Part 4: `npm run update` — end-user update command

A small script (`scripts/update.mjs`) that handles the full update flow. User never
needs to know about git.

### What it does

```
1. Check: is this a git repo with a valid remote? (safety check)
2. Backup (unless --no-backup): copy all user layer files to data/.backups/YYYY-MM-DD/
   (creates a timestamped folder with everything personal)
3. Pull: git pull origin main
4. Report: show which system files changed (git diff --name-only HEAD@{1} HEAD)
5. Config check: compare top-level keys in portals.example.yml vs portals.yml
   — flag any keys present in example but missing from user's file
   — suggest: "Ask the AI: 'Add any missing fields from portals.example.yml to my portals.yml'"
```

**Uses `import.meta.url` for all path resolution** — works from any directory.

### Usage

```bash
npm run update              # standard (with backup)
npm run update -- --no-backup  # skip backup (for users who trust their git skills)
```

### Output

```
career-scout update
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backing up your personal files...
  Saved to: data/.backups/2026-05-18/

Pulling latest changes...
  Already up to date.   ← or: Updated from v1.2 to v1.3

What changed:
  modes/scan.md     (scan mode improvements)
  scripts/scan.mjs  (bug fix: --fast flag)

Config check:
  Your portals.yml is missing 1 field from the latest example:
    stale_threshold_days: 21   ← NEW field in portals.example.yml
  Ask the AI to add it: "Update my portals.yml with any new fields from portals.example.yml"

Done. Run 'gemini' (or your CLI) to continue.
```

---

## Part 5: Fresh install flow

For someone setting up for the first time (requires GitHub invite first):

```bash
# 1. Accept the GitHub invite (sent to their email by you)
# 2. Install Git if not already: https://git-scm.com

git clone https://github.com/YOU/career-scout.git
cd career-scout
npm install
npx playwright install chromium   # for PDF generation
```

Then open their AI CLI (Gemini, Claude Code, etc.) in the career-scout folder:
```
> setup
```

The onboarding check (already built in AGENTS.md) detects missing user files and
runs the setup wizard automatically.

**Total time from invite-to-first-job-evaluation: ~15 minutes.**

### README install section (what users see)

```markdown
## Installation

You need a GitHub invite to access this repo. Contact [your name] to request access.

Prerequisites:
- Git: https://git-scm.com
- Node.js 18+: https://nodejs.org
- Gemini CLI (or Claude Code, Copilot, etc.)

Steps:
1. Accept the GitHub invite (check your email)
2. git clone https://github.com/YOU/career-scout.git
3. cd career-scout
4. npm install
5. npx playwright install chromium
6. Open your AI CLI in the career-scout folder and type: setup
```

---

## Part 6: Developer's personal data

The developer (you) has personal data in the monorepo's career-scout folder. Since
those files are gitignored in the standalone repo, `git subtree push` won't include them.

Your personal files stay in the monorepo, tracked by the monorepo's git. They never
appear in the standalone GitHub repo.

If you want to back up your personal data separately:
- The monorepo git tracks them (since the monorepo's .gitignore doesn't exclude them)
- OR: the `npm run update` backup system also works for your own copy when you
  `npm run update` to sync what you pushed

---

## Part 7: Versioning (optional, Phase 2)

For now: users just get `main`. When the tool is more mature, add semantic versioning:
- `CHANGELOG.md` tracking what changed per release
- Git tags (`v1.0.0`, `v1.1.0`) for each release
- `npm run update` shows "Updated from v1.0.0 to v1.1.0"

Not needed now — implement when there are multiple users with different versions.

---

## Implementation Steps

1. **Create private GitHub repo:** `github.com/YOU/career-scout`
2. **Move story-bank.md:** Copy `interview-prep/story-bank.md` → `templates/story-bank.template.md`
   Update AGENTS.md onboarding check: if missing → copy from template silently
3. **Update `.gitignore`** — full user-layer exclusion list + .env + story-bank.md
4. **Add `.gitkeep` files** in data/, reports/, output/, writing-samples/, interview-prep/
5. **Write `scripts/update.mjs`** — backup + `git pull` + config key diff + --no-backup flag
   (uses import.meta.url for paths)
6. **Write `scripts/release.mjs`** — pre-release safety check + subtree push + version tag
   (lives in monorepo only, not shipped to users)
7. **Add npm scripts to `package.json`:** `"update": "node scripts/update.mjs"`
8. **Update README.md** — Installation section (invite flow), update instructions
9. **Add release remote in monorepo:**
   `git remote add career-scout-release git@github.com:YOU/career-scout.git`
10. **First push:** `node career-scout/scripts/release.mjs` (or manual subtree push)
11. **Verify:** Clone the standalone repo fresh, run setup, confirm user data is gitignored

---

## Gemini Review Log

| Finding | Decision | Rationale |
|---------|----------|-----------|
| Subtree push security risk (personal data accidentally pushed) | Adopt | Pre-release safety check in release.mjs verifies user files are gitignored |
| story-bank.md conflict on git pull | Adopt — critical fix | Gitignore it, ship templates/story-bank.template.md, setup copies on first run |
| Path portability (import.meta.url) | Adopt as hard rule | All scripts must use import.meta.url, documented explicitly |
| Public vs private recommendation | Reject | User decided private/invite-only — respecting that choice |
| release.sh deployment recipe | Adopt (as release.mjs) | Consolidated push + tag + safety check script |
| .env in .gitignore | Adopt | Standard good practice |
| npm run update --no-backup flag | Adopt | Power user option, low cost |

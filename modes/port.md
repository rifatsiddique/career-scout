# Mode: port — Profile Porting

Guides the user through importing their profile and accumulated data from a
previous career-scout instance into this one.

**When to use:**
- Upgrading to a new version (cloned a fresh repo, need your old data)
- The onboarding check detects an empty profile AND the user says they have
  an existing career-scout folder

**What gets ported:** Personal data only — CV, profile, reports, interview
prep, story bank, pipeline tracker, scan history, custom templates. See
`config/port-manifest.yml` for the full list and strategies.

**What does NOT get ported:** System files (modes, scripts, default templates).
If you modified system files directly in your old instance (e.g., tweaked a
default template or a script), those changes stay behind — the new version's
system files take precedence. This is intentional: system files contain bug
fixes and improvements you want.

**Safety:** All overwrites create a timestamped `.bak` backup before writing
(e.g., `cv.md.20260525-143000.bak`). Your old instance is never modified —
files are copied, not moved. You choose which groups to port.

---

## Step 0: Prerequisites

Before starting, verify:

1. Have you run `npm install` in this new folder?
   Check: does `node_modules/` exist here?
   If not: run `npm install` first — the porting script needs it.

2. Do you have your old career-scout folder path handy?

If both are ready, proceed.

---

## Step 1: Get Source Path

Ask the user:

> "Where is your previous career-scout folder?
>  Paste the full path to the old instance
>  (e.g., C:/Work/Git-Python/career-scout-old)."

**Validate the path:**
- Check that it exists
- Check that it contains `AGENTS.md` or a `modes/` directory

If validation fails, explain what's wrong and ask again.

**Windows paths with spaces:** Paths like `C:\Users\John Doe\Documents\career-scout`
are valid. When constructing the script command, wrap the path in quotes:
```
node scripts/port-profile.mjs --source="C:\Users\John Doe\Documents\career-scout" --dry-run
```

---

## Step 2: Preview the Port Plan

Run the script in dry-run mode to show what would be ported:

```
node scripts/port-profile.mjs --source=<path> --dry-run
```

Show the full output to the user. It displays:
- Groups with per-file actions (create / overwrite / merge / skip)
- Warnings for files with existing content that would be overwritten
- Any unrecognized files in the source that won't be ported automatically

---

## Step 3: User Selection

After showing the dry-run output, present the available groups:

> "Which groups do you want to port?
>
>  [1] core        — CV, profile.yml, portals.yml, _profile.md
>  [2] pipeline    — pipeline.md, applications.md, scan-history.tsv, inbox, follow-ups
>  [3] reports     — Evaluation reports (N found)
>  [4] interview   — Story bank + company prep docs
>  [5] writing     — Writing samples
>  [6] customizations — Custom CV templates and domain packs
>  [7] output      — Generated PDFs, HTML drafts, DOCX exports
>
>  Type 'all' for everything, or enter group numbers separated by commas
>  (e.g., 1,2,3). Default: all."

Map numbers to group IDs: core, pipeline, reports, interview, writing, customizations, output.

---

## Step 4: Execute the Port

Run the script with the selected groups and `--yes` to skip the interactive prompt:

```
node scripts/port-profile.mjs --source=<path> --groups=<selected-ids> --yes
```

Show the output as the script runs. Each line is a file operation result.

If any files failed (❌ lines), note them and explain:
- OneDrive or file sync tools can lock files mid-operation
- Ask the user to pause sync, then offer to re-run for just the failed files

---

## Step 5: Schema Migration Review

If the script reports schema migrations (injected new keys into profile.yml):

> "Your old profile.yml was missing some settings added in this version.
>  I've appended them at the bottom of the file with their default values.
>
>  The injected section is shown above. Please open config/profile.yml and
>  verify it still looks correct — especially the appended block at the bottom.
>
>  To adjust the new settings: open the file and edit the values, or type
>  'setup' to walk through them interactively."

---

## Step 6: Lock In + Next Steps

> **First: lock in your ported data by committing it.**
> Run in your terminal:
>   git add . && git commit -m "Port profile from old instance"
>
> This creates a clean baseline — if anything looks wrong later, you can
> always return to this state.
>
> Then:
> 1. Review your profile: open config/profile.yml
> 2. Paste a job URL to start evaluating
> 3. Type 'scan' to search for new jobs
> 4. Type 'setup' to update any profile settings
>
> **Rollback (if needed):**
> - Before committing: git checkout -- . && git clean -fd
> - After committing:  git reset --hard HEAD~1 && git clean -fd
>
> **Note on CLI project memory:** Your AI CLI's project memory
> (Gemini's .gemini/ folder, Claude Code's .claude/ folder) is tied
> to the directory path. If you had project-specific notes or memories
> in your old instance's CLI, copy those folders manually.

---

## Integration with First-Run Onboarding

If the onboarding check (AGENTS.md) finds empty profile files:
- If the user says they have an existing career-scout instance → route to this mode
- Otherwise → route to setup mode

Both modes are mutually exclusive — port replaces setup for existing users.

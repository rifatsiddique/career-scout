<#
  Sync SYSTEM-layer files from this git repo into a separate working instance
  (e.g. C:\Work\Git-Local_AI\career-scout), WITHOUT ever touching the user's
  USER-layer data. Use after pulling code updates so the working instance gets the
  new modes/scripts/templates while keeping its CV, career log, profile, reports,
  pipeline, and generated output intact.

  Usage (from the repo's career-scout root):
      pwsh scripts/sync_system.ps1                 # sync to the default dest
      pwsh scripts/sync_system.ps1 -DryRun         # show what WOULD copy, write nothing
      pwsh scripts/sync_system.ps1 -Dest "D:\elsewhere\career-scout"

  NEVER copies (USER layer):
      career-log.md, cv.md, stories.md
      config/profile.yml, config/portals.yml, config/scout-preferences.yml
      modes/_profile.md
      data\**, reports\**, output\**, interview-prep\**, writing-samples\**

  See docs/DATA_CONTRACT.md for the authoritative layer mapping.
#>
param(
    [string]$Dest = "C:\Work\Git-Local_AI\career-scout",
    [switch]$DryRun
)
$ErrorActionPreference = "Stop"
$Src = (Resolve-Path "$PSScriptRoot\..").Path

if (-not (Test-Path $Dest)) { throw "Destination not found: $Dest" }
if ((Resolve-Path $Dest).Path -eq $Src) { throw "Destination is the source. Refusing." }

$flags = @("/NJH", "/NJS", "/NP", "/NDL")
if ($DryRun) { $flags += "/L" }
$xd = @("node_modules", "__pycache__", ".git")

function Sync-Dir($rel, [string[]]$files = @(), [string[]]$excludeFiles = @()) {
    $s = Join-Path $Src $rel; $d = Join-Path $Dest $rel
    if (-not (Test-Path $s)) { return }
    $roboArgs = @($s, $d) + $files + @("/E") + $flags
    if ($xd.Count) { $roboArgs += @("/XD") + $xd }
    if ($excludeFiles.Count) { $roboArgs += @("/XF") + $excludeFiles }
    $out = robocopy @roboArgs
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $rel (code $LASTEXITCODE)" }
    if ($DryRun) { $out | Where-Object { $_ -match '\S' } | ForEach-Object { Write-Host "   $_" } }
}

Write-Host "Syncing SYSTEM files: $Src  ->  $Dest" -ForegroundColor Cyan
if ($DryRun) { Write-Host "(dry run - nothing will be written)`n" -ForegroundColor Yellow }

# Whole SYSTEM directories
Write-Host "`n[scripts]";   Sync-Dir "scripts"
Write-Host "[docs]";        Sync-Dir "docs"
Write-Host "[templates]";   Sync-Dir "templates"
Write-Host "[fonts]";       Sync-Dir "fonts"
Write-Host "[.agents]";     Sync-Dir ".agents"

# modes: all *.md EXCEPT the USER-layer _profile.md
Write-Host "[modes]"
Sync-Dir "modes" -files @("*.md") -excludeFiles @("_profile.md", "_profile.md.bak")

# config: SYSTEM files only. profile.yml / portals.yml / scout-preferences.yml never copied.
Write-Host "[config]"
Sync-Dir "config" -files @("*.example.yml", "port-manifest.yml")

# Root SYSTEM files
Write-Host "[root]"
foreach ($f in @("AGENTS.md", "CLAUDE.md", "GEMINI.md", "README.md", ".gitignore",
                 "package.json", "package-lock.json")) {
    $s = Join-Path $Src $f
    if (Test-Path $s) {
        if ($DryRun) { Write-Host "   would copy  $f" }
        else { Copy-Item $s (Join-Path $Dest $f) -Force; Write-Host "   $f" }
    }
}

# --- Post-sync advisories (never acted on automatically) ---
# These concern USER-layer files. The script reports; the user decides.
$notes = @()
if (-not (Test-Path (Join-Path $Dest "career-log.md"))) {
    $notes += "career-log.md is missing - the curate mode has no canonical source yet."
}
if (-not (Test-Path (Join-Path $Dest "stories.md"))) {
    if (Test-Path (Join-Path $Dest "interview-prep\story-bank.md")) {
        $notes += "interview-prep\story-bank.md exists but stories.md does not - your story bank is stranded; every mode now reads stories.md."
    } else {
        $notes += "stories.md is missing - interview-prep and evaluate Block F expect it."
    }
}
if (-not (Test-Path (Join-Path $Dest "data\curate-state.md"))) {
    $notes += "data\curate-state.md is missing - curate cannot track watermarks."
}
if (Test-Path (Join-Path $Dest "article-digest.md")) {
    $notes += "article-digest.md still present - retired; its role moved to career-log.md + stories.md."
}

Write-Host "`nDone. USER-layer files (career log, CV, stories, profile, data, reports, output) were left untouched." -ForegroundColor Green
if ($notes.Count) {
    Write-Host "`nUSER-layer follow-ups this script will NOT do for you:" -ForegroundColor Yellow
    foreach ($n in $notes) { Write-Host "  - $n" -ForegroundColor Yellow }
    Write-Host "  Run 'port' in the working instance, or migrate by hand." -ForegroundColor Yellow
}

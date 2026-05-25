#!/usr/bin/env node
/**
 * port-profile.mjs — port user-layer files from an old career-scout instance
 *
 * Usage:
 *   node scripts/port-profile.mjs --source=<path> [--dry-run] [--yes]
 *                                  [--groups=core,pipeline,reports]
 *                                  [--skip=output]
 *
 * Reads config/port-manifest.yml from the current (new) instance.
 * Scans the source (old) instance for every listed file.
 * Copies files according to their strategy:
 *   overwrite     - replaces dest, creates timestamped .bak
 *   copy-missing  - copies only if dest does not exist
 *   append-dedup  - merges TSV rows by URL, deduplicating
 *
 * Exit codes:
 *   0  success (all planned files ported, or nothing to port)
 *   1  error or partial failure (bad args, missing manifest, any file failed)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { resolve, join, dirname, basename, relative } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

// ── Dependencies ───────────────────────────────────────────────────────────────

let yaml;
try {
  yaml = await import('js-yaml');
} catch {
  console.error('❌ Dependencies not found. Run: npm install');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ── Args ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const YES = args.includes('--yes');
const sourceArg = args.find(a => a.startsWith('--source='))?.split('=').slice(1).join('=');
const groupsArg = args.find(a => a.startsWith('--groups='))?.split('=')[1];
const skipArg = args.find(a => a.startsWith('--skip='))?.split('=')[1];

if (!sourceArg) {
  console.error('❌ --source=<path> is required.');
  console.error('   Usage: node scripts/port-profile.mjs --source=/path/to/old-career-scout');
  process.exit(1);
}

const selectedGroups = groupsArg ? groupsArg.split(',').map(s => s.trim()) : null;
const skippedGroups = skipArg ? skipArg.split(',').map(s => s.trim()) : [];

// ── Validate Source ────────────────────────────────────────────────────────────
// Case-insensitive on Windows — C:\Work\X and c:\work\x are the same directory

const source = resolve(sourceArg);

if (!existsSync(source)) {
  console.error(`❌ Source path does not exist: ${source}`);
  process.exit(1);
}

const srcNorm = source.toLowerCase();
const dstNorm = projectRoot.toLowerCase();
if (srcNorm === dstNorm) {
  console.error('❌ Source and destination are the same folder. Point --source at your OLD instance.');
  process.exit(1);
}

const isCareerScout = existsSync(join(source, 'AGENTS.md')) || existsSync(join(source, 'modes'));
if (!isCareerScout) {
  console.error(`❌ ${source} doesn't look like a career-scout folder.`);
  console.error('   Expected to find AGENTS.md or a modes/ directory.');
  process.exit(1);
}

// ── Read Manifest ──────────────────────────────────────────────────────────────

const manifestPath = join(projectRoot, 'config', 'port-manifest.yml');
if (!existsSync(manifestPath)) {
  console.error(`❌ Manifest not found: ${manifestPath}`);
  process.exit(1);
}

let manifest;
try {
  manifest = yaml.load(readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error(`❌ Failed to parse port-manifest.yml: ${e.message}`);
  process.exit(1);
}

// Filter groups
let groups = manifest.groups;
if (selectedGroups) groups = groups.filter(g => selectedGroups.includes(g.id));
groups = groups.filter(g => !skippedGroups.includes(g.id));

// ── Helpers ────────────────────────────────────────────────────────────────────

const BINARY_EXTS = new Set(['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf']);

function isBinary(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return BINARY_EXTS.has(ext);
}

function timestampedBakPath(p) {
  const now = new Date();
  const stamp = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + '-'
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
  return p + '.' + stamp + '.bak';
}

function writeWithBak(dest, content, binary = false) {
  if (DRY_RUN) return;
  if (existsSync(dest)) {
    writeFileSync(timestampedBakPath(dest), readFileSync(dest));
  }
  writeFileSync(dest, content, binary ? undefined : 'utf8');
}

function hasNonTemplateContent(filePath) {
  if (!existsSync(filePath)) return false;
  const size = statSync(filePath).size;
  if (size === 0) return false;
  // If file has meaningful content (> 100 bytes), assume it has user data
  // This is used only for the ⚠️ warning, not for .bak gating (we always .bak)
  return size > 100;
}

function countMarkdownRows(content) {
  // Count non-header, non-separator rows in a markdown table
  return (content.match(/^\|[^|].*\|$/gm) || []).filter(row => !row.match(/^\|[-| ]+\|$/)).length - 1;
}

function normalizeUrl(url) {
  return url.toLowerCase().replace(/\/$/, '').trim();
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim().toLowerCase()); });
  });
}

// ── Scan Source ────────────────────────────────────────────────────────────────

// Expand glob entries: dir/*.ext → list of matching files in source
function expandGlob(srcDir, pattern, excludeList = []) {
  // pattern like "reports/*.md" or "output/*"
  const lastSlash = pattern.lastIndexOf('/');
  const dir = pattern.slice(0, lastSlash);
  const ext = pattern.slice(lastSlash + 2); // after "*"

  const srcDirFull = join(source, dir);
  if (!existsSync(srcDirFull)) return [];

  return readdirSync(srcDirFull)
    .filter(f => {
      if (excludeList.includes(f)) return false;
      if (ext === '') return true; // bare *
      return f.endsWith(ext);
    })
    .map(f => join(dir, f));
}

// Build list of planned file operations
const plan = []; // { srcPath, destPath, strategy, description, sizeKb, destExists, hasData }

for (const group of groups) {
  for (const entry of group.files) {
    if (entry.glob) {
      const matches = expandGlob(source, entry.path, entry.exclude || []);
      for (const relPath of matches) {
        const srcPath = join(source, relPath);
        const destPath = join(projectRoot, relPath);
        const stat = statSync(srcPath);
        if (stat.size === 0) continue; // skip empty files
        plan.push({
          relPath, srcPath, destPath,
          strategy: entry.strategy,
          description: entry.description,
          sizeKb: (stat.size / 1024).toFixed(1),
          destExists: existsSync(destPath),
          hasData: hasNonTemplateContent(destPath),
          schemaMigrate: false,
          groupId: group.id, groupName: group.name,
        });
      }
    } else {
      const srcPath = join(source, entry.path);
      const destPath = join(projectRoot, entry.path);
      if (!existsSync(srcPath)) {
        plan.push({
          relPath: entry.path, srcPath, destPath,
          strategy: entry.strategy,
          description: entry.description,
          sizeKb: null,
          destExists: existsSync(destPath),
          hasData: hasNonTemplateContent(destPath),
          notFound: true,
          required: entry.required,
          schemaMigrate: entry.schema_migrate || false,
          groupId: group.id, groupName: group.name,
        });
      } else {
        const stat = statSync(srcPath);
        if (stat.size === 0) continue;
        plan.push({
          relPath: entry.path, srcPath, destPath,
          strategy: entry.strategy,
          description: entry.description,
          sizeKb: (stat.size / 1024).toFixed(1),
          destExists: existsSync(destPath),
          hasData: hasNonTemplateContent(destPath),
          schemaMigrate: entry.schema_migrate || false,
          groupId: group.id, groupName: group.name,
        });
      }
    }
  }
}

// ── Unrecognized File Scan (new-instance baseline) ─────────────────────────────
// A file in the source is "unrecognized" if it exists in source but NOT in the
// new instance AND is NOT matched by any manifest entry.
// Uses the new instance's file listing as the baseline — self-maintaining,
// no hardcoded exclusion list needed.

const manifestPaths = new Set(plan.map(p => p.relPath.replace(/\\/g, '/')));

function listFilesRecursive(dir, base = '') {
  const result = [];
  if (!existsSync(dir)) return result;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    try {
      if (statSync(full).isDirectory()) {
        result.push(...listFilesRecursive(full, rel));
      } else {
        result.push(rel);
      }
    } catch { /* skip inaccessible */ }
  }
  return result;
}

// Directories to skip entirely in the scan
const SKIP_DIRS = new Set(['node_modules', '.git', '.gemini', '.claude', 'data/batch', 'fonts']);

function scanForUnrecognized(dirName) {
  const srcDir = join(source, dirName);
  const dstDir = join(projectRoot, dirName);
  if (!existsSync(srcDir)) return [];

  const srcFiles = listFilesRecursive(srcDir).map(f => (dirName ? `${dirName}/${f}` : f).replace(/\\/g, '/'));
  const dstFiles = new Set(listFilesRecursive(dstDir).map(f => (dirName ? `${dirName}/${f}` : f).replace(/\\/g, '/')));

  return srcFiles.filter(f => {
    if (manifestPaths.has(f)) return false; // already in manifest
    if (dstFiles.has(f)) return false;       // exists in new instance = system file
    // Skip known non-user dirs
    for (const skip of SKIP_DIRS) { if (f.startsWith(skip + '/') || f === skip) return false; }
    return true;
  });
}

// Scan: root (files only), data/, config/, interview-prep/, writing-samples/, scripts/, templates/
const unrecognized = [];

// Root-level files
const srcRoot = readdirSync(source);
const dstRootFiles = new Set(readdirSync(projectRoot));
for (const f of srcRoot) {
  const full = join(source, f);
  try { if (statSync(full).isDirectory()) continue; } catch { continue; }
  if (dstRootFiles.has(f)) continue;   // exists in new instance = system file
  if (manifestPaths.has(f)) continue;  // in manifest
  unrecognized.push(f);
}

for (const dir of ['data', 'config', 'interview-prep', 'writing-samples', 'scripts', 'templates']) {
  unrecognized.push(...scanForUnrecognized(dir));
}

// ── Display Plan ───────────────────────────────────────────────────────────────

console.log(`\n── Port Plan ${'─'.repeat(45)}`);
console.log(`Source: ${source}\n`);

let lastGroup = null;
let totalTodo = 0;

for (const item of plan) {
  if (item.groupName !== lastGroup) {
    if (lastGroup) console.log();
    console.log(`  Group: ${item.groupName}`);
    lastGroup = item.groupName;
  }

  if (item.notFound) {
    const flag = item.required ? '⚠️ ' : '⏭  ';
    const note = item.required ? ' (REQUIRED — is this the right folder?)' : '';
    console.log(`    ${flag}${item.relPath.padEnd(45)} → not found${note}`);
    continue;
  }

  let action, icon;
  if (item.strategy === 'overwrite') {
    action = item.destExists ? `overwrite (${item.sizeKb} KB)` : `create (${item.sizeKb} KB)`;
    icon = '✅';
    if (item.destExists && item.hasData) {
      // Check for content worth warning about
      if (item.relPath.endsWith('.md')) {
        try {
          const destContent = readFileSync(item.destPath, 'utf8');
          const rows = countMarkdownRows(destContent);
          if (rows > 0) action += ` ⚠️  dest has ${rows} row(s) — will be saved to .bak`;
        } catch { /* ignore */ }
      }
    }
    if (item.schemaMigrate) action += ' + schema migration';
    totalTodo++;
  } else if (item.strategy === 'copy-missing') {
    if (item.destExists) {
      action = 'skip (already exists in new instance)';
      icon = '⏭ ';
    } else {
      action = `create (${item.sizeKb} KB)`;
      icon = '➕';
      totalTodo++;
    }
  } else if (item.strategy === 'append-dedup') {
    action = `merge by URL (${item.sizeKb} KB source)`;
    icon = '🔀';
    totalTodo++;
  }

  console.log(`    ${icon} ${item.relPath.padEnd(45)} → ${action}`);
}

if (unrecognized.length > 0) {
  console.log(`\n  ℹ️  Found ${unrecognized.length} file(s) in source not covered by manifest:`);
  for (const f of unrecognized.slice(0, 10)) {
    let size = '';
    try { size = ` (${(statSync(join(source, f)).size / 1024).toFixed(1)} KB)`; } catch { /* ignore */ }
    console.log(`       ${f}${size}`);
  }
  if (unrecognized.length > 10) console.log(`       ... and ${unrecognized.length - 10} more`);
  console.log('     These will NOT be ported automatically. Copy them manually if needed.');
}

const schemaMigrations = plan.filter(p => p.schemaMigrate && !p.notFound).length;
console.log(`\n── Plan Summary ${'─'.repeat(43)}`);
console.log(`  Files to port: ${totalTodo}`);
if (schemaMigrations) console.log(`  Schema migrations: ${schemaMigrations} (profile.yml)`);
console.log();

if (DRY_RUN) {
  console.log('  (Dry run — no files written)');
  process.exit(0);
}

if (totalTodo === 0) {
  console.log('  Nothing to port.');
  process.exit(0);
}

// ── Execute ────────────────────────────────────────────────────────────────────

if (!YES) {
  const answer = await prompt(`⚠️  This will write ${totalTodo} file(s). Existing files will be backed up with timestamps. Proceed? [y/N] `);
  if (answer !== 'y' && answer !== 'yes') {
    console.log('Aborted.');
    process.exit(0);
  }
}

// Read profile.yml TEMPLATE into memory BEFORE overwriting (for schema migration)
let profileTemplate = null;
const profileDestPath = join(projectRoot, 'config', 'profile.yml');
if (existsSync(profileDestPath)) {
  try { profileTemplate = readFileSync(profileDestPath, 'utf8'); } catch { /* ignore */ }
}

const failures = [];
const counts = { created: 0, updated: 0, merged: 0 };

console.log();

for (const item of plan) {
  if (item.notFound) continue;
  if (item.strategy === 'copy-missing' && item.destExists) continue;

  // Ensure parent directory exists
  const destDir = dirname(item.destPath);
  if (!existsSync(destDir)) {
    try { mkdirSync(destDir, { recursive: true }); } catch (e) {
      failures.push({ file: item.relPath, error: e.message });
      console.log(`  ❌ FAILED (mkdir): ${item.relPath} — ${e.message}`);
      continue;
    }
  }

  try {
    if (item.strategy === 'overwrite' || item.strategy === 'copy-missing') {
      const binary = isBinary(item.srcPath);
      const content = readFileSync(item.srcPath, binary ? { encoding: null } : 'utf8');
      if (item.strategy === 'overwrite') {
        writeWithBak(item.destPath, content, binary);
        if (item.destExists) {
          counts.updated++;
          console.log(`  ✅ Updated:  ${item.relPath}`);
        } else {
          counts.created++;
          console.log(`  ➕ Created:  ${item.relPath}`);
        }
      } else {
        writeFileSync(item.destPath, content, binary ? undefined : 'utf8');
        counts.created++;
        console.log(`  ➕ Created:  ${item.relPath}`);
      }

    } else if (item.strategy === 'append-dedup') {
      // append-dedup: merge TSV rows by URL (column 0)
      const newTsvPath = item.destPath;
      const oldContent = readFileSync(item.srcPath, 'utf8');
      const oldLines = oldContent.split('\n').filter(l => l.trim());

      if (oldLines.length === 0) {
        console.log(`  ⏭  Skipped:  ${item.relPath} (source is empty)`);
        continue;
      }

      // Header validation
      if (existsSync(newTsvPath)) {
        const newContent = readFileSync(newTsvPath, 'utf8');
        const newLines = newContent.split('\n').filter(l => l.trim());
        const oldCols = oldLines[0].split('\t').length;
        const newCols = newLines[0]?.split('\t').length ?? 0;

        if (newCols > 0 && oldCols !== newCols) {
          console.log(`  ⚠️  Skipped:  ${item.relPath} — header mismatch (old: ${oldCols} cols, new: ${newCols} cols). Copy manually.`);
          continue;
        }

        // Build set of existing URLs (normalized)
        const existingUrls = new Set(
          newLines.slice(1).map(row => normalizeUrl(row.split('\t')[0] || ''))
        );

        // Append new-to-us rows from old file (skip header)
        const rowsToAdd = oldLines.slice(1).filter(row => {
          const url = normalizeUrl(row.split('\t')[0] || '');
          return url && !existingUrls.has(url);
        });

        if (rowsToAdd.length === 0) {
          console.log(`  ⏭  Skipped:  ${item.relPath} (all ${oldLines.length - 1} entries already present)`);
          continue;
        }

        writeWithBak(newTsvPath, newContent.trimEnd() + '\n' + rowsToAdd.join('\n') + '\n');
        counts.merged++;
        console.log(`  🔀 Merged:   ${item.relPath} (+${rowsToAdd.length} entries, ${oldLines.length - 1 - rowsToAdd.length} duplicates skipped)`);
      } else {
        // No existing TSV — just copy
        writeFileSync(newTsvPath, oldContent, 'utf8');
        counts.created++;
        console.log(`  ➕ Created:  ${item.relPath}`);
      }
    }

  } catch (e) {
    failures.push({ file: item.relPath, error: e.message });
    console.log(`  ❌ FAILED:   ${item.relPath} — ${e.message}`);
  }
}

// ── Schema Migration ───────────────────────────────────────────────────────────
// Inject top-level keys present in template but absent in ported profile.yml.
// Uses textual injection (not js-yaml.dump) to preserve comments.
// Scans upward from each key line to include preceding # comment blocks.
//
// TODO: This handles top-level block additions only. If profile.yml gains
// nested keys within an existing block (e.g., candidate.social.bluesky),
// a manual edit will be needed. Add to next schema migration doc if this occurs.

const profilePlanItem = plan.find(p => p.schemaMigrate && !p.notFound);
if (profilePlanItem && profileTemplate && !failures.find(f => f.file === profilePlanItem.relPath)) {
  try {
    const portedContent = readFileSync(profileDestPath, 'utf8');
    const templateKeys = Object.keys(yaml.load(profileTemplate) || {});
    const portedKeys = new Set(Object.keys(yaml.load(portedContent) || {}));

    const missingKeys = templateKeys.filter(k => !portedKeys.has(k));

    if (missingKeys.length > 0) {
      const templateLines = profileTemplate.split('\n');
      let injected = '';

      for (const key of missingKeys) {
        // Find the line index of "key:"
        const keyLineIdx = templateLines.findIndex(l => l.match(new RegExp(`^${key}:`)));
        if (keyLineIdx === -1) continue;

        // Scan upward for preceding # comment lines
        let startIdx = keyLineIdx;
        for (let i = keyLineIdx - 1; i >= 0; i--) {
          const line = templateLines[i].trim();
          if (line.startsWith('#') || line === '') {
            startIdx = i;
          } else {
            break;
          }
        }

        // Scan downward for the section (until next top-level key or EOF)
        let endIdx = templateLines.length;
        for (let i = keyLineIdx + 1; i < templateLines.length; i++) {
          if (templateLines[i].match(/^[a-z]/)) { endIdx = i; break; }
        }

        const section = templateLines.slice(startIdx, endIdx).join('\n');
        injected += '\n' + section;

        const injectedLines = section.split('\n').map(l => '  ' + l).join('\n');
        console.log(`\n  ⚠️  Injected missing section into profile.yml:`);
        console.log(`  ───`);
        console.log(injectedLines);
        console.log(`  ───`);
        console.log(`  Please verify config/profile.yml is still valid YAML.`);
      }

      if (injected) {
        const header = '\n# ── Added by port (new in this version) ──────────────────────────────────────';
        writeFileSync(profileDestPath, portedContent.trimEnd() + '\n' + header + injected + '\n', 'utf8');
      }
    }
  } catch (e) {
    console.log(`  ⚠️  Schema migration failed: ${e.message}`);
  }
}

// ── Summary ────────────────────────────────────────────────────────────────────

const totalDone = counts.created + counts.updated + counts.merged;
const hasFailures = failures.length > 0;
const header = hasFailures ? '── Port Summary (with errors) ' : '── Port Summary ';
console.log(`\n${header}${'─'.repeat(58 - header.length)}`);
console.log(`Source: ${source}\n`);
console.log(`  Files ported:      ${totalDone}`);
console.log(`    Created:          ${counts.created}  (copy-missing / new)`);
console.log(`    Updated:          ${counts.updated}  (overwrite + .bak)`);
console.log(`    Merged:           ${counts.merged}  (append-dedup)`);
if (schemaMigrations) console.log(`  Schema migrations: ${schemaMigrations}  (profile.yml)`);
console.log(`  Failures:          ${failures.length}`);

if (failures.length > 0) {
  for (const f of failures) {
    console.log(`    ❌ ${f.file} — ${f.error}`);
  }
  console.log('\n  Try closing OneDrive/file sync apps, then re-run the port.');
}

// _profile.md migration reminder
if (plan.find(p => p.relPath === 'modes/_profile.md' && !p.notFound)) {
  console.log('\n  ℹ️  modes/_profile.md ported — check for any new sections added in this version.');
}

// Open key files
console.log();
const keyFiles = ['config/profile.yml', 'cv.md'];
for (const f of keyFiles) {
  const abs = join(projectRoot, f).replace(/\\/g, '/');
  console.log(`  📂 Open: file:///${abs}`);
  console.log(`     Path: ${f}`);
}

console.log(`
  💡 Next: lock in your ported data with:
     git add . && git commit -m "Port profile from old instance"
`);

process.exit(hasFailures ? 1 : 0);

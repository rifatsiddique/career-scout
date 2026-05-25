#!/usr/bin/env node
/**
 * merge-tracker.mjs — merge batch worker results into applications.md + pipeline.md
 *
 * Usage:
 *   node scripts/merge-tracker.mjs [--dry-run] [--results-dir PATH]
 *
 * Reads every data/batch/results/*.json (skips data/batch/results/processed/).
 * For each completed result:
 *   - Upserts a row in data/applications.md (match by company+role; update if present, append if new)
 *   - Idempotently moves the matching URL in data/pipeline.md Pending → Evaluated
 * Writes .bak of both files before modifying.
 * Archives processed results to data/batch/results/processed/.
 *
 * Exit codes:
 *   0  success (with or without changes)
 *   1  error (bad args, unreadable files, write failure)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const resultsDirArg = args.find(a => a.startsWith('--results-dir='))?.split('=')[1];
const RESULTS_DIR = resolve(projectRoot, resultsDirArg ?? 'data/batch/results');
const PROCESSED_DIR = join(RESULTS_DIR, 'processed');
const APPLICATIONS_PATH = join(projectRoot, 'data', 'applications.md');
const PIPELINE_PATH = join(projectRoot, 'data', 'pipeline.md');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFile(p) {
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}

function writeWithBak(p, content) {
  if (DRY_RUN) return;
  if (existsSync(p)) writeFileSync(p + '.bak', readFileSync(p));
  writeFileSync(p, content, 'utf8');
}

function slugKey(company, role) {
  return `${(company || '').toLowerCase().trim()}|${(role || '').toLowerCase().trim()}`;
}

// ─── Load results ─────────────────────────────────────────────────────────────

if (!existsSync(RESULTS_DIR)) {
  console.log('No results directory found — nothing to merge.');
  process.exit(0);
}

const resultFiles = readdirSync(RESULTS_DIR)
  .filter(f => f.endsWith('.json') && !f.startsWith('.'));

if (resultFiles.length === 0) {
  console.log('No result files found — nothing to merge.');
  process.exit(0);
}

const results = [];
for (const file of resultFiles) {
  const filePath = join(RESULTS_DIR, file);
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.warn(`⚠️  Skipping ${file} — JSON parse error: ${e.message}`);
    continue;
  }
  if (data.status !== 'completed') {
    console.log(`⏭  Skipping ${file} — status: ${data.status}`);
    continue;
  }
  results.push({ file, filePath, data });
}

if (results.length === 0) {
  console.log('No completed results to merge.');
  process.exit(0);
}

console.log(`\nMerging ${results.length} completed result(s)...\n`);

// ─── Merge applications.md ────────────────────────────────────────────────────

const appsRaw = readFile(APPLICATIONS_PATH) ?? '# Applications\n\n| # | Date | Company | Role | Score | Fit | Status | Report | PDF | Notes |\n|---|------|---------|------|-------|-----|--------|--------|-----|-------|\n';

// Split into header lines + data rows
const appsLines = appsRaw.split('\n');
const headerEnd = appsLines.findIndex(l => l.startsWith('|---|'));
const headerLines = appsLines.slice(0, headerEnd + 1);
const dataLines = appsLines.slice(headerEnd + 1).filter(l => l.trim().startsWith('|'));

// Parse existing rows into a map keyed by company|role
const rowMap = new Map(); // key → { idx, cells }
for (let i = 0; i < dataLines.length; i++) {
  const cells = dataLines[i].split('|').map(c => c.trim()).filter((_, j) => j > 0 && j < 11);
  // cells: [#, Date, Company, Role, Score, Fit, Status, Report, PDF, Notes]
  if (cells.length < 4) continue;
  const key = slugKey(cells[2], cells[3]);
  rowMap.set(key, { idx: i, cells });
}

function buildRow(num, d) {
  const score = d.score != null ? `${d.score}/100 (${d.display}/5)` : '';
  const report = d.report ? `[${d.report_num}](${d.report})` : '';
  const pdf = d.pdf_ok ? '✅' : (d.pdf ? '⬜' : '');
  const notes = d.notes ?? '';
  return `| ${num} | ${d.date} | ${d.company} | ${d.role} | ${score} | ${d.fit} | ${d.status_label} | ${report} | ${pdf} | ${notes} |`;
}

let appsChanged = false;
for (const { data: d } of results) {
  const key = slugKey(d.company, d.role);
  if (rowMap.has(key)) {
    // Update existing row — preserve row number
    const existing = rowMap.get(key);
    const num = existing.cells[0];
    dataLines[existing.idx] = buildRow(num, d);
    console.log(`  ✏️  Updated: ${d.company} — ${d.role}`);
  } else {
    // Append new row — tentative number (renumbered below)
    dataLines.push(buildRow('__NEW__', d));
    rowMap.set(key, { idx: dataLines.length - 1, cells: [] });
    console.log(`  ➕  Added:   ${d.company} — ${d.role}`);
  }
  appsChanged = true;
}

// Renumber # column sequentially
const finalRows = dataLines.map((line, i) =>
  line.replace(/^\|\s*(?:\d+|__NEW__)\s*\|/, `| ${i + 1} |`)
);

const newAppsContent = [...headerLines, ...finalRows, ''].join('\n');

if (appsChanged) {
  writeWithBak(APPLICATIONS_PATH, newAppsContent);
  const label = DRY_RUN ? '(dry-run) would update' : 'Updated';
  console.log(`\n${label} applications.md`);
  if (!DRY_RUN) console.log(`📂 Open: file:///${APPLICATIONS_PATH.replace(/\\/g, '/')}`);
}

// ─── Merge pipeline.md ────────────────────────────────────────────────────────

const pipelineRaw = readFile(PIPELINE_PATH);
if (!pipelineRaw) {
  console.warn('⚠️  pipeline.md not found — skipping pipeline move.');
} else {
  let pipelineContent = pipelineRaw;
  let pipelineChanged = false;

  // Parse Evaluated section to build a set of already-evaluated URLs (idempotency)
  const evalMatch = pipelineContent.match(/## Evaluated[\s\S]*/);
  const evalSection = evalMatch ? evalMatch[0] : '';
  const evaluatedUrls = new Set(
    [...evalSection.matchAll(/\|\s*(https?:\/\/\S+?)\s*\|/g)].map(m => m[1].trim())
  );

  // Parse Pending section rows
  const pendingMatch = pipelineContent.match(/(## Pending[\s\S]*?)(?=\n## |$)/);
  const pendingSection = pendingMatch ? pendingMatch[1] : '';

  for (const { data: d } of results) {
    const url = d.url;
    if (!url) continue;

    // Idempotency: already in Evaluated → no-op
    if (evaluatedUrls.has(url)) {
      console.log(`  ⏭  Already evaluated in pipeline: ${url}`);
      continue;
    }

    // Find the row in Pending
    const pendingRowRegex = new RegExp(
      `\\|\\s*${escapeRegex(url)}\\s*\\|[^\\n]*\\n?`
    );
    const pendingRowMatch = pipelineContent.match(pendingRowRegex);
    if (!pendingRowMatch) {
      console.log(`  ℹ️  URL not in Pending (may have been manual): ${url}`);
      continue;
    }

    // Build the Evaluated row
    const score = d.score != null ? `${d.score}/100 (${d.display}/5)` : '';
    const report = d.report ? `[${d.report_num}](${d.report})` : '';
    const pdf = d.pdf_ok ? '✅' : (d.pdf ? '⬜' : '');
    const evalRowNum = evaluatedUrls.size + 1;
    const evalRow = `| ${evalRowNum} | ${url} | ${d.company} | ${d.role} | ${score} | ${d.fit} | ${d.status_label} | ${report} | ${pdf} | ${d.notes ?? ''} |\n`;

    // Remove from Pending
    pipelineContent = pipelineContent.replace(pendingRowRegex, '');

    // Append to Evaluated (before any trailing blank lines after the Evaluated header/separator)
    pipelineContent = pipelineContent.replace(
      /(## Evaluated[\s\S]*?\|[-|: ]+\|\n?)([\s\S]*?)(\n## |\s*$)/,
      (match, header, rows, tail) => `${header}${rows}${evalRow}${tail}`
    );

    evaluatedUrls.add(url);
    pipelineChanged = true;
    console.log(`  🔀  Moved to Evaluated: ${d.company} — ${d.role}`);
  }

  if (pipelineChanged) {
    writeWithBak(PIPELINE_PATH, pipelineContent);
    const label = DRY_RUN ? '(dry-run) would update' : 'Updated';
    console.log(`\n${label} pipeline.md`);
    if (!DRY_RUN) console.log(`📂 Open: file:///${PIPELINE_PATH.replace(/\\/g, '/')}`);
  }
}

// ─── Archive processed results ────────────────────────────────────────────────

if (!DRY_RUN) {
  mkdirSync(PROCESSED_DIR, { recursive: true });
  for (const { file, filePath } of results) {
    const dest = join(PROCESSED_DIR, file);
    renameSync(filePath, dest);
  }
  console.log(`\n📦 Archived ${results.length} result file(s) to data/batch/results/processed/`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n✅ Merge complete — ${results.length} job(s) processed.`);
if (DRY_RUN) console.log('   (dry-run: no files were written)');

// ─── Util ─────────────────────────────────────────────────────────────────────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

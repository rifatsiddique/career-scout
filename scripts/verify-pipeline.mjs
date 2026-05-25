#!/usr/bin/env node
/**
 * verify-pipeline.mjs — integrity checker for pipeline.md + applications.md
 *
 * Usage:
 *   node scripts/verify-pipeline.mjs [--strict] [--pipeline PATH] [--applications PATH]
 *
 * Checks:
 *   [error] Duplicate # in applications.md
 *   [error] Report link points to non-existent reports/ file
 *   [error] Score not well-formed
 *   [error] Fit category not in the known set
 *   [error] Same URL in both pipeline Pending and Evaluated
 *   [warn]  Status not canonical
 *   [warn]  PDF=✅ row with no matching output/ file
 *
 * Exit codes:
 *   0  clean (errors=0; warns may be present unless --strict)
 *   1  one or more errors (or warns under --strict)
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const STRICT = args.includes('--strict');
const pipelineArg = args.find(a => a.startsWith('--pipeline='))?.split('=')[1];
const appsArg = args.find(a => a.startsWith('--applications='))?.split('=')[1];

const PIPELINE_PATH = resolve(projectRoot, pipelineArg ?? 'data/pipeline.md');
const APPLICATIONS_PATH = resolve(projectRoot, appsArg ?? 'data/applications.md');

// ─── Known valid values ───────────────────────────────────────────────────────

const KNOWN_FIT = new Set([
  'PERFECT_MATCH', 'GOOD_FIT', 'PARTIAL_MATCH', 'HARD_MISMATCH', 'POOR_FIT',
  'TOO_JUNIOR', 'OVERQUALIFIED',
]);

const CANONICAL_STATUSES = new Set([
  'Evaluated', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Withdrawn',
  'On Hold', 'Archived',
]);

// Score formats: "84/100 (4.2/5)" or "84/100 → 4.2/5"
const SCORE_RE = /^\d{1,3}\/100\s*(?:\([\d.]+\/5\)|→\s*[\d.]+\/5)$/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

let errors = 0;
let warns = 0;

function err(msg) {
  console.log(`  ❌ [error] ${msg}`);
  errors++;
}

function warn(msg) {
  console.log(`  ⚠️  [warn]  ${msg}`);
  warns++;
}

function readFile(p) {
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}

/**
 * Parse Markdown table rows from a section string.
 * Returns only rows that appear AFTER the separator line (|---|---| etc.),
 * so header rows are never included.
 */
function parseTableRows(section) {
  const lines = section.split('\n').filter(l => l.trim().startsWith('|'));
  let pastSeparator = false;
  const rows = [];
  for (const l of lines) {
    const raw = l.split('|');
    // Trim leading/trailing empty strings from the outer pipes
    const cells = raw.slice(1, raw.at(-1).trim() === '' ? -1 : undefined).map(c => c.trim());
    if (cells.length === 0) continue;
    // Separator row: every cell is only dashes/colons/spaces
    if (cells.every(c => /^[-: ]*$/.test(c))) {
      pastSeparator = true;
      continue;
    }
    if (pastSeparator) rows.push(cells);
  }
  return rows;
}

// ─── Load files ───────────────────────────────────────────────────────────────

console.log('verify-pipeline — integrity check\n');

const pipelineRaw = readFile(PIPELINE_PATH);
const appsRaw = readFile(APPLICATIONS_PATH);

if (!pipelineRaw) console.log(`ℹ️  pipeline.md not found — skipping pipeline checks.`);
if (!appsRaw) console.log(`ℹ️  applications.md not found — skipping applications checks.`);

// ─── applications.md checks ───────────────────────────────────────────────────

if (appsRaw) {
  console.log('── applications.md ──');
  const appsRows = parseTableRows(appsRaw);

  const seenNums = new Map();

  for (const cells of appsRows) {
    // cols: [#, Date, Company, Role, Score, Fit, Status, Report, PDF, Notes]
    const [num, , company, role, score, fit, status, report, pdf] = cells;
    const label = `row #${num} (${company ?? '?'} — ${role ?? '?'})`;

    // Check 1: duplicate #
    if (num) {
      if (seenNums.has(num)) {
        err(`Duplicate # ${num} in applications.md`);
      } else {
        seenNums.set(num, true);
      }
    }

    // Check 3: malformed score
    if (score && !SCORE_RE.test(score)) {
      err(`Malformed score "${score}" in ${label}`);
    }

    // Check 4: unknown fit category
    if (fit && !KNOWN_FIT.has(fit)) {
      err(`Unknown fit category "${fit}" in ${label}`);
    }

    // Check 2: dead report link
    if (report) {
      const linkMatch = report.match(/\[.*?\]\((.+?)\)/);
      const reportPath = linkMatch ? linkMatch[1] : report;
      if (reportPath && !existsSync(resolve(projectRoot, reportPath))) {
        err(`Dead report link "${reportPath}" in ${label}`);
      }
    }

    // Check 6 (warn): non-canonical status
    if (status && !CANONICAL_STATUSES.has(status)) {
      warn(`Non-canonical status "${status}" in ${label}`);
    }

    // Check 7 (warn): PDF=✅ but no matching output/ file
    if (pdf === '✅') {
      const slug = (company ?? '').toLowerCase().replace(/\s+/g, '-');
      const outputDir = join(projectRoot, 'output');
      if (existsSync(outputDir)) {
        const files = readdirSync(outputDir);
        const hasPdf = files.some(f => f.includes(slug) && f.endsWith('.pdf'));
        if (!hasPdf) {
          warn(`PDF=✅ but no output/*.pdf matching slug "${slug}" for ${label}`);
        }
      }
    }
  }

  if (appsRows.length === 0) {
    console.log('  ✅ Empty — no rows to check');
  } else if (errors === 0 && warns === 0) {
    console.log('  ✅ Clean');
  }
}

// ─── pipeline.md checks ───────────────────────────────────────────────────────

if (pipelineRaw) {
  const errsBefore = errors;
  const warnsBefore = warns;
  console.log('\n── pipeline.md ──');

  const pendingMatch = pipelineRaw.match(/## Pending([\s\S]*?)(?=\n## |$)/);
  const evalMatch = pipelineRaw.match(/## Evaluated([\s\S]*?)(?=\n## |$)/);

  const pendingRows = pendingMatch ? parseTableRows(pendingMatch[1]) : [];
  const evalRows = evalMatch ? parseTableRows(evalMatch[1]) : [];

  // Pending cols: [URL, Company, Role, Source, Found, Notes]
  const pendingUrls = new Set(pendingRows.map(r => r[0]).filter(Boolean));
  // Evaluated cols: [#, URL, Company, Role, Score, Fit, Status, Report, PDF, Notes]
  const evalUrls = new Set(evalRows.map(r => r[1]).filter(Boolean));

  // Check 5: URL in both sections
  for (const url of pendingUrls) {
    if (evalUrls.has(url)) {
      err(`URL in both Pending and Evaluated: ${url}`);
    }
  }

  // Evaluated row field checks
  for (const cells of evalRows) {
    const [num, , company, role, score, fit, status] = cells;
    const label = `eval row #${num} (${company ?? '?'} — ${role ?? '?'})`;

    if (score && !SCORE_RE.test(score)) {
      err(`Malformed score "${score}" in ${label}`);
    }
    if (fit && !KNOWN_FIT.has(fit)) {
      err(`Unknown fit category "${fit}" in ${label}`);
    }
    if (status && !CANONICAL_STATUSES.has(status)) {
      warn(`Non-canonical status "${status}" in ${label}`);
    }
  }

  if (pendingRows.length === 0 && evalRows.length === 0) {
    console.log('  ✅ Empty — no rows to check');
  } else if (errors === errsBefore && warns === warnsBefore) {
    console.log('  ✅ Clean');
  }
}

// ─── Result ───────────────────────────────────────────────────────────────────

console.log(`\n── Summary ──`);
console.log(`  Errors: ${errors}   Warnings: ${warns}`);

if (errors > 0) {
  console.log('\n❌ Integrity check failed.');
  process.exit(1);
} else if (STRICT && warns > 0) {
  console.log('\n❌ Integrity check failed (--strict: warnings treated as errors).');
  process.exit(1);
} else if (warns > 0) {
  console.log('\n⚠️  Integrity check passed with warnings.');
} else {
  console.log('\n✅ Integrity check passed.');
}

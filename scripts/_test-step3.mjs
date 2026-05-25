#!/usr/bin/env node
// Step 3 unit tests: merge-tracker.mjs + verify-pipeline.mjs
// Run: node scripts/_test-step3.mjs
// Cleans up after itself.

import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TMP = join(ROOT, 'data', 'batch', '_test_tmp');

let passed = 0;
let failed = 0;

function assert(label, cond) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else       { console.log(`  ❌ FAIL: ${label}`); failed++; }
}

function run(script, extraArgs = '') {
  try {
    const out = execSync(`node "${join(ROOT, 'scripts', script)}" ${extraArgs}`, { encoding: 'utf8' });
    return { out, code: 0 };
  } catch (e) {
    return { out: (e.stdout ?? '') + (e.stderr ?? ''), code: e.status ?? 1 };
  }
}

function setup() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(join(TMP, 'results', 'processed'), { recursive: true });
}

function writeResult(id, obj) {
  writeFileSync(join(TMP, 'results', `${id}.json`), JSON.stringify(obj));
}

function writeApps(content) { writeFileSync(join(ROOT, 'data', 'applications.md'), content); }
function writePipe(content) { writeFileSync(join(ROOT, 'data', 'pipeline.md'), content); }
function readApps() { return readFileSync(join(ROOT, 'data', 'applications.md'), 'utf8'); }
function readPipe() { return readFileSync(join(ROOT, 'data', 'pipeline.md'), 'utf8'); }

const APPS_HEADER = '# Applications\n\n| # | Date | Company | Role | Score | Fit | Status | Report | PDF | Notes |\n|---|------|---------|------|-------|-----|--------|--------|-----|-------|\n';
const PIPE_BASE = '# Pipeline\n\n## Pending\n\n| URL | Company | Role | Source | Found | Notes |\n|-----|---------|------|--------|-------|-------|\n| https://acme.com/jobs/1 | Acme | Senior AI Eng | manual | 2026-05-25 | |\n\n## Evaluated\n\n| # | URL | Company | Role | Score | Fit | Status | Report | PDF | Notes |\n|---|-----|---------|------|-------|-----|--------|--------|-----|-------|\n';

const COMPLETED_RESULT = {
  status: 'completed', id: '1', report_num: '001', date: '2026-05-25',
  company: 'Acme', role: 'Senior AI Eng', score: 84, display: '4.2',
  fit: 'GOOD_FIT', legitimacy: 'High Confidence', status_label: 'Evaluated',
  pdf: 'output/cv-doe-acme-2026-05-25.pdf', pdf_ok: true,
  report: 'reports/001-acme-2026-05-25.md',
  url: 'https://acme.com/jobs/1', notes: 'strong match', flags: 0, error: null,
};

// ── merge-tracker tests ───────────────────────────────────────────────────────
console.log('\n── merge-tracker.mjs ──');

// T-M1: completed result → row appended + pipeline row moved
setup();
writeApps(APPS_HEADER);
writePipe(PIPE_BASE);
writeResult('1', COMPLETED_RESULT);
{
  const r = run('merge-tracker.mjs', `--results-dir="${TMP}/results"`);
  const apps = readApps();
  const pipe = readPipe();
  assert('T-M1: row added to applications.md', apps.includes('Acme') && apps.includes('GOOD_FIT'));
  assert('T-M1: pipeline row moved to Evaluated', /## Evaluated[\s\S]*Acme/.test(pipe));
  const pendingSection = pipe.match(/## Pending([\s\S]*?)(?=\n## |$)/)?.[1] ?? '';
  assert('T-M1: URL removed from Pending', !pendingSection.includes('acme.com/jobs/1'));
  assert('T-M1: .bak file written', existsSync(join(ROOT, 'data', 'applications.md.bak')));
  assert('T-M1: result archived', !existsSync(join(TMP, 'results', '1.json')) && existsSync(join(TMP, 'results', 'processed', '1.json')));
}

// T-M2: failed result skipped
setup();
writeApps(APPS_HEADER);
writePipe(PIPE_BASE);
writeResult('2', { status: 'failed', id: '2', report_num: '002', company: 'Beta', role: 'PM', error: 'contact-audit-failed', score: null, pdf: null, pdf_ok: false, url: 'https://beta.com/jobs/2', notes: '', flags: 0, date: '2026-05-25', display: null, fit: null, legitimacy: null, status_label: null, report: null });
{
  const r = run('merge-tracker.mjs', `--results-dir="${TMP}/results"`);
  assert('T-M2: failed result not added to applications', !readApps().includes('Beta'));
}

// T-M3: duplicate company+role → update, not append
setup();
const appsWithRow = APPS_HEADER + '| 1 | 2026-05-20 | Acme | Senior AI Eng | 70/100 (3.5/5) | PARTIAL_MATCH | Evaluated | [001](reports/001-acme-old.md) | ⬜ | old |\n';
writeApps(appsWithRow);
writePipe(PIPE_BASE);
writeResult('1', COMPLETED_RESULT);
{
  const r = run('merge-tracker.mjs', `--results-dir="${TMP}/results"`);
  const apps = readApps();
  const dataRows = apps.split('\n').filter(l => l.startsWith('|') && !l.includes('---|') && !l.includes('| # |') && l.includes('Acme'));
  assert('T-M3: only one row for Acme (no duplicate)', dataRows.length === 1);
  assert('T-M3: row updated with new score', apps.includes('84/100'));
}

// T-M4: idempotency — URL already in Evaluated → no duplicate
setup();
const pipeWithEval = '# Pipeline\n\n## Pending\n\n| URL | Company | Role | Source | Found | Notes |\n|-----|---------|------|--------|-------|-------|\n\n## Evaluated\n\n| # | URL | Company | Role | Score | Fit | Status | Report | PDF | Notes |\n|---|-----|---------|------|-------|-----|--------|--------|-----|-------|\n| 1 | https://acme.com/jobs/1 | Acme | Senior AI Eng | 84/100 (4.2/5) | GOOD_FIT | Evaluated | | ✅ | |\n';
writePipe(pipeWithEval);
writeApps(APPS_HEADER);
writeResult('1', COMPLETED_RESULT);
{
  const r = run('merge-tracker.mjs', `--results-dir="${TMP}/results"`);
  const pipe = readPipe();
  const urlMatches = [...pipe.matchAll(/https:\/\/acme\.com\/jobs\/1/g)];
  assert('T-M4: URL appears only once (no duplicate)', urlMatches.length === 1);
}

// T-M5: empty results dir → clean no-op
setup();
writeApps(APPS_HEADER);
{
  const r = run('merge-tracker.mjs', `--results-dir="${TMP}/results"`);
  assert('T-M5: exit 0', r.code === 0);
  assert('T-M5: nothing-to-merge message', r.out.includes('No result files'));
}

// T-M6: re-running after archive → clean no-op (all already in processed/)
setup();
writeResult('1', COMPLETED_RESULT);
writeApps(APPS_HEADER);
writePipe(PIPE_BASE);
run('merge-tracker.mjs', `--results-dir="${TMP}/results"`); // first run
// results now in processed/
writeApps(APPS_HEADER); // reset for clean check
{
  const r = run('merge-tracker.mjs', `--results-dir="${TMP}/results"`);
  assert('T-M6: re-run after archive is clean no-op', r.out.includes('No result files'));
}

// ── verify-pipeline tests ─────────────────────────────────────────────────────
console.log('\n── verify-pipeline.mjs ──');

const PIPE_CLEAN = '# Pipeline\n\n## Pending\n\n| URL | Company | Role | Source | Found | Notes |\n|-----|---------|------|--------|-------|-------|\n\n## Evaluated\n\n| # | URL | Company | Role | Score | Fit | Status | Report | PDF | Notes |\n|---|-----|---------|------|-------|-----|--------|--------|-----|-------|\n';
writeApps(APPS_HEADER);
writePipe(PIPE_CLEAN);

// T-V1: clean → exit 0
{
  const r = run('verify-pipeline.mjs');
  assert('T-V1: clean files → exit 0', r.code === 0);
}

// T-V2: duplicate # → error
{
  writeApps(APPS_HEADER + '| 1 | 2026-05-25 | Acme | AI Eng | 84/100 (4.2/5) | GOOD_FIT | Evaluated | | | |\n| 1 | 2026-05-25 | Beta | PM | 80/100 (4.0/5) | GOOD_FIT | Evaluated | | | |\n');
  const r = run('verify-pipeline.mjs');
  assert('T-V2: duplicate # → error', r.code === 1 && r.out.includes('Duplicate #'));
  writeApps(APPS_HEADER);
}

// T-V3: dead report link → error
{
  writeApps(APPS_HEADER + '| 1 | 2026-05-25 | Acme | AI Eng | 84/100 (4.2/5) | GOOD_FIT | Evaluated | [001](reports/999-nonexistent.md) | | |\n');
  const r = run('verify-pipeline.mjs');
  assert('T-V3: dead report link → error', r.code === 1 && r.out.includes('Dead report link'));
  writeApps(APPS_HEADER);
}

// T-V4: malformed score → error
{
  writeApps(APPS_HEADER + '| 1 | 2026-05-25 | Acme | AI Eng | 84pts | GOOD_FIT | Evaluated | | | |\n');
  const r = run('verify-pipeline.mjs');
  assert('T-V4: malformed score → error', r.code === 1 && r.out.includes('Malformed score'));
  writeApps(APPS_HEADER);
}

// T-V5: unknown fit category → error
{
  writeApps(APPS_HEADER + '| 1 | 2026-05-25 | Acme | AI Eng | 84/100 (4.2/5) | GREAT_JOB | Evaluated | | | |\n');
  const r = run('verify-pipeline.mjs');
  assert('T-V5: unknown fit category → error', r.code === 1 && r.out.includes('Unknown fit category'));
  writeApps(APPS_HEADER);
}

// T-V6: URL in both Pending and Evaluated → error
{
  const dupPipe = '# Pipeline\n\n## Pending\n\n| URL | Company | Role | Source | Found | Notes |\n|-----|---------|------|--------|-------|-------|\n| https://acme.com/jobs/1 | Acme | AI Eng | manual | 2026-05-25 | |\n\n## Evaluated\n\n| # | URL | Company | Role | Score | Fit | Status | Report | PDF | Notes |\n|---|-----|---------|------|-------|-----|--------|--------|-----|-------|\n| 1 | https://acme.com/jobs/1 | Acme | AI Eng | 84/100 (4.2/5) | GOOD_FIT | Evaluated | | | |\n';
  writePipe(dupPipe);
  const r = run('verify-pipeline.mjs');
  assert('T-V6: URL in both sections → error', r.code === 1 && r.out.includes('both Pending and Evaluated'));
  writePipe(PIPE_CLEAN);
}

// T-V7: non-canonical status → warn (exit 0); exit 1 with --strict
{
  writeApps(APPS_HEADER + '| 1 | 2026-05-25 | Acme | AI Eng | 84/100 (4.2/5) | GOOD_FIT | InReview | | | |\n');
  const r1 = run('verify-pipeline.mjs');
  const r2 = run('verify-pipeline.mjs', '--strict');
  assert('T-V7: non-canonical status → warn only (exit 0)', r1.code === 0 && r1.out.includes('warn'));
  assert('T-V7: --strict promotes warn → error (exit 1)', r2.code === 1);
  writeApps(APPS_HEADER);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
rmSync(TMP, { recursive: true, force: true });
for (const f of readdirSync(join(ROOT, 'data'))) {
  if (f.endsWith('.bak')) unlinkSync(join(ROOT, 'data', f));
}

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);

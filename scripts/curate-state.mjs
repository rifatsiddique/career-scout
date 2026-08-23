#!/usr/bin/env node
/**
 * curate-state.mjs — mechanical invariants for the career-log curation flow.
 *
 * The model decides WHAT to write. This script guarantees HOW.
 * Same rationale as resolve-template.mjs / merge-tracker.mjs: state operations
 * expressed as prose instructions fail silently. These do not.
 *
 * Commands:
 *   read                          Print parsed state as JSON (watermarks, suppressed, declined)
 *   append <text> [--date YYYY-MM-DD]
 *                                 Append a dated entry to career-log.md. Prints the byte
 *                                 range written so `log --undo` is exact.
 *   undo-append                   Remove the last appended entry (uses .last-append.json)
 *   commit <file> --through <date>
 *                                 .bak -> write staged content -> advance that file's
 *                                 watermark, as one operation. Staged content on stdin.
 *   decline <file> --note <text>  Record a declined proposal. Watermark NOT advanced.
 *   suppress --note <text>        Record deleted content that must never be re-proposed.
 *   stale                         Exit 10 if career-log.md is newer than any curated file.
 *
 * Exit codes:
 *   0 ok · 1 usage · 2 malformed state file · 3 write failed (backup intact) · 10 stale
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOG = resolve(ROOT, 'career-log.md');
const STATE = resolve(ROOT, 'data/curate-state.md');
const LAST_APPEND = resolve(ROOT, 'data/.last-append.json');
const CURATED = ['cv.md', 'stories.md'];

const die = (code, msg) => { console.error(msg); process.exit(code); };

// ---------- state parsing ----------

function parseState() {
  if (!existsSync(STATE)) die(2, `Missing ${STATE}. Run setup or create it from the plan.`);
  const raw = readFileSync(STATE, 'utf8');
  const state = { watermarks: {}, suppressed: [], declined: [] };
  let section = null;

  for (const line of raw.split(/\r?\n/)) {
    const h = line.match(/^##\s+(\w+)/);
    if (h) { section = h[1].toLowerCase(); continue; }
    if (!line.startsWith('- ')) continue;
    const body = line.slice(2).trim();

    if (section === 'watermarks') {
      const m = body.match(/^(\S+?):\s*(?:proposed through\s*)?(.+)$/);
      if (!m) die(2, `Malformed watermark line: ${line}`);
      state.watermarks[m[1]] = m[2].trim();
    } else if (section === 'suppressed') {
      state.suppressed.push(body);
    } else if (section === 'declined') {
      state.declined.push(body);
    }
  }

  // A watermark must exist for every curated file that exists on disk.
  for (const f of CURATED) {
    if (existsSync(resolve(ROOT, f)) && !(f in state.watermarks)) {
      die(2, `${STATE} has no watermark for ${f}. Refusing to guess — add "- ${f}: never".`);
    }
  }
  return state;
}

function writeState(state) {
  const lines = [
    '# Curate State',
    '',
    '<!-- USER LAYER. Written by `curate` via scripts/curate-state.mjs.',
    '     Human-readable on purpose: edit or delete any line to change curate\'s',
    '     behavior. Deleting a Suppressed line lets that content be proposed again. -->',
    '',
    '## Watermarks',
    '<!-- How far each curated file has had entries proposed into it. Per-file, so',
    '     accepting one file and declining another in the same run works correctly. -->',
    ...CURATED.map(f => `- ${f}: ${state.watermarks[f] ?? 'never'}`),
    '',
    '## Suppressed',
    '<!-- Content you deleted from a curated file. Never proposed again.',
    '     Matched by topic in plain language. Delete a line to un-suppress. -->',
    ...state.suppressed.map(s => `- ${s}`),
    '',
    '## Declined',
    '<!-- Proposals you turned down. Not re-offered. -->',
    ...state.declined.map(s => `- ${s}`),
    '',
  ];
  atomicWrite(STATE, lines.join('\n'));
}

/** Backup then write. On any failure the .bak is left intact and we exit 3. */
function atomicWrite(path, content) {
  const bak = `${path}.bak`;
  try {
    if (existsSync(path)) copyFileSync(path, bak);
    writeFileSync(path, content, 'utf8');
  } catch (err) {
    die(3, `Write failed for ${path}: ${err.message}\nBackup (if any) intact at ${bak}`);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

// ---------- commands ----------

function cmdRead() {
  console.log(JSON.stringify(parseState(), null, 2));
}

function cmdAppend(args) {
  const text = args._[0];
  if (!text) die(1, 'usage: curate-state.mjs append "<text>" [--date YYYY-MM-DD]');
  const date = args.date ?? today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) die(1, `Bad --date: ${date}`);
  if (!existsSync(LOG)) die(2, `Missing ${LOG}`);

  const before = readFileSync(LOG, 'utf8');
  // Idempotence guard: identical entry under the same date is a no-op.
  const entry = `\n## ${date}\n${text.trim()}\n`;
  if (before.includes(`## ${date}\n${text.trim()}\n`)) {
    console.log(JSON.stringify({ appended: false, reason: 'identical entry already present', date }));
    return;
  }
  const start = Buffer.byteLength(before, 'utf8');
  atomicWrite(LOG, before + entry);
  writeFileSync(LAST_APPEND, JSON.stringify({ start, length: Buffer.byteLength(entry, 'utf8'), date }), 'utf8');
  console.log(JSON.stringify({ appended: true, date, start, length: Buffer.byteLength(entry, 'utf8') }));
}

function cmdUndoAppend() {
  if (!existsSync(LAST_APPEND)) die(1, 'Nothing to undo — no recorded append.');
  const { start, length } = JSON.parse(readFileSync(LAST_APPEND, 'utf8'));
  const buf = readFileSync(LOG);
  if (start + length !== buf.length) {
    die(1, 'career-log.md changed since that append — refusing to undo by byte range. Remove the entry by hand.');
  }
  atomicWrite(LOG, buf.subarray(0, start).toString('utf8'));
  unlinkSync(LAST_APPEND);
  console.log(JSON.stringify({ undone: true }));
}

function cmdCommit(args) {
  const file = args._[0];
  if (!CURATED.includes(file)) die(1, `usage: commit <${CURATED.join('|')}> --through YYYY-MM-DD  (content on stdin)`);
  if (!args.through) die(1, 'commit requires --through YYYY-MM-DD');
  const content = readFileSync(0, 'utf8');
  if (!content.trim()) die(1, 'Refusing to write empty content.');

  const state = parseState();
  const target = resolve(ROOT, file);
  atomicWrite(target, content);
  state.watermarks[file] = args.through;   // advance ONLY after the write succeeded
  writeState(state);
  console.log(JSON.stringify({ committed: file, backup: `${file}.bak`, watermark: args.through }));
}

function cmdDecline(args) {
  const file = args._[0];
  if (!CURATED.includes(file) || !args.note) die(1, 'usage: decline <file> --note "<what was declined>"');
  const state = parseState();
  state.declined.push(`${file}: ${args.note} (declined ${today()})`);
  writeState(state);   // watermark deliberately NOT advanced
  console.log(JSON.stringify({ declined: file, watermarkUnchanged: state.watermarks[file] }));
}

function cmdSuppress(args) {
  if (!args.note) die(1, 'usage: suppress --note "<topic that must not come back>"');
  const state = parseState();
  state.suppressed.push(`${args.note} (suppressed ${today()})`);
  writeState(state);
  console.log(JSON.stringify({ suppressed: args.note }));
}

function cmdStale() {
  if (!existsSync(LOG)) die(2, `Missing ${LOG}`);
  const logM = statSync(LOG).mtimeMs;
  const stale = CURATED.filter(f => {
    const p = resolve(ROOT, f);
    return existsSync(p) && statSync(p).mtimeMs < logM;
  });
  console.log(JSON.stringify({ stale }));
  if (stale.length) process.exit(10);
}

// ---------- arg parsing ----------

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[++i];
    else out._.push(argv[i]);
  }
  return out;
}

const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

switch (cmd) {
  case 'read':         cmdRead(); break;
  case 'append':       cmdAppend(args); break;
  case 'undo-append':  cmdUndoAppend(); break;
  case 'commit':       cmdCommit(args); break;
  case 'decline':      cmdDecline(args); break;
  case 'suppress':     cmdSuppress(args); break;
  case 'stale':        cmdStale(); break;
  default:
    die(1, 'Commands: read | append | undo-append | commit | decline | suppress | stale');
}

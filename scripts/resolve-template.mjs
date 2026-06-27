#!/usr/bin/env node
/**
 * resolve-template.mjs — resolve {{#if}} conditionals in a filled CV draft, in place.
 *
 * Run right after the drafter writes output/draft-{slug}.html so the draft the user
 * reviews/edits is clean (no {{#if}} fences, no empty optional sections). generate-pdf.mjs
 * runs the same resolution again as an unbypassable backstop (idempotent — safe).
 *
 * Usage:
 *   node scripts/resolve-template.mjs <draft.html>
 *
 * Exit codes:
 *   0  resolved cleanly, no residual template tokens
 *   1  script error (bad args, file not found)
 *   3  residual {{...}} tokens remain after resolution (unfilled required placeholder
 *      and/or stray/malformed control tag) — surfaced, NOT auto-removed
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { resolveConditionals, findLeaks } from './lib/cv-template.mjs';

const arg = process.argv[2];
if (!arg) { console.error('Usage: node scripts/resolve-template.mjs <draft.html>'); process.exit(1); }
const path = resolve(arg);
if (!existsSync(path)) { console.error(`File not found: ${path}`); process.exit(1); }

const { html, removed, kept } = resolveConditionals(readFileSync(path, 'utf8'));
writeFileSync(path, html, 'utf8');

console.log(`Resolved conditionals in ${path}`);
console.log(`  kept    (${kept.length}): ${kept.join(', ') || '—'}`);
console.log(`  removed (${removed.length}): ${removed.join(', ') || '—'}`);

const leaks = findLeaks(html);
if (leaks.tokens.length > 0) {
  console.error('\n❌ Residual template tokens after resolution:');
  leaks.tokens.forEach((t, i) => console.error(`  line ${leaks.lines[i]}: ${t}`));
  if (leaks.hasMalformedControl) {
    console.error('\n⚠️  A stray {{#if}}/{{/if}} suggests a missing closing tag or an ' +
      'unsupported nested conditional. Fix the template/draft markup.');
  }
  process.exit(3);
}
console.log('✅ No residual tokens.');
process.exit(0);

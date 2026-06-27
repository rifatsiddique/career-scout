#!/usr/bin/env node
/**
 * audit-contact.mjs — verify contact fields in generated CV HTML against profile.yml
 *
 * Thin CLI wrapper around lib/contact-audit.mjs (the same logic generate-pdf.mjs
 * runs unconditionally at render time). This pre-step gives early, friendly
 * feedback; the renderer is the actual gate.
 *
 * Usage:
 *   node scripts/audit-contact.mjs <filled-cv.html> <profile.yml>
 *
 * Exit codes:
 *   0  all contact fields valid (populated from profile.yml or intentionally absent)
 *   1  script error (bad args, file not found)
 *   2  contact fabrication or leaked placeholder detected — STOP before PDF generation
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  parseProfile, extractContactFromHtml, auditContact, CONTACT_FIELDS,
} from './lib/contact-audit.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/audit-contact.mjs <cv.html> <profile.yml>');
    process.exit(1);
  }
  return { htmlPath: resolve(args[0]), profilePath: resolve(args[1]) };
}

function main() {
  const { htmlPath, profilePath } = parseArgs();
  if (!existsSync(htmlPath)) { console.error(`HTML file not found: ${htmlPath}`); process.exit(1); }
  if (!existsSync(profilePath)) { console.error(`Profile not found: ${profilePath}`); process.exit(1); }

  const html = readFileSync(htmlPath, 'utf8');
  const profileFields = parseProfile(profilePath);
  const htmlContactValues = extractContactFromHtml(html);
  const { failures, omissions } = auditContact(htmlContactValues, profileFields);

  console.log('\n📋 Contact Info Audit\n');
  for (const [key, label] of CONTACT_FIELDS) {
    if (profileFields[key]) console.log(`  ✅ ${label}: ${profileFields[key]}`);
    else console.log(`  ⚠️  ${label}: not set in profile.yml — will be omitted from CV`);
  }

  if (failures.length > 0) {
    console.log('\n❌ CONTACT AUDIT FAILED — do not generate PDF\n');
    for (const f of failures) {
      console.log(`  ❌ "${f.value}"`);
      console.log(`     Reason: ${f.reason}`);
    }
    console.log('\nFix: update config/profile.yml with the correct values and regenerate.');
    process.exit(2);
  }

  if (omissions.length > 0) {
    console.log('\n⚠️  Populated in profile.yml but NOT shown in the CV (verify this is intentional):');
    for (const o of omissions) console.log(`  ⚠️  ${o.field}: "${o.value}"`);
  }

  console.log('\n✅ Contact audit passed — all rendered fields traceable to profile.yml\n');
  process.exit(0);
}

main();

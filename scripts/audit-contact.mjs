#!/usr/bin/env node
/**
 * audit-contact.mjs — verify contact fields in generated CV HTML against profile.yml
 *
 * Usage:
 *   node scripts/audit-contact.mjs <filled-cv.html> <profile.yml>
 *
 * Exit codes:
 *   0  all contact fields are valid (populated from profile.yml or intentionally absent)
 *   1  script error (bad args, file not found)
 *   2  contact fabrication or leaked placeholder detected — STOP before PDF generation
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Known-bad placeholder values that should never appear in a generated CV
const PLACEHOLDER_VALUES = new Set([
  '+1-555-0123', '+1 (555) 555-5555', '+1-555-555-5555',
  'your@email.com', 'name@example.com', 'you@example.com', 'user@domain.com',
  'linkedin.com/in/yourname', 'linkedin.com/in/username', 'linkedin.com/in/your-name',
  'github.com/username', 'github.com/yourname',
  'yourdomain.com', 'your-portfolio.com', 'example.com',
  'City, State', 'Your City', 'City, Country',
  'Your Name', 'Full Name', 'First Last',
  'TBD', 'N/A', 'TODO', 'PLACEHOLDER',
]);

function normalize(str) {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/audit-contact.mjs <cv.html> <profile.yml>');
    process.exit(1);
  }
  return { htmlPath: resolve(args[0]), profilePath: resolve(args[1]) };
}

function parseProfile(profilePath) {
  if (!existsSync(profilePath)) {
    console.error(`Profile not found: ${profilePath}`);
    process.exit(1);
  }

  const yaml = readFileSync(profilePath, 'utf8');

  // Simple YAML field extraction — reads candidate.* fields line by line
  // No full YAML parser needed; profile.yml structure is controlled
  const fields = {};
  const lines = yaml.split('\n');
  let inCandidate = false;
  for (const line of lines) {
    if (/^candidate:/.test(line)) { inCandidate = true; continue; }
    if (inCandidate && /^\S/.test(line)) { inCandidate = false; }
    if (!inCandidate) continue;

    const match = line.match(/^\s+(\w+):\s*"?([^"#\n]*)"?/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/["']/g, '');
      if (val && val.length > 0) fields[key] = val;
    }
  }
  return fields;
}

function extractContactFromHtml(html) {
  const found = [];
  // Match both <span class="contact-item"> and <a class="contact-item"> elements only.
  // Do NOT use a global href scan — that would pull in project links, DOIs, and other
  // body URLs that are not contact fields, causing false-positive fabrication alerts.
  const contactRe = /<(span|a)[^>]*class="[^"]*contact-item[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = contactRe.exec(html)) !== null) {
    const outerTag = m[0];

    // Extract visible text (strip inner tags)
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (text) found.push(text);

    // Extract href only from this specific contact-item element
    const hrefM = outerTag.match(/href="([^"]+)"/i);
    if (hrefM) {
      const url = hrefM[1];
      if (url.startsWith('mailto:')) {
        found.push(url.replace('mailto:', ''));
      } else if (!url.startsWith('#')) {
        found.push(url);
      }
    }
  }
  return found;
}

function audit(htmlContactValues, profileFields) {
  const failures = [];
  const warnings = [];

  // Build the set of values allowed in the CV (from profile.yml)
  const allowed = new Set(
    Object.values(profileFields).map(v => normalize(v))
  );

  for (const val of htmlContactValues) {
    const norm = normalize(val);
    if (!norm) continue;

    // Check known-bad placeholder values first
    if (PLACEHOLDER_VALUES.has(val) || PLACEHOLDER_VALUES.has(norm)) {
      failures.push({ value: val, reason: 'PLACEHOLDER LEAKED — template default was not replaced' });
      continue;
    }

    // Check if the value appears in profile.yml (normalized comparison)
    // Allow partial matches for display values (e.g. "linkedin.com/in/name" vs full URL)
    const matchFound = [...allowed].some(a =>
      a === norm ||
      a.includes(norm) ||
      norm.includes(a)
    );

    if (!matchFound && norm.length > 2) {
      // Only flag values that look like contact data, not generic words
      const looksLikeContact = /[@\./\+\d]/.test(norm) || norm.length > 8;
      if (looksLikeContact) {
        failures.push({ value: val, reason: 'FABRICATION — not found in profile.yml' });
      }
    }
  }

  return { failures, warnings };
}

function main() {
  const { htmlPath, profilePath } = parseArgs();

  if (!existsSync(htmlPath)) {
    console.error(`HTML file not found: ${htmlPath}`);
    process.exit(1);
  }

  const html = readFileSync(htmlPath, 'utf8');
  const profileFields = parseProfile(profilePath);
  const htmlContactValues = extractContactFromHtml(html);

  const { failures, warnings } = audit(htmlContactValues, profileFields);

  // Print contact summary
  console.log('\n📋 Contact Info Audit\n');

  const contactFieldMap = [
    ['full_name', 'Name'],
    ['email', 'Email'],
    ['phone', 'Phone'],
    ['location', 'Location'],
    ['linkedin', 'LinkedIn'],
    ['portfolio_url', 'Portfolio'],
    ['github', 'GitHub'],
    ['work_authorization', 'Work Auth'],
  ];

  for (const [key, label] of contactFieldMap) {
    if (profileFields[key]) {
      console.log(`  ✅ ${label}: ${profileFields[key]}`);
    } else {
      console.log(`  ⚠️  ${label}: not set in profile.yml — will be omitted from CV`);
    }
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

  if (warnings.length > 0) {
    for (const w of warnings) {
      console.log(`  ⚠️  ${w}`);
    }
  }

  console.log('\n✅ Contact audit passed — all fields traceable to profile.yml\n');
  process.exit(0);
}

main();

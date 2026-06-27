/**
 * contact-audit.mjs — verify CV contact fields against config/profile.yml
 *
 * Shared by scripts/audit-contact.mjs (CLI pre-step) and scripts/generate-pdf.mjs
 * (unconditional render-time gate) so both enforce identical rules with no logic
 * fork. Detects three failure modes:
 *   1. leaked placeholder  — template default rendered literally
 *   2. fabrication         — a contact value not traceable to profile.yml
 *   3. omission            — a field populated in profile.yml absent from the CV
 *
 * (1) and (2) are hard failures; (3) is a warning (a user may legitimately omit
 * a field), promotable to a failure with the caller's own --strict-contact flag.
 */
import { readFileSync, existsSync } from 'fs';

// Known template-default values that must never appear in a generated CV.
export const PLACEHOLDER_VALUES = new Set([
  '+1-555-0123', '+1 (555) 555-5555', '+1-555-555-5555',
  'your@email.com', 'name@example.com', 'you@example.com', 'user@domain.com',
  'linkedin.com/in/yourname', 'linkedin.com/in/username', 'linkedin.com/in/your-name',
  'scholar.google.com/citations?user=XXXXX', 'scholar.google.com/citations?user=xxxxx',
  'github.com/username', 'github.com/yourname',
  'yourdomain.com', 'your-portfolio.com', 'example.com',
  'City, State', 'Your City', 'City, Country',
  'Your Name', 'Full Name', 'First Last',
  'TBD', 'N/A', 'TODO', 'PLACEHOLDER',
]);

// profile.yml candidate.* key → human label. Order = display order.
export const CONTACT_FIELDS = [
  ['full_name', 'Name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['location', 'Location'],
  ['linkedin', 'LinkedIn'],
  ['google_scholar', 'Google Scholar'],
  ['portfolio_url', 'Portfolio'],
  ['github', 'GitHub'],
  ['work_authorization', 'Work Auth'],
];

export function normalize(str) {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Extract candidate.* fields from profile.yml (line-based; the file structure is
 * controlled, so no full YAML parser is needed).
 * @returns {Record<string,string>}
 */
export function parseProfile(profilePath) {
  const yaml = readFileSync(profilePath, 'utf8');
  const fields = {};
  let inCandidate = false;
  for (const line of yaml.split('\n')) {
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

/**
 * Pull visible text + hrefs from <span|a class="...contact-item..."> elements only.
 * A global href scan would pull in project links / DOIs and cause false fabrication
 * alerts, so matching is scoped to contact-item elements.
 * @returns {string[]}
 */
export function extractContactFromHtml(html) {
  const found = [];
  const contactRe = /<(span|a)[^>]*class="[^"]*contact-item[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = contactRe.exec(html)) !== null) {
    const outerTag = m[0];
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (text) found.push(text);
    const hrefM = outerTag.match(/href="([^"]+)"/i);
    if (hrefM) {
      const url = hrefM[1];
      if (url.startsWith('mailto:')) found.push(url.replace('mailto:', ''));
      else if (!url.startsWith('#')) found.push(url);
    }
  }
  return found;
}

function matches(allowedValue, candidate) {
  const a = normalize(allowedValue);
  const c = normalize(candidate);
  return a === c || a.includes(c) || c.includes(a);
}

/**
 * @param {string[]} htmlContactValues
 * @param {Record<string,string>} profileFields
 * @returns {{ failures: {value:string,reason:string}[], omissions: {field:string,value:string}[] }}
 */
export function auditContact(htmlContactValues, profileFields) {
  const failures = [];
  const allowed = Object.values(profileFields).map(v => normalize(v));

  // (1) placeholder + (2) fabrication
  for (const val of htmlContactValues) {
    const norm = normalize(val);
    if (!norm) continue;
    if (PLACEHOLDER_VALUES.has(val) || PLACEHOLDER_VALUES.has(norm)) {
      failures.push({ value: val, reason: 'PLACEHOLDER LEAKED — template default was not replaced' });
      continue;
    }
    const matchFound = allowed.some(a => a === norm || a.includes(norm) || norm.includes(a));
    if (!matchFound && norm.length > 2) {
      const looksLikeContact = /[@./+\d]/.test(norm) || norm.length > 8;
      if (looksLikeContact) {
        failures.push({ value: val, reason: 'FABRICATION — not found in profile.yml' });
      }
    }
  }

  // (3) omission — a populated profile contact field absent from the rendered CV.
  // full_name is excluded: it renders in the header <h1>, not the contact row, so it
  // never appears among the scanned contact-item elements.
  const omissions = [];
  for (const [key, label] of CONTACT_FIELDS) {
    if (key === 'full_name') continue;
    const val = profileFields[key];
    if (!val) continue;
    const present = htmlContactValues.some(h => matches(val, h));
    if (!present) omissions.push({ field: label, value: val });
  }

  return { failures, omissions };
}

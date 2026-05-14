#!/usr/bin/env node
/**
 * check-history.mjs — Scan history lookup for Block G repost/evergreen detection
 *
 * Usage:
 *   node scripts/check-history.mjs <url> [company] [role-title]
 *
 * Returns JSON:
 *   {
 *     "appearances": N,           // total times this company+role was seen
 *     "first_seen": "YYYY-MM-DD", // earliest appearance
 *     "last_seen": "YYYY-MM-DD",  // most recent appearance
 *     "is_repost": false,         // same company+title but different URLs
 *     "is_evergreen": false,      // exact same URL seen 3+ months apart
 *     "urls_seen": [],            // all distinct URLs seen for this role
 *     "verdict": "..."            // human-readable summary
 *   }
 *
 * Never passes raw TSV to the LLM — this script is the parsing layer.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TSV_PATH = resolve(__dirname, '../data/scan-history.tsv');

// ── Args ──────────────────────────────────────────────────────────────────────
const [, , inputUrl = '', inputCompany = '', inputRole = ''] = process.argv;

if (!inputUrl) {
  console.error('Usage: node scripts/check-history.mjs <url> [company] [role-title]');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    // Strip tracking params and trailing slashes for comparison
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function daysBetween(dateA, dateB) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.abs(new Date(dateA) - new Date(dateB)) / msPerDay;
}

function monthsBetween(dateA, dateB) {
  return daysBetween(dateA, dateB) / 30.44;
}

// ── Read TSV ──────────────────────────────────────────────────────────────────

if (!existsSync(TSV_PATH)) {
  console.log(JSON.stringify({
    appearances: 0,
    first_seen: null,
    last_seen: null,
    is_repost: false,
    is_evergreen: false,
    urls_seen: [],
    verdict: 'No scan history available (scan-history.tsv not found)'
  }));
  process.exit(0);
}

const raw = readFileSync(TSV_PATH, 'utf8').trim();
const lines = raw.split('\n');

if (lines.length <= 1) {
  // Header only or empty
  console.log(JSON.stringify({
    appearances: 0,
    first_seen: null,
    last_seen: null,
    is_repost: false,
    is_evergreen: false,
    urls_seen: [],
    verdict: 'No scan history available (empty history)'
  }));
  process.exit(0);
}

// TSV columns: url, first_seen, portal, title, company, status, location
const header = lines[0].split('\t').map(h => h.trim());
const rows = lines.slice(1).map(line => {
  const cols = line.split('\t');
  return {
    url:        (cols[0] || '').trim(),
    first_seen: (cols[1] || '').trim(),
    portal:     (cols[2] || '').trim(),
    title:      (cols[3] || '').trim(),
    company:    (cols[4] || '').trim(),
    status:     (cols[5] || '').trim(),
    location:   (cols[6] || '').trim(),
  };
});

// ── Match Logic ───────────────────────────────────────────────────────────────

const targetUrl    = normalizeUrl(inputUrl);
const targetCompany = slugify(inputCompany);
const targetRole   = slugify(inputRole);

// Exact URL match
const exactUrlMatches = rows.filter(r => normalizeUrl(r.url) === targetUrl);

// Same company + similar role (fuzzy — any 2 consecutive words of the role match)
const roleWords = targetRole.split(' ').filter(w => w.length > 2);
const companyRoleMatches = (targetCompany || targetRole)
  ? rows.filter(r => {
      const rowCompany = slugify(r.company);
      const rowTitle   = slugify(r.title);
      const companyMatch = targetCompany && rowCompany.includes(targetCompany);
      const roleMatch    = targetRole && roleWords.length > 0 &&
        roleWords.some(w => rowTitle.includes(w));
      return companyMatch && roleMatch;
    })
  : [];

// All matching rows (union, deduped by URL)
const allMatchUrls = new Set([
  ...exactUrlMatches.map(r => r.url),
  ...companyRoleMatches.map(r => r.url),
]);
const allMatches = rows.filter(r => allMatchUrls.has(r.url));

if (allMatches.length === 0) {
  console.log(JSON.stringify({
    appearances: 0,
    first_seen: null,
    last_seen: null,
    is_repost: false,
    is_evergreen: false,
    urls_seen: [],
    verdict: 'No prior appearances found for this role'
  }));
  process.exit(0);
}

// ── Compute Signals ───────────────────────────────────────────────────────────

const dates = allMatches
  .map(r => r.first_seen)
  .filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d))
  .sort();

const firstSeen = dates[0] || null;
const lastSeen  = dates[dates.length - 1] || null;
const appearances = allMatches.length;

// Distinct URLs seen
const distinctUrls = [...new Set(allMatches.map(r => r.url))];

// is_evergreen: same URL seen across 3+ months
const urlSpans = {};
for (const row of allMatches) {
  const norm = normalizeUrl(row.url);
  if (!urlSpans[norm]) urlSpans[norm] = [];
  if (row.first_seen) urlSpans[norm].push(row.first_seen);
}
const isEvergreen = Object.values(urlSpans).some(dates => {
  if (dates.length < 2) return false;
  const sorted = dates.sort();
  return monthsBetween(sorted[0], sorted[sorted.length - 1]) >= 3;
});

// is_repost: same company+role, more than 1 distinct URL
const distinctUrlCount = distinctUrls.length;
const hasMultipleUrls  = distinctUrlCount > 1;
const hasCompanyRoleMatch = companyRoleMatches.length > 0;
const isRepost = hasMultipleUrls && hasCompanyRoleMatch;

// ── Verdict ───────────────────────────────────────────────────────────────────

let verdict;
if (appearances === 0) {
  verdict = 'No prior appearances found';
} else if (isEvergreen) {
  verdict = `Evergreen role: same URL seen across ${monthsBetween(firstSeen, lastSeen).toFixed(1)} months. Likely a pipeline/always-hiring role.`;
} else if (isRepost && appearances >= 3) {
  verdict = `Reposted ${appearances} times (${distinctUrlCount} distinct URLs). Repeated re-listing is a ghost job signal — verify before applying.`;
} else if (isRepost) {
  verdict = `Reposted with a new URL (${distinctUrlCount} URLs seen). Minor signal — could be ATS migration or updated JD.`;
} else if (appearances >= 3) {
  verdict = `Appeared ${appearances} times. Multiple appearances with the same URL may indicate an active evergreen role or slow-to-fill position.`;
} else {
  verdict = `Seen ${appearances} time(s) previously. Low signal.`;
}

// ── Output ────────────────────────────────────────────────────────────────────

console.log(JSON.stringify({
  appearances,
  first_seen: firstSeen,
  last_seen:  lastSeen,
  is_repost:  isRepost,
  is_evergreen: isEvergreen,
  urls_seen:  distinctUrls,
  verdict
}, null, 2));

#!/usr/bin/env node

/**
 * scan.mjs — Zero-token portal scanner
 *
 * Fetches Greenhouse, Ashby, and Lever APIs directly, applies title/location
 * filters from config/portals.yml, deduplicates against existing history,
 * and outputs new offers as JSON to stdout.
 *
 * Zero Claude API tokens — pure HTTP + JSON.
 *
 * Usage:
 *   node scripts/scan.mjs                        # scan all enabled companies
 *   node scripts/scan.mjs --dry-run              # preview without writing files
 *   node scripts/scan.mjs --fast                 # priority: true companies only
 *   node scripts/scan.mjs --company Cohere       # scan a single company
 *   node scripts/scan.mjs --sources greenhouse   # scan specific API type(s)
 *   node scripts/scan.mjs --import jobs.csv      # import from CSV file
 *
 * Output: JSON to stdout, human summary to stderr
 * Exit codes: 0 = success, 1 = fatal error, 2 = CSV column mapping failed
 *
 * Ported and adapted from career-ops/scan.mjs
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readFile } from 'fs';
import { readFile as readFileAsync } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ── Config paths (resolved relative to script, CWD-independent) ─────────────

const PORTALS_PATH = resolve(projectRoot, 'config/portals.yml');
const SCAN_HISTORY_PATH = resolve(projectRoot, 'data/scan-history.tsv');
const PIPELINE_PATH = resolve(projectRoot, 'data/pipeline.md');
const APPLICATIONS_PATH = resolve(projectRoot, 'data/applications.md');

mkdirSync(resolve(projectRoot, 'data'), { recursive: true });

const CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 10_000;

// ── API detection ─────────────────────────────────────────────────────────────

function detectApi(company) {
  // Greenhouse: explicit api field
  if (company.api && company.api.includes('greenhouse')) {
    return { type: 'greenhouse', url: company.api };
  }

  const url = company.careers_url || '';

  // Ashby
  const ashbyMatch = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/);
  if (ashbyMatch) {
    return {
      type: 'ashby',
      url: `https://api.ashbyhq.com/posting-api/job-board/${ashbyMatch[1]}?includeCompensation=true`,
    };
  }

  // Lever
  const leverMatch = url.match(/jobs\.lever\.co\/([^/?#]+)/);
  if (leverMatch) {
    return {
      type: 'lever',
      url: `https://api.lever.co/v0/postings/${leverMatch[1]}`,
    };
  }

  // Greenhouse EU boards
  const ghEuMatch = url.match(/job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/);
  if (ghEuMatch && !company.api) {
    return {
      type: 'greenhouse',
      url: `https://boards-api.greenhouse.io/v1/boards/${ghEuMatch[1]}/jobs`,
    };
  }

  return null;
}

// ── API parsers ──────────────────────────────────────────────────────────────

function parseGreenhouse(json, companyName) {
  const jobs = json.jobs || [];
  return jobs.map(j => ({
    title: j.title || '',
    url: j.absolute_url || '',
    company: companyName,
    location: j.location?.name || '',
  }));
}

function parseAshby(json, companyName) {
  const jobs = json.jobs || [];
  return jobs.map(j => ({
    title: j.title || '',
    url: j.jobUrl || '',
    company: companyName,
    location: j.location || '',
  }));
}

function parseLever(json, companyName) {
  if (!Array.isArray(json)) return [];
  return json.map(j => ({
    title: j.text || '',
    url: j.hostedUrl || '',
    company: companyName,
    location: j.categories?.location || '',
  }));
}

const PARSERS = { greenhouse: parseGreenhouse, ashby: parseAshby, lever: parseLever };

// ── Fetch with timeout ───────────────────────────────────────────────────────

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── Title filter ─────────────────────────────────────────────────────────────

function buildTitleFilter(titleFilter) {
  const positive = (titleFilter?.positive || []).map(k => k.toLowerCase());
  const negative = (titleFilter?.negative || []).map(k => k.toLowerCase());

  return (title) => {
    const lower = title.toLowerCase();
    const hasPositive = positive.length === 0 || positive.some(k => lower.includes(k));
    const hasNegative = negative.some(k => lower.includes(k));
    return hasPositive && !hasNegative;
  };
}

// ── Location filter ──────────────────────────────────────────────────────────

function buildLocationFilter(locationFilter) {
  if (!locationFilter) return () => true;
  const allow = (locationFilter.allow || []).map(k => k.toLowerCase());
  const block = (locationFilter.block || []).map(k => k.toLowerCase());

  return (location) => {
    if (!location) return true;
    const lower = location.toLowerCase();
    if (block.length > 0 && block.some(k => lower.includes(k))) return false;
    if (allow.length === 0) return true;
    return allow.some(k => lower.includes(k));
  };
}

// ── Dedup ────────────────────────────────────────────────────────────────────

function loadSeenUrls(lookbackDays) {
  const seen = new Set();
  const cutoffDate = lookbackDays > 0
    ? new Date(Date.now() - lookbackDays * 86400000)
    : null;

  // scan-history.tsv — with lookback window
  if (existsSync(SCAN_HISTORY_PATH)) {
    const lines = readFileSync(SCAN_HISTORY_PATH, 'utf-8').split('\n');
    for (const line of lines.slice(1)) { // skip header
      if (!line.trim()) continue;
      const cols = line.split('\t');
      const url = cols[0];
      const firstSeen = cols[1];
      if (!url) continue;

      // Apply lookback window: skip entries older than cutoffDate
      if (cutoffDate && firstSeen) {
        try {
          const entryDate = new Date(firstSeen);
          if (!isNaN(entryDate) && entryDate < cutoffDate) continue;
        } catch {
          // Malformed date — include in dedup (conservative)
        }
      }
      seen.add(url);
    }
  }

  // pipeline.md — general URL extraction from table cells (never windowed)
  if (existsSync(PIPELINE_PATH)) {
    const text = readFileSync(PIPELINE_PATH, 'utf-8');
    for (const match of text.matchAll(/https?:\/\/[^\s|)]+/g)) {
      seen.add(match[0].trim());
    }
  }

  // applications.md — all inline URLs (never windowed)
  if (existsSync(APPLICATIONS_PATH)) {
    const text = readFileSync(APPLICATIONS_PATH, 'utf-8');
    for (const match of text.matchAll(/https?:\/\/[^\s|)]+/g)) {
      seen.add(match[0].trim());
    }
  }

  return seen;
}

function loadSeenCompanyRoles() {
  const seen = new Set();
  if (existsSync(APPLICATIONS_PATH)) {
    const text = readFileSync(APPLICATIONS_PATH, 'utf-8');
    // Parse markdown table rows: | # | Date | Company | Role | ...
    for (const match of text.matchAll(/\|[^|]+\|[^|]+\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g)) {
      const company = match[1].trim().toLowerCase();
      const role = match[2].trim().toLowerCase();
      if (company && role && company !== 'company') {
        seen.add(`${company}::${role}`);
      }
    }
  }
  return seen;
}

// ── Scan history writer ──────────────────────────────────────────────────────

function appendToScanHistory(offers, date) {
  if (!existsSync(SCAN_HISTORY_PATH)) {
    writeFileSync(SCAN_HISTORY_PATH, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tlocation\n', 'utf-8');
  }

  const lines = offers.map(o =>
    `${o.url}\t${date}\t${o.source}\t${o.title}\t${o.company}\tadded\t${o.location || ''}`
  ).join('\n') + '\n';

  appendFileSync(SCAN_HISTORY_PATH, lines, 'utf-8');
}

// ── Parallel fetch with concurrency limit ────────────────────────────────────

async function parallelFetch(tasks, limit) {
  const results = [];
  let i = 0;

  async function next() {
    while (i < tasks.length) {
      const task = tasks[i++];
      results.push(await task());
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => next());
  await Promise.all(workers);
  return results;
}

// ── CSV import ───────────────────────────────────────────────────────────────

async function importCsv(filePath) {
  let text;
  try {
    text = await readFileAsync(filePath, 'utf-8');
  } catch {
    console.error(`Error: Cannot read CSV file: ${filePath}`);
    process.exit(1);
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    console.error('Error: CSV file is empty.');
    process.exit(1);
  }

  // Parse headers (first line)
  const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

  // Deterministic column mapping
  const URL_HEADERS = ['url', 'link', 'job_url', 'posting_url', 'job url', 'posting url'];
  const COMPANY_HEADERS = ['company', 'employer', 'organization', 'company name'];
  const TITLE_HEADERS = ['title', 'role', 'position', 'job_title', 'job title', 'job role'];
  const LOCATION_HEADERS = ['location', 'city', 'office', 'work location'];

  const urlCol = rawHeaders.findIndex(h => URL_HEADERS.includes(h));
  if (urlCol === -1) {
    // Exit code 2 signals agent to do LLM-based mapping
    console.error(`CSV_MAPPING_FAILED: Cannot find URL column. Headers found: ${rawHeaders.join(', ')}`);
    process.exit(2);
  }

  const companyCol = rawHeaders.findIndex(h => COMPANY_HEADERS.includes(h));
  const titleCol = rawHeaders.findIndex(h => TITLE_HEADERS.includes(h));
  const locationCol = rawHeaders.findIndex(h => LOCATION_HEADERS.includes(h));

  const offers = [];
  for (const line of lines.slice(1)) {
    if (!line) continue;
    // Basic CSV split (doesn't handle quoted commas — good enough for standard exports)
    const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    const url = cols[urlCol];
    if (!url || !url.startsWith('http')) continue;

    offers.push({
      url,
      company: companyCol >= 0 ? cols[companyCol] || '' : '',
      title: titleCol >= 0 ? cols[titleCol] || '' : '',
      location: locationCol >= 0 ? cols[locationCol] || '' : '',
      source: 'csv-import',
    });
  }

  return offers;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`career-scout scan — Zero-token portal scanner

USAGE
  node scripts/scan.mjs                        Scan all enabled companies
  node scripts/scan.mjs --fast                 Priority companies only (priority: true)
  node scripts/scan.mjs --sources TYPE         Scan specific API types (greenhouse,ashby,lever)
  node scripts/scan.mjs --company NAME         Scan a single company
  node scripts/scan.mjs --import FILE          Import jobs from a CSV file
  node scripts/scan.mjs --dry-run              Preview without writing files

OUTPUT
  stdout: JSON { date, mode, stats, offers[], errors[] }
  stderr: human-readable summary

EXIT CODES
  0  Success
  1  Fatal error (portals.yml missing, CSV file not found)
  2  CSV column mapping failed (agent should do LLM-based mapping)

CONFIG
  config/portals.yml           Companies + title/location filters
  config/portals.example.yml   Copy to portals.yml and customize`);
    process.exit(0);
  }

  const dryRun = args.includes('--dry-run');
  const fastMode = args.includes('--fast');
  const companyFlag = args.indexOf('--company');
  const filterCompany = companyFlag !== -1 ? args[companyFlag + 1]?.toLowerCase() : null;
  const sourcesFlag = args.indexOf('--sources');
  const filterSources = sourcesFlag !== -1
    ? args[sourcesFlag + 1]?.toLowerCase().split(',').map(s => s.trim())
    : null;
  const importFlag = args.indexOf('--import');
  const importFile = importFlag !== -1 ? args[importFlag + 1] : null;

  // ── CSV import mode ──
  if (importFile) {
    const csvOffers = await importCsv(importFile);
    const date = new Date().toISOString().slice(0, 10);

    // Dedup against existing history
    const config = existsSync(PORTALS_PATH)
      ? yaml.load(readFileSync(PORTALS_PATH, 'utf-8'))
      : {};
    const lookbackDays = config.lookback_days ?? 180;
    const seenUrls = loadSeenUrls(lookbackDays);
    const seenCompanyRoles = loadSeenCompanyRoles();

    const newOffers = [];
    for (const offer of csvOffers) {
      if (seenUrls.has(offer.url)) continue;
      const key = `${offer.company.toLowerCase()}::${offer.title.toLowerCase()}`;
      if (offer.company && offer.title && seenCompanyRoles.has(key)) continue;
      seenUrls.add(offer.url);
      newOffers.push(offer);
    }

    if (!dryRun && newOffers.length > 0) {
      appendToScanHistory(newOffers, date);
    }

    const result = {
      date,
      mode: 'csv-import',
      stats: {
        companies_scanned: 0,
        total_found: csvOffers.length,
        filtered_title: 0,
        filtered_location: 0,
        duplicates: csvOffers.length - newOffers.length,
        new_offers: newOffers.length,
        errors: 0,
      },
      offers: newOffers,
      errors: [],
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // ── Portal scan mode ──

  // 1. Read portals.yml
  if (!existsSync(PORTALS_PATH)) {
    console.error('Error: config/portals.yml not found. Run setup or copy config/portals.example.yml.');
    process.exit(1);
  }

  const config = yaml.load(readFileSync(PORTALS_PATH, 'utf-8'));
  const companies = config.tracked_companies || [];
  const lookbackDays = config.lookback_days ?? 180;
  const titleFilter = buildTitleFilter(config.title_filter);
  const locationFilter = buildLocationFilter(config.location_filter);

  // 2. Filter to enabled companies with detectable APIs
  let targets = companies
    .filter(c => c.enabled !== false)
    .filter(c => !filterCompany || c.name.toLowerCase().includes(filterCompany))
    .map(c => ({ ...c, _api: detectApi(c) }))
    .filter(c => c._api !== null);

  // --fast: priority companies only
  if (fastMode) {
    targets = targets.filter(c => c.priority === true);
  }

  // --sources: filter by API type
  if (filterSources) {
    targets = targets.filter(c => filterSources.includes(c._api.type));
  }

  const totalEnabled = companies.filter(c => c.enabled !== false).length;
  const skippedCount = companies.filter(c => c.enabled !== false).length - targets.length;

  console.error(`Scanning ${targets.length} companies via API (${skippedCount} skipped — no API detected)${fastMode ? ' [PRIORITY RUN]' : ''}`);
  if (dryRun) console.error('(dry run — no files will be written)\n');

  // Warn if --fast found no priority companies
  if (fastMode && targets.length === 0) {
    console.error('No favorite companies set up yet.');
    console.error('Open config/portals.yml and add "priority: true" to your top companies,');
    console.error('then run "scan --fast" for a quick daily check on just those.');
  }

  // 3. Load dedup sets
  const seenUrls = loadSeenUrls(lookbackDays);
  const seenCompanyRoles = loadSeenCompanyRoles();

  // 4. Fetch all APIs
  const date = new Date().toISOString().slice(0, 10);
  let totalFound = 0;
  let totalFilteredTitle = 0;
  let totalFilteredLocation = 0;
  let totalDupes = 0;
  const newOffers = [];
  const errors = [];

  const tasks = targets.map(company => async () => {
    const { type, url } = company._api;
    try {
      const json = await fetchJson(url);
      const jobs = PARSERS[type](json, company.name);
      totalFound += jobs.length;

      for (const job of jobs) {
        if (!titleFilter(job.title)) {
          totalFilteredTitle++;
          continue;
        }
        if (!locationFilter(job.location)) {
          totalFilteredLocation++;
          continue;
        }
        if (seenUrls.has(job.url)) {
          totalDupes++;
          continue;
        }
        const key = `${job.company.toLowerCase()}::${job.title.toLowerCase()}`;
        if (seenCompanyRoles.has(key)) {
          totalDupes++;
          continue;
        }
        // Mark as seen to avoid intra-scan dupes
        seenUrls.add(job.url);
        seenCompanyRoles.add(key);
        newOffers.push({ ...job, source: `${type}-api` });
      }
    } catch (err) {
      errors.push({ company: company.name, error: err.message });
    }
  });

  await parallelFetch(tasks, CONCURRENCY);

  // 5. Write scan history (skip on dry-run)
  if (!dryRun && newOffers.length > 0) {
    appendToScanHistory(newOffers, date);
  }

  // 6. Print human summary to stderr
  console.error(`\n${'━'.repeat(45)}`);
  console.error(`Portal Scan — ${date}${fastMode ? ' [PRIORITY RUN]' : ''}`);
  console.error(`${'━'.repeat(45)}`);
  console.error(`Companies scanned:     ${targets.length}`);
  console.error(`Total jobs found:      ${totalFound}`);
  console.error(`Filtered by title:     ${totalFilteredTitle} removed`);
  console.error(`Filtered by location:  ${totalFilteredLocation} removed`);
  console.error(`Duplicates:            ${totalDupes} skipped`);
  console.error(`New offers:            ${newOffers.length}`);
  if (errors.length > 0) {
    console.error(`\nErrors (${errors.length}):`);
    for (const e of errors) {
      console.error(`  x ${e.company}: ${e.error}`);
    }
  }
  if (dryRun) {
    console.error('\n(dry run — run without --dry-run to save results)');
  }

  // 7. Output JSON to stdout
  const result = {
    date,
    mode: fastMode ? 'priority' : 'full',
    stats: {
      companies_scanned: targets.length,
      total_found: totalFound,
      filtered_title: totalFilteredTitle,
      filtered_location: totalFilteredLocation,
      duplicates: totalDupes,
      new_offers: newOffers.length,
      errors: errors.length,
    },
    offers: newOffers,
    errors,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

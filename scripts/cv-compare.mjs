#!/usr/bin/env node
/**
 * cv-compare.mjs — deterministic CV diff: master cv.md vs tailored CV HTML
 *
 * Usage:
 *   node scripts/cv-compare.mjs <cv.md> <tailored-draft.html> <company-slug>
 *
 * Reads cv.diff_threshold from config/profile.yml (default 0.5).
 * Emits output/compare-{slug}-{YYYY-MM-DD}.md and runs md-to-html.mjs on it.
 *
 * Exit codes:
 *   0  success (warnings printed for added items)
 *   1  usage error or missing file
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ─── Args ────────────────────────────────────────────────────────────────────

const [,, masterMdArg, tailoredHtmlArg, slug] = process.argv;

if (!masterMdArg || !tailoredHtmlArg || !slug) {
  console.error('Usage: node scripts/cv-compare.mjs <cv.md> <tailored-draft.html> <company-slug>');
  process.exit(1);
}

const absMaster = resolve(masterMdArg);
const absTailored = resolve(tailoredHtmlArg);

for (const p of [absMaster, absTailored]) {
  if (!existsSync(p)) { console.error(`File not found: ${p}`); process.exit(1); }
}

// ─── Config ──────────────────────────────────────────────────────────────────

const profilePath = join(projectRoot, 'config', 'profile.yml');
let threshold = 0.5;
if (existsSync(profilePath)) {
  const m = readFileSync(profilePath, 'utf8').match(/diff_threshold:\s*([\d.]+)/);
  if (m) threshold = Math.min(1, Math.max(0, parseFloat(m[1])));
}

// ─── Parse master cv.md ──────────────────────────────────────────────────────

/**
 * Returns { summary, competencies, jobs }
 *   summary:      string | null
 *   competencies: string[]
 *   jobs:         { company: string, bullets: string[] }[]
 *   skills:       string[]
 */
function parseMasterMd(md) {
  const lines = md.split('\n');

  let summary = null;
  const competencies = [];
  const jobs = [];
  const skills = [];

  let currentH2 = null;
  let currentH3 = null;
  let currentJob = null;
  let summaryLines = [];
  let summaryDone = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    const h2m = line.match(/^##\s+(.+)/);
    const h3m = line.match(/^###\s+(.+)/);

    if (h2m) {
      finaliseJob();
      currentH2 = h2m[1].trim();
      currentH3 = null;
      currentJob = null;
      summaryLines = [];
      summaryDone = false;
      continue;
    }

    if (h3m) {
      finaliseJob();
      currentH3 = h3m[1].trim();
      // H3 inside Work Experience → a job entry
      if (currentH2 && /experience|work|employment|career/i.test(currentH2)) {
        currentJob = { company: currentH3, bullets: [] };
        jobs.push(currentJob);
      } else {
        currentJob = null;
      }
      continue;
    }

    if (!currentH2) continue;

    const isSummarySection = /summary|profile|objective|professional/i.test(currentH2);
    const isCompSection = /competenc|skills?|expertise/i.test(currentH2) && !/work|exp/i.test(currentH2);
    const isSkillsSection = /technical\s+skills?|skills?\s+&|^skills?$/i.test(currentH2);
    const isExpSection = /experience|work|employment|career/i.test(currentH2);

    const bulletM = line.match(/^[-*•]\s+(.+)/);

    if (isSummarySection && !isCompSection && !summaryDone) {
      if (bulletM) {
        // Bullets inside a summary section signal the start of a sub-list — stop collecting
        summaryDone = true;
      } else if (line.trim()) {
        summaryLines.push(line.trim());
      }
      // Do NOT set summaryDone on blank lines — multi-paragraph summaries have blank lines
      // between paragraphs. The parser continues until the next ## header resets currentH2.
      continue;
    }

    if (!bulletM) continue;

    const item = bulletM[1].trim();

    if (isSkillsSection) {
      skills.push(item);
    } else if (isCompSection) {
      competencies.push(item);
    } else if (isExpSection) {
      if (currentJob) {
        currentJob.bullets.push(item);
      }
    }
  }

  // Flush pending summary — join all collected lines; collapse internal blank markers to space
  if (!summary && summaryLines.length > 0) summary = summaryLines.join(' ').replace(/\s+/g, ' ').trim();
  finaliseJob();

  return { summary, competencies, jobs, skills };

  function finaliseJob() { /* jobs are pushed eagerly */ }
}

// ─── Parse tailored HTML ──────────────────────────────────────────────────────

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Returns { summary, competencies, jobs, skills }
 */
function parseTailoredHtml(html) {
  // Professional Summary
  let summary = null;
  const sumM = html.match(/<div[^>]+class="[^"]*summary-text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (sumM) summary = stripTags(sumM[1]);

  // Competencies — both classic (.competency-item) and ats (.competency-tag)
  const competencies = [];
  const compRe = /<span[^>]+class="[^"]*competency-(?:item|tag)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let cm;
  while ((cm = compRe.exec(html)) !== null) {
    const t = stripTags(cm[1]);
    if (t) competencies.push(t);
  }

  // Jobs: each .job div → company name + <li> bullets
  const jobs = [];
  const jobRe = /<div[^>]+class="[^"]*\bjob\b[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*\bjob\b|<\/div>\s*<\/div>\s*(?:<div[^>]+class="[^"]*section|$))/gi;
  let jm;
  while ((jm = jobRe.exec(html)) !== null) {
    const block = jm[1];
    const companyM = block.match(/<[^>]+class="[^"]*job-company[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);
    const company = companyM ? stripTags(companyM[1]) : 'Unknown';

    const bullets = [];
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let lm;
    while ((lm = liRe.exec(block)) !== null) {
      const t = stripTags(lm[1]);
      if (t) bullets.push(t);
    }
    if (bullets.length > 0) jobs.push({ company, bullets });
  }

  // Skills — any <li> items in the skills section (last section before closing body)
  // Find skills section by looking for section-title containing "skills"
  const skills = [];
  const skillsSectionM = html.match(/class="[^"]*section-title[^"]*"[^>]*>[^<]*[Ss]kills[^<]*<\/[^>]+>([\s\S]*?)(?=<div[^>]+class="[^"]*section-title|<\/body>)/i);
  if (skillsSectionM) {
    const block = skillsSectionM[1];
    const liRe2 = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let lm2;
    while ((lm2 = liRe2.exec(block)) !== null) {
      const t = stripTags(lm2[1]);
      if (t) skills.push(t);
    }
  }

  return { summary, competencies, jobs, skills };
}

// ─── Jaccard similarity ───────────────────────────────────────────────────────

function tokenize(str) {
  return new Set(str.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean));
}

function jaccard(a, b) {
  const ta = tokenize(a);
  const tb = tokenize(b);
  let inter = 0;
  for (const t of ta) { if (tb.has(t)) inter++; }
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ─── Diff bullets ────────────────────────────────────────────────────────────

/**
 * Returns { kept, rewritten (pairs), removed, added }
 */
function diffBullets(masterBullets, tailoredBullets, thresh) {
  const kept = [];
  const rewritten = [];
  const removed = [];
  const added = [];

  const masterUsed = new Set();
  const tailoredUsed = new Set();

  // Exact matches first (after normalization)
  for (let ti = 0; ti < tailoredBullets.length; ti++) {
    for (let mi = 0; mi < masterBullets.length; mi++) {
      if (masterUsed.has(mi)) continue;
      if (normalize(masterBullets[mi]) === normalize(tailoredBullets[ti])) {
        kept.push(tailoredBullets[ti]);
        masterUsed.add(mi);
        tailoredUsed.add(ti);
        break;
      }
    }
  }

  // Fuzzy rewrite matches
  for (let ti = 0; ti < tailoredBullets.length; ti++) {
    if (tailoredUsed.has(ti)) continue;
    let bestScore = -1;
    let bestMi = -1;
    for (let mi = 0; mi < masterBullets.length; mi++) {
      if (masterUsed.has(mi)) continue;
      const score = jaccard(masterBullets[mi], tailoredBullets[ti]);
      if (score >= thresh && score > bestScore) {
        bestScore = score;
        bestMi = mi;
      }
    }
    if (bestMi >= 0) {
      rewritten.push({ master: masterBullets[bestMi], tailored: tailoredBullets[ti] });
      masterUsed.add(bestMi);
      tailoredUsed.add(ti);
    }
  }

  // Remaining master → removed
  for (let mi = 0; mi < masterBullets.length; mi++) {
    if (!masterUsed.has(mi)) removed.push(masterBullets[mi]);
  }

  // Remaining tailored → added (fabrication candidates)
  for (let ti = 0; ti < tailoredBullets.length; ti++) {
    if (!tailoredUsed.has(ti)) added.push(tailoredBullets[ti]);
  }

  return { kept, rewritten, removed, added };
}

function normalize(s) {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim();
}

// ─── Section status label ─────────────────────────────────────────────────────

function sectionStatus(diff) {
  if (diff.added.length > 0 && diff.removed.length === 0) return 'ADDED';
  if (diff.added.length > 0) return 'EDITED+ADDED';
  if (diff.removed.length > 0 && diff.rewritten.length === 0 && diff.kept.length > 0) return 'TRIMMED';
  if (diff.removed.length === 0 && diff.rewritten.length === 0) return 'UNCHANGED';
  if (diff.rewritten.length > 0 || diff.removed.length > 0) return 'EDITED';
  return 'MODIFIED';
}

// ─── Build comparison markdown ────────────────────────────────────────────────

function buildComparisonMd(master, tailored, slug, today) {
  const lines = [];
  const companyDisplay = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  lines.push(`# CV Comparison: ${companyDisplay} (${today})`);
  lines.push('');
  lines.push(`> Generated by scripts/cv-compare.mjs · Jaccard threshold: ${threshold}`);
  lines.push(`> Master: cv.md | Tailored: ${tailoredHtmlArg}`);
  lines.push('');

  // ── Summary table ──
  lines.push('## Summary');
  lines.push('');
  lines.push('| Section | Kept | Rewritten | Removed | Added | Status |');
  lines.push('|---------|-----:|----------:|--------:|------:|--------|');

  const rows = [];

  // Professional Summary row
  if (master.summary || tailored.summary) {
    const changed = master.summary && tailored.summary && normalize(master.summary) !== normalize(tailored.summary);
    rows.push({ name: 'Professional Summary', kept: 'n/a', rewritten: changed ? 1 : 0, removed: 'n/a', added: 'n/a', status: changed ? 'REWRITTEN' : 'UNCHANGED' });
  }

  // Competencies diff
  const compDiff = diffBullets(master.competencies, tailored.competencies, threshold);
  if (master.competencies.length > 0 || tailored.competencies.length > 0) {
    rows.push({ name: 'Core Competencies', ...counts(compDiff), status: sectionStatus(compDiff), _diff: compDiff });
  }

  // Job diffs — match by company name
  const masterJobMap = {};
  for (const j of master.jobs) masterJobMap[normalizeCompany(j.company)] = j;

  for (const tj of tailored.jobs) {
    const key = normalizeCompany(tj.company);
    const mj = masterJobMap[key] || bestJobMatch(tj.company, master.jobs);
    const bullets_m = mj ? mj.bullets : [];
    const diff = diffBullets(bullets_m, tj.bullets, threshold);
    rows.push({ name: tj.company, ...counts(diff), status: sectionStatus(diff), _diff: diff });
    if (mj) delete masterJobMap[normalizeCompany(mj.company)];
  }

  // Remaining master jobs not in tailored → all removed
  for (const mj of Object.values(masterJobMap)) {
    rows.push({ name: `${mj.company} *(removed)*`, kept: 0, rewritten: 0, removed: mj.bullets.length, added: 0, status: 'REMOVED', _diff: { kept: [], rewritten: [], removed: mj.bullets, added: [] } });
  }

  // Skills diff
  const skillsDiff = diffBullets(master.skills, tailored.skills, threshold);
  if (master.skills.length > 0 || tailored.skills.length > 0) {
    rows.push({ name: 'Technical Skills', ...counts(skillsDiff), status: sectionStatus(skillsDiff), _diff: skillsDiff });
  }

  for (const r of rows) {
    const k = r.kept === 'n/a' ? 'n/a' : r.kept;
    const rw = r.rewritten === 'n/a' ? 'n/a' : r.rewritten;
    const rm = r.removed === 'n/a' ? 'n/a' : r.removed;
    const ad = r.added === 'n/a' ? 'n/a' : r.added;
    lines.push(`| ${r.name} | ${k} | ${rw} | ${rm} | ${ad} | ${r.status} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // ── Professional Summary section ──
  if (master.summary || tailored.summary) {
    lines.push('## Professional Summary');
    lines.push('');
    lines.push('**Master:**');
    lines.push('');
    lines.push(`> ${master.summary || '*(not found in cv.md)*'}`);
    lines.push('');
    lines.push('**Tailored:**');
    lines.push('');
    lines.push(`> ${tailored.summary || '*(not found in tailored CV)*'}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // ── Competencies section ──
  if (compDiff) {
    lines.push('## Core Competencies');
    lines.push('');
    appendBulletDiff(lines, compDiff, 'Core Competencies');
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // ── Job sections ──
  for (const r of rows) {
    if (!r._diff || r.name === 'Core Competencies' || r.name === 'Technical Skills') continue;
    if (r.name === 'Professional Summary') continue;

    lines.push(`## ${r.name.replace(' *(removed)*', '')}`);
    lines.push('');
    appendBulletDiff(lines, r._diff, r.name);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // ── Skills section ──
  if (skillsDiff && (master.skills.length > 0 || tailored.skills.length > 0)) {
    lines.push('## Technical Skills');
    lines.push('');
    appendBulletDiff(lines, skillsDiff, 'Technical Skills');
    lines.push('');
  }

  return lines.join('\n');
}

function counts(diff) {
  return { kept: diff.kept.length, rewritten: diff.rewritten.length, removed: diff.removed.length, added: diff.added.length };
}

function appendBulletDiff(lines, diff, sectionName) {
  if (diff.kept.length > 0) {
    lines.push(`**Kept verbatim (${diff.kept.length}):** ${diff.kept.slice(0, 5).map(b => `*${b.slice(0, 60)}${b.length > 60 ? '…' : ''}*`).join(', ')}${diff.kept.length > 5 ? `, … +${diff.kept.length - 5} more` : ''}`);
    lines.push('');
  }

  if (diff.rewritten.length > 0) {
    lines.push(`**Rewritten (${diff.rewritten.length}):**`);
    lines.push('');
    lines.push('| Master | Tailored |');
    lines.push('|--------|----------|');
    for (const pair of diff.rewritten) {
      lines.push(`| ${escMd(pair.master)} | ${escMd(pair.tailored)} |`);
    }
    lines.push('');
  }

  if (diff.removed.length > 0) {
    lines.push(`**Removed (${diff.removed.length}):**`);
    lines.push('');
    for (const b of diff.removed) lines.push(`- ~~${escMd(b)}~~`);
    lines.push('');
  }

  if (diff.added.length > 0) {
    lines.push('<div class="warning-block">');
    lines.push('');
    lines.push(`⚠️ **ADDED ITEMS REQUIRE VERIFICATION — ${diff.added.length} item(s) not found in master cv.md**`);
    lines.push('');
    lines.push('The items below appear in the tailored CV but do not match any bullet in cv.md (below the Jaccard threshold). Verify each is accurate before submitting. If the candidate genuinely has this experience, add it to cv.md first.');
    lines.push('');
    for (const b of diff.added) lines.push(`- ${escMd(b)}`);
    lines.push('');
    lines.push('</div>');
    lines.push('');
  }

  if (diff.kept.length === 0 && diff.rewritten.length === 0 && diff.removed.length === 0 && diff.added.length === 0) {
    lines.push('*(Section unchanged or not found in both documents)*');
    lines.push('');
  }
}

function escMd(s) {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function normalizeCompany(name) {
  return name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function bestJobMatch(tailoredCompany, masterJobs) {
  let best = null;
  let bestScore = 0;
  for (const mj of masterJobs) {
    const score = jaccard(tailoredCompany, mj.company);
    if (score > bestScore) { bestScore = score; best = mj; }
  }
  return bestScore >= 0.3 ? best : null;
}

// ─── Terminal summary ─────────────────────────────────────────────────────────

function printTerminalSummary(master, tailored) {
  const compDiff = diffBullets(master.competencies, tailored.competencies, threshold);
  const skillsDiff = diffBullets(master.skills, tailored.skills, threshold);

  console.log('\n📊 CV Comparison Summary\n');

  const allAdded = [];

  if (master.summary && tailored.summary) {
    const changed = normalize(master.summary) !== normalize(tailored.summary);
    console.log(`  Professional Summary: ${changed ? 'REWRITTEN' : 'UNCHANGED'}`);
  }

  if (master.competencies.length > 0 || tailored.competencies.length > 0) {
    const s = sectionStatus(compDiff);
    console.log(`  Core Competencies: ${s} — ${compDiff.kept.length} kept, ${compDiff.rewritten.length} rewritten, ${compDiff.removed.length} removed, ${compDiff.added.length} added`);
    if (compDiff.added.length > 0) allAdded.push(...compDiff.added.map(b => `Competencies: "${b}"`));
  }

  const masterJobMap = {};
  for (const j of master.jobs) masterJobMap[normalizeCompany(j.company)] = j;

  for (const tj of tailored.jobs) {
    const mj = masterJobMap[normalizeCompany(tj.company)] || bestJobMatch(tj.company, master.jobs);
    const diff = diffBullets(mj ? mj.bullets : [], tj.bullets, threshold);
    const s = sectionStatus(diff);
    console.log(`  ${tj.company}: ${s} — ${diff.kept.length} kept, ${diff.rewritten.length} rewritten, ${diff.removed.length} removed, ${diff.added.length} added`);
    if (diff.added.length > 0) allAdded.push(...diff.added.map(b => `${tj.company}: "${b.slice(0, 60)}${b.length > 60 ? '…' : ''}"`));
  }

  if (master.skills.length > 0 || tailored.skills.length > 0) {
    const s = sectionStatus(skillsDiff);
    console.log(`  Technical Skills: ${s} — ${skillsDiff.kept.length} kept, ${skillsDiff.rewritten.length} rewritten, ${skillsDiff.removed.length} removed, ${skillsDiff.added.length} added`);
    if (skillsDiff.added.length > 0) allAdded.push(...skillsDiff.added.map(b => `Skills: "${b}"`));
  }

  if (allAdded.length > 0) {
    console.log('\n⚠️  ADDED ITEMS — verify before submitting (not found in master cv.md):');
    for (const item of allAdded) console.log(`  • ${item}`);
  } else {
    console.log('\n✅ No added items — all tailored content traces back to master cv.md');
  }

  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const masterContent = readFileSync(absMaster, 'utf8');
const tailoredContent = readFileSync(absTailored, 'utf8');

const master = parseMasterMd(masterContent);
const tailored = parseTailoredHtml(tailoredContent);

mkdirSync(join(projectRoot, 'output'), { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const outMd = join(projectRoot, 'output', `compare-${slug}-${today}.md`);
const mdContent = buildComparisonMd(master, tailored, slug, today);
writeFileSync(outMd, mdContent, 'utf8');

// Run md-to-html
const outHtml = outMd.replace(/\.md$/, '.html');
try {
  execSync(`node "${join(projectRoot, 'scripts', 'md-to-html.mjs')}" "${outMd}"`, { stdio: 'pipe' });
  const fwdHtml = outHtml.replace(/\\/g, '/');
  const relHtml = outHtml.startsWith(projectRoot)
    ? outHtml.slice(projectRoot.length + 1).replace(/\\/g, '/')
    : fwdHtml;
  console.log(`✅ Comparison written: ${outMd}`);
  console.log(`📂 Open: file:///${fwdHtml}`);
  console.log(`   Path: ${relHtml}`);
} catch {
  const relMd = outMd.startsWith(projectRoot)
    ? outMd.slice(projectRoot.length + 1).replace(/\\/g, '/')
    : outMd;
  console.log(`✅ Comparison written: ${outMd}`);
  console.log(`   Path: ${relMd}`);
  console.log('   [file:// link unavailable — open from project directory]');
}

printTerminalSummary(master, tailored);

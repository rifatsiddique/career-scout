#!/usr/bin/env node
/**
 * generate-docx.mjs — CV HTML → high-fidelity DOCX via programmatic OOXML
 *
 * Usage:
 *   node scripts/generate-docx.mjs <input-cv.html> <output.docx>
 *
 * Reads design tokens from the HTML's :root CSS block (--accent, --margins,
 * --base-font-size). Parses content using node-html-parser. Builds the DOCX
 * with the `docx` npm package.
 *
 * FIDELITY NOTE: This produces a professional Word document that mirrors the
 * PDF's visual language (colors, structure, margins). CSS constructs that have
 * no DOCX equivalent (flexbox, grid, pseudo-elements, @font-face) are mapped
 * to nearest approximations. See plan_rs/ux-improvements-v2.md §Improvement 5
 * for the full fidelity scope table.
 *
 * Exit codes:
 *   0  success
 *   1  usage error, missing file, or docx/node-html-parser not installed
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { normalizeText } from './lib/normalize-text.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ─── Args ────────────────────────────────────────────────────────────────────

const [,, inputHtmlArg, outputDocxArg] = process.argv;
if (!inputHtmlArg || !outputDocxArg) {
  console.error('Usage: node scripts/generate-docx.mjs <input-cv.html> <output.docx>');
  process.exit(1);
}

const absInput = resolve(inputHtmlArg);
const absOutput = resolve(outputDocxArg);

if (!existsSync(absInput)) {
  console.error(`File not found: ${absInput}`);
  process.exit(1);
}

// ─── Load dependencies ────────────────────────────────────────────────────────

let docxLib, parseHtml;
try {
  docxLib = await import('docx');
  const nhp = await import('node-html-parser');
  parseHtml = nhp.parse;
} catch (e) {
  console.error('Missing dependency. Run: npm install docx node-html-parser');
  console.error(e.message);
  process.exit(1);
}

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel,
  convertInchesToTwip, UnderlineType,
} = docxLib;

// ─── Parse HTML ───────────────────────────────────────────────────────────────

const rawHtml = readFileSync(absInput, 'utf8');
const root = parseHtml(rawHtml);

// ─── Extract design tokens from :root ────────────────────────────────────────

function extractToken(html, varName, fallback) {
  const m = html.match(new RegExp(`${varName}:\\s*([^;\\n]+)`));
  return m ? m[1].trim() : fallback;
}

const accentHex = extractToken(rawHtml, '--accent', '#1e3a5f');
const accentMutedHex = extractToken(rawHtml, '--accent-muted', '#4a6985');
const marginsStr = extractToken(rawHtml, '--margins', '0.5in');

// Parse margin value to twips (1 in = 1440 twips; 1 cm = ~567 twips)
function parseMarginToTwips(val) {
  const m = val.match(/([\d.]+)(in|cm|mm|pt|px)?/);
  if (!m) return 720; // default 0.5in
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case 'in': return Math.round(n * 1440);
    case 'cm': return Math.round(n * 567);
    case 'mm': return Math.round(n * 56.7);
    case 'pt': return Math.round(n * 20);
    case 'px': return Math.round(n * 15);
    default: return Math.round(n * 1440);
  }
}
const marginTwips = parseMarginToTwips(marginsStr);

// Convert hex color to RRGGBB string (docx uses RRGGBB without #)
function hexToDocx(hex) {
  return hex.replace(/^#/, '').toUpperCase().padEnd(6, '0').slice(0, 6);
}
const ACCENT = hexToDocx(accentHex);
const ACCENT_MUTED = hexToDocx(accentMutedHex);

// ─── HTML → text helpers ──────────────────────────────────────────────────────

function getText(el) {
  if (!el) return '';
  return normalizeText(el.text.replace(/\s+/g, ' ').trim());
}

// ─── DOCX builders ───────────────────────────────────────────────────────────

function makeRun(text, opts = {}) {
  return new TextRun({
    text: normalizeText(text),
    bold: opts.bold || false,
    italics: opts.italic || false,
    color: opts.color || undefined,
    size: opts.size || 22, // half-points; 22 = 11pt
    font: opts.font || 'Calibri',
  });
}

function makeEmptyPara(spacing = 60) {
  return new Paragraph({ spacing: { after: spacing } });
}

function makeNamePara(name) {
  return new Paragraph({
    children: [new TextRun({
      text: normalizeText(name),
      bold: true,
      color: ACCENT,
      size: 48, // 24pt
      font: 'Georgia',
    })],
    spacing: { after: 40 },
  });
}

function makeHeadlinePara(headline) {
  if (!headline) return null;
  return new Paragraph({
    children: [makeRun(headline, { color: '444444', size: 20, italic: true })],
    spacing: { after: 80 },
  });
}

function makeContactRow(items) {
  const children = [];
  items.forEach((item, i) => {
    if (i > 0) children.push(makeRun('  |  ', { color: 'BBBBBB', size: 18 }));
    children.push(makeRun(item, { color: '555555', size: 18 }));
  });
  return new Paragraph({ children, spacing: { after: 160 } });
}

function makeSectionTitle(title) {
  return new Paragraph({
    children: [new TextRun({
      text: normalizeText(title).toUpperCase(),
      bold: true,
      color: ACCENT,
      size: 22,
      font: 'Georgia',
    })],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT_MUTED },
    },
    spacing: { before: 200, after: 120 },
  });
}

function makeSummaryPara(text) {
  return new Paragraph({
    children: [makeRun(text, { color: '2a2a2a', size: 21 })],
    spacing: { after: 80 },
  });
}

// Competencies as a simple wrapped paragraph with bullet separators
function makeCompetenciesPara(items) {
  const children = [];
  items.forEach((item, i) => {
    if (i > 0) children.push(makeRun('  •  ', { color: '888888', size: 19 }));
    children.push(makeRun(item, { color: '333333', size: 19 }));
  });
  return new Paragraph({ children, spacing: { after: 120 } });
}

// Job header: 2-col borderless table — company (left) | period (right)
function makeJobHeader(company, period) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0 },
      bottom: { style: BorderStyle.NONE, size: 0 },
      left: { style: BorderStyle.NONE, size: 0 },
      right: { style: BorderStyle.NONE, size: 0 },
      insideH: { style: BorderStyle.NONE, size: 0 },
      insideV: { style: BorderStyle.NONE, size: 0 },
    },
    rows: [new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [makeRun(company, { bold: true, color: ACCENT, size: 22, font: 'Georgia' })],
          })],
          width: { size: 70, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
        }),
        new TableCell({
          children: [new Paragraph({
            children: [makeRun(period, { color: '666666', size: 18 })],
            alignment: AlignmentType.RIGHT,
          })],
          width: { size: 30, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
        }),
      ],
    })],
  });
}

function makeRolePara(role, location) {
  const text = location ? `${role}  ·  ${location}` : role;
  return new Paragraph({
    children: [makeRun(text, { bold: true, italic: true, color: '444444', size: 20 })],
    spacing: { after: 40 },
  });
}

function makeBullet(text) {
  return new Paragraph({
    children: [makeRun(text, { size: 19, color: '2a2a2a' })],
    bullet: { level: 0 },
    spacing: { after: 40 },
  });
}

function makeEduRow(degree, org, year) {
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 },
        insideH: { style: BorderStyle.NONE, size: 0 }, insideV: { style: BorderStyle.NONE, size: 0 },
      },
      rows: [new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [
                makeRun(degree, { bold: true, color: ACCENT, size: 22, font: 'Georgia' }),
                org ? makeRun(` — ${org}`, { color: '444444', size: 20 }) : new TextRun(''),
              ],
            })],
            width: { size: 75, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
          }),
          new TableCell({
            children: [new Paragraph({
              children: [makeRun(year || '', { color: '666666', size: 18 })],
              alignment: AlignmentType.RIGHT,
            })],
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
          }),
        ],
      })],
    }),
    makeEmptyPara(60),
  ];
}

// ─── Parse CV HTML structure ──────────────────────────────────────────────────

const sections = [];

// Header
const nameEl = root.querySelector('h1');
const headlineEl = root.querySelector('.header-headline');
const contactItems = root.querySelectorAll('.contact-item').map(el => getText(el)).filter(Boolean);

// All .section blocks
const sectionEls = root.querySelectorAll('.section');

for (const sec of sectionEls) {
  const titleEl = sec.querySelector('.section-title');
  if (!titleEl) continue;
  const title = getText(titleEl);

  const summaryEl = sec.querySelector('.summary-text');
  const compListEl = sec.querySelector('.competencies-list');
  const jobEls = sec.querySelectorAll('.job');
  const projectEls = sec.querySelectorAll('.project');
  const eduEls = sec.querySelectorAll('.edu-item');
  const certEls = sec.querySelectorAll('.cert-item');
  const skillsGrid = sec.querySelector('.skills-grid');

  if (summaryEl) {
    sections.push({ type: 'summary', title, text: getText(summaryEl) });
  } else if (compListEl) {
    const items = sec.querySelectorAll('.competency-item, .competency-tag').map(el => getText(el)).filter(Boolean);
    sections.push({ type: 'competencies', title, items });
  } else if (jobEls.length > 0) {
    const jobs = jobEls.map(job => {
      const company = getText(job.querySelector('.job-company'));
      const period = getText(job.querySelector('.job-period'));
      // Bug fix: .job-location is nested inside .job-role — getText(.job-role) returns
      // "Role · Location". Extract location first, then strip it from the role text.
      const locationEl = job.querySelector('.job-location');
      const location = locationEl ? getText(locationEl) : '';
      const roleEl = job.querySelector('.job-role');
      let role = roleEl ? getText(roleEl) : '';
      if (location && role.includes(location)) {
        role = role.replace(location, '').replace(/·\s*$/, '').trim();
      }
      const bullets = job.querySelectorAll('li').map(li => getText(li)).filter(Boolean);
      return { company, period, role, location, bullets };
    });
    sections.push({ type: 'experience', title, jobs });
  } else if (projectEls.length > 0) {
    const projects = projectEls.map(proj => ({
      title: getText(proj.querySelector('.project-title')),
      badge: getText(proj.querySelector('.project-badge')),
      desc: getText(proj.querySelector('.project-desc')),
      tech: getText(proj.querySelector('.project-tech')),
    }));
    sections.push({ type: 'projects', title, projects });
  } else if (eduEls.length > 0) {
    const entries = eduEls.map(edu => {
      // Bug fix: .edu-org is nested inside .edu-title — strip org from degree text
      const orgEl = edu.querySelector('.edu-org');
      const org = orgEl ? getText(orgEl) : '';
      const titleDegEl = edu.querySelector('.edu-title');
      let degree = titleDegEl ? getText(titleDegEl) : '';
      if (org && degree.includes(org)) {
        degree = degree.replace(org, '').replace(/—\s*$/, '').trim();
      }
      const year = getText(edu.querySelector('.edu-year'));
      const desc = getText(edu.querySelector('.edu-desc'));
      return { degree, org, year, desc };
    });
    sections.push({ type: 'education', title, entries });
  } else if (certEls.length > 0) {
    const items = certEls.map(cert => {
      const t = getText(cert.querySelector('.cert-title'));
      const y = getText(cert.querySelector('.cert-year'));
      return y ? `${t} (${y})` : t;
    }).filter(Boolean);
    sections.push({ type: 'list', title, items });
  } else if (skillsGrid) {
    // Bug fix: querySelectorAll('span') matches ALL nested spans — for a skill row like
    // <span><span class="skill-category">Tools:</span> <span class="skill-item">A, B</span></span>
    // it would return 3 spans. Use childNodes to get only direct children of the grid.
    const directChildren = skillsGrid.childNodes.filter(n => n.nodeType === 1);
    const skillItems = directChildren.map(el => getText(el)).filter(t => t && t.length > 2);
    sections.push({ type: 'skills', title, items: skillItems });
  } else {
    // Generic: grab all <li> items or text
    const liItems = sec.querySelectorAll('li').map(li => getText(li)).filter(Boolean);
    const bodyText = liItems.length > 0 ? null : getText(sec).replace(getText(titleEl), '').trim();
    sections.push({ type: liItems.length > 0 ? 'list' : 'text', title, items: liItems, text: bodyText });
  }
}

// ─── Build document children ──────────────────────────────────────────────────

const children = [];

// Header block
if (nameEl) children.push(makeNamePara(getText(nameEl)));
if (headlineEl && getText(headlineEl)) children.push(makeHeadlinePara(getText(headlineEl)));
if (contactItems.length > 0) children.push(makeContactRow(contactItems));

// Sections
for (const sec of sections) {
  children.push(makeSectionTitle(sec.title));

  switch (sec.type) {
    case 'summary':
      if (sec.text) children.push(makeSummaryPara(sec.text));
      break;

    case 'competencies':
      if (sec.items?.length > 0) children.push(makeCompetenciesPara(sec.items));
      break;

    case 'experience':
      for (const job of sec.jobs) {
        if (job.company) children.push(makeJobHeader(job.company, job.period || ''));
        if (job.role) children.push(makeRolePara(job.role, job.location));
        for (const bullet of job.bullets) children.push(makeBullet(bullet));
        children.push(makeEmptyPara(80));
      }
      break;

    case 'projects':
      for (const proj of (sec.projects || [])) {
        if (proj.title) {
          children.push(new Paragraph({
            children: [
              makeRun(proj.title, { bold: true, color: ACCENT, size: 21, font: 'Georgia' }),
              proj.badge ? makeRun(`  [${proj.badge}]`, { color: '666666', size: 18, italic: true }) : new TextRun(''),
            ],
            spacing: { before: 100, after: 40 },
          }));
        }
        if (proj.desc) children.push(new Paragraph({ children: [makeRun(proj.desc, { size: 19, color: '2a2a2a' })], spacing: { after: 40 } }));
        if (proj.tech) children.push(new Paragraph({ children: [makeRun(proj.tech, { size: 17, italic: true, color: '666666' })], spacing: { after: 120 } }));
      }
      break;

    case 'education':
      for (const entry of sec.entries) {
        children.push(...makeEduRow(entry.degree, entry.org, entry.year));
        if (entry.desc) children.push(new Paragraph({ children: [makeRun(entry.desc, { size: 19, italic: true, color: '444444' })], spacing: { after: 60 } }));
      }
      break;

    case 'skills':
      for (const item of (sec.items || [])) {
        children.push(new Paragraph({ children: [makeRun(item, { size: 19, color: '333333' })], spacing: { after: 40 } }));
      }
      break;

    case 'list':
      for (const item of (sec.items || [])) children.push(makeBullet(item));
      break;

    case 'text':
      if (sec.text) children.push(new Paragraph({ children: [makeRun(sec.text, { size: 20, color: '333333' })], spacing: { after: 80 } }));
      break;
  }
}

// ─── Build and write document ─────────────────────────────────────────────────

mkdirSync(dirname(absOutput), { recursive: true });

const doc = new Document({
  sections: [{
    properties: {
      page: {
        margin: {
          top: marginTwips,
          right: marginTwips,
          bottom: marginTwips,
          left: marginTwips,
        },
      },
    },
    children,
  }],
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22 },
      },
    },
  },
});

const buf = await Packer.toBuffer(doc);
writeFileSync(absOutput, buf);

const fwdPath = absOutput.replace(/\\/g, '/');
const relPath = absOutput.startsWith(projectRoot)
  ? absOutput.slice(projectRoot.length + 1).replace(/\\/g, '/')
  : fwdPath;

const accentNote = `accent=${accentHex}, margins=${marginsStr}`;
console.log(`✅ DOCX written: ${absOutput}`);
console.log(`📂 Open: file:///${fwdPath}`);
console.log(`   Path: ${relPath}`);
console.log(`   ℹ️  Style tokens applied: ${accentNote}`);

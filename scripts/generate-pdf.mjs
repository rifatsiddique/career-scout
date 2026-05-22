#!/usr/bin/env node

/**
 * generate-pdf.mjs — HTML → PDF via Playwright
 *
 * Usage:
 *   node scripts/generate-pdf.mjs <input.html> <output.pdf> [--format=letter|a4]
 *
 * Requires: @playwright/test (or playwright) installed.
 * Uses Chromium headless to render the HTML and produce a clean, ATS-parseable PDF.
 *
 * Notes for career-scout:
 *   - Page margins are controlled by the --margins CSS variable in the template
 *     (default: 0.5in). This script reads that value and applies it as Playwright's
 *     PDF page-level margin so it repeats on every page (single page or multi-page).
 *   - Font paths are resolved relative to career-scout/fonts/ (one level up from scripts/).
 *   - Output directory is career-scout/output/ (one level up from scripts/).
 *   - Page count is printed to stdout so the caller can check for overflow.
 */

import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { readFile } from 'fs/promises';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Project root is one level up from scripts/
const projectRoot = resolve(__dirname, '..');

// Ensure output directory exists
mkdirSync(resolve(projectRoot, 'output'), { recursive: true });

/**
 * Normalize text for ATS compatibility by converting problematic Unicode.
 *
 * ATS parsers and legacy systems often fail on em-dashes, smart quotes,
 * zero-width characters, and non-breaking spaces. Only touches body text —
 * preserves CSS, JS, tag attributes, and URLs.
 */
function normalizeTextForATS(html) {
  const replacements = {};
  const bump = (key, n) => { replacements[key] = (replacements[key] || 0) + n; };

  const masks = [];
  const masked = html.replace(
    /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (match) => {
      const token = `\u0000MASK${masks.length}\u0000`;
      masks.push(match);
      return token;
    }
  );

  let out = '';
  let i = 0;
  while (i < masked.length) {
    const lt = masked.indexOf('<', i);
    if (lt === -1) { out += sanitizeText(masked.slice(i)); break; }
    out += sanitizeText(masked.slice(i, lt));
    const gt = masked.indexOf('>', lt);
    if (gt === -1) { out += masked.slice(lt); break; }
    out += masked.slice(lt, gt + 1);
    i = gt + 1;
  }

  const restored = out.replace(/\u0000MASK(\d+)\u0000/g, (_, n) => masks[Number(n)]);
  return { html: restored, replacements };

  function sanitizeText(text) {
    if (!text) return text;
    let t = text;
    t = t.replace(/\u2014/g, () => { bump('em-dash', 1); return '-'; });
    t = t.replace(/\u2013/g, () => { bump('en-dash', 1); return '-'; });
    t = t.replace(/[\u201C\u201D\u201E\u201F]/g, () => { bump('smart-double-quote', 1); return '"'; });
    t = t.replace(/[\u2018\u2019\u201A\u201B]/g, () => { bump('smart-single-quote', 1); return "'"; });
    t = t.replace(/\u2026/g, () => { bump('ellipsis', 1); return '...'; });
    t = t.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, () => { bump('zero-width', 1); return ''; });
    t = t.replace(/\u00A0/g, () => { bump('nbsp', 1); return ' '; });
    return t;
  }
}

async function generatePDF() {
  const args = process.argv.slice(2);

  let inputPath, outputPath, format = 'letter';

  for (const arg of args) {
    if (arg.startsWith('--format=')) {
      format = arg.split('=')[1].toLowerCase();
    } else if (!inputPath) {
      inputPath = arg;
    } else if (!outputPath) {
      outputPath = arg;
    }
  }

  if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/generate-pdf.mjs <input.html> <output.pdf> [--format=letter|a4]');
    process.exit(1);
  }

  inputPath = resolve(inputPath);
  outputPath = resolve(outputPath);

  const validFormats = ['a4', 'letter'];
  if (!validFormats.includes(format)) {
    console.error(`Invalid format "${format}". Use: ${validFormats.join(', ')}`);
    process.exit(1);
  }

  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Format: ${format.toUpperCase()}`);

  let html = await readFile(inputPath, 'utf-8');

  // Extract --margins CSS variable from the template :root block so it can be
  // applied as Playwright's page-level margin. Page-level margins repeat on
  // every page break, whereas the box padding on .page would only apply once
  // at the top and once at the bottom of the whole div (page 2+ would have
  // zero top margin).
  const marginsMatch = html.match(/--margins:\s*([^;\s]+)\s*;/);
  const cssMargins = marginsMatch ? marginsMatch[1].trim() : '0.5in';
  console.log(`Margins: ${cssMargins} (from --margins CSS variable)`);

  // Resolve font paths relative to career-scout/fonts/
  // Templates reference fonts as ./fonts/ — resolve to absolute file:// URLs
  const fontsDir = resolve(projectRoot, 'fonts');
  html = html.replace(
    /url\(['"]?\.\/fonts\//g,
    `url('file://${fontsDir}/`
  );
  html = html.replace(
    /file:\/\/([^'")]+)\.(woff2?|ttf|otf)['"]?\)/g,
    `file://$1.$2')`
  );

  // Normalize text for ATS compatibility
  const normalized = normalizeTextForATS(html);
  html = normalized.html;
  const totalReplacements = Object.values(normalized.replacements).reduce((a, b) => a + b, 0);
  if (totalReplacements > 0) {
    const breakdown = Object.entries(normalized.replacements).map(([k, v]) => `${k}=${v}`).join(', ');
    console.log(`ATS normalization: ${totalReplacements} replacements (${breakdown})`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'networkidle',
      baseURL: `file://${dirname(inputPath)}/`,
    });

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // Page-level margins come from --margins (extracted above). Applied via
    // Playwright so they repeat on every page in multi-page output. The .page
    // div in the template sets padding: 0 so margins are not doubled.
    const pdfBuffer = await page.pdf({
      format: format,
      printBackground: true,
      margin: {
        top: cssMargins,
        right: cssMargins,
        bottom: cssMargins,
        left: cssMargins,
      },
      preferCSSPageSize: false,
    });

    const { writeFile } = await import('fs/promises');
    await writeFile(outputPath, pdfBuffer);

    // Count pages (approximate from PDF structure)
    const pdfString = pdfBuffer.toString('latin1');
    const pageCount = (pdfString.match(/\/Type\s*\/Page[^s]/g) || []).length;

    console.log(`PDF generated: ${outputPath}`);
    console.log(`Pages: ${pageCount}`);
    console.log(`Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

    // Exit code encodes page count for overflow detection by the calling agent
    // 0 = success (≤2 pages), 2 = overflow (>2 pages), 1 = error
    if (pageCount > 2) {
      console.warn(`OVERFLOW: ${pageCount} pages (target: 2)`);
      process.exit(2);
    }

    return { outputPath, pageCount, size: pdfBuffer.length };
  } finally {
    await browser.close();
  }
}

generatePDF().catch((err) => {
  console.error('PDF generation failed:', err.message);
  process.exit(1);
});

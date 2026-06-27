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
import { mkdirSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { normalizeTextForATS } from './lib/normalize-text.mjs';
import { resolveConditionals, findLeaks } from './lib/cv-template.mjs';
import { parseProfile, extractContactFromHtml, auditContact } from './lib/contact-audit.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Project root is one level up from scripts/
const projectRoot = resolve(__dirname, '..');

// Ensure output directory exists
mkdirSync(resolve(projectRoot, 'output'), { recursive: true });

async function generatePDF() {
  const args = process.argv.slice(2);

  let inputPath, outputPath, format = 'letter', maxPages = 2;
  let profileOverride = null, strictContact = false;

  for (const arg of args) {
    if (arg.startsWith('--format=')) {
      format = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--max-pages=')) {
      maxPages = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--profile=')) {
      profileOverride = arg.split('=')[1];
    } else if (arg === '--strict-contact') {
      strictContact = true;
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

  // ── Template-resolution backstop (unbypassable; runs on EVERY render path) ──
  // Resolve {{#if}} conditionals in memory (idempotent — safe even if
  // resolve-template.mjs already cleaned the draft), then block on any residual
  // template token. This makes a leaked CV impossible to produce regardless of
  // which agent ran or whether the optional pre-step was executed.
  {
    const r = resolveConditionals(html);
    html = r.html;
    if (r.removed.length || r.kept.length) {
      console.log(`Template: kept [${r.kept.join(', ') || '—'}], removed [${r.removed.join(', ') || '—'}]`);
    }
    const leaks = findLeaks(html);
    if (leaks.tokens.length > 0) {
      console.error('\n❌ LEAK: unresolved template tokens — PDF not written.');
      leaks.tokens.forEach((t, i) => console.error(`   line ${leaks.lines[i]}: ${t}`));
      if (leaks.hasMalformedControl) {
        console.error('   A stray {{#if}}/{{/if}} suggests a missing closing tag or nested conditional.');
      }
      process.exit(3);
    }
  }

  // ── Contact-integrity gate (auto-locate config/profile.yml) ──
  // Blocks on leaked-placeholder / fabricated contact values (exit 4); warns on
  // fields populated in profile.yml but absent from the CV (promote to block with
  // --strict-contact). Skipped only if no profile.yml is found.
  {
    const profilePath = profileOverride
      ? resolve(profileOverride)
      : resolve(projectRoot, 'config', 'profile.yml');
    if (existsSync(profilePath)) {
      const profileFields = parseProfile(profilePath);
      const { failures, omissions } = auditContact(extractContactFromHtml(html), profileFields);
      if (failures.length > 0) {
        console.error('\n❌ CONTACT AUDIT FAILED — PDF not written.');
        for (const f of failures) console.error(`   "${f.value}" — ${f.reason}`);
        console.error('   Fix config/profile.yml or the draft and regenerate.');
        process.exit(4);
      }
      if (omissions.length > 0) {
        console.warn('\n⚠️  Contact fields in profile.yml but NOT shown in the CV (verify intentional):');
        for (const o of omissions) console.warn(`   ${o.field}: "${o.value}"`);
        if (strictContact) {
          console.error('   --strict-contact set → treating omission as failure. PDF not written.');
          process.exit(4);
        }
      }
    } else {
      console.log(`Contact audit skipped — no profile.yml at ${profilePath}`);
    }
  }

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

  // One-shot retry on transient launch failures (resource lock / socket conflict
  // when multiple batch workers launch Chromium within milliseconds of each other).
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (launchErr) {
    await new Promise(r => setTimeout(r, 1500));
    browser = await chromium.launch({ headless: true }); // throws on genuine failure
  }
  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'networkidle',
      baseURL: `file://${dirname(inputPath)}/`,
    });

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // ── Fill-ratio probe (for the underflow loop in modes/cv.md) ──
    // Lay out at the actual printable box (paper minus margins) under print media,
    // so scrollHeight reflects the PDF layout rather than the default viewport.
    const marginIn = parseFloat(cssMargins) || 0.5;
    const paper = format === 'a4' ? { w: 8.27, h: 11.69 } : { w: 8.5, h: 11 };
    const printableWpx = Math.round((paper.w - 2 * marginIn) * 96);
    const printableHpx = Math.round((paper.h - 2 * marginIn) * 96);
    let fillRatio = null, pagesEst = null;
    try {
      await page.emulateMedia({ media: 'print' });
      // Width drives text wrapping; keep height small so scrollHeight reflects TRUE
      // content height rather than being floored up to a tall viewport.
      await page.setViewportSize({ width: printableWpx, height: 100 });
      const contentH = await page.evaluate(() =>
        Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
      pagesEst = Math.max(1, Math.ceil(contentH / printableHpx));
      const lastPageContent = contentH - (pagesEst - 1) * printableHpx;
      fillRatio = Math.min(1, lastPageContent / printableHpx);
    } catch {
      /* measurement is best-effort — never block PDF generation on it */
    }

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
    if (fillRatio !== null) {
      // Last-page fullness (0–1). modes/cv.md triggers the underflow expansion loop
      // when target is 2 pages and FILL_RATIO is low on a 1-page render.
      console.log(`FILL_RATIO: ${fillRatio.toFixed(2)} (last of ~${pagesEst} page(s))`);
    }

    // Canonical URI for clickable terminal links (relayed by the calling mode verbatim)
    const absURI = outputPath.replace(/\\/g, '/');
    const relPath = outputPath.startsWith(projectRoot)
      ? outputPath.slice(projectRoot.length + 1).replace(/\\/g, '/')
      : absURI;
    console.log(`✅ PDF written: ${outputPath}`);
    console.log(`📂 Open: file:///${absURI}`);
    console.log(`   Path: ${relPath}`);

    // Exit code encodes page count for overflow detection by the calling agent
    // 0 = success (≤maxPages), 2 = overflow (>maxPages), 1 = error
    // --max-pages defaults to 2; academic-research template passes --max-pages=4
    if (pageCount > maxPages) {
      console.warn(`OVERFLOW: ${pageCount} pages (target: ${maxPages})`);
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

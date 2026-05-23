#!/usr/bin/env node
/**
 * md-to-html.mjs
 *
 * Converts a Markdown file to a styled HTML viewer using templates/docs/viewer.html.
 * Writes the HTML file alongside the source .md file (same directory, .html extension).
 *
 * Usage:
 *   node scripts/md-to-html.mjs <path-to-file.md>
 *
 * Output:
 *   <path-to-file>.html  (alongside the source .md)
 *
 * Exit codes:
 *   0  success
 *   1  missing argument or file not found
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const mdPath = process.argv[2];
if (!mdPath) {
  console.error('Usage: node scripts/md-to-html.mjs <file.md>');
  process.exit(1);
}

const absPath = resolve(mdPath);
if (!existsSync(absPath)) {
  console.error(`File not found: ${absPath}`);
  process.exit(1);
}

const mdContent = readFileSync(absPath, 'utf8');

// Derive title from first H1 heading, or fall back to filename
const titleMatch = mdContent.match(/^#\s+(.+)$/m);
const title = titleMatch ? titleMatch[1].trim() : basename(absPath, '.md');

// Render markdown to HTML (marked v9+ async by default; use synchronous parse)
const htmlContent = marked.parse(mdContent);

// Load viewer template
const templatePath = join(projectRoot, 'templates', 'docs', 'viewer.html');
if (!existsSync(templatePath)) {
  console.error(`Viewer template not found: ${templatePath}`);
  process.exit(1);
}
const template = readFileSync(templatePath, 'utf8');

// Relative source path for display (strip project root prefix)
const relSource = absPath.startsWith(projectRoot)
  ? absPath.slice(projectRoot.length + 1).replace(/\\/g, '/')
  : basename(absPath);

const now = new Date();
const generatedDate = now.toLocaleDateString('en-GB', {
  year: 'numeric', month: 'short', day: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

const output = template
  .replace(/\{\{TITLE\}\}/g, escapeHtml(title))
  .replace(/\{\{SOURCE_MD\}\}/g, escapeHtml(relSource))
  .replace(/\{\{GENERATED_DATE\}\}/g, escapeHtml(generatedDate))
  .replace('{{CONTENT}}', htmlContent);

const outPath = absPath.replace(/\.md$/, '.html');
writeFileSync(outPath, output, 'utf8');

console.log(`✅ HTML written: ${outPath}`);
console.log(`📂 Open: file:///${outPath.replace(/\\/g, '/')}`);

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

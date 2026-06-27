/**
 * cv-template.mjs — deterministic CV template resolution + leak detection
 *
 * The CV templates (templates/cv/*.html) use Handlebars-LOOKING tokens:
 *   {{PLACEHOLDER}}                 — a value the drafter fills
 *   {{#if NAME}} ... {{/if}}        — an optional section/element
 *
 * Nothing else in the pipeline processes these — historically the LLM was asked
 * to strip the conditionals by hand, which leaked literal {{#if ...}} / {{...}}
 * tokens into shipped PDFs. This module moves that mechanical work into code so
 * it is deterministic and unbypassable.
 *
 * Contract for the drafter (see modes/cv.md):
 *   - Fill each {{PLACEHOLDER}} with a real value.
 *   - For an OPTIONAL field with no data, LEAVE the {{PLACEHOLDER}} token in place
 *     (do NOT blank it or delete the element). resolveConditionals() removes the
 *     surrounding {{#if}} block when its inner content is still unfilled.
 *   - Never hand-delete a conditional block or element.
 *
 * Placeholder grammar is strict-uppercase: {{[A-Z0-9_]+}}. Arbitrary text like
 * `{{ a: 1 }}` in a code snippet is NOT treated as a placeholder. To emit a
 * literal placeholder-shaped token, escape as \{{TOKEN}} or space the braces.
 */

// A filled-in placeholder leaves no braces; an unfilled one still matches this.
const PLACEHOLDER_RE = /\{\{[A-Z0-9_]+\}\}/;
const PLACEHOLDER_RE_G = /\{\{[A-Z0-9_]+\}\}/g;

// Liberal control-tag matcher — catches well-formed AND malformed/typo'd variants
// ({{#if X}}, {{/if}}, {{ /if PROJECTS }}, {{#if}}) so a stray control tag can
// never slip past findLeaks even though it does not match PLACEHOLDER_RE.
const CONTROL_RE_G = /\{\{\s*[#/]if\b[^}]*\}\}/g;

// {{#if NAME}} ... {{/if}} — the negative lookahead (?!\{\{#if) prevents the
// inner from spanning a SECOND {{#if, so a missing/typo'd {{/if}} makes the
// regex fail to match (block left intact for findLeaks) instead of greedily
// swallowing adjacent sections and silently deleting filled content.
const IF_BLOCK_RE = /\{\{#if\s+([A-Z0-9_]+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g;

// Required placeholders — must always be filled, never wrapped in {{#if}}.
export const REQUIRED_PLACEHOLDERS = ['NAME', 'EMAIL'];

/**
 * Resolve every {{#if NAME}}...{{/if}} block.
 *   - inner still contains an unfilled {{PLACEHOLDER}}  → condition false → remove block
 *   - inner fully filled (no placeholder tokens left)   → strip the fence, keep inner
 *
 * Idempotent: a second pass is a no-op (no well-formed {{#if}} blocks remain).
 *
 * @param {string} html
 * @returns {{ html: string, removed: string[], kept: string[] }}
 */
export function resolveConditionals(html) {
  const removed = [];
  const kept = [];

  const out = html.replace(IF_BLOCK_RE, (_match, name, inner) => {
    if (PLACEHOLDER_RE.test(inner)) {
      // Unfilled (or no data) → drop the whole optional region.
      removed.push(name);
      return '';
    }
    // Filled → keep the content, discard only the {{#if}}/{{/if}} fence.
    kept.push(name);
    return inner;
  });

  return { html: out, removed, kept };
}

/**
 * Find residual template tokens after resolution. Catches both unfilled
 * placeholders ({{NAME}}) and stray/malformed control tags ({{#if X}}, {{/if}},
 * {{/if PROJECTS}}) — the latter usually signal a missing closing tag or an
 * unsupported nested conditional.
 *
 * @param {string} html
 * @returns {{ tokens: string[], lines: number[], hasMalformedControl: boolean }}
 */
export function findLeaks(html) {
  const hits = [];
  collect(html, PLACEHOLDER_RE_G, hits, false);
  collect(html, CONTROL_RE_G, hits, true);

  hits.sort((a, b) => a.index - b.index);

  const tokens = [];
  const lines = [];
  const seen = new Set();
  let hasMalformedControl = false;
  for (const h of hits) {
    if (h.isControl) hasMalformedControl = true;
    const key = `${h.token}@${h.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push(h.token);
    lines.push(lineOf(html, h.index));
  }
  return { tokens, lines, hasMalformedControl };
}

/**
 * Lint a template for the invariants the resolver relies on:
 *   1. Every {{#if}} block contains >=1 dynamic placeholder (otherwise a purely
 *      static optional block can never be auto-removed — §8.1 edge case).
 *   2. Required placeholders are never wrapped in a {{#if}} block.
 *
 * @param {string} html
 * @param {string[]} [required]
 * @returns {string[]} list of human-readable issues (empty = clean)
 */
export function lintTemplate(html, required = REQUIRED_PLACEHOLDERS) {
  const issues = [];

  let m;
  const blockRe = new RegExp(IF_BLOCK_RE.source, 'g');
  while ((m = blockRe.exec(html)) !== null) {
    const [, name, inner] = m;
    if (!PLACEHOLDER_RE.test(inner)) {
      issues.push(
        `{{#if ${name}}} block contains no {{PLACEHOLDER}} — it can never be ` +
        `auto-removed when empty. Add a dynamic placeholder or remove the conditional.`
      );
    }
    for (const req of required) {
      if (new RegExp(`\\{\\{${req}\\}\\}`).test(inner)) {
        issues.push(
          `Required placeholder {{${req}}} is wrapped in {{#if ${name}}} — ` +
          `required fields must never be conditional.`
        );
      }
    }
  }
  return issues;
}

function collect(html, re, hits, isControl) {
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m;
  while ((m = r.exec(html)) !== null) {
    hits.push({ token: m[0], index: m.index, isControl });
    if (m.index === r.lastIndex) r.lastIndex++; // guard against zero-width
  }
}

function lineOf(html, index) {
  let line = 1;
  for (let i = 0; i < index && i < html.length; i++) {
    if (html[i] === '\n') line++;
  }
  return line;
}

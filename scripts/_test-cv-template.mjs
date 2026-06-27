/**
 * _test-cv-template.mjs — unit tests for lib/cv-template.mjs
 * Run: node scripts/_test-cv-template.mjs
 */
import assert from 'node:assert/strict';
import { resolveConditionals, findLeaks, lintTemplate } from './lib/cv-template.mjs';

let pass = 0;
const test = (name, fn) => { fn(); console.log(`  ✅ ${name}`); pass++; };

// ── The exact Renesas failure: filled PROJECTS + empty CERTIFICATIONS + mixed contact ──
const renesas = `
<div class="contact-row">
  <span class="contact-item">rifatalam99@gmail.com</span>
  {{#if PHONE}}<span class="contact-item">978-727-3390</span>{{/if}}
  {{#if LOCATION}}<span class="contact-item">{{LOCATION}}</span>{{/if}}
  {{#if WORK_AUTH}}<span class="contact-item">Authorized to work in the US</span>{{/if}}
</div>
{{#if PROJECTS}}
<div class="section"><div class="section-title">Key Projects</div>
  <div class="project-card">20kW DCX LLC Resonant Converter</div>
</div>
{{/if}}
{{#if CERTIFICATIONS}}
<div class="section"><div class="section-title">{{SECTION_CERTIFICATIONS}}</div>{{CERTIFICATIONS}}</div>
{{/if}}
`;

test('Renesas fixture resolves correctly', () => {
  const { html, removed, kept } = resolveConditionals(renesas);
  // PHONE + WORK_AUTH filled → kept; LOCATION + CERTIFICATIONS unfilled → removed.
  assert.deepEqual(kept.sort(), ['PHONE', 'PROJECTS', 'WORK_AUTH']);
  assert.deepEqual(removed.sort(), ['CERTIFICATIONS', 'LOCATION']);
  assert.ok(html.includes('978-727-3390'), 'filled phone kept');
  assert.ok(html.includes('Authorized to work in the US'), 'filled work-auth kept');
  assert.ok(html.includes('20kW DCX LLC Resonant Converter'), 'filled project content kept');
  assert.ok(!html.includes('{{#if'), 'no {{#if fences remain');
  assert.ok(!html.includes('{{/if}}'), 'no {{/if}} fences remain');
  assert.ok(!html.includes('SECTION_CERTIFICATIONS'), 'empty cert section gone');
  assert.ok(!html.includes('{{LOCATION}}'), 'unfilled location block gone');
  // No residual tokens after resolution.
  assert.equal(findLeaks(html).tokens.length, 0);
});

test('idempotent — resolve twice == resolve once', () => {
  const once = resolveConditionals(renesas).html;
  const twice = resolveConditionals(once).html;
  assert.equal(once, twice);
});

test('missing {{/if}} does NOT mass-delete adjacent sections', () => {
  // PROJECTS block is missing its {{/if}}. The negative-lookahead parser must
  // NOT swallow up to CERTIFICATIONS' {{/if}} and delete both.
  const broken = `{{#if PROJECTS}}<div>KEEP ME 20kW</div>
{{#if CERTIFICATIONS}}<div>CertContent</div>{{/if}}`;
  const { html, removed, kept } = resolveConditionals(broken);
  assert.ok(html.includes('KEEP ME 20kW'), 'filled project content NOT destroyed');
  assert.equal(kept.includes('CERTIFICATIONS'), true, 'well-formed cert block still resolved');
  assert.equal(removed.includes('PROJECTS'), false, 'malformed block not silently removed');
  // The stray {{#if PROJECTS}} survives and is caught as a leak.
  const leaks = findLeaks(html);
  assert.ok(leaks.hasMalformedControl, 'stray control tag flagged');
  assert.ok(leaks.tokens.some(t => t.includes('#if PROJECTS')), 'reports the orphan tag');
});

test('findLeaks catches unfilled placeholder', () => {
  const leaks = findLeaks('<h1>{{NAME}}</h1><p>ok</p>');
  assert.deepEqual(leaks.tokens, ['{{NAME}}']);
  assert.equal(leaks.lines[0], 1);
});

test('findLeaks catches stray/typo control tags', () => {
  assert.ok(findLeaks('a {{/if}} b').hasMalformedControl);
  assert.ok(findLeaks('a {{/if PROJECTS}} b').hasMalformedControl);
  assert.ok(findLeaks('a {{#if X}} b').hasMalformedControl);
});

test('findLeaks ignores arbitrary {{ ... }} code/text (no false positive)', () => {
  const code = '<li>config: {{ a: 1, b: 2 }} and struct { int x; }</li>';
  const leaks = findLeaks(code);
  assert.equal(leaks.tokens.length, 0, 'lowercase/spaced braces are not placeholders');
});

test('lintTemplate flags static conditional + wrapped required field', () => {
  const bad = `{{#if FOO}}<div>static only</div>{{/if}}
{{#if NAME}}<span>{{NAME}}</span>{{/if}}`;
  const issues = lintTemplate(bad);
  assert.ok(issues.some(i => i.includes('FOO')), 'static conditional flagged');
  assert.ok(issues.some(i => i.includes('NAME')), 'required-wrapped flagged');
});

test('lintTemplate passes a well-formed block', () => {
  const good = `{{#if PHONE}}<span>{{PHONE}}</span>{{/if}}`;
  assert.deepEqual(lintTemplate(good), []);
});

console.log(`\n${pass} tests passed.`);

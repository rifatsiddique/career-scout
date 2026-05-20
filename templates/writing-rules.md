# Writing Rules — Anti-Slop Guardrails for CV Generation

These rules prevent AI-generated CVs from sounding like AI. The drafter applies them
during generation. The reviewer checks compliance and flags violations.

Adapted from open-source anti-slop research. Tailored for CV/resume content.

---

## 1. The Core Principle: Specificity Over Polish

A good CV bullet could only have been written by ONE person. If you replace the company
name with a blank and the bullet still sounds plausible for anyone, it's a **zombie bullet**
and must be rewritten.

**Zombie bullet (bad):** "Collaborated with cross-functional teams to deliver high-impact results"
**Specific (good):** "Designed the 48V-to-12V LLC converter stage for the EV charging module, reducing board area by 35%"

Test every bullet: *Could a technical interviewer ask you to explain the methodology behind this?*
If not, it's too vague.

---

## 2. Stats Are Welcome — Make Them Yours

Engineering and technical resumes NEED numbers. Stats are NOT the problem — vague stats are.

**Vague (bad):** "Improved system performance by 30%"
**Specific (good):** "Reduced switching losses from 12W to 3.8W at 500kHz by redesigning the gate driver topology"

**The rule:** Stats must be specific enough that a technical interviewer could ask you
to explain how you measured them. If you can't defend the number in an interview,
don't put it on the CV.

Include units, conditions, comparisons, or methodology when relevant:
- Efficiency: "98.2% peak efficiency at 3.3kW" not "high efficiency"
- Scale: "740+ evaluations across 50 companies" not "large-scale analysis"
- Impact: "Cut boot time from 4.2s to 0.8s by replacing DMA polling with interrupt-driven transfers" not "improved boot time"

---

## 3. Banned Words (53)

These words appear at 2-5x human frequency in AI-generated text. Recruiters and AI
detectors flag them. Never use in CV bullets, summaries, or competency descriptions.

```
delve, tapestry, realm, landscape, embark, multifaceted, nuanced, pivotal,
underscore, meticulous, vibrant, whimsical, gossamer, labyrinth, indelible,
leverage, synergies, facilitate, utilize, optimize, robust, comprehensive,
seamless, cutting-edge, revolutionary, transformative, illuminate, elucidate,
commence, endeavor, intersection, incredibly, passionate, excited, thrilled,
spearheaded, testament, nestled, moreover, furthermore, additionally,
subsequently, nonetheless, bolster, cornerstone, fostering, harnessing,
intricate, paradigm, unprecedented, elevate, poised, reshape
```

**Replacements:** Use the plain verb or remove the word entirely.
- "leveraged Python to build" → "built with Python"
- "spearheaded the migration" → "led the migration" or just "migrated"
- "utilized advanced techniques" → "used" or name the actual technique
- "optimized system performance" → name what you actually did: "reduced latency from 200ms to 40ms"

---

## 4. Banned Phrases (CV-specific subset)

These phrases are AI boilerplate. They add no information and waste space.

```
aligns perfectly with               resulted in significant improvements
well-positioned to                   I bring a unique blend of
unique combination of skills         cross-functional collaboration
delivered high-impact results        collaborated with stakeholders
drove strategic initiatives          thought leader in
leveraged cutting-edge               proven track record of
passionate about delivering          excited to contribute
at the intersection of               end-to-end ownership of
played a pivotal role in             in today's fast-paced environment
```

**The fix:** Delete the phrase entirely and state what you actually did.
- "Drove strategic initiatives across teams" → "Migrated the billing pipeline from Stripe v2 to v3"
- "Proven track record of delivering results" → delete entirely, your bullets ARE the track record

---

## 5. AI Structural Tells (What Detectors Catch)

These patterns pass a casual read but trigger AI detectors and trained recruiters:

### 5a. Uniform bullet length
If every bullet is 15-22 words, that's AI rhythm. Vary aggressively:
one bullet might be 8 words, the next 25, the next 12.

### 5b. Em dash abuse
AI uses em dashes (—) at 2-5x human rate. **Maximum 1 em dash per CV.** Use commas instead.

### 5c. Rule of three
AI defaults to triplets: "designed, implemented, and deployed." Vary list lengths:
sometimes two items, sometimes four, sometimes one.

### 5d. Present participial openers
"Leveraging advanced analytics..." / "Harnessing cloud infrastructure..." — AI uses
these at 2-5x human rate. Start bullets with past tense verbs instead.

### 5e. Tidy summary closers
If the professional summary ends with a neat bow-tying sentence ("...bringing this
expertise to drive results at [Company]"), delete it. Summaries should just stop
when the content is done. No closers.

### 5f. Synonym cycling
If adjacent bullets rephrase the same concept with different words ("streamlined" →
"enhanced" → "refined"), the reviewer should flag it. Pick one verb and move on.

### 5g. Hyphenated compound overuse
"data-driven", "cross-functional", "results-oriented", "high-impact" — maximum one
per section. These are resume cliches even without AI.

---

## 6. The Substitution Test (Reviewer Audit)

After the drafter fills in the template, the reviewer applies this test to each bullet:

1. **Replace the company name with ___** — does the bullet still make sense for anyone at any company? If yes → zombie bullet → rewrite with specific technical detail.

2. **The Interview Test** — could the candidate comfortably explain this bullet in a technical interview without backtracking? If the bullet claims "architected a distributed system" but the candidate's CV shows individual contributor roles, flag it.

3. **The AI Bingo Test** — count: banned words + em dashes + uniform lengths + rule-of-three patterns. If 3+ hits across the entire CV → rewrite pass needed.

---

## 7. What Good CV Writing Looks Like

These markers signal human authorship:

- **Varied bullet lengths** — 8 words, then 22, then 14, then 9
- **Technical specificity** — "LTspice", "500kHz", "DMA channel 3", not "advanced tools"
- **Past tense action verbs** — "designed", "built", "reduced", "migrated", "debugged"
- **One thought per bullet** — no "and" connecting two unrelated achievements
- **Opinions when appropriate** — summary can include perspective: "focused on X because Y"
- **Uneven section weights** — most recent role gets 5 bullets, oldest gets 2
- **No filler** — if a bullet doesn't strengthen the application, cut it

---

## Scope

These rules apply to:
- CV/resume bullet points
- Professional summaries
- Competency descriptions
- Project descriptions

These rules do NOT apply to:
- Section headers (those follow template conventions)
- Contact info, dates, company names
- Skills lists (those are keyword-dense by nature)
- Internal agent instructions or evaluation reports

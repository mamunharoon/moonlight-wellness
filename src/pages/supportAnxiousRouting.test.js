// Support.jsx — anxious-flow routing swap: B01 replaces E08 (2026-10-30,
// owner-approved). See reports/e08-b01-deep-breathing-duplication-review-
// 2026-10-30.md: the narration audit found E08 includes a counted
// breath-hold with no safety guidance, while B01 explicitly teaches
// breathing "without holding" and includes stop-if-uncomfortable
// guidance — a better fit for this specific flow. This is a routing
// change only, not a claim that either video treats anxiety or
// guarantees a health outcome.
//
// This repo's Vitest runs with environment: 'node' (vite.config.js) and
// has no @testing-library/DOM setup — no page can be rendered. Matching
// this codebase's own established precedent (see breathingPreStart.test.js's
// own header comment), this file reads Support.jsx as source text and
// checks its MOOD_RECOMMENDATIONS data structure directly, rather than
// rendering the component.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const supportSource = read('./Support.jsx');

const extractMoodBlock = (source, moodKey) => {
  // Matches `  <moodKey>: { ... }` up to the first top-level `  }` that
  // closes it — safe here because none of these mood objects nest braces
  // deeper than their own `options: [ ... ]` array, which this pattern's
  // lazy match still correctly spans (tested against the real file below).
  // Trailing comma is optional: 'low-energy' is the last property in
  // MOOD_RECOMMENDATIONS and has none.
  const re = new RegExp(`${moodKey}:\\s*\\{[\\s\\S]*?\\n  \\},?`);
  const match = source.match(re);
  if (!match) throw new Error(`Could not locate the '${moodKey}' mood block in Support.jsx`);
  return match[0];
};

const extractOptionIds = (moodBlock) => [...moodBlock.matchAll(/kind:\s*'video',\s*id:\s*'([A-Z0-9-]+)'/g)].map((m) => m[1]);

describe('Support.jsx — anxious mood options', () => {
  const anxiousBlock = extractMoodBlock(supportSource, 'anxious');

  it('options are exactly [E03, B01], in that order', () => {
    expect(extractOptionIds(anxiousBlock)).toEqual(['E03', 'B01']);
  });

  it('E03 is still options[0] (the default shown recommendation) — unchanged by this swap', () => {
    expect(extractOptionIds(anxiousBlock)[0]).toBe('E03');
  });

  it('E08 no longer appears anywhere in the anxious mood block', () => {
    expect(anxiousBlock).not.toContain('E08');
  });

  it('B01 appears exactly once in the anxious mood block', () => {
    const occurrences = (anxiousBlock.match(/'B01'/g) || []).length;
    expect(occurrences).toBe(1);
  });
});

describe('Support.jsx — other mood mappings are unchanged by the anxious-flow swap', () => {
  it('overwhelmed still offers E02 + the Grounding interactive option', () => {
    const block = extractMoodBlock(supportSource, 'overwhelmed');
    expect(extractOptionIds(block)).toEqual(['E02']);
    expect(block).toContain("route: '/grounding'");
  });

  it('stressed still offers exactly [E04, E09], in that order', () => {
    const block = extractMoodBlock(supportSource, 'stressed');
    expect(extractOptionIds(block)).toEqual(['E04', 'E09']);
  });

  it("calm still offers only the 60-Second Reset interactive option (no video option)", () => {
    const block = extractMoodBlock(supportSource, 'calm');
    expect(extractOptionIds(block)).toEqual([]);
    expect(block).toContain("route: '/quiet-breathing'");
  });

  it('confidence still offers exactly [E12]', () => {
    const block = extractMoodBlock(supportSource, 'confidence');
    expect(extractOptionIds(block)).toEqual(['E12']);
  });

  it("'low-energy' still offers exactly [E11]", () => {
    const block = extractMoodBlock(supportSource, "'low-energy'");
    expect(extractOptionIds(block)).toEqual(['E11']);
  });
});

describe('Support.jsx — E08 is fully removed from this file (not just the anxious block)', () => {
  it('the string E08 does not appear anywhere in Support.jsx outside of explanatory comments', () => {
    // The file's own header/inline comments are allowed to mention E08
    // historically (documenting what changed and why) — what must be
    // true is that no *code* (CARDS/MOOD_RECOMMENDATIONS) references it.
    // Strip single-line (//) and block (/* */) comments, then assert.
    const codeOnly = supportSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(codeOnly).not.toContain('E08');
  });
});

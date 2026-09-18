// Regression guard for the Intention screen horizontal-overflow fix. No
// DOM/component rendering is available in this repo's Vitest (see
// index.css.test.js's own note) - this locks in the actual fix at the
// source level: the custom-intention <input> sits in a flex row next to
// the "Add" button, and a flex item's default min-width is `auto` (its
// own content size), not 0 - without min-w-0 it refuses to shrink below
// that and pushes the row wider than the viewport on narrow phones
// (320-390px). min-w-0 is what lets it actually shrink to fit.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./IntentionSetup.jsx', import.meta.url)), 'utf-8');

describe('IntentionSetup custom-intention input overflow guard', () => {
  it('keeps min-w-0 on the flex-1 input so it can shrink to fit narrow viewports', () => {
    const inputMatch = source.match(/<input[\s\S]*?\/>/);
    expect(inputMatch).not.toBeNull();
    expect(inputMatch[0]).toMatch(/flex-1 min-w-0/);
  });
});

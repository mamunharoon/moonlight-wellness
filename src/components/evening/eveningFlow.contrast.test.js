// Regression guard for the Evening Wind-down colour-contrast fix. No DOM
// rendering is available in this repo's Vitest, so these lock in the
// source-level treatment described in docs/evening-flow-contrast-fix.md
// - a future edit that quietly reverts the scrim or reintroduces a
// fragile low-opacity text colour should fail one of these.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('Gradient.jsx legibility scrim', () => {
  it('stays strengthened (0.55-0.65), never reverts to the original too-faint 0.05-0.22', () => {
    const source = read('../stage3/Gradient.jsx');
    expect(source).toMatch(/rgba\(0,0,0,0\.55\), rgba\(0,0,0,0\.65\)/);
    expect(source).not.toMatch(/rgba\(0,0,0,0\.05\), rgba\(0,0,0,0\.22\)/);
  });
});

describe('ProgressIndicator evening-safe colour tokens', () => {
  const source = read('../ProgressIndicator.jsx');

  it('branches on the evening session to avoid the fragile low-opacity tokens', () => {
    expect(source).toMatch(/const isEvening = sessionId === EVENING_SESSION_ID;/);
  });

  it('keeps full-opacity tokens for evening inactive/separator/completed steps', () => {
    expect(source).toMatch(/isEvening \? 'text-on-surface-variant' : 'text-on-surface-variant\/40'/);
    expect(source).toMatch(/isEvening \? 'text-on-surface' : 'text-secondary'/);
    expect(source).toMatch(/isEvening \? 'text-on-surface-variant' : 'text-on-surface-variant\/30'/);
    expect(source).toMatch(/isEvening \? 'text-on-surface-variant\/70 mx-0\.5' : 'text-on-surface-variant\/20 mx-0\.5'/);
  });

  it('leaves morning\'s own rendering path byte-for-byte reachable (the non-evening branch of each ternary matches the original values)', () => {
    // Covered by the same assertions above - the non-evening branch is
    // literally the original /40, /secondary, /30, /20 values, so morning
    // (sessionId default 'morning-routine') renders exactly as before.
    expect(source).toMatch(/text-on-surface-variant\/40/);
  });
});

describe('PromptStepper evening-safe colour tokens', () => {
  const source = read('./PromptStepper.jsx');

  it('keeps the step counter and placeholder at full opacity, not the original fragile /60 and /40', () => {
    expect(source).toMatch(/text-on-surface-variant font-bold/);
    expect(source).not.toMatch(/text-on-surface-variant\/60/);
    expect(source).toMatch(/placeholder:text-on-surface-variant /);
    expect(source).not.toMatch(/placeholder:text-on-surface-variant\/40/);
  });

  it('gives the Previous/Skip buttons a visible, important-forced border (overriding glass-panel\'s own faint default)', () => {
    const matches = source.match(/!border-white\/40/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe('EveningBreathing Skip button', () => {
  it('matches the same visible-border treatment as PromptStepper\'s Skip', () => {
    const source = read('../../pages/EveningBreathing.jsx');
    expect(source).toMatch(/!border-white\/40/);
  });
});

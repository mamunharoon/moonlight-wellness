// Build 15 Phase A — ProgressIndicator.jsx restyle regression guard.
// Confirms the type-scale/emphasis bump landed and, critically, that the
// evening colour-contrast fix (a live WCAG AA fix, not a style choice)
// was NOT touched by this restyle. Source-level checks - this repo's
// Vitest has no rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./ProgressIndicator.jsx', import.meta.url)), 'utf-8');

describe('ProgressIndicator.jsx — Phase A restyle (type-scale/emphasis only)', () => {
  it('base label size is bumped 10px -> 11px', () => {
    expect(source).toMatch(/text-\[11px\] uppercase tracking-wider font-semibold/);
    expect(source).not.toMatch(/text-\[10px\] uppercase tracking-wider font-semibold/);
  });

  it('the active step\'s emphasis is strengthened (scale-105 -> scale-110)', () => {
    expect(source).toMatch(/text-primary font-bold scale-110/);
    expect(source).not.toMatch(/text-primary font-bold scale-105/);
  });

  it('the evening colour-contrast fix (isEvening branch, WCAG AA verified) is byte-for-byte unchanged - Phase A never touches accessibility-critical color/opacity logic', () => {
    expect(source).toMatch(/const isEvening = sessionId === EVENING_SESSION_ID;/);
    expect(source).toMatch(/isEvening \? 'text-on-surface-variant' : 'text-on-surface-variant\/40'/);
    expect(source).toMatch(/isCompleted\s*\n\s*\? \(isEvening \? 'text-on-surface' : 'text-secondary'\)/);
  });

  it('Review Mode (tap-to-return-to-completed-step) and the registry-driven step order are untouched', () => {
    expect(source).toMatch(/onClick=\{\(\) => onReviewStep\(step\.key\)\}/);
    expect(source).toMatch(/import \{ getSessionById \} from '\.\.\/session\/sessionRegistry';/);
  });
});

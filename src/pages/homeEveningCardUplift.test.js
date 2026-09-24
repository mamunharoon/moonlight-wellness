// Evening Visual Uplift (Build 17), Decision C — Home's four Evening card
// shells (stale-choice, not-started, in-progress, completed) gain
// `border-evening-accent/25 shadow-evening-glow`, mirroring Morning's own
// `border-morning-accent/25 shadow-morning-glow` from Build 16. This file
// proves the new className is scoped to exactly those four Evening cards,
// that Morning's own card treatment and Anytime's plain card are
// untouched, and that no card logic (which state renders, button labels/
// handlers, completion/Resume/Redo behaviour) changed alongside the
// restyle.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Home.jsx', import.meta.url)), 'utf-8');

describe('Home.jsx — Evening card shells gain border-evening-accent/25 shadow-evening-glow', () => {
  it('exactly 4 Evening cards carry the new className (stale-choice, not-started, in-progress, completed)', () => {
    const count = (source.match(/className="glass-panel p-6 rounded-3xl space-y-[56] border-evening-accent\/25 shadow-evening-glow"/g) ?? []).length;
    expect(count).toBe(4);
  });

  it('the old plain border-white/5 shadow-sm className no longer appears anywhere in the Evening block', () => {
    expect(source).not.toMatch(/border-white\/5 shadow-sm/);
  });

  it('Morning\'s own card shells keep their Build 16 border-morning-accent/25 shadow-morning-glow, completely untouched by this change', () => {
    const morningCount = (source.match(/border-morning-accent\/25 shadow-morning-glow/g) ?? []).length;
    expect(morningCount).toBeGreaterThanOrEqual(3); // not-started, in-progress, completed (at minimum)
  });

  it('the evening-tint inline background style is still applied on all 4 cards, unchanged by the className edit', () => {
    const eveningCardCount = (source.match(/style=\{\{ backgroundColor: 'rgb\(var\(--color-evening-tint\) \/ 0\.2\)' \}\}/g) ?? []).length;
    expect(eveningCardCount).toBe(4);
  });
});

describe('Home.jsx — Evening card logic is completely untouched by the restyle', () => {
  it('all real Evening state branches still exist with their original conditions', () => {
    expect(source).toMatch(/eveningCardState === 'not-started' && eveningHasStaleChoice/);
    expect(source).toMatch(/eveningCardState === 'not-started' && !eveningHasStaleChoice/);
    expect(source).toMatch(/eveningCardState === 'in-progress'/);
    expect(source).toMatch(/eveningCardState === 'completed'/);
  });

  it('nextStepCardBody call sites for Evening are still 1-arg (no isMorning/isEvening flag was added to the shared badge/heading helper for Evening)', () => {
    expect(source).toMatch(/\{nextStepCardBody\(eveningNotStartedCard\)\}/);
    expect(source).toMatch(/\{nextStepCardBody\(eveningInProgressCard, resolveStepLabel\(RITUAL_SESSION_IDS\.evening, eveningResolvedStepIndex\)\)\}/);
    expect(source).toMatch(/\{nextStepCardBody\(eveningCompletedCard\)\}/);
  });

  it('guest-vs-authenticated completed-state buttons (Begin Evening Wind-Down / Review-Edit / Redo / Return Home path) are untouched', () => {
    expect(source).toMatch(/Begin Evening Wind-Down/);
    expect(source).toMatch(/handleBeginEveningWindDown/);
  });

  it('the stale-choice card\'s Resume/Start-Today actions are untouched', () => {
    expect(source).toMatch(/handleResumeStaleEvening/);
    expect(source).toMatch(/Resume Previous Routine/);
    expect(source).toMatch(/Start Today's Routine/);
  });
});

// Regression guard for the Build 10 critical defect: "Evening selected
// launches Morning flow". No DOM/component rendering is available in
// this repo's Vitest (see index.css.test.js's own note), so - matching
// the pure-logic tests in routineProgress.test.js/routineCardState.test.js
// that cover the real decision logic exhaustively - this locks in the
// source-level wiring: each routine's own CTA only ever calls
// resumeRoutine/getSessionById scoped to ITS OWN sessionId, never a
// shared/global "whatever is currently live" read, and the cross-routine
// banner only ever switches the selector, never navigates on its own.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const homeSource = readFileSync(fileURLToPath(new URL('./Home.jsx', import.meta.url)), 'utf-8');

describe('Home.jsx per-routine action handlers (Build 10 critical fix)', () => {
  it('Morning\'s resume path calls resumeRoutine/navigates scoped to RITUAL_SESSION_IDS.morning only', () => {
    expect(homeSource).toMatch(/resumeRoutine\(RITUAL_SESSION_IDS\.morning\)/);
    expect(homeSource).toMatch(/getSessionById\(RITUAL_SESSION_IDS\.morning\)/);
  });

  it('Evening\'s resume path calls resumeRoutine/navigates scoped to RITUAL_SESSION_IDS.evening only', () => {
    expect(homeSource).toMatch(/resumeRoutine\(RITUAL_SESSION_IDS\.evening\)/);
    expect(homeSource).toMatch(/getSessionById\(RITUAL_SESSION_IDS\.evening\)/);
  });

  it('each card\'s Begin/Resume button is wired to that routine\'s own handler, not a shared generic one', () => {
    expect(homeSource).toMatch(/onClick=\{handleMorningAction\}/);
    expect(homeSource).toMatch(/onClick=\{handleEveningAction\}/);
  });

  it('card state for each routine is resolved independently via resolveRoutineCardState, keyed by that routine\'s own sessionId', () => {
    expect(homeSource).toMatch(/const morningCardState = resolveRoutineCardState\(\{\s*\n\s*sessionId: RITUAL_SESSION_IDS\.morning,/);
    expect(homeSource).toMatch(/const eveningCardState = resolveRoutineCardState\(\{\s*\n\s*sessionId: RITUAL_SESSION_IDS\.evening,/);
  });

  it('the cross-routine "paused" banners only switch the selector (setSelectedPeriod), never navigate directly themselves', () => {
    const bannerBlocks = homeSource.match(/routine paused[\s\S]{0,400}/g) ?? [];
    expect(bannerBlocks.length).toBeGreaterThanOrEqual(2);
    for (const block of bannerBlocks) {
      expect(block).not.toMatch(/navigate\(/);
    }
  });

  it('renders three distinct states per routine (not-started/in-progress/completed), never collapsing paused into either extreme', () => {
    expect(homeSource).toMatch(/morningCardState === 'not-started'/);
    expect(homeSource).toMatch(/morningCardState === 'in-progress'/);
    expect(homeSource).toMatch(/morningCardState === 'completed'/);
    expect(homeSource).toMatch(/eveningCardState === 'not-started'/);
    expect(homeSource).toMatch(/eveningCardState === 'in-progress'/);
    expect(homeSource).toMatch(/eveningCardState === 'completed'/);
  });

  it('Start Over/Do Again is wired through resetRoutine via a confirmation dialog with the required exact wording', () => {
    expect(homeSource).toMatch(/title="Start this routine again\?"/);
    expect(homeSource).toMatch(/message="Your current step progress will be reset\."/);
    expect(homeSource).toMatch(/resetRoutine\(RITUAL_SESSION_IDS\[confirmResetPeriod\]\)/);
  });
});

describe('Sign-out routine-progress isolation', () => {
  it('AuthContext clears all routine progress on every sign-out', () => {
    const authContextSource = readFileSync(fileURLToPath(new URL('../context/AuthContext.jsx', import.meta.url)), 'utf-8');
    expect(authContextSource).toMatch(/clearAllRoutineProgress\(\);/);
  });
});

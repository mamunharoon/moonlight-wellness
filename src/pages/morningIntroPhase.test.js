// Regression guard for the Morning Introduction phase added to
// IntentionSetup.jsx, and the audit fixes applied afterward:
// (1) the intro must never restate the canonical step order incorrectly
//     (approved order is Intend -> Stretch -> Breathe -> Affirm -> Complete,
//     see morningFlowOrder.test.js - the intro must not claim Affirmation
//     is first),
// (2) the intro must not reappear on every remount of the same live
//     'intention' step once the user has already dismissed it,
// (3) Review Mode must always skip straight past the intro,
// (4) an Exit routine affordance must exist on the intro phase too, not
//     just the picker phase.
// Source-level checks, matching this codebase's established pattern for
// logic that isn't practically renderable in this repo's Node-environment
// Vitest (see Home.routineState.test.js's own note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./IntentionSetup.jsx', import.meta.url)), 'utf-8');
const homeSource = readFileSync(fileURLToPath(new URL('./Home.jsx', import.meta.url)), 'utf-8');

describe('IntentionSetup.jsx - Morning Introduction copy never misstates the canonical step order', () => {
  it('never claims Affirmation is first (the approved order is Intend -> Stretch -> Breathe -> Affirm)', () => {
    expect(source).not.toMatch(/begin with a positive affirmation/i);
    expect(source).not.toMatch(/We'll begin with[\s\S]{0,20}affirmation/i);
  });

  it('describes intention-setting as the first thing, matching the actual approved order', () => {
    expect(source).toMatch(/We'll begin by setting an intention for today/);
  });
});

describe('Home.jsx - Morning card supporting copy never misstates the canonical step order', () => {
  it('never lists affirmation before intention (the approved order ends with Affirm, not starts with it)', () => {
    expect(homeSource).not.toMatch(/guide you through affirmation/i);
  });
});

describe('IntentionSetup.jsx - showIntro does not repeatedly force the intro on an already-dismissed live session', () => {
  it('isReviewMode always short-circuits showIntro to false, before any sessionStorage check', () => {
    const initializer = source.match(/const \[showIntro, setShowIntro\] = useState\(\(\) => \{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(initializer).toMatch(/if \(isReviewMode\) return false;/);
  });

  it('derives a per-live-session introSeenKey from isLiveStep and the session\'s own startedAt - never a bare, session-independent flag', () => {
    expect(source).toMatch(/const introSeenKey = isLiveStep && state\.startedAt \? `moonlight_morning_intro_seen:\$\{state\.startedAt\}` : null;/);
  });

  it('checks sessionStorage for that key before deciding to show the intro', () => {
    const initializer = source.match(/const \[showIntro, setShowIntro\] = useState\(\(\) => \{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(initializer).toMatch(/sessionStorage\.getItem\(introSeenKey\) === '1'/);
  });

  it('dismissIntro writes the sessionStorage flag before hiding the intro, and the intro\'s own Begin button calls dismissIntro (not a bare setShowIntro)', () => {
    expect(source).toMatch(/const dismissIntro = \(\) => \{[\s\S]*?sessionStorage\.setItem\(introSeenKey, '1'\);[\s\S]*?setShowIntro\(false\);/);
    expect(source).toMatch(/onClick=\{dismissIntro\}/);
    expect(source).not.toMatch(/onClick=\{\(\) => setShowIntro\(false\)\}/);
  });

  it('never persists the intro-seen flag anywhere but sessionStorage (no localStorage, no database/network write)', () => {
    const introBlock = source.slice(source.indexOf('const introSeenKey'), source.indexOf('const dismissIntro') + 400);
    expect(introBlock).not.toMatch(/localStorage/);
    expect(introBlock).not.toMatch(/supabase|fetch\(/i);
  });
});

describe('IntentionSetup.jsx - the intro phase offers the same Exit routine affordance as the picker phase', () => {
  it('the intro phase (showIntro branch) renders an Exit routine button wired to the existing handleExitRoutine', () => {
    const introBranch = source.match(/\{showIntro \? \(\s*<>([\s\S]*?)<\/>\s*\) : \(/)?.[1] ?? '';
    expect(introBranch).toMatch(/onClick=\{handleExitRoutine\}[\s\S]*?Exit routine/);
  });
});

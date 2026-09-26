// WakeWise Phase 1 correction — root cause: the top-of-page greeting used
// to key off `timeState` directly, completely independent of
// `activePeriod`/`selectedPeriod`. A user who manually tapped the Morning
// card could still see "A calm evening to you" if the real clock said
// evening, directly contradicting the Morning card selected right below
// it. Source-level regression guard (no DOM rendering is available in this
// repo's Vitest - see Home.greeting.test.js's own note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const homeSource = readFileSync(fileURLToPath(new URL('./Home.jsx', import.meta.url)), 'utf-8');
const greetingBlock = homeSource.match(/const greetingText =[\s\S]*?getGreeting\('afternoon', \{ profile, user, dateKey: today \}\);/)?.[0] ?? '';

describe('Home.jsx greeting — cannot contradict the selected rhythm', () => {
  it('locates the greetingText assignment', () => {
    expect(greetingBlock).not.toBe('');
  });

  it('branches on activePeriod (the same value driving which journey card renders), not on timeState directly', () => {
    expect(greetingBlock).toMatch(/activePeriod === 'morning'/);
    expect(greetingBlock).toMatch(/activePeriod === 'evening'/);
    expect(greetingBlock).not.toMatch(/timeState ===/);
  });

  it('a manually-selected Morning always gets the morning greeting, and a manually-selected Evening always gets the evening greeting, regardless of the real clock', () => {
    expect(greetingBlock).toMatch(/activePeriod === 'morning'\s*\n\s*\? getGreeting\('morning', \{ profile, user, dateKey: today \}\)/);
    expect(greetingBlock).toMatch(/: activePeriod === 'evening'\s*\n\s*\? getGreeting\('evening', \{ profile, user, dateKey: today \}\)/);
  });

  it('Anytime reuses the existing approved "afternoon" copy set rather than introducing a new rotating-message system', () => {
    expect(greetingBlock).toMatch(/: getGreeting\('afternoon', \{ profile, user, dateKey: today \}\);$/);
  });

  it('preserves the time-based default: when unselected, activePeriod already equals defaultPeriod, so every real timeState still resolves through the exact same getGreeting daypart as before this fix', () => {
    // activePeriod = selectedPeriod ?? defaultPeriod, and defaultPeriod's
    // own three branches ('morning' for before-wake/daytime-morning
    // unless completed, 'evening' for evening/night, 'anytime' otherwise)
    // line up exactly with the old direct-timeState mapping this test
    // used to guard - see Home.greeting.test.js's "Build 15" test for
    // defaultPeriod's own branches.
    expect(homeSource).toMatch(/const activePeriod = selectedPeriod \?\? defaultPeriod;/);
  });

  it('updates immediately when the user changes the rhythm tab: greetingText is a plain synchronous expression re-evaluated every render, not state captured once', () => {
    expect(homeSource).not.toMatch(/const \[greetingText/);
    expect(homeSource).toMatch(/const greetingText =/);
  });
});

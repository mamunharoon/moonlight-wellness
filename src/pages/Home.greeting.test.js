// Regression guard for the native Home-tab greeting. A prior fix touched
// Home.jsx's morning-only greeting, but real Build 9 device testing showed
// no greeting at all outside the morning window - and no test caught that
// the fix, while correct, never reached the afternoon/evening branches. No
// DOM/component rendering is available in this repo's Vitest (see
// index.css.test.js's own note), so this locks in two things at the
// source level instead: the bottom Home tab's actual route really renders
// Home.jsx (not some other unreachable component), and Home.jsx's own
// three greeted timeState branches each call getGreeting with the
// matching daypart.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appSource = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf-8');
const homeSource = readFileSync(fileURLToPath(new URL('./Home.jsx', import.meta.url)), 'utf-8');

describe('bottom Home tab route wiring', () => {
  it('the index route under the bottom-nav Layout renders Home.jsx, not some other/unreachable component', () => {
    expect(appSource).toMatch(/import\(['"]\.\/pages\/Home['"]\)/);
    expect(appSource).toMatch(/<Route path="\/" element=\{<Layout \/>\}>/);
    expect(appSource).toMatch(/<Route index element=\{withFallback\(<Home \/>\)\}/);
  });
});

describe('Home.jsx daypart greeting wiring', () => {
  it('calls getGreeting with the matching daypart for each of the three greeted timeState branches', () => {
    expect(homeSource).toMatch(/getGreeting\('morning', \{ profile, user \}\)/);
    expect(homeSource).toMatch(/getGreeting\('afternoon', \{ profile, user \}\)/);
    expect(homeSource).toMatch(/getGreeting\('evening', \{ profile, user \}\)/);
  });

  it('imports profile and user from useAuth so no additional profile query is introduced', () => {
    expect(homeSource).toMatch(/const \{ profile, user, isGuest \} = useAuth\(\);/);
  });
});

describe('Home.jsx Morning/Evening selector wiring', () => {
  it('renders the Morning, Anytime, and Evening cards as real, clickable controls, not static status text', () => {
    expect(homeSource).toMatch(/onClick=\{\(\) => setSelectedPeriod\('morning'\)\}/);
    expect(homeSource).toMatch(/onClick=\{\(\) => setSelectedPeriod\('anytime'\)\}/);
    expect(homeSource).toMatch(/onClick=\{\(\) => setSelectedPeriod\('evening'\)\}/);
  });

  it('Home redesign — a manual pill selection always decides which routine\'s card renders, at any real clock time (activePeriod, not a timeState-gated effectiveTimeState)', () => {
    expect(homeSource).toMatch(/activePeriod === 'morning' && \(/);
    expect(homeSource).toMatch(/activePeriod === 'evening' && \(/);
    // The old effectiveTimeState/overridableTimeStates gating is fully
    // retired - every state now maps to an actionable "Your Next Step"
    // card (see nextStepCard.js), so there is no longer a timeState band
    // a manual selection can be blocked by.
    expect(homeSource).not.toMatch(/effectiveTimeState/);
    expect(homeSource).not.toMatch(/overridableTimeStates/);
  });

  it('Home redesign — Morning is now reachable/actionable during evening AND night (the approved "Not started during the evening/night while Morning is selected" state), and Evening is reachable at any time too - both retired full-page before-wake/night takeovers are gone', () => {
    expect(homeSource).not.toMatch(/\{timeState === 'before-wake' && \(/);
    expect(homeSource).not.toMatch(/\{timeState === 'night' && \(/);
    expect(homeSource).not.toMatch(/Still resting/);
    expect(homeSource).not.toMatch(/Rest Well/);
    // Morning's own not-started copy varies by real daypart via
    // resolveMorningDaypart(timeState) - before-wake and night both fold
    // into a real, actionable variant (see nextStepCard.test.js for the
    // exhaustive copy coverage), never a dead end.
    expect(homeSource).toMatch(/const morningDaypart = resolveMorningDaypart\(timeState\);/);
  });

  it('Build 15 — defaults the card highlight from an active routine first, then the real clock, with a completed Morning deferring to Anytime rather than blocking a useful default', () => {
    expect(homeSource).toMatch(/const activePeriod = selectedPeriod \?\? defaultPeriod;/);
    const defaultPeriodBody = homeSource.match(/const defaultPeriod = \(\(\) => \{[\s\S]*?\}\)\(\);/)?.[0] ?? '';
    expect(defaultPeriodBody).toMatch(/if \(morningCardState === 'in-progress'\) return 'morning';/);
    expect(defaultPeriodBody).toMatch(/if \(eveningCardState === 'in-progress'\) return 'evening';/);
    expect(defaultPeriodBody).toMatch(/if \(timeState === 'evening' \|\| timeState === 'night'\) return 'evening';/);
    expect(defaultPeriodBody).toMatch(/return morningCardState === 'completed' \? 'anytime' : 'morning';/);
    expect(defaultPeriodBody).toMatch(/return 'anytime';/);
  });
});

describe('Home.jsx Morning/Anytime/Evening selector styling (Build 15 "Today\'s Rhythm")', () => {
  it('uses the semantically correct tab pattern (role="tablist"/"tab" + aria-selected), not aria-pressed', () => {
    expect(homeSource).toMatch(/role="tablist" aria-label="Today's rhythm"/);
    expect(homeSource).toMatch(/role="tab"/);
    expect(homeSource).toMatch(/aria-selected=\{activePeriod === 'morning'\}/);
    expect(homeSource).toMatch(/aria-selected=\{activePeriod === 'anytime'\}/);
    expect(homeSource).toMatch(/aria-selected=\{activePeriod === 'evening'\}/);
    expect(homeSource).not.toMatch(/aria-pressed=\{/);
  });

  it('gives the active card a solid, bordered accent fill - each of the three keeping its own distinct, approved colour identity (Morning sunrise gold, Anytime mint, Evening soft blue - Anytime Reset Visual Uplift Phase 2, decision A; Home Visual Uplift swapped the generic shadow-sm for each one\'s own already-existing named circadian glow)', () => {
    expect(homeSource).toMatch(/'bg-morning-accent text-on-morning-accent border-morning-accent shadow-morning-glow'/);
    expect(homeSource).toMatch(/'bg-tertiary text-on-tertiary border-tertiary shadow-mint-glow'/);
    expect(homeSource).toMatch(/'bg-evening-accent text-on-evening-accent border-evening-accent shadow-evening-glow'/);
  });

  it('never gives an inactive card a visible border, so it can never look stronger than the active one', () => {
    const inactiveClassMatches = homeSource.match(/'bg-white\/5 text-on-surface-variant\/60 border-transparent hover:bg-white\/10'/g) ?? [];
    expect(inactiveClassMatches.length).toBe(3);
  });

  it('shows no numeric completion count anywhere in the selector - only the existing ✓ prefix/label convention', () => {
    const selectorBlock = homeSource.slice(homeSource.indexOf("Today's Rhythm"), homeSource.indexOf('Build 10 remediation'));
    expect(selectorBlock).not.toMatch(/\d+ of \d+/);
  });
});

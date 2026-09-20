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
  it('renders the Morning and Evening pills as real, clickable controls, not static status text', () => {
    expect(homeSource).toMatch(/onClick=\{\(\) => setSelectedPeriod\('morning'\)\}/);
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

  it('defaults the pill highlight from the real clock (existing daypart rules) until the user actually picks one', () => {
    expect(homeSource).toMatch(
      /const activePeriod = selectedPeriod \?\? \(timeState === 'evening' \|\| timeState === 'night' \? 'evening' : 'morning'\);/
    );
  });
});

describe('Home.jsx Morning/Evening selector styling (selected-state fix)', () => {
  it('uses the semantically correct tab pattern (role="tablist"/"tab" + aria-selected), not the previous aria-pressed', () => {
    expect(homeSource).toMatch(/role="tablist" aria-label="Time of day"/);
    expect(homeSource).toMatch(/role="tab"/);
    expect(homeSource).toMatch(/aria-selected=\{activePeriod === 'morning'\}/);
    expect(homeSource).toMatch(/aria-selected=\{activePeriod === 'evening'\}/);
    expect(homeSource).not.toMatch(/aria-pressed=\{/);
  });

  it('gives the active pill a solid, bordered accent fill - each option keeping its own distinct colour', () => {
    expect(homeSource).toMatch(/'bg-primary text-on-primary border-primary shadow-sm'/);
    expect(homeSource).toMatch(/'bg-secondary text-on-secondary border-secondary shadow-sm'/);
  });

  it('never gives the inactive pill a visible border, so it can never look stronger than the active one', () => {
    const inactiveClassMatches = homeSource.match(/'bg-white\/5 text-on-surface-variant\/60 border-transparent hover:bg-white\/10'/g) ?? [];
    expect(inactiveClassMatches.length).toBe(2);
  });
});

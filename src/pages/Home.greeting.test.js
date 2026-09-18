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

  it('lets a manual selection override which ritual card renders during daytime-morning/daytime/evening', () => {
    expect(homeSource).toMatch(/effectiveTimeState === 'daytime-morning'/);
    expect(homeSource).toMatch(/effectiveTimeState === 'daytime'/);
    expect(homeSource).toMatch(/effectiveTimeState === 'evening'/);
  });

  it('never lets a manual selection override the before-wake or night screens (real time constraints, not a ritual choice)', () => {
    expect(homeSource).toMatch(/\{timeState === 'before-wake' && \(/);
    expect(homeSource).toMatch(/\{timeState === 'night' && \(/);
    expect(homeSource).not.toMatch(/effectiveTimeState === 'before-wake'/);
    expect(homeSource).not.toMatch(/effectiveTimeState === 'night'/);
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

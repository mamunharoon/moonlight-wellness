// Release-blocking runtime fix — WakeWise DEV, deployed commit
// 2fbe38e6b00528e24e565d04306a1f80f6b518b2.
//
// Root cause (reproduced live in a real browser against the deployed
// site, on a real authenticated user's real persisted Evening session,
// not guessed from source): EveningSceneShell's `protectedHeader` branch
// gave its decorative AtmosphereManager layer `z-[100]` - copied literally
// from the DEFAULT (non-protectedHeader) branch below, which correctly
// pairs it with a `z-[101]` scroll owner. The protectedHeader branch's own
// nav row (`z-20`) and content body (`z-10`) are both LOWER than 100. All
// three are direct children of the same `fixed inset-0 flex flex-col`
// wrapper, which never sets its own z-index - so they compare directly in
// one local stacking context, and 100 > 20 > 10 put the atmosphere
// visually ABOVE Back/Exit and all real page content on every screen that
// opts into protectedHeader (Evening Breathing, Evening Meditate).
// `pointer-events-none` on the atmosphere meant clicks still reached the
// real content underneath - so the DOM/accessibility tree, computed
// styles (color/opacity/display all reported "visible"), and even
// `document.elementsFromPoint` all looked completely correct - only the
// actual PAINTED pixels were hidden, which is exactly why every existing
// test here (all source-string checks - this repo's Vitest has no DOM/
// paint) already passed: none of them compared the atmosphere's z-index
// against the content's own. This file closes that gap with a REAL,
// numeric stacking-order assertion, not a string match that could pass
// even if some other equally-wrong value were used.
//
// This file's own component (EveningSceneShell) takes no hooks - a plain
// function of props - so it can be called directly and its returned
// element tree inspected structurally, exactly like this codebase's other
// hook-free presentational components (EveningJourneyPathway.test.js,
// MorningJourneyPathway.test.js).
import { describe, it, expect } from 'vitest';
import { EveningSceneShell } from './EveningSceneShell';
import { AtmosphereManager } from '../stage3/AtmosphereManager';
import { getSessionById } from '../../session/sessionRegistry';

// Tailwind's `z-<n>` / `-z-<n>` utilities are the only two shapes any of
// this shell's own classNames ever use - a plain positive/negative
// integer, never an arbitrary `z-[...]` value in the fixed code paths
// this test reads (the one remaining `z-[100]`/`z-[101]` pair in the
// DEFAULT branch is asserted on literally, below, since that pair is
// intentionally unchanged).
const zIndexOf = (className) => {
  const match = className.match(/(?:^|\s)(-?)z-(\d+)(?:\s|$)/);
  if (!match) return null;
  const [, sign, digits] = match;
  return (sign === '-' ? -1 : 1) * Number(digits);
};

describe('EveningSceneShell — protectedHeader real stacking order (release-blocking runtime fix)', () => {
  const element = EveningSceneShell({ protectedHeader: true, showBack: true, showExit: true, children: 'content' });
  const [atmosphereEl, navRow, scrollBody] = element.props.children;

  it('renders the outer fixed column with exactly the three expected children in order: atmosphere, nav row, scroll body', () => {
    expect(element.props.className).toBe('fixed inset-0 flex flex-col');
    expect(atmosphereEl).toBeTruthy();
    expect(navRow).toBeTruthy();
    expect(scrollBody).toBeTruthy();
  });

  it('the atmosphere layer is the real AtmosphereManager (Evening\'s default journey, no glowJourney override) with a NEGATIVE z-index - never z-[100] or any positive value', () => {
    expect(atmosphereEl.type).toBe(AtmosphereManager);
    const z = zIndexOf(atmosphereEl.props.className);
    expect(z).not.toBeNull();
    expect(z).toBeLessThan(0);
    expect(atmosphereEl.props.className).not.toMatch(/z-\[100\]/);
  });

  it('the atmosphere\'s real numeric z-index is strictly lower than both the nav row\'s and the content body\'s own - a genuine stacking-order comparison, not a string match', () => {
    const atmosphereZ = zIndexOf(atmosphereEl.props.className);
    const navZ = zIndexOf(navRow.props.className);
    const contentZ = zIndexOf(scrollBody.props.className);
    expect(navZ).toBe(20);
    expect(contentZ).toBe(10);
    expect(atmosphereZ).toBeLessThan(navZ);
    expect(atmosphereZ).toBeLessThan(contentZ);
  });

  it('the atmosphere stays pointer-events-none and fixed inset-0 - the fix changes only paint order, never hit-testing/positioning', () => {
    expect(atmosphereEl.props.className).toMatch(/\bpointer-events-none\b/);
    expect(atmosphereEl.props.className).toMatch(/\bfixed\b/);
    expect(atmosphereEl.props.className).toMatch(/\binset-0\b/);
  });

  it('a caller-supplied className is still appended (additive prop, unaffected by the fix)', () => {
    const el = EveningSceneShell({ protectedHeader: true, className: 'custom-test-class', children: 'x' });
    const [atmosphere] = el.props.children;
    expect(atmosphere.props.className).toMatch(/custom-test-class/);
  });

  it('journey="anytime"/"morning" still resolve to JourneyGlow (unaffected by this fix - JourneyGlow already uses its own proven -z-10 convention)', () => {
    const anytimeEl = EveningSceneShell({ protectedHeader: true, journey: 'anytime', children: 'x' });
    const [glow] = anytimeEl.props.children;
    expect(glow.type).not.toBe(AtmosphereManager);
  });
});

// Release-blocking runtime investigation — "does the root route redirect
// into Evening Breathing?" This is the real data-level mapping
// RoutineRestoreGuard.jsx's own activeRoute (via useActiveRoutineStep.js's
// `currentStep?.route`) resolves through: real execution against the real
// session registry, not a guess. Confirmed live on the deployed site too:
// a real authenticated user's persisted 'evening-wind-down' session at
// stepIndex 3 genuinely redirected "/" to "/evening-breathing" - that
// redirect itself was always correct and is untouched by this fix; it
// only mattered because the destination page it redirected to was the one
// rendering blank.
describe('Session registry — a persisted evening-wind-down session at stepIndex 3 resolves to /evening-breathing (the real redirect target root "/" forces into, via RoutineRestoreGuard.jsx)', () => {
  it('EVENING_ROUTINE_SESSION.steps[3] is genuinely the breathing step, route "/evening-breathing"', () => {
    const session = getSessionById('evening-wind-down');
    expect(session.steps[3].id).toBe('breathing');
    expect(session.steps[3].route).toBe('/evening-breathing');
  });
});

describe('EveningSceneShell — default (non-protectedHeader) branch is untouched and was never affected by this bug', () => {
  it('its own atmosphere (z-[100]) and scroll owner (z-[101]) still resolve correctly, content above atmosphere - this pairing was always correct, which is why only the protectedHeader branch needed a fix', () => {
    const element = EveningSceneShell({ showBack: true, children: 'content' });
    // Default branch: <><glow-or-atmosphere/><div className="fixed inset-0 z-[101] overflow-y-auto">...</div></>
    const kids = Array.isArray(element) ? element : element.props?.children;
    const flat = (Array.isArray(kids) ? kids : [kids]).filter(Boolean);
    const atmosphereEl = flat.find((c) => c?.type === AtmosphereManager);
    const scrollOwner = flat.find((c) => typeof c?.props?.className === 'string' && c.props.className.includes('overflow-y-auto') && c.props.className.includes('z-['));
    expect(atmosphereEl).toBeTruthy();
    expect(atmosphereEl.props.className).toMatch(/z-\[100\]/);
    expect(scrollOwner).toBeTruthy();
    expect(scrollOwner.props.className).toMatch(/z-\[101\]/);
  });
});

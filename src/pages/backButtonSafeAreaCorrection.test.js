// Build 16 physical-iPhone correction (F8) — top-left Back buttons on
// every full-screen journey page that renders OUTSIDE <Layout> were
// confirmed live (Playwright, real geometry, not source inspection) to
// sit flush at x:0, y:24 with zero safe-area accounting - the exact
// device-notch/Dynamic-Island/left-edge overlap risk F8 describes.
// Layout.jsx's own in-app pages already handle this globally (its own
// header/content safe-area padding); these 8 pages are the ones that
// don't inherit that. No DOM rendering available in this repo's Vitest -
// source-level checks, matching this codebase's established pattern -
// but the geometry claim itself (x:16, y:24 post-fix, at all 5 required
// widths, plus real tap-reliability at the button's center/edges) was
// verified live via a temporary pure-props preview route (real
// IntentionSetup.jsx, no fake persisted state), fully removed afterward -
// see this session's own report for that evidence; not re-asserted here
// since env(safe-area-inset-*) always resolves to 0 outside a real
// device/Safari simulation, so a Node-level or headless-browser assertion
// of the resolved pixel value would not be meaningful.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

// WakeWise DEV — F1 mobile-nav fix: Affirmation.jsx is no longer part of
// this shared min-h-[85vh]/py-6-or-pb-6 loop - it now owns its own
// h-dvh/overflow-y-auto scroll container (the same proven shape
// Introduction.jsx/AnytimeReset.jsx already use), a genuinely different
// structure from the other 7 pages below (all unchanged by this fix).
// Its own top-safe-area padding is untouched (still the exact F8 calc()
// this describe.each still verifies for every other page); see the
// dedicated describe block below for its new bottom-safe-area/scroll
// container coverage.
const AFFECTED_PAGES = [
  ['Breathe.jsx', './Breathe.jsx'],
  ['IntentionSetup.jsx', './IntentionSetup.jsx'],
  ['MeditationComplete.jsx', './MeditationComplete.jsx'],
  ['MorningFlow.jsx', './MorningFlow.jsx'],
  ['MorningMeditate.jsx', './MorningMeditate.jsx'],
  ['SelfGuidedMeditationComplete.jsx', './SelfGuidedMeditationComplete.jsx'],
  ['SessionComplete.jsx', './SessionComplete.jsx']
];

describe.each(AFFECTED_PAGES)('%s — top-left Back button safe-area correction (F8)', (_name, relativePath) => {
  const source = read(relativePath);

  it('adds env(safe-area-inset-top) on top of the existing flat top padding, via the same calc() pattern already proven in ResetPassword.jsx/EveningSceneShell.jsx', () => {
    expect(source).toMatch(/paddingTop: 'calc\(1\.5rem \+ env\(safe-area-inset-top\)\)'/);
  });

  it('adds real left/right safe-area inset plus at least 1rem (16px) of comfortable spacing - the exact "12-16px after the safe-area inset" F8 requires', () => {
    expect(source).toMatch(/paddingLeft: 'calc\(1rem \+ env\(safe-area-inset-left\)\)'/);
    expect(source).toMatch(/paddingRight: 'calc\(1rem \+ env\(safe-area-inset-right\)\)'/);
  });

  it('no longer uses the old flat, safe-area-unaware "py-6" shorthand on this container - bottom padding is now expressed separately (pb-6) so top could be replaced without silently changing the bottom too', () => {
    const containerLine = source.match(/className="min-h-\[85vh\][^"]*"/)?.[0] ?? '';
    expect(containerLine).not.toMatch(/\bpy-6\b/);
    expect(containerLine).toMatch(/\bpb-6\b/);
  });

  it('the style object sits on the same top-level min-h-[85vh] container the Back button is the first child of - not on some unrelated inner element', () => {
    const openTag = source.match(/<div\s*\n(?:\s*\/\/[^\n]*\n)*\s*className="min-h-\[85vh\][^"]*"\s*\n\s*style=\{\{[\s\S]*?\}\}\s*\n\s*>/)?.[0] ?? '';
    expect(openTag).not.toBe('');
  });
});

// WakeWise DEV — F1 mobile-nav fix: Affirmation.jsx's own dedicated
// coverage, now that it owns a real scroll container instead of the
// shared min-h-[85vh] shape every other AFFECTED_PAGES entry still uses.
describe('Affirmation.jsx — F1 mobile-nav fix: real scroll container, F8 top-safe-area untouched', () => {
  const source = read('./Affirmation.jsx');

  it('still adds env(safe-area-inset-top) via the same F8 calc() pattern - untouched by this fix', () => {
    expect(source).toMatch(/paddingTop: 'calc\(1\.5rem \+ env\(safe-area-inset-top\)\)'/);
    expect(source).toMatch(/paddingLeft: 'calc\(1rem \+ env\(safe-area-inset-left\)\)'/);
    expect(source).toMatch(/paddingRight: 'calc\(1rem \+ env\(safe-area-inset-right\)\)'/);
  });

  it('now also adds env(safe-area-inset-bottom) - never accounted for before this fix, on a page rendered outside <Layout> with its own no-header-of-its-own top-left Back button', () => {
    expect(source).toMatch(/paddingBottom: 'calc\(1\.5rem \+ env\(safe-area-inset-bottom\)\)'/);
  });

  it('owns its own h-dvh/overflow-y-auto scroll container - the same proven shape Introduction.jsx/AnytimeReset.jsx already use - instead of the old min-h-[85vh] floor with no real scroll owner', () => {
    expect(source).toMatch(/<div className="h-dvh overflow-hidden">/);
    expect(source).toMatch(/<div className="h-full w-full overflow-y-auto overflow-x-hidden scroll-hide" style=\{\{ overscrollBehaviorY: 'contain' \}\}>/);
    expect(source).not.toMatch(/min-h-\[85vh\]/);
  });

  it('the innermost padded content container uses min-h-full (a floor inside the real scroll owner, not min-h-[85vh] against an unscrollable ancestor) and no longer carries the old flat pb-6', () => {
    expect(source).toMatch(/className="min-h-full flex flex-col justify-between max-w-xl mx-auto space-y-10"/);
  });
});

describe('Back button destinations are unchanged by the F8 safe-area correction', () => {
  it('Affirmation.jsx still falls back to /morning-meditate', () => {
    expect(read('./Affirmation.jsx')).toMatch(/<BackButton fallback="\/morning-meditate" guardActiveRoute=\{false\} \/>/);
  });
  it('Breathe.jsx still falls back to /morning-flow', () => {
    expect(read('./Breathe.jsx')).toMatch(/<BackButton fallback="\/morning-flow" guardActiveRoute=\{false\} onBeforeLeave=\{handleBackFromActive\} \/>/);
  });
  it('IntentionSetup.jsx still falls back to /', () => {
    expect(read('./IntentionSetup.jsx')).toMatch(/<BackButton fallback="\/" \/>/);
  });
  it('MeditationComplete.jsx still falls back to /meditate', () => {
    expect(read('./MeditationComplete.jsx')).toMatch(/<BackButton fallback="\/meditate" \/>/);
  });
  it('MorningFlow.jsx still falls back to /intention-setup', () => {
    expect(read('./MorningFlow.jsx')).toMatch(/<BackButton fallback="\/intention-setup" guardActiveRoute=\{false\} onBeforeLeave=\{handleBackFromActive\} \/>/);
  });
  it('MorningMeditate.jsx still falls back to /breathe', () => {
    expect(read('./MorningMeditate.jsx')).toMatch(/<BackButton fallback="\/breathe" guardActiveRoute=\{false\} \/>/);
  });
  // Context-aware Breathing/Meditation theming — this BackButton now also
  // clears the captured practice journey tone via onBeforeLeave before
  // navigating away (a real exit-to-Home) - the label/guard props are
  // unchanged; the fallback destination is now `backDestination` (WakeWise
  // DEV Anytime Back-navigation correction - see
  // selfGuidedMeditationComplete.test.js's own dedicated coverage of what
  // that resolves to).
  it('SelfGuidedMeditationComplete.jsx still falls back to backDestination (context.fallback, or the preserved Anytime Reset recommendation when anytimeOrigin)', () => {
    expect(read('./SelfGuidedMeditationComplete.jsx')).toMatch(
      /<BackButton\s*\n\s*fallback=\{backDestination\}\s*\n\s*label=\{context\.label\}\s*\n\s*guardActiveRoute=\{false\}\s*\n[\s\S]*?\s*alwaysFallback=\{anytimeOrigin\}\s*\n\s*onBeforeLeave=\{\(\) => \{\s*\n\s*clearPracticeJourneyTone\(\);\s*\n\s*\}\}\s*\n\s*\/>/
    );
  });
  it('SessionComplete.jsx still uses alwaysFallback to / (never re-enters the completed routine via browser Back)', () => {
    expect(read('./SessionComplete.jsx')).toMatch(/<BackButton fallback="\/" guardActiveRoute=\{false\} alwaysFallback \/>/);
  });
});

describe('Layout.jsx (in-app pages) already handles this correctly - confirming F8 is scoped to the right set of pages, not a repo-wide rewrite', () => {
  const layoutSource = read('../components/Layout.jsx');
  it('already adds env(safe-area-inset-top) to its own header and hideNavigation content padding', () => {
    expect(layoutSource).toMatch(/paddingTop: 'calc\(1rem \+ env\(safe-area-inset-top\)\)'/);
  });
});

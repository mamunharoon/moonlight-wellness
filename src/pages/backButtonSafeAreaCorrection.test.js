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

const AFFECTED_PAGES = [
  ['Affirmation.jsx', './Affirmation.jsx'],
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
  it('SelfGuidedMeditationComplete.jsx still falls back to the dynamic context.fallback', () => {
    expect(read('./SelfGuidedMeditationComplete.jsx')).toMatch(/<BackButton fallback=\{context\.fallback\} label=\{context\.label\} guardActiveRoute=\{false\} \/>/);
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

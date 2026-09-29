// Build 15 viewport audit — release blockers on small iPhones.
//
// Self-Guided Meditation setup, Auth (Sign In/Create Account) and Anytime
// Reset (Steps 1 & 3) are full-bleed routes (outside <Layout>, see
// App.jsx) that had no scroll container of their own and relied on
// document scroll — which index.html deliberately disables on both axes
// (see that file's own doc comment: every Layout-wrapped page already
// owns its own internal scroll container, and two competing scrollers was
// the actual bug that fix solved). Confirmed live with a real wheel-scroll
// simulation (Playwright + system Edge, genuine CDP viewport sizing) at
// 320x568/375x667/390x844/393x852/430x932: Self-Guided Meditation's Begin
// Meditation button was unreachable at every one of those sizes including
// the largest iPhone; Create Account was unreachable at all but the
// largest; Sign In and Welcome were unreachable at the smallest only;
// Anytime Reset's Step 1 need grid and Step 3 Change Need/Change Time
// were unreachable on small phones. Fix: each of these screens now owns
// the same proven scroll-container shape Introduction.jsx/Layout.jsx
// already use (h-dvh overflow-hidden outer, h-full overflow-y-auto
// scroll-hide inner), rather than shrinking fonts to force content above
// the fold. AnytimeReset.jsx and Auth.jsx already carry their own
// dedicated regression checks for this (see AnytimeReset.test.js's
// "desktop layout" describe block and Auth.mobileSafeArea.test.js's
// "Safe-area support" describe block) — this file covers
// SelfGuidedMeditation.jsx and Welcome.jsx, which had no natural existing
// home for this check, plus one cross-file consistency assertion.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const selfGuidedMeditationSource = read('./SelfGuidedMeditation.jsx');
const welcomeSource = read('./Welcome.jsx');
const introductionSource = read('./Introduction.jsx');

const SCROLL_OUTER = '<div className="h-dvh overflow-hidden">';
const SCROLL_INNER = '<div className="h-full w-full overflow-y-auto overflow-x-hidden scroll-hide" style={{ overscrollBehaviorY: \'contain\' }}>';

// Physical-iPhone correction (exercise-screen safe-area architecture) —
// SelfGuidedMeditation.jsx's setup/countdown/earlyEnded branches moved OFF
// this shared h-dvh/overflow-y-auto shape entirely, onto the more specific
// shared ExerciseScreenShell (see MorningMeditate.jsx's identical
// migration and meditationSafeAreaCoverage.test.js for full per-branch
// coverage across Morning/Anytime/Evening Meditation).
describe('SelfGuidedMeditation.jsx — setup screen owns its own scroll container via the shared ExerciseScreenShell', () => {
  it('wraps the setup return in the shared ExerciseScreenShell, matching MorningMeditate.jsx', () => {
    expect(selfGuidedMeditationSource).toMatch(/if \(session\.phase === 'active' && session\.snapshot\) \{/);
    expect(selfGuidedMeditationSource).toMatch(/import \{ ExerciseScreenShell \} from '\.\.\/components\/journey\/ExerciseScreenShell';/);
    // Only the setup (non-active) return needs the fix - the active
    // session screen (MeditationActiveSession) already scrolls correctly
    // via its own ExerciseScreenShell.
    const setupReturn = selfGuidedMeditationSource.slice(selfGuidedMeditationSource.lastIndexOf('return ('));
    expect(setupReturn).toMatch(/<ExerciseScreenShell/);
    expect(setupReturn).not.toContain(SCROLL_OUTER);
  });

  it('the content keeps its original max-w-md/space-y-6, now via the shell\'s own maxWidthClassName prop and safe-area handling', () => {
    expect(selfGuidedMeditationSource).toMatch(/maxWidthClassName="max-w-md"/);
    expect(selfGuidedMeditationSource).toMatch(/className="flex flex-col space-y-6 animate-in fade-in duration-500"/);
  });

  it('div open/close tags stay balanced', () => {
    const opens = (selfGuidedMeditationSource.match(/<div/g) ?? []).length;
    const closes = (selfGuidedMeditationSource.match(/<\/div>/g) ?? []).length;
    expect(opens).toBe(closes);
  });
});

describe('Welcome.jsx — first-run screen owns its own scroll container', () => {
  it('wraps the whole return in the proven h-dvh/overflow-y-auto shape, matching Introduction.jsx', () => {
    expect(welcomeSource).toContain(SCROLL_OUTER);
    expect(welcomeSource).toContain(SCROLL_INNER);
  });

  it('the content div is min-h-full (not min-h-screen), so it grows past one viewport instead of clamping and relying on document scroll', () => {
    expect(welcomeSource).toMatch(/className="min-h-full flex flex-col justify-between px-6 max-w-md mx-auto"/);
    expect(welcomeSource).not.toMatch(/min-h-screen/);
  });

  it('gained explicit safe-area top/bottom padding it previously had none of - required for a route rendered before <Layout> mounts', () => {
    expect(welcomeSource).toMatch(/paddingTop: 'calc\(2\.5rem \+ env\(safe-area-inset-top\)\)'/);
    expect(welcomeSource).toMatch(/paddingBottom: 'calc\(2\.5rem \+ env\(safe-area-inset-bottom\)\)'/);
  });

  it('justify-between and the inner justify-center are untouched - only the outer height/scroll mechanism changed, preserving the existing "buttons anchored to the bottom" look when content fits', () => {
    expect(welcomeSource).toMatch(/justify-between/);
    expect(welcomeSource).toMatch(/justify-center/);
  });

  it('div open/close tags stay balanced', () => {
    const opens = (welcomeSource.match(/<div/g) ?? []).length;
    const closes = (welcomeSource.match(/<\/div>/g) ?? []).length;
    expect(opens).toBe(closes);
  });
});

// Physical-iPhone correction (exercise-screen safe-area architecture) —
// MorningMeditate.jsx's setup screen moved OFF this shared h-dvh/
// overflow-y-auto shape entirely, onto the more specific shared
// ExerciseScreenShell (a protected, non-scrolling header + single scroll
// body - see ExerciseScreenShell.jsx's own doc comment and
// meditationSafeAreaCoverage.test.js for full per-branch coverage). Its
// own dedicated describe block lives there now, not here.
describe('MorningMeditate.jsx — Meditation setup screen owns its own scroll container via the shared ExerciseScreenShell (mobile correction: Duration/Sound/Begin were unreachable)', () => {
  const morningMeditateSource = read('./MorningMeditate.jsx');

  it('renders the shared ExerciseScreenShell instead of the old bespoke h-dvh/overflow-y-auto pair', () => {
    expect(morningMeditateSource).toMatch(/import \{ ExerciseScreenShell \} from '\.\.\/components\/journey\/ExerciseScreenShell';/);
    expect(morningMeditateSource).not.toContain(SCROLL_OUTER);
  });

  it('the setup content no longer relies on justify-between (was spreading the few, short children across the full viewport height, the real cause of the excessive gap below the progress pathway) and space-y-10 is tightened to space-y-4', () => {
    // Comments in this file legitimately mention "justify-between" while
    // explaining the fix - strip comments first.
    const codeOnly = morningMeditateSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/justify-between/);
    expect(morningMeditateSource).toMatch(/className="flex flex-col space-y-4"/);
  });

  it('still renders MeditationSetupPanel unchanged (Begin/Duration/Sound wiring untouched by the scroll-container fix)', () => {
    expect(morningMeditateSource).toMatch(/<MeditationSetupPanel/);
    expect(morningMeditateSource).toMatch(/onBegin=\{handleBegin\}/);
  });

  it('div open/close tags stay balanced', () => {
    const opens = (morningMeditateSource.match(/<div/g) ?? []).length;
    const closes = (morningMeditateSource.match(/<\/div>/g) ?? []).length;
    expect(opens).toBe(closes);
  });
});

describe('Cross-file consistency - every fixed screen reuses the exact same wrapper shape Introduction.jsx pioneered, no bespoke variant invented per file', () => {
  it('Introduction.jsx (the original fix) still has the same two wrapper lines - the shape being copied has not itself drifted', () => {
    expect(introductionSource).toContain(SCROLL_OUTER);
    expect(introductionSource).toContain(SCROLL_INNER);
  });

  // MorningMeditate.jsx/SelfGuidedMeditation.jsx are deliberately excluded
  // here - they moved onto the newer, more specific ExerciseScreenShell
  // (protected header + single scroll body), not this older bare
  // h-dvh/overflow-y-auto pair. See each one's own dedicated describe
  // block above and meditationSafeAreaCoverage.test.js.
  it('all fixed files still using the older bare pair (Introduction, Auth, Welcome, AnytimeReset) use byte-identical wrapper markup, not slightly different reimplementations', () => {
    const authSource = read('./Auth.jsx');
    const anytimeResetSource = read('./AnytimeReset.jsx');
    for (const source of [introductionSource, authSource, welcomeSource, anytimeResetSource]) {
      expect(source).toContain(SCROLL_OUTER);
      expect(source).toContain(SCROLL_INNER);
    }
  });
});

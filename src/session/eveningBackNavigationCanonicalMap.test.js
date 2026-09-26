// Back-navigation repair — Evening half of the canonical Morning/Evening
// Back/Close map. Morning's own map (already fixed in commit 2dae04c) is
// covered by backNavigationCanonicalMap.test.js; this file covers the two
// genuine Evening-side gaps found during this pass's audit:
//
// 1. EveningComplete.jsx was missing the alwaysFallback fix
//    SessionComplete.jsx (Morning) already has - its own in-app history
//    always has the just-finished Prepare for Rest step behind it, so
//    BackButton's normal goBack would otherwise navigate(-1) straight back
//    into that completed step ("do not re-enter a completed journey using
//    browser Back").
// 2. EveningBreathing.jsx's active-phase Back did a plain navigate with no
//    stop-and-return-to-setup intercept, unlike Morning's identical
//    Stretch/Breathe screens (found live: inconsistent with the
//    established convention, even though the unmount cleanup already
//    stopped the timer for free).
//
// Every other Evening screen (EveningWindDown/Reflection/Gratitude/
// EveningMeditate/PrepareForRest) was already correct before this pass -
// EveningSceneShell has always rendered its BackButton with
// guardActiveRoute={false} (a prior "Build 15 Evening UX correction"),
// with a separate showExit control for the one real whole-routine exit -
// architecturally ahead of what Morning needed. No DOM/component
// rendering is available in this repo's Vitest - source-level checks,
// matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const eveningSceneShellSource = read('../components/evening/EveningSceneShell.jsx');
const eveningCompleteSource = read('../pages/EveningComplete.jsx');
const eveningBreathingSource = read('../pages/EveningBreathing.jsx');
const eveningWindDownSource = read('../pages/EveningWindDown.jsx');
const reflectionSource = read('../pages/Reflection.jsx');
const gratitudeSource = read('../pages/Gratitude.jsx');
const eveningMeditateSource = read('../pages/EveningMeditate.jsx');
const prepareForRestSource = read('../pages/PrepareForRest.jsx');

describe('EveningSceneShell — alwaysFallback pass-through, additive only', () => {
  it('accepts alwaysFallback (default false) and forwards it straight to the inner BackButton', () => {
    expect(eveningSceneShellSource).toMatch(/showBack = false, backFallback = '\/', onBeforeLeave, alwaysFallback = false, showExit = false, guardActiveRoute = false, journey = 'evening', children/);
    expect(eveningSceneShellSource).toMatch(/<BackButton\s*\n\s*fallback=\{backFallback\}\s*\n\s*className="!bg-black\/55 !border-white\/40"\s*\n\s*onBeforeLeave=\{onBeforeLeave\}\s*\n\s*guardActiveRoute=\{guardActiveRoute\}\s*\n\s*alwaysFallback=\{alwaysFallback\}\s*\n\s*\/>/);
  });

  // Release-candidate verification fix: guardActiveRoute defaults to false
  // (every existing caller unaffected) but is now a real pass-through, not
  // a hardcoded {false} - EveningWindDown.jsx is the one caller that opts
  // in (see the "EveningWindDown opts into guardActiveRoute" describe
  // block below), which this test's own regex must not contradict.
  it('guardActiveRoute is a genuine pass-through prop, not hardcoded to false in the JSX', () => {
    expect(eveningSceneShellSource).not.toMatch(/guardActiveRoute=\{false\}/);
  });
});

describe('Canonical map — Morning Complete -> Home is unaffected; Evening Complete -> Home only through its existing completion action, Back can never re-enter the completed journey', () => {
  it('EveningComplete.jsx passes alwaysFallback to EveningSceneShell', () => {
    expect(eveningCompleteSource).toMatch(/<EveningSceneShell atmosphere=\{\{ phase: 'moonlight' \}\} showBack backFallback="\/" alwaysFallback>/);
  });

  it('the real completion action (Return Home / handleReturnHome) is untouched: unpins/clears routine progress, navigates home, resets the session', () => {
    const body = eveningCompleteSource.match(/const handleReturnHome = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/unpinRoutineDate\(state\.sessionId\);/);
    expect(body).toMatch(/clearRoutineProgress\(state\.sessionId\);/);
    expect(body).toMatch(/navigate\('\/'\);/);
    expect(body).toMatch(/resetSession\(\);/);
  });
});

describe('Canonical map — every other Evening screen already had a plain, unguarded Back before this pass (Build 15 Evening UX correction) - confirmed unchanged', () => {
  it('Reflection/Gratitude/EveningMeditate/PrepareForRest all render EveningSceneShell with showBack, never passing guardActiveRoute themselves (the shell default keeps it false for them)', () => {
    for (const source of [reflectionSource, gratitudeSource, eveningMeditateSource, prepareForRestSource]) {
      expect(source).toMatch(/<EveningSceneShell[^>]*showBack/);
      expect(source).not.toMatch(/guardActiveRoute/);
    }
  });

  // Release-candidate verification fix: EveningWindDown is the one
  // exception to the rule above. It has no internal sub-questions and its
  // own unique route (sessionDefinitions.js's WIND_DOWN step), so
  // `activeRoute === location.pathname` is true only for the genuine
  // duration Wind-Down itself is the live step - exactly when the
  // canonical Evening map requires Back to show the same whole-routine
  // confirmation Exit already shows at the routine's first step. Confirmed
  // live: Back previously navigated straight Home with no confirmation at
  // all while Exit correctly showed one - see EveningSceneShell.jsx's own
  // doc comment for the full rationale.
  it('EveningWindDown opts into guardActiveRoute so first-step Back matches Exit\'s existing whole-routine confirmation', () => {
    expect(eveningWindDownSource).toMatch(/<EveningSceneShell atmosphere=\{\{ phase: 'dusk' \}\} showBack backFallback="\/" showExit guardActiveRoute>/);
  });

  it('EveningMeditate.jsx setup Back falls back to /evening-breathing; PrepareForRest.jsx Back falls back to /evening-meditate - matching Morning\'s identical per-step convention', () => {
    expect(eveningMeditateSource).toMatch(/showBack backFallback="\/evening-breathing"/);
    expect(prepareForRestSource).toMatch(/showBack backFallback="\/evening-meditate"/);
  });
});

describe('Canonical map — Active Breathing Back safely stops the exercise and returns to Breathing setup, mirroring Breathe.jsx/MorningFlow.jsx', () => {
  it('EveningBreathing.jsx wires onBeforeLeave={handleBackFromActive} into its EveningSceneShell', () => {
    expect(eveningBreathingSource).toMatch(/<EveningSceneShell atmosphere=\{\{ phase: 'moonlight' \}\} showBack backFallback="\/gratitude\?q=3" onBeforeLeave=\{handleBackFromActive\} showExit>/);
  });

  it('handleBackFromActive is a no-op (lets ordinary Back-to-Gratitude proceed) while not begun or gated for repeat', () => {
    const body = eveningBreathingSource.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!hasBegun \|\| isRepeatGated\) return;/);
  });

  it('while active, it resets the double-tap guard, clears the pause flag and phase/countdown, flips hasBegun off, stops any playing music, and cancels this tap\'s navigation', () => {
    const body = eveningBreathingSource.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/hasBegunOnceRef\.current = false;/);
    expect(body).toMatch(/setManuallyPaused\(false\);/);
    expect(body).toMatch(/setBreatheState\('Inhale'\);/);
    expect(body).toMatch(/setSecondsLeft\(activePattern\.totalSeconds\);/);
    expect(body).toMatch(/setHasBegun\(false\);/);
    expect(body).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    expect(body).toMatch(/return false;/);
  });
});

describe('Review-mode auto-start defect fix — Evening Breathing only trusts a paused snapshot when genuinely the live step', () => {
  it('trustedSnapshot is null unless isLiveStep is true at mount - found live: "Back from Meditation opened an already-running Breathing countdown, with no pattern choices available"', () => {
    expect(eveningBreathingSource).toMatch(/const trustedSnapshot = isLiveStep \? pausedSnapshot : null;/);
  });

  it('hasBegun/breatheState/secondsLeft/manuallyPaused/musicPreferenceOn all seed from trustedSnapshot, never the raw pausedSnapshot directly', () => {
    expect(eveningBreathingSource).toMatch(/const \[hasBegun, setHasBegun\] = useState\(\(\) => Boolean\(trustedSnapshot\)\);/);
    expect(eveningBreathingSource).toMatch(/const \[breatheState, setBreatheState\] = useState\(\(\) => trustedSnapshot\?\.breatheState \?\? 'Inhale'\);/);
    expect(eveningBreathingSource).toMatch(/const \[secondsLeft, setSecondsLeft\] = useState\(\(\) => trustedSnapshot\?\.secondsLeft \?\? activePattern\.totalSeconds\);/);
    expect(eveningBreathingSource).toMatch(/const \[manuallyPaused, setManuallyPaused\] = useState\(\(\) => Boolean\(trustedSnapshot\)\);/);
    expect(eveningBreathingSource).toMatch(/if \(trustedSnapshot\) return Boolean\(trustedSnapshot\.musicEnabled\);/);
  });

  it('the raw snapshot is still read and cleared unconditionally, regardless of isLiveStep - a stale one can never resurface later either way', () => {
    expect(eveningBreathingSource).toMatch(/const \[pausedSnapshot\] = useState\(\(\) => loadPausedExerciseState\('evening-wind-down', 'breathing'\)\);/);
    expect(eveningBreathingSource).toMatch(/useEffect\(\(\) => \{\s*\n\s*if \(pausedSnapshot\) clearPausedExerciseState\('evening-wind-down', 'breathing'\);\s*\n\s*\}, \[pausedSnapshot\]\);/);
  });
});

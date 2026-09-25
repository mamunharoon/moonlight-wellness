// Back-navigation repair — canonical Morning Back/Close map, audited and
// fixed across every Morning routine screen.
//
// The defect: BackButton's `guardActiveRoute` guard (default true) shows
// the whole-routine "Leave this routine?" confirmation whenever the
// current route IS the Session Engine's own live step. Every Morning step
// screen after Intention rendered its header Back with that default -
// meaning simply moving to the previous Morning step (Stretch -> Intention,
// Breathe -> Stretch, Meditation setup -> Breathe, Affirmation ->
// Meditation setup) incorrectly showed the whole-routine exit confirmation
// instead of just navigating back one step, every single time that screen
// was the live step (i.e. on every ordinary forward run through Morning,
// not just some edge case).
//
// Fix: the confirmation now appears only from the first step (Intention -
// unchanged) and from an explicit Close/X control that genuinely means
// "leave the whole routine" (Stretch/Breathe's Skip+Exit links, unchanged;
// MorningMeditate's active-phase Close/X, already correct before this fix).
// Every other Back is a plain, unconfirmed previous-step navigation
// (guardActiveRoute={false}). Active Stretch/Breathe additionally get a
// "safely stop, return to this step's own setup" intercept via BackButton's
// existing onBeforeLeave hook, rather than skipping straight to the prior
// step while a timer/music is still running. SessionComplete gets both
// guardActiveRoute={false} AND the new alwaysFallback prop, since its real
// in-app history always has the just-finished routine behind it.
//
// No DOM/component rendering is available in this repo's Vitest - source-
// level checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const backButtonSource = read('../components/BackButton.jsx');
const intentionSetupSource = read('../pages/IntentionSetup.jsx');
const morningFlowSource = read('../pages/MorningFlow.jsx');
const breatheSource = read('../pages/Breathe.jsx');
const morningMeditateSource = read('../pages/MorningMeditate.jsx');
const affirmationSource = read('../pages/Affirmation.jsx');
const sessionCompleteSource = read('../pages/SessionComplete.jsx');
const interactiveAmbientMusicSource = read('../components/InteractiveAmbientMusic.jsx');

describe('BackButton.jsx — new alwaysFallback prop, additive only', () => {
  it('defaults to false - every pre-existing caller that omits it keeps goBack\'s normal "prefer real history" behaviour', () => {
    expect(backButtonSource).toMatch(/alwaysFallback = false/);
  });

  it('imports useNavigate alongside the existing useLocation', () => {
    expect(backButtonSource).toMatch(/import \{ useLocation, useNavigate \} from 'react-router-dom';/);
  });

  it('when true, an ordinary-path tap (after the active-routine-step guard and onBeforeLeave) always replaces to fallback - never goBack/navigate(-1)', () => {
    const body = backButtonSource.match(/const handleClick = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(alwaysFallback\) \{\s*\n\s*navigate\(fallback, \{ replace: true \}\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*goBack\(fallback\);/);
    // alwaysFallback is checked AFTER the active-routine-step guard and
    // onBeforeLeave, never before - both can still short-circuit first.
    const guardIdx = body.indexOf('isActiveRoutineStep');
    const onBeforeLeaveIdx = body.indexOf('onBeforeLeave');
    const alwaysFallbackIdx = body.indexOf('alwaysFallback');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(alwaysFallbackIdx).toBeGreaterThan(onBeforeLeaveIdx);
    expect(onBeforeLeaveIdx).toBeGreaterThan(guardIdx);
  });

  it('handleLeave (the guarded "Leave routine" confirmation path) is untouched by alwaysFallback - it still always calls goBack(fallback)', () => {
    const body = backButtonSource.match(/const handleLeave = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/goBack\(fallback\);/);
  });
});

describe('InteractiveAmbientMusic.jsx — stop() exposed via ref alongside the existing start()', () => {
  // isPlaying() was added alongside start()/stop() in Build 16 (F6, the
  // guided-session-resume-music fix) - this block still only cares about
  // stop()'s own presence/behaviour, updated to match the current
  // three-key handle.
  it('useImperativeHandle now exposes { start, stop, isPlaying, preload }, including stop()', () => {
    expect(interactiveAmbientMusicSource).toMatch(/useImperativeHandle\(ref, \(\) => \(\{ start, stop, isPlaying, preload \}\)\);/);
  });

  it('stop() itself is unchanged - a plain audioRef.current?.pause()', () => {
    const body = interactiveAmbientMusicSource.match(/const stop = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/audioRef\.current\?\.pause\(\);/);
  });
});

describe('Canonical map — Intention Back (first step): unchanged, still the guarded whole-routine confirmation', () => {
  it('IntentionSetup.jsx keeps the default guarded BackButton, falling back to Home - there is no earlier Morning step to return to', () => {
    expect(intentionSetupSource).toMatch(/<BackButton fallback="\/" \/>/);
    expect(intentionSetupSource).not.toMatch(/guardActiveRoute/);
  });
});

describe('Canonical map — Stretch setup Back -> Intention; Active Stretch Back -> safely stop, return to Stretch setup', () => {
  it('the header BackButton has guardActiveRoute off and is wired to the new onBeforeLeave intercept', () => {
    expect(morningFlowSource).toMatch(/<BackButton fallback="\/intention-setup" guardActiveRoute=\{false\} onBeforeLeave=\{handleBackFromActive\} \/>/);
  });

  it('handleBackFromActive is a no-op (lets ordinary Back-to-Intention proceed) while not begun or gated for repeat', () => {
    const body = morningFlowSource.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!hasBegun \|\| isRepeatGated\) return;/);
  });

  it('while active, it resets the double-tap guard, clears the interrupt/pause flags and the locked sequence, flips hasBegun off, stops any playing music, and cancels this tap\'s navigation', () => {
    const body = morningFlowSource.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/hasBegunOnceRef\.current = false;/);
    expect(body).toMatch(/setVideoOpenedDuringExercise\(false\);/);
    expect(body).toMatch(/setManuallyPaused\(false\);/);
    expect(body).toMatch(/setActiveSequence\(null\);/);
    expect(body).toMatch(/setHasBegun\(false\);/);
    expect(body).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    expect(body).toMatch(/return false;/);
  });
});

describe('Canonical map — Breathe setup Back -> Stretch; Active Breathe Back -> safely stop, return to Breathe setup', () => {
  it('the header BackButton has guardActiveRoute off and is wired to the new onBeforeLeave intercept, falling back to Stretch (/morning-flow)', () => {
    expect(breatheSource).toMatch(/<BackButton fallback="\/morning-flow" guardActiveRoute=\{false\} onBeforeLeave=\{handleBackFromActive\} \/>/);
  });

  it('handleBackFromActive mirrors MorningFlow.jsx\'s own handler: no-op while not begun/gated, otherwise resets the run and stops music before cancelling navigation', () => {
    const body = breatheSource.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!hasBegun \|\| isRepeatGated\) return;/);
    expect(body).toMatch(/hasBegunOnceRef\.current = false;/);
    expect(body).toMatch(/setVideoOpenedDuringExercise\(false\);/);
    expect(body).toMatch(/setManuallyPaused\(false\);/);
    expect(body).toMatch(/setBreatheState\('Inhale'\);/);
    expect(body).toMatch(/setSecondsLeft\(activePattern\.totalSeconds\);/);
    expect(body).toMatch(/setHasBegun\(false\);/);
    expect(body).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    expect(body).toMatch(/return false;/);
  });
});

describe('Canonical map — Meditation setup Back -> Breathe; Active Meditation Back preserves the already-approved local "End this meditation?" behaviour', () => {
  it('the pre-start header BackButton falls back to /breathe with guardActiveRoute off - no onBeforeLeave intercept needed here (the active phase is a wholly separate render branch, not this BackButton at all)', () => {
    expect(morningMeditateSource).toMatch(/<BackButton fallback="\/breathe" guardActiveRoute=\{false\} \/>/);
  });

  it('the active phase\'s own Back/End Meditation (onRequestLeave=session.endSession, MeditationActiveSession) is untouched by this pass - still returns to this step\'s own setup without touching the Session Engine', () => {
    expect(morningMeditateSource).toMatch(/onRequestLeave=\{session\.endSession\}/);
  });

  it('the active phase\'s own Close/X (onRequestClose=handleRequestExitRoutine) is untouched - still the one real "Leave this routine?" confirmation while meditation is active', () => {
    expect(morningMeditateSource).toMatch(/onRequestClose=\{handleRequestExitRoutine\}/);
    expect(morningMeditateSource).toMatch(/title="Leave this routine\?"/);
  });
});

describe('Canonical map — Affirmation Back -> Meditation setup', () => {
  it('the header BackButton falls back to /morning-meditate with guardActiveRoute off', () => {
    expect(affirmationSource).toMatch(/<BackButton fallback="\/morning-meditate" guardActiveRoute=\{false\} \/>/);
  });
});

describe('Canonical map — Morning Complete -> Home only through its existing completion action; Back can never re-enter the completed journey', () => {
  it('SessionComplete.jsx\'s header BackButton has guardActiveRoute off (nothing left to "leave" once the routine is done) and alwaysFallback set (never goBack\'s navigate(-1), which would otherwise land back on the just-finished Affirmation step)', () => {
    expect(sessionCompleteSource).toMatch(/<BackButton fallback="\/" guardActiveRoute=\{false\} alwaysFallback \/>/);
  });

  it('the real completion action (Continue to Today / handleReturnHome) is untouched: writes daily completion, clears routine progress/pin, clears journeyStep, navigates home, resets the session', () => {
    const body = sessionCompleteSource.match(/const handleReturnHome = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setJourneyStep\(''\);/);
    expect(body).toMatch(/navigate\('\/'\);/);
    expect(body).toMatch(/resetSession\(\);/);
  });
});

describe('Whole-routine exit confirmation now appears in exactly the two intended places, nowhere else', () => {
  it('exactly one guarded (default guardActiveRoute) BackButton exists across the five step-screen files audited here - IntentionSetup.jsx\'s own, the first step', () => {
    const sources = [intentionSetupSource, morningFlowSource, breatheSource, morningMeditateSource, affirmationSource];
    const guardedBackButtons = sources
      .map((s) => s.match(/<BackButton fallback="[^"]*"(?: guardActiveRoute=\{false\})?(?: onBeforeLeave=\{[^}]*\})?(?: alwaysFallback)? \/>/g) ?? [])
      .flat()
      .filter((usage) => !usage.includes('guardActiveRoute={false}'));
    expect(guardedBackButtons.length).toBe(1);
    expect(guardedBackButtons[0]).toBe('<BackButton fallback="/" />');
  });

  it('the second intended place is MorningMeditate.jsx\'s own active-phase Close/X (handleRequestExitRoutine), a manual ConfirmDialog, not a guarded BackButton', () => {
    expect(morningMeditateSource).toMatch(/const handleRequestExitRoutine = \(\) => setExitConfirmOpen\(true\);/);
  });

  it('Skip/Exit-routine links on every setup screen remain their own pre-existing, deliberately unconfirmed quick-exit affordance - untouched by this pass (not a Close/X control this fix reworks)', () => {
    for (const source of [morningFlowSource, breatheSource, morningMeditateSource, affirmationSource]) {
      expect(source).toMatch(/Exit routine/);
    }
  });
});

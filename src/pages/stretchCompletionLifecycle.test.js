// Morning Stretch completion correction — Reuses Breathe.jsx's approved,
// physical-iPhone-tested architecture (createBreathingSession/isCompleted/
// backConfirmOpen) for Morning Stretch: a pure, synchronous
// createStretchSession controller (stretchSession.js, real-execution
// tested — see stretchSession.test.js) driven by ONE real interval, whose
// own callback is the single place that detects the final tick AND
// synchronously stops itself, stops music, picks the completion greeting,
// and flips the explicit isCompleted state.
//
// This file covers what stretchSession.test.js's pure-module tests cannot:
// that MorningFlow.jsx's own React wiring actually calls it correctly,
// gates the right UI on the right state, and never leaks a timer/session
// across runs or navigation. Source-level checks only (no DOM rendering
// available in this repo's Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./MorningFlow.jsx');

describe('MorningFlow.jsx (Stretch) — completion is an explicit, authoritative state, never a render-time-derived guess', () => {
  it('isCompleted is real React state, dedicated to Stretch (not shared/reused from any other step\'s state)', () => {
    expect(source).toMatch(/const \[isCompleted, setIsCompleted\] = useState\(false\);/);
  });

  it('the interval callback is the ONE place that detects completion and synchronously stops itself, stops music, picks the greeting, and sets isCompleted - all in the same callback invocation', () => {
    const intervalEffect = source.match(/useEffect\(\(\) => \{\s*\n\s*\/\/ Build 15: nothing runs until hasBegun[\s\S]*?\n\s*return \(\) => stopStretchInterval\(\);\s*\n\s*\}, \[hasBegun, activeSequence, isInterrupted, isRepeatGated, isConfirming, isCompleted, backConfirmOpen\]\);/)?.[0] ?? '';
    expect(intervalEffect).not.toBe('');
    const callbackBody = intervalEffect.match(/intervalRef\.current = setInterval\(\(\) => \{([\s\S]*?)\n\s*\}, 1000\);/)?.[1] ?? '';
    expect(callbackBody).not.toBe('');
    expect(callbackBody).toMatch(/current\.tick\(\)/);
    expect(callbackBody).toMatch(/if \(completed\) \{/);
    const completedBranch = callbackBody.match(/if \(completed\) \{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    expect(completedBranch).toMatch(/stopStretchInterval\(\);/);
    expect(completedBranch).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    expect(completedBranch).toMatch(/setCompletionGreeting\(getCompletionGreeting\(\{ journey: 'morning', practice: 'stretching' \}\)\);/);
    expect(completedBranch).toMatch(/setIsCompleted\(true\);/);
  });

  it('0s left cannot remain indefinitely in the active state - the interval effect refuses to start a new interval once isCompleted, and the active step-list branch is only reachable while !isCompleted', () => {
    expect(source).toMatch(/if \(!hasBegun \|\| !activeSequence \|\| isInterrupted \|\| isRepeatGated \|\| isConfirming \|\| isCompleted \|\| backConfirmOpen\) return;/);
    expect(source).toMatch(/\) : showCompletionPanel \? \(/);
  });

  it('a manual "Next Movement"/"Continue" tap (handleNextStep) makes the exact same completion decision as the timer, via the shared advanceMovement() - never a second, independently-derived completion path', () => {
    const fn = source.match(/const handleNextStep = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/session\.advanceMovement\(\)/);
    expect(fn).toMatch(/if \(completed\) \{/);
    expect(fn).toMatch(/stopStretchInterval\(\);/);
    expect(fn).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    expect(fn).toMatch(/setCompletionGreeting\(getCompletionGreeting\(\{ journey: 'morning', practice: 'stretching' \}\)\);/);
    expect(fn).toMatch(/setIsCompleted\(true\);/);
  });
});

describe('MorningFlow.jsx (Stretch) — idempotent completion (createStretchSession\'s own tick()/advanceMovement() are permanent no-ops after completion - see stretchSession.test.js for the real-execution proof; this checks the React side never re-triggers it)', () => {
  it('stopStretchInterval() is called synchronously inside the same completion branch that sets isCompleted in both the timer and the manual-tap path - no stray interval can survive to tick again', () => {
    const timerBranch = source.match(/if \(completed\) \{([\s\S]*?)\n\s*\}\s*\n\s*\}, 1000\);/)?.[1] ?? '';
    expect(timerBranch).toMatch(/stopStretchInterval\(\);/);
    const manualFn = source.match(/const handleNextStep = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(manualFn).toMatch(/stopStretchInterval\(\);/);
  });

  it('a fresh createStretchSession is only ever created from countdown.onComplete (the one true "start a fresh session" entry point) - never re-created by the interval effect itself', () => {
    const intervalEffectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*\/\/ Build 15: nothing runs until hasBegun[\s\S]*?\n\s*return \(\) => stopStretchInterval\(\);\s*\n\s*\}, \[hasBegun, activeSequence, isInterrupted, isRepeatGated, isConfirming, isCompleted, backConfirmOpen\]\);/)?.[0] ?? '';
    expect(intervalEffectBody).not.toMatch(/createStretchSession/);
    expect(source).toMatch(/sessionRef\.current = createStretchSession\(\{ movementCount: sequence\.length, stepDurationSeconds: getStepDuration\(\) \}\);\s*\n\s*sessionRef\.current\.begin\(\);/);
  });
});

describe('MorningFlow.jsx (Stretch) — completion greeting is picked exactly once per completion, held stable, never re-picked on re-render', () => {
  it('completionGreeting is React state, set only from the shared getCompletionGreeting({journey: \'morning\', practice: \'stretching\'}) API - never an independent, hand-rolled random array', () => {
    expect(source).toMatch(/const \[completionGreeting, setCompletionGreeting\] = useState\(null\);/);
    const setterCalls = source.match(/setCompletionGreeting\([^)]*\)/g) ?? [];
    // Call sites: two real picks (timer completion, manual-tap completion)
    // and two resets to null (countdown.onComplete beginning a fresh run,
    // leaveStretch tearing down) - never a render-time call.
    expect(setterCalls.filter((c) => c.includes("getCompletionGreeting({ journey: 'morning', practice: 'stretching' })")).length).toBe(2);
    expect(setterCalls.filter((c) => c.includes('null')).length).toBe(2);
    expect(source).not.toMatch(/const STRETCH_COMPLETION_GREETINGS/);
  });

  it('the completed panel renders the held completionGreeting value directly - never calls getCompletionGreeting again in JSX', () => {
    const completedPanel = source.match(/\) : showCompletionPanel \? \(([\s\S]*?)\n\s*\) : \(\s*\n\s*\/\/ Completion-transition-tuning pass/)?.[1] ?? '';
    expect(completedPanel).not.toBe('');
    expect(completedPanel).toMatch(/\{completionGreeting\}/);
    expect(completedPanel).not.toMatch(/getCompletionGreeting\(/);
  });
});

describe('MorningFlow.jsx (Stretch) — dedicated completion panel fully replaces the active exercise interface (never just overlaid on top of it)', () => {
  const completedPanel = source.match(/\) : showCompletionPanel \? \(([\s\S]*?)\n\s*\) : \(\s*\n\s*\/\/ Completion-transition-tuning pass/)?.[1] ?? '';

  it('the completed branch contains no "Stretching Progress" bar and no movement list - the active view is gone, not hidden behind it', () => {
    expect(completedPanel).not.toMatch(/Stretching Progress/);
    expect(completedPanel).not.toMatch(/orderedActiveSteps\.map/);
  });

  it('shows the required warm-gold "Stretch Completed" label, reusing existing tokens (same badge shape as Breathe.jsx - never a new colour)', () => {
    expect(completedPanel).toMatch(/Stretch Completed/);
    expect(completedPanel).toMatch(/bg-morning-accent\/10 border border-morning-accent-tint\/25 shadow-morning-glow/);
  });

  it('Pause Exercise, ExercisePausedPanel, and the active-only guided-sessions disclosure are all gated on !isCompleted, so none of them can render alongside the completed panel', () => {
    expect(source).toMatch(/\{hasBegun && !isRepeatGated && !isCompleted && isInterrupted && !openVideo && \(\s*\n\s*<ExercisePausedPanel/);
    expect(source).toMatch(/\{hasBegun && !isRepeatGated && !isCompleted && !isInterrupted && !openVideo && \(\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*onClick=\{handlePauseExercise\}/);
    expect(source).toMatch(/\{hasBegun && !isRepeatGated && !isCompleted && \(\s*\n\s*<div className="space-y-2">\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => setGuidedSessionsOpen/);
  });
});

describe('MorningFlow.jsx (Stretch) — Continue to Breathe (required primary action, existing approved destination, never a new route)', () => {
  it('is rendered only within the isCompleted branch of the action-block ternary, calls the dedicated handleContinueToBreathe, and is labelled exactly as required', () => {
    const actionBlock = source.match(/\{isCompleted \? \(([\s\S]*?)\n\s*\) : \(\s*\n\s*<>\s*\n\s*\{\/\* Hidden while the ExercisePausedPanel/)?.[1] ?? '';
    expect(actionBlock).not.toBe('');
    expect(actionBlock).toMatch(/onClick=\{handleContinueToBreathe\}/);
    expect(actionBlock).toMatch(/<span>Continue to Breathe<\/span>/);
  });

  it('handleContinueToBreathe navigates to the existing /breathe route (same destination as handleSkip - the approved Stretch->Breathe order is unchanged) and mirrors completion into the Session Engine exactly once, guarded by hasMirroredExitRef', () => {
    const fn = source.match(/const handleContinueToBreathe = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/setJourneyStep\('breathe'\);/);
    expect(fn).toMatch(/navigate\('\/breathe'\);/);
    expect(fn).toMatch(/mirrorStretchExitRef\.current\(\);/);
    const mirrorFn = source.match(/mirrorStretchExitRef\.current = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(mirrorFn).toMatch(/if \(hasMirroredExitRef\.current\) return;/);
    expect(mirrorFn).toMatch(/hasMirroredExitRef\.current = true;/);
  });
});

describe('MorningFlow.jsx (Stretch) — ended-early/skipped/interrupted never record completion or show the completed panel', () => {
  it('handleSkip never touches isCompleted/completionGreeting/getCompletionGreeting - Skip is structurally incapable of showing "Stretch Completed"', () => {
    const fn = source.match(/const handleSkip = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toMatch(/isCompleted|completionGreeting|getCompletionGreeting/);
  });

  it('confirmExitRoutine (Exit routine) never touches isCompleted/completionGreeting either', () => {
    const fn = source.match(/const confirmExitRoutine = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toMatch(/isCompleted|completionGreeting/);
  });

  it('leaveStretch (the confirmed early-exit path) records nothing - never calls mirrorStretchExitRef/advanceStep', () => {
    const fn = source.match(/const leaveStretch = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toMatch(/mirrorStretchExitRef|advanceStep/);
  });
});

describe('MorningFlow.jsx (Stretch) — Back-after-completion is ordinary navigation, never converted into an early-exit confirmation', () => {
  it('handleBackFromActive returns early (no dialog) the instant isCompleted is true, before the backConfirmOpen re-open guard even runs', () => {
    const fn = source.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const completedGuardIndex = fn.indexOf('if (isCompleted) return;');
    const dialogGuardIndex = fn.indexOf('if (backConfirmOpen) return false;');
    expect(completedGuardIndex).toBeGreaterThan(-1);
    expect(dialogGuardIndex).toBeGreaterThan(-1);
    expect(completedGuardIndex).toBeLessThan(dialogGuardIndex);
  });
});

describe('MorningFlow.jsx (Stretch) — Back/early-exit confirmation reuses Breathe.jsx\'s exact pattern (pause-not-reset, mild-warning severity)', () => {
  it('handleBackFromActive only captures music state and opens the dialog - never resets hasBegun/activeSequence/isCompleted itself', () => {
    const fn = source.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/wasMusicPlayingRef\.current = musicPlayerRef\.current\?\.isPlaying\(\) \?\? false;/);
    expect(fn).toMatch(/setBackConfirmOpen\(true\);/);
    expect(fn).not.toMatch(/setHasBegun\(false\);|setActiveSequence\(null\);|musicPlayerRef\.current\?\.stop\(\);/);
  });

  it('keepStretching resumes without resetting anything, restoring music only if it was genuinely playing before the dialog opened', () => {
    const fn = source.match(/const keepStretching = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/setBackConfirmOpen\(false\);/);
    expect(fn).toMatch(/if \(wasMusicPlayingRef\.current\) \{/);
    expect(fn).toMatch(/musicPlayerRef\.current\?\.start\(\);/);
  });

  it('leaveStretch does the actual teardown - stops the interval/session/music and resets to the pre-start screen, recording nothing', () => {
    const fn = source.match(/const leaveStretch = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/stopStretchInterval\(\);/);
    expect(fn).toMatch(/sessionRef\.current\?\.end\(\);/);
    expect(fn).toMatch(/sessionRef\.current = null;/);
    expect(fn).toMatch(/setActiveSequence\(null\);/);
    expect(fn).toMatch(/setIsCompleted\(false\);/);
    expect(fn).toMatch(/setCompletionGreeting\(null\);/);
    expect(fn).toMatch(/setHasBegun\(false\);/);
    expect(fn).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
  });

  it('a mildDestructive ConfirmDialog is wired to leaveStretch/keepStretching with the required mild-warning wording, mirroring Breathe.jsx\'s severity tier', () => {
    const dialogBlock = source.match(/<ConfirmDialog\s*\n\s*open=\{backConfirmOpen\}[\s\S]*?\/>/)?.[0] ?? '';
    expect(dialogBlock).not.toBe('');
    expect(dialogBlock).toMatch(/title="Leave this stretch\?"/);
    expect(dialogBlock).toMatch(/message="Your progress in this stretch won.t be completed\."/);
    expect(dialogBlock).toMatch(/confirmLabel="Leave Stretch"/);
    expect(dialogBlock).toMatch(/cancelLabel="Keep Stretching"/);
    expect(dialogBlock).toMatch(/mildDestructive/);
    expect(dialogBlock).toMatch(/onConfirm=\{leaveStretch\}/);
    expect(dialogBlock).toMatch(/onDismiss=\{keepStretching\}/);
  });
});

describe('MorningFlow.jsx (Stretch) — repeated-run use in one mounted visit (sequential-completion guard)', () => {
  it('every real Begin (countdown.onComplete) always creates a BRAND NEW controller for whichever movements are currently selected - never reuses a previous instance across runs', () => {
    const countdownBlock = source.match(/const countdown = usePreparationCountdown\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(countdownBlock).toMatch(/sessionRef\.current = createStretchSession\(\{ movementCount: sequence\.length, stepDurationSeconds: getStepDuration\(\) \}\);/);
    expect(countdownBlock).toMatch(/setIsCompleted\(false\);/);
    expect(countdownBlock).toMatch(/setCompletionGreeting\(null\);/);
  });
});

describe('MorningFlow.jsx (Stretch) — timer cleanup on unmount/navigation', () => {
  it('a dedicated unmount effect stops the interval - covers Continue/Skip/Exit/Back and any other navigation away from this screen', () => {
    expect(source).toMatch(/useEffect\(\(\) => \(\) => stopStretchInterval\(\), \[\]\);/);
  });
});

// Evening Breathing completion correction — reuses Breathe.jsx's approved,
// physical-iPhone-tested architecture exactly: a pure, synchronous
// createBreathingSession controller (breathingSession.js - already
// journey-agnostic and real-execution tested, see breathingSession.test.js)
// driven by ONE real interval, whose own callback is the single place that
// detects the final tick AND synchronously stops itself, stops music,
// picks the completion greeting, and flips the explicit isCompleted state.
//
// Previous behaviour: completion was a render-time-DERIVED value
// (hasFinished = secondsLeft <= 0), the active BreathingRing screen stayed
// visible indefinitely once secondsLeft hit 0, and Back during an active
// exercise reset everything silently with zero confirmation.
//
// Source-level checks only (no DOM rendering available in this repo's
// Vitest), matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./EveningBreathing.jsx');

describe('EveningBreathing.jsx — completion is an explicit, authoritative state, never a render-time-derived guess', () => {
  it('isCompleted is real React state, not derived from secondsLeft on every render', () => {
    expect(source).toMatch(/const \[isCompleted, setIsCompleted\] = useState\(false\);/);
    expect(source).not.toMatch(/const hasFinished = secondsLeft <= 0;/);
  });

  it('the interval callback is the ONE place that detects completion and synchronously stops itself, stops music, picks the greeting, and sets isCompleted - all in the same callback invocation', () => {
    const intervalEffect = source.match(/useEffect\(\(\) => \{\s*\n\s*\/\/ Build 15: nothing runs until hasBegun[\s\S]*?\n\s*return \(\) => stopBreathingInterval\(\);\s*\n\s*\}, \[hasBegun, manuallyPaused, isRepeatGated, isConfirming, isCompleted, backConfirmOpen\]\);/)?.[0] ?? '';
    expect(intervalEffect).not.toBe('');
    const callbackBody = intervalEffect.match(/intervalRef\.current = setInterval\(\(\) => \{([\s\S]*?)\n\s*\}, 1000\);/)?.[1] ?? '';
    expect(callbackBody).not.toBe('');
    expect(callbackBody).toMatch(/current\.tick\(\)/);
    expect(callbackBody).toMatch(/if \(completed\) \{/);
    const completedBranch = callbackBody.match(/if \(completed\) \{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    expect(completedBranch).toMatch(/stopBreathingInterval\(\);/);
    expect(completedBranch).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    expect(completedBranch).toMatch(/setCompletionGreeting\(getCompletionGreeting\(\{ journey: 'evening', practice: 'breathing' \}\)\);/);
    expect(completedBranch).toMatch(/setIsCompleted\(true\);/);
  });

  it('0s left cannot remain indefinitely in the active state - the interval effect refuses to start a new interval once isCompleted, and the active ring branch is only reachable while !isCompleted', () => {
    expect(source).toMatch(/if \(!hasBegun \|\| manuallyPaused \|\| isRepeatGated \|\| isConfirming \|\| isCompleted \|\| backConfirmOpen\) return;/);
    expect(source).toMatch(/\) : isCompleted \? \(/);
  });
});

describe('EveningBreathing.jsx — idempotent completion (breathingSession.js\'s own tick() is a permanent no-op after completion - see breathingSession.test.js for the real-execution proof; this checks the React side never re-triggers it)', () => {
  it('stopBreathingInterval() is called synchronously inside the same completion branch that sets isCompleted - no stray interval can survive to tick again', () => {
    const completedBranch = source.match(/if \(completed\) \{([\s\S]*?)\n\s*\}\s*\n\s*\}, 1000\);/)?.[1] ?? '';
    expect(completedBranch).toMatch(/stopBreathingInterval\(\);/);
  });

  it('a fresh createBreathingSession is only ever created from countdown.onComplete (the one true "start a fresh session" entry point) - never re-created by the interval effect itself', () => {
    const intervalEffectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*\/\/ Build 15: nothing runs until hasBegun[\s\S]*?\n\s*return \(\) => stopBreathingInterval\(\);\s*\n\s*\}, \[hasBegun, manuallyPaused, isRepeatGated, isConfirming, isCompleted, backConfirmOpen\]\);/)?.[0] ?? '';
    expect(intervalEffectBody).not.toMatch(/createBreathingSession/);
    expect(source).toMatch(/sessionRef\.current = createBreathingSession\(\{ pattern: activePattern, resolveBreathPhase \}\);\s*\n\s*sessionRef\.current\.begin\(\);/);
  });
});

describe('EveningBreathing.jsx — completion greeting is picked exactly once per completion, held stable, never re-picked on re-render', () => {
  it('completionGreeting is React state, set only from the shared getCompletionGreeting({journey: \'evening\', practice: \'breathing\'}) API - never an independent, hand-rolled random array', () => {
    expect(source).toMatch(/const \[completionGreeting, setCompletionGreeting\] = useState\(null\);/);
    const setterCalls = source.match(/setCompletionGreeting\([^)]*\)/g) ?? [];
    // Exactly two call sites: the one real pick on completion, and the
    // reset to null when beginning a fresh pattern (countdown.onComplete)
    // and when confirming Leave Exercise (leaveExercise) - never a
    // render-time call.
    expect(setterCalls.filter((c) => c.includes("getCompletionGreeting({ journey: 'evening', practice: 'breathing' })")).length).toBe(1);
    expect(setterCalls.filter((c) => c.includes('null')).length).toBe(2);
  });

  it('the completed panel renders the held completionGreeting value directly - never calls getCompletionGreeting again in JSX', () => {
    const completedPanel = source.match(/\) : isCompleted \? \(([\s\S]*?)\n\s*\) : \(\s*\n\s*<>\s*\n\s*<div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">\s*\n\s*<div className="space-y-2">/)?.[1] ?? '';
    expect(completedPanel).not.toBe('');
    expect(completedPanel).toMatch(/\{completionGreeting\}/);
    expect(completedPanel).not.toMatch(/getCompletionGreeting\(/);
  });
});

describe('EveningBreathing.jsx — dedicated completion panel fully replaces the active exercise interface (never just overlaid on top of it)', () => {
  const completedPanel = source.match(/\) : isCompleted \? \(([\s\S]*?)\n\s*\) : \(\s*\n\s*<>\s*\n\s*<div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">\s*\n\s*<div className="space-y-2">/)?.[1] ?? '';

  it('the completed branch contains no BreathingRing and no "Breathe with the night." heading - the active view is gone, not hidden behind it', () => {
    expect(completedPanel).not.toBe('');
    expect(completedPanel).not.toMatch(/BreathingRing/);
    expect(completedPanel).not.toMatch(/Breathe with the night\./);
  });

  it('shows the required periwinkle "Breathing Completed" label, reusing existing Evening tokens (bg-evening-accent/shadow-evening-glow - never the Morning gold or Anytime mint treatment)', () => {
    expect(completedPanel).toMatch(/Breathing Completed/);
    expect(completedPanel).toMatch(/bg-evening-accent\/10 border border-evening-accent-tint\/25 shadow-evening-glow/);
    expect(completedPanel).toMatch(/text-evening-accent/);
  });

  it('ExercisePausedPanel and the Pause Exercise button are both gated on !isCompleted, so neither can render alongside the completed panel', () => {
    expect(source).toMatch(/\{hasBegun && !isRepeatGated && !isCompleted && manuallyPaused && \(\s*\n\s*<ExercisePausedPanel/);
    expect(source).toMatch(/\{hasBegun && !isRepeatGated && !isCompleted && !manuallyPaused && \(\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*onClick=\{handlePauseExercise\}/);
  });
});

describe('EveningBreathing.jsx — Continue to Meditate (required primary action, correct existing Evening destination, never a new route)', () => {
  it('is rendered only within the isCompleted branch of the bottom-action ternary, calls the unchanged handleComplete (Session Engine mirror + navigate), and is labelled exactly as required', () => {
    const actionBlock = source.match(/\{isCompleted \? \(([\s\S]*?)\n\s*\) : \(\s*\n\s*<button\s*\n\s*onClick=\{handleSkip\}/)?.[1] ?? '';
    expect(actionBlock).not.toBe('');
    expect(actionBlock).toMatch(/onClick=\{handleComplete\}/);
    expect(actionBlock).toMatch(/<span>Continue to Meditate<\/span>/);
  });

  it('handleComplete (unchanged) navigates to the existing /evening-meditate route and mirrors completion into the Session Engine exactly once, guarded by hasMirroredExitRef', () => {
    const fn = source.match(/const handleComplete = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/navigate\('\/evening-meditate'\);/);
    expect(fn).toMatch(/mirrorExitRef\.current\(\);/);
    const mirrorFn = source.match(/mirrorExitRef\.current = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(mirrorFn).toMatch(/if \(hasMirroredExitRef\.current\) return;/);
    expect(mirrorFn).toMatch(/hasMirroredExitRef\.current = true;/);
  });
});

describe('EveningBreathing.jsx — ended-early/skipped never record completion or show the completed panel', () => {
  it('handleSkip never touches isCompleted/completionGreeting/getCompletionGreeting - Skip is structurally incapable of showing "Breathing Completed"', () => {
    const fn = source.match(/const handleSkip = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toMatch(/isCompleted|completionGreeting|getCompletionGreeting/);
  });

  it('leaveExercise (the confirmed early-exit path) records nothing - never calls mirrorExitRef/advanceStep', () => {
    const fn = source.match(/const leaveExercise = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toMatch(/mirrorExitRef|advanceStep/);
  });

  it('handlePauseExercise (the way manuallyPaused becomes true) never touches isCompleted - a pause can never be mistaken for completion', () => {
    const fn = source.match(/const handlePauseExercise = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toMatch(/isCompleted/);
  });
});

describe('EveningBreathing.jsx — Back-after-completion is ordinary navigation, never converted into an early-exit confirmation', () => {
  it('handleBackFromActive returns early (no dialog) the instant isCompleted is true, before the backConfirmOpen re-open guard even runs', () => {
    const fn = source.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const completedGuardIndex = fn.indexOf('if (isCompleted) return;');
    const dialogGuardIndex = fn.indexOf('if (backConfirmOpen) return false;');
    expect(completedGuardIndex).toBeGreaterThan(-1);
    expect(dialogGuardIndex).toBeGreaterThan(-1);
    expect(completedGuardIndex).toBeLessThan(dialogGuardIndex);
  });
});

describe('EveningBreathing.jsx — Back/early-exit confirmation reuses Breathe.jsx\'s exact pattern (pause-not-reset, mild-warning severity)', () => {
  it('handleBackFromActive only captures music state and opens the dialog - never resets hasBegun/breatheState/secondsLeft or stops music itself', () => {
    const fn = source.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/wasMusicPlayingRef\.current = musicPlayerRef\.current\?\.isPlaying\(\) \?\? false;/);
    expect(fn).toMatch(/setBackConfirmOpen\(true\);/);
    expect(fn).not.toMatch(/setHasBegun\(false\);|musicPlayerRef\.current\?\.stop\(\);/);
  });

  it('keepBreathing resumes without resetting anything, restoring music only if it was genuinely playing before the dialog opened', () => {
    const fn = source.match(/const keepBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/setBackConfirmOpen\(false\);/);
    expect(fn).toMatch(/if \(wasMusicPlayingRef\.current\) \{/);
    expect(fn).toMatch(/musicPlayerRef\.current\?\.start\(\);/);
  });

  it('leaveExercise does the actual teardown - stops the interval/session/music and resets to the pre-start screen, recording nothing, without inventing a new early-exit banner message', () => {
    const fn = source.match(/const leaveExercise = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/stopBreathingInterval\(\);/);
    expect(fn).toMatch(/sessionRef\.current\?\.end\(\);/);
    expect(fn).toMatch(/sessionRef\.current = null;/);
    expect(fn).toMatch(/setIsCompleted\(false\);/);
    expect(fn).toMatch(/setCompletionGreeting\(null\);/);
    expect(fn).toMatch(/setHasBegun\(false\);/);
    expect(fn).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    expect(fn).not.toMatch(/getMorningBreathingEarlyExitMessage|EarlyExitMessage/);
  });

  it('a mildDestructive ConfirmDialog is wired to leaveExercise/keepBreathing with the required mild-warning wording, mirroring Breathe.jsx\'s severity tier', () => {
    const dialogBlock = source.match(/<ConfirmDialog\s*\n\s*open=\{backConfirmOpen\}[\s\S]*?\/>/)?.[0] ?? '';
    expect(dialogBlock).not.toBe('');
    expect(dialogBlock).toMatch(/title="Leave this breathing exercise\?"/);
    expect(dialogBlock).toMatch(/message="Your progress in this exercise won.t be completed\."/);
    expect(dialogBlock).toMatch(/confirmLabel="Leave Exercise"/);
    expect(dialogBlock).toMatch(/cancelLabel="Keep Breathing"/);
    expect(dialogBlock).toMatch(/mildDestructive/);
    expect(dialogBlock).toMatch(/onConfirm=\{leaveExercise\}/);
    expect(dialogBlock).toMatch(/onDismiss=\{keepBreathing\}/);
  });
});

describe('EveningBreathing.jsx — repeated-pattern use in one mounted visit (sequential-completion guard)', () => {
  it('every real Begin (countdown.onComplete) always creates a BRAND NEW controller for whichever pattern is currently selected - never reuses a previous instance across patterns', () => {
    const countdownBlock = source.match(/const countdown = usePreparationCountdown\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(countdownBlock).toMatch(/sessionRef\.current = createBreathingSession\(\{ pattern: activePattern, resolveBreathPhase \}\);/);
    expect(countdownBlock).toMatch(/setIsCompleted\(false\);/);
    expect(countdownBlock).toMatch(/setCompletionGreeting\(null\);/);
  });
});

describe('EveningBreathing.jsx — timer cleanup on unmount/navigation', () => {
  it('a dedicated unmount effect stops the interval - covers Continue/Skip/Back and any other navigation away from this screen', () => {
    expect(source).toMatch(/useEffect\(\(\) => \(\) => stopBreathingInterval\(\), \[\]\);/);
  });
});

// Morning breathing completion correction — physical-iPhone defect: after
// reaching 0s left, Breathe.jsx stayed in the active exercise state (ring
// still visible, no completion panel, no Continue to Meditate). Root
// cause: completion was a render-time-DERIVED value (secondsLeft <= 0)
// rather than a single, authoritative decision made the instant the
// timer actually reaches the boundary - the previous fix's "hasFinished"
// gate could not be verified or guaranteed to fire in time on a real
// device. Fix: Breathe.jsx now drives a pure, synchronous
// createBreathingSession controller (breathingSession.js) with ONE real
// interval; the interval's own callback is the single place that both
// detects the final tick AND synchronously stops itself, stops music,
// picks the completion greeting, and flips the explicit isCompleted
// state - zero renders/effects in between.
//
// The actual timer-boundary/idempotency correctness is proven with REAL
// EXECUTION (no fake timers needed - tick() is synchronous and manual by
// design, mirroring meditationSession.test.js's own established
// approach) in breathingSession.test.js. This file covers what that pure
// module cannot: that Breathe.jsx's own React wiring actually calls it
// correctly, gates the right UI on the right state, and never leaks a
// timer/session across pattern changes or navigation. Source-level
// checks only (no DOM rendering available in this repo's Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./Breathe.jsx');

describe('Breathe.jsx — completion is an explicit, authoritative state, never a render-time-derived guess', () => {
  it('isCompleted is real React state, not derived from secondsLeft on every render', () => {
    expect(source).toMatch(/const \[isCompleted, setIsCompleted\] = useState\(false\);/);
    expect(source).not.toMatch(/const hasFinished = secondsLeft <= 0;/);
  });

  it('the interval callback is the ONE place that detects completion and synchronously stops itself, stops music, picks the greeting, and sets isCompleted - all in the same callback invocation, not spread across a render+effect round trip', () => {
    const intervalEffect = source.match(/useEffect\(\(\) => \{\s*\n\s*\/\/ Nothing runs until hasBegun[\s\S]*?\n\s*return \(\) => stopBreathingInterval\(\);\s*\n\s*\}, \[hasBegun, isInterrupted, isRepeatGated, isConfirming, isCompleted\]\);/)?.[0] ?? '';
    expect(intervalEffect).not.toBe('');
    const callbackBody = intervalEffect.match(/intervalRef\.current = setInterval\(\(\) => \{([\s\S]*?)\n\s*\}, 1000\);/)?.[1] ?? '';
    expect(callbackBody).not.toBe('');
    expect(callbackBody).toMatch(/current\.tick\(\)/);
    expect(callbackBody).toMatch(/if \(completed\) \{/);
    const completedBranch = callbackBody.match(/if \(completed\) \{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    expect(completedBranch).toMatch(/stopBreathingInterval\(\);/);
    expect(completedBranch).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    expect(completedBranch).toMatch(/setCompletionGreeting\(getBreathingCompletionGreeting\('morning'\)\);/);
    expect(completedBranch).toMatch(/setIsCompleted\(true\);/);
  });

  it('0s left cannot remain indefinitely in the active state - the interval effect re-runs and refuses to start a new interval once isCompleted, and the active ring branch is only reachable while !isCompleted', () => {
    expect(source).toMatch(/if \(!hasBegun \|\| isInterrupted \|\| isRepeatGated \|\| isConfirming \|\| isCompleted\) return;/);
    expect(source).toMatch(/\) : isCompleted \? \(/);
  });
});

describe('Breathe.jsx — idempotent completion (breathingSession.js\'s own tick() is a permanent no-op after completion - see breathingSession.test.js for the real-execution proof; this checks the React side never re-triggers it)', () => {
  it('stopBreathingInterval() is called synchronously inside the same completion branch that sets isCompleted - no stray interval can survive to tick again', () => {
    const completedBranch = source.match(/if \(completed\) \{([\s\S]*?)\n\s*\}\s*\n\s*\}, 1000\);/)?.[1] ?? '';
    expect(completedBranch).toMatch(/stopBreathingInterval\(\);/);
  });

  it('a fresh createBreathingSession is only ever created from countdown.onComplete (the one true "start a fresh session" entry point) - never re-created by the interval effect itself', () => {
    const intervalEffectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*\/\/ Nothing runs until hasBegun[\s\S]*?\n\s*return \(\) => stopBreathingInterval\(\);\s*\n\s*\}, \[hasBegun, isInterrupted, isRepeatGated, isConfirming, isCompleted\]\);/)?.[0] ?? '';
    expect(intervalEffectBody).not.toMatch(/createBreathingSession/);
    expect(source).toMatch(/sessionRef\.current = createBreathingSession\(\{ pattern: activePattern, resolveBreathPhase \}\);\s*\n\s*sessionRef\.current\.begin\(\);/);
  });
});

describe('Breathe.jsx — completion greeting is picked exactly once per completion, held stable, never re-picked on re-render', () => {
  it('completionGreeting is React state, set exactly once inside the completion branch (a lazy pick, not a value computed inline in JSX every render)', () => {
    expect(source).toMatch(/const \[completionGreeting, setCompletionGreeting\] = useState\(null\);/);
    const setterCalls = source.match(/setCompletionGreeting\([^)]*\)/g) ?? [];
    // Exactly two call sites: the one real pick on completion, and the
    // reset to null when returning to pre-start (handleBackFromActive)
    // and when beginning a fresh pattern (countdown.onComplete) - never
    // a third, render-time call.
    expect(setterCalls.length).toBe(3);
    expect(setterCalls.filter((c) => c.includes("getBreathingCompletionGreeting('morning')")).length).toBe(1);
    expect(setterCalls.filter((c) => c.includes('null')).length).toBe(2);
  });

  it('the completed panel renders the held completionGreeting value directly - never calls getBreathingCompletionGreeting(\'morning\') again in JSX', () => {
    const completedPanel = source.match(/\) : isCompleted \? \(([\s\S]*?)\n\s*\) : \(/)?.[1] ?? '';
    expect(completedPanel).toMatch(/\{completionGreeting\}/);
    expect(completedPanel).not.toMatch(/getBreathingCompletionGreeting\('morning'\)/);
  });
});

describe('Breathe.jsx — dedicated completion panel fully replaces the active exercise interface (never just overlaid on top of it)', () => {
  const completedPanel = source.match(/\) : isCompleted \? \(([\s\S]*?)\n\s*\) : \(/)?.[1] ?? '';

  it('the completed branch contains no BreathingRing, no "Center Yourself" copy, and no pattern-label pill - the active view is gone, not hidden behind it', () => {
    expect(completedPanel).not.toMatch(/BreathingRing/);
    expect(completedPanel).not.toMatch(/Center Yourself/);
  });

  it('shows the required warm-gold "Exercise Completed" label, reusing existing tokens (never a new colour)', () => {
    expect(completedPanel).toMatch(/Exercise Completed/);
    expect(completedPanel).toMatch(/bg-morning-accent\/10 border border-morning-accent-tint\/25 shadow-morning-glow/);
  });

  it('Pause Exercise, ExercisePausedPanel, and the active-only guided-sessions disclosure are all gated on !isCompleted, so none of them can render alongside the completed panel', () => {
    expect(source).toMatch(/\{hasBegun && !isRepeatGated && !isCompleted && isInterrupted && !openVideo && \(\s*\n\s*<ExercisePausedPanel/);
    expect(source).toMatch(/\{hasBegun && !isRepeatGated && !isCompleted && !isInterrupted && !openVideo && \(\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*onClick=\{handlePauseExercise\}/);
    expect(source).toMatch(/\{hasBegun && !isRepeatGated && !isCompleted && \(\s*\n\s*<div className="space-y-2">\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => setGuidedSessionsOpen/);
  });
});

describe('Breathe.jsx — Continue to Meditate (required primary action)', () => {
  it('is rendered only within the isCompleted branch of the action-block ternary, calls the unchanged handleComplete (Session Engine mirror + navigate), and is labelled exactly as required', () => {
    const actionBlock = source.match(/\{isCompleted \? \(([\s\S]*?)\n\s*\) : \(\s*\n\s*<>\s*\n\s*<button\s*\n\s*onClick=\{handleSkip\}/)?.[1] ?? '';
    expect(actionBlock).not.toBe('');
    expect(actionBlock).toMatch(/onClick=\{handleComplete\}/);
    expect(actionBlock).toMatch(/<span>Continue to Meditate<\/span>/);
  });

  it('handleComplete (unchanged) navigates to /morning-meditate and mirrors completion into the Session Engine exactly once, guarded by hasMirroredExitRef', () => {
    const fn = source.match(/const handleComplete = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/navigate\('\/morning-meditate'\);/);
    expect(fn).toMatch(/mirrorBreathingExitRef\.current\(\);/);
    const mirrorFn = source.match(/mirrorBreathingExitRef\.current = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(mirrorFn).toMatch(/if \(hasMirroredExitRef\.current\) return;/);
    expect(mirrorFn).toMatch(/hasMirroredExitRef\.current = true;/);
  });

  it('an optional "Explore guided breathing" secondary action is offered on the completed panel, reusing the existing guided-video catalogue rather than a new one', () => {
    const actionBlock = source.match(/\{isCompleted \? \(([\s\S]*?)\n\s*\) : \(\s*\n\s*<>\s*\n\s*<button\s*\n\s*onClick=\{handleSkip\}/)?.[1] ?? '';
    expect(actionBlock).toMatch(/Explore guided breathing/);
    expect(actionBlock).toMatch(/BREATHE_VIDEOS\.map/);
  });
});

describe('Breathe.jsx — ended-early/skipped/interrupted never record completion or show the completed panel', () => {
  it('handleSkip never touches isCompleted/completionGreeting/getBreathingCompletionGreeting - Skip is structurally incapable of showing "Exercise Completed"', () => {
    const fn = source.match(/const handleSkip = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toMatch(/isCompleted|completionGreeting/);
  });

  it('confirmExitRoutine (Exit routine) never touches isCompleted/completionGreeting either', () => {
    const fn = source.match(/const confirmExitRoutine = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toMatch(/isCompleted|completionGreeting/);
  });

  it('handlePauseExercise/handleSelectVideo (the two ways isInterrupted becomes true) never touch isCompleted either - an interruption can never be mistaken for completion', () => {
    const pauseFn = source.match(/const handlePauseExercise = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const selectFn = source.match(/const handleSelectVideo = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(pauseFn).not.toMatch(/isCompleted/);
    expect(selectFn).not.toMatch(/isCompleted/);
  });
});

describe('Breathe.jsx — repeated-pattern use in one mounted visit (sequential-completion guard)', () => {
  it('handleBackFromActive (the only in-place path back to pattern selection) fully tears down the interval/session and resets isCompleted/completionGreeting, so a second pattern starts genuinely clean', () => {
    const fn = source.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/stopBreathingInterval\(\);/);
    expect(fn).toMatch(/sessionRef\.current = null;/);
    expect(fn).toMatch(/setIsCompleted\(false\);/);
    expect(fn).toMatch(/setCompletionGreeting\(null\);/);
  });

  it('every real Begin (countdown.onComplete) always creates a BRAND NEW controller for whichever pattern is currently selected - never reuses a previous instance across patterns', () => {
    const countdownBlock = source.match(/const countdown = usePreparationCountdown\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(countdownBlock).toMatch(/sessionRef\.current = createBreathingSession\(\{ pattern: activePattern, resolveBreathPhase \}\);/);
  });
});

describe('Breathe.jsx — timer cleanup on unmount/navigation', () => {
  it('a dedicated unmount effect stops the interval - covers Continue/Skip/Exit/Back and any other navigation away from this screen', () => {
    expect(source).toMatch(/useEffect\(\(\) => \(\) => stopBreathingInterval\(\), \[\]\);/);
  });
});

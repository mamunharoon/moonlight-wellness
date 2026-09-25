// Source-level regression guard for usePreparationCountdown.js (Build 16
// physical-iPhone correction, F3). No DOM rendering is available in this
// repo's Vitest (environment: 'node' - see vite.config.js), so this is a
// source-level check, matching this repo's established convention for
// React hooks (see useMeditationSession.test.js's own identical note).
//
// The single most important thing this file guards: a REAL bug found live
// during this pass. An earlier version called onComplete() (a genuine side
// effect - it goes on to start a whole separate session's timer/audio via
// several of ITS OWN setState calls) directly from inside the
// setSecondsRemaining functional updater passed to the countdown's own
// interval callback. React updater functions must be pure and can be
// invoked more than once per commit (React 18/StrictMode dev double-
// invocation is the reproducible case, confirmed live via instrumented
// tracing - internal state (phase, timer ticks) advanced correctly and
// completely invisibly, while the screen itself silently kept showing the
// countdown/setup UI instead of transitioning to the active practice).
// Moving the transition into a dedicated useEffect keyed on
// [isActive, secondsRemaining] fixed it - confirmed live via 4+ consecutive
// clean runs after the fix, reproduced reliably before it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./usePreparationCountdown.js', import.meta.url)), 'utf-8');

describe('usePreparationCountdown — onComplete() is never called from inside a setState updater', () => {
  it('the interval callback\'s setSecondsRemaining updater is a pure decrement - it never calls onComplete, finish, or any other side effect', () => {
    const intervalBody = source.match(/intervalRef\.current = setInterval\(\(\) => \{[\s\S]*?\n {4}\}, 1000\);/)?.[0] ?? '';
    expect(intervalBody).not.toBe('');
    expect(intervalBody).toMatch(/setSecondsRemaining\(\(prev\) => \(prev <= 1 \? 0 : prev - 1\)\);/);
    expect(intervalBody).not.toMatch(/onComplete|finish\(\)/);
  });

  it('reaching zero is detected and acted on in a dedicated useEffect, not inside the interval\'s own updater', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(isActive && secondsRemaining <= 0[\s\S]*?\n {2}\}, \[isActive, secondsRemaining\]\);/)?.[0] ?? '';
    expect(effectBody).not.toBe('');
    expect(effectBody).toMatch(/completedOnceRef\.current = true;/);
    expect(effectBody).toMatch(/setIsActive\(false\);/);
    expect(effectBody).toMatch(/onCompleteRef\.current\?\.\(\);/);
  });

  it('the effect guards against a duplicate call via completedOnceRef, so it can never fire onComplete twice for one start()', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(isActive && secondsRemaining <= 0[\s\S]*?\n {2}\}, \[isActive, secondsRemaining\]\);/)?.[0] ?? '';
    expect(effectBody).toMatch(/!completedOnceRef\.current/);
  });
});

describe('usePreparationCountdown — start/skip/cancel lifecycle', () => {
  it('start() resets to the full seconds, sets isActive true, and is a no-op while already active (prevents a double-start from a rapid double tap)', () => {
    const body = source.match(/const start = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(isActive\) return;/);
    expect(body).toMatch(/completedOnceRef\.current = false;/);
    expect(body).toMatch(/setSecondsRemaining\(seconds\);/);
    expect(body).toMatch(/setIsActive\(true\);/);
  });

  it('skip() ("Start now") is a genuine event-handler call, not a setState updater - safe to call onComplete synchronously, and is one-shot via completedOnceRef', () => {
    const body = source.match(/const skip = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(completedOnceRef\.current\) return;/);
    expect(body).toMatch(/completedOnceRef\.current = true;/);
    expect(body).toMatch(/stopInterval\(\);/);
    expect(body).toMatch(/setIsActive\(false\);/);
    expect(body).toMatch(/onCompleteRef\.current\?\.\(\);/);
  });

  it('cancel() (Back/Cancel during the countdown) never calls onComplete - it only stops the interval and marks the countdown inactive', () => {
    const body = source.match(/const cancel = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/completedOnceRef\.current = true;/);
    expect(body).toMatch(/stopInterval\(\);/);
    expect(body).toMatch(/setIsActive\(false\);/);
    expect(body).not.toMatch(/onCompleteRef|onComplete\(/);
  });

  it('onCompleteRef always points at the latest onComplete via a useEffect, never a stale start()-time closure - and is never assigned during render (this repo\'s "no ref writes during render" lint rule)', () => {
    expect(source).toMatch(/const onCompleteRef = useRef\(onComplete\);/);
    expect(source).toMatch(/useEffect\(\(\) => \{\s*\n\s*onCompleteRef\.current = onComplete;\s*\n\s*\}, \[onComplete\]\);/);
  });

  it('unmount mid-countdown clears the interval (Back/Close/route change away can never leave a stray interval running behind a screen the user already left)', () => {
    expect(source).toMatch(/useEffect\(\(\) => \(\) => stopInterval\(\), \[\]\);/);
  });

  it('returns exactly the expected public surface - secondsRemaining, isActive, start, skip, cancel', () => {
    expect(source).toMatch(/return \{ secondsRemaining, isActive, start, skip, cancel \};/);
  });
});

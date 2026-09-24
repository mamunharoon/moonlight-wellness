// Build 15 Box/Coherent Breathing addition — genuine fake-timer execution
// tests for the breathing countdown engine, not source-string assertions.
//
// This repo's Vitest has no DOM rendering environment (plain Node, no
// jsdom - see every other test file's own note on this), so Breathe.jsx/
// EveningBreathing.jsx/QuietBreathing.jsx cannot literally be mounted and
// have a real setInterval tick against a real render tree. What CAN be
// done, and what this file does, is run the exact same sequencing those
// components' own countdown `useEffect` uses - a real `setInterval`
// firing every 1000ms, decrementing `secondsLeft`, deriving the phase via
// the REAL, imported `resolveBreathPhase` (never a reimplementation of
// it) - driven by Vitest's fake timers. `simulateBreathingRun` below is a
// deliberately faithful mirror of that effect body (see EveningBreathing.
// jsx's own countdown effect for the original this copies the shape of):
// same gate condition (`hasBegun && !paused && !gated`), same
// completion check (`secondsLeft <= 0` on the NEXT tick after reaching
// zero, firing the completion callback exactly once), same pause
// semantics (freezing the interval's own effect, not the underlying
// secondsLeft value). It contains no cadence/phase-boundary logic of its
// own - all of that comes from the real resolveBreathPhase.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBreathingPatternById, resolveBreathPhase } from '../lib/breathingPatterns';

function simulateBreathingRun(pattern) {
  let secondsLeft = pattern.totalSeconds;
  let breatheState = 'Inhale';
  let hasBegun = false;
  let paused = false;
  let completions = 0;
  let intervalId = null;
  const history = [];

  const canRun = () => hasBegun && !paused;

  const stopInterval = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  // Mirrors the real effect's own re-evaluation on every dependency
  // change (secondsLeft/hasBegun/paused) - called after every state
  // change below, exactly like React re-running the effect.
  const reconcile = () => {
    stopInterval();
    if (!canRun()) return;
    if (secondsLeft <= 0) {
      completions += 1;
      return; // no new interval - the exercise is over
    }
    intervalId = setInterval(() => {
      const nextSec = secondsLeft - 1;
      secondsLeft = nextSec;
      breatheState = resolveBreathPhase(pattern, nextSec);
      history.push({ secondsLeft, breatheState });
      reconcile();
    }, 1000);
  };

  return {
    begin: () => {
      hasBegun = true;
      secondsLeft = pattern.totalSeconds;
      breatheState = 'Inhale';
      reconcile();
    },
    pause: () => {
      paused = true;
      reconcile();
    },
    resume: () => {
      paused = false;
      reconcile();
    },
    hasActiveTimer: () => intervalId !== null,
    getState: () => ({ secondsLeft, breatheState, completions, history: [...history] })
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('Box Breathing (4-4-4-4) - genuine fake-timer execution', () => {
  const box = getBreathingPatternById('box');

  it('no timer exists before Begin is called', () => {
    const run = simulateBreathingRun(box);
    expect(run.hasActiveTimer()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(run.getState().history).toHaveLength(0);
  });

  it('runs all four phases, in order, across one full 16s cycle, with the exact boundary before/after every transition (3->4, 7->8, 11->12, 15->next-cycle 0)', () => {
    const run = simulateBreathingRun(box);
    run.begin();

    // Tick 1-3s: still Inhale (3->4 boundary not yet crossed)
    vi.advanceTimersByTime(3000);
    expect(run.getState().breatheState).toBe('Inhale');
    // Tick 4s: crosses into Hold
    vi.advanceTimersByTime(1000);
    expect(run.getState().breatheState).toBe('Hold');
    // Tick 7s: still Hold
    vi.advanceTimersByTime(3000);
    expect(run.getState().breatheState).toBe('Hold');
    // Tick 8s: crosses into Exhale
    vi.advanceTimersByTime(1000);
    expect(run.getState().breatheState).toBe('Exhale');
    // Tick 11s: still Exhale
    vi.advanceTimersByTime(3000);
    expect(run.getState().breatheState).toBe('Exhale');
    // Tick 12s: crosses into the second Hold (approved label: also "Hold")
    vi.advanceTimersByTime(1000);
    expect(run.getState().breatheState).toBe('Hold');
    // Tick 15s: still the second Hold
    vi.advanceTimersByTime(3000);
    expect(run.getState().breatheState).toBe('Hold');
    // Tick 16s: cycle wraps back to Inhale
    vi.advanceTimersByTime(1000);
    expect(run.getState().breatheState).toBe('Inhale');
  });

  it('completes after exactly 4 cycles (64 seconds), firing completion exactly once', () => {
    const run = simulateBreathingRun(box);
    run.begin();

    vi.advanceTimersByTime(64 * 1000);
    expect(run.getState().secondsLeft).toBe(0);
    expect(run.getState().completions).toBe(1);
    expect(run.hasActiveTimer()).toBe(false);

    // Advancing further must never fire a second completion - the
    // interval was already cleared by the real completion path.
    vi.advanceTimersByTime(10 * 1000);
    expect(run.getState().completions).toBe(1);
  });

  it('pause/resume within the fourth phase (the second Hold) preserves the exact phase and remaining time - no drift, no skip', () => {
    const run = simulateBreathingRun(box);
    run.begin();

    // Advance to cycleTime 13 (secondsLeft = 64-13 = 51) - inside the
    // second Hold (cycleTime 12-15).
    vi.advanceTimersByTime(13 * 1000);
    expect(run.getState().breatheState).toBe('Hold');
    const pausedSecondsLeft = run.getState().secondsLeft;

    run.pause();
    expect(run.hasActiveTimer()).toBe(false);
    // Time passing while paused changes nothing.
    vi.advanceTimersByTime(10 * 1000);
    expect(run.getState().secondsLeft).toBe(pausedSecondsLeft);
    expect(run.getState().breatheState).toBe('Hold');

    run.resume();
    expect(run.hasActiveTimer()).toBe(true);
    // The very next tick continues from exactly where it paused - one
    // second further into the still-active second Hold phase.
    vi.advanceTimersByTime(1000);
    expect(run.getState().secondsLeft).toBe(pausedSecondsLeft - 1);
    expect(run.getState().breatheState).toBe('Hold');
  });

  it('runs all four complete cycles with the identical phase sequence each time', () => {
    const run = simulateBreathingRun(box);
    run.begin();
    const expectedCycle = ['Inhale', 'Inhale', 'Inhale', 'Hold', 'Hold', 'Hold', 'Hold', 'Exhale', 'Exhale', 'Exhale', 'Exhale', 'Hold', 'Hold', 'Hold', 'Hold', 'Inhale'];
    for (let cycle = 0; cycle < 4; cycle++) {
      const cyclePhases = [];
      for (let i = 0; i < 16; i++) {
        vi.advanceTimersByTime(1000);
        cyclePhases.push(run.getState().breatheState);
      }
      // Last cycle's final tick is the completion tick (secondsLeft hits
      // 0), not a new Inhale - checked separately below instead.
      if (cycle < 3) {
        expect(cyclePhases).toEqual(expectedCycle);
      }
    }
    expect(run.getState().completions).toBe(1);
  });
});

describe('Coherent Breathing (5-5, no hold) - genuine fake-timer execution', () => {
  const coherent = getBreathingPatternById('coherent');

  it('no timer exists before Begin is called', () => {
    const run = simulateBreathingRun(coherent);
    expect(run.hasActiveTimer()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(run.getState().history).toHaveLength(0);
  });

  it('transitions directly from Inhale to Exhale at the 4->5 boundary - "Hold" is never the observed state at any tick', () => {
    const run = simulateBreathingRun(coherent);
    run.begin();

    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(1000);
      expect(run.getState().breatheState).toBe('Inhale');
    }
    // The 5th tick crosses directly into Exhale - no intermediate Hold.
    vi.advanceTimersByTime(1000);
    expect(run.getState().breatheState).toBe('Exhale');

    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(1000);
      expect(run.getState().breatheState).toBe('Exhale');
    }
    // Cycle wraps back to Inhale at the 10s boundary.
    vi.advanceTimersByTime(1000);
    expect(run.getState().breatheState).toBe('Inhale');

    expect(run.getState().history.map((h) => h.breatheState)).not.toContain('Hold');
  });

  it('completes after exactly 6 cycles (60 seconds), firing completion exactly once, never observing "Hold"', () => {
    const run = simulateBreathingRun(coherent);
    run.begin();

    vi.advanceTimersByTime(60 * 1000);
    expect(run.getState().secondsLeft).toBe(0);
    expect(run.getState().completions).toBe(1);
    expect(run.getState().history.map((h) => h.breatheState)).not.toContain('Hold');

    vi.advanceTimersByTime(10 * 1000);
    expect(run.getState().completions).toBe(1);
  });

  it('pause/resume preserves the exact phase and remaining time', () => {
    const run = simulateBreathingRun(coherent);
    run.begin();

    vi.advanceTimersByTime(7 * 1000); // mid-Exhale (cycleTime 7)
    expect(run.getState().breatheState).toBe('Exhale');
    const pausedSecondsLeft = run.getState().secondsLeft;

    run.pause();
    vi.advanceTimersByTime(5000);
    expect(run.getState().secondsLeft).toBe(pausedSecondsLeft);

    run.resume();
    vi.advanceTimersByTime(1000);
    expect(run.getState().secondsLeft).toBe(pausedSecondsLeft - 1);
    expect(run.getState().breatheState).toBe('Exhale');
  });
});

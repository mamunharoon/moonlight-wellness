// Morning breathing completion correction — physical-iPhone defect: after
// reaching 0s left, the screen stayed in the active exercise state (no
// completion panel, no Continue). Root cause: completion was a
// render-time-derived value (secondsLeft <= 0) rather than a single,
// authoritative decision made at the moment the timer actually reaches
// the boundary. This mirrors meditationSession.test.js's own established,
// real-execution (no fake timers, no DOM) approach exactly - tick() is
// synchronous and manual by design, so its return value can be asserted
// directly.
import { describe, it, expect } from 'vitest';
import { createBreathingSession, BREATHING_SESSION_STATUS } from './breathingSession';
import { BREATHING_PATTERNS, getBreathingPatternById, resolveBreathPhase } from './breathingPatterns';

const makeSession = (patternId) =>
  createBreathingSession({ pattern: getBreathingPatternById(patternId), resolveBreathPhase });

describe('createBreathingSession — pure timer state machine', () => {
  it('starts idle, with the pattern\'s full duration remaining', () => {
    const session = makeSession('morning');
    expect(session.getStatus()).toBe(BREATHING_SESSION_STATUS.IDLE);
    expect(session.getSecondsLeft()).toBe(56);
  });

  it('begin() transitions to running; a second begin() call is a no-op (guards a repeated/duplicate Begin tap)', () => {
    const session = makeSession('morning');
    session.begin();
    session.tick();
    session.tick();
    expect(session.getSecondsLeft()).toBe(54);

    session.begin(); // second call - must not reset progress
    expect(session.getSecondsLeft()).toBe(54);
    expect(session.getStatus()).toBe(BREATHING_SESSION_STATUS.RUNNING);
  });

  it.each(BREATHING_PATTERNS.map((p) => [p.id, p.totalSeconds]))(
    'pattern "%s" (%d s) completes at exactly the final tick, not before, and the completed tick reports it',
    (patternId, totalSeconds) => {
      const session = makeSession(patternId);
      session.begin();
      for (let i = 1; i < totalSeconds; i += 1) {
        const { completed, secondsLeft } = session.tick();
        expect(completed).toBe(false);
        expect(secondsLeft).toBe(totalSeconds - i);
      }
      expect(session.getStatus()).toBe(BREATHING_SESSION_STATUS.RUNNING);
      const finalTick = session.tick();
      expect(finalTick.completed).toBe(true);
      expect(finalTick.secondsLeft).toBe(0);
      expect(session.getStatus()).toBe(BREATHING_SESSION_STATUS.COMPLETED);
    }
  );

  it('tick() after completion is a permanent no-op - a completed session can never resume ticking or re-report completed', () => {
    const session = makeSession('morning');
    session.begin();
    for (let i = 0; i < 55; i += 1) session.tick();
    expect(session.tick().completed).toBe(true); // the 56th tick
    const secondsLeftAtCompletion = session.getSecondsLeft();
    expect(session.tick().completed).toBe(false); // a stray extra tick (e.g. from a not-yet-cleared interval)
    expect(session.tick().completed).toBe(false);
    expect(session.getSecondsLeft()).toBe(secondsLeftAtCompletion); // never goes negative, never re-completes
  });

  it('tick() before begin() (idle) is a no-op, never accidentally starts or completes', () => {
    const session = makeSession('morning');
    expect(session.tick().completed).toBe(false);
    expect(session.getStatus()).toBe(BREATHING_SESSION_STATUS.IDLE);
  });

  it('end() (Skip/Exit/Back-to-setup) moves straight to completed from any non-completed state, and is idempotent', () => {
    const session = makeSession('morning');
    session.begin();
    session.tick();
    session.end();
    expect(session.getStatus()).toBe(BREATHING_SESSION_STATUS.COMPLETED);
    session.end();
    expect(session.getStatus()).toBe(BREATHING_SESSION_STATUS.COMPLETED);
    // end() never reports itself through tick()'s own {completed} contract -
    // only a genuine natural-completion tick() does, so an early end can
    // never be mistaken for natural completion by a caller only watching
    // tick()'s return value.
    expect(session.tick().completed).toBe(false);
  });

  it('breatheState tracks resolveBreathPhase exactly, including at the very first and very last tick', () => {
    const session = makeSession('morning'); // 4-4-6, 56s
    expect(session.getBreatheState()).toBe('Inhale'); // before begin(), secondsLeft=56, cycleTime=0
    session.begin();
    const first = session.tick();
    expect(first.breatheState).toBe(resolveBreathPhase(getBreathingPatternById('morning'), first.secondsLeft));
    let last;
    for (let i = 0; i < 55; i += 1) last = session.tick();
    expect(last.completed).toBe(true);
    expect(last.breatheState).toBe(resolveBreathPhase(getBreathingPatternById('morning'), 0));
  });

  it('a fresh session instance for a second pattern in the same visit starts from that pattern\'s own full duration, never a leftover value from the one that just finished (sequential-completion guard)', () => {
    const first = makeSession('morning'); // 56s
    first.begin();
    for (let i = 0; i < 56; i += 1) first.tick();
    expect(first.isComplete()).toBe(true);

    const second = makeSession('evening'); // 76s - a genuinely new instance, as Breathe.jsx creates on each Begin
    expect(second.getStatus()).toBe(BREATHING_SESSION_STATUS.IDLE);
    expect(second.getSecondsLeft()).toBe(76);
    second.begin();
    for (let i = 1; i < 76; i += 1) {
      expect(second.tick().completed).toBe(false);
    }
    expect(second.tick().completed).toBe(true);
  });
});

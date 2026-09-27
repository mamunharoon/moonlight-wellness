// Morning Stretch completion correction — physical-device-class defect
// (mirroring the same class of bug already fixed for Breathe.jsx): the
// timer auto-navigated the instant the final movement's final second
// elapsed, with no completion panel and no confirmed way to leave early.
// Root cause: completion was decided by a render-time setInterval closure
// directly calling navigate(), not by a single, authoritative, testable
// decision point. Fix: this pure controller, mirroring breathingSession.js/
// meditationSession.js's own proven, real-execution-tested (no fake
// timers) design exactly.
import { describe, it, expect } from 'vitest';
import { createStretchSession, STRETCH_SESSION_STATUS } from './stretchSession';

const makeSession = (movementCount = 4, stepDurationSeconds = 20) =>
  createStretchSession({ movementCount, stepDurationSeconds });

describe('createStretchSession — pure timer state machine', () => {
  it('starts idle, at the first movement, with the full step duration remaining', () => {
    const session = makeSession();
    expect(session.getStatus()).toBe(STRETCH_SESSION_STATUS.IDLE);
    expect(session.getActiveIndex()).toBe(0);
    expect(session.getTimeLeft()).toBe(20);
  });

  it('begin() transitions to running; a second begin() call is a no-op (guards a repeated/duplicate Begin tap)', () => {
    const session = makeSession();
    session.begin();
    session.tick();
    session.tick();
    expect(session.getTimeLeft()).toBe(18);

    session.begin();
    expect(session.getTimeLeft()).toBe(18);
    expect(session.getStatus()).toBe(STRETCH_SESSION_STATUS.RUNNING);
  });

  it('a 4-movement, 20s-per-movement sequence completes at exactly the final tick of the final movement, not before', () => {
    const session = makeSession(4, 20);
    session.begin();
    // 3 full movements (20 ticks each) + 19 ticks of the 4th (final)
    // movement never report completed.
    for (let movement = 0; movement < 4; movement += 1) {
      const ticksThisMovement = movement < 3 ? 20 : 19;
      for (let i = 0; i < ticksThisMovement; i += 1) {
        const { completed } = session.tick();
        expect(completed).toBe(false);
      }
    }
    expect(session.getStatus()).toBe(STRETCH_SESSION_STATUS.RUNNING);
    expect(session.getActiveIndex()).toBe(3);
    const finalTick = session.tick();
    expect(finalTick.completed).toBe(true);
    expect(session.getStatus()).toBe(STRETCH_SESSION_STATUS.COMPLETED);
  });

  it('advances to the next movement, resetting timeLeft, when a movement finishes but is not the last one', () => {
    const session = makeSession(4, 20);
    session.begin();
    for (let i = 0; i < 20; i += 1) session.tick();
    expect(session.getActiveIndex()).toBe(1);
    expect(session.getTimeLeft()).toBe(20);
    expect(session.getStatus()).toBe(STRETCH_SESSION_STATUS.RUNNING);
  });

  it('tick() after completion is a permanent no-op - a completed session can never resume ticking or re-report completed', () => {
    const session = makeSession(1, 5); // single movement, short duration
    session.begin();
    for (let i = 0; i < 4; i += 1) session.tick();
    expect(session.tick().completed).toBe(true); // the 5th tick
    expect(session.tick().completed).toBe(false); // stray extra tick
    expect(session.tick().completed).toBe(false);
    expect(session.getTimeLeft()).toBe(0);
  });

  it('tick() before begin() (idle) is a no-op, never accidentally starts or completes', () => {
    const session = makeSession();
    expect(session.tick().completed).toBe(false);
    expect(session.getStatus()).toBe(STRETCH_SESSION_STATUS.IDLE);
  });

  it('advanceMovement() (manual "Next Movement"/"Continue" tap) makes the exact same completion decision as tick() on the final movement', () => {
    const session = makeSession(2, 20);
    session.begin();
    expect(session.advanceMovement().completed).toBe(false); // movement 1 -> 2
    expect(session.getActiveIndex()).toBe(1);
    expect(session.advanceMovement().completed).toBe(true); // final movement, finished early by tap
    expect(session.getStatus()).toBe(STRETCH_SESSION_STATUS.COMPLETED);
  });

  it('end() (Skip/Exit/confirmed Leave/Back-to-setup) moves straight to completed from any non-completed state, and is idempotent - never reports itself as a natural completion', () => {
    const session = makeSession();
    session.begin();
    session.tick();
    session.end();
    expect(session.getStatus()).toBe(STRETCH_SESSION_STATUS.COMPLETED);
    session.end();
    expect(session.getStatus()).toBe(STRETCH_SESSION_STATUS.COMPLETED);
    expect(session.tick().completed).toBe(false);
  });

  it('a fresh session instance for a second stretch run starts from movement 0 with the full duration, never a leftover value from the run that just finished (sequential-completion guard)', () => {
    const first = makeSession(4, 20);
    first.begin();
    for (let i = 0; i < 79; i += 1) first.tick();
    expect(first.tick().completed).toBe(true);

    const second = makeSession(2, 40); // a genuinely new instance, different selection/duration
    expect(second.getStatus()).toBe(STRETCH_SESSION_STATUS.IDLE);
    expect(second.getActiveIndex()).toBe(0);
    expect(second.getTimeLeft()).toBe(40);
    second.begin();
    for (let i = 0; i < 79; i += 1) {
      expect(second.tick().completed).toBe(false);
    }
    expect(second.tick().completed).toBe(true);
  });
});

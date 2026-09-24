import { describe, it, expect } from 'vitest';
import { createMeditationSession, MEDITATION_SESSION_STATUS } from './meditationSession';

describe('createMeditationSession — pure timer state machine', () => {
  it('starts idle, with zero elapsed time', () => {
    const session = createMeditationSession({ durationSeconds: 120 });
    expect(session.getStatus()).toBe(MEDITATION_SESSION_STATUS.IDLE);
    expect(session.getElapsedSeconds()).toBe(0);
    expect(session.getRemainingSeconds()).toBe(120);
  });

  it('begin() transitions to running; a second begin() call is a no-op (guards a repeated/duplicate Begin tap)', () => {
    const session = createMeditationSession({ durationSeconds: 120 });
    session.begin();
    expect(session.getStatus()).toBe(MEDITATION_SESSION_STATUS.RUNNING);
    session.tick();
    session.tick();
    expect(session.getElapsedSeconds()).toBe(2);

    session.begin(); // second call - must not reset elapsed or restart
    expect(session.getElapsedSeconds()).toBe(2);
    expect(session.getStatus()).toBe(MEDITATION_SESSION_STATUS.RUNNING);
  });

  it('a 2-minute session completes at exactly the 120th tick, not before', () => {
    const session = createMeditationSession({ durationSeconds: 120 });
    session.begin();
    for (let i = 0; i < 119; i += 1) {
      expect(session.tick()).toBe(false);
    }
    expect(session.getStatus()).toBe(MEDITATION_SESSION_STATUS.RUNNING);
    expect(session.tick()).toBe(true);
    expect(session.getStatus()).toBe(MEDITATION_SESSION_STATUS.COMPLETED);
    expect(session.getElapsedSeconds()).toBe(120);
  });

  it('a 5-minute session completes at exactly the 300th tick', () => {
    const session = createMeditationSession({ durationSeconds: 300 });
    session.begin();
    let completedAt = -1;
    for (let i = 1; i <= 300; i += 1) {
      if (session.tick()) {
        completedAt = i;
        break;
      }
    }
    expect(completedAt).toBe(300);
  });

  it('a 10-minute session completes at exactly the 600th tick', () => {
    const session = createMeditationSession({ durationSeconds: 600 });
    session.begin();
    let completedAt = -1;
    for (let i = 1; i <= 600; i += 1) {
      if (session.tick()) {
        completedAt = i;
        break;
      }
    }
    expect(completedAt).toBe(600);
  });

  it('pause() freezes elapsed time - further tick() calls are no-ops while paused', () => {
    const session = createMeditationSession({ durationSeconds: 120 });
    session.begin();
    session.tick();
    session.tick();
    session.pause();
    expect(session.getStatus()).toBe(MEDITATION_SESSION_STATUS.PAUSED);
    session.tick();
    session.tick();
    session.tick();
    expect(session.getElapsedSeconds()).toBe(2);
  });

  it('resume() continues from the exact elapsed time it was paused at, never resetting progress', () => {
    const session = createMeditationSession({ durationSeconds: 120 });
    session.begin();
    session.tick();
    session.tick();
    session.pause();
    session.resume();
    expect(session.getStatus()).toBe(MEDITATION_SESSION_STATUS.RUNNING);
    expect(session.getElapsedSeconds()).toBe(2);
    session.tick();
    expect(session.getElapsedSeconds()).toBe(3);
  });

  it('resume() while not paused is a no-op', () => {
    const session = createMeditationSession({ durationSeconds: 120 });
    session.begin();
    session.resume();
    expect(session.getStatus()).toBe(MEDITATION_SESSION_STATUS.RUNNING);
  });

  it('end() moves straight to completed from any non-completed state, and is idempotent', () => {
    const session = createMeditationSession({ durationSeconds: 120 });
    session.begin();
    session.tick();
    session.end();
    expect(session.getStatus()).toBe(MEDITATION_SESSION_STATUS.COMPLETED);
    session.end();
    expect(session.getStatus()).toBe(MEDITATION_SESSION_STATUS.COMPLETED);
  });

  it('tick() after completion is a permanent no-op - a completed session can never resume ticking', () => {
    const session = createMeditationSession({ durationSeconds: 2 });
    session.begin();
    session.tick();
    expect(session.tick()).toBe(true);
    expect(session.tick()).toBe(false);
    expect(session.getElapsedSeconds()).toBe(2);
  });
});

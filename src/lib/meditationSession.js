// WakeWise — Self-Guided Meditation — pure timer/session state machine.
//
// Deliberately owns no setInterval/setTimeout itself - the caller (a real
// browser interval in SelfGuidedMeditation.jsx) drives it one second at a
// time via tick(). This keeps the timer fully synchronous and directly
// testable (call tick() N times, assert status/elapsed) without fake
// timers, and makes it trivially "authoritative": completion is decided
// purely by elapsedSeconds vs durationSeconds, never by anything audio
// does (see meditationSessionController.js, which composes this with the
// audio controller and never lets audio influence tick()'s result).
export const MEDITATION_SESSION_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed'
};

export const createMeditationSession = ({ durationSeconds }) => {
  let status = MEDITATION_SESSION_STATUS.IDLE;
  let elapsedSeconds = 0;

  // Idempotent by design - a repeated Begin tap (e.g. a double-tap before
  // the first render commits) must never reset progress or re-arm a
  // second timer; only the very first call from IDLE has any effect.
  const begin = () => {
    if (status !== MEDITATION_SESSION_STATUS.IDLE) return;
    status = MEDITATION_SESSION_STATUS.RUNNING;
    elapsedSeconds = 0;
  };

  const pause = () => {
    if (status !== MEDITATION_SESSION_STATUS.RUNNING) return;
    status = MEDITATION_SESSION_STATUS.PAUSED;
  };

  const resume = () => {
    if (status !== MEDITATION_SESSION_STATUS.PAUSED) return;
    status = MEDITATION_SESSION_STATUS.RUNNING;
  };

  // Early/deliberate stop (End Session, or leaving mid-session) - distinct
  // from natural completion but lands in the same terminal status so a
  // stopped session can never be resumed or re-ticked.
  const end = () => {
    if (status === MEDITATION_SESSION_STATUS.COMPLETED) return;
    status = MEDITATION_SESSION_STATUS.COMPLETED;
  };

  // Advances by exactly one second only while running (a no-op while
  // idle/paused/completed) and returns whether this tick just reached
  // natural completion, so the caller knows precisely when to stop its
  // own interval and navigate - never inferred from a race between two
  // separately-read pieces of state.
  const tick = () => {
    if (status !== MEDITATION_SESSION_STATUS.RUNNING) return false;
    elapsedSeconds += 1;
    if (elapsedSeconds >= durationSeconds) {
      status = MEDITATION_SESSION_STATUS.COMPLETED;
      return true;
    }
    return false;
  };

  return {
    begin,
    pause,
    resume,
    end,
    tick,
    getStatus: () => status,
    getElapsedSeconds: () => elapsedSeconds,
    getRemainingSeconds: () => Math.max(0, durationSeconds - elapsedSeconds),
    getDurationSeconds: () => durationSeconds
  };
};

// WakeWise — Morning Stretch — pure timer/session state machine,
// mirroring breathingSession.js's own proven design exactly (which itself
// mirrors meditationSession.js). Deliberately owns no setInterval/
// setTimeout itself - the caller (a real browser interval in
// MorningFlow.jsx) drives it one second at a time via tick(). This keeps
// the timer fully synchronous and directly testable (call tick() N times,
// assert status/timeLeft/activeIndex) without fake timers, and makes
// completion "authoritative": the SAME tick() call that reaches the final
// second of the final movement is the one that flips status to COMPLETED
// and reports it back to the caller - never a separately-derived,
// render-time comparison that depends on a subsequent React re-render/
// effect to act on it. That render-time-derived shape (and the immediate,
// unconfirmed auto-navigate it drove) is what the previous Stretch
// implementation used; this closes the same gap breathingSession.js
// already closed for Breathe.jsx.
export const STRETCH_SESSION_STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed'
});

export const createStretchSession = ({ movementCount, stepDurationSeconds }) => {
  let status = STRETCH_SESSION_STATUS.IDLE;
  let activeIndex = 0;
  let timeLeft = stepDurationSeconds;

  // Idempotent by design - a repeated Begin tap must never reset progress
  // or re-arm a second timer; only the very first call from IDLE has any
  // effect. Also the one true "start a fresh session" entry point:
  // selecting a different set of movements always creates a brand-new
  // controller instance (see MorningFlow.jsx's own getOrCreateStretchSession),
  // so activeIndex/timeLeft always start fresh for the sequence actually
  // being run - never a leftover value from whichever run finished last.
  const begin = () => {
    if (status !== STRETCH_SESSION_STATUS.IDLE) return;
    status = STRETCH_SESSION_STATUS.RUNNING;
    activeIndex = 0;
    timeLeft = stepDurationSeconds;
  };

  // Early/deliberate stop (Skip, Exit routine, confirmed Leave, Back-to-
  // setup) - distinct from natural completion but lands in the same
  // terminal status so a stopped session can never be resumed or
  // re-ticked, and a stray extra tick() call after this is a guaranteed
  // no-op.
  const end = () => {
    if (status === STRETCH_SESSION_STATUS.COMPLETED) return;
    status = STRETCH_SESSION_STATUS.COMPLETED;
  };

  // Manual "Next Movement"/"Continue" tap - the exact same completion
  // decision the timer's own tick() makes when it reaches the final
  // second, just triggered by a deliberate tap instead of the clock. On
  // the final movement, this IS the natural-completion boundary (the
  // user finished the last movement early by choice, not by waiting out
  // the last second) - genuinely distinct from Skip/Leave, which never
  // call this.
  const advanceMovement = () => {
    if (status !== STRETCH_SESSION_STATUS.RUNNING) return { completed: false, timeLeft, activeIndex };
    if (activeIndex < movementCount - 1) {
      activeIndex += 1;
      timeLeft = stepDurationSeconds;
      return { completed: false, timeLeft, activeIndex };
    }
    status = STRETCH_SESSION_STATUS.COMPLETED;
    timeLeft = 0;
    return { completed: true, timeLeft, activeIndex };
  };

  // Advances by exactly one second only while running (a no-op while
  // idle/completed - so more than one timer/callback observing the final
  // boundary can never double-complete) and returns whether THIS tick
  // just reached natural completion - never inferred from a race between
  // two separately-read pieces of state.
  const tick = () => {
    if (status !== STRETCH_SESSION_STATUS.RUNNING) {
      return { completed: false, timeLeft, activeIndex };
    }
    if (timeLeft <= 1) {
      const { completed } = advanceMovement();
      return { completed, timeLeft, activeIndex };
    }
    timeLeft -= 1;
    return { completed: false, timeLeft, activeIndex };
  };

  return {
    begin,
    end,
    tick,
    advanceMovement,
    getStatus: () => status,
    getTimeLeft: () => timeLeft,
    getActiveIndex: () => activeIndex,
    isComplete: () => status === STRETCH_SESSION_STATUS.COMPLETED
  };
};

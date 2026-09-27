// WakeWise — embedded breathing (Morning/Evening) — pure timer/session
// state machine, mirroring meditationSession.js's own proven design
// exactly. Deliberately owns no setInterval/setTimeout itself - the
// caller (a real browser interval in Breathe.jsx) drives it one second
// at a time via tick(). This keeps the timer fully synchronous and
// directly testable (call tick() N times, assert status/secondsLeft/
// breatheState) without fake timers, and makes completion
// "authoritative": the SAME tick() call that reaches the final second is
// the one that flips status to COMPLETED and reports it back to the
// caller - never a separately-derived, render-time `secondsLeft <= 0`
// comparison that depends on a subsequent React re-render/effect to act
// on it. That render-time-derived shape is what the previous
// implementation used; this closes the gap between "the countdown
// reached zero" and "the app decided the exercise is complete" to zero
// renders, matching meditationSession.js's own tick()->{completed}
// contract used by useMeditationSession.js.
export const BREATHING_SESSION_STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed'
});

export const createBreathingSession = ({ pattern, resolveBreathPhase }) => {
  let status = BREATHING_SESSION_STATUS.IDLE;
  let elapsedSeconds = 0;

  const getSecondsLeft = () => Math.max(0, pattern.totalSeconds - elapsedSeconds);
  const getBreatheState = () => resolveBreathPhase(pattern, getSecondsLeft());

  // Idempotent by design - a repeated Begin tap (e.g. a double-tap before
  // the first render commits) must never reset progress or re-arm a
  // second timer; only the very first call from IDLE has any effect.
  // Also the one true "start a fresh session" entry point: selecting a
  // DIFFERENT pattern always creates a brand-new controller instance
  // (see Breathe.jsx's own getOrCreateBreathingSession), so elapsedSeconds
  // always starts at 0 for the pattern actually being run - never a
  // leftover value from whichever pattern finished last in this visit.
  const begin = () => {
    if (status !== BREATHING_SESSION_STATUS.IDLE) return;
    status = BREATHING_SESSION_STATUS.RUNNING;
    elapsedSeconds = 0;
  };

  // Early/deliberate stop (Skip, Exit routine, Back-to-setup) - distinct
  // from natural completion but lands in the same terminal status so a
  // stopped session can never be resumed or re-ticked, and a stray extra
  // tick() call after this (e.g. from a not-yet-cleared interval) is a
  // guaranteed no-op.
  const end = () => {
    if (status === BREATHING_SESSION_STATUS.COMPLETED) return;
    status = BREATHING_SESSION_STATUS.COMPLETED;
  };

  // Advances by exactly one second only while running (a no-op while
  // idle/completed - so more than one timer/callback observing the final
  // boundary can never double-complete) and returns whether THIS tick
  // just reached natural completion, so the caller knows precisely when
  // to stop its own interval/music and show the completed state - never
  // inferred from a race between two separately-read pieces of state.
  const tick = () => {
    if (status !== BREATHING_SESSION_STATUS.RUNNING) {
      return { completed: false, secondsLeft: getSecondsLeft(), breatheState: getBreatheState() };
    }
    elapsedSeconds += 1;
    const secondsLeft = getSecondsLeft();
    let completed = false;
    if (secondsLeft <= 0) {
      status = BREATHING_SESSION_STATUS.COMPLETED;
      completed = true;
    }
    return { completed, secondsLeft, breatheState: getBreatheState() };
  };

  return {
    begin,
    end,
    tick,
    getStatus: () => status,
    getSecondsLeft,
    getBreatheState,
    isComplete: () => status === BREATHING_SESSION_STATUS.COMPLETED
  };
};

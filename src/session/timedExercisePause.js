// Safe backward navigation ("Review Mode") — pause-and-resume-exact-state
// for the three timed exercise screens (Breathe, Stretch/MorningFlow,
// Evening Breathing).
//
// Their countdown/phase state (secondsLeft, breatheState, activeStep,
// musicChoiceMade) lives in local component state, which is destroyed on
// unmount - reviewing an earlier step navigates away (unmounting the
// live screen), so without this, returning to it always restarted the
// exercise from the very beginning instead of resuming exactly where it
// was left off. Reproduced live: reviewing Intend from a running Stretch
// timer and returning showed "Exercise 1 of 4" again, not wherever the
// timer actually was.
//
// sessionStorage (not localStorage): this is a one-shot "resume exactly
// here" handoff for the current tab's review round-trip, not state that
// should persist across app restarts - same reasoning as
// lib/pendingContent.js. Keyed by stepId, since only one of these three
// screens can ever be the live step at once.
const KEY_PREFIX = 'moonlight_paused_exercise_';

export const savePausedExerciseState = (stepId, state) => {
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${stepId}`, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    // Storage unavailable - the exercise will simply restart fresh on
    // return, never worse than the pre-fix behaviour.
  }
};

// Read-only (does not clear) - the calling page reads this once, at its
// own lazy useState initializer, then explicitly clears it itself (see
// clearPausedExerciseState) once it has committed the values into its
// own local state.
export const loadPausedExerciseState = (stepId) => {
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${stepId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearPausedExerciseState = (stepId) => {
  try {
    sessionStorage.removeItem(`${KEY_PREFIX}${stepId}`);
  } catch {
    // no-op
  }
};

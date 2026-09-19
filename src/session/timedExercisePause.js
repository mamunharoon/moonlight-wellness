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
// Cross-routine isolation fix: keyed by BOTH sessionId and stepId (never
// stepId alone), and the saved snapshot also carries its own sessionId
// field, verified on load. Today's three step ids ('breathe', 'stretch',
// 'breathing') never actually collide across Morning/Evening, but this
// hook exists specifically so a snapshot from Breathe (Morning) can never
// be consumed by EveningBreathing, MorningFlow, or a future step that
// happens to reuse a stepId - by construction, not by convention. A
// mismatched/foreign sessionId inside a stored snapshot is treated
// exactly like no snapshot at all: rejected and cleared, never guessed
// at or partially trusted.
//
// sessionStorage (not localStorage): this is a one-shot "resume exactly
// here" handoff for the current tab's review round-trip, not state that
// should persist across app restarts - same reasoning as
// lib/pendingContent.js.
const KEY_PREFIX = 'moonlight_paused_exercise_';

const keyFor = (sessionId, stepId) => `${KEY_PREFIX}${sessionId}__${stepId}`;

export const savePausedExerciseState = (sessionId, stepId, state) => {
  try {
    sessionStorage.setItem(keyFor(sessionId, stepId), JSON.stringify({ ...state, sessionId, stepId, savedAt: Date.now() }));
  } catch {
    // Storage unavailable - the exercise will simply restart fresh on
    // return, never worse than the pre-fix behaviour.
  }
};

// Read-only (does not clear) - the calling page reads this once, at its
// own lazy useState initializer, then explicitly clears it itself (see
// clearPausedExerciseState) once it has committed the values into its
// own local state. Validates the snapshot's own recorded sessionId/
// stepId match what's being requested - a mismatch (which should never
// happen given the key itself is already scoped by both, but is checked
// anyway as defense-in-depth against a hand-edited or legacy stored
// value) is rejected exactly like no snapshot at all, never guessed at.
export const loadPausedExerciseState = (sessionId, stepId) => {
  try {
    const raw = sessionStorage.getItem(keyFor(sessionId, stepId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.sessionId !== sessionId || parsed.stepId !== stepId) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearPausedExerciseState = (sessionId, stepId) => {
  try {
    sessionStorage.removeItem(keyFor(sessionId, stepId));
  } catch {
    // no-op
  }
};

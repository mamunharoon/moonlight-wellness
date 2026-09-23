// Evening Breathing — tonight's selected pattern (Build 15 Evening UX
// correction). This is NOT a general cross-app user preference (unlike
// musicPreference.js) - it is only which of the three real breathing
// patterns is currently selected for TONIGHT's active Evening Wind-Down,
// named and scoped accordingly.
//
// Mirrors dailyCompletion.js's own established userId-scoped-key
// convention exactly (a registered user's own key is `<baseKey>:<userId>`,
// a guest continues on the unscoped base key - the same accepted
// device-shared guest policy already used for completion flags), rather
// than routineProgress.js's shared, hand-validated snapshot shape (which
// would silently drop an unrecognised field) or timedExercisePause.js's
// sessionStorage handoff (a one-shot review round-trip, wrong lifetime
// for "survives leaving to Home and resuming").
import { getBreathingPatternById } from './breathingPatterns';

export const EVENING_BREATHING_PATTERN_KEY = 'moonlight_evening_breathing_pattern';

const scopedKey = (userId) => (userId ? `${EVENING_BREATHING_PATTERN_KEY}:${userId}` : EVENING_BREATHING_PATTERN_KEY);

export const getEveningBreathingPatternKey = (userId) => scopedKey(userId);

/**
 * Persists tonight's selected pattern, alongside the local date it was
 * selected on - the read side below only trusts a stored value for the
 * exact same date, so a value from a prior night is never silently reused.
 */
export const saveEveningBreathingPattern = (userId, patternId, dateKey) => {
  try {
    localStorage.setItem(scopedKey(userId), JSON.stringify({ patternId, dateKey }));
  } catch {
    // Best-effort only, matching musicPreference.js's own established
    // precedent - a failed write just means the default is used next time.
  }
};

/**
 * Returns a validated pattern id for TODAY only, or null for every other
 * case (nothing stored, a stale prior-day value, corrupt JSON, or a
 * pattern id that no longer exists in BREATHING_PATTERNS) - the caller is
 * responsible for falling back to the default (4-7-8) whenever this
 * returns null, exactly as it already would on a completely fresh visit.
 */
export const loadEveningBreathingPattern = (userId, dateKey) => {
  try {
    const raw = localStorage.getItem(scopedKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.dateKey !== dateKey) return null;
    if (!getBreathingPatternById(parsed?.patternId)) return null;
    return parsed.patternId;
  } catch {
    return null;
  }
};

/**
 * Clears tonight's selection for the CURRENT identity only - called
 * alongside Redo Tonight's Wind-Down and a genuine Evening Start Over,
 * mirroring clearEveningCompletionKey's own single-identity scoping.
 * Never touches Morning's own state, and never leaks between users (a
 * different signed-in user reads their own, separately-scoped key).
 */
export const clearEveningBreathingPattern = (userId) => {
  localStorage.removeItem(scopedKey(userId));
};

// WakeWise Phase 1 correction — Prepare for Rest's four preparation
// toggles and selected bedtime media used to be plain component state
// only (see PrepareForRest.jsx's own former CHECKLIST STATE doc comment),
// which reset on any full unmount/remount - including the ordinary case
// of reviewing an earlier Evening step (Back to Evening Breathing/
// Meditate) and returning. Mirrors eveningBreathingSelection.js's own
// established "tonight's selection" convention exactly (userId-scoped key,
// guest continues on the unscoped base key per the same accepted
// device-shared guest policy, validated against the exact same local
// date it was saved on so a value from a prior night is never silently
// reused) - not a new persistence architecture, no Supabase migration,
// no localStorage schema shared with anything else.
export const EVENING_PREPARE_SELECTION_KEY = 'moonlight_evening_prepare_selection';

const scopedKey = (userId) => (userId ? `${EVENING_PREPARE_SELECTION_KEY}:${userId}` : EVENING_PREPARE_SELECTION_KEY);

export const getEveningPrepareSelectionKey = (userId) => scopedKey(userId);

/**
 * Persists tonight's checklist selections and chosen bedtime media
 * (`bedtimeId` may be null - "nothing chosen yet" is itself a valid,
 * savable state), alongside the local date they were selected on. This
 * is deliberately NOT a completed-journey-step record - see
 * PrepareForRest.jsx's own doc comment for why the checklist must never
 * be conflated with real Session Engine step completion.
 */
export const saveEveningPrepareSelection = (userId, { prepIds, bedtimeId }, dateKey) => {
  try {
    localStorage.setItem(scopedKey(userId), JSON.stringify({ prepIds: prepIds ?? [], bedtimeId: bedtimeId ?? null, dateKey }));
  } catch {
    // Best-effort only, matching eveningBreathingSelection.js's own
    // established precedent - a failed write just means an empty
    // checklist is shown next time, exactly like a first-ever visit.
  }
};

/**
 * Returns a validated { prepIds, bedtimeId } for TODAY only, or null for
 * every other case (nothing stored, a stale prior-day value, or corrupt
 * JSON) - the caller is responsible for falling back to an empty
 * selection whenever this returns null, exactly as it already would on a
 * completely fresh visit.
 */
export const loadEveningPrepareSelection = (userId, dateKey) => {
  try {
    const raw = localStorage.getItem(scopedKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.dateKey !== dateKey) return null;
    if (!Array.isArray(parsed?.prepIds)) return null;
    return { prepIds: parsed.prepIds, bedtimeId: parsed.bedtimeId ?? null };
  } catch {
    return null;
  }
};

/**
 * Clears tonight's selection for the CURRENT identity only - called on
 * successful Evening completion, a genuine Redo/Start Over, or a deliberate
 * discard, mirroring clearEveningBreathingPattern's own single-identity
 * scoping. Never touches Morning's own state, and never leaks between
 * users (a different signed-in user reads their own, separately-scoped
 * key; a guest reads the separate unscoped base key).
 */
export const clearEveningPrepareSelection = (userId) => {
  localStorage.removeItem(scopedKey(userId));
};

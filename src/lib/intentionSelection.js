// Shared selection logic for "one or two Morning intentions" - used by
// both IntentionSetup.jsx (Morning routine's own Step 1) and Home.jsx's
// "Change intention" (ActiveIntentionCard), so the exact same rules
// govern both places a user picks their intentions, and the two can
// never drift out of sync.
//
// Order IS the model: the first element of the returned array is
// Primary, the second (if present) is Supporting - there is no separate
// "role" field anywhere. Promotion ("if Primary is removed while
// Supporting remains, promote Supporting to Primary") falls out for
// free from this: removing index 0 with a plain filter naturally shifts
// whatever was at index 1 down to index 0.

export const MAX_INTENTIONS = 2;

// WakeWise Phase 2 — guided intention ladder. A custom intention has no
// length cap anywhere else in this module (by design, until now) - the
// ladder's "excessively long entries are handled clearly" requirement
// needs one. 60 characters comfortably fits every existing preset
// ('Take one step forward' is the longest at 22) with generous room for a
// genuine custom phrase, while still fitting on one line in the summary
// card and the chip row without wrapping awkwardly.
export const MAX_CUSTOM_INTENTION_LENGTH = 60;
export const TOO_LONG_INTENTION_MESSAGE = `Please keep it under ${MAX_CUSTOM_INTENTION_LENGTH} characters.`;

export const LIMIT_MESSAGE = 'You can choose up to two intentions.';

// Custom-intention defect fix — a more actionable message for the "Add
// your own" flow specifically (ChangeIntention.jsx): the generic
// LIMIT_MESSAGE above says what the limit is but not what to do about
// it, which matters more here than at the preset chips (which are
// already visibly selected/deselectable) since a rejected custom value
// can otherwise look like the app silently ate it.
export const CUSTOM_LIMIT_MESSAGE = 'You can choose up to two intentions. Remove one before adding your own.';

// Custom-intention defect fix — shown when the typed text (case-
// insensitively) already matches a currently-selected intention.
export const DUPLICATE_INTENTION_MESSAGE = 'That intention is already selected.';

// Comparison-only normalisation (trim + lowercase) - never used for what
// gets stored or displayed. This is how duplicates are rejected
// case-insensitively while the user's own display wording (casing,
// internal spacing) is always preserved verbatim in the stored array.
const normalizeForComparison = (value) => value.trim().toLowerCase();

const isSameIntention = (a, b) => normalizeForComparison(a) === normalizeForComparison(b);

/**
 * Toggle one intention (preset or custom) against the current ordered
 * selection. Never mutates `current` - always returns a new array (or
 * the same reference, unchanged, when the tap is rejected).
 *
 * @param {string[]} current - current ordered selection (0-2 items)
 * @param {string} rawValue - the tapped preset, or trimmed custom text
 * @returns {{ intentions: string[], limitReached: boolean }}
 *   limitReached is true only when a THIRD, not-already-selected value
 *   was tapped while two were already selected - `intentions` is
 *   returned unchanged (the existing pair is never silently replaced).
 */
export const toggleIntention = (current, rawValue) => {
  const value = rawValue.trim();
  if (!value) return { intentions: current, limitReached: false };

  const existingIndex = current.findIndex((item) => isSameIntention(item, value));

  if (existingIndex !== -1) {
    // Deselect. A plain filter is what promotes Supporting to Primary
    // when index 0 is the one removed - nothing else needs to happen.
    return { intentions: current.filter((_, i) => i !== existingIndex), limitReached: false };
  }

  if (current.length >= MAX_INTENTIONS) {
    return { intentions: current, limitReached: true };
  }

  // A custom intention counts toward the limit exactly like a preset -
  // this function has no idea (and no need to know) which kind `value`
  // is, so that's automatically true.
  return { intentions: [...current, value], limitReached: false };
};

/**
 * Custom-intention defect fix — ADD-ONLY for the freely-typed "Add your
 * own" flow (ChangeIntention.jsx/IntentionSetup.jsx), deliberately never
 * a toggle. toggleIntention above is correct for tapping a chip that's
 * already visibly selected/deselectable, but wrong here: typing text
 * that happens to match an already-selected intention (case-
 * insensitively) must be REJECTED as a duplicate, never silently remove
 * the existing selection - a user who mistypes or re-types an existing
 * value should never watch their own selection vanish with no add
 * having happened. Never mutates `current`.
 * @param {string[]} current - current ordered selection (0-2 items)
 * @param {string} rawValue - the raw text from the custom-input field
 * @returns {{ intentions: string[], status: 'added'|'blank'|'duplicate'|'limit-reached' }}
 *   `intentions` is unchanged (same reference) for every status except
 *   'added'.
 */
export const addCustomIntention = (current, rawValue) => {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!value) return { intentions: current, status: 'blank' };
  if (current.some((item) => isSameIntention(item, value))) {
    return { intentions: current, status: 'duplicate' };
  }
  if (current.length >= MAX_INTENTIONS) {
    return { intentions: current, status: 'limit-reached' };
  }
  // WakeWise Phase 2 — checked last, after duplicate/limit, so every
  // existing caller/test exercising those two statuses with ordinary
  // short strings is completely unaffected; only a genuinely-too-long
  // value that would otherwise have been added now isn't.
  if (value.length > MAX_CUSTOM_INTENTION_LENGTH) {
    return { intentions: current, status: 'too-long' };
  }
  return { intentions: [...current, value], status: 'added' };
};

// WakeWise Phase 2 — guided intention ladder. Order IS the model (see this
// file's own top comment), so "set the primary" / "set the supporting" /
// "clear the supporting" are just the three shapes that order can be
// changed into from a stage-based UI - never a new field, never a second
// source of truth. All three are pure and never mutate `current`.

/**
 * Sets the primary (index 0) intention, replacing whatever was there.
 * Preserves an existing supporting (index 1) intention unless it now
 * equals the new primary (case-insensitively) - a supporting intention
 * can never be identical to its own primary, so it is dropped rather than
 * left as a same-value duplicate.
 * @param {string[]} current - current ordered selection (0-2 items)
 * @param {string} rawValue - the chosen preset, or trimmed custom text
 * @returns {string[]} the next ordered selection; `current` unchanged if
 *   `rawValue` is blank
 */
export const setPrimaryIntention = (current, rawValue) => {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!value) return current;
  const existingSupporting = current[1];
  const keepSupporting = existingSupporting && !isSameIntention(existingSupporting, value);
  return keepSupporting ? [value, existingSupporting] : [value];
};

/**
 * Sets the supporting (index 1) intention. Requires a primary already at
 * index 0 - returns `current` unchanged if there isn't one (never invents
 * a primary). Also returns `current` unchanged if `rawValue` matches the
 * primary (case-insensitively): a defensive guarantee that a supporting
 * intention is never identical to its own primary - the calling UI is
 * expected to already exclude the primary from the supporting choices, so
 * this should never actually trigger in practice.
 * @param {string[]} current - current ordered selection (0-2 items)
 * @param {string} rawValue - the chosen preset, or trimmed custom text
 * @returns {string[]} the next ordered selection
 */
export const setSupportingIntention = (current, rawValue) => {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!value || current.length === 0) return current;
  if (isSameIntention(value, current[0])) return current;
  return [current[0], value];
};

/**
 * Drops the supporting (index 1) intention only - the "No thanks, one is
 * enough" action. Keeps the primary untouched; a safe no-op when there is
 * no supporting intention yet.
 * @param {string[]} current - current ordered selection (0-2 items)
 * @returns {string[]} the next ordered selection
 */
export const clearSupportingIntention = (current) => (current.length > 1 ? [current[0]] : current);

/**
 * Role label for display ("Primary"/"Supporting"/null), purely a
 * function of position - never stored separately from the array order.
 * @param {number} index
 * @returns {'Primary'|'Supporting'|null}
 */
export const roleForIndex = (index) => {
  if (index === 0) return 'Primary';
  if (index === 1) return 'Supporting';
  return null;
};

/**
 * Normalises a freshly-loaded selection (e.g. from Supabase, or a
 * legacy single-value localStorage record) into a valid ordered,
 * deduplicated selection - distinct values (case-insensitively), never
 * more than MAX_INTENTIONS, order preserved. Never mutates the input.
 * @param {unknown} value
 * @returns {string[]}
 */
export const sanitizeIntentions = (value) => {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (result.some((existing) => isSameIntention(existing, trimmed))) continue;
    result.push(trimmed);
    if (result.length >= MAX_INTENTIONS) break;
  }
  return result;
};

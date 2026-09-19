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

export const LIMIT_MESSAGE = 'You can choose up to two intentions.';

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

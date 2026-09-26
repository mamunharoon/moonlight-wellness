// WakeWise Phase 2 (B2) — decorative icons alongside each intention
// preset. Material Symbols Outlined - the exact same icon font/ligature
// pattern already used throughout this app (see SelectionChip.jsx's own
// `icon` prop, e.g. "air"/"bolt" on Anytime Reset/Meditate) - never an
// emoji, never a new icon dependency. Purely decorative: every consumer
// renders this with aria-hidden="true", since the intention's own text
// label is already the accessible name (identical convention to every
// other icon+label control in this app).
//
// Kept as its own small file (not folded into intentionAffirmations.js)
// because it is a presentation-only concern - INTENTION_PRESETS/
// INTENTION_AFFIRMATIONS describe what an intention IS and means; this
// describes only how to draw it, and callers that only need one concern
// (e.g. Affirmation.jsx, which never shows icons) don't need to import
// the other.
export const INTENTION_ICON_BY_PRESET = Object.freeze({
  'Stay calm': 'waves',
  'Be grateful': 'wb_twilight',
  'Be patient': 'hourglass_empty',
  'Stay focused': 'track_changes',
  'Take one step forward': 'footprint',
  'Be kind to yourself': 'favorite'
});

// Shown for a custom (non-preset) intention - a neutral sparkle, never
// implying a meaning for text this app has no fixed understanding of
// (mirrors intentionAffirmations.js's own DEFAULT_AFFIRMATION reasoning:
// never derived from or suggestive of the user's own free-typed words).
export const DEFAULT_INTENTION_ICON = 'auto_awesome';

/**
 * @param {string} intention - a preset from INTENTION_PRESETS, or any
 *   custom string
 * @returns {string} a Material Symbols Outlined ligature name
 */
export const getIntentionIcon = (intention) => INTENTION_ICON_BY_PRESET[intention] ?? DEFAULT_INTENTION_ICON;

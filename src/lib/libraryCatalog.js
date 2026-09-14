// WakeWise — Library, Phase 3: category catalogue
//
// Maps every id already in BETA_VIDEO_MANIFEST to one of the six Library
// categories, purely for browsing/discovery — this is a new, independent
// grouping for "browse everything," not a re-statement of which
// contextual page each id already appears on (several ids already appear
// on more than one page today, e.g. E24 "Confidence" on Affirmation.jsx
// alongside the separate A01 "Confidence Affirmations"). Grouped by each
// video's own theme/title instead, since that is what actually helps
// someone find something in a browsable list.
//
// This is the one place that needs updating if a new manifest id is ever
// added but not yet assigned a Library category — getLibraryCategory
// below falls back to 'Calm & Support' for any id missing here rather
// than silently dropping it from the Library.
export const LIBRARY_CATEGORIES = [
  'Morning',
  'Calm & Support',
  'Breathing',
  'Gratitude & Reflection',
  'Stretching',
  'Sleep Soundscapes'
];

const CATEGORY_MAP = {
  // Morning
  E06: 'Morning', E07: 'Morning', E11: 'Morning', E12: 'Morning', E13: 'Morning',
  E14: 'Morning', E15: 'Morning', F01: 'Morning', F02: 'Morning', F03: 'Morning',

  // Calm & Support
  E02: 'Calm & Support', E03: 'Calm & Support', E09: 'Calm & Support', E16: 'Calm & Support',
  E17: 'Calm & Support', E18: 'Calm & Support', E19: 'Calm & Support',
  G01: 'Calm & Support', G02: 'Calm & Support', G03: 'Calm & Support', G04: 'Calm & Support',
  M01: 'Calm & Support', M02: 'Calm & Support', M03: 'Calm & Support', M04: 'Calm & Support', M05: 'Calm & Support',

  // Breathing
  E08: 'Breathing', E28: 'Breathing',
  B01: 'Breathing', B02: 'Breathing', B03: 'Breathing', B04: 'Breathing', B05: 'Breathing',

  // Gratitude & Reflection
  E04: 'Gratitude & Reflection', E05: 'Gratitude & Reflection', E10: 'Gratitude & Reflection',
  E20: 'Gratitude & Reflection', E21: 'Gratitude & Reflection', E22: 'Gratitude & Reflection',
  E23: 'Gratitude & Reflection', E24: 'Gratitude & Reflection', E25: 'Gratitude & Reflection',
  E26: 'Gratitude & Reflection', E27: 'Gratitude & Reflection', E29: 'Gratitude & Reflection',
  E30: 'Gratitude & Reflection',
  A01: 'Gratitude & Reflection', A02: 'Gratitude & Reflection', A03: 'Gratitude & Reflection',
  A04: 'Gratitude & Reflection', A05: 'Gratitude & Reflection', A06: 'Gratitude & Reflection',

  // Stretching
  S01: 'Stretching', S02: 'Stretching', S03: 'Stretching', S04: 'Stretching', S05: 'Stretching',

  // Sleep Soundscapes
  SL01: 'Sleep Soundscapes', SL02: 'Sleep Soundscapes', SL03: 'Sleep Soundscapes', SL04: 'Sleep Soundscapes',
  SL05: 'Sleep Soundscapes', SL06: 'Sleep Soundscapes', SL07: 'Sleep Soundscapes', SL08: 'Sleep Soundscapes'
};

export const getLibraryCategory = (id) => CATEGORY_MAP[id] || 'Calm & Support';

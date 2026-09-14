// WakeWise — Daily Journey & Content Architecture: central media catalogue
//
// Single source of truth for every content id's discovery metadata
// (category, time of day, recommended feelings, primary contextual
// page). Deliberately layered ON TOP of betaVideoManifest.js rather than
// replacing it: storagePath/title/description there are mirrored
// byte-for-byte in supabase/functions/get-beta-video-url/index.ts's own
// EXERCISE_PATHS map, so that file stays untouched (zero risk to the
// signed-URL mechanism) — this file only adds the metadata Library.jsx,
// Support.jsx, and the routine pages need to organise that same 65-id
// set into one coherent journey, replacing the previous split between
// betaVideoManifest.js (id/title/storagePath) and the now-deleted
// libraryCatalog.js (category only) — one file, one lookup, no
// competing definitions.
//
// CATEGORY RECATEGORISATION (Daily Journey audit — reported, not silent)
// Two categories from the previous Library pass are now split further,
// matching this batch's approved 8-category list:
//   - "Positive Energy & Confidence" is new. E11/E12/E14/E24/A01/A04 move
//     out of Morning/Gratitude & Reflection into it — all six are
//     energy/confidence/motivation themed by title, a better semantic
//     fit than the general buckets they started in.
//   - "Evening Wind-Down" is new, split out of "Gratitude & Reflection".
//     E05/E10/E20/E27/E30 (Prepare for Rest's own video rows) and
//     M01-M05 (Reflection.jsx's "Meditation Sessions", an evening-only
//     step) move into it — their actual contextual placement has always
//     been evening-wind-down pages, not general reflection.
// Every other id's category is unchanged from the prior Library pass.
//
// REACHABILITY NOTE (flagged, not silently fixed)
// E16 (Anxiety Relief) and E17 (Stress Reset) were part of Support.jsx's
// original mood-video mapping before the "Need a moment" journey was
// rebuilt into its current direct feeling->recommendation flow (which
// uses E02/E03/E04/E08/E09 instead) — neither id has a contextual page
// reference anymore. Not unreachable overall (both are fully browsable
// and playable via Library, same as any other id), just no longer
// embedded in a specific flow. `page: null` reflects this honestly
// rather than inventing a placement that doesn't exist today.
//
// `page` is the id's PRIMARY contextual page for audit purposes — a few
// ids genuinely appear on more than one page today (e.g. E09 on both
// /support and /grounding); this field names the more prominent one and
// is not meant to enumerate every occurrence.
import { BETA_VIDEO_MANIFEST, getBetaVideoById } from './betaVideoManifest';

export const CATALOG_CATEGORIES = [
  'Morning',
  'Positive Energy & Confidence',
  'Calm & Support',
  'Breathing',
  'Gratitude & Reflection',
  'Evening Wind-Down',
  'Stretching',
  'Sleep Soundscapes'
];

const CATEGORY_ICONS = {
  Morning: 'wb_sunny',
  'Positive Energy & Confidence': 'bolt',
  'Calm & Support': 'self_improvement',
  Breathing: 'air',
  'Gratitude & Reflection': 'favorite',
  'Evening Wind-Down': 'bedtime',
  Stretching: 'accessibility_new',
  'Sleep Soundscapes': 'nights_stay'
};

export const getCategoryIcon = (category) => CATEGORY_ICONS[category] || 'category';

// id -> { category, timeOfDay, page, feelings? }
const METADATA = {
  // Morning
  E06: { category: 'Morning', timeOfDay: 'morning', page: '/morning-start' },
  E07: { category: 'Morning', timeOfDay: 'morning', page: '/affirmation' },
  E13: { category: 'Morning', timeOfDay: 'morning', page: '/morning-start' },
  E15: { category: 'Morning', timeOfDay: 'morning', page: '/morning-start' },
  F01: { category: 'Morning', timeOfDay: 'morning', page: '/intention-setup' },
  F02: { category: 'Morning', timeOfDay: 'morning', page: '/intention-setup' },
  F03: { category: 'Morning', timeOfDay: 'morning', page: '/intention-setup' },

  // Positive Energy & Confidence
  E11: { category: 'Positive Energy & Confidence', timeOfDay: 'morning', page: '/morning-start', feelings: ['low-energy'] },
  E12: { category: 'Positive Energy & Confidence', timeOfDay: 'morning', page: '/affirmation', feelings: ['confidence'] },
  E14: { category: 'Positive Energy & Confidence', timeOfDay: 'morning', page: '/morning-start' },
  E24: { category: 'Positive Energy & Confidence', timeOfDay: 'any', page: '/affirmation' },
  A01: { category: 'Positive Energy & Confidence', timeOfDay: 'any', page: '/affirmation' },
  A04: { category: 'Positive Energy & Confidence', timeOfDay: 'any', page: '/affirmation' },

  // Calm & Support
  E02: { category: 'Calm & Support', timeOfDay: 'any', page: '/support', feelings: ['overwhelmed'] },
  E03: { category: 'Calm & Support', timeOfDay: 'any', page: '/support', feelings: ['anxious'] },
  E09: { category: 'Calm & Support', timeOfDay: 'any', page: '/support', feelings: ['stressed'] },
  E16: { category: 'Calm & Support', timeOfDay: 'any', page: null },
  E17: { category: 'Calm & Support', timeOfDay: 'any', page: null },
  E18: { category: 'Calm & Support', timeOfDay: 'any', page: '/grounding' },
  E19: { category: 'Calm & Support', timeOfDay: 'any', page: '/reflection' },
  G01: { category: 'Calm & Support', timeOfDay: 'any', page: '/grounding' },
  G02: { category: 'Calm & Support', timeOfDay: 'any', page: '/grounding' },
  G03: { category: 'Calm & Support', timeOfDay: 'any', page: '/grounding' },
  G04: { category: 'Calm & Support', timeOfDay: 'any', page: '/grounding' },

  // Breathing
  E08: { category: 'Breathing', timeOfDay: 'any', page: '/breathe', feelings: ['anxious'] },
  E28: { category: 'Breathing', timeOfDay: 'any', page: '/breathe' },
  B01: { category: 'Breathing', timeOfDay: 'any', page: '/breathe' },
  B02: { category: 'Breathing', timeOfDay: 'any', page: '/breathe' },
  B03: { category: 'Breathing', timeOfDay: 'any', page: '/breathe' },
  B04: { category: 'Breathing', timeOfDay: 'any', page: '/breathe' },
  B05: { category: 'Breathing', timeOfDay: 'any', page: '/breathe' },

  // Gratitude & Reflection
  E04: { category: 'Gratitude & Reflection', timeOfDay: 'any', page: '/support', feelings: ['stressed'] },
  E21: { category: 'Gratitude & Reflection', timeOfDay: 'morning', page: '/affirmation' },
  E22: { category: 'Gratitude & Reflection', timeOfDay: 'morning', page: '/affirmation' },
  E23: { category: 'Gratitude & Reflection', timeOfDay: 'evening', page: '/reflection' },
  E25: { category: 'Gratitude & Reflection', timeOfDay: 'evening', page: '/reflection' },
  E26: { category: 'Gratitude & Reflection', timeOfDay: 'morning', page: '/affirmation' },
  E29: { category: 'Gratitude & Reflection', timeOfDay: 'any', page: '/grounding' },
  A02: { category: 'Gratitude & Reflection', timeOfDay: 'any', page: '/affirmation' },
  A03: { category: 'Gratitude & Reflection', timeOfDay: 'any', page: '/affirmation' },
  A05: { category: 'Gratitude & Reflection', timeOfDay: 'any', page: '/affirmation' },
  A06: { category: 'Gratitude & Reflection', timeOfDay: 'any', page: '/affirmation' },

  // Evening Wind-Down (video content — distinct from Sleep Soundscapes)
  E05: { category: 'Evening Wind-Down', timeOfDay: 'evening', page: '/prepare-for-rest' },
  E10: { category: 'Evening Wind-Down', timeOfDay: 'evening', page: '/reflection' },
  E20: { category: 'Evening Wind-Down', timeOfDay: 'evening', page: '/prepare-for-rest' },
  E27: { category: 'Evening Wind-Down', timeOfDay: 'evening', page: '/prepare-for-rest' },
  E30: { category: 'Evening Wind-Down', timeOfDay: 'evening', page: '/prepare-for-rest' },
  M01: { category: 'Evening Wind-Down', timeOfDay: 'evening', page: '/reflection' },
  M02: { category: 'Evening Wind-Down', timeOfDay: 'evening', page: '/reflection' },
  M03: { category: 'Evening Wind-Down', timeOfDay: 'evening', page: '/reflection' },
  M04: { category: 'Evening Wind-Down', timeOfDay: 'evening', page: '/reflection' },
  M05: { category: 'Evening Wind-Down', timeOfDay: 'evening', page: '/reflection' },

  // Stretching
  S01: { category: 'Stretching', timeOfDay: 'any', page: '/morning-flow' },
  S02: { category: 'Stretching', timeOfDay: 'any', page: '/morning-flow' },
  S03: { category: 'Stretching', timeOfDay: 'any', page: '/morning-flow' },
  S04: { category: 'Stretching', timeOfDay: 'morning', page: '/morning-flow' },
  S05: { category: 'Stretching', timeOfDay: 'evening', page: '/morning-flow' },

  // Sleep Soundscapes
  SL01: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL02: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL03: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL04: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL05: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL06: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL07: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL08: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' }
};

const DEFAULT_METADATA = { category: 'Calm & Support', timeOfDay: 'any', page: null };

export const MEDIA_CATALOG = BETA_VIDEO_MANIFEST.map((entry) => ({
  ...entry,
  ...(METADATA[entry.id] || DEFAULT_METADATA),
  active: true
}));

export const getCatalogEntryById = (id) => MEDIA_CATALOG.find((entry) => entry.id === id);

export const getCatalogEntriesByCategory = (category) =>
  MEDIA_CATALOG.filter((entry) => entry.category === category);

export const getCatalogEntriesByFeeling = (feeling) =>
  MEDIA_CATALOG.filter((entry) => entry.feelings?.includes(feeling));

// Re-exported so existing callers (BetaVideoModal.jsx, PrepareForRest.jsx,
// etc.) can migrate to this file without a second import statement.
export { getBetaVideoById };

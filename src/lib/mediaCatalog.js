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

// ============================================================================
// Meditation experience — additive metadata, reusing the exact same 65-id
// catalogue and Storage objects above. No new manifest, no new media, no
// change to any existing category/page/feelings field for these ids — an
// item keeps every placement it already has (e.g. M01 stays on /reflection
// AND becomes eligible for /meditate).
//
// Durations are real, independently verified by playback this batch (open
// each item, read the video element's own reported duration) — never
// estimated from filename or Storage object size (an earlier size-based
// estimate for a different item was tested and was off by 3x, so that
// approach was discarded entirely; see the Meditation Coverage Audit).
//
// MAPPING CONFLICT FOUND AND RESOLVED (reported, not silently guessed):
// E27's verified duration is 2:35 (155s) — 25s short of the Short group's
// own 3:00 floor, so it doesn't cleanly satisfy "3-5 min" the way every
// other Short-tagged item does. The approved suggested mapping still
// places it in Short; it's tagged that way here, but `exactGroupFit:
// false` marks the shortfall so the recommendation engine always surfaces
// it labelled "Closest match" rather than silently presenting 2:35 as an
// exact 3-5 minute session.
// ============================================================================

export const MEDITATION_NEEDS = [
  { id: 'calm', label: 'Calm' },
  { id: 'focus', label: 'Focus' },
  { id: 'mindfulness', label: 'Mindfulness' },
  { id: 'stress-relief', label: 'Stress relief' },
  { id: 'body-awareness', label: 'Body awareness' },
  { id: 'gratitude', label: 'Gratitude' },
  { id: 'self-compassion', label: 'Self-compassion' },
  { id: 'deep-relaxation', label: 'Deep relaxation' }
];

// Only two concrete groups are offered in the time-selection step (plus
// "Any duration") — 10/15-minute groups are deliberately not offered here
// since no existing content reaches them (see the coverage audit).
export const MEDITATION_DURATION_GROUPS = [
  { id: 'quick', label: 'Quick', description: '1–2 min', minSeconds: 60, maxSeconds: 120 },
  { id: 'short', label: 'Short', description: '3–5 min', minSeconds: 180, maxSeconds: 300 },
  { id: 'any', label: 'Any duration', description: null, minSeconds: 0, maxSeconds: Infinity }
];

const MEDITATION_METADATA = {
  E03: { meditationEligible: true, needs: ['calm'], durationSeconds: 100, durationGroup: 'quick', reason: 'Matches your need for calm and fits your quick 1–2 minute window.' },
  E04: { meditationEligible: true, needs: ['stress-relief'], durationSeconds: 110, durationGroup: 'quick', reason: 'Matches your need for stress relief and fits your quick 1–2 minute window.' },
  E08: { meditationEligible: true, needs: ['calm', 'body-awareness'], durationSeconds: 120, durationGroup: 'quick', reason: 'Matches your need for calm and body awareness, and fits your quick 1–2 minute window.' },
  B02: { meditationEligible: true, needs: ['focus', 'calm'], durationSeconds: 180, durationGroup: 'short', reason: 'Matches your need for focus and calm, and fits your short 3–5 minute window.' },
  M01: { meditationEligible: true, needs: ['mindfulness'], durationSeconds: 215, durationGroup: 'short', reason: 'Matches your need for mindfulness and fits your short 3–5 minute window.' },
  M02: { meditationEligible: true, needs: ['body-awareness', 'deep-relaxation'], durationSeconds: 227, durationGroup: 'short', reason: 'Matches your need for body awareness and deep relaxation, and fits your short 3–5 minute window.' },
  E27: { meditationEligible: true, needs: ['deep-relaxation', 'calm'], durationSeconds: 155, durationGroup: 'short', exactGroupFit: false, reason: 'Matches your need for deep relaxation and calm — at 2:35, the closest available match to your short 3–5 minute window.' },
  M03: { meditationEligible: true, needs: ['self-compassion'], durationSeconds: 204, durationGroup: 'short', reason: 'Matches your need for self-compassion and fits your short 3–5 minute window.' },
  M04: { meditationEligible: true, needs: ['gratitude'], durationSeconds: 216, durationGroup: 'short', reason: 'Matches your need for gratitude and fits your short 3–5 minute window.' },
  M05: { meditationEligible: true, needs: ['mindfulness', 'calm'], durationSeconds: 212, durationGroup: 'short', reason: 'Matches your need for mindfulness and calm, and fits your short 3–5 minute window.' }
};

export const MEDIA_CATALOG = BETA_VIDEO_MANIFEST.map((entry) => ({
  ...entry,
  ...(METADATA[entry.id] || DEFAULT_METADATA),
  meditation: MEDITATION_METADATA[entry.id] || null,
  active: true
}));

export const getCatalogEntryById = (id) => MEDIA_CATALOG.find((entry) => entry.id === id);

export const getCatalogEntriesByCategory = (category) =>
  MEDIA_CATALOG.filter((entry) => entry.category === category);

export const getCatalogEntriesByFeeling = (feeling) =>
  MEDIA_CATALOG.filter((entry) => entry.feelings?.includes(feeling));

// Every meditation-eligible entry — the single source /meditate and the
// Library's Meditation filter both read from, so the two surfaces can
// never drift out of sync about which ids qualify.
export const getMeditationCatalog = () => MEDIA_CATALOG.filter((entry) => entry.meditation?.meditationEligible);

// Re-exported so existing callers (BetaVideoModal.jsx, PrepareForRest.jsx,
// etc.) can migrate to this file without a second import statement.
export { getBetaVideoById };

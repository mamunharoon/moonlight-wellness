// WakeWise — Daily Journey & Content Architecture: central media catalogue
//
// Single source of truth for every content id's discovery metadata
// (category, time of day, recommended feelings, primary contextual
// page). Deliberately layered ON TOP of betaVideoManifest.js rather than
// replacing it: storagePath/title/description there are mirrored
// byte-for-byte in supabase/functions/get-beta-video-url/index.ts's own
// EXERCISE_PATHS map, so that file stays untouched (zero risk to the
// signed-URL mechanism) — this file only adds the metadata Library.jsx,
// Support.jsx, and the routine pages need to organise that same 67-id
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
//
// MORNING-FLOW REDESIGN REACHABILITY UPDATE
// E06/E07/E11-E15/E21/E22/E24/E26/A01-A06/F01-F03 lost their `page`
// reference (now null, same convention as E16/E17 above) when their
// guided-video rows were removed from the in-routine Intention/Stretch/
// Breathe/Affirm screens (Set Your Intention, Affirmation.jsx) — those
// screens now show only their own core content, never a video-selection
// list, so background music and narrated video can never compete for the
// user's attention on the same screen. No catalogue entry, id, title,
// description, or Storage asset was touched or deleted — every one of
// these ids remains exactly as fully browsable and playable via Library
// as it always was, same as E16/E17's own precedent above.
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

// Circadian Colors (Build 16) — a semantic accent for the three
// time-of-day-specific categories only, each reusing an existing design
// token already established elsewhere in the app (Home.jsx's Morning/
// Evening pills, Introduction.jsx's welcome cards, the Routines Hub's
// accent borders): Morning -> dawn gold, Breathing -> sage/mint,
// Evening Wind-Down/Sleep Soundscapes -> twilight lavender (sleep is the
// same evening/night family as Evening Wind-Down). Every other category
// (Positive Energy & Confidence, Calm & Support, Gratitude & Reflection,
// Stretching) stays WakeWise's neutral peach - deliberately not "every
// category gets its own colour," just the ones with a real time-of-day
// identity, per the approved "accent where it helps recognise the
// experience, don't flood every screen" direction.
const CATEGORY_ACCENT_CLASSES = {
  Morning: 'text-morning-accent',
  Breathing: 'text-tertiary',
  'Evening Wind-Down': 'text-evening-accent',
  'Sleep Soundscapes': 'text-evening-accent'
};

export const getCategoryAccentClass = (category) => CATEGORY_ACCENT_CLASSES[category] || 'text-primary';

// id -> { category, timeOfDay, page, feelings? }
const METADATA = {
  // Morning
  E06: { category: 'Morning', timeOfDay: 'morning', page: null },
  E07: { category: 'Morning', timeOfDay: 'morning', page: null },
  E13: { category: 'Morning', timeOfDay: 'morning', page: null },
  E15: { category: 'Morning', timeOfDay: 'morning', page: null },
  F01: { category: 'Morning', timeOfDay: 'morning', page: null },
  F02: { category: 'Morning', timeOfDay: 'morning', page: null },
  F03: { category: 'Morning', timeOfDay: 'morning', page: null },

  // Positive Energy & Confidence
  E11: { category: 'Positive Energy & Confidence', timeOfDay: 'morning', page: null, feelings: ['low-energy'] },
  E12: { category: 'Positive Energy & Confidence', timeOfDay: 'morning', page: null, feelings: ['confidence'] },
  E14: { category: 'Positive Energy & Confidence', timeOfDay: 'morning', page: null },
  E24: { category: 'Positive Energy & Confidence', timeOfDay: 'any', page: null },
  A01: { category: 'Positive Energy & Confidence', timeOfDay: 'any', page: null },
  A04: { category: 'Positive Energy & Confidence', timeOfDay: 'any', page: null },

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
  E21: { category: 'Gratitude & Reflection', timeOfDay: 'morning', page: null },
  E22: { category: 'Gratitude & Reflection', timeOfDay: 'morning', page: null },
  E23: { category: 'Gratitude & Reflection', timeOfDay: 'evening', page: '/reflection' },
  E25: { category: 'Gratitude & Reflection', timeOfDay: 'evening', page: '/reflection' },
  E26: { category: 'Gratitude & Reflection', timeOfDay: 'morning', page: null },
  E29: { category: 'Gratitude & Reflection', timeOfDay: 'any', page: '/grounding' },
  A02: { category: 'Gratitude & Reflection', timeOfDay: 'any', page: null },
  A03: { category: 'Gratitude & Reflection', timeOfDay: 'any', page: null },
  A05: { category: 'Gratitude & Reflection', timeOfDay: 'any', page: null },
  A06: { category: 'Gratitude & Reflection', timeOfDay: 'any', page: null },

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
  // Mindful Listening - new real audio-only addition to this same
  // Evening Wind-Down batch (2026-10-05 meditation content refresh).
  // M06COVER (its still cover image) is deliberately absent here - see
  // INTERACTIVE_ONLY_IDS below, same exclusion reason as IB01/IS01/IM01/IM02.
  M06: { category: 'Evening Wind-Down', timeOfDay: 'evening', page: '/reflection' },

  // Stretching
  S01: { category: 'Stretching', timeOfDay: 'any', page: '/morning-flow' },
  S02: { category: 'Stretching', timeOfDay: 'any', page: '/morning-flow' },
  S03: { category: 'Stretching', timeOfDay: 'any', page: '/morning-flow' },
  S04: { category: 'Stretching', timeOfDay: 'morning', page: '/morning-flow' },
  S05: { category: 'Stretching', timeOfDay: 'evening', page: '/morning-flow' },
  // S06-S09 (Anytime Stretch audio sessions) join Stretching here as of
  // the 2026-10-05 stretching content refresh's explicit Library
  // expansion decision - see LIBRARY_EXCLUDED_STRETCH_IDS below for the
  // superseded original "No Library expansion" scope. Their own primary
  // page stays /anytime-stretch (unchanged, still their main entry
  // point); Library is now a second, equally valid way to reach them.
  // S06COVER-S09COVER (their still cover images) are deliberately absent
  // here - see INTERACTIVE_ONLY_IDS below, same exclusion reason as
  // M06COVER.
  S06: { category: 'Stretching', timeOfDay: 'any', page: '/anytime-stretch' },
  S07: { category: 'Stretching', timeOfDay: 'any', page: '/anytime-stretch' },
  S08: { category: 'Stretching', timeOfDay: 'any', page: '/anytime-stretch' },
  S09: { category: 'Stretching', timeOfDay: 'any', page: '/anytime-stretch' },

  // Sleep Soundscapes
  SL01: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL02: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL03: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL04: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL05: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL06: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL07: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL08: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL09: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' },
  SL10: { category: 'Sleep Soundscapes', timeOfDay: 'evening', page: '/prepare-for-rest' }
};

const DEFAULT_METADATA = { category: 'Calm & Support', timeOfDay: 'any', page: null };

// ============================================================================
// Meditation experience — additive metadata, reusing the exact same 67-id
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

// `reason` deliberately isn't stored here — meditationRecommendations.js
// builds the "Why this" copy at match time, from the selection the user
// actually made (need + duration group), so it can never narrate a
// duration window ("fits your short 3-5 minute window") the user didn't
// choose, e.g. when they picked "Any duration" instead.
//
// 2026-10-05 meditation content refresh: M01-M05's underlying Storage
// objects were replaced with new exports (same filenames, genuinely
// different runtimes - verified via ffprobe against the live objects,
// not assumed) - every durationSeconds below for M01-M05 is updated to
// match. Two (M01, M03) no longer cleanly fit the 'short' 180-300s
// window the way they used to - flagged via exactGroupFit: false, same
// precedent as E27's own pre-existing shortfall below, rather than
// silently presenting an inexact match as exact:
//   M01: 316s (was 215s) - 16s OVER short's 300s ceiling.
//   M03: 164s (was 204s) - 16s UNDER short's 180s floor, and also
//        doesn't fit 'quick' (60-120s cap) - genuinely between groups;
//        'short' is the closer of the two and what's tagged here.
// M02/M04/M05 still land cleanly inside 'short' with their new runtimes.
const MEDITATION_METADATA = {
  E03: { meditationEligible: true, needs: ['calm'], durationSeconds: 100, durationGroup: 'quick' },
  E04: { meditationEligible: true, needs: ['stress-relief'], durationSeconds: 110, durationGroup: 'quick' },
  E08: { meditationEligible: true, needs: ['calm', 'body-awareness'], durationSeconds: 120, durationGroup: 'quick' },
  B02: { meditationEligible: true, needs: ['focus', 'calm'], durationSeconds: 180, durationGroup: 'short' },
  M01: { meditationEligible: true, needs: ['mindfulness'], durationSeconds: 316, durationGroup: 'short', exactGroupFit: false },
  M02: { meditationEligible: true, needs: ['body-awareness', 'deep-relaxation'], durationSeconds: 205, durationGroup: 'short' },
  E27: { meditationEligible: true, needs: ['deep-relaxation', 'calm'], durationSeconds: 155, durationGroup: 'short', exactGroupFit: false },
  M03: { meditationEligible: true, needs: ['self-compassion'], durationSeconds: 164, durationGroup: 'short', exactGroupFit: false },
  M04: { meditationEligible: true, needs: ['gratitude'], durationSeconds: 242, durationGroup: 'short' },
  M05: { meditationEligible: true, needs: ['mindfulness', 'calm'], durationSeconds: 245, durationGroup: 'short' }
};

// IB01/IS01 are audio-only interactive-ambient-music loops (see their own
// entries in betaVideoManifest.js), never narrated exercises - they must
// stay fully resolvable via getBetaVideoById() (InteractiveAmbientMusic.jsx's
// own eligibility check depends on it) but must NEVER appear as a
// user-selectable "Watch" row in Library.jsx, which has no concept of an
// audio-only, no-narration entry and would render one as if it were an
// ordinary tappable exercise video. Library.jsx's own grouping
// (itemsByCategory) indexes strictly by CATALOG_CATEGORIES, so simply
// excluding these two ids from MEDIA_CATALOG - the one thing Library.jsx
// actually iterates - is sufficient; getBetaVideoById() itself reads
// BETA_VIDEO_MANIFEST directly and is completely unaffected by this filter.
//
// I01/I02 (Introduction guide videos) share the same exclusion for the
// same structural reason: they must stay reachable via getBetaVideoById()
// from Introduction.jsx alone, and must never surface as a general
// Library/catalog-browsable row.
// IM01/IM02 (Self-Guided Meditation's two selectable sound tracks) join the
// same exclusion for the same reason as IB01/IS01 above - see their own
// entries in betaVideoManifest.js.
// M06COVER (Mindful Listening's still cover image) joins this same
// exclusion for the same structural reason: it must stay reachable only
// via M06's own coverId lookup inside BetaVideoModal.jsx, never as a
// general Library/catalog-browsable row in its own right.
// S06COVER-S09COVER (Anytime Stretch's own still cover images, added in
// the 2026-10-05 stretching refresh) join for the identical reason -
// reachable only via S06-S09's own coverId lookups.
const INTERACTIVE_ONLY_IDS = new Set(['IB01', 'IS01', 'IM01', 'IM02', 'I01', 'I02', 'M06COVER', 'S06COVER', 'S07COVER', 'S08COVER', 'S09COVER']);

// Anytime Stretch (DEV integration) — S06-S09 are real narrated exercises
// (unlike the interactive-only loops above). Originally excluded from
// Library entirely ("No Library expansion" was an explicit requirement
// when this integration was approved - reachable ONLY via
// AnytimeStretch.jsx's own exerciseId lookup). SUPERSEDED 2026-10-05: the
// stretching content refresh explicitly asked for all nine stretching
// sessions (S01-S09) to appear in Library, so S06-S09 are no longer
// listed here - see their own METADATA entries above instead.
// AnytimeStretch.jsx's own exerciseId lookup is completely unaffected
// either way; Library is now simply a second, additional path to the
// same four ids. Kept as its own named (now empty) set rather than
// deleted outright, in case a future id needs this same
// excluded-from-Library-but-real-content treatment - the structural
// distinction from INTERACTIVE_ONLY_IDS above (a different exclusion
// reason) stays documented and ready to reuse.
const LIBRARY_EXCLUDED_STRETCH_IDS = new Set([]);

export const MEDIA_CATALOG = BETA_VIDEO_MANIFEST.filter((entry) => !INTERACTIVE_ONLY_IDS.has(entry.id) && !LIBRARY_EXCLUDED_STRETCH_IDS.has(entry.id)).map((entry) => ({
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

// =============================================================================
// Build 15 UX remediation — Anytime Reset (src/pages/AnytimeReset.jsx).
//
// Deliberately additive and fully separate from MEDITATION_NEEDS/
// MEDITATION_DURATION_GROUPS/MEDITATION_METADATA/getMeditationCatalog
// above: nothing above this comment block is read, written, or otherwise
// affected by anything below it. Meditate.jsx imports only the exports
// above and is untouched by this addition.
//
// Every durationSeconds value below was read from this session's own
// catalogue-wide ffprobe audit against the live Storage objects (not
// guessed from titles) - see the Build 15 implementation report for the
// exact source. A single maxSeconds cap per duration option (rather than
// Meditate's own min/max window) is deliberate: it directly encodes the
// approved rule "never recommend content longer than the selected time"
// as a plain filter, with no per-item "exactGroupFit" override needed.
export const ANYTIME_RESET_NEEDS = Object.freeze([
  { id: 'calm', label: 'Calm' },
  { id: 'focus', label: 'Focus' },
  { id: 'energy', label: 'More energy' },
  { id: 'stress-relief', label: 'Stress relief' },
  { id: 'body-reset', label: 'Body reset' },
  { id: 'quiet-time', label: 'Quiet time' },
  { id: 'better-mood', label: 'Better mood' },
  { id: 'not-sure', label: 'Not sure' }
]);

export const ANYTIME_RESET_DURATIONS = Object.freeze([
  { id: 'quick', label: 'About 2 minutes', maxSeconds: 135 },
  { id: 'short', label: 'About 5 minutes', maxSeconds: 330 },
  { id: 'any', label: 'No preference', maxSeconds: Infinity }
]);

// id -> { needs: string[], durationSeconds: number }. Every id here also
// exists in MEDIA_CATALOG (asserted by getAnytimeResetCatalog below via a
// plain filter, so a typo'd id is silently dropped rather than crashing -
// covered by a dedicated test asserting the expected count survives the
// filter). No id below is exclusive to this feature: all are existing,
// already-shipped, already-Fast-Start catalogue entries.
const ANYTIME_RESET_METADATA = {
  E03: { needs: ['calm'], durationSeconds: 100.1 },
  E08: { needs: ['calm'], durationSeconds: 117.2 },
  B04: { needs: ['calm'], durationSeconds: 163.8 },
  E27: { needs: ['calm'], durationSeconds: 155.6 },
  E13: { needs: ['focus'], durationSeconds: 111.0 },
  F01: { needs: ['focus'], durationSeconds: 155.9 },
  F03: { needs: ['focus'], durationSeconds: 174.3 },
  E11: { needs: ['energy'], durationSeconds: 109.5 },
  E14: { needs: ['energy'], durationSeconds: 102.4 },
  A04: { needs: ['energy'], durationSeconds: 146.1 },
  E04: { needs: ['stress-relief'], durationSeconds: 110.9 },
  E17: { needs: ['stress-relief'], durationSeconds: 116.6 },
  B02: { needs: ['stress-relief'], durationSeconds: 168.9 },
  G02: { needs: ['stress-relief'], durationSeconds: 196.9 },
  G04: { needs: ['stress-relief'], durationSeconds: 172.7 },
  // S01-S03 updated 2026-10-05 - the stretching content refresh replaced
  // their underlying Storage objects with new exports of genuinely
  // different runtimes (ffprobe-verified against the live objects); all
  // three still comfortably clear this feature's own 'short' 330s cap.
  S01: { needs: ['body-reset'], durationSeconds: 117.0 },
  S02: { needs: ['body-reset'], durationSeconds: 212.9 },
  S03: { needs: ['body-reset'], durationSeconds: 208.3 },
  // M01/M03/M05 updated 2026-10-05 - the meditation content refresh
  // replaced their underlying Storage objects with new exports of
  // genuinely different runtimes (ffprobe-verified against the live
  // objects); all three still comfortably clear this feature's own
  // 'short' 330s cap either way, so no need/tier reclassification here,
  // only the numbers themselves.
  M01: { needs: ['quiet-time'], durationSeconds: 316.3 },
  M03: { needs: ['quiet-time'], durationSeconds: 164.4 },
  M05: { needs: ['quiet-time'], durationSeconds: 245.0 },
  E23: { needs: ['better-mood'], durationSeconds: 116.4 },
  A05: { needs: ['better-mood'], durationSeconds: 163.5 },
  A01: { needs: ['better-mood'], durationSeconds: 147.8 }
};

// Every Anytime-Reset-eligible entry, each carrying its own `anytimeReset`
// metadata - the single source anytimeResetRecommendations.js reads from,
// so the two files can never drift out of sync about which ids qualify
// or what their verified duration is.
export const getAnytimeResetCatalog = () =>
  MEDIA_CATALOG
    .filter((entry) => ANYTIME_RESET_METADATA[entry.id])
    .map((entry) => ({ ...entry, anytimeReset: ANYTIME_RESET_METADATA[entry.id] }));

// WakeWise — Self-Guided Meditation — duration choices.
//
// 2/5/10 minutes, exact seconds - the timer is authoritative (see
// meditationSession.js), never derived from anything else. 5 minutes is
// both the default and the "Recommended" choice, matching IM01's own
// approximate length (see betaVideoManifest.js's IM01 entry) - the
// 10-minute session repeats/loops the same track rather than needing a
// second, longer asset.
export const MEDITATION_DURATIONS = [
  { id: '2min', label: '2 minutes', seconds: 120 },
  { id: '5min', label: '5 minutes', seconds: 300, recommended: true },
  { id: '10min', label: '10 minutes', seconds: 600 }
];

export const DEFAULT_MEDITATION_DURATION_ID = '5min';

export const getMeditationDurationById = (id) => MEDITATION_DURATIONS.find((duration) => duration.id === id) || null;

// Embedded Morning/Evening meditation (Journey Embedding) — a context-aware
// "Recommended" badge WITHOUT mutating MEDITATION_DURATIONS' own shared
// `recommended` flag (which must keep marking '5min' for standalone/Library/
// Home entry - the only caller that still reads that flag directly).
// Morning's embedded pre-start recommends 2min instead; Evening's embedded
// pre-start and every other context keep the registry's existing 5min. A
// setup UI renders its badge from THIS function's result, never from the
// per-duration `recommended` field, once it needs to vary by context - see
// MeditationSetupPanel.jsx.
export const MEDITATION_CONTEXTS = Object.freeze({
  STANDALONE: 'standalone',
  MORNING_EMBEDDED: 'morning-embedded',
  EVENING_EMBEDDED: 'evening-embedded'
});

export const getRecommendedDurationId = (context = MEDITATION_CONTEXTS.STANDALONE) =>
  context === MEDITATION_CONTEXTS.MORNING_EMBEDDED ? '2min' : DEFAULT_MEDITATION_DURATION_ID;

// Pre-Build-15 defect fix — found live: MorningMeditate.jsx/EveningMeditate.jsx
// each passed MeditationSetupPanel.jsx's own `beginLabel` prop as a
// hardcoded literal ("Begin 2-Minute Meditation"/"Begin 5-Minute
// Meditation"), completely disconnected from the actually-selected
// `duration` state - correct on first paint (matching each context's own
// starting duration), but never updated again once the user picked a
// different duration in "Choose style, time & sound", even though the
// recommendation card and the duration chip's own selected state (both
// driven by the same live `duration` prop) updated correctly. The timer
// itself was never affected (useMeditationSession's own begin() always
// reads the live `duration.seconds` at call time, confirmed live) - only
// this one label was stale. Single source of truth for the exact
// required format ("Begin 2-Minute Meditation", singular "Minute",
// hyphenated) - `MEDITATION_DURATIONS`' own `label` field ("2 minutes")
// is deliberately not reused as-is, since it's plural/unhyphenated and
// used for a different purpose (the duration chip's own visible text,
// the recommendation card's own summary).
export const formatMeditationBeginLabel = (duration) => {
  const minutes = duration.seconds / 60;
  return `Begin ${minutes}-Minute Meditation`;
};

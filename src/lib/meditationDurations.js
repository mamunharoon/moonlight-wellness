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

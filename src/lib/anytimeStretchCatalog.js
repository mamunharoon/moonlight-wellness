// Anytime Stretch (DEV integration) — the 4 guided-stretch narration
// sessions, now served from the private `wellness-videos` Storage bucket
// via the same signed-URL mechanism every other beta exercise uses
// (`exerciseId` is sent to get-beta-video-url/index.ts's EXERCISE_PATHS -
// see that file's own comment on the S06-S09 block for the real,
// verified storagePath values; this file never holds a filesystem or
// Storage path itself, only the id the server resolves). `durationSeconds`
// is ffprobe-measured from the real files, shown only as an upfront
// estimate in the selection list; actual playback always reads the real
// <audio> element's own `duration` once its metadata loads
// (AnytimeStretch.jsx), never this value - so a replaced file is still
// played/timed correctly even if this number goes stale.
//
// Titles are derived directly from each file's own descriptive filename
// (e.g. ST01_Chest_Shoulder_Stretch -> "Chest & Shoulder Stretch") - no
// invented copy, and match betaVideoManifest.js's own S06-S09 titles
// exactly. Icon reuses JOURNEY_STAGE_ICONS.stretch ('accessibility_new'),
// the same canonical Stretch glyph Morning's own pathway preview already
// uses, so this integration introduces no new icon identity for the same
// concept.
// 2026-11-05 "consistently audio-only" fix (ported from dev commit
// d759a2c onto this PROD-bound branch) — `coverId` is REMOVED from all
// four sessions (the owner replaced all four underlying MP3s in PROD
// Storage with an Adobe Express voice+music mix; these sessions must
// show no exercise photograph here or in Library, matching
// betaVideoManifest.js's own identical coverId removal for S06-S09 -
// see that file's comment for the full rationale). `durationSeconds`
// below is the new ffprobe-measured value against the replaced
// objects - all four genuinely got longer (narration remixed with a
// music bed/fades, not a measurement error).
export const ANYTIME_STRETCH_SESSIONS = [
  {
    id: 'chest-shoulder',
    exerciseId: 'S06',
    title: 'Chest & Shoulder Stretch',
    durationSeconds: 103
  },
  {
    id: 'hands-wrists',
    exerciseId: 'S07',
    title: 'Hands & Wrists Refresh',
    durationSeconds: 97
  },
  {
    id: 'feet-ankles',
    exerciseId: 'S08',
    title: 'Feet & Ankles Refresh',
    durationSeconds: 90
  },
  {
    id: 'gentle-side',
    exerciseId: 'S09',
    title: 'Gentle Side Stretch',
    durationSeconds: 56
  }
];

export const getAnytimeStretchSessionById = (id) => ANYTIME_STRETCH_SESSIONS.find((s) => s.id === id) ?? null;

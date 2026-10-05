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
// 2026-10-05 stretching content refresh: all four durations updated to
// match the re-recorded MP3s (ffprobe-measured against the live
// objects, not guessed) - notably shorter than the previous batch, not
// a measurement error.
export const ANYTIME_STRETCH_SESSIONS = [
  {
    id: 'chest-shoulder',
    exerciseId: 'S06',
    title: 'Chest & Shoulder Stretch',
    durationSeconds: 52
  },
  {
    id: 'hands-wrists',
    exerciseId: 'S07',
    title: 'Hands & Wrists Refresh',
    durationSeconds: 44
  },
  {
    id: 'feet-ankles',
    exerciseId: 'S08',
    title: 'Feet & Ankles Refresh',
    durationSeconds: 41
  },
  {
    id: 'gentle-side',
    exerciseId: 'S09',
    title: 'Gentle Side Stretch',
    durationSeconds: 49
  }
];

export const getAnytimeStretchSessionById = (id) => ANYTIME_STRETCH_SESSIONS.find((s) => s.id === id) ?? null;

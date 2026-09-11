// WakeWise — Beta Video Preview (localhost testing pass).
//
// TEMPORARY LOCAL MANIFEST — not a database table. The app has no
// content model for video yet (audioLibrary.js is audio-only, gated by
// Plus subscription, and still fully comingSoon). This file exists only
// because nine beta exercise videos are live in Storage today and need
// a minimal, typed, isolated place to map an id -> title -> object
// path. When a real "exercises" table exists, replace this file with a
// query and delete it — nothing outside src/lib/betaVideo*.js and
// BetaVideoModal.jsx should ever import it directly.
//
// `storagePath` is an object path inside the private `wellness-videos`
// bucket (bucket root, includes the `exercises/` folder) — never a
// public URL. It is only ever sent to the get-beta-video-url Edge
// Function, which is the one place allowed to turn it into a short-lived
// signed URL. Object names are exactly what's in Storage today (verified
// via `supabase db query --linked` against storage.objects for E02-E10,
// not assumed from any spec) — not renamed, typos and double extensions
// included.
//
// @typedef {Object} BetaVideoEntry
// @property {string} id            - stable id sent to the Edge Function (E02-E10)
// @property {string} title         - exercise/video title shown on the beta card. Distinct
//                                     from Support.jsx's "I feel overwhelmed" mood-card copy
//                                     (E02's filename concept, "OverwhelmedMind") - that mood
//                                     label stays as-is; this is the exercise's own title.
// @property {string} storagePath   - object path within the private `wellness-videos` bucket
// @property {string} description   - short, non-clinical one-liner for the beta card

/** @type {BetaVideoEntry[]} */
export const BETA_VIDEO_MANIFEST = [
  {
    id: 'E02',
    title: 'Overwhelmed Mind',
    storagePath: 'exercises/WW_E02_OverwhelmedMind_Final_v2.mp4Use.mp4',
    description: 'Too much at once. A guided video to help you set some of it down.'
  },
  {
    id: 'E03',
    title: 'Instant Calm',
    storagePath: 'exercises/WW_E03_InstantCalm_v3.mp4.mp4',
    description: 'A fast, guided reset for your nervous system.'
  },
  {
    id: 'E04',
    title: 'Release Tension',
    storagePath: 'exercises/WW_E04_ReleaseTension_Portrait_v2png.mp4',
    description: 'A short guided sequence to let go of physical tension.'
  },
  {
    id: 'E05',
    title: 'Night-time Calm',
    storagePath: 'exercises/WW_E05_NightTimeCalm_v2.mp4.mp4',
    description: 'A slow wind-down video to ease you toward sleep.'
  },
  {
    id: 'E06',
    title: 'Gentle Awakening',
    storagePath: 'exercises/WW_E06_GentleAwakening_Gratitude_v3.mp3.mp4',
    description: 'A soft guided start to ease into your morning.'
  },
  {
    id: 'E07',
    title: 'Morning Gratitude',
    storagePath: 'exercises/WW_E07_MorningGratitude_Music_v2.mp3.mp4',
    description: 'A short guided moment to set a grateful tone for the day.'
  },
  {
    id: 'E08',
    title: 'Deep Breathing',
    storagePath: 'exercises/WW_E08_DeepBreathing_v2.mp4.mp4',
    description: 'A guided deep-breathing video to center yourself.'
  },
  {
    id: 'E09',
    title: 'Mindful Pause',
    storagePath: 'exercises/WW_E09_MindfulPause_Music_v1.mp3.mp4',
    description: 'A brief guided pause to reset your attention.'
  },
  {
    id: 'E10',
    title: 'Evening Reflection',
    storagePath: 'exercises/WW_E10_EveningReflection_Music_v1.mp3.mp4',
    description: 'A guided reflection to close out your day.'
  }
];

export const getBetaVideoById = (id) => BETA_VIDEO_MANIFEST.find((entry) => entry.id === id);

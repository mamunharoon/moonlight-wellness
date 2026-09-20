// First-use WakeWise introduction — media configuration.
//
// The two guide clips are now live (WW_I01_WelcomeToWakeWise_v1.mp4 /
// WW_I02_HowToUseWakeWise_v1.mp4, verified against storage.objects and
// registered as I01/I02 in betaVideoManifest.js + the get-beta-video-url
// Edge Function's EXERCISE_PATHS map). `storageRef` here is the MANIFEST
// ID (`getBetaVideoById(storageRef)`), never a raw Storage path or a
// signed URL — Introduction.jsx resolves the id to a signed URL itself,
// on demand, the exact same way every other private video in this app
// does (useProtectedVideo + BetaVideoModal + betaVideoAccess.js). Keeping
// this file id-only, not path-bearing, means a future re-upload/rename
// only ever needs updating in betaVideoManifest.js/the Edge Function -
// never here.
//
// Shape mirrors betaVideoManifest.js's own established fields (id, title,
// description) plus what the player additionally needs (mediaType,
// durationSeconds, captionRef) and the availability flag itself - matching
// this codebase's existing isFeatureEnabled()/FEATURE_FLAGS convention
// (featureFlags.js) for "a flag decides what's reachable", but scoped per
// media item rather than per app-wide feature.
//
// captionRef is deliberately still null - see this migration's own
// caption-track findings (no embedded subtitle/caption track exists in
// either exported MP4, confirmed via MP4 box inspection: only `vide`/
// `soun` handler types present). Inventing a WebVTT reference before a
// real transcript exists would be a fabricated identifier, not a
// placeholder - flagged as a follow-up requirement before public release,
// not a blocker for this DEV integration.
export const INTRODUCTION_MEDIA = [
  {
    id: 'why-wakewise',
    title: 'Why WakeWise',
    description: 'A brief introduction to the purpose of WakeWise and how it can support your daily wellbeing.',
    mediaType: 'video', // 'video' | 'audio'
    storageRef: 'I01', // betaVideoManifest.js id - resolved via getBetaVideoById()
    durationSeconds: null,
    captionRef: null, // caption/transcript reference (e.g. a WebVTT storage path) - none exists yet, see header comment
    available: true
  },
  {
    id: 'how-to-use-wakewise',
    title: 'How to Use WakeWise',
    description: 'A quick guide to Morning, Evening, calming practices and the Library.',
    mediaType: 'video',
    storageRef: 'I02',
    durationSeconds: null,
    captionRef: null,
    available: true
  }
];

// First-use WakeWise introduction — future media configuration.
//
// The two guide clips referenced on Introduction.jsx do not exist yet: no
// storage object, no URL, no duration has been produced or approved. This
// config is the single place that will change once a real asset exists -
// Introduction.jsx itself only ever reads `available` to decide whether to
// render a working Play control or a "Coming soon" card, so connecting a
// real clip later is exactly one edit here, no component changes required.
//
// Shape mirrors betaVideoManifest.js's own established fields (id, title,
// description, storagePath) plus what a real player will additionally need
// (mediaType, durationSeconds, captionRef) and the availability flag itself
// - matching this codebase's existing isFeatureEnabled()/FEATURE_FLAGS
// convention (featureFlags.js) for "a flag decides what's reachable", but
// scoped per media item rather than per app-wide feature.
//
// storageRef/captionRef are deliberately null - inventing a Supabase
// Storage path or a caption/transcript reference before the real object
// exists would be a fabricated identifier, not a placeholder.
export const INTRODUCTION_MEDIA = [
  {
    id: 'why-wakewise',
    title: 'Why WakeWise',
    description: 'A brief introduction to the purpose of WakeWise and how it can support your daily wellbeing.',
    mediaType: 'video', // 'video' | 'audio'
    storageRef: null, // Supabase Storage object path, once the real asset exists
    durationSeconds: null,
    captionRef: null, // caption/transcript reference (e.g. a WebVTT storage path)
    available: false
  },
  {
    id: 'how-to-use-wakewise',
    title: 'How to Use WakeWise',
    description: 'A quick guide to Morning, Evening, calming practices and the Library.',
    mediaType: 'video',
    storageRef: null,
    durationSeconds: null,
    captionRef: null,
    available: false
  }
];

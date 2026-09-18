// Background-music framework, Phase 1 (scaffold only - see
// docs/background-music-specification.md for the full plan). Mirrors
// reducedMotionPreference.js's own get/set-with-safe-fallback shape
// exactly, as its own independent preference: reduced motion is a visual
// preference and must never be read as a stand-in for this one, and vice
// versa - a user who wants a calmer screen does not necessarily want
// silence, and a user who wants no music does not necessarily want
// reduced animation.
//
// Default is OFF (conservative) rather than defaulting music on: no
// licensed music asset exists yet (see the spec doc), so this is
// currently a no-op in practice either way, but the conservative default
// matters once real assets ship - a new/returning user should not be
// surprised by audio they never opted into, and background music is a
// meaningfully bigger UX change than most toggles default to permitting.
const MUSIC_PREFERENCE_KEY = 'moonlight_background_music_enabled';

export const getMusicPreference = () => {
  try {
    return localStorage.getItem(MUSIC_PREFERENCE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setMusicPreference = (enabled) => {
  try {
    localStorage.setItem(MUSIC_PREFERENCE_KEY, enabled ? 'true' : 'false');
  } catch {
    // localStorage unavailable - the toggle simply won't persist this session.
  }
};

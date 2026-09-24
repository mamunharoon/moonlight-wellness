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

// Guest pre-start-music correction (Build 18) — the single, explicit,
// shared API distinguishing the two real cases every interactive-timed
// screen's music control needs, so no page has to hand-roll its own
// `if (!isGuest) setMusicPreference(...)` workaround:
//   - an authenticated user's choice persists to the real, device-shared
//     MUSIC_PREFERENCE_KEY above, exactly as before - honoured everywhere
//     else on this device (BetaVideoModal.jsx, every other pre-start
//     screen);
//   - a guest's choice is intentionally NEVER written here. It still
//     drives real playback for the current mount (the calling page's own
//     `musicPreferenceOn` component state, passed straight through to
//     MusicPreferenceToggle's `isOn` and to the Begin handler's decision
//     to call InteractiveAmbientMusic's start()) - it is a genuine,
//     functioning session-only choice, not a no-op, just never persisted
//     to the one key every other account on this device could read back
//     (see MUSIC_PREFERENCE_KEY's own doc comment: single, device-scoped,
//     no per-account namespace).
// InteractiveAmbientMusic.jsx's own handleToggle already applied exactly
// this same guest-vs-authenticated split inline, twice, before this
// function existed - it and every pre-start screen (Breathe.jsx,
// MorningFlow.jsx, EveningBreathing.jsx, QuietBreathing.jsx's standalone
// branch) now all call through this one place instead.
export const setMusicPreferenceForUser = (enabled, { isGuest }) => {
  if (isGuest) return;
  setMusicPreference(enabled);
};

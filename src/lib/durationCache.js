// WakeWise — Library, Phase 3: real-duration cache
//
// The Library needs to show a "Duration" for every item, but the app has
// no verified runtime for the ~57 guided-video ids (only SL01-SL10 have
// an explicit, verified-duration durationLabel — see
// betaVideoManifest.js). Probing every item's actual video duration up
// front would mean fetching a signed URL for each one on page load,
// which directly violates "request the signed URL only after the
// authenticated user chooses an item or presses Play" / "do not preload
// large videos on app startup."
//
// Instead: BetaVideoModal.jsx already loads real playback metadata every
// time ANY user actually opens a video (that's an existing, already-
// permitted request — the user chose that item). This module lets it
// cache the video's own reported duration, in whole minutes, keyed by
// content id, the first time that happens — after which the Library can
// show a real, verified duration for that item instead of a guess. Until
// an item has been played at least once in this browser, the Library
// shows a plain "Guided video" label rather than a fabricated number.
const CACHE_KEY = 'moonlight_video_durations';

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const getCachedDurationMinutes = (id) => {
  const cache = readCache();
  const value = cache[id];
  return typeof value === 'number' && value > 0 ? value : null;
};

export const cacheDurationSeconds = (id, seconds) => {
  if (!id || !Number.isFinite(seconds) || seconds <= 0) return;
  try {
    const cache = readCache();
    cache[id] = Math.max(1, Math.round(seconds / 60));
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage unavailable/exceeded — purely a cosmetic cache, safe to skip.
  }
};

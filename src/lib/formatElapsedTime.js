// Shared m:ss formatter for an audio/video element's own currentTime/
// duration - used by every custom (non-native-controls) playback UI in
// this app (AnytimeStretch.jsx's inline player, BetaVideoModal.jsx's
// minimal audio player branch) so the two never drift into two slightly
// different time-display implementations.
export const formatElapsedTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

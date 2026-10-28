// Coordinated audio/visual handoff — a bounded wait for an in-flight async
// operation (a music fade-out) so a caller can never stall indefinitely.
// Resolves as soon as `promise` genuinely settles, resolved OR rejected (a
// failed fade is handled exactly like a finished one - never surfaced as a
// blocking error, per "handle failed playback without unnecessary delay"),
// or after `fallbackMs` elapses, whichever happens first.
export const awaitWithFallback = (promise, fallbackMs) => new Promise((resolve) => {
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    resolve();
  };
  Promise.resolve(promise).then(finish, finish);
  setTimeout(finish, fallbackMs);
});

// Natural-completion fades run for FADE_OUT_DURATION_MS (2000ms, both
// InteractiveAmbientMusic.jsx and meditationAudioController.js) - this adds
// a 500ms safety margin over that for ordinary timer drift (e.g. a
// backgrounded tab briefly throttling the fade's own setInterval), while
// still bounding the absolute worst case so a reveal/navigate gated on this
// can never hang indefinitely.
export const AUDIO_HANDOFF_FALLBACK_MS = 2500;

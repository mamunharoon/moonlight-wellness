// WakeWise — Self-Guided Meditation — audio controller.
//
// Reuses the exact same signed-URL resolution as IB01/IS01
// (requestBetaVideoUrl, betaVideoAccess.js) - no duplicated network/signing
// logic. A new, small controller rather than extending the existing
// InteractiveAmbientMusic.jsx: that component's public surface is
// deliberately start()-only (see its own doc comment) because
// breathing/stretching screens only ever fully stop or fully restart their
// music. This feature needs independent pause()/resume() (Pause must
// freeze both timer and music; Resume must continue both without
// re-fetching or restarting) - a genuinely different contract, so a
// sibling controller avoids widening IB01/IS01's shared component with
// behaviour those four existing screens never asked for.
//
// `createAudioElement`/`resolveUrl` are injectable purely so this module
// can be unit-tested with a plain fake object standing in for
// HTMLAudioElement - this repo's Vitest runs with environment: 'node'
// (see vite.config.js), so there is no real Audio/DOM available in tests.
// Production callers omit both and get the real `new Audio()` +
// requestBetaVideoUrl.
//
// `isCurrent` (Self-Guided Meditation Sound Choices - multi-track support):
// meditationSessionController.js now keeps one of these controllers per
// track id (IM01/IM02) alive at once, so a track the user has since
// switched away from can still have a `start()` in flight when the switch
// happens. Re-checked immediately after each `await` inside start() - if
// the caller reports this is no longer the selected track, the resolved
// signed URL is never applied to an audible, unpaused element: this is
// exactly the `suspendedRef`-after-async-gap pattern
// InteractiveAmbientMusic.jsx already established, applied here at the
// controller level instead of a component ref. Defaults to "always
// current" so a caller that only ever manages one track (or a test that
// doesn't care) is unaffected.
import { requestBetaVideoUrl } from './betaVideoAccess';

const DEFAULT_VOLUME = 0.35;

export const createMeditationAudioController = ({
  mediaId,
  createAudioElement = () => new Audio(),
  resolveUrl = requestBetaVideoUrl,
  isCurrent = () => true
} = {}) => {
  let audio = null;
  let isBusy = false;
  let started = false;
  let lastError = null;

  const start = async () => {
    // Guards both a duplicate concurrent start() (isBusy, matching
    // InteractiveAmbientMusic's own isBusyRef pattern) and a start() after
    // one already succeeded (started) - together these make repeated Begin
    // taps or a stray extra call safe: at most one signed-URL request and
    // one audio element are ever created for the life of this controller.
    if (isBusy || started) return;
    isBusy = true;
    lastError = null;
    try {
      const { url } = await resolveUrl(mediaId);
      // Re-check after the async gap - see this function's own isCurrent
      // doc comment above. Bail before ever touching the element so a
      // stale switch can never make a no-longer-selected track audible.
      if (!isCurrent()) return;
      if (!audio) audio = createAudioElement();
      audio.src = url;
      // Native loop, exactly like IB01/IS01 (InteractiveAmbientMusic.jsx) -
      // this is how the 10-minute session safely repeats IM01/IM02 without
      // any JS-level 'ended' listener, manual restart, or a second element:
      // the browser itself re-starts playback at the loop boundary, and
      // the timer (meditationSession.js) never observes or reacts to it.
      audio.loop = true;
      audio.volume = DEFAULT_VOLUME;
      await audio.play();
      // The element genuinely loaded and started - mark it so a later
      // switch back to this track can resume() (no re-fetch) rather than
      // start() again. Still immediately paused below if the user has
      // since switched to a different track during this same play() call.
      started = true;
      if (!isCurrent()) audio.pause();
    } catch (error) {
      // Signed-URL failure, network failure, or a play() rejection
      // (e.g. an anonymous/guest session - the Edge Function requires a
      // signed-in, non-anonymous user) - the meditation continues silently
      // without music; lastError is exposed only for a small, unobtrusive
      // status line, never surfaced as a blocking error.
      lastError = error;
    } finally {
      isBusy = false;
    }
  };

  const pause = () => {
    if (audio && started) audio.pause();
  };

  // Resume never re-fetches or re-sets `src` - it's the same element,
  // already primed with the signed URL from the original start(), so
  // "continue without restarting" is true by construction rather than by
  // convention.
  const resume = () => {
    if (!audio || !started) return;
    Promise.resolve(audio.play()).catch(() => {
      lastError = new Error('Resume playback failed');
    });
  };

  // Distinct from pause(): used for a deliberate stop (natural completion,
  // End Session, unmount-adjacent cleanup) where the caller does not
  // intend to resume() this same instance again.
  const stop = () => {
    if (audio) audio.pause();
  };

  // Full teardown - mirrors InteractiveAmbientMusic.jsx's own unmount
  // cleanup effect exactly (pause, removeAttribute('src'), load()) so the
  // element releases its network/buffer resources the same proven way.
  const destroy = () => {
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      if (typeof audio.load === 'function') audio.load();
    }
    audio = null;
    started = false;
    isBusy = false;
  };

  return {
    start,
    pause,
    resume,
    stop,
    destroy,
    hasStarted: () => started,
    isBusy: () => isBusy,
    getLastError: () => lastError
  };
};

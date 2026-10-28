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
const FADE_OUT_DURATION_MS = 2000;
const FADE_STEP_MS = 50;

export const createMeditationAudioController = ({
  mediaId,
  createAudioElement = () => new Audio(),
  resolveUrl = requestBetaVideoUrl,
  isCurrent = () => true
} = {}) => {
  let audio = null;
  let started = false;
  let lastError = null;
  // Verification-pass correction (F4 acceptance audit) — preload() and
  // start() used to share one `isBusy` flag. Found live via the required
  // "Start now before preload completes" test: tapping Start now (a fully
  // legitimate, encouraged skip gesture) while preload()'s own fetch was
  // still in flight made start() hit `if (isBusy || started) return;` and
  // silently return WITHOUT EVER PLAYING - preload()'s later completion
  // never retried it, so the session ran with no music at all, with
  // nothing about it visibly wrong (the countdown/timer transitioned
  // completely normally). Reproduced live: `play()` call count 0,
  // Active-state reached true. `preloadPromise` now tracks only the
  // in-flight preload; start() `await`s it (succeed or fail) instead of
  // bailing, so a Start-now that races an in-flight preload still plays
  // as soon as that same fetch resolves, rather than being silently lost.
  // `startInFlight` is start()'s own separate duplicate-call guard.
  let preloadPromise = null;
  let startInFlight = false;
  // Natural-completion fade-out (gentle ~2s ramp, not baked into the loop
  // files themselves - see fadeOutAndStop below). `fading` is read by
  // destroy() so the unmount cleanup that fires the instant the owning
  // page navigates away on completion (meditationSessionController.js's
  // own destroy(), called from useMeditationSession.js's unmount effect)
  // does NOT abruptly cut this ramp off mid-fade - it defers entirely to
  // the fade's own self-contained setInterval, which keeps running via
  // this closure even after the React page that started it has already
  // unmounted (a bare `new Audio()` has no DOM/render-tree dependency).
  // fadeIntervalId/fadeGeneration let any OTHER call (pause/resume/stop/
  // destroy/a fresh start) cancel an in-flight fade and restore full
  // volume immediately - every one of those paths must stay instant per
  // the product requirement ("preserve immediate stopping when
  // required"), so a fade is only ever allowed to run to completion
  // on its own, never block a real stop.
  let fading = false;
  let fadeIntervalId = null;
  let fadeGeneration = 0;

  // Restores DEFAULT_VOLUME whenever an in-flight fade is actually
  // cancelled (a no-op when nothing was fading) - a ramp stopped partway
  // through would otherwise leave the element sitting at whatever partial
  // volume it had just reached, silently undercutting whatever happens
  // next. Centralised here rather than left to each caller individually.
  // iOS/WKWebView verification pass (B66 physical-iPhone review) - see
  // InteractiveAmbientMusic.jsx's own ensureAudioGraph doc comment for the
  // full rationale (verified via MDN/Apple's own WebKit docs, not
  // assumed: iOS ignores HTMLMediaElement.volume entirely for real
  // output) and the CORS verification backing crossOrigin below. Guarded
  // with `typeof window !== 'undefined'` so this gracefully no-ops in
  // this repo's Vitest (environment: 'node' - no window/AudioContext at
  // all there), falling back to the original audio.volume path, which is
  // exactly what every existing real-execution test in
  // meditationSessionController.test.js already exercises and asserts on.
  let audioContext = null;
  let gainNode = null;
  let audioGraphFailed = false;

  const ensureAudioGraph = () => {
    if (gainNode || audioGraphFailed) return gainNode;
    if (!audio || typeof window === 'undefined') return null;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        audioGraphFailed = true;
        return null;
      }
      const ctx = new AudioContextClass();
      const source = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);
      audio.volume = 1; // unity - GainNode is the only volume control from here on, never both at once
      gain.gain.value = DEFAULT_VOLUME;
      audioContext = ctx;
      gainNode = gain;
      return gain;
    } catch {
      audioGraphFailed = true;
      return null;
    }
  };

  const setLevel = (value) => {
    if (gainNode) {
      gainNode.gain.value = value;
      return;
    }
    if (audio) audio.volume = value;
  };

  const getLevel = () => {
    if (gainNode) return gainNode.gain.value;
    return audio ? audio.volume : DEFAULT_VOLUME;
  };

  const cancelFade = () => {
    const wasFading = fading;
    fading = false;
    fadeGeneration += 1;
    if (fadeIntervalId) {
      clearInterval(fadeIntervalId);
      fadeIntervalId = null;
    }
    if (wasFading) setLevel(DEFAULT_VOLUME);
  };

  // Build 16 physical-iPhone correction (F4) — resolves the signed URL and
  // primes the element's `src` WITHOUT calling play(), so the network
  // round-trip that used to only ever begin the instant start() was
  // called (i.e. the instant the exercise timer also started - the
  // measured root cause of "music starts late") can instead happen
  // earlier, while the preparation countdown is showing. A no-op if
  // start() has already run (`started`), the element already exists
  // (`audio`), or a preload is already in flight (`preloadPromise`) -
  // safe to call defensively without its own guard at every call site.
  const preload = () => {
    if (started || audio || preloadPromise) return preloadPromise ?? Promise.resolve();
    preloadPromise = (async () => {
      try {
        const { url } = await resolveUrl(mediaId);
        if (!isCurrent()) return;
        if (!audio) {
          audio = createAudioElement();
          audio.crossOrigin = 'anonymous'; // must be set before src - see ensureAudioGraph's own doc comment
        }
        audio.src = url;
        audio.loop = true;
        setLevel(DEFAULT_VOLUME);
      } catch (error) {
        lastError = error;
      } finally {
        preloadPromise = null;
      }
    })();
    return preloadPromise;
  };

  const start = async () => {
    // Guards both a duplicate concurrent start() (startInFlight) and a
    // start() after one already succeeded (started) - together these make
    // repeated Begin taps or a stray extra call safe: at most one signed-
    // URL request and one audio element are ever created for the life of
    // this controller.
    if (started || startInFlight) return;
    startInFlight = true;
    lastError = null;
    try {
      // Verification-pass correction (F4 acceptance audit, see this
      // function's own top-of-file doc comment) — wait out an in-flight
      // preload() first, rather than bailing out just because one happens
      // to be running. Whether it succeeds or fails, start() always
      // proceeds to its own normal resolve-and-play path below.
      if (preloadPromise) await preloadPromise;
      // F4 — if preload() already resolved the URL and primed `audio.src`,
      // skip straight to play() rather than re-resolving: this is the
      // actual fix for "music starts several seconds after the timer" -
      // the network round-trip already happened earlier, during the
      // countdown, off the timer-start critical path.
      if (!audio || !audio.src) {
        const { url } = await resolveUrl(mediaId);
        // Re-check after the async gap - see this function's own isCurrent
        // doc comment above. Bail before ever touching the element so a
        // stale switch can never make a no-longer-selected track audible -
        // deliberately BEFORE creating an element at all (not just before
        // playing one): a track abandoned by a rapid switch must never
        // even get as far as an Audio()/AudioContext created for it (see
        // meditationSessionController.test.js's own "rapid/repeated
        // switching creates no overlap or duplicates" coverage).
        if (!isCurrent()) return;
        if (!audio) {
          audio = createAudioElement();
          audio.crossOrigin = 'anonymous'; // must be set before src - see ensureAudioGraph's own doc comment
        }
        audio.src = url;
        // Native loop, exactly like IB01/IS01 (InteractiveAmbientMusic.jsx) -
        // this is how the 10-minute session safely repeats IM01/IM02 without
        // any JS-level 'ended' listener, manual restart, or a second element:
        // the browser itself re-starts playback at the loop boundary, and
        // the timer (meditationSession.js) never observes or reacts to it.
        audio.loop = true;
        setLevel(DEFAULT_VOLUME);
      }
      // Deliberately AFTER the isCurrent() re-check above, right before
      // play() itself - the same point audio.play()'s own gesture
      // requirement is satisfied from in this already-shipping call chain
      // (this function is already called from this same gesture-adjacent
      // path for play() to work at all), and never any earlier: creating
      // the AudioContext before the isCurrent() check would create one for
      // a track a rapid switch has already abandoned (see above).
      const gain = ensureAudioGraph();
      if (audioContext?.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
      if (gain) setLevel(DEFAULT_VOLUME);
      await audio.play();
      // The element genuinely loaded and started - mark it so a later
      // switch back to this track can resume() (no re-fetch) rather than
      // start() again. Still immediately paused below if the user has
      // since switched to a different track during this same play() call.
      started = true;
      if (!isCurrent()) audio.pause();
    } catch (error) {
      // Signed-URL failure, network failure, or a play() rejection (e.g. a
      // transient network error, or the browser blocking autoplay) - NOT a
      // guest-vs-signed-in distinction: IM01/IM02 are both in
      // GUEST_ALLOWED_IDS (supabase/functions/_shared/betaVideoUrlAccess.ts),
      // so a guest's requestBetaVideoUrl call succeeds exactly like a
      // signed-in user's (see SelfGuidedMeditation.jsx's own doc comment).
      // Either way, the meditation continues silently without music;
      // lastError is exposed only for a small, unobtrusive status line,
      // never surfaced as a blocking error.
      lastError = error;
    } finally {
      startInFlight = false;
    }
  };

  const pause = () => {
    cancelFade(); // Pause (timer paused by the user) always wins over a fade in flight - instant, per requirement.
    if (audio && started) audio.pause();
  };

  // Resume never re-fetches or re-sets `src` - it's the same element,
  // already primed with the signed URL from the original start(), so
  // "continue without restarting" is true by construction rather than by
  // convention.
  const resume = () => {
    if (!audio || !started) return;
    cancelFade(); // restores DEFAULT_VOLUME via setLevel() when a fade was actually in flight (see cancelFade's own doc comment)
    Promise.resolve(audio.play()).catch(() => {
      lastError = new Error('Resume playback failed');
    });
  };

  // Distinct from pause(): used for a deliberate stop (End Session,
  // unmount-adjacent cleanup) where the caller does not intend to resume()
  // this same instance again. Always instant - natural completion uses
  // fadeOutAndStop() below instead, never this.
  const stop = () => {
    cancelFade();
    if (audio) {
      setLevel(DEFAULT_VOLUME);
      audio.pause();
    }
  };

  // Gentle fade-out on NATURAL session completion only (tick()'s own
  // completed branch in meditationSessionController.js) - every other exit
  // (End Session, Pause, a track switch, unmount) goes through stop()/
  // pause()/destroy() above and stays instant, per the product
  // requirement. Ramps audio.volume down from its current value to 0 over
  // durationMs using a plain setInterval (mirrors BetaVideoModal.jsx's own
  // remainingMs-driven volume pattern for Sleep Soundscapes, the only
  // other fade in this codebase), then performs the SAME full release as
  // destroy() (pause, removeAttribute('src'), load()) and explicitly
  // restores audio.volume to DEFAULT_VOLUME - not just for this now-dead
  // element, but because a fresh start() can skip re-setting volume on its
  // preloaded fast-path (see start() above), so this is what actually
  // guarantees "replay starts at normal volume" for whichever instance
  // plays next.
  const fadeOutAndStop = ({ durationMs = FADE_OUT_DURATION_MS } = {}) => {
    if (!audio || !started || audio.paused) return;
    // startVolume read via getLevel() - NOT audio.volume directly - so
    // this correctly reads the GainNode's current value when the Web
    // Audio graph is active (audio.volume is pinned to 1 from that point
    // on - see ensureAudioGraph's own doc comment).
    const startVolume = getLevel() > 0 ? getLevel() : DEFAULT_VOLUME;
    cancelFade();
    const startTime = Date.now();
    fading = true;
    const generation = fadeGeneration;
    fadeIntervalId = setInterval(() => {
      if (generation !== fadeGeneration || !audio) return; // superseded by a real stop/pause/resume/destroy
      const elapsed = Date.now() - startTime;
      const ratio = Math.max(1 - elapsed / durationMs, 0);
      setLevel(startVolume * ratio);
      if (elapsed >= durationMs) {
        clearInterval(fadeIntervalId);
        fadeIntervalId = null;
        fading = false;
        audio.pause();
        setLevel(DEFAULT_VOLUME); // restored before release - see this function's own doc comment
        audio.removeAttribute('src');
        if (typeof audio.load === 'function') audio.load();
        audioContext?.close().catch(() => {});
        audioContext = null;
        gainNode = null;
        audio = null;
        started = false;
        preloadPromise = null;
        startInFlight = false;
      }
    }, FADE_STEP_MS);
  };

  // Full teardown - mirrors InteractiveAmbientMusic.jsx's own unmount
  // cleanup effect exactly (pause, removeAttribute('src'), load()) so the
  // element releases its network/buffer resources the same proven way.
  // Defers entirely to an in-flight fadeOutAndStop() rather than cutting
  // it off: this is what lets the ~2s completion fade survive the
  // immediate unmount that happens when the owning page navigates to the
  // completion screen (see `fading`'s own doc comment above) - the fade's
  // own interval performs the identical release once it finishes, just a
  // couple of seconds later.
  const destroy = () => {
    if (fading) return;
    cancelFade();
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      if (typeof audio.load === 'function') audio.load();
    }
    audioContext?.close().catch(() => {});
    audioContext = null;
    gainNode = null;
    audio = null;
    started = false;
    preloadPromise = null;
    startInFlight = false;
  };

  return {
    preload,
    start,
    pause,
    resume,
    stop,
    fadeOutAndStop,
    destroy,
    hasStarted: () => started,
    isBusy: () => startInFlight || Boolean(preloadPromise),
    getLastError: () => lastError
  };
};

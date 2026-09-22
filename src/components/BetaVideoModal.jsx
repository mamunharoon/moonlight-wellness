import { useEffect, useRef, useState } from 'react';
import { requestBetaVideoUrl, isSignedUrlExpired } from '../lib/betaVideoAccess';
import { cacheDurationSeconds, getCachedDurationMinutes } from '../lib/durationCache';
import { getBetaVideoById } from '../lib/mediaCatalog';
import { getMusicPreference, setMusicPreference } from '../lib/musicPreference';
import { isFeatureEnabled } from '../lib/featureFlags';
import { resolvePlaybackId, shouldShowMusicToggle } from '../lib/backgroundMusicSelection';
import { useAuth } from '../context/AuthContext';

// Sleep Soundscapes timer options, minutes only - release-blocking fix:
// the previous no-auto-stop option is removed entirely, no indefinite-
// playback choice remains. 15 is the required default.
const SLEEP_TIMER_MINUTES_OPTIONS = [10, 15, 30, 60];
const DEFAULT_SLEEP_TIMER_MINUTES = 15;

// Gentle fade-then-stop, never a hard cut. Volume is a pure function of
// remainingMs once inside this window (see the fade effect below) -
// tied directly to the same countdown that only ever advances while the
// element is actually playing, so an iOS interruption (a real `pause`
// event) freezes the fade exactly where it was, never drifting ahead on
// wall-clock time while genuinely paused.
const FADE_DURATION_MS = 8000;

const formatRemaining = (ms) => {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

/*
 * WakeWise — Beta Video Preview — playback modal.
 *
 * One instance is ever mounted at a time (see Beta.jsx's single
 * `openVideoId` state) so "only one video plays at a time" holds
 * structurally, not just by convention. The signed URL is requested
 * only on mount (i.e. only when a card is actually opened) — never for
 * all four videos up front. Unmounting (close button, backdrop click,
 * or navigating away from /beta entirely) always pauses and releases
 * the <video> element via the cleanup below.
 *
 * The signed URL loads as soon as the modal opens, but the <video>
 * itself is never autoplayed (muted or otherwise) - a "Begin Exercise"
 * overlay covers the frame until the user taps it, which calls
 * handleBegin() directly inside that click's own event handler (a real
 * user gesture, which is what lets .play() start with sound). The
 * overlay hides once the <video>'s own onPlay event confirms playback
 * has actually begun, not merely on click.
 *
 * showBetaBadge controls only the small "Beta preview" pill at the
 * bottom of the panel - purely cosmetic, no bearing on access control.
 * profiles.beta_access gating happens entirely server-side, in
 * get-beta-video-url and in each caller's own beta_access check before
 * ever rendering this modal; hiding this label doesn't loosen or bypass
 * any of that. Defaults to false (hidden) since the integrated Support
 * Hub / Evening Wind-down journeys are meant to feel like a normal part
 * of those flows, not a QA artifact - Beta.jsx passes true explicitly to
 * keep the label on its own standalone admin/QA catalogue.
 */
export const BetaVideoModal = ({ entry, onClose, showBetaBadge = false }) => {
  const { isGuest } = useAuth();
  const isSleepSound = entry.category === 'Sleep Soundscapes';
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [videoUrl, setVideoUrl] = useState(null);
  // Bumped by the Retry button. The fetch effect depends on it (alongside
  // entry.id) instead of on a `load` function reference — keeps the whole
  // fetch fully local to the effect, so there's no outer function identity
  // for exhaustive-deps to ask for and no memoized callback whose direct,
  // synchronous setState the set-state-in-effect rule would flag.
  const [retryToken, setRetryToken] = useState(0);
  // Background Music, Phase B — see backgroundMusicSelection.js's own doc
  // comment for the full contract. `musicEnabled` is read once, at mount,
  // as this instance's own initial state (never re-read from storage on
  // every render) — combined with the feature flag and this entry's own
  // (today, always absent) musicVariantId, it resolves to a single
  // `playbackId` used by the fetch effect below. This is what "resolve
  // the choice before playback, never swap during playback" means in
  // practice: the id the fetch effect requests cannot change once
  // hasStarted is true, because the toggle itself is hidden by then (see
  // the JSX below) and nothing else ever calls setMusicEnabledState.
  const [musicEnabled, setMusicEnabledState] = useState(getMusicPreference);
  const musicFeatureOn = isFeatureEnabled('backgroundMusic');
  const showMusicToggle = shouldShowMusicToggle({ entry, featureEnabled: musicFeatureOn });
  const playbackId = resolvePlaybackId({ entry, musicEnabled, featureEnabled: musicFeatureOn, getEntryById: getBetaVideoById });
  // Whether the user has actually pressed "Begin Exercise" and playback
  // has genuinely started (set from the <video>'s own onPlay event, not
  // from the click itself - see handleBegin). Never set programmatically
  // to true on load: this is what keeps autoplay off even though the
  // signed URL is fetched as soon as the modal opens.
  const [hasStarted, setHasStarted] = useState(false);
  // Sleep Soundscapes only: selected auto-stop duration (minutes -
  // always a fixed choice, never indefinite - see
  // SLEEP_TIMER_MINUTES_OPTIONS above), the actual remaining countdown,
  // and whether that timer has since elapsed. remainingMs is the single
  // source of truth the countdown display, the volume fade, and the
  // auto-stop itself all derive from - see the effects below.
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(DEFAULT_SLEEP_TIMER_MINUTES);
  const [remainingMs, setRemainingMs] = useState(DEFAULT_SLEEP_TIMER_MINUTES * 60 * 1000);
  const [timerEnded, setTimerEnded] = useState(false);
  // Mirrors the <video> element's own native play/pause events (never a
  // click handler's assumption) - this is what makes the countdown
  // freeze correctly during a real iOS audio-session interruption, not
  // just an explicit Stop/pause tap: any native `pause` event, whatever
  // its cause, stops the countdown from advancing.
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  // Immersive fullscreen, Defect 2 fix. isFullscreen mirrors whichever
  // fullscreen mechanism is actually active (native iOS video fullscreen
  // via webkitbeginfullscreen/webkitendfullscreen, or the standards-track
  // Fullscreen API's fullscreenchange — see the effect below);
  // fallbackFullscreen is this component's OWN full-viewport in-app state
  // for platforms where neither native API exists (requestVideoFullscreen
  // below). hasEnded distinguishes natural completion (Done/Replay) from
  // merely having exited fullscreen mid-playback (Resume) — both render
  // the same small preview modal underneath, never a second player and
  // never an autoclose (see the overlay in the JSX below).
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const expiresAtRef = useRef(null);
  const videoRef = useRef(null);

  // Immersive fullscreen, Defect 2 fix — the supported iPhone path is
  // HTMLVideoElement.webkitEnterFullscreen(), a WKWebView/iOS-native API
  // specific to <video>, not the standards-track element.requestFullscreen()
  // — iOS has never reliably supported requestFullscreen() the way desktop
  // browsers do, so that generic API is only ever tried second, as the
  // fallback for platforms that DO support it (desktop Chrome/Firefox/
  // Safari). If neither exists, fallbackFullscreen renders this same
  // <video> element full-viewport via CSS instead (see its conditional
  // className below) — never silently stays small. Declared here, ahead
  // of every effect/handler that calls it, so none of them ever close
  // over the identifier before it's initialised.
  const requestVideoFullscreen = (video) => {
    if (typeof video.webkitEnterFullscreen === 'function') {
      try {
        video.webkitEnterFullscreen();
        return;
      } catch {
        // falls through to the standards-track path below
      }
    }
    if (typeof video.requestFullscreen === 'function') {
      video.requestFullscreen().catch(() => setFallbackFullscreen(true));
      return;
    }
    setFallbackFullscreen(true);
  };

  // Mirror image of requestVideoFullscreen, used on every exit path
  // (cleanup effect, sign-out guard) so a fullscreen video is never left
  // presented — native or in-app — once its source is about to be
  // released.
  const exitVideoFullscreen = (video) => {
    if (typeof video.webkitExitFullscreen === 'function' && video.webkitDisplayingFullscreen) {
      try {
        video.webkitExitFullscreen();
      } catch {
        // no-op — the source is being released regardless
      }
    } else if (document.fullscreenElement === video && typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Fetches the signed URL. Deps are playbackId/retryToken - playbackId
  // already folds in entry.id (it's always the fallback), so this effect
  // re-fetches exactly when the actual requested id changes, whether
  // that's a different entry entirely or a pre-playback Music toggle
  // flip (see handleToggleMusic below) - never mid-playback, since the
  // toggle that could change playbackId is hidden once hasStarted is
  // true. No ref involved here, since the <video> element (and therefore
  // videoRef) doesn't exist yet while this is in flight.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setStatus('loading');
      setErrorMessage('');
      setHasStarted(false);
      // Duplicate-player/timer guard: this effect re-runs whenever the
      // requested id actually changes (a genuinely different entry, not
      // just a re-render) - resetting the sleep-timer state here too
      // means even a same-instance prop swap (parent changes `entry`
      // without unmounting) can never carry over a stale countdown/
      // fade/timerEnded state from whatever was open before.
      setRemainingMs(DEFAULT_SLEEP_TIMER_MINUTES * 60 * 1000);
      setSleepTimerMinutes(DEFAULT_SLEEP_TIMER_MINUTES);
      setTimerEnded(false);
      setIsVideoPlaying(false);
      setIsFullscreen(false);
      setFallbackFullscreen(false);
      setHasEnded(false);
      try {
        const { url, expiresAt } = await requestBetaVideoUrl(playbackId);
        if (cancelled) return;
        expiresAtRef.current = expiresAt;
        setVideoUrl(url);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(e?.message || "Couldn't load this video.");
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [playbackId, retryToken]);

  // Owns the <video> element's lifecycle, separately from the fetch above.
  // Depends on videoUrl specifically so it re-runs (and re-captures the
  // ref) in the same commit the element actually mounts/changes in -
  // videoRef.current is guaranteed fresh at that point, unlike reading it
  // lazily inside the cleanup itself (which can race a React-nulled ref
  // by unmount time) or capturing it before the element exists at all.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video) {
        exitVideoFullscreen(video);
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [videoUrl]);

  // Immersive fullscreen, Defect 2 fix — event wiring. iOS/WKWebView video
  // fullscreen fires its own proprietary event pair on the <video>
  // element itself (webkitbeginfullscreen/webkitendfullscreen), entirely
  // separate from the standards-track Fullscreen API's `fullscreenchange`
  // event on `document` (which iOS's native video fullscreen never
  // fires) — both are listened for here so either path correctly updates
  // isFullscreen. Exiting either way only ever flips this state; it never
  // calls onClose, so the small preview modal underneath — never
  // unmounted while fullscreen is active — is simply what's visible again
  // once fullscreen ends (requirement: native Done / fullscreen exit
  // returns to the preview modal). `ended` only ever fires for a
  // non-looping video (Sleep Soundscapes loop, by design, and are
  // excluded from fullscreen entirely — see requestVideoFullscreen).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleBeginFullscreen = () => setIsFullscreen(true);
    const handleEndFullscreen = () => {
      setIsFullscreen(false);
      setFallbackFullscreen(false);
    };
    const handleStandardFullscreenChange = () => {
      const active = document.fullscreenElement === video;
      setIsFullscreen(active);
      if (!active) setFallbackFullscreen(false);
    };
    const handleEnded = () => {
      setIsFullscreen(false);
      setFallbackFullscreen(false);
      setHasEnded(true);
    };

    video.addEventListener('webkitbeginfullscreen', handleBeginFullscreen);
    video.addEventListener('webkitendfullscreen', handleEndFullscreen);
    document.addEventListener('fullscreenchange', handleStandardFullscreenChange);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('webkitbeginfullscreen', handleBeginFullscreen);
      video.removeEventListener('webkitendfullscreen', handleEndFullscreen);
      document.removeEventListener('fullscreenchange', handleStandardFullscreenChange);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoUrl]);

  // Escape only closes the whole modal from the small preview state.
  // While the standards-track Fullscreen API is active (isFullscreen),
  // the browser exits fullscreen on its own and that already flows
  // through handleStandardFullscreenChange above — calling onClose()
  // here too would additionally tear down the modal underneath on the
  // very same keypress. fallbackFullscreen (the in-app CSS full-viewport
  // state, no native Fullscreen API engaged) has no browser-level Escape
  // handling of its own, so this is the only place that can exit it -
  // same "return to Resume/Close, never close the modal" contract.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (fallbackFullscreen) {
        setFallbackFullscreen(false);
        return;
      }
      if (isFullscreen) return;
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isFullscreen, fallbackFullscreen]);

  // Sleep Soundscapes auto-stop countdown. Only ever ticks while playback
  // has genuinely begun (hasStarted) AND the element is actually playing
  // right now (isVideoPlaying, from its own native play/pause events) -
  // picking a timer before pressing Begin just records the choice, and a
  // real pause (explicit, or an iOS interruption) freezes remainingMs
  // exactly where it is rather than continuing to count down while
  // nothing is audible.
  useEffect(() => {
    if (!isSleepSound || !hasStarted || !isVideoPlaying || timerEnded) return;
    const interval = setInterval(() => {
      setRemainingMs((prev) => {
        const next = Math.max(prev - 1000, 0);
        // The actual stop, once the countdown reaches zero, happens
        // here - inside the timer's own async tick, never as a bare
        // setState in a reactive effect body. Reads/mutates the DOM
        // element directly (never the source asset itself).
        if (next <= 0) {
          const video = videoRef.current;
          if (video) {
            video.pause();
            video.volume = 1; // restored for the next "Play again"/Begin
          }
          setTimerEnded(true);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSleepSound, hasStarted, isVideoPlaying, timerEnded]);

  // Gentle fade - volume is a pure function of remainingMs (never a
  // separate wall-clock timer of its own), so it can only ever advance
  // in step with the countdown above: frozen during any real pause,
  // resuming exactly where it left off. A plain DOM mutation only (no
  // state to set here) - the real stop, once remainingMs reaches zero,
  // is handled inside the countdown interval's own tick above. Source
  // asset itself is never touched - this only ever adjusts the <video>
  // element's own .volume.
  useEffect(() => {
    if (!isSleepSound || !hasStarted || remainingMs <= 0) return;
    const video = videoRef.current;
    if (!video) return;
    video.volume = remainingMs <= FADE_DURATION_MS ? Math.max(remainingMs / FADE_DURATION_MS, 0) : 1;
  }, [remainingMs, isSleepSound, hasStarted]);

  // Sign-out defensive guard - same pattern as
  // InteractiveAmbientMusic.jsx's own equivalent: if this modal somehow
  // stayed mounted through an auth-state transition to guest (e.g. a
  // session expiring mid-playback), stop immediately rather than let a
  // guest continue hearing audio they were never allowed to start.
  useEffect(() => {
    if (!isGuest) return;
    const video = videoRef.current;
    if (!video) return;
    exitVideoFullscreen(video);
    video.pause();
  }, [isGuest]);

  const handleVideoError = () => {
    // A playback error once a URL is already loaded most likely means the
    // short-lived signed URL expired mid-visit — surfaced as its own
    // message rather than a generic failure, so "retry" reads correctly.
    setStatus('error');
    setErrorMessage(
      isSignedUrlExpired(expiresAtRef.current)
        ? 'This preview link expired.'
        : "Couldn't play this video."
    );
  };

  const handleClose = () => {
    videoRef.current?.pause();
    onClose();
  };

  // Background Music, Phase B — deliberately a no-op once hasStarted is
  // true (the toggle itself is hidden by then too; this guard is
  // defense-in-depth, not the only thing preventing a mid-playback
  // swap). Persists immediately via setMusicPreference so the choice
  // sticks for every future video, not just this one, then updates local
  // state so the fetch effect above re-resolves playbackId and loads the
  // other variant — always still before the user has pressed Begin.
  const handleToggleMusic = () => {
    if (hasStarted) return;
    const next = !musicEnabled;
    setMusicEnabledState(next);
    setMusicPreference(next);
  };

  // Sleep Soundscapes only: explicit "Stop" distinct from Close — ends
  // playback immediately (never a fade - that's only for the timer's own
  // natural expiry) and resets the remaining timer back to the full
  // selected duration, so resuming starts completely fresh rather than
  // mid-countdown. "do not create multiple simultaneous audio instances"
  // is already structural (one <video> element, one BetaVideoModal
  // instance ever mounted) — this just stops the one.
  const handleStop = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      // Guarded: assigning currentTime before the element has any
      // buffered metadata (readyState 0, HAVE_NOTHING - e.g. Stop tapped
      // while the very first play() is still resolving) throws
      // InvalidStateError. Found live: that exception can abort the
      // still-pending play() promise, surfacing as a spurious "Couldn't
      // start playback" error even though the user only asked to Stop.
      if (video.readyState > 0) video.currentTime = 0;
      video.volume = 1;
    }
    setTimerEnded(false);
    setHasStarted(false);
    setRemainingMs(sleepTimerMinutes * 60 * 1000);
  };

  // The ONLY place playback is first started. Called directly from the
  // overlay button's onClick, so this runs synchronously inside a real
  // user gesture - the one thing browsers require to allow unmuted
  // playback (and the same gesture fullscreen APIs require - see
  // requestVideoFullscreen, called synchronously here rather than inside
  // play()'s own .then(), so a fullscreen request is never one microtask
  // removed from the tap that authorized it). hasStarted itself isn't set
  // here; it flips from the <video>'s own onPlay event once playback has
  // genuinely begun, so the overlay hides exactly when sound actually
  // starts, not just on click.
  //
  // PRODUCT DECISION (temporary, revisitable - not an omission): Sleep
  // Soundscapes are deliberately excluded from automatic fullscreen.
  // Their own timer/remaining-time/Stop controls live in this modal's
  // body, below the video frame, and would be hidden behind a fullscreen
  // presentation with no way back to them short of exiting fullscreen
  // entirely. Immersive fullscreen was requested for the guided exercise
  // videos specifically (Defect 2) - giving Sleep Soundscapes their own
  // fullscreen-compatible timer UI, if ever wanted, is a separate,
  // deliberately deferred piece of work, not something this fix forgot.
  const handleBegin = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!isSleepSound) requestVideoFullscreen(video);
    video.play().catch(() => {
      setStatus('error');
      setErrorMessage("Couldn't start playback.");
    });
  };

  // Resume (exited fullscreen mid-playback, e.g. native Done) or Play
  // Again (natural completion) from the returned-to-preview overlay -
  // see the JSX below. Same synchronous fullscreen-then-play ordering and
  // gesture reasoning as handleBegin.
  const handleResumeOrReplay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (hasEnded) {
      video.currentTime = 0;
      setHasEnded(false);
    }
    if (!isSleepSound) requestVideoFullscreen(video);
    video.play().catch(() => {
      setStatus('error');
      setErrorMessage("Couldn't start playback.");
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={entry.title}
      onClick={handleClose}
    >
      <div className="w-full max-w-sm glass-panel rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-headline-md text-base text-on-surface font-bold truncate">{entry.title}</h3>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-xl">close</span>
          </button>
        </div>

        {/* 9:16 frame matches the uploaded vertical format; object-contain
            never stretches or crops regardless of exact pixel dimensions. */}
        <div className="relative w-full aspect-[9/16] max-h-[70vh] mx-auto bg-black rounded-2xl overflow-hidden flex items-center justify-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
              <span className="text-xs">Loading preview…</span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant">error</span>
              <p role="alert" className="text-xs text-on-surface-variant">{errorMessage}</p>
              <button
                onClick={() => setRetryToken((t) => t + 1)}
                className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
              >
                Retry
              </button>
            </div>
          )}

          {status === 'ready' && videoUrl && (
            <>
              <video
                ref={videoRef}
                key={videoUrl}
                src={videoUrl}
                controls
                playsInline
                loop={isSleepSound}
                preload="metadata"
                onError={handleVideoError}
                onPlay={() => {
                  setHasStarted(true);
                  setIsVideoPlaying(true);
                  // "Play again" after the timer ended - a completely
                  // fresh countdown, never continuing from 0.
                  if (timerEnded) setRemainingMs(sleepTimerMinutes * 60 * 1000);
                  setTimerEnded(false);
                }}
                onPause={() => setIsVideoPlaying(false)}
                onLoadedMetadata={(e) => cacheDurationSeconds(entry.id, e.currentTarget.duration)}
                // Fallback-fullscreen, Defect 2 fix: the SAME <video>
                // element is simply repositioned full-viewport via CSS
                // when neither native fullscreen API is available -
                // never a second, duplicate video element (only one
                // video may ever exist/play at a time).
                className={
                  fallbackFullscreen
                    ? 'fixed inset-0 z-[200] w-screen h-screen object-contain bg-black'
                    : 'w-full h-full object-contain bg-black'
                }
              >
                Your browser doesn&apos;t support embedded video.
              </video>

              {/* Full-viewport in-app fallback exit control - only ever
                  rendered when neither native fullscreen API was
                  available, so there's otherwise no way back to the
                  preview modal. Exits fullscreen only; does not close the
                  video (matches the native-fullscreen Done behaviour
                  above - both return to the same preview modal). */}
              {fallbackFullscreen && (
                <button
                  type="button"
                  onClick={() => setFallbackFullscreen(false)}
                  aria-label="Exit fullscreen"
                  className="fixed z-[201] w-11 h-11 rounded-full bg-black/50 flex items-center justify-center active:scale-95 transition-all"
                  style={{ top: 'calc(1rem + env(safe-area-inset-top))', right: '1rem' }}
                >
                  <span className="material-symbols-outlined text-white">fullscreen_exit</span>
                </button>
              )}

              {/* Covers the frame until playback genuinely starts. No
                  autoplay, muted or otherwise - the signed URL loads as
                  soon as the modal opens, but sound only ever starts from
                  handleBegin, which this button calls directly inside its
                  own click handler (a real user gesture). */}
              {!hasStarted && !timerEnded && (
                <button
                  type="button"
                  onClick={handleBegin}
                  aria-label={`Begin ${entry.title}`}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                >
                  <span className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg">
                    <span className="material-symbols-outlined text-3xl">play_arrow</span>
                  </span>
                  <span className="px-5 py-2.5 rounded-full bg-primary text-on-primary text-sm font-bold uppercase tracking-wide">
                    {isSleepSound ? 'Play' : 'Begin Exercise'}
                  </span>
                  <span className="text-[11px] text-white/70">Tap to begin with sound</span>
                </button>
              )}

              {/* Sleep Soundscapes only: the selected timer elapsed. */}
              {timerEnded && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm text-center px-6">
                  <span className="material-symbols-outlined text-3xl text-white/80">bedtime</span>
                  <p className="text-sm text-white font-semibold">Timer ended</p>
                  <button
                    type="button"
                    onClick={handleBegin}
                    className="px-5 py-2.5 rounded-full bg-primary text-on-primary text-sm font-bold uppercase tracking-wide"
                  >
                    Play again
                  </button>
                </div>
              )}

              {/* Returned-to-preview state, Defect 2 fix: shown once
                  playback has started AND fullscreen (native or fallback)
                  is no longer active - i.e. the native Done button was
                  pressed, a standards-track browser's own fullscreen exit
                  was used, or the video completed naturally (hasEnded).
                  Never rendered while still in either fullscreen mode
                  (both fullscreen presentations cover this entire frame
                  regardless). Deliberately excluded for Sleep
                  Soundscapes, which never enter fullscreen in the first
                  place and already have their own timerEnded "Play
                  again" state above. */}
              {hasStarted && !isFullscreen && !fallbackFullscreen && !isSleepSound && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm text-center px-6">
                  <span className="material-symbols-outlined text-3xl text-white/80">
                    {hasEnded ? 'check_circle' : 'pause_circle'}
                  </span>
                  <p className="text-sm text-white font-semibold">{hasEnded ? 'Done' : 'Paused'}</p>
                  <div className="flex flex-col gap-2 w-full max-w-[220px]">
                    <button
                      type="button"
                      onClick={handleResumeOrReplay}
                      className="px-5 py-2.5 rounded-full bg-primary text-on-primary text-sm font-bold uppercase tracking-wide"
                    >
                      {hasEnded ? 'Play Again' : 'Resume'}
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-5 py-2.5 rounded-full glass-panel text-on-surface-variant text-xs font-semibold hover:bg-white/10 active:scale-95 transition-all border-white/10"
                    >
                      Close Video
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sleep Soundscapes only: timer picker + source duration + live
            remaining-time + Stop. The source file loops seamlessly
            (native <video loop>) rather than requiring separately-
            uploaded per-duration files - "loops until the timer ends" is
            accurate copy now that there is no continuous/indefinite
            option at all. */}
        {isSleepSound && status === 'ready' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Timer</span>
              <span className="text-[10px] text-on-surface-variant/70">
                Source: {getCachedDurationMinutes(entry.id) ? `~${getCachedDurationMinutes(entry.id)} min, loops until the timer ends` : 'Loops until the timer ends.'}
              </span>
            </div>
            <div className="flex gap-2">
              {SLEEP_TIMER_MINUTES_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => {
                    setSleepTimerMinutes(minutes);
                    setRemainingMs(minutes * 60 * 1000);
                    setTimerEnded(false);
                  }}
                  className={`flex-1 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all min-h-[36px] ${
                    sleepTimerMinutes === minutes ? 'bg-primary text-on-primary' : 'glass-panel text-on-surface-variant hover:bg-white/5'
                  }`}
                >
                  {minutes} Min
                </button>
              ))}
            </div>
            {/* Required: remaining time displayed clearly while playing. */}
            {hasStarted && !timerEnded && (
              <p className="text-center text-xs text-on-surface-variant font-semibold" aria-live="polite">
                {formatRemaining(remainingMs)} remaining
              </p>
            )}
            {hasStarted && (
              <button
                type="button"
                onClick={handleStop}
                className="w-full py-2.5 rounded-full glass-panel text-on-surface-variant text-xs font-semibold hover:bg-white/10 active:scale-95 transition-all border-white/10"
              >
                Stop
              </button>
            )}
          </div>
        )}

        {/* Background Music, Phase B — only ever rendered when the
            feature flag is on AND this entry actually has a produced,
            registered musicVariantId (shouldShowMusicToggle handles
            both, plus the Sleep Soundscape exclusion). Today that's
            never true for any real entry, so this row is fully inert in
            production regardless of the flag - see
            backgroundMusicSelection.js. Hidden once hasStarted, so it
            can only ever change playbackId before playback begins,
            never during it. */}
        {showMusicToggle && status === 'ready' && !hasStarted && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-lg">music_note</span>
              Music
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={musicEnabled}
              aria-label="Background music"
              onClick={handleToggleMusic}
              className={`w-12 h-7 rounded-full transition-colors relative shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                musicEnabled ? 'bg-primary' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  musicEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}

        {showBetaBadge && (
          <span className="inline-block text-[10px] uppercase tracking-wider font-bold text-on-surface-variant/60 bg-white/5 px-2 py-1 rounded-full">
            Beta preview
          </span>
        )}
      </div>
    </div>
  );
};

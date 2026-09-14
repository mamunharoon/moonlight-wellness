import { useEffect, useRef, useState } from 'react';
import { requestBetaVideoUrl, isSignedUrlExpired } from '../lib/betaVideoAccess';
import { cacheDurationSeconds, getCachedDurationMinutes } from '../lib/durationCache';

// Daily Journey & Content Architecture: Sleep Soundscapes timer options.
// 'continuous' means no auto-stop — the source loops (see the `loop`
// attribute below) until the user presses Stop or closes the modal.
const SLEEP_TIMER_OPTIONS = [
  { id: 15, label: '15 min' },
  { id: 30, label: '30 min' },
  { id: 60, label: '60 min' },
  { id: 'continuous', label: 'Continuous' }
];

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
  // Whether the user has actually pressed "Begin Exercise" and playback
  // has genuinely started (set from the <video>'s own onPlay event, not
  // from the click itself - see handleBegin). Never set programmatically
  // to true on load: this is what keeps autoplay off even though the
  // signed URL is fetched as soon as the modal opens.
  const [hasStarted, setHasStarted] = useState(false);
  // Sleep Soundscapes only: selected auto-stop duration (minutes, or
  // 'continuous' for none) and whether that timer has since elapsed.
  const [sleepTimer, setSleepTimer] = useState('continuous');
  const [timerEnded, setTimerEnded] = useState(false);
  const expiresAtRef = useRef(null);
  const videoRef = useRef(null);
  const timerRef = useRef(null);

  // Fetches the signed URL. Deps are entry.id/retryToken only - no ref
  // involved here, since the <video> element (and therefore videoRef)
  // doesn't exist yet while this is in flight.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setStatus('loading');
      setErrorMessage('');
      setHasStarted(false);
      try {
        const { url, expiresAt } = await requestBetaVideoUrl(entry.id);
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
  }, [entry.id, retryToken]);

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
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [videoUrl]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Sleep Soundscapes auto-stop timer. Only ever starts once playback has
  // genuinely begun (hasStarted) — picking a timer before pressing Begin
  // just records the choice, it doesn't start any countdown early.
  // 'continuous' never sets a timer at all — the source keeps looping
  // (see the <video loop> attribute below) until Stop or Close.
  useEffect(() => {
    if (!isSleepSound || !hasStarted || sleepTimer === 'continuous') return;
    timerRef.current = setTimeout(() => {
      videoRef.current?.pause();
      setTimerEnded(true);
    }, sleepTimer * 60 * 1000);
    return () => clearTimeout(timerRef.current);
  }, [isSleepSound, hasStarted, sleepTimer]);

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
    clearTimeout(timerRef.current);
    onClose();
  };

  // Sleep Soundscapes only: explicit "Stop" distinct from Close — pauses
  // and resets to the Begin overlay (so resuming starts from a clean
  // state rather than mid-loop) without leaving the modal, and cancels
  // any pending auto-stop timer, "do not create multiple simultaneous
  // audio instances" is already structural (one <video> element, one
  // BetaVideoModal instance ever mounted) — this just stops the one.
  const handleStop = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    clearTimeout(timerRef.current);
    setTimerEnded(false);
    setHasStarted(false);
  };

  // The ONLY place playback is ever started. Called directly from the
  // overlay button's onClick, so this runs synchronously inside a real
  // user gesture - the one thing browsers require to allow unmuted
  // playback. hasStarted itself isn't set here; it flips from the
  // <video>'s own onPlay event once playback has genuinely begun, so the
  // overlay hides exactly when sound actually starts, not just on click.
  const handleBegin = () => {
    const video = videoRef.current;
    if (!video) return;
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
                onPlay={() => { setHasStarted(true); setTimerEnded(false); }}
                onLoadedMetadata={(e) => cacheDurationSeconds(entry.id, e.currentTarget.duration)}
                className="w-full h-full object-contain bg-black"
              >
                Your browser doesn&apos;t support embedded video.
              </video>

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
            </>
          )}
        </div>

        {/* Sleep Soundscapes only: timer picker + source duration + Stop.
            The source file loops seamlessly (native <video loop>) rather
            than requiring separately-uploaded 30/60-minute files. */}
        {isSleepSound && status === 'ready' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Timer</span>
              <span className="text-[10px] text-on-surface-variant/70">
                Source: {getCachedDurationMinutes(entry.id) ? `~${getCachedDurationMinutes(entry.id)} min, loops` : 'loops automatically'}
              </span>
            </div>
            <div className="flex gap-2">
              {SLEEP_TIMER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSleepTimer(opt.id)}
                  className={`flex-1 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all min-h-[36px] ${
                    sleepTimer === opt.id ? 'bg-primary text-on-primary' : 'glass-panel text-on-surface-variant hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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

        {showBetaBadge && (
          <span className="inline-block text-[10px] uppercase tracking-wider font-bold text-on-surface-variant/60 bg-white/5 px-2 py-1 rounded-full">
            Beta preview
          </span>
        )}
      </div>
    </div>
  );
};

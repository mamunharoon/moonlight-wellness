/* eslint-disable no-unused-vars */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestBetaVideoUrl } from '../lib/betaVideoAccess';
import { getBetaVideoById } from '../lib/mediaCatalog';
import { setMusicPreference } from '../lib/musicPreference';
import { isFeatureEnabled } from '../lib/featureFlags';
import { isInteractiveMusicEligible } from '../lib/backgroundMusicSelection';
import { setPendingContent } from '../lib/pendingContent';
import { SignInPromptDialog } from './SignInPromptDialog';

// Background Music — every interactive timed screen (EveningBreathing.jsx,
// QuietBreathing.jsx, Breathe.jsx, MorningFlow.jsx). Renamed from
// InteractiveBreathingMusic.jsx (Morning-flow redesign audit): it was
// never actually breathing-specific — MorningFlow.jsx's stretch timer
// uses the exact same component with a different musicVariantId (IS01
// instead of IB01). Shared by all four rather than duplicated: each is a
// structurally similar non-narrated interactive timer, so one component
// serves all of them rather than independent, inevitably-drifting copies.
//
// `suspended` (Morning-flow redesign): Breathe.jsx/MorningFlow.jsx are the
// two screens that also offer optional guided-video rows on the SAME
// page (opened via a same-page BetaVideoModal, no route change) —
// EveningBreathing.jsx/QuietBreathing.jsx have none, so they simply never
// pass this prop (defaults to false, zero behaviour change for them).
// When the parent's own openVideo becomes truthy, it passes
// suspended={true}; this component immediately pauses/releases the
// element AND resets its own toggle to Off — never merely masks the
// visual state while leaving the underlying "on" flag true, which would
// make the toggle silently flip back to ON the moment the video closes
// even though nothing new was ever actually started. Returning from the
// video (suspended -> false) does nothing further: per the approved
// requirement, resuming needs a real tap, exactly like a fresh mount.
//
// WHY NOT THE SAME "resolvePlaybackId" SHAPE AS BetaVideoModal.jsx:
// that mechanism always has a safe narration-only fallback id to resolve
// to (entry.id). These screens have no narration at all — there is
// nothing to fall back TO, only "play nothing" — so eligibility here is
// simpler (isInteractiveMusicEligible) and "ineligible" just means this
// component renders null, exactly as if it were never placed on the page.
//
// AUTOPLAY / GESTURE POLICY — a deliberate, documented trade-off:
// BetaVideoModal.jsx can seed its Music toggle from the persisted
// preference on mount because a SEPARATE, mandatory "Begin Exercise" tap
// always exists there before anything plays. These two screens have no
// equivalent gesture — the breathing cycle animation starts immediately
// on mount with no tap required — so there is no safe moment to honour
// an already-on stored preference without violating iOS's
// gesture-before-unmuted-playback rule. This toggle therefore ALWAYS
// starts unchecked on a fresh mount, regardless of what
// getMusicPreference() currently holds — flipping it on is itself the
// qualifying gesture. Persistence still writes to the same shared key
// (musicPreference.js), so a choice made here is honoured everywhere
// else (e.g. a later-opened BetaVideoModal); it just can't be
// *auto-applied* as playback on this specific surface.
const DEFAULT_VOLUME = 0.35;

// Exposed via ref (see useImperativeHandle below) so Breathe.jsx/
// MorningFlow.jsx's own "Resume with Music" button — part of their
// paused-for-guided-video panel — can trigger a fresh, deliberate start()
// after the timer resumes, without duplicating this component's network/
// element-management logic in two page files. EveningBreathing.jsx/
// QuietBreathing.jsx (no ref passed) are completely unaffected.
export const InteractiveAmbientMusic = forwardRef(({ musicVariantId, suspended = false }, ref) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isGuest } = useAuth();
  const audioRef = useRef(null);
  // Duplicate-playback guard: ignored while a play()/pause() cycle
  // (including its network fetch) is already in flight, so a remount
  // race or repeated rapid taps can never issue two overlapping
  // requests/play() calls against the same element.
  const isBusyRef = useRef(false);
  // Mirrors the `suspended` prop for start()'s own async gap below (a
  // plain render-time assignment, not an effect — refs are exempt from
  // the state-derived-in-effect rule specifically for this "let an
  // in-flight async callback read the latest prop" case). Fixes a real
  // bug: without this, opening a guided video WHILE start()'s signed-URL
  // fetch is still in flight had no way to notice - the fetch would
  // resolve after the video was already open (or already closed) and
  // call audio.play() regardless, leaving the ambient loop audibly
  // playing under/after the video with the toggle stuck showing the
  // stale "on" state from a play() that should never have happened.
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;

  const featureOn = isFeatureEnabled('backgroundMusic');
  const eligible = isInteractiveMusicEligible({ musicVariantId, featureEnabled: featureOn, getEntryById: getBetaVideoById });

  // See the AUTOPLAY / GESTURE POLICY note above for why this is always
  // `false` on mount rather than seeded from getMusicPreference().
  const [musicEnabled, setMusicEnabledState] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  // Stop and fully release the element on unmount — covers every exit
  // path this screen has (Skip, Continue, Back, a route change to the
  // next routine stage): all of them call react-router's navigate(),
  // which unmounts this component in this SPA, exactly like
  // BetaVideoModal.jsx's own equivalent cleanup effect. `audio` is
  // captured here, in the effect body, not read lazily inside the
  // returned cleanup itself - the ref is guaranteed fresh at this point,
  // unlike by unmount time (same pattern BetaVideoModal.jsx uses).
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    };
  }, []);

  // Sign-out defensive guard: if this component somehow stayed mounted
  // through an auth-state transition to guest (e.g. a session expiring
  // while this screen is open), stop immediately rather than let a guest
  // continue hearing audio they were never allowed to start. Only ever
  // calls the native .pause() DOM method here (an effect's proper job,
  // per react-hooks/set-state-in-effect) — musicEnabled itself is kept in
  // sync by the <audio> element's own onPause handler below, a real
  // event-handler callback, never a setState call from inside an effect.
  useEffect(() => {
    if (!isGuest) return;
    audioRef.current?.pause();
  }, [isGuest]);

  // Stop-before-guided-video: see the `suspended` doc comment above. Same
  // pattern as the guest guard - only ever calls .pause() here; the
  // resulting native `pause` event (fired by the browser itself) is what
  // actually resets musicEnabled, via onPause below.
  useEffect(() => {
    if (!suspended) return;
    audioRef.current?.pause();
  }, [suspended]);

  // musicEnabled itself is never set from here — the <audio> element's own
  // onPlay/onPause handlers (below, in the JSX) are the single source of
  // truth for it, since they're real event-handler callbacks reacting to
  // the browser's own native media events, not a value this code has to
  // remember to keep in sync by hand in every place that calls .pause()/
  // .play(). Calling .pause() when already paused (or .play() when
  // already playing) is a safe native no-op either way.
  const stop = () => {
    audioRef.current?.pause();
  };

  const start = async () => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    setLoadError(false);
    try {
      const { url } = await requestBetaVideoUrl(musicVariantId);
      // Re-check here, not just at the top of start() - a guided video
      // can open while this fetch is in flight. Bail before ever touching
      // the element so nothing plays under/after the video (see
      // suspendedRef's own doc comment above).
      if (suspendedRef.current) return;
      const audio = audioRef.current;
      if (!audio) return;
      audio.src = url;
      audio.loop = true;
      audio.volume = DEFAULT_VOLUME;
      // Called synchronously within handleToggle's own click handler (a
      // real user gesture) via this same call chain — never from an
      // effect, never on mount. A successful play() fires the element's
      // own `play` event, which is what actually flips musicEnabled on.
      await audio.play();
    } catch {
      // Loading/playback failed - continue the breathing exercise
      // silently. loadError only ever shows a small, unobtrusive line;
      // it never blocks or interrupts the breathing cycle itself. A
      // rejected play() never fires a `play` event, so musicEnabled is
      // already still false - nothing else to reset here.
      setLoadError(true);
    } finally {
      isBusyRef.current = false;
    }
  };

  const handleToggle = () => {
    if (suspended) return; // a guided video is open on this same page - see the doc comment above
    if (isGuest) {
      setShowSignInPrompt(true);
      return;
    }
    if (isBusyRef.current) return;
    if (musicEnabled) {
      setMusicPreference(false);
      stop();
    } else {
      setMusicPreference(true);
      start();
    }
  };

  // "Resume with Music" (Breathe.jsx/MorningFlow.jsx's paused-for-video
  // panel) calls this directly, bypassing handleToggle - by the time that
  // button exists at all, the video is already closed (suspended is
  // already false), and the button tap itself is the required deliberate
  // gesture, exactly like a direct toggle tap. Called unconditionally
  // (not gated on eligible/hooks-order below) since useImperativeHandle
  // must run on every render regardless of `eligible`.
  useImperativeHandle(ref, () => ({ start }));

  if (!eligible) return null;

  const confirmSignIn = () => {
    setPendingContent({ returnPath: `${location.pathname}${location.search}` });
    setShowSignInPrompt(false);
    navigate('/auth');
  };
  const confirmCreateAccount = () => {
    setPendingContent({ returnPath: `${location.pathname}${location.search}` });
    setShowSignInPrompt(false);
    navigate('/auth?tab=signup');
  };

  // A guest can never genuinely have music playing (see the sign-out/
  // guest defensive effect above), and neither can a suspended screen
  // (see the suspend effect above) - computed directly in render as a
  // second, immediate guard on top of that effect, so the toggle can
  // never visually show "on" even for one stale render before the
  // effect runs.
  const isChecked = musicEnabled && !isGuest && !suspended;

  return (
    <div className="space-y-1.5">
      {/* Not narration - hidden, no visible player chrome of its own;
          the toggle below is the only visible control. */}
      <audio
        ref={audioRef}
        preload="none"
        aria-hidden="true"
        className="hidden"
        onError={() => setLoadError(true)}
        onPlay={() => setMusicEnabledState(true)}
        onPause={() => setMusicEnabledState(false)}
      />

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
          <span className="material-symbols-outlined text-lg">music_note</span>
          Music
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isChecked}
          aria-label="Background music"
          onClick={handleToggle}
          className={`w-12 h-7 rounded-full transition-colors relative shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
            isChecked ? 'bg-primary' : 'bg-white/10'
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
              isChecked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {loadError && (
        <p className="text-[10px] text-on-surface-variant/60 text-center">
          Music unavailable right now — continuing without it.
        </p>
      )}

      <SignInPromptDialog
        open={showSignInPrompt}
        onSignIn={confirmSignIn}
        onCreateAccount={confirmCreateAccount}
        onDismiss={() => setShowSignInPrompt(false)}
      />
    </div>
  );
});

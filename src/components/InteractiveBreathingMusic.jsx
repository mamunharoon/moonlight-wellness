/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestBetaVideoUrl } from '../lib/betaVideoAccess';
import { getBetaVideoById } from '../lib/mediaCatalog';
import { setMusicPreference } from '../lib/musicPreference';
import { isFeatureEnabled } from '../lib/featureFlags';
import { isInteractiveMusicEligible } from '../lib/backgroundMusicSelection';
import { setPendingContent } from '../lib/pendingContent';
import { SignInPromptDialog } from './SignInPromptDialog';

// Background Music — interactive breathing screens (EveningBreathing.jsx,
// QuietBreathing.jsx). Shared by both rather than duplicated — see this
// codebase's own media audit (docs/background-music-asset-manifest.md):
// both screens are structurally identical non-narrated uses of
// BreathingRing (no useProtectedVideo, no BetaVideoModal, no narration
// of any kind), so both get exactly this one component rather than two
// independent, inevitably-drifting copies.
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

export const InteractiveBreathingMusic = ({ musicVariantId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isGuest } = useAuth();
  const audioRef = useRef(null);
  // Duplicate-playback guard: ignored while a play()/pause() cycle
  // (including its network fetch) is already in flight, so a remount
  // race or repeated rapid taps can never issue two overlapping
  // requests/play() calls against the same element.
  const isBusyRef = useRef(false);

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
  // while this screen is open), stop immediately rather than let a
  // guest continue hearing audio they were never allowed to start. Only
  // ever touches the external <audio> element here (an effect's proper
  // job) - never calls setState synchronously from inside an effect
  // body; the render below already treats a guest as unable to have
  // music genuinely playing regardless of this state's own value.
  useEffect(() => {
    if (!isGuest) return;
    audioRef.current?.pause();
  }, [isGuest]);

  if (!eligible) return null;

  const stop = () => {
    audioRef.current?.pause();
    setMusicEnabledState(false);
  };

  const start = async () => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    setLoadError(false);
    try {
      const { url } = await requestBetaVideoUrl(musicVariantId);
      const audio = audioRef.current;
      if (!audio) return;
      audio.src = url;
      audio.loop = true;
      audio.volume = DEFAULT_VOLUME;
      // Called synchronously within handleToggle's own click handler (a
      // real user gesture) via this same call chain — never from an
      // effect, never on mount.
      await audio.play();
      setMusicEnabledState(true);
    } catch {
      // Loading/playback failed - continue the breathing exercise
      // silently. loadError only ever shows a small, unobtrusive line;
      // it never blocks or interrupts the breathing cycle itself.
      setLoadError(true);
      setMusicEnabledState(false);
    } finally {
      isBusyRef.current = false;
    }
  };

  const handleToggle = () => {
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
  // guest defensive effect above) - computed directly in render rather
  // than mirrored into state, so the toggle can never visually show
  // "on" for a guest even for one stale render after an auth transition.
  const isChecked = musicEnabled && !isGuest;

  return (
    <div className="space-y-1.5">
      {/* Not narration - hidden, no visible player chrome of its own;
          the toggle below is the only visible control. */}
      <audio ref={audioRef} preload="none" aria-hidden="true" className="hidden" onError={() => setLoadError(true)} />

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
};

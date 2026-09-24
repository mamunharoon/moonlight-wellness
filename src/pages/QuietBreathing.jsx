import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { BreathingRing } from '../components/BreathingRing';
import { BreathingPatternRow } from '../components/BreathingPatternRow';
import { InteractiveAmbientMusic } from '../components/InteractiveAmbientMusic';
import { MusicPreferenceToggle } from '../components/MusicPreferenceToggle';
import { MusicEntryChoice } from '../components/MusicEntryChoice';
import { isFeatureEnabled } from '../lib/featureFlags';
import { isInteractiveMusicEligible } from '../lib/backgroundMusicSelection';
import { getBetaVideoById } from '../lib/mediaCatalog';
import { useAuth } from '../context/AuthContext';
import { getMusicPreference, setMusicPreferenceForUser } from '../lib/musicPreference';
import { BREATHING_PATTERNS, getBreathingPatternById, resolveBreathPhase } from '../lib/breathingPatterns';
import { BREATHE_VIDEOS, BREATHING_SESSION_VIDEOS, GUIDED_BREATHING_VIDEO_COUNT } from '../lib/guidedBreathingVideos';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';
import { SignInPromptDialog } from '../components/SignInPromptDialog';

// Background Music — same shared, reserved interactive-breathing loop id
// as EveningBreathing.jsx/Breathe.jsx.
const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';
const DEFAULT_STANDALONE_PATTERN_ID = 'quiet';

/*
 * Solas — Support & Calm, Sprint 1 Phase 2: Quiet Breathing
 *
 * Build 15 — extended with an explicit, additive `standalone` prop
 * (approved Option A) rather than a second parallel page. Every existing
 * caller (Support's own embedded usage, `standalone` omitted/false) is
 * COMPLETELY UNCHANGED: same fixed 4-4-8 pattern, no picker, same
 * MusicEntryChoice-gated auto-start-once-chosen behaviour, same
 * `/support`/`/support-complete` back-fallback/completion route, same
 * JSX structure, same InteractiveAmbientMusic mount position (between
 * the ring and the Continue/Skip buttons) - none of this is inferred
 * from a URL parameter, only from this one explicit, controlled prop the
 * ROUTE ITSELF decides (see App.jsx's two separate route registrations).
 *
 * `standalone={true}` (the new Home-launched Breathe entry) is a
 * genuinely different rendering path: real pattern selection (the same
 * three real cadences Morning Breathe offers, defaulting to this
 * screen's own established 4-4-8), a Background music preference, and a
 * real "Begin Breathing" gesture - nothing starts on mount. No Session
 * Engine coupling either way (this file has never imported useSession).
 *
 * Because `standalone` is a fixed prop for the lifetime of one mounted
 * instance (the router decides it, not runtime state), branching the
 * top-level render on it is safe - React never has to reconcile between
 * the two top-level shapes mid-life. Only the STANDALONE branch's own
 * internal pre-start/active transition needs InteractiveAmbientMusic to
 * be a single, stable, never-remounted instance (see MorningFlow.jsx's
 * own fix/doc comment for exactly why two separate mount points across a
 * hasBegun transition orphans audio started via a ref) - so its own
 * InteractiveAmbientMusic sits once, outside that inner ternary, with
 * conditional props instead of two mount points. Non-standalone never
 * has this transition at all (hasBegun starts true and never changes),
 * so its own single, original mount position is already safe exactly as
 * it always was.
 *
 * Guest pre-start-music correction (Build 18, complete) — BOTH branches
 * are now fixed. The standalone branch's MusicPreferenceToggle no longer
 * routes a guest's tap to sign-in; handleToggleMusicPreference persists
 * through the shared setMusicPreferenceForUser; the Begin handler's own
 * `&& !isGuest` guard is removed. Non-standalone (Support's embedded
 * usage)'s MusicEntryChoice is fixed the same way - see that component's
 * own updated doc comment. The former confirmSignInForMusic handler (a
 * local setPendingContent+navigate('/auth') pair, previously shared by
 * both branches' now-removed gates) is removed entirely: nothing in this
 * file navigates to sign-in for music any more, in either branch.
 */
export const QuietBreathing = ({ standalone = false }) => {
  const navigate = useNavigate();
  const { isGuest } = useAuth();

  // Build 15 — standalone mode's own return targets. Support's existing
  // embedded usage keeps its exact original targets, unconditionally.
  const backFallback = standalone ? '/' : '/support';
  const completionRoute = standalone ? '/' : '/support-complete';

  // Pattern selection - standalone only. Non-standalone (Support) never
  // renders a picker and always uses the fixed 'quiet' pattern, exactly
  // as before this phase - selectedPatternId simply never changes away
  // from its default when !standalone, since no picker UI exists to
  // change it.
  const [selectedPatternId, setSelectedPatternId] = useState(DEFAULT_STANDALONE_PATTERN_ID);
  const activePattern = getBreathingPatternById(selectedPatternId) ?? getBreathingPatternById(DEFAULT_STANDALONE_PATTERN_ID);

  // Release-quality guided-breathing discoverability — standalone only
  // (Support's own embedded usage is untouched, see below). Collapsed by
  // default, same shared 7-entry catalogue Breathe.jsx now uses. This
  // screen has no pause/interrupt system of its own (unlike Breathe.jsx/
  // MorningFlow.jsx) - opening a video simply shows the existing
  // BetaVideoModal overlay; it does not pause or affect the countdown,
  // matching this page's own deliberately simple design.
  const [guidedSessionsOpen, setGuidedSessionsOpen] = useState(false);
  const {
    openVideo,
    handleSelect: handleSelectVideo,
    closeVideo,
    promptOpen,
    dismissPrompt,
    confirmSignIn: confirmSignInForVideo,
    confirmCreateAccount: confirmCreateAccountForVideo
  } = useProtectedVideo();

  const [breatheState, setBreatheState] = useState('Inhale');
  const [secondsLeft, setSecondsLeft] = useState(activePattern.totalSeconds);

  // Legacy entry-choice gate - Support's own existing, byte-for-byte
  // unchanged behaviour (see MusicEntryChoice.jsx's own doc comment).
  // Standalone mode never renders MusicEntryChoice and never reads
  // awaitingMusicChoice for its own gate - see hasBegun/canRun below.
  const [musicChoiceMade, setMusicChoiceMade] = useState(false);
  const musicPlayerRef = useRef(null);
  const musicEligible = isInteractiveMusicEligible({
    musicVariantId: INTERACTIVE_BREATHING_MUSIC_ID,
    featureEnabled: isFeatureEnabled('backgroundMusic'),
    getEntryById: getBetaVideoById
  });
  const awaitingMusicChoice = musicEligible && !musicChoiceMade;
  const handleStartWithMusic = () => {
    setMusicChoiceMade(true);
    musicPlayerRef.current?.start();
  };
  const handleContinueWithoutMusic = () => {
    setMusicChoiceMade(true);
  };

  // Build 15 — standalone mode's own real pre-start gate. Non-standalone
  // starts (and stays) true: Support's own screen has never had a
  // separate "Begin" concept - awaitingMusicChoice alone remains its
  // only gate, unchanged.
  const [hasBegun, setHasBegun] = useState(() => !standalone);
  const [musicPreferenceOn, setMusicPreferenceOn] = useState(() => {
    if (isGuest) return false;
    return musicEligible && getMusicPreference();
  });
  const handleToggleMusicPreference = () => {
    setMusicPreferenceOn((prev) => {
      const next = !prev;
      setMusicPreferenceForUser(next, { isGuest });
      return next;
    });
  };
  // Double-tap protection - see Breathe.jsx's identical rationale.
  const hasBegunOnceRef = useRef(false);
  const handleBeginBreathing = () => {
    if (hasBegunOnceRef.current) return;
    hasBegunOnceRef.current = true;
    setSecondsLeft(activePattern.totalSeconds);
    setBreatheState('Inhale');
    setHasBegun(true);
    if (musicEligible && musicPreferenceOn) {
      musicPlayerRef.current?.start();
    }
  };

  if (EveningSceneShell && BreathingRing && InteractiveAmbientMusic && MusicEntryChoice && MusicPreferenceToggle && BreathingPatternRow && BetaVideoModal && BetaVideoRow && SignInPromptDialog) { /* no-op to satisfy blind linter */ }

  // The single gate the countdown effect uses: standalone waits for
  // hasBegun; non-standalone (Support) preserves its exact original gate
  // (awaitingMusicChoice alone) - never affected by hasBegun at all.
  const canRun = standalone ? hasBegun : !awaitingMusicChoice;

  useEffect(() => {
    if (!canRun) return;

    if (secondsLeft <= 0) {
      navigate(completionRoute);
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        const nextSec = prev - 1;
        setBreatheState(resolveBreathPhase(activePattern, nextSec));
        return nextSec;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, navigate, canRun, activePattern, completionRoute]);

  const handleAdvance = () => {
    navigate(completionRoute);
  };

  if (standalone) {
    return (
      <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback={backFallback}>
        {!hasBegun ? (
          <>
            <div className="text-center space-y-2">
              <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">Mindful Breathing</span>
              <h2 className="text-2xl font-bold text-on-surface">Choose Your Breathing Practice</h2>
              <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
                Choose a breathing rhythm, then begin when you&rsquo;re ready.
              </p>
            </div>

            <div className="space-y-3" role="radiogroup" aria-label="Choose your breathing practice">
              {BREATHING_PATTERNS.map((pattern) => (
                <BreathingPatternRow
                  key={pattern.id}
                  pattern={pattern}
                  selected={selectedPatternId === pattern.id}
                  onSelect={setSelectedPatternId}
                  groupName="breathing-pattern"
                />
              ))}
            </div>

            {musicEligible && (
              <MusicPreferenceToggle
                isOn={musicPreferenceOn}
                onToggle={handleToggleMusicPreference}
                description="Play gentle music during your breathing practice."
              />
            )}

            <div className="space-y-3 w-full">
              <button
                type="button"
                onClick={handleBeginBreathing}
                className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
              >
                <span>Begin Breathing</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>

            {/* Release-quality guided-breathing discoverability -
                standalone only. Collapsed by default, mirrors Breathe.jsx's
                own identical disclosure using the same shared catalogue. */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setGuidedSessionsOpen((v) => !v)}
                aria-expanded={guidedSessionsOpen}
                aria-controls="standalone-breathe-guided-sessions"
                className="w-full flex items-center justify-between gap-3 bg-surface-container border border-white/15 rounded-2xl p-4 min-h-[44px] hover:bg-white/10 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="text-sm font-semibold text-on-surface text-left">Explore guided breathing sessions — {GUIDED_BREATHING_VIDEO_COUNT} available</span>
                <span
                  className="material-symbols-outlined text-on-surface-variant transition-transform shrink-0"
                  style={{ transform: guidedSessionsOpen ? 'rotate(180deg)' : 'none' }}
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </button>
              {guidedSessionsOpen && (
                <div id="standalone-breathe-guided-sessions" className="space-y-4">
                  <div className="space-y-3">
                    {BREATHE_VIDEOS.map(({ id, blurb }) => {
                      const entry = getBetaVideoById(id);
                      if (!entry) return null;
                      return (
                        <BetaVideoRow
                          key={id}
                          title={entry.title}
                          description={blurb}
                          onClick={() => handleSelectVideo(id)}
                        />
                      );
                    })}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Breathing Sessions</h3>
                    {BREATHING_SESSION_VIDEOS.map(({ id, blurb }) => {
                      const entry = getBetaVideoById(id);
                      if (!entry) return null;
                      return (
                        <BetaVideoRow
                          key={id}
                          title={entry.title}
                          description={blurb}
                          onClick={() => handleSelectVideo(id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
              <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                Just breathe. There is nowhere else to be.
              </p>

              <BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} />
            </div>

            <div className="space-y-3 w-full">
              <button
                onClick={handleAdvance}
                className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                <span>Continue</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
              <button
                onClick={handleAdvance}
                className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
              >
                Skip
              </button>
            </div>

            {/* Same disclosure, reusing the same guidedSessionsOpen state -
                still reachable once the exercise is active. */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setGuidedSessionsOpen((v) => !v)}
                aria-expanded={guidedSessionsOpen}
                aria-controls="standalone-breathe-guided-sessions-active"
                className="w-full flex items-center justify-between gap-3 bg-surface-container border border-white/15 rounded-2xl p-4 min-h-[44px] hover:bg-white/10 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="text-sm font-semibold text-on-surface text-left">Explore guided breathing sessions — {GUIDED_BREATHING_VIDEO_COUNT} available</span>
                <span
                  className="material-symbols-outlined text-on-surface-variant transition-transform shrink-0"
                  style={{ transform: guidedSessionsOpen ? 'rotate(180deg)' : 'none' }}
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </button>
              {guidedSessionsOpen && (
                <div id="standalone-breathe-guided-sessions-active" className="space-y-4">
                  <div className="space-y-3">
                    {BREATHE_VIDEOS.map(({ id, blurb }) => {
                      const entry = getBetaVideoById(id);
                      if (!entry) return null;
                      return (
                        <BetaVideoRow
                          key={id}
                          title={entry.title}
                          description={blurb}
                          onClick={() => handleSelectVideo(id)}
                        />
                      );
                    })}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Breathing Sessions</h3>
                    {BREATHING_SESSION_VIDEOS.map(({ id, blurb }) => {
                      const entry = getBetaVideoById(id);
                      if (!entry) return null;
                      return (
                        <BetaVideoRow
                          key={id}
                          title={entry.title}
                          description={blurb}
                          onClick={() => handleSelectVideo(id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Build 15 fix — a SINGLE, stable InteractiveAmbientMusic
            instance, never remounted across the pre-start -> active
            transition above - see MorningFlow.jsx's identical fix/doc
            comment for the full rationale. */}
        <InteractiveAmbientMusic
          ref={musicPlayerRef}
          musicVariantId={INTERACTIVE_BREATHING_MUSIC_ID}
          suspended={false}
          hideToggle={!hasBegun}
        />

        {openVideo && (
          <BetaVideoModal entry={openVideo} onClose={closeVideo} />
        )}
        <SignInPromptDialog
          open={promptOpen}
          onSignIn={confirmSignInForVideo}
          onCreateAccount={confirmCreateAccountForVideo}
          onDismiss={dismissPrompt}
        />
      </EveningSceneShell>
    );
  }

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback={backFallback}>
      {awaitingMusicChoice && (
        <MusicEntryChoice
          onStartWithMusic={handleStartWithMusic}
          onContinueWithoutMusic={handleContinueWithoutMusic}
        />
      )}

      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          Just breathe. There is nowhere else to be.
        </p>

        <BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} />
      </div>

      <InteractiveAmbientMusic ref={musicPlayerRef} musicVariantId={INTERACTIVE_BREATHING_MUSIC_ID} />

      <div className="space-y-3 w-full">
        <button
          onClick={handleAdvance}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          <span>Continue</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button
          onClick={handleAdvance}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Skip
        </button>
      </div>
    </EveningSceneShell>
  );
};

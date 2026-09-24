/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { getStepLabel } from '../lib/stepLabels';
import { BreathingRing } from '../components/BreathingRing';
import { BreathingPatternRow } from '../components/BreathingPatternRow';
import { InteractiveAmbientMusic } from '../components/InteractiveAmbientMusic';
import { MusicPreferenceToggle } from '../components/MusicPreferenceToggle';
import { ExercisePausedPanel } from '../components/ExercisePausedPanel';
import { ReviewModeBanner } from '../components/ReviewModeBanner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { savePausedExerciseState, loadPausedExerciseState, clearPausedExerciseState } from '../session/timedExercisePause';
import { getMusicPreference, setMusicPreferenceForUser } from '../lib/musicPreference';
import { BREATHING_PATTERNS, getBreathingPatternById, resolveBreathPhase } from '../lib/breathingPatterns';
import { BREATHE_VIDEOS, BREATHING_SESSION_VIDEOS, GUIDED_BREATHING_VIDEO_COUNT } from '../lib/guidedBreathingVideos';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { BackButton } from '../components/BackButton';
import { isFeatureEnabled } from '../lib/featureFlags';
import { isInteractiveMusicEligible } from '../lib/backgroundMusicSelection';

// Background Music — shared with EveningBreathing.jsx/QuietBreathing.jsx/
// MorningFlow.jsx (see InteractiveAmbientMusic.jsx's own doc comment).
const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';

const DEFAULT_PATTERN_ID = 'morning';

/*
 * Build 15 — Morning Breathe pre-start screen. The three real breathing
 * cadences this app has ever shipped (BREATHING_PATTERNS, shared with
 * Evening/standalone Breathe) are now shown and selectable BEFORE
 * anything starts, defaulting to this screen's own established 4-4-6
 * pattern. A real native <input type="radio"> per pattern (via
 * BreathingPatternRow) - exactly one selected at a time.
 *
 * Video Integration: additional rows offering "Deep Breathing" and
 * "Mindful Breathing" alongside the morning routine's own breathing step
 * - reuses this exact page rather than adding a parallel breathing
 * screen. Shown to any signed-in user (guests excluded).
 *
 * Morning-flow redesign — interactive timer vs. optional guided video:
 * this screen's own Inhale/Hold/Exhale ring has no narration or audio of
 * its own (confirmed by direct audit - the rows below open a completely
 * separate, same-page BetaVideoModal, never mixed with the ring itself).
 * Selecting any row now: (1) marks videoOpenedDuringExercise so the timer
 * stops advancing and background music is suspended (via
 * InteractiveAmbientMusic's own `suspended` prop, driven by openVideo
 * directly), and (2) requires a deliberate "Resume Exercise" tap to
 * continue afterward — closing the video alone never restarts the timer
 * or the music, exactly as required.
 *
 * Guest pre-start-music correction (Build 18) — the pre-start
 * MusicPreferenceToggle below no longer routes a guest's tap to sign-in;
 * `confirmSignIn` (from useProtectedVideo, shared with this screen's own
 * guided-video sign-in prompts) is no longer passed to it at all.
 * handleToggleMusicPreference now persists through the shared
 * setMusicPreferenceForUser (musicPreference.js) so a guest's choice
 * still drives real playback this mount without ever reaching the
 * shared, device-scoped preference key. handleBeginBreathing's own
 * `&& !isGuest` guard is removed too - IB01 is server-allowlisted for
 * guests, same as every other interactive-breathing screen.
 */
export const Breathe = () => {
  const navigate = useNavigate();
  const { setJourneyStep } = useAlarm();
  // Stage 3C Group 3D Batch B: mirrors the breathe -> affirmation transition
  // into the Session Engine from all genuine exits (timer expiry,
  // Complete/Continue, Skip Breathing). See mirrorBreathingExitRef below.
  const { state, currentStep, advanceStep, abandonSession } = useSession();
  const { isReviewMode, isLiveStep } = useStepReviewMode('breathe', 'morning-routine');
  const [hasStartedRepeat, setHasStartedRepeat] = useState(false);
  const isRepeatGated = isReviewMode && !hasStartedRepeat;
  const { isGuest } = useAuth();

  // Pause-and-resume-exact-state fix - see MorningFlow.jsx's identical
  // block for the full rationale (session/timedExercisePause.js). Build
  // 15: the snapshot now also carries which pattern was selected and
  // whether music was enabled.
  const [pausedSnapshot] = useState(() => loadPausedExerciseState('morning-routine', 'breathe'));
  useEffect(() => {
    if (pausedSnapshot) clearPausedExerciseState('morning-routine', 'breathe');
  }, [pausedSnapshot]);

  // Build 15 — pattern selection, pre-start only. Defaults to Morning's
  // own established 4-4-6 pattern.
  const [selectedPatternId, setSelectedPatternId] = useState(() => pausedSnapshot?.patternId ?? DEFAULT_PATTERN_ID);
  // Release-quality guided-breathing discoverability — one collapsed-by-
  // default disclosure combining both video collections, mirroring
  // MorningFlow.jsx's own "Explore guided stretching sessions" pattern:
  // never forced open by Begin, reachable both pre-start and once the
  // exercise is active (preserving the existing interrupt-to-watch
  // affordance).
  const [guidedSessionsOpen, setGuidedSessionsOpen] = useState(false);
  const activePattern = getBreathingPatternById(selectedPatternId) ?? BREATHING_PATTERNS[0];

  // hasBegun: false until the user explicitly taps "Begin Breathing" -
  // true immediately when resuming from a paused snapshot.
  const [hasBegun, setHasBegun] = useState(() => Boolean(pausedSnapshot));

  const { requestReview, confirmLeave, cancelLeave, isConfirming, routeForStep } = useReviewNavigation({
    sessionId: 'morning-routine',
    isLiveStep,
    hasUnsavedProgress: true,
    onLeaveLiveStep: () => savePausedExerciseState('morning-routine', 'breathe', {
      secondsLeft,
      breatheState,
      patternId: selectedPatternId,
      musicEnabled: musicPreferenceOn
    })
  });
  const [breatheState, setBreatheState] = useState(() => pausedSnapshot?.breatheState ?? 'Inhale');
  const [secondsLeft, setSecondsLeft] = useState(() => pausedSnapshot?.secondsLeft ?? activePattern.totalSeconds);
  // Morning-flow redesign: set the moment any guided-video row is tapped
  // (from that same click handler, never from an effect), never cleared
  // automatically — only the deliberate "Resume Exercise" tap clears it.
  const [videoOpenedDuringExercise, setVideoOpenedDuringExercise] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(() => Boolean(pausedSnapshot));
  const handlePauseExercise = () => setManuallyPaused(true);
  const isInterrupted = videoOpenedDuringExercise || manuallyPaused;
  const {
    openVideo,
    handleSelect,
    closeVideo,
    promptOpen,
    dismissPrompt,
    confirmSignIn,
    confirmCreateAccount
  } = useProtectedVideo();

  if (ProgressIndicator) { /* no-op to satisfy blind linter */ }
  if (BreathingRing && BetaVideoModal && BetaVideoRow) { /* no-op to satisfy blind linter */ }

  const handleSelectVideo = (id) => {
    setVideoOpenedDuringExercise(true);
    handleSelect(id);
  };

  const handleResumeExercise = () => {
    setVideoOpenedDuringExercise(false);
    setManuallyPaused(false);
  };

  const musicPlayerRef = useRef(null);
  const handleResumeWithMusic = () => {
    setVideoOpenedDuringExercise(false);
    setManuallyPaused(false);
    musicPlayerRef.current?.start();
  };
  const musicEligible = isInteractiveMusicEligible({
    musicVariantId: INTERACTIVE_BREATHING_MUSIC_ID,
    featureEnabled: isFeatureEnabled('backgroundMusic'),
    getEntryById: getBetaVideoById
  });

  // Build 15 — a real pre-start preference, safe to seed from the
  // persisted cross-app preference now that Begin Breathing is a genuine
  // mandatory gesture before any playback - see MorningFlow.jsx's
  // identical rationale.
  const [musicPreferenceOn, setMusicPreferenceOn] = useState(() => {
    if (pausedSnapshot) return Boolean(pausedSnapshot.musicEnabled);
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

  // Stage 3C Group 3D Batch B: one-shot guard for the Session Engine
  // mirror only.
  const hasMirroredExitRef = useRef(false);
  const mirrorBreathingExitRef = useRef(() => {});
  useEffect(() => {
    mirrorBreathingExitRef.current = () => {
      if (hasMirroredExitRef.current) return;
      hasMirroredExitRef.current = true;
      if (state.status === 'playing' && currentStep?.id === 'breathe') {
        advanceStep();
      }
    };
  }, [state.status, currentStep, advanceStep]);

  useEffect(() => {
    // Build 15: nothing runs until hasBegun (or a genuine resume from a
    // paused snapshot, which already implies hasBegun=true). Pause-
    // during-review fix - freeze the countdown the instant the
    // confirmation dialog opens, not only after the user confirms.
    if (!hasBegun || isInterrupted || isRepeatGated || isConfirming) return;

    if (secondsLeft <= 0) {
      // Journey Embedding — Meditate is now the next step (optional,
      // inserted immediately after Breathe in MORNING_ROUTINE_SESSION).
      // mirrorBreathingExitRef.current() is unchanged: it already advances
      // the Session Engine from whatever the registry's real NEXT step is
      // after 'breathe' - no logic change needed there, only this route.
      setJourneyStep('meditate');
      navigate('/morning-meditate');
      mirrorBreathingExitRef.current();
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
  }, [secondsLeft, hasBegun, isInterrupted, isRepeatGated, isConfirming, navigate, setJourneyStep, activePattern]);

  // Double-tap protection: a ref, checked and set before anything else
  // runs - see MorningFlow.jsx's identical rationale.
  const hasBegunOnceRef = useRef(false);
  const handleBeginBreathing = () => {
    if (hasBegunOnceRef.current) return;
    hasBegunOnceRef.current = true;
    setSecondsLeft(activePattern.totalSeconds);
    setBreatheState('Inhale');
    setHasBegun(true);
    // Called synchronously within this real click handler - the same
    // proven, gesture-safe pattern "Resume with Music" already uses.
    if (musicEligible && musicPreferenceOn) {
      musicPlayerRef.current?.start();
    }
  };

  const handleComplete = () => {
    setJourneyStep('meditate');
    navigate('/morning-meditate');
    mirrorBreathingExitRef.current();
  };

  const handleSkip = () => {
    setJourneyStep('meditate');
    navigate('/morning-meditate');
    mirrorBreathingExitRef.current();
  };

  const handleExitRoutine = () => {
    setJourneyStep('');
    navigate('/');
    if (state.status === 'playing' && currentStep?.id === 'breathe') abandonSession();
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-xl mx-auto space-y-10 select-none">
      <div className="flex items-center gap-3">
        <BackButton fallback="/morning-flow" />
      </div>
      <ProgressIndicator activeStep="breathe" onReviewStep={requestReview} />

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      {isRepeatGated ? (
        <div className="glass-panel rounded-2xl p-6 text-center space-y-4 border-white/10">
          <p className="text-sm text-on-surface-variant">You already completed this step. Repeating it starts a fresh breathing exercise.</p>
          <button
            type="button"
            onClick={() => setHasStartedRepeat(true)}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            <span className="material-symbols-outlined text-sm">replay</span>
            <span>Repeat this exercise</span>
          </button>
        </div>
      ) : !hasBegun ? (
        <>
          {/* Build 15 — pre-start pattern selection. Nothing below this
              point runs a timer, animation, or plays music - see
              handleBeginBreathing above for the one gesture that starts
              all three together. */}
          <div className="text-center space-y-2">
            <span className="font-label-sm text-xs text-morning-accent uppercase tracking-widest font-bold">Mindful Breathing</span>
            <h2 className="text-2xl font-bold text-on-surface font-morning-display italic">Choose Your Breathing Practice</h2>
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
                accent="morning"
              />
            ))}
          </div>

          {musicEligible && (
            <MusicPreferenceToggle
              isOn={musicPreferenceOn}
              onToggle={handleToggleMusicPreference}
              description="Play gentle music during your breathing practice."
              accent="morning"
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
            <button
              onClick={handleSkip}
              className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
            >
              Skip this step
            </button>
            <button
              onClick={handleExitRoutine}
              className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors py-2"
            >
              Exit routine
            </button>
          </div>

          {/* Release-quality guided-breathing discoverability — collapsed
              by default, mirrors PrepareForRest.jsx's own "Choose a
              bedtime video or sleep sound" precedent: aria-expanded/
              aria-controls, never navigates. */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setGuidedSessionsOpen((v) => !v)}
              aria-expanded={guidedSessionsOpen}
              aria-controls="breathe-guided-sessions"
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
              <div id="breathe-guided-sessions" className="space-y-4">
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
          <div className="text-center space-y-2">
            <span className="font-label-sm text-xs text-morning-accent uppercase tracking-widest font-bold">Grounding Exercise</span>
            <h2 className="text-2xl font-bold text-on-surface font-morning-display italic">Center Yourself</h2>
            <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
              Bring your attention to the present before the day becomes busy.
            </p>
          </div>

          {/* Breathing Ring Visualizer — src/components/BreathingRing.jsx */}
          <BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} />

          <div className="text-center space-y-2">
            <span className="text-[10px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-on-surface-variant/80 font-bold uppercase tracking-wider">
              {activePattern.supportingLabel ? `${activePattern.supportingLabel} (${activePattern.label})` : activePattern.label}
            </span>
          </div>
        </>
      )}

      {/* Build 15 fix — a SINGLE, stable InteractiveAmbientMusic instance,
          never remounted across the pre-start -> active transition - see
          MorningFlow.jsx's identical fix/doc comment for the full
          rationale (a ref-triggered start() on an instance that's about
          to unmount orphans the audio element). */}
      {!isRepeatGated && (
        <InteractiveAmbientMusic
          ref={musicPlayerRef}
          musicVariantId={INTERACTIVE_BREATHING_MUSIC_ID}
          suspended={hasBegun ? (Boolean(openVideo) || manuallyPaused) : false}
          hideToggle={!hasBegun}
        />
      )}

      {hasBegun && !isRepeatGated && isInterrupted && !openVideo && (
        <ExercisePausedPanel
          onResumeExercise={handleResumeExercise}
          onResumeWithMusic={handleResumeWithMusic}
          showResumeWithMusic={musicEligible}
        />
      )}

      {hasBegun && !isRepeatGated && !isInterrupted && !openVideo && (
        <button
          type="button"
          onClick={handlePauseExercise}
          className="w-full py-4 glass-panel text-on-surface rounded-full font-bold flex items-center justify-center gap-2 border-white/10"
        >
          <span className="material-symbols-outlined text-sm">pause</span>
          <span>Pause Exercise</span>
        </button>
      )}

      {/* Same "Explore guided breathing sessions" disclosure as the
          pre-start screen, reusing the same guidedSessionsOpen state -
          opening it before Begin and then starting the exercise never
          silently closes it. Only rendered once the exercise is active;
          the pre-start branch above already renders its own copy while
          !hasBegun. Still reachable mid-exercise, preserving the
          existing interrupt-to-watch affordance handleSelectVideo
          already provides. */}
      {hasBegun && !isRepeatGated && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setGuidedSessionsOpen((v) => !v)}
            aria-expanded={guidedSessionsOpen}
            aria-controls="breathe-guided-sessions-active"
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
            <div id="breathe-guided-sessions-active" className="space-y-4">
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
      )}

      {hasBegun && !isRepeatGated && (
        <div className="space-y-3 w-full">
          {isReviewMode ? (
            currentStep && (
              <button
                onClick={() => navigate(routeForStep(currentStep.id))}
                className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
              >
                <span>Return to {getStepLabel(currentStep.id)}</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            )
          ) : (
            <>
              {!isInterrupted && (
                <button
                  onClick={handleComplete}
                  className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
                >
                  <span>Continue</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              )}
              <button
                onClick={handleSkip}
                className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
              >
                Skip this step
              </button>
              <button
                onClick={handleExitRoutine}
                className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors py-2"
              >
                Exit routine
              </button>
            </>
          )}
        </div>
      )}

      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={closeVideo} />
      )}
      <SignInPromptDialog
        open={promptOpen}
        onSignIn={confirmSignIn}
        onCreateAccount={confirmCreateAccount}
        onDismiss={dismissPrompt}
      />
      <ConfirmDialog
        open={isConfirming}
        title="Review an earlier step?"
        message="Your current exercise will be paused."
        confirmLabel="Review Step"
        cancelLabel="Cancel"
        onConfirm={confirmLeave}
        onDismiss={cancelLeave}
      />
    </div>
  );
};

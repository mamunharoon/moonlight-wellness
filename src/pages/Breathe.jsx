/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { JourneyGlow } from '../components/JourneyGlow';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { getStepLabel } from '../lib/stepLabels';
import { BreathingRing } from '../components/BreathingRing';
import { BreathingPatternRow } from '../components/BreathingPatternRow';
import { BreathingPatternDescription } from '../components/BreathingPatternDescription';
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
import { usePreparationCountdown } from '../hooks/usePreparationCountdown';
import { PreparationCountdown } from '../components/PreparationCountdown';
import { getReducedMotionPreference } from '../lib/reducedMotionPreference';

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
  // into the Session Engine on genuine natural/Continue completion. See
  // mirrorBreathingExitRef below. Skip uses the canonical, separately-
  // validated skipStep() action instead (Continue-lock/Skip-semantics
  // fix) - see handleSkip.
  const { state, currentStep, advanceStep, skipStep, abandonSession } = useSession();
  const { isReviewMode, isLiveStep } = useStepReviewMode('breathe', 'morning-routine');
  // isRepeatGated hidden-options defect fix — see MorningFlow.jsx's
  // identical fix for the full rationale (found live: reviewing an
  // earlier, already-passed Breathe step showed "You already completed
  // this step - Repeat?" instead of the real setup screen with all
  // pattern/music choices, blocking the approved "review the previous
  // step with setup options" behaviour). Always false now.
  const isRepeatGated = false;
  const { isGuest } = useAuth();

  // Pause-and-resume-exact-state fix - see MorningFlow.jsx's identical
  // block for the full rationale (session/timedExercisePause.js). Build
  // 15: the snapshot now also carries which pattern was selected and
  // whether music was enabled.
  const [pausedSnapshot] = useState(() => loadPausedExerciseState('morning-routine', 'breathe'));
  useEffect(() => {
    if (pausedSnapshot) clearPausedExerciseState('morning-routine', 'breathe');
  }, [pausedSnapshot]);

  // Review-mode auto-start defect fix — a pausedSnapshot only represents
  // a genuine "I left THIS exact live step mid-run to review something
  // else" resume. If this mount is not currently the live step
  // (isLiveStep false - e.g. arrived here via an ordinary Back/forward
  // navigation while a stale, un-consumed snapshot from an earlier,
  // unrelated interrupted round-trip still sits in sessionStorage), it
  // must never be trusted to auto-restore an already-active exercise
  // with no setup/pattern choices shown - found live on Evening's
  // identical mechanism ("Back from Meditation opened an already-running
  // Breathing countdown"). The raw snapshot is still read and cleared
  // unconditionally above so a stale one can never resurface later
  // either way; only TRUSTED for seeding initial UI state when
  // isLiveStep is true at mount.
  const trustedSnapshot = isLiveStep ? pausedSnapshot : null;

  // Build 15 — pattern selection, pre-start only. Defaults to Morning's
  // own established 4-4-6 pattern.
  const [selectedPatternId, setSelectedPatternId] = useState(() => trustedSnapshot?.patternId ?? DEFAULT_PATTERN_ID);
  // Release-quality guided-breathing discoverability — one collapsed-by-
  // default disclosure combining both video collections, mirroring
  // MorningFlow.jsx's own "Explore guided stretching sessions" pattern:
  // never forced open by Begin, reachable both pre-start and once the
  // exercise is active (preserving the existing interrupt-to-watch
  // affordance).
  const [guidedSessionsOpen, setGuidedSessionsOpen] = useState(false);
  const activePattern = getBreathingPatternById(selectedPatternId) ?? BREATHING_PATTERNS[0];

  // hasBegun: false until the user explicitly taps "Begin Breathing" -
  // true immediately when resuming from a TRUSTED paused snapshot (this
  // genuinely is the live step being returned to).
  const [hasBegun, setHasBegun] = useState(() => Boolean(trustedSnapshot));

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
  const [breatheState, setBreatheState] = useState(() => trustedSnapshot?.breatheState ?? 'Inhale');
  const [secondsLeft, setSecondsLeft] = useState(() => trustedSnapshot?.secondsLeft ?? activePattern.totalSeconds);
  // WakeWise Phase 1 correction — same OS-or-manual-preference snapshot
  // SelfGuidedMeditation.jsx already uses for MeditationProgressRing; the
  // ring previously never read either signal at all.
  const [reducedMotion] = useState(() => {
    try {
      return Boolean(getReducedMotionPreference() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  });
  // Morning-flow redesign: set the moment any guided-video row is tapped
  // (from that same click handler, never from an effect), never cleared
  // automatically — only the deliberate "Resume Exercise" tap clears it.
  const [videoOpenedDuringExercise, setVideoOpenedDuringExercise] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(() => Boolean(trustedSnapshot));
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

  const musicPlayerRef = useRef(null);
  // Build 16 physical-iPhone correction (F6) — captures whether music was
  // genuinely playing at the exact moment an interruption begins (before
  // `suspended` pauses it below), so the single Resume action can restore
  // the same choice automatically. See ExercisePausedPanel.jsx's own doc
  // comment for the full rationale.
  const wasMusicPlayingRef = useRef(false);

  const handlePauseExercise = () => {
    wasMusicPlayingRef.current = musicPlayerRef.current?.isPlaying() ?? false;
    setManuallyPaused(true);
  };

  const handleSelectVideo = (id) => {
    wasMusicPlayingRef.current = musicPlayerRef.current?.isPlaying() ?? false;
    setVideoOpenedDuringExercise(true);
    handleSelect(id);
  };

  const handleResume = () => {
    setVideoOpenedDuringExercise(false);
    setManuallyPaused(false);
    if (wasMusicPlayingRef.current) {
      wasMusicPlayingRef.current = false;
      musicPlayerRef.current?.start();
    }
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
    if (trustedSnapshot) return Boolean(trustedSnapshot.musicEnabled);
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

  // Continue-lock/Skip-semantics fix, found live: natural timer
  // completion used to auto-navigate immediately (identical to a manual
  // Continue tap), and the pre-start "Continue" button itself was
  // tappable at any point while active/unpaused - not gated on the timer
  // actually finishing. Now: reaching 0 only STOPS the countdown (no
  // navigation) and hasFinished (below) unlocks the Continue button -
  // Continue itself, tapped afterward, is what records completion and
  // advances. Skip remains the only early-exit action while still
  // running, and now calls the canonical, separately-validated
  // skipStep() (see handleSkip) instead of sharing this completion path.
  const hasFinished = secondsLeft <= 0;
  useEffect(() => {
    // Build 15: nothing runs until hasBegun (or a genuine resume from a
    // paused snapshot, which already implies hasBegun=true). Pause-
    // during-review fix - freeze the countdown the instant the
    // confirmation dialog opens, not only after the user confirms.
    if (!hasBegun || isInterrupted || isRepeatGated || isConfirming || hasFinished) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        const nextSec = prev - 1;
        setBreatheState(resolveBreathPhase(activePattern, nextSec));
        return nextSec;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasFinished, hasBegun, isInterrupted, isRepeatGated, isConfirming, activePattern]);

  // Double-tap protection: a ref, checked and set before anything else
  // runs - see MorningFlow.jsx's identical rationale.
  const hasBegunOnceRef = useRef(false);

  // Build 16 physical-iPhone correction (F3/F4) — Begin Breathing now
  // transitions into the shared 5-second preparation countdown instead of
  // starting the timer/music immediately - see MorningFlow.jsx's
  // identical block for the full rationale.
  const countdown = usePreparationCountdown({
    seconds: 5,
    onComplete: () => {
      setSecondsLeft(activePattern.totalSeconds);
      setBreatheState('Inhale');
      setHasBegun(true);
      if (musicEligible && musicPreferenceOn) {
        musicPlayerRef.current?.start();
      }
    }
  });

  const handleBeginBreathing = () => {
    if (hasBegunOnceRef.current) return;
    hasBegunOnceRef.current = true;
    if (musicEligible && musicPreferenceOn) {
      musicPlayerRef.current?.preload();
    }
    countdown.start();
  };

  // Only reachable once hasFinished (Continue is hidden until then, see
  // render below) - records genuine completion and advances.
  const handleComplete = () => {
    setJourneyStep('meditate');
    navigate('/morning-meditate');
    mirrorBreathingExitRef.current();
  };

  // Continue-lock/Skip-semantics fix — Skip is the explicit early-exit
  // action while still running (or at any point), genuinely distinct from
  // Continue/natural completion: it calls the Session Engine's own
  // canonical skipStep() (validated against currentStep.skippable and
  // 'playing' status by the reducer itself) rather than the
  // completion-mirror's advanceStep(), so it can never be recorded as
  // completing the step.
  const handleSkip = () => {
    setJourneyStep('meditate');
    navigate('/morning-meditate');
    skipStep();
  };

  const handleExitRoutine = () => {
    setJourneyStep('');
    navigate('/');
    if (state.status === 'playing' && currentStep?.id === 'breathe') abandonSession();
  };

  // Back-navigation repair (Morning canonical map) — Active Breathe Back
  // must safely stop breathing and return to THIS step's own pre-start
  // screen, never straight to Stretch and never the whole-routine "Leave
  // this routine?" confirmation (guardActiveRoute is off on this screen's
  // BackButton below - only Skip/Exit still leave the routine outright).
  // A subsequent Back tap, once hasBegun is false again, falls through to
  // BackButton's own ordinary previous-step navigation. Pre-start (and the
  // gated repeat-intro) are untouched - only a genuinely active run is
  // ever stopped here. Mirrors MorningFlow.jsx's identical handler.
  const handleBackFromActive = () => {
    // Build 16 physical-iPhone correction (F3) — Back/Cancel during the
    // preparation countdown returns to this same pre-start screen without
    // ever marking breathing started or begun.
    if (countdown.isActive) {
      countdown.cancel();
      hasBegunOnceRef.current = false;
      return false;
    }
    if (!hasBegun || isRepeatGated) return;
    hasBegunOnceRef.current = false;
    setVideoOpenedDuringExercise(false);
    setManuallyPaused(false);
    setBreatheState('Inhale');
    setSecondsLeft(activePattern.totalSeconds);
    setHasBegun(false);
    musicPlayerRef.current?.stop();
    return false;
  };

  return (
    // Build 16 physical-iPhone correction (F8) - see Affirmation.jsx's
    // identical block for the full rationale.
    <div
      className="min-h-[85vh] flex flex-col pb-6 max-w-xl mx-auto space-y-5 select-none"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))'
      }}
    >
      {/* WakeWise DEV — colour glow extension: Morning's Breathe step
          (setup, prep countdown, and active phase all share this one
          root - see this file's own single-return structure). */}
      <JourneyGlow journey="morning" />
      <div className="flex items-center gap-3">
        <BackButton fallback="/morning-flow" guardActiveRoute={false} onBeforeLeave={handleBackFromActive} />
      </div>
      <ProgressIndicator activeStep="breathe" onReviewStep={requestReview} />

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      {/* Build 16 physical-iPhone correction (F3) — shared preparation
          countdown, shown in place of the pre-start/active content below
          while running. Back/Cancel is handled entirely by this screen's
          own header BackButton above (handleBackFromActive). */}
      {countdown.isActive && (
        <PreparationCountdown
          secondsRemaining={countdown.secondsRemaining}
          cue="Find a comfortable, steady position."
          onSkip={countdown.skip}
          accent="morning"
        />
      )}

      {!countdown.isActive && (!hasBegun ? (
        <>
          {/* Build 15 — pre-start pattern selection. Nothing below this
              point runs a timer, animation, or plays music - see
              handleBeginBreathing above for the one gesture that starts
              all three together. */}
          <div className="text-center space-y-1.5">
            <span className="font-label-sm text-xs text-morning-accent uppercase tracking-widest font-bold">Mindful Breathing</span>
            <h2 className="text-2xl font-bold text-on-surface font-morning-display italic">Choose Your Breathing Practice</h2>
            <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
              Choose a breathing rhythm, then begin when you&rsquo;re ready.
            </p>
          </div>

          {/* Build 16 physical-iPhone correction (F5) — compact 2-column
              grid (4-4-6 | 4-7-8 / 4-4-8 | Box / Coherent full-width),
              replacing the five full-width rows that made this screen too
              long. Each card shows its complete name only - the selected
              pattern's full cadence and exact duration render once, below
              the grid, via the shared BreathingPatternDescription. */}
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Choose your breathing practice">
            {BREATHING_PATTERNS.map((pattern, idx) => (
              <BreathingPatternRow
                key={pattern.id}
                compact
                pattern={pattern}
                selected={selectedPatternId === pattern.id}
                onSelect={setSelectedPatternId}
                groupName="breathing-pattern"
                accent="morning"
                className={idx === BREATHING_PATTERNS.length - 1 ? 'col-span-2' : undefined}
              />
            ))}
          </div>
          <BreathingPatternDescription pattern={activePattern} />

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
              className={`w-full ${getJourneyPrimaryActionClasses('morning')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg`}
            >
              <span>Begin Breathing</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
            {/* Morning journey UX correction — Skip has no meaning while
                reviewing an already-completed Breathe from a later step
                (Meditate/Affirm): the ReviewModeBanner's own "Return to
                [current step]" above already covers that, and "remains
                available only before the activity has ever been started in
                that forward visit" excludes review entirely. The
                whole-routine exit link below stays available either way -
                leaving the routine is valid regardless of review state,
                matching MorningMeditate.jsx's identical precedent. */}
            {!isReviewMode && (
              <button
                onClick={handleSkip}
                className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
              >
                Skip this step
              </button>
            )}
            <button
              onClick={handleExitRoutine}
              className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors -my-1.5 py-3.5"
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
          <BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} journeyTone="morning" reducedMotion={reducedMotion} />

          <div className="text-center space-y-2">
            <span className="text-[10px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-on-surface-variant/80 font-bold uppercase tracking-wider">
              {activePattern.supportingLabel ? `${activePattern.supportingLabel} (${activePattern.label})` : activePattern.label}
            </span>
          </div>
        </>
      ))}

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
        <ExercisePausedPanel onResume={handleResume} journeyTone="morning" />
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
          {/* Duplicate-return-action fix, found live: reviewing Breathe
              from a later step (e.g. Meditate/Affirm) and then tapping
              "Begin Breathing" to replay it used to show BOTH the
              ReviewModeBanner's own "Return to X" (top, always rendered
              whenever isReviewMode) AND this identical button here -
              two controls doing the exact same thing on screen at once.
              The banner already covers it; nothing replaces this branch
              while reviewing (Skip/Exit were already hidden here too, for
              the same reason - reviewing never exposes them). */}
          {!isReviewMode && (
            <>
              {hasFinished && !isInterrupted && (
                <button
                  onClick={handleComplete}
                  className={`w-full ${getJourneyPrimaryActionClasses('morning')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg`}
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
                className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors -my-1.5 py-3.5"
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

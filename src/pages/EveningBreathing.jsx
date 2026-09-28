/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { BreathingRing } from '../components/BreathingRing';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { BreathingPatternRow } from '../components/BreathingPatternRow';
import { BreathingPatternDescription } from '../components/BreathingPatternDescription';
import { InteractiveAmbientMusic } from '../components/InteractiveAmbientMusic';
import { MusicPreferenceToggle } from '../components/MusicPreferenceToggle';
import { ExercisePausedPanel } from '../components/ExercisePausedPanel';
import { isFeatureEnabled } from '../lib/featureFlags';
import { isInteractiveMusicEligible } from '../lib/backgroundMusicSelection';
import { getBetaVideoById } from '../lib/mediaCatalog';
import { getMusicPreference, setMusicPreferenceForUser } from '../lib/musicPreference';
import { BREATHING_PATTERNS, getBreathingPatternById, resolveBreathPhase } from '../lib/breathingPatterns';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { getReducedMotionPreference } from '../lib/reducedMotionPreference';
import { loadEveningBreathingPattern, saveEveningBreathingPattern } from '../lib/eveningBreathingSelection';
import { ReviewModeBanner } from '../components/ReviewModeBanner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { savePausedExerciseState, loadPausedExerciseState, clearPausedExerciseState } from '../session/timedExercisePause';
import { getStepLabel } from '../lib/stepLabels';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { usePreparationCountdown } from '../hooks/usePreparationCountdown';
import { PreparationCountdown } from '../components/PreparationCountdown';
import { getCompletionGreeting } from '../lib/outcomeMessages';
import { createBreathingSession } from '../lib/breathingSession';
import { CompletionReveal } from '../components/CompletionReveal';
import { useCompletionHandoff } from '../hooks/useCompletionHandoff';

// Background Music — reserved id for the shared interactive-breathing
// ambient loop (see docs/background-music-asset-manifest.md).
const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';

// Build 15 Evening UX correction — Evening now offers the same three real
// shared patterns Morning/standalone already do (BREATHING_PATTERNS),
// defaulting to its own established 4-7-8 recommendation rather than
// being permanently fixed to it. Nothing (timer, ring animation, or
// music) starts before "Begin Breathing" is tapped - same proven
// pre-start shape already used by Breathe.jsx/QuietBreathing.jsx.
const DEFAULT_PATTERN_ID = 'evening';

/*
 * Stage 4 Batch F6 — EveningBreathing
 *
 * Fourth step of the evening-wind-down session. Reuses BreathingRing
 * (F2) as-is — the visual is unchanged; only the timing driving it
 * changes. Same mirrorBreathingExitRef one-shot-guard pattern as
 * Breathe.jsx, targeting the 'breathing' step and advanceStep()
 * (immediately adjacent to 'sleepPreparation').
 *
 * Guest pre-start-music correction (Build 18, complete) — neither the
 * pre-start MusicPreferenceToggle nor the paused-state ExercisePausedPanel
 * below route a guest's tap to sign-in any more (see each component's own
 * updated doc comment). The former confirmSignInForMusic handler (a local
 * setPendingContent+navigate('/auth') pair - this screen has no guided-
 * video rows to borrow a confirmSignIn from) is removed entirely, now
 * genuinely dead: nothing on this screen navigates to sign-in for music
 * any more. handleToggleMusicPreference persists through the shared
 * setMusicPreferenceForUser (musicPreference.js) instead of the raw
 * setter, so a guest's choice still drives real playback this mount but
 * is never written to the shared, device-scoped key.
 * handleBeginBreathing's own `&& !isGuest` guard is removed too - a guest
 * who left the switch On now genuinely gets InteractiveAmbientMusic's
 * start() called on Begin, exactly like an authenticated user (IB01 is
 * server-allowlisted for guests - see interactiveAmbientMusic.test.js).
 */
export const EveningBreathing = () => {
  const navigate = useNavigate();
  const { effectiveTimezone, userId } = useAlarm();
  const today = getZonedParts(effectiveTimezone, devNow()).dateKey;
  const { isGuest } = useAuth();
  const { state, currentStep, advanceStep, skipStep } = useSession();
  const { isReviewMode, isLiveStep } = useStepReviewMode('breathing', 'evening-wind-down');
  // isRepeatGated hidden-options defect fix — the exact same defect and
  // fix as MorningFlow.jsx/Breathe.jsx (found live: "Back from Meditation
  // opened an already-running Breathing countdown, with no pattern
  // choices available" was actually two separate bugs - the paused-
  // snapshot auto-start fixed above via trustedSnapshot, and this
  // isRepeatGated gate independently hiding the real setup screen behind
  // a "Repeat this exercise?" tap whenever reviewing an already-passed
  // step). Always false now.
  const isRepeatGated = false;
  const [pausedSnapshot] = useState(() => loadPausedExerciseState('evening-wind-down', 'breathing'));
  useEffect(() => {
    if (pausedSnapshot) clearPausedExerciseState('evening-wind-down', 'breathing');
  }, [pausedSnapshot]);

  // Review-mode auto-start defect fix — found live: "Back from Meditation
  // opened an already-running Breathing countdown, with no pattern
  // choices available." A pausedSnapshot only represents a genuine "I
  // left THIS exact live step mid-run to review something else" resume;
  // if this mount is not currently the live step (isLiveStep false - a
  // stale, un-consumed snapshot from an earlier, unrelated interrupted
  // round-trip can still sit in sessionStorage), it must never be
  // trusted to auto-restore an already-active exercise. The raw snapshot
  // is still read and cleared unconditionally above so a stale one can
  // never resurface later either way; only TRUSTED for seeding initial
  // UI state when isLiveStep is true at mount.
  const trustedSnapshot = isLiveStep ? pausedSnapshot : null;

  const [hasBegun, setHasBegun] = useState(() => Boolean(trustedSnapshot));

  // Build 15 Evening UX correction — tonight's selected pattern. Priority:
  // a genuine review-round-trip snapshot (same as Breathe.jsx's own
  // precedent) first, then whatever was already persisted/selected
  // earlier tonight (survives backgrounding/remount/leaving to Home and
  // resuming), then the established 4-7-8 default.
  const [selectedPatternId, setSelectedPatternId] = useState(
    () => trustedSnapshot?.patternId ?? loadEveningBreathingPattern(userId, today) ?? DEFAULT_PATTERN_ID
  );
  const activePattern = getBreathingPatternById(selectedPatternId) ?? getBreathingPatternById(DEFAULT_PATTERN_ID);
  const handleSelectPattern = (patternId) => {
    setSelectedPatternId(patternId);
    saveEveningBreathingPattern(userId, patternId, today);
  };

  const { requestReview, confirmLeave, cancelLeave, isConfirming, routeForStep } = useReviewNavigation({
    sessionId: 'evening-wind-down',
    isLiveStep,
    hasUnsavedProgress: true,
    onLeaveLiveStep: () => savePausedExerciseState('evening-wind-down', 'breathing', {
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
  const [manuallyPaused, setManuallyPaused] = useState(() => Boolean(trustedSnapshot));
  const musicPlayerRef = useRef(null);
  // Build 16 physical-iPhone correction (F6) — captures whether music was
  // genuinely playing at the exact moment the pause begins (before
  // `suspended` pauses it below), so the single Resume action can restore
  // the same choice automatically. See ExercisePausedPanel.jsx's own doc
  // comment for the full rationale.
  const wasMusicPlayingRef = useRef(false);
  const handlePauseExercise = () => {
    wasMusicPlayingRef.current = musicPlayerRef.current?.isPlaying() ?? false;
    setManuallyPaused(true);
  };
  const handleResume = () => {
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
  // Build 15 — genuinely safe to seed from the persisted preference now:
  // Begin Breathing is a real mandatory gesture before any playback.
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

  if (EveningSceneShell && BreathingRing && ProgressIndicator && BreathingPatternRow && BreathingPatternDescription && InteractiveAmbientMusic && MusicPreferenceToggle && ExercisePausedPanel && ReviewModeBanner && ConfirmDialog && PreparationCountdown) { /* no-op to satisfy blind linter */ }

  const hasMirroredExitRef = useRef(false);
  const mirrorExitRef = useRef(() => {});
  useEffect(() => {
    mirrorExitRef.current = () => {
      if (hasMirroredExitRef.current) return;
      hasMirroredExitRef.current = true;
      if (state.status === 'playing' && currentStep?.id === 'breathing') {
        advanceStep();
      }
    };
  }, [state.status, currentStep, advanceStep]);

  // Evening Breathing completion correction — reuses Breathe.jsx's
  // approved, physical-iPhone-tested architecture exactly: completion was
  // previously a render-time-DERIVED value (secondsLeft <= 0, "Continue-
  // lock/Skip-semantics fix" below) rather than a single, authoritative
  // decision made the instant the timer actually reaches the boundary -
  // and reaching 0 left the screen showing the still-active ring
  // indefinitely, with an inline acknowledgement/Continue button rather
  // than a dedicated completion panel. Fix: a pure, synchronous
  // createBreathingSession controller (breathingSession.js, already
  // journey-agnostic and real-execution tested - see
  // breathingSession.test.js) driven by ONE real interval; the interval's
  // own callback is the single place that detects the final tick AND
  // synchronously stops itself, stops music, picks the completion
  // greeting, and flips the explicit isCompleted state - zero renders/
  // effects in between.
  const sessionRef = useRef(null);
  const intervalRef = useRef(null);
  const [isCompleted, setIsCompleted] = useState(false);
  // Completion-transition-tuning pass — purely additive/visual; isCompleted
  // itself (above) keeps its exact original timing for every other
  // consumer. Only the render ternary below swaps from isCompleted to
  // showCompletionPanel - see useCompletionHandoff.js's own doc comment.
  const { activeViewExiting, showCompletionPanel } = useCompletionHandoff(isCompleted);
  const [completionGreeting, setCompletionGreeting] = useState(null);
  // Evening Breathing Back/early-exit correction (reusing Breathe.jsx's
  // proven pattern) — gates the same interval-management effect and
  // InteractiveAmbientMusic's own `suspended` prop that isConfirming/
  // isCompleted already use, so the timer/animation/music all genuinely
  // pause the instant this dialog opens, never reset.
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);

  const stopBreathingInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Covers unmount and any navigation away from this screen (Continue/
  // Skip/Exit/Back) - the one place that guarantees the interval is
  // never left running behind a screen the user is no longer on.
  useEffect(() => () => stopBreathingInterval(), []);

  useEffect(() => {
    // Build 15: nothing runs until hasBegun, and never again once
    // isCompleted or backConfirmOpen. Pause-during-review fix - freeze
    // the countdown the instant a confirmation dialog opens.
    if (!hasBegun || manuallyPaused || isRepeatGated || isConfirming || isCompleted || backConfirmOpen) return;
    const session = sessionRef.current;
    if (!session) return;

    intervalRef.current = setInterval(() => {
      const current = sessionRef.current;
      if (!current) return;
      const { completed, secondsLeft: nextSecondsLeft, breatheState: nextBreatheState } = current.tick();
      setSecondsLeft(nextSecondsLeft);
      setBreatheState(nextBreatheState);
      if (completed) {
        // All completion side-effects happen synchronously, in this same
        // callback, the instant the boundary is reached - stop the
        // interval (so a stray extra tick can never fire), stop the
        // music, and enter the completed state, all in one step, exactly
        // once per real completion.
        stopBreathingInterval();
        musicPlayerRef.current?.stop();
        setCompletionGreeting(getCompletionGreeting({ journey: 'evening', practice: 'breathing' }));
        setIsCompleted(true);
      }
    }, 1000);

    return () => stopBreathingInterval();
  }, [hasBegun, manuallyPaused, isRepeatGated, isConfirming, isCompleted, backConfirmOpen]);

  // Double-tap protection - see Breathe.jsx's identical rationale. Also
  // where the selected pattern is effectively "locked" for the active
  // run - the picker UI below only renders while !hasBegun, so
  // selectedPatternId can never change again once this fires.
  const hasBegunOnceRef = useRef(false);

  // WakeWise DEV — Evening Breathing silent-music fix. Root cause (traced
  // live, same defect class already found and fixed for Anytime Breathing/
  // Morning Stretch/Morning Breathing - see InteractiveAmbientMusic.jsx's
  // own start()/unmute() doc comment for the full root-cause trace):
  // handleBeginBreathing used to call only preload() (a network fetch,
  // never touching playback) and deferred the real, audible start() call
  // to this onComplete - which fires from usePreparationCountdown's own
  // setInterval tick + effect, 5 REAL SECONDS after the Begin tap, not a
  // synchronous continuation of it. iOS/WKWebView's gesture-before-
  // unmuted-playback rule does not survive that gap, so audio.play() was
  // silently rejected.
  //
  // Fix: onComplete now only unmute()s - the real start(true) call already
  // happened synchronously in handleBeginBreathing below, at the moment of
  // the actual tap, so audio is already genuinely playing (muted) by the
  // time this fires; unmute() is a plain property set with no gesture
  // requirement of its own, safe to call from this setInterval-derived
  // callback.
  const countdown = usePreparationCountdown({
    seconds: 5,
    onComplete: () => {
      // Sequential-pattern correctness — the one true "start a fresh
      // session" entry point: always creates a BRAND NEW controller for
      // whichever pattern is currently selected, never reusing a
      // previous instance, so a 2nd/3rd pattern completed in the same
      // mounted visit behaves identically to the 1st.
      sessionRef.current = createBreathingSession({ pattern: activePattern, resolveBreathPhase });
      sessionRef.current.begin();
      setSecondsLeft(sessionRef.current.getSecondsLeft());
      setBreatheState(sessionRef.current.getBreatheState());
      setIsCompleted(false);
      setCompletionGreeting(null);
      setHasBegun(true);
      if (musicEligible && musicPreferenceOn) {
        musicPlayerRef.current?.unmute();
      }
    }
  });

  // WakeWise DEV — Evening Breathing silent-music fix (see the countdown's
  // own doc comment above for the full root-cause trace). Calls the REAL
  // start(true) (muted) here, synchronously within this actual tap - the
  // one genuine user gesture this screen has - instead of only preload()
  // (network fetch, no play()). A muted play() still passes iOS/WKWebView's
  // gesture-before-playback check and produces no audible sound during the
  // 5-second "get ready" countdown; the countdown's own onComplete then
  // reveals it with a plain unmute() once the active breathing phase
  // actually begins.
  const handleBeginBreathing = () => {
    if (hasBegunOnceRef.current) return;
    hasBegunOnceRef.current = true;
    if (musicEligible && musicPreferenceOn) {
      musicPlayerRef.current?.start(true);
    }
    countdown.start();
  };

  // Only reachable once isCompleted (Continue to Meditate is hidden until
  // then, see render below) - records genuine completion and advances.
  const handleComplete = () => {
    navigate('/evening-meditate');
    mirrorExitRef.current();
  };

  // Continue-lock/Skip-semantics fix — Skip is the explicit early-exit
  // action while still running (or at any point), genuinely distinct from
  // Continue/natural completion: it calls the Session Engine's own
  // canonical skipStep() (validated against currentStep.skippable and
  // 'playing' status by the reducer itself) rather than the
  // completion-mirror's advanceStep(), so it can never be recorded as
  // completing the step.
  const handleSkip = () => {
    navigate('/evening-meditate');
    skipStep();
  };

  // Back-navigation repair (canonical Morning/Evening map) — Active
  // Breathing Back must safely stop the exercise and return to this
  // step's own pre-start screen, never straight to Gratitude and never
  // the whole-routine exit (this screen never opts into EveningSceneShell's
  // guardActiveRoute prop, so Back here stays unguarded - only its
  // separate showExit control leaves the routine outright). A subsequent
  // Back tap, once hasBegun is false again, falls through to the ordinary
  // previous-step navigation. Mirrors Breathe.jsx's identical handler.
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
    // Evening Breathing Back/early-exit correction (reusing Breathe.jsx's
    // proven pattern) — Back from the COMPLETED panel is ordinary
    // navigation, never an early exit: the exercise already finished, so
    // this must never open the confirmation or touch isCompleted/
    // completionGreeting.
    if (isCompleted) return;
    // Repeated-Back-tap guard — never re-capture wasMusicPlayingRef (it
    // would now read false, since the music is already suspended for
    // the open dialog) and never open a second dialog.
    if (backConfirmOpen) return false;
    // Previously: reset everything immediately with ZERO confirmation
    // (found live - identical defect class to Breathe.jsx/MorningFlow.jsx
    // before their own fixes). Now: capture whether music was genuinely
    // playing before the dialog suspends it, then just open the dialog -
    // the timer/animation/music all pause via the interval effect's/
    // InteractiveAmbientMusic's own backConfirmOpen gate, never reset,
    // until the user actually chooses Leave Exercise.
    wasMusicPlayingRef.current = musicPlayerRef.current?.isPlaying() ?? false;
    setBackConfirmOpen(true);
    return false;
  };

  // "Keep Breathing" — dismiss the dialog and resume from the exact
  // remaining time (nothing was ever reset), restoring music only if it
  // was genuinely playing before the dialog opened.
  const keepBreathing = () => {
    setBackConfirmOpen(false);
    if (wasMusicPlayingRef.current) {
      wasMusicPlayingRef.current = false;
      musicPlayerRef.current?.start();
    }
  };

  // "Leave Exercise" — the one true confirmed-early-exit path: stops and
  // disposes of the timer/session/music, records nothing (never calls
  // mirrorExitRef/advanceStep), and returns to the pre-start/pattern-
  // selection screen. No early-exit banner message is shown here - the
  // task defining this correction gave exact approved copy only for
  // natural completion, not for an Evening Breathing early exit, so none
  // is invented (see the final report's honest-outcomes note).
  const leaveExercise = () => {
    setBackConfirmOpen(false);
    hasBegunOnceRef.current = false;
    setManuallyPaused(false);
    stopBreathingInterval();
    sessionRef.current?.end();
    sessionRef.current = null;
    setBreatheState('Inhale');
    setSecondsLeft(activePattern.totalSeconds);
    setIsCompleted(false);
    setCompletionGreeting(null);
    setHasBegun(false);
    musicPlayerRef.current?.stop();
    wasMusicPlayingRef.current = false;
  };

  return (
    // Build 15 Evening UX correction — fixes the confirmed Back-matrix bug:
    // the missing `?q=3` meant Back landed on Gratitude Q1 (parseActiveIndex
    // defaults a missing q to index 0), not Gratitude Q3 as required.
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/gratitude?q=3" onBeforeLeave={handleBackFromActive} showExit>
      {/* Build 16 physical-iPhone correction (F9) — see Gratitude.jsx's
          identical fix for the full rationale (ProgressIndicator's own
          mobile compact block already shows "Step 4 of 7"). */}
      <ProgressIndicator activeStep="breathing" sessionId="evening-wind-down" onReviewStep={requestReview} />

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      {/* Build 16 physical-iPhone correction (F3) — shared preparation
          countdown, shown in place of the pre-start/active content below
          while running. Back/Cancel is handled entirely by this screen's
          own EveningSceneShell Back (handleBackFromActive, above). */}
      {countdown.isActive && (
        <PreparationCountdown
          secondsRemaining={countdown.secondsRemaining}
          cue="Find a comfortable, steady position."
          onSkip={countdown.skip}
          accent="evening"
        />
      )}

      {!countdown.isActive && (!hasBegun ? (
        <>
          {/* Build 15 Evening UX correction — real pattern selection,
              replacing the former fixed-4-7-8-only preview. Nothing
              below this point runs a timer, animation, or plays music -
              see handleBeginBreathing above for the one gesture that
              starts all three together. */}
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="text-center space-y-2">
              <h1 className="font-serif italic text-2xl text-on-surface">Breathe with the night.</h1>
              <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                Slow, easy breaths. There is nowhere else to be.
              </p>
            </div>

            {/* Build 16 physical-iPhone correction (F5) — compact
                2-column grid, replacing the five full-width rows. Each
                card shows its complete name only - the selected
                pattern's full cadence and exact duration render once,
                below the grid, via the shared
                BreathingPatternDescription. */}
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Choose your breathing practice">
              {BREATHING_PATTERNS.map((pattern, idx) => (
                <BreathingPatternRow
                  key={pattern.id}
                  compact
                  pattern={pattern}
                  selected={selectedPatternId === pattern.id}
                  onSelect={handleSelectPattern}
                  groupName="evening-breathing-pattern"
                  accent="evening"
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
                accent="evening"
              />
            )}
          </div>

          <div className="space-y-3 w-full">
            <button
              type="button"
              onClick={handleBeginBreathing}
              className={`w-full ${getJourneyPrimaryActionClasses('evening')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg`}
            >
              <span>Begin Breathing</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
            {/* Evening journey UX correction (mirrors Breathe.jsx's
                identical fix) — Skip has no meaning while reviewing an
                already-completed Breathing from a later Evening step: the
                ReviewModeBanner's own "Return to [current step]" above
                already covers that. Evening's own whole-journey exit is
                EveningSceneShell's separate showExit control, unaffected
                either way. */}
            {!isReviewMode && (
              <button
                onClick={handleSkip}
                className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/40"
              >
                Skip
              </button>
            )}
          </div>
        </>
      ) : showCompletionPanel ? (
        // Evening Breathing completion correction — a genuine dedicated
        // completed panel, replacing the active exercise interface
        // entirely (ring and its own heading copy are gone here, not just
        // overlaid) so there is never any doubt the exercise is over.
        // Periwinkle visual language reused from this app's own existing
        // tokens (EveningComplete.jsx's own bg-evening-accent/10 +
        // border-evening-accent-tint/25 + shadow-evening-glow badge
        // shape) - never the Morning gold or Anytime mint treatment.
        // "Your Momentum" foundation, Phase 3, retuned by the
        // completion-transition-tuning pass — the shared completion-
        // reveal transition. showCompletionPanel (useCompletionHandoff)
        // starts false and flips true exactly once per genuine
        // completion, after its own brief hold+exit-fade of the active
        // view below, so CompletionReveal's auto-freshness detection
        // applies directly - no explicit isFresh needed, matching every
        // other ternary-swap screen. Evening Breathing alone is not one
        // of the three Phase 2 tracked activities (only the full Evening
        // routine is), so there is no factual insight/milestone to show
        // here - this is the shared visual transition only.
        <CompletionReveal
          active={showCompletionPanel}
          journeyTone="evening"
          className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
          stagger={[
            <div key="badge" className="w-20 h-20 rounded-full bg-evening-accent/10 border border-evening-accent-tint/25 shadow-evening-glow flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-evening-accent text-4xl" aria-hidden="true">check_circle</span>
            </div>,
            <div key="greeting" className="space-y-2">
              <span className="font-label-sm text-xs text-evening-accent uppercase tracking-widest font-bold">Breathing Completed</span>
              <h2 className="font-serif italic text-2xl text-on-surface max-w-xs mx-auto" role="status">
                {completionGreeting}
              </h2>
              <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                Carry this calm with you as your evening continues.
              </p>
            </div>
          ]}
        />
      ) : (
        // Completion-transition-tuning pass — the outgoing active view
        // (below) is held at full opacity during the brief hold, then
        // fades over EXIT_FADE_MS (useCompletionHandoff.js) once
        // activeViewExiting is true, rather than being unmounted the
        // instant isCompleted flips true. pointerEvents is set to 'none'
        // from the very instant isCompleted is true (the whole
        // hold+exiting window) - the exercise has already genuinely
        // finished, so its own controls must never remain tappable
        // behind the completion panel.
        <div
          style={isCompleted ? { pointerEvents: 'none', ...(activeViewExiting ? { opacity: 0, transition: 'opacity 350ms ease-out' } : null) } : undefined}
        >
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
            <div className="space-y-2">
              <h1 className="font-serif italic text-2xl text-on-surface">Breathe with the night.</h1>
              <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                Slow, easy breaths. There is nowhere else to be.
              </p>
            </div>

            <BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} journeyTone="evening" reducedMotion={reducedMotion} />
          </div>
        </div>
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
          suspended={hasBegun ? (isCompleted || manuallyPaused || backConfirmOpen) : false}
          hideToggle={!hasBegun || isCompleted}
        />
      )}

      {hasBegun && !isRepeatGated && !isCompleted && manuallyPaused && (
        <ExercisePausedPanel onResume={handleResume} journeyTone="evening" />
      )}

      {/* Evening Breathing completion correction — gated on !isCompleted
          too (pausing a finished exercise is nonsensical). */}
      {hasBegun && !isRepeatGated && !isCompleted && !manuallyPaused && (
        <button
          type="button"
          onClick={handlePauseExercise}
          className="w-full py-4 glass-panel text-on-surface rounded-full font-bold flex items-center justify-center gap-2 border-white/10"
        >
          <span className="material-symbols-outlined text-sm">pause</span>
          <span>Pause Exercise</span>
        </button>
      )}

      {hasBegun && !isRepeatGated && (
        <div className="space-y-3 w-full">
          {/* Duplicate-return-action fix (mirrors Breathe.jsx's identical
              fix) — the ReviewModeBanner's own "Return to X" (top) already
              covers this; nothing replaces this branch while reviewing. */}
          {!isReviewMode && (
            <>
              {isCompleted ? (
                // Evening Breathing completion correction — the required
                // primary action, gated purely on the new explicit
                // isCompleted state. Tapping it is the one place
                // completion is ever mirrored into the Session Engine
                // (handleComplete, unchanged) - exactly once, guarded by
                // hasMirroredExitRef.
                <button
                  onClick={handleComplete}
                  className={`w-full ${getJourneyPrimaryActionClasses('evening')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg`}
                >
                  <span>Continue to Meditate</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              ) : (
                <button
                  onClick={handleSkip}
                  className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/40"
                >
                  Skip
                </button>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={isConfirming}
        title="Review an earlier step?"
        message="Your current exercise will be paused."
        confirmLabel="Review Step"
        cancelLabel="Cancel"
        onConfirm={confirmLeave}
        onDismiss={cancelLeave}
      />
      {/* Evening Breathing Back/early-exit correction — mild warning
          (temporary, resumable progress lost; no saved history erased),
          matching Breathe.jsx's own identical severity/hierarchy for the
          same class of action. Keep Breathing dismisses with zero state
          change (nothing was ever reset); Leave Exercise is the one
          confirmed early-exit path (leaveExercise, above). */}
      <ConfirmDialog
        open={backConfirmOpen}
        title="Leave this breathing exercise?"
        message="Your progress in this exercise won’t be completed."
        confirmLabel="Leave Exercise"
        cancelLabel="Keep Breathing"
        mildDestructive
        onConfirm={leaveExercise}
        onDismiss={keepBreathing}
      />
    </EveningSceneShell>
  );
};

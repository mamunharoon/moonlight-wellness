/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { BackButton } from '../components/BackButton';
import { ReviewModeBanner } from '../components/ReviewModeBanner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { useActiveRoutineStep } from '../hooks/useActiveRoutineStep';
import { getStepLabel } from '../lib/stepLabels';
import { useMeditationSession } from '../hooks/useMeditationSession';
import { MeditationSetupPanel } from '../components/journey/MeditationSetupPanel';
import { MeditationActiveSession } from '../components/journey/MeditationActiveSession';
import { MEDITATION_CONTEXTS, getRecommendedDurationId } from '../lib/meditationDurations';

/*
 * WakeWise — Journey Embedding (Self-Guided Meditation) — Morning embedded
 * step, inserted immediately after Breathe (Intend -> Stretch -> Breathe ->
 * Meditate (optional) -> Affirm -> Complete).
 *
 * Reuses useMeditationSession.js/MeditationSetupPanel.jsx/
 * MeditationActiveSession.jsx verbatim - the exact same real timer/
 * controller/audio behaviour the standalone /self-guided-meditation page
 * uses, never a second implementation. Recommended defaults: Mindful
 * Pause, 2 minutes (its own "Recommended" badge via
 * MEDITATION_CONTEXTS.MORNING_EMBEDDED - the shared registry's own
 * `recommended` flag, which still marks 5min for standalone, is never
 * mutated), Gentle Ambient (IM01) - matching meditationSounds.js's own
 * existing style-aware suggestion for 'mindful-pause', so no override is
 * needed for the sound to land correctly.
 *
 * Session-local, independent of Evening's own embedded selections and of
 * standalone meditation - this page's own useMeditationSession() call is
 * a completely separate hook instance/closure.
 *
 * Skip, "Finish & continue", and natural completion all continue to
 * Affirmation via the exact same setJourneyStep+navigate+mirror-to-
 * Session-Engine pattern Breathe.jsx already established for its own
 * transitions (see mirrorMeditateExitRef below) - never a duplicated/
 * divergent mechanism. None of them navigate to
 * /self-guided-meditation-complete.
 *
 * Morning journey UX correction — the active screen's header Back arrow
 * and its bottom action now mean two genuinely different things (found
 * live: they previously both opened the exact same "End this meditation?"
 * dialog and both always landed back on Meditation setup, leaving no way
 * to finish early and actually move on - the only forward action from
 * setup was the since-misleading "Skip meditation," even after a real
 * attempt at Meditation):
 *   - Back (and, unchanged, MeditationActiveSession's own local dialog):
 *     "End this meditation?" - stops the timer/audio and returns to THIS
 *     step's own pre-start screen. The parent Morning session stays
 *     exactly where it was (no advanceStep, no interruptSession, no
 *     navigate) - the user hasn't left the journey, only paused this
 *     optional sub-activity. The pre-start screen then shows "Continue to
 *     Affirmation" instead of "Skip meditation" (`hasStartedThisVisit`),
 *     since skip is misleading once the user has already engaged.
 *   - The bottom action is now `bottomAction` ("Finish & continue" / "Finish
 *     meditation?"): a deliberate, distinct early finish that stops the
 *     timer/audio (handleFinishAndContinue -> session.endSession()) and
 *     advances straight to Affirmation via the same guarded handleComplete()
 *     every other completion path uses - never returns to setup.
 *

 * Whole-journey exit while meditation is ACTIVE (correction, found live):
 * an earlier revision wired the active screen's Close/X to the SAME local
 * "End this meditation?" dialog as Back, leaving no way to exit the whole
 * Morning routine while meditation was running. Fixed via
 * MeditationActiveSession's own `onRequestClose` prop
 * (handleRequestExitRoutine below) - Close/X now opens THIS page's own
 * separate "Leave this routine?" dialog (same copy/severity BackButton.jsx
 * uses everywhere else in Morning), and confirming calls the real shared
 * leaveActiveRoutine() (useActiveRoutineStep.js - interruptSession(), the
 * SAME resumable mechanism BackButton's own guard uses, never
 * abandonSession()) before navigating Home. Because stepIndex is never
 * advanced by this path, Home's own Continue card resumes exactly back to
 * this step's own pre-start screen - never a fake "still running" state
 * (no elapsed-seconds persistence exists for this or any other timed
 * Morning step).
 *
 * The PRE-START screen's header Back returns to Breathe (guardActiveRoute
 * is off - see Back-navigation repair, Morning canonical map: the
 * whole-routine "Leave this routine?" confirmation belongs only to
 * Intention, the first step, and to this screen's own active-phase
 * Close/X above), plus the same plain, unconfirmed "Exit routine" link
 * every other Morning step already has.
 */
export const MorningMeditate = () => {
  const navigate = useNavigate();
  const { setJourneyStep } = useAlarm();
  const { state, currentStep, advanceStep, abandonSession } = useSession();
  const { isReviewMode, isLiveStep } = useStepReviewMode('meditate', 'morning-routine');
  // Whole-journey exit while meditation is active - see this file's own
  // top-of-file doc comment. The same shared mechanism BackButton.jsx's
  // own "Leave this routine?" guard uses everywhere else in Morning.
  const { leaveActiveRoutine } = useActiveRoutineStep();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  const hasMirroredExitRef = useRef(false);
  const mirrorMeditateExitRef = useRef(() => {});
  // Morning journey UX correction — distinguishes "never started Meditation
  // this visit" (setup shows "Skip meditation") from "started, then backed
  // out to setup via Back -> End Meditation" (setup shows "Continue to
  // Affirmation" instead - "skip" is misleading once the user has already
  // engaged with the activity). Session-local only (component state, not
  // persisted anywhere) - resets naturally on a fresh mount of this route,
  // exactly matching "the current visit" as the state model requires. Real
  // React state, not a ref: this value is read during render (the setup
  // panel's skipLabel below), and refs must never be read during render
  // (react-hooks/refs - found by lint, not just a style preference: a ref
  // read during render can silently miss a re-render entirely).
  const [hasStartedThisVisit, setHasStartedThisVisit] = useState(false);

  const handleComplete = () => {
    mirrorMeditateExitRef.current();
    setJourneyStep('affirmation');
    navigate('/affirmation');
  };

  const session = useMeditationSession({
    initialStyleId: 'mindful-pause',
    initialDurationId: '2min',
    initialSoundId: 'IM01',
    onComplete: handleComplete
  });

  const handleBegin = () => {
    setHasStartedThisVisit(true);
    session.begin();
  };

  // "Finish & continue" (active-screen bottom action, Morning journey UX
  // correction) — a deliberate EARLY finish, genuinely distinct from
  // natural completion: stops the timer/audio first (session.endSession(),
  // the exact same cleanup Back -> End Meditation already uses), then
  // reuses handleComplete() verbatim, so it goes through the identical
  // mirror-to-Session-Engine-exactly-once guard (hasMirroredExitRef) and
  // navigation as natural completion and Skip - never a second, divergent
  // advance-to-Affirmation path. Never claims the full selected duration
  // elapsed (no completion summary is fabricated); the Morning progress
  // checkmark for Meditate means "consciously moved past," not "every
  // selected minute ran."
  const handleFinishAndContinue = () => {
    session.endSession();
    handleComplete();
  };

  useEffect(() => {
    mirrorMeditateExitRef.current = () => {
      if (hasMirroredExitRef.current) return;
      hasMirroredExitRef.current = true;
      if (state.status === 'playing' && currentStep?.id === 'meditate') {
        advanceStep();
      }
    };
  }, [state.status, currentStep, advanceStep]);

  const { requestReview, confirmLeave, cancelLeave, isConfirming, routeForStep } = useReviewNavigation({
    sessionId: 'morning-routine',
    isLiveStep,
    hasUnsavedProgress: session.phase === 'active'
  });

  const handleSkip = () => handleComplete();

  const handleExitRoutine = () => {
    setJourneyStep('');
    navigate('/');
    if (state.status === 'playing' && currentStep?.id === 'meditate') abandonSession();
  };

  // Active-screen Close/X - genuinely distinct from End Meditation (see
  // this file's own doc comment). Opens this page's own dialog rather
  // than MeditationActiveSession's local one.
  const handleRequestExitRoutine = () => setExitConfirmOpen(true);
  const handleConfirmExitRoutine = () => {
    setExitConfirmOpen(false);
    leaveActiveRoutine();
    navigate('/');
  };

  if (session.phase === 'active' && session.snapshot) {
    return (
      <>
        <MeditationActiveSession
          style={session.style}
          snapshot={session.snapshot}
          soundId={session.soundId}
          soundUnavailable={session.soundUnavailable}
          onSelectSound={session.selectSound}
          onPause={session.pause}
          onResume={session.resume}
          onRequestLeave={session.endSession}
          onRequestClose={handleRequestExitRoutine}
          endCopy={{
            buttonLabel: 'End Meditation',
            buttonAriaLabel: 'End meditation',
            dialogTitle: 'End this meditation?',
            dialogMessage: 'Your current meditation will end. Your Morning routine stays right where it is.',
            confirmLabel: 'End Meditation',
            cancelLabel: 'Keep Meditating'
          }}
          bottomAction={{
            buttonLabel: 'Finish & continue',
            buttonAriaLabel: 'Finish meditation and continue to Affirmation',
            dialogTitle: 'Finish meditation?',
            dialogMessage: 'Your meditation will end and your Morning routine will continue to Affirmation.',
            confirmLabel: 'Finish & continue',
            cancelLabel: 'Keep meditating',
            onConfirm: handleFinishAndContinue
          }}
        />
        {/* Same copy/severity as BackButton.jsx's own default "Leave this
            routine?" guard - the canonical whole-Morning-routine exit
            confirmation, reused verbatim rather than inventing new wording
            for this one screen. */}
        <ConfirmDialog
          open={exitConfirmOpen}
          title="Leave this routine?"
          message="Your current progress may be paused."
          confirmLabel="Leave routine"
          cancelLabel="Stay"
          destructive
          onConfirm={handleConfirmExitRoutine}
          onDismiss={() => setExitConfirmOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-xl mx-auto space-y-10">
      <div className="flex items-center gap-3">
        {/* Back-navigation repair (Morning canonical map) — Meditation
            setup Back returns to Breathe; the whole-routine "Leave this
            routine?" confirmation belongs only to Intention (the first
            step) and to this screen's own active-phase Close/X control
            above (handleRequestExitRoutine), never here. */}
        <BackButton fallback="/breathe" guardActiveRoute={false} />
      </div>
      <ProgressIndicator activeStep="meditate" onReviewStep={requestReview} />

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      <MeditationSetupPanel
        compact
        purpose="A short pause to settle your mind before your affirmation."
        recommendedDurationId={getRecommendedDurationId(MEDITATION_CONTEXTS.MORNING_EMBEDDED)}
        beginLabel="Begin 2-Minute Meditation"
        style={session.style}
        duration={session.duration}
        soundId={session.soundId}
        onSelectStyle={session.selectStyle}
        onSelectDuration={session.setDurationId}
        onSelectSound={session.selectSound}
        onBegin={handleBegin}
        // Morning journey UX correction: no forward-skip action at all
        // while reviewing an already-completed Meditation from Affirmation
        // - the ReviewModeBanner's own "Return to Affirmation" already
        // covers that. Outside review mode, the label reflects whether the
        // user has actually engaged with Meditation this visit yet.
        onSkip={isReviewMode ? undefined : handleSkip}
        skipLabel={hasStartedThisVisit ? 'Continue to Affirmation' : 'Skip meditation'}
      />

      <button
        type="button"
        onClick={handleExitRoutine}
        className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors py-2"
      >
        Exit routine
      </button>

      <ConfirmDialog
        open={isConfirming}
        title="Leave this meditation?"
        message="Your meditation in progress will end if you review an earlier step."
        confirmLabel="Leave Meditation"
        cancelLabel="Stay"
        mildDestructive
        onConfirm={confirmLeave}
        onDismiss={cancelLeave}
      />
    </div>
  );
};

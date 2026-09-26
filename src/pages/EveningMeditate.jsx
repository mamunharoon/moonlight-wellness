/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { ReviewModeBanner } from '../components/ReviewModeBanner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { getStepLabel } from '../lib/stepLabels';
import { useMeditationSession } from '../hooks/useMeditationSession';
import { usePreparationCountdown } from '../hooks/usePreparationCountdown';
import { PreparationCountdown } from '../components/PreparationCountdown';
import { MeditationSetupPanel } from '../components/journey/MeditationSetupPanel';
import { MeditationActiveSession } from '../components/journey/MeditationActiveSession';
import { getRecommendedDurationId } from '../lib/meditationDurations';

/*
 * WakeWise — Journey Embedding (Self-Guided Meditation) — Evening embedded
 * step, inserted immediately after Breathing (Wind Down -> Reflection ->
 * Gratitude -> Breathe -> Meditate (optional) -> Prepare for Rest ->
 * Complete).
 *
 * Reuses useMeditationSession.js/MeditationSetupPanel.jsx/
 * MeditationActiveSession.jsx verbatim, exactly like MorningMeditate.jsx -
 * never a second implementation. Recommended defaults: Quiet Meditation,
 * 5 minutes (the shared registry's own existing default/`recommended`
 * flag - getRecommendedDurationId() with no context argument, since 5min
 * remains recommended for Evening exactly as it already is for standalone),
 * Soft Piano (IM02) - matching meditationSounds.js's own existing
 * style-aware suggestion for 'quiet'.
 *
 * Session-local, independent of Morning's own embedded selections and of
 * standalone meditation.
 *
 * Skip, "Finish & continue", and natural completion all continue to
 * Prepare for Rest via the exact same advanceStep+navigate+mirror pattern
 * EveningBreathing.jsx already established (see mirrorMeditateExitRef
 * below). None of them navigate to /self-guided-meditation-complete.
 *
 * Evening journey UX correction (mirrors MorningMeditate.jsx's identical
 * fix) — Back and the bottom action now mean two different things: Back
 * (and MeditationActiveSession's own local "End this meditation?" dialog)
 * stops the timer/audio and returns to THIS step's own pre-start screen -
 * the parent Evening session stays exactly where it was (no advanceStep,
 * no interruptSession, no navigate) - and that pre-start screen then shows
 * "Continue to Prepare for Rest" instead of "Skip meditation"
 * (`hasStartedThisVisit`), since skip is misleading once the user has
 * already engaged. The bottom action is now `bottomAction` ("Finish &
 * continue" / "Finish meditation?"): a deliberate, distinct early finish
 * that stops the timer/audio and advances straight to Prepare for Rest via
 * the same guarded handleComplete() every other completion path uses -
 * never returns to setup.
 *
 * Back/Exit reuse Evening's own existing, unmodified split convention
 * exactly as EveningBreathing.jsx/PrepareForRest.jsx already establish it
 * (EveningSceneShell's showBack={no confirmation, plain navigate} +
 * showExit={ExitEveningButton, the one whole-journey exit control, its own
 * approved dialog unchanged}) - no meditation-only exception.
 */
export const EveningMeditate = () => {
  const navigate = useNavigate();
  const { state, currentStep, advanceStep } = useSession();
  const { isReviewMode, isLiveStep } = useStepReviewMode('meditation', 'evening-wind-down');

  const hasMirroredExitRef = useRef(false);
  const mirrorMeditateExitRef = useRef(() => {});
  // Evening journey UX correction (mirrors MorningMeditate.jsx's identical
  // fix) — session-local only, resets naturally on a fresh mount of this
  // route. Real React state, not a ref: this value is read during render
  // (the setup panel's skipLabel below), and refs must never be read
  // during render (react-hooks/refs).
  const [hasStartedThisVisit, setHasStartedThisVisit] = useState(false);

  const handleComplete = () => {
    mirrorMeditateExitRef.current();
    navigate('/prepare-for-rest');
  };

  const session = useMeditationSession({
    initialStyleId: 'quiet',
    initialDurationId: '5min',
    initialSoundId: 'IM02',
    onComplete: handleComplete
  });

  // Build 16 physical-iPhone correction (F3/F4) - see MorningMeditate.jsx's
  // identical block for the full rationale.
  const countdown = usePreparationCountdown({
    seconds: 5,
    onComplete: () => session.begin()
  });

  const handleBegin = () => {
    setHasStartedThisVisit(true);
    session.preload();
    countdown.start();
  };

  // "Finish & continue" (mirrors MorningMeditate.jsx's identical fix) — a
  // deliberate early finish: stops the timer/audio first, then reuses
  // handleComplete() verbatim so it goes through the same guarded
  // mirror-to-Session-Engine-exactly-once path as natural completion and
  // Skip.
  const handleFinishAndContinue = () => {
    session.endSession();
    handleComplete();
  };

  // "Choose another meditation" (mirrors MorningMeditate.jsx's identical
  // fix) — ends the current session (same cleanup as Back/Finish &
  // continue, never claims completion, never advances the journey, never
  // navigates Home/standalone/a later step) and reopens this same step's
  // own setup panel already expanded to the full style/duration/sound
  // picker.
  const [chooseAnotherExpanded, setChooseAnotherExpanded] = useState(false);
  const handleChooseAnother = () => {
    session.endSession();
    setChooseAnotherExpanded(true);
  };

  useEffect(() => {
    mirrorMeditateExitRef.current = () => {
      if (hasMirroredExitRef.current) return;
      hasMirroredExitRef.current = true;
      if (state.status === 'playing' && currentStep?.id === 'meditation') {
        advanceStep();
      }
    };
  }, [state.status, currentStep, advanceStep]);

  const { requestReview, confirmLeave, cancelLeave, isConfirming, routeForStep } = useReviewNavigation({
    sessionId: 'evening-wind-down',
    isLiveStep,
    hasUnsavedProgress: session.phase === 'active'
  });

  const handleSkip = () => handleComplete();

  if (countdown.isActive) {
    return (
      <EveningSceneShell
        atmosphere={{ phase: 'moonlight' }}
        showBack
        backFallback="/evening-breathing"
        onBeforeLeave={() => {
          countdown.cancel();
          session.cancelPreload();
          return false;
        }}
        showExit
      >
        <PreparationCountdown
          secondsRemaining={countdown.secondsRemaining}
          cue="Find a comfortable position and let your shoulders soften."
          onSkip={countdown.skip}
          accent="evening"
        />
      </EveningSceneShell>
    );
  }

  if (session.phase === 'active' && session.snapshot) {
    // Structural fix (corrected) - two genuinely distinct controls, no
    // overlap: EveningSceneShell's own showExit (ExitEveningButton) stays
    // visible at top-right, exactly like every other active Evening
    // screen - it interrupts the whole Evening Wind-Down journey via its
    // own unmodified "Leave Evening Wind-Down?" dialog and
    // leaveActiveRoutine(). MeditationActiveSession's own header Close is
    // suppressed (showHeaderClose={false}) so it never renders a SECOND
    // control at that same corner - its Back arrow (top-left) and the big
    // "End Meditation" button below both still render, both still only
    // ever call onRequestLeave (session.endSession - never
    // leaveActiveRoutine), so ending meditation can never be confused
    // with, or accidentally trigger, leaving the whole journey.
    return (
      <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showExit>
        <MeditationActiveSession
          journeyTone="evening"
          style={session.style}
          snapshot={session.snapshot}
          soundId={session.soundId}
          soundUnavailable={session.soundUnavailable}
          onSelectSound={session.selectSound}
          onPause={session.pause}
          onResume={session.resume}
          onRequestLeave={session.endSession}
          showHeaderClose={false}
          endCopy={{
            buttonLabel: 'End Meditation',
            buttonAriaLabel: 'End meditation',
            dialogTitle: 'End this meditation?',
            dialogMessage: 'Your current meditation will end. Your Evening Wind-Down stays right where it is.',
            confirmLabel: 'End Meditation',
            cancelLabel: 'Keep Meditating'
          }}
          bottomAction={{
            buttonLabel: 'Finish & continue',
            buttonAriaLabel: 'Finish meditation and continue to Prepare for Rest',
            dialogTitle: 'Finish meditation?',
            dialogMessage: 'Your meditation will end and your Evening Wind-Down will continue to Prepare for Rest.',
            confirmLabel: 'Finish & continue',
            cancelLabel: 'Keep meditating',
            onConfirm: handleFinishAndContinue
          }}
          onChooseAnother={handleChooseAnother}
        />
      </EveningSceneShell>
    );
  }

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/evening-breathing" showExit>
      {/* Build 16 physical-iPhone correction (F9) — see Gratitude.jsx's
          identical fix for the full rationale (ProgressIndicator's own
          mobile compact block already shows "Step 5 of 7"). The former
          per-screen span this comment used to describe is removed here
          along with every other step page's own copy of it, except
          EveningWindDown.jsx/EveningComplete.jsx, which render no
          ProgressIndicator at all and so are not duplicates. */}
      <ProgressIndicator activeStep="meditation" sessionId="evening-wind-down" onReviewStep={requestReview} />

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      <MeditationSetupPanel
        compact
        journeyTone="evening"
        purpose="A quiet pause to settle your mind before you rest."
        recommendedDurationId={getRecommendedDurationId()}
        // Defect fix — beginLabel omitted entirely: it previously
        // hardcoded "Begin 5-Minute Meditation" regardless of the
        // actually-selected duration, going stale the moment the user
        // picked 2/10 minutes in "Choose style, time & sound". Omitting
        // it lets MeditationSetupPanel.jsx compute the live label from
        // `duration` (below) instead - see that file's own doc comment.
        style={session.style}
        duration={session.duration}
        soundId={session.soundId}
        onSelectStyle={session.selectStyle}
        onSelectDuration={session.setDurationId}
        onSelectSound={session.selectSound}
        onBegin={handleBegin}
        // Evening journey UX correction (mirrors MorningMeditate.jsx): no
        // forward-skip action while reviewing an already-completed
        // Meditation from a later Evening step - the ReviewModeBanner's own
        // "Return to [current step]" already covers that.
        onSkip={isReviewMode ? undefined : handleSkip}
        skipLabel={hasStartedThisVisit ? 'Continue to Prepare for Rest' : 'Skip meditation'}
        defaultExpanded={chooseAnotherExpanded}
        onExpandedConsumed={() => setChooseAnotherExpanded(false)}
      />

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
    </EveningSceneShell>
  );
};

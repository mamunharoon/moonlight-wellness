/* eslint-disable no-unused-vars */
import { useEffect, useRef } from 'react';
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
 * Skip and natural completion both continue to Prepare for Rest via the
 * exact same advanceStep+navigate+mirror pattern EveningBreathing.jsx
 * already established (see mirrorMeditateExitRef below). Completion NEVER
 * navigates to /self-guided-meditation-complete.
 *
 * End Meditation (active screen) stops the timer/audio and returns to
 * THIS step's own pre-start screen - the parent Evening session stays
 * exactly where it was (no advanceStep, no interruptSession, no navigate).
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
        />
      </EveningSceneShell>
    );
  }

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/evening-breathing" showExit>
      <ProgressIndicator activeStep="meditation" sessionId="evening-wind-down" onReviewStep={requestReview} />
      {/* Journey Embedding — matching every other Evening step's own
          per-screen "Step X of 7" label exactly (EveningWindDown.jsx/
          Reflection.jsx/Gratitude.jsx/EveningBreathing.jsx/
          PrepareForRest.jsx/EveningComplete.jsx all show one). */}
      <span className="block text-center text-[10px] text-primary uppercase font-bold tracking-wider">Step 5 of 7</span>

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      <MeditationSetupPanel
        compact
        purpose="A quiet pause to settle your mind before you rest."
        recommendedDurationId={getRecommendedDurationId()}
        beginLabel="Begin 5-Minute Meditation"
        style={session.style}
        duration={session.duration}
        soundId={session.soundId}
        onSelectStyle={session.selectStyle}
        onSelectDuration={session.setDurationId}
        onSelectSound={session.selectSound}
        onBegin={session.begin}
        onSkip={handleSkip}
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

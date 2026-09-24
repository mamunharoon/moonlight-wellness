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
 * Skip and natural completion both continue to Affirmation via the exact
 * same setJourneyStep+navigate+mirror-to-Session-Engine pattern Breathe.jsx
 * already established for its own transitions (see mirrorMeditateExitRef
 * below) - never a duplicated/divergent mechanism. Completion NEVER
 * navigates to /self-guided-meditation-complete.
 *
 * End Meditation (active screen: both the Back arrow and the big "End
 * Meditation" button) stops the timer/audio and returns to THIS step's
 * own pre-start screen - the parent Morning session stays exactly where
 * it was (no advanceStep, no interruptSession, no navigate) - the user
 * hasn't left the journey, only abandoned this optional sub-activity.
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
 * Whole-journey exit from the PRE-START screen reuses Morning's own
 * existing, unmodified conventions exactly as Affirmation.jsx/Breathe.jsx
 * already establish them - no meditation-only exception: BackButton
 * (guarded, shows "Leave this routine?" when this is the live step) for
 * the header Back, plus the same plain, unconfirmed "Exit routine" link
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
        <BackButton fallback="/breathe" />
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
        onBegin={session.begin}
        onSkip={handleSkip}
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

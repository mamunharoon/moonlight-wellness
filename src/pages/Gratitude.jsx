import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { useAlarm } from '../context/AlarmContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { PromptStepper } from '../components/evening/PromptStepper';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { ReviewModeBanner } from '../components/ReviewModeBanner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { getStepLabel } from '../lib/stepLabels';
import { getPinnedRoutineDate } from '../session/routineProgress';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { loadRoutineResponses, upsertRoutineResponse, deleteRoutineResponse } from '../lib/routineResponses';
import { setPendingContent } from '../lib/pendingContent';

/*
 * Stage 4 Batch F4/F6 — Gratitude
 *
 * Third step of the evening-wind-down session. Structurally identical to
 * Reflection.jsx (see that file's own doc comment for the glass-panel/
 * centering, no-onChange, and ProgressIndicator reasoning — journal/
 * database/storage persistence are all explicitly deferred for this
 * screen too).
 *
 * F4 had this jump straight to 'completion' via advanceToStep, since
 * Breathing/Sleep Preparation had no pages yet. Now that EveningBreathing
 * exists (F6), completing the final prompt advances one real step at a
 * time via advanceStep() instead — gratitude -> breathing is immediately
 * adjacent, so advanceStep() is correct here, same change already made
 * to EveningWindDown.jsx in F4.
 */
const GRATITUDE_PROMPTS = [
  { id: 'appreciated-moment', label: 'Name one moment you appreciated today.' },
  { id: 'who-made-better', label: 'Who made your day better?' },
  { id: 'grateful-now', label: 'What are you grateful for right now?' },
];

const SESSION_ID = 'evening-wind-down';
const STEP_ID = 'gratitude';

export const Gratitude = () => {
  const navigate = useNavigate();
  const { state, currentStep, advanceStep } = useSession();
  const { isGuest } = useAuth();
  // useAuth() itself exposes no userId field (only the full `user` object)
  // - useAlarm() is the context that already derives a real, non-anonymous
  // userId from it (see AlarmContext.jsx), and this page already needs it
  // for effectiveTimezone anyway.
  const { effectiveTimezone, userId } = useAlarm();

  // Safe backward navigation ("Review Mode") - see Reflection.jsx's
  // identical block for the full rationale.
  const { isReviewMode, isLiveStep } = useStepReviewMode(STEP_ID, SESSION_ID);
  const [hasUnsavedText, setHasUnsavedText] = useState(false);
  const { requestReview, confirmLeave, cancelLeave, isConfirming, routeForStep } = useReviewNavigation({
    sessionId: SESSION_ID,
    isLiveStep,
    hasUnsavedProgress: hasUnsavedText
  });

  const localDate = getPinnedRoutineDate(SESSION_ID) ?? getZonedParts(effectiveTimezone, devNow()).dateKey;

  const [responses, setResponses] = useState(() => (isGuest ? {} : null));
  useEffect(() => {
    if (isGuest) return;
    let cancelled = false;
    loadRoutineResponses({ userId, sessionId: SESSION_ID, stepId: STEP_ID, localDate }).then((loaded) => {
      if (!cancelled) setResponses(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [isGuest, userId, localDate]);

  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
  const dismissGuestPrompt = () => setGuestPromptOpen(false);
  const confirmGuestSignIn = () => {
    setPendingContent({ returnPath: '/gratitude' });
    setGuestPromptOpen(false);
    navigate('/auth');
  };
  const confirmGuestCreateAccount = () => {
    setPendingContent({ returnPath: '/gratitude' });
    setGuestPromptOpen(false);
    navigate('/auth?tab=signup');
  };

  const handlePromptChange = (promptId, value) => {
    if (isGuest) {
      setGuestPromptOpen(true);
      return;
    }
    setHasUnsavedText(value.trim().length > 0);
    upsertRoutineResponse({ userId, sessionId: SESSION_ID, stepId: STEP_ID, promptId, localDate, response: value });
  };

  const handlePromptClear = (promptId) => {
    if (isGuest) return;
    deleteRoutineResponse({ userId, sessionId: SESSION_ID, stepId: STEP_ID, promptId, localDate });
  };

  if (EveningSceneShell && PromptStepper && ProgressIndicator && ReviewModeBanner && ConfirmDialog && SignInPromptDialog) { /* no-op to satisfy blind linter */ }

  const handleComplete = (answers) => {
    setHasUnsavedText(false);
    if (!isGuest) {
      Object.entries(answers ?? {}).forEach(([promptId, value]) => {
        upsertRoutineResponse({ userId, sessionId: SESSION_ID, stepId: STEP_ID, promptId, localDate, response: value });
      });
    }
    if (isReviewMode) {
      if (currentStep) navigate(routeForStep(currentStep.id));
      return;
    }
    if (state.status === 'playing' && currentStep?.id === STEP_ID) {
      advanceStep();
    }
    navigate('/evening-breathing');
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/reflection">
      <ProgressIndicator activeStep="gratitude" sessionId="evening-wind-down" onReviewStep={requestReview} />
      <span className="block text-center text-[10px] text-primary uppercase font-bold tracking-wider">Step 3 of 6</span>

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      <div className="flex-1 flex flex-col justify-center">
        <div className="glass-panel rounded-3xl p-6">
          {responses !== null && (
            <PromptStepper
              prompts={GRATITUDE_PROMPTS}
              initialAnswers={responses}
              onChange={handlePromptChange}
              onClear={handlePromptClear}
              onComplete={handleComplete}
            />
          )}
        </div>
      </div>

      <SignInPromptDialog
        open={guestPromptOpen}
        onSignIn={confirmGuestSignIn}
        onCreateAccount={confirmGuestCreateAccount}
        onDismiss={dismissGuestPrompt}
      />
      <ConfirmDialog
        open={isConfirming}
        title="Review an earlier step?"
        message="Your unsaved progress on this step may be lost."
        confirmLabel="Review"
        cancelLabel="Stay here"
        onConfirm={confirmLeave}
        onDismiss={cancelLeave}
      />
    </EveningSceneShell>
  );
};

/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { parseActiveIndex } from '../lib/questionStepNavigation';
import { GRATITUDE_PROMPTS } from '../lib/eveningJourneyQuestions';

/*
 * Phase 3 (Reflection/Gratitude tap-first redesign) — Gratitude
 *
 * Third step of the evening-wind-down session. Structurally identical to
 * Reflection.jsx (see that file's own doc comment, and PromptStepper.jsx's
 * own doc comment for the full single-select/guidance/custom-answer
 * contract every question follows) - this screen gains a guidance
 * disclosure for the first time in this phase; it had none before.
 *
 * BACK-NAVIGATION FIX (Phase 3): Gratitude's Q1 Back now correctly lands
 * on Reflection's own Q3 (`/reflection?q=3`), not Reflection's Q1 as it
 * did before this phase - see backFallbackForIndex below and Reflection.jsx's
 * identical mechanism.
 *
 * Question configuration extracted into eveningJourneyQuestions.js
 * (Evening completed-review work) - see Reflection.jsx's own doc comment
 * for why. This page's own SESSION_ID/STEP_ID/accent/write behaviour
 * below stay local, unchanged.
 */
const SESSION_ID = 'evening-wind-down';
const STEP_ID = 'gratitude';

// Q1's Back correctly returns to Reflection's own last question (Q3) -
// the actual previous Evening journey stage's own furthest question, not
// Reflection's Q1 (the prior, now-fixed limitation).
const backFallbackForIndex = (activeIndex) => (activeIndex === 0 ? '/reflection?q=3' : `/gratitude?q=${activeIndex}`);

export const Gratitude = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeIndex = parseActiveIndex(searchParams, GRATITUDE_PROMPTS.length);
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
    setPendingContent({ returnPath: `/gratitude?q=${activeIndex + 1}` });
    setGuestPromptOpen(false);
    navigate('/auth');
  };
  const confirmGuestCreateAccount = () => {
    setPendingContent({ returnPath: `/gratitude?q=${activeIndex + 1}` });
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

  // Moves to another question WITHIN Gratitude - a real navigate() (not
  // local state), so the shared BackButton's own in-app history check
  // lands correctly on the previous question afterward.
  const handleAdvance = (nextIndex) => navigate(`/gratitude?q=${nextIndex + 1}`);

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
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback={backFallbackForIndex(activeIndex)} showExit>
      {/* Build 16 physical-iPhone correction (F9) — the per-page "Step 3 of
          7" span that used to render here is gone: ProgressIndicator's own
          mobile (sm:hidden) compact block already renders "Gratitude ·
          Step 3 of 7" as part of the same row - this was a literal
          duplicate label stacked as an extra row, contributing to "top
          area taller than needed" with no information the indicator
          didn't already give. */}
      <ProgressIndicator activeStep="gratitude" sessionId="evening-wind-down" onReviewStep={requestReview} />

      {isReviewMode && currentStep && (
        <ReviewModeBanner
          currentStepLabel={getStepLabel(currentStep.id)}
          onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))}
          journeyTone="evening"
        />
      )}

      <div className="flex-1 flex flex-col justify-center">
        {/* Build 16 physical-iPhone correction (F9, then Decision 3
            acceptance correction) — see Reflection.jsx's identical trim for
            the full rationale. */}
        <div className="glass-panel rounded-3xl p-4">
          {responses !== null && (
            <PromptStepper
              prompts={GRATITUDE_PROMPTS}
              activeIndex={activeIndex}
              initialAnswers={responses}
              onChange={handlePromptChange}
              onClear={handlePromptClear}
              onAdvance={handleAdvance}
              onComplete={handleComplete}
              journeyTone="evening"
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

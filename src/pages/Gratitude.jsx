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
 */
const GRATITUDE_PROMPTS = [
  {
    id: 'appreciated-moment',
    label: 'Name one moment you appreciated today.',
    options: [
      'Morning stillness',
      'A comforting meal',
      'Kindness from someone',
      'A song that lifted me',
      'Feeling at home',
      'A moment of relief',
      'Fresh air or movement',
      'A quiet pause'
    ],
    guidance: [
      { id: 'E23', blurb: 'A guided video for a quiet moment of gratitude.' },
      { id: 'M04', blurb: 'A guided meditation for gratitude.' }
    ]
  },
  {
    id: 'who-made-better',
    label: 'Who made your day better?',
    options: [
      'Partner or family',
      'Friend',
      'Colleague',
      'Someone who helped',
      'Someone who listened',
      'A kind stranger',
      'My community',
      'I supported myself'
    ],
    guidance: [
      { id: 'M03', blurb: 'A guided loving kindness meditation.' }
    ]
  },
  {
    id: 'grateful-now',
    label: 'What are you grateful for right now?',
    options: [
      'This quiet moment',
      'Someone who cares about me',
      'A place where I feel safe',
      'Something that made me smile',
      'A small comfort',
      'A fresh start tomorrow',
      'My own effort today',
      'Simply being here'
    ],
    guidance: [
      { id: 'A05', blurb: 'A guided affirmation video for a grateful moment.' }
    ]
  }
];

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
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback={backFallbackForIndex(activeIndex)}>
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
              activeIndex={activeIndex}
              initialAnswers={responses}
              onChange={handlePromptChange}
              onClear={handlePromptClear}
              onAdvance={handleAdvance}
              onComplete={handleComplete}
              accent="gratitude"
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

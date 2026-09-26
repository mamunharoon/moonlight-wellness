/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { useAlarm } from '../context/AlarmContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { PromptStepper } from '../components/evening/PromptStepper';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { ReviewModeBanner } from '../components/ReviewModeBanner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { getStepLabel } from '../lib/stepLabels';
import { getPinnedRoutineDate } from '../session/routineProgress';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { loadRoutineResponses, upsertRoutineResponse, deleteRoutineResponse } from '../lib/routineResponses';
import { setPendingContent } from '../lib/pendingContent';
import { parseActiveIndex } from '../lib/questionStepNavigation';
import { REFLECTION_PROMPTS } from '../lib/eveningJourneyQuestions';

/*
 * Phase 3 (Reflection/Gratitude tap-first redesign) — Reflection
 *
 * Second step of the evening-wind-down session. Tap-first preset choices
 * per question (never a large required-looking text area up front) - see
 * PromptStepper.jsx's own doc comment for the full single-select/
 * guidance/custom-answer contract every question here follows.
 *
 * Question-specific preset options and guidance items were reported to
 * and approved by the product owner before implementation - see the
 * Phase 3 pre-implementation report for the full rationale behind each
 * choice (why these particular catalogue ids, why Q1 uses full-width
 * rows instead of a 2-column grid, etc.). Extracted into
 * eveningJourneyQuestions.js (Evening completed-review work) so this
 * page and ReflectionReview.jsx can never drift apart on wording/
 * options/guidance - this page's own SESSION_ID/STEP_ID/accent/write
 * behaviour below are page-specific wiring, not question configuration,
 * and stay local here unchanged.
 */
const SESSION_ID = 'evening-wind-down';
const STEP_ID = 'reflection';

// The shared circular BackButton's destination for the CURRENT question -
// a pure function of where the user is right now, never dependent on
// browser history actually containing the right entry (BackButton's own
// goBack() already prefers real in-app history first when it exists;
// this fallback is what's used whenever it doesn't - a direct link,
// refresh, or the very first screen this app instance has rendered).
const backFallbackForIndex = (activeIndex) => (activeIndex === 0 ? '/evening-wind-down' : `/reflection?q=${activeIndex}`);

export const Reflection = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeIndex = parseActiveIndex(searchParams, REFLECTION_PROMPTS.length);
  const { state, currentStep, advanceStep } = useSession();
  const { isGuest } = useAuth();
  // useAuth() itself exposes no userId field (only the full `user` object)
  // - useAlarm() is the context that already derives a real, non-anonymous
  // userId from it (see AlarmContext.jsx), and this page already needs it
  // for effectiveTimezone anyway.
  const { effectiveTimezone, userId } = useAlarm();

  // Safe backward navigation ("Review Mode") - see Breathe.jsx's
  // identical block for the full rationale. Reflection has no timer, but
  // real unsaved typed input is exactly the "unsaved input" case the
  // shared leave-confirmation exists for.
  const { isReviewMode, isLiveStep } = useStepReviewMode(STEP_ID, SESSION_ID);
  const [hasUnsavedText, setHasUnsavedText] = useState(false);
  const { requestReview, confirmLeave, cancelLeave, isConfirming, routeForStep } = useReviewNavigation({
    sessionId: SESSION_ID,
    isLiveStep,
    hasUnsavedProgress: hasUnsavedText
  });

  // A stale/pinned routine (resumed from an earlier local day - see
  // routineProgress.js's own pinRoutineDate) keeps writing under its
  // ORIGINAL date, never silently today's - the exact same rule
  // routineProgress.js itself already applies to step-position snapshots.
  const localDate = getPinnedRoutineDate(SESSION_ID) ?? getZonedParts(effectiveTimezone, devNow()).dateKey;

  // null = still loading; {} = loaded (possibly empty) or guest (never
  // loaded/persisted at all - guests get a blank stepper every time, per
  // the approved guest restriction).
  const [responses, setResponses] = useState(() => (isGuest ? {} : null));
  useEffect(() => {
    // Guests already resolved to {} at initial state above - no load, no
    // Supabase call, nothing to seed here.
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
    setPendingContent({ returnPath: `/reflection?q=${activeIndex + 1}` });
    setGuestPromptOpen(false);
    navigate('/auth');
  };
  const confirmGuestCreateAccount = () => {
    setPendingContent({ returnPath: `/reflection?q=${activeIndex + 1}` });
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

  // Moves to another question WITHIN Reflection - a real navigate() (not
  // local state), so the shared BackButton's own in-app history check
  // lands correctly on the previous question afterward.
  const handleAdvance = (nextIndex) => navigate(`/reflection?q=${nextIndex + 1}`);

  const handleComplete = (answers) => {
    setHasUnsavedText(false);
    if (!isGuest) {
      // Final flush - idempotent upsert on the same conflict target the
      // per-selection save already used, so this can never create a
      // duplicate row even if a debounce/save above already covered it.
      Object.entries(answers ?? {}).forEach(([promptId, value]) => {
        upsertRoutineResponse({ userId, sessionId: SESSION_ID, stepId: STEP_ID, promptId, localDate, response: value });
      });
    }
    // Reviewing: edits are saved (above), but "Continue" here must never
    // advance the real session or navigate forward into Gratitude as if
    // this were the live routine - it returns to wherever the engine
    // actually still is instead.
    if (isReviewMode) {
      if (currentStep) navigate(routeForStep(currentStep.id));
      return;
    }
    if (state.status === 'playing' && currentStep?.id === STEP_ID) {
      advanceStep();
    }
    navigate('/gratitude');
  };

  return (
    // Evening visual-consistency fix: this page previously used the
    // "dusk" atmosphere phase — the same brown/orange sunset gradient as
    // the opening Wind-Down screen — while every step after
    // it (Gratitude, Breathing, Prepare For Rest, Completion) already used
    // 'moonlight'. That made the sunset-to-night transition happen TWICE
    // (once abruptly between Reflection and Gratitude) instead of once,
    // right where it belongs, between Wind-Down and Reflection. 'moonlight'
    // here means Reflection now shares the exact same gradient as every
    // subsequent evening step, so there is no visible change at all
    // crossing that boundary — only the deliberate Wind-Down -> Reflection
    // transition remains.
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback={backFallbackForIndex(activeIndex)} showExit>
      {/* Build 16 physical-iPhone correction (F9) — see Gratitude.jsx's
          identical fix for the full rationale (ProgressIndicator's own
          mobile compact block already shows "Step 2 of 7"). */}
      <ProgressIndicator activeStep="reflection" sessionId="evening-wind-down" onReviewStep={requestReview} />

      {isReviewMode && currentStep && (
        <ReviewModeBanner
          currentStepLabel={getStepLabel(currentStep.id)}
          onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))}
          journeyTone="evening"
        />
      )}

      <div className="flex-1 flex flex-col justify-center">
        {/* Build 16 physical-iPhone correction (F9, then tightened further
            by the Decision 3 acceptance correction) — p-6 -> p-5 -> p-4: a
            modest, further card-padding trim (reducing padding/gaps before
            font size, per spec) that combines with PromptStepper's own
            space-y-4 -> space-y-3 trim to bring Next within the 390x844/
            393x852 viewport - measured precisely (see this file's own
            acceptance-audit evidence): Next's bottom edge sat 24.8px below
            an 844px viewport before this pass. */}
        <div className="glass-panel rounded-3xl p-4">
          {/* Wait for the saved-response load (guests resolve instantly to
              {}) before ever mounting PromptStepper - it only seeds its
              answers once, at its own mount, so mounting it before real
              data arrives would show blank questions forever. */}
          {responses !== null && (
            <PromptStepper
              prompts={REFLECTION_PROMPTS}
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

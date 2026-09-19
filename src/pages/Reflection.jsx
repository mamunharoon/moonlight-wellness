/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { useAlarm } from '../context/AlarmContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { PromptStepper } from '../components/evening/PromptStepper';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';
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

// Each { id, blurb } pairs a manifest entry with this page's own short,
// contextual line, matching the pattern already established for E10
// here. E10 first since it was already here, E19 appended in the order
// it was assigned to this screen.
const REFLECTION_VIDEOS = [
  { id: 'E10', blurb: 'A guided video to close out your day.' },
  { id: 'E19', blurb: "A guided video to help you release what isn't yours to carry." },
  { id: 'E23', blurb: 'A guided video for a quiet moment of gratitude.' },
  { id: 'E25', blurb: 'A guided video for hope and healing.' }
];

// M01-M05: a distinct "Meditation Sessions" collection, kept in its own
// array/section (with its own heading) rather than merged into
// REFLECTION_VIDEOS above, matching the pattern already established for
// the A-series "Affirmation Sessions", B-series "Breathing Sessions" and
// G-series "Grounding Sessions" sections. No dedicated Meditation page
// exists in the app, so this page - the evening wind-down's own
// reflection step - is the closest existing contextual home for
// mindfulness/body-scan/loving-kindness/gratitude/guided-reflection
// content.
const MEDITATION_SESSION_VIDEOS = [
  { id: 'M01', blurb: 'A guided mindfulness meditation.' },
  { id: 'M02', blurb: 'A guided body scan meditation.' },
  { id: 'M03', blurb: 'A guided loving kindness meditation.' },
  { id: 'M04', blurb: 'A guided meditation for gratitude.' },
  { id: 'M05', blurb: 'A guided meditation for quiet reflection.' }
];

/*
 * Stage 4 Batch F4 (+ Completion Pass) — Reflection
 *
 * Second step of the evening-wind-down session. Reuses PromptStepper
 * (F2) for the three prompts below rather than a bespoke sub-stepper —
 * "one question per screen" is PromptStepper's own job, not this page's.
 * ProgressIndicator (F2, generalised in the F4 Completion Pass) is
 * rendered with sessionId="evening-wind-down" so it reads step order/
 * labels from that session instead of its morning default.
 * No onChange is passed: journal persistence is explicitly deferred (see
 * this batch's ticket), and PromptStepper already keeps each answer in
 * its own local state regardless, so there is nothing to lift up yet.
 *
 * The glass-panel wrapper below is built directly rather than via
 * EveningSceneShell's `panelled` prop, because `panelled` gives this
 * page exactly one child — with EveningSceneShell's own `justify-between`
 * container, a single child has no sibling to distribute space against
 * and sits pinned at the top. Wrapping in `flex-1 justify-center` first
 * (the same single-child self-centering pattern EveningWindDown.jsx and
 * EveningComplete.jsx already use) centers it properly; the inner
 * className matches what `panelled` would have used verbatim.
 *
 * advanceStep() is guarded exactly like every other Session-Engine-
 * consuming page in this codebase (MorningStart/Breathe/AlarmActive):
 * only dispatched when the engine is genuinely 'playing' at this exact
 * step. Without this guard, a direct /reflection visit while some other
 * session happened to be 'playing' would incorrectly advance that
 * unrelated session — the reducer only checks status, not which session
 * or step. Navigation itself is unconditional, matching every precedent.
 */
const REFLECTION_PROMPTS = [
  { id: 'went-well', label: 'What went well today?' },
  { id: 'challenged', label: 'What challenged you today?' },
  { id: 'release', label: 'What are you ready to release?' },
];

// Video Integration: additional rows below the reflection prompts offer
// "Evening Reflection" and "Letting Go" - the exact evening wind-down
// reflection stage the mapping calls for. Shown to any signed-in user
// (guests excluded); PromptStepper's own journaling/Continue/Skip are
// entirely unaffected. Access was originally gated on
// profiles.beta_access; that gate was removed once these videos were
// approved for general availability in this environment.
const SESSION_ID = 'evening-wind-down';
const STEP_ID = 'reflection';

export const Reflection = () => {
  const navigate = useNavigate();
  const { state, currentStep, advanceStep } = useSession();
  const { isGuest } = useAuth();
  // useAuth() itself exposes no userId field (only the full `user` object)
  // - useAlarm() is the context that already derives a real, non-anonymous
  // userId from it (see AlarmContext.jsx), and this page already needs it
  // for effectiveTimezone anyway.
  const { effectiveTimezone, userId } = useAlarm();
  const {
    openVideo,
    handleSelect,
    closeVideo,
    promptOpen,
    dismissPrompt,
    confirmSignIn,
    confirmCreateAccount
  } = useProtectedVideo();

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
    setPendingContent({ returnPath: '/reflection' });
    setGuestPromptOpen(false);
    navigate('/auth');
  };
  const confirmGuestCreateAccount = () => {
    setPendingContent({ returnPath: '/reflection' });
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

  if (EveningSceneShell && PromptStepper && ProgressIndicator && BetaVideoModal && BetaVideoRow && ReviewModeBanner) { /* no-op to satisfy blind linter */ }

  const handleComplete = (answers) => {
    setHasUnsavedText(false);
    if (!isGuest) {
      // Final flush - idempotent upsert on the same conflict target the
      // per-keystroke save already used, so this can never create a
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
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/evening-wind-down">
      <ProgressIndicator activeStep="reflection" sessionId="evening-wind-down" onReviewStep={requestReview} />
      <span className="block text-center text-[10px] text-primary uppercase font-bold tracking-wider">Step 2 of 6</span>

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      <div className="flex-1 flex flex-col justify-center space-y-4">
        <div className="glass-panel rounded-3xl p-6">
          {/* Wait for the saved-response load (guests resolve instantly to
              {}) before ever mounting PromptStepper - it only seeds
              initialAnswers once, at its own mount, so mounting it before
              real data arrives would show a blank stepper forever. */}
          {responses !== null && (
            <PromptStepper
              prompts={REFLECTION_PROMPTS}
              initialAnswers={responses}
              onChange={handlePromptChange}
              onClear={handlePromptClear}
              onComplete={handleComplete}
            />
          )}
        </div>

        {REFLECTION_VIDEOS.map(({ id, blurb }) => {
          const entry = getBetaVideoById(id);
          if (!entry) return null;
          return (
            <BetaVideoRow
              key={id}
              title={entry.title}
              description={blurb}
              onClick={() => handleSelect(id)}
            />
          );
        })}

        <div className="space-y-3">
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Meditation Sessions</h3>
          {MEDITATION_SESSION_VIDEOS.map(({ id, blurb }) => {
            const entry = getBetaVideoById(id);
            if (!entry) return null;
            return (
              <BetaVideoRow
                key={id}
                title={entry.title}
                description={blurb}
                onClick={() => handleSelect(id)}
              />
            );
          })}
        </div>
      </div>

      {/* Closing this leaves the user right here on Reflection - no
          navigation needed for a return path. PromptStepper's own
          journaling/Continue/Skip above are entirely unaffected. */}
      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={closeVideo} />
      )}
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
      <SignInPromptDialog
        open={promptOpen}
        onSignIn={confirmSignIn}
        onCreateAccount={confirmCreateAccount}
        onDismiss={dismissPrompt}
      />
    </EveningSceneShell>
  );
};

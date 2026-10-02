/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { getAffirmationForIntention } from '../lib/intentionAffirmations';
import { roleForIndex } from '../lib/intentionSelection';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { BackButton } from '../components/BackButton';
import { ReviewModeBanner } from '../components/ReviewModeBanner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { getStepLabel } from '../lib/stepLabels';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { JourneyGlow } from '../components/JourneyGlow';
import { ExerciseScreenShell } from '../components/journey/ExerciseScreenShell';

/*
 * Morning-flow redesign — Affirm step (Journey Embedding correction: now
 * Step 5 of 5, after Meditate; was Step 4 of 4, after Breathe, before
 * Meditate was inserted and counted).
 *
 * Previously this screen showed one fixed generic quote plus optional
 * guided-video rows (E07/E11/E12/E21/E22/E24/E26, A01-A06) requiring a
 * video choice before continuing. Per the approved redesign: the screen
 * now automatically shows one affirmation matched to the user's own
 * selected Morning intention (IntentionSetup.jsx, now Step 1) - no video
 * choice, nothing to tap before Continue. The removed videos are not
 * deleted (see docs/... none needed - lib/mediaCatalog.js's own
 * MORNING-FLOW REDESIGN REACHABILITY UPDATE comment): every one of them
 * remains fully browsable and playable via Library, exactly like every
 * other id whose `page` metadata is null.
 *
 * Also previously branched to skip Stretching for routineDuration ===
 * 'quick' - that branch point moved to IntentionSetup.jsx's own
 * handleComplete when Intention started coming before Stretch instead of
 * after it, and was then removed there entirely as a release-blocking
 * DEV defect fix (see IntentionSetup.jsx's own top comment) - the "skip
 * Stretching for quick" behaviour no longer exists anywhere in the app.
 * This screen (the last content step before Complete, in every routine
 * duration) always advances straight to Complete.
 *
 * Morning journey UX correction — "Skip this step" removed: it called the
 * exact same handleNext as Continue (this step has no separate content to
 * skip past), so presenting both was a redundant, confusing duplicate of
 * the same single terminal transition. Continue and Exit routine are the
 * only two actions now, matching the required Affirmation interaction
 * contract exactly.
 */
export const Affirmation = () => {
  const navigate = useNavigate();
  const { setJourneyStep, intentions, effectiveTimezone } = useAlarm();
  const { state, currentStep, advanceStep, abandonSession } = useSession();
  // Safe backward navigation ("Review Mode") - no timer, no input on this
  // screen, so leaving it never needs a confirmation; it always reflects
  // whatever the CURRENT intentions are (below, from AlarmContext) -
  // including a change made via Home's "Change intention" or via
  // reviewing/editing Intend itself, automatically, since both just read
  // the same live context value at render time.
  const { isReviewMode, isLiveStep } = useStepReviewMode('affirmation', 'morning-routine');
  const { routeForStep } = useReviewNavigation({ sessionId: 'morning-routine', isLiveStep, hasUnsavedProgress: false });

  // Primary then Supporting order, always - intentions is already
  // ordered that way (index 0 = Primary, index 1 = Supporting), so this
  // is just "map every selected intention to its own fixed affirmation
  // in-order", never a re-sort. A custom (non-preset) intention maps to
  // the same fixed neutral DEFAULT_AFFIRMATION getAffirmationForIntention
  // already returns for one - never a dynamically generated claim.
  // WakeWise Phase 2 (B6) — each intention's own affirmation now rotates
  // through 5 curated variants keyed to the user's own local calendar day
  // (see intentionAffirmations.js's own doc comment) instead of one fixed
  // line - stable all day, never re-rolled on rerender/reopen.
  const today = getZonedParts(effectiveTimezone, devNow()).dateKey;
  const affirmations = intentions.map((intention) => ({
    intention,
    affirmation: getAffirmationForIntention(intention, today)
  }));

  // Mirror only when the engine is genuinely playing at the 'affirmation'
  // step — a direct-route visit with no active session, or a mismatched
  // mirror, silently does nothing here.
  const mirrorTransition = () => {
    if (state.status !== 'playing' || currentStep?.id !== 'affirmation') return;
    advanceStep();
  };

  const handleNext = () => {
    setJourneyStep('complete');
    navigate('/session-complete');
    mirrorTransition();
  };

  // Dialog-severity correction — see Breathe.jsx's identical fix/
  // rationale. This screen itself has no timer/local progress of its own
  // (per this file's own note above), but abandonSession() still marks
  // the WHOLE Morning routine SKIPPED (terminal, never resurfaced as
  // resumable) - by this point that means every earlier completed step
  // too, which previously exited with zero confirmation at all.
  const [exitRoutineConfirmOpen, setExitRoutineConfirmOpen] = useState(false);
  const handleExitRoutine = () => setExitRoutineConfirmOpen(true);
  const confirmExitRoutine = () => {
    setExitRoutineConfirmOpen(false);
    setJourneyStep('');
    navigate('/');
    if (state.status === 'playing' && currentStep?.id === 'affirmation') abandonSession();
  };

  return (
    // Morning scroll/header-placement correction — this screen's own
    // Back/ProgressIndicator row now lives in ExerciseScreenShell's
    // dedicated, non-scrolling `header` slot instead of being an ordinary
    // in-flow child of the one scrollable region - see that component's
    // own doc comment, and Breathe.jsx/MorningFlow.jsx's identical fix,
    // for the full root cause (the old min-h-full/overflow-y-auto wrapper
    // below genuinely fixed the earlier "Continue button clipped"
    // defect - that scroll-container-of-its-own fix stays, below - but
    // left the header as scroll-away in-flow content, same class of bug
    // as every other affected Morning screen). The flex-1 spacer the old
    // justify-between layout needed is dropped along with it - content
    // now simply flows to its natural height inside the shell's own body,
    // matching Breathe.jsx/MorningFlow.jsx's identical convention; a
    // short affirmation no longer needs to scroll at all, and a long one
    // (two affirmations, or larger Dynamic Type) scrolls only the body,
    // Continue always reachable exactly as the min-h-full fix intended.
    <ExerciseScreenShell
      journeyTone="morning"
      header={
        <>
          <div className="flex items-center gap-3">
            {/* Journey Embedding — Meditate is now the real preceding step
                (Breathe -> Meditate (optional) -> Affirm), so Back must return
                there, not skip over it straight to Breathe - "Back returns to
                the immediately preceding step" is the same rule every other
                Morning page already follows. Back-navigation repair (Morning
                canonical map): guardActiveRoute is off - the whole-routine
                "Leave this routine?" confirmation belongs only to Intention
                (the first step), never to a plain previous-step Back. */}
            <BackButton fallback="/morning-meditate" guardActiveRoute={false} />
          </div>
          <ProgressIndicator activeStep="affirmation" onReviewStep={(stepId) => navigate(routeForStep(stepId))} />

          {isReviewMode && currentStep && (
            <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
          )}
        </>
      }
    >
    <div className="flex flex-col space-y-6 select-none">
      {/* WakeWise DEV — colour glow extension: subtle warm-gold ambient
          backdrop behind this step's own morning-affirmation card. */}
      <JourneyGlow journey="morning" />

      <p className="text-xs text-on-surface-variant text-center max-w-xs mx-auto leading-relaxed">
        Carry this thought into your day.
      </p>

      <div className="space-y-6 text-center relative overflow-hidden p-5 rounded-3xl bg-gradient-to-tr from-morning-affirmation-from via-morning-affirmation-via to-morning-affirmation-to border border-morning-accent-tint/15 shadow-[0_8px_30px_rgba(149,72,53,0.04)]">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <span className="material-symbols-outlined text-9xl">wb_sunny</span>
        </div>

        <div className="space-y-4 relative z-10">
          <span className="material-symbols-outlined text-morning-accent text-4xl animate-pulse">auto_awesome</span>
          <h2 className="text-3xl font-morning-display font-semibold text-on-morning-affirmation leading-tight tracking-tight px-2">
            Today is a fresh beginning.
          </h2>
          {/* Morning Visual Uplift (Phase 6) — a visible divider now
              separates Primary from Supporting whenever both are shown
              (clear visual separation, per the approved Stitch-direction
              redesign), and the quote text now reuses the same warm
              on-morning-affirmation token the role label already uses
              (previously a cool grey, text-slate-600, at odds with the
              warm cream/gold surface) - no new colour introduced, only an
              existing token applied more consistently. Role label bumped
              9px -> 10px.
              Physical-iPhone correction — the quote text was still hard
              to read: text-sm (14px) fell short of the approved 15-16px
              floor, and the /90 opacity on-morning-affirmation-tint/90)
              softened the already-brownish token further, reading as
              pale against the cream card. Now full-strength
              on-morning-affirmation (the SAME token, no opacity modifier
              - never a new colour, and the token this screen's own role
              label and heading already use at full strength) at text-base
              (16px) and font-semibold, keeping leading-relaxed for
              comfortable line height. */}
          <div className="space-y-4">
            {affirmations.map(({ intention, affirmation }, idx) => (
              <div
                key={intention.toLowerCase()}
                className={`space-y-1 ${idx > 0 ? 'pt-4 border-t border-morning-accent-tint/20' : ''}`}
              >
                {affirmations.length > 1 && (
                  <span className="text-[12px] font-bold uppercase tracking-wider text-on-morning-affirmation">{roleForIndex(idx)}</span>
                )}
                <p className="text-base text-on-morning-affirmation max-w-xs mx-auto leading-relaxed font-semibold">
                  "{affirmation}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 w-full">
        {/* Duplicate-return-action fix (mirrors IntentionSetup.jsx's
            identical fix) — the ReviewModeBanner above already renders
            its own "Return to X" whenever isReviewMode; nothing replaces
            this branch while reviewing. */}
        {!isReviewMode && (
          <>
            <button
              onClick={handleNext}
              className={`w-full ${getJourneyPrimaryActionClasses('morning')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg`}
            >
              <span>Complete Affirmation</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
            <button
              onClick={handleExitRoutine}
              className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors -my-1.5 py-3.5"
            >
              Exit routine
            </button>
          </>
        )}
      </div>
      <ConfirmDialog
        open={exitRoutineConfirmOpen}
        title="Exit this routine?"
        message="You'll leave without finishing today's Morning routine - it won't be saved to resume later."
        confirmLabel="Exit Routine"
        cancelLabel="Stay"
        mildDestructive
        onConfirm={confirmExitRoutine}
        onDismiss={() => setExitRoutineConfirmOpen(false)}
      />
    </div>
    </ExerciseScreenShell>
  );
};

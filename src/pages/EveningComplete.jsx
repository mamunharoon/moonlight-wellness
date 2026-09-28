/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { useAlarm } from '../context/AlarmContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { getPinnedRoutineDate, unpinRoutineDate, clearRoutineProgress } from '../session/routineProgress';
import { shouldWriteCompletionDate } from '../lib/routineCardState';
import { getEveningCompletionKey } from '../lib/dailyCompletion';
import { redoEveningWindDown } from '../lib/routineResponses';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { getCompletionGreeting } from '../lib/outcomeMessages';
import { recordPracticeCompletion } from '../lib/practiceCompletions';

/*
 * Stage 4 Batch F3 — EveningComplete
 *
 * Terminal step of the evening-wind-down session. Mirrors
 * SessionComplete.jsx's own mount-effect pattern exactly: only calls
 * completeSession() when the engine is genuinely 'playing' at this
 * step, so a direct /evening-complete visit with no active session (or
 * mid-navigation from an unrelated route) renders the closing message
 * without touching Session Engine state. No StrictMode guard ref is
 * needed here either, for the same reason SessionComplete.jsx doesn't
 * need one — COMPLETE_SESSION is idempotent in the reducer itself (a
 * repeat call once status is already 'completed' returns the exact same
 * state reference, so a double-invoked effect is harmless).
 *
 * Evening completed-review (Build 15) — the daily completion-date flag
 * (Home.jsx's own isEveningDone signal, and the ONLY thing
 * ReflectionReview.jsx/GratitudeReview.jsx trust to decide "is there a
 * completed journey to show") now writes HERE, in this same mount
 * effect, the instant the session genuinely completes - not later,
 * gated behind the user actually tapping "Return Home" as it used to be.
 * Without this move, a user who reaches this screen and immediately taps
 * "Review Tonight's Journey" (the single most likely first thing to tap)
 * would see "Nothing to review yet", even though their Reflection/
 * Gratitude answers are already safely saved in Supabase - the flag was
 * simply the one signal lagging behind. shouldWriteCompletionDate still
 * guards it exactly as before (no write once the flag already holds this
 * exact value - a revisit or a StrictMode double-invoke stays a genuine
 * no-op, never a second "credit").
 *
 * This screen is also safe to revisit at any later point, including
 * after the Session Engine has been fully reset back to idle (state.
 * sessionId null): the mount effect's own `status === 'playing'` guard
 * is then simply false, so nothing above re-fires - no second
 * completion event, no re-write of the (already-correct) completion
 * flag, no change to any routine_responses row. It just renders the
 * same static summary and the same action set every time.
 */
export const EveningComplete = () => {
  const navigate = useNavigate();
  const { state, currentStep, completeSession, resetSession, resetRoutine } = useSession();
  const { isGuest } = useAuth();
  const { effectiveTimezone, userId } = useAlarm();

  const [redoConfirmOpen, setRedoConfirmOpen] = useState(false);
  const [isRedoing, setIsRedoing] = useState(false);
  const [redoError, setRedoError] = useState(false);

  // Rotating 100% Evening completion messages correction — this screen is
  // reached ONLY on a genuine natural completion (the mount effect below
  // gates completeSession() on state.status==='playing'; a direct/
  // refreshed visit, or one after the engine has already reset to idle,
  // still renders this same static screen, unaffected - see this file's
  // own top comment). The headline now uses the shared journey/practice
  // completion-greeting architecture (getCompletionGreeting) already
  // approved for every other Morning/Anytime/Evening exercise completion,
  // migrated cleanly off the older getOutcomeMessage/day-of-year rotation
  // (which only changed once every 5 calendar days per user -
  // indistinguishable from "stuck" within any single test session). Picked
  // exactly once via this lazy initializer, so it stays stable through
  // every re-render this same mounted screen goes through afterward - a
  // revisit/refresh of this already-completed screen naturally picks
  // again, exactly like every other completion-greeting call site.
  const [headline] = useState(() => getCompletionGreeting({ journey: 'evening', practice: 'routine' }));
  const today = getZonedParts(effectiveTimezone, devNow()).dateKey;

  if (EveningSceneShell) { /* no-op to satisfy blind linter */ }

  useEffect(() => {
    if (state.status === 'playing' && currentStep?.id === 'completion') {
      completeSession();
      // "Repeat Morning/Evening Routine" remediation — a session resumed
      // from a genuinely stale (prior local day) snapshot is pinned to
      // its own original dateKey, so its completion credits that
      // original day, never today; an ordinary session (including one
      // spanning a local midnight) still credits "now" exactly as
      // before. User-scoped: writes to the CURRENT identity's own key
      // (dailyCompletion.js), so this completion is never later read
      // back as a different user's.
      const pinnedDateKey = getPinnedRoutineDate(state.sessionId);
      const attributionDateKey = pinnedDateKey ?? getZonedParts(effectiveTimezone, devNow()).dateKey;
      const eveningDoneKey = getEveningCompletionKey(userId);
      if (shouldWriteCompletionDate(localStorage.getItem(eveningDoneKey), attributionDateKey)) {
        localStorage.setItem(eveningDoneKey, attributionDateKey);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, currentStep, completeSession]);

  // "Your Momentum" foundation, Phase 2 — this new completion EVENT (a
  // separate concern from the daily completion-date flag above - see
  // practiceCompletions.js) mirrors this screen's own already-correct
  // mount-time pattern: it fires the instant state.completionEventId is
  // genuinely minted, never on a direct/stale visit (state.completionEventId
  // is only ever set by a genuine COMPLETE_SESSION transition). A separate
  // effect from the one above (keyed on completionEventId, not
  // [state.status, currentStep, completeSession]) because completeSession()
  // above only DISPATCHES the action that mints completionEventId - the
  // minted value itself isn't available on `state` until the next render,
  // which is exactly when this effect re-runs and reads it.
  // recordPracticeCompletion's own database uniqueness constraint (never a
  // React ref alone) is what actually keeps this to one row per id even if
  // this effect is ever double-invoked (StrictMode) or this screen is
  // later revisited.
  //
  // Duration policy correction — identical to Morning's own
  // (SessionComplete.jsx): deliberately NULL, never
  // state.updatedAt - state.startedAt. That elapsed wall-clock span
  // includes any time genuinely spent interrupted/backgrounded mid-routine
  // (INTERRUPT_SESSION/RESUME_SESSION both advance updatedAt), so it would
  // silently overstate real engaged time - reported as fact, that is a
  // false claim, not an honest estimate. The Session Engine has no
  // accumulator that tracks only genuinely active (non-paused) time, and
  // Phase 2 is deliberately not building one - see practiceCompletions.js's
  // own doc comment. Routine mindful-minute insights are simply
  // unavailable until a real, verified active-duration measurement exists;
  // this column staying NULL for every Morning/Evening row is the honest
  // reflection of that, not a bug to work around later by approximating it
  // here.
  useEffect(() => {
    if (state.status !== 'completed' || !state.completionEventId) return;
    recordPracticeCompletion({
      userId,
      isGuest: !userId,
      sessionId: state.completionEventId,
      journey: 'evening',
      practiceType: 'full_routine',
      durationSeconds: null,
      timezone: effectiveTimezone
    });
  }, [state.status, state.completionEventId, userId, effectiveTimezone]);

  const handleReturnHome = () => {
    if (state.sessionId) {
      unpinRoutineDate(state.sessionId);
      clearRoutineProgress(state.sessionId);
    }
    navigate('/');
    resetSession();
  };

  const handleRedoTap = () => {
    setRedoError(false);
    setRedoConfirmOpen(true);
  };

  /*
   * Redo Tonight's Wind-Down (Build 15; shared as of the Build 15
   * addendum) — the entire failure-safe eligibility/delete/flag/routine
   * sequence now lives in one place, routineResponses.js's own
   * redoEveningWindDown (see its doc comment for the exact approved
   * order), so this screen and Home.jsx's completed-Evening card can
   * never drift out of sync with each other. This handler's own job is
   * just: guard against rapid double taps, resolve today's local date
   * once, call the shared function, and translate its result into this
   * screen's own error/navigation UI.
   */
  const handleConfirmRedo = async () => {
    if (isRedoing) return;
    setIsRedoing(true);
    setRedoError(false);

    const localDate = getZonedParts(effectiveTimezone, devNow()).dateKey;
    const result = await redoEveningWindDown({ userId, isGuest, localDate, resetRoutine });

    setIsRedoing(false);
    setRedoConfirmOpen(false);
    if (!result.ok) {
      setRedoError(true);
      return;
    }
    navigate('/evening-wind-down');
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/" alwaysFallback>
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
        {/* Evening Visual Uplift (Build 17) — periwinkle badge/icon ring,
            the same restrained circular-icon shape SessionComplete.jsx's
            own Morning-gold version already established (Build 16), just
            evening-accent instead of morning-accent. Heading (already
            Newsreader italic), body copy, and all four action buttons
            below (order, labels, handlers) are completely untouched. */}
        <span className="w-16 h-16 rounded-full bg-evening-accent/10 border border-evening-accent-tint/25 shadow-evening-glow flex items-center justify-center">
          <span className="material-symbols-outlined text-evening-accent text-3xl">bedtime</span>
        </span>
        {/* Journey Embedding (correction) — Meditate is now a counted step,
            so Evening Complete is Step 7 of 7, not 6 of 6. */}
        <span className="block text-[10px] text-evening-accent uppercase font-bold tracking-wider">Step 7 of 7</span>
        <h1 className="font-serif italic text-3xl text-on-surface">{headline}</h1>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          You've reflected, appreciated the day and prepared for rest.
        </p>
      </div>

      <div className="space-y-3 w-full">
        {/* Build 15 Evening UX correction — approved authenticated order:
            (1) Choose a Sleep Experience, now first and primary;
            (2) Review or Edit Tonight's Responses, combined into one
            secondary action (opens read-only Review first; Edit is
            reached from Review's own banner - see EveningReviewBanner.jsx);
            (3) Redo Tonight's Wind-Down (unchanged); (4) Return Home
            (unchanged). Guests never have persisted routine_responses
            (Reflection.jsx/Gratitude.jsx both early-return before ever
            writing for a guest), so Review/Edit/Redo would all open on
            nothing genuine - guests see only Sleep Experience + Return
            Home, both truthful for them either way. */}
        {/* Build 15 DEV correction — carries the allowlisted
            `from=evening-summary` entry context (see Library.jsx's own
            FROM_CONTEXTS) so Library shows a contextual "Back to Evening
            Summary" control, landing back on this exact screen - never a
            free-form return URL, never an arbitrary destination. */}
        <button
          onClick={() => navigate('/library?category=sleep-soundscapes&from=evening-summary')}
          className={`w-full ${getJourneyPrimaryActionClasses('evening')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg`}
        >
          <span>Choose a Sleep Experience</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        {!isGuest && (
          <button
            onClick={() => navigate('/review/reflection?q=1')}
            className="w-full glass-panel text-on-surface py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span>Review or Edit Tonight's Responses</span>
          </button>
        )}
        {/* Redo Tonight's Wind-Down (Build 15) — quiet, destructive-tinted
            text-only action, deliberately NOT a filled/primary Continue-
            style button, so it never visually competes with the actions
            above. */}
        {!isGuest && (
          <>
            {redoError && (
              <div className="glass-panel rounded-2xl p-4 border-red-400/30 bg-red-500/10">
                <p className="text-sm text-on-surface">
                  Couldn't redo tonight's Wind-Down. Your existing journey is unchanged — please try again.
                </p>
              </div>
            )}
            <button
              onClick={handleRedoTap}
              className="w-full py-3 text-center text-sm font-semibold text-red-300 hover:text-red-200 active:scale-95 transition-all"
            >
              Redo Tonight's Wind-Down
            </button>
          </>
        )}
        <button
          onClick={handleReturnHome}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Return Home
        </button>
      </div>

      <ConfirmDialog
        open={redoConfirmOpen}
        title="Redo tonight's Wind-Down?"
        message="This will permanently delete tonight's saved Reflection and Gratitude responses and restart the Evening journey from the beginning. If you leave before completing it again, your previous responses cannot be restored."
        confirmLabel="Delete Responses & Redo"
        cancelLabel="Keep Existing Journey"
        destructive
        confirmPending={isRedoing}
        onConfirm={handleConfirmRedo}
        onDismiss={() => setRedoConfirmOpen(false)}
      />
    </EveningSceneShell>
  );
};

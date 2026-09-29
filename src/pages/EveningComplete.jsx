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
import { getEveningCompletionKey, getEveningFullyCompletedKey } from '../lib/dailyCompletion';
import { redoEveningWindDown } from '../lib/routineResponses';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { getCompletionGreeting } from '../lib/outcomeMessages';
import { recordPracticeCompletion } from '../lib/practiceCompletions';
import { useMomentumCompletion } from '../hooks/useMomentumCompletion';
import { CompletionReveal } from '../components/CompletionReveal';
import { MomentumPanel } from '../components/MomentumPanel';
import { ExploreCard } from '../components/ExploreCard';
import { EveningJourneyPathway } from '../components/EveningJourneyPathway';
import { EVENING_PATHWAY_STAGES } from '../session/pathwayStages';
import { computeStageStatus, isFullyCompleted } from '../session/stageStatus';

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

  // "Your Momentum" foundation, Phase 3 — captured once, before the mount
  // effect below can flip state.status to 'completed': true only for a
  // genuine natural completion arriving with the session still 'playing'
  // (the exact same signal the effect itself gates completeSession() on -
  // mirrors SessionComplete.jsx's own established isFreshCompletion
  // precedent). A direct/refreshed visit, or a later revisit after the
  // engine has reset to idle, never animates the completion-reveal below.
  // Reduced Motion detection itself lives entirely inside
  // CompletionReveal.jsx - never duplicated here.
  const [isFreshCompletion] = useState(() => state.status === 'playing');

  // Phase 9 — Truthful Journey Outcomes: computed early (before the
  // completion-recording effect below, which must gate on it) from the
  // Session Engine's own stepOutcomes - never inferred from having
  // reached this screen. A direct/stale visit still resolves whatever
  // stepOutcomes state genuinely holds; it is never fabricated as "all
  // completed" merely because this is the terminal screen.
  const eveningPathwayStages = computeStageStatus({
    stages: EVENING_PATHWAY_STAGES,
    stepOutcomes: state.stepOutcomes,
    currentStepId: currentStep?.id ?? null,
    sessionStatus: state.status
  });
  const eveningFullyCompleted = isFullyCompleted(eveningPathwayStages);

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
      // Phase 9 — Truthful Journey Outcomes (Part 8/9): the additive
      // "genuinely fully completed today" signal, written only when every
      // displayed Evening stage is genuinely 'completed' - never for a
      // partial run. eveningDoneKey above keeps its own separate, broader
      // meaning ("reached a genuine completion today, so there is
      // something real to review") untouched.
      if (eveningFullyCompleted) {
        const eveningFullyDoneKey = getEveningFullyCompletedKey(userId);
        if (shouldWriteCompletionDate(localStorage.getItem(eveningFullyDoneKey), attributionDateKey)) {
          localStorage.setItem(eveningFullyDoneKey, attributionDateKey);
        }
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
  // "Your Momentum" foundation, Phase 3 — the write's own resolution is
  // now captured (previously fire-and-forget) - see SessionComplete.jsx's
  // identical addition for the full rationale. recordPracticeCompletion
  // itself, and the identity it's called with, are completely unchanged.
  const [confirmedSessionId, setConfirmedSessionId] = useState(null);
  useEffect(() => {
    // Phase 9 — Truthful Journey Outcomes (Part 8): a full_routine
    // completion event must only ever be written when every displayed
    // Evening stage is genuinely 'completed' - reaching this terminal
    // screen (state.status === 'completed') is necessary but never
    // sufficient on its own. A partial run (any skipped/ended-early/
    // not-reached stage) still shows this same supportive screen, just
    // with no full_routine event and no full-routine Momentum credit.
    // Individual practice completions (Breathing/Meditation) are
    // untouched by this gate - recorded elsewhere, at their own natural-
    // completion moment, regardless of how the surrounding routine ends.
    if (state.status !== 'completed' || !state.completionEventId || !eveningFullyCompleted) return;
    let cancelled = false;
    recordPracticeCompletion({
      userId,
      isGuest: !userId,
      sessionId: state.completionEventId,
      journey: 'evening',
      practiceType: 'full_routine',
      durationSeconds: null,
      timezone: effectiveTimezone
    }).then((result) => {
      if (!cancelled && result.ok) setConfirmedSessionId(state.completionEventId);
    });
    return () => {
      cancelled = true;
    };
  }, [state.status, state.completionEventId, eveningFullyCompleted, userId, effectiveTimezone]);

  // "Your Momentum" foundation, Phase 3 — factual insight + gentle
  // milestone for this exact, already-confirmed completion event. Never
  // blocks/delays any of this screen's existing actions, all of which
  // render unconditionally below regardless of this hook's own status.
  const momentum = useMomentumCompletion({
    ready: confirmedSessionId === state.completionEventId,
    userId,
    isGuest: !userId,
    sessionId: state.completionEventId,
    journey: 'evening',
    practiceType: 'full_routine'
  });

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
      {/* "Your Momentum" foundation, Phase 3 — shared completion-reveal
          transition, mirroring SessionComplete.jsx's own identical
          wiring. The four action buttons below stay outside this
          wrapper entirely - always immediately rendered and reachable,
          never gated on any fade timing. */}
      <CompletionReveal
        active
        isFresh={isFreshCompletion}
        journeyTone="evening"
        className="flex-1 flex flex-col items-center justify-center w-full"
        stagger={[
          <div key="greeting" className="flex flex-col items-center text-center space-y-4">
            {/* Evening Visual Uplift (Build 17) — periwinkle badge/icon ring,
                the same restrained circular-icon shape SessionComplete.jsx's
                own Morning-gold version already established (Build 16), just
                evening-accent instead of morning-accent. Heading (already
                Newsreader italic), body copy, and all four action buttons
                below (order, labels, handlers) are completely untouched. */}
            <span className="w-16 h-16 rounded-full bg-evening-accent/10 border border-evening-accent-tint/25 shadow-evening-glow flex items-center justify-center">
              <span className="material-symbols-outlined text-evening-accent text-3xl">bedtime</span>
            </span>
            {/* Phase 9 — Truthful Journey Outcomes (Part 7): exact
                approved copy, gated on eveningFullyCompleted - "complete"
                is shown ONLY when every displayed Evening stage is
                genuinely completed; any skipped/ended-early/not-reached
                stage shows the "finished" variant instead, and the old
                unconditional "You've reflected, appreciated the day and
                prepared for rest." claim (which overclaimed on a partial
                run) is replaced by this same honest supporting line.
                Never a percentage, either way - the former "100%
                Complete" badge is removed entirely. */}
            <h1 className="font-serif italic text-3xl text-on-surface">
              {eveningFullyCompleted ? 'Evening Wind-Down complete' : 'Evening Wind-Down finished'}
            </h1>
            <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
              {eveningFullyCompleted ? 'You gave yourself time to close the day gently.' : 'Take the calm you created into the night.'}
            </p>
            {/* The pre-existing rotating greeting stays as a smaller,
                secondary line - every phrase in the evening/routine pool
                (outcomeMessages.js) is a generic, supportive affirmation
                that never itself claims full completion, so it never
                contradicts the "finished" outcome above. */}
            <p className="text-sm text-on-surface-variant/80 italic">{headline}</p>
            {/* Phase 9 — Truthful Journey Outcomes: the real per-stage
                pathway for this run, added to the final Evening summary
                screen per Part 4/5 of the spec. */}
            <EveningJourneyPathway stages={eveningPathwayStages} />
          </div>,
          <MomentumPanel key="momentum" insight={momentum.insight} milestone={momentum.milestone} />
        ]}
      />

      <div className="space-y-3 w-full">
        {/* Evening Visual Uplift (Phase 7) — approved reordering: (1)
            Choose a Sleep Experience, primary; (2) Return Home, secondary
            (moved up from last); (3) Review or Edit Tonight's Responses,
            now visually smaller/quieter (moved down, text-only like Redo
            rather than a full glass-panel button); (4) the optional
            Explore Evening card; (5) Redo Tonight's Wind-Down, tertiary.
            Every handler/destination below is completely unchanged - only
            order and Review/Edit's own visual weight moved. Guests never
            have persisted routine_responses (Reflection.jsx/Gratitude.jsx
            both early-return before ever writing for a guest), so
            Review/Edit/Redo would all open on nothing genuine - guests
            still see only Sleep Experience + Return Home, both truthful
            for them either way. */}
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
        <button
          onClick={handleReturnHome}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Return Home
        </button>
        {!isGuest && (
          <button
            onClick={() => navigate('/review/reflection?q=1')}
            className="w-full py-3 text-center text-sm font-semibold text-on-surface-variant hover:text-on-surface active:scale-95 transition-all"
          >
            Review or Edit Tonight's Responses
          </button>
        )}
      </div>

      {/* "Explore More" discovery, Phase 5 — optional, secondary, placed
          AFTER the primary completion/return actions above. Distinct from
          "Choose a Sleep Experience" above it (which links straight into
          the Sleep Soundscapes category only) - this is the broader
          Evening/wind-down discovery entry point, covering calming videos
          too, not just sleep sounds. journey="evening" filters the
          Library to approved Evening/sleep/wind-down content only
          (timeOfDay === 'evening' - never an energising Morning-only
          item, see exploreFiltering.js's own documented rule).
          Evening Visual Uplift (Phase 7) — the longer supporting sentence
          is removed (ExploreCard's own supportingText is now optional -
          see ExploreCard.jsx's doc comment); title/CTA/route/
          accessibility label are all otherwise unchanged.
          Evening pathway parity (Phase 13) — `itemCount` is no longer
          passed at all, mirroring SessionComplete.jsx's own identical
          Morning correction: ExploreCard's own `typeof itemCount ===
          'number' && itemCount > 0` guard already renders nothing when
          the prop is omitted, so "EXPLORE EVENING · N" becomes plain
          "EXPLORE EVENING" with zero changes to the shared ExploreCard.jsx
          component. */}
      <ExploreCard
        journey="evening"
        icon="nights_stay"
        title="Would more support help you unwind?"
        ctaLabel="Explore Evening"
        to="/library?journey=evening&from=evening-summary"
      />

      {/* Redo Tonight's Wind-Down (Build 15, Evening Visual Uplift Phase 7
          reordering) — quiet, destructive-tinted text-only action, now
          the last/tertiary action on the screen so it never visually
          competes with anything above it. */}
      {!isGuest && (
        <div className="w-full space-y-3">
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
        </div>
      )}

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

// Build 10 remediation — pure decision logic for the Morning/Evening
// resume card, extracted out of Home.jsx so it's directly testable (see
// subscriptionStatusMessages.js/greeting.js for this codebase's
// established pattern). Fixes the critical defect where the standalone
// "Continue where you left off" card ignored which period was selected
// and showed whichever routine happened to be live in the Session
// Engine's one global slot - it must instead be resolved per-routine.

export const RITUAL_SESSION_IDS = Object.freeze({
  morning: 'morning-routine',
  evening: 'evening-wind-down'
});

/**
 * What one routine's own card should show. `doneToday` is Home.jsx's
 * existing, simpler moonlight_{morning,evening}_completed_date flag -
 * kept as the sole "completed" signal (see routineProgress.js's own doc
 * comment for why) rather than introducing a second, competing source of
 * truth. `liveState` is SessionContext's `state`; `snapshot` is
 * routineProgress.getRoutineProgress(sessionId) (today-only, or null).
 */
export const resolveRoutineCardState = ({ sessionId, liveState, snapshot, doneToday }) => {
  if (doneToday) return 'completed';

  const isLiveHere =
    liveState?.sessionId === sessionId &&
    (liveState.status === 'playing' || liveState.status === 'interrupted');
  if (isLiveHere) return 'in-progress';

  if (snapshot && (snapshot.status === 'playing' || snapshot.status === 'interrupted')) {
    return 'in-progress';
  }

  return 'not-started';
};

/**
 * The step index to resume from for a routine resolved as 'in-progress'.
 * Prefers the live reducer's own stepIndex when this routine is genuinely
 * the one currently live (the freshest source), falling back to the
 * stored snapshot otherwise - never the OTHER routine's step index, since
 * both inputs are already scoped to this one sessionId by the caller.
 */
export const resolveRoutineStepIndex = ({ sessionId, liveState, snapshot }) => {
  if (liveState?.sessionId === sessionId) return liveState.stepIndex;
  return snapshot?.stepIndex ?? 0;
};

/**
 * Whether the OTHER routine (not the one currently selected on the
 * Morning/Evening pill) should show a distinct, clearly-labelled "paused"
 * banner - never presented as if it were the selected routine's own
 * state (the exact failure mode of the original bug). `otherCardState` is
 * that other routine's own resolveRoutineCardState() result.
 */
export const shouldShowCrossRoutineBanner = ({ selectedSessionId, otherSessionId, otherCardState }) =>
  selectedSessionId !== otherSessionId && otherCardState === 'in-progress';

/**
 * Whether to offer the "yesterday's unfinished routine" choice for one
 * routine: only when there's genuinely no progress recorded for TODAY
 * (todaySnapshot null and not already doneToday) but a stale, prior-day
 * entry does exist. Never shown once today has its own entry - a fresh
 * Begin already takes priority over an old, unrelated day's leftover step.
 */
export const shouldOfferStaleRoutineChoice = ({ doneToday, todaySnapshot, staleSnapshot }) =>
  !doneToday && !todaySnapshot && Boolean(staleSnapshot?.isStale);

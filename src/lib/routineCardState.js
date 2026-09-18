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

// Only these two statuses represent a genuinely UNFINISHED routine - a
// stale entry whose status is 'completed' (finished, just never cleared)
// or 'skipped' (the user explicitly chose Exit routine) is a resolved
// outcome, not something to re-surface as "unfinished, resume?" the next
// day. Deliberate policy call: SKIPPED is a terminal state in the Session
// Engine's own enum (sessionReducer.js), on the same footing as COMPLETED
// - re-litigating a deliberate exit as if it were forgotten progress
// would be confusing, not helpful.
const UNFINISHED_STATUSES = ['playing', 'interrupted'];

/**
 * Whether to offer the "yesterday's unfinished routine" choice for one
 * routine: only when there's genuinely no progress recorded for TODAY
 * (todaySnapshot null and not already doneToday), a stale, prior-day entry
 * does exist, AND that entry's own status is genuinely unfinished (see
 * UNFINISHED_STATUSES above - excludes a stale entry that actually
 * completed or was deliberately abandoned). Never shown once today has
 * its own entry - a fresh Begin already takes priority over an old,
 * unrelated day's leftover step.
 */
export const shouldOfferStaleRoutineChoice = ({ doneToday, todaySnapshot, staleSnapshot }) =>
  !doneToday &&
  !todaySnapshot &&
  Boolean(staleSnapshot?.isStale) &&
  UNFINISHED_STATUSES.includes(staleSnapshot?.status);

const dateKeyToUTCDate = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const FRIENDLY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
});

/**
 * A user-friendly label for a stale routine's own original local date,
 * e.g. "Yesterday" or "Sep 16" - pure calendar-day arithmetic over two
 * already-resolved 'YYYY-MM-DD' dateKeys (see timezone.js's own
 * getZonedParts), never touching the real clock or timezone itself, so
 * this stays deterministic and directly testable across any date
 * boundary. `todayDateKey` is the caller's own already-resolved "today"
 * (Home.jsx's `today`), not recomputed here.
 */
export const formatStaleRoutineDate = (dateKey, todayDateKey) => {
  if (!dateKey || !todayDateKey) return '';
  if (dateKey === todayDateKey) return 'Today';
  const diffDays = Math.round((dateKeyToUTCDate(todayDateKey) - dateKeyToUTCDate(dateKey)) / 86400000);
  if (diffDays === 1) return 'Yesterday';
  return FRIENDLY_DATE_FORMATTER.format(dateKeyToUTCDate(dateKey));
};

/**
 * Whether a "completed today" date flag actually needs writing - false
 * once it already holds this exact dateKey. This codebase's data model
 * tracks daily completion as a single boolean-per-day flag (see
 * routineProgress.js's own doc comment), not a counter or a per-session
 * history table, so a same-day repeat completion re-affirming the exact
 * same value is a pure no-op: never a second write, never any kind of
 * "double credit", because there is no counter here to increment in the
 * first place.
 */
export const shouldWriteCompletionDate = (currentValue, dateKey) => currentValue !== dateKey;

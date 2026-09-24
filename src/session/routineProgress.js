import { getSessionById } from './sessionRegistry';
import { SESSION_STATUS } from './sessionReducer';
import { getZonedParts, getCachedTimezone } from '../lib/timezone';

/*
 * Build 10 remediation — per-routine progress snapshots.
 *
 * ROOT CAUSE this fixes: SessionContext/sessionReducer/sessionPersistence
 * (Stage 3C) deliberately model exactly ONE globally-active session at a
 * time - one flat { sessionId, stepIndex, status, ... } blob, one storage
 * key. That's a correct, simple design for "what is the Session Engine
 * doing right now", but it has no notion of "Morning routine progress"
 * and "Evening routine progress" as two independent things - starting a
 * different routine while one is playing/interrupted requires an
 * explicit resetSession() first (see sessionReducer.js's own
 * START_SESSION precondition), which wipes sessionId/stepIndex back to
 * canonical idle and permanently loses the OTHER routine's paused step.
 * That is the direct mechanism behind both Build 10 reports: the
 * Morning/Evening resume card only ever reflects whichever routine is
 * CURRENTLY live in that one global slot, with no way to tell "Morning
 * is paused at step 3" and "Evening is paused at step 2" apart, or to
 * resume one without having already discarded the other.
 *
 * This module adds a second, independent, additive store - one entry per
 * sessionId, each stamped with the local calendar date (device timezone,
 * via the same getCachedTimezone()/getZonedParts() primitives every other
 * "what day is it for this user" check in this codebase already uses -
 * see timezone.js's own file header) it was last updated on. It never
 * reads/writes sessionPersistence.js's own key, and never touches
 * completed-session history, journal entries, reflections, or the daily
 * moonlight_morning_completed_date/moonlight_evening_completed_date flags
 * (Home.jsx's own separate, simpler "did you finish today" signal,
 * intentionally left as the authoritative "completed" source - this
 * module only tracks in-progress/paused step position).
 *
 * DAILY LIFECYCLE: an entry whose stored dateKey isn't today's is stale
 * by definition - getRoutineProgress() returns null for it (so a fresh
 * "not started today" state is what Home.jsx sees), while
 * getRoutineProgressIncludingStale() still surfaces it (tagged
 * isStale: true) for an explicit "yesterday's unfinished routine" choice
 * rather than silently carrying it into today or silently discarding it.
 */

// Exported (not just module-local) so morningFlowMigration.js/
// embeddedMeditationMigration.js can each perform their own targeted,
// selective read/rewrite of this exact store without duplicating these
// literals — see morningFlowMigration.js's own doc comment for why a
// blunt version-mismatch rejection here would be wrong for this store (it
// would discard a perfectly valid Evening entry alongside Morning's), and
// embeddedMeditationMigration.js's own doc comment for why THIS bump
// (2 -> 3) discards an unfinished entry for either routine.
export const ROUTINE_PROGRESS_KEY = 'moonlight_routine_progress';
export const ROUTINE_PROGRESS_VERSION = 3;

// "Resume Previous Routine" remediation — a small, separate store mapping
// sessionId -> the ORIGINAL local dateKey a stale routine was resumed
// from. Deliberately its own key/shape (not folded into the routines
// object above): it needs to survive independently of any single
// snapshot write, and its presence is itself the signal "the live session
// for this sessionId is a continuation of a PREVIOUS day's routine, not
// today's" - saveRoutineProgress consults it below so every subsequent
// step-by-step mirror write, while that previous-day session is actively
// being played out, keeps stamping the ORIGINAL date instead of silently
// re-dating it to today (the exact "falsely recorded as today's routine"
// failure this whole mechanism exists to prevent). Cleared the moment
// that particular run ends (completed, abandoned, or reset) - see
// SessionContext.jsx's resetSession/abandonSession/resetRoutine.
// Exported for the same reason as ROUTINE_PROGRESS_KEY/VERSION above.
export const PINNED_DATE_KEY = 'moonlight_routine_progress_pinned_date';

const readPinnedDates = () => {
  try {
    const raw = localStorage.getItem(PINNED_DATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writePinnedDates = (pins) => {
  try {
    localStorage.setItem(PINNED_DATE_KEY, JSON.stringify(pins));
  } catch {
    // storage unavailable - in-memory only for this session, same silent-noop convention as the rest of this module.
  }
};

/** Pins `sessionId` to a specific dateKey - call exactly once, the moment a stale (prior-day) routine is resumed. */
export const pinRoutineDate = (sessionId, dateKey) => {
  if (!sessionId || typeof dateKey !== 'string' || !dateKey) return;
  const pins = readPinnedDates();
  pins[sessionId] = dateKey;
  writePinnedDates(pins);
};

/** The pinned original dateKey for this routine, or null if it isn't currently pinned. */
export const getPinnedRoutineDate = (sessionId) => {
  const pins = readPinnedDates();
  return typeof pins[sessionId] === 'string' ? pins[sessionId] : null;
};

/** Clears the pin for exactly this routine - idempotent, safe to call even when nothing was pinned. */
export const unpinRoutineDate = (sessionId) => {
  const pins = readPinnedDates();
  if (!(sessionId in pins)) return;
  delete pins[sessionId];
  writePinnedDates(pins);
};

const VALID_STATUSES = Object.values(SESSION_STATUS);

const todayDateKey = () => getZonedParts(getCachedTimezone(), new Date()).dateKey;

const readAll = () => {
  try {
    const raw = localStorage.getItem(ROUTINE_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== ROUTINE_PROGRESS_VERSION) return {};
    return parsed.routines && typeof parsed.routines === 'object' ? parsed.routines : {};
  } catch {
    return {};
  }
};

const writeAll = (routines) => {
  try {
    localStorage.setItem(ROUTINE_PROGRESS_KEY, JSON.stringify({ version: ROUTINE_PROGRESS_VERSION, routines }));
  } catch {
    // storage unavailable/exceeded - in-memory only for this session,
    // same silent-noop convention as sessionPersistence.js/AlarmContext.jsx.
  }
};

// Defensive shape + referential validation, mirroring
// sessionPersistence.js's own validateRuntimeState - never trusts a
// corrupted/tampered entry, and never trusts a stepIndex that doesn't
// actually exist in THIS sessionId's own registry definition (the "fail
// safely to that routine's start screen rather than opening the other
// routine" requirement starts here: an out-of-range index is rejected
// outright, never clamped into some other step). Returns null (never
// throws) if anything about the candidate can't be trusted.
const validateEntry = (sessionId, candidate) => {
  if (!candidate || typeof candidate !== 'object') return null;
  const { stepIndex, status, startedAt, updatedAt, completionEventId, dateKey } = candidate;
  if (!VALID_STATUSES.includes(status)) return null;
  if (!Number.isInteger(stepIndex) || stepIndex < 0) return null;
  if (typeof dateKey !== 'string' || !dateKey) return null;
  const session = getSessionById(sessionId);
  if (!session || stepIndex >= session.steps.length) return null;
  return { stepIndex, status, startedAt: startedAt ?? null, updatedAt: updatedAt ?? null, completionEventId: completionEventId ?? null, dateKey };
};

/**
 * Upserts one routine's own snapshot, stamped with today's local calendar
 * date - never touches any other sessionId's entry. `snapshot` is the
 * subset of the live reducer's state worth remembering (stepIndex,
 * status, startedAt, updatedAt, completionEventId) - never called with a
 * null/idle sessionId (nothing routine-specific to store for "no active
 * session"), matching SessionContext.jsx's own mirror-effect guard.
 */
export const saveRoutineProgress = (sessionId, snapshot) => {
  if (!sessionId || !getSessionById(sessionId)) return;
  const all = readAll();
  // A pinned date (set by resumeStaleRoutine) means this write belongs to
  // a previous-day session being continued right now - keep stamping ITS
  // original date, never today's, until the pin is cleared.
  const pinnedDateKey = getPinnedRoutineDate(sessionId);
  all[sessionId] = {
    stepIndex: snapshot?.stepIndex ?? 0,
    status: snapshot?.status ?? SESSION_STATUS.IDLE,
    startedAt: snapshot?.startedAt ?? null,
    updatedAt: snapshot?.updatedAt ?? null,
    completionEventId: snapshot?.completionEventId ?? null,
    dateKey: pinnedDateKey ?? todayDateKey()
  };
  writeAll(all);
};

/**
 * The routine's own snapshot, only if it's from today - null for "no
 * saved progress" and for "saved progress exists but it's from a
 * previous local day" alike, since both mean the same thing to a caller
 * that only wants TODAY's state (see getRoutineProgressIncludingStale
 * for the one caller - the "yesterday's unfinished routine" prompt -
 * that needs to tell those two apart).
 */
export const getRoutineProgress = (sessionId) => {
  const entry = validateEntry(sessionId, readAll()[sessionId]);
  if (!entry) return null;
  if (entry.dateKey !== todayDateKey()) return null;
  return entry;
};

/** Same lookup, but a stale (not-today) entry is returned too, tagged `isStale: true`. */
export const getRoutineProgressIncludingStale = (sessionId) => {
  const entry = validateEntry(sessionId, readAll()[sessionId]);
  if (!entry) return null;
  return { ...entry, isStale: entry.dateKey !== todayDateKey() };
};

/** Removes exactly one routine's snapshot - "Start Over"/"Do Again", or a stale-entry dismissal. Idempotent. */
export const clearRoutineProgress = (sessionId) => {
  const all = readAll();
  if (!(sessionId in all)) return;
  delete all[sessionId];
  writeAll(all);
};

/**
 * Wipes every routine's snapshot - sign-out / user-switch isolation, so
 * one user's in-progress step can never be shown to the next signed-in
 * user on the same device. Idempotent.
 */
export const clearAllRoutineProgress = () => {
  writeAll({});
  writePinnedDates({});
};

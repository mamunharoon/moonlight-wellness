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

const ROUTINE_PROGRESS_KEY = 'moonlight_routine_progress';
const ROUTINE_PROGRESS_VERSION = 1;

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
  all[sessionId] = {
    stepIndex: snapshot?.stepIndex ?? 0,
    status: snapshot?.status ?? SESSION_STATUS.IDLE,
    startedAt: snapshot?.startedAt ?? null,
    updatedAt: snapshot?.updatedAt ?? null,
    completionEventId: snapshot?.completionEventId ?? null,
    dateKey: todayDateKey()
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
};

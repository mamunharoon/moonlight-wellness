import { SESSION_STORAGE_KEY, SESSION_STORAGE_VERSION } from './sessionPersistence';
import { ROUTINE_PROGRESS_KEY, ROUTINE_PROGRESS_VERSION } from './routineProgress';
import { SESSION_STATUS } from './sessionReducer';

/*
 * Journey Embedding (Self-Guided Meditation) — one-time, targeted
 * migration, same precedent and shape as morningFlowMigration.js.
 *
 * WHY THIS EXISTS
 * sessionPersistence.js/routineProgress.js each persist a bare integer
 * `stepIndex`, never a step id (see sessionPersistence.js's own doc
 * comment). Inserting 'meditate'/'meditation' into MORNING_ROUTINE_SESSION
 * and EVENING_ROUTINE_SESSION shifts every step index after breathe/
 * breathing by one in BOTH registries. A live/paused session persisted
 * under the old indices would, after this deploy, have its stored integer
 * silently resolve to the WRONG step (e.g. Evening index 4 meant
 * 'sleepPreparation' before this deploy; it means 'meditation' after) -
 * exactly the failure mode morningFlowMigration.js already exists to
 * prevent for Morning alone.
 *
 * DIFFERENCE FROM morningFlowMigration.js — BOTH sessions change shape
 * this time, not just Morning. That migration could carry Evening's own
 * v1 snapshot forward byte-for-byte because Evening's step order was
 * genuinely unaffected by the Morning-only 'start' removal. This time
 * there is no unaffected session to preserve: both MORNING_ROUTINE_SESSION
 * and EVENING_ROUTINE_SESSION gained a new step, so any 'playing'/
 * 'interrupted' snapshot for EITHER sessionId is discarded - the same
 * "remapping would be a guess, not a fact" reasoning, applied to both
 * routines this time instead of one.
 *
 * WHAT SURVIVES UNTOUCHED (this migration touches only the two keys named
 * above, nothing else)
 *   - completed-day flags (moonlight_morning_completed_date/
 *     moonlight_evening_completed_date - a different key, Home.jsx's own
 *     separate "did you finish today" signal, never read/written here);
 *   - Morning intentions (moonlight_intentions - a different key);
 *   - Evening Reflection/Gratitude journal responses (routineResponses.js's
 *     own storage - a different key/module entirely);
 *   - any other preference/media-related localStorage key.
 * A 'completed'/'skipped' terminal snapshot for either session is
 * preserved as-is (rewritten under the bumped version, same policy
 * sessionPersistence.js's own doc comment already documents for the
 * general stale-session case) - only a genuinely in-progress
 * 'playing'/'interrupted' position is discarded, since only THAT shape is
 * actually stepIndex-sensitive in a way this deploy invalidates.
 *
 * DEV CONSEQUENCE (stated plainly, for the delivery report)
 *   A user with an interrupted Morning or Evening session at the moment
 *   this deploys will restart that journey from its beginning, once, the
 *   next time they open it. Completed journey history and already-entered
 *   responses remain intact.
 *
 * RUNS ONCE, IDEMPOTENT, CLIENT-LOCAL ONLY
 *   Gated by MIGRATION_MARKER_KEY, same pattern as
 *   morningFlowMigration.js. Called at module-evaluation time (see the
 *   bottom of sessionPersistence.js... no - see SessionContext.jsx, which
 *   already calls runMorningFlowMigration() at module-evaluation time;
 *   this migration is invoked the exact same way, from the exact same
 *   place, immediately after it) - so it always completes before the
 *   first render of anything that reads these stores, including Home.jsx's
 *   direct render-time read of routineProgress.js. Touches only
 *   localStorage; no Supabase call anywhere in this file.
 */

export const EMBEDDED_MEDITATION_MIGRATION_MARKER_KEY = 'moonlight_embedded_meditation_migration_v3';

const MORNING_SESSION_ID = 'morning-routine';
const EVENING_SESSION_ID = 'evening-wind-down';
const UNFINISHED_STATUSES = new Set([SESSION_STATUS.PLAYING, SESSION_STATUS.INTERRUPTED]);

const safeGet = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable/exceeded - same silent-noop convention as every
    // other localStorage touch in this codebase.
  }
};

const safeRemove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // no-op
  }
};

// Migrates the single global live-session slot. Malformed storage (missing
// key, corrupt JSON, not an object) fails safely - removed or left alone,
// never thrown.
const migrateSessionProgress = () => {
  const raw = safeGet(SESSION_STORAGE_KEY);
  if (!raw) return;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemove(SESSION_STORAGE_KEY); // corrupt - cannot trust it either way
    return;
  }

  if (!parsed || typeof parsed !== 'object' || parsed.version === SESSION_STORAGE_VERSION) {
    return; // already current version (or unrecognisable) - nothing to migrate
  }

  const state = parsed.state;
  const isUnfinishedMorningOrEvening =
    (state?.sessionId === MORNING_SESSION_ID || state?.sessionId === EVENING_SESSION_ID) &&
    UNFINISHED_STATUSES.has(state?.status);

  if (isUnfinishedMorningOrEvening) {
    // Both registries changed shape - discard outright, same as
    // morningFlowMigration.js's own Morning-only discard branch.
    safeRemove(SESSION_STORAGE_KEY);
    return;
  }

  // idle/completed/skipped (or an unrecognised sessionId) - not
  // stepIndex-sensitive in a way this deploy invalidates; carry forward
  // byte-for-byte under the bumped version, same policy
  // sessionPersistence.js's own doc comment already documents.
  if (state) {
    safeSet(SESSION_STORAGE_KEY, JSON.stringify({ version: SESSION_STORAGE_VERSION, state }));
  } else {
    safeRemove(SESSION_STORAGE_KEY);
  }
};

// Migrates the per-sessionId routine-progress map. Same malformed-storage
// safety as above.
const migrateRoutineProgress = () => {
  const raw = safeGet(ROUTINE_PROGRESS_KEY);
  if (!raw) return;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemove(ROUTINE_PROGRESS_KEY);
    return;
  }

  if (!parsed || typeof parsed !== 'object' || parsed.version === ROUTINE_PROGRESS_VERSION) {
    return;
  }

  const routines = parsed.routines && typeof parsed.routines === 'object' ? parsed.routines : {};
  const survivingRoutines = {};
  for (const [sessionId, entry] of Object.entries(routines)) {
    const isMorningOrEvening = sessionId === MORNING_SESSION_ID || sessionId === EVENING_SESSION_ID;
    const isUnfinished = isMorningOrEvening && UNFINISHED_STATUSES.has(entry?.status);
    if (isUnfinished) continue; // discarded - stepIndex-sensitive, both registries changed shape
    survivingRoutines[sessionId] = entry;
  }

  safeSet(ROUTINE_PROGRESS_KEY, JSON.stringify({ version: ROUTINE_PROGRESS_VERSION, routines: survivingRoutines }));
};

/**
 * Runs the full one-time migration described above. Safe to call more
 * than once - the marker check makes every call after the first a pure
 * no-op.
 */
export const runEmbeddedMeditationMigration = () => {
  let alreadyRan;
  try {
    alreadyRan = localStorage.getItem(EMBEDDED_MEDITATION_MIGRATION_MARKER_KEY) === 'done';
  } catch {
    return; // storage unavailable - nothing safe to do, nothing to mark either
  }
  if (alreadyRan) return;

  migrateSessionProgress();
  migrateRoutineProgress();

  safeSet(EMBEDDED_MEDITATION_MIGRATION_MARKER_KEY, 'done');
};

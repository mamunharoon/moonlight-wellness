import { SESSION_STORAGE_KEY, SESSION_STORAGE_VERSION } from './sessionPersistence';
import { ROUTINE_PROGRESS_KEY, ROUTINE_PROGRESS_VERSION, PINNED_DATE_KEY } from './routineProgress';
import { SESSION_STATUS } from './sessionReducer';

/*
 * Morning-flow reorder — one-time, targeted migration (Intend/Stretch/
 * Breathe/Affirm/Complete, 'start' removed).
 *
 * WHY THIS EXISTS, NOT JUST A VERSION-MISMATCH REJECTION
 * sessionPersistence.js and routineProgress.js each reject a stored blob
 * outright when its `version` field doesn't match the current constant -
 * a fine, simple rule when the whole store belongs to one thing. But both
 * of those stores are SHARED between the Morning and Evening routines
 * (one global live-session slot; one per-sessionId snapshot map). A bare
 * version bump would discard an in-progress Evening session's real,
 * still-valid progress for no reason connected to it at all - Evening's
 * step order/count did not change. This module runs BEFORE either loader
 * ever sees a v1 blob, and rewrites each store in place: an Evening entry
 * is carried forward byte-for-byte under the new version number; a
 * Morning entry (the only side that actually changed shape) is the only
 * thing discarded. Only after this has run does the bumped
 * SESSION_STORAGE_VERSION/ROUTINE_PROGRESS_VERSION check in each loader
 * ever apply, and by then every stored blob already matches it.
 *
 * WHY NOT ATTEMPT TO REMAP MORNING'S OLD STEP POSITION INSTEAD OF
 * DISCARDING IT
 * Both Morning stores persist a bare integer `stepIndex`, never a step
 * id. Under the old 7-step order index 2 meant 'affirmation'; under the
 * new 5-step order index 2 means 'breathe'. There is no way to tell,
 * from the stored integer alone, which order it was written under - any
 * remapping would be a guess, not a fact, and would risk silently
 * resuming a real paused user on the wrong step. Discarding only
 * Morning's stored position and offering a clean fresh start is the
 * explicit, approved fallback for exactly this situation.
 *
 * WHY moonlight_journey_step IS CLEARED ENTIRELY, NOT SELECTIVELY
 * This key (AlarmContext.jsx) is written ONLY by Morning pages - grepped
 * confirmed zero Evening page ever imports setJourneyStep. Any value it
 * holds at the moment this migration runs necessarily predates this
 * deploy (nothing new could have written a post-reorder value yet), so
 * clearing it unconditionally is safe and cannot affect Evening in any
 * way. Left in place, a stale value like 'affirmation' could otherwise
 * route the user (via useActiveRoutineStep's legacy-string fallback)
 * onto the Affirm screen with no real active Session Engine session
 * behind it - "resuming" a step the user never asked to resume, the
 * exact silent-wrong-step failure mode this whole migration exists to
 * prevent.
 *
 * RUNS ONCE, IDEMPOTENT
 * Gated by MIGRATION_MARKER_KEY. Called at module-evaluation time from
 * session/sessionPersistence.js's own import (see that file's bottom) -
 * NOT from a React effect - specifically so it completes before the
 * first render of anything that reads these stores directly at render
 * time (Home.jsx's routineCardState resolution), not just before
 * SessionProvider's own mount-restore effect. ES module evaluation is
 * synchronous and depth-first, so by the time main.jsx ever calls
 * ReactDOM's render(), this has already run exactly once.
 */

export const MORNING_FLOW_MIGRATION_MARKER_KEY = 'moonlight_morning_flow_migration_v2';
export const MORNING_FLOW_MIGRATION_NOTICE_KEY = 'moonlight_morning_flow_migration_notice';
const JOURNEY_STEP_KEY = 'moonlight_journey_step';

const MORNING_SESSION_ID = 'morning-routine';
const EVENING_SESSION_ID = 'evening-wind-down';

// Values moonlight_journey_step can hold that represent genuinely
// unfinished (not merely pre-start or already-terminal) Morning progress
// - used only to decide whether the one-time user-facing notice is
// worth showing, never to decide what gets cleared (everything gets
// cleared regardless, per the doc comment above).
const UNFINISHED_JOURNEY_STEPS = new Set(['start', 'affirmation', 'stretch', 'breathe', 'intention']);
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

// Migrates the single global live-session slot. Returns true if a live
// Morning session in 'playing'/'interrupted' status was discarded (worth
// mentioning in the notice).
const migrateSessionProgress = () => {
  const raw = safeGet(SESSION_STORAGE_KEY);
  if (!raw) return false;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemove(SESSION_STORAGE_KEY); // corrupt - cannot trust it either way
    return false;
  }

  if (!parsed || typeof parsed !== 'object' || parsed.version === SESSION_STORAGE_VERSION) {
    return false; // already current version (or unrecognisable) - nothing to migrate
  }

  const state = parsed.state;
  if (state && state.sessionId === EVENING_SESSION_ID) {
    // Evening's shape did not change - carry it forward byte-for-byte,
    // only the wrapper version advances.
    safeSet(SESSION_STORAGE_KEY, JSON.stringify({ version: SESSION_STORAGE_VERSION, state }));
    return false;
  }

  const wasUnfinishedMorning =
    state?.sessionId === MORNING_SESSION_ID && UNFINISHED_STATUSES.has(state?.status);
  // Morning (or anything else - null/idle/unrecognised sessionId) is
  // discarded outright: clearing the live slot safely means removing it,
  // not writing a placeholder idle record under the new version.
  safeRemove(SESSION_STORAGE_KEY);
  return wasUnfinishedMorning;
};

// Migrates the per-sessionId routine-progress map. Returns true if a
// Morning entry in 'playing'/'interrupted' status was discarded.
const migrateRoutineProgress = () => {
  const raw = safeGet(ROUTINE_PROGRESS_KEY);
  if (!raw) return false;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemove(ROUTINE_PROGRESS_KEY);
    return false;
  }

  if (!parsed || typeof parsed !== 'object' || parsed.version === ROUTINE_PROGRESS_VERSION) {
    return false;
  }

  const routines = parsed.routines && typeof parsed.routines === 'object' ? parsed.routines : {};
  const morningEntry = routines[MORNING_SESSION_ID];
  const wasUnfinishedMorning = Boolean(morningEntry && UNFINISHED_STATUSES.has(morningEntry.status));

  // Keep Evening's own entry byte-for-byte if present; drop Morning's
  // (and, conservatively, anything else - only these two sessionIds are
  // real today) rather than carrying forward a shape that might not
  // match the new registry.
  const survivingRoutines = {};
  if (routines[EVENING_SESSION_ID]) {
    survivingRoutines[EVENING_SESSION_ID] = routines[EVENING_SESSION_ID];
  }

  safeSet(ROUTINE_PROGRESS_KEY, JSON.stringify({ version: ROUTINE_PROGRESS_VERSION, routines: survivingRoutines }));
  return wasUnfinishedMorning;
};

// Strips a Morning-only pin (see resumeStaleRoutine/pinRoutineDate in
// routineProgress.js) from the pinned-date map, preserving Evening's own
// pin (if any) untouched. This store carries no version field of its own
// - removing an already-absent key is a naturally safe no-op, so this
// runs every time this module runs (still exactly once overall, gated by
// the shared marker below like everything else here).
const migratePinnedDates = () => {
  const raw = safeGet(PINNED_DATE_KEY);
  if (!raw) return;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemove(PINNED_DATE_KEY);
    return;
  }

  if (!parsed || typeof parsed !== 'object') return;
  if (!(MORNING_SESSION_ID in parsed)) return; // nothing Morning-specific to strip

  const rest = { ...parsed };
  delete rest[MORNING_SESSION_ID];
  safeSet(PINNED_DATE_KEY, JSON.stringify(rest));
};

// Clears the legacy Morning-only string tracker entirely - see the doc
// comment above for why this is always safe. Returns true if the value
// it held represented genuinely unfinished (not pre-start/terminal)
// progress.
const migrateJourneyStep = () => {
  const value = safeGet(JOURNEY_STEP_KEY);
  if (!value) return false;
  safeRemove(JOURNEY_STEP_KEY);
  return UNFINISHED_JOURNEY_STEPS.has(value);
};

/**
 * Runs the full one-time migration described above. Safe to call more
 * than once (e.g. multiple module instantiations in tests) - the marker
 * check makes every call after the first a pure no-op.
 */
export const runMorningFlowMigration = () => {
  let alreadyRan;
  try {
    alreadyRan = localStorage.getItem(MORNING_FLOW_MIGRATION_MARKER_KEY) === 'done';
  } catch {
    return; // storage unavailable - nothing safe to do, nothing to mark either
  }
  if (alreadyRan) return;

  const foundUnfinishedA = migrateSessionProgress();
  const foundUnfinishedB = migrateRoutineProgress();
  migratePinnedDates();
  const foundUnfinishedC = migrateJourneyStep();

  if (foundUnfinishedA || foundUnfinishedB || foundUnfinishedC) {
    safeSet(MORNING_FLOW_MIGRATION_NOTICE_KEY, 'pending');
  }

  safeSet(MORNING_FLOW_MIGRATION_MARKER_KEY, 'done');
};

/**
 * One-shot read: true exactly once, the first time it's called after
 * runMorningFlowMigration() found genuinely unfinished Build-10 Morning
 * progress to discard - clears its own flag immediately so it can never
 * fire twice, even across reloads. Home.jsx is this flag's one intended
 * reader (see the required user-facing copy there).
 */
export const consumeMorningFlowMigrationNotice = () => {
  let pending;
  try {
    pending = localStorage.getItem(MORNING_FLOW_MIGRATION_NOTICE_KEY) === 'pending';
  } catch {
    return false;
  }
  if (!pending) return false;
  safeRemove(MORNING_FLOW_MIGRATION_NOTICE_KEY);
  return true;
};

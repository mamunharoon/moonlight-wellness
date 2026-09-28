import { supabase } from './supabaseClient';
import { getZonedParts, isValidTimezone } from './timezone';

// "Your Momentum" foundation, Phase 2 — the ONE shared writer for
// practice_completion_events (20260928000000_practice_completion_events.sql).
// Every wired completion path (SessionComplete.jsx's Morning routine,
// EveningComplete.jsx's Evening routine, Meditate.jsx's guided-video
// meditation) calls this same function - never a second, competing
// completion-writing path, and never a direct supabase.from(TABLE) call
// from a page component itself (matches routineResponses.js's own
// established shape: one client module owns a table's writes).
//
// This module never fabricates a completion, never silently turns a real
// database failure into a reported success, and never exposes another
// user's data (it never SELECTs at all - Phase 2 is write-only from the
// client; nothing yet needs to read this table back). A persistence
// failure is always returned as an honest `{ ok: false }` result - the
// caller's own journey navigation is never gated on this call succeeding
// (see each wired screen's own doc comment for why).
//
// Duration policy - deliberately per-practice-type, not one shared rule:
//   - Meditate.jsx guided-video meditation: the real media element's own
//     .duration (via BetaVideoModal's onDurationKnown) - a genuine,
//     verified measurement of what was actually played.
//   - SessionComplete.jsx (Morning) / EveningComplete.jsx (Evening) full
//     routines: always null. The Session Engine only records
//     state.startedAt/state.updatedAt - wall-clock timestamps that
//     include any time genuinely spent interrupted/backgrounded
//     mid-routine (INTERRUPT_SESSION/RESUME_SESSION both advance
//     updatedAt). Their difference is real elapsed time, not active/
//     mindful time, so persisting it here would silently overstate
//     engagement as fact. There is no existing accumulator anywhere in
//     this codebase that tracks only genuinely active (non-paused) time,
//     and Phase 2 deliberately does not build one - that is real new
//     timing architecture, out of this phase's scope. Routine mindful-
//     minute insights are simply unavailable until such a measurement
//     exists; null is the honest reflection of that, never a value to
//     approximate around it.
const TABLE = 'practice_completion_events';

// The exact, already-established app-wide guided-media completion journey
// allowlist (src/lib/mediaCompletionPresentation.js's own
// MEDIA_COMPLETION_JOURNEYS) - kept in lock-step with the migration's own
// CHECK constraint so an invalid value is rejected here, client-side,
// before ever reaching the database.
export const JOURNEY_VALUES = Object.freeze(['morning', 'anytime', 'evening', 'library', 'direct']);

// Only the two practice types Phase 2 actually wires - see the migration's
// own doc comment for how this list is meant to be widened later.
export const PRACTICE_TYPE_VALUES = Object.freeze(['full_routine', 'meditation']);

// Postgres unique_violation - the exact code the owner_idempotency_key
// constraint raises for a genuine duplicate (retried failed write,
// StrictMode double-invoke, or a second callback for the same run). Never
// surfaced to the caller as a failure - the completion is already durably
// recorded under this exact (user_id, idempotency_key) pair, so this is
// the successful, idempotent outcome the whole design exists to guarantee.
const UNIQUE_VIOLATION = '23505';

// Never attempts a write for a guest or a missing/anonymous identity - the
// existing journey experience for signed-out use is untouched; this is
// simply never called into for them (matches every other restricted write
// in this app - e.g. routineResponses.js's own isGuest gate precedent).
const isEligibleUser = (userId, isGuest) => Boolean(userId) && !isGuest;

/**
 * Records one genuine practice completion. Returns an explicit result,
 * never throws:
 *   { ok: true }                     — durably recorded (first time)
 *   { ok: true, deduplicated: true } — already recorded under this exact
 *                                       (userId, sessionId) pair; a
 *                                       harmless, expected outcome for a
 *                                       retried or duplicated call, never
 *                                       a second row
 *   { ok: false, reason }            — rejected before ever reaching the
 *                                       database (bad input, guest/no
 *                                       user) - `reason` is a short,
 *                                       stable machine-readable string
 *   { ok: false, error }             — a genuine database/network failure
 *                                       (RLS denial, offline, etc.)
 *
 * @param {object} params
 * @param {string|null} params.userId - authenticated Supabase user id (see
 *   dailyCompletion.js's own convention - never an email address).
 * @param {boolean} params.isGuest - true for a guest/anonymous session.
 * @param {string} params.sessionId - stable id for ONE genuine run. For
 *   Morning/Evening full routines this is the Session Engine's own
 *   state.completionEventId (session/sessionReducer.js); for Meditate.jsx
 *   guided-video meditation this is a client-generated UUID minted per
 *   genuine open/replay (see that file's own doc comment). Also used
 *   verbatim as idempotency_key - see the migration's own doc comment for
 *   why the two columns hold the same value in Phase 2.
 * @param {'morning'|'anytime'|'evening'|'library'|'direct'} params.journey
 * @param {'full_routine'|'meditation'} params.practiceType
 * @param {number|null} [params.durationSeconds] - credited duration in
 *   whole seconds, or null when no genuine measured duration exists. Never
 *   negative (rejected below) - see each wired screen's own doc comment
 *   for its specific credited-duration policy.
 * @param {string} params.timezone - the effective IANA zone this
 *   completion is credited under (AlarmContext's effectiveTimezone,
 *   already validated/defaulted the same way every other daily-completion
 *   write in this app relies on).
 * @param {() => Date} [params.now] - test seam only; defaults to `new
 *   Date()`. Production callers never pass this (they already resolve
 *   their own "now" via lib/devClock.js's now() where relevant, same as
 *   every other completion-adjacent read in this app).
 */
export const recordPracticeCompletion = async ({
  userId,
  isGuest,
  sessionId,
  journey,
  practiceType,
  durationSeconds = null,
  timezone,
  now = () => new Date()
}) => {
  if (!isEligibleUser(userId, isGuest)) {
    return { ok: false, reason: 'not-authenticated' };
  }
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    return { ok: false, reason: 'invalid-session-id' };
  }
  if (!JOURNEY_VALUES.includes(journey)) {
    return { ok: false, reason: 'invalid-journey' };
  }
  if (!PRACTICE_TYPE_VALUES.includes(practiceType)) {
    return { ok: false, reason: 'invalid-practice-type' };
  }
  if (durationSeconds != null && (!Number.isFinite(durationSeconds) || durationSeconds < 0)) {
    return { ok: false, reason: 'invalid-duration' };
  }
  if (!supabase) {
    return { ok: false, reason: 'not-authenticated' };
  }

  const effectiveTimezone = isValidTimezone(timezone) ? timezone : 'UTC';
  const localDate = getZonedParts(effectiveTimezone, now()).dateKey;
  const roundedDuration = durationSeconds == null ? null : Math.round(durationSeconds);

  try {
    const { error } = await supabase.from(TABLE).insert({
      user_id: userId,
      session_id: sessionId,
      journey,
      practice_type: practiceType,
      duration_seconds: roundedDuration,
      local_date: localDate,
      timezone: effectiveTimezone,
      outcome: 'completed',
      idempotency_key: sessionId
    });

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return { ok: true, deduplicated: true };
      }
      console.warn('Practice completion event not recorded:', error.message);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (e) {
    console.warn('Practice completion event skipped:', e?.message);
    return { ok: false, error: e };
  }
};

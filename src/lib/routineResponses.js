import { supabase } from './supabaseClient';
import { REFLECTION_PROMPTS, GRATITUDE_PROMPTS } from './eveningJourneyQuestions';
import { getEveningCompletionKey, clearEveningCompletionKey } from './dailyCompletion';

// Client-side counterpart to the routine_responses migration
// (20260919120000) - Reflection.jsx/Gratitude.jsx's prompt answers, keyed
// by user + session + step + prompt + local-calendar-day. Guests are
// gated entirely at the calling page (the same isGuest check every other
// restricted write in this app already uses) - these functions assume a
// real userId and never attempt to infer guest-ness themselves.

const TABLE = 'routine_responses';
const CONFLICT_TARGET = 'user_id,session_id,step_id,prompt_id,local_date';

/**
 * Loads every saved prompt answer for one routine visit (all prompts for
 * this session+step+date at once) as a { [promptId]: response } map -
 * the exact shape PromptStepper's own `initialAnswers` prop expects.
 * Returns {} on any failure (missing table row, network error, no
 * userId) - a load failure must never block the screen from rendering
 * its prompts blank, same "continue silently" precedent as every other
 * best-effort read in this app.
 */
export const loadRoutineResponses = async ({ userId, sessionId, stepId, localDate }) => {
  if (!supabase || !userId) return {};
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('prompt_id, response')
      .match({ user_id: userId, session_id: sessionId, step_id: stepId, local_date: localDate });
    if (error || !data) return {};
    return Object.fromEntries(data.map((row) => [row.prompt_id, row.response]));
  } catch {
    return {};
  }
};

/**
 * Idempotent upsert on the exact (user, session, step, prompt, date)
 * conflict target - editing an existing response updates that same row,
 * never inserts a second one. A blank/whitespace-only value is a no-op
 * (never saved) rather than an error - see deleteRoutineResponse for
 * the explicit-clear path a truly-empty answer should use instead.
 */
export const upsertRoutineResponse = async ({ userId, sessionId, stepId, promptId, localDate, response }) => {
  if (!supabase || !userId) return;
  const trimmed = typeof response === 'string' ? response.trim() : '';
  if (!trimmed) return;
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        { user_id: userId, session_id: sessionId, step_id: stepId, prompt_id: promptId, local_date: localDate, response: trimmed },
        { onConflict: CONFLICT_TARGET }
      );
    if (error) {
      console.warn('Routine response saved locally only - cloud sync failed:', error.message);
    }
  } catch (e) {
    console.warn('Routine response saved locally only - cloud sync skipped:', e.message);
  }
};

/**
 * Explicit "Clear response?" confirmation path (the calling page shows
 * that confirmation itself - this function just performs the delete once
 * confirmed). Deletes at most the one exact matching row; never touches
 * any other prompt/step/date/user's rows.
 */
export const deleteRoutineResponse = async ({ userId, sessionId, stepId, promptId, localDate }) => {
  if (!supabase || !userId) return;
  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .match({ user_id: userId, session_id: sessionId, step_id: stepId, prompt_id: promptId, local_date: localDate });
    if (error) {
      console.warn('Routine response clear failed:', error.message);
    }
  } catch (e) {
    console.warn('Routine response clear skipped:', e.message);
  }
};

/**
 * Edit Tonight's Responses (Build 15) — saves every CHANGED answer across
 * both Reflection and Gratitude in one call. `entries` is a
 * { stepId, promptId, response }[] (see eveningJourneyQuestions.js's own
 * computeChangedEntries - the only intended source of this array).
 *
 * Genuinely atomic, with no RPC and no schema change: a single
 * `.upsert()` call given an ARRAY of rows compiles to one
 * `INSERT ... ON CONFLICT DO UPDATE` SQL statement covering every row at
 * once - Postgres itself guarantees that statement is all-or-nothing (a
 * constraint violation on any one row rolls back the whole statement,
 * never a partial write). `step_id` differing across rows within the
 * same array (Reflection vs Gratitude) does not change this - the
 * conflict target already includes step_id, so each row still resolves
 * to its own distinct existing-or-new row.
 *
 * Unlike upsertRoutineResponse/deleteRoutineResponse above, this never
 * swallows a failure - it returns an explicit { ok, error } result so
 * the caller can show an honest recoverable error state instead of
 * silently reporting success after a failed write.
 */
export const upsertRoutineResponsesBatch = async ({ userId, sessionId, localDate, entries }) => {
  if (!supabase || !userId) return { ok: false, error: new Error('Not authenticated') };
  const rows = (entries ?? [])
    .map((entry) => ({ ...entry, response: typeof entry.response === 'string' ? entry.response.trim() : '' }))
    .filter((entry) => entry.response)
    .map((entry) => ({
      user_id: userId,
      session_id: sessionId,
      step_id: entry.stepId,
      prompt_id: entry.promptId,
      local_date: localDate,
      response: entry.response
    }));
  if (rows.length === 0) return { ok: true };
  try {
    const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: CONFLICT_TARGET });
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
};

// Redo Tonight's Wind-Down (Build 15) — the exact set of Reflection/
// Gratitude prompt ids this deletion is allowed to ever touch, derived
// from the same shared question configuration every other Evening
// surface already uses (never a second, hand-maintained list that could
// silently drift). A future Evening step that persists its own
// routine_responses rows (e.g. a future Prepare for Rest question) is
// NOT in this list and is therefore structurally unreachable by this
// deletion, by construction - not by convention.
const EVENING_REFLECTION_GRATITUDE_PROMPT_IDS = [...REFLECTION_PROMPTS, ...GRATITUDE_PROMPTS].map((p) => p.id);
const EVENING_REFLECTION_GRATITUDE_STEP_IDS = ['reflection', 'gratitude'];
const EVENING_WIND_DOWN_SESSION_ID = 'evening-wind-down';

/**
 * Redo Tonight's Wind-Down (Build 15) — deliberately named for its exact,
 * narrow scope rather than a generic "delete all of today's Evening
 * rows" helper (approved correction: a broader helper would also reach
 * any future Evening step's own persisted rows, which must never happen
 * here). Deletes ONLY this user's own Reflection/Gratitude rows for the
 * evening-wind-down session on the one given local date - the session id
 * is not a parameter, it is the fixed literal this function's own name
 * promises.
 *
 * One atomic SQL DELETE (Postgres guarantees all-or-nothing for a single
 * statement, matching upsertRoutineResponsesBatch's own reasoning
 * above). `.select('prompt_id')` on the delete makes Supabase return the
 * rows it actually removed, so the caller can distinguish "matched and
 * removed N rows" from "matched zero rows" (a legitimate outcome for an
 * all-skipped completed journey) - both are `ok: true`; only a genuine
 * query/RLS/network error is ever `ok: false`, so a caller can never
 * mistake a failed delete for an empty-but-successful one.
 */
export const deleteEveningReflectionGratitudeResponsesForDate = async ({ userId, localDate }) => {
  if (!supabase || !userId) return { ok: false, error: new Error('Not authenticated') };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .match({ user_id: userId, session_id: EVENING_WIND_DOWN_SESSION_ID, local_date: localDate })
      .in('step_id', EVENING_REFLECTION_GRATITUDE_STEP_IDS)
      .in('prompt_id', EVENING_REFLECTION_GRATITUDE_PROMPT_IDS)
      .select('prompt_id');
    if (error) return { ok: false, error };
    return { ok: true, deletedCount: data?.length ?? 0 };
  } catch (e) {
    return { ok: false, error: e };
  }
};

/**
 * Redo Tonight's Wind-Down (Build 15 addendum) — the ONE shared
 * implementation of the whole destructive Redo sequence, used identically
 * by EveningComplete.jsx and Home.jsx's own completed-Evening card so
 * neither screen hand-rolls its own copy of this ordering (approved: do
 * not duplicate the deletion/reset logic between the two surfaces).
 *
 * Failure-safe, exactly as originally approved for EveningComplete.jsx:
 * (1) validate eligibility (never a guest, a real userId, and the
 * completion flag genuinely set to this exact localDate - never a stale
 * or future value), (2) the one narrowly-scoped atomic delete, (3) only
 * once that delete genuinely succeeds does it clear the completion flag
 * and reset the Session Engine's own evening-wind-down routine state.
 * Any failure at (1) or (2) returns `{ ok: false }` and mutates nothing
 * else - the existing completed journey is left exactly as it was, still
 * fully reviewable.
 *
 * `localDate` is resolved ONCE by the caller and passed in (matching
 * deleteEveningReflectionGratitudeResponsesForDate's own convention
 * above); `resetRoutine` is the caller's own SessionContext action.
 * Navigating to the canonical Evening start afterwards is the one
 * remaining step left to each caller's own useNavigate() - it is not a
 * data mutation, so it stays outside this function.
 */
export const redoEveningWindDown = async ({ userId, isGuest, localDate, resetRoutine }) => {
  const isEligible = !isGuest && Boolean(userId) && localStorage.getItem(getEveningCompletionKey(userId)) === localDate;
  if (!isEligible) return { ok: false };

  const result = await deleteEveningReflectionGratitudeResponsesForDate({ userId, localDate });
  if (!result.ok) return { ok: false };

  clearEveningCompletionKey(userId);
  resetRoutine(EVENING_WIND_DOWN_SESSION_ID);
  return { ok: true };
};

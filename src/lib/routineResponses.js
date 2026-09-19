import { supabase } from './supabaseClient';

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

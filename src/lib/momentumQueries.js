import { supabase } from './supabaseClient';

// "Your Momentum" foundation, Phase 3 — the ONE shared read path for
// practice_completion_events. Every screen that wants factual completion
// insights (SessionComplete.jsx, EveningComplete.jsx, Meditate.jsx) calls
// through this module rather than querying Supabase directly - matching
// practiceCompletions.js's own "one client module owns a table's reads/
// writes" precedent.
//
// This module never mutates practice_completion_events (SELECT only),
// never uses a service-role key (relies entirely on the table's own RLS -
// see 20260928000000_practice_completion_events.sql's owner-scoped SELECT
// policy), and never queries for a guest (callers are responsible for
// never invoking this without a real, non-anonymous userId - matching
// every other restricted read/write in this app).
const TABLE = 'practice_completion_events';

/**
 * Fetches every completion row this authenticated user is allowed to see
 * (RLS already restricts this server-side to their own rows; the
 * `.eq('user_id', userId)` filter here is defence in depth, matching
 * routineResponses.js's own established convention of never relying on
 * RLS alone at the client call site). Returns an explicit result, never
 * throws:
 *   { ok: true, rows: [...] }
 *   { ok: false, reason }   — rejected before ever reaching the database
 *   { ok: false, error }    — a genuine database/network failure
 *
 * Only the columns Phase 3's own calculations need are selected -
 * `session_id` (so a specific completion event can be excluded/identified
 * without ever guessing "the latest row"), `journey`, `practice_type`,
 * `duration_seconds`, `local_date`.
 */
export const fetchCompletionRows = async ({ userId }) => {
  if (!supabase || !userId) return { ok: false, reason: 'not-authenticated' };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('session_id, journey, practice_type, duration_seconds, local_date')
      .eq('user_id', userId);
    if (error) return { ok: false, error };
    return { ok: true, rows: Array.isArray(data) ? data : [] };
  } catch (e) {
    return { ok: false, error: e };
  }
};

// Pure - never touches the network, never mutates its input, tolerates
// malformed/missing fields defensively (never throws). Returns structured
// totals, never JSX. `meditationMinutes` floors the aggregate SUM (not a
// sum of per-row floors) so partial minutes across several sessions can
// still combine into a whole completed minute - the exact total genuinely
// listened to, in whole minutes, never inflated.
export const computeMomentumTotals = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  let totalPractices = 0;
  let morningTotal = 0;
  let eveningTotal = 0;
  let meditationCount = 0;
  let meditationSeconds = 0;
  const activeDates = new Set();

  for (const row of safeRows) {
    if (!row || typeof row !== 'object') continue;
    totalPractices += 1;
    if (row.journey === 'morning' && row.practice_type === 'full_routine') morningTotal += 1;
    if (row.journey === 'evening' && row.practice_type === 'full_routine') eveningTotal += 1;
    if (row.practice_type === 'meditation') {
      meditationCount += 1;
      if (typeof row.duration_seconds === 'number' && Number.isFinite(row.duration_seconds) && row.duration_seconds > 0) {
        meditationSeconds += row.duration_seconds;
      }
    }
    if (typeof row.local_date === 'string' && row.local_date) activeDates.add(row.local_date);
  }

  return {
    totalPractices,
    morningTotal,
    eveningTotal,
    meditationCount,
    meditationMinutes: Math.floor(meditationSeconds / 60),
    activeDateCount: activeDates.size
  };
};

/**
 * Convenience wrapper: fetch + compute in one call. Returns
 * { ok: true, rows, totals } or the same failure shapes as
 * fetchCompletionRows. `rows` is included alongside `totals` because
 * milestone-crossing detection (momentumInsights.js) needs the raw rows
 * (specifically each row's own session_id) to exclude the current
 * completion event and compute genuine before/after totals - never by
 * guessing which row is "current" from a timestamp.
 */
export const queryMomentumData = async ({ userId }) => {
  const result = await fetchCompletionRows({ userId });
  if (!result.ok) return result;
  return { ok: true, rows: result.rows, totals: computeMomentumTotals(result.rows) };
};

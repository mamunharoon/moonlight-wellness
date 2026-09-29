// Timezone persistence correction, part 2 — real found defect, confirmed
// live via a direct, read-only PostgREST probe against DEV:
// `20260926000000_rhythms_alarm_enabled_and_configured.sql` is committed in
// this repo but has NOT been applied to the live DEV database -
// rhythms.alarm_enabled/alarm_configured both return Postgres 42703
// ("column ... does not exist") there today, while wake_up_time/bedtime/
// timezone all resolve fine. AlarmContext.jsx's saveRhythm always sent
// alarm_enabled/alarm_configured alongside every other field in ONE upsert
// payload, so that single missing pair broke the ENTIRE write for every
// caller - not just the timezone-confirmation banner, but updateRhythm
// (Onboarding.jsx's own wake/bed/timezone save, every alarm-time edit) too.
//
// Timezone persistence correction, part 3 — the part-2 retry above only
// ever checked for Postgres' own raw `42703` (undefined_column) code. A
// second, DIFFERENT live probe (a real POST .upsert() with the same two
// extended fields, against DEV) proved this is NOT the error code
// PostgREST actually returns for a write that references an unknown
// column - it returns its own schema-cache error instead:
//   {"code":"PGRST204","details":null,"hint":null,
//    "message":"Could not find the 'alarm_configured' column of
//    'rhythms' in the schema cache"}
// confirmed via a real POST with a syntactically-valid-but-nonexistent
// user_id (no auth session at all), so this is genuinely PostgREST's own
// pre-flight schema-cache check, not an RLS/foreign-key error masquerading
// as one. `42703` IS still what a plain SELECT with the same unknown
// columns returns (confirmed by the same probe session), so PostgREST
// clearly validates INSERT/UPSERT payload keys against its schema cache
// BEFORE ever reaching Postgres, while a SELECT's column list still goes
// straight through to Postgres and surfaces the raw SQLSTATE - two
// genuinely different codes for the same underlying "column doesn't
// exist" condition, depending only on which HTTP verb triggered it. The
// retry below now recognises both, so it actually fires on the real
// write-path error instead of never triggering at all.
//
// Extracted into small, pure, exported functions (rather than left inline
// inside AlarmContext.jsx's own closure) specifically so this exact retry
// contract can be executed against a mocked Supabase client in a real
// test, not only checked by source-text regex like the rest of that
// Provider's own internals necessarily are.
//
// `supabase` here is only ever the real app-wide client, or a test double
// shaped like `{ from: () => ({ upsert: async (payload, opts) => ({ error })
// }) }` - these functions never import supabaseClient.js themselves, so
// they have no hidden dependency beyond what's passed in.

// PostgREST returns the raw Postgres SQLSTATE (`42703`, undefined_column)
// for a SELECT whose column list names something that doesn't exist, but
// its own pre-flight schema-cache code (`PGRST204`) for an INSERT/UPSERT/
// UPDATE payload key that doesn't map to a real column - both mean exactly
// the same thing ("this column does not exist on this table right now"),
// just surfaced by two different code paths depending on the HTTP verb.
// Treating only one as retryable is exactly the gap that let the write
// path's real DEV failure go unfixed by the part-2 correction above.
const isUndefinedColumnError = (error) => error?.code === '42703' || error?.code === 'PGRST204';

// @param {{ from: (table: string) => { upsert: (payload: object, opts: { onConflict: string }) => Promise<{ error: any }> } }} supabase
// @param {object} corePayload - fields confirmed to exist on every rhythms
//   row regardless of which optional migrations have been applied
//   (user_id, wake_up_time, bedtime, timezone, updated_at).
// @param {object} extendedFields - fields from a newer, additive migration
//   that may not yet be applied everywhere (today: alarm_enabled,
//   alarm_configured) - sent on the first attempt always; dropped only on
//   a genuine undefined-column retry.
// @returns {Promise<{ success: true } | { success: false, error: any }>}
export const upsertRhythmWithFallback = async (supabase, corePayload, extendedFields) => {
  const { error } = await supabase
    .from('rhythms')
    .upsert({ ...corePayload, ...extendedFields }, { onConflict: 'user_id' });

  if (!error) return { success: true };

  // Never assumed to be alarm_enabled/alarm_configured specifically - the
  // retry below simply omits every extended field and lets the core
  // payload alone prove whether that was really the cause; any OTHER
  // structural problem (including a still-missing core column) surfaces as
  // a real failure from the fallback attempt itself, never silently
  // swallowed.
  if (!isUndefinedColumnError(error)) return { success: false, error };

  const { error: fallbackError } = await supabase
    .from('rhythms')
    .upsert(corePayload, { onConflict: 'user_id' });

  if (fallbackError) return { success: false, error: fallbackError };
  return { success: true };
};

// The read-side counterpart of upsertRhythmWithFallback above - the exact
// same missing-columns condition breaks a plain SELECT too (confirmed live:
// a probe selecting wake_up_time, bedtime, timezone, alarm_enabled,
// alarm_configured together returns 42703 on DEV today), and until now
// fetchRhythm's own single-attempt select had no fallback at all: a
// missing column made the WHOLE fetch fail, silently leaving alarmTime/
// bedTime/timezone/isAlarmSet/alarmConfigured all at their client-side
// defaults instead of the user's real saved values - this is the exact
// "Error fetching rhythm: column rhythms.alarm_enabled does not exist"
// console error reported alongside the save failure. Falling back to the
// three guaranteed-present columns lets a genuinely saved wake/bed/
// timezone still load correctly even while alarm_enabled/alarm_configured
// remain unmigrated - the caller's own existing `data.alarm_enabled ?? true`/
// `Boolean(data.alarm_configured)` fallbacks already handle those two keys
// being absent from the returned row either way.
// @param {{ from: (table: string) => { select: (columns: string) => { eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: any, error: any }> } } } }} supabase
// @param {string} userId
// @returns {Promise<{ success: true, data: object | null } | { success: false, error: any }>}
export const selectRhythmWithFallback = async (supabase, userId) => {
  const { data, error } = await supabase
    .from('rhythms')
    .select('wake_up_time, bedtime, timezone, alarm_enabled, alarm_configured')
    .eq('user_id', userId)
    .maybeSingle();

  if (!error) return { success: true, data };

  if (!isUndefinedColumnError(error)) return { success: false, error };

  const { data: coreData, error: fallbackError } = await supabase
    .from('rhythms')
    .select('wake_up_time, bedtime, timezone')
    .eq('user_id', userId)
    .maybeSingle();

  if (fallbackError) return { success: false, error: fallbackError };
  return { success: true, data: coreData };
};

// Timezone persistence correction, part 3 — the dedicated, minimal write
// path for a genuine timezone-only confirmation (the "Use current
// timezone" banner action and Settings' "Save timezone" button - see
// AlarmContext.jsx's confirmTimezone). Sends ONLY user_id/timezone/
// updated_at, never wake_up_time/bedtime/alarm_enabled/alarm_configured -
// PostgREST's own upsert semantics only ever SET the columns actually
// present in the payload on a conflict, so every other existing column on
// an already-existing row (wake_up_time, bedtime, alarm_enabled,
// alarm_configured) is left completely untouched, never overwritten with a
// stale or default client-side value; a genuinely NEW row still gets
// correct wake_up_time/bedtime via the table's own column DEFAULTs
// ('07:30'/'22:00'), never an explicit null. Structurally immune to the
// alarm_enabled/alarm_configured migration gap - those two columns are
// never referenced by this payload at all, so there is nothing for that
// gap to break here regardless of whether the migration has been applied.
// @param {{ from: (table: string) => { upsert: (payload: object, opts: { onConflict: string }) => Promise<{ error: any }> } }} supabase
// @param {{ userId: string, timezone: string }} params
// @returns {Promise<{ success: true } | { success: false, error: any }>}
export const upsertTimezoneOnly = async (supabase, { userId, timezone }) => {
  const { error } = await supabase
    .from('rhythms')
    .upsert(
      { user_id: userId, timezone, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) return { success: false, error };
  return { success: true };
};

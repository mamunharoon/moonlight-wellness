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
// Extracted into its own small, pure, exported function (rather than left
// inline inside AlarmContext.jsx's own closure) specifically so this exact
// retry contract can be executed against a mocked Supabase client in a real
// test, not only checked by source-text regex like the rest of that
// Provider's own internals necessarily are.
//
// `supabase` here is only ever the real app-wide client, or a test double
// shaped like `{ from: () => ({ upsert: async (payload, opts) => ({ error })
// }) }` - this function never imports supabaseClient.js itself, so it has
// no hidden dependency beyond what's passed in.
//
// @param {{ from: (table: string) => { upsert: (payload: object, opts: { onConflict: string }) => Promise<{ error: any }> } }} supabase
// @param {object} corePayload - fields confirmed to exist on every rhythms
//   row regardless of which optional migrations have been applied
//   (user_id, wake_up_time, bedtime, timezone, updated_at).
// @param {object} extendedFields - fields from a newer, additive migration
//   that may not yet be applied everywhere (today: alarm_enabled,
//   alarm_configured) - sent on the first attempt always; dropped only on
//   a genuine "column does not exist" retry.
// @returns {Promise<{ success: true } | { success: false, error: any }>}
export const upsertRhythmWithFallback = async (supabase, corePayload, extendedFields) => {
  const { error } = await supabase
    .from('rhythms')
    .upsert({ ...corePayload, ...extendedFields }, { onConflict: 'user_id' });

  if (!error) return { success: true };

  // Postgres 42703 = undefined_column. Never assumed to be
  // alarm_enabled/alarm_configured specifically - the retry below simply
  // omits every extended field and lets the core payload alone prove
  // whether that was really the cause; any OTHER structural problem
  // (including a still-missing core column) surfaces as a real failure
  // from the fallback attempt itself, never silently swallowed.
  if (error.code !== '42703') return { success: false, error };

  const { error: fallbackError } = await supabase
    .from('rhythms')
    .upsert(corePayload, { onConflict: 'user_id' });

  if (fallbackError) return { success: false, error: fallbackError };
  return { success: true };
};

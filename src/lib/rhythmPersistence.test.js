// Timezone persistence correction, part 2 — real found defect, confirmed
// live via a direct, read-only PostgREST probe against DEV: rhythms.
// alarm_enabled/alarm_configured both return Postgres 42703 ("column ...
// does not exist") there today, even though wake_up_time/bedtime/timezone
// all resolve fine and the migration adding those two columns is already
// committed in this repo. Because AlarmContext.jsx's saveRhythm always sent
// alarm_enabled/alarm_configured alongside every other field in ONE upsert
// payload, that single missing pair broke the ENTIRE rhythm write for
// every caller.
//
// This is real, executed behavioural coverage against a mocked Supabase
// client - unlike most of AlarmContext.jsx's own internals (which live
// inside a Provider closure this repo's Vitest can't render), this exact
// retry contract was deliberately extracted into its own pure, exported
// function specifically so it could be tested this way.
import { describe, it, expect, vi } from 'vitest';
import { upsertRhythmWithFallback } from './rhythmPersistence';

const CORE_PAYLOAD = {
  user_id: 'user-123',
  wake_up_time: '07:30',
  bedtime: '22:00',
  timezone: 'Australia/Sydney',
  updated_at: '2026-09-27T00:00:00.000Z'
};
const EXTENDED_FIELDS = { alarm_enabled: true, alarm_configured: false };

// A fresh fake for each test: records every upsert call (payload + onConflict
// option) so assertions can check exactly what was sent and how many times.
const makeFakeSupabase = (upsertResults) => {
  const calls = [];
  let callIndex = 0;
  const upsert = vi.fn(async (payload, opts) => {
    calls.push({ payload, opts });
    const result = upsertResults[Math.min(callIndex, upsertResults.length - 1)];
    callIndex += 1;
    return result;
  });
  const from = vi.fn((table) => {
    expect(table).toBe('rhythms');
    return { upsert };
  });
  return { supabase: { from }, calls, upsert };
};

describe('upsertRhythmWithFallback — the first attempt always sends the full row (this is "successful insert" and "successful update" both: upsert is the same call either way, Postgres/Postgrest decides which)', () => {
  it('a clean upsert (no error) succeeds on the first attempt - never even considers a retry', async () => {
    const { supabase, calls, upsert } = makeFakeSupabase([{ error: null }]);
    const result = await upsertRhythmWithFallback(supabase, CORE_PAYLOAD, EXTENDED_FIELDS);
    expect(result).toEqual({ success: true });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(calls[0].payload).toEqual({ ...CORE_PAYLOAD, ...EXTENDED_FIELDS });
    expect(calls[0].opts).toEqual({ onConflict: 'user_id' });
  });

  it('sends every core field and every extended field together on the first attempt - never silently dropped', async () => {
    const { supabase, calls } = makeFakeSupabase([{ error: null }]);
    await upsertRhythmWithFallback(supabase, CORE_PAYLOAD, EXTENDED_FIELDS);
    for (const key of Object.keys(CORE_PAYLOAD)) expect(calls[0].payload).toHaveProperty(key, CORE_PAYLOAD[key]);
    for (const key of Object.keys(EXTENDED_FIELDS)) expect(calls[0].payload).toHaveProperty(key, EXTENDED_FIELDS[key]);
  });
});

describe('upsertRhythmWithFallback — Supabase error propagation', () => {
  it('a non-42703 error (e.g. RLS denial, constraint violation) propagates immediately - never attempts a retry', async () => {
    const rlsError = { code: '42501', message: 'new row violates row-level security policy' };
    const { supabase, upsert } = makeFakeSupabase([{ error: rlsError }]);
    const result = await upsertRhythmWithFallback(supabase, CORE_PAYLOAD, EXTENDED_FIELDS);
    expect(result).toEqual({ success: false, error: rlsError });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('a null-constraint violation (e.g. code 23502) also propagates immediately, unretried', async () => {
    const notNullError = { code: '23502', message: 'null value in column "user_id" violates not-null constraint' };
    const { supabase, upsert } = makeFakeSupabase([{ error: notNullError }]);
    const result = await upsertRhythmWithFallback(supabase, CORE_PAYLOAD, EXTENDED_FIELDS);
    expect(result).toEqual({ success: false, error: notNullError });
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});

describe('upsertRhythmWithFallback — the exact 42703 (undefined_column) resilience fix', () => {
  it('a 42703 on the first attempt retries ONCE with exactly the core payload (extended fields dropped) - the real fix for the confirmed live DEV defect', async () => {
    const undefinedColumnError = { code: '42703', message: 'column rhythms.alarm_enabled does not exist' };
    const { supabase, calls, upsert } = makeFakeSupabase([{ error: undefinedColumnError }, { error: null }]);
    const result = await upsertRhythmWithFallback(supabase, CORE_PAYLOAD, EXTENDED_FIELDS);
    expect(result).toEqual({ success: true });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(calls[0].payload).toEqual({ ...CORE_PAYLOAD, ...EXTENDED_FIELDS });
    expect(calls[1].payload).toEqual(CORE_PAYLOAD);
    expect(calls[1].opts).toEqual({ onConflict: 'user_id' });
  });

  it('if the fallback (core-only) attempt ALSO fails, that failure is surfaced honestly - never silently reported as success', async () => {
    const undefinedColumnError = { code: '42703', message: 'column rhythms.alarm_enabled does not exist' };
    const fallbackError = { code: '23502', message: 'null value in column "wake_up_time" violates not-null constraint' };
    const { supabase, upsert } = makeFakeSupabase([{ error: undefinedColumnError }, { error: fallbackError }]);
    const result = await upsertRhythmWithFallback(supabase, CORE_PAYLOAD, EXTENDED_FIELDS);
    expect(result).toEqual({ success: false, error: fallbackError });
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('a 42703 for some other, unrelated column still triggers the same retry - the fix is not hardcoded to alarm_enabled/alarm_configured specifically', async () => {
    const undefinedColumnError = { code: '42703', message: 'column rhythms.some_future_column does not exist' };
    const { supabase, upsert } = makeFakeSupabase([{ error: undefinedColumnError }, { error: null }]);
    const result = await upsertRhythmWithFallback(supabase, CORE_PAYLOAD, EXTENDED_FIELDS);
    expect(result).toEqual({ success: true });
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});

describe('upsertRhythmWithFallback — invalid payload handling', () => {
  it('never mutates the caller\'s own corePayload/extendedFields objects', async () => {
    const core = { ...CORE_PAYLOAD };
    const extended = { ...EXTENDED_FIELDS };
    const { supabase } = makeFakeSupabase([{ error: { code: '42703', message: 'x' } }, { error: null }]);
    await upsertRhythmWithFallback(supabase, core, extended);
    expect(core).toEqual(CORE_PAYLOAD);
    expect(extended).toEqual(EXTENDED_FIELDS);
  });

  it('a malformed/invalid timezone value already baked into corePayload is not this function\'s concern - it upserts exactly what it is given, and any resulting constraint error still propagates honestly', async () => {
    const badPayload = { ...CORE_PAYLOAD, timezone: '' };
    const checkConstraintError = { code: '23514', message: 'new row for relation "rhythms" violates check constraint "rhythms_timezone_not_blank"' };
    const { supabase, calls } = makeFakeSupabase([{ error: checkConstraintError }]);
    const result = await upsertRhythmWithFallback(supabase, badPayload, EXTENDED_FIELDS);
    expect(result).toEqual({ success: false, error: checkConstraintError });
    expect(calls[0].payload.timezone).toBe('');
  });
});

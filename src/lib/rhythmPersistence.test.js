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
// Timezone persistence correction, part 3 — a second, real live probe (an
// actual POST .upsert() with the same two extended fields, against DEV)
// proved the part-2 retry above checked the WRONG error code for a write:
// PostgREST returns its own schema-cache error, {"code":"PGRST204",
// "message":"Could not find the 'alarm_configured' column of 'rhythms' in
// the schema cache"}, not the raw Postgres 42703 a SELECT with the same
// unknown columns returns. Because the part-2 retry only ever matched
// '42703', it never actually fired for a genuine write, and the live
// "Couldn't save your timezone" defect persisted even after that fix
// shipped. This file's own coverage below now proves BOTH codes retry
// correctly, plus the same fallback contract extended to the read side
// (selectRhythmWithFallback) and a brand-new, minimal timezone-only write
// path (upsertTimezoneOnly) that never references alarm_enabled/
// alarm_configured at all.
//
// This is real, executed behavioural coverage against a mocked Supabase
// client - unlike most of AlarmContext.jsx's own internals (which live
// inside a Provider closure this repo's Vitest can't render), this exact
// retry contract was deliberately extracted into its own pure, exported
// functions specifically so they could be tested this way.
import { describe, it, expect, vi } from 'vitest';
import { upsertRhythmWithFallback, selectRhythmWithFallback, upsertTimezoneOnly } from './rhythmPersistence';
import { COMMON_TIMEZONES } from './timezone';

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
  it('a non-undefined-column error (e.g. RLS denial, constraint violation) propagates immediately - never attempts a retry', async () => {
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

// Timezone persistence correction, part 3 — the real, confirmed-live fix.
// A direct POST .upsert() probe against DEV (same payload shape as this
// function sends) returned PGRST204, not 42703, for the exact same
// missing-column condition - this is genuinely how this live PostgREST
// instance reports an unknown column on a WRITE (as opposed to a SELECT,
// which still returns raw 42703 - see selectRhythmWithFallback's own
// describe block below). Without this, the "part 2" retry above never
// actually fired on a real write, and the live save failure persisted.
describe('upsertRhythmWithFallback — the exact PGRST204 (schema-cache column-not-found) resilience fix, confirmed live on DEV', () => {
  it('a PGRST204 on the first attempt retries ONCE with exactly the core payload - the real fix for the still-live DEV defect the 42703-only check missed', async () => {
    const schemaCacheError = {
      code: 'PGRST204',
      message: "Could not find the 'alarm_configured' column of 'rhythms' in the schema cache"
    };
    const { supabase, calls, upsert } = makeFakeSupabase([{ error: schemaCacheError }, { error: null }]);
    const result = await upsertRhythmWithFallback(supabase, CORE_PAYLOAD, EXTENDED_FIELDS);
    expect(result).toEqual({ success: true });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(calls[0].payload).toEqual({ ...CORE_PAYLOAD, ...EXTENDED_FIELDS });
    expect(calls[1].payload).toEqual(CORE_PAYLOAD);
  });

  it('if the fallback (core-only) attempt ALSO fails after a PGRST204, that failure is surfaced honestly', async () => {
    const schemaCacheError = { code: 'PGRST204', message: "Could not find the 'alarm_enabled' column of 'rhythms' in the schema cache" };
    const fallbackError = { code: '23514', message: 'new row for relation "rhythms" violates check constraint "rhythms_timezone_not_blank"' };
    const { supabase, upsert } = makeFakeSupabase([{ error: schemaCacheError }, { error: fallbackError }]);
    const result = await upsertRhythmWithFallback(supabase, CORE_PAYLOAD, EXTENDED_FIELDS);
    expect(result).toEqual({ success: false, error: fallbackError });
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('a PGRST204 for some other, unrelated column still triggers the same retry - not hardcoded to alarm_enabled/alarm_configured specifically', async () => {
    const schemaCacheError = { code: 'PGRST204', message: "Could not find the 'some_future_column' column of 'rhythms' in the schema cache" };
    const { supabase, upsert } = makeFakeSupabase([{ error: schemaCacheError }, { error: null }]);
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

  it('a malformed/invalid timezone value already baked into corePayload is not this function\'s concern - it upserts exactly what it is given, and any resulting constraint error still propagates honestly', () => {
    const badPayload = { ...CORE_PAYLOAD, timezone: '' };
    const checkConstraintError = { code: '23514', message: 'new row for relation "rhythms" violates check constraint "rhythms_timezone_not_blank"' };
    const { supabase, calls } = makeFakeSupabase([{ error: checkConstraintError }]);
    return upsertRhythmWithFallback(supabase, badPayload, EXTENDED_FIELDS).then((result) => {
      expect(result).toEqual({ success: false, error: checkConstraintError });
      expect(calls[0].payload.timezone).toBe('');
    });
  });
});

// Timezone persistence correction, part 3 — the read-side counterpart.
// A live probe confirmed the SAME missing-column condition breaks a plain
// SELECT too (42703 for wake_up_time, bedtime, timezone, alarm_enabled,
// alarm_configured selected together), and fetchRhythm's previous
// single-attempt select had no fallback at all - a missing column made
// the whole fetch silently fail, leaving alarmTime/bedTime/timezone/
// isAlarmSet/alarmConfigured at client-side defaults instead of the
// user's real saved values.
const makeFakeSupabaseForSelect = (selectResults) => {
  const calls = [];
  let callIndex = 0;
  const maybeSingle = vi.fn(async () => {
    const result = selectResults[Math.min(callIndex, selectResults.length - 1)];
    callIndex += 1;
    return result;
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn((columns) => {
    calls.push({ columns });
    return { eq };
  });
  const from = vi.fn((table) => {
    expect(table).toBe('rhythms');
    return { select };
  });
  return { supabase: { from }, calls, select, eq, maybeSingle };
};

describe('selectRhythmWithFallback — a clean select (no error) succeeds on the first attempt', () => {
  it('returns the full row, including alarm_enabled/alarm_configured, never even considering a retry', async () => {
    const row = { wake_up_time: '06:45', bedtime: '21:30', timezone: 'Asia/Dhaka', alarm_enabled: true, alarm_configured: true };
    const { supabase, select, maybeSingle } = makeFakeSupabaseForSelect([{ data: row, error: null }]);
    const result = await selectRhythmWithFallback(supabase, 'user-123');
    expect(result).toEqual({ success: true, data: row });
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('wake_up_time, bedtime, timezone, alarm_enabled, alarm_configured');
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('always scopes the query to the exact userId passed in - User A\'s fetch never queries for User B\'s row', async () => {
    const { supabase, eq } = makeFakeSupabaseForSelect([{ data: null, error: null }]);
    await selectRhythmWithFallback(supabase, 'user-A');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-A');
  });

  it('a genuinely absent row (no rhythm saved yet) resolves data: null, not an error', async () => {
    const { supabase } = makeFakeSupabaseForSelect([{ data: null, error: null }]);
    const result = await selectRhythmWithFallback(supabase, 'user-123');
    expect(result).toEqual({ success: true, data: null });
  });
});

describe('selectRhythmWithFallback — non-undefined-column errors propagate immediately, unretried', () => {
  it('an RLS denial never triggers a retry', async () => {
    const rlsError = { code: '42501', message: 'permission denied for table rhythms' };
    const { supabase, select } = makeFakeSupabaseForSelect([{ data: null, error: rlsError }]);
    const result = await selectRhythmWithFallback(supabase, 'user-123');
    expect(result).toEqual({ success: false, error: rlsError });
    expect(select).toHaveBeenCalledTimes(1);
  });
});

describe('selectRhythmWithFallback — the exact 42703 (undefined_column) resilience fix, confirmed live on DEV', () => {
  it('a 42703 on the first attempt retries ONCE with only the three guaranteed-present columns (wake_up_time, bedtime, timezone)', async () => {
    const undefinedColumnError = { code: '42703', message: 'column rhythms.alarm_enabled does not exist' };
    const coreRow = { wake_up_time: '07:30', bedtime: '22:00', timezone: 'Australia/Sydney' };
    const { supabase, select, calls } = makeFakeSupabaseForSelect([
      { data: null, error: undefinedColumnError },
      { data: coreRow, error: null }
    ]);
    const result = await selectRhythmWithFallback(supabase, 'user-123');
    expect(result).toEqual({ success: true, data: coreRow });
    expect(select).toHaveBeenCalledTimes(2);
    expect(calls[0].columns).toBe('wake_up_time, bedtime, timezone, alarm_enabled, alarm_configured');
    expect(calls[1].columns).toBe('wake_up_time, bedtime, timezone');
  });

  it('a PGRST204 on the first attempt (the same schema-cache code the write side can return) also retries with the core-only column list', async () => {
    const schemaCacheError = { code: 'PGRST204', message: "Could not find the 'alarm_enabled' column of 'rhythms' in the schema cache" };
    const coreRow = { wake_up_time: '07:30', bedtime: '22:00', timezone: 'Asia/Dhaka' };
    const { supabase, select } = makeFakeSupabaseForSelect([
      { data: null, error: schemaCacheError },
      { data: coreRow, error: null }
    ]);
    const result = await selectRhythmWithFallback(supabase, 'user-123');
    expect(result).toEqual({ success: true, data: coreRow });
    expect(select).toHaveBeenCalledTimes(2);
  });

  it('if the fallback (core-only) select ALSO fails, that failure is surfaced honestly', async () => {
    const undefinedColumnError = { code: '42703', message: 'column rhythms.alarm_enabled does not exist' };
    const fallbackError = { code: '08006', message: 'connection failure' };
    const { supabase, select } = makeFakeSupabaseForSelect([
      { data: null, error: undefinedColumnError },
      { data: null, error: fallbackError }
    ]);
    const result = await selectRhythmWithFallback(supabase, 'user-123');
    expect(result).toEqual({ success: false, error: fallbackError });
    expect(select).toHaveBeenCalledTimes(2);
  });

  it('the fallback row never fabricates alarm_enabled/alarm_configured keys - the caller\'s own existing `data.alarm_enabled ?? true`/`Boolean(data.alarm_configured)` defaults handle their absence', async () => {
    const undefinedColumnError = { code: '42703', message: 'column rhythms.alarm_enabled does not exist' };
    const coreRow = { wake_up_time: '07:30', bedtime: '22:00', timezone: 'Australia/Sydney' };
    const { supabase } = makeFakeSupabaseForSelect([
      { data: null, error: undefinedColumnError },
      { data: coreRow, error: null }
    ]);
    const result = await selectRhythmWithFallback(supabase, 'user-123');
    expect(result.data).not.toHaveProperty('alarm_enabled');
    expect(result.data).not.toHaveProperty('alarm_configured');
  });
});

// Timezone persistence correction, part 3 — the dedicated, minimal
// timezone-only write path used by confirmTimezone ("Use current
// timezone" / Settings' "Save timezone"). Never references alarm_enabled/
// alarm_configured at all, so it is structurally immune to the migration
// gap regardless of whether it has been applied - there is nothing here
// for that gap to break.
describe('upsertTimezoneOnly — sends exactly user_id/timezone/updated_at, nothing else', () => {
  it('a successful upsert reports success and sends only the three authoritative fields', async () => {
    const { supabase, calls, upsert } = makeFakeSupabase([{ error: null }]);
    const result = await upsertTimezoneOnly(supabase, { userId: 'user-123', timezone: 'Australia/Sydney' });
    expect(result).toEqual({ success: true });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(Object.keys(calls[0].payload).sort()).toEqual(['timezone', 'updated_at', 'user_id']);
    expect(calls[0].payload.user_id).toBe('user-123');
    expect(calls[0].payload.timezone).toBe('Australia/Sydney');
    expect(calls[0].opts).toEqual({ onConflict: 'user_id' });
  });

  it('saves Asia/Dhaka exactly as given - never rewritten, never coerced to a curated-list label', async () => {
    const { supabase, calls } = makeFakeSupabase([{ error: null }]);
    await upsertTimezoneOnly(supabase, { userId: 'user-456', timezone: 'Asia/Dhaka' });
    expect(calls[0].payload.timezone).toBe('Asia/Dhaka');
  });

  it('never references alarm_enabled or alarm_configured - structurally immune to the migration gap regardless of whether it is applied', async () => {
    const { supabase, calls } = makeFakeSupabase([{ error: null }]);
    await upsertTimezoneOnly(supabase, { userId: 'user-123', timezone: 'Australia/Sydney' });
    expect(calls[0].payload).not.toHaveProperty('alarm_enabled');
    expect(calls[0].payload).not.toHaveProperty('alarm_configured');
    expect(calls[0].payload).not.toHaveProperty('wake_up_time');
    expect(calls[0].payload).not.toHaveProperty('bedtime');
  });

  it('a genuine failure (e.g. RLS denial) is surfaced honestly, with no retry of any kind - there are no optional fields here for a retry to drop', async () => {
    const rlsError = { code: '42501', message: 'new row violates row-level security policy' };
    const { supabase, upsert } = makeFakeSupabase([{ error: rlsError }]);
    const result = await upsertTimezoneOnly(supabase, { userId: 'user-123', timezone: 'Australia/Sydney' });
    expect(result).toEqual({ success: false, error: rlsError });
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});

// Bangladesh tester reproduction, closing the loop — Asia/Dhaka is now a
// real entry in the manual COMMON_TIMEZONES picker (lib/timezone.js), not
// just reachable via automatic detection. This proves the one thing that
// actually matters end-to-end for a manual selection: the exact id a user
// would tap in that picker is (a) genuinely present with a clear label,
// and (b) saves successfully through the new timezone-only persistence
// path this correction introduces - the same path "Use current timezone"
// and Settings' "Save timezone" both already use.
describe('Asia/Dhaka — manual picker entry saves through the new timezone-only persistence path', () => {
  it('COMMON_TIMEZONES includes Asia/Dhaka with a clear, human-readable label', () => {
    const entry = COMMON_TIMEZONES.find((tz) => tz.id === 'Asia/Dhaka');
    expect(entry).toBeTruthy();
    expect(entry.label).toBe('Dhaka (no DST)');
  });

  it('selecting that exact picker entry saves successfully via upsertTimezoneOnly, sending only the authoritative field', async () => {
    const dhakaEntry = COMMON_TIMEZONES.find((tz) => tz.id === 'Asia/Dhaka');
    const { supabase, calls } = makeFakeSupabase([{ error: null }]);
    const result = await upsertTimezoneOnly(supabase, { userId: 'user-bd-1', timezone: dhakaEntry.id });
    expect(result).toEqual({ success: true });
    expect(calls[0].payload.timezone).toBe('Asia/Dhaka');
    expect(Object.keys(calls[0].payload).sort()).toEqual(['timezone', 'updated_at', 'user_id']);
  });
});

// "Your Momentum" foundation, Phase 2 — genuine behavioural tests for
// recordPracticeCompletion, the ONE shared writer for
// practice_completion_events. Real execution against a mocked Supabase
// query builder, matching routineResponses.test.js's own established
// standard (asserting on the EXACT call made and the EXACT result
// returned, never a source-string assertion for this module).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertMock = vi.fn();
const mockFrom = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: { from: mockFrom }
}));

const { recordPracticeCompletion, JOURNEY_VALUES, PRACTICE_TYPE_VALUES } = await import('./practiceCompletions');

beforeEach(() => {
  mockFrom.mockReset();
  insertMock.mockReset();
  insertMock.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({ insert: insertMock });
});

const baseParams = () => ({
  userId: 'user-1',
  isGuest: false,
  sessionId: 'session-abc',
  journey: 'morning',
  practiceType: 'full_routine',
  durationSeconds: 420,
  timezone: 'Australia/Sydney',
  now: () => new Date('2026-09-22T21:00:00.000Z') // 2026-09-23 07:00 AEST
});

describe('recordPracticeCompletion — authenticated successful insert', () => {
  it('inserts exactly one row, on the correct table, with the exact expected shape', async () => {
    const result = await recordPracticeCompletion(baseParams());

    expect(result).toEqual({ ok: true });
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('practice_completion_events');
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      session_id: 'session-abc',
      journey: 'morning',
      practice_type: 'full_routine',
      duration_seconds: 420,
      local_date: '2026-09-23',
      timezone: 'Australia/Sydney',
      outcome: 'completed',
      idempotency_key: 'session-abc'
    });
  });

  it('idempotency_key is always exactly the given sessionId, never a derived composite', async () => {
    await recordPracticeCompletion({ ...baseParams(), sessionId: 'a-different-session-id' });
    const [row] = insertMock.mock.calls[0];
    expect(row.session_id).toBe('a-different-session-id');
    expect(row.idempotency_key).toBe('a-different-session-id');
  });

  it('rounds a fractional duration to the nearest whole second', async () => {
    await recordPracticeCompletion({ ...baseParams(), durationSeconds: 419.6 });
    const [row] = insertMock.mock.calls[0];
    expect(row.duration_seconds).toBe(420);
  });

  it('stores null duration when no genuine measured duration is available', async () => {
    await recordPracticeCompletion({ ...baseParams(), durationSeconds: null });
    const [row] = insertMock.mock.calls[0];
    expect(row.duration_seconds).toBeNull();
  });
});

describe('recordPracticeCompletion — guest / no-user behaviour', () => {
  it('refuses a guest session, without ever calling Supabase', async () => {
    const result = await recordPracticeCompletion({ ...baseParams(), isGuest: true, userId: null });
    expect(result).toEqual({ ok: false, reason: 'not-authenticated' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('refuses a null userId even when isGuest is (incorrectly) false, without ever calling Supabase', async () => {
    const result = await recordPracticeCompletion({ ...baseParams(), userId: null });
    expect(result).toEqual({ ok: false, reason: 'not-authenticated' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('refuses a real userId flagged isGuest:true (defence in depth), without ever calling Supabase', async () => {
    const result = await recordPracticeCompletion({ ...baseParams(), isGuest: true });
    expect(result).toEqual({ ok: false, reason: 'not-authenticated' });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('recordPracticeCompletion — duplicate invocation for the same session', () => {
  it('a Postgres unique_violation (23505) on the (user_id, idempotency_key) constraint is reported as an honest, idempotent ok:true - never a second logical row, never surfaced as a failure', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } });
    const result = await recordPracticeCompletion(baseParams());
    expect(result).toEqual({ ok: true, deduplicated: true });
  });

  it('calling twice with the exact same sessionId sends two identical insert attempts - safety is the database constraint (simulated here), not a call-count limit in this module', async () => {
    await recordPracticeCompletion(baseParams());
    await recordPracticeCompletion(baseParams());
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock.mock.calls[0][0]).toEqual(insertMock.mock.calls[1][0]);
  });
});

describe('recordPracticeCompletion — two different sessions of the same type on the same day', () => {
  it('two distinct sessionIds produce two distinct, independent inserts - never collapsed into one', async () => {
    await recordPracticeCompletion({ ...baseParams(), sessionId: 'run-1' });
    await recordPracticeCompletion({ ...baseParams(), sessionId: 'run-2' });
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock.mock.calls[0][0].idempotency_key).toBe('run-1');
    expect(insertMock.mock.calls[1][0].idempotency_key).toBe('run-2');
  });
});

describe('recordPracticeCompletion — database error propagation', () => {
  it('a genuine (non-duplicate) database error is reported as an honest ok:false with the real error attached - never silently reported as success', async () => {
    insertMock.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } });
    const result = await recordPracticeCompletion(baseParams());
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('a thrown network exception is caught and reported as ok:false, never left to bubble up to the caller', async () => {
    insertMock.mockRejectedValue(new Error('network unreachable'));
    const result = await recordPracticeCompletion(baseParams());
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('recordPracticeCompletion — local-date generation', () => {
  it('derives local_date from the given timezone and instant, not from UTC or the machine clock', async () => {
    // 2026-09-22T21:00:00.000Z is 2026-09-23 07:00 in Australia/Sydney
    // (AEST, UTC+10) - a different calendar day than the UTC instant.
    await recordPracticeCompletion({ ...baseParams(), timezone: 'Australia/Sydney', now: () => new Date('2026-09-22T21:00:00.000Z') });
    expect(insertMock.mock.calls[0][0].local_date).toBe('2026-09-23');
  });

  it('an invalid/unrecognised timezone falls back safely to UTC rather than rejecting the whole completion', async () => {
    await recordPracticeCompletion({ ...baseParams(), timezone: 'Not/AZone', now: () => new Date('2026-09-22T21:00:00.000Z') });
    const [row] = insertMock.mock.calls[0];
    expect(row.timezone).toBe('UTC');
    expect(row.local_date).toBe('2026-09-22');
  });
});

describe('recordPracticeCompletion — timezone handling around midnight', () => {
  it('a genuine local-midnight boundary in America/Los_Angeles resolves to the correct side of the boundary', async () => {
    // 2026-01-15T07:59:00Z = 2026-01-14 23:59 PST (UTC-8, standard time -
    // still the 14th).
    await recordPracticeCompletion({ ...baseParams(), timezone: 'America/Los_Angeles', now: () => new Date('2026-01-15T07:59:00.000Z') });
    expect(insertMock.mock.calls[0][0].local_date).toBe('2026-01-14');
  });

  it('one minute later, past local midnight, resolves to the next day', async () => {
    // 2026-01-15T08:01:00Z = 2026-01-15 00:01 PST (now the 15th).
    await recordPracticeCompletion({ ...baseParams(), timezone: 'America/Los_Angeles', now: () => new Date('2026-01-15T08:01:00.000Z') });
    expect(insertMock.mock.calls[0][0].local_date).toBe('2026-01-15');
  });
});

describe('recordPracticeCompletion — DST boundary behaviour for Australia/Sydney', () => {
  it('just before the 2026 spring-forward transition (2am -> 3am AEDT, first Sunday of October) still resolves the pre-transition calendar day', async () => {
    // 2026-10-03T15:59:00Z = 2026-10-04 01:59 AEST (UTC+10, still standard
    // time - the transition to AEDT/UTC+11 has not yet happened).
    await recordPracticeCompletion({ ...baseParams(), timezone: 'Australia/Sydney', now: () => new Date('2026-10-03T15:59:00.000Z') });
    expect(insertMock.mock.calls[0][0].local_date).toBe('2026-10-04');
  });

  it('just after the transition, the same UTC-minute-scale gap still resolves to the same calendar day, now in AEDT', async () => {
    // 2026-10-03T16:05:00Z = 2026-10-04 03:05 AEDT (UTC+11, the 2:00-3:00
    // local wall-clock hour never happened this day) - still the 4th, not
    // a day rollover from a naive fixed-offset calculation.
    await recordPracticeCompletion({ ...baseParams(), timezone: 'Australia/Sydney', now: () => new Date('2026-10-03T16:05:00.000Z') });
    expect(insertMock.mock.calls[0][0].local_date).toBe('2026-10-04');
  });

  it('across the 2026 autumn end-of-DST transition (3am -> 2am AEDT->AEST, first Sunday of April), the calendar day is still computed correctly', async () => {
    // 2026-04-04T16:30:00Z = 2026-04-05 02:30 AEST (UTC+10 - already back
    // to standard time).
    await recordPracticeCompletion({ ...baseParams(), timezone: 'Australia/Sydney', now: () => new Date('2026-04-04T16:30:00.000Z') });
    expect(insertMock.mock.calls[0][0].local_date).toBe('2026-04-05');
  });
});

describe('recordPracticeCompletion — payload validation', () => {
  it('rejects a missing/blank sessionId, without ever calling Supabase', async () => {
    const result = await recordPracticeCompletion({ ...baseParams(), sessionId: '' });
    expect(result).toEqual({ ok: false, reason: 'invalid-session-id' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects a journey outside the established allowlist, without ever calling Supabase', async () => {
    const result = await recordPracticeCompletion({ ...baseParams(), journey: 'not-a-real-journey' });
    expect(result).toEqual({ ok: false, reason: 'invalid-journey' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects a practiceType outside the established allowlist, without ever calling Supabase', async () => {
    const result = await recordPracticeCompletion({ ...baseParams(), practiceType: 'stretching' });
    expect(result).toEqual({ ok: false, reason: 'invalid-practice-type' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('every currently-wired journey/practiceType combination the app actually uses is accepted', async () => {
    expect(JOURNEY_VALUES).toEqual(['morning', 'anytime', 'evening', 'library', 'direct']);
    expect(PRACTICE_TYPE_VALUES).toEqual(['full_routine', 'meditation']);
    for (const journey of ['morning', 'evening', 'direct']) {
      mockFrom.mockClear();
      insertMock.mockClear();
      const result = await recordPracticeCompletion({ ...baseParams(), journey });
      expect(result).toEqual({ ok: true });
    }
  });
});

describe('recordPracticeCompletion — duration cannot be negative', () => {
  it('rejects a negative duration, without ever calling Supabase', async () => {
    const result = await recordPracticeCompletion({ ...baseParams(), durationSeconds: -1 });
    expect(result).toEqual({ ok: false, reason: 'invalid-duration' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects a non-finite duration (NaN/Infinity), without ever calling Supabase', async () => {
    const result = await recordPracticeCompletion({ ...baseParams(), durationSeconds: Infinity });
    expect(result).toEqual({ ok: false, reason: 'invalid-duration' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('accepts exactly zero as a valid, non-negative duration', async () => {
    const result = await recordPracticeCompletion({ ...baseParams(), durationSeconds: 0 });
    expect(result).toEqual({ ok: true });
    expect(insertMock.mock.calls[0][0].duration_seconds).toBe(0);
  });
});

describe('recordPracticeCompletion — completion outcome restriction', () => {
  it('always writes outcome "completed" - there is no parameter that can make it write anything else', async () => {
    await recordPracticeCompletion(baseParams());
    expect(insertMock.mock.calls[0][0].outcome).toBe('completed');
  });

  it('an attempted outcome override in the input is silently ignored - the function signature does not expose an outcome parameter at all', async () => {
    await recordPracticeCompletion({ ...baseParams(), outcome: 'ended_early' });
    expect(insertMock.mock.calls[0][0].outcome).toBe('completed');
  });
});

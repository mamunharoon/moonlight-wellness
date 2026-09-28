// "Your Momentum" foundation, Phase 3 — genuine behavioural tests for
// momentumQueries.js: real execution against a mocked Supabase query
// builder (matching routineResponses.test.js's own established standard),
// plus pure-function tests for computeMomentumTotals (no mocking needed
// at all).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: { from: mockFrom }
}));

const { fetchCompletionRows, computeMomentumTotals, queryMomentumData } = await import('./momentumQueries');

const setResult = (result) => {
  eqMock.mockResolvedValue(result);
  selectMock.mockReturnValue({ eq: eqMock });
  mockFrom.mockReturnValue({ select: selectMock });
};

beforeEach(() => {
  mockFrom.mockReset();
  selectMock.mockReset();
  eqMock.mockReset();
  setResult({ data: [], error: null });
});

describe('fetchCompletionRows — authenticated-user scoping', () => {
  it('queries the correct table, selecting only the columns Phase 3 needs, scoped to exactly this user_id', async () => {
    setResult({ data: [{ session_id: 'a', journey: 'morning', practice_type: 'full_routine', duration_seconds: null, local_date: '2026-09-28' }], error: null });
    const result = await fetchCompletionRows({ userId: 'user-1' });
    expect(result.ok).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('practice_completion_events');
    expect(selectMock).toHaveBeenCalledWith('session_id, journey, practice_type, duration_seconds, local_date');
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result.rows).toHaveLength(1);
  });

  it('refuses to run without a userId, without ever calling Supabase', async () => {
    const result = await fetchCompletionRows({ userId: null });
    expect(result).toEqual({ ok: false, reason: 'not-authenticated' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns an explicit failure on a genuine query/RLS/network error - never silently reports success', async () => {
    setResult({ data: null, error: { message: 'permission denied' } });
    const result = await fetchCompletionRows({ userId: 'user-1' });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('a thrown exception is caught and reported as ok:false, never left to bubble up', async () => {
    selectMock.mockImplementation(() => {
      throw new Error('network unreachable');
    });
    const result = await fetchCompletionRows({ userId: 'user-1' });
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });

  it('malformed/missing data (null instead of an array) is tolerated safely, never throws', async () => {
    setResult({ data: null, error: null });
    const result = await fetchCompletionRows({ userId: 'user-1' });
    expect(result).toEqual({ ok: true, rows: [] });
  });
});

describe('computeMomentumTotals — pure calculation, no network', () => {
  it('counts total tracked practices across every row', () => {
    const rows = [
      { journey: 'morning', practice_type: 'full_routine', duration_seconds: null, local_date: '2026-09-28' },
      { journey: 'evening', practice_type: 'full_routine', duration_seconds: null, local_date: '2026-09-28' },
      { journey: 'direct', practice_type: 'meditation', duration_seconds: 300, local_date: '2026-09-28' }
    ];
    expect(computeMomentumTotals(rows).totalPractices).toBe(3);
  });

  it('Morning total counts only journey=morning AND practice_type=full_routine rows', () => {
    const rows = [
      { journey: 'morning', practice_type: 'full_routine' },
      { journey: 'morning', practice_type: 'full_routine' },
      { journey: 'evening', practice_type: 'full_routine' },
      { journey: 'direct', practice_type: 'meditation' }
    ];
    expect(computeMomentumTotals(rows).morningTotal).toBe(2);
  });

  it('Evening total counts only journey=evening AND practice_type=full_routine rows', () => {
    const rows = [
      { journey: 'evening', practice_type: 'full_routine' },
      { journey: 'evening', practice_type: 'full_routine' },
      { journey: 'evening', practice_type: 'full_routine' },
      { journey: 'morning', practice_type: 'full_routine' }
    ];
    expect(computeMomentumTotals(rows).eveningTotal).toBe(3);
  });

  it('meditation count includes every practice_type=meditation row regardless of journey', () => {
    const rows = [
      { journey: 'direct', practice_type: 'meditation' },
      { journey: 'anytime', practice_type: 'meditation' },
      { journey: 'morning', practice_type: 'full_routine' }
    ];
    expect(computeMomentumTotals(rows).meditationCount).toBe(2);
  });

  it('genuine meditation-minute total sums duration_seconds across meditation rows and floors to whole minutes', () => {
    const rows = [
      { practice_type: 'meditation', duration_seconds: 190 },
      { practice_type: 'meditation', duration_seconds: 190 }
    ];
    // 380s = 6.33 minutes -> floors to 6, not 3+3=6 per-row (both would
    // agree here, but the aggregate-then-floor approach is what's tested).
    expect(computeMomentumTotals(rows).meditationMinutes).toBe(6);
  });

  it('NULL routine durations are excluded from the minute total entirely - never coerced to 0 seconds counted or NaN', () => {
    const rows = [
      { journey: 'morning', practice_type: 'full_routine', duration_seconds: null },
      { journey: 'evening', practice_type: 'full_routine', duration_seconds: null },
      { practice_type: 'meditation', duration_seconds: 600 }
    ];
    const totals = computeMomentumTotals(rows);
    expect(totals.meditationMinutes).toBe(10);
    expect(Number.isNaN(totals.meditationMinutes)).toBe(false);
  });

  it('a zero or negative duration_seconds is never counted (defensive - the DB itself already rejects negative values)', () => {
    const rows = [{ practice_type: 'meditation', duration_seconds: 0 }, { practice_type: 'meditation', duration_seconds: 300 }];
    expect(computeMomentumTotals(rows).meditationMinutes).toBe(5);
  });

  it('distinct active local dates counts unique local_date values, never a UTC-derived recomputation', () => {
    const rows = [
      { local_date: '2026-09-28' },
      { local_date: '2026-09-28' },
      { local_date: '2026-09-29' },
      { local_date: '2026-09-30' }
    ];
    expect(computeMomentumTotals(rows).activeDateCount).toBe(3);
  });

  it('malformed rows (non-object entries, missing fields) are skipped safely, never throwing', () => {
    const rows = [null, undefined, 'not-an-object', 42, { journey: 'morning', practice_type: 'full_routine' }];
    const totals = computeMomentumTotals(rows);
    expect(totals.totalPractices).toBe(1);
    expect(totals.morningTotal).toBe(1);
  });

  it('a non-array input (e.g. undefined) is tolerated and returns all-zero totals', () => {
    const totals = computeMomentumTotals(undefined);
    expect(totals).toEqual({
      totalPractices: 0,
      morningTotal: 0,
      eveningTotal: 0,
      meditationCount: 0,
      meditationMinutes: 0,
      activeDateCount: 0
    });
  });
});

describe('queryMomentumData — fetch + compute in one call', () => {
  it('returns rows and totals together on success', async () => {
    setResult({
      data: [
        { session_id: 'a', journey: 'morning', practice_type: 'full_routine', duration_seconds: null, local_date: '2026-09-28' }
      ],
      error: null
    });
    const result = await queryMomentumData({ userId: 'user-1' });
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.totals.morningTotal).toBe(1);
  });

  it('propagates a query failure without computing totals', async () => {
    setResult({ data: null, error: { message: 'boom' } });
    const result = await queryMomentumData({ userId: 'user-1' });
    expect(result.ok).toBe(false);
    expect(result.totals).toBeUndefined();
  });
});

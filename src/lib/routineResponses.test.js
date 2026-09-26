// Edit Tonight's Responses / Redo Tonight's Wind-Down (Build 15) —
// genuine behavioural tests for upsertRoutineResponsesBatch and
// deleteEveningReflectionGratitudeResponsesForDate: real execution
// against a mocked Supabase query builder, asserting on the EXACT calls
// made (table, match/in filters, payload shape) and the EXACT result
// returned - not source-string assertions. loadRoutineResponse/
// upsertRoutineResponse/deleteRoutineResponse (the pre-existing
// functions) are unchanged by this work and are not re-tested here.
//
// Build 15 addendum — redoEveningWindDown (the ONE shared Redo workflow
// used identically by EveningComplete.jsx and Home.jsx's own completed-
// Evening card) is covered below too, with the same real-execution
// standard. This repo's Vitest runs in a plain Node environment - not
// jsdom - so there is no real `localStorage` global (see
// musicPreference.test.js's own note on this exact point); an in-memory
// mock is installed as that global for these tests only.
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { REFLECTION_PROMPTS, GRATITUDE_PROMPTS } from './eveningJourneyQuestions';
import { getEveningCompletionKey } from './dailyCompletion';
import { saveEveningBreathingPattern, loadEveningBreathingPattern } from './eveningBreathingSelection';
import { saveEveningPrepareSelection, loadEveningPrepareSelection } from './eveningPrepareSelection';

const localStorageStore = new Map();
const localStorageMock = {
  getItem: (key) => (localStorageStore.has(key) ? localStorageStore.get(key) : null),
  setItem: (key, value) => localStorageStore.set(key, String(value)),
  removeItem: (key) => localStorageStore.delete(key),
  clear: () => localStorageStore.clear()
};
const originalLocalStorage = globalThis.localStorage;
globalThis.localStorage = localStorageMock;

afterAll(() => {
  globalThis.localStorage = originalLocalStorage;
});

// A minimal fake Postgrest-style chainable query builder. Each method
// records its own call and returns the same chain object, so tests can
// assert on the exact sequence/arguments of .match()/.in()/.in() calls
// regardless of call order elsewhere. The chain becomes a real Promise
// only at whichever method the real implementation actually awaits
// (.upsert() for the batch save, .select() for the scoped delete) -
// matching how the real supabase-js query builder is itself "thenable"
// at any point in its own chain.
let lastChain;
const makeChain = (result) => {
  const chain = {
    matchArgs: undefined,
    inCalls: [],
    upsertArgs: undefined,
    selectArgs: undefined,
    match: vi.fn((...args) => {
      chain.matchArgs = args;
      return chain;
    }),
    in: vi.fn((...args) => {
      chain.inCalls.push(args);
      return chain;
    }),
    delete: vi.fn(() => chain),
    upsert: vi.fn((...args) => {
      chain.upsertArgs = args;
      return Promise.resolve(result);
    }),
    select: vi.fn((...args) => {
      chain.selectArgs = args;
      return Promise.resolve(result);
    })
  };
  return chain;
};

const mockFrom = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: { from: mockFrom }
}));

const { upsertRoutineResponsesBatch, deleteEveningReflectionGratitudeResponsesForDate, redoEveningWindDown } =
  await import('./routineResponses');

const setResult = (result) => {
  lastChain = makeChain(result);
  mockFrom.mockReturnValue(lastChain);
};

beforeEach(() => {
  mockFrom.mockReset();
  setResult({ error: null, data: [] });
  localStorageStore.clear();
});

describe('upsertRoutineResponsesBatch - one atomic call across both sections', () => {
  it('sends exactly one .upsert() call for a Reflection change and a Gratitude change together, on the correct table and conflict target', async () => {
    const result = await upsertRoutineResponsesBatch({
      userId: 'user-1',
      sessionId: 'evening-wind-down',
      localDate: '2026-09-22',
      entries: [
        { stepId: 'reflection', promptId: 'went-well', response: 'Helped someone' },
        { stepId: 'gratitude', promptId: 'grateful-now', response: 'A small comfort' }
      ]
    });

    expect(result).toEqual({ ok: true });
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('routine_responses');
    expect(lastChain.upsert).toHaveBeenCalledTimes(1);

    const [rows, options] = lastChain.upsertArgs;
    expect(options).toEqual({ onConflict: 'user_id,session_id,step_id,prompt_id,local_date' });
    expect(rows).toEqual(
      expect.arrayContaining([
        {
          user_id: 'user-1',
          session_id: 'evening-wind-down',
          step_id: 'reflection',
          prompt_id: 'went-well',
          local_date: '2026-09-22',
          response: 'Helped someone'
        },
        {
          user_id: 'user-1',
          session_id: 'evening-wind-down',
          step_id: 'gratitude',
          prompt_id: 'grateful-now',
          local_date: '2026-09-22',
          response: 'A small comfort'
        }
      ])
    );
    expect(rows).toHaveLength(2);
  });

  it('trims each response before sending, and never sends a blank/whitespace-only entry', async () => {
    const result = await upsertRoutineResponsesBatch({
      userId: 'user-1',
      sessionId: 'evening-wind-down',
      localDate: '2026-09-22',
      entries: [
        { stepId: 'reflection', promptId: 'went-well', response: '  Got outside or moved  ' },
        { stepId: 'reflection', promptId: 'challenged', response: '   ' }
      ]
    });

    expect(result).toEqual({ ok: true });
    const [rows] = lastChain.upsertArgs;
    expect(rows).toEqual([
      {
        user_id: 'user-1',
        session_id: 'evening-wind-down',
        step_id: 'reflection',
        prompt_id: 'went-well',
        local_date: '2026-09-22',
        response: 'Got outside or moved'
      }
    ]);
  });

  it('never calls Supabase at all when every entry is blank - a genuine no-op, matching upsertRoutineResponse\'s own convention', async () => {
    const result = await upsertRoutineResponsesBatch({
      userId: 'user-1',
      sessionId: 'evening-wind-down',
      localDate: '2026-09-22',
      entries: [{ stepId: 'reflection', promptId: 'went-well', response: '' }]
    });
    expect(result).toEqual({ ok: true });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns an explicit failure result on a Supabase error - never a silent/false success (a real caller can detect this, unlike upsertRoutineResponse)', async () => {
    setResult({ error: { message: 'network error' } });
    const result = await upsertRoutineResponsesBatch({
      userId: 'user-1',
      sessionId: 'evening-wind-down',
      localDate: '2026-09-22',
      entries: [{ stepId: 'reflection', promptId: 'went-well', response: 'Helped someone' }]
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('refuses to run without an authenticated userId, without ever calling Supabase', async () => {
    const result = await upsertRoutineResponsesBatch({
      userId: null,
      sessionId: 'evening-wind-down',
      localDate: '2026-09-22',
      entries: [{ stepId: 'reflection', promptId: 'went-well', response: 'Helped someone' }]
    });
    expect(result.ok).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('deleteEveningReflectionGratitudeResponsesForDate - narrowly scoped, never a generic broad delete', () => {
  it('matches only user_id/session_id(evening-wind-down)/local_date - never step_id/prompt_id in the match itself (those are scoped via .in())', async () => {
    await deleteEveningReflectionGratitudeResponsesForDate({ userId: 'user-1', localDate: '2026-09-22' });
    expect(mockFrom).toHaveBeenCalledWith('routine_responses');
    expect(lastChain.delete).toHaveBeenCalledTimes(1);
    expect(lastChain.matchArgs).toEqual([{ user_id: 'user-1', session_id: 'evening-wind-down', local_date: '2026-09-22' }]);
  });

  it('scopes step_id to exactly [reflection, gratitude] - no other step is ever reachable, protecting any future Evening step\'s own persisted rows', async () => {
    await deleteEveningReflectionGratitudeResponsesForDate({ userId: 'user-1', localDate: '2026-09-22' });
    const stepIdCall = lastChain.inCalls.find(([field]) => field === 'step_id');
    expect(stepIdCall[1]).toEqual(['reflection', 'gratitude']);
  });

  it('scopes prompt_id to exactly the 6 allowlisted Reflection/Gratitude ids - not one more, not one fewer', async () => {
    await deleteEveningReflectionGratitudeResponsesForDate({ userId: 'user-1', localDate: '2026-09-22' });
    const promptIdCall = lastChain.inCalls.find(([field]) => field === 'prompt_id');
    const expectedIds = [...REFLECTION_PROMPTS, ...GRATITUDE_PROMPTS].map((p) => p.id);
    expect(promptIdCall[1]).toHaveLength(6);
    expect(promptIdCall[1].sort()).toEqual(expectedIds.sort());
    // A hypothetical unrelated Evening response row (a different prompt
    // id, e.g. a future step) is structurally unreachable: it is simply
    // not a member of this allowlist, so no .in() filter this function
    // constructs could ever match it.
    expect(promptIdCall[1]).not.toContain('unrelated-future-prompt');
  });

  it('a successful zero-row delete (an all-skipped completed journey) is reported as ok:true, never mistaken for a failure', async () => {
    setResult({ data: [], error: null });
    const result = await deleteEveningReflectionGratitudeResponsesForDate({ userId: 'user-1', localDate: '2026-09-22' });
    expect(result).toEqual({ ok: true, deletedCount: 0 });
  });

  it('a genuine query/RLS/network failure is reported as ok:false, never conflated with an empty-but-successful delete', async () => {
    setResult({ data: null, error: { message: 'permission denied' } });
    const result = await deleteEveningReflectionGratitudeResponsesForDate({ userId: 'user-1', localDate: '2026-09-22' });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.deletedCount).toBeUndefined();
  });

  it('a successful delete with rows removed reports the real deleted count', async () => {
    setResult({ data: [{ prompt_id: 'went-well' }, { prompt_id: 'grateful-now' }], error: null });
    const result = await deleteEveningReflectionGratitudeResponsesForDate({ userId: 'user-1', localDate: '2026-09-22' });
    expect(result).toEqual({ ok: true, deletedCount: 2 });
  });

  it('refuses to run without an authenticated userId, without ever calling Supabase', async () => {
    const result = await deleteEveningReflectionGratitudeResponsesForDate({ userId: null, localDate: '2026-09-22' });
    expect(result.ok).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('the resolved local date is used exactly as given, for this one call only - the caller (EveningComplete.jsx) is responsible for resolving it once and passing the same value throughout', async () => {
    await deleteEveningReflectionGratitudeResponsesForDate({ userId: 'user-1', localDate: '2026-09-22' });
    expect(lastChain.matchArgs[0].local_date).toBe('2026-09-22');
  });
});

describe('redoEveningWindDown - the ONE shared Redo workflow (Build 15 addendum), used identically by EveningComplete.jsx and Home.jsx', () => {
  it('on an eligible request and a successful delete: clears the completion flag, THEN calls resetRoutine, and reports ok:true', async () => {
    setResult({ data: [{ prompt_id: 'went-well' }], error: null });
    localStorage.setItem(getEveningCompletionKey('user-1'), '2026-09-22');
    const resetRoutine = vi.fn(() => {
      // At the exact moment resetRoutine is called, the flag must already
      // be cleared - proves the real call order, not just that both
      // eventually happened.
      expect(localStorage.getItem(getEveningCompletionKey('user-1'))).toBeNull();
    });

    const result = await redoEveningWindDown({ userId: 'user-1', isGuest: false, localDate: '2026-09-22', resetRoutine });

    expect(result).toEqual({ ok: true });
    expect(resetRoutine).toHaveBeenCalledTimes(1);
    expect(resetRoutine).toHaveBeenCalledWith('evening-wind-down');
    expect(localStorage.getItem(getEveningCompletionKey('user-1'))).toBeNull();
  });

  it('deletes scoped to exactly this user/date, via the same narrowly-scoped delete used elsewhere - never a second, broader delete path', async () => {
    setResult({ data: [], error: null });
    localStorage.setItem(getEveningCompletionKey('user-1'), '2026-09-22');
    await redoEveningWindDown({ userId: 'user-1', isGuest: false, localDate: '2026-09-22', resetRoutine: vi.fn() });
    expect(mockFrom).toHaveBeenCalledWith('routine_responses');
    expect(lastChain.matchArgs).toEqual([{ user_id: 'user-1', session_id: 'evening-wind-down', local_date: '2026-09-22' }]);
  });

  it('a guest is never eligible, regardless of userId - refuses without ever calling Supabase or resetRoutine', async () => {
    localStorage.setItem(getEveningCompletionKey('user-1'), '2026-09-22');
    const resetRoutine = vi.fn();
    const result = await redoEveningWindDown({ userId: 'user-1', isGuest: true, localDate: '2026-09-22', resetRoutine });
    expect(result).toEqual({ ok: false });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(resetRoutine).not.toHaveBeenCalled();
  });

  it('refuses without a userId, without ever calling Supabase or resetRoutine', async () => {
    const resetRoutine = vi.fn();
    const result = await redoEveningWindDown({ userId: null, isGuest: false, localDate: '2026-09-22', resetRoutine });
    expect(result).toEqual({ ok: false });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(resetRoutine).not.toHaveBeenCalled();
  });

  it('refuses when the completion flag does not match this exact local date (missing, or a stale prior day) - never calls Supabase or resetRoutine', async () => {
    localStorage.setItem(getEveningCompletionKey('user-1'), '2026-09-21');
    const resetRoutine = vi.fn();
    const result = await redoEveningWindDown({ userId: 'user-1', isGuest: false, localDate: '2026-09-22', resetRoutine });
    expect(result).toEqual({ ok: false });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(resetRoutine).not.toHaveBeenCalled();
  });

  it('on a genuine delete failure: does not clear the flag, does not call resetRoutine, and reports ok:false - the existing completed journey is left exactly as it was', async () => {
    setResult({ data: null, error: { message: 'permission denied' } });
    localStorage.setItem(getEveningCompletionKey('user-1'), '2026-09-22');
    const resetRoutine = vi.fn();
    const result = await redoEveningWindDown({ userId: 'user-1', isGuest: false, localDate: '2026-09-22', resetRoutine });
    expect(result).toEqual({ ok: false });
    expect(resetRoutine).not.toHaveBeenCalled();
    expect(localStorage.getItem(getEveningCompletionKey('user-1'))).toBe('2026-09-22');
  });

  it('also clears tonight\'s selected Evening breathing pattern on a successful redo (Build 15 Evening UX correction addendum) - so a redone journey starts fresh at the 4-7-8 default, never silently reusing the old selection', async () => {
    setResult({ data: [], error: null });
    localStorage.setItem(getEveningCompletionKey('user-1'), '2026-09-22');
    saveEveningBreathingPattern('user-1', 'quiet', '2026-09-22');
    expect(loadEveningBreathingPattern('user-1', '2026-09-22')).toBe('quiet');

    const result = await redoEveningWindDown({ userId: 'user-1', isGuest: false, localDate: '2026-09-22', resetRoutine: vi.fn() });

    expect(result).toEqual({ ok: true });
    expect(loadEveningBreathingPattern('user-1', '2026-09-22')).toBeNull();
  });

  it('also clears tonight\'s Prepare for Rest checklist/bedtime-media selection on a successful redo (WakeWise Phase 1 correction) - so a redone journey starts fresh, never silently reusing the old selection', async () => {
    setResult({ data: [], error: null });
    localStorage.setItem(getEveningCompletionKey('user-1'), '2026-09-22');
    saveEveningPrepareSelection('user-1', { prepIds: ['phone', 'water'], bedtimeId: 'SL01' }, '2026-09-22');
    expect(loadEveningPrepareSelection('user-1', '2026-09-22')).toEqual({ prepIds: ['phone', 'water'], bedtimeId: 'SL01' });

    const result = await redoEveningWindDown({ userId: 'user-1', isGuest: false, localDate: '2026-09-22', resetRoutine: vi.fn() });

    expect(result).toEqual({ ok: true });
    expect(loadEveningPrepareSelection('user-1', '2026-09-22')).toBeNull();
  });

  it('two different users never collide - user A\'s flag/delete never touches user B\'s', async () => {
    localStorage.setItem(getEveningCompletionKey('user-a'), '2026-09-22');
    localStorage.setItem(getEveningCompletionKey('user-b'), '2026-09-22');
    setResult({ data: [], error: null });
    await redoEveningWindDown({ userId: 'user-a', isGuest: false, localDate: '2026-09-22', resetRoutine: vi.fn() });
    expect(localStorage.getItem(getEveningCompletionKey('user-a'))).toBeNull();
    expect(localStorage.getItem(getEveningCompletionKey('user-b'))).toBe('2026-09-22');
  });
});

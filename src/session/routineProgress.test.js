// This repo's Vitest runs in a plain Node environment - not jsdom - so
// there is no real `localStorage` global (see
// notificationPreferences.test.js's own note). routineProgress.js reads/
// writes the bare `localStorage` global directly, so an in-memory mock is
// installed as that exact global for these tests.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SESSION_STATUS } from './sessionReducer';

const store = new Map();
const localStorageMock = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};
const originalLocalStorage = globalThis.localStorage;
globalThis.localStorage = localStorageMock;
afterAll(() => {
  globalThis.localStorage = originalLocalStorage;
});

const {
  saveRoutineProgress,
  getRoutineProgress,
  getRoutineProgressIncludingStale,
  clearRoutineProgress,
  clearAllRoutineProgress,
  pinRoutineDate,
  getPinnedRoutineDate,
  unpinRoutineDate,
  ROUTINE_PROGRESS_VERSION
} = await import('./routineProgress');

const MORNING = 'morning-routine';
const EVENING = 'evening-wind-down';
const ROUTINE_PROGRESS_KEY = 'moonlight_routine_progress';

describe('routineProgress — independent per-routine snapshots (Build 10 remediation)', () => {
  beforeEach(() => {
    store.clear();
  });

  it('has nothing saved returns null for either routine', () => {
    expect(getRoutineProgress(MORNING)).toBeNull();
    expect(getRoutineProgress(EVENING)).toBeNull();
  });

  it('saving Morning progress never touches Evening, and vice versa - both can be in-progress simultaneously', () => {
    saveRoutineProgress(MORNING, { stepIndex: 2, status: SESSION_STATUS.INTERRUPTED, startedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:05:00.000Z', completionEventId: null });
    saveRoutineProgress(EVENING, { stepIndex: 1, status: SESSION_STATUS.PLAYING, startedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:02:00.000Z', completionEventId: null });

    const morning = getRoutineProgress(MORNING);
    const evening = getRoutineProgress(EVENING);
    expect(morning).toMatchObject({ stepIndex: 2, status: SESSION_STATUS.INTERRUPTED });
    expect(evening).toMatchObject({ stepIndex: 1, status: SESSION_STATUS.PLAYING });
  });

  it('starting/saving a different routine does not destroy the other one\'s already-saved snapshot (the core architectural fix)', () => {
    saveRoutineProgress(MORNING, { stepIndex: 3, status: SESSION_STATUS.INTERRUPTED, startedAt: null, updatedAt: null, completionEventId: null });
    // Simulates switching to Evening - Morning's own entry must survive.
    saveRoutineProgress(EVENING, { stepIndex: 0, status: SESSION_STATUS.PLAYING, startedAt: null, updatedAt: null, completionEventId: null });
    expect(getRoutineProgress(MORNING)).toMatchObject({ stepIndex: 3, status: SESSION_STATUS.INTERRUPTED });
  });

  it('clearRoutineProgress removes only the named routine\'s entry', () => {
    saveRoutineProgress(MORNING, { stepIndex: 1, status: SESSION_STATUS.PLAYING, startedAt: null, updatedAt: null, completionEventId: null });
    saveRoutineProgress(EVENING, { stepIndex: 1, status: SESSION_STATUS.PLAYING, startedAt: null, updatedAt: null, completionEventId: null });
    clearRoutineProgress(MORNING);
    expect(getRoutineProgress(MORNING)).toBeNull();
    expect(getRoutineProgress(EVENING)).not.toBeNull();
  });

  it('clearRoutineProgress is idempotent - clearing an already-empty routine is a safe no-op', () => {
    expect(() => clearRoutineProgress(MORNING)).not.toThrow();
    expect(() => clearRoutineProgress(MORNING)).not.toThrow();
    expect(getRoutineProgress(MORNING)).toBeNull();
  });

  it('clearAllRoutineProgress wipes every routine (sign-out/user-switch isolation)', () => {
    saveRoutineProgress(MORNING, { stepIndex: 1, status: SESSION_STATUS.PLAYING, startedAt: null, updatedAt: null, completionEventId: null });
    saveRoutineProgress(EVENING, { stepIndex: 1, status: SESSION_STATUS.PLAYING, startedAt: null, updatedAt: null, completionEventId: null });
    clearAllRoutineProgress();
    expect(getRoutineProgress(MORNING)).toBeNull();
    expect(getRoutineProgress(EVENING)).toBeNull();
  });

  it('daily lifecycle: an entry stamped with a previous local day is invisible to getRoutineProgress (never silently carried into today)', () => {
    store.set(ROUTINE_PROGRESS_KEY, JSON.stringify({
      version: ROUTINE_PROGRESS_VERSION,
      routines: { [MORNING]: { stepIndex: 2, status: SESSION_STATUS.INTERRUPTED, startedAt: null, updatedAt: null, completionEventId: null, dateKey: '2000-01-01' } }
    }));
    expect(getRoutineProgress(MORNING)).toBeNull();
  });

  it('daily lifecycle: getRoutineProgressIncludingStale still surfaces yesterday\'s entry, tagged isStale', () => {
    store.set(ROUTINE_PROGRESS_KEY, JSON.stringify({
      version: ROUTINE_PROGRESS_VERSION,
      routines: { [EVENING]: { stepIndex: 1, status: SESSION_STATUS.INTERRUPTED, startedAt: null, updatedAt: null, completionEventId: null, dateKey: '2000-01-01' } }
    }));
    const stale = getRoutineProgressIncludingStale(EVENING);
    expect(stale).toMatchObject({ stepIndex: 1, status: SESSION_STATUS.INTERRUPTED, isStale: true });
  });

  it('a freshly-saved (today\'s) entry is never flagged stale', () => {
    saveRoutineProgress(MORNING, { stepIndex: 0, status: SESSION_STATUS.PLAYING, startedAt: null, updatedAt: null, completionEventId: null });
    expect(getRoutineProgressIncludingStale(MORNING)).toMatchObject({ isStale: false });
  });

  it('rejects a stepIndex out of range for that routine\'s own registry definition - fails safely (null), never a crash or a clamp', () => {
    store.set(ROUTINE_PROGRESS_KEY, JSON.stringify({
      version: ROUTINE_PROGRESS_VERSION,
      routines: { [MORNING]: { stepIndex: 999, status: SESSION_STATUS.PLAYING, startedAt: null, updatedAt: null, completionEventId: null, dateKey: '2000-01-01' } }
    }));
    expect(getRoutineProgress(MORNING)).toBeNull();
    expect(getRoutineProgressIncludingStale(MORNING)).toBeNull();
  });

  it('rejects an unknown sessionId outright - never invents a routine that isn\'t registered', () => {
    store.set(ROUTINE_PROGRESS_KEY, JSON.stringify({
      version: ROUTINE_PROGRESS_VERSION,
      routines: { 'not-a-real-routine': { stepIndex: 0, status: SESSION_STATUS.PLAYING, startedAt: null, updatedAt: null, completionEventId: null, dateKey: '2000-01-01' } }
    }));
    expect(getRoutineProgress('not-a-real-routine')).toBeNull();
  });

  it('rejects corrupt JSON/wrong version/malformed shape without throwing', () => {
    store.set(ROUTINE_PROGRESS_KEY, '{not valid json');
    expect(() => getRoutineProgress(MORNING)).not.toThrow();
    expect(getRoutineProgress(MORNING)).toBeNull();

    store.set(ROUTINE_PROGRESS_KEY, JSON.stringify({ version: 999, routines: { [MORNING]: {} } }));
    expect(getRoutineProgress(MORNING)).toBeNull();
  });

  it('saveRoutineProgress silently no-ops for a null/unknown sessionId', () => {
    expect(() => saveRoutineProgress(null, { stepIndex: 0, status: SESSION_STATUS.PLAYING })).not.toThrow();
    expect(() => saveRoutineProgress('not-a-real-routine', { stepIndex: 0, status: SESSION_STATUS.PLAYING })).not.toThrow();
    expect(getRoutineProgress('not-a-real-routine')).toBeNull();
  });
});

describe('pinRoutineDate/getPinnedRoutineDate/unpinRoutineDate - "Resume Previous Routine" date retention', () => {
  beforeEach(() => {
    store.clear();
  });

  it('has nothing pinned by default', () => {
    expect(getPinnedRoutineDate(MORNING)).toBeNull();
  });

  it('pins and reads back independently per sessionId', () => {
    pinRoutineDate(MORNING, '2026-09-10');
    pinRoutineDate(EVENING, '2026-09-11');
    expect(getPinnedRoutineDate(MORNING)).toBe('2026-09-10');
    expect(getPinnedRoutineDate(EVENING)).toBe('2026-09-11');
  });

  it('unpinRoutineDate clears only the named routine, and is idempotent', () => {
    pinRoutineDate(MORNING, '2026-09-10');
    pinRoutineDate(EVENING, '2026-09-11');
    unpinRoutineDate(MORNING);
    expect(getPinnedRoutineDate(MORNING)).toBeNull();
    expect(getPinnedRoutineDate(EVENING)).toBe('2026-09-11');
    expect(() => unpinRoutineDate(MORNING)).not.toThrow();
  });

  it('saveRoutineProgress stamps the PINNED date, not today, while a routine is pinned (the core "retain original identity" fix)', () => {
    pinRoutineDate(EVENING, '2026-09-10');
    saveRoutineProgress(EVENING, { stepIndex: 2, status: SESSION_STATUS.PLAYING, startedAt: '2026-09-10T20:00:00.000Z', updatedAt: '2026-09-10T20:05:00.000Z', completionEventId: null });
    const stale = getRoutineProgressIncludingStale(EVENING);
    expect(stale).toMatchObject({ stepIndex: 2, status: SESSION_STATUS.PLAYING, dateKey: '2026-09-10' });
  });

  it('saveRoutineProgress falls back to today once unpinned', () => {
    pinRoutineDate(MORNING, '2000-01-01');
    unpinRoutineDate(MORNING);
    saveRoutineProgress(MORNING, { stepIndex: 0, status: SESSION_STATUS.PLAYING, startedAt: null, updatedAt: null, completionEventId: null });
    expect(getRoutineProgressIncludingStale(MORNING)).toMatchObject({ isStale: false });
  });

  it('clearAllRoutineProgress (sign-out isolation) also wipes every pinned date', () => {
    pinRoutineDate(MORNING, '2026-09-10');
    pinRoutineDate(EVENING, '2026-09-11');
    clearAllRoutineProgress();
    expect(getPinnedRoutineDate(MORNING)).toBeNull();
    expect(getPinnedRoutineDate(EVENING)).toBeNull();
  });
});

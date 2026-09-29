// Phase 9 — Truthful Journey Outcomes (Part 10): persistence/isolation
// coverage specific to the new stepOutcomes field, layered on top of this
// codebase's own already-extensive, already-passing cross-user isolation
// suite (routineProgress.test.js, signOutIsolation.test.js,
// authRouting.test.js, Home.routineState.test.js) - this file does not
// duplicate that coverage, only proves stepOutcomes inherits it.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE = new Map();
beforeEach(() => {
  STORAGE.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (STORAGE.has(k) ? STORAGE.get(k) : null),
    setItem: (k, v) => STORAGE.set(k, String(v)),
    removeItem: (k) => STORAGE.delete(k),
  });
});

describe('sessionPersistence.js — stepOutcomes legacy safety and round-trip', () => {
  it('a legacy v3 blob with no stepOutcomes field at all restores safely to {} - never crashes, never fabricates outcomes from stepIndex', async () => {
    const { loadSessionState, SESSION_STORAGE_KEY, SESSION_STORAGE_VERSION } = await import('./sessionPersistence');
    const legacy = {
      sessionId: 'morning-routine',
      stepIndex: 3,
      status: 'playing',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      interruptionReason: null,
      completionEventId: null,
      // no stepOutcomes key at all - the exact pre-Phase-9 shape
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ version: SESSION_STORAGE_VERSION, state: legacy }));
    const restored = loadSessionState();
    expect(restored).not.toBeNull();
    expect(restored.stepOutcomes).toEqual({});
    expect(restored.stepIndex).toBe(3); // position itself is still honestly restored, just no outcome history invented
  });

  it('a genuine round-trip (save then load) preserves stepOutcomes exactly', async () => {
    const { saveSessionState, loadSessionState } = await import('./sessionPersistence');
    const state = {
      sessionId: 'evening-wind-down',
      stepIndex: 3,
      status: 'playing',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      interruptionReason: null,
      completionEventId: null,
      stepOutcomes: { windDown: 'completed', reflection: 'completed', gratitude: 'skipped' },
    };
    saveSessionState(state);
    const restored = loadSessionState();
    expect(restored.stepOutcomes).toEqual(state.stepOutcomes);
  });

  it('an individually-invalid stepOutcomes entry (unknown step id, or a bogus outcome value) is dropped, never propagated or used to reject the whole restore', async () => {
    const { saveSessionState, loadSessionState } = await import('./sessionPersistence');
    const state = {
      sessionId: 'morning-routine',
      stepIndex: 2,
      status: 'playing',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      interruptionReason: null,
      completionEventId: null,
      stepOutcomes: { intention: 'completed', notARealStepId: 'completed', stretch: 'bogus-value' },
    };
    saveSessionState(state);
    const restored = loadSessionState();
    expect(restored.stepOutcomes).toEqual({ intention: 'completed' });
  });
});

// WakeWise DEV — release-blocking runtime investigation (Evening Breathing
// blank-screen fix). This code path (missing key / legacy version) turned
// out to be completely unrelated to the actual root cause (a pure CSS
// stacking bug in EveningSceneShell.jsx - see
// eveningSceneShellStackingOrder.test.js), but was explicitly required
// verification during that investigation: a real, authenticated user's
// persisted 'evening-wind-down' session at stepIndex 3 (Breathing),
// status 'playing', restored completely correctly through this exact
// module - the blank screen was never a session-restore defect. These two
// tests close the remaining gap this file's own suite didn't yet cover
// explicitly: no stored key at all, and a stale/legacy version number.
describe('sessionPersistence.js — missing key and legacy version safety (release-blocking runtime investigation)', () => {
  it('no stored key at all restores to null (idle) - never throws, never fabricates a session', async () => {
    const { loadSessionState } = await import('./sessionPersistence');
    expect(loadSessionState()).toBeNull();
  });

  it('a stored blob under an OLDER version number (a real, valid v3-shaped state that predates the current SESSION_STORAGE_VERSION) is rejected wholesale, not partially trusted - the exact real-world scenario a physical device with an older cached deploy could reach', async () => {
    const { saveSessionState, loadSessionState, SESSION_STORAGE_KEY, SESSION_STORAGE_VERSION } = await import('./sessionPersistence');
    const state = {
      sessionId: 'evening-wind-down',
      stepIndex: 3,
      status: 'playing',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      interruptionReason: null,
      completionEventId: null,
      stepOutcomes: { windDown: 'completed', reflection: 'completed', gratitude: 'completed' },
    };
    // Save under the REAL current version first (proving the state shape
    // itself is genuinely valid), then overwrite with the same state under
    // an older version number - the only thing that changed is `version`.
    saveSessionState(state);
    expect(loadSessionState()).not.toBeNull();
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ version: SESSION_STORAGE_VERSION - 1, state }));
    expect(loadSessionState()).toBeNull();
  });

  it('corrupt JSON in the stored key is rejected safely, never thrown', async () => {
    const { loadSessionState, SESSION_STORAGE_KEY } = await import('./sessionPersistence');
    localStorage.setItem(SESSION_STORAGE_KEY, '{not valid json');
    expect(() => loadSessionState()).not.toThrow();
    expect(loadSessionState()).toBeNull();
  });
});

describe('routineProgress.js — stepOutcomes inherits the existing sign-out/user-switch isolation guarantee', () => {
  it('clearAllRoutineProgress() (already wired into AuthContext.signOut per this repo\'s own established isolation suite) wipes a routine\'s stepOutcomes along with the rest of its snapshot', async () => {
    const { saveRoutineProgress, getRoutineProgress, clearAllRoutineProgress } = await import('./routineProgress');
    saveRoutineProgress('morning-routine', {
      stepIndex: 2,
      status: 'playing',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completionEventId: null,
      stepOutcomes: { intention: 'completed', stretch: 'skipped' },
    });
    expect(getRoutineProgress('morning-routine').stepOutcomes).toEqual({ intention: 'completed', stretch: 'skipped' });
    clearAllRoutineProgress();
    expect(getRoutineProgress('morning-routine')).toBeNull();
  });

  it('a legacy routineProgress entry with no stepOutcomes field restores to {} - same safe fallback as sessionPersistence.js', async () => {
    const { saveRoutineProgress, getRoutineProgress } = await import('./routineProgress');
    // Save once via the real API to get a valid dateKey/shape, then simulate
    // a pre-Phase-9 write by re-saving through the module's own writeAll
    // path is not exported - instead prove the public contract: omitting
    // stepOutcomes from the snapshot passed to saveRoutineProgress (exactly
    // what a not-yet-upgraded caller would do) still yields {} on read.
    saveRoutineProgress('evening-wind-down', {
      stepIndex: 1,
      status: 'playing',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completionEventId: null,
      // stepOutcomes omitted entirely
    });
    expect(getRoutineProgress('evening-wind-down').stepOutcomes).toEqual({});
  });
});

describe('dailyCompletion.js — the new "genuinely fully completed" signals are user-scoped exactly like every other completion flag', () => {
  it('getMorningFullyCompletedKey/getEveningFullyCompletedKey key by userId, matching getMorningCompletionKey\'s own established scoping - two different users never share a key', async () => {
    const { getMorningFullyCompletedKey, getEveningFullyCompletedKey, getMorningCompletionKey } = await import('../lib/dailyCompletion');
    const userA = getMorningFullyCompletedKey('user-a');
    const userB = getMorningFullyCompletedKey('user-b');
    expect(userA).not.toBe(userB);
    expect(userA).toContain('user-a');
    // Same scoping convention as the pre-existing flag (":" + userId suffix)
    expect(userA.endsWith(':user-a')).toBe(true);
    expect(getMorningCompletionKey('user-a').endsWith(':user-a')).toBe(true);
    expect(getEveningFullyCompletedKey(null)).not.toMatch(/:null|:undefined/); // guest key stays the bare base key, never a literal "null"/"undefined" suffix
  });
});

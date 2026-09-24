// Same in-memory localStorage mock pattern as morningFlowMigration.test.js -
// this repo's Vitest runs in plain Node, no real localStorage global.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
  runEmbeddedMeditationMigration,
  EMBEDDED_MEDITATION_MIGRATION_MARKER_KEY
} = await import('./embeddedMeditationMigration');
const { SESSION_STORAGE_KEY, SESSION_STORAGE_VERSION } = await import('./sessionPersistence');
const { ROUTINE_PROGRESS_KEY, ROUTINE_PROGRESS_VERSION } = await import('./routineProgress');
const { SESSION_STATUS } = await import('./sessionReducer');

const MORNING = 'morning-routine';
const EVENING = 'evening-wind-down';

// Seeds a v2-wrapped blob (the shape every currently-deployed device has
// before this migration ever runs) - the OLD registry's own step count,
// pre-meditate-insertion.
const seedV2SessionProgress = (state) => {
  store.set(SESSION_STORAGE_KEY, JSON.stringify({ version: 2, state }));
};
const seedV2RoutineProgress = (routines) => {
  store.set(ROUTINE_PROGRESS_KEY, JSON.stringify({ version: 2, routines }));
};

describe('embeddedMeditationMigration — targeted v2->v3 migration (Journey Embedding)', () => {
  beforeEach(() => {
    store.clear();
  });

  it('discards a live Morning session from the global slot (unlike morningFlowMigration.js, Morning\'s shape changed again here)', () => {
    seedV2SessionProgress({
      sessionId: MORNING,
      stepIndex: 4, // was 'affirmation' under the pre-meditate 6-step order
      status: SESSION_STATUS.PLAYING,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:05:00.000Z',
      interruptionReason: null,
      completionEventId: null
    });

    runEmbeddedMeditationMigration();

    expect(store.get(SESSION_STORAGE_KEY)).toBeUndefined();
  });

  it('ALSO discards a live Evening session from the global slot - the key difference from the v1->v2 migration, since Evening\'s own registry changed shape this time too', () => {
    seedV2SessionProgress({
      sessionId: EVENING,
      stepIndex: 4, // was 'sleepPreparation' under the pre-meditation 6-step order
      status: SESSION_STATUS.INTERRUPTED,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:10:00.000Z',
      interruptionReason: 'user_back_navigation',
      completionEventId: null
    });

    runEmbeddedMeditationMigration();

    expect(store.get(SESSION_STORAGE_KEY)).toBeUndefined();
  });

  it('preserves a COMPLETED Morning/Evening snapshot byte-for-byte, only bumping the version wrapper - a resolved outcome is not stepIndex-sensitive', () => {
    const completedState = {
      sessionId: MORNING,
      stepIndex: 5,
      status: SESSION_STATUS.COMPLETED,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:20:00.000Z',
      interruptionReason: null,
      completionEventId: 'evt-1'
    };
    seedV2SessionProgress(completedState);

    runEmbeddedMeditationMigration();

    const rewritten = JSON.parse(store.get(SESSION_STORAGE_KEY));
    expect(rewritten.version).toBe(SESSION_STORAGE_VERSION);
    expect(rewritten.state).toEqual(completedState);
  });

  it('drops an unfinished entry for EITHER routine from the per-routine snapshot map, keeping a completed one for the other', () => {
    const completedEvening = {
      stepIndex: 5,
      status: SESSION_STATUS.COMPLETED,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:03:00.000Z',
      completionEventId: 'evt-2',
      dateKey: '2026-01-01'
    };
    seedV2RoutineProgress({
      [MORNING]: {
        stepIndex: 3, // was 'breathe' under the pre-meditate order
        status: SESSION_STATUS.INTERRUPTED,
        startedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:03:00.000Z',
        completionEventId: null,
        dateKey: '2026-01-01'
      },
      [EVENING]: completedEvening
    });

    runEmbeddedMeditationMigration();

    const rewritten = JSON.parse(store.get(ROUTINE_PROGRESS_KEY));
    expect(rewritten.version).toBe(ROUTINE_PROGRESS_VERSION);
    expect(rewritten.routines[MORNING]).toBeUndefined();
    expect(rewritten.routines[EVENING]).toEqual(completedEvening);
  });

  it('is idempotent - a second call makes no further changes and does not re-discard a fresh v3 entry written after the first run', () => {
    seedV2SessionProgress({
      sessionId: MORNING,
      stepIndex: 1,
      status: SESSION_STATUS.PLAYING,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      interruptionReason: null,
      completionEventId: null
    });

    runEmbeddedMeditationMigration();
    expect(store.get(SESSION_STORAGE_KEY)).toBeUndefined();

    const freshMorning = {
      sessionId: MORNING,
      stepIndex: 0,
      status: SESSION_STATUS.PLAYING,
      startedAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      interruptionReason: null,
      completionEventId: null
    };
    store.set(SESSION_STORAGE_KEY, JSON.stringify({ version: SESSION_STORAGE_VERSION, state: freshMorning }));

    runEmbeddedMeditationMigration(); // second call - must be a total no-op now

    const stillThere = JSON.parse(store.get(SESSION_STORAGE_KEY));
    expect(stillThere).toEqual({ version: SESSION_STORAGE_VERSION, state: freshMorning });
  });

  it('sets its own migration marker after running', () => {
    expect(store.get(EMBEDDED_MEDITATION_MIGRATION_MARKER_KEY)).toBeUndefined();
    runEmbeddedMeditationMigration();
    expect(store.get(EMBEDDED_MEDITATION_MIGRATION_MARKER_KEY)).toBe('done');
  });

  it('malformed storage fails safely - corrupt JSON is removed, never thrown', () => {
    store.set(SESSION_STORAGE_KEY, '{not valid json');
    store.set(ROUTINE_PROGRESS_KEY, '{also not valid');

    expect(() => runEmbeddedMeditationMigration()).not.toThrow();

    expect(store.get(SESSION_STORAGE_KEY)).toBeUndefined();
  });

  it('a missing/absent key is a safe no-op (nothing to migrate)', () => {
    expect(() => runEmbeddedMeditationMigration()).not.toThrow();
    expect(store.get(SESSION_STORAGE_KEY)).toBeUndefined();
    expect(store.get(ROUTINE_PROGRESS_KEY)).toBeUndefined();
  });

  it('an already-current (v3) blob is left completely untouched', () => {
    const currentState = {
      sessionId: EVENING,
      stepIndex: 2,
      status: SESSION_STATUS.PLAYING,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      interruptionReason: null,
      completionEventId: null
    };
    store.set(SESSION_STORAGE_KEY, JSON.stringify({ version: SESSION_STORAGE_VERSION, state: currentState }));

    runEmbeddedMeditationMigration();

    expect(JSON.parse(store.get(SESSION_STORAGE_KEY))).toEqual({ version: SESSION_STORAGE_VERSION, state: currentState });
  });

  it('leaves completion-date flags, Morning intentions, and Evening journal-response keys completely untouched', () => {
    store.set('moonlight_morning_completed_date', '2026-01-01');
    store.set('moonlight_evening_completed_date', '2026-01-01');
    store.set('moonlight_intentions', JSON.stringify(['Stay calm']));
    store.set('moonlight_routine_responses', JSON.stringify({ reflection: ['A thoughtful answer'] }));

    seedV2SessionProgress({
      sessionId: EVENING,
      stepIndex: 1,
      status: SESSION_STATUS.PLAYING,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      interruptionReason: null,
      completionEventId: null
    });

    runEmbeddedMeditationMigration();

    expect(store.get('moonlight_morning_completed_date')).toBe('2026-01-01');
    expect(store.get('moonlight_evening_completed_date')).toBe('2026-01-01');
    expect(store.get('moonlight_intentions')).toBe(JSON.stringify(['Stay calm']));
    expect(store.get('moonlight_routine_responses')).toBe(JSON.stringify({ reflection: ['A thoughtful answer'] }));
  });

  it('runs synchronously before any restored session state could ever be interpreted against the new registries - called at module-evaluation time in SessionContext.jsx, immediately after runMorningFlowMigration()', () => {
    const contextSource = readFileSync(fileURLToPath(new URL('../context/SessionContext.jsx', import.meta.url)), 'utf-8');
    expect(contextSource).toMatch(/runMorningFlowMigration\(\);\s*\n[\s\S]*?runEmbeddedMeditationMigration\(\);/);
    // Neither call is inside a React effect/component body - both are
    // top-level statements, so ES module evaluation (synchronous) runs
    // them before main.jsx ever calls ReactDOM's render().
    const beforeProvider = contextSource.slice(0, contextSource.indexOf('export const SessionProvider'));
    expect(beforeProvider).toMatch(/runEmbeddedMeditationMigration\(\);/);
  });

  it('no Supabase reference anywhere in this migration - client-local only', () => {
    const source = readFileSync(fileURLToPath(new URL('./embeddedMeditationMigration.js', import.meta.url)), 'utf-8');
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/supabase/i);
  });
});

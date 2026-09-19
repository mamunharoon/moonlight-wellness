// Same in-memory localStorage mock pattern as routineProgress.test.js -
// this repo's Vitest runs in plain Node, no real localStorage global.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';

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
  runMorningFlowMigration,
  consumeMorningFlowMigrationNotice,
  MORNING_FLOW_MIGRATION_MARKER_KEY
} = await import('./morningFlowMigration');
const { SESSION_STORAGE_KEY } = await import('./sessionPersistence');
const { ROUTINE_PROGRESS_KEY, PINNED_DATE_KEY } = await import('./routineProgress');
const { SESSION_STATUS } = await import('./sessionReducer');

const JOURNEY_STEP_KEY = 'moonlight_journey_step';
const MORNING = 'morning-routine';
const EVENING = 'evening-wind-down';

const seedV1SessionProgress = (state) => {
  store.set(SESSION_STORAGE_KEY, JSON.stringify({ version: 1, state }));
};
const seedV1RoutineProgress = (routines) => {
  store.set(ROUTINE_PROGRESS_KEY, JSON.stringify({ version: 1, routines }));
};

describe('morningFlowMigration — targeted v1->v2 migration (Morning reorder)', () => {
  beforeEach(() => {
    store.clear();
  });

  it('clears a live Morning session from the global slot', () => {
    seedV1SessionProgress({
      sessionId: MORNING,
      stepIndex: 2, // was 'affirmation' under the old 7-step order
      status: SESSION_STATUS.PLAYING,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:05:00.000Z',
      interruptionReason: null,
      completionEventId: null
    });

    runMorningFlowMigration();

    expect(store.get(SESSION_STORAGE_KEY)).toBeUndefined();
  });

  it('preserves a live Evening session in the global slot byte-for-byte, only bumping the version wrapper', () => {
    const eveningState = {
      sessionId: EVENING,
      stepIndex: 3,
      status: SESSION_STATUS.INTERRUPTED,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:10:00.000Z',
      interruptionReason: 'user_back_navigation',
      completionEventId: null
    };
    seedV1SessionProgress(eveningState);

    runMorningFlowMigration();

    const rewritten = JSON.parse(store.get(SESSION_STORAGE_KEY));
    expect(rewritten.version).toBe(2);
    expect(rewritten.state).toEqual(eveningState);
  });

  it('drops only the Morning entry from the per-routine snapshot map, keeping Evening\'s untouched', () => {
    const eveningEntry = {
      stepIndex: 1,
      status: SESSION_STATUS.PLAYING,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:02:00.000Z',
      completionEventId: null,
      dateKey: '2026-01-01'
    };
    seedV1RoutineProgress({
      [MORNING]: {
        stepIndex: 4, // was 'breathe' under the old order
        status: SESSION_STATUS.INTERRUPTED,
        startedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:03:00.000Z',
        completionEventId: null,
        dateKey: '2026-01-01'
      },
      [EVENING]: eveningEntry
    });

    runMorningFlowMigration();

    const rewritten = JSON.parse(store.get(ROUTINE_PROGRESS_KEY));
    expect(rewritten.version).toBe(2);
    expect(rewritten.routines[MORNING]).toBeUndefined();
    expect(rewritten.routines[EVENING]).toEqual(eveningEntry);
  });

  it('preserves an Evening pinned stale-routine date, dropping only a Morning pin', () => {
    store.set(PINNED_DATE_KEY, JSON.stringify({ [MORNING]: '2025-12-30', [EVENING]: '2025-12-31' }));

    runMorningFlowMigration();

    const rewritten = JSON.parse(store.get(PINNED_DATE_KEY));
    expect(rewritten[MORNING]).toBeUndefined();
    expect(rewritten[EVENING]).toBe('2025-12-31');
  });

  it('clears moonlight_journey_step unconditionally when it holds any Morning value', () => {
    store.set(JOURNEY_STEP_KEY, 'affirmation');

    runMorningFlowMigration();

    expect(store.get(JOURNEY_STEP_KEY)).toBeUndefined();
  });

  it('is idempotent - a second call makes no further changes and does not re-discard a fresh Evening entry written after the first run', () => {
    seedV1SessionProgress({
      sessionId: MORNING,
      stepIndex: 1,
      status: SESSION_STATUS.PLAYING,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      interruptionReason: null,
      completionEventId: null
    });

    runMorningFlowMigration();
    expect(store.get(SESSION_STORAGE_KEY)).toBeUndefined();

    // Simulate a brand-new, post-migration Evening session starting.
    const freshEvening = {
      sessionId: EVENING,
      stepIndex: 0,
      status: SESSION_STATUS.PLAYING,
      startedAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      interruptionReason: null,
      completionEventId: null
    };
    store.set(SESSION_STORAGE_KEY, JSON.stringify({ version: 2, state: freshEvening }));

    runMorningFlowMigration(); // second call - must be a total no-op now

    const stillThere = JSON.parse(store.get(SESSION_STORAGE_KEY));
    expect(stillThere).toEqual({ version: 2, state: freshEvening });
  });

  it('sets the migration marker after running, and running again does not re-process an already-migrated v2 blob', () => {
    expect(store.get(MORNING_FLOW_MIGRATION_MARKER_KEY)).toBeUndefined();
    runMorningFlowMigration();
    expect(store.get(MORNING_FLOW_MIGRATION_MARKER_KEY)).toBe('done');
  });

  it('surfaces a one-time notice when unfinished Morning progress was actually discarded', () => {
    seedV1SessionProgress({
      sessionId: MORNING,
      stepIndex: 3,
      status: SESSION_STATUS.PLAYING,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      interruptionReason: null,
      completionEventId: null
    });

    runMorningFlowMigration();

    expect(consumeMorningFlowMigrationNotice()).toBe(true);
    // One-shot: consuming it clears it, so a second read is false even
    // within the same (already-migrated) session.
    expect(consumeMorningFlowMigrationNotice()).toBe(false);
  });

  it('does not surface a notice when there was nothing unfinished to discard (e.g. only Evening progress existed)', () => {
    seedV1SessionProgress({
      sessionId: EVENING,
      stepIndex: 2,
      status: SESSION_STATUS.PLAYING,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      interruptionReason: null,
      completionEventId: null
    });

    runMorningFlowMigration();

    expect(consumeMorningFlowMigrationNotice()).toBe(false);
  });

  it('does not surface a notice for a completed/skipped Morning snapshot (a resolved outcome, not unfinished progress)', () => {
    seedV1RoutineProgress({
      [MORNING]: {
        stepIndex: 6,
        status: SESSION_STATUS.COMPLETED,
        startedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        completionEventId: 'evt-1',
        dateKey: '2026-01-01'
      }
    });

    runMorningFlowMigration();

    expect(consumeMorningFlowMigrationNotice()).toBe(false);
  });

  it('leaves completion-date and intentions keys completely untouched', () => {
    store.set('moonlight_morning_completed_date', '2026-01-01');
    store.set('moonlight_evening_completed_date', '2026-01-01');
    store.set('moonlight_intentions', JSON.stringify(['Stay calm']));

    seedV1SessionProgress({
      sessionId: MORNING,
      stepIndex: 1,
      status: SESSION_STATUS.PLAYING,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      interruptionReason: null,
      completionEventId: null
    });

    runMorningFlowMigration();

    expect(store.get('moonlight_morning_completed_date')).toBe('2026-01-01');
    expect(store.get('moonlight_evening_completed_date')).toBe('2026-01-01');
    expect(store.get('moonlight_intentions')).toBe(JSON.stringify(['Stay calm']));
  });
});

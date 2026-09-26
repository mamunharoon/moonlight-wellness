// WakeWise Phase 1 correction — real behavioural tests for tonight's
// Prepare for Rest checklist/bedtime-media selection
// (eveningPrepareSelection.js). This repo's Vitest runs in a plain Node
// environment - not jsdom - so there is no real `localStorage` global (see
// eveningBreathingSelection.test.js's own identical note); an in-memory
// mock is installed as that global for these tests only.
import { describe, it, expect, afterAll } from 'vitest';

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
  EVENING_PREPARE_SELECTION_KEY,
  getEveningPrepareSelectionKey,
  saveEveningPrepareSelection,
  loadEveningPrepareSelection,
  clearEveningPrepareSelection
} = await import('./eveningPrepareSelection');

describe('getEveningPrepareSelectionKey - user-scoped, mirroring eveningBreathingSelection.js\'s own convention', () => {
  it('a guest (no userId) reads/writes the original unscoped key', () => {
    expect(getEveningPrepareSelectionKey(null)).toBe(EVENING_PREPARE_SELECTION_KEY);
    expect(getEveningPrepareSelectionKey(undefined)).toBe(EVENING_PREPARE_SELECTION_KEY);
  });

  it('a registered user gets their own key, suffixed with their Supabase user id', () => {
    expect(getEveningPrepareSelectionKey('user-a')).toBe(`${EVENING_PREPARE_SELECTION_KEY}:user-a`);
  });

  it('two different users never collide on the same key', () => {
    expect(getEveningPrepareSelectionKey('user-a')).not.toBe(getEveningPrepareSelectionKey('user-b'));
  });
});

describe('saveEveningPrepareSelection / loadEveningPrepareSelection - round trip, same-day only', () => {
  it('a selection saved and loaded for the exact same date round-trips correctly (checklist + bedtime media)', () => {
    store.clear();
    saveEveningPrepareSelection('user-a', { prepIds: ['phone', 'water'], bedtimeId: 'SL01' }, '2026-09-24');
    expect(loadEveningPrepareSelection('user-a', '2026-09-24')).toEqual({ prepIds: ['phone', 'water'], bedtimeId: 'SL01' });
  });

  it('a null bedtimeId (nothing chosen yet) is itself a valid, round-trippable state', () => {
    store.clear();
    saveEveningPrepareSelection('user-a', { prepIds: ['dim'], bedtimeId: null }, '2026-09-24');
    expect(loadEveningPrepareSelection('user-a', '2026-09-24')).toEqual({ prepIds: ['dim'], bedtimeId: null });
  });

  it('an empty checklist with nothing selected still round-trips (not conflated with "nothing ever saved")', () => {
    store.clear();
    saveEveningPrepareSelection('user-a', { prepIds: [], bedtimeId: null }, '2026-09-24');
    expect(loadEveningPrepareSelection('user-a', '2026-09-24')).toEqual({ prepIds: [], bedtimeId: null });
  });

  it('returns null when nothing has ever been saved for this identity', () => {
    store.clear();
    expect(loadEveningPrepareSelection('user-a', '2026-09-24')).toBeNull();
  });

  it('a stale prior-day selection is ignored, never silently reused - the caller falls back to an empty checklist', () => {
    store.clear();
    saveEveningPrepareSelection('user-a', { prepIds: ['phone'], bedtimeId: 'SL01' }, '2026-09-23');
    expect(loadEveningPrepareSelection('user-a', '2026-09-24')).toBeNull();
  });

  it('corrupt/non-JSON stored data is handled gracefully - returns null, never throws', () => {
    store.clear();
    localStorage.setItem(getEveningPrepareSelectionKey('user-a'), 'not valid json{{{');
    expect(() => loadEveningPrepareSelection('user-a', '2026-09-24')).not.toThrow();
    expect(loadEveningPrepareSelection('user-a', '2026-09-24')).toBeNull();
  });

  it('a malformed stored shape (prepIds not an array) safely falls back to null, never fabricates or throws', () => {
    store.clear();
    localStorage.setItem(getEveningPrepareSelectionKey('user-a'), JSON.stringify({ prepIds: 'not-an-array', dateKey: '2026-09-24' }));
    expect(loadEveningPrepareSelection('user-a', '2026-09-24')).toBeNull();
  });

  it('User A\'s selection is never visible to User B - cross-user isolation', () => {
    store.clear();
    saveEveningPrepareSelection('user-a', { prepIds: ['phone'], bedtimeId: 'SL01' }, '2026-09-24');
    expect(loadEveningPrepareSelection('user-b', '2026-09-24')).toBeNull();
  });

  it('a guest\'s selection is scoped to the unscoped device key, distinct from any registered user\'s own key - a signed-in user who signs out and continues as guest never sees their own prior selection leak into the guest view', () => {
    store.clear();
    saveEveningPrepareSelection('user-a', { prepIds: ['phone'], bedtimeId: 'SL01' }, '2026-09-24');
    expect(loadEveningPrepareSelection(null, '2026-09-24')).toBeNull();
  });
});

describe('clearEveningPrepareSelection - scoped to exactly the current identity', () => {
  it('clears the given user\'s own selection only', () => {
    store.clear();
    saveEveningPrepareSelection('user-a', { prepIds: ['phone'], bedtimeId: 'SL01' }, '2026-09-24');
    clearEveningPrepareSelection('user-a');
    expect(loadEveningPrepareSelection('user-a', '2026-09-24')).toBeNull();
  });

  it('never touches a different user\'s own selection (Redo/Start Over for User A must never clear User B\'s choice)', () => {
    store.clear();
    saveEveningPrepareSelection('user-a', { prepIds: ['phone'], bedtimeId: 'SL01' }, '2026-09-24');
    saveEveningPrepareSelection('user-b', { prepIds: ['water'], bedtimeId: 'SL02' }, '2026-09-24');
    clearEveningPrepareSelection('user-a');
    expect(loadEveningPrepareSelection('user-b', '2026-09-24')).toEqual({ prepIds: ['water'], bedtimeId: 'SL02' });
  });

  it('is a safe no-op when nothing was ever saved', () => {
    store.clear();
    expect(() => clearEveningPrepareSelection('user-with-nothing-saved')).not.toThrow();
  });
});

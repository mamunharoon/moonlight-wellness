// Build 15 Evening UX correction — real behavioural tests for tonight's
// Evening breathing pattern selection (eveningBreathingSelection.js).
// This repo's Vitest runs in a plain Node environment - not jsdom - so
// there is no real `localStorage` global (see musicPreference.test.js's
// own note on this exact point); an in-memory mock is installed as that
// global for these tests only.
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
  EVENING_BREATHING_PATTERN_KEY,
  getEveningBreathingPatternKey,
  saveEveningBreathingPattern,
  loadEveningBreathingPattern,
  clearEveningBreathingPattern
} = await import('./eveningBreathingSelection');

describe('getEveningBreathingPatternKey - user-scoped, mirroring dailyCompletion.js\'s own convention', () => {
  beforeEach(() => {
    store.clear();
  });

  it('a guest (no userId) reads/writes the original unscoped key', () => {
    expect(getEveningBreathingPatternKey(null)).toBe(EVENING_BREATHING_PATTERN_KEY);
    expect(getEveningBreathingPatternKey(undefined)).toBe(EVENING_BREATHING_PATTERN_KEY);
  });

  it('a registered user gets their own key, suffixed with their Supabase user id', () => {
    expect(getEveningBreathingPatternKey('user-a')).toBe(`${EVENING_BREATHING_PATTERN_KEY}:user-a`);
  });

  it('two different users never collide on the same key', () => {
    expect(getEveningBreathingPatternKey('user-a')).not.toBe(getEveningBreathingPatternKey('user-b'));
  });
});

describe('saveEveningBreathingPattern / loadEveningBreathingPattern - round trip, same-day only', () => {
  beforeEach(() => {
    store.clear();
  });

  it('a selection saved and loaded for the exact same date round-trips correctly', () => {
    saveEveningBreathingPattern('user-a', 'quiet', '2026-09-24');
    expect(loadEveningBreathingPattern('user-a', '2026-09-24')).toBe('quiet');
  });

  it('returns null when nothing has ever been saved for this identity', () => {
    expect(loadEveningBreathingPattern('user-a', '2026-09-24')).toBeNull();
  });

  it('a stale prior-day selection is ignored, never silently reused - the caller falls back to the 4-7-8 default', () => {
    saveEveningBreathingPattern('user-a', 'morning', '2026-09-23');
    expect(loadEveningBreathingPattern('user-a', '2026-09-24')).toBeNull();
  });

  it('an invalid/unknown pattern id (corrupted or from a retired pattern) safely falls back to null, never fabricates or throws', () => {
    localStorage.setItem(getEveningBreathingPatternKey('user-a'), JSON.stringify({ patternId: 'nonexistent', dateKey: '2026-09-24' }));
    expect(loadEveningBreathingPattern('user-a', '2026-09-24')).toBeNull();
  });

  it('corrupt/non-JSON stored data is handled gracefully - returns null, never throws', () => {
    localStorage.setItem(getEveningBreathingPatternKey('user-a'), 'not valid json{{{');
    expect(() => loadEveningBreathingPattern('user-a', '2026-09-24')).not.toThrow();
    expect(loadEveningBreathingPattern('user-a', '2026-09-24')).toBeNull();
  });

  it('User A\'s selection is never visible to User B - cross-user isolation', () => {
    saveEveningBreathingPattern('user-a', 'quiet', '2026-09-24');
    expect(loadEveningBreathingPattern('user-b', '2026-09-24')).toBeNull();
  });

  it('a guest\'s selection is scoped to the unscoped device key, distinct from any registered user\'s own key', () => {
    saveEveningBreathingPattern(null, 'morning', '2026-09-24');
    expect(loadEveningBreathingPattern('user-a', '2026-09-24')).toBeNull();
    expect(loadEveningBreathingPattern(null, '2026-09-24')).toBe('morning');
  });
});

describe('clearEveningBreathingPattern - scoped to exactly the current identity', () => {
  beforeEach(() => {
    store.clear();
  });

  it('clears the given user\'s own selection only', () => {
    saveEveningBreathingPattern('user-a', 'quiet', '2026-09-24');
    clearEveningBreathingPattern('user-a');
    expect(loadEveningBreathingPattern('user-a', '2026-09-24')).toBeNull();
  });

  it('never touches a different user\'s own selection (Redo/Start Over for User A must never clear User B\'s choice)', () => {
    saveEveningBreathingPattern('user-a', 'quiet', '2026-09-24');
    saveEveningBreathingPattern('user-b', 'morning', '2026-09-24');
    clearEveningBreathingPattern('user-a');
    expect(loadEveningBreathingPattern('user-b', '2026-09-24')).toBe('morning');
  });

  it('is a safe no-op when nothing was ever saved', () => {
    expect(() => clearEveningBreathingPattern('user-with-nothing-saved')).not.toThrow();
  });
});

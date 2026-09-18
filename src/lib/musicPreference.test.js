// This repo's Vitest runs in a plain Node environment - not jsdom -
// there is no real `localStorage` global (see
// notificationPreferences.test.js's own note on this). musicPreference.js
// reads/writes the bare `localStorage` global directly (mirroring
// reducedMotionPreference.js's own convention), so an in-memory mock is
// installed as that exact global for these tests.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';

const store = new Map();
const localStorageMock = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  clear: () => store.clear()
};
const originalLocalStorage = globalThis.localStorage;
globalThis.localStorage = localStorageMock;

afterAll(() => {
  globalThis.localStorage = originalLocalStorage;
});

const { getMusicPreference, setMusicPreference } = await import('./musicPreference');

describe('music preference (background-music framework scaffold)', () => {
  beforeEach(() => {
    store.clear();
  });

  it('defaults to off (conservative) when never set', () => {
    expect(getMusicPreference()).toBe(false);
  });

  it('persists an explicit on/off choice across reads', () => {
    setMusicPreference(true);
    expect(getMusicPreference()).toBe(true);
    setMusicPreference(false);
    expect(getMusicPreference()).toBe(false);
  });

  it('never throws when localStorage is unavailable, reading or writing', () => {
    globalThis.localStorage = {
      getItem: () => { throw new Error('unavailable'); },
      setItem: () => { throw new Error('unavailable'); }
    };
    try {
      expect(getMusicPreference()).toBe(false);
      expect(() => setMusicPreference(true)).not.toThrow();
    } finally {
      globalThis.localStorage = localStorageMock;
    }
  });
});

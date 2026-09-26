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

const { getMusicPreference, setMusicPreference, setMusicPreferenceForUser } = await import('./musicPreference');

describe('music preference (background-music framework scaffold)', () => {
  beforeEach(() => {
    store.clear();
  });

  // WakeWise DEV — Anytime Breathing silent-music fix: real, licensed
  // background tracks now exist and play, so the earlier "no asset
  // exists yet" conservative-OFF default no longer applies - reversed to
  // default ON specifically for the never-set case. An explicit stored
  // 'false' still always stays OFF (see the next test).
  it('defaults to ON when never set', () => {
    expect(getMusicPreference()).toBe(true);
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
      expect(getMusicPreference()).toBe(true);
      expect(() => setMusicPreference(true)).not.toThrow();
    } finally {
      globalThis.localStorage = localStorageMock;
    }
  });
});

describe('setMusicPreferenceForUser — guest pre-start-music correction (Build 18)', () => {
  beforeEach(() => {
    store.clear();
  });

  it('a guest\'s choice never reaches the shared key, in either direction (On or Off)', () => {
    // Nothing was ever actually written by this guest tap - the key
    // stays genuinely unset, so it still reads the real default (now ON,
    // see the "defaults to ON when never set" test above), not a value
    // this guest tap silently wrote.
    setMusicPreferenceForUser(true, { isGuest: true });
    expect(getMusicPreference()).toBe(true);
    // Prove a guest Off-write is also a genuine no-op, not a real write -
    // pre-seed an explicit stored TRUE (distinct from the new default, so
    // a guest Off "leaking" through would be observable), then confirm
    // the guest's Off tap leaves it untouched.
    setMusicPreference(true);
    setMusicPreferenceForUser(false, { isGuest: true });
    expect(getMusicPreference()).toBe(true);
    // And the reverse: pre-seed an explicit stored FALSE, confirm a
    // guest's On tap doesn't flip it either.
    setMusicPreference(false);
    setMusicPreferenceForUser(true, { isGuest: true });
    expect(getMusicPreference()).toBe(false);
  });

  it('an authenticated (non-guest) choice persists exactly as the original setMusicPreference always did', () => {
    setMusicPreferenceForUser(true, { isGuest: false });
    expect(getMusicPreference()).toBe(true);
    setMusicPreferenceForUser(false, { isGuest: false });
    expect(getMusicPreference()).toBe(false);
  });

  it('a guest\'s choice does not leak into a later authenticated write on the same device - the two stay genuinely independent', () => {
    setMusicPreference(false); // explicit stored OFF, distinct from the new default-ON
    setMusicPreferenceForUser(true, { isGuest: true }); // guest turns on, never persisted
    expect(getMusicPreference()).toBe(false);
    setMusicPreferenceForUser(true, { isGuest: false }); // a signed-in user turns on for real
    expect(getMusicPreference()).toBe(true);
  });
});

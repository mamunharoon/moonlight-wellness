// This repo's Vitest runs in plain Node, not jsdom (see
// notificationPreferences.test.js's own note) - an in-memory localStorage
// mock is installed as the bare global, matching the established pattern
// used throughout src/session/routineProgress.test.js.
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

const { hasChosenGuestEntry, markGuestEntryChosen, clearGuestEntryChoice } = await import('./guestEntry');

describe('guestEntry — persisted "Continue as Guest" choice', () => {
  beforeEach(() => {
    store.clear();
  });

  it('has not chosen guest entry by default', () => {
    expect(hasChosenGuestEntry()).toBe(false);
  });

  it('marks and reads back the choice', () => {
    markGuestEntryChosen();
    expect(hasChosenGuestEntry()).toBe(true);
  });

  it('persists across "relaunches" - a fresh read after marking still reports true, since this is real localStorage, not component state', () => {
    markGuestEntryChosen();
    expect(hasChosenGuestEntry()).toBe(true);
    expect(hasChosenGuestEntry()).toBe(true);
  });

  it('clearGuestEntryChoice removes the flag (the sign-out case)', () => {
    markGuestEntryChosen();
    clearGuestEntryChoice();
    expect(hasChosenGuestEntry()).toBe(false);
  });

  it('clearGuestEntryChoice is idempotent - clearing when nothing was set is a safe no-op', () => {
    expect(() => clearGuestEntryChoice()).not.toThrow();
    expect(hasChosenGuestEntry()).toBe(false);
  });

  it('markGuestEntryChosen is idempotent - marking twice is still just "chosen"', () => {
    markGuestEntryChosen();
    markGuestEntryChosen();
    expect(hasChosenGuestEntry()).toBe(true);
  });
});

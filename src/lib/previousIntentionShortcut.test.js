// WakeWise Phase 3B (3B.2) — real functional tests (localStorage is
// available in this repo's Vitest environment, see eveningPrepareSelection
// .test.js's own established precedent), not just source-string checks.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  getPreviousIntentionRecordKey,
  recordIntentionConfirmation,
  getPreviousDayIntention,
  wasConfirmedToday
} from './previousIntentionShortcut';

// This repo's Vitest runs in a plain Node environment - no real
// `localStorage` global (see eveningPrepareSelection.test.js's own
// identical note) - an in-memory mock is installed as that global for
// these tests only.
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

beforeEach(() => {
  localStorage.clear();
});

describe('getPreviousIntentionRecordKey - scoped per user, guest on the unscoped base key', () => {
  it('a signed-in user gets a suffixed key', () => {
    expect(getPreviousIntentionRecordKey('user-a')).toBe('moonlight_intentions_confirmed_record:user-a');
  });

  it('a guest (no userId) gets the plain base key', () => {
    expect(getPreviousIntentionRecordKey(null)).toBe('moonlight_intentions_confirmed_record');
    expect(getPreviousIntentionRecordKey(undefined)).toBe('moonlight_intentions_confirmed_record');
  });

  it('two different users never collide', () => {
    expect(getPreviousIntentionRecordKey('user-a')).not.toBe(getPreviousIntentionRecordKey('user-b'));
  });
});

describe('recordIntentionConfirmation / getPreviousDayIntention - round trip, prior-day only', () => {
  it('a confirmation recorded yesterday is returned when checked against today', () => {
    recordIntentionConfirmation('user-a', ['Stay calm', 'Be kind to yourself'], '2026-09-26');
    expect(getPreviousDayIntention('user-a', '2026-09-27')).toEqual(['Stay calm', 'Be kind to yourself']);
  });

  it('a confirmation recorded TODAY is never returned as "previous day" - already-confirmed-today has its own separate path', () => {
    recordIntentionConfirmation('user-a', ['Stay calm'], '2026-09-27');
    expect(getPreviousDayIntention('user-a', '2026-09-27')).toBeNull();
  });

  it('returns null when nothing was ever recorded', () => {
    expect(getPreviousDayIntention('user-with-nothing-saved', '2026-09-27')).toBeNull();
  });

  it('ignores empty intentions arrays - never records or returns a save with nothing in it', () => {
    recordIntentionConfirmation('user-a', [], '2026-09-26');
    expect(getPreviousDayIntention('user-a', '2026-09-27')).toBeNull();
  });

  it('survives corrupted JSON without throwing', () => {
    localStorage.setItem(getPreviousIntentionRecordKey('user-a'), 'not valid json{{{');
    expect(() => getPreviousDayIntention('user-a', '2026-09-27')).not.toThrow();
    expect(getPreviousDayIntention('user-a', '2026-09-27')).toBeNull();
  });

  it('survives a malformed record shape (missing intentions array) without throwing', () => {
    localStorage.setItem(getPreviousIntentionRecordKey('user-a'), JSON.stringify({ dateKey: '2026-09-26' }));
    expect(getPreviousDayIntention('user-a', '2026-09-27')).toBeNull();
  });
});

describe('Cross-user isolation - never reads another user\'s or a guest\'s record', () => {
  it('User A\'s prior-day intention is never returned for User B', () => {
    recordIntentionConfirmation('user-a', ['Be grateful', 'Finish my project'], '2026-09-26');
    expect(getPreviousDayIntention('user-b', '2026-09-27')).toBeNull();
  });

  it('a guest\'s record is never returned for a signed-in user, and vice versa', () => {
    recordIntentionConfirmation(null, ['Guest intention'], '2026-09-26');
    expect(getPreviousDayIntention('user-a', '2026-09-27')).toBeNull();
    recordIntentionConfirmation('user-a', ['Signed-in intention'], '2026-09-26');
    // Writing user-a's own record must not overwrite or leak into the
    // guest's separate key - the guest still reads back its own value.
    expect(getPreviousDayIntention(null, '2026-09-27')).toEqual(['Guest intention']);
    expect(getPreviousDayIntention('user-a', '2026-09-27')).toEqual(['Signed-in intention']);
  });
});

describe('wasConfirmedToday - the companion check IntentionSetup.jsx uses to decide fresh-ask vs summary', () => {
  it('true only when the stored record\'s dateKey matches today exactly', () => {
    recordIntentionConfirmation('user-a', ['Stay calm'], '2026-09-27');
    expect(wasConfirmedToday('user-a', '2026-09-27')).toBe(true);
    expect(wasConfirmedToday('user-a', '2026-09-28')).toBe(false);
  });

  it('false when nothing was ever recorded', () => {
    expect(wasConfirmedToday('user-with-nothing-saved', '2026-09-27')).toBe(false);
  });
});

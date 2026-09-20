// Logout / cross-user client-state audit — direct behaviour tests for the
// shared sign-out cleanup helpers. This repo's Vitest runs in plain Node,
// not jsdom (see notificationPreferences.test.js's own note) - in-memory
// localStorage/sessionStorage/window mocks are installed as bare globals,
// matching the established pattern used throughout guestEntry.test.js.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';

const makeStorageMock = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
    _store: store
  };
};

const localStorageMock = makeStorageMock();
const sessionStorageMock = makeStorageMock();

const originalLocalStorage = globalThis.localStorage;
const originalSessionStorage = globalThis.sessionStorage;
const originalWindow = globalThis.window;

globalThis.localStorage = localStorageMock;
globalThis.sessionStorage = sessionStorageMock;

// Minimal EventTarget-backed window mock — real addEventListener/
// removeEventListener/dispatchEvent semantics (not a stub), so
// onSignOutBroadcast's own unsubscribe function is genuinely exercised.
globalThis.window = new EventTarget();

afterAll(() => {
  globalThis.localStorage = originalLocalStorage;
  globalThis.sessionStorage = originalSessionStorage;
  globalThis.window = originalWindow;
});

const { broadcastSignOut, onSignOutBroadcast, clearAppSessionStorage } =
  await import('./signOutCleanup');

describe('signOutCleanup — clearAppSessionStorage', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
  });

  it('removes every "moonlight_"-prefixed sessionStorage key', () => {
    sessionStorage.setItem('moonlight_pending_content', '{}');
    sessionStorage.setItem('moonlight_paused_exercise_morning-routine__stretch', '{}');
    sessionStorage.setItem('moonlight_morning_intro_seen:2026-09-20T00:00:00.000Z', '1');
    clearAppSessionStorage();
    expect(sessionStorage.getItem('moonlight_pending_content')).toBeNull();
    expect(sessionStorage.getItem('moonlight_paused_exercise_morning-routine__stretch')).toBeNull();
    expect(sessionStorage.getItem('moonlight_morning_intro_seen:2026-09-20T00:00:00.000Z')).toBeNull();
  });

  it('never touches a non-"moonlight_" key, e.g. the DEV-only clock override', () => {
    sessionStorage.setItem('__wakewise_dev_clock_offset_ms', '3600000');
    clearAppSessionStorage();
    expect(sessionStorage.getItem('__wakewise_dev_clock_offset_ms')).toBe('3600000');
  });

  it('is idempotent - clearing an already-empty store is a safe no-op', () => {
    expect(() => clearAppSessionStorage()).not.toThrow();
  });
});

describe('signOutCleanup — broadcastSignOut / onSignOutBroadcast', () => {
  it('every subscriber is notified when broadcastSignOut fires', () => {
    let calls = 0;
    const unsubscribe = onSignOutBroadcast(() => {
      calls += 1;
    });
    broadcastSignOut();
    unsubscribe();
    expect(calls).toBe(1);
  });

  it('the returned unsubscribe function actually stops future notifications', () => {
    let calls = 0;
    const unsubscribe = onSignOutBroadcast(() => {
      calls += 1;
    });
    unsubscribe();
    broadcastSignOut();
    expect(calls).toBe(0);
  });

  it('supports multiple independent subscribers (AudioContext/SessionContext/AlarmContext/OnboardingGate all listen at once)', () => {
    let a = 0;
    let b = 0;
    const unsubA = onSignOutBroadcast(() => {
      a += 1;
    });
    const unsubB = onSignOutBroadcast(() => {
      b += 1;
    });
    broadcastSignOut();
    unsubA();
    unsubB();
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});

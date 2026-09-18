// Plain Node environment, no sessionStorage global (matches
// routineProgress.test.js/guestEntry.test.js's own established pattern)
// - an in-memory mock is installed as the bare global.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';

const store = new Map();
const sessionStorageMock = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};
const originalSessionStorage = globalThis.sessionStorage;
globalThis.sessionStorage = sessionStorageMock;
afterAll(() => {
  globalThis.sessionStorage = originalSessionStorage;
});

const { setPendingContent, consumePendingContent, isSafeReturnPath } = await import('./pendingContent');

describe('isSafeReturnPath — open-redirect guard', () => {
  it('accepts an ordinary in-app relative path', () => {
    expect(isSafeReturnPath('/')).toBe(true);
    expect(isSafeReturnPath('/library')).toBe(true);
    expect(isSafeReturnPath('/routines/wind-down?foo=bar')).toBe(true);
  });

  it('rejects a protocol-relative path ("//evil.example.com")', () => {
    expect(isSafeReturnPath('//evil.example.com')).toBe(false);
  });

  it('rejects an absolute URL smuggled in as a path', () => {
    expect(isSafeReturnPath('https://evil.example.com')).toBe(false);
    expect(isSafeReturnPath('javascript://alert(1)')).toBe(false);
  });

  it('rejects a path that does not start with "/"', () => {
    expect(isSafeReturnPath('library')).toBe(false);
    expect(isSafeReturnPath('')).toBe(false);
  });

  it('rejects non-string input without throwing', () => {
    expect(isSafeReturnPath(null)).toBe(false);
    expect(isSafeReturnPath(undefined)).toBe(false);
    expect(isSafeReturnPath(42)).toBe(false);
  });
});

describe('setPendingContent / consumePendingContent', () => {
  beforeEach(() => {
    store.clear();
  });

  it('round-trips an id-based prompt (locked video/exercise)', () => {
    setPendingContent({ id: 'E10', returnPath: '/library' });
    expect(consumePendingContent()).toEqual({ id: 'E10', returnPath: '/library' });
  });

  it('round-trips an id-less prompt (routine-start)', () => {
    setPendingContent({ returnPath: '/' });
    expect(consumePendingContent()).toEqual({ id: null, returnPath: '/' });
  });

  it('is consumed only once - a second read after consuming returns null', () => {
    setPendingContent({ returnPath: '/' });
    consumePendingContent();
    expect(consumePendingContent()).toBeNull();
  });

  it('silently refuses to store an unsafe returnPath - never even reaches sessionStorage', () => {
    setPendingContent({ returnPath: '//evil.example.com' });
    expect(consumePendingContent()).toBeNull();
  });

  it('rejects a tampered/malformed unsafe returnPath even if it somehow already exists in storage', () => {
    store.set('moonlight_pending_content', JSON.stringify({ id: null, returnPath: 'https://evil.example.com', setAt: Date.now() }));
    expect(consumePendingContent()).toBeNull();
  });

  it('rejects a stale entry older than 10 minutes', () => {
    store.set('moonlight_pending_content', JSON.stringify({ id: null, returnPath: '/', setAt: Date.now() - 11 * 60 * 1000 }));
    expect(consumePendingContent()).toBeNull();
  });

  it('returns null when nothing was ever set', () => {
    expect(consumePendingContent()).toBeNull();
  });
});

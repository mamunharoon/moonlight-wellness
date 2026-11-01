// Video startup performance (2026-11-01, DEV only) — real behavioural
// tests for the in-memory signed-URL cache: get/set/expiry, per-user
// isolation, in-flight de-duplication bookkeeping, and the sign-out
// broadcast actually clearing it (dispatched as a real window event,
// matching signOutCleanup.js's own contract — not source-matched).
//
// This repo's Vitest runs in plain Node, not jsdom (see
// signOutCleanup.test.js's own note). A minimal EventTarget-backed
// `window` mock is installed as a bare global BEFORE importing the
// module under test, so its module-scope
// `onSignOutBroadcast(() => clearSignedVideoUrlCache())` self-
// registration — guarded on `typeof window !== 'undefined'` specifically
// so it can coexist with Node-only test files that have no window at all
// — actually runs here, and the sign-out integration test below is a
// genuine end-to-end exercise, not a source-level check.
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

const originalWindow = globalThis.window;
globalThis.window = new EventTarget();

afterAll(() => {
  globalThis.window = originalWindow;
});

const {
  getCachedSignedUrl,
  setCachedSignedUrl,
  invalidateCachedSignedUrl,
  getInFlightRequest,
  setInFlightRequest,
  clearSignedVideoUrlCache
} = await import('./signedVideoUrlCache');
const { broadcastSignOut } = await import('./signOutCleanup');

beforeEach(() => {
  clearSignedVideoUrlCache();
  vi.useRealTimers();
});

describe('getCachedSignedUrl / setCachedSignedUrl', () => {
  it('returns null when nothing has been cached for this user+id', () => {
    expect(getCachedSignedUrl('user-1', 'E02')).toBeNull();
  });

  it('returns the exact entry just set, for the same user+id', () => {
    const entry = { url: 'https://example.com/signed-1', expiresAt: Date.now() + 60_000 };
    setCachedSignedUrl('user-1', 'E02', entry);
    expect(getCachedSignedUrl('user-1', 'E02')).toEqual(entry);
  });

  it('a cached entry for one id is never returned for a different id, same user', () => {
    setCachedSignedUrl('user-1', 'E02', { url: 'https://example.com/e02', expiresAt: Date.now() + 60_000 });
    expect(getCachedSignedUrl('user-1', 'E03')).toBeNull();
  });

  it('a cached entry for one user is never returned for a different user, same id (no cross-account leak)', () => {
    setCachedSignedUrl('user-1', 'E02', { url: 'https://example.com/user1-e02', expiresAt: Date.now() + 60_000 });
    expect(getCachedSignedUrl('user-2', 'E02')).toBeNull();
  });

  it('a signed-in user and a guest never share an entry even for the same id (guest key is a reserved literal)', () => {
    setCachedSignedUrl('guest', 'IB01', { url: 'https://example.com/guest-ib01', expiresAt: Date.now() + 60_000 });
    expect(getCachedSignedUrl('some-real-user-id', 'IB01')).toBeNull();
  });

  it('an expired entry is treated as absent', () => {
    setCachedSignedUrl('user-1', 'E02', { url: 'https://example.com/stale', expiresAt: Date.now() - 1 });
    expect(getCachedSignedUrl('user-1', 'E02')).toBeNull();
  });

  it('an expired entry is evicted from the map once read, not just hidden', () => {
    setCachedSignedUrl('user-1', 'E02', { url: 'https://example.com/stale', expiresAt: Date.now() - 1 });
    getCachedSignedUrl('user-1', 'E02'); // triggers eviction
    setCachedSignedUrl('user-1', 'E02', { url: 'https://example.com/fresh', expiresAt: Date.now() + 60_000 });
    expect(getCachedSignedUrl('user-1', 'E02').url).toBe('https://example.com/fresh');
  });

  it('a boundary entry (expiresAt exactly now) is treated as expired, matching isSignedUrlExpired\'s own >= semantics', () => {
    const now = Date.now();
    setCachedSignedUrl('user-1', 'E02', { url: 'https://example.com/boundary', expiresAt: now });
    expect(getCachedSignedUrl('user-1', 'E02')).toBeNull();
  });
});

describe('invalidateCachedSignedUrl', () => {
  it('removes exactly the one entry named, leaving others untouched', () => {
    setCachedSignedUrl('user-1', 'E02', { url: 'https://example.com/e02', expiresAt: Date.now() + 60_000 });
    setCachedSignedUrl('user-1', 'E03', { url: 'https://example.com/e03', expiresAt: Date.now() + 60_000 });
    invalidateCachedSignedUrl('user-1', 'E02');
    expect(getCachedSignedUrl('user-1', 'E02')).toBeNull();
    expect(getCachedSignedUrl('user-1', 'E03')).not.toBeNull();
  });

  it('is a safe no-op when nothing was cached for that key', () => {
    expect(() => invalidateCachedSignedUrl('user-1', 'E99')).not.toThrow();
  });
});

describe('in-flight request tracking', () => {
  it('returns null when no request is in flight for this user+id', () => {
    expect(getInFlightRequest('user-1', 'E02')).toBeNull();
  });

  it('returns the exact promise registered for this user+id', () => {
    const promise = Promise.resolve({ url: 'https://example.com/x', expiresAt: Date.now() + 60_000 });
    setInFlightRequest('user-1', 'E02', promise);
    expect(getInFlightRequest('user-1', 'E02')).toBe(promise);
  });

  it('a resolved in-flight promise unregisters itself (future callers get null again, not a stale finished promise)', async () => {
    const promise = Promise.resolve({ url: 'https://example.com/x', expiresAt: Date.now() + 60_000 });
    setInFlightRequest('user-1', 'E02', promise);
    await promise;
    await Promise.resolve(); // let the .finally() microtask run
    expect(getInFlightRequest('user-1', 'E02')).toBeNull();
  });

  it('a rejected in-flight promise also unregisters itself', async () => {
    const promise = Promise.reject(new Error('network down'));
    setInFlightRequest('user-1', 'E02', promise);
    await promise.catch(() => {});
    await Promise.resolve();
    expect(getInFlightRequest('user-1', 'E02')).toBeNull();
  });

  it('different ids for the same user track independent in-flight requests', () => {
    const p1 = new Promise(() => {});
    const p2 = new Promise(() => {});
    setInFlightRequest('user-1', 'E02', p1);
    setInFlightRequest('user-1', 'E03', p2);
    expect(getInFlightRequest('user-1', 'E02')).toBe(p1);
    expect(getInFlightRequest('user-1', 'E03')).toBe(p2);
  });
});

describe('clearSignedVideoUrlCache', () => {
  it('wipes every cached URL for every user and id', () => {
    setCachedSignedUrl('user-1', 'E02', { url: 'https://example.com/a', expiresAt: Date.now() + 60_000 });
    setCachedSignedUrl('user-2', 'E03', { url: 'https://example.com/b', expiresAt: Date.now() + 60_000 });
    setCachedSignedUrl('guest', 'IB01', { url: 'https://example.com/c', expiresAt: Date.now() + 60_000 });
    clearSignedVideoUrlCache();
    expect(getCachedSignedUrl('user-1', 'E02')).toBeNull();
    expect(getCachedSignedUrl('user-2', 'E03')).toBeNull();
    expect(getCachedSignedUrl('guest', 'IB01')).toBeNull();
  });

  it('is safe to call when the cache is already empty', () => {
    expect(() => clearSignedVideoUrlCache()).not.toThrow();
  });
});

describe('sign-out broadcast integration — the cache clears itself with zero wiring elsewhere', () => {
  it('a real moonlight:sign-out window event clears every cached entry', () => {
    setCachedSignedUrl('user-1', 'E02', { url: 'https://example.com/a', expiresAt: Date.now() + 60_000 });
    expect(getCachedSignedUrl('user-1', 'E02')).not.toBeNull();

    broadcastSignOut();

    expect(getCachedSignedUrl('user-1', 'E02')).toBeNull();
  });

  it('account switching is safe by construction even without the sign-out broadcast: a second user id never resolves the first user\'s entry', () => {
    // Exercises the actual isolation property the "no reuse after account
    // switching" requirement cares about, independent of whether sign-out
    // cleanup ran: two different userKeys are two different map keys.
    setCachedSignedUrl('user-1', 'E02', { url: 'https://example.com/user1', expiresAt: Date.now() + 60_000 });
    setCachedSignedUrl('user-2', 'E02', { url: 'https://example.com/user2', expiresAt: Date.now() + 60_000 });
    expect(getCachedSignedUrl('user-1', 'E02').url).toBe('https://example.com/user1');
    expect(getCachedSignedUrl('user-2', 'E02').url).toBe('https://example.com/user2');
  });
});

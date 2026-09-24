// Preserving a non-media journey intent through authentication — real
// behaviour tests against a genuine in-memory sessionStorage mock (not
// just a source-level regex check), matching pendingContent.test.js's
// own established pattern exactly (plain Node environment, no
// sessionStorage global).
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

const {
  isAllowedJourneyAction,
  setPendingJourneyIntent,
  clearPendingJourneyIntent,
  consumePendingJourneyIntent,
  resolveJourneyResumeTarget
} = await import('./pendingJourneyIntent');

describe('isAllowedJourneyAction — the one fixed allowlist', () => {
  it('accepts exactly morning and sleep (the Evening/Wind-Down card\'s own real id)', () => {
    expect(isAllowedJourneyAction('morning')).toBe(true);
    expect(isAllowedJourneyAction('sleep')).toBe(true);
  });

  it('rejects Gentle Reset (never gated, never needs to survive an auth round-trip), Anytime, and any other feature id', () => {
    expect(isAllowedJourneyAction('calm')).toBe(false);
    expect(isAllowedJourneyAction('anytime')).toBe(false);
    expect(isAllowedJourneyAction('gentle-reset')).toBe(false);
  });

  it('rejects a caller-supplied URL/path masquerading as an action - the exact thing this module exists to prevent', () => {
    expect(isAllowedJourneyAction('/admin')).toBe(false);
    expect(isAllowedJourneyAction('https://evil.example.com')).toBe(false);
    expect(isAllowedJourneyAction('//evil.example.com')).toBe(false);
  });

  it('rejects non-string/empty/nullish input without throwing', () => {
    expect(isAllowedJourneyAction(null)).toBe(false);
    expect(isAllowedJourneyAction(undefined)).toBe(false);
    expect(isAllowedJourneyAction('')).toBe(false);
    expect(isAllowedJourneyAction(42)).toBe(false);
  });
});

describe('setPendingJourneyIntent / consumePendingJourneyIntent — round-trip', () => {
  beforeEach(() => {
    store.clear();
  });

  it('round-trips a real morning intent', () => {
    setPendingJourneyIntent('morning');
    expect(consumePendingJourneyIntent()).toBe('morning');
  });

  it('round-trips a real Evening/Wind-Down intent (real card id "sleep")', () => {
    setPendingJourneyIntent('sleep');
    expect(consumePendingJourneyIntent()).toBe('sleep');
  });

  it('is consumed only once - a second read after consuming returns null (no duplicate session can ever be started from one stashed intent)', () => {
    setPendingJourneyIntent('morning');
    consumePendingJourneyIntent();
    expect(consumePendingJourneyIntent()).toBeNull();
  });

  it('silently refuses to store a disallowed action - never even reaches sessionStorage', () => {
    setPendingJourneyIntent('calm');
    expect(store.has('moonlight_pending_journey_intent')).toBe(false);
    expect(consumePendingJourneyIntent()).toBeNull();
  });

  it('silently refuses a caller-supplied URL passed as an action', () => {
    setPendingJourneyIntent('/admin');
    expect(store.has('moonlight_pending_journey_intent')).toBe(false);
  });

  it('rejects a tampered/malformed entry even if it somehow already exists in storage', () => {
    store.set('moonlight_pending_journey_intent', JSON.stringify({ action: 'delete-account', setAt: Date.now() }));
    expect(consumePendingJourneyIntent()).toBeNull();
  });

  it('rejects a stale entry older than 10 minutes - matches pendingContent.js\'s own TTL exactly', () => {
    store.set('moonlight_pending_journey_intent', JSON.stringify({ action: 'morning', setAt: Date.now() - 11 * 60 * 1000 }));
    expect(consumePendingJourneyIntent()).toBeNull();
  });

  it('accepts an entry just inside the TTL window', () => {
    store.set('moonlight_pending_journey_intent', JSON.stringify({ action: 'sleep', setAt: Date.now() - 9 * 60 * 1000 }));
    expect(consumePendingJourneyIntent()).toBe('sleep');
  });

  it('returns null when nothing was ever set', () => {
    expect(consumePendingJourneyIntent()).toBeNull();
  });

  it('uses a different sessionStorage key than pendingContent.js - the two mechanisms can never collide or be misread as one another', () => {
    setPendingJourneyIntent('morning');
    expect(store.has('moonlight_pending_content')).toBe(false);
    expect(store.has('moonlight_pending_journey_intent')).toBe(true);
  });

  it('setting a second intent before the first is consumed overwrites it - only the most recent tap survives, matching a real user changing their mind before completing sign-in', () => {
    setPendingJourneyIntent('morning');
    setPendingJourneyIntent('sleep');
    expect(consumePendingJourneyIntent()).toBe('sleep');
  });
});

describe('clearPendingJourneyIntent', () => {
  beforeEach(() => {
    store.clear();
  });

  it('removes a pending intent so a later consume returns null - the sign-out safety net (also covered automatically by clearAppSessionStorage\'s moonlight_ prefix sweep, see signOutCleanup.test.js)', () => {
    setPendingJourneyIntent('morning');
    clearPendingJourneyIntent();
    expect(consumePendingJourneyIntent()).toBeNull();
  });

  it('is a safe no-op when nothing is pending', () => {
    expect(() => clearPendingJourneyIntent()).not.toThrow();
    expect(consumePendingJourneyIntent()).toBeNull();
  });
});

describe('resolveJourneyResumeTarget — the one real navigation decision this module produces', () => {
  it('resolves morning to the fixed, expected route', () => {
    expect(resolveJourneyResumeTarget('morning')).toBe('/introduction?auto=1&resume=morning');
  });

  it('resolves sleep (the Evening/Wind-Down card\'s own real id in WELCOME_CARDS) to the fixed, expected route', () => {
    expect(resolveJourneyResumeTarget('sleep')).toBe('/introduction?auto=1&resume=sleep');
  });

  it('returns null for a disallowed action - including the null a missing/expired/tampered consumePendingJourneyIntent() result already resolves to', () => {
    expect(resolveJourneyResumeTarget(null)).toBeNull();
    expect(resolveJourneyResumeTarget(undefined)).toBeNull();
    expect(resolveJourneyResumeTarget('calm')).toBeNull();
  });

  it('never echoes a caller-supplied value into the returned path - the action segment is always one of the two literal, fixed strings', () => {
    // Even if somehow asked to resolve something URL-shaped, the function
    // itself only ever returns null or one of its two hardcoded routes -
    // proven directly: the malicious value never appears in the output.
    expect(resolveJourneyResumeTarget('/admin')).toBeNull();
    expect(resolveJourneyResumeTarget('javascript://alert(1)')).toBeNull();
  });

  it('the full real round-trip: set -> consume -> resolve produces the exact expected redirect target', () => {
    setPendingJourneyIntent('morning');
    const action = consumePendingJourneyIntent();
    expect(resolveJourneyResumeTarget(action)).toBe('/introduction?auto=1&resume=morning');
  });

  it('a consumed-but-invalid intent (expired/tampered/never set) resolves the whole chain to null, never a partial/malformed route', () => {
    const action = consumePendingJourneyIntent();
    expect(action).toBeNull();
    expect(resolveJourneyResumeTarget(action)).toBeNull();
  });
});

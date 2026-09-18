import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { isBetaProgramVisible, isFeatureEnabled, setFeatureFlagOverride, clearFeatureFlagOverrides } from './featureFlags';

// Plain Node environment, no real localStorage global (see
// notificationPreferences.test.js's own note) - an in-memory mock is
// installed as the bare global, matching this codebase's established
// convention for every other localStorage-backed module's own tests.
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear()
};

describe('isBetaProgramVisible', () => {
  afterEach(() => {
    delete import.meta.env.VITE_SHOW_BETA_PROGRAM;
  });

  it('defaults to visible when the flag is unset (today\'s local dev, DEV Vercel, and every TestFlight build)', () => {
    expect(isBetaProgramVisible()).toBe(true);
  });

  it('hides only when explicitly set to the literal string "false" (the eventual production build)', () => {
    import.meta.env.VITE_SHOW_BETA_PROGRAM = 'false';
    expect(isBetaProgramVisible()).toBe(false);
  });

  it('stays visible for any other value, never silently hiding on a typo', () => {
    import.meta.env.VITE_SHOW_BETA_PROGRAM = 'no';
    expect(isBetaProgramVisible()).toBe(true);
  });
});

describe('backgroundMusic feature flag (Background Music, Phase B)', () => {
  beforeEach(() => {
    store.clear();
  });

  it('defaults to off - no licensed music asset exists yet, so this must never default on', () => {
    expect(isFeatureEnabled('backgroundMusic')).toBe(false);
  });

  it('can be forced on per-device for QA, via the existing override mechanism, without a code deploy', () => {
    setFeatureFlagOverride('backgroundMusic', true);
    expect(isFeatureEnabled('backgroundMusic')).toBe(true);
  });

  it('clearing overrides restores the conservative default', () => {
    setFeatureFlagOverride('backgroundMusic', true);
    clearFeatureFlagOverrides();
    expect(isFeatureEnabled('backgroundMusic')).toBe(false);
  });
});

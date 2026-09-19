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

describe('backgroundMusic feature flag (now shipped - real, licensed v2 IB01/IS01 tracks registered and regression-tested)', () => {
  beforeEach(() => {
    store.clear();
  });

  it('defaults to on - IB01/IS01 are real, registered, licensed assets; the toggle/entry-choice UX is built and tested', () => {
    expect(isFeatureEnabled('backgroundMusic')).toBe(true);
  });

  it('can still be forced off per-device without a code deploy, e.g. to pull it mid-beta', () => {
    setFeatureFlagOverride('backgroundMusic', false);
    expect(isFeatureEnabled('backgroundMusic')).toBe(false);
  });

  it('clearing overrides restores the shipped default (on)', () => {
    setFeatureFlagOverride('backgroundMusic', false);
    clearFeatureFlagOverrides();
    expect(isFeatureEnabled('backgroundMusic')).toBe(true);
  });
});

import { describe, it, expect, afterEach, afterAll, beforeEach } from 'vitest';
import {
  isBetaProgramVisible,
  isSubscriptionSandboxTestVisible,
  isFeatureEnabled,
  setFeatureFlagOverride,
  clearFeatureFlagOverrides
} from './featureFlags';

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

// Codemagic CI-failure fix — both describe blocks below used to rely on
// an ambient "the var happens to be unset" default for their very first
// test, cleaned up only by an afterEach that only ever runs AFTER a
// test, never before one. That's silently correct locally and in every
// workflow that never sets these vars at all - but the
// wakewise-ios-sandbox-test Codemagic workflow's own
// wakewise_revenuecat_sandbox variable group sets
// VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST=true as a REAL process env var
// for that entire job, including its "Run the automated test suite"
// step (codemagic.yaml) - Vite/Vitest's own env loading exposes
// VITE_-prefixed process.env values in import.meta.env from the moment
// the test run starts, before this file's first beforeEach/afterEach
// ever fires. The "defaults to hidden when unset" test was therefore
// never actually testing "unset" in that one workflow - it inherited
// the real 'true' and failed. Each block below now captures whatever
// value was ACTUALLY present before these tests touched anything,
// explicitly forces the unset state in a beforeEach (so the first test
// is genuinely isolated regardless of what the real environment
// injected), keeps the existing afterEach for between-test cleanup, and
// restores the original ambient value in afterAll - so this file never
// permanently erases a real CI-configured flag for whatever runs after
// it in the same process.
describe('isBetaProgramVisible', () => {
  const originalValue = import.meta.env.VITE_SHOW_BETA_PROGRAM;

  beforeEach(() => {
    delete import.meta.env.VITE_SHOW_BETA_PROGRAM;
  });

  afterEach(() => {
    delete import.meta.env.VITE_SHOW_BETA_PROGRAM;
  });

  afterAll(() => {
    if (originalValue !== undefined) import.meta.env.VITE_SHOW_BETA_PROGRAM = originalValue;
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

describe('isSubscriptionSandboxTestVisible', () => {
  const originalValue = import.meta.env.VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST;

  beforeEach(() => {
    delete import.meta.env.VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST;
  });

  afterEach(() => {
    delete import.meta.env.VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST;
  });

  afterAll(() => {
    if (originalValue !== undefined) import.meta.env.VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST = originalValue;
  });

  it('defaults to hidden when the flag is unset - opposite default from isBetaProgramVisible, since this page can call a real purchase SDK', () => {
    expect(isSubscriptionSandboxTestVisible()).toBe(false);
  });

  it('shows only when explicitly set to the literal string "true" - the sandbox workflow\'s own real setting, confirmed here rather than assumed', () => {
    import.meta.env.VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST = 'true';
    expect(isSubscriptionSandboxTestVisible()).toBe(true);
  });

  it('stays hidden for any other value, never shown on a typo', () => {
    import.meta.env.VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST = 'yes';
    expect(isSubscriptionSandboxTestVisible()).toBe(false);
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

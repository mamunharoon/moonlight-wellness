// First-use WakeWise Introduction — version-comparison behaviour tests.
import { describe, it, expect } from 'vitest';
import {
  CURRENT_INTRODUCTION_VERSION,
  shouldShowIntroduction,
  shouldRedirectToIntroduction,
  buildIntroductionRedirectPath
} from './introductionVersion';

describe('shouldShowIntroduction', () => {
  it('shows it for a brand-new profile whose completed version is 0 (the DEFAULT)', () => {
    expect(shouldShowIntroduction(0)).toBe(true);
  });

  it('shows it for every pre-existing user, who also starts at 0 per the migration DEFAULT', () => {
    expect(shouldShowIntroduction(0)).toBe(CURRENT_INTRODUCTION_VERSION > 0);
  });

  it('does not show it once the user has completed the current version', () => {
    expect(shouldShowIntroduction(CURRENT_INTRODUCTION_VERSION)).toBe(false);
  });

  it('shows it again if a future version is released and the user is still on an older one', () => {
    expect(shouldShowIntroduction(CURRENT_INTRODUCTION_VERSION - 1 < 0 ? 0 : CURRENT_INTRODUCTION_VERSION - 1)).toBe(
      CURRENT_INTRODUCTION_VERSION - 1 < CURRENT_INTRODUCTION_VERSION
    );
  });

  it('never shows it for a user already on a NEWER version than current (no downgrade re-prompt)', () => {
    expect(shouldShowIntroduction(CURRENT_INTRODUCTION_VERSION + 1)).toBe(false);
  });

  it('treats a missing/undefined/null value as "not yet completed" (0), never as "already seen"', () => {
    expect(shouldShowIntroduction(undefined)).toBe(shouldShowIntroduction(0));
    expect(shouldShowIntroduction(null)).toBe(shouldShowIntroduction(0));
  });

  it('CURRENT_INTRODUCTION_VERSION is a positive integer', () => {
    expect(Number.isInteger(CURRENT_INTRODUCTION_VERSION)).toBe(true);
    expect(CURRENT_INTRODUCTION_VERSION).toBeGreaterThan(0);
  });
});

// First-Use Welcome redirect-order defect fix — real-execution coverage
// for OnboardingGate.jsx's own passive check, extracted as a pure
// function specifically so it can be exercised this way rather than only
// via source-string assertions (this repo's Vitest has no DOM/component
// rendering available - see any other test file's own note on this).
describe('shouldRedirectToIntroduction — OnboardingGate.jsx\'s passive, redirect-order-defect-fixing check', () => {
  const baseUser = { id: 'user-1' };
  const newProfile = { introduction_completed_version: null };
  const currentProfile = { introduction_completed_version: CURRENT_INTRODUCTION_VERSION };
  const belowVersionProfile = { introduction_completed_version: CURRENT_INTRODUCTION_VERSION - 1 };

  const baseParams = {
    user: baseUser,
    isGuest: false,
    profile: newProfile,
    profileLoading: false,
    profileError: null,
    pathname: '/',
    alreadyHandled: false
  };

  it('1/2. brand-new signup / first confirmed sign-in: real user, brand-new profile (never completed any version) -> true', () => {
    expect(shouldRedirectToIntroduction(baseParams)).toBe(true);
  });

  it('5. returning current-version user -> false (Home is reached directly, no Welcome)', () => {
    expect(shouldRedirectToIntroduction({ ...baseParams, profile: currentProfile })).toBe(false);
  });

  it('6. existing user below CURRENT_INTRODUCTION_VERSION -> true (sees Welcome once more)', () => {
    expect(shouldRedirectToIntroduction({ ...baseParams, profile: belowVersionProfile })).toBe(true);
  });

  it('a guest (no user, or isGuest true) is never redirected here - guests are handled entirely by OnboardingGate\'s own separate, already-correct needsWelcome/guestEntry mechanism', () => {
    expect(shouldRedirectToIntroduction({ ...baseParams, user: null })).toBe(false);
    expect(shouldRedirectToIntroduction({ ...baseParams, isGuest: true })).toBe(false);
    expect(shouldRedirectToIntroduction({ ...baseParams, user: null, isGuest: true })).toBe(false);
  });

  it('never fires while the profile is still loading, on a profile-fetch error, or before any profile object exists yet - fails closed (stays wherever the user is) rather than redirecting on uncertain data', () => {
    expect(shouldRedirectToIntroduction({ ...baseParams, profileLoading: true })).toBe(false);
    expect(shouldRedirectToIntroduction({ ...baseParams, profileError: "We couldn't load your profile. Please try again." })).toBe(false);
    expect(shouldRedirectToIntroduction({ ...baseParams, profile: null })).toBe(false);
  });

  it('9/11. defers to Auth.jsx\'s own synchronous redirect whenever it already ran (alreadyHandled) - never double-acts, so an ordinary sign-in via the Auth form is completely unaffected by this passive check', () => {
    expect(shouldRedirectToIntroduction({ ...baseParams, alreadyHandled: true })).toBe(false);
  });

  it('9. never re-fires once already on /introduction - no redirect loop', () => {
    expect(shouldRedirectToIntroduction({ ...baseParams, pathname: '/introduction' })).toBe(false);
  });

  it('fires from any OTHER route, not only "/" - Home and every other route must not be reachable before the Welcome decision', () => {
    for (const pathname of ['/', '/profile', '/settings', '/library']) {
      expect(shouldRedirectToIntroduction({ ...baseParams, pathname })).toBe(true);
    }
  });
});

describe('buildIntroductionRedirectPath', () => {
  it('a genuinely brand-new profile (never completed any version) gets the plain auto=1 path, no &existing=1', () => {
    expect(buildIntroductionRedirectPath({ introduction_completed_version: null })).toBe('/introduction?auto=1');
    expect(buildIntroductionRedirectPath({ introduction_completed_version: 0 })).toBe('/introduction?auto=1');
  });

  it('an existing account below the current version gets &existing=1, for the personalised "Welcome back" copy', () => {
    expect(buildIntroductionRedirectPath({ introduction_completed_version: 1 })).toBe('/introduction?auto=1&existing=1');
  });
});

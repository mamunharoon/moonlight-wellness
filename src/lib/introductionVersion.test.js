// First-use WakeWise Introduction — version-comparison behaviour tests.
import { describe, it, expect } from 'vitest';
import { CURRENT_INTRODUCTION_VERSION, shouldShowIntroduction } from './introductionVersion';

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

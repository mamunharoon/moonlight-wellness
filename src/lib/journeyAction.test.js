// WakeWise DEV — journey-aware primary action colour: focused unit
// coverage for the shared getJourneyPrimaryActionClasses helper, real
// execution (not just source-text assertions - see journeyGlowWiring.test.js
// for the source-level wiring proof across every consumer page).
import { describe, it, expect } from 'vitest';
import { getJourneyPrimaryActionClasses } from './journeyAction';

describe('getJourneyPrimaryActionClasses', () => {
  it('resolves each real journey to its own solid, alpha-safe accent pair - never an opacity-modified class (solid fills never need the -tint form)', () => {
    expect(getJourneyPrimaryActionClasses('morning')).toBe('bg-morning-accent text-on-morning-accent');
    expect(getJourneyPrimaryActionClasses('anytime')).toBe('bg-tertiary text-on-tertiary');
    expect(getJourneyPrimaryActionClasses('evening')).toBe('bg-evening-accent text-on-evening-accent');
  });

  it('falls back to the app\'s existing generic peach primary for an unknown or omitted journey - never a crash, never a wrong colour', () => {
    expect(getJourneyPrimaryActionClasses('primary')).toBe('bg-primary text-on-primary');
    expect(getJourneyPrimaryActionClasses(undefined)).toBe('bg-primary text-on-primary');
    expect(getJourneyPrimaryActionClasses('not-a-real-journey')).toBe('bg-primary text-on-primary');
    expect(getJourneyPrimaryActionClasses('')).toBe('bg-primary text-on-primary');
  });

  it('none of the three real-journey results contain a Tailwind opacity modifier (the exact class of bug this pass fixed elsewhere)', () => {
    for (const journey of ['morning', 'anytime', 'evening']) {
      expect(getJourneyPrimaryActionClasses(journey)).not.toMatch(/\/\d/);
    }
  });
});

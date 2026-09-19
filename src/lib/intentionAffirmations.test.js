import { describe, it, expect } from 'vitest';
import { getAffirmationForIntention, INTENTION_AFFIRMATIONS, DEFAULT_AFFIRMATION } from './intentionAffirmations';

describe('getAffirmationForIntention', () => {
  it('maps every one of the six approved presets to its exact required affirmation', () => {
    expect(getAffirmationForIntention('Stay calm')).toBe('I can meet today with calm and steadiness.');
    expect(getAffirmationForIntention('Be grateful')).toBe('I notice and appreciate the good around me.');
    expect(getAffirmationForIntention('Be patient')).toBe('I give myself and others the time we need.');
    expect(getAffirmationForIntention('Stay focused')).toBe('I give my attention to what matters now.');
    expect(getAffirmationForIntention('Take one step forward')).toBe('Small, steady steps create meaningful progress.');
    expect(getAffirmationForIntention('Be kind to yourself')).toBe('I can move through today with self-compassion.');
  });

  it('falls back to the fixed neutral affirmation for a custom (non-preset) intention', () => {
    expect(getAffirmationForIntention('Write my novel')).toBe(DEFAULT_AFFIRMATION);
    expect(getAffirmationForIntention('<script>alert(1)</script>')).toBe(DEFAULT_AFFIRMATION);
  });

  it('never interpolates the custom intention text into the returned affirmation', () => {
    const custom = 'Something totally unique nobody else would type';
    expect(getAffirmationForIntention(custom)).not.toContain(custom);
    expect(getAffirmationForIntention(custom)).toBe(DEFAULT_AFFIRMATION);
  });

  it('falls back to the default for null, undefined, empty string, or a non-string value', () => {
    expect(getAffirmationForIntention(null)).toBe(DEFAULT_AFFIRMATION);
    expect(getAffirmationForIntention(undefined)).toBe(DEFAULT_AFFIRMATION);
    expect(getAffirmationForIntention('')).toBe(DEFAULT_AFFIRMATION);
    expect(getAffirmationForIntention(42)).toBe(DEFAULT_AFFIRMATION);
  });

  it('is case-sensitive and whitespace-sensitive - only an exact preset match resolves (no fuzzy matching that could mis-map)', () => {
    expect(getAffirmationForIntention('stay calm')).toBe(DEFAULT_AFFIRMATION);
    expect(getAffirmationForIntention('Stay calm ')).toBe(DEFAULT_AFFIRMATION);
  });

  it('exposes exactly the six approved presets, no more, no less', () => {
    expect(Object.keys(INTENTION_AFFIRMATIONS).sort()).toEqual(
      ['Be grateful', 'Be kind to yourself', 'Be patient', 'Stay calm', 'Stay focused', 'Take one step forward'].sort()
    );
  });
});

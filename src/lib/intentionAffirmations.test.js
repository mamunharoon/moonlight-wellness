import { describe, it, expect } from 'vitest';
import { getAffirmationForIntention, INTENTION_AFFIRMATIONS, DEFAULT_AFFIRMATION, DEFAULT_AFFIRMATION_VARIANTS } from './intentionAffirmations';

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

// WakeWise Phase 2 (B6) — rotating affirmations, same technique as
// greeting.js/outcomeMessages.js.
describe('getAffirmationForIntention - rotation', () => {
  it('each preset now holds 5 variants, with the original single line preserved as variant 0', () => {
    for (const variants of Object.values(INTENTION_AFFIRMATIONS)) {
      expect(variants.length).toBe(5);
    }
  });

  it('is stable for the same local dateKey across repeated calls', () => {
    const a = getAffirmationForIntention('Stay calm', '2026-09-26');
    const b = getAffirmationForIntention('Stay calm', '2026-09-26');
    expect(a).toBe(b);
  });

  it('advances through all 5 variants across 5 consecutive days before repeating', () => {
    const dateKeys = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'];
    const results = dateKeys.map((d) => getAffirmationForIntention('Stay calm', d));
    expect(new Set(results).size).toBe(5);
    const sixthDay = getAffirmationForIntention('Stay calm', '2026-09-25');
    expect(sixthDay).toBe(results[0]);
  });

  it('a custom (non-preset) intention also rotates, through DEFAULT_AFFIRMATION_VARIANTS', () => {
    const dateKeys = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'];
    const results = dateKeys.map((d) => getAffirmationForIntention('My own custom goal', d));
    expect(new Set(results).size).toBe(5);
    expect([...results].sort()).toEqual([...DEFAULT_AFFIRMATION_VARIANTS].sort());
  });

  it('a missing dateKey resolves to variant 0 (the original, pre-Phase-2 single line) - every existing no-dateKey call site/test is unaffected', () => {
    expect(getAffirmationForIntention('Stay calm')).toBe(INTENTION_AFFIRMATIONS['Stay calm'][0]);
    expect(getAffirmationForIntention('Stay calm', undefined)).toBe(INTENTION_AFFIRMATIONS['Stay calm'][0]);
  });

  it('never interpolates the custom intention text into any rotated variant', () => {
    const custom = 'Something totally unique nobody else would type';
    for (const dateKey of ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24']) {
      expect(getAffirmationForIntention(custom, dateKey)).not.toContain(custom);
    }
  });
});

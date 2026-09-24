// Circadian Colors (Build 16) — Library category header accent, live-
// verified in the browser (Morning gold, Breathing mint, Evening
// Wind-Down/Sleep Soundscapes lavender, every other category neutral
// peach). This is the pure-logic piece: real execution, not a source
// regex (getCategoryAccentClass is trivially importable/callable).
import { describe, it, expect } from 'vitest';
import { CATALOG_CATEGORIES, getCategoryAccentClass } from './mediaCatalog';

describe('getCategoryAccentClass — Circadian Colors, time-of-day categories only', () => {
  it('Morning gets dawn-gold, Breathing gets mint, Evening Wind-Down/Sleep Soundscapes get lavender', () => {
    expect(getCategoryAccentClass('Morning')).toBe('text-morning-accent');
    expect(getCategoryAccentClass('Breathing')).toBe('text-tertiary');
    expect(getCategoryAccentClass('Evening Wind-Down')).toBe('text-evening-accent');
    expect(getCategoryAccentClass('Sleep Soundscapes')).toBe('text-evening-accent');
  });

  it('every other real catalogue category stays the neutral peach default - not every category gets its own colour', () => {
    const accented = new Set(['Morning', 'Breathing', 'Evening Wind-Down', 'Sleep Soundscapes']);
    for (const category of CATALOG_CATEGORIES) {
      if (accented.has(category)) continue;
      expect(getCategoryAccentClass(category)).toBe('text-primary');
    }
  });

  it('an unknown category also falls back to the neutral peach default, never throws', () => {
    expect(getCategoryAccentClass('Not A Real Category')).toBe('text-primary');
    expect(getCategoryAccentClass(undefined)).toBe('text-primary');
  });
});

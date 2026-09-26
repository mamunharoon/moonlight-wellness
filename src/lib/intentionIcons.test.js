// WakeWise Phase 2 (B2) — intentionIcons.js.
import { describe, it, expect } from 'vitest';
import { INTENTION_PRESETS } from './intentionAffirmations';
import { INTENTION_ICON_BY_PRESET, DEFAULT_INTENTION_ICON, getIntentionIcon } from './intentionIcons';

describe('INTENTION_ICON_BY_PRESET', () => {
  it('has exactly one icon for every real preset, never drifting out of sync with INTENTION_PRESETS', () => {
    expect(Object.keys(INTENTION_ICON_BY_PRESET).sort()).toEqual([...INTENTION_PRESETS].sort());
  });

  it('every icon is a non-empty Material Symbols ligature name, never an emoji', () => {
    for (const icon of Object.values(INTENTION_ICON_BY_PRESET)) {
      expect(typeof icon).toBe('string');
      expect(icon.length).toBeGreaterThan(0);
      // Material Symbols ligature names are lower_snake_case ASCII - an
      // emoji or arbitrary unicode glyph would fail this.
      expect(icon).toMatch(/^[a-z_]+$/);
    }
  });

  it('no two presets share the same icon - each intention is visually distinguishable by icon alone', () => {
    const icons = Object.values(INTENTION_ICON_BY_PRESET);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

describe('getIntentionIcon', () => {
  it('returns the mapped icon for every real preset', () => {
    for (const preset of INTENTION_PRESETS) {
      expect(getIntentionIcon(preset)).toBe(INTENTION_ICON_BY_PRESET[preset]);
    }
  });

  it('returns DEFAULT_INTENTION_ICON for a custom (non-preset) intention', () => {
    expect(getIntentionIcon('My own custom intention')).toBe(DEFAULT_INTENTION_ICON);
  });

  it('returns DEFAULT_INTENTION_ICON for an empty or unexpected value, never throws', () => {
    expect(() => getIntentionIcon('')).not.toThrow();
    expect(getIntentionIcon('')).toBe(DEFAULT_INTENTION_ICON);
    expect(getIntentionIcon(undefined)).toBe(DEFAULT_INTENTION_ICON);
  });
});

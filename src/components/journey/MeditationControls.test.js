// Source-level regression guard for MeditationControls.jsx - the shared
// MeditationOptionRow/MeditationDurationChip radios extracted from
// SelfGuidedMeditation.jsx (Journey Embedding, Phase 2).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./MeditationControls.jsx', import.meta.url)), 'utf-8');

describe('MeditationControls — accessible radios, real native <input type="radio">', () => {
  it('both MeditationOptionRow and MeditationDurationChip render a real native radio input', () => {
    const matches = source.match(/<input type="radio" name=\{groupName\}/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it('selected/unselected state is conveyed by more than colour alone (a filled ring + dot vs. an outline, never a checkmark)', () => {
    expect(source).toMatch(/aria-hidden="true"/);
    expect(source).not.toMatch(/✓/);
  });
});

describe('MeditationControls — touch targets', () => {
  it('both rows carry the 44px minimum', () => {
    const minHeightMatches = source.match(/min-h-\[44px\]/g) ?? [];
    expect(minHeightMatches.length).toBe(2);
  });

  it('no element uses a fixed pixel width wider than a 320px viewport', () => {
    expect(source).not.toMatch(/w-\[\d{3,}px\]/);
  });
});

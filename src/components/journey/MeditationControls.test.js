// Source-level regression guard for MeditationControls.jsx - the shared
// MeditationOptionRow/MeditationDurationChip radios extracted from
// SelfGuidedMeditation.jsx (Journey Embedding, Phase 2).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./MeditationControls.jsx', import.meta.url)), 'utf-8');

describe('MeditationControls — accessible radios, real native <input type="radio">', () => {
  it('MeditationOptionRow, MeditationDurationChip and MeditationStyleCard (F6) each render a real native radio input', () => {
    const matches = source.match(/<input type="radio" name=\{groupName\}/g) ?? [];
    expect(matches.length).toBe(3);
  });

  it('selected/unselected state is conveyed by more than colour alone (a filled ring + dot vs. an outline, never a checkmark)', () => {
    expect(source).toMatch(/aria-hidden="true"/);
    expect(source).not.toMatch(/✓/);
  });
});

describe('MeditationControls — touch targets', () => {
  it('all three controls carry the 44px minimum', () => {
    const minHeightMatches = source.match(/min-h-\[44px\]/g) ?? [];
    expect(minHeightMatches.length).toBe(3);
  });

  it('no element uses a fixed pixel width wider than a 320px viewport', () => {
    expect(source).not.toMatch(/w-\[\d{3,}px\]/);
  });
});

// F6 (pre-Build-15 usability pass) — MeditationStyleCard: compact
// two-column style selector, shows only the style name (the description
// moves to one shared line below the grid in MeditationSetupPanel.jsx).
describe('MeditationControls — MeditationStyleCard (F6 compact style grid)', () => {
  it('shows only the style name inline - no description text inside the card itself', () => {
    const block = source.match(/export const MeditationStyleCard = [\s\S]*?\n};/)?.[0] ?? '';
    expect(block).toMatch(/\{label\}/);
    expect(block).not.toMatch(/\{description\}<\/span>/);
  });

  it('the accessible name (aria-label on the actual radio input, not the wrapping label) still carries "label: description" - a screen reader user gets the same information the visible shared description line gives a sighted user', () => {
    const block = source.match(/export const MeditationStyleCard = [\s\S]*?\n};/)?.[0] ?? '';
    expect(block).toMatch(/aria-label=\{description \? `\$\{label\}: \$\{description\}` : label\}/);
  });

  it('fullWidth (used only for the odd-numbered last style) applies col-span-2, defaulting to false for every ordinary card', () => {
    const block = source.match(/export const MeditationStyleCard = [\s\S]*?\n};/)?.[0] ?? '';
    expect(block).toMatch(/fullWidth = false/);
    expect(block).toMatch(/fullWidth \? 'col-span-2' : ''/);
  });

  it('selected state uses the same visual language (filled/outline border, no checkmark) as MeditationOptionRow/MeditationDurationChip - not a bespoke third treatment', () => {
    const block = source.match(/export const MeditationStyleCard = [\s\S]*?\n};/)?.[0] ?? '';
    expect(block).toMatch(/selected \? tokens\.selectedRow : tokens\.unselectedRow/);
  });
});

// Context-aware Meditation theming — journeyTone prop, additive
// (default 'primary': every pre-existing caller that omits it keeps its
// exact original peach look).
describe('MeditationControls — journeyTone', () => {
  it('imports the shared journeyTone.js token map, never a locally re-declared copy', () => {
    expect(source).toMatch(/import \{ getJourneyToneTokens \} from '\.\.\/\.\.\/lib\/journeyTone';/);
  });

  it('all three controls accept journeyTone (default \'primary\') and resolve it via getJourneyToneTokens', () => {
    const defaults = source.match(/journeyTone = 'primary'/g) ?? [];
    expect(defaults.length).toBe(3);
    const resolves = source.match(/const tokens = getJourneyToneTokens\(journeyTone\);/g) ?? [];
    expect(resolves.length).toBe(3);
  });

  it('no control hardcodes a plain bg-primary/border-primary/text-primary selected-state class any more - every one is tone-driven', () => {
    expect(source).not.toMatch(/'bg-primary\/10 border-primary'/);
    expect(source).not.toMatch(/'text-primary font-bold'/);
  });
});

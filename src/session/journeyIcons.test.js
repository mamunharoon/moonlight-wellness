// Phase 9 — canonical Breathe/Meditate icons (real execution). Proves
// Morning, Anytime and Evening all resolve the exact same semantic icon
// for the same concept, that Anytime's own original values are
// unchanged (it is the canonical reference), and that meditation-style/
// breathing-pattern/Library-content icons - deliberately different by
// design - are unaffected by this shared mapping.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JOURNEY_STAGE_ICONS } from './journeyIcons';
import { MORNING_PATHWAY_STAGES, EVENING_PATHWAY_STAGES } from './pathwayStages';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('JOURNEY_STAGE_ICONS - Anytime is the unchanged canonical reference', () => {
  it('breathe/meditate/need/time/reset/instantCalm/explore match Anytime\'s own original, pre-refactor values exactly', () => {
    expect(JOURNEY_STAGE_ICONS.breathe).toBe('air');
    expect(JOURNEY_STAGE_ICONS.meditate).toBe('self_improvement');
    expect(JOURNEY_STAGE_ICONS.need).toBe('psychology');
    expect(JOURNEY_STAGE_ICONS.time).toBe('schedule');
    expect(JOURNEY_STAGE_ICONS.reset).toBe('auto_awesome');
    expect(JOURNEY_STAGE_ICONS.instantCalm).toBe('bolt');
    expect(JOURNEY_STAGE_ICONS.explore).toBe('explore');
  });

  it('covers every concept named in the Phase 9 spec, including the journey-specific ones Anytime does not define', () => {
    for (const key of ['focus', 'stretch', 'breathe', 'meditate', 'affirm', 'reflect', 'gratitude', 'rest', 'need', 'time', 'reset', 'instantCalm', 'explore']) {
      expect(typeof JOURNEY_STAGE_ICONS[key]).toBe('string');
      expect(JOURNEY_STAGE_ICONS[key].length).toBeGreaterThan(0);
    }
  });
});

describe('Morning and Evening pathways resolve the exact same canonical icon as Anytime for shared concepts', () => {
  it('Breathe: Morning, Evening and Anytime all use "air"', () => {
    expect(MORNING_PATHWAY_STAGES.find((s) => s.id === 'breathe').icon).toBe('air');
    expect(EVENING_PATHWAY_STAGES.find((s) => s.id === 'breathe').icon).toBe('air');
    expect(JOURNEY_STAGE_ICONS.breathe).toBe('air');
  });

  it('Meditate: Morning, Evening and Anytime all use "self_improvement" (owner-confirmed seated-meditation icon), matching Home\'s own Meditate quick-action tile', () => {
    expect(MORNING_PATHWAY_STAGES.find((s) => s.id === 'meditate').icon).toBe('self_improvement');
    expect(EVENING_PATHWAY_STAGES.find((s) => s.id === 'meditate').icon).toBe('self_improvement');
    expect(JOURNEY_STAGE_ICONS.meditate).toBe('self_improvement');
  });

  it('Stretch no longer collides with Meditate\'s icon - each Morning stage has a visually distinct glyph', () => {
    const icons = MORNING_PATHWAY_STAGES.map((s) => s.icon);
    expect(new Set(icons).size).toBe(icons.length);
    expect(MORNING_PATHWAY_STAGES.find((s) => s.id === 'stretch').icon).toBe('accessibility_new');
  });

  it('every stage icon is sourced from the one shared JOURNEY_STAGE_ICONS mapping, never hardcoded independently in pathwayStages.js', () => {
    const source = read('./pathwayStages.js');
    expect(source).not.toMatch(/icon:\s*'[a-z_]+'/);
    expect(source).toMatch(/import \{ JOURNEY_STAGE_ICONS \} from '\.\/journeyIcons';/);
  });
});

describe('Meditation-style, breathing-pattern and Library-content icons are deliberately untouched', () => {
  it('breathingPatterns.js defines no icon field at all - unaffected by this journey-stage-only mapping', () => {
    expect(read('../lib/breathingPatterns.js')).not.toMatch(/icon:/);
  });

  it('meditationStyles.js (Meditation ↔ Breathing alignment correction, a later and separate pass) now carries its own per-STYLE icons, but none of them import from or collide with the canonical journey-stage JOURNEY_STAGE_ICONS.meditate/breathe value - proving style icons stay genuinely independent of the journey-stage mapping', () => {
    const source = read('../lib/meditationStyles.js');
    expect(source).toMatch(/icon:/);
    expect(source).not.toMatch(/import[\s\S]*?journeyIcons/);
    expect(source).not.toMatch(/icon:\s*'self_improvement'/);
    expect(source).not.toMatch(/icon:\s*'air'/);
  });

  it('Library.jsx\'s own Meditation category-filter icon (content-catalog scope, not a journey stage) is untouched', () => {
    expect(read('../pages/Library.jsx')).toMatch(/category === MEDITATION_FILTER \? 'spa' : getCategoryIcon\(category\)/);
  });

  it('individual Reflection/Gratitude answer-option icons (eveningOptionPresentation.js) and Morning\'s own per-move stretch icons (MorningFlow.jsx) are untouched', () => {
    expect(read('../lib/eveningOptionPresentation.js')).toMatch(/icon: 'spa'/);
    expect(read('../pages/MorningFlow.jsx')).toMatch(/icon: 'spa'/);
  });
});

describe('No raw hex colours; journey colour tokens are unaffected by this icon-only change', () => {
  it('journeyIcons.js introduces no colour of any kind', () => {
    const source = read('./journeyIcons.js');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(source).not.toMatch(/bg-|text-|border-/);
  });
});

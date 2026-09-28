import { describe, it, expect } from 'vitest';
import { getOptionPresentation, OPTION_PRESENTATION } from './eveningOptionPresentation';
import { REFLECTION_PROMPTS, GRATITUDE_PROMPTS } from './eveningJourneyQuestions';

const ALL_PROMPTS = [...REFLECTION_PROMPTS, ...GRATITUDE_PROMPTS];

describe('getOptionPresentation — safe presentation mapping (Evening Visual Uplift)', () => {
  it('never mutates or replaces the stored option string - only returns display metadata alongside it', () => {
    const presentation = getOptionPresentation('went-well', 'Reached a small milestone');
    expect(presentation.icon).toBe('flag');
    expect(presentation.label).toBe('Small milestone');
    expect(presentation.descriptor).toBe('Made meaningful progress');
    // The lookup key itself - the real stored value - is never altered or
    // echoed back transformed; callers keep comparing/saving the original.
  });

  it('falls back to the original option string with no icon for an unrecognised promptId/value pair - never throws', () => {
    expect(getOptionPresentation('not-a-real-prompt', 'Anything')).toEqual({
      label: 'Anything',
      icon: null,
      descriptor: null
    });
    expect(getOptionPresentation('went-well', 'Some future option not yet mapped')).toEqual({
      label: 'Some future option not yet mapped',
      icon: null,
      descriptor: null
    });
  });

  it('falls back safely for a StressRelease.jsx (Anytime) promptId, which this map never covers', () => {
    expect(getOptionPresentation('anytime-stress-prompt', 'Some Anytime option')).toEqual({
      label: 'Some Anytime option',
      icon: null,
      descriptor: null
    });
  });

  it('every real Reflection/Gratitude option (eveningJourneyQuestions.js) has a mapped presentation - no silent drift', () => {
    for (const prompt of ALL_PROMPTS) {
      for (const option of prompt.options ?? []) {
        const presentation = getOptionPresentation(prompt.id, option);
        expect(presentation.icon, `${prompt.id} / "${option}" should have a real icon`).toBeTruthy();
        expect(presentation.label, `${prompt.id} / "${option}" should have a display label`).toBeTruthy();
      }
    }
  });

  it('OPTION_PRESENTATION keys are copied verbatim from the real prompt ids - no orphaned or renamed prompt sections', () => {
    const realPromptIds = new Set(ALL_PROMPTS.map((p) => p.id));
    for (const promptId of Object.keys(OPTION_PRESENTATION)) {
      expect(realPromptIds.has(promptId), `"${promptId}" is not a real Reflection/Gratitude prompt id`).toBe(true);
    }
  });
});

// Evening completed-review — real, executable unit tests for
// resolveSavedAnswerDisplay (genuine execution against real prompt
// objects and saved-value strings, not source-level regex - this logic
// is pure/importable, matching this codebase's own precedent of
// preferring real execution wherever possible - see
// questionStepNavigation.test.js).
import { describe, it, expect } from 'vitest';
import { REFLECTION_PROMPTS, GRATITUDE_PROMPTS, resolveSavedAnswerDisplay } from './eveningJourneyQuestions';

const wentWell = REFLECTION_PROMPTS.find((p) => p.id === 'went-well');
const whoMadeBetter = GRATITUDE_PROMPTS.find((p) => p.id === 'who-made-better');

describe('resolveSavedAnswerDisplay - a saved value that exactly matches one of the question\'s real options', () => {
  it('is reported as that selected preset, never as a custom answer', () => {
    const result = resolveSavedAnswerDisplay(wentWell, 'Had a peaceful moment');
    expect(result.selectedOption).toBe('Had a peaceful moment');
    expect(result.isCustomAnswer).toBe(false);
    expect(result.hasValue).toBe(true);
  });

  it('works identically for a Gratitude question\'s own real options', () => {
    const result = resolveSavedAnswerDisplay(whoMadeBetter, 'A kind stranger');
    expect(result.selectedOption).toBe('A kind stranger');
    expect(result.isCustomAnswer).toBe(false);
  });
});

describe('resolveSavedAnswerDisplay - a saved value that does not match any option', () => {
  it('is reported as a custom answer, with the trimmed text preserved verbatim', () => {
    const result = resolveSavedAnswerDisplay(wentWell, '  Finally finished the garden project  ');
    expect(result.selectedOption).toBeNull();
    expect(result.isCustomAnswer).toBe(true);
    expect(result.hasValue).toBe(true);
    expect(result.trimmed).toBe('Finally finished the garden project');
  });
});

describe('resolveSavedAnswerDisplay - no saved value (skipped/missing)', () => {
  it('undefined, null, empty string, and whitespace-only all resolve to hasValue: false, never a fabricated selection or custom answer', () => {
    for (const missing of [undefined, null, '', '   ']) {
      const result = resolveSavedAnswerDisplay(wentWell, missing);
      expect(result.hasValue).toBe(false);
      expect(result.selectedOption).toBeNull();
      expect(result.isCustomAnswer).toBe(false);
    }
  });
});

describe('resolveSavedAnswerDisplay - matches the live journey\'s own derivation exactly (PromptStepper.jsx)', () => {
  it('a value is either the selected preset OR a custom answer OR nothing - never more than one true at once', () => {
    const cases = ['Had a peaceful moment', 'My own custom words', '', undefined];
    for (const value of cases) {
      const { selectedOption, isCustomAnswer, hasValue } = resolveSavedAnswerDisplay(wentWell, value);
      const flags = [Boolean(selectedOption), isCustomAnswer, !hasValue];
      expect(flags.filter(Boolean).length).toBe(1);
    }
  });
});

// Evening completed-review — real, executable unit tests for
// resolveSavedAnswerDisplay (genuine execution against real prompt
// objects and saved-value strings, not source-level regex - this logic
// is pure/importable, matching this codebase's own precedent of
// preferring real execution wherever possible - see
// questionStepNavigation.test.js).
import { describe, it, expect } from 'vitest';
import {
  REFLECTION_PROMPTS,
  GRATITUDE_PROMPTS,
  resolveSavedAnswerDisplay,
  EVENING_EDIT_PROMPTS,
  computeChangedEntries
} from './eveningJourneyQuestions';

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

// ---------------------------------------------------------------------
// Edit Tonight's Responses (Build 15) - EVENING_EDIT_PROMPTS/
// computeChangedEntries. Both are pure and genuinely executable, so
// these are real function calls against real inputs, not source-string
// assertions.
// ---------------------------------------------------------------------
describe('EVENING_EDIT_PROMPTS - one combined, ordered 6-question list (approved: a single shared edit session, never two independent pages)', () => {
  it('has exactly 6 entries: Reflection\'s 3 in their original order, then Gratitude\'s 3 in their original order', () => {
    expect(EVENING_EDIT_PROMPTS).toHaveLength(6);
    expect(EVENING_EDIT_PROMPTS.map((p) => p.id)).toEqual([
      ...REFLECTION_PROMPTS.map((p) => p.id),
      ...GRATITUDE_PROMPTS.map((p) => p.id)
    ]);
  });

  it('questions 1-3 are tagged reflection/peach, questions 4-6 are tagged gratitude/gold', () => {
    expect(EVENING_EDIT_PROMPTS.slice(0, 3).every((p) => p.stepId === 'reflection' && p.accent === 'reflection')).toBe(true);
    expect(EVENING_EDIT_PROMPTS.slice(3, 6).every((p) => p.stepId === 'gratitude' && p.accent === 'gratitude')).toBe(true);
  });

  it('is a derived combination, not a re-declared copy - every option list is the exact same array instance as the source prompt', () => {
    expect(EVENING_EDIT_PROMPTS[0].options).toBe(REFLECTION_PROMPTS[0].options);
    expect(EVENING_EDIT_PROMPTS[3].options).toBe(GRATITUDE_PROMPTS[0].options);
  });
});

describe('computeChangedEntries - real execution against real prompts and draft maps', () => {
  it('an unchanged answer (draft === original) is not included', () => {
    const original = { 'went-well': 'Had a peaceful moment' };
    const draft = { 'went-well': 'Had a peaceful moment' };
    expect(computeChangedEntries(original, draft, EVENING_EDIT_PROMPTS)).toEqual([]);
  });

  it('a blank draft is never included, even when the original had a real saved answer - Build 15 Edit does not support clearing to blank', () => {
    const original = { 'went-well': 'Had a peaceful moment' };
    const draft = { 'went-well': '   ' };
    expect(computeChangedEntries(original, draft, EVENING_EDIT_PROMPTS)).toEqual([]);
  });

  it('preset-to-different-preset is included with the correct stepId/promptId/response', () => {
    const original = { 'went-well': 'Had a peaceful moment' };
    const draft = { 'went-well': 'Got outside or moved' };
    expect(computeChangedEntries(original, draft, EVENING_EDIT_PROMPTS)).toEqual([
      { stepId: 'reflection', promptId: 'went-well', response: 'Got outside or moved' }
    ]);
  });

  it('preset-to-custom-text is included', () => {
    const original = { 'went-well': 'Had a peaceful moment' };
    const draft = { 'went-well': 'Finally finished a big project I was proud of' };
    expect(computeChangedEntries(original, draft, EVENING_EDIT_PROMPTS)).toEqual([
      { stepId: 'reflection', promptId: 'went-well', response: 'Finally finished a big project I was proud of' }
    ]);
  });

  it('custom-to-preset is included', () => {
    const original = { 'went-well': 'My own words from that night' };
    const draft = { 'went-well': 'Helped someone' };
    expect(computeChangedEntries(original, draft, EVENING_EDIT_PROMPTS)).toEqual([
      { stepId: 'reflection', promptId: 'went-well', response: 'Helped someone' }
    ]);
  });

  it('a previously-skipped question (no original answer) can gain a new answer during Edit', () => {
    const original = {};
    const draft = { 'grateful-now': 'This quiet moment' };
    expect(computeChangedEntries(original, draft, EVENING_EDIT_PROMPTS)).toEqual([
      { stepId: 'gratitude', promptId: 'grateful-now', response: 'This quiet moment' }
    ]);
  });

  it('a Reflection change and a Gratitude change together are both returned in ONE array - proves a single combined save can span both sections', () => {
    const original = { 'went-well': 'Had a peaceful moment', 'grateful-now': 'This quiet moment' };
    const draft = { 'went-well': 'Helped someone', 'grateful-now': 'A small comfort' };
    const changed = computeChangedEntries(original, draft, EVENING_EDIT_PROMPTS);
    expect(changed).toHaveLength(2);
    expect(changed).toEqual(
      expect.arrayContaining([
        { stepId: 'reflection', promptId: 'went-well', response: 'Helped someone' },
        { stepId: 'gratitude', promptId: 'grateful-now', response: 'A small comfort' }
      ])
    );
  });

  it('an untouched prompt elsewhere in the draft is never included alongside a genuine change', () => {
    const original = { 'went-well': 'Had a peaceful moment', challenged: 'Low energy' };
    const draft = { 'went-well': 'Helped someone', challenged: 'Low energy' };
    const changed = computeChangedEntries(original, draft, EVENING_EDIT_PROMPTS);
    expect(changed).toEqual([{ stepId: 'reflection', promptId: 'went-well', response: 'Helped someone' }]);
  });

  it('no changes anywhere returns an empty array', () => {
    expect(computeChangedEntries({}, {}, EVENING_EDIT_PROMPTS)).toEqual([]);
  });
});

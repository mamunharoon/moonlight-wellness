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
  computeChangedEntries,
  encodeMultiAnswer,
  decodeMultiAnswer,
  toggleMultiSelectOption,
  NOT_SURE_YET_OPTION
} from './eveningJourneyQuestions';

const wentWell = REFLECTION_PROMPTS.find((p) => p.id === 'went-well');
const whoMadeBetter = GRATITUDE_PROMPTS.find((p) => p.id === 'who-made-better');
const release = REFLECTION_PROMPTS.find((p) => p.id === 'release');

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

// ---------------------------------------------------------------------
// Evening Reflection/Gratitude multiple-selection enhancement —
// encodeMultiAnswer/decodeMultiAnswer/toggleMultiSelectOption. Pure and
// genuinely executable (no React, no DOM), so these are real function
// calls against real prompt objects and saved-value strings, matching
// this file's own established convention above. NO schema change: every
// encoded value is still a single plain string written to the same
// `response text` column - a single selection with no custom text (or
// custom text alone) still encodes to that exact bare string, byte-
// identical to a historical single-answer record; only a genuinely
// multi-valued answer (two or more selections, or any selection(s) plus
// custom text) encodes to a small JSON object string.
// ---------------------------------------------------------------------
describe('encodeMultiAnswer - single-valued answers stay a plain string, byte-identical to a legacy single-answer record', () => {
  it('no selections and no custom text encodes to an empty string', () => {
    expect(encodeMultiAnswer({ selections: [], custom: '' })).toBe('');
    expect(encodeMultiAnswer({})).toBe('');
  });

  it('exactly one selection with no custom text encodes to that bare option string - never JSON-wrapped', () => {
    expect(encodeMultiAnswer({ selections: ['Had a peaceful moment'], custom: '' })).toBe('Had a peaceful moment');
  });

  it('custom text alone (no selections) encodes to that trimmed bare string - never JSON-wrapped', () => {
    expect(encodeMultiAnswer({ selections: [], custom: '  My own words  ' })).toBe('My own words');
  });
});

describe('encodeMultiAnswer - genuinely multi-valued answers encode to a small JSON object string', () => {
  it('two or more selections (no custom) encode to {"selections":[...],"custom":""}', () => {
    const encoded = encodeMultiAnswer({ selections: ['Had a peaceful moment', 'Helped someone'], custom: '' });
    expect(JSON.parse(encoded)).toEqual({ selections: ['Had a peaceful moment', 'Helped someone'], custom: '' });
  });

  it('exactly one selection PLUS custom text also encodes to JSON - the one case a bare string cannot represent unambiguously', () => {
    const encoded = encodeMultiAnswer({ selections: ['Had a peaceful moment'], custom: 'and a bit more' });
    expect(JSON.parse(encoded)).toEqual({ selections: ['Had a peaceful moment'], custom: 'and a bit more' });
  });
});

describe('decodeMultiAnswer - no saved value (skipped/missing)', () => {
  it('undefined, null, empty string, and whitespace-only all resolve to hasValue: false, zero selections, no custom text', () => {
    for (const missing of [undefined, null, '', '   ']) {
      expect(decodeMultiAnswer(wentWell, missing)).toEqual({ selections: [], custom: '', hasValue: false });
    }
  });
});

describe('decodeMultiAnswer - legacy single-answer records (pre-dating this enhancement) decode exactly like resolveSavedAnswerDisplay', () => {
  it('a legacy value that exactly matches one of the question\'s real options decodes as that one selection, no custom text', () => {
    expect(decodeMultiAnswer(wentWell, 'Had a peaceful moment')).toEqual({
      selections: ['Had a peaceful moment'],
      custom: '',
      hasValue: true
    });
  });

  it('a legacy value that matches no option decodes as pure custom text, zero selections', () => {
    expect(decodeMultiAnswer(wentWell, '  Finally finished the garden project  ')).toEqual({
      selections: [],
      custom: 'Finally finished the garden project',
      hasValue: true
    });
  });
});

describe('decodeMultiAnswer - genuinely multi-valued (JSON-encoded) answers', () => {
  it('decodes every selection plus custom text back out exactly as encoded', () => {
    const encoded = encodeMultiAnswer({ selections: ['Had a peaceful moment', 'Helped someone'], custom: 'and a bit more' });
    expect(decodeMultiAnswer(wentWell, encoded)).toEqual({
      selections: ['Had a peaceful moment', 'Helped someone'],
      custom: 'and a bit more',
      hasValue: true
    });
  });

  it('a selection that no longer belongs to this question\'s own options list is filtered out, never surfaced as a phantom checked box', () => {
    const encoded = JSON.stringify({ selections: ['Had a peaceful moment', 'An option that no longer exists'], custom: '' });
    expect(decodeMultiAnswer(wentWell, encoded)).toEqual({
      selections: ['Had a peaceful moment'],
      custom: '',
      hasValue: true
    });
  });

  it('malformed JSON-like text that merely starts with "{" falls back to being read as plain custom text, never throws', () => {
    const malformed = '{not valid json';
    expect(() => decodeMultiAnswer(wentWell, malformed)).not.toThrow();
    expect(decodeMultiAnswer(wentWell, malformed)).toEqual({ selections: [], custom: malformed, hasValue: true });
  });
});

describe('toggleMultiSelectOption - independent add/remove, more than one may be selected at once', () => {
  it('toggling an unselected option onto an empty selection adds it', () => {
    expect(toggleMultiSelectOption([], 'Had a peaceful moment')).toEqual(['Had a peaceful moment']);
  });

  it('toggling an already-selected option off removes only that option, leaving every other selection untouched', () => {
    const selections = ['Had a peaceful moment', 'Helped someone', 'Got outside or moved'];
    expect(toggleMultiSelectOption(selections, 'Helped someone')).toEqual(['Had a peaceful moment', 'Got outside or moved']);
  });

  it('toggling a second, third option onto an existing selection appends it, never replacing the prior selection(s)', () => {
    expect(toggleMultiSelectOption(['Had a peaceful moment'], 'Helped someone')).toEqual(['Had a peaceful moment', 'Helped someone']);
  });
});

describe('toggleMultiSelectOption - "Not sure yet" (release question) is exclusive with every other selection', () => {
  it('selecting "Not sure yet" while other options are already selected clears them, leaving it as the sole selection', () => {
    expect(toggleMultiSelectOption(["Today's stress", 'A mistake I made'], NOT_SURE_YET_OPTION)).toEqual([NOT_SURE_YET_OPTION]);
  });

  it('toggling "Not sure yet" off (it was the sole selection) clears the selection entirely', () => {
    expect(toggleMultiSelectOption([NOT_SURE_YET_OPTION], NOT_SURE_YET_OPTION)).toEqual([]);
  });

  it('selecting a real option while "Not sure yet" is the current selection replaces it with that option alone', () => {
    expect(toggleMultiSelectOption([NOT_SURE_YET_OPTION], "Today's stress")).toEqual(["Today's stress"]);
  });

  it('the exclusivity is specific to this literal option string - a question with no "Not sure yet" option never triggers it for any of its own options', () => {
    expect(toggleMultiSelectOption(['Had a peaceful moment'], 'Helped someone')).toEqual(['Had a peaceful moment', 'Helped someone']);
  });
});

describe('Persistence round-trip - a legacy single-answer record survives an encode(decode(...)) pass byte-for-byte', () => {
  it('a legacy preset selection round-trips to the exact same bare string', () => {
    const legacy = 'Had a peaceful moment';
    expect(encodeMultiAnswer(decodeMultiAnswer(wentWell, legacy))).toBe(legacy);
  });

  it('legacy free-text custom round-trips to the exact same trimmed string', () => {
    const legacy = 'Finally finished the garden project';
    expect(encodeMultiAnswer(decodeMultiAnswer(wentWell, `  ${legacy}  `))).toBe(legacy);
  });

  it('a genuinely multi-valued answer round-trips to an equivalent decode (selections/custom), even though the JSON string itself is regenerated', () => {
    const original = { selections: ['Had a peaceful moment', 'Helped someone'], custom: 'and a bit more' };
    const roundTripped = decodeMultiAnswer(wentWell, encodeMultiAnswer(original));
    expect(roundTripped).toEqual({ ...original, hasValue: true });
  });

  it('the "release" question\'s real "Not sure yet" option round-trips correctly as a single-valued legacy-compatible record', () => {
    const encoded = encodeMultiAnswer({ selections: [NOT_SURE_YET_OPTION], custom: '' });
    expect(encoded).toBe(NOT_SURE_YET_OPTION);
    expect(decodeMultiAnswer(release, encoded)).toEqual({ selections: [NOT_SURE_YET_OPTION], custom: '', hasValue: true });
  });
});

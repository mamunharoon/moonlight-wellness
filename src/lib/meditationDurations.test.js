import { describe, it, expect } from 'vitest';
import { MEDITATION_DURATIONS, DEFAULT_MEDITATION_DURATION_ID, getMeditationDurationById, formatMeditationBeginLabel } from './meditationDurations';

describe('MEDITATION_DURATIONS — three choices, exact order, exact seconds', () => {
  it('has exactly three durations in order: 2, 5, 10 minutes', () => {
    expect(MEDITATION_DURATIONS.map((d) => d.id)).toEqual(['2min', '5min', '10min']);
    expect(MEDITATION_DURATIONS.map((d) => d.seconds)).toEqual([120, 300, 600]);
    expect(MEDITATION_DURATIONS.map((d) => d.label)).toEqual(['2 minutes', '5 minutes', '10 minutes']);
  });

  it('5 minutes is both the default and the only "Recommended" choice', () => {
    expect(DEFAULT_MEDITATION_DURATION_ID).toBe('5min');
    const recommended = MEDITATION_DURATIONS.filter((d) => d.recommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].id).toBe('5min');
  });
});

describe('getMeditationDurationById', () => {
  it('resolves a known id to its exact seconds', () => {
    expect(getMeditationDurationById('2min')?.seconds).toBe(120);
    expect(getMeditationDurationById('10min')?.seconds).toBe(600);
  });

  it('returns null for an unknown id, never throws', () => {
    expect(getMeditationDurationById('3min')).toBeNull();
    expect(getMeditationDurationById(undefined)).toBeNull();
  });
});

// Pre-Build-15 defect fix — real-execution behavioural test.
// formatMeditationBeginLabel is a pure function (genuinely executable,
// unlike the React component files in this repo - environment: 'node' in
// vite.config.js has no DOM), the single source of truth for the "Begin
// N-Minute Meditation" CTA text every caller (Morning/Evening/standalone,
// via MeditationSetupPanel.jsx) now derives from the live duration
// object instead of a caller-supplied static string.
describe('formatMeditationBeginLabel — real execution, one consistent format for every real duration', () => {
  it('produces the exact required label for each of the three real durations', () => {
    expect(formatMeditationBeginLabel(getMeditationDurationById('2min'))).toBe('Begin 2-Minute Meditation');
    expect(formatMeditationBeginLabel(getMeditationDurationById('5min'))).toBe('Begin 5-Minute Meditation');
    expect(formatMeditationBeginLabel(getMeditationDurationById('10min'))).toBe('Begin 10-Minute Meditation');
  });

  it('is a pure function of `duration.seconds` alone - the exact same duration object always produces the exact same label, no hidden state', () => {
    const twoMin = getMeditationDurationById('2min');
    expect(formatMeditationBeginLabel(twoMin)).toBe(formatMeditationBeginLabel(twoMin));
    expect(formatMeditationBeginLabel(twoMin)).toBe(formatMeditationBeginLabel({ ...twoMin }));
  });

  it('repeated selection changes (2 -> 10 -> 5 -> 2) each produce the correct, independent label - proves there is no memoisation/staleness across calls', () => {
    const sequenceIds = ['2min', '10min', '5min', '2min'];
    const expected = ['Begin 2-Minute Meditation', 'Begin 10-Minute Meditation', 'Begin 5-Minute Meditation', 'Begin 2-Minute Meditation'];
    const actual = sequenceIds.map((id) => formatMeditationBeginLabel(getMeditationDurationById(id)));
    expect(actual).toEqual(expected);
  });

  it('every MEDITATION_DURATIONS entry converts to a whole number of minutes - the format never needs to handle a fractional result', () => {
    for (const duration of MEDITATION_DURATIONS) {
      expect(Number.isInteger(duration.seconds / 60)).toBe(true);
    }
  });
});

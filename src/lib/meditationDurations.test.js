import { describe, it, expect } from 'vitest';
import { MEDITATION_DURATIONS, DEFAULT_MEDITATION_DURATION_ID, getMeditationDurationById } from './meditationDurations';

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

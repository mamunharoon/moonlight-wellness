import { describe, it, expect } from 'vitest';
import {
  MEDITATION_STYLES,
  DEFAULT_MEDITATION_STYLE_ID,
  getMeditationStyleById,
  getPromptIndexForElapsed,
  getPromptForStyle
} from './meditationStyles';

describe('MEDITATION_STYLES — five styles, exact order, exact copy', () => {
  it('has exactly five styles in the approved order', () => {
    expect(MEDITATION_STYLES.map((s) => s.id)).toEqual([
      'quiet',
      'breath-awareness',
      'mindful-pause',
      'body-awareness',
      'loving-kindness'
    ]);
  });

  it('Quiet Meditation is the default style', () => {
    expect(DEFAULT_MEDITATION_STYLE_ID).toBe('quiet');
    expect(MEDITATION_STYLES[0].id).toBe(DEFAULT_MEDITATION_STYLE_ID);
  });

  it('labels and supporting copy match the approved spec exactly', () => {
    const byId = Object.fromEntries(MEDITATION_STYLES.map((s) => [s.id, s]));
    expect(byId.quiet.label).toBe('Quiet Meditation');
    expect(byId.quiet.description).toBe('Sit quietly with gentle background music');
    expect(byId['breath-awareness'].label).toBe('Breath Awareness');
    expect(byId['breath-awareness'].description).toBe('Gently notice each breath');
    expect(byId['mindful-pause'].label).toBe('Mindful Pause');
    expect(byId['mindful-pause'].description).toBe('Notice your body, thoughts and surroundings');
    expect(byId['body-awareness'].label).toBe('Body Awareness');
    expect(byId['body-awareness'].description).toBe('Gently notice sensations throughout your body');
    expect(byId['loving-kindness'].label).toBe('Loving-Kindness');
    expect(byId['loving-kindness'].description).toBe('Offer kind thoughts to yourself and others');
  });

  it('no style carries its own audio/media id - all five share one track, wired by the page/controller, not per style', () => {
    for (const style of MEDITATION_STYLES) {
      expect(style.mediaId).toBeUndefined();
      expect(style.audioId).toBeUndefined();
    }
  });

  it('Body Awareness and Loving-Kindness carry their own four-line prompt sets, exactly as specified', () => {
    const byId = Object.fromEntries(MEDITATION_STYLES.map((s) => [s.id, s]));
    expect(byId['body-awareness'].prompts).toEqual([
      'Notice where your body meets the surface beneath you.',
      'Gently soften your shoulders and jaw.',
      'Notice sensations without needing to change them.',
      'Allow your whole body to settle.'
    ]);
    expect(byId['loving-kindness'].prompts).toEqual([
      'Offer yourself a moment of kindness.',
      'May you feel calm and supported.',
      'Bring someone you care about gently to mind.',
      'Extend that same kindness outward.'
    ]);
  });

  it('every style has at least one prompt and no empty prompt strings (no medical/wellbeing claims to check here, just non-empty visual text)', () => {
    for (const style of MEDITATION_STYLES) {
      expect(style.prompts.length).toBeGreaterThan(0);
      for (const prompt of style.prompts) {
        expect(typeof prompt).toBe('string');
        expect(prompt.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('getMeditationStyleById', () => {
  it('resolves a known id', () => {
    expect(getMeditationStyleById('body-awareness')?.label).toBe('Body Awareness');
  });

  it('returns null for an unknown id, never throws', () => {
    expect(getMeditationStyleById('not-a-style')).toBeNull();
    expect(getMeditationStyleById(undefined)).toBeNull();
  });
});

describe('getPromptIndexForElapsed — deterministic, equal-section schedule', () => {
  it('splits a 3-prompt style into three equal sections of a 300s session', () => {
    expect(getPromptIndexForElapsed(0, 300, 3)).toBe(0);
    expect(getPromptIndexForElapsed(99, 300, 3)).toBe(0);
    expect(getPromptIndexForElapsed(100, 300, 3)).toBe(1);
    expect(getPromptIndexForElapsed(199, 300, 3)).toBe(1);
    expect(getPromptIndexForElapsed(200, 300, 3)).toBe(2);
    expect(getPromptIndexForElapsed(299, 300, 3)).toBe(2);
  });

  it('never exceeds the last valid index, even at or beyond the full duration', () => {
    expect(getPromptIndexForElapsed(300, 300, 3)).toBe(2);
    expect(getPromptIndexForElapsed(10_000, 300, 3)).toBe(2);
  });

  it('splits a 4-prompt style into four equal sections of a 120s session', () => {
    expect(getPromptIndexForElapsed(0, 120, 4)).toBe(0);
    expect(getPromptIndexForElapsed(29, 120, 4)).toBe(0);
    expect(getPromptIndexForElapsed(30, 120, 4)).toBe(1);
    expect(getPromptIndexForElapsed(60, 120, 4)).toBe(2);
    expect(getPromptIndexForElapsed(90, 120, 4)).toBe(3);
    expect(getPromptIndexForElapsed(119, 120, 4)).toBe(3);
  });

  it('is a pure function of its inputs - calling it repeatedly with the same arguments always yields the same index', () => {
    const calls = Array.from({ length: 5 }, () => getPromptIndexForElapsed(150, 300, 3));
    expect(new Set(calls).size).toBe(1);
  });

  it('a single-prompt style always resolves to index 0, regardless of elapsed time', () => {
    expect(getPromptIndexForElapsed(0, 120, 1)).toBe(0);
    expect(getPromptIndexForElapsed(119, 120, 1)).toBe(0);
  });
});

describe('getPromptForStyle — real prompt text per style, per duration', () => {
  it('Quiet Meditation shows its three prompts across a 2-minute (120s) session in order', () => {
    const style = getMeditationStyleById('quiet');
    expect(getPromptForStyle(style, 0, 120)).toBe('Allow yourself to be still.');
    expect(getPromptForStyle(style, 45, 120)).toBe('Let thoughts pass without following them.');
    expect(getPromptForStyle(style, 90, 120)).toBe('Return gently to this quiet moment.');
  });

  it('Body Awareness shows its own four prompts across a 10-minute (600s) session, distinct from Quiet Meditation', () => {
    const style = getMeditationStyleById('body-awareness');
    expect(getPromptForStyle(style, 0, 600)).toBe('Notice where your body meets the surface beneath you.');
    expect(getPromptForStyle(style, 200, 600)).toBe('Gently soften your shoulders and jaw.');
    expect(getPromptForStyle(style, 400, 600)).toBe('Notice sensations without needing to change them.');
    expect(getPromptForStyle(style, 599, 600)).toBe('Allow your whole body to settle.');
  });

  it('Loving-Kindness shows its own four prompts, never mixed with another style\'s prompts', () => {
    const style = getMeditationStyleById('loving-kindness');
    expect(getPromptForStyle(style, 0, 300)).toBe('Offer yourself a moment of kindness.');
    expect(getPromptForStyle(style, 299, 300)).toBe('Extend that same kindness outward.');
  });

  it('returns an empty string rather than throwing for a null/malformed style', () => {
    expect(getPromptForStyle(null, 0, 300)).toBe('');
    expect(getPromptForStyle({ prompts: [] }, 0, 300)).toBe('');
  });
});

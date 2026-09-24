import { describe, it, expect } from 'vitest';
import {
  MEDITATION_SOUNDS,
  getMeditationSoundById,
  isValidMeditationSoundId,
  SUGGESTED_SOUND_ID_BY_STYLE_ID,
  getSuggestedSoundIdForStyle,
  toControllerSoundId
} from './meditationSounds';
import { MEDITATION_STYLES } from './meditationStyles';

describe('MEDITATION_SOUNDS — three choices, exact order, exact copy', () => {
  it('has exactly three sounds in the approved order: Gentle Ambient, Soft Piano, No Music', () => {
    expect(MEDITATION_SOUNDS.map((s) => s.id)).toEqual(['IM01', 'IM02', 'none']);
    expect(MEDITATION_SOUNDS.map((s) => s.label)).toEqual(['Gentle Ambient', 'Soft Piano', 'No Music']);
  });

  it('supporting copy matches the approved spec exactly, and never describes either track as narrated or guided', () => {
    const byId = Object.fromEntries(MEDITATION_SOUNDS.map((s) => [s.id, s]));
    expect(byId.IM01.description).toBe('Soft atmospheric background music');
    expect(byId.IM02.description).toBe('Slow, spacious piano for a quiet pause');
    expect(byId.none.description).toBe('Continue in silence');
    for (const sound of MEDITATION_SOUNDS) {
      expect(sound.description.toLowerCase()).not.toMatch(/narrat|guided/);
    }
  });
});

describe('getMeditationSoundById / isValidMeditationSoundId', () => {
  it('resolves each of the three real ids', () => {
    expect(getMeditationSoundById('IM01')?.label).toBe('Gentle Ambient');
    expect(getMeditationSoundById('IM02')?.label).toBe('Soft Piano');
    expect(getMeditationSoundById('none')?.label).toBe('No Music');
  });

  it('returns null / false for an unknown id, never throws', () => {
    expect(getMeditationSoundById('IM03')).toBeNull();
    expect(isValidMeditationSoundId('IM03')).toBe(false);
    expect(isValidMeditationSoundId(undefined)).toBe(false);
    expect(isValidMeditationSoundId(null)).toBe(false);
  });
});

describe('SUGGESTED_SOUND_ID_BY_STYLE_ID — every style-to-default mapping', () => {
  it('Quiet Meditation suggests Soft Piano (IM02)', () => {
    expect(getSuggestedSoundIdForStyle('quiet')).toBe('IM02');
  });

  it('Breath Awareness suggests Gentle Ambient (IM01)', () => {
    expect(getSuggestedSoundIdForStyle('breath-awareness')).toBe('IM01');
  });

  it('Mindful Pause suggests Gentle Ambient (IM01)', () => {
    expect(getSuggestedSoundIdForStyle('mindful-pause')).toBe('IM01');
  });

  it('Body Awareness suggests Soft Piano (IM02)', () => {
    expect(getSuggestedSoundIdForStyle('body-awareness')).toBe('IM02');
  });

  it('Loving-Kindness suggests Soft Piano (IM02)', () => {
    expect(getSuggestedSoundIdForStyle('loving-kindness')).toBe('IM02');
  });

  it('every real meditation style id has an entry in the suggestion table - none silently falls through to the fallback', () => {
    for (const style of MEDITATION_STYLES) {
      expect(SUGGESTED_SOUND_ID_BY_STYLE_ID[style.id]).toBeDefined();
      expect(isValidMeditationSoundId(SUGGESTED_SOUND_ID_BY_STYLE_ID[style.id])).toBe(true);
    }
  });

  it('an unknown/invalid style id falls back to Gentle Ambient rather than throwing', () => {
    expect(getSuggestedSoundIdForStyle('not-a-real-style')).toBe('IM01');
    expect(getSuggestedSoundIdForStyle(undefined)).toBe('IM01');
  });
});

describe('toControllerSoundId — UI sentinel -> audio-layer value', () => {
  it('IM01/IM02 pass through unchanged', () => {
    expect(toControllerSoundId('IM01')).toBe('IM01');
    expect(toControllerSoundId('IM02')).toBe('IM02');
  });

  it('"none" and any invalid/missing value all resolve to null - never a track id that was not explicitly validated', () => {
    expect(toControllerSoundId('none')).toBeNull();
    expect(toControllerSoundId(undefined)).toBeNull();
    expect(toControllerSoundId(null)).toBeNull();
    expect(toControllerSoundId('IM03')).toBeNull();
    expect(toControllerSoundId('')).toBeNull();
  });
});

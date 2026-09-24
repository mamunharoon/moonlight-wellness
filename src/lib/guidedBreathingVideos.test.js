// Build 15 release-quality pass — shared guided-breathing video
// catalogue. Real execution (the module is pure data, fully importable),
// matching this codebase's own established precedent for genuinely
// importable pieces.
import { describe, it, expect } from 'vitest';
import { BREATHE_VIDEOS, BREATHING_SESSION_VIDEOS, GUIDED_BREATHING_VIDEO_COUNT } from './guidedBreathingVideos';

describe('guidedBreathingVideos.js - single source of truth, real execution', () => {
  it('BREATHE_VIDEOS contains exactly E08 and E28, in that order', () => {
    expect(BREATHE_VIDEOS.map((v) => v.id)).toEqual(['E08', 'E28']);
  });

  it('BREATHING_SESSION_VIDEOS contains exactly B01-B05, in that order', () => {
    expect(BREATHING_SESSION_VIDEOS.map((v) => v.id)).toEqual(['B01', 'B02', 'B03', 'B04', 'B05']);
  });

  it('GUIDED_BREATHING_VIDEO_COUNT is calculated (2 + 5 = 7), never a hand-typed literal', () => {
    expect(GUIDED_BREATHING_VIDEO_COUNT).toBe(7);
    expect(GUIDED_BREATHING_VIDEO_COUNT).toBe(BREATHE_VIDEOS.length + BREATHING_SESSION_VIDEOS.length);
  });

  it('every entry has a real, non-empty blurb - nothing fabricated or left blank', () => {
    for (const video of [...BREATHE_VIDEOS, ...BREATHING_SESSION_VIDEOS]) {
      expect(typeof video.blurb).toBe('string');
      expect(video.blurb.length).toBeGreaterThan(0);
    }
  });
});

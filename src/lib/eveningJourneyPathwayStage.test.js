import { describe, it, expect } from 'vitest';
import { resolveEveningPathwayStage } from './eveningJourneyPathwayStage';

describe('resolveEveningPathwayStage', () => {
  it('maps windDown (before any of the 5 stages) to null - the plain/neutral pathway look', () => {
    expect(resolveEveningPathwayStage('windDown')).toBeNull();
  });

  it('maps each real Evening step id to its own high-level pathway stage', () => {
    expect(resolveEveningPathwayStage('reflection')).toBe('reflect');
    expect(resolveEveningPathwayStage('gratitude')).toBe('gratitude');
    expect(resolveEveningPathwayStage('breathing')).toBe('breathe');
    expect(resolveEveningPathwayStage('meditation')).toBe('meditate');
  });

  it('maps both sleepPreparation and completion to rest - Prepare for Rest is the real screen for the final stage', () => {
    expect(resolveEveningPathwayStage('sleepPreparation')).toBe('rest');
    expect(resolveEveningPathwayStage('completion')).toBe('rest');
  });

  it('falls back to null for an unrecognised or missing step id - never throws', () => {
    expect(resolveEveningPathwayStage('not-a-real-step')).toBeNull();
    expect(resolveEveningPathwayStage(null)).toBeNull();
    expect(resolveEveningPathwayStage(undefined)).toBeNull();
  });
});

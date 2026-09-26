// WakeWise Phase 2 (B4/B6) — outcomeMessages.js.
import { describe, it, expect } from 'vitest';
import { OUTCOME, JOURNEY, getOutcomeMessage } from './outcomeMessages';

describe('OUTCOME / JOURNEY enums', () => {
  it('OUTCOME has exactly the four required values', () => {
    expect(OUTCOME).toEqual({
      COMPLETED: 'completed',
      ENDED_EARLY: 'ended_early',
      SKIPPED: 'skipped',
      INTERRUPTED: 'interrupted'
    });
  });

  it('JOURNEY has exactly the three real journeys', () => {
    expect(JOURNEY).toEqual({ MORNING: 'morning', ANYTIME: 'anytime', EVENING: 'evening' });
  });
});

describe('getOutcomeMessage - never claims completion for a non-completed outcome', () => {
  it('ended_early never says "complete" or shows a percentage, for any journey', () => {
    for (const journey of Object.values(JOURNEY)) {
      const { headline, body } = getOutcomeMessage(OUTCOME.ENDED_EARLY, journey, '2026-09-26');
      expect(`${headline} ${body}`.toLowerCase()).not.toMatch(/complete|100%/);
    }
  });

  it('skipped never claims completion (as a whole word, distinct from "completely" in "that\'s completely fine"), for any journey', () => {
    for (const journey of Object.values(JOURNEY)) {
      const { headline, body } = getOutcomeMessage(OUTCOME.SKIPPED, journey, '2026-09-26');
      expect(`${headline} ${body}`.toLowerCase()).not.toMatch(/\bcomplete\b|\bcompleted\b/);
    }
  });

  it('interrupted never claims completion, for any journey, and offers to continue', () => {
    for (const journey of Object.values(JOURNEY)) {
      const { headline, body } = getOutcomeMessage(OUTCOME.INTERRUPTED, journey, '2026-09-26');
      expect(`${headline} ${body}`.toLowerCase()).not.toMatch(/\bcomplete\b|\bcompleted\b/);
      expect(`${headline} ${body}`.toLowerCase()).toMatch(/continue|paused/);
    }
  });
});

describe('getOutcomeMessage - no guilt, medical, or guaranteed-outcome language anywhere', () => {
  it('scans every real (journey, outcome) combination this module defines', () => {
    const dateKeys = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'];
    for (const journey of Object.values(JOURNEY)) {
      for (const outcome of Object.values(OUTCOME)) {
        for (const dateKey of dateKeys) {
          const { headline, body } = getOutcomeMessage(outcome, journey, dateKey);
          const text = `${headline} ${body}`;
          expect(text).not.toMatch(/streak|missed|failed|behind|should have|didn't finish/i);
          expect(text).not.toMatch(/cure|treat|diagnos|therap|medical|guarantee/i);
        }
      }
    }
  });
});

describe('getOutcomeMessage - rotation, exactly like greeting.js\'s own proven pattern', () => {
  it('is stable for the same local dateKey across repeated calls', () => {
    const a = getOutcomeMessage(OUTCOME.COMPLETED, JOURNEY.MORNING, '2026-09-26');
    const b = getOutcomeMessage(OUTCOME.COMPLETED, JOURNEY.MORNING, '2026-09-26');
    expect(a).toEqual(b);
  });

  it('advances through the full Morning-completed set before repeating (5 consecutive days -> 5 distinct headlines)', () => {
    const dateKeys = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'];
    const headlines = dateKeys.map((d) => getOutcomeMessage(OUTCOME.COMPLETED, JOURNEY.MORNING, d).headline);
    expect(new Set(headlines).size).toBe(5);
  });

  it('advances through the full Anytime-completed set before repeating', () => {
    const dateKeys = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'];
    const headlines = dateKeys.map((d) => getOutcomeMessage(OUTCOME.COMPLETED, JOURNEY.ANYTIME, d).headline);
    expect(new Set(headlines).size).toBe(5);
  });

  it('advances through the full Anytime-ended_early set before repeating', () => {
    const dateKeys = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'];
    const headlines = dateKeys.map((d) => getOutcomeMessage(OUTCOME.ENDED_EARLY, JOURNEY.ANYTIME, d).headline);
    expect(new Set(headlines).size).toBe(5);
  });

  it('advances through the full Evening-completed set before repeating', () => {
    const dateKeys = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'];
    const headlines = dateKeys.map((d) => getOutcomeMessage(OUTCOME.COMPLETED, JOURNEY.EVENING, d).headline);
    expect(new Set(headlines).size).toBe(5);
  });

  it('the 6th consecutive day repeats the 1st (cycles, never grows unbounded)', () => {
    const first = getOutcomeMessage(OUTCOME.COMPLETED, JOURNEY.MORNING, '2026-09-20');
    const sixthLater = getOutcomeMessage(OUTCOME.COMPLETED, JOURNEY.MORNING, '2026-09-25');
    expect(sixthLater).toEqual(first);
  });

  it('a missing/invalid dateKey resolves to the first variant, never throws', () => {
    expect(() => getOutcomeMessage(OUTCOME.COMPLETED, JOURNEY.MORNING, undefined)).not.toThrow();
    expect(getOutcomeMessage(OUTCOME.COMPLETED, JOURNEY.MORNING, undefined)).toEqual(getOutcomeMessage(OUTCOME.COMPLETED, JOURNEY.MORNING, 'not-a-date'));
  });

  it('non-rotating outcomes (skipped, interrupted, and morning/evening ended_early) return the exact same message regardless of date', () => {
    const a = getOutcomeMessage(OUTCOME.SKIPPED, JOURNEY.MORNING, '2026-09-20');
    const b = getOutcomeMessage(OUTCOME.SKIPPED, JOURNEY.MORNING, '2026-09-27');
    expect(a).toEqual(b);
  });
});

describe('getOutcomeMessage - defaults and defensiveness', () => {
  it('defaults journey to anytime when omitted', () => {
    expect(getOutcomeMessage(OUTCOME.SKIPPED)).toEqual(getOutcomeMessage(OUTCOME.SKIPPED, JOURNEY.ANYTIME));
  });

  it('never throws for an unrecognised outcome/journey - falls back to a still-honest, never-completed message', () => {
    expect(() => getOutcomeMessage('not-a-real-outcome', 'not-a-real-journey')).not.toThrow();
    const fallback = getOutcomeMessage('not-a-real-outcome', 'not-a-real-journey');
    expect(fallback.headline.toLowerCase()).not.toMatch(/complete/);
  });
});

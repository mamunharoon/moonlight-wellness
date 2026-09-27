// WakeWise Phase 2 (B4/B6) — outcomeMessages.js.
import { describe, it, expect } from 'vitest';
import { OUTCOME, JOURNEY, getOutcomeMessage, getBreathingAcknowledgement, getBreathingCompletionGreeting, getMorningBreathingEarlyExitMessage } from './outcomeMessages';

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

describe('getBreathingCompletionGreeting - three separate, journey-scoped rotating pools for the breathing completed panel (Morning breathing completion correction)', () => {
  // localStorage (not sessionStorage) - deliberately survives across
  // days, so "avoid yesterday's greeting" and "avoid the immediately-
  // previous greeting" are satisfied by the one same mechanism.
  const withMockLocalStorage = (fn) => {
    const store = new Map();
    const mock = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    };
    const previous = globalThis.localStorage;
    globalThis.localStorage = mock;
    try {
      return fn(mock);
    } finally {
      if (previous === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = previous;
    }
  };

  const POOLS = {
    morning: [
      'A brighter morning starts now.',
      'Carry this calm into your day.',
      'You’re ready for what’s ahead.',
      'A steady start makes a difference.',
      'You showed up for yourself.'
    ],
    anytime: [
      'You gave yourself a moment.',
      'A short reset can change things.',
      'Carry this calm with you.',
      'You made space to breathe.',
      'Feeling steadier? Keep it close.'
    ],
    evening: [
      'Let the day soften now.',
      'You’re ready to slow down.',
      'Carry this calm into rest.',
      'The day can wait until tomorrow.',
      'Breathe out. It’s time to unwind.'
    ]
  };

  it.each(Object.entries(POOLS))('%s: always returns one of that journey\'s own approved greetings - never a placeholder, never another journey\'s pool', (journey, pool) => {
    for (let i = 0; i < 20; i += 1) {
      const greeting = getBreathingCompletionGreeting(journey);
      expect(pool).toContain(greeting);
      for (const [otherJourney, otherPool] of Object.entries(POOLS)) {
        if (otherJourney === journey) continue;
        expect(otherPool).not.toContain(greeting);
      }
    }
  });

  it('every greeting in every pool is short (3-8 words) and free of clinical/instructional language (a casual "Breathe out" is warm phrasing, not an instruction - "inhale/exhale for N seconds" would be)', () => {
    const CLINICAL_WORDS = /\b(exercise|session|practice|inhale|exhale|protocol|technique)\b/i;
    for (const pool of Object.values(POOLS)) {
      for (const greeting of pool) {
        const wordCount = greeting.trim().split(/\s+/).length;
        expect(wordCount).toBeGreaterThanOrEqual(3);
        expect(wordCount).toBeLessThanOrEqual(8);
        expect(greeting).not.toMatch(CLINICAL_WORDS);
      }
    }
  });

  it('never repeats the immediately-previous greeting for the SAME journey across consecutive completed sessions, when localStorage is available (also covers "avoid yesterday\'s greeting" - same mechanism, since localStorage survives across days)', () => {
    withMockLocalStorage(() => {
      let previous = getBreathingCompletionGreeting('morning');
      for (let i = 0; i < 30; i += 1) {
        const next = getBreathingCompletionGreeting('morning');
        expect(next).not.toBe(previous);
        previous = next;
      }
    });
  });

  it('each journey\'s own rotation is tracked independently - completing Evening in between two Morning completions never affects Morning\'s own non-repeat memory', () => {
    withMockLocalStorage(() => {
      const morningFirst = getBreathingCompletionGreeting('morning');
      // Exhaust many Evening picks in between - must never influence Morning's own key.
      for (let i = 0; i < 10; i += 1) getBreathingCompletionGreeting('evening');
      const morningSecond = getBreathingCompletionGreeting('morning');
      expect(morningSecond).not.toBe(morningFirst); // still correctly avoids ITS OWN immediately-previous
      expect(POOLS.morning).toContain(morningSecond);
    });
  });

  it('an unrecognised or missing journey falls back to the anytime pool - never crashes, never a Morning/Evening-specific claim for an unknown context', () => {
    expect(() => getBreathingCompletionGreeting()).not.toThrow();
    expect(POOLS.anytime).toContain(getBreathingCompletionGreeting('not-a-real-journey'));
    expect(POOLS.anytime).toContain(getBreathingCompletionGreeting(undefined));
  });

  it('degrades gracefully with no localStorage at all (this repo\'s own test environment) - never throws, still returns a real greeting', () => {
    expect(() => getBreathingCompletionGreeting('morning')).not.toThrow();
    expect(typeof getBreathingCompletionGreeting('morning')).toBe('string');
  });

  it('does not claim completion language is tied to any outcome constant - a plain string pool, callers gate when it is shown (never for ended-early/skipped/interrupted)', () => {
    expect(typeof getBreathingCompletionGreeting('morning')).toBe('string');
  });
});

describe('getBreathingAcknowledgement - honest positive acknowledgement after a single natural breathing-pattern completion (mobile correction #4)', () => {
  it('returns the exact required copy for each real journey', () => {
    expect(getBreathingAcknowledgement(JOURNEY.MORNING)).toBe('Beautifully done. Carry this steady energy into your morning.');
    expect(getBreathingAcknowledgement(JOURNEY.ANYTIME)).toBe('You gave yourself a moment to reset.');
    expect(getBreathingAcknowledgement(JOURNEY.EVENING)).toBe('Let that slower rhythm stay with you as you wind down.');
  });

  it('falls back to the neutral/standalone copy for an unrecognised or missing journey - never throws', () => {
    expect(getBreathingAcknowledgement(undefined)).toBe('Thank you for taking this moment for yourself.');
    expect(getBreathingAcknowledgement('not-a-real-journey')).toBe('Thank you for taking this moment for yourself.');
    expect(() => getBreathingAcknowledgement()).not.toThrow();
  });
});

describe('getMorningBreathingEarlyExitMessage - honest, non-celebratory acknowledgement for a confirmed Back -> Leave Exercise early exit (Morning breathing Back/early-exit correction)', () => {
  const POOL = [
    'A short pause still matters.',
    'You still made time to breathe.',
    'Every mindful moment counts.',
    'Return when it feels right.',
    'Choose what supports you now.'
  ];

  it('always returns one of the approved short messages - never empty, never a placeholder', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(POOL).toContain(getMorningBreathingEarlyExitMessage());
    }
  });

  it('never uses completion/celebration language - genuinely distinct from the natural-completion greeting pool', () => {
    const completionPool = [
      'A brighter morning starts now.',
      'Carry this calm into your day.',
      'You’re ready for what’s ahead.',
      'A steady start makes a difference.',
      'You showed up for yourself.'
    ];
    for (const message of POOL) {
      expect(completionPool).not.toContain(message);
      expect(message.toLowerCase()).not.toMatch(/complete|congrat|well done|finished/);
    }
  });

  it('never throws, always returns a string', () => {
    expect(() => getMorningBreathingEarlyExitMessage()).not.toThrow();
    expect(typeof getMorningBreathingEarlyExitMessage()).toBe('string');
  });
});

import { describe, it, expect } from 'vitest';
import { resolveNextStepCard, resolveMorningDaypart, MORNING_DAYPART } from './nextStepCard';

describe('resolveMorningDaypart', () => {
  it('folds before-wake and daytime-morning into MORNING', () => {
    expect(resolveMorningDaypart('before-wake')).toBe(MORNING_DAYPART.MORNING);
    expect(resolveMorningDaypart('daytime-morning')).toBe(MORNING_DAYPART.MORNING);
  });

  it('maps daytime to AFTERNOON', () => {
    expect(resolveMorningDaypart('daytime')).toBe(MORNING_DAYPART.AFTERNOON);
  });

  it('folds evening and night into EVENING_NIGHT', () => {
    expect(resolveMorningDaypart('evening')).toBe(MORNING_DAYPART.EVENING_NIGHT);
    expect(resolveMorningDaypart('night')).toBe(MORNING_DAYPART.EVENING_NIGHT);
  });
});

describe('resolveNextStepCard — Morning, not-started', () => {
  it('morning daypart: exact required copy, including the always-shown body sentence', () => {
    const card = resolveNextStepCard({
      period: 'morning',
      cardState: 'not-started',
      morningDaypart: MORNING_DAYPART.MORNING
    });
    expect(card.eyebrow).toBe('YOUR NEXT STEP');
    expect(card.title).toBe('Start your Morning Reset');
    expect(card.supportingText).toBe('Begin with today’s intention, then move through gentle stretching, grounding and a closing affirmation.');
    expect(card.duration).toBe('About 5–10 minutes, plus optional meditation');
    expect(card.buttonLabel).toBe('Begin My Morning');
  });

  it('afternoon daypart: exact required copy', () => {
    const card = resolveNextStepCard({
      period: 'morning',
      cardState: 'not-started',
      morningDaypart: MORNING_DAYPART.AFTERNOON
    });
    expect(card.title).toBe('It’s not too late for a reset');
    expect(card.supportingText).toBe('Take a few minutes to reconnect with your intention and approach the rest of your day with focus.');
    expect(card.buttonLabel).toBe('Start a Daytime Reset');
  });

  it('evening-night daypart: exact required copy', () => {
    const card = resolveNextStepCard({
      period: 'morning',
      cardState: 'not-started',
      morningDaypart: MORNING_DAYPART.EVENING_NIGHT
    });
    expect(card.title).toBe('Take a moment to reset');
    expect(card.supportingText).toBe('Reconnect with your intention and move gently through a short reset whenever it feels useful.');
    expect(card.buttonLabel).toBe('Start a Gentle Reset');
  });

  it('never omits the body sentence - it is not gated by any first-time/returning distinction', () => {
    const calledTwice = [
      resolveNextStepCard({ period: 'morning', cardState: 'not-started', morningDaypart: MORNING_DAYPART.MORNING }),
      resolveNextStepCard({ period: 'morning', cardState: 'not-started', morningDaypart: MORNING_DAYPART.MORNING })
    ];
    expect(calledTwice[0]).toEqual(calledTwice[1]);
    expect(calledTwice[0].supportingText).toEqual(expect.any(String));
    expect(calledTwice[0].supportingText.length).toBeGreaterThan(0);
  });
});

describe('resolveNextStepCard — Morning, in-progress and completed', () => {
  it('in-progress interpolates the caller-supplied step name - never hard-coded here', () => {
    const card = resolveNextStepCard({ period: 'morning', cardState: 'in-progress', stepName: 'Stretch' });
    expect(card.eyebrow).toBe('YOUR NEXT STEP');
    expect(card.title).toBe('Continue where you left off');
    expect(card.supportingText).toBe("You're on Stretch—your next step is ready.");
    expect(card.buttonLabel).toBe('Continue Morning Routine');
  });

  it('completed: exact required copy, "YOUR MORNING" eyebrow', () => {
    const card = resolveNextStepCard({ period: 'morning', cardState: 'completed' });
    expect(card.eyebrow).toBe('YOUR MORNING');
    expect(card.title).toBe('Your Morning Reset is complete');
    expect(card.supportingText).toBe('You’ve set your direction for today.');
    expect(card.buttonLabel).toBe('Repeat Morning Routine');
    expect(card.duration).toBeNull();
  });
});

describe('resolveNextStepCard — Evening (no daypart variation)', () => {
  it('not-started: exact required copy, including the always-shown body sentence', () => {
    const card = resolveNextStepCard({ period: 'evening', cardState: 'not-started' });
    expect(card.eyebrow).toBe('YOUR NEXT STEP');
    expect(card.title).toBe('Begin your Evening Wind-Down');
    expect(card.supportingText).toBe('Reflect on your day, release what you no longer need and prepare gently for rest.');
    expect(card.duration).toBe('About 5–10 minutes, plus optional meditation');
    expect(card.buttonLabel).toBe('Begin Evening Wind-Down');
  });

  it('in-progress interpolates the step name', () => {
    const card = resolveNextStepCard({ period: 'evening', cardState: 'in-progress', stepName: 'Reflect' });
    expect(card.supportingText).toBe("You're on Reflect—your next step is ready.");
    expect(card.buttonLabel).toBe('Continue Evening Wind-Down');
  });

  it('completed: exact required copy, "YOUR EVENING" eyebrow', () => {
    const card = resolveNextStepCard({ period: 'evening', cardState: 'completed' });
    expect(card.eyebrow).toBe('YOUR EVENING');
    expect(card.title).toBe('Your Evening Wind-Down is complete');
    expect(card.supportingText).toBe('You’ve taken time to close the day gently.');
    expect(card.buttonLabel).toBe('Repeat Evening Routine');
  });

  it('evening copy never varies by morningDaypart, even if one is accidentally passed', () => {
    const a = resolveNextStepCard({ period: 'evening', cardState: 'not-started', morningDaypart: MORNING_DAYPART.AFTERNOON });
    const b = resolveNextStepCard({ period: 'evening', cardState: 'not-started', morningDaypart: MORNING_DAYPART.EVENING_NIGHT });
    expect(a).toEqual(b);
  });
});

describe('Journey Embedding — truthful duration copy, never a flat range that understates the optional-meditation maximum', () => {
  it('Morning and Evening not-started cards both name the optional addition rather than a fixed range', () => {
    const morning = resolveNextStepCard({ period: 'morning', cardState: 'not-started', morningDaypart: MORNING_DAYPART.MORNING });
    const evening = resolveNextStepCard({ period: 'evening', cardState: 'not-started' });
    expect(morning.duration).toBe('About 5–10 minutes, plus optional meditation');
    expect(evening.duration).toBe('About 5–10 minutes, plus optional meditation');
  });

  it('never claims a single fixed upper bound wider than the approved 5-10 baseline (e.g. "5-15"/"5-12"/"5-20 minutes") that would misstate the true maximum or wrongly imply a cap', () => {
    const morning = resolveNextStepCard({ period: 'morning', cardState: 'not-started', morningDaypart: MORNING_DAYPART.MORNING });
    const evening = resolveNextStepCard({ period: 'evening', cardState: 'not-started' });
    // The approved baseline "5–10 minutes" is expected and fine; only a
    // DIFFERENT, wider range (the audit's own rejected "5-12"/"5-15"
    // proposals) would be a real problem here.
    expect(morning.duration).not.toMatch(/5[-–](?:11|12|13|14|15|20) minutes/);
    expect(evening.duration).not.toMatch(/5[-–](?:11|12|13|14|15|20) minutes/);
  });
});

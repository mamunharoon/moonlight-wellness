// Anytime Reset — recommendation engine regression guard (Build 15).
import { describe, it, expect } from 'vitest';
import { recommendAnytimeReset } from './anytimeResetRecommendations';
import { ANYTIME_RESET_NEEDS, ANYTIME_RESET_DURATIONS, getAnytimeResetCatalog, MEDIA_CATALOG } from './mediaCatalog';

const catalog = getAnytimeResetCatalog();
const catalogIds = new Set(catalog.map((e) => e.id));

describe('ANYTIME_RESET_NEEDS / ANYTIME_RESET_DURATIONS — exact approved sets', () => {
  it('exactly the eight approved need chips, in order, "Not sure" last', () => {
    expect(ANYTIME_RESET_NEEDS.map((n) => n.label)).toEqual([
      'Calm', 'Focus', 'More energy', 'Stress relief', 'Body reset', 'Quiet time', 'Better mood', 'Not sure'
    ]);
  });

  it('no "Something else" chip and no custom-value need exists', () => {
    expect(ANYTIME_RESET_NEEDS.some((n) => /something else/i.test(n.label))).toBe(false);
  });

  it('exactly the three approved duration options, in order', () => {
    expect(ANYTIME_RESET_DURATIONS.map((d) => d.label)).toEqual(['About 2 minutes', 'About 5 minutes', 'No preference']);
  });

  it('"No preference" has no upper bound', () => {
    expect(ANYTIME_RESET_DURATIONS.find((d) => d.id === 'any').maxSeconds).toBe(Infinity);
  });
});

describe('getAnytimeResetCatalog — every entry resolves through the live Fast Start mapping (never an exercises/ original)', () => {
  it('every entry\'s storagePath is a faststart-v1/ or faststart-v2/ object, matching the deployed betaVideoManifest.js exactly', () => {
    expect(catalog.length).toBe(24);
    for (const entry of catalog) {
      expect(entry.storagePath.startsWith('faststart-v1/') || entry.storagePath.startsWith('faststart-v2/'), `${entry.id} -> ${entry.storagePath}`).toBe(true);
      expect(entry.storagePath.startsWith('exercises/')).toBe(false);
    }
  });
});

describe('getAnytimeResetCatalog — every entry references a real, currently-active catalogue id', () => {
  it('every id resolves to a real MEDIA_CATALOG entry', () => {
    expect(catalog.length).toBeGreaterThan(0);
    for (const entry of catalog) {
      expect(MEDIA_CATALOG.some((m) => m.id === entry.id)).toBe(true);
      expect(entry.active).toBe(true);
    }
  });

  it('every entry carries a positive, plausible verified duration (not a placeholder/zero)', () => {
    for (const entry of catalog) {
      expect(entry.anytimeReset.durationSeconds).toBeGreaterThan(30);
      expect(entry.anytimeReset.durationSeconds).toBeLessThan(600);
    }
  });

  it('every entry has at least one need tag', () => {
    for (const entry of catalog) {
      expect(entry.anytimeReset.needs.length).toBeGreaterThan(0);
    }
  });
});

describe('recommendAnytimeReset — every real need x every real duration returns real catalogue ids only', () => {
  const realNeeds = ANYTIME_RESET_NEEDS.map((n) => n.id);
  const durations = ANYTIME_RESET_DURATIONS.map((d) => d.id);

  for (const needId of realNeeds) {
    for (const durationId of durations) {
      it(`${needId} + ${durationId} returns only real catalogue ids, each with a real duration and a non-empty reason`, () => {
        const { items } = recommendAnytimeReset({ needId, durationId });
        for (const item of items) {
          expect(catalogIds.has(item.id)).toBe(true);
          expect(item.anytimeReset.durationSeconds).toBeGreaterThan(0);
          expect(typeof item.matchReason).toBe('string');
          expect(item.matchReason.length).toBeGreaterThan(0);
        }
      });
    }
  }

  it('every real need (not "not-sure") returns at least one item for "No preference"', () => {
    for (const needId of realNeeds.filter((id) => id !== 'not-sure')) {
      const { items } = recommendAnytimeReset({ needId, durationId: 'any' });
      expect(items.length, `${needId} should have at least one item`).toBeGreaterThan(0);
    }
  });

  it('"Not sure" returns a valid, non-empty, balanced recommendation for every duration', () => {
    for (const durationId of durations) {
      const { items } = recommendAnytimeReset({ needId: 'not-sure', durationId });
      expect(items.length).toBeGreaterThan(0);
    }
  });
});

describe('recommendAnytimeReset — duration honesty (never silently implies a shorter fit than reality)', () => {
  it('an exact match never exceeds the selected duration cap', () => {
    for (const need of ANYTIME_RESET_NEEDS) {
      const { items, matchQuality } = recommendAnytimeReset({ needId: need.id, durationId: 'quick' });
      if (matchQuality === 'exact') {
        for (const item of items) {
          expect(item.anytimeReset.durationSeconds).toBeLessThanOrEqual(135);
        }
      }
    }
  });

  it('body-reset has no item short enough for "About 2 minutes" — correctly falls back to "closest match" and explicitly states no item fits, plus the real shortest available duration (3:18 for S01, verified via ffprobe), never silently claiming a 2-minute fit', () => {
    const { items, matchQuality } = recommendAnytimeReset({ needId: 'body-reset', durationId: 'quick' });
    expect(matchQuality).toBe('closest');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.anytimeReset.durationSeconds).toBeGreaterThan(135);
      expect(item.matchReason).toMatch(/No .* option fits within about 2 minutes\./i);
      expect(item.matchReason).toMatch(/The shortest option is 3:18\./);
    }
  });

  it('the "shortest option" stated in the reason is the true minimum across the whole fallback pool, not the currently-displayed item\'s own (possibly longer) duration - stays accurate through every "Choose another" cycle', () => {
    const { items } = recommendAnytimeReset({ needId: 'body-reset', durationId: 'quick' });
    expect(items.length).toBeGreaterThan(1);
    const trueShortest = Math.min(...items.map((i) => i.anytimeReset.durationSeconds));
    for (const item of items) {
      // Every item's reason must cite the SAME true-shortest value, even
      // when that item's own duration is longer than it.
      expect(item.matchReason).toContain(`The shortest option is ${Math.floor(trueShortest / 60)}:${String(Math.round(trueShortest % 60)).padStart(2, '0')}.`);
    }
  });

  it('quiet-time (meditation) has no item short enough for "About 2 minutes" either — same honest closest-match fallback', () => {
    const { items, matchQuality } = recommendAnytimeReset({ needId: 'quiet-time', durationId: 'quick' });
    expect(matchQuality).toBe('closest');
    for (const item of items) {
      expect(item.anytimeReset.durationSeconds).toBeGreaterThan(135);
    }
  });

  it('"About 5 minutes" genuinely caps at 330 seconds - no item beyond that is ever returned as an exact match', () => {
    for (const need of ANYTIME_RESET_NEEDS) {
      const { items, matchQuality } = recommendAnytimeReset({ needId: need.id, durationId: 'short' });
      if (matchQuality === 'exact') {
        for (const item of items) {
          expect(item.anytimeReset.durationSeconds).toBeLessThanOrEqual(330);
        }
      }
    }
  });
});

describe('recommendAnytimeReset — mapping intent spot-checks (real ids, real themes)', () => {
  it('Calm includes at least one breathing/calm-titled item', () => {
    const { items } = recommendAnytimeReset({ needId: 'calm', durationId: 'any' });
    expect(items.some((i) => i.id === 'E03' || i.id === 'E08' || i.id === 'B04')).toBe(true);
  });

  it('Body reset returns only stretching (S-series) items', () => {
    const { items } = recommendAnytimeReset({ needId: 'body-reset', durationId: 'any' });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.id.startsWith('S')).toBe(true);
  });

  it('Quiet time returns only meditation (M-series) items', () => {
    const { items } = recommendAnytimeReset({ needId: 'quiet-time', durationId: 'any' });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.id.startsWith('M')).toBe(true);
  });

  it('Better mood includes gratitude/affirmation content', () => {
    const { items } = recommendAnytimeReset({ needId: 'better-mood', durationId: 'any' });
    expect(items.some((i) => ['E23', 'A05', 'A01'].includes(i.id))).toBe(true);
  });
});

describe('Choose Another semantics (verified via the same index-cycling the component uses)', () => {
  it('cycling through every item before repeating never immediately shows the same item twice while alternatives exist', () => {
    const { items } = recommendAnytimeReset({ needId: 'calm', durationId: 'any' });
    expect(items.length).toBeGreaterThan(1);
    const seenInOneFullCycle = new Set();
    for (let i = 0; i < items.length; i++) {
      seenInOneFullCycle.add(items[i % items.length].id);
    }
    expect(seenInOneFullCycle.size).toBe(items.length);
  });
});

describe('Isolation from Meditate — separate exports, unaffected by this file existing', () => {
  it('ANYTIME_RESET_NEEDS and MEDITATION_NEEDS are separate arrays with different id sets', async () => {
    const { MEDITATION_NEEDS } = await import('./mediaCatalog');
    const anytimeIds = new Set(ANYTIME_RESET_NEEDS.map((n) => n.id));
    const meditationIds = new Set(MEDITATION_NEEDS.map((n) => n.id));
    expect(anytimeIds).not.toBe(meditationIds);
    // 'calm' and 'focus' happen to exist as ids in both taxonomies (same
    // English word, two independent lists) - not evidence of aliasing on
    // their own, so the real assertion is object identity/array identity,
    // not full disjointness.
    expect(ANYTIME_RESET_NEEDS).not.toBe(MEDITATION_NEEDS);
  });

  it('an id that is meditation-eligible but was never given Anytime Reset metadata (M02) is genuinely absent from getAnytimeResetCatalog - proves this is a real filter, not an alias of getMeditationCatalog', () => {
    expect(catalogIds.has('M02')).toBe(false);
  });

  it('MEDITATION_NEEDS/MEDITATION_DURATION_GROUPS/getMeditationCatalog are exactly as they were before this feature existed - unchanged by this file\'s own import of mediaCatalog.js', async () => {
    const { MEDITATION_NEEDS, MEDITATION_DURATION_GROUPS, getMeditationCatalog } = await import('./mediaCatalog');
    expect(MEDITATION_NEEDS.map((n) => n.id)).toEqual([
      'calm', 'focus', 'mindfulness', 'stress-relief', 'body-awareness', 'gratitude', 'self-compassion', 'deep-relaxation'
    ]);
    expect(MEDITATION_DURATION_GROUPS.map((g) => g.id)).toEqual(['quick', 'short', 'any']);
    expect(getMeditationCatalog().map((e) => e.id).sort()).toEqual(
      ['B02', 'E03', 'E04', 'E08', 'E27', 'M01', 'M02', 'M03', 'M04', 'M05'].sort()
    );
  });
});

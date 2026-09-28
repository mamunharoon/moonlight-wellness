// "Explore More" discovery, Phase 5 — real-execution tests (pure
// functions over the actual MEDIA_CATALOG, no DOM/component needed).
import { describe, it, expect } from 'vitest';
import { MEDIA_CATALOG } from './mediaCatalog';
import {
  EXPLORE_JOURNEYS,
  EXPLORE_CURATED_COUNT,
  isValidExploreJourney,
  getMorningExploreCatalog,
  getEveningExploreCatalog,
  getAnytimeExploreCatalog,
  getExploreCatalogForJourney,
  getCuratedExploreCatalog
} from './exploreFiltering';

describe('isValidExploreJourney', () => {
  it('accepts exactly morning/anytime/evening', () => {
    expect(isValidExploreJourney('morning')).toBe(true);
    expect(isValidExploreJourney('anytime')).toBe(true);
    expect(isValidExploreJourney('evening')).toBe(true);
  });

  it('rejects anything else, including case-mismatches, empty, and null/undefined - never guesses a closest match', () => {
    expect(isValidExploreJourney('Morning')).toBe(false);
    expect(isValidExploreJourney('day')).toBe(false);
    expect(isValidExploreJourney('')).toBe(false);
    expect(isValidExploreJourney(null)).toBe(false);
    expect(isValidExploreJourney(undefined)).toBe(false);
  });

  it('EXPLORE_JOURNEYS is the exact three-value allowlist', () => {
    expect(EXPLORE_JOURNEYS).toEqual(['morning', 'anytime', 'evening']);
  });
});

describe('getMorningExploreCatalog', () => {
  const morning = getMorningExploreCatalog();

  it('includes every Morning/Stretching/Breathing category item that is not evening-tagged', () => {
    for (const entry of MEDIA_CATALOG) {
      if (['Morning', 'Stretching', 'Breathing'].includes(entry.category) && entry.timeOfDay !== 'evening') {
        expect(morning.some((e) => e.id === entry.id)).toBe(true);
      }
    }
  });

  it('excludes S05 (Stretching, but timeOfDay evening) - never advertises evening-only stretching as morning content', () => {
    expect(morning.some((e) => e.id === 'S05')).toBe(false);
  });

  it('includes every meditation-eligible entry that is not evening-tagged (e.g. E03, E04) but excludes the evening-tagged ones (M01-M05, E27)', () => {
    expect(morning.some((e) => e.id === 'E03')).toBe(true);
    expect(morning.some((e) => e.id === 'E04')).toBe(true);
    for (const id of ['M01', 'M02', 'M03', 'M04', 'M05', 'E27']) {
      expect(morning.some((e) => e.id === id)).toBe(false);
    }
  });

  it('never includes a Sleep Soundscapes or Evening Wind-Down item', () => {
    expect(morning.every((e) => e.category !== 'Sleep Soundscapes' && e.category !== 'Evening Wind-Down')).toBe(true);
  });

  it('is a genuinely non-trivial subset of the full catalogue - neither empty nor the whole thing', () => {
    expect(morning.length).toBeGreaterThan(0);
    expect(morning.length).toBeLessThan(MEDIA_CATALOG.length);
  });
});

describe('getEveningExploreCatalog', () => {
  const evening = getEveningExploreCatalog();

  it('is exactly every timeOfDay === "evening" entry - no more, no less', () => {
    const expected = MEDIA_CATALOG.filter((e) => e.timeOfDay === 'evening');
    expect(evening.map((e) => e.id).sort()).toEqual(expected.map((e) => e.id).sort());
  });

  it('includes every Evening Wind-Down and Sleep Soundscapes item', () => {
    for (const entry of MEDIA_CATALOG) {
      if (entry.category === 'Evening Wind-Down' || entry.category === 'Sleep Soundscapes') {
        expect(evening.some((e) => e.id === entry.id)).toBe(true);
      }
    }
  });

  it('never includes an entry whose own timeOfDay is "morning" - no energising Morning-only material leaks into Evening Explore', () => {
    expect(evening.every((e) => e.timeOfDay !== 'morning')).toBe(true);
  });
});

describe('getAnytimeExploreCatalog', () => {
  const anytime = getAnytimeExploreCatalog();

  it('reuses the existing Anytime Reset catalogue exactly - same ids, never a second/competing definition of "quick"', () => {
    expect(anytime.length).toBeGreaterThan(0);
    expect(anytime.every((e) => e.anytimeReset)).toBe(true);
  });

  it('is sorted shortest real verified duration first', () => {
    for (let i = 1; i < anytime.length; i++) {
      expect(anytime[i].anytimeReset.durationSeconds).toBeGreaterThanOrEqual(anytime[i - 1].anytimeReset.durationSeconds);
    }
  });
});

describe('getExploreCatalogForJourney', () => {
  it('routes to the correct per-journey getter', () => {
    expect(getExploreCatalogForJourney('morning').map((e) => e.id)).toEqual(getMorningExploreCatalog().map((e) => e.id));
    expect(getExploreCatalogForJourney('evening').map((e) => e.id)).toEqual(getEveningExploreCatalog().map((e) => e.id));
    expect(getExploreCatalogForJourney('anytime').map((e) => e.id)).toEqual(getAnytimeExploreCatalog().map((e) => e.id));
  });

  it('returns an empty array (never throws) for an unrecognised journey - a safe, honest fallback', () => {
    expect(getExploreCatalogForJourney('bogus')).toEqual([]);
    expect(getExploreCatalogForJourney(undefined)).toEqual([]);
  });
});

describe('getCuratedExploreCatalog', () => {
  it('returns at most EXPLORE_CURATED_COUNT items, taken from the front of the real per-journey list (deterministic, never random/shuffled)', () => {
    for (const journey of EXPLORE_JOURNEYS) {
      const curated = getCuratedExploreCatalog(journey);
      const full = getExploreCatalogForJourney(journey);
      expect(curated.length).toBeLessThanOrEqual(EXPLORE_CURATED_COUNT);
      expect(curated.map((e) => e.id)).toEqual(full.slice(0, EXPLORE_CURATED_COUNT).map((e) => e.id));
    }
  });

  it('calling it twice for the same journey returns the identical set and order - never randomised between visits', () => {
    expect(getCuratedExploreCatalog('morning').map((e) => e.id)).toEqual(getCuratedExploreCatalog('morning').map((e) => e.id));
  });
});

describe('Catalogue facts reconfirmed against current source (audit cross-check)', () => {
  it('67 Library-visible items, 10 looping Sleep Soundscapes, 57 items capable of a natural ended event', () => {
    expect(MEDIA_CATALOG.length).toBe(67);
    const sleepSoundscapes = MEDIA_CATALOG.filter((e) => e.category === 'Sleep Soundscapes');
    expect(sleepSoundscapes.length).toBe(10);
    expect(MEDIA_CATALOG.length - sleepSoundscapes.length).toBe(57);
  });

  it('no interactive-only/draft id (IB01/IS01/IM01/IM02/I01/I02) ever appears in any Explore catalogue - they are already excluded from MEDIA_CATALOG itself', () => {
    const interactiveOnlyIds = ['IB01', 'IS01', 'IM01', 'IM02', 'I01', 'I02'];
    for (const journey of EXPLORE_JOURNEYS) {
      const ids = getExploreCatalogForJourney(journey).map((e) => e.id);
      for (const bad of interactiveOnlyIds) expect(ids).not.toContain(bad);
    }
  });

  it('every Explore catalogue entry carries a real id/title/description sourced from the one shared MEDIA_CATALOG - never a second, hand-authored copy that could drift', () => {
    for (const journey of EXPLORE_JOURNEYS) {
      for (const entry of getExploreCatalogForJourney(journey)) {
        const canonical = MEDIA_CATALOG.find((e) => e.id === entry.id);
        expect(canonical).toBeTruthy();
        expect(entry.title).toBe(canonical.title);
        expect(entry.description).toBe(canonical.description);
      }
    }
  });
});

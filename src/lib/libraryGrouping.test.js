// Regression guard for the 2026-10-22 defect report: "GR01-GR03 do not
// appear in the deployed Library." This exercises the REAL data path —
// the actual MEDIA_CATALOG/CATALOG_CATEGORIES built from source, run
// through the exact groupLibraryItems() function Library.jsx itself calls
// inside its itemsByCategory useMemo (see Library.jsx) — not a source-text
// pattern match (this repo's Vitest has no DOM rendering capability; see
// libraryCategoryNavigation.test.js's own header comment) and not a
// hand-copied reimplementation of the grouping logic that could silently
// drift from what Library.jsx actually runs.
import { describe, it, expect } from 'vitest';
import { CATALOG_CATEGORIES, MEDIA_CATALOG } from './mediaCatalog';
import { groupLibraryItems } from './libraryGrouping';

const GR_IDS = ['GR01', 'GR02', 'GR03'];

describe('GR01-GR03 are present in the real catalogue with the expected shape', () => {
  it('all three exist in MEDIA_CATALOG, categorised under Gratitude & Reflection, not marked unavailable', () => {
    for (const id of GR_IDS) {
      const entry = MEDIA_CATALOG.find((e) => e.id === id);
      expect(entry, `${id} missing from MEDIA_CATALOG`).toBeTruthy();
      expect(entry.category).toBe('Gratitude & Reflection');
      expect(entry.active).not.toBe(false);
    }
  });
});

describe('a plain, unfiltered /library visit renders GR01-GR03 in the Gratitude & Reflection group', () => {
  // The exact params a direct/bottom-nav Library visit uses: no search
  // query typed, no ?journey= deep link active (journeyPool null).
  const grouped = groupLibraryItems(MEDIA_CATALOG, CATALOG_CATEGORIES, { query: '', journeyPool: null });

  it('the Gratitude & Reflection bucket contains all three new ids alongside their existing siblings', () => {
    const ids = grouped['Gratitude & Reflection'].map((e) => e.id);
    for (const id of GR_IDS) {
      expect(ids, `${id} not in the rendered Gratitude & Reflection group`).toContain(id);
    }
    // Existing siblings this category already rendered before this
    // content addition — if these disappeared too, the defect is
    // category-wide, not specific to the three new ids.
    for (const siblingId of ['A02', 'A03', 'A05']) {
      expect(ids).toContain(siblingId);
    }
  });

  it('every other category is untouched by this addition (same length as a catalogue search would show)', () => {
    for (const category of CATALOG_CATEGORIES) {
      if (category === 'Gratitude & Reflection') continue;
      expect(grouped[category].every((e) => !GR_IDS.includes(e.id))).toBe(true);
    }
  });
});

describe('a search query that matches a GR title/description still surfaces it (matchesQuery is not accidentally excluding these ids)', () => {
  it('"gratitude through uncertainty" finds GR02 specifically', () => {
    const grouped = groupLibraryItems(MEDIA_CATALOG, CATALOG_CATEGORIES, { query: 'gratitude through uncertainty', journeyPool: null });
    const ids = grouped['Gratitude & Reflection'].map((e) => e.id);
    expect(ids).toEqual(['GR02']);
  });
});

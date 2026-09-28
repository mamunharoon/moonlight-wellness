// "Explore More" discovery, Phase 5 — source-level regression guard for
// Library.jsx's new journey-aware filtering/progressive-disclosure/origin
// behaviour (journey/from=anytime-recommend). libraryHomeReturnContext.test.js
// already covers the pre-existing FROM_CONTEXTS allowlist in depth; this
// file covers only what's new.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const librarySource = readFileSync(fileURLToPath(new URL('./Library.jsx', import.meta.url)), 'utf-8');

describe('Library.jsx — journey is captured once, from an allowlist, never a guessed value', () => {
  it('imports isValidExploreJourney/getExploreCatalogForJourney/getCuratedExploreCatalog from the one shared exploreFiltering.js - never a second, duplicated filtering definition', () => {
    expect(librarySource).toMatch(/import \{ isValidExploreJourney, getExploreCatalogForJourney, getCuratedExploreCatalog \} from '\.\.\/lib\/exploreFiltering';/);
  });

  it('journey is a lazy one-time initializer validated against isValidExploreJourney - an invalid/missing value resolves to null, never a guessed closest journey', () => {
    const body = librarySource.match(/const \[journey\] = useState\(\(\) => \{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/return isValidExploreJourney\(raw\) \? raw : null;/);
  });

  it('journeyScopeActive starts true only when a genuine journey was captured, and can be cleared (View All) but never re-set from the URL again this visit', () => {
    expect(librarySource).toMatch(/const \[journeyScopeActive, setJourneyScopeActive\] = useState\(\(\) => Boolean\(journey\)\);/);
  });
});

describe('Library.jsx — resolveAnytimeRecommendContext is never an open redirect', () => {
  it('the destination path is always the same hardcoded \'/anytime-reset\' string - need/duration are only ever appended as a query string, never used to choose the path itself', () => {
    const fn = librarySource.match(/const resolveAnytimeRecommendContext = \(searchParams\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(fn).not.toBe('');
    expect(fn).toMatch(/fallback: isValid \? `\/anytime-reset\?need=\$\{encodeURIComponent\(need\)\}&duration=\$\{encodeURIComponent\(duration\)\}` : '\/anytime-reset',/);
  });

  it('need/duration are validated against the exact same ANYTIME_RESET_NEEDS/ANYTIME_RESET_DURATIONS allowlist AnytimeReset.jsx\'s own restore mechanism uses - never accepted as raw, unchecked strings', () => {
    const fn = librarySource.match(/const resolveAnytimeRecommendContext = \(searchParams\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(fn).toMatch(/ANYTIME_RESET_NEEDS\.some\(\(n\) => n\.id === need\)/);
    expect(fn).toMatch(/ANYTIME_RESET_DURATIONS\.some\(\(d\) => d\.id === duration\)/);
  });

  it('an invalid or missing need/duration pair safely falls back to plain /anytime-reset (step 1) - never a crash, never a malformed URL', () => {
    const fn = librarySource.match(/const resolveAnytimeRecommendContext = \(searchParams\) => \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(fn).toMatch(/const isValid = ANYTIME_RESET_NEEDS/);
    expect(fn).toMatch(/: '\/anytime-reset',/);
  });

  it('entryContext routes to resolveAnytimeRecommendContext only for the exact literal \'anytime-recommend\' marker - every other from value still goes through the plain FROM_CONTEXTS lookup', () => {
    const body = librarySource.match(/const \[entryContext\] = useState\(\(\) => \{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(body).toMatch(/if \(from === 'anytime-recommend'\) return resolveAnytimeRecommendContext\(searchParams\);/);
  });
});

describe('Library.jsx — journeyPool restricts every grouping (categories and the Meditation filter alike) to the exact journey-filtered id set', () => {
  it('journeyPool is null (no restriction) unless both journeyScopeActive and journey are true', () => {
    expect(librarySource).toMatch(/journeyScopeActive && journey \? new Set\(getExploreCatalogForJourney\(journey\)\.map\(\(entry\) => entry\.id\)\) : null/);
  });

  it('itemsByCategory\'s own grouping loop checks matchesJourneyPool before matchesQuery, for both the primary category loop and the independent Meditation filter view', () => {
    const body = librarySource.match(/const itemsByCategory = useMemo\(\(\) => \{[\s\S]*?\n {2}\}, \[query, journeyPool\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/if \(!matchesJourneyPool\(entry\) \|\| !matchesQuery\(entry\)\) continue;/);
    expect(body).toMatch(/getMeditationCatalog\(\)\.filter\(\(entry\) => matchesJourneyPool\(entry\) && matchesQuery\(entry\)\)/);
  });
});

describe('Library.jsx — progressive disclosure: a small curated set first, "View All" is the one uniform escape hatch', () => {
  it('showJourneyCurated is true only while journey-scoped AND the user has not yet selected a category or typed a search - both already count as "using the existing filters"', () => {
    expect(librarySource).toMatch(/const showJourneyCurated = Boolean\(journeyScopeActive && journey && !activeCategory && !query\.trim\(\)\);/);
  });

  it('the curated section renders getCuratedExploreCatalog(journey) via the SAME renderItemRow helper the normal category list uses - no second visual treatment', () => {
    expect(librarySource).toMatch(/\{journeyCuratedItems\.map\(renderItemRow\)\}/);
  });

  it('"View All Library content" clears journeyScopeActive (never re-narrows, only ever broadens back to the complete, unfiltered Library) - satisfies Anytime\'s own "broader approved catalogue" requirement', () => {
    expect(librarySource).toMatch(/onClick=\{\(\) => setJourneyScopeActive\(false\)\}/);
    expect(librarySource).toMatch(/View All Library content/);
  });

  it('the normal per-category "Content sections" are hidden while the curated view is showing - the same journey-scoped items never appear twice at once', () => {
    expect(librarySource).toMatch(/\{!showJourneyCurated && \(totalVisibleItems === 0 \? \(/);
  });

  it('search and the existing category chips remain fully rendered/usable regardless of showJourneyCurated - "allow View All OR the existing filters" both stay genuinely available, not gated behind one another', () => {
    const curatedIdx = librarySource.indexOf('{showJourneyCurated && (');
    const searchIdx = librarySource.indexOf('{/* Search */}');
    const categoryChipsIdx = librarySource.indexOf('handleSelectCategory(null)');
    expect(curatedIdx).toBeGreaterThan(-1);
    expect(searchIdx).toBeGreaterThan(curatedIdx);
    expect(categoryChipsIdx).toBeGreaterThan(searchIdx);
  });
});

describe('Library.jsx — no duplicated content registry, no exposed internal/storage identifiers', () => {
  it('renderItemRow reads only id/title/description/durationLabel/active from each entry - the exact same public fields the pre-existing item row already rendered, never entry.storagePath', () => {
    const body = librarySource.match(/const renderItemRow = \(entry\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).not.toMatch(/storagePath/);
  });

  it('the curated section and the normal grouped section both ultimately read from the one shared MEDIA_CATALOG (via exploreFiltering.js/getMeditationCatalog) - never a second hand-authored list', () => {
    expect(librarySource).not.toMatch(/const CURATED_MORNING|const CURATED_EVENING|const CURATED_ANYTIME/);
  });
});

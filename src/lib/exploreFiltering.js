// "Explore More" discovery, Phase 5 — pure, testable journey-aware
// filtering over the SAME single MEDIA_CATALOG every other surface
// already reads (never a second content registry, never a duplicated id
// list). Every function here is a plain array transform with no network
// call, no React, no router - fully unit-testable in isolation.
//
// JOURNEY RULES (documented, not guessed):
//   - Morning: matches the approved copy ("stretching, breathing and
//     meditation for your morning") - category is Morning/Stretching/
//     Breathing, OR the entry is meditation-eligible, AND never an
//     evening-only item (S05 is Stretching but timeOfDay 'evening', and
//     every meditation-eligible M0x item is Evening Wind-Down - both
//     correctly excluded here).
//   - Evening: timeOfDay === 'evening' - directly matches "Do not include
//     energising Morning-only material" (anything not evening-tagged is
//     structurally excluded), and directly matches the approved copy
//     ("sleep stories, calming videos and soothing sounds") since every
//     Evening Wind-Down and Sleep Soundscapes item is evening-tagged.
//   - Anytime: reuses getAnytimeResetCatalog() (mediaCatalog.js's own
//     existing, already-shipped "quick reset" set with real verified
//     durationSeconds) rather than inventing a second definition of
//     "quick" - sorted shortest-first so "prioritise relevant and
//     shorter practices" is a direct, honest consequence of each item's
//     own real duration, never an arbitrary hand-picked order.
import { MEDIA_CATALOG, getAnytimeResetCatalog } from './mediaCatalog';

export const EXPLORE_JOURNEYS = Object.freeze(['morning', 'anytime', 'evening']);

export const isValidExploreJourney = (journey) => EXPLORE_JOURNEYS.includes(journey);

const MORNING_CATEGORIES = new Set(['Morning', 'Stretching', 'Breathing']);

export const getMorningExploreCatalog = () =>
  MEDIA_CATALOG.filter((entry) => entry.timeOfDay !== 'evening' && (MORNING_CATEGORIES.has(entry.category) || Boolean(entry.meditation?.meditationEligible)));

export const getEveningExploreCatalog = () =>
  MEDIA_CATALOG.filter((entry) => entry.timeOfDay === 'evening');

// Shortest-first: `getAnytimeResetCatalog()` already carries verified
// `anytimeReset.durationSeconds` per entry (never estimated) - sorting by
// it is a stable, honest "shorter practices first" ordering with no
// separate prioritisation logic to keep in sync.
export const getAnytimeExploreCatalog = () =>
  [...getAnytimeResetCatalog()].sort((a, b) => a.anytimeReset.durationSeconds - b.anytimeReset.durationSeconds);

// One shared lookup so callers (Library.jsx, ExploreCard.jsx, and every
// completion screen wiring a card) never hand-roll their own
// journey -> catalogue-getter switch. Returns [] for an invalid/unknown
// journey rather than throwing - see isValidExploreJourney for the
// allowlist a caller should check first if it needs to distinguish
// "genuinely empty" from "not a real journey".
export const getExploreCatalogForJourney = (journey) => {
  if (journey === 'morning') return getMorningExploreCatalog();
  if (journey === 'evening') return getEveningExploreCatalog();
  if (journey === 'anytime') return getAnytimeExploreCatalog();
  return [];
};

// The small, "relevant set first" slice each completion card's own
// destination (and Library's own progressive-disclosure default view)
// shows before "View All" - a fixed, small, deterministic count, never a
// random sample (two visits to the same journey show the same curated
// set, matching this catalogue's own already-established "never guess,
// never randomise real content order" convention elsewhere, e.g.
// momentumInsights.js's own deterministic milestone selection).
export const EXPLORE_CURATED_COUNT = 6;

export const getCuratedExploreCatalog = (journey) => getExploreCatalogForJourney(journey).slice(0, EXPLORE_CURATED_COUNT);

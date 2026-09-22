// WakeWise — Anytime Reset: cross-category recommendation engine.
//
// Pure functions over getAnytimeResetCatalog() (see mediaCatalog.js) - no
// React, no Supabase, no new data source. Modeled directly on
// meditationRecommendations.js's own proven exact -> closest ->
// related-need -> honest-empty priority chain, adapted for a single
// maxSeconds cap per duration option instead of a min/max window (see
// mediaCatalog.js's own comment on why). Meditate.jsx and
// meditationRecommendations.js are untouched by this file.
import { ANYTIME_RESET_DURATIONS, ANYTIME_RESET_NEEDS, getAnytimeResetCatalog } from './mediaCatalog';

// "Not sure" is a real, first-class need (its own chip, its own copy) but
// deliberately draws from a small curated cross-category pool rather than
// carrying its own `needs: ['not-sure']` tag in mediaCatalog.js - every id
// here already has a real primary need elsewhere, matching the approved
// "safe balanced rotation across calm, grounding, breathing and positive
// content" intent exactly (calm x2, grounding/stress-relief x1, positive
// x1).
const NOT_SURE_ITEM_IDS = ['E03', 'E08', 'E04', 'E11', 'G04'];

// Used only if a real need's own pool has zero items fitting the selected
// duration AND zero items at all (not reachable with today's catalogue -
// every approved need has 3+ items - kept as a defensive, honestly-
// labelled path rather than a silent dead end, same rationale as
// meditationRecommendations.js's own RELATED_NEEDS).
const RELATED_NEEDS = {
  calm: ['stress-relief', 'quiet-time'],
  focus: ['quiet-time'],
  energy: ['better-mood'],
  'stress-relief': ['calm', 'body-reset'],
  'body-reset': ['stress-relief'],
  'quiet-time': ['calm'],
  'better-mood': ['energy', 'calm']
};

const getDuration = (durationId) => ANYTIME_RESET_DURATIONS.find((d) => d.id === durationId);
const getNeedLabel = (needId) => ANYTIME_RESET_NEEDS.find((n) => n.id === needId)?.label ?? '';

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const fitsDuration = (entry, durationId) => {
  const duration = getDuration(durationId);
  if (!duration) return true;
  return entry.anytimeReset.durationSeconds <= duration.maxSeconds;
};

const byNeed = (catalog, needId) =>
  needId === 'not-sure'
    ? catalog.filter((entry) => NOT_SURE_ITEM_IDS.includes(entry.id))
    : catalog.filter((entry) => entry.anytimeReset.needs.includes(needId));

// Builds the "Why this" copy at match time, from the actual selection -
// never a static per-item string, so it can never claim a duration window
// the user didn't ask for.
//
// matchQuality 'closest' states the plain fact up front - "No item in
// this category fits within <selected duration>" - then the category's
// true shortest available option, computed ONCE across the whole
// fallback pool (`shortestSeconds`, not this specific item's own
// duration). This stays accurate no matter which item "Choose another"
// currently has selected: the recommendation card's own duration badge
// (see AnytimeReset.jsx) always shows THIS item's real duration
// separately, so the two together can never contradict each other -
// unlike an earlier draft, which restated "the closest match" using each
// item's own duration and would have called a *longer* second/third item
// "the shortest option" once the user tapped Choose Another.
const buildReason = ({ needId, durationId, matchQuality, shortestSeconds }) => {
  const needLabel = getNeedLabel(needId).toLowerCase();
  const duration = getDuration(durationId);
  if (!duration || durationId === 'any') {
    return `Matches your need for ${needLabel}.`;
  }
  if (matchQuality === 'exact') {
    return `Matches your need for ${needLabel} and fits ${duration.label.toLowerCase()}.`;
  }
  return `No ${needLabel} option fits within ${duration.label.toLowerCase()}. The shortest option is ${formatDuration(shortestSeconds)}.`;
};

const withReasons = (items, needId, durationId, matchQuality) => {
  const shortestSeconds = items.length > 0 ? Math.min(...items.map((entry) => entry.anytimeReset.durationSeconds)) : null;
  return items.map((entry) => ({
    ...entry,
    matchReason: buildReason({ needId, durationId, matchQuality, shortestSeconds })
  }));
};

/**
 * @param {{ needId: string, durationId: 'quick'|'short'|'any' }} selection
 * @returns {{ matchQuality: 'exact'|'closest', items: Array }}
 */
export const recommendAnytimeReset = ({ needId, durationId }) => {
  const catalog = getAnytimeResetCatalog();
  if (!needId) return { matchQuality: 'exact', items: [] };

  const needMatches = byNeed(catalog, needId);

  // "No preference" - the need match is itself the exact match, no
  // duration filtering to apply. Sorted shortest-first so quicker options
  // surface before longer ones within the same need.
  if (!durationId || durationId === 'any') {
    const sorted = [...needMatches].sort((a, b) => a.anytimeReset.durationSeconds - b.anytimeReset.durationSeconds);
    return { matchQuality: 'exact', items: withReasons(sorted, needId, durationId, 'exact') };
  }

  // Priority 1: exact need, and it genuinely fits within the selected cap.
  const exact = needMatches.filter((entry) => fitsDuration(entry, durationId));
  if (exact.length > 0) {
    return { matchQuality: 'exact', items: withReasons(exact, needId, durationId, 'exact') };
  }

  // Priority 2: exact need, nearest (shortest) available duration - every
  // remaining candidate here exceeds the cap, so shortest-first is
  // closest to what was asked for. Its real duration is always shown.
  if (needMatches.length > 0) {
    const sorted = [...needMatches].sort((a, b) => a.anytimeReset.durationSeconds - b.anytimeReset.durationSeconds);
    return { matchQuality: 'closest', items: withReasons(sorted, needId, durationId, 'closest') };
  }

  // Priority 3: related need, selected duration cap.
  const related = RELATED_NEEDS[needId] || [];
  for (const relatedNeedId of related) {
    const relatedMatches = byNeed(catalog, relatedNeedId).filter((entry) => fitsDuration(entry, durationId));
    if (relatedMatches.length > 0) {
      return { matchQuality: 'closest', items: withReasons(relatedMatches, relatedNeedId, durationId, 'closest') };
    }
  }
  for (const relatedNeedId of related) {
    const relatedAny = byNeed(catalog, relatedNeedId);
    if (relatedAny.length > 0) {
      return { matchQuality: 'closest', items: withReasons(relatedAny, relatedNeedId, durationId, 'closest') };
    }
  }

  // Priority 4: no unsuitable fallback - an empty result is a valid,
  // honest answer.
  return { matchQuality: 'exact', items: [] };
};

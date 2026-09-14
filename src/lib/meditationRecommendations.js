// WakeWise — Meditation experience: recommendation engine.
//
// Pure functions over getMeditationCatalog() (see mediaCatalog.js) — no
// React, no Supabase, no new data source. Implements the exact matching
// priority from the approved spec:
//   1. Exact need AND exact duration-group fit.
//   2. Exact need, nearest available duration (labelled "Closest match").
//   3. Related need, selected duration (labelled "Closest match").
//   4. No unsuitable fallback — an empty result is a valid, honest answer.
//
// "Exact duration-group fit" means durationGroup matches AND the item's
// own exactGroupFit flag isn't false (see mediaCatalog.js's own doc
// comment on the one item, E27, whose verified duration falls just short
// of its assigned group's floor).
import { MEDITATION_DURATION_GROUPS, getMeditationCatalog } from './mediaCatalog';

// Used only as priority 3's fallback, and only if a need somehow has zero
// eligible items — not reachable with today's 10-item set (every approved
// need has at least one real match), kept as a defensive, honestly-labelled
// path rather than a silent dead end.
const RELATED_NEEDS = {
  calm: ['mindfulness', 'deep-relaxation'],
  focus: ['mindfulness'],
  mindfulness: ['calm'],
  'stress-relief': ['calm', 'deep-relaxation'],
  'body-awareness': ['deep-relaxation'],
  gratitude: ['self-compassion'],
  'self-compassion': ['gratitude', 'calm'],
  'deep-relaxation': ['calm', 'body-awareness']
};

const getGroup = (durationGroupId) => MEDITATION_DURATION_GROUPS.find((g) => g.id === durationGroupId);

const distanceFromGroup = (entry, group) => {
  const seconds = entry.meditation.durationSeconds;
  if (seconds < group.minSeconds) return group.minSeconds - seconds;
  if (seconds > group.maxSeconds) return seconds - group.maxSeconds;
  return 0;
};

const byNeed = (catalog, needId) => catalog.filter((entry) => entry.meditation.needs.includes(needId));

const exactGroupFit = (entry, durationGroupId) =>
  entry.meditation.durationGroup === durationGroupId && entry.meditation.exactGroupFit !== false;

/**
 * @param {{ durationGroupId: 'quick'|'short'|'any', needId: string }} selection
 * @returns {{ matchQuality: 'exact'|'closest', items: Array }}
 */
export const recommendMeditations = ({ durationGroupId, needId }) => {
  const catalog = getMeditationCatalog();
  if (!needId) return { matchQuality: 'exact', items: [] };

  const needMatches = byNeed(catalog, needId);

  // "Any duration" — need match is itself the exact match, no duration
  // filtering to apply. Sorted shortest-first so Quick-length options
  // surface before longer ones within the same need.
  if (durationGroupId === 'any' || !durationGroupId) {
    const sorted = [...needMatches].sort((a, b) => a.meditation.durationSeconds - b.meditation.durationSeconds);
    return { matchQuality: 'exact', items: sorted };
  }

  // Priority 1: exact need AND exact duration-group fit.
  const exact = needMatches.filter((entry) => exactGroupFit(entry, durationGroupId));
  if (exact.length > 0) return { matchQuality: 'exact', items: exact };

  // Priority 2: exact need, nearest available duration (includes the
  // group's own not-quite-fitting items, e.g. E27 for 'short').
  if (needMatches.length > 0) {
    const group = getGroup(durationGroupId);
    const sorted = [...needMatches].sort(
      (a, b) => distanceFromGroup(a, group) - distanceFromGroup(b, group)
    );
    return { matchQuality: 'closest', items: sorted };
  }

  // Priority 3: related need, selected duration group.
  const related = RELATED_NEEDS[needId] || [];
  for (const relatedNeedId of related) {
    const relatedMatches = byNeed(catalog, relatedNeedId).filter((entry) => exactGroupFit(entry, durationGroupId));
    if (relatedMatches.length > 0) return { matchQuality: 'closest', items: relatedMatches };
  }
  const relatedAnyDuration = related.flatMap((relatedNeedId) => byNeed(catalog, relatedNeedId));
  if (relatedAnyDuration.length > 0) return { matchQuality: 'closest', items: relatedAnyDuration };

  // Priority 4: no unsuitable fallback.
  return { matchQuality: 'exact', items: [] };
};

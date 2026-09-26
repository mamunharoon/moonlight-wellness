import { getZonedParts } from './timezone';
import { now as devNow } from './devClock';

// Context-aware Meditation/Breathing theming — safe last-resort fallback
// for a standalone practice reached with no explicit launch context at
// all (a genuinely fresh direct URL, or sessionStorage unavailable). A
// simple daypart band, deliberately independent of Home.jsx's own richer
// "in-progress routine takes priority over the clock" default-tab logic
// (defaultPeriod) - that logic exists to decide which card Home itself
// highlights and needs session/rhythm state a standalone practice screen
// has no reason to depend on just to pick a fallback colour. Never used
// when a real launch context (an embedded journey, or a captured Home
// quick-action tap) is available - see resolvePracticeJourneyTone in
// practiceJourneyContext.js.
export const currentDaypartJourneyTone = (timezone) => {
  const { hour } = getZonedParts(timezone, devNow());
  if (hour < 12) return 'morning';
  if (hour >= 18) return 'evening';
  return 'anytime';
};

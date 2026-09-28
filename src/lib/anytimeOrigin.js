// Anytime Visual Flow and Closing Handoff uplift — the ONE explicit,
// validated signal every standalone practice (QuietBreathing.jsx's
// standalone branch, SelfGuidedMeditation.jsx/SelfGuidedMeditationComplete.jsx)
// uses to know it was genuinely launched from Anytime Reset's own "Or
// choose another quick reset" - never inferred from journeyTone (which
// also resolves to 'anytime' for an unrelated reason: no explicit tone at
// all, falling back to a plain midday daypart band - see
// dayPartJourneyTone.js/practiceJourneyContext.js), and never from
// navigate(-1)/browser history.
//
// Previously each of the three call sites computed this inline as a bare
// `Boolean(state?.anytimeNeed && state?.anytimeDuration)`, with no
// validation against the real allowlists - AnytimeReset.jsx's own
// post-sign-in restore already validates (restoredIsValid), so a garbage
// value downstream safely fell back to step 1 rather than crashing or
// opening an arbitrary destination, but the marker itself could still
// read "true" for a value that could never actually resolve to a real
// screen. This module centralizes the same check, now genuinely
// allowlist-validated at the source, so `anytimeOrigin` itself is
// trustworthy end-to-end, not just downstream-safe.
import { ANYTIME_RESET_NEEDS, ANYTIME_RESET_DURATIONS } from './mediaCatalog';

const isValidNeedId = (needId) => ANYTIME_RESET_NEEDS.some((n) => n.id === needId);
const isValidDurationId = (durationId) => ANYTIME_RESET_DURATIONS.some((d) => d.id === durationId);

/**
 * @param {{ anytimeNeed?: string, anytimeDuration?: string } | null | undefined} state
 *   - typically a react-router `location.state` (or a preset/session object
 *   forwarded from it) carrying the two router-state fields AnytimeReset.jsx's
 *   own `handleQuickResetAlternative` sets on navigate.
 * @returns {{ anytimeOrigin: boolean, anytimeNeed: string|null, anytimeDuration: string|null, anytimeResetDestination: string }}
 *   `anytimeResetDestination` is always a safe, same-origin, relative path -
 *   the validated recommendation when anytimeOrigin is true, or the plain
 *   wizard entry ('/anytime-reset', step 1) otherwise - never an open
 *   redirect, never an arbitrary URL.
 */
export const resolveAnytimeOrigin = (state) => {
  const needId = state?.anytimeNeed;
  const durationId = state?.anytimeDuration;
  const anytimeOrigin = Boolean(needId && durationId && isValidNeedId(needId) && isValidDurationId(durationId));
  return {
    anytimeOrigin,
    anytimeNeed: anytimeOrigin ? needId : null,
    anytimeDuration: anytimeOrigin ? durationId : null,
    anytimeResetDestination: anytimeOrigin
      ? `/anytime-reset?need=${encodeURIComponent(needId)}&duration=${encodeURIComponent(durationId)}`
      : '/anytime-reset'
  };
};

// Context-aware Meditation/Breathing theming — standalone practice launch
// context.
//
// Root problem: standalone Breathe (/breathe-standalone, QuietBreathing.jsx)
// and standalone Meditation (/self-guided-meditation, SelfGuidedMeditation.jsx)
// are SHARED practices with no journey of their own - unlike Morning/Evening's
// own embedded Breathe/Meditate screens (MorningMeditate.jsx, Breathe.jsx,
// EveningMeditate.jsx, EveningBreathing.jsx), which always know their own
// real journey directly and pass it as a literal 'morning'/'evening', no
// ambiguity, no capture needed. A standalone practice must instead INHERIT
// whichever experience launched it (the active Home rhythm tab at the
// moment of the tap, or a direct-URL/missing-context daypart fallback) and
// then PRESERVE that one captured value for its whole lifecycle - setup,
// countdown, active session, completion, Back-to-setup, replay - never
// recalculated from the clock mid-practice, and never leaking into a LATER,
// unrelated practice once this one finishes.
//
// sessionStorage (not localStorage, and no new Supabase migration): tab-
// scoped, gone the moment the browser/app session ends, and explicitly
// overwritten on every fresh Home quick-action launch and cleared on every
// real exit-to-Home path below - never a long-lived, potentially cross-
// user leak the way a localStorage key would be. Sign-out already broadcasts
// via signOutCleanup.js's onSignOutBroadcast (see AlarmContext.jsx's own
// journeyStep reset for the established precedent) - clearPracticeJourneyTone
// is wired into that same broadcast so User B can never inherit User A's
// leftover practice context on a shared device.
const PRACTICE_JOURNEY_TONE_KEY = 'moonlight_practice_journey_tone';

const VALID_TONES = new Set(['morning', 'anytime', 'evening']);

export const normalizeJourneyTone = (value) => (VALID_TONES.has(value) ? value : null);

// Called by Home.jsx immediately before navigating to a standalone
// practice (via the Link's own `state`, read by resolvePracticeJourneyTone
// below) - this is the OVERWRITE that guarantees "starting another
// practice captures the new current Home context" regardless of whether a
// previous practice's own exit path already cleared this key.
export const capturePracticeJourneyTone = (tone) => {
  try {
    sessionStorage.setItem(PRACTICE_JOURNEY_TONE_KEY, normalizeJourneyTone(tone) || 'anytime');
  } catch {
    // sessionStorage unavailable - the practice's own daypart fallback
    // (see usePracticeJourneyTone) still gives a safe value; it just
    // won't survive this one practice's own later route changes.
  }
};

export const readCapturedPracticeJourneyTone = () => {
  try {
    return normalizeJourneyTone(sessionStorage.getItem(PRACTICE_JOURNEY_TONE_KEY));
  } catch {
    return null;
  }
};

// Called on every real exit-to-Home path (natural completion's Done,
// a confirmed mid-practice Close, an early-ended session's Done, Back
// from setup or from a result screen) and on sign-out (via
// signOutCleanup.js's own moonlight_-prefix sessionStorage sweep, which
// this key's name already matches - no separate wiring needed) - never
// on an in-flow action that stays within the SAME practice (Back-to-
// setup while genuinely mid-session, Meditate/Breathe Again, Choose
// Another, a guided-video interruption that never leaves the page).
export const clearPracticeJourneyTone = () => {
  try {
    sessionStorage.removeItem(PRACTICE_JOURNEY_TONE_KEY);
  } catch {
    // no-op - nothing to clear if storage was never available.
  }
};

// Centralized clear-and-navigate helper — the single, hard-to-miss way
// every real "exit this practice to Home (or wherever)" call site should
// leave. Every terminal exit from a standalone practice (Done, a
// confirmed Close/exit dialog, an early-ended result's Done) should call
// this instead of pairing a bare clearPracticeJourneyTone() with its own
// navigate() call by hand - one centralized helper is far harder to
// accidentally miss on a new exit path than scattered, easily-forgotten
// pairs. `navigate` is the caller's own react-router useNavigate()
// instance (this module has no router dependency of its own).
export const exitPracticeToHome = (navigate, destination = '/', options) => {
  clearPracticeJourneyTone();
  navigate(destination, options);
};

// Resolves the ONE launch-context tone a standalone practice screen
// captures at its own first mount, per the documented precedence:
//   1. explicitTone - a real, unambiguous context the caller already
//      knows directly (none of today's standalone screens have one, but
//      the hook accepts it for a future embedded-context caller);
//   2. whatever was captured just before navigation (Home quick-action
//      launch, or a value an earlier screen in this SAME practice already
//      wrote back - see usePracticeJourneyTone);
//   3. daypartFallback - a safe daypart-derived value for a direct URL or
//      otherwise missing context, supplied by the caller (already derived
//      from this app's own existing circadian/daypart logic) rather than
//      computed here, so this module stays a pure resolver with no clock
//      access of its own.
export const resolvePracticeJourneyTone = ({ explicitTone, daypartFallback } = {}) => {
  const explicit = normalizeJourneyTone(explicitTone);
  if (explicit) return explicit;
  const captured = readCapturedPracticeJourneyTone();
  if (captured) return captured;
  return normalizeJourneyTone(daypartFallback) || 'anytime';
};

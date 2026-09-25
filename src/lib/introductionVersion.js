// First-use WakeWise Introduction — canonical version + comparison.
//
// Single source of truth for "which Introduction have users seen": bump
// this when the Introduction's content changes enough that every user
// (including one who already completed an earlier version) should see it
// again — that alone is the entire mechanism, no second migration or
// column needed (see the accompanying migration's own doc comment).
//
// Wired to a live redirect (Auth.jsx's redirectAfterAuth) and persistence
// call (Introduction.jsx's own persistAndContinue) against the real
// server column profiles.introduction_completed_version.
//
// Bumped 1 -> 2 for the Build 16 welcome-screen redesign (new heading/
// copy, three destination cards, single optional video pill) - content
// changed enough that a user who already completed version 1 should see
// the new screen once more.
export const CURRENT_INTRODUCTION_VERSION = 2;

/**
 * Whether the Introduction should be shown automatically for a user whose
 * own `introduction_completed_version` is `completedVersion` — undefined/
 * null (a profile that hasn't loaded yet, or has no value at all) is
 * treated as "not yet completed" (0), the same starting point a fresh
 * DEFAULT 0 row already has, never as "already seen".
 */
export const shouldShowIntroduction = (completedVersion) =>
  (completedVersion ?? 0) < CURRENT_INTRODUCTION_VERSION;

/**
 * First-Use Welcome redirect-order defect fix — OnboardingGate.jsx's own
 * passive check, extracted as a pure function so it can be real-execution
 * tested directly (this repo's Vitest runs in a plain Node environment,
 * with no DOM/component rendering available - see any other test file's
 * own note on this - so a pure decision function is what "real execution,
 * not source-string assertions" means for logic that would otherwise only
 * ever run inside a React component).
 *
 * Every input is passed in explicitly, never read from module state
 * inside this function - `alreadyHandled` in particular is the caller's
 * own hasPostAuthRedirectBeenHandled() read, kept a parameter rather than
 * an internal side-effecting read so this stays a pure, trivially-testable
 * function of its inputs.
 *
 * @param {object} params
 * @param {object|null} params.user - AuthContext's own user, or null/undefined
 * @param {boolean} params.isGuest
 * @param {object|null} params.profile - AuthContext's own profile row, or null while loading/absent
 * @param {boolean} params.profileLoading
 * @param {string|null} params.profileError
 * @param {string} params.pathname - the current route, e.g. location.pathname
 * @param {boolean} params.alreadyHandled - hasPostAuthRedirectBeenHandled()
 * @returns {boolean}
 */
export const shouldRedirectToIntroduction = ({
  user,
  isGuest,
  profile,
  profileLoading,
  profileError,
  pathname,
  alreadyHandled
}) => {
  if (!user || isGuest) return false;
  if (profileLoading || profileError || !profile) return false;
  if (alreadyHandled) return false;
  if (pathname === '/introduction') return false;
  return shouldShowIntroduction(profile.introduction_completed_version);
};

/**
 * The one real destination this whole passive check produces - mirrors
 * Auth.jsx's own redirectAfterAuth `existingParam` signal exactly:
 * `&existing=1` only when this account already had a real, previously-
 * completed version (an existing user below CURRENT_INTRODUCTION_VERSION),
 * never for a genuinely brand-new profile.
 * @param {object} profile - a profile row that already passed shouldRedirectToIntroduction's own checks (never null here)
 * @returns {string}
 */
export const buildIntroductionRedirectPath = (profile) =>
  `/introduction?auto=1${profile.introduction_completed_version ? '&existing=1' : ''}`;

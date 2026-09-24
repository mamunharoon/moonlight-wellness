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

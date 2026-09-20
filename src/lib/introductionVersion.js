// First-use WakeWise Introduction — canonical version + comparison.
//
// Single source of truth for "which Introduction have users seen": bump
// this when the Introduction's content changes enough that every user
// (including one who already completed an earlier version) should see it
// again — that alone is the entire mechanism, no second migration or
// column needed (see the accompanying migration's own doc comment).
//
// Not yet wired to any live redirect or persistence call — the server
// column this compares against (profiles.introduction_completed_version)
// does not exist until the accompanying migration is reviewed and
// applied. This module is the safe, pure, already-testable piece; see the
// implementation report for the exact (not-yet-connected) call sites this
// plugs into once that migration lands.
export const CURRENT_INTRODUCTION_VERSION = 1;

/**
 * Whether the Introduction should be shown automatically for a user whose
 * own `introduction_completed_version` is `completedVersion` — undefined/
 * null (a profile that hasn't loaded yet, or has no value at all) is
 * treated as "not yet completed" (0), the same starting point a fresh
 * DEFAULT 0 row already has, never as "already seen".
 */
export const shouldShowIntroduction = (completedVersion) =>
  (completedVersion ?? 0) < CURRENT_INTRODUCTION_VERSION;

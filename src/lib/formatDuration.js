// Build 15 — a generic "seconds -> human duration" formatter, shared by
// the Morning Stretch pre-start summary and the Breathing pre-start
// pattern rows (Morning/Evening/standalone). Pure, no side effects -
// extracted out of MorningFlow.jsx (a page component, where exporting a
// second named value alongside the default breaks React Fast Refresh)
// so it can be genuinely unit-tested with real execution, and reused
// rather than duplicated by anything else that needs the same formatting.
//
// Build 15 Box/Coherent addition — exact-minute correction: a genuine
// whole-minute total (60s, 120s, ...) no longer carries the "~" that
// implies rounding happened when it didn't. Only checked audited
// consumers of this function: BreathingPatternRow.jsx (per-pattern
// total; only Coherent's own 60s total is exact among all five patterns,
// every other pattern's total is unaffected) and MorningFlow.jsx's own
// Stretch summary (unaffected for its default 80s total; only changes
// display in the specific reachable state where exactly 3 of 4
// movements are selected, 20s each = 60s exactly - a genuine correctness
// improvement there too, not a regression).
export const formatTotalDuration = (totalSeconds) => {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = totalSeconds / 60;
  if (Number.isInteger(mins)) return `${mins} min${mins === 1 ? '' : 's'}`;
  const rounded = Math.round(mins);
  return `~${rounded} min${rounded === 1 ? '' : 's'}`;
};

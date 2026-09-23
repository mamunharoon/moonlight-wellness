// Build 15 — a generic "seconds -> human duration" formatter, shared by
// the Morning Stretch pre-start summary and the Breathing pre-start
// pattern rows (Morning/Evening/standalone). Pure, no side effects -
// extracted out of MorningFlow.jsx (a page component, where exporting a
// second named value alongside the default breaks React Fast Refresh)
// so it can be genuinely unit-tested with real execution, and reused
// rather than duplicated by anything else that needs the same formatting.
export const formatTotalDuration = (totalSeconds) => {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.round(totalSeconds / 60);
  return `~${mins} min${mins === 1 ? '' : 's'}`;
};

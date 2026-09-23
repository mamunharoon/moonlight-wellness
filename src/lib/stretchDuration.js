// Build 15 — Morning Stretch pre-start summary. Pure, no side effects -
// extracted out of MorningFlow.jsx (a page component, where exporting a
// second named value alongside the default breaks React Fast Refresh)
// so it can be genuinely unit-tested with real execution.
export const formatTotalDuration = (totalSeconds) => {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.round(totalSeconds / 60);
  return `~${mins} min${mins === 1 ? '' : 's'}`;
};

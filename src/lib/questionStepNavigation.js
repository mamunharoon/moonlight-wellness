// Phase 3 (Reflection/Gratitude tap-first redesign) — shared, pure helper
// for the allowlisted `?q=` route param both pages use to address their
// own current question. Extracted out of Reflection.jsx/Gratitude.jsx (both
// had byte-identical logic, differing only in their own prompt count) so
// this can be genuinely unit-tested with real inputs rather than only a
// source-level regex, matching this codebase's own precedent of preferring
// real execution over regex wherever the logic is pure/importable (see
// morningStretchSkipDefectFix.test.js).
//
// Deliberately safe by construction, never throwing: missing, non-numeric,
// fractional, or out-of-range input all resolve to the first question (index
// 0) - a direct link, a stale bookmark, or a hand-edited URL can never crash
// either page or land on an undefined prompt.
export const parseActiveIndex = (searchParams, promptCount) => {
  const raw = Number(searchParams.get('q'));
  if (!Number.isInteger(raw) || raw < 1 || raw > promptCount) return 0;
  return raw - 1;
};

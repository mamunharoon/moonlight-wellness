// Physical-iPhone correction (Phase 9 follow-up) — the previous connector
// was a bare `chevron_right` glyph with no connecting line, which on a
// real device reads as an isolated floating arrowhead rather than a
// visible stage-to-stage connection. The approved reference is a short
// horizontal line ending in a right-facing arrowhead: `Stage ─→ Stage`.
// This renders that as one explicit SVG shape (a <line> plus a filled
// triangle), not a single font glyph — Material Symbols' `arrow_right_alt`
// was considered, but its stem thickness varies with the variable font's
// resolved weight/rasterization and can't be guaranteed visible at this
// size on every device, whereas an SVG stroke is deterministic and
// trivially provable in this repo's source-level tests. One shared
// implementation for every pathway (Morning/Evening/Anytime decision
// pathway/Anytime Home preview row) so the three journeys cannot drift
// out of sync again.
//
// Purely decorative: aria-hidden, never focusable/tappable, and its
// appearance never changes with adjacent stage status (completed/
// skipped/ended_early/current/not_started all render the identical
// connector — status lives only in the stage's own badge/label, never
// here).
//
// `className` is caller-supplied only for the exact vertical-centring
// offset against that pathway's own icon-circle size (Morning/Evening
// use a 28px circle, the Anytime decision pathway a 32px circle, Home's
// Anytime preview row a 36px circle) — see each caller's own comment for
// the exact half-pixel arithmetic. It never changes the connector's
// shape or colour resolution, which stay centralised here.
const TONE_CLASS = Object.freeze({
  morning: 'text-morning-accent/70',
  evening: 'text-evening-accent/70',
  anytime: 'text-tertiary/70',
});

export const JourneyConnector = ({ journeyTone = 'morning', className = '' }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width="22"
    height="11"
    viewBox="0 0 22 11"
    className={`shrink-0 ${TONE_CLASS[journeyTone] ?? TONE_CLASS.morning} ${className}`}
  >
    <line x1="0" y1="5.5" x2="14" y2="5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <path d="M12 1 L21 5.5 L12 10 Z" fill="currentColor" />
  </svg>
);

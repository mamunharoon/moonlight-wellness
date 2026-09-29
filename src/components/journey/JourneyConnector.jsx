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

// Morning pathway icon uplift (physical-iPhone correction) — `size`
// (additive, default 'sm' — every existing caller omits it and renders
// byte-identical geometry to before this prop existed) lets the Morning
// pathway ask for a proportionally larger line+arrowhead to bridge its
// own now-substantially-bigger icon circles, without touching Evening/
// Anytime/Home's own 'sm' geometry at all. Both sizes share the exact
// same shape (one <line> + one filled triangle) and colour-resolution
// logic — only the numbers scale.
const SIZE = Object.freeze({
  sm: { width: 22, height: 11, lineY: 5.5, lineX2: 14, strokeWidth: '1.75', arrow: 'M12 1 L21 5.5 L12 10 Z' },
  lg: { width: 28, height: 14, lineY: 7, lineX2: 18, strokeWidth: '2.5', arrow: 'M16 1.5 L27 7 L16 12.5 Z' },
});

export const JourneyConnector = ({ journeyTone = 'morning', className = '', size = 'sm' }) => {
  const s = SIZE[size] ?? SIZE.sm;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={s.width}
      height={s.height}
      viewBox={`0 0 ${s.width} ${s.height}`}
      className={`shrink-0 ${TONE_CLASS[journeyTone] ?? TONE_CLASS.morning} ${className}`}
    >
      <line x1="0" y1={s.lineY} x2={s.lineX2} y2={s.lineY} stroke="currentColor" strokeWidth={s.strokeWidth} strokeLinecap="round" />
      <path d={s.arrow} fill="currentColor" />
    </svg>
  );
};

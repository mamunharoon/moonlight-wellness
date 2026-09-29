/* eslint-disable no-unused-vars */
import { StageOutcomeBadge } from './journey/StageOutcomeBadge';
import { MORNING_PATHWAY_STAGES } from '../session/pathwayStages';
import { STAGE_STATUS_SR_TEXT } from '../session/stageStatus';

// Morning Visual Uplift (Phase 6) — the Morning Home "Morning Reset" card's
// five-step visual pathway (Focus -> Stretch -> Breathe -> Meditate ->
// Affirm), per the approved Stitch-direction Home redesign. Purely
// decorative/informational (a preview of what the routine contains, not a
// navigable control - each step is reached only by actually progressing
// through the real routine via the card's own "Begin Morning Reset"
// action) - it never links anywhere, never duplicates ProgressIndicator's
// own in-routine step tracking, and introduces no new routing.
//
// Every icon is a real, existing Material Symbol already used elsewhere in
// this app for the same concept (never an emoji) - see
// session/pathwayStages.js's own doc comment for the full per-icon
// rationale. Unchanged by Phase 9 - these are the exact same five icons
// this component has always used.

// Every stage 'not_started' - the exact rendering this component has
// always produced when no progress prop was supplied.
const DEFAULT_STAGES = MORNING_PATHWAY_STAGES.map(({ id, label, icon }) => ({ id, label, icon, status: 'not_started' }));

// Approved Morning pathway-fit correction — physical-iPhone finding: the
// previous flex row (`min-w-max`, horizontal scroll + scroll-snap + a
// trailing fade mask) clipped Affirm and required scrolling to see it at
// every normal iPhone width, which is not the approved standard
// presentation. Fixed by switching to a real 5-column CSS grid
// (`grid-cols-5`, which Tailwind compiles to
// `repeat(5, minmax(0, 1fr))`) - the `minmax(0, ...)` half is the actual
// fix: a plain `1fr` column still refuses to shrink below its own
// content's intrinsic width (grid items default to `min-width: auto`),
// which is exactly what forced horizontal overflow before; `minmax(0,
// 1fr)` explicitly allows each column to shrink to fit the real available
// width, so all five stages - and all four direction markers - are
// visible simultaneously with no scrolling, snapping, or fade needed.
// Removed entirely below, since none of that machinery still does
// anything useful once the row itself never overflows.
const TILE_CLASS = Object.freeze({
  current: 'border-morning-accent bg-morning-accent-tint/10',
  default: 'border-morning-accent-tint/25 bg-morning-accent-tint/5',
});

// Approved Morning pathway-fit correction — icon/glyph sizing now scales
// with the viewport (`clamp(min, preferred-vw, max)`) instead of a single
// fixed Tailwind size class, so the icon stays "clearly visible" (the
// explicit complaint about the previous fixed-48px circle reading as too
// small once wrapped in the tile's own border/padding at narrow widths)
// without ever forcing the row wider than the real 320-430px viewport
// budget the grid above already caps it to. Approved target ranges:
// icon container clamp(38px, 11vw, 46px), glyph clamp(20px, 5.5vw, 24px).
const ICON_CONTAINER_STYLE = { width: 'clamp(38px, 11vw, 46px)', height: 'clamp(38px, 11vw, 46px)' };
const ICON_GLYPH_STYLE = { fontSize: 'clamp(20px, 5.5vw, 24px)' };

// Direction markers — approved redesign, replacing the previous line-and-
// arrowhead JourneyConnector for Morning ONLY (Evening/Anytime/Home's own
// Anytime preview row all keep rendering the real JourneyConnector
// unchanged - see pathwayConnectors.test.js's own untouched assertions for
// those three). One small standalone ">" per adjacent pair - no line, no
// stem, no oversized arrow. Purely decorative (aria-hidden,
// non-interactive) and NEVER conditioned on stage.status - direction
// markers are not outcome indicators.
//
// Positioned `absolute` inside the icon row's own wrapper (a `relative`
// div that spans the FULL card width, not just the icon circle's own
// centred width) so it: (a) is vertically centred against the icon
// specifically via `top-1/2 -translate-y-1/2` - exact at every responsive
// size, including when a neighbouring card's label wraps to two lines and
// changes that card's own height, since this positioning never depends on
// the card's total height at all; (b) sits right at/just past the CARD's
// own right edge (the wrapper is the same width as the card), matching
// "emerge directly from the right side of the preceding square"; and (c)
// consumes zero grid layout width, since absolute positioning removes it
// from flow entirely - the small negative `right` offset lets it visually
// extend into the inter-column gap without affecting the grid's own
// column widths, exactly as approved.
const DIRECTION_MARKER_STYLE = { right: '-8px', fontSize: 'clamp(14px, 4vw, 18px)' };

// Phase 9 — Truthful Journey Outcomes (problem #3 fix): this component
// previously replaced a "completed" step's own icon with a generic
// checkmark, inferred purely from `currentStepNumber` position (a step
// was "completed" merely because a later step's number was reached - the
// exact defect Phase 9 was raised to fix, since a SKIPPED step reads
// identically to a genuinely completed one under pure position math).
// It now accepts a `stages` prop - the exact output shape of
// session/stageStatus.js's computeStageStatus() - and NEVER infers
// anything itself: the genuine activity icon (flag/self_improvement/air/
// spa/auto_awesome) is always the primary visual, in every status,
// including 'completed'. A real completion only ever adds a small
// secondary check badge in the corner (StageOutcomeBadge); a real skip
// adds a muted dash badge; a confirmed mid-exercise abandonment adds a
// muted pause badge; 'current' only changes the main badge's own ring/
// highlight styling (and the tile's own border/background). Omitting
// `stages` entirely renders every stage 'not_started', byte-identical to
// this component's original no-progress-prop rendering.
export const MorningJourneyPathway = ({ stages = DEFAULT_STAGES } = {}) => (
  <div className="w-full">
    <div className="grid grid-cols-5 gap-1" role="list" aria-label="Morning Reset steps: Focus, Stretch, Breathe, Meditate, Affirm">
      {stages.map((stage, idx) => {
        const isCurrent = stage.status === 'current';
        const badgeClass = isCurrent
          ? 'bg-morning-accent-tint/25 border-morning-accent text-morning-accent'
          : 'bg-morning-accent-tint/15 border-morning-accent-tint/30 text-morning-accent';
        const labelClass = isCurrent ? 'text-morning-accent font-bold' : 'text-on-surface-variant font-semibold';
        const tileClass = isCurrent ? TILE_CLASS.current : TILE_CLASS.default;
        return (
          <div key={stage.id} className="min-w-0" role="listitem">
            <div className={`flex flex-col items-center gap-1 w-full rounded-2xl border p-1 ${tileClass}`}>
              <div className="relative w-full flex items-center justify-center">
                <span className={`relative rounded-full border-2 flex items-center justify-center shrink-0 ${badgeClass}`} style={ICON_CONTAINER_STYLE}>
                  <span className="material-symbols-outlined" style={ICON_GLYPH_STYLE} aria-hidden="true">{stage.icon}</span>
                  <StageOutcomeBadge status={stage.status} journeyTone="morning" size="md" />
                </span>
                {idx < stages.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 pointer-events-none"
                    style={DIRECTION_MARKER_STYLE}
                  >
                    chevron_right
                  </span>
                )}
              </div>
              <span className={`text-xs leading-tight text-center break-words ${labelClass}`}>
                {stage.label}
                <span className="sr-only">, {STAGE_STATUS_SR_TEXT[stage.status]}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

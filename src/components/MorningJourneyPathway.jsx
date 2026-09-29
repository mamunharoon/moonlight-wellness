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

// WakeWise DEV — approved Morning pathway-tile redesign. Each stage is now
// a compact rounded tile (border + subtle tint) wrapping the same genuine
// icon-circle + label this component has always rendered - the tile is
// purely an additive visual frame, never a replacement for the existing
// Phase 9 honesty contract below. `isCurrent` drives BOTH the existing
// icon-circle badge treatment and this new tile border/background, so
// "current" reads as one coherent highlighted card, not two independently
// lit pieces.
const TILE_CLASS = Object.freeze({
  current: 'border-morning-accent bg-morning-accent-tint/10',
  default: 'border-morning-accent-tint/25 bg-morning-accent-tint/5',
});

// Direction markers — approved redesign, replacing the previous line-and-
// arrowhead JourneyConnector for Morning ONLY (Evening/Anytime/Home's own
// Anytime preview row all keep rendering the real JourneyConnector
// unchanged - see pathwayConnectors.test.js's own untouched assertions for
// those three). The approved mock-up calls for one small, standalone ">"
// between tiles - no line, no stem, no oversized arrow - so this is a bare
// Material Symbol glyph, not JourneyConnector in any variant. Purely
// decorative (aria-hidden, non-interactive) and NEVER conditioned on
// stage.status - direction markers are not outcome indicators. Inlined
// directly in the map below (not its own sub-component) so the real
// returned element tree exposes the marker's own props (aria-hidden, the
// glyph text) directly, matching this repo's established "call the
// component and inspect the real tree, no renderer" test convention
// (morningTilePathway.test.js's own dedicated coverage).
const directionMarker = (
  <span
    aria-hidden="true"
    className="material-symbols-outlined text-base text-on-surface-variant/40 shrink-0 mt-[24px]"
  >
    chevron_right
  </span>
);

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
// highlight styling (and, per the tile redesign above, the tile's own
// border/background). Omitting `stages` entirely renders every stage
// 'not_started', byte-identical to this component's original
// no-progress-prop rendering.
export const MorningJourneyPathway = ({ stages = DEFAULT_STAGES } = {}) => (
  <div
    className="overflow-x-auto scroll-hide snap-x snap-mandatory -mx-1 px-1"
    style={{
      // Approved redesign — a subtle right-edge fade hints that more tiles
      // exist once the row genuinely overflows its own container. A CSS
      // mask (not a solid-colour gradient overlay) fades the CONTENT
      // itself rather than painting over it with a guessed background
      // colour - this component renders inside several different card
      // backgrounds (Home's four card states, SessionComplete's own
      // panel), and a mask works correctly against all of them with no
      // new colour value. When the row's own content is narrower than its
      // container (`min-w-max` + `mx-auto` below already centres it in
      // that case), this fades empty trailing space only - invisible, and
      // never clips a genuinely fully-visible last tile.
      WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 28px), transparent 100%)',
      maskImage: 'linear-gradient(to right, black calc(100% - 28px), transparent 100%)',
    }}
  >
    <div className="flex items-start gap-1.5 min-w-max mx-auto" role="list" aria-label="Morning Reset steps: Focus, Stretch, Breathe, Meditate, Affirm">
      {stages.map((stage, idx) => {
        const isCurrent = stage.status === 'current';
        const badgeClass = isCurrent
          ? 'bg-morning-accent-tint/25 border-morning-accent text-morning-accent'
          : 'bg-morning-accent-tint/15 border-morning-accent-tint/30 text-morning-accent';
        const labelClass = isCurrent ? 'text-morning-accent font-bold' : 'text-on-surface-variant font-semibold';
        const tileClass = isCurrent ? TILE_CLASS.current : TILE_CLASS.default;
        return (
          <div key={stage.id} className="flex items-start gap-1.5" role="listitem">
            <div className={`flex flex-col items-center gap-1 shrink-0 min-w-[68px] snap-start rounded-2xl border px-2 py-2 ${tileClass}`}>
              <span className={`relative w-12 h-12 rounded-full border-2 flex items-center justify-center shrink-0 ${badgeClass}`}>
                <span className="material-symbols-outlined text-xl" aria-hidden="true">{stage.icon}</span>
                <StageOutcomeBadge status={stage.status} journeyTone="morning" size="lg" />
              </span>
              <span className={`text-xs leading-none whitespace-nowrap ${labelClass}`}>
                {stage.label}
                <span className="sr-only">, {STAGE_STATUS_SR_TEXT[stage.status]}</span>
              </span>
            </div>
            {idx < stages.length - 1 && directionMarker}
          </div>
        );
      })}
    </div>
  </div>
);

/* eslint-disable no-unused-vars */
import { StageOutcomeBadge } from './journey/StageOutcomeBadge';
import { EVENING_PATHWAY_STAGES } from '../session/pathwayStages';
import { STAGE_STATUS_SR_TEXT } from '../session/stageStatus';

// Evening pathway parity (Phase 13) — brings this component into exact
// structural parity with the approved MorningJourneyPathway.jsx (Phase 11/
// 12's tile-based redesign): same 5-column CSS grid (`grid-cols-5`,
// Tailwind's `repeat(5, minmax(0, 1fr))` - the `minmax(0, ...)` half is
// what actually lets each column shrink to fit 320-430px with no
// horizontal scroll, unlike a plain `1fr` column which refuses to shrink
// below its own content's intrinsic width), same rounded-square tile
// treatment, same clamp()-based responsive icon sizing, and the same
// small standalone ">" direction marker (absolutely positioned, consumes
// no grid width, replacing the previous line-and-arrowhead
// JourneyConnector) - see MorningJourneyPathway.jsx's own doc comments for
// the full rationale behind each of these. Evening keeps its own
// periwinkle tokens (`evening-accent`/`evening-accent-tint`,
// `journeyTone="evening"`) throughout - no raw colours, no Morning gold.
//
// Every icon is a real, existing Material Symbol (never an emoji) - see
// session/pathwayStages.js's own doc comment for the full per-icon
// rationale.

// Every stage 'not_started' - the exact rendering this component has
// always produced when no progress prop was supplied.
const DEFAULT_STAGES = EVENING_PATHWAY_STAGES.map(({ id, label, icon }) => ({ id, label, icon, status: 'not_started' }));

const TILE_CLASS = Object.freeze({
  current: 'border-evening-accent bg-evening-accent-tint/10',
  default: 'border-evening-accent-tint/25 bg-evening-accent-tint/5',
});

// Same approved target ranges as Morning's own tiles: icon container
// clamp(38px, 11vw, 46px), glyph clamp(20px, 5.5vw, 24px).
const ICON_CONTAINER_STYLE = { width: 'clamp(38px, 11vw, 46px)', height: 'clamp(38px, 11vw, 46px)' };
const ICON_GLYPH_STYLE = { fontSize: 'clamp(20px, 5.5vw, 24px)' };

// Direction markers — same treatment as Morning's: one small standalone
// ">" per adjacent pair (no line, no stem, no oversized arrow), purely
// decorative (aria-hidden, non-interactive), never conditioned on
// stage.status. Absolutely positioned inside the icon row's own `relative`
// wrapper so it consumes zero grid layout width and stays vertically
// centred on the icon regardless of a neighbouring card's label wrapping.
const DIRECTION_MARKER_STYLE = { right: '-8px', fontSize: 'clamp(14px, 4vw, 18px)' };

// Phase 9 — Truthful Journey Outcomes: this component's own honesty
// contract (genuine icon always visible; completion/skip/ended-early are
// each a small ADDITIVE corner badge, never a replacement of the real
// icon) is unchanged by this parity pass. Accepts the exact output shape
// of session/stageStatus.js's computeStageStatus() - NEVER infers
// completed/skipped/ended-early from step position, only from the
// caller-supplied `stages`. Omitting `stages` entirely renders every stage
// 'not_started', byte-identical to this component's original no-progress-
// prop rendering.
export const EveningJourneyPathway = ({ stages = DEFAULT_STAGES } = {}) => (
  <div className="w-full">
    <div className="grid grid-cols-5 gap-1" role="list" aria-label="Evening Wind-Down stages: Reflect, Gratitude, Breathe, Meditate, Rest">
      {stages.map((stage, idx) => {
        const isCurrent = stage.status === 'current';
        const badgeClass = isCurrent
          ? 'bg-evening-accent-tint/25 border-evening-accent text-evening-accent'
          : 'bg-evening-accent-tint/15 border-evening-accent-tint/30 text-evening-accent';
        const labelClass = isCurrent ? 'text-evening-accent font-bold' : 'text-on-surface-variant font-semibold';
        const tileClass = isCurrent ? TILE_CLASS.current : TILE_CLASS.default;
        return (
          <div key={stage.id} className="min-w-0" role="listitem">
            <div className={`flex flex-col items-center gap-1 w-full rounded-2xl border p-1 ${tileClass}`}>
              <div className="relative w-full flex items-center justify-center">
                <span className={`relative rounded-full border-2 flex items-center justify-center shrink-0 ${badgeClass}`} style={ICON_CONTAINER_STYLE}>
                  <span className="material-symbols-outlined" style={ICON_GLYPH_STYLE} aria-hidden="true">{stage.icon}</span>
                  <StageOutcomeBadge status={stage.status} journeyTone="evening" size="md" />
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

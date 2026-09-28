/* eslint-disable no-unused-vars */
import { StageOutcomeBadge } from './journey/StageOutcomeBadge';
import { JourneyConnector } from './journey/JourneyConnector';
import { EVENING_PATHWAY_STAGES } from '../session/pathwayStages';
import { STAGE_STATUS_SR_TEXT } from '../session/stageStatus';

// Evening Visual Uplift (Phase 7) — the high-level Evening Wind-Down
// pathway (Reflect -> Gratitude -> Breathe -> Meditate -> Rest), shown on
// every Evening Home card state and on the Evening Wind-Down introduction
// screen. Mirrors MorningJourneyPathway.jsx's own structural pattern
// (small icon badges, chevron separators, overflow-x-auto safety net for
// 320px).
//
// Every icon is a real, existing Material Symbol (never an emoji) - see
// session/pathwayStages.js's own doc comment for the full per-icon
// rationale.

// Every stage 'not_started' - the exact rendering this component has
// always produced when no progress prop was supplied.
const DEFAULT_STAGES = EVENING_PATHWAY_STAGES.map(({ id, label, icon }) => ({ id, label, icon, status: 'not_started' }));

// Phase 9 — Truthful Journey Outcomes: this component's own honesty
// contract (genuine icon always visible; completion/skip/ended-early are
// each a small ADDITIVE corner badge, never a replacement of the real
// icon) was already established in Phase 7 - see git history for that
// rationale. Phase 9 makes the contract real: it now accepts a `stages`
// prop, the exact output shape of session/stageStatus.js's
// computeStageStatus(), which is genuinely populated by real callers
// (Home.jsx, EveningWindDown.jsx, PrepareForRest.jsx, EveningComplete.jsx)
// from the Session Engine's own stepOutcomes map - Phase 7's gap ("no
// caller populates stageStatus, because no reliable source exists") is
// closed. NEVER infers completed/skipped/ended-early from step position -
// only from the caller-supplied `stages`. `status: 'current'` (which
// stage the real session is on right now) only ever changes the main
// badge's own ring/highlight styling, never the rendered icon glyph.
// Omitting `stages` entirely renders every stage 'not_started',
// byte-identical to this component's original no-progress-prop
// rendering.
export const EveningJourneyPathway = ({ stages = DEFAULT_STAGES } = {}) => (
  <div className="overflow-x-auto scroll-hide -mx-1 px-1">
    <div className="flex items-start justify-between gap-0.5 min-w-max mx-auto" role="list" aria-label="Evening Wind-Down stages: Reflect, Gratitude, Breathe, Meditate, Rest">
      {stages.map((stage, idx) => {
        const isCurrent = stage.status === 'current';
        const badgeClass = isCurrent
          ? 'bg-evening-accent-tint/25 border-evening-accent text-evening-accent'
          : 'bg-evening-accent-tint/15 border-evening-accent-tint/30 text-evening-accent';
        const labelClass = isCurrent ? 'text-evening-accent font-bold' : 'text-on-surface-variant font-semibold';
        return (
          <div key={stage.id} className="flex items-start gap-0.5" role="listitem">
            <div className="flex flex-col items-center gap-1 w-11">
              <span className={`relative w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${badgeClass}`}>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">{stage.icon}</span>
                <StageOutcomeBadge status={stage.status} journeyTone="evening" />
              </span>
              <span className={`text-[9px] leading-none whitespace-nowrap ${labelClass}`}>
                {stage.label}
                <span className="sr-only">, {STAGE_STATUS_SR_TEXT[stage.status]}</span>
              </span>
            </div>
            {idx < stages.length - 1 && (
              /* w-7 h-7 (28px) icon circle - centre at 14px; connector is
                 11px tall (half = 5.5px) - 14 - 5.5 = 8.5px top margin
                 centres it exactly on the icon circle, not the label. */
              <JourneyConnector journeyTone="evening" className="mt-[8.5px]" />
            )}
          </div>
        );
      })}
    </div>
  </div>
);

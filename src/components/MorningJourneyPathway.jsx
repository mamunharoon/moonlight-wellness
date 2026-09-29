/* eslint-disable no-unused-vars */
import { StageOutcomeBadge } from './journey/StageOutcomeBadge';
import { JourneyConnector } from './journey/JourneyConnector';
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

// 320px structural safety — five columns of the now-substantially-larger
// (56px) icon circles plus four connectors measure comfortably wider
// than a 320px viewport's real available width once the card's own p-5
// padding is subtracted. Per the physical-iPhone correction's own
// explicit requirement ("preserve useful icon size... allow the pathway
// to scroll horizontally rather than shrinking it until ineffective"),
// this is intentional: `overflow-x-auto scroll-hide` (below) is the
// primary, deliberate accommodation here, not a fallback safety net —
// the icons never shrink below a legible size to force a fit.
//
// Morning pathway icon uplift (physical-iPhone correction) — the
// previous 28px icon circles/14px glyphs/9px labels read as "too small,
// no visual journey" on a physical device against the approved Stitch
// direction's own larger, bolder stage cards. Bumped to 56px circles
// (w-14 h-14), 24px glyphs (text-2xl) and 12px labels (text-xs) - a real,
// substantial size increase, not a cosmetic tweak - while keeping every
// other part of the Phase 9 honesty contract byte-identical: the genuine
// icon is still always the primary visual, in every status, and
// completed/skipped/ended-early are still only ever an ADDITIVE corner
// badge (now StageOutcomeBadge's own `size="lg"` variant, scaled to
// match). JourneyConnector's own `size="lg"` variant bridges the larger
// gap between these bigger circles - see that file's own doc comment.
// No duration/minutes, no percentage, no streak - this pass touches
// only icon/connector/label geometry.
//
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
// highlight styling. Omitting `stages` entirely renders every stage
// 'not_started', byte-identical to this component's original
// no-progress-prop rendering.
export const MorningJourneyPathway = ({ stages = DEFAULT_STAGES } = {}) => (
  <div className="overflow-x-auto scroll-hide -mx-1 px-1">
    <div className="flex items-start justify-between gap-1.5 min-w-max mx-auto" role="list" aria-label="Morning Reset steps: Focus, Stretch, Breathe, Meditate, Affirm">
      {stages.map((stage, idx) => {
        const isCurrent = stage.status === 'current';
        const badgeClass = isCurrent
          ? 'bg-morning-accent-tint/25 border-morning-accent text-morning-accent'
          : 'bg-morning-accent-tint/15 border-morning-accent-tint/30 text-morning-accent';
        const labelClass = isCurrent ? 'text-morning-accent font-bold' : 'text-on-surface-variant font-semibold';
        return (
          <div key={stage.id} className="flex items-start gap-1.5" role="listitem">
            <div className="flex flex-col items-center gap-1.5 w-16">
              <span className={`relative w-14 h-14 rounded-full border-2 flex items-center justify-center shrink-0 ${badgeClass}`}>
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">{stage.icon}</span>
                <StageOutcomeBadge status={stage.status} journeyTone="morning" size="lg" />
              </span>
              <span className={`text-xs leading-none whitespace-nowrap ${labelClass}`}>
                {stage.label}
                <span className="sr-only">, {STAGE_STATUS_SR_TEXT[stage.status]}</span>
              </span>
            </div>
            {idx < stages.length - 1 && (
              /* w-14 h-14 (56px) icon circle - centre at 28px; the "lg"
                 connector is 14px tall (half = 7px) - 28 - 7 = 21px top
                 margin centres it exactly on the icon circle, not the
                 label. */
              <JourneyConnector journeyTone="morning" size="lg" className="mt-[21px]" />
            )}
          </div>
        );
      })}
    </div>
  </div>
);

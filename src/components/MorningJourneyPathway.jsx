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

// 320px structural safety — five columns plus four chevrons at a
// comfortable size (w-9 badges, gap-1 throughout) measure wider than a
// 320px viewport's real available width once the card's own p-5 padding
// is subtracted (confirmed by hand: 5*48px badge columns + 4 chevrons +
// gaps ≈ 340px, against a ~248px budget at 320px). Two changes, both
// matching this codebase's own established narrow-screen pattern
// (ProgressIndicator.jsx's own compact review-chip row): smaller badges/
// tighter gaps as the primary fix, PLUS `overflow-x-auto` as the safety
// net so the row can never visually break the card even on a device
// narrower than tested - it simply scrolls horizontally in that case,
// exactly like ProgressIndicator's own precedent.
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
    <div className="flex items-start justify-between gap-0.5 min-w-max mx-auto" role="list" aria-label="Morning Reset steps: Focus, Stretch, Breathe, Meditate, Affirm">
      {stages.map((stage, idx) => {
        const isCurrent = stage.status === 'current';
        const badgeClass = isCurrent
          ? 'bg-morning-accent-tint/25 border-morning-accent text-morning-accent'
          : 'bg-morning-accent-tint/15 border-morning-accent-tint/30 text-morning-accent';
        const labelClass = isCurrent ? 'text-morning-accent font-bold' : 'text-on-surface-variant font-semibold';
        return (
          <div key={stage.id} className="flex items-start gap-0.5" role="listitem">
            <div className="flex flex-col items-center gap-1 w-11">
              <span className={`relative w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${badgeClass}`}>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">{stage.icon}</span>
                <StageOutcomeBadge status={stage.status} journeyTone="morning" />
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
              <JourneyConnector journeyTone="morning" className="mt-[8.5px]" />
            )}
          </div>
        );
      })}
    </div>
  </div>
);

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
// this app for the same concept (never an emoji): `air` mirrors Home's own
// Breathe quick-action tile icon, `spa` mirrors Home's own Meditate
// quick-action tile icon, `auto_awesome` mirrors Affirmation.jsx's own
// sparkle icon - reused here rather than invented. `flag` (Focus) and
// `self_improvement` (Stretch) are the closest existing-vocabulary
// Material Symbols for those two steps, matching every other choice's
// "real Material Symbol, not a fabricated one" standard.
const STEPS = [
  { label: 'Focus', icon: 'flag' },
  { label: 'Stretch', icon: 'self_improvement' },
  { label: 'Breathe', icon: 'air' },
  { label: 'Meditate', icon: 'spa' },
  { label: 'Affirm', icon: 'auto_awesome' }
];

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
// Physical-iPhone correction — the pathway previously only ever appeared
// on the not-started Morning card; the in-progress and completed cards
// never rendered it at all, so a device that landed on either of those
// two states (the tested phone showed the completed card) saw no pathway.
// `currentStepNumber` (additive, optional) makes this same one component
// state-aware instead of adding a second implementation or a competing
// progress store - it is read-only presentation derived from Home.jsx's
// own EXISTING resolved step index (MORNING_DISPLAY_STEP_NUMBERS, the
// same source ProgressIndicator.jsx already uses), never a new state
// source:
//   - omitted/undefined -> not-started: every step renders in its
//     original plain/upcoming look, byte-identical to before this prop
//     existed.
//   - 1-5 -> in-progress: steps before it are marked completed (checked),
//     the step at that number is marked current (highlighted), steps
//     after it stay in the plain/upcoming look.
//   - 6 (past the last real step) -> completed: every one of the 5 steps
//     satisfies "before it", so all five render as completed/checked -
//     one shared code path, no separate "completed" branch needed.
// Completed/current are communicated by more than colour alone: a real
// check icon replaces the activity icon for completed steps, and an
// sr-only suffix ("- completed"/"- current") is announced per step for
// assistive tech, alongside the always-visible text label.
export const MorningJourneyPathway = ({ currentStepNumber } = {}) => (
  <div className="overflow-x-auto scroll-hide -mx-1 px-1">
    <div className="flex items-start justify-between gap-0.5 min-w-max mx-auto" role="list" aria-label="Morning Reset steps: Focus, Stretch, Breathe, Meditate, Affirm">
      {STEPS.map((step, idx) => {
        const stepNumber = idx + 1;
        const isCompleted = currentStepNumber != null && stepNumber < currentStepNumber;
        const isCurrent = currentStepNumber != null && stepNumber === currentStepNumber;
        const badgeClass = isCompleted
          ? 'bg-morning-accent border-morning-accent text-on-morning-accent'
          : isCurrent
            ? 'bg-morning-accent-tint/25 border-morning-accent text-morning-accent'
            : 'bg-morning-accent-tint/15 border-morning-accent-tint/30 text-morning-accent';
        const labelClass = isCurrent
          ? 'text-morning-accent font-bold'
          : 'text-on-surface-variant font-semibold';
        return (
          <div key={step.label} className="flex items-center gap-0.5" role="listitem">
            <div className="flex flex-col items-center gap-1 w-11">
              <span className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${badgeClass}`}>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">{isCompleted ? 'check' : step.icon}</span>
              </span>
              <span className={`text-[9px] leading-none whitespace-nowrap ${labelClass}`}>
                {step.label}
                {(isCompleted || isCurrent) && (
                  <span className="sr-only">{isCompleted ? ' - completed' : ' - current'}</span>
                )}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <span className="material-symbols-outlined text-on-surface-variant/30 text-xs -mt-4 shrink-0" aria-hidden="true">chevron_right</span>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

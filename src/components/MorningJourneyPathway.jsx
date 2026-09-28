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
export const MorningJourneyPathway = () => (
  <div className="overflow-x-auto scroll-hide -mx-1 px-1">
    <div className="flex items-start justify-between gap-0.5 min-w-max mx-auto" role="list" aria-label="Morning Reset steps: Focus, Stretch, Breathe, Meditate, Affirm">
      {STEPS.map((step, idx) => (
        <div key={step.label} className="flex items-center gap-0.5" role="listitem">
          <div className="flex flex-col items-center gap-1 w-11">
            <span className="w-7 h-7 rounded-full bg-morning-accent-tint/15 border border-morning-accent-tint/30 text-morning-accent flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">{step.icon}</span>
            </span>
            <span className="text-[9px] font-semibold text-on-surface-variant leading-none whitespace-nowrap">{step.label}</span>
          </div>
          {idx < STEPS.length - 1 && (
            <span className="material-symbols-outlined text-on-surface-variant/30 text-xs -mt-4 shrink-0" aria-hidden="true">chevron_right</span>
          )}
        </div>
      ))}
    </div>
  </div>
);

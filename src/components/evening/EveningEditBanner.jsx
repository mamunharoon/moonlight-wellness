/*
 * Edit Tonight's Responses (Build 15) — EveningEditBanner
 *
 * Purely informational, unlike EveningReviewBanner (which also renders a
 * "return to summary" action). Deliberately has no button of its own:
 * Edit Mode already has exactly two guarded exits (the shared BackButton
 * on question 1, and the explicit Cancel action below the question
 * card) - a third, unguarded exit here would bypass the unsaved-changes
 * confirmation both of those honour.
 */
export const EveningEditBanner = () => (
  <div className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3 border-primary/20 bg-primary/5">
    <span className="material-symbols-outlined text-primary text-lg shrink-0" aria-hidden="true">
      edit
    </span>
    <p className="text-xs text-on-surface-variant">
      <span className="font-bold text-primary">Editing</span> tonight&rsquo;s responses.
    </p>
  </div>
);

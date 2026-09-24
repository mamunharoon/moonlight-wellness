/*
 * Edit Tonight's Responses (Build 15) — EveningEditBanner
 *
 * Purely informational, unlike EveningReviewBanner (which also renders a
 * "return to summary" action). Deliberately has no button of its own:
 * Edit Mode already has exactly two guarded exits (the shared BackButton
 * on question 1, and the explicit Cancel action below the question
 * card) - a third, unguarded exit here would bypass the unsaved-changes
 * confirmation both of those honour.
 *
 * Evening Visual Uplift (Build 17) — genuinely Evening-exclusive, same as
 * EveningReviewBanner.jsx (see its matching comment) - restrained
 * periwinkle border/tint/icon/label, no shared default touched.
 */
export const EveningEditBanner = () => (
  <div className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3 border-evening-accent/20 bg-evening-accent/5">
    <span className="material-symbols-outlined text-evening-accent text-lg shrink-0" aria-hidden="true">
      edit
    </span>
    <p className="text-xs text-on-surface-variant">
      <span className="font-bold text-evening-accent">Editing</span> tonight&rsquo;s responses.
    </p>
  </div>
);

/*
 * Evening completed-review — EveningReviewBanner
 *
 * Deliberately NOT a reuse of the existing ReviewModeBanner.jsx: that
 * component's copy ("your place is still {step}") describes reviewing an
 * EARLIER STEP OF A STILL-LIVE session - there is no "place" to return to
 * once the whole journey is completed and the Session Engine has been
 * reset (see Phase 1 report §7/§17). This banner's wording is honest
 * about what's actually true here: the journey is over, this is a
 * read-only look back at what was saved, and there is nothing to resume.
 *
 * Pure presentation - `onReturn` is a plain navigate() the calling page
 * owns (see ReflectionReview.jsx/GratitudeReview.jsx's own "Return to
 * Evening Summary" handling).
 *
 * `onEdit` (Build 15 Evening UX correction, additive - optional, so a
 * caller that omits it keeps the original single-button banner exactly):
 * the one entry point into the existing safe Edit Mode reachable from
 * anywhere inside Review, satisfying "Review or Edit Tonight's
 * Responses" on EveningComplete.jsx/Home.jsx without making Review
 * editable by default - Review itself is always read-only; this button
 * only ever navigates to /edit/evening?q=1, still a completely separate
 * mode. Label/status stack above the actions, and the two actions sit in
 * their own flex-wrap row (never squeezed onto the label's own line), so
 * at 320px both remain fully visible with no truncation and can wrap to
 * their own lines without crowding - each carries an explicit
 * min-h-[44px] regardless of its compact text-xs label.
 */
export const EveningReviewBanner = ({ onReturn, onEdit }) => (
  <div className="glass-panel rounded-2xl px-4 py-3 space-y-3 border-primary/20 bg-primary/5">
    <p className="text-xs text-on-surface-variant">
      <span className="font-bold text-primary">Reviewing</span> tonight's completed journey.
    </p>
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onReturn}
        className="min-h-[44px] px-3 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
      >
        Evening Summary
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="min-h-[44px] px-3 py-2 rounded-full glass-panel text-on-surface text-xs font-bold hover:bg-white/10 active:scale-95 transition-all border-white/10"
        >
          Edit Tonight's Responses
        </button>
      )}
    </div>
  </div>
);

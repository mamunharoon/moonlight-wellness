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
 * Pure presentation - `onReturn` is the only behaviour, a plain
 * navigate() the calling page owns (see ReflectionReview.jsx/
 * GratitudeReview.jsx's own "Return to Evening Summary" handling).
 */
export const EveningReviewBanner = ({ onReturn }) => (
  <div className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between gap-3 border-primary/20 bg-primary/5">
    <p className="text-xs text-on-surface-variant">
      <span className="font-bold text-primary">Reviewing</span> tonight's completed journey.
    </p>
    <button
      type="button"
      onClick={onReturn}
      className="shrink-0 px-3 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
    >
      Evening Summary
    </button>
  </div>
);

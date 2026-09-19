/*
 * Safe backward navigation ("Review Mode") — shown at the top of every
 * Morning/Evening step page whenever useStepReviewMode reports
 * isReviewMode: true (currentStep.id differs from this page's own step
 * id). `currentStepLabel` is the plain-English name of the step the
 * engine is actually still on; tapping the action is a plain
 * navigate() to that step's own route (see useReviewNavigation) — it
 * never touches stepIndex or any other session state itself.
 */
export const ReviewModeBanner = ({ currentStepLabel, onReturnToCurrentStep }) => (
  <div className="glass-panel rounded-2xl px-4 py-3 flex items-center justify-between gap-3 border-primary/20 bg-primary/5">
    <p className="text-xs text-on-surface-variant">
      <span className="font-bold text-primary">Reviewing</span> — your place is still {currentStepLabel}.
    </p>
    <button
      type="button"
      onClick={onReturnToCurrentStep}
      className="shrink-0 px-3 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
    >
      Return to {currentStepLabel}
    </button>
  </div>
);

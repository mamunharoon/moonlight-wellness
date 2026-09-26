/*
 * Safe backward navigation ("Review Mode") — shown at the top of every
 * Morning/Evening step page whenever useStepReviewMode reports
 * isReviewMode: true (currentStep.id differs from this page's own step
 * id). `currentStepLabel` is the plain-English name of the step the
 * engine is actually still on; tapping the action is a plain
 * navigate() to that step's own route (see useReviewNavigation) — it
 * never touches stepIndex or any other session state itself.
 *
 * Evening journey-theme correction — this genuinely shared, journey-
 * agnostic banner (Morning/Evening alike) previously had no accent
 * mechanism at all, always peach; found live on Reflection.jsx/
 * Gratitude.jsx, whose own "Return to Breathe" (its real rendered text
 * when currentStep.id is 'breathing') read as generic peach against an
 * otherwise all-periwinkle Evening screen. `journeyTone` is additive,
 * default 'primary' - the exact original peach classes, byte-identical
 * for every existing caller (Morning's Breathe.jsx/MorningFlow.jsx/
 * Affirmation.jsx/IntentionSetup.jsx, and every OTHER Evening step page
 * this component is used on) - only Reflection.jsx/Gratitude.jsx pass
 * "evening" explicitly, the two screens this correction actually covers.
 * The "Return to X" action is deliberately a periwinkle-TINTED/outline
 * treatment, not the solid bg-evening-accent primary-action fill used
 * elsewhere - on Reflection/Gratitude this banner sits above
 * PromptStepper's own solid-periwinkle Next/Continue button on the same
 * screen, and a second solid fill would compete with it rather than read
 * as the secondary, review-only action it actually is.
 */
const TONE_TOKENS = {
  primary: {
    container: 'border-primary/20 bg-primary/5',
    label: 'text-primary',
    action: 'bg-primary text-on-primary hover:opacity-90'
  },
  evening: {
    container: 'border-evening-accent-tint/20 bg-evening-accent-tint/5',
    label: 'text-evening-accent',
    action: 'bg-evening-accent-tint/15 text-evening-accent border border-evening-accent hover:bg-evening-accent-tint/25'
  }
};

export const ReviewModeBanner = ({ currentStepLabel, onReturnToCurrentStep, journeyTone = 'primary' }) => {
  const tokens = TONE_TOKENS[journeyTone] ?? TONE_TOKENS.primary;

  return (
    <div className={`glass-panel rounded-2xl px-4 py-3 flex items-center justify-between gap-3 ${tokens.container}`}>
      <p className="text-xs text-on-surface-variant">
        <span className={`font-bold ${tokens.label}`}>Reviewing</span> — your place is still {currentStepLabel}.
      </p>
      <button
        type="button"
        onClick={onReturnToCurrentStep}
        className={`shrink-0 px-3 py-2 rounded-full ${tokens.action} text-xs font-bold active:scale-95 transition-all`}
      >
        Return to {currentStepLabel}
      </button>
    </div>
  );
};

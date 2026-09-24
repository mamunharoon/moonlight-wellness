/*
 * Build 15 release-quality pass — AnytimeResetProgress
 *
 * A dedicated, separate progress component for AnytimeReset.jsx only -
 * JourneyHeader.jsx's own dots (shared with Meditate.jsx, which passes
 * the identical stepIndex/stepCount={3}) are completely untouched.
 * AnytimeReset.jsx renders JourneyHeader without stepIndex/stepCount (so
 * its dot block never activates) and this component separately,
 * immediately below it.
 *
 * Three full-width, clearly visible segments (not JourneyHeader's small
 * dots) plus a visible "Step X of 3" label - the sr-only-only text on
 * the old shared dots was judged too subtle. Real progressbar semantics:
 * role="progressbar", aria-valuemin/aria-valuemax/aria-valuenow, and an
 * accessible label - this repo had no earlier role="progressbar"
 * precedent, which is not a reason to avoid the correct ARIA role here.
 *
 * Colours: current = primary (WakeWise peach), completed = primary/50,
 * upcoming = the existing `outline` token (~5.85:1 against the page
 * background - real computed WCAG contrast, see
 * anytimeResetProgress.test.js - replacing the old shared dots' white/15
 * upcoming colour, which measured only ~1.54:1 against the same
 * background). A fixed height is always reserved (exactly stepCount
 * segments render regardless of step), so there is no layout shift.
 */
export const AnytimeResetProgress = ({ stepIndex, stepCount }) => (
  <div role="progressbar" aria-valuemin={1} aria-valuemax={stepCount} aria-valuenow={stepIndex + 1} aria-label="Anytime Reset progress" className="space-y-2">
    <p className="text-xs font-bold text-on-surface-variant text-center">{`Step ${stepIndex + 1} of ${stepCount}`}</p>
    <div className="flex items-center gap-1.5">
      {Array.from({ length: stepCount }).map((_, i) => (
        <span
          key={i}
          className={`flex-1 h-2 rounded-full transition-colors duration-200 ${
            i === stepIndex ? 'bg-primary' : i < stepIndex ? 'bg-primary/50' : 'bg-outline'
          }`}
        />
      ))}
    </div>
  </div>
);

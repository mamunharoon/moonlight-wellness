/* eslint-disable no-unused-vars */
import { BackButton } from '../BackButton';

/*
 * WakeWise — Build 15 Phase B — shared journey header.
 *
 * Extracted from AnytimeReset.jsx's own header block (Meditate.jsx has
 * the byte-identical shape) — both pages already rendered the same
 * "shared BackButton on step 1, a local step-back arrow on later steps,
 * plus a Close button" pattern independently. Pure presentation: every
 * click still resolves to a handler the OWNING page passes in, so
 * neither page's own step machine, auth flow, or navigation logic moves
 * here — this component holds no state and makes no decisions about
 * what Back/Close/step actually do.
 *
 * `stepIndex`/`stepCount` are optional and purely additive: when
 * `stepCount > 1` a row of progress dots renders under the Back/Close
 * row (the "progress through the steps" requirement for both journeys).
 * Selected/completed state is conveyed by dot WIDTH and colour together
 * (the active dot is both wider and filled), never colour alone, and a
 * visually-hidden "Step X of Y" string keeps it accurate for VoiceOver
 * even though the dots themselves are `aria-hidden`.
 */
export const JourneyHeader = ({
  showBackButton,
  backFallback = '/',
  onStepBack,
  onClose,
  stepIndex,
  stepCount
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      {showBackButton ? (
        <BackButton fallback={backFallback} />
      ) : (
        <button
          type="button"
          onClick={onStepBack}
          aria-label="Go back"
          className="w-11 h-11 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="w-11 h-11 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="material-symbols-outlined text-on-surface-variant">close</span>
      </button>
    </div>

    {stepCount > 1 && (
      <div className="flex items-center justify-center gap-1.5">
        <span className="sr-only">{`Step ${stepIndex + 1} of ${stepCount}`}</span>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: stepCount }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === stepIndex
                  ? 'w-6 bg-primary'
                  : i < stepIndex
                    ? 'w-1.5 bg-primary/50'
                    : 'w-1.5 bg-white/15'
              }`}
            />
          ))}
        </div>
      </div>
    )}
  </div>
);

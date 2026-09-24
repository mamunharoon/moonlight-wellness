/* eslint-disable react-refresh/only-export-components -- getSegmentClassName
   is exported alongside AnytimeResetProgress specifically so the Phase 2
   regression test can call it directly with real (index, stepIndex) pairs
   instead of regex-matching JSX source (see anytimeResetProgress.test.js). */
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
 * Anytime Reset Visual Uplift (Phase 2, approved decisions A/D) — recolours
 * this bar from peach to mint AND fixes a real, verified defect found
 * during the Phase 1 audit: the old completed-segment colour, `bg-primary/
 * 50`, rendered fully transparent in production (rgba(0,0,0,0)) because
 * --color-primary is a plain hex string with no Tailwind opacity-modifier
 * support (see src/index.css's --color-tertiary-tint comment for the full
 * root cause). The fix is narrowly scoped to this file's own new
 * --color-tertiary-tint token - --color-primary itself is untouched, and
 * every other `primary/NN` utility across the app (flagged as a separate,
 * wider follow-up in the Phase 1 report) is left exactly as it was.
 *
 * Segment classes are computed by the exported getSegmentClassName, kept
 * as a plain, independently-testable function (per the approved Phase 2
 * requirement to test computed/renderable classes, not only source
 * strings) - anytimeResetProgress.test.js imports and calls it directly
 * with real stepIndex/index combinations rather than regex-matching JSX.
 *
 * Distinguishable by more than colour, approved decision D: the active
 * segment is also taller (h-2.5 vs h-2) - a genuine shape difference, not
 * just a fill change - and the completed segments carry a visible border
 * the upcoming segments do not. This is on top of the "Step X of 3" text
 * label above, which already names the current step in words.
 *
 *   - upcoming (i > stepIndex):  h-2, bg-outline, no border
 *   - completed (i < stepIndex): h-2, bg-tertiary-tint/55, border-tertiary/40
 *   - active (i === stepIndex):  h-2.5, bg-tertiary, no border
 */
const SEGMENT_BASE = 'flex-1 rounded-full transition-all duration-200 border';

export const getSegmentClassName = (index, stepIndex) => {
  if (index === stepIndex) {
    return `${SEGMENT_BASE} h-2.5 bg-tertiary border-transparent`;
  }
  if (index < stepIndex) {
    return `${SEGMENT_BASE} h-2 bg-tertiary-tint/55 border-tertiary/40`;
  }
  return `${SEGMENT_BASE} h-2 bg-outline border-transparent`;
};

export const AnytimeResetProgress = ({ stepIndex, stepCount }) => (
  <div role="progressbar" aria-valuemin={1} aria-valuemax={stepCount} aria-valuenow={stepIndex + 1} aria-label="Anytime Reset progress" className="space-y-2">
    <p className="text-xs font-bold text-on-surface-variant text-center">{`Step ${stepIndex + 1} of ${stepCount}`}</p>
    <div className="flex items-center gap-1.5">
      {Array.from({ length: stepCount }).map((_, i) => (
        <span key={i} className={getSegmentClassName(i, stepIndex)} />
      ))}
    </div>
  </div>
);

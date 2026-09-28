// "Your Momentum" foundation, Phase 3 — the ONE shared presentational
// component for a completion screen's factual insight + optional gentle
// milestone. Pure rendering only (no query, no calculation - see
// momentumQueries.js/momentumInsights.js for those); a caller that has no
// insight and no milestone renders nothing at all, so an untracked
// activity (Anytime Reset, standalone/self-guided meditation, Morning
// Stretch alone, Support/Grounding/Stress Release/Panic) that never calls
// the momentum hooks in the first place is completely unaffected by this
// component's mere existence in the tree.
//
// Accessibility order: this component renders factual insight, THEN the
// optional milestone - callers are responsible for placing it after their
// own existing rotating greeting and before their own existing primary
// action in the JSX, so VoiceOver's natural document-order reading
// matches the approved sequence (greeting -> insight -> milestone ->
// action) without any explicit tabindex/focus management of its own. No
// aria-live/role="status" is added here deliberately - this content is
// set exactly once per genuine completion (see useMomentumCompletion.js)
// and never mutates afterward for the same mount, so there is nothing to
// re-announce; adding a live region here would risk a second, redundant
// announcement alongside a caller's own existing status region (e.g.
// BetaVideoModal.jsx's overlay wrapper, which already carries
// role="status").
//
// Text size: the factual insight uses `text-base` (16px), meeting the
// approved ~15-16px minimum. The milestone's own label is `text-sm`
// (14px, matching every other secondary/supporting line already used on
// these screens) - only the factual insight itself carries the explicit
// minimum-size requirement.
const MILESTONE_TONE_CLASSES = Object.freeze({
  morning: { border: 'border-morning-accent-tint/25', label: 'text-morning-accent' },
  evening: { border: 'border-evening-accent-tint/25', label: 'text-evening-accent' },
  anytime: { border: 'border-tertiary-tint/25', label: 'text-tertiary' }
});

const DEFAULT_TONE = { border: 'border-white/15', label: 'text-primary' };

export const MomentumPanel = ({ insight, milestone }) => {
  if (!insight && !milestone) return null;

  const tone = milestone ? (MILESTONE_TONE_CLASSES[milestone.journeyTone] ?? DEFAULT_TONE) : DEFAULT_TONE;

  return (
    <div className="w-full max-w-sm mx-auto space-y-3">
      {insight && (
        <p className="text-center text-base text-on-surface-variant font-medium leading-relaxed">
          {insight}
        </p>
      )}
      {milestone && (
        <div className={`glass-panel rounded-2xl p-4 text-center space-y-1 border ${tone.border}`}>
          <span className={`font-label-sm text-[10px] uppercase tracking-widest font-bold ${tone.label}`}>
            A Gentle Milestone
          </span>
          <p className="text-sm font-semibold text-on-surface">{milestone.label}</p>
          {milestone.supportingLine && (
            <p className="text-xs text-on-surface-variant">{milestone.supportingLine}</p>
          )}
        </div>
      )}
    </div>
  );
};

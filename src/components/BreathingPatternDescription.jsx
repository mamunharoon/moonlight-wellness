import { formatCadence, formatBreathingDuration } from '../lib/breathingPatterns';

// Build 16 physical-iPhone correction (F5) — the compact 2-column pattern
// grid (BreathingPatternRow's `compact` variant) intentionally omits each
// card's own cadence/duration to stay small. This is the one shared place
// that information now lives: the currently SELECTED pattern's complete
// cadence and exact duration, shown once, directly below the grid -
// never repeated inside every card. Shared verbatim across standalone
// Breathe, Morning Breathe, and Evening Breathing so the three screens
// can never drift on wording/format.
export const BreathingPatternDescription = ({ pattern }) => (
  <div className="text-center space-y-1 px-2" role="status" aria-live="polite">
    <p className="text-sm font-bold text-on-surface">{pattern.label}</p>
    <p className="text-xs text-on-surface-variant">{formatCadence(pattern)}</p>
    <p className="text-[11px] text-on-surface-variant/70 font-semibold uppercase tracking-wide">{formatBreathingDuration(pattern.totalSeconds)}</p>
  </div>
);

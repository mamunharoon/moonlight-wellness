// Build 15 — the three real breathing cadences this app has ever
// actually shipped, extracted into one shared, side-effect-free
// configuration so labels, cadence timing, and total duration can never
// drift between Morning Breathe, Evening Breathing, and standalone
// Breathe. Every value here is copied verbatim from each screen's own
// existing, already-shipped implementation - nothing invented, nothing
// renamed to a fabricated Stitch label:
//   - Breathe.jsx (Morning): "Deep Belly Breath (4-4-6)", 56s total.
//   - EveningBreathing.jsx: 4-7-8, 76s total (its own doc comment already
//     named this cadence explicitly).
//   - QuietBreathing.jsx: 4-4-8, 64s total.
//
// `label` uses the approved factual naming ("4-4-6 Breathing" etc.) so a
// pattern picker can show real, honest names rather than a screen-
// specific nickname. `supportingLabel` is kept ONLY on the one pattern
// it has always accurately described (Morning's own "Deep Belly Breath")
// - never applied to a pattern it wasn't written for, so it can never
// become inaccurate if a different pattern is selected on a screen that
// offers a choice.
export const BREATHING_PATTERNS = [
  {
    id: 'morning',
    label: '4-4-6 Breathing',
    supportingLabel: 'Deep Belly Breath',
    inhaleSeconds: 4,
    holdSeconds: 4,
    exhaleSeconds: 6,
    cycleSeconds: 14,
    totalCycles: 4,
    totalSeconds: 56
  },
  {
    id: 'evening',
    label: '4-7-8 Breathing',
    supportingLabel: null,
    inhaleSeconds: 4,
    holdSeconds: 7,
    exhaleSeconds: 8,
    cycleSeconds: 19,
    totalCycles: 4,
    totalSeconds: 76
  },
  {
    id: 'quiet',
    label: '4-4-8 Breathing',
    supportingLabel: null,
    inhaleSeconds: 4,
    holdSeconds: 4,
    exhaleSeconds: 8,
    cycleSeconds: 16,
    totalCycles: 4,
    totalSeconds: 64
  }
];

export const getBreathingPatternById = (id) => BREATHING_PATTERNS.find((p) => p.id === id) ?? null;

// The exact phase-cycling arithmetic already proven identically (with
// different numeric cadences) in Breathe.jsx/EveningBreathing.jsx/
// QuietBreathing.jsx's own inline countdown effects - centralised here so
// every caller shares one implementation instead of three independently
// hand-rolled copies of the same modulo logic that could silently drift
// apart. Verified to reproduce each screen's own exact original cutoffs:
//   - 4-4-6: cycleTime<4 Inhale, <8 Hold, else Exhale (matches Breathe.jsx)
//   - 4-7-8: cycleTime<4 Inhale, <11 Hold, else Exhale (matches EveningBreathing.jsx)
//   - 4-4-8: cycleTime<4 Inhale, <8 Hold, else Exhale (matches QuietBreathing.jsx)
export const resolveBreathPhase = (pattern, secondsLeft) => {
  const cycleTime = (pattern.totalSeconds - secondsLeft) % pattern.cycleSeconds;
  if (cycleTime < pattern.inhaleSeconds) return 'Inhale';
  if (cycleTime < pattern.inhaleSeconds + pattern.holdSeconds) return 'Hold';
  return 'Exhale';
};

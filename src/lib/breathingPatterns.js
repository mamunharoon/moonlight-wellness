// Build 15 — the five real breathing cadences this app offers (the
// original three this app has ever actually shipped, plus Box/Coherent
// added in the same Build 15 window), extracted into one shared,
// side-effect-free configuration so labels, cadence timing, and total
// duration can never drift between Morning Breathe, Evening Breathing,
// and standalone Breathe. The original three values are copied verbatim
// from each screen's own existing, already-shipped implementation -
// nothing invented, nothing renamed to a fabricated Stitch label:
//   - Breathe.jsx (Morning): "Deep Belly Breath (4-4-6)", 56s total.
//   - EveningBreathing.jsx: 4-7-8, 76s total (its own doc comment already
//     named this cadence explicitly).
//   - QuietBreathing.jsx: 4-4-8, 64s total.
// Box Breathing / Coherent Breathing (approved addition) use real,
// standard cadences (4-4-4-4 box breathing; 5-5 coherent/resonant
// breathing) - not invented numbers.
//
// `label` uses the approved factual naming ("4-4-6 Breathing" etc.) so a
// pattern picker can show real, honest names rather than a screen-
// specific nickname. `supportingLabel` is kept ONLY on the one pattern
// it has always accurately described (Morning's own "Deep Belly Breath")
// - never applied to a pattern it wasn't written for, so it can never
// become inaccurate if a different pattern is selected on a screen that
// offers a choice. `null` elsewhere - never rendered as the text "null"
// or as blank spacing by any consumer (BreathingPatternRow.jsx never
// reads this field at all; Breathe.jsx's own active-exercise badge
// already guards it with `pattern.supportingLabel ? ... : pattern.label`).
//
// `holdAfterExhaleSeconds` (approved addition) - explicit on every
// pattern, `0` for the original three and for Coherent (no second hold
// at all), `4` for Box only. Keeping this an explicit field (never
// omitted/undefined) matches this file's own existing convention of
// explicit, non-implicit fields (see `supportingLabel: null` above) and
// is what lets resolveBreathPhase's own arithmetic below treat every
// pattern uniformly, with no special-casing per id.
export const BREATHING_PATTERNS = [
  {
    id: 'morning',
    label: '4-4-6 Breathing',
    supportingLabel: 'Deep Belly Breath',
    inhaleSeconds: 4,
    holdSeconds: 4,
    exhaleSeconds: 6,
    holdAfterExhaleSeconds: 0,
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
    holdAfterExhaleSeconds: 0,
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
    holdAfterExhaleSeconds: 0,
    cycleSeconds: 16,
    totalCycles: 4,
    totalSeconds: 64
  },
  {
    id: 'box',
    label: 'Box Breathing',
    supportingLabel: null,
    inhaleSeconds: 4,
    holdSeconds: 4,
    exhaleSeconds: 4,
    holdAfterExhaleSeconds: 4,
    cycleSeconds: 16,
    totalCycles: 4,
    totalSeconds: 64
  },
  {
    id: 'coherent',
    label: 'Coherent Breathing',
    supportingLabel: null,
    inhaleSeconds: 5,
    holdSeconds: 0,
    exhaleSeconds: 5,
    holdAfterExhaleSeconds: 0,
    cycleSeconds: 10,
    totalCycles: 6,
    totalSeconds: 60
  }
];

export const getBreathingPatternById = (id) => BREATHING_PATTERNS.find((p) => p.id === id) ?? null;

// The exact phase-cycling arithmetic already proven identically (with
// different numeric cadences) in Breathe.jsx/EveningBreathing.jsx/
// QuietBreathing.jsx's own inline countdown effects - centralised here so
// every caller shares one implementation instead of independently
// hand-rolled copies of the same modulo logic that could silently drift
// apart. Verified to reproduce each screen's own exact original cutoffs:
//   - 4-4-6: cycleTime<4 Inhale, <8 Hold, else Exhale (matches Breathe.jsx)
//   - 4-7-8: cycleTime<4 Inhale, <11 Hold, else Exhale (matches EveningBreathing.jsx)
//   - 4-4-8: cycleTime<4 Inhale, <8 Hold, else Exhale (matches QuietBreathing.jsx)
//
// Fourth-phase addition (approved, for Box Breathing) - a genuine new
// `holdEnd`/`exhaleEnd` boundary, not a fabricated one: for every
// pre-existing pattern, `holdAfterExhaleSeconds` is 0, so `exhaleEnd`
// equals `cycleSeconds` exactly and `cycleTime` (always < cycleSeconds by
// construction of the modulo above) can never reach the final branch -
// byte-identical behaviour to the original three-branch version for
// morning/evening/quiet, for every integer cycleTime, verified by hand.
// The final branch only ever fires for Box (cycleTime 12-15 of its own
// 16s cycle). Approved label: both holds return the literal string
// 'Hold' (never a distinct "Hold empty" - the sequence Inhale/Hold/
// Exhale/Hold is self-explanatory without extra terminology), so the
// two `return 'Hold'` lines below are deliberately identical, not a
// missed refactor - kept as separate branches (rather than combined into
// one condition) so each phase boundary stays independently readable and
// testable.
//
// A zero-duration phase is skipped completely, for the SAME structural
// reason in both places: if `holdSeconds` is 0 (Coherent), `holdEnd`
// equals `inhaleEnd`, so no integer `cycleTime` can ever satisfy
// `cycleTime >= inhaleEnd && cycleTime < holdEnd` - the first 'Hold'
// branch is unreachable. If `holdAfterExhaleSeconds` is 0 (every pattern
// except Box), the final 'Hold' branch is equally unreachable, as
// explained above. No pattern-id branching anywhere in this function.
export const resolveBreathPhase = (pattern, secondsLeft) => {
  const cycleTime = (pattern.totalSeconds - secondsLeft) % pattern.cycleSeconds;
  const inhaleEnd = pattern.inhaleSeconds;
  const holdEnd = inhaleEnd + pattern.holdSeconds;
  const exhaleEnd = holdEnd + pattern.exhaleSeconds;
  if (cycleTime < inhaleEnd) return 'Inhale';
  if (cycleTime < holdEnd) return 'Hold';
  if (cycleTime < exhaleEnd) return 'Exhale';
  return 'Hold';
};

// Build 15 Box/Coherent Breathing addition — the pre-start cadence
// preview text (BreathingPatternRow.jsx), built from only the non-zero
// phases, in phase order, so a pattern with no hold at all (Coherent:
// `holdSeconds: 0`) never shows "Hold 0s", and a pattern with a genuine
// second hold (Box: `holdAfterExhaleSeconds: 4`) shows all four segments
// - while every existing pattern's own visible cadence text stays
// byte-identical to before this addition (their `holdAfterExhaleSeconds`
// is 0, so the fourth segment is always filtered out for them). Exported
// as its own pure function (not inlined in the component) so it can be
// genuinely unit-tested with real execution, matching this file's own
// established precedent for resolveBreathPhase/getBreathingPatternById.
export const formatCadence = (pattern) =>
  [
    `Inhale ${pattern.inhaleSeconds}s`,
    pattern.holdSeconds > 0 && `Hold ${pattern.holdSeconds}s`,
    `Exhale ${pattern.exhaleSeconds}s`,
    pattern.holdAfterExhaleSeconds > 0 && `Hold ${pattern.holdAfterExhaleSeconds}s`
  ]
    .filter(Boolean)
    .join(' · ');

// F7 (pre-Build-15 usability pass) — approved compact duration format for
// the breathing pattern cards specifically ("56 sec" / "1 min"),
// deliberately a SEPARATE function from formatTotalDuration
// (formatDuration.js), which MorningFlow.jsx's own unrelated Stretch
// summary also reads - changing that shared formatter's own output
// ("56s") would have silently changed Stretch's display too, outside
// this pass's approved scope.
//
// Correction (acceptance review) — the first version of this function
// mirrored formatTotalDuration's own "~N mins" rounding for a non-exact
// minute count. Checked against the real registry: only `coherent` (60s)
// is an exact minute; `quiet`/`box` (64s) and `evening` (76s) are not -
// `evening` in particular is 76s, genuinely 16s (≈27%) longer than the
// "~1 min" that rounding produced, which is not a cosmetic rounding
// difference. Per the approved correction, this never approximates: any
// total that is not an exact whole number of minutes is shown as its
// real, exact second count instead ("76 sec", not "~1 min" or "1 min").
// Every current real pattern is well under 2 minutes, so this never
// produces an unwieldy "137 sec"-style value in practice; if a future
// pattern's duration ever exceeds that, this still shows the true exact
// count rather than a misleading rounded one.
export const formatBreathingDuration = (totalSeconds) => {
  const mins = totalSeconds / 60;
  if (Number.isInteger(mins)) return `${mins} min${mins === 1 ? '' : 's'}`;
  return `${totalSeconds} sec`;
};

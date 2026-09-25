import { formatCadence, formatBreathingDuration } from '../lib/breathingPatterns';

/*
 * Build 15 — BreathingPatternRow
 *
 * One selectable real breathing pattern, shown on the Morning Breathe,
 * standalone Breathe, and (Build 15 Evening UX correction) Evening
 * Breathing pre-start screens. A real native <input type="radio"> -
 * exactly one pattern may be selected at a time - wrapped by one <label>
 * covering the whole row, matching the same accessible construction
 * AnswerOptionButton.jsx already established and proved (contrast-
 * verified this same session): a strong ring when unselected, a filled
 * ring plus a small contrasting inner dot when selected - never a
 * checkmark, never a chevron. Kept as its own small component (not a
 * reuse of AnswerOptionButton, which lives under components/evening/ and
 * carries Reflection/Gratitude's own section-accent contract) so
 * Morning/standalone/Evening each just pass their own accent identity.
 *
 * F7 (pre-Build-15 usability pass) — approved compact card structure:
 * the duration used to sit on its own third line below the cadence
 * ("Inhale 4s · Hold 4s · Exhale 6s" then, on its own line, "56 sec"),
 * making every card unnecessarily tall. Duration now sits beside the
 * cadence on the same row (justify-between, so it right-aligns when
 * there's room), wrapping onto its own line at narrow widths
 * (flex-wrap) rather than ever overlapping the cadence text or the
 * radio indicator - both still ordinary text within the same flex-1
 * label content, so the whole card stays selectable exactly as before.
 * min-h-[56px] -> min-h-[44px] (still the established minimum, just no
 * longer padded for a fourth line of content this shape no longer has).
 *
 * Correction (acceptance review) — the duration span had carried
 * `uppercase` since before this pass (the original third-line design),
 * so live verification showed "56 SEC"/"~1 MIN" despite the approved
 * copy reading "56 sec"/"1 min" in real sentence case. Removed here -
 * the rendered text now matches the approved copy's own casing exactly.
 * See breathingPatterns.js's own doc comment for the separate "~1 min"
 * rounding correction.
 *
 * `accent` (additive, default 'primary' - every existing Morning/
 * standalone caller omits it and keeps its exact original WakeWise-peach
 * look, byte-for-byte unchanged): 'evening' swaps in the same
 * evening-accent periwinkle tokens already used throughout the rest of
 * the Evening journey (AnswerOptionButton's own unselected rows,
 * PrepareToggleRow's switches) - never a third, new colour.
 *
 * Morning Visual Uplift (Build 16) — 'morning' is a NEW accent value,
 * additive exactly like 'evening' above: it reuses the already-contrast-
 * verified morning-accent/on-morning-accent gold pair (the same tokens
 * Home's Today's Rhythm Morning tab already uses), never a new colour.
 * Only Breathe.jsx (Morning's real mindful-breathing screen) passes
 * `accent="morning"`; EveningBreathing.jsx, QuietBreathing.jsx (Anytime),
 * and SelfGuidedMeditation.jsx all still omit the prop entirely and keep
 * rendering the exact 'primary' peach tokens they always have - see
 * breathingPatternRowSharedConsumers.test.js for the regression proof
 * that this stays true.
 */
const ACCENT_TOKENS = {
  primary: {
    selectedRow: 'bg-primary/10 border-primary',
    unselectedRow: 'bg-surface-container border-primary/50 hover:bg-white/10',
    selectedLabel: 'text-primary font-bold',
    selectedRing: 'border-primary bg-primary',
    unselectedRing: 'border-primary bg-surface-container-lowest',
    dot: 'bg-on-primary',
    focusRing: 'has-[:focus-visible]:ring-primary'
  },
  evening: {
    selectedRow: 'bg-evening-accent/10 border-evening-accent',
    unselectedRow: 'bg-surface-container border-evening-accent/55 hover:bg-white/10',
    selectedLabel: 'text-evening-accent font-bold',
    selectedRing: 'border-evening-accent bg-evening-accent',
    unselectedRing: 'border-evening-accent bg-surface-container-lowest',
    dot: 'bg-on-evening-accent',
    focusRing: 'has-[:focus-visible]:ring-evening-accent'
  },
  morning: {
    selectedRow: 'bg-morning-accent/10 border-morning-accent',
    unselectedRow: 'bg-surface-container border-morning-accent/55 hover:bg-white/10',
    selectedLabel: 'text-morning-accent font-bold',
    selectedRing: 'border-morning-accent bg-morning-accent',
    unselectedRing: 'border-morning-accent bg-surface-container-lowest',
    dot: 'bg-on-morning-accent',
    focusRing: 'has-[:focus-visible]:ring-morning-accent'
  }
};

export const BreathingPatternRow = ({ pattern, selected, onSelect, groupName, accent = 'primary' }) => {
  const tokens = ACCENT_TOKENS[accent];

  return (
    <label
      className={`flex items-center justify-between gap-3 w-full min-h-[44px] px-5 py-2.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer active:scale-[0.98] has-[:focus-visible]:ring-2 ${tokens.focusRing} has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
        selected ? tokens.selectedRow : tokens.unselectedRow
      }`}
    >
      <input
        type="radio"
        name={groupName}
        checked={selected}
        onChange={() => onSelect(pattern.id)}
        className="sr-only"
      />
      <span className="flex-1 min-w-0">
        <span className={`block text-sm leading-snug ${selected ? tokens.selectedLabel : 'text-on-surface font-medium'}`}>
          {pattern.label}
        </span>
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 mt-1">
          <span className="text-xs text-on-surface-variant">
            {formatCadence(pattern)}
          </span>
          <span className="text-[10px] text-on-surface-variant/70 font-semibold tracking-wide shrink-0">
            {formatBreathingDuration(pattern.totalSeconds)}
          </span>
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`relative w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${
          selected ? tokens.selectedRing : tokens.unselectedRing
        }`}
      >
        {selected && <span className={`absolute inset-0 m-auto w-2 h-2 rounded-full ${tokens.dot}`} />}
      </span>
    </label>
  );
};

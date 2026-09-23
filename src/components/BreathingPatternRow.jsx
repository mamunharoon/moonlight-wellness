import { formatTotalDuration } from '../lib/formatDuration';

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
 * `accent` (additive, default 'primary' - every existing Morning/
 * standalone caller omits it and keeps its exact original WakeWise-peach
 * look, byte-for-byte unchanged): 'evening' swaps in the same
 * evening-accent periwinkle tokens already used throughout the rest of
 * the Evening journey (AnswerOptionButton's own unselected rows,
 * PrepareToggleRow's switches) - never a third, new colour.
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
  }
};

export const BreathingPatternRow = ({ pattern, selected, onSelect, groupName, accent = 'primary' }) => {
  const tokens = ACCENT_TOKENS[accent];

  return (
    <label
      className={`flex items-center justify-between gap-3 w-full min-h-[56px] px-5 py-3 rounded-2xl border text-left transition-all duration-150 cursor-pointer active:scale-[0.98] has-[:focus-visible]:ring-2 ${tokens.focusRing} has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
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
        <span className="block text-xs text-on-surface-variant mt-1">
          Inhale {pattern.inhaleSeconds}s · Hold {pattern.holdSeconds}s · Exhale {pattern.exhaleSeconds}s
        </span>
        <span className="block text-[10px] text-on-surface-variant/70 mt-1 uppercase font-semibold tracking-wide">
          {formatTotalDuration(pattern.totalSeconds)}
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

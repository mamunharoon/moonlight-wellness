import { formatTotalDuration } from '../lib/formatDuration';

/*
 * Build 15 — BreathingPatternRow
 *
 * One selectable real breathing pattern, shown on the Morning Breathe and
 * standalone Breathe pre-start screens (never Evening, which stays fixed
 * to its own canonical 4-7-8 pattern this phase - see EveningBreathing.jsx's
 * own read-only preview instead). A real native <input type="radio"> -
 * exactly one pattern may be selected at a time - wrapped by one <label>
 * covering the whole row, matching the same accessible construction
 * AnswerOptionButton.jsx already established and proved (contrast-
 * verified this same session): a strong periwinkle-free, `primary`
 * (WakeWise peach) ring when unselected, a filled ring plus a small
 * contrasting inner dot when selected - never a checkmark, never a
 * chevron. Kept as its own small component (not a reuse of
 * AnswerOptionButton, which lives under components/evening/ and carries
 * Reflection/Gratitude's own section-accent contract) so a Morning/
 * standalone breathing screen never has to import an Evening-scoped
 * component to render its own, differently-themed control.
 */
export const BreathingPatternRow = ({ pattern, selected, onSelect, groupName }) => (
  <label
    className={`flex items-center justify-between gap-3 w-full min-h-[56px] px-5 py-3 rounded-2xl border text-left transition-all duration-150 cursor-pointer active:scale-[0.98] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
      selected ? 'bg-primary/10 border-primary' : 'bg-surface-container border-primary/50 hover:bg-white/10'
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
      <span className={`block text-sm leading-snug ${selected ? 'text-primary font-bold' : 'text-on-surface font-medium'}`}>
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
        selected ? 'border-primary bg-primary' : 'border-primary bg-surface-container-lowest'
      }`}
    >
      {selected && <span className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-on-primary" />}
    </span>
  </label>
);

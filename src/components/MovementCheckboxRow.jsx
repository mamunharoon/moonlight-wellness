/*
 * Build 15 — MovementCheckboxRow
 *
 * Replaces MorningFlow.jsx's own former switch-styled movement rows.
 * Movement inclusion is a genuine multi-select (any subset of the 4
 * movements may be included in a run), which a switch's on/off framing
 * reads as ambiguous for - this uses real checkbox semantics instead,
 * matching AnswerOptionButton.jsx's own proven construction: a real
 * native checkbox input, visually hidden via sr-only, wrapped by one
 * label element that covers the entire row so a tap anywhere activates
 * it - but with a checkbox glyph (a filled square plus checkmark) rather
 * than a radio dot - genuinely distinct from both the switch it replaces
 * and any radio control elsewhere in the app. No sliding knob, no
 * colour-only state: selected rows also gain a full-strength border, a
 * subtle primary tint, and bold label text.
 */
export const MovementCheckboxRow = ({ title, description, durationLabel, icon, isSelected, onToggle }) => {
  return (
    <label
      className={`w-full min-h-[56px] px-5 py-4 rounded-2xl border text-left flex items-center gap-4 transition-all duration-150 cursor-pointer active:scale-[0.98] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
        isSelected ? 'bg-primary/10 border-primary' : 'bg-surface-container border-primary/50 hover:bg-white/10'
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors duration-150 ${
          isSelected ? 'bg-primary border-primary' : 'border-on-surface-variant/50 bg-transparent'
        }`}
      >
        {isSelected && <span className="material-symbols-outlined text-on-primary text-base leading-none">check</span>}
      </span>
      <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary/25 text-primary' : 'bg-white/5 text-on-surface-variant'}`}>
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm leading-snug ${isSelected ? 'text-primary font-bold' : 'text-on-surface font-medium'}`}>{title}</span>
        <span className="block text-xs text-on-surface-variant mt-1">{description}</span>
        <span className="block text-[10px] text-on-surface-variant/70 mt-1 uppercase font-semibold tracking-wide">{durationLabel}</span>
      </span>
    </label>
  );
};

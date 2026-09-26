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
 * subtle tint, and bold label text.
 *
 * Context-aware Meditation/Breathing theming consistency audit —
 * `journeyTone` (additive, default 'primary': the original peach look,
 * byte-identical to before this prop existed). MorningFlow.jsx (this
 * component's only real consumer today) passes its own fixed "morning"
 * explicitly - selected movements now read gold, matching every other
 * selected-state control on this same Stretch step. A dedicated local
 * token map (not journeyTone.js's own shared one) - this row has its own
 * checkbox+icon-badge shape journeyTone.js's radio-row shape doesn't
 * cover, and every class name below is a literal string (never built at
 * runtime via string concatenation/replace) so Tailwind's build-time JIT
 * scan can actually see and generate each one.
 */
const TOKENS = {
  primary: {
    selectedRow: 'bg-primary/10 border-primary',
    unselectedRow: 'bg-surface-container border-primary/50 hover:bg-white/10',
    selectedLabel: 'text-primary font-bold',
    selectedCheckBg: 'bg-primary border-primary',
    checkIconText: 'text-on-primary',
    selectedIconBadge: 'bg-primary/25 text-primary',
    focusRing: 'has-[:focus-visible]:ring-primary'
  },
  morning: {
    selectedRow: 'bg-morning-accent-tint/10 border-morning-accent',
    unselectedRow: 'bg-surface-container border-morning-accent/55 hover:bg-white/10',
    selectedLabel: 'text-morning-accent font-bold',
    selectedCheckBg: 'bg-morning-accent border-morning-accent',
    checkIconText: 'text-on-morning-accent',
    selectedIconBadge: 'bg-morning-accent-tint/25 text-morning-accent',
    focusRing: 'has-[:focus-visible]:ring-morning-accent'
  },
  anytime: {
    selectedRow: 'bg-tertiary-tint/10 border-tertiary',
    unselectedRow: 'bg-surface-container border-tertiary/55 hover:bg-white/10',
    selectedLabel: 'text-tertiary font-bold',
    selectedCheckBg: 'bg-tertiary border-tertiary',
    checkIconText: 'text-on-tertiary',
    selectedIconBadge: 'bg-tertiary-tint/25 text-tertiary',
    focusRing: 'has-[:focus-visible]:ring-tertiary'
  },
  evening: {
    selectedRow: 'bg-evening-accent-tint/10 border-evening-accent',
    unselectedRow: 'bg-surface-container border-evening-accent/55 hover:bg-white/10',
    selectedLabel: 'text-evening-accent font-bold',
    selectedCheckBg: 'bg-evening-accent border-evening-accent',
    checkIconText: 'text-on-evening-accent',
    selectedIconBadge: 'bg-evening-accent-tint/25 text-evening-accent',
    focusRing: 'has-[:focus-visible]:ring-evening-accent'
  }
};

// Build 16 physical-iPhone correction (F2) — `compact` renders a 2-column-
// grid card instead of the full-width row: icon + checkmark badge, title,
// duration only (the longer `description` is intentionally omitted here -
// the full row below still shows it, this card exists purely so all four
// movements are visible on the setup screen at once without scrolling).
// Same real checkbox input/label wrapping and focus-visible ring as the
// full row - only the visual layout differs, not the accessibility
// contract. min-h-[76px] keeps the whole card comfortably above the
// 44x44pt minimum touch target even with two columns on a 320px-wide
// screen.
export const MovementCheckboxRow = ({ title, description, durationLabel, icon, isSelected, onToggle, compact = false, journeyTone = 'primary' }) => {
  const tokens = TOKENS[journeyTone] || TOKENS.primary;
  if (compact) {
    return (
      <label
        className={`relative min-h-[76px] px-3 py-3 rounded-2xl border flex flex-col items-center text-center gap-1 transition-all duration-150 cursor-pointer active:scale-[0.98] has-[:focus-visible]:ring-2 ${tokens.focusRing} has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
          isSelected ? tokens.selectedRow : tokens.unselectedRow
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
          className={`absolute top-2 right-2 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors duration-150 ${
            isSelected ? tokens.selectedCheckBg : 'border-on-surface-variant/50 bg-transparent'
          }`}
        >
          {isSelected && <span className={`material-symbols-outlined ${tokens.checkIconText} text-sm leading-none`}>check</span>}
        </span>
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? tokens.selectedIconBadge : 'bg-white/5 text-on-surface-variant'}`}>
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </span>
        <span className={`block text-xs leading-snug ${isSelected ? tokens.selectedLabel : 'text-on-surface font-semibold'}`}>{title}</span>
        <span className="block text-[10px] text-on-surface-variant/70 uppercase font-semibold tracking-wide">{durationLabel}</span>
      </label>
    );
  }

  return (
    <label
      className={`w-full min-h-[56px] px-5 py-4 rounded-2xl border text-left flex items-center gap-4 transition-all duration-150 cursor-pointer active:scale-[0.98] has-[:focus-visible]:ring-2 ${tokens.focusRing} has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
        isSelected ? tokens.selectedRow : tokens.unselectedRow
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
          isSelected ? tokens.selectedCheckBg : 'border-on-surface-variant/50 bg-transparent'
        }`}
      >
        {isSelected && <span className={`material-symbols-outlined ${tokens.checkIconText} text-base leading-none`}>check</span>}
      </span>
      <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? tokens.selectedIconBadge : 'bg-white/5 text-on-surface-variant'}`}>
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm leading-snug ${isSelected ? tokens.selectedLabel : 'text-on-surface font-medium'}`}>{title}</span>
        <span className="block text-xs text-on-surface-variant mt-1">{description}</span>
        <span className="block text-[10px] text-on-surface-variant/70 mt-1 uppercase font-semibold tracking-wide">{durationLabel}</span>
      </span>
    </label>
  );
};

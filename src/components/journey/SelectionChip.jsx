/*
 * WakeWise — Build 15 Phase B — shared selection chip.
 *
 * The 2-column grid tile used by both Anytime Reset's need step and
 * Meditate's need step (both grids already rendered near-identical
 * buttons independently: glass-panel tile, aria-pressed, 44px min
 * height, primary-tinted selected state). Pure presentation - the
 * caller owns the data (`label`) and the click handler; this component
 * makes no selection decisions of its own.
 *
 * `icon` is a Material Symbols ligature name (e.g. "air", "bolt") -
 * never an emoji. Selected state is conveyed through four channels at
 * once (fill colour, border colour, font-weight, and a check glyph),
 * never colour alone, per the accessibility requirement.
 *
 * Build 15 Phase B remediation — two new, purely additive/opt-in props
 * for the Change Intention screen's larger preset cards, which neither
 * existing caller (Anytime Reset/Meditate) passes, so their own rendered
 * output is completely unchanged:
 *   - `roleLabel` ("Primary"/"Supporting") renders a small pill at the
 *     opposite corner from the selected checkmark, the same badge shape
 *     IntentionSetup.jsx's own preset buttons already use - purely
 *     presentational, still just a function of the caller's own array
 *     index (roleForIndex), never a value this component invents.
 *   - `large` swaps the compact icon-topped tile sizing for a taller,
 *     bigger-type card with no icon column, for a screen (intention
 *     presets) that has no icon per choice and wants a bigger tap
 *     target than the 4-icon grids' own compact tiles.
 *
 * Anytime Reset Visual Uplift (Phase 2) — `accent` (additive, default
 * 'primary': every existing caller - Meditate.jsx, ChangeIntention.jsx -
 * omits it and keeps the exact original peach selected state, byte-for-
 * byte unchanged). 'anytime' is a new value, only ever passed by
 * AnytimeReset.jsx's own need-selection chips: it swaps the selected
 * fill/border/check/icon/label colours to the same mint tokens
 * (tertiary/tertiary-tint) the rest of this phase's uplift uses, never a
 * new colour. The unselected state and every non-colour channel (border
 * shape, check_circle glyph, font-weight) are unaffected by accent.
 */
const CHIP_ACCENT = {
  primary: {
    selected: 'bg-primary-container/25 border-primary shadow-md shadow-primary/10',
    badge: 'bg-primary text-on-primary',
    check: 'text-primary',
    icon: 'text-primary',
    label: 'text-primary font-bold'
  },
  anytime: {
    selected: 'bg-tertiary-tint/20 border-tertiary shadow-md shadow-tertiary-tint/20',
    badge: 'bg-tertiary text-on-tertiary',
    check: 'text-tertiary',
    icon: 'text-tertiary',
    label: 'text-tertiary font-bold'
  }
};

export const SelectionChip = ({ label, icon, selected, onClick, roleLabel, large = false, accent = 'primary' }) => {
  const tokens = CHIP_ACCENT[accent] ?? CHIP_ACCENT.primary;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98] ${
        large ? 'p-5 min-h-[72px]' : 'p-4 min-h-[44px]'
      } ${
        selected ? tokens.selected : 'glass-panel border-white/5 text-on-surface-variant hover:bg-white/10'
      }`}
    >
      {roleLabel && (
        <span className={`absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full ${tokens.badge} text-[9px] font-bold uppercase tracking-wider shadow-sm`}>
          {roleLabel}
        </span>
      )}
      {selected && (
        <span
          className={`absolute top-1.5 right-1.5 material-symbols-outlined ${tokens.check} text-[16px]`}
          aria-hidden="true"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          check_circle
        </span>
      )}
      {icon && (
        <span className={`material-symbols-outlined text-xl ${selected ? tokens.icon : 'text-on-surface-variant'}`} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={`${large ? 'text-sm' : 'text-xs'} ${selected ? tokens.label : 'text-on-surface font-semibold'}`}>{label}</span>
    </button>
  );
};

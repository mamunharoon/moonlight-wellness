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
 */
export const SelectionChip = ({ label, icon, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`relative flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border text-center transition-all duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98] ${
      selected
        ? 'bg-primary-container/25 border-primary shadow-md shadow-primary/10'
        : 'glass-panel border-white/5 text-on-surface-variant hover:bg-white/10'
    }`}
  >
    {selected && (
      <span
        className="absolute top-1.5 right-1.5 material-symbols-outlined text-primary text-[16px]"
        aria-hidden="true"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        check_circle
      </span>
    )}
    {icon && (
      <span className={`material-symbols-outlined text-xl ${selected ? 'text-primary' : 'text-on-surface-variant'}`} aria-hidden="true">
        {icon}
      </span>
    )}
    <span className={`text-xs ${selected ? 'text-primary font-bold' : 'text-on-surface font-semibold'}`}>{label}</span>
  </button>
);

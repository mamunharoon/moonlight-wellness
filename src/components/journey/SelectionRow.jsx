/*
 * WakeWise — Build 15 Phase B — shared selection row.
 *
 * The full-width list row used by both Anytime Reset's and Meditate's
 * duration step (both already rendered a near-identical
 * "glass-panel rounded-2xl, label + optional description, trailing
 * chevron" row independently). Pure presentation, same contract as
 * SelectionChip — caller owns the data and the click handler.
 *
 * Selected state swaps the trailing chevron for a check glyph (not just
 * a colour change) and adds a primary border/tint, so the state reads
 * through shape as well as colour.
 */
export const SelectionRow = ({ label, description, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`w-full text-left glass-panel rounded-2xl p-5 flex items-center justify-between gap-3 border transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99] ${
      selected ? 'border-primary bg-primary-container/20' : 'border-white/10 hover:bg-white/5'
    }`}
  >
    <span className="min-w-0">
      <span className={`block text-sm font-bold ${selected ? 'text-primary' : 'text-on-surface'}`}>{label}</span>
      {description && <span className="block text-xs text-on-surface-variant mt-0.5">{description}</span>}
    </span>
    <span
      className={`material-symbols-outlined shrink-0 ${selected ? 'text-primary' : 'text-on-surface-variant'}`}
      aria-hidden="true"
      style={selected ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {selected ? 'check_circle' : 'chevron_right'}
    </span>
  </button>
);

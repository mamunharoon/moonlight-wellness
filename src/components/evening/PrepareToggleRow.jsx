/*
 * Phase 3 (Prepare for Rest subphase) — PrepareToggleRow
 *
 * Four independent, optional preparation actions on Prepare for Rest are
 * a genuinely different interaction from Reflection/Gratitude's answers:
 * multiple may be on at once (never single-select), so this is a plain
 * toggle button - aria-pressed carries the real state (per this
 * subphase's own approved "button/aria-pressed semantics" requirement),
 * never role="switch"/aria-checked.
 *
 * Purely local, client-side state - see PrepareForRest.jsx's own doc
 * comment for why toggling never writes anywhere (no completion event,
 * no Supabase write, no new persistence).
 *
 * UNSELECTED: deep surface-container background, a subtle white/15
 * border, off-white title, muted supporting text, the item's own real
 * WakeWise icon (peach-tinted, matching this app's established icon
 * colour) - no chevron, no checkmark.
 * SELECTED: the entire row fills with the new evening-accent/
 * on-evening-accent token pair (see index.css) - a calm periwinkle blue,
 * distinct from Reflection's peach and Gratitude's gold - plus a
 * stronger border, bold high-contrast title, and an inset/pressed
 * shadow. Never colour alone (weight and border also change), never a
 * tick/checkmark, never a navigation chevron.
 */
export const PrepareToggleRow = ({ icon, title, support, selected, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={selected}
    className={`w-full min-h-[56px] px-5 py-4 rounded-2xl border text-left flex items-center gap-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98] ${
      selected
        ? 'bg-evening-accent border-evening-accent shadow-[inset_0_2px_5px_rgba(0,0,0,0.2)]'
        : 'bg-surface-container border-white/15 hover:bg-white/10'
    }`}
  >
    <span className={`material-symbols-outlined text-2xl shrink-0 ${selected ? 'text-on-evening-accent' : 'text-primary'}`} aria-hidden="true">
      {icon}
    </span>
    <span className="flex-1 min-w-0">
      <span className={`block text-sm leading-snug ${selected ? 'text-on-evening-accent font-bold' : 'text-on-surface font-medium'}`}>
        {title}
      </span>
      <span className={`block text-xs mt-0.5 ${selected ? 'text-on-evening-accent/80' : 'text-on-surface-variant'}`}>{support}</span>
    </span>
  </button>
);

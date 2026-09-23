/*
 * Phase 3 (Prepare for Rest subphase) — PrepareToggleRow
 *
 * Physical-device feedback, round 2: selecting a preparation action
 * turning the ENTIRE row bright blue made the page "suddenly look like a
 * different design." Corrected to a genuine sliding switch (role="switch",
 * aria-checked - the earlier "button/aria-pressed" spec is superseded by
 * this explicit correction) where the row itself only ever gains a
 * SUBTLE blue tint and a stronger border - the saturated colour and the
 * real, visible state change live in the switch track+knob, exactly like
 * a native iOS toggle, never a full-bright-fill row.
 *
 * Four independent, optional preparation actions - multiple may be on at
 * once (never single-select, unlike Reflection/Gratitude's
 * AnswerOptionButton radio). Purely local, client-side state - see
 * PrepareForRest.jsx's own doc comment for why toggling never writes
 * anywhere (no completion event, no Supabase write, no new persistence).
 *
 * OFF: deep surface-container background, a subtle white/15 border,
 * off-white title, muted supporting text, the item's own real WakeWise
 * icon - a muted-grey track with the knob on the left. No chevron, no
 * checkmark.
 * ON: the row stays predominantly dark navy - only a subtle
 * evening-accent/10 tint and a full-strength evening-accent border are
 * added, plus a slightly bolder/brighter title (never colour alone).
 * The switch track fills solid evening-accent blue and the knob visibly
 * slides right - genuine knob movement is the primary non-colour state
 * cue, never a tick/checkmark.
 */
export const PrepareToggleRow = ({ icon, title, support, selected, onToggle }) => (
  <button
    type="button"
    role="switch"
    aria-checked={selected}
    onClick={onToggle}
    className={`w-full min-h-[56px] px-5 py-4 rounded-2xl border text-left flex items-center gap-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98] ${
      selected
        ? 'bg-evening-accent/10 border-evening-accent shadow-[inset_0_1px_3px_rgba(0,0,0,0.12)]'
        : 'bg-surface-container border-white/15 hover:bg-white/10'
    }`}
  >
    <span className="material-symbols-outlined text-primary text-2xl shrink-0" aria-hidden="true">
      {icon}
    </span>
    <span className="flex-1 min-w-0">
      <span className={`block text-sm leading-snug ${selected ? 'text-evening-accent font-bold' : 'text-on-surface font-medium'}`}>
        {title}
      </span>
      <span className="block text-xs text-on-surface-variant mt-0.5">{support}</span>
    </span>
    <span
      aria-hidden="true"
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-150 ${selected ? 'bg-evening-accent' : 'bg-white/20'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-on-surface transition-transform duration-150 ${
          selected ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </span>
  </button>
);

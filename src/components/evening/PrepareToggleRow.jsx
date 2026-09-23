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
 * OFF: deep surface-container background, a visible evening-accent/55
 * border (Build 15 visual refinement - shared with AnswerOptionButton's
 * own unselected row border, one consistent Evening row language;
 * measures ~3.4:1 against the row, clearing the 3:1 AA non-text floor),
 * off-white title, muted supporting text, the item's own real WakeWise
 * icon - a muted deep-slate track (evening-track-off) with a dark navy
 * knob on the left. No chevron, no checkmark.
 * ON: the row stays predominantly dark navy - only a subtle
 * evening-accent/10 tint and a full-strength evening-accent border are
 * added, plus a slightly bolder/brighter title (never colour alone).
 * The switch track fills solid evening-accent blue and the knob visibly
 * slides right - genuine knob movement is the primary non-colour state
 * cue, never a tick/checkmark.
 *
 * Build 15 visual refinement - the knob itself: previously a plain
 * bg-on-surface fill (a bright, near-white circle, flagged as reading
 * "too pale" against this dark system). Now a dark navy fill
 * (surface-container-lowest) with a thin evening-accent ring, in both
 * states - calculated, not eyeballed: the dark knob fill alone already
 * measures ~3.7:1 against the new evening-track-off (Off) and ~9.4:1
 * against evening-accent (On), so the knob stays clearly distinguishable
 * from its track at either state; the ring is an additional, not the
 * only, separation cue.
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
        : 'bg-surface-container border-evening-accent/55 hover:bg-white/10'
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
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-150 ${selected ? 'bg-evening-accent' : 'bg-evening-track-off'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface-container-lowest border border-evening-accent transition-transform duration-150 ${
          selected ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </span>
  </button>
);

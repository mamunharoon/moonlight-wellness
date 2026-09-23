/*
 * WakeWise — Build 15 Phase B — shared recommendation-card shell.
 *
 * Anytime Reset's and Meditate's recommend-step cards were already
 * near-byte-identical (title + duration badge, description, optional
 * "Closest match" label, "Why this" reason, a primary Start/Begin
 * button, an optional "Choose another" button). This component owns
 * only the SHELL/markup; every value and every action is a prop, so
 * neither page's own recommendation engine, auth-revalidation flow, or
 * button copy moves here:
 *
 *   - Anytime Reset passes `startBusy`/`startDisabled` (its own
 *     verifyingAuth/authLoading state, from the server-revalidated
 *     Start flow) - Meditate simply never sets them, so its button
 *     never shows the "Checking…" label and is never auth-disabled,
 *     exactly matching its own existing (simpler) behaviour.
 *   - `startLabel` and `chooseAnotherLabel` are required props, not
 *     hardcoded, so each page keeps its own exact existing copy
 *     ("Start" vs "Begin", "Choose another" vs "Choose Another").
 *
 * The empty/no-match state is deliberately NOT part of this shell -
 * each page's own copy for that ("No reset matches…" vs "No session
 * matches…") stays owned by that page, rendered instead of this
 * component entirely.
 */
export const RecommendationCard = ({
  title,
  durationLabel,
  description,
  isClosestMatch,
  matchReason,
  onStart,
  startLabel,
  startDisabled = false,
  startBusy = false,
  onChooseAnother,
  showChooseAnother,
  chooseAnotherLabel
}) => (
  <div className="glass-panel rounded-3xl p-5 space-y-3 border-white/10">
    <div className="flex items-start justify-between gap-3">
      <h2 className="text-base font-bold text-on-surface">{title}</h2>
      <span className="text-[10px] text-on-surface-variant/70 font-semibold uppercase tracking-wider shrink-0 bg-white/5 px-2 py-1 rounded-full">
        {durationLabel}
      </span>
    </div>
    <p className="text-sm text-on-surface-variant leading-relaxed">{description}</p>
    {isClosestMatch && (
      <p className="text-[11px] text-secondary font-semibold uppercase tracking-wider">Closest match</p>
    )}
    <p className="text-xs text-on-surface-variant/80 italic">Why this: {matchReason}</p>

    <button
      type="button"
      onClick={onStart}
      disabled={startDisabled}
      className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-60 disabled:pointer-events-none"
    >
      <span>{startBusy ? 'Checking…' : startLabel}</span>
      <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_forward</span>
    </button>

    {showChooseAnother && (
      <button
        type="button"
        onClick={onChooseAnother}
        className="w-full glass-panel text-on-surface-variant py-3 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {chooseAnotherLabel}
      </button>
    )}
  </div>
);

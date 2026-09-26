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
 *
 * Anytime Reset Visual Uplift (Phase 2, approved decision E) — `accent`
 * (additive, default 'primary': the existing Meditate.jsx caller omits it
 * and keeps the exact original glass-panel border, byte-for-byte
 * unchanged - see the borderColor style below for why). 'anytime' is only
 * ever passed by AnytimeReset.jsx's own Step 3 recommendation card,
 * adding a restrained mint border/glow.
 *
 * WakeWise DEV — journey-aware primary action colour: the later approved
 * journey-colour pass explicitly reversed this phase's own "the Start
 * button stays unconditionally peach" decision - Start now resolves to
 * the shared journey-action helper (getJourneyPrimaryActionClasses),
 * which correctly falls back to the original peach for Meditate.jsx's
 * own 'primary' caller and only turns mint for accent='anytime'.
 *
 * The mint border is applied via inline style, not a Tailwind border-*
 * class: .glass-panel's own `border: 1px solid rgba(255,255,255,0.12)`
 * shorthand is defined after Tailwind's utilities in the compiled
 * stylesheet, so a same-specificity utility class silently loses to it
 * (the exact same reason Routines.jsx's own left-border accent already
 * uses an inline style - see that file's doc comment). An inline style
 * always wins regardless of stylesheet order, so this is the only
 * mechanism that actually renders a visible colour change here.
 *
 * `locked` (additive, optional, default false — F3 guest-gate disclosure):
 * Meditate.jsx's own caller never passes it and is completely unaffected.
 * AnytimeReset.jsx passes `locked={isGuest}` so a guest sees a "Sign in to
 * play" badge (same lock-icon pill shape AudioPlayerPlaceholder.jsx
 * already established for gated content) BEFORE tapping Start, rather
 * than discovering the gate only after the tap. This component still
 * never knows what "signing in" means - `onStart` is unconditionally the
 * same prop as before; AnytimeReset.jsx's own handleBegin still decides
 * whether to open SignInPromptDialog. `startLabel` already lets the
 * caller swap the button's own text (e.g. "Sign in to start"), so the
 * button itself needs no locked-specific branching here.
 *
 * `expanded`/`controlsId` (WakeWise Phase 2, B5 — additive, optional,
 * both `undefined` by default): Meditate.jsx's own caller passes neither
 * and is completely unaffected (React omits an `undefined` aria-* attribute
 * from the DOM entirely, so its "Choose another" stays a plain button with
 * no aria-expanded at all, exactly as before). AnytimeReset.jsx's own
 * "Choose another" is now a real progressive-disclosure toggle (its own
 * onChooseAnother no longer cycles - it opens/closes a list of real
 * alternatives this component doesn't render itself), so it passes both
 * for a standard, accessible disclosure-button contract - the same
 * aria-expanded/aria-controls pattern Grounding.jsx's own "Need more
 * support?" disclosure already established (WakeWise Phase 1).
 */
import { getJourneyPrimaryActionClasses } from '../../lib/journeyAction';

const CARD_ACCENT_STYLE = {
  primary: undefined,
  anytime: { borderColor: 'rgba(127, 228, 208, 0.35)' }
};
const CARD_ACCENT_CLASS = {
  primary: '',
  anytime: 'shadow-mint-glow'
};

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
  chooseAnotherLabel,
  accent = 'primary',
  locked = false,
  expanded,
  controlsId
}) => (
  <div
    className={`glass-panel rounded-3xl p-5 space-y-3 border-white/10 ${CARD_ACCENT_CLASS[accent] ?? ''}`}
    style={CARD_ACCENT_STYLE[accent]}
  >
    <div className="flex items-start justify-between gap-3">
      <h2 className="text-base font-bold text-on-surface">{title}</h2>
      <span className="text-[10px] text-on-surface-variant/70 font-semibold uppercase tracking-wider shrink-0 bg-white/5 px-2 py-1 rounded-full">
        {durationLabel}
      </span>
    </div>
    <p className="text-sm text-on-surface-variant leading-relaxed">{description}</p>
    {locked && (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
        <span className="material-symbols-outlined text-xs" aria-hidden="true">lock</span>
        Sign in to play
      </span>
    )}
    {isClosestMatch && (
      <p className="text-[11px] text-secondary font-semibold uppercase tracking-wider">Closest match</p>
    )}
    <p className="text-xs text-on-surface-variant/80 italic">Why this: {matchReason}</p>

    <button
      type="button"
      onClick={onStart}
      disabled={startDisabled}
      className={`w-full min-h-[44px] ${getJourneyPrimaryActionClasses(accent)} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-60 disabled:pointer-events-none`}
    >
      <span>{startBusy ? 'Checking…' : startLabel}</span>
      <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_forward</span>
    </button>

    {showChooseAnother && (
      <button
        type="button"
        onClick={onChooseAnother}
        aria-expanded={expanded}
        aria-controls={controlsId}
        className="w-full min-h-[44px] glass-panel text-on-surface-variant py-3 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {chooseAnotherLabel}
      </button>
    )}
  </div>
);

/* eslint-disable no-unused-vars */
import { Link } from 'react-router-dom';

// "Explore More" discovery, Phase 5 — the ONE shared, reusable Explore
// card every journey completion surface uses (Morning/Anytime/Evening),
// never three separate hand-rolled implementations. Deliberately visually
// SECONDARY to whatever primary action a caller already renders (glass-
// panel + a restrained journey-tone border/glow, matching
// RecommendationCard.jsx's own established 'anytime' accent treatment
// exactly, extended here to morning/evening using the same existing
// -accent-tint CSS custom properties) - callers are responsible for their
// own visual ordering (this component renders nothing that competes for
// primary-button styling on its own).
//
// The border colour is applied via inline style, not a Tailwind border-*
// class, for the exact same reason RecommendationCard.jsx's own doc
// comment already documents: .glass-panel's own `border` shorthand is
// defined after Tailwind's utilities in the compiled stylesheet, so a
// same-specificity utility class silently loses to it - only an inline
// style reliably wins regardless of stylesheet order.
//
// This is a plain navigation card (a styled <Link>, not a button) - it
// carries no destination-resolution logic of its own. Callers pass the
// exact `to` URL (built via exploreFiltering.js's own journey/filter
// contract and Library.jsx's own allowlisted `from` origin keys) so this
// component never has to know about routing/origin rules itself.
const JOURNEY_ACCENT_STYLE = {
  morning: { borderColor: 'rgba(253, 186, 116, 0.35)' },
  evening: { borderColor: 'rgba(159, 180, 240, 0.35)' },
  anytime: { borderColor: 'rgba(127, 228, 208, 0.35)' }
};

const JOURNEY_GLOW_CLASS = {
  morning: 'shadow-morning-glow',
  evening: 'shadow-evening-glow',
  anytime: 'shadow-mint-glow'
};

const JOURNEY_ICON_CLASS = {
  morning: 'text-morning-accent bg-morning-accent/10',
  evening: 'text-evening-accent bg-evening-accent/10',
  anytime: 'text-tertiary bg-tertiary/10'
};

// Physical-iPhone correction — `supportingText` is now optional (additive,
// backward-compatible: Evening/Anytime both keep passing it and render
// byte-identically to before). Only SessionComplete.jsx (Morning) now
// omits it, per the approved "remove the supporting sentence" simplification
// - the space-y-1 wrapper below only ever applies margin between actually-
// rendered siblings, so omitting this line already tightens the card with
// no separate spacing change needed.
export const ExploreCard = ({ journey, icon, title, supportingText, ctaLabel, to, itemCount }) => (
  <Link
    to={to}
    className={`w-full flex items-start gap-4 glass-panel rounded-2xl p-4 min-h-[44px] text-left transition-all hover:bg-white/5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${JOURNEY_GLOW_CLASS[journey] ?? ''}`}
    style={JOURNEY_ACCENT_STYLE[journey]}
    aria-label={`${ctaLabel}: ${title}`}
  >
    <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${JOURNEY_ICON_CLASS[journey] ?? 'text-primary bg-primary/10'}`}>
      <span className="material-symbols-outlined text-xl" aria-hidden="true">{icon}</span>
    </span>
    <span className="flex-1 min-w-0 space-y-1">
      <span className="block text-sm font-bold text-on-surface">{title}</span>
      {supportingText && (
        <span className="block text-xs text-on-surface-variant leading-relaxed">{supportingText}</span>
      )}
      <span className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider mt-1 ${journey === 'morning' ? 'text-morning-accent' : journey === 'evening' ? 'text-evening-accent' : journey === 'anytime' ? 'text-tertiary' : 'text-primary'}`}>
        {ctaLabel}
        {typeof itemCount === 'number' && itemCount > 0 ? ` · ${itemCount}` : ''}
        <span className="material-symbols-outlined text-xs" aria-hidden="true">arrow_forward</span>
      </span>
    </span>
  </Link>
);

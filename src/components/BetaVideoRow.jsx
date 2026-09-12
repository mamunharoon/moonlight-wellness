/*
 * WakeWise — Beta Video Preview — BetaVideoRow
 *
 * Pure presentational row for one video entry point, extracted once
 * several contextual pages (MorningStart, Affirmation, Support, etc.)
 * needed to list more than one video per page (E11-E20 batch). Markup
 * is byte-for-byte the same row every page already used for a single
 * video — this just parameterizes it so it isn't hand-duplicated per
 * row per page. Owns no state, no signed-URL/access logic, and never
 * touches BetaVideoModal directly - the calling page still owns which
 * video id is "open" and renders BetaVideoModal itself, exactly as
 * before. Title/description are passed explicitly rather than a whole
 * manifest entry, since several pages write their own short, contextual
 * blurb distinct from the manifest's generic description.
 */
export const BetaVideoRow = ({ title, description, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-4 glass-panel rounded-2xl p-4 hover:bg-white/5 active:scale-[0.99] transition-all text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
  >
    <span className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
      <span className="material-symbols-outlined text-primary text-xl">play_circle</span>
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-semibold text-on-surface">Watch: {title}</span>
      <span className="block text-xs text-on-surface-variant">{description}</span>
    </span>
    <span className="material-symbols-outlined text-sm text-on-surface-variant shrink-0">chevron_right</span>
  </button>
);

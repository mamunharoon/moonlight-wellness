/* eslint-disable no-unused-vars */
import { useEffect } from 'react';
import { BetaVideoRow } from '../BetaVideoRow';

/*
 * Build 16 physical-iPhone correction (F10) — dedicated full-catalogue
 * chooser for Prepare for Rest's bedtime media. Previously "Choose a
 * bedtime video or sleep sound" expanded IN-PAGE (one featured video +
 * one featured sound, plus a second "More bedtime options" disclosure
 * for the rest), pushing the preparation checklist and Ready for Sleep
 * off-screen together with the whole catalogue on one page - found live:
 * expanding it (already open by default) made the screen substantially
 * longer, well past a single iPhone viewport. This is a separate,
 * full-screen overlay instead: Prepare for Rest itself stays a compact
 * primary screen (checklist + a single chooser control + a compact
 * selected-item summary + Ready for Sleep), and browsing the full
 * library - which can be as long as it needs to be - is this dedicated,
 * independently scrollable view (its own scroll owner, never affecting
 * Prepare for Rest's own layout underneath).
 *
 * Tapping a row here SELECTS it (calls onSelect(id) then onClose) - it
 * does not start playback itself. Prepare for Rest's own compact summary
 * card is what actually plays a selection (reusing BetaVideoRow's own
 * established tap-to-play behaviour there, exactly as every other
 * BetaVideoRow in this app already works), so "choosing" and "playing"
 * stay two genuinely distinct actions.
 *
 * Visual pattern mirrors BetaVideoModal.jsx's own overlay (dark backdrop,
 * explicit Close, Escape-to-close) - the one full-screen overlay
 * convention this app already has - rather than inventing a second one.
 * No existing BottomSheet/catalogue-list component exists elsewhere in
 * this codebase to reuse instead.
 *
 * z-[110] (not the z-[100] BetaVideoModal.jsx uses) is deliberate, and the
 * caller renders this component as a SIBLING of <EveningSceneShell>, never
 * nested inside its children - found live: EveningSceneShell's own nav
 * row (Back/Exit, `relative z-20`) sits in the SAME stacking context as
 * this chooser's own content, both descendants of the shell's `content`
 * wrapper div (`relative z-10`). A stacking context fully contains its
 * descendants - no z-index this component declares, however high, can
 * ever paint above a SIBLING of one of its own ANCESTOR stacking
 * contexts. Reproduced live: this chooser's own Close button (top-right)
 * was genuinely unclickable, silently intercepted by the shell's Exit
 * button sitting in the same screen position one stacking context up.
 * Rendering as a sibling of EveningSceneShell entirely (not as its
 * `children`) escapes that ancestor's z-10 stacking context altogether;
 * z-[110] then only needs to clear EveningSceneShell's own highest layer
 * (its scroll-owner div, z-[101]) - no z-index anywhere else in this
 * codebase exceeds z-[101].
 *
 * PROPS
 *   videos, sounds   arrays of { id, entry, blurb, duration } - every
 *                    genuinely available item in each category, already
 *                    resolved by the caller (PrepareForRest.jsx) via
 *                    getBetaVideoById; this component invents/filters
 *                    nothing of its own.
 *   onSelect(id)     called once, the moment a row is tapped.
 *   onClose()        called on the header Close button, Escape, or a tap
 *                    on the dark backdrop itself (never on the scrollable
 *                    catalogue panel, so an accidental catalogue tap can
 *                    never dismiss the whole chooser).
 */
export const BedtimeMediaChooser = ({ videos, sounds, onSelect, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a bedtime video or sleep sound"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 shrink-0"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: '1rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-headline-md text-lg text-on-surface font-bold">Choose bedtime media</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-11 h-11 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0"
        >
          <span className="material-symbols-outlined text-on-surface-variant text-xl">close</span>
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 space-y-6"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {videos.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Guided video</h3>
            <div className="space-y-2">
              {videos.map(({ id, entry, blurb, duration }) => (
                <BetaVideoRow key={id} title={entry.title} description={blurb} duration={duration} onClick={() => onSelect(id)} />
              ))}
            </div>
          </div>
        )}

        {sounds.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Sleep sounds</h3>
            <div className="space-y-2">
              {sounds.map(({ id, entry, blurb, duration }) => (
                <BetaVideoRow key={id} title={entry.title} description={blurb} duration={duration} onClick={() => onSelect(id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

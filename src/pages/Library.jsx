/* eslint-disable no-unused-vars */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BETA_VIDEO_MANIFEST } from '../lib/betaVideoManifest';
import { LIBRARY_CATEGORIES, getLibraryCategory } from '../lib/libraryCatalog';
import { getCachedDurationMinutes } from '../lib/durationCache';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { SignInPromptDialog } from '../components/SignInPromptDialog';

const slugify = (label) => label.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const CATEGORY_ICONS = {
  Morning: 'wb_sunny',
  'Calm & Support': 'self_improvement',
  Breathing: 'air',
  'Gratitude & Reflection': 'favorite',
  Stretching: 'accessibility_new',
  'Sleep Soundscapes': 'bedtime'
};

/*
 * Mobile navigation repair, Phase 3 — Library
 *
 * The normal-user, non-beta home for every video already in
 * BETA_VIDEO_MANIFEST (E02-E30, A01-A06, B01-B05, F01-F03, G01-G04,
 * M01-M05, S01-S05, SL01-SL08) — none of this was previously browsable
 * anywhere: every id only ever appeared as a fixed 1-4-row list embedded
 * in one specific contextual page (Affirmation.jsx, Breathe.jsx,
 * PrepareForRest.jsx, etc.), and the only page that ever listed the
 * entire manifest was /beta, gated behind profiles.beta_access and
 * framed as a QA catalogue. This page carries no beta framing (no "Beta"
 * badge, no betaAccess check) and is reached from the bottom nav, so any
 * signed-in normal user can find and play anything here. It is a main
 * bottom-nav destination, so it does not get a back arrow.
 *
 * Guest access repair: every row stays visible AND tappable for guests
 * (title/description/category — nothing private) — tapping one always
 * responds immediately via useProtectedVideo/SignInPromptDialog instead
 * of the previous silent no-op. Only pressing Play inside the opened
 * modal is actually gated (get-beta-video-url requires a real signed-in
 * user server-side regardless) — the private bucket and short-lived
 * signed URLs are entirely unaffected either way.
 *
 * Duration: only SL01-SL08 have a spec-provided real duration
 * (durationLabel). Every other id shows "Guided video" until it has
 * actually been played at least once in this browser (see
 * lib/durationCache.js) — never a fabricated number, and never fetched
 * eagerly just to populate this list.
 */
export const Library = () => {
  const { isGuest } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = LIBRARY_CATEGORIES.find((c) => slugify(c) === searchParams.get('category')) || null;
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const {
    openVideo,
    handleSelect,
    closeVideo,
    promptOpen,
    dismissPrompt,
    confirmSignIn,
    confirmCreateAccount
  } = useProtectedVideo();

  const itemsByCategory = useMemo(() => {
    const grouped = {};
    for (const category of LIBRARY_CATEGORIES) grouped[category] = [];
    for (const entry of BETA_VIDEO_MANIFEST) {
      grouped[getLibraryCategory(entry.id)].push(entry);
    }
    return grouped;
  }, []);

  const visibleCategories = activeCategory ? [activeCategory] : LIBRARY_CATEGORIES;

  const handleSelectCategory = (category) => {
    setActiveCategory(category);
    const next = new URLSearchParams(searchParams);
    next.delete('openId');
    if (category) {
      next.set('category', slugify(category));
    } else {
      next.delete('category');
    }
    setSearchParams(next);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Library</h2>
        <p className="text-on-surface-variant font-body-md mt-1 text-sm">
          Every guided exercise and sleep sound, in one place.
        </p>
      </div>

      {isGuest && (
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-3 border-white/10">
          <span className="material-symbols-outlined text-secondary text-xl shrink-0">info</span>
          <p className="text-xs text-on-surface-variant">Sign in to play any item below.</p>
        </div>
      )}

      {/* Category filter chips. Guest access + mobile repair: this row is
          intentionally horizontally scrollable on its own (scroll-hide
          keeps that scrollable but visually clean — see index.css, where
          this previously-referenced-but-undefined class was actually
          defined) — the fix for the document-level horizontal scrollbar
          this used to cause lives one level up, in Layout.jsx's content
          container (`overflow-x-hidden`), not here. */}
      <div className="flex gap-2 overflow-x-auto scroll-hide -mx-4 px-4 pb-1">
        <button
          type="button"
          onClick={() => handleSelectCategory(null)}
          className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all min-h-[44px] ${
            !activeCategory ? 'bg-primary text-on-primary' : 'glass-panel text-on-surface-variant hover:bg-white/5'
          }`}
        >
          All
        </button>
        {LIBRARY_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => handleSelectCategory(category)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all min-h-[44px] ${
              activeCategory === category ? 'bg-primary text-on-primary' : 'glass-panel text-on-surface-variant hover:bg-white/5'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Content sections */}
      <div className="space-y-8">
        {visibleCategories.map((category) => {
          const items = itemsByCategory[category];
          if (!items.length) return null;
          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className="material-symbols-outlined text-primary text-lg">{CATEGORY_ICONS[category]}</span>
                <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">{category}</h3>
              </div>
              <div className="space-y-3">
                {items.map((entry) => {
                  const cachedMinutes = getCachedDurationMinutes(entry.id);
                  const durationLabel = entry.durationLabel || (cachedMinutes ? `~${cachedMinutes} min` : 'Guided video');
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleSelect(entry.id)}
                      className="w-full flex items-center gap-4 glass-panel rounded-2xl p-4 hover:bg-white/5 active:scale-[0.99] transition-all text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset min-h-[44px]"
                    >
                      <span className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-xl">
                          {isGuest ? 'lock' : 'play_circle'}
                        </span>
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-on-surface">{entry.title}</span>
                        <span className="block text-xs text-on-surface-variant leading-relaxed line-clamp-2">{entry.description}</span>
                      </span>
                      <span className="text-[10px] text-on-surface-variant/70 font-semibold uppercase tracking-wider shrink-0">{durationLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={closeVideo} />
      )}

      <SignInPromptDialog
        open={promptOpen}
        onSignIn={confirmSignIn}
        onCreateAccount={confirmCreateAccount}
        onDismiss={dismissPrompt}
      />
    </div>
  );
};

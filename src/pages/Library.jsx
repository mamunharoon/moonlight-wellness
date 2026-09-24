/* eslint-disable no-unused-vars */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CATALOG_CATEGORIES, MEDIA_CATALOG, getCategoryIcon, getMeditationCatalog } from '../lib/mediaCatalog';
import { getCachedDurationMinutes } from '../lib/durationCache';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { BackButton } from '../components/BackButton';

const slugify = (label) => label.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Build 15 DEV correction — contextual Back entry contexts. An
// ALLOWLISTED identifier only, never a free-form `returnTo` URL: each
// key maps to one fixed, hardcoded {fallback, label} pair this file
// itself owns - the `from` query value can never choose an arbitrary
// destination, only select among these pre-approved ones. An unknown or
// missing value resolves to `undefined` (looked up below), which the
// render guard below treats identically to "no context at all" - no
// contextual Back renders, safely.
const FROM_CONTEXTS = {
  home: { fallback: '/', label: 'Back to Home' },
  'evening-summary': { fallback: '/evening-complete', label: 'Back to Evening Summary' },
  'meditation-setup': { fallback: '/self-guided-meditation', label: 'Back to Meditation Setup' }
};

// Meditation experience: a UI-only pseudo-category, deliberately not part
// of CATALOG_CATEGORIES (that list still means "this item's one primary
// category" for every other consumer of mediaCatalog.js). An item's real
// category is never reassigned to select it into this filter — the chip
// below reads getMeditationCatalog() instead of grouping by `category`,
// so e.g. M01 keeps appearing under "Evening Wind-Down" AND under this
// filter, exactly the "same id, no duplicated placement" rule this
// feature is built on.
const MEDITATION_FILTER = 'Meditation';

/*
 * Daily Journey & Content Architecture — Library
 *
 * Reads from lib/mediaCatalog.js — the single central catalogue every
 * other surface (Support's recommendations, routine step video rows)
 * now shares, replacing the prior split between betaVideoManifest.js
 * (id/title/storagePath) and a separate category-only file. This page
 * is a main bottom-nav destination, so by default it does not get a
 * back arrow — a plain bottom-nav or direct `/library` visit carries no
 * `from` param, so `entryContext` below is undefined and no contextual
 * Back control renders. This must never regress into a global "Library
 * is a child page" change - direct/bottom-nav access always stays a
 * top-level destination.
 *
 * Build 15 Phase B remediation (Task 4) / Build 15 DEV correction —
 * specific callers link here with an explicit, ALLOWLISTED `?from=`
 * marker (never an arbitrary return URL): Home's "Browse exercises"/
 * "Sleep sounds" tiles use `from=home`; EveningComplete.jsx's "Choose a
 * Sleep Experience" uses `from=evening-summary`. FROM_CONTEXTS (above)
 * is the one allowlist - the marker only ever SELECTS among these
 * pre-approved {fallback, label} pairs, it can never supply its own
 * destination. Captured once via a lazy useState initializer (same
 * pattern AnytimeReset.jsx/Meditate.jsx already use for their own
 * one-time restore params) so it keeps controlling this Back control for
 * the lifetime of this mounted page even after the marker itself is
 * stripped from the visible URL a moment later - a plain `/library`
 * bottom-nav visit, or a later refresh once the marker is gone, both
 * correctly show no Back control.
 *
 * Search: client-side substring match over title + description — no
 * network request, the whole catalogue (65 items of plain text) is
 * already in this bundle.
 *
 * Unavailable items: every catalogue entry defaults `active: true`
 * (see mediaCatalog.js) since none are currently known-broken in
 * Storage — this page still renders an explicit "Unavailable" state for
 * any entry an operator later marks `active: false`, rather than
 * silently omitting it or letting it fail inside the player.
 */
export const Library = () => {
  const { isGuest } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory =
    [...CATALOG_CATEGORIES, MEDITATION_FILTER].find((c) => slugify(c) === searchParams.get('category')) || null;
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [query, setQuery] = useState('');
  // Captured once, before the strip effect below removes it from the URL -
  // see this file's own top-of-component comment for why a lazy
  // initializer (not a live searchParams.get('from') read) is required.
  // Looks up the raw `from` value in the FROM_CONTEXTS allowlist above -
  // an unknown/missing value resolves to `undefined`, never a caller-
  // chosen destination.
  const [entryContext] = useState(() => FROM_CONTEXTS[searchParams.get('from')]);

  // Strips the now-consumed `from` marker so it can't linger in the URL
  // while the user browses/filters within Library, or reappear on a
  // later browser back/forward - `category`/`openId` are left completely
  // untouched, same one-time-consume-then-clear treatment
  // AnytimeReset.jsx/Meditate.jsx already use for their own restore
  // params. Only ever strips a value that was genuinely in the allowlist -
  // an unrecognised `from` value is left in place (harmless - it never
  // matched anything and never will) rather than silently erased.
  useEffect(() => {
    if (!FROM_CONTEXTS[searchParams.get('from')]) return;
    const next = new URLSearchParams(searchParams);
    next.delete('from');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
    for (const category of CATALOG_CATEGORIES) grouped[category] = [];
    const trimmedQuery = query.trim().toLowerCase();
    const matchesQuery = (entry) => {
      if (!trimmedQuery) return true;
      return `${entry.title} ${entry.description}`.toLowerCase().includes(trimmedQuery);
    };
    for (const entry of MEDIA_CATALOG) {
      if (!matchesQuery(entry)) continue;
      grouped[entry.category].push(entry);
    }
    // Meditation is a second, independent view of the same catalogue —
    // filtered by meditation eligibility, not by primary category, so it
    // never removes an item from the group loop above.
    grouped[MEDITATION_FILTER] = getMeditationCatalog().filter(matchesQuery);
    return grouped;
  }, [query]);

  const visibleCategories = activeCategory ? [activeCategory] : CATALOG_CATEGORIES;
  const totalVisibleItems = visibleCategories.reduce((sum, c) => sum + itemsByCategory[c].length, 0);

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
      {entryContext && (
        <div className="flex items-center gap-3">
          <BackButton fallback={entryContext.fallback} label={entryContext.label} />
        </div>
      )}
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

      {/* Search */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xl pointer-events-none">search</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises and sounds..."
          className="w-full glass-panel border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-on-surface bg-transparent outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-on-surface-variant/40 min-h-[44px]"
        />
      </div>

      {/* Category filter chips. scroll-hide keeps this row's own
          horizontal scroll visually clean; Layout.jsx's content
          container (overflow-x-hidden) is what stops it from causing a
          document-level horizontal scrollbar. */}
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
        {CATALOG_CATEGORIES.map((category) => (
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
        <button
          type="button"
          onClick={() => handleSelectCategory(MEDITATION_FILTER)}
          className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all min-h-[44px] ${
            activeCategory === MEDITATION_FILTER ? 'bg-primary text-on-primary' : 'glass-panel text-on-surface-variant hover:bg-white/5'
          }`}
        >
          {MEDITATION_FILTER}
        </button>
      </div>

      {/* Content sections */}
      {totalVisibleItems === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center space-y-2">
          <span className="material-symbols-outlined text-on-surface-variant/50 text-3xl">search_off</span>
          <p className="text-sm text-on-surface-variant">
            {query.trim() ? `No results for "${query.trim()}".` : 'Nothing in this category yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {visibleCategories.map((category) => {
            const items = itemsByCategory[category];
            if (!items.length) return null;
            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="material-symbols-outlined text-primary text-lg">
                    {category === MEDITATION_FILTER ? 'spa' : getCategoryIcon(category)}
                  </span>
                  <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">{category}</h3>
                </div>
                <div className="space-y-3">
                  {/* Self-Guided Meditation: a clear entry point into the
                      new shared setup/timer experience (SelfGuidedMeditation.jsx),
                      not a duplicate implementation - same visual treatment
                      as the real guided items below it. `from=meditation-setup`
                      is the one new hardcoded FROM_CONTEXTS key this feature
                      adds, so a user who continues on to "Explore Guided
                      Meditations" from setup sees a "Back to Meditation
                      Setup" control here. Rendered only for the Meditation
                      category/filter, never altering the real guided items
                      that follow it. */}
                  {category === MEDITATION_FILTER && (
                    <Link
                      to="/self-guided-meditation?from=library"
                      className="w-full flex items-center gap-4 glass-panel rounded-2xl p-4 transition-all text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset min-h-[44px] hover:bg-white/5 active:scale-[0.99] border-primary/40"
                    >
                      <span className="w-11 h-11 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-xl">self_improvement</span>
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-on-surface">Self-Guided Meditation</span>
                        <span className="block text-xs text-on-surface-variant leading-relaxed">
                          Sit quietly with gentle background music, on your own time.
                        </span>
                      </span>
                    </Link>
                  )}
                  {items.map((entry) => {
                    const cachedMinutes = getCachedDurationMinutes(entry.id);
                    const durationLabel = entry.durationLabel || (cachedMinutes ? `~${cachedMinutes} min` : 'Guided video');
                    const isUnavailable = entry.active === false;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        disabled={isUnavailable}
                        onClick={() => handleSelect(entry.id)}
                        className={`w-full flex items-center gap-4 glass-panel rounded-2xl p-4 transition-all text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset min-h-[44px] ${
                          isUnavailable ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 active:scale-[0.99]'
                        }`}
                      >
                        <span className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary text-xl">
                            {isUnavailable ? 'error_outline' : isGuest ? 'lock' : 'play_circle'}
                          </span>
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-on-surface">{entry.title}</span>
                          <span className="block text-xs text-on-surface-variant leading-relaxed line-clamp-2">
                            {isUnavailable ? 'Unavailable right now.' : entry.description}
                          </span>
                        </span>
                        <span className="text-[10px] text-on-surface-variant/70 font-semibold uppercase tracking-wider shrink-0">
                          {isUnavailable ? '' : durationLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

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

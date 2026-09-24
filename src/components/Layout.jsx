/* eslint-disable no-unused-vars */
import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAudio } from '../context/AudioContext';

export const Layout = () => {
  const { currentTrack, isPlaying, togglePlay, progress } = useAudio();
  const location = useLocation();

  // Mobile navigation repair / Safe backward navigation ("Review Mode")
  // fix: the "restore the user into their in-progress step" forced-
  // redirect effect that used to live here now lives in
  // RoutineRestoreGuard.jsx, mounted once directly inside <Router>
  // (App.jsx) instead of inside this component — see that file's own doc
  // comment for why a Layout-scoped effect was fighting Review Mode
  // navigation whenever a review crossed the Layout/non-Layout route
  // boundary (only breathe/morning-flow, of the nine Morning/Evening step
  // routes, are actually nested under <Layout> in App.jsx's route tree).

  // Routines removed from the visible nav (WakeWise DEV — Remove Routines
  // from the Visible User Flow): the Routines Hub duplicated Home's own
  // clearer Morning/Anytime/Evening model. Home is now the single place
  // for choosing the daily rhythm - see App.jsx's own /routines and
  // /routines/:routineId redirects, and Introduction.jsx's Welcome cards,
  // which now route directly to the same canonical entry points Home
  // itself uses rather than through the (now unrouted) Routines Hub.
  // Routines.jsx/RoutineDetail.jsx/routinesCatalog.js are all still
  // present and unmodified, just no longer wired into the route table -
  // reusable later by restoring the entry below and the App.jsx routes.
  // No fourth item replaces it yet, per the approved brief. Each
  // remaining item is already `flex-1` (below), so removing one entry
  // here is the ONLY change needed for the three survivors to share the
  // bar's width evenly - no other layout math to touch.
  const navItems = [
    { label: 'Home', path: '/', icon: 'home_health' },
    { label: 'Library', path: '/library', icon: 'video_library' },
    { label: 'Profile', path: '/profile', icon: 'person' }
  ];

  const hideNavigation = ['/onboarding', '/alarm-trigger', '/session-complete', '/landing', '/affirmation', '/intention-setup', '/morning-flow', '/breathe', '/evening-wind-down', '/reflection', '/gratitude', '/evening-breathing', '/prepare-for-rest', '/evening-complete'].includes(location.pathname);

  return (
    <div
      className="h-dvh bg-background text-on-surface flex flex-col transition-colors duration-300"
      style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
    >

      {/* Immersive background layer */}
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[10%] left-1/4 w-[350px] h-[350px] bg-primary/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[20%] right-1/4 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Main Responsive Container. Mobile navigation repair, Phase 4:
          root changed from min-h-screen (a lower bound only — nothing
          actually constrained the page to viewport height) to h-dvh (a
          real, dynamic-viewport-aware bound, correct for iOS Safari's
          collapsing address bar) with min-h-0 here and on the scrollable
          content div below. Without a real bound + min-h-0, a flex-1
          child with overflow-y-auto can't actually engage its own
          scrolling — its content just grows the whole page instead
          (confirmed live: Library's "All" filter, long enough to be the
          first page ever this long, grew the page to 7000+px instead of
          scrolling internally, taking the fixed header and bottom nav
          along with it). Every shorter existing page happened to never
          have enough content to expose this. */}
      <div className="relative flex-1 min-h-0 flex flex-col max-w-md w-full mx-auto z-10">
        
        {/* Global Page Header. iPhone safe-area repair: top padding adds
            env(safe-area-inset-top) on top of the normal 1rem so the logo
            never renders under the notch/Dynamic Island/status bar in
            Safari, standalone PWA, or the Capacitor shell (see
            capacitor.config.ts's ios.contentInset: 'never' - the native
            WKWebView no longer auto-insets itself, so this env() value is
            the single source of truth everywhere, never doubled up). */}
        {!hideNavigation && (
          <header
            className="flex justify-between items-center px-4 pb-4 w-full border-b border-white/5 shrink-0 z-40"
            style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>spa</span>
              <h1 className="font-headline-md text-lg text-primary font-bold tracking-tight">
                WakeWise
              </h1>
            </div>
          </header>
        )}

        {/* Dynamic Route Content. Bottom padding clears the taller
            (72px) nav bar plus the iOS home-indicator safe area, so the
            last card/button on any page is never hidden behind either —
            see index.html's viewport-fit=cover, added alongside this.
            Guest access repair: overflow-x-hidden added here — Library's
            category-chip row uses a full-bleed `-mx-4` + `overflow-x-auto`
            technique (intentionally horizontally scrollable, on its own),
            but this outer container only ever constrained the Y axis, so
            that row's own scrollWidth was free to push the whole page
            wider than the viewport and produce a visible document-level
            horizontal scrollbar. This clips at the container instead,
            without touching the chip row's own internal scrolling.
            iPhone safe-area repair: on routes that hide the header
            (hideNavigation), this div's own top padding is the first thing
            below the notch/Dynamic Island, so it needs the same
            env(safe-area-inset-top) addition the header gets above -
            never both at once, since a shown header already reserves
            that space and this div starts right after it. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-hide px-4"
          style={{
            paddingTop: hideNavigation ? 'calc(1rem + env(safe-area-inset-top))' : '1rem',
            paddingBottom: hideNavigation ? 'calc(7.5rem + env(safe-area-inset-bottom))' : '1rem',
            // Bottom-nav overlap fix, found live on tall/desktop viewports:
            // this div is a `flex-1` sibling of the `absolute`-positioned
            // nav below, so it always fills the SAME full container height
            // the nav floats over - a bare paddingBottom only pushes the
            // reserved gap further down the SCROLLABLE content, which does
            // nothing when that content is already short enough to fit
            // the viewport without scrolling (confirmed live: nothing ever
            // forces a scroll to reveal padding that was never actually
            // subtracted from this element's own box). marginBottom, by
            // contrast, genuinely shrinks this flex item's own box by the
            // nav's exact footprint (its bottom offset + its own height),
            // so the last piece of real content can never render behind
            // the nav - whether or not the page needs to scroll at all.
            // Only reserved when the nav actually renders (!hideNavigation)
            // - routes that hide it (e.g. /breathe, /morning-flow) must not
            // gain unexplained blank space at the bottom.
            marginBottom: hideNavigation ? '0px' : 'calc(1rem + 72px + env(safe-area-inset-bottom))',
            // Scroll-chaining hardening: without this, a wheel/trackpad
            // gesture that starts right at this container's top/bottom
            // edge (e.g. immediately after ExercisePausedPanel changes
            // the page's height, or right after a modal closes) can hand
            // the remaining scroll delta to an ancestor instead of
            // stopping - the immersive `fixed inset-0` background layer
            // above has no scroll of its own to receive it, which reads
            // to a real trackpad/mouse-wheel user as "scrolling stopped
            // responding". Scoping the scroll to this element only is a
            // real, low-risk fix regardless of the exact trigger.
            overscrollBehaviorY: 'contain'
          }}
        >
          <Outlet />
        </div>

        {/* Global Persistent Audio Player */}
        {currentTrack && !hideNavigation && (
          <div className="absolute left-4 right-4 z-40 glass-panel rounded-2xl p-3 flex items-center justify-between shadow-2xl border-white/10 animate-in slide-in-from-bottom-5 duration-300" style={{ bottom: 'calc(92px + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                <img className="w-full h-full object-cover" src={currentTrack.image} alt={currentTrack.title} />
              </div>
              <div className="overflow-hidden w-full">
                <h6 className="font-label-md text-on-surface truncate text-xs font-bold leading-none">{currentTrack.title}</h6>
                <div className="w-full h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            </div>
            <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 ml-2 active:scale-90 transition-transform">
              <span className="material-symbols-outlined text-lg">{isPlaying ? 'pause' : 'play_arrow'}</span>
            </button>
          </div>
        )}

        {/* Flat Bottom Navigation bar. Mobile navigation repair, Phase 1:
            every item (not just the active one) now gets a real ~44x44px
            touch target (min-w-[44px] min-h-[44px], flex-1 so all four
            share the bar evenly) plus a text label under the icon — the
            audit found the previous inactive-tab className had *no*
            padding at all, so its hit area was just the bare icon glyph
            (~24px), well under a usable mobile tap target: a near-miss
            tap reads to the user as "the icon didn't respond" and needs a
            retry, which presents exactly as slow/unresponsive navigation
            even though nothing in the click handler itself was slow.
            active:scale-90 now applies to every item on :active (a CSS
            pseudo-class — fires on touch-down, not gated behind any JS),
            so every tap gets immediate visual feedback, not just the
            already-active tab. */}
        {!hideNavigation && (
          <nav className="absolute left-4 right-4 z-40 glass-panel rounded-full h-[72px] shadow-[0_10px_20px_rgba(149,72,53,0.15)] border border-white/10 flex items-stretch px-2" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/today');
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  // Same-tab taps are already idempotent (react-router
                  // doesn't push a duplicate history entry for the current
                  // location), but this avoids even attempting a
                  // navigation when the user is already there — belt and
                  // suspenders against rapid repeated taps.
                  onClick={(e) => { if (isActive) e.preventDefault(); }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex-1 min-w-[44px] min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-full transition-all duration-150 active:scale-90 ${
                    isActive
                      ? 'bg-primary-container/80 text-on-primary-container shadow-md shadow-primary/10'
                      : 'text-on-surface-variant/70 hover:text-on-surface active:bg-white/5'
                  }`}
                >
                  {/* Build 15 Phase A — icon/label bumped one step
                      (22px→24px, 10px→11px) per tester feedback ("text
                      and icons could be larger"). Nav bar height
                      (h-[72px] below) and the min-w/min-h-[44px] touch
                      target are both already generous enough that this
                      fits without growing the bar - verified live, no
                      change to nav height or the bottom-nav clearance
                      math needed. */}
                  <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                    {item.icon}
                  </span>
                  <span className="text-[11px] font-bold leading-none">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

      </div>
    </div>
  );
};
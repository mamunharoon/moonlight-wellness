import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { isAndroid } from '../lib/platform';
import { runBackHandler } from '../lib/backHandlerRegistry';

/*
 * Android system Back button/gesture repair.
 *
 * Root cause: MainActivity.java is a bare, unmodified
 * `BridgeActivity` and no code anywhere registered a listener for
 * Capacitor's `backButton` event - so Capacitor's own native default
 * ran on every hardware Back press and every edge-swipe-back gesture:
 * raw WebView history traversal (`webView.goBack()` when
 * `canGoBack()`, else exit). That traverses actual browser session
 * history - every push/replace this app instance ever made, including
 * ones the app's own curated stack (NavigationHistoryContext)
 * intentionally treats as collapsed/replaced - which is exactly the
 * reported defect: Back "returns to the last displayed screen in
 * navigation history" instead of following the in-app back arrow's own
 * contextual logic. iOS has the same category of gap today (Main
 * ViewController.swift's edge-swipe gesture is also raw WebView
 * back/forward, merely disabled outright on 5 hardcoded Evening
 * routes) - out of scope here, Android-only per this fix's brief.
 *
 * Registering ANY listener for Capacitor's `backButton` event replaces
 * that native default entirely (documented Capacitor App-plugin
 * behaviour) - once this hook is mounted, native Android no longer
 * touches WebView history on Back at all; every press is fully
 * resolved by this callback.
 *
 * Resolution order:
 *   1. runBackHandler() - invokes whichever in-app control
 *      (BackButton/ConfirmDialog/JourneyHeader's step-back/etc., see
 *      backHandlerRegistry.js) is currently topmost, i.e. exactly what
 *      tapping the visible back arrow or dismissing the visible dialog
 *      would do. Covers Morning, Evening, Anytime, Library and every
 *      nested exercise screen - anywhere a real back-navigation repair
 *      component already renders, AND every open dialog/overlay (kind
 *      'overlay' always wins there - see backHandlerRegistry.js).
 *   2. No handler registered - only true on a screen with no in-app back
 *      arrow AND no open dialog/overlay: Home ('/'), a bottom-nav tab
 *      landed on directly with no back context (Library/Profile without
 *      an entryContext), or Auth reached fresh. Post-review correction
 *      (was: always App.exitApp()): already AT Home (pathname === '/')
 *      still exits - the standard Android convention for Back at the
 *      app's one true root - but anywhere else, Back now prefers
 *      returning to Home first (navigate('/', { replace: true }),
 *      matching how a bottom-nav app's Back conventionally behaves -
 *      Library/Profile visited directly, Journal, Settings, Audio*, etc.
 *      all fall through to this branch), exiting only actually happens
 *      from Home. This is deliberately a pure `pathname === '/'` check,
 *      not app-state-aware - it does NOT need to special-case Welcome:
 *      OnboardingGate.jsx registers its own 'screen' handler
 *      (App.exitApp(), reusing its own existing needsWelcome gate
 *      directly rather than a second copy of it here) for as long as
 *      Welcome is genuinely showing, which - being state-based, not
 *      pathname-based - wins via runBackHandler() above BEFORE this
 *      pathname fallback would ever run, even for the deep-link case
 *      (OnboardingGate's own comment: "A native deep link or notification
 *      tap landing on any other unauthenticated route still resolves to
 *      Welcome first") where pathname isn't '/'. See OnboardingGate.jsx's
 *      own doc comment on that registration for the full reasoning.
 *
 * pathnameRef (not a `location.pathname` dependency on the effect below)
 * is deliberate: re-running the registration effect on every navigation
 * would remove and re-add the native listener on every single route
 * change (listener.remove() is itself async - a Promise - so a fast
 * enough second navigation could add the new listener before the old
 * one's removal actually lands natively, producing two live listeners
 * and a Back press handled/navigated twice - exactly the duplicate-
 * handler failure mode this whole fix exists to prevent, see
 * backCloseConsistency-style "handled exactly once" contract).
 * useNavigate()'s own return value is referentially stable across
 * renders (react-router guarantee), so `[navigate]` below still only
 * ever registers the listener once, for the app's whole lifetime - the
 * ref is what lets the callback see the CURRENT pathname at the moment
 * Back is actually pressed without paying that cost.
 *
 * Android-only (isAndroid()): iOS keeps its existing edge-swipe-gesture
 * behaviour untouched (MainViewController.swift, unrelated to this
 * hook), and web/PWA has no hardware Back button or Capacitor App
 * plugin `backButton` event to listen for at all.
 *
 * Mounted exactly once, for the app's whole lifetime (see the
 * AndroidBackButtonHandler wrapper in App.jsx, colocated with the other
 * native-only "renders nothing" handlers - NativeDeepLinkHandler,
 * MorningReminderTapHandler) - guarantees exactly one native listener
 * ever exists, so a hardware Back press can never be handled twice.
 */
export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  });

  useEffect(() => {
    if (!isAndroid()) return undefined;

    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      const handled = runBackHandler();
      if (handled) return;

      if (pathnameRef.current === '/') {
        CapacitorApp.exitApp();
      } else {
        navigate('/', { replace: true });
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [navigate]);
}

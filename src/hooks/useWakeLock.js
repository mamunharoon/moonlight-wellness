import { useEffect, useRef } from 'react';

/*
 * Keeps the screen awake for as long as `active` is true - tester-reported
 * defect: the screen sleeps mid-Morning-routine and mid-meditation.
 *
 * Uses the standard Screen Wake Lock API (`navigator.wakeLock`) rather than
 * a native Capacitor plugin - this app's WebViews are Chromium (Android,
 * supported since Chrome 84) and WKWebView (iOS, supported from iOS 16.4),
 * so the existing web capability already covers both platforms with no new
 * native dependency, no Podfile/Gradle change, and no extra permission.
 * Where it isn't supported (an older iOS WebView), `navigator.wakeLock` is
 * simply undefined and this hook is a silent no-op - the screen sleeps on
 * its normal schedule, exactly like today, never a hard failure.
 *
 * Deliberately keyed on a per-screen `active` boolean, never mounted
 * unconditionally for the app's lifetime - "do not keep the screen awake
 * throughout the entire app" means every caller must pass true only while
 * a real timed/playing activity is genuinely in front of the user, and
 * false the instant it's paused, finished, or left (each caller's own
 * active flag already encodes this - see this hook's call sites).
 *
 * The OS itself releases a wake lock the moment the document goes into
 * the background (tab hidden / app backgrounded) - that's the platform's
 * own behaviour, nothing to implement here. The `visibilitychange` listener
 * below only handles the return trip: re-acquiring once the app is
 * foregrounded again, for as long as `active` is still true at that point.
 */
export const useWakeLock = (active) => {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    if (typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;

    let cancelled = false;

    const acquire = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        // Declined (low battery, document not visible yet, unsupported in
        // this exact build) - not fatal, the screen just sleeps normally.
      }
    };

    acquire();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [active]);
};

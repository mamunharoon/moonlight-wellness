import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { isNativePlatform } from '../lib/platform';

/*
 * Settings "Application" section version/build display fix.
 *
 * Root cause of the installed TestFlight app showing "Version 0.0.0 /
 * Build number 1": Settings.jsx used to hardcode those two strings from
 * package.json's own "version" field ("0.0.0", a Node-convention
 * placeholder never actually maintained) and a literal "1" - neither
 * was ever the real native source of truth. The actual shipped values
 * are: CFBundleShortVersionString (Xcode's MARKETING_VERSION, currently
 * 1.0 - a deliberate product decision, not auto-bumped) and
 * CFBundleVersion (Xcode's CURRENT_PROJECT_VERSION), which
 * codemagic.yaml's own "Determine and set the next available TestFlight
 * build number" step sets via `agvtool new-version -all` to App Store
 * Connect's real highest-existing-build + 1 at BUILD time - never
 * committed back to the repo, so no static value here could ever stay
 * correct across builds even if it started out right.
 *
 * `@capacitor/app`'s App.getInfo() (already a project dependency, same
 * import convention useNativeDeepLinks.js/MorningReminderContext.jsx
 * already use) reads those exact values from the real installed
 * binary at runtime - the one source that is always correct for
 * whatever build is actually running, with zero maintenance.
 *
 * getInfo() is NOT implemented on web (@capacitor/app's own web shim
 * throws "Not implemented on web.") - isNativePlatform() (lib/platform.js,
 * the same guard every other native-only call in this app already uses)
 * is checked FIRST, so this never even attempts the call in a browser
 * preview, matching "do not misleadingly present a fallback as real
 * native build information."
 *
 * Returns one of:
 *   { status: 'web' }                         - not running natively
 *   { status: 'loading' }                      - native, fetch in flight
 *   { status: 'ready', version, build }        - native, real values
 *   { status: 'error' }                        - native, but the call
 *                                                 failed (plugin missing/
 *                                                 misconfigured) - never
 *                                                 silently falls back to
 *                                                 a fabricated number
 */
export const useNativeAppInfo = () => {
  const [state, setState] = useState(() => (isNativePlatform() ? { status: 'loading' } : { status: 'web' }));

  useEffect(() => {
    if (!isNativePlatform()) return undefined;
    let cancelled = false;
    CapacitorApp.getInfo()
      .then(({ version, build }) => {
        if (cancelled) return;
        setState({ status: 'ready', version, build });
      })
      .catch((error) => {
        console.warn('[useNativeAppInfo] Could not read native app version/build info', error);
        if (cancelled) return;
        setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};

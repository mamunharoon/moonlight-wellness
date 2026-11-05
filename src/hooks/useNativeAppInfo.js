import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { isNativePlatform } from '../lib/platform';

/*
 * Settings "Application" section version/build display fix (ported from
 * dev commit dece7dd onto this PROD-bound branch).
 *
 * Root cause of the installed TestFlight app showing "Version 0.0.0 /
 * Build number 1": Settings.jsx hardcodes those two strings from
 * package.json's own "version" field ("0.0.0", a Node-convention
 * placeholder never actually maintained) and a literal "1" - neither
 * was ever the real native source of truth. The actual shipped values
 * are: CFBundleShortVersionString (Xcode's MARKETING_VERSION) and
 * CFBundleVersion (Xcode's CURRENT_PROJECT_VERSION), which
 * codemagic.yaml's own build step sets dynamically via `agvtool
 * new-version -all` to App Store Connect's real highest-existing-build
 * + 1 at BUILD time - never committed back to the repo, so no static
 * value here could ever stay correct across builds even if it started
 * out right.
 *
 * This is a DIFFERENT, narrower concern from this branch's own existing
 * `nativeBuild`/Environment row (environmentBuildInfo.js) - that row
 * shows which build/commit is actually running, for internal dev/QA
 * freshness checks, and is left completely untouched by this hook. This
 * hook exists only to correct the separate, pre-existing Version/Build
 * number rows that were always meant to show the installed app's real
 * marketing version and build number to any user, not just internal
 * testers.
 *
 * `@capacitor/app`'s App.getInfo() (already a project dependency, same
 * import convention this file's own existing `nativeBuild` effect and
 * useNativeDeepLinks.js/MorningReminderContext.jsx already use) reads
 * those exact values from the real installed binary at runtime - the
 * one source that is always correct for whatever build is actually
 * running, with zero maintenance.
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

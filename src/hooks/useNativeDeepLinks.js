import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { isNativePlatform } from '../lib/platform';
import { resolveIncomingUrl } from '../lib/nativeAuthRecovery';

// Native deep-link scheme: wakewise://
// Documented paths (reset-password is not yet registered with Supabase
// Auth's redirect allow-list — that requires an explicit, separate
// dashboard-change approval; see docs/ios-xcode-handoff.md):
//   wakewise://reset-password  -> classified and handled by
//                                  nativeAuthRecovery.js's
//                                  resolveIncomingUrl() below (it needs
//                                  to inspect the token payload, not just
//                                  the path, before it's safe to navigate)
//   wakewise://auth            -> maps to the existing /auth route
// Only same-origin app routes are ever navigated to; the scheme/host of
// the incoming URL is never used to build an external redirect.
const ALLOWED_DEEP_LINK_PATHS = new Set(['auth']);

export function useNativeDeepLinks() {
  const navigate = useNavigate();
  // Persists across a React Strict Mode double-mount (refs survive the
  // effect's mount/cleanup/mount cycle) and across getLaunchUrl() +
  // appUrlOpen both delivering the same cold-launch URL, so a recovery
  // link's session-establishment and navigation only ever happen once —
  // see resolveIncomingUrl()'s own dedup for the testable version of
  // this logic.
  const processedUrlsRef = useRef(new Set());

  useEffect(() => {
    if (!isNativePlatform()) return undefined;

    const handleUrl = async (url) => {
      const result = await resolveIncomingUrl(url, {
        processedUrls: processedUrlsRef.current,
        allowedPaths: ALLOWED_DEEP_LINK_PATHS,
      });
      if (result) navigate(result.path, result.options);
    };

    // Cold launch: the app may have been opened directly via a
    // wakewise:// URL, which appUrlOpen alone is not guaranteed to
    // deliver — getLaunchUrl() is Capacitor's documented mechanism for
    // retrieving it once on startup.
    CapacitorApp.getLaunchUrl().then((result) => {
      if (result?.url) handleUrl(result.url);
    });

    const listenerPromise = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      handleUrl(url);
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [navigate]);
}

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { isNativePlatform } from '../lib/platform';

// Proposed native deep-link scheme: wakewise://
// Documented paths (not yet registered with Supabase Auth redirect URLs —
// that requires an explicit, separate dashboard-change approval):
//   wakewise://reset-password  -> maps to the existing /reset-password route
//   wakewise://auth            -> maps to the existing /auth route
// Only same-origin app routes are ever navigated to; the scheme/host of the
// incoming URL is never used to build an external redirect.
const ALLOWED_DEEP_LINK_PATHS = new Set(['reset-password', 'auth']);

export function useNativeDeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativePlatform()) return undefined;

    const listenerPromise = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'wakewise:') return;
        const path = (parsed.hostname || parsed.pathname.replace(/^\/+/, '')).toLowerCase();
        if (ALLOWED_DEEP_LINK_PATHS.has(path)) {
          navigate(`/${path}${parsed.search}`);
        }
      } catch (error) {
        console.warn('[deep-link] ignoring unparseable url', error);
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [navigate]);
}

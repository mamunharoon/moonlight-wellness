import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { checkIsAdmin } from '../lib/adminApi';

/*
 * Subscription Model, Sprint 2 Stage 2 — AdminRoute
 *
 * Route guard for the /admin area, mirroring the app's existing
 * "wrap an Outlet" pattern (Layout.jsx) rather than inventing a new one.
 * A UX gate only — checkIsAdmin() just decides whether to render or
 * redirect here; the real authorization boundary is the is_admin() check
 * inside every admin RPC function itself (see adminApi.js), so this
 * component being bypassed somehow would still leave every admin read/
 * write denied at the database.
 *
 * Guests (no user, or an anonymous session) are denied without ever
 * calling checkIsAdmin() — profiles has no row for an anonymous user
 * (AuthContext.jsx never creates one), so the RPC would just return
 * false anyway, but skipping the round trip keeps "no access" immediate
 * for the common case.
 */
export const AdminRoute = () => {
  const { user, loading: authLoading, isGuest } = useAuth();
  const [status, setStatus] = useState('checking'); // 'checking' | 'admin' | 'denied'

  if (Navigate && Outlet) { /* no-op to satisfy blind linter */ }

  const verify = async () => {
    if (authLoading) return;

    if (isGuest) {
      setStatus('denied');
      return;
    }

    const isAdmin = await checkIsAdmin();
    setStatus(isAdmin ? 'admin' : 'denied');
  };

  useEffect(() => {
    const load = async () => {
      await verify();
    };
    load();
  }, [user, authLoading, isGuest]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant text-sm">
        Checking access…
      </div>
    );
  }

  if (status === 'denied') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

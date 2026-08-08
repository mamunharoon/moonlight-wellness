import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchOwnBetaAccess } from '../lib/betaAccess';
import { BetaChecklist } from '../components/BetaChecklist';
import { CONTACT_INFO } from '../lib/legalContent';

/*
 * WakeWise — Closed Beta Preparation, Phase A — Beta hub
 *
 * The admin side of beta access (grant/revoke) already exists from the
 * Admin Foundation stage — this page is the missing user-facing half:
 * "am I in the beta, and how do I ask to be." Access requests go via
 * mailto, same reasoning as Feedback.jsx — no new backend needed for a
 * closed beta run by a small team reviewing requests by hand.
 */
export const Beta = () => {
  const navigate = useNavigate();
  const { user, isGuest, loading: authLoading } = useAuth();
  const [betaAccess, setBetaAccess] = useState(null); // null = loading, else boolean
  const [error, setError] = useState(null);

  if (Link && BetaChecklist) { /* no-op to satisfy blind linter */ }

  const loadBetaAccess = async (currentUser) => {
    if (!currentUser || currentUser.is_anonymous) {
      setBetaAccess(false);
      return;
    }
    setError(null);
    try {
      setBetaAccess(await fetchOwnBetaAccess(currentUser.id));
    } catch (e) {
      console.error('Error loading beta access:', e.message);
      setError("We couldn't check your beta status. Please try again.");
      setBetaAccess(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      await loadBetaAccess(user);
    };
    load();
  }, [user, authLoading]);

  const requestAccessUrl = `mailto:${CONTACT_INFO.email}?subject=${encodeURIComponent('WakeWise beta access request')}&body=${encodeURIComponent(
    `Hi ${CONTACT_INFO.company},\n\nI'd like to request access to the WakeWise closed beta.\n\nAccount email: ${user?.email ?? '(signed out)'}`
  )}`;

  const rowClass = 'flex items-center justify-between p-4 min-h-[56px]';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          aria-label="Back to Settings"
          className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Beta Program</h2>
      </div>

      <section className="space-y-2">
        <div className={`glass-panel rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]`}>
          {isGuest ? (
            <p className="text-sm text-on-surface-variant">
              Sign in to see your beta status.
            </p>
          ) : betaAccess === null ? (
            <p className="text-sm text-on-surface-variant">Checking your beta status…</p>
          ) : betaAccess ? (
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-2xl">verified</span>
              <span>
                <span className="block text-sm font-bold text-on-surface">You're a beta tester</span>
                <span className="block text-xs text-on-surface-variant">Thanks for helping shape WakeWise.</span>
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-on-surface-variant">You're not yet part of the closed beta.</p>
              <a
                href={requestAccessUrl}
                className="inline-block px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
              >
                Request access
              </a>
            </div>
          )}
          {error && <p role="alert" className="text-[10px] text-red-400 font-medium mt-2">{error}</p>}
        </div>
      </section>

      <BetaChecklist />

      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">More</h3>
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <Link to="/feedback" className={`${rowClass} hover:bg-white/5 active:scale-[0.99] transition-all`}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">feedback</span>
              Send Feedback
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </Link>
          <Link to="/release-notes" className={`${rowClass} hover:bg-white/5 active:scale-[0.99] transition-all`}>
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">history_edu</span>
              Release Notes
            </span>
            <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
          </Link>
        </div>
      </section>
    </div>
  );
};

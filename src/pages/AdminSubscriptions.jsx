import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAdminSubscriptions, setSubscriptionStatus } from '../lib/adminApi';

/*
 * Subscription Model, Sprint 2 Stage 2 — Subscriptions view (/admin/subscriptions)
 *
 * Fields per the stage brief: plan, status, provider, renewal date. Email
 * is shown as the row identifier only (an admin cannot act on "a plan"
 * without knowing whose it is) — see admin_list_subscriptions()'s own
 * comment. Status is the one editable field (capability 4 — "change plan
 * status manually"); plan and provider are read-only here, matching the
 * migration's admin_set_subscription_status(), which only ever writes
 * `status`.
 */
const PLAN_LABELS = { free: 'Free', plus: 'WakeWise Plus' };
const STATUS_OPTIONS = ['trial', 'active', 'cancelled', 'expired'];
const STATUS_LABELS = { trial: 'Trial', active: 'Active', cancelled: 'Cancelled', expired: 'Expired' };
const PROVIDER_LABELS = { manual: 'Manual', stripe: 'Stripe', apple: 'Apple', google: 'Google' };

const formatRenewalDate = (row) => {
  if (!row.expires_at) return 'No renewal date';
  return new Date(row.expires_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const AdminSubscriptions = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  const loadSubscriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminSubscriptions();
      setRows(data);
    } catch (e) {
      console.error('Error loading admin subscriptions:', e.message);
      setError("We couldn't load subscriptions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      await loadSubscriptions();
    };
    load();
  }, []);

  const handleStatusChange = async (row, nextStatus) => {
    if (nextStatus === row.status) return;
    setPendingId(row.user_id);
    try {
      await setSubscriptionStatus(row.user_id, nextStatus);
      setRows((prev) => prev.map((r) => (r.user_id === row.user_id ? { ...r, status: nextStatus } : r)));
    } catch (e) {
      console.error('Error updating subscription status:', e.message);
      setError("We couldn't update this subscription. Please try again.");
    } finally {
      setPendingId(null);
    }
  };

  const rowClass = 'flex items-center justify-between gap-3 p-4 min-h-[56px]';

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin')}
          aria-label="Back to Administration"
          className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Subscriptions</h2>
      </div>

      {error && (
        <p role="alert" className="text-[10px] text-red-400 font-medium px-1">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-on-surface-variant px-1">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-on-surface-variant px-1">No subscriptions found.</p>
      ) : (
        <section className="space-y-2">
          <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            {rows.map((row) => (
              <div key={row.user_id} className={`${rowClass} flex-wrap`}>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs text-on-surface-variant truncate">{row.email}</span>
                  <span className="block text-sm font-bold text-on-surface">
                    {PLAN_LABELS[row.plan] ?? row.plan} · {PROVIDER_LABELS[row.provider] ?? row.provider}
                  </span>
                  <span className="block text-xs text-on-surface-variant">{formatRenewalDate(row)}</span>
                </span>
                <select
                  aria-label={`Status for ${row.email}`}
                  value={row.status}
                  disabled={pendingId === row.user_id}
                  onChange={(e) => handleStatusChange(row, e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-full text-xs font-bold text-on-surface px-3 py-1.5 shrink-0 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option} className="bg-surface text-on-surface">
                      {STATUS_LABELS[option]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

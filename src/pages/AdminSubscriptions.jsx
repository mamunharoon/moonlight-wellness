/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { fetchAdminSubscriptions, setSubscriptionStatus } from '../lib/adminApi';
import { summarizeAdminSubscriptions, isStatusEditable } from '../lib/adminSubscriptionsSummary';
import { BackButton } from '../components/BackButton';

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
 *
 * N-04 fix (reports/p2c-prg-dash-verification-2026-10-19.md /
 * supabase/migrations/20261019160000_admin_list_subscriptions_multi_provider.sql):
 * admin_list_subscriptions() now resolves Stripe/Apple/Google with the
 * same expiry-aware rules the real entitlement system already uses,
 * instead of only ever reading the legacy Stripe table. Still exactly one
 * row per registered user (never double-counted for holding more than
 * one provider record) — provider_record_count and the summary line below
 * surface that distinction without changing that one-row-per-user shape.
 * environment (sandbox/production) and cancel_at_period_end are shown so
 * "cancelled-but-still-entitled until expiry" is never confused with a
 * genuinely cancelled/expired subscription. The status dropdown is
 * disabled for an apple/google winner (isStatusEditable) — see that
 * function's own header for why editing it there would be misleading,
 * not merely redundant.
 */
const PLAN_LABELS = { free: 'Free', plus: 'WakeWise Plus' };
const STATUS_OPTIONS = ['trial', 'active', 'cancelled', 'expired'];
const STATUS_LABELS = { trial: 'Trial', active: 'Active', cancelled: 'Cancelled', expired: 'Expired' };
const PROVIDER_LABELS = { manual: 'Manual', stripe: 'Stripe', apple: 'Apple', google: 'Google' };
const ENVIRONMENT_LABELS = { sandbox: 'Sandbox', production: 'Production' };

const formatRenewalDate = (row) => {
  if (!row.expires_at) return 'No renewal date';
  return new Date(row.expires_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const AdminSubscriptions = () => {
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
    if (!isStatusEditable(row.provider)) return;
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
        <BackButton fallback="/admin" label="Back to Administration" />
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
          {(() => {
            const summary = summarizeAdminSubscriptions(rows);
            return (
              <p className="text-xs text-on-surface-variant px-1">
                {summary.revenueSubscribers} unique Plus subscriber{summary.revenueSubscribers === 1 ? '' : 's'} of {summary.totalUsers} registered user{summary.totalUsers === 1 ? '' : 's'}
                {summary.sandboxPlusSubscribers > 0 && ` · ${summary.sandboxPlusSubscribers} sandbox (never revenue)`}
                {summary.totalProviderRecords > summary.totalUsers && ` · ${summary.totalProviderRecords} underlying subscription records`}
              </p>
            );
          })()}
          <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            {rows.map((row) => {
              const editable = isStatusEditable(row.provider);
              return (
                <div key={row.user_id} className={`${rowClass} flex-wrap`}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs text-on-surface-variant truncate">{row.email}</span>
                    <span className="block text-sm font-bold text-on-surface">
                      {PLAN_LABELS[row.plan] ?? row.plan} · {row.provider ? (PROVIDER_LABELS[row.provider] ?? row.provider) : '—'}
                      {row.environment && ` (${ENVIRONMENT_LABELS[row.environment] ?? row.environment})`}
                      {row.provider_record_count > 1 && ` · ${row.provider_record_count} records`}
                    </span>
                    <span className="block text-xs text-on-surface-variant">
                      {formatRenewalDate(row)}
                      {row.plan === 'plus' && row.cancel_at_period_end && ' · auto-renew off'}
                    </span>
                    {!editable && (
                      <span className="block text-[10px] text-on-surface-variant italic">
                        Managed by {PROVIDER_LABELS[row.provider]} — status here won&apos;t change it
                      </span>
                    )}
                  </span>
                  <select
                    aria-label={`Status for ${row.email}`}
                    value={row.status}
                    disabled={pendingId === row.user_id || !editable}
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
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

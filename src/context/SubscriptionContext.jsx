/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { getEntitlements } from '../lib/entitlements';
import { applySubscriptionOverride } from '../lib/subscriptionOverride';

const SubscriptionContext = createContext();

const SUBSCRIPTION_COLUMNS = 'id, plan, status, provider, started_at, expires_at, cancel_at_period_end';

// The implicit default for a guest, or a signed-in user with no row yet
// — the expected state for every user until a future stage's
// plan-assignment mechanism exists (see the migration's own doc
// comment). Never written to the database; this is a read-time default
// only, matching entitlements.js's own null-safe design.
const FREE_DEFAULT = {
  plan: 'free',
  status: 'active',
  provider: 'manual',
  started_at: null,
  expires_at: null,
  cancel_at_period_end: false
};

const isMissingTableError = (fetchError) =>
  fetchError?.code === '42P01' ||
  /relation .* does not exist|could not find the table/i.test(fetchError?.message ?? '');

/*
 * Subscription Model, Sprint 2 Stage 1 — SubscriptionContext
 *
 * Mirrors AuthContext's own profile-loading effect exactly (same
 * currentUser-guard, same loading/error state shape) — deliberately not
 * a new pattern. One real difference from that precedent: on "no row
 * found" this never auto-creates one. profiles auto-creates because
 * every registered user is expected to have a profile row; subscriptions
 * should not — RLS grants `authenticated` SELECT only (see the
 * migration), so a client-side insert would fail anyway, and a missing
 * row already means exactly what it should mean: plan='free'.
 *
 * isMissingTableError handles one sprint-specific case: this migration
 * is written but deliberately not applied to the live database in this
 * batch (see the report). Until it is, every query here returns
 * "relation does not exist" for every single user — an expected,
 * anticipated state, not a bug, so it's logged at most once via
 * console.warn rather than console.error, and never surfaced to the
 * user as an error banner. A genuinely unexpected failure (permissions,
 * network) still logs via console.error and sets `error`.
 *
 * Stage 1A: every setSubscription call below goes through
 * setResolvedSubscription, which applies the dev-only override (see
 * subscriptionOverride.js) as the last step regardless of which branch
 * produced the value — a real row, the guest/no-row Free default, or
 * the error fallback. Outside development, applySubscriptionOverride is
 * a no-op passthrough, so this has no effect on any of those branches'
 * normal behavior.
 */
export const SubscriptionProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState(() => applySubscriptionOverride(FREE_DEFAULT));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setResolvedSubscription = (value) => setSubscription(applySubscriptionOverride(value));

  const loadSubscription = async (currentUser) => {
    if (!supabase || !currentUser || currentUser.is_anonymous) {
      setResolvedSubscription(FREE_DEFAULT);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (fetchError) {
      if (isMissingTableError(fetchError)) {
        console.warn('Subscription table not yet provisioned — defaulting to Free plan.');
      } else {
        console.error('Error loading subscription:', fetchError.message);
        setError("We couldn't load your subscription. Showing your Free plan for now.");
      }
      setResolvedSubscription(FREE_DEFAULT);
      setLoading(false);
      return;
    }

    setResolvedSubscription(data ?? FREE_DEFAULT);
    setLoading(false);
  };

  useEffect(() => {
    const load = async () => {
      if (authLoading) return;
      await loadSubscription(user);
    };
    load();
  }, [user, authLoading]);

  const refreshSubscription = () => loadSubscription(user);

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, error, refreshSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);

// The single entitlement layer's React entry point — everywhere else in
// the app that needs to ask "can this user do X" calls this hook rather
// than reading `subscription` and comparing plan/status itself. Backed
// by src/lib/entitlements.js, which stays framework-agnostic (no React
// import) so its rules are plain, directly testable functions.
export const useEntitlements = () => {
  const { subscription } = useSubscription();
  return getEntitlements(subscription);
};

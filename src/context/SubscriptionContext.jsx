/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { getEntitlements } from '../lib/entitlements';
import { applySubscriptionOverride } from '../lib/subscriptionOverride';
import { fetchEntitlementRecords } from '../lib/entitlementSnapshot';
import { resolveUnifiedEntitlement, ENTITLEMENT_STATES } from '../lib/entitlementResolver';
import { isNativePlatform } from '../lib/platform';
import { scheduleAtTime } from '../lib/scheduleAtTime';

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

  // Returns the exact value it just set as state (dev-override applied) -
  // WakeWise Phase 2A correction: useAppleRestore.js needs to know the
  // real, current entitlement immediately after a refresh, and cannot
  // safely rely on this Provider's own re-render having already reached a
  // consumer's closure by the time an awaited call resolves. Every
  // existing caller of refreshSubscription()/loadSubscription() already
  // ignores its return value, so this is purely additive.
  const setResolvedSubscription = (value) => {
    const resolved = applySubscriptionOverride(value);
    setSubscription(resolved);
    return resolved;
  };

  const loadSubscription = async (currentUser) => {
    if (!supabase || !currentUser || currentUser.is_anonymous) {
      const resolved = setResolvedSubscription(FREE_DEFAULT);
      setError(null);
      setLoading(false);
      return resolved;
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
      const resolved = setResolvedSubscription(FREE_DEFAULT);
      setLoading(false);
      return resolved;
    }

    const resolved = setResolvedSubscription(data ?? FREE_DEFAULT);
    setLoading(false);
    return resolved;
  };

  useEffect(() => {
    const load = async () => {
      if (authLoading) return;
      await loadSubscription(user);
    };
    load();
  }, [user, authLoading]);

  const refreshSubscription = () => loadSubscription(user);

  // WakeWise Phase 2B — the unified, multi-provider entitlement result
  // (see entitlementResolver.js's own header). Deliberately a SEPARATE
  // read/state from `subscription` above rather than woven into it: every
  // existing consumer of `subscription`/useEntitlements() (AudioDetails.jsx,
  // Subscription.jsx, DeleteAccount.jsx, etc.) keeps reading exactly the
  // same legacy-table-only value it always has, completely unchanged by
  // this addition — this phase explicitly does not redesign or cut over
  // the existing entitlement check. `entitlement` is additive, consumed
  // only by the new Phase 2B integration points (Profile's membership
  // status row).
  const [entitlement, setEntitlement] = useState(() => resolveUnifiedEntitlement({ loading: true }, []));

  // The raw, already-fetched provider records behind the current
  // `entitlement` — kept so the expiry-crossing effect below can
  // RE-RESOLVE against a fresh `now` without a network round-trip. A ref,
  // not state: this backs a derived recompute, never rendered directly,
  // so it must never itself trigger a re-render on write (that would just
  // be loadEntitlement's own setEntitlement doing the same job twice).
  const lastRecordsRef = useRef([]);

  // Returns the exact value it just set as state — same correction as
  // setResolvedSubscription's own header above, and for the identical
  // reason: native purchase integration's useNativeRestore.js needs the
  // real, just-refreshed entitlement immediately after refreshEntitlement()
  // resolves, and cannot safely rely on this Provider's own re-render
  // having already reached a consumer's closure by the time an awaited
  // call resolves. Every existing caller already ignores this return
  // value, so this is purely additive.
  const loadEntitlement = async (currentUser) => {
    if (!currentUser || currentUser.is_anonymous) {
      lastRecordsRef.current = [];
      const resolved = resolveUnifiedEntitlement({ loading: false }, []);
      setEntitlement(resolved);
      return resolved;
    }
    setEntitlement((current) => (current.state === ENTITLEMENT_STATES.LOADING ? current : resolveUnifiedEntitlement({ loading: true }, [])));
    const { records, error: fetchError } = await fetchEntitlementRecords(supabase, currentUser.id);
    lastRecordsRef.current = fetchError ? [] : records;
    const resolved = resolveUnifiedEntitlement({ loading: false, error: fetchError }, records);
    setEntitlement(resolved);
    return resolved;
  };

  useEffect(() => {
    // Mirrors the `subscription` effect above's own shape exactly (a
    // nested async function, invoked once) — not merely stylistic:
    // calling loadEntitlement(user) directly as this effect's own body
    // trips react-hooks/set-state-in-effect, since loadEntitlement's
    // guest/no-user branch can call setEntitlement synchronously, before
    // any await. Wrapping the call moves that possible synchronous
    // setState out of the effect body's own top level.
    const load = async () => {
      if (authLoading) return;
      await loadEntitlement(user);
    };
    load();
    // `subscription` is an intentional dependency: a refreshSubscription()
    // call (e.g. after a Stripe checkout return) updates the legacy row
    // this effect's own fetchEntitlementRecords call also reads, so the
    // unified result must be recomputed whenever that happens, not just
    // once per sign-in.
  }, [user, authLoading, subscription]);

  const refreshEntitlement = () => loadEntitlement(user);

  // Re-evaluate as time passes, without waiting for a new webhook.
  //
  // Every write path (RPCs, this client's own resolver) only ever
  // recomputes on an EVENT — a webhook, a sign-in, a checkout return.
  // Nothing re-checks a stored record's own expiry purely because time
  // passed; a status-only read would keep showing "Plus — Active" forever
  // once a subscription's real period has elapsed, until the next
  // unrelated event happens to trigger a refetch. This effect closes that
  // gap client-side: whenever the CURRENTLY-displayed entitlement has a
  // known expiry, it schedules exactly one wake-up for that instant
  // (scheduleAtTime handles a far-future — e.g. annual — expiry safely;
  // see that module's own header) and, when it fires, re-resolves against
  // the SAME already-fetched records with a fresh `now` — no network
  // call needed, since nothing about the underlying data changed, only
  // whether `now` has passed the expiry. If the winning record is still
  // within a provider's cancel_at_period_end grace or another provider is
  // still genuinely valid, this correctly changes nothing; if nothing
  // else backs it, access (and any purchase-screen suppression keyed off
  // `isEntitled`) drops the instant the clock actually crosses the real
  // expiry, not whenever the app happens to next refetch.
  useEffect(() => {
    if (!entitlement.isEntitled || !entitlement.currentPeriodEnd) return undefined;
    const expiresAtMs = new Date(entitlement.currentPeriodEnd).getTime();
    if (Number.isNaN(expiresAtMs)) return undefined;

    const cancel = scheduleAtTime(expiresAtMs, () => {
      setEntitlement(resolveUnifiedEntitlement({ loading: false }, lastRecordsRef.current, new Date()));
    });
    return cancel;
  }, [entitlement.isEntitled, entitlement.currentPeriodEnd]);

  // Re-evaluate on app resume/refetch — not only when a webhook arrives.
  //
  // A webhook (or the sandbox confirmation poll) is how a NEW purchase or
  // cancellation becomes known, but a user who simply backgrounds the app
  // and returns later should also see up-to-date state immediately,
  // rather than whatever was last resolved before backgrounding — e.g. a
  // provider that lapsed while the app was in the background, or a
  // renewal that completed while it was. Layers two mechanisms, matching
  // this codebase's own established per-platform convention
  // (MorningReminderContext.jsx's identical appStateChange gate for the
  // identical reason): `appStateChange` for native (its web shim is
  // inert — see that file's own comment), `visibilitychange` for web/PWA
  // (useWakeLock.js's own established pattern), covering app resume on
  // every platform this app ships to without double-registering on
  // native. A full refreshEntitlement() (network read), not just a local
  // recompute — resuming is exactly when a provider's real state may have
  // changed underneath this client, not merely when time passed on an
  // already-known value (the effect above handles that narrower case).
  useEffect(() => {
    let appStateListenerPromise;
    if (isNativePlatform()) {
      appStateListenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) refreshEntitlement();
      });
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshEntitlement();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      appStateListenerPromise?.then((listener) => listener.remove());
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, error, refreshSubscription, entitlement, refreshEntitlement }}>
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

// WakeWise Phase 2B — the unified, multi-provider entitlement result (see
// entitlementResolver.js). A thin, named convenience matching
// useEntitlements()'s own shape; Profile.jsx is its first consumer.
export const useUnifiedEntitlement = () => useSubscription().entitlement;

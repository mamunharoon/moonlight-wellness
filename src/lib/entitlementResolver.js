// WakeWise Phase 2B — the unified, application-level entitlement result.
//
// Builds on (does not replace) src/lib/entitlementResolution.js's own
// resolveEntitlement() — that function already implements and tests the
// actual precedence rule ("among every access-granting record, the one
// most recently verified wins"); this module wraps its result in the
// richer shape Phase 2B's Profile/paywall surfaces need, and is the ONE
// place that shape is decided. Pure and framework-free by design, exactly
// like entitlementResolution.js itself — no Supabase import, no React
// import, so it is directly unit-testable with plain fixtures. The actual
// Supabase reads live in entitlementSnapshot.js, which calls this file.
//
// Every possible `state` value, and what it means:
//   'loading'                          — the underlying read is in flight.
//   'verification_unavailable'         — the read itself failed (network/
//                                         permission/unexpected error) —
//                                         never silently shown as 'free'.
//   'free'                             — no access-granting record exists.
//   'trial'                            — winning record's status is trial.
//   'active'                           — winning record's status is active,
//                                         not scheduled to cancel.
//   'cancelled_active_until_period_end'— winning record's status is still
//                                         trial/active, but
//                                         cancelAtPeriodEnd is true and a
//                                         real period end is known — access
//                                         continues until that date, never
//                                         revoked early for this reason
//                                         alone.
//   'grace_period'                     — winning record's status is
//                                         grace_period — access continues.
//   'billing_issue'                    — winning record's status is
//                                         billing_retry — access continues
//                                         (mirrors this project's existing
//                                         "short grace" treatment of a
//                                         failed-renewal retry).
//   'expired'                          — no access-granting record remains
//                                         (covers both a plain 'expired'
//                                         and an already-fully-lapsed
//                                         'cancelled' record — once
//                                         cancellation has actually taken
//                                         effect, "expired" and "cancelled"
//                                         are the same user-facing fact:
//                                         no access).
import { resolveEntitlement } from './entitlementResolution';

export const ENTITLEMENT_STATES = Object.freeze({
  LOADING: 'loading',
  VERIFICATION_UNAVAILABLE: 'verification_unavailable',
  FREE: 'free',
  TRIAL: 'trial',
  ACTIVE: 'active',
  CANCELLED_ACTIVE_UNTIL_PERIOD_END: 'cancelled_active_until_period_end',
  GRACE_PERIOD: 'grace_period',
  BILLING_ISSUE: 'billing_issue',
  EXPIRED: 'expired'
});

// Where "Manage Subscription" should route for a given resolved provider —
// a pure function of provider alone, so Profile/Subscription.jsx never
// have to re-derive this themselves. 'manual' has no self-service
// destination (an admin grant, not a store/portal subscription) — a null
// here is the honest signal that no store-management link should be
// shown, never a guessed one.
const MANAGEMENT_DESTINATIONS = Object.freeze({
  stripe: 'stripe_portal',
  apple: 'apple_settings',
  google: 'google_play',
  manual: null
});

export const getManagementDestination = (provider) => MANAGEMENT_DESTINATIONS[provider] ?? null;

const LOADING_RESULT = Object.freeze({
  state: ENTITLEMENT_STATES.LOADING,
  isEntitled: false,
  provider: null,
  product: null,
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  managementDestination: null,
  lastVerifiedSource: null
});

const UNAVAILABLE_RESULT = Object.freeze({
  state: ENTITLEMENT_STATES.VERIFICATION_UNAVAILABLE,
  isEntitled: false,
  provider: null,
  product: null,
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  managementDestination: null,
  lastVerifiedSource: null
});

// The one place a resolved provider's status maps to this file's own
// `state` vocabulary — status/cancelAtPeriodEnd alone are never
// re-interpreted anywhere else in this app. `hasAnyRecord` distinguishes
// "never subscribed at all" (free) from "had a record, but it has fully
// lapsed" (expired) — both are `isEntitled: false`, but they are not the
// same fact, and this app should never claim a lapsed subscriber was
// simply always on the free plan.
const stateForWinningRecord = (winner, cancelAtPeriodEnd, hasAnyRecord) => {
  if (!winner) return hasAnyRecord ? ENTITLEMENT_STATES.EXPIRED : ENTITLEMENT_STATES.FREE;

  if ((winner.status === 'trial' || winner.status === 'active') && cancelAtPeriodEnd && winner.currentPeriodExpiresAt) {
    return ENTITLEMENT_STATES.CANCELLED_ACTIVE_UNTIL_PERIOD_END;
  }

  switch (winner.status) {
    case 'trial':
      return ENTITLEMENT_STATES.TRIAL;
    case 'active':
      return ENTITLEMENT_STATES.ACTIVE;
    case 'grace_period':
      return ENTITLEMENT_STATES.GRACE_PERIOD;
    case 'billing_retry':
      return ENTITLEMENT_STATES.BILLING_ISSUE;
    default:
      // cancelled/expired/refunded/revoked never reach here as a
      // "winner" (resolveEntitlement's own access-granting filter already
      // excludes them) — defensive fallback only.
      return ENTITLEMENT_STATES.EXPIRED;
  }
};

// Best-effort "where did this come from" label, derived purely from
// provider until provider_subscriptions.verification_source (this phase's
// own proposed, unapplied migration) exists and is populated live — see
// this file's own module header and the Phase 2B report for why the
// client read deliberately does not select a column that may not exist
// yet. Once applied, entitlementSnapshot.js can pass a real per-record
// verification_source through and this function can prefer it.
const inferVerifiedSource = (provider) => {
  if (provider === 'stripe') return 'stripe_webhook';
  if (provider === 'apple') return 'apple_direct';
  if (provider === 'google') return 'revenuecat';
  if (provider === 'manual') return 'manual';
  return null;
};

/**
 * @param {{loading?: boolean, error?: unknown}} readState
 * @param {Array<{provider: 'stripe'|'apple'|'google'|'manual', status: string, productId?: string|null, currentPeriodExpiresAt?: string|null, cancelAtPeriodEnd?: boolean, lastVerifiedAt?: string|null}>} records
 *   Every provider-shaped record this user currently has, from BOTH the
 *   legacy `subscriptions` table (provider stripe/manual) and
 *   `provider_subscriptions` (provider apple/google) — see
 *   entitlementSnapshot.js for how these are actually fetched and mapped.
 *   Passing every record the user has, from every source, in one array is
 *   what makes "losing one provider must not revoke access if another
 *   verified provider is active" true: resolveEntitlement() below simply
 *   never sees fewer candidates than genuinely exist.
 */
export const resolveUnifiedEntitlement = (readState, records) => {
  if (readState?.loading) return LOADING_RESULT;
  if (readState?.error) return UNAVAILABLE_RESULT;

  const candidates = Array.isArray(records) ? records : [];
  const resolved = resolveEntitlement(candidates);
  const isEntitled = resolved.plan === 'plus';

  const winner = isEntitled
    ? candidates.find((record) => record.provider === resolved.activeProvider && record.status === resolved.status) ?? null
    : null;

  const cancelAtPeriodEnd = Boolean(winner?.cancelAtPeriodEnd);
  const state = stateForWinningRecord(
    isEntitled ? { status: resolved.status, currentPeriodExpiresAt: resolved.expiresAt } : null,
    cancelAtPeriodEnd,
    candidates.length > 0
  );

  return {
    state,
    isEntitled,
    provider: resolved.activeProvider,
    product: winner?.productId ?? null,
    status: isEntitled ? resolved.status : null,
    currentPeriodEnd: resolved.expiresAt,
    cancelAtPeriodEnd,
    managementDestination: isEntitled ? getManagementDestination(resolved.activeProvider) : null,
    lastVerifiedSource: isEntitled ? inferVerifiedSource(resolved.activeProvider) : null
  };
};

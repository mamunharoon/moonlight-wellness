// WakeWise Phase 2A — Profile membership status row.
//
// The one place the compact status label shown on Profile is decided.
// Reads ONLY the already-trusted subscription record SubscriptionContext
// already resolves (plan/status/provider/cancel_at_period_end/expires_at,
// straight from the `subscriptions` table) — never localStorage, never a
// client-side guess, and never a value this function invents itself. See
// entitlements.js's own isSubscribed() for the actual access rule this
// label describes; this file only decides how to *say* that rule's
// current result, never re-derives access itself.
//
// 'Plus — Grace period' is deliberately never returned by this function
// today. The LIVE `subscriptions` table (see SubscriptionContext.jsx) has
// no distinct grace-period status — a Stripe `past_due` renewal is folded
// into 'active' by design (see subscriptionStatusMessages.js's own
// comment), so a real grace period is indistinguishable from ordinary
// active access with the data this phase is allowed to read. Genuine
// grace-period detection needs the richer entitlements/provider_subscriptions
// schema, which Phase 2A is explicitly not cutting over to — this is a
// disclosed, honest limitation, not an oversight (see the Phase 2A report).
import { formatExpiryDate } from './subscriptionStatusMessages';
import { ENTITLEMENT_STATES } from './entitlementResolver';

export const MEMBERSHIP_STATUS_UNAVAILABLE = 'Membership details unavailable';
export const MEMBERSHIP_STATUS_LOADING = 'Loading…';

/**
 * @param {{plan?: string, status?: string, cancel_at_period_end?: boolean, expires_at?: string|null}|null} subscription
 * @param {{loading?: boolean, error?: string|null}} state
 * @returns {string} an honest, display-ready label — never a fabricated date or status.
 */
export const getMembershipStatusLabel = (subscription, { loading = false, error = null } = {}) => {
  if (loading) return MEMBERSHIP_STATUS_LOADING;
  if (error) return MEMBERSHIP_STATUS_UNAVAILABLE;
  if (!subscription || typeof subscription.plan !== 'string' || typeof subscription.status !== 'string') {
    return MEMBERSHIP_STATUS_UNAVAILABLE;
  }

  const { plan, status, cancel_at_period_end: cancelAtPeriodEnd, expires_at: expiresAt } = subscription;

  if (plan !== 'plus') return 'Free';

  if (status === 'trial') return 'Trial';

  if (status === 'active') {
    if (cancelAtPeriodEnd && expiresAt) {
      const date = formatExpiryDate(expiresAt);
      if (date) return `Plus — Cancels on ${date}`;
    }
    return 'Plus — Active';
  }

  if (status === 'cancelled' || status === 'expired') return 'Expired';

  // An unrecognised status value — never guess which of the honest states
  // above it might mean.
  return MEMBERSHIP_STATUS_UNAVAILABLE;
};

// WakeWise Phase 2B — the unified, multi-provider label. Profile.jsx now
// uses this one (built from useUnifiedEntitlement(), which combines the
// legacy `subscriptions` table with Apple/Google's provider_subscriptions
// rows) instead of the function above, which is kept only for its own
// tests and any other still-legacy-only caller — see the Phase 2B report
// for why the switch is additive, not a redesign. Unlike the function
// above, this one CAN genuinely say 'Plus — Grace period' and
// 'Plus — Billing issue': the richer schema this reads from actually
// distinguishes those states, closing the exact gap Phase 2A's own report
// disclosed as impossible with the legacy table alone.
export const getMembershipStatusLabelFromEntitlement = (entitlement) => {
  if (!entitlement || typeof entitlement.state !== 'string') return MEMBERSHIP_STATUS_UNAVAILABLE;

  switch (entitlement.state) {
    case ENTITLEMENT_STATES.LOADING:
      return MEMBERSHIP_STATUS_LOADING;
    case ENTITLEMENT_STATES.VERIFICATION_UNAVAILABLE:
      return MEMBERSHIP_STATUS_UNAVAILABLE;
    case ENTITLEMENT_STATES.FREE:
      return 'Free';
    case ENTITLEMENT_STATES.TRIAL:
      return 'Trial';
    case ENTITLEMENT_STATES.ACTIVE:
      return 'Plus — Active';
    case ENTITLEMENT_STATES.CANCELLED_ACTIVE_UNTIL_PERIOD_END: {
      const date = entitlement.currentPeriodEnd ? formatExpiryDate(entitlement.currentPeriodEnd) : null;
      return date ? `Plus — Cancels on ${date}` : 'Plus — Active';
    }
    case ENTITLEMENT_STATES.GRACE_PERIOD:
      return 'Plus — Grace period';
    case ENTITLEMENT_STATES.BILLING_ISSUE:
      return 'Plus — Billing issue';
    case ENTITLEMENT_STATES.EXPIRED:
      return 'Expired';
    default:
      return MEMBERSHIP_STATUS_UNAVAILABLE;
  }
};

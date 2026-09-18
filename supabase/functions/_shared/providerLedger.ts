// Duplicate-Subscription Remediation — the one place a Stripe subscription
// object is turned into a provider_subscriptions ledger row. Shared by
// stripe-webhook/index.ts (the normal lifecycle path) and
// create-checkout-session/index.ts (the self-healing path: opportunistically
// recording a live Stripe subscription the checkout guard discovers that
// this app's own DB had gone stale on — exactly the historical $50/year
// situation this remediation exists to handle). Keyed on
// (provider, stripe_subscription_id) — writing here can never touch a
// different subscription's row, and never enforces any one-per-user
// uniqueness: the ledger must be able to record Stripe's complete truth,
// conflicts included. See stripe-webhook/index.ts's
// updateLedgerAndProjection for the (separate, webhook-only)
// projection-selection algorithm this feeds.
import { mapStripeStatus } from './planMapping.ts';

export const buildStripeLedgerFields = (userId, stripeSubscription, customerId) => {
  const firstItem = stripeSubscription.items?.data?.[0] ?? null;
  const priceId = firstItem?.price?.id ?? null;
  // current_period_end moved from the top-level Subscription object to
  // each subscription item on newer Stripe API versions — check both so
  // this works regardless of which API version the account is on.
  const periodEnd = stripeSubscription.current_period_end ?? firstItem?.current_period_end ?? null;
  const expiresAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

  return {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: stripeSubscription.id,
    product_id: priceId,
    status: mapStripeStatus(stripeSubscription.status),
    current_period_expires_at: expiresAt,
    cancel_at_period_end: Boolean(stripeSubscription.cancel_at_period_end)
  };
};

export const upsertStripeLedgerRow = async (supabaseAdmin, fields, environment) => {
  const { error } = await supabaseAdmin.from('provider_subscriptions').upsert(
    { ...fields, provider: 'stripe', environment, last_verified_at: new Date().toISOString() },
    { onConflict: 'provider,stripe_subscription_id' }
  );
  if (error) throw error;
};

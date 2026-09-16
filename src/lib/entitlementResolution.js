// WakeWise — provider-neutral entitlement resolution
// (Apple Subscription Architecture task, Phase C).
//
// The precedence logic docs/apple-subscription-architecture.md §7
// describes for the proposed `entitlements` table: given every
// provider_subscriptions row a user has (Stripe, Apple, Google, or
// 'manual' for an admin grant), decide the single resolved entitlement.
// Pure and framework-free by design — no Supabase import, no React
// import — so it is directly unit-testable and usable from either a
// future Edge Function (Deno) or a future client-side read, exactly like
// src/lib/entitlements.js already stays framework-agnostic for the same
// reason.
//
// Not yet wired into any live code path: the `provider_subscriptions`
// table this operates on does not exist on the live project yet (its
// migration is deliberately unapplied — see
// supabase/migrations/20260916100000_apple_subscription_entitlements_foundation.sql).
// This module exists now so the resolution RULE is written, reviewed,
// and tested before any code depends on it — a future task wires a real
// Edge Function or client read through this function once the schema is
// live.

// Statuses that grant access. Mirrors entitlements.js's existing
// ACTIVE_STATUSES ('trial','active') plus the two new intermediate
// states this task's schema adds (grace_period, billing_retry) — a
// service should keep serving a subscriber through a temporary billing
// hiccup, exactly like the current Stripe mapping already folds
// `past_due` into `active` for the same reason. cancelled/expired/
// refunded/revoked never grant access.
const ACCESS_GRANTING_STATUSES = ['trial', 'active', 'grace_period', 'billing_retry'];

export const isAccessGrantingStatus = (status) => ACCESS_GRANTING_STATUSES.includes(status);

/**
 * Resolves the single entitlement a user should have from every
 * provider_subscriptions-shaped record they have. Each record is
 * expected to look like:
 *   { provider: 'stripe'|'apple'|'google'|'manual', status: string,
 *     currentPeriodExpiresAt: string|null, lastVerifiedAt: string|null }
 *
 * Tie-break rule (docs/apple-subscription-architecture.md §7's own
 * recommended default, flagged there as requiring explicit user
 * approval): among every currently access-granting record, the one with
 * the most recent `lastVerifiedAt` wins. This is deliberately NOT "latest
 * expiry wins" — a stale-but-far-in-the-future expiry from a provider
 * that hasn't been re-checked recently should not outrank a record this
 * app has verified more recently.
 *
 * Never grants access from an empty or all-non-granting input — the
 * default is always 'free'. Never trusts anything about *why* a record
 * says what it says; this function only combines already-server-verified
 * records, it does not itself verify anything (see
 * docs/apple-subscription-architecture.md §8 for verification, which
 * happens before a record is ever passed in here).
 */
export const resolveEntitlement = (providerRecords) => {
  const records = Array.isArray(providerRecords) ? providerRecords : [];
  const granting = records.filter((record) => isAccessGrantingStatus(record?.status));

  if (granting.length === 0) {
    return { plan: 'free', status: 'active', activeProvider: null, expiresAt: null };
  }

  const winner = granting.reduce((best, candidate) => {
    if (!best) return candidate;
    const bestVerified = best.lastVerifiedAt ? Date.parse(best.lastVerifiedAt) : -Infinity;
    const candidateVerified = candidate.lastVerifiedAt ? Date.parse(candidate.lastVerifiedAt) : -Infinity;
    return candidateVerified > bestVerified ? candidate : best;
  }, null);

  return {
    plan: 'plus',
    status: winner.status,
    activeProvider: winner.provider,
    expiresAt: winner.currentPeriodExpiresAt ?? null
  };
};

/**
 * The specific, narrower question this task's unified-entitlement rule
 * #5 asks: "is access active if either a server-verified Stripe
 * entitlement or a server-verified Apple entitlement is active." A thin,
 * explicit wrapper over resolveEntitlement for exactly the two providers
 * that exist today, so a call site can ask this precise question without
 * needing to know about the general N-provider resolver — matches
 * entitlements.js's own "thin, named wrapper" style.
 */
export const hasActiveStripeOrAppleEntitlement = (stripeRecord, appleRecord) =>
  resolveEntitlement([stripeRecord, appleRecord].filter(Boolean)).plan === 'plus';

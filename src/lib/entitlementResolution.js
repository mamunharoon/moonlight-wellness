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
// Wired into the live client read path since Phase 2B:
// entitlementResolver.js's resolveUnifiedEntitlement() calls
// resolveEntitlement() below with records entitlementSnapshot.js reads
// from the live `subscriptions` + `provider_subscriptions` tables;
// SubscriptionContext.jsx exposes the result as `entitlement`, which
// Subscription.jsx/Profile.jsx read directly. (Older revisions of this
// comment said "not yet wired" — that predates Phase 2B and is no longer
// true.)

// Statuses that grant access. Mirrors entitlements.js's existing
// ACTIVE_STATUSES ('trial','active') plus the two new intermediate
// states this task's schema adds (grace_period, billing_retry) — a
// service should keep serving a subscriber through a temporary billing
// hiccup, exactly like the current Stripe mapping already folds
// `past_due` into `active` for the same reason. cancelled/expired/
// refunded/revoked never grant access.
const ACCESS_GRANTING_STATUSES = ['trial', 'active', 'grace_period', 'billing_retry'];

export const isAccessGrantingStatus = (status) => ACCESS_GRANTING_STATUSES.includes(status);

// Expiry guard — brought into the client resolver to match the boundary
// that was already deployed server-side for media authorization
// (supabase/functions/_shared/entitlementResolution.ts's
// isCurrentlyAccessGranting/isAuthorizedForPremiumAccess, live on DEV as
// of get-beta-video-url v34). Until this change, this file's own
// resolveEntitlement() only ever checked `status`, exactly like the
// still-unchanged server copy used by the RPCs' `entitlements` recompute
// — which is how a provider whose billing period had already elapsed,
// but whose `status` hadn't yet been flipped by a later webhook, could
// still "win" the display/projection's tie-break purely by being the
// most recently verified. The real authorization boundary never had this
// gap (it already checks `now`); this brings the DISPLAY layer — the
// one place a user actually sees a provider and a date — into agreement
// with it, so what the Subscription screen shows can never contradict
// what the same user's own still-genuinely-active provider actually is.
//
// `now` is an explicit, injectable parameter (default `new Date()`) so
// every call site — and every test — can pin a fixed instant rather than
// depending on the real wall clock, exactly like the server copy's own
// signature.
//
// Per the exact rule this mirrors:
//   1. status must be access-granting (unchanged).
//   2. provider === 'manual' AND no real currentPeriodExpiresAt -> grants
//      (the one documented exception — an indefinite legacy/admin
//      grant). A 'manual' record that DOES carry a real
//      currentPeriodExpiresAt is checked against `now` exactly like any
//      other provider's — never an unconditional bypass just because
//      provider==='manual' (see docs/phase-2c-access-specification.md
//      §9a and the server test this mirrors,
//      entitlementResolution.manualGrantExpiry.test.js).
//   3. Every other case (stripe/apple/google, or a malformed/unparseable
//      date): grants only if currentPeriodExpiresAt is a real timestamp
//      strictly after `now`. A recurring provider with a missing or
//      invalid expiry is a data-integrity problem, never implicit
//      unlimited access — it fails closed.
export const isCurrentlyAccessGranting = (record, now = new Date()) => {
  if (!isAccessGrantingStatus(record?.status)) return false;
  if (!record.currentPeriodExpiresAt) return record.provider === 'manual';
  const expiresAtMs = new Date(record.currentPeriodExpiresAt).getTime();
  if (Number.isNaN(expiresAtMs)) return false;
  return expiresAtMs > now.getTime();
};

// Pure OR across every provider record this user has, using the
// per-record guard above — mirrors resolveEntitlement's own "pure OR
// across providers" precedence principle. Never throws on malformed/
// empty input; the safe default is always `false`.
export const isAuthorizedForPremiumAccess = (providerRecords, now = new Date()) =>
  (Array.isArray(providerRecords) ? providerRecords : []).some((record) => isCurrentlyAccessGranting(record, now));

/**
 * Resolves the single entitlement a user should have from every
 * provider_subscriptions-shaped record they have. Each record is
 * expected to look like:
 *   { provider: 'stripe'|'apple'|'google'|'manual', status: string,
 *     currentPeriodExpiresAt: string|null, lastVerifiedAt: string|null }
 *
 * A record is a tie-break *candidate* at all only once it passes
 * isCurrentlyAccessGranting() above — status-granting but already
 * time-lapsed (or missing/invalid expiry, for a non-manual provider)
 * never reaches the tie-break, regardless of how recently it was
 * verified. This is what makes "expired access is never granted, and
 * the displayed provider/date can never come from an already-lapsed
 * record" true, not merely likely.
 *
 * Tie-break rule (docs/apple-subscription-architecture.md §7's own
 * recommended default, flagged there as requiring explicit user
 * approval): among every CURRENTLY-valid candidate, the one with the
 * most recent `lastVerifiedAt` wins. This is deliberately NOT "latest
 * expiry wins" — a stale-but-far-in-the-future expiry from a provider
 * that hasn't been re-checked recently should not outrank a record this
 * app has verified more recently, as long as both are still genuinely
 * current.
 *
 * Never grants access from an empty or all-non-granting input — the
 * default is always 'free'. Never trusts anything about *why* a record
 * says what it says; this function only combines already-server-verified
 * records, it does not itself verify anything (see
 * docs/apple-subscription-architecture.md §8 for verification, which
 * happens before a record is ever passed in here).
 *
 * Returns the winning record's own `cancelAtPeriodEnd`/`productId`
 * directly (not just plan/status/provider/expiresAt) — callers (see
 * entitlementResolver.js's resolveUnifiedEntitlement) need these to
 * display the selected record's own management destination and renewal
 * behaviour, and re-deriving them by searching `providerRecords` again
 * for "whichever record matches this provider+status" is exactly the
 * kind of fragile re-lookup that can silently pick a DIFFERENT record
 * than the one actually selected here (e.g. two records sharing the same
 * provider+status) — returning the real winner's fields removes that
 * class of bug entirely.
 */
export const resolveEntitlement = (providerRecords, now = new Date()) => {
  const records = Array.isArray(providerRecords) ? providerRecords : [];
  const granting = records.filter((record) => isCurrentlyAccessGranting(record, now));

  if (granting.length === 0) {
    return { plan: 'free', status: 'active', activeProvider: null, expiresAt: null, cancelAtPeriodEnd: false, productId: null };
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
    expiresAt: winner.currentPeriodExpiresAt ?? null,
    cancelAtPeriodEnd: Boolean(winner.cancelAtPeriodEnd),
    productId: winner.productId ?? null
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

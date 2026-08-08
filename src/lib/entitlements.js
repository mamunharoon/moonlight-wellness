// Subscription Model, Sprint 2 Stage 1 (+ Stage 1A) — entitlement layer.
//
// The single place the rest of the app asks "can this user do X" —
// nothing else in the codebase should compare `plan`/`status` directly.
// isSubscribed(plan, status) is the actual rule; every canUseX check
// below is a thin, named wrapper around it, taking the subscription
// record itself (or null/undefined for a guest or a user with no row
// yet — both mean "free") rather than bare plan/status. Entitlement
// depends on plan AND status together, not plan alone: a row can still
// say plan='plus' after a user cancels (cancellation flips `status`, not
// `plan`, mirroring how a real billing provider like Stripe reports it)
// — checking plan alone would keep granting access to a lapsed
// subscriber. 'trial' and 'active' are the only statuses that grant Plus
// access; 'cancelled' and 'expired' do not, even on a plan='plus' row.
//
// Every Plus feature this sprint (audio, AI, premium content, advanced
// insights, extended journaling) shares one entitlement today — there is
// only one paid plan. Kept as separate named functions rather than one
// `isPlus()` so call sites read as intent ("can this render the audio
// player") and so a future plan tier that splits these apart is a
// change to this file only, not a hunt through every call site.

const ACTIVE_STATUSES = ['trial', 'active'];

// Stage 1A: the one central helper every entitlement check depends on.
// Takes plan and status as two plain arguments (not a subscription
// object) so it's usable anywhere a caller has those two values without
// needing to shape them into a record first — e.g. a future admin tool
// or a unit test can call isSubscribed('plus', 'active') directly.
export const isSubscribed = (plan, status) =>
  plan === 'plus' && ACTIVE_STATUSES.includes(status);

// Every canUseX below reads through isSubscribed rather than re-deriving
// the rule — this function, not the exported checks, is the single
// source of truth requested for Stage 1A. null/undefined-safe for a
// guest or a user with no row yet (both mean "free").
const hasActivePlusPlan = (subscription) =>
  isSubscribed(subscription?.plan, subscription?.status);

export const canUseAudio = (subscription) => hasActivePlusPlan(subscription);
export const canUseAI = (subscription) => hasActivePlusPlan(subscription);
export const canUsePremiumContent = (subscription) => hasActivePlusPlan(subscription);
export const canUseAdvancedInsights = (subscription) => hasActivePlusPlan(subscription);
export const canUseExtendedJournaling = (subscription) => hasActivePlusPlan(subscription);

// Convenience bundle for a screen that needs several flags at once (e.g.
// the /subscription screen itself) — still backed by the same five
// functions above, so there is exactly one place the actual rule lives.
export const getEntitlements = (subscription) => ({
  canUseAudio: canUseAudio(subscription),
  canUseAI: canUseAI(subscription),
  canUsePremiumContent: canUsePremiumContent(subscription),
  canUseAdvancedInsights: canUseAdvancedInsights(subscription),
  canUseExtendedJournaling: canUseExtendedJournaling(subscription)
});

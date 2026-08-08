// Subscription Model, Stage 1A — development-only entitlement override.
//
// Lets a developer force plan='free' or plan='plus' locally, to test
// Plus-gated UI before Stripe (or any real payment provider) exists.
//
// Named VITE_SOLAS_SUBSCRIPTION_OVERRIDE, not the brief's bare
// SOLAS_SUBSCRIPTION_OVERRIDE: Vite only exposes env vars prefixed
// `VITE_` to client-side code via import.meta.env — an unprefixed name
// would be silently undefined here and never do anything. Same
// variable, same values ('free' | 'plus'), just the prefix this stack
// actually requires to work at all.
//
// import.meta.env.DEV is Vite's own dev/prod flag: true only under
// `vite dev`, always false in a production build — so this has zero
// effect in production regardless of what env vars happen to be set
// there, satisfying "development mode only; no production effect"
// without any separate environment check. Purely an in-memory read:
// never writes to Supabase, never touches AuthContext or any auth
// state — see SubscriptionContext.jsx for the one place it's applied.

const VALID_PLANS = ['free', 'plus'];

export const getSubscriptionOverride = () => {
  if (!import.meta.env.DEV) return null;
  const raw = import.meta.env.VITE_SOLAS_SUBSCRIPTION_OVERRIDE;
  return VALID_PLANS.includes(raw) ? raw : null;
};

// Applied as the last step of resolving a subscription, regardless of
// where the pre-override value came from (a real row, the guest/no-row
// Free default, or an error fallback) — see SubscriptionContext.jsx.
// Forces status to 'active' alongside plan: a developer overriding to
// 'plus' expects Plus features to actually unlock, not a plan='plus'
// value that isSubscribed() still rejects for having some other status.
export const applySubscriptionOverride = (subscription) => {
  const overridePlan = getSubscriptionOverride();
  if (!overridePlan) return subscription;
  return { ...subscription, plan: overridePlan, status: 'active' };
};

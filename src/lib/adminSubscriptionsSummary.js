// Pure helpers for AdminSubscriptions.jsx — split out from the component
// so the counting/eligibility logic introduced by the N-04 fix
// (admin_list_subscriptions() now recognising Stripe, Apple and Google)
// is genuinely unit-testable, matching this project's established
// pattern of keeping display logic out of JSX.

// One row per registered user (admin_list_subscriptions()'s own
// contract, unchanged by the N-04 fix) — summing here can never
// double-count a multi-provider user, since the RPC itself already
// resolved them to a single winning row before this function ever sees
// the data.
export const summarizeAdminSubscriptions = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  let uniquePlusSubscribers = 0;
  let sandboxPlusSubscribers = 0;
  let productionPlusSubscribers = 0;
  let totalProviderRecords = 0;

  for (const row of safeRows) {
    if (!row || typeof row !== 'object') continue;
    totalProviderRecords += Number.isFinite(row.provider_record_count) ? row.provider_record_count : 0;
    if (row.plan === 'plus') {
      uniquePlusSubscribers += 1;
      if (row.environment === 'sandbox') sandboxPlusSubscribers += 1;
      else if (row.environment === 'production') productionPlusSubscribers += 1;
    }
  }

  return {
    totalUsers: safeRows.length,
    uniquePlusSubscribers,
    sandboxPlusSubscribers,
    productionPlusSubscribers,
    // D-12 (sandbox purchases on production, excluded from revenue): the
    // one number that should read as "real, revenue-bearing Plus
    // subscribers" — total minus sandbox ONLY. Deliberately not
    // productionPlusSubscribers: that figure excludes environment !==
    // 'production', which also excludes every Stripe/manual-provider
    // winner (their environment is always NULL, never 'production' —
    // see admin_list_subscriptions()'s own SQL) and would silently
    // undercount real, paying subscribers who happen not to be on
    // Apple/Google. Same unit as uniquePlusSubscribers (one row per
    // user), so the two numbers are directly comparable.
    revenueSubscribers: uniquePlusSubscribers - sandboxPlusSubscribers,
    totalProviderRecords
  };
};

// admin_set_subscription_status() only ever writes to the legacy
// public.subscriptions table (upserting provider='manual' by default) —
// it has no effect on a real Apple/Google provider_subscriptions row.
// Once the N-04 fix lets this screen show a user's REAL winning provider,
// leaving the status control enabled for an apple/google winner would let
// an admin believe they changed that subscription when they actually
// created or updated an unrelated manual-provider row instead. Editable
// only when the resolved provider is one admin_set_subscription_status()
// genuinely controls (stripe, manual) or when there is no winner at all
// (a free user — the same "create a manual row" upsert behaviour the
// control already had before this fix).
export const isStatusEditable = (provider) => provider !== 'apple' && provider !== 'google';

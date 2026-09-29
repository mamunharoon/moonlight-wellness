// WakeWise Phase 2B — reads every provider-shaped record a user currently
// has, from BOTH the legacy `subscriptions` table (Stripe/manual — live,
// unchanged, untouched by this phase) and `provider_subscriptions`
// (Apple/Google — applied in Phase 1's Apple task, still unused in
// production until a real Apple/RevenueCat write path exists), and hands
// them to entitlementResolver.js's own pure resolveUnifiedEntitlement().
//
// This is the ONLY place those two tables are combined for a live
// client-side read. Deliberately does NOT select
// provider_subscriptions.verification_source — that column does not exist
// on the live database yet (it is part of this phase's own proposed,
// UNAPPLIED migration; see supabase/migrations/*_revenuecat_google_entitlement_support.sql)
// and selecting an unknown column would fail this entire read. Accepts
// `supabase` as a parameter rather than importing the module-level client
// directly, matching this project's established pattern
// (rhythmPersistence.js) for real, fake-client-backed testability.
const LEGACY_SUBSCRIPTION_COLUMNS = 'plan, status, provider, expires_at, cancel_at_period_end';
const PROVIDER_SUBSCRIPTION_COLUMNS = 'provider, status, product_id, current_period_expires_at, cancel_at_period_end, last_verified_at';

const isMissingTableError = (fetchError) =>
  fetchError?.code === '42P01' ||
  /relation .* does not exist|could not find the table/i.test(fetchError?.message ?? '');

/**
 * Maps a legacy `subscriptions` row into the shape
 * entitlementResolver.js's records array expects. A free-default row
 * (plan='free') is never included as a candidate — resolveEntitlement()
 * only ever needs to see records that could plausibly grant access; an
 * explicit 'free' record would never win regardless, so omitting it here
 * is a pure simplification, not a behaviour change.
 */
const mapLegacySubscriptionRow = (row) => {
  if (!row || row.plan !== 'plus') return null;
  return {
    provider: row.provider ?? 'manual',
    status: row.status,
    productId: null, // the legacy table has never tracked a product id.
    currentPeriodExpiresAt: row.expires_at ?? null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    // The legacy table has no per-row "when was this last verified"
    // column of its own — its `updated_at` would be the closest analogue,
    // but this table's SELECT list has deliberately stayed minimal since
    // Phase 2A's own timezone-persistence work; verified-recency here is
    // approximated as "now" (this read just happened), which only matters
    // for tie-breaking against an Apple/Google record when BOTH are
    // simultaneously access-granting — a genuinely rare case this
    // approximation is an acceptable, disclosed simplification for.
    lastVerifiedAt: new Date().toISOString()
  };
};

const mapProviderSubscriptionRow = (row) => ({
  provider: row.provider,
  status: row.status,
  productId: row.product_id ?? null,
  currentPeriodExpiresAt: row.current_period_expires_at ?? null,
  cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  lastVerifiedAt: row.last_verified_at ?? null
});

/**
 * @param {import('@supabase/supabase-js').SupabaseClient|null} supabase
 * @param {string|null} userId
 * @returns {Promise<{records: Array, error: string|null}>}
 */
export const fetchEntitlementRecords = async (supabase, userId) => {
  if (!supabase || !userId) return { records: [], error: null };

  const [legacyResult, providerResult] = await Promise.all([
    supabase.from('subscriptions').select(LEGACY_SUBSCRIPTION_COLUMNS).eq('user_id', userId).maybeSingle(),
    supabase.from('provider_subscriptions').select(PROVIDER_SUBSCRIPTION_COLUMNS).eq('user_id', userId)
  ]);

  const records = [];

  if (legacyResult.error) {
    if (!isMissingTableError(legacyResult.error)) {
      console.error('fetchEntitlementRecords: failed to read subscriptions', legacyResult.error.message);
      return { records: [], error: legacyResult.error.message };
    }
    // Missing table — an expected, already-established state for a
    // project stage where this migration hasn't been applied yet (see
    // SubscriptionContext.jsx's own identical handling). Treated as "no
    // legacy record," never a hard failure.
  } else {
    const mapped = mapLegacySubscriptionRow(legacyResult.data);
    if (mapped) records.push(mapped);
  }

  if (providerResult.error) {
    if (!isMissingTableError(providerResult.error)) {
      console.error('fetchEntitlementRecords: failed to read provider_subscriptions', providerResult.error.message);
      return { records: [], error: providerResult.error.message };
    }
  } else {
    for (const row of providerResult.data ?? []) {
      records.push(mapProviderSubscriptionRow(row));
    }
  }

  return { records, error: null };
};

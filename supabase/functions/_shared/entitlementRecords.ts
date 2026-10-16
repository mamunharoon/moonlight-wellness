// Phase 2C — server-side mirror of src/lib/entitlementSnapshot.js's
// fetchEntitlementRecords, used ONLY by get-beta-video-url's §6 premium
// authorization check (via betaVideoUrlAccess.ts) — never the display
// layer, which has its own separate client-side read against the
// caller's own JWT-scoped client. Deliberately duplicated rather than
// imported across the Deno/Vite boundary, the same established
// convention this project already uses for
// FREE_EXERCISE_IDS/KNOWN_APPLE_PLUS_PRODUCT_IDS (see premiumExerciseIds.ts/
// planMapping.ts's own comments on this).
//
// Reads with the service-role admin client (never the caller's own JWT),
// because this must see every subscriptions/provider_subscriptions row
// for the verified user regardless of RLS. The `userId` passed in MUST
// already be server-verified (resolveBetaVideoUrlRequest only calls this
// after verifyUser has confirmed the caller's JWT) — this function trusts
// it completely and performs no verification of its own.
//
// Only the three fields isAuthorizedForPremiumAccess actually needs
// (provider/status/currentPeriodExpiresAt) are selected and mapped —
// this is a narrower read than entitlementSnapshot.js's own (which also
// carries productId/cancelAtPeriodEnd for the display layer's richer
// shape); nothing here feeds any UI.

export const isMissingTableError = (fetchError: { code?: string; message?: string } | null | undefined) =>
  fetchError?.code === '42P01' ||
  /relation .* does not exist|could not find the table/i.test(fetchError?.message ?? '');

export interface RawLegacySubscriptionRow {
  plan: string;
  status: string;
  provider: string | null;
  expires_at: string | null;
}

export interface RawProviderSubscriptionRow {
  provider: string;
  status: string;
  current_period_expires_at: string | null;
}

export interface EntitlementRecord {
  provider: string;
  status: string;
  currentPeriodExpiresAt: string | null;
}

// A free-default legacy row (plan='free') is never included as a
// candidate — isAuthorizedForPremiumAccess only ever needs records that
// could plausibly grant access; an explicit 'free' row would never
// authorize anything regardless, so omitting it here is a pure
// simplification, matching entitlementSnapshot.js's own identical choice.
export const mapLegacySubscriptionRow = (row: RawLegacySubscriptionRow | null): EntitlementRecord | null => {
  if (!row || row.plan !== 'plus') return null;
  return {
    provider: row.provider ?? 'manual',
    status: row.status,
    currentPeriodExpiresAt: row.expires_at ?? null
  };
};

export const mapProviderSubscriptionRow = (row: RawProviderSubscriptionRow): EntitlementRecord => ({
  provider: row.provider,
  status: row.status,
  currentPeriodExpiresAt: row.current_period_expires_at ?? null
});

export interface FetchEntitlementRecordsResult {
  records: EntitlementRecord[];
  error: string | null;
}

// Minimal shape of the one Supabase-js query-builder surface this
// function actually calls — lets a test supply a plain fake rather than
// a real SupabaseClient, the same dependency-injection approach
// betaVideoUrlAccess.ts already uses for verifyUser/signUrl.
export interface EntitlementRecordsDbClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        maybeSingle: () => Promise<{ data: RawLegacySubscriptionRow | null; error: { code?: string; message?: string } | null }>;
      } & Promise<{ data: RawProviderSubscriptionRow[] | null; error: { code?: string; message?: string } | null }>;
    };
  };
}

export const fetchEntitlementRecords = async (
  adminClient: EntitlementRecordsDbClient,
  userId: string
): Promise<FetchEntitlementRecordsResult> => {
  const [legacyResult, providerResult] = await Promise.all([
    adminClient.from('subscriptions').select('plan, status, provider, expires_at').eq('user_id', userId).maybeSingle(),
    adminClient.from('provider_subscriptions').select('provider, status, current_period_expires_at').eq('user_id', userId)
  ]);

  const records: EntitlementRecord[] = [];

  if (legacyResult.error) {
    if (!isMissingTableError(legacyResult.error)) {
      return { records: [], error: legacyResult.error.message ?? 'Failed to read subscriptions' };
    }
    // Missing table — an already-established acceptable state elsewhere
    // in this app (see entitlementSnapshot.js's own identical handling);
    // treated as "no legacy record," never a hard failure.
  } else {
    const mapped = mapLegacySubscriptionRow(legacyResult.data);
    if (mapped) records.push(mapped);
  }

  if (providerResult.error) {
    if (!isMissingTableError(providerResult.error)) {
      return { records: [], error: providerResult.error.message ?? 'Failed to read provider_subscriptions' };
    }
  } else {
    for (const row of providerResult.data ?? []) {
      records.push(mapProviderSubscriptionRow(row));
    }
  }

  return { records, error: null };
};

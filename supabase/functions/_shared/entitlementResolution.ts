// Apple Server Verification task — server-side mirror of
// src/lib/entitlementResolution.js's resolveEntitlement(). Deliberately
// duplicated rather than imported across the Deno/Vite boundary, the
// same established convention this project already uses for
// KNOWN_APPLE_PLUS_PRODUCT_IDS (see planMapping.ts's own comment on
// this): kept as a separate, independently-declared implementation so a
// change to the client-side copy can never silently change what a
// server-side Edge Function actually writes. Both copies are covered by
// their own tests (src/lib/entitlementResolution.test.js and
// src/lib/entitlementResolution.serverMirror.test.js), and the server
// mirror test explicitly asserts the two implementations agree.
const ACCESS_GRANTING_STATUSES = ['trial', 'active', 'grace_period', 'billing_retry'];

export const isAccessGrantingStatus = (status) => ACCESS_GRANTING_STATUSES.includes(status);

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

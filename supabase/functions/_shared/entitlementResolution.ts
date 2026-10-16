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

// Phase 2C — Free vs. WakeWise Plus Access Specification §6's exact
// authorization rule ("Server authorization rule (exact)"), additive to
// resolveEntitlement above rather than a change to it: resolveEntitlement
// feeds the DISPLAY layer (entitlementResolver.js, Profile/Subscription
// screens — a cached/soon-stale read is an acceptable, disclosed
// limitation there, see that file's own header) and is also what the
// `apply_verified_*_subscription_event` RPCs use to recompute the
// `entitlements` projection table. Deciding whether to hand out a signed
// media URL is a materially stricter question — §6 requires checking
// `expires_at` against `now()` for every recurring provider, which
// resolveEntitlement does not do today (it only filters by status,
// matching its own, earlier, display-oriented design). isAuthorizedForPremiumAccess
// is this stricter rule, used ONLY by get-beta-video-url's own premium
// check (via betaVideoUrlAccess.ts) — resolveEntitlement itself is left
// completely unchanged so the display layer's existing, already-approved
// behaviour is not altered by this addition.
//
// Per §6 exactly:
//   1. status must be access-granting (trial/active/grace_period/
//      billing_retry) — identical to resolveEntitlement's own filter.
//   2. For provider='manual' (an admin-granted grant), a NULL expires_at
//      is the expected, legitimate shape — §6's one documented exception
//      to "a missing expiry fails closed." This is a null-handling
//      exception specifically, not a blanket "manual never expires":
//      §9a's own complimentary-tester-access design (approved, not yet
//      built) requires every such grant to carry a real, mandatory,
//      honored expiry ("An indefinite/non-expiring complimentary grant
//      is not permitted by this design") - so once a manual record DOES
//      carry a real currentPeriodExpiresAt, it must be checked against
//      `now` exactly like any other provider's, never unconditionally
//      bypassed just because provider==='manual'. (Fixed this round: the
//      original implementation returned true for any access-granting
//      manual record regardless of its expires_at, which would have
//      granted access forever past a real, already-elapsed §9a expiry
//      once that mechanism exists - see
//      entitlementResolution.manualGrantExpiry.test.js.)
//   3. For every OTHER provider (stripe/apple/google — any real,
//      recurring subscription), expires_at must be a real, non-null
//      timestamp AND strictly greater than `now`. A recurring
//      subscription with a missing/null expires_at is treated as a
//      data-integrity problem and FAILS CLOSED (never implicit unlimited
//      access) — this is the one behaviour this function adds beyond
//      resolveEntitlement's own status-only filter.
export const isCurrentlyAccessGranting = (record, now = new Date()) => {
  if (!isAccessGrantingStatus(record?.status)) return false;
  if (!record.currentPeriodExpiresAt) return record.provider === 'manual';
  const expiresAtMs = new Date(record.currentPeriodExpiresAt).getTime();
  if (Number.isNaN(expiresAtMs)) return false;
  return expiresAtMs > now.getTime();
};

// Pure OR across every provider record this user has — mirrors
// resolveEntitlement's own "pure OR across providers" precedence
// principle, but using isCurrentlyAccessGranting's stricter per-record
// check above rather than resolveEntitlement's status-only one. Never
// throws on malformed/empty input; the safe default is always `false`
// (no access), exactly like resolveEntitlement's own 'free' default.
export const isAuthorizedForPremiumAccess = (providerRecords, now = new Date()) =>
  (Array.isArray(providerRecords) ? providerRecords : []).some((record) => isCurrentlyAccessGranting(record, now));

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

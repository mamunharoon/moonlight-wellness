// WakeWise — RevenueCat App User ID backend scoping.
//
// RevenueCat has exactly one App (one API key) per platform, shared by
// every Supabase project this app has ever pointed at (DEV, production,
// any future one) — confirmed directly in RevenueCat's own dashboard,
// not assumed. RevenueCat itself has no concept of "which backend" an
// event is for; the only thing WakeWise controls that flows through
// every purchase/restore/renewal event is the App User ID string itself
// (RevenueCat's own docs: app_user_id is present on essentially every
// webhook event type, including RENEWAL).
//
// This module is the one place that string's backend-scoped shape is
// built and parsed — deliberately plain JS (no Deno global, no `npm:`
// import), so it can be imported unmodified by the Deno Edge Function
// (revenuecat-webhook), by this repo's own Vitest suite, AND by the
// actual client bundle (src/lib/revenueCatAdapter.js) — the same
// cross-boundary pattern revenueCatEventMapping.js/
// revenueCatWebhookHandler.js already established (see those files' own
// headers), extended here to a genuine third consumer (the client),
// since this is the one piece of this concern both sides must agree on
// byte-for-byte.
//
// NOT proof of ownership. This scoping only answers "which Supabase
// project is this event/identity for" — it says nothing about whether
// the underlying UUID genuinely belongs to the user claiming it. That
// guarantee comes entirely from elsewhere, unchanged by this module: the
// authenticated Supabase session that produced the UUID in the first
// place (see useRevenueCatIdentity.js — the one place RevenueCat's App
// User ID is ever set, always from the real authenticated session's own
// user.id, never a guest/anonymous/client-invented value), the
// owner-only RLS policies on provider_subscriptions/entitlements, and
// the user_id REFERENCES auth.users(id) foreign key. A forged or stale
// prefix changes only which backend an event is routed to — it can
// never make an event pass the existing ownership/ownership-conflict
// checks downstream, and this module performs no ownership check of its
// own.
//
// Known, disclosed limitation — restores/aliases, not solved by this
// module: RevenueCat's own restore/identity-merge mechanic (triggered by
// Purchases.restorePurchases()/logIn() finding a receipt already
// associated with a different App User ID) can, independent of anything
// here, move a transaction's ownership from one App User ID to another
// — generating a TRANSFER event (transferred_from/transferred_to). This
// is inherent RevenueCat SDK/account behaviour, not something WakeWise
// has configured or can disable from this module. TRANSFER events are
// deliberately NOT applied to entitlement state at all today
// (acknowledge-only — see revenueCatEventMapping.js's own header), so no
// write happens via that path right now regardless of which two
// identities are involved or which backends they're scoped to. The
// moment real transfer-handling is built, this module's own
// resolveEventBackendScope must gate `transferred_to` exactly the way it
// already gates `app_user_id` here — but a scoped destination id alone
// would NOT be a complete fix on its own: if the receiving identity is a
// genuinely real, pre-existing user of the OTHER backend (not a forged
// value), the scope check and the FK check would both legitimately pass,
// and a production-originated purchase could still be transferred onto a
// real DEV account (or vice versa) if the same Apple/Google account is
// ever used against both builds. That residual case is not closed by
// this module, by the FK check, or by the no-cloning rule — it requires
// a decision at the point transfer-handling is actually implemented, not
// here.

export const PRODUCTION_PROJECT_REF = 'wqpszprbuqdjcfmdqdlv';

const SUPABASE_HOST_PATTERN = /^https:\/\/([a-z0-9]+)\.supabase\.co/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Every real Supabase project ref this app has ever used is exactly 20
// lowercase alphanumeric characters (confirmed directly against every
// known project ref, not assumed from one example). This shape check is
// what keeps RevenueCat's OWN anonymous-id format
// ('$RCAnonymousID:<hash>', which also contains a colon) from ever being
// misread as a backend prefix — its 'prefix' ('$RCAnonymousID') fails
// this shape, so the whole raw value falls through to the uuid check
// below instead, where it correctly fails as not-a-real-UUID
// ('invalid_app_user_id'), never as a false 'wrong_backend'.
const PROJECT_REF_SHAPE = /^[a-z0-9]{20}$/;

/**
 * Pure. Extracts the project ref from a real Supabase project URL
 * (`https://<ref>.supabase.co`). Null for anything else — a missing,
 * empty, malformed, or non-Supabase URL is never guessed at.
 */
export const extractProjectRef = (supabaseUrl) => {
  const match = SUPABASE_HOST_PATTERN.exec(typeof supabaseUrl === 'string' ? supabaseUrl : '');
  return match ? match[1].toLowerCase() : null;
};

const isValidUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);

/**
 * Builds the App User ID the client sends to RevenueCat. Scoped
 * (`<ref>:<uuid>`) only when `ownProjectRef` is the production ref —
 * every other backend (DEV, any future non-production project, or one
 * that couldn't be determined) gets the bare UUID back unchanged. This
 * is a deliberate, PERMANENT asymmetry, not a migration step: production
 * had zero existing RevenueCat identities to protect at the time this
 * shipped; DEV has real, evidenced purchase/trial history under the bare
 * form already. DEV is never retroactively or prospectively prefixed by
 * this function.
 */
export const buildScopedAppUserId = (ownProjectRef, supabaseUserId) =>
  ownProjectRef === PRODUCTION_PROJECT_REF ? `${ownProjectRef}:${supabaseUserId}` : supabaseUserId;

/**
 * Resolves an inbound RevenueCat event's claimed identity against the
 * backend receiving it. Returns the bare, verified UUID to use for every
 * downstream write, or null with a reason if the event must not be
 * applied at all.
 *
 * `ownProjectRef` must be derived by the caller from ITS OWN runtime
 * environment (SUPABASE_URL, server-side; never from the event, never
 * from anything client-supplied) — this function only ever compares
 * against that value, it never trusts the event to say who should
 * receive it.
 *
 * Fails closed if `ownProjectRef` is falsy: this backend could not
 * determine its own identity, so nothing about any event can be safely
 * decided — reason 'backend_ref_unresolved', independent of the event's
 * own content.
 *
 * On the production project specifically (`ownProjectRef ===
 * PRODUCTION_PROJECT_REF`): ONLY an id scoped to exactly this project's
 * own ref is accepted. A bare/unscoped id ('unscoped_on_production') or
 * one scoped to any other ref ('wrong_backend') is rejected outright —
 * production never falls back to legacy/bare-id trust.
 *
 * On every other (non-production) project: a bare/unscoped id is
 * accepted (DEV's existing, unchanged format) and an id scoped to THIS
 * project's own ref is also accepted (forward-compatible, unused today)
 * — only an id scoped to a DIFFERENT ref is rejected ('wrong_backend').
 *
 * Either way, the uuid portion is always independently validated
 * ('invalid_app_user_id' if it doesn't look like a real Supabase UUID) —
 * a correct ref prefix never substitutes for a real identity.
 *
 * @returns {{userId: string, rejectReason: null} | {userId: null, rejectReason: string}}
 */
export const resolveEventBackendScope = (rawAppUserId, ownProjectRef) => {
  if (!ownProjectRef) {
    return { userId: null, rejectReason: 'backend_ref_unresolved' };
  }

  const value = typeof rawAppUserId === 'string' ? rawAppUserId : '';
  const separatorIndex = value.indexOf(':');
  const candidateRef = separatorIndex === -1 ? null : value.slice(0, separatorIndex);
  // Only a prefix that actually has the shape of a real project ref is
  // ever treated as a backend scope — anything else (including
  // RevenueCat's own '$RCAnonymousID:<hash>' format, which also
  // contains a colon) falls through as an unscoped, whole-string
  // candidate uuid instead, never as a fabricated "wrong backend".
  const claimedRef = candidateRef !== null && PROJECT_REF_SHAPE.test(candidateRef) ? candidateRef : null;
  const claimedUuid = claimedRef === null ? value : value.slice(separatorIndex + 1);

  const isProductionBackend = ownProjectRef === PRODUCTION_PROJECT_REF;

  if (isProductionBackend) {
    if (claimedRef !== ownProjectRef) {
      return { userId: null, rejectReason: claimedRef === null ? 'unscoped_on_production' : 'wrong_backend' };
    }
  } else if (claimedRef !== null && claimedRef !== ownProjectRef) {
    return { userId: null, rejectReason: 'wrong_backend' };
  }

  if (!isValidUuid(claimedUuid)) {
    return { userId: null, rejectReason: 'invalid_app_user_id' };
  }

  return { userId: claimedUuid, rejectReason: null };
};

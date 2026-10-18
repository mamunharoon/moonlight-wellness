// revenuecat-webhook's own decision core, extracted as a pure,
// dependency-injected module — same pattern betaVideoUrlAccess.ts already
// established for get-beta-video-url (see that file's own header): no
// Deno global, no `npm:` import, so it can be imported and genuinely
// executed by this repo's Vitest suite. revenuecat-webhook/index.ts is
// the only real caller in production; it supplies real
// insertProviderEvent/callApplyVerifiedEvent implementations backed by
// the service-role Supabase client, and does its own logging around the
// returned `{ status, body }` — this module has no console side effects
// of its own (matching resolveBetaVideoUrlRequest's own convention),
// except the explicit, injectable `onTimestampQuarantined` hook (see
// resolveEventVerifiedAt's own header for why that one is deliberate).
import { mapRevenueCatStoreToProvider, mapRevenueCatEventToStateChange } from './revenueCatEventMapping.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const looksLikeSupabaseUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);

// Documented clock-skew tolerance for event_timestamp_ms range
// validation — 5 minutes, matching the common webhook-timestamp-tolerance
// convention (e.g. Stripe's own default signature timestamp tolerance).
// This is a RANGE CHECK ONLY: it decides whether an event_timestamp_ms
// that is ahead of `now` is still plausible ordinary clock skew between
// RevenueCat/Apple/Google's clocks and this server's, or is unreasonable
// (a malformed/corrupt payload, or a bug on the sending side) and must be
// quarantined exactly like a missing/non-numeric one — see
// resolveEventVerifiedAt's own header for why a value failing this check
// is NEVER replaced with a computed fallback (e.g. clamping it to `now`),
// only ever quarantined. There is deliberately no corresponding PAST-side
// bound: a genuinely old/delayed event (a retried delivery after an
// outage, a backlog being drained) must still be accepted and preserved
// — only an event claiming to be unreasonably far in the FUTURE is ever
// rejected on range grounds.
export const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Event-ordering fix. RevenueCat's own official guidance (Event Types and
 * Fields docs): "you should ignore stale events by using
 * event_timestamp_ms" — the real, documented field for "when the event
 * occurred", present on every official sample payload (RENEWAL,
 * CANCELLATION, EXPIRATION, REFUND_REVERSED all carry it). This replaces
 * the previous `new Date().toISOString()` (processing time), which made
 * "arrived later" indistinguishable from "happened later" and let a
 * late-redelivered OLDER event (RevenueCat guarantees at-least-once, not
 * ordered, delivery) overwrite a genuinely newer one's state.
 *
 * Compatibility: apply_verified_apple_subscription_event/
 * apply_verified_google_subscription_event's own staleness guard
 * (`v_existing_verified_at >= p_last_verified_at -> stale_event`) is
 * unchanged by this fix — only the VALUE fed into that same existing
 * parameter changes, for RevenueCat-sourced writes. Already-stored rows
 * written under the old (processing-time) basis are not retroactively
 * rewritten; the next genuinely-newer event will still almost always
 * exceed them (real events are typically hours/days apart, dwarfing any
 * processing delay), but a legitimate new event whose own
 * event_timestamp_ms happens to be extremely close to a prior row's
 * stored processing-time value could, in principle, be rejected as
 * stale when it should not be — a disclosed, low-probability transition
 * risk, not a correctness regression (the guard still only ever REJECTS
 * a write, it never corrupts one with wrong data). This also brings
 * RevenueCat-sourced writes onto the SAME basis
 * applyVerifiedAppleTransaction.ts already uses for the Apple-direct
 * path sharing these same rows — that path has always used Apple's own
 * JWS-signed `transaction.signedDate`, never processing time — so this
 * fix REDUCES cross-path inconsistency for a shared
 * apple_original_transaction_id, it does not introduce a new kind of
 * disagreement between the two paths.
 *
 * FINALISED timestamp safety (readiness-gap review — the previous
 * revision of this function fell back to `now` on a missing/invalid
 * timestamp and let the caller apply the write anyway). Processing time
 * is NEVER authoritative ordering for a state-changing write: `usedFallback:
 * true` here now means "do not apply this write at all" to the caller
 * (see processRevenueCatWebhookEvent's own quarantine branch), not "apply
 * it with a best-effort guess." The reasoning:
 *   - A malformed timestamp is a property of THIS event's payload, not a
 *     transient delivery glitch — retrying will not produce a different
 *     value, so this is the same "malformed payload, not retry-worthy"
 *     category this codebase already treats distinctly elsewhere
 *     (stripe-webhook/apple-server-notifications' own 400-vs-500
 *     convention).
 *   - Applying anyway with `now` as the ordering key reintroduces EXACTLY
 *     the bug fixed above, but worse: it is not merely "ordered by
 *     delivery time" for ONE event, it unconditionally wins the
 *     staleness race against every correctly-ordered row (processing
 *     time is always >= any real past event time), so a malformed event
 *     could silently clobber a validly-timestamped one.
 *   - Rejecting instead is NOT free of risk either, and must never be
 *     described as harmless: if the quarantined event was a genuine
 *     RENEWAL, the stored (older) expiry stays in place and the
 *     already-deployed expiry guard (157cd56) will correctly, but
 *     possibly PREMATURELY, deny access once that older expiry passes —
 *     a real, user-visible wrong-access window, not merely a delayed
 *     grant. If it was a genuine revoking event carrying an updated
 *     (shortened) expiry, that shortened expiry never gets written and
 *     access stays wrongly granted until something else corrects it.
 *     Quarantining only prevents DATA CORRUPTION from a bad ordering
 *     key; it does not by itself resolve the underlying "this account's
 *     state may now be wrong" risk — see
 *     processRevenueCatWebhookEvent's own alerting for why this must be
 *     loud, not silent.
 *   - The Apple-direct path already has a real remedy for exactly this:
 *     verifyAndApplyAppleTransaction.ts (used by both
 *     verify-apple-transaction and reconcile-apple-subscriptions) reads
 *     Apple's own JWS-signed transaction/renewal data directly, bypassing
 *     RevenueCat's payload entirely. A quarantined Apple event's
 *     original_transaction_id is exactly what that path needs — scheduling
 *     reconcile-apple-subscriptions (deployed, confirmed NOT scheduled)
 *     is the actual designed recovery mechanism, an operational action
 *     outside this fix's scope, not something invoked inline here. No
 *     equivalent reconciliation path exists yet for Google — a disclosed
 *     gap, not solved by this fix.
 *
 * Future timestamps are NOT blanket-treated as invalid — ordinary clock
 * skew between RevenueCat/Apple/Google's clocks and ours can legitimately
 * put event_timestamp_ms a little ahead of our own `now`, and that must
 * still be accepted (see "preserve valid delayed events" — the identical
 * principle applied to the future side: a value being off from `now` in
 * either direction, by a plausible amount, is normal). But an
 * UNREASONABLY future value (CLOCK_SKEW_TOLERANCE_MS beyond `now` — see
 * that constant's own header) is quarantined exactly like a missing/
 * non-numeric one: it cannot be ordinary skew, and — critically — if it
 * were ever accepted as an ordering key, it would make this transaction
 * row's last_verified_at effectively unbeatable, since no future
 * genuinely-real event could ever exceed it. That would PERMANENTLY
 * poison ordering for this transaction, not merely cause one bad write —
 * every subsequent real event would be rejected as "stale" forever. This
 * is exactly why `now` is accepted again here as a parameter, but — same
 * discipline as the missing/invalid case — ONLY to decide whether to
 * reject, never to compute or hand back a substitute value.
 *
 * @param {{event_timestamp_ms?: unknown}} event
 * @param {Date} [now]
 * @returns {{verifiedAtIso: string|null, usedFallback: boolean, quarantineReason: 'missing_or_invalid'|'unreasonable_future'|null}}
 *   `verifiedAtIso` is null whenever usedFallback is true — there is no
 *   safe ordering value to hand the caller in either quarantine case; the
 *   caller must quarantine, never substitute one of its own (including
 *   never clamping an unreasonable future value down to `now`, which
 *   would just reintroduce the exact "processing time as ordering key"
 *   problem this module exists to avoid).
 */
export const resolveEventVerifiedAt = (event, now = new Date()) => {
  const ms = event?.event_timestamp_ms;
  if (typeof ms !== 'number' || !Number.isFinite(ms)) {
    return { verifiedAtIso: null, usedFallback: true, quarantineReason: 'missing_or_invalid' };
  }
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return { verifiedAtIso: null, usedFallback: true, quarantineReason: 'missing_or_invalid' };
  }
  if (date.getTime() > now.getTime() + CLOCK_SKEW_TOLERANCE_MS) {
    return { verifiedAtIso: null, usedFallback: true, quarantineReason: 'unreasonable_future' };
  }
  return { verifiedAtIso: date.toISOString(), usedFallback: false, quarantineReason: null };
};

export const buildPayloadSummary = (event) => ({
  type: event.type,
  productId: event.product_id ?? null,
  periodType: event.period_type ?? null,
  store: event.store ?? null
});

/**
 * Builds the exact RPC argument object for whichever provider's
 * apply_verified_*_subscription_event this event targets. Identical to
 * revenuecat-webhook/index.ts's own previous inline construction, with
 * one deliberate change: `p_cancel_at_period_end` is always
 * `stateChange.cancelAtPeriodEnd ?? null` — `undefined` (no fresh
 * renewal-preference evidence, e.g. a CUSTOMER_SUPPORT-reason
 * CANCELLATION, or RENEWAL/PRODUCT_CHANGE) and an explicit `null` both
 * become SQL NULL, which the RPC's own
 * `COALESCE(p_cancel_at_period_end, public.provider_subscriptions.cancel_at_period_end)`
 * preserves the existing stored value for — never coerced to `false` or
 * `true` by anything in this function. See this module's own test file
 * for an explicit assertion of this exact chain.
 *
 * @returns {{args: object, reason: null} | {args: null, reason: string}}
 */
export const buildApplyVerifiedEventArgs = ({ provider, event, appUserId, stateChange, verifiedAtIso, payloadSummary, eventId }) => {
  const expiresAt = typeof event.expiration_at_ms === 'number' ? new Date(event.expiration_at_ms).toISOString() : null;
  const environment = event.environment === 'PRODUCTION' ? 'production' : 'sandbox';
  const cancelAtPeriodEnd = stateChange.cancelAtPeriodEnd ?? null;

  if (provider === 'apple') {
    // RevenueCat's own field for Apple's originalTransactionId in a v2
    // webhook event (confirmed present in RevenueCat's documented
    // webhook payload fields — see revenuecat-webhook/index.ts's own
    // header for the fuller field-name verification note).
    const originalTransactionId = event.original_transaction_id ?? event.transaction_id ?? null;
    if (!originalTransactionId) return { args: null, reason: 'missing_transaction_id' };
    return {
      args: {
        p_user_id: appUserId,
        p_apple_original_transaction_id: originalTransactionId,
        p_product_id: event.product_id ?? null,
        p_status: stateChange.status,
        p_current_period_expires_at: expiresAt,
        p_cancel_at_period_end: cancelAtPeriodEnd,
        p_environment: environment,
        p_apple_app_account_token: appUserId,
        p_last_verified_at: verifiedAtIso,
        p_raw_event_summary: payloadSummary,
        p_provider_event_id: eventId,
        p_event_type: event.type,
        p_verification_source: 'revenuecat'
      },
      reason: null
    };
  }

  // provider === 'google'
  // RevenueCat's official webhook field reference (event-types-and-fields)
  // lists only `transaction_id`/`original_transaction_id` as webhook
  // payload fields. For a PLAY_STORE event this carries Google's own
  // ORDER ID (format `GPA.xxxx-xxxx-xxxx-xxxxx`), never the raw Play
  // Billing purchase token — RevenueCat's webhooks do not expose the
  // purchase token at all. Still a genuine, unique, per-purchase Google
  // identifier — safe to use as the DB's ownership/idempotency key
  // exactly like Apple's original_transaction_id — but the RPC
  // parameter name (p_google_purchase_token, and the underlying
  // provider_subscriptions.google_purchase_token column) is a
  // pre-existing misnomer this fix does not rename.
  const googlePurchaseToken = event.original_transaction_id ?? event.transaction_id ?? null;
  if (!googlePurchaseToken) return { args: null, reason: 'missing_purchase_token' };
  return {
    args: {
      p_user_id: appUserId,
      p_google_purchase_token: googlePurchaseToken,
      p_product_id: event.product_id ?? null,
      p_status: stateChange.status,
      p_current_period_expires_at: expiresAt,
      p_cancel_at_period_end: cancelAtPeriodEnd,
      p_environment: environment,
      p_last_verified_at: verifiedAtIso,
      p_raw_event_summary: payloadSummary,
      p_provider_event_id: eventId,
      p_event_type: event.type,
      p_verification_source: 'revenuecat'
    },
    reason: null
  };
};

/**
 * The full post-authentication decision this webhook makes for one
 * already-parsed RevenueCat event — identical branching to the previous
 * inline Deno.serve body, now real, injectable, and testable.
 *
 * @param {object} event - the already-JSON-parsed `body.event`.
 * @param {{
 *   now?: Date,
 *   onTimestampQuarantined?: (event: object, reason: 'missing_or_invalid'|'unreasonable_future') => void,
 *   insertProviderEvent: (row: object) => Promise<{error: {code?: string, message?: string}|null}>,
 *   callApplyVerifiedEvent: (provider: 'apple'|'google', args: object) => Promise<{error: {code?: string, message?: string}|null}>
 * }} deps
 *   `now` is forwarded only to resolveEventVerifiedAt's range check
 *   (defaults to the real wall clock in production; tests pin it) — it is
 *   never used to construct a substitute ordering value anywhere in this
 *   function.
 * @returns {Promise<{status: number, body: Record<string, unknown>}>}
 */
export const processRevenueCatWebhookEvent = async (event, deps) => {
  const { now = new Date(), onTimestampQuarantined, insertProviderEvent, callApplyVerifiedEvent } = deps;

  if (!event || typeof event.type !== 'string') {
    return { status: 400, body: { error: 'Missing event' } };
  }

  const eventId = event.id;
  if (typeof eventId !== 'string' || eventId.length === 0) {
    return { status: 400, body: { error: 'Missing event id' } };
  }

  const provider = mapRevenueCatStoreToProvider(event.store);
  const payloadSummary = buildPayloadSummary(event);

  if (!provider) {
    return { status: 200, body: { received: true, processed: false, reason: 'unresolved_store' } };
  }

  const stateChange = mapRevenueCatEventToStateChange(event);
  const appUserId = event.app_user_id;

  if (!stateChange || !looksLikeSupabaseUuid(appUserId)) {
    const { error: insertError } = await insertProviderEvent({
      provider,
      provider_event_id: eventId,
      event_type: event.type,
      user_id: null,
      payload_summary: payloadSummary
    });
    if (insertError && insertError.code !== '23505') {
      return { status: 500, body: { error: 'Failed to record event' } };
    }
    return { status: 200, body: { received: true, processed: true } };
  }

  const { verifiedAtIso, usedFallback, quarantineReason } = resolveEventVerifiedAt(event, now);

  // QUARANTINE — a missing/invalid OR unreasonably-future
  // event_timestamp_ms on a state-changing event is never applied with a
  // guessed ordering key (see resolveEventVerifiedAt's own header for the
  // full reasoning, including why an unreasonable future value is just
  // as dangerous as a missing one — it would make this transaction's
  // ordering permanently unbeatable, not merely wrong once). Still
  // recorded to provider_events for idempotency/audit (a redelivery of
  // the exact same malformed/unreasonable event becomes a quiet no-op
  // after the first alert, matching every other event-recording path in
  // this function) and ALWAYS surfaced via onTimestampQuarantined — this
  // is an alert-worthy condition, not a benign fallback, precisely
  // because rejecting is not free of risk either (see the same header):
  // the account's real state may now be wrong until a later valid event
  // or (for Apple) a scheduled reconcile-apple-subscriptions pass
  // corrects it. HTTP 200/processed:false — a malformed/unreasonable
  // timestamp is a property of this event's payload; asking RevenueCat
  // to retry would not produce a different value, so this is not
  // retry-worthy in the same sense a transient 500 is.
  if (usedFallback) {
    onTimestampQuarantined?.(event, quarantineReason);
    const { error: insertError } = await insertProviderEvent({
      provider,
      provider_event_id: eventId,
      event_type: event.type,
      user_id: appUserId,
      payload_summary: payloadSummary
    });
    if (insertError && insertError.code !== '23505') {
      return { status: 500, body: { error: 'Failed to record event' } };
    }
    return {
      status: 200,
      body: {
        received: true,
        processed: false,
        reason: quarantineReason === 'unreasonable_future' ? 'quarantined_future_timestamp' : 'quarantined_invalid_timestamp'
      }
    };
  }

  const { args, reason: missingIdentifierReason } = buildApplyVerifiedEventArgs({
    provider,
    event,
    appUserId,
    stateChange,
    verifiedAtIso,
    payloadSummary,
    eventId
  });

  if (!args) {
    return { status: 200, body: { received: true, processed: false, reason: missingIdentifierReason } };
  }

  const { error: rpcError } = await callApplyVerifiedEvent(provider, args);
  if (rpcError) {
    if (rpcError.code === '23505' || /already linked to a different/i.test(rpcError.message ?? '')) {
      return { status: 200, body: { received: true, processed: false, reason: 'ownership_conflict' } };
    }
    return { status: 500, body: { error: 'Failed to process event' } };
  }

  return { status: 200, body: { received: true, processed: true } };
};

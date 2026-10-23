// WakeWise Phase 2B — revenuecat-webhook.
//
// *** NOT DEPLOYED BY THIS TASK. *** This file exists so the code is
// written, reviewed, and tested — deploying an Edge Function is one of
// this phase's own explicit approval gates. No RevenueCat project has
// this endpoint's URL configured yet.
//
// Trust boundary: RevenueCat calls this directly — there is no Supabase
// user JWT to check (exactly like stripe-webhook/index.ts and
// apple-server-notifications/index.ts). RevenueCat's own webhook
// mechanism authenticates via a shared "Authorization" header VALUE you
// set once in the RevenueCat dashboard (Project Settings → Integrations →
// Webhooks) and again here as REVENUECAT_WEBHOOK_AUTHORIZATION — compared
// with a constant-time check (mirrors reconcile-apple-subscriptions'
// own timingSafeEqual helper) so response timing can never be used to
// guess it. Fails closed (401) if the secret is missing, unconfigured, or
// does not match.
//
// Idempotency/replay protection: RevenueCat's own event.id is recorded in
// provider_events(provider, provider_event_id) inside the SAME atomic RPC
// transaction as the resulting provider_subscriptions/entitlements write
// (apply_verified_apple_subscription_event /
// apply_verified_google_subscription_event — see this phase's own
// migration) — a redelivered event is a safe, silent no-op, exactly
// mirroring stripe_webhook_events' already-proven pattern.
//
// Retry behaviour: RevenueCat retries a webhook delivery on any non-2xx
// response, with backoff, for a limited window (per RevenueCat's own
// documented retry policy) — this function returns 401 for an auth
// failure (never retried usefully — the secret will not become correct on
// retry, so this is a genuine configuration problem to alert on, not a
// transient one), 400 for a malformed/unrecognised payload (also not
// retry-worthy), and 500 only for a genuine, transient processing failure
// (a database error), so RevenueCat's own retry has a chance to succeed
// once the transient condition clears — exactly stripe-webhook's own
// established convention.
//
// Never trusts a client-provided subscription status: every field this
// function reads comes from RevenueCat's own authenticated webhook
// payload, never from anything a WakeWise app client could send directly
// — there is no code path in this app that lets a client call this
// endpoint's URL with attacker-controlled content and have it accepted
// (the Authorization check above rejects anything without the real
// dashboard-configured secret).
//
// Never stores unnecessary sensitive payload data: only a minimal,
// non-sensitive summary (event type, product id, period type) is ever
// written to provider_events.payload_summary — never the full webhook
// body, which RevenueCat's own docs note may in some event types include
// pricing/promotional details not needed for WakeWise's own reconciliation.
//
// FIELD-NAME STATUS (readiness-gap review, updated against RevenueCat's
// official docs — https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields):
//   - Apple: `original_transaction_id` (fallback `transaction_id`) —
//     CONFIRMED present in RevenueCat's documented webhook payload fields.
//   - Google: also `original_transaction_id`/`transaction_id` — same two
//     documented fields, no Google-specific field exists in the official
//     schema. A prior version of this file read a `store_transaction_id`
//     field that does NOT appear in RevenueCat's webhook field reference
//     (that name belongs to a different API surface) — corrected in
//     ../_shared/revenueCatWebhookHandler.js, where this field read now
//     lives.
//     For PLAY_STORE events this identifier is Google's own order id
//     (`GPA.xxxx-...`), not a raw Play Billing purchase token (RevenueCat
//     webhooks never expose the purchase token itself).
// STILL REQUIRED BEFORE THIS CAN GO LIVE: neither reading has been
// verified against a REAL captured RevenueCat sandbox event (no
// RevenueCat project/sandbox purchase exists yet — see the Phase 2B
// report's external-prerequisites section). Do not treat this function as
// purchase-ready until a real sandbox event has been captured and both
// field reads confirmed against it.
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';
import { processRevenueCatWebhookEvent } from '../_shared/revenueCatWebhookHandler.js';
import { extractProjectRef } from '../_shared/revenueCatBackendScope.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

// Constant-time string comparison — matches
// reconcile-apple-subscriptions/index.ts's own identical helper.
const timingSafeEqual = (a, b) => {
  const bytesA = new TextEncoder().encode(a);
  const bytesB = new TextEncoder().encode(b);
  if (bytesA.length !== bytesB.length) return false;
  let diff = 0;
  for (let i = 0; i < bytesA.length; i += 1) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const configuredSecret = Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION') ?? '';
  const providedSecret = req.headers.get('Authorization') ?? '';
  if (!configuredSecret || !providedSecret || !timingSafeEqual(providedSecret, configuredSecret)) {
    console.warn('revenuecat-webhook: rejected — missing or invalid Authorization');
    return json({ error: 'Unauthorized' }, 401);
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid payload' }, 400);
  }

  const event = body?.event;

  // All of the post-authentication decision-making (store/provider
  // resolution, event-to-state mapping, event-time-based ordering,
  // RPC-argument construction, the acknowledge-only vs. state-changing
  // branch) lives in processRevenueCatWebhookEvent
  // (../_shared/revenueCatWebhookHandler.js) — a pure, dependency-injected
  // function so it can be genuinely exercised by this repo's Vitest
  // suite, not just source-text matched. This Deno.serve handler is a
  // thin adapter: it supplies the real service-role
  // insertProviderEvent/callApplyVerifiedEvent implementations and does
  // its own logging around the returned `{ status, body }`, exactly
  // like get-beta-video-url/index.ts's identical relationship with
  // resolveBetaVideoUrlRequest.
  const supabaseAdmin = createSupabaseAdminClient();

  // Own backend identity, derived ONLY from this deployment's own
  // environment (SUPABASE_URL — platform-auto-injected per project,
  // same value supabaseAdmin.ts already depends on) — never from the
  // event itself. See revenueCatBackendScope.js's own header for why
  // this is the server-enforced check, not the event's own claim.
  const ownProjectRef = extractProjectRef(Deno.env.get('SUPABASE_URL'));

  const result = await processRevenueCatWebhookEvent(event, {
    ownProjectRef,
    // ALERT, not a benign fallback — see resolveEventVerifiedAt's/
    // processRevenueCatWebhookEvent's own headers for the full
    // reasoning: a missing/invalid OR unreasonably-future
    // event_timestamp_ms on a state-changing event is now QUARANTINED
    // (never applied with a guessed processing-time ordering key or a
    // clamped-to-now value), and that quarantine itself carries a real
    // "this account's state may now be wrong" risk until a later valid
    // event or (Apple only) a scheduled reconcile-apple-subscriptions
    // pass corrects it — logged at error level, deliberately louder
    // than this file's other console.warn cases, specifically so this
    // is actionable (e.g. alerting/paging on this log line) rather than
    // merely informational. See
    // docs/revenuecat-webhook-quarantine-recovery.md for the manual
    // recovery procedure this log line is the trigger for.
    onTimestampQuarantined: (quarantinedEvent, reason) => {
      console.error(
        `revenuecat-webhook: QUARANTINED (${reason}) — state change NOT applied (processing time is never used as an ordering fallback, and an unreasonably-future timestamp is never clamped to now); account state may be stale until a later valid event or manual/scheduled reconciliation corrects it — see docs/revenuecat-webhook-quarantine-recovery.md`,
        quarantinedEvent?.type,
        quarantinedEvent?.id,
        quarantinedEvent?.app_user_id
      );
    },
    // SUB-21/ST-29 fix — same alert-level treatment as the timestamp
    // quarantine above and for the same reason: rejecting a missing/
    // invalid expiration_at_ms is not free of risk either (the account's
    // real state may now be stale until a later valid event corrects it).
    onExpirationQuarantined: (quarantinedEvent) => {
      console.error(
        'revenuecat-webhook: QUARANTINED (invalid expiration_at_ms) — state change NOT applied (a missing/invalid expiry is never written as null or guessed); account state may be stale until a later valid event or manual/scheduled reconciliation corrects it',
        quarantinedEvent?.type,
        quarantinedEvent?.id,
        quarantinedEvent?.app_user_id
      );
    },
    insertProviderEvent: (row) => supabaseAdmin.from('provider_events').insert(row),
    callApplyVerifiedEvent: (provider, args) =>
      supabaseAdmin.rpc(provider === 'apple' ? 'apply_verified_apple_subscription_event' : 'apply_verified_google_subscription_event', args)
  });

  // Logging that mirrors exactly what the previous inline implementation
  // logged at each of these same outcomes, now driven off the pure
  // function's own returned reason rather than duplicated inline.
  // Neither 'quarantined_invalid_timestamp' nor 'quarantined_future_timestamp'
  // is re-logged here — both are already logged, loudly, by
  // onTimestampQuarantined above. 'quarantined_invalid_expiration'
  // likewise already logged, loudly, by onExpirationQuarantined above.
  if (result.body?.reason === 'unresolved_store') {
    console.warn('revenuecat-webhook: event references a store this project does not act on', event?.store ?? 'unknown', event?.type);
  } else if (result.body?.reason === 'missing_transaction_id') {
    console.warn('revenuecat-webhook: Apple event missing a usable transaction identifier');
  } else if (result.body?.reason === 'missing_purchase_token') {
    console.warn('revenuecat-webhook: Google event missing a usable purchase token');
  } else if (result.body?.reason === 'ownership_conflict') {
    console.error('revenuecat-webhook: ownership conflict', event?.type);
  } else if (result.body?.reason === 'backend_ref_unresolved') {
    // Loud, not a benign skip — this deployment's own SUPABASE_URL did
    // not resolve to a known project ref, so it could not safely decide
    // whether ANY event belongs to it. Platform-auto-injected and
    // expected to always be present (see supabaseAdmin.ts) — this
    // should never actually fire; if it does, that is itself the alert.
    console.error('revenuecat-webhook: own backend ref could not be resolved from SUPABASE_URL — failing closed, no event applied', ownProjectRef);
  } else if (result.body?.reason === 'wrong_backend' || result.body?.reason === 'unscoped_on_production') {
    console.warn('revenuecat-webhook: event scoped to a different backend than this deployment — rejected, zero entitlement write', result.body?.reason, event?.type, ownProjectRef);
  } else if (result.body?.reason === 'invalid_app_user_id') {
    console.warn('revenuecat-webhook: event app_user_id is not a genuine Supabase UUID once unscoped — rejected', event?.type);
  } else if (result.status === 500) {
    console.error('revenuecat-webhook: failed to process event', result.body?.error);
  } else if (result.status === 400 && result.body?.error === 'Missing event id') {
    console.warn("revenuecat-webhook: event missing its own id — cannot guarantee idempotency, rejecting");
  }

  return json(result.body, result.status);
});

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
// FIELD-NAME VERIFICATION STILL REQUIRED BEFORE THIS CAN GO LIVE: the
// exact field names below for the Apple original-transaction identifier
// and the Google purchase-token equivalent are this task's best-documented
// understanding of RevenueCat's REST API v2 webhook event shape, but have
// NOT been verified against a real RevenueCat sandbox event (no
// RevenueCat project exists to generate one from — see the Phase 2B
// report's external-prerequisites section). Do not treat this function as
// purchase-ready until a real sandbox event has been captured and these
// field reads confirmed against it.
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';
import { mapRevenueCatStoreToProvider, mapRevenueCatEventToStateChange } from '../_shared/revenueCatEventMapping.js';

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

// A basic (not RFC 4122 exhaustive) UUID shape check — this app's Supabase
// user ids are always real UUIDs (auth.users.id), so a RevenueCat
// app_user_id that isn't shaped like one can never be a genuine WakeWise
// identity. Rejecting early avoids ever passing an obviously-wrong value
// into a Postgres uuid-typed RPC parameter (which would itself error, but
// this is a clearer, intentional rejection rather than an incidental one).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const looksLikeSupabaseUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);

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
  if (!event || typeof event.type !== 'string') {
    return json({ error: 'Missing event' }, 400);
  }

  const eventId = event.id;
  if (typeof eventId !== 'string' || eventId.length === 0) {
    console.warn('revenuecat-webhook: event missing its own id — cannot guarantee idempotency, rejecting');
    return json({ error: 'Missing event id' }, 400);
  }

  const provider = mapRevenueCatStoreToProvider(event.store);
  const supabaseAdmin = createSupabaseAdminClient();

  const payloadSummary = { type: event.type, productId: event.product_id ?? null, periodType: event.period_type ?? null, store: event.store ?? null };

  if (!provider) {
    // A store this webhook has no business acting on: 'STRIPE' would mean
    // the RevenueCat project itself is misconfigured (Stripe must never
    // be added as a store there — Stripe stays on its own entirely
    // separate stripe-webhook/index.ts), and anything else is a store
    // RevenueCat added later that this task has not reviewed.
    // provider_events' own CHECK constraint only allows
    // ('stripe','apple','google') — there is no honest bucket to record
    // an unresolved store under without either violating that constraint
    // or writing a misleading provider value, so this is logged
    // server-side (visible in this function's own Supabase logs) and
    // acknowledged, never written to the audit table, and never applied
    // to entitlement state.
    console.warn('revenuecat-webhook: event references a store this project does not act on', event.store ?? 'unknown', event.type);
    return json({ received: true, processed: false, reason: 'unresolved_store' });
  }

  const stateChange = mapRevenueCatEventToStateChange(event);
  const appUserId = event.app_user_id;

  if (!stateChange || !looksLikeSupabaseUuid(appUserId)) {
    // Acknowledge-only event type, OR a state-bearing type whose
    // app_user_id isn't a genuine Supabase UUID (this app only ever logs
    // in to RevenueCat with a real Supabase user id — see
    // useRevenueCatIdentity.js — so a non-UUID app_user_id here means
    // either a RevenueCat-generated anonymous id that never completed
    // identity login, or an acknowledge-only event type with no
    // actionable identity; neither should ever reach a write). Still
    // recorded for idempotency/audit.
    const { error: insertError } = await supabaseAdmin.from('provider_events').insert({
      provider,
      provider_event_id: eventId,
      event_type: event.type,
      user_id: null,
      payload_summary: payloadSummary
    });
    if (insertError && insertError.code !== '23505') {
      console.error('revenuecat-webhook: failed to record acknowledge-only event', insertError.message);
      return json({ error: 'Failed to record event' }, 500);
    }
    return json({ received: true, processed: true });
  }

  const expiresAt = typeof event.expiration_at_ms === 'number' ? new Date(event.expiration_at_ms).toISOString() : null;
  const environment = event.environment === 'PRODUCTION' ? 'production' : 'sandbox';

  if (provider === 'apple') {
    // FIELD-NAME VERIFICATION REQUIRED (see this file's own header) —
    // RevenueCat's own field for Apple's originalTransactionId in a v2
    // webhook event.
    const originalTransactionId = event.original_transaction_id ?? event.transaction_id ?? null;
    if (!originalTransactionId) {
      console.warn('revenuecat-webhook: Apple event missing a usable transaction identifier');
      return json({ received: true, processed: false, reason: 'missing_transaction_id' });
    }

    const { error: rpcError } = await supabaseAdmin.rpc('apply_verified_apple_subscription_event', {
      p_user_id: appUserId,
      p_apple_original_transaction_id: originalTransactionId,
      p_product_id: event.product_id ?? null,
      p_status: stateChange.status,
      p_current_period_expires_at: expiresAt,
      p_cancel_at_period_end: stateChange.cancelAtPeriodEnd ?? null,
      p_environment: environment,
      p_apple_app_account_token: appUserId,
      p_last_verified_at: new Date().toISOString(),
      p_raw_event_summary: payloadSummary,
      p_provider_event_id: eventId,
      p_event_type: event.type,
      p_verification_source: 'revenuecat'
    });

    if (rpcError) {
      if (rpcError.code === '23505' || /already linked to a different/i.test(rpcError.message ?? '')) {
        console.error('revenuecat-webhook: Apple ownership conflict', event.type);
        return json({ received: true, processed: false, reason: 'ownership_conflict' });
      }
      console.error('revenuecat-webhook: failed to apply verified Apple state', rpcError.message);
      return json({ error: 'Failed to process event' }, 500);
    }

    return json({ received: true, processed: true });
  }

  // provider === 'google'
  // FIELD-NAME VERIFICATION REQUIRED (see this file's own header) —
  // RevenueCat's own field carrying the Google Play purchase token
  // equivalent in a v2 webhook event.
  const googlePurchaseToken = event.store_transaction_id ?? event.transaction_id ?? null;
  if (!googlePurchaseToken) {
    console.warn('revenuecat-webhook: Google event missing a usable purchase token');
    return json({ received: true, processed: false, reason: 'missing_purchase_token' });
  }

  const { error: rpcError } = await supabaseAdmin.rpc('apply_verified_google_subscription_event', {
    p_user_id: appUserId,
    p_google_purchase_token: googlePurchaseToken,
    p_product_id: event.product_id ?? null,
    p_status: stateChange.status,
    p_current_period_expires_at: expiresAt,
    p_cancel_at_period_end: stateChange.cancelAtPeriodEnd ?? null,
    p_environment: environment,
    p_last_verified_at: new Date().toISOString(),
    p_raw_event_summary: payloadSummary,
    p_provider_event_id: eventId,
    p_event_type: event.type,
    p_verification_source: 'revenuecat'
  });

  if (rpcError) {
    if (rpcError.code === '23505' || /already linked to a different/i.test(rpcError.message ?? '')) {
      console.error('revenuecat-webhook: Google ownership conflict', event.type);
      return json({ received: true, processed: false, reason: 'ownership_conflict' });
    }
    console.error('revenuecat-webhook: failed to apply verified Google state', rpcError.message);
    return json({ error: 'Failed to process event' }, 500);
  }

  return json({ received: true, processed: true });
});

// Apple Server Verification task — apple-server-notifications.
//
// Public webhook endpoint — Apple calls this directly, so unlike
// verify-apple-transaction there is no Supabase user JWT to check
// (exactly like stripe-webhook/index.ts). Every request is treated as
// hostile until its signedPayload's JWS signature and certificate chain
// verify against Apple's pinned root (appleJwsVerification.ts) — this is
// now a genuine cryptographic check, not a stub. See
// appleJwsVerification.ts's header comment for why Apple's own official
// library is not used here, and what is used instead.
//
// Idempotency/replay protection: Apple's notificationUUID is recorded in
// provider_events(provider, provider_event_id) before any state change
// is applied — a redelivered notification is a safe, silent no-op,
// exactly mirroring stripe_webhook_events' already-proven pattern.
//
// Never logs the raw signedPayload, any transaction identifier, or any
// user-identifying field — only notificationType/subtype (already
// non-sensitive, allow-listed-by-Apple's-own-enum values) and plain
// error messages/reason codes.
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';
import { isKnownApplePlusProductId } from '../_shared/planMapping.ts';
import { verifyAndDecodeAppleSignedData, AppleSignatureVerificationError } from '../_shared/appleJwsVerification.ts';
import { mapVerifiedAppleNotificationToStateChange } from '../_shared/appleSubscriptionStateMapping.ts';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

const appleServerCredentialsConfigured = () =>
  Boolean(Deno.env.get('APPLE_BUNDLE_ID')) && Boolean(Deno.env.get('APPLE_ENVIRONMENT'));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid notification payload' }, 400);
  }

  if (typeof body?.signedPayload !== 'string' || body.signedPayload.length === 0) {
    return json({ error: 'Missing signedPayload' }, 400);
  }

  if (!appleServerCredentialsConfigured()) {
    // Deliberately not "not yet implemented" any more — the
    // verification code exists. This branch only fires if the bundle
    // id/environment secrets themselves are missing, which must never
    // be silently treated as "nothing to verify against."
    console.warn('apple-server-notifications: APPLE_BUNDLE_ID/APPLE_ENVIRONMENT not configured — cannot safely verify');
    return json({ received: true, processed: false, reason: 'not_yet_configured' });
  }

  const expectedBundleId = Deno.env.get('APPLE_BUNDLE_ID');
  const expectedEnvironment = Deno.env.get('APPLE_ENVIRONMENT') === 'production' ? 'Production' : 'Sandbox';

  let notification;
  try {
    notification = await verifyAndDecodeAppleSignedData(body.signedPayload);
  } catch (err) {
    const reason = err instanceof AppleSignatureVerificationError ? err.reason : 'signature_invalid';
    console.warn('apple-server-notifications: rejected an unverifiable signedPayload', reason);
    return json({ error: 'Signature verification failed' }, 400);
  }

  const data = notification.data;
  if (notification.notificationType !== 'TEST') {
    if (!data || data.bundleId !== expectedBundleId || data.environment !== expectedEnvironment) {
      console.warn('apple-server-notifications: verified notification failed bundle id / environment check');
      return json({ error: 'Bundle id or environment mismatch' }, 400);
    }
  }

  const notificationUUID = notification.notificationUUID;
  if (typeof notificationUUID !== 'string' || notificationUUID.length === 0) {
    console.warn('apple-server-notifications: verified notification is missing notificationUUID');
    return json({ error: 'Missing notificationUUID' }, 400);
  }

  const supabaseAdmin = createSupabaseAdminClient();

  let transaction = null;
  let renewalInfo = null;
  try {
    if (data?.signedTransactionInfo) {
      transaction = await verifyAndDecodeAppleSignedData(data.signedTransactionInfo);
    }
    if (data?.signedRenewalInfo) {
      renewalInfo = await verifyAndDecodeAppleSignedData(data.signedRenewalInfo);
    }
  } catch (err) {
    const reason = err instanceof AppleSignatureVerificationError ? err.reason : 'signature_invalid';
    console.warn('apple-server-notifications: nested signed data failed verification', reason);
    return json({ error: 'Nested signature verification failed' }, 400);
  }

  if (transaction && !isKnownApplePlusProductId(transaction.productId)) {
    console.warn('apple-server-notifications: verified transaction references an unknown product id, ignoring');
    // Recorded for idempotency below, but never applied as a state
    // change — an unrecognised product must never touch entitlement.
    transaction = null;
  }

  const stateChange = mapVerifiedAppleNotificationToStateChange({
    notificationType: notification.notificationType,
    subtype: notification.subtype,
    transaction,
    appleStatus: typeof data?.status === 'number' ? data.status : null
  });

  if (!stateChange || !transaction?.originalTransactionId) {
    // Acknowledge-only (or a state-bearing type with no usable
    // transaction) — still record the event for idempotency/audit, but
    // never write to provider_subscriptions/entitlements.
    const { error: insertError } = await supabaseAdmin.from('provider_events').insert({
      provider: 'apple',
      provider_event_id: notificationUUID,
      event_type: notification.notificationType,
      user_id: null,
      payload_summary: { notificationType: notification.notificationType, subtype: notification.subtype ?? null }
    });
    if (insertError && insertError.code !== '23505') {
      console.error('apple-server-notifications: failed to record acknowledge-only event', insertError.message);
      return json({ error: 'Failed to record notification' }, 500);
    }
    return json({ received: true, processed: true });
  }

  // Resolve the WakeWise user this transaction belongs to. A verified
  // appAccountToken IS trustworthy here — the whole payload it came from
  // has already passed cryptographic verification, so this is Apple
  // vouching for the value WakeWise itself set at purchase time (see
  // docs/apple-subscription-architecture.md §9). If it is absent (older
  // transactions may lack it), fall back to whatever user this
  // transaction id is already on record for — a renewal/status
  // notification about a subscription verify-apple-transaction already
  // recorded. If neither resolves, this notification cannot be
  // attributed to any WakeWise account — recorded for audit, not
  // retried (mirrors stripe-webhook's own "could not resolve a user,
  // skip" convention for exactly this situation).
  let userId = transaction.appAccountToken ?? null;
  if (!userId) {
    const { data: existing } = await supabaseAdmin
      .from('provider_subscriptions')
      .select('user_id')
      .eq('provider', 'apple')
      .eq('apple_original_transaction_id', transaction.originalTransactionId)
      .maybeSingle();
    userId = existing?.user_id ?? null;
  }

  if (!userId) {
    console.error('apple-server-notifications: could not resolve a WakeWise user for a verified transaction', notification.notificationType);
    const { error: insertError } = await supabaseAdmin.from('provider_events').insert({
      provider: 'apple',
      provider_event_id: notificationUUID,
      event_type: notification.notificationType,
      user_id: null,
      payload_summary: { notificationType: notification.notificationType, unresolved: true }
    });
    if (insertError && insertError.code !== '23505') {
      console.error('apple-server-notifications: failed to record unresolved event', insertError.message);
    }
    return json({ received: true, processed: false, reason: 'user_not_resolved' });
  }

  let cancelAtPeriodEnd = null;
  if (typeof stateChange.cancelAtPeriodEnd === 'boolean') {
    cancelAtPeriodEnd = stateChange.cancelAtPeriodEnd;
  } else if (renewalInfo && typeof renewalInfo.autoRenewStatus === 'number') {
    cancelAtPeriodEnd = renewalInfo.autoRenewStatus === 0;
  }

  const { error: rpcError } = await supabaseAdmin.rpc('apply_verified_apple_subscription_event', {
    p_user_id: userId,
    p_apple_original_transaction_id: transaction.originalTransactionId,
    p_product_id: transaction.productId,
    p_status: stateChange.status,
    p_current_period_expires_at: transaction.expiresDate ? new Date(transaction.expiresDate).toISOString() : null,
    p_cancel_at_period_end: cancelAtPeriodEnd,
    p_environment: expectedEnvironment === 'Production' ? 'production' : 'sandbox',
    p_apple_app_account_token: transaction.appAccountToken ?? null,
    p_last_verified_at: notification.signedDate ? new Date(notification.signedDate).toISOString() : new Date().toISOString(),
    p_raw_event_summary: { notificationType: notification.notificationType, subtype: notification.subtype ?? null, productId: transaction.productId, status: stateChange.status },
    p_provider_event_id: notificationUUID,
    p_event_type: notification.notificationType
  });

  if (rpcError) {
    if (rpcError.code === '23505' || /already linked to a different/i.test(rpcError.message ?? '')) {
      // A genuine, unresolvable ownership conflict — do not retry
      // forever into the same conflict. Recorded (the provider_events
      // insert inside the RPC's own transaction rolled back along with
      // everything else, so this is NOT yet recorded — attempt a
      // best-effort standalone record for audit, then ack).
      console.error('apple-server-notifications: ownership conflict', notification.notificationType);
      await supabaseAdmin.from('provider_events').insert({
        provider: 'apple',
        provider_event_id: notificationUUID,
        event_type: notification.notificationType,
        user_id: null,
        payload_summary: { notificationType: notification.notificationType, ownershipConflict: true }
      }).then(({ error }) => {
        if (error && error.code !== '23505') console.error('apple-server-notifications: failed to record conflict event', error.message);
      });
      return json({ received: true, processed: false, reason: 'ownership_conflict' });
    }
    // A transient/unexpected failure — return 500 so Apple retries,
    // exactly like stripe-webhook's own genuine-failure convention.
    console.error('apple-server-notifications: failed to apply verified state', rpcError.message);
    return json({ error: 'Failed to process notification' }, 500);
  }

  return json({ received: true, processed: true });
});

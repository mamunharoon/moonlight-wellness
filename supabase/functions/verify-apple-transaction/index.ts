// Apple Server Verification task — verify-apple-transaction.
//
// Client-triggered, post-purchase verification. This is now a genuine
// verifier, not a stub — see appleJwsVerification.ts's header comment
// for why Apple's own official library is not used, and what is used
// instead (jose + @peculiar/x509, both WebCrypto-native).
//
// Trust boundary (per this task's explicit security model):
//   - Requires a valid Supabase user JWT; resolves the authenticated
//     user server-side (same pattern as create-checkout-session).
//   - Accepts ONLY a `transactionId` from the client — nothing else the
//     client claims (product, status, expiry, environment, price,
//     offer, appAccountToken) is ever trusted for what gets written.
//   - The actual verification/apply flow (call Apple's own App Store
//     Server API, cryptographically verify every JWS returned, enforce
//     bundle id / product-id allow-list / environment / ownership, and
//     write via the service-role-only RPC) lives in
//     _shared/applyVerifiedAppleTransaction.ts — shared with
//     reconcile-apple-subscriptions so the security-critical logic is
//     never duplicated between the two callers.
//   - Returns a minimal response: verified true/false, status, expiry.
//     Never the signed payload, never any other sensitive Apple field.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';
import { appleServerCredentialsConfigured } from '../_shared/appleServerApi.ts';
import { verifyAndApplyAppleTransaction } from '../_shared/applyVerifiedAppleTransaction.ts';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

const NOT_CONFIRMED_MESSAGE = "We couldn't confirm this purchase yet. Please check back shortly, or contact support if this continues.";

// Reasons that reflect a genuine, permanent rejection (bad data, wrong
// product, ownership conflict) vs. a transient one (Apple API
// unavailable) — used only to pick an appropriate HTTP status; the
// response body's own `reason` field is what a caller should actually
// branch on.
const HTTP_STATUS_BY_REASON = {
  transaction_not_found: 404,
  bundle_id_mismatch: 400,
  unknown_product: 400,
  environment_mismatch: 400,
  transaction_id_mismatch: 400,
  appAccountToken_mismatch: 409,
  already_linked_to_another_account: 409,
  user_not_resolved: 400,
  signature_invalid: 502,
  apple_api_unavailable: 502,
  internal_error: 500
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return json({ error: 'Sign in required' }, 401);
  }

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return json({ error: 'Sign in required' }, 401);
  }
  if (userData.user.is_anonymous) {
    return json({ error: 'Please sign in or create an account first.' }, 403);
  }
  const userId = userData.user.id;

  let body = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  // The ONLY thing accepted from the client. No productIdentifier,
  // status, or jwsRepresentation is read from the request body at all —
  // every one of those now comes exclusively from Apple's own verified
  // response.
  const transactionId = body?.transactionId;
  if (typeof transactionId !== 'string' || transactionId.length === 0) {
    return json({ error: 'Missing transactionId' }, 400);
  }

  if (!appleServerCredentialsConfigured()) {
    console.warn('verify-apple-transaction: Apple server credentials not configured — verification not yet available');
    return json({ verified: false, reason: 'apple_server_verification_not_yet_configured', message: NOT_CONFIRMED_MESSAGE }, 501);
  }

  const environment = Deno.env.get('APPLE_ENVIRONMENT') ?? '';
  const bundleId = Deno.env.get('APPLE_BUNDLE_ID') ?? '';
  if (bundleId !== 'com.zavaraai.wakewise' || (environment !== 'production' && environment !== 'sandbox')) {
    // Fail closed on a misconfiguration, never guess a bundle id or
    // environment. bundleId is intentionally hardcoded to WakeWise's
    // real bundle id (not merely "non-empty") — an operator typo in the
    // secret value must not silently widen what this function accepts.
    console.error('verify-apple-transaction: APPLE_BUNDLE_ID/APPLE_ENVIRONMENT misconfigured');
    return json({ verified: false, reason: 'apple_server_verification_not_yet_configured', message: NOT_CONFIRMED_MESSAGE }, 501);
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const result = await verifyAndApplyAppleTransaction(
    { transactionId, environment, expectedUserId: userId },
    { supabaseAdmin }
  );

  if (!result.verified) {
    console.warn('verify-apple-transaction: not verified', result.reason);
    return json(
      { verified: false, reason: result.reason, message: NOT_CONFIRMED_MESSAGE },
      HTTP_STATUS_BY_REASON[result.reason] ?? 502
    );
  }

  return json({ verified: true, status: result.status, expiresAt: result.expiresAt, recorded: result.recorded });
});

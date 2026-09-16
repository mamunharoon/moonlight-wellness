// Apple Subscription Architecture task, Phase C — client-triggered Apple
// transaction verification.
//
// *** THIS IS A FAIL-CLOSED STUB, NOT A WORKING VERIFIER. ***
// docs/apple-subscription-architecture.md §8 designs the real flow:
// verify the client-submitted transaction against Apple's own App Store
// Server API (or independently verify the JWS signature against Apple's
// published root certificates), never trusting the device's own claim.
// That requires Apple credentials (APPLE_ISSUER_ID, APPLE_KEY_ID,
// APPLE_PRIVATE_KEY — an App Store Connect API key) this task does not
// have, must not fabricate, and must not commit. Every path through this
// function that lacks those credentials responds honestly that
// verification did not happen and grants nothing — it never falls back
// to trusting the client's transaction data, and it never decodes
// `jwsRepresentation` as if that alone proved anything (a JWS's *shape*
// is not its *validity* — only a real signature-chain check against
// Apple's roots, or Apple's own server confirming the transaction ID,
// counts as verified).
//
// What this stub DOES do safely, today, without any Apple credential:
//   - Verifies the caller's own Supabase identity from their JWT (same
//     pattern as create-checkout-session) — a request with no valid
//     session is rejected before anything else happens.
//   - Validates the claimed product id against the same fixed
//     allow-list the future real verifier must also enforce
//     (KNOWN_APPLE_PLUS_PRODUCT_IDS) — an unrecognised product id is
//     rejected immediately, never silently accepted.
//   - Never writes to entitlements/provider_subscriptions/provider_events
//     (Phase C's new tables) — both because no verification has actually
//     happened, and because those tables do not exist on the live
//     project yet (their migration is deliberately unapplied — see
//     supabase/migrations/20260916100000_apple_subscription_entitlements_foundation.sql).
//     A future task, once Apple credentials exist and that migration is
//     applied, replaces the body of the `else` branch below with the
//     real App Store Server API call + provider_subscriptions/
//     entitlements upsert — the shape of what that write should look
//     like is documented, not implemented, in
//     docs/apple-subscription-architecture.md §7-§8.
//   - Never logs `jwsRepresentation`, a receipt, or any raw transaction
//     payload — only the (already non-sensitive, allow-listed)
//     productIdentifier and plain error messages are ever logged.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { isKnownApplePlusProductId } from '../_shared/planMapping.ts';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

// Presence-only check — never reads the actual secret value into a
// variable that could be logged or returned. A future real
// implementation reads these to sign App Store Server API requests; this
// stub only asks "do they exist yet."
const appleServerCredentialsConfigured = () =>
  Boolean(Deno.env.get('APPLE_ISSUER_ID')) &&
  Boolean(Deno.env.get('APPLE_KEY_ID')) &&
  Boolean(Deno.env.get('APPLE_PRIVATE_KEY'));

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

  let body = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const productIdentifier = body?.productIdentifier;
  if (typeof productIdentifier !== 'string' || !isKnownApplePlusProductId(productIdentifier)) {
    return json({ error: 'Unknown or missing product identifier' }, 400);
  }

  // transactionId/jwsRepresentation are read only far enough to confirm
  // they are present and string-shaped — never parsed, decoded, or
  // otherwise treated as meaningful data by this stub.
  const transactionId = body?.transactionId;
  const jwsRepresentation = body?.jwsRepresentation;
  if (typeof transactionId !== 'string' || typeof jwsRepresentation !== 'string') {
    return json({ error: 'Malformed transaction payload' }, 400);
  }

  if (!appleServerCredentialsConfigured()) {
    // Fail closed: no entitlement is granted, no row is written, and the
    // client is told plainly that this purchase is not yet confirmed —
    // never that it succeeded. See docs/apple-subscription-implementation.md
    // for exactly what remains to complete this (App Store Connect API
    // key generation, then a real App Store Server API call here).
    console.warn('verify-apple-transaction: Apple server credentials not configured — verification not yet available');
    return json(
      {
        verified: false,
        reason: 'apple_server_verification_not_yet_configured',
        message: "We couldn't confirm this purchase yet. Please check back shortly, or contact support if this continues."
      },
      501
    );
  }

  // Unreachable in this task (the credentials above are never set here),
  // and deliberately left unimplemented rather than guessed at — see the
  // file header. A real implementation must not be added without those
  // credentials to actually test against Apple's sandbox environment.
  return json(
    {
      verified: false,
      reason: 'not_implemented',
      message: "We couldn't confirm this purchase yet. Please check back shortly, or contact support if this continues."
    },
    501
  );
});

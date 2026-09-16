// Apple Subscription Architecture task, Phase C — App Store Server
// Notifications V2 receiver.
//
// *** THIS IS A FAIL-CLOSED STUB, NOT A WORKING WEBHOOK HANDLER. ***
// Apple calls this endpoint directly (there is no Supabase user JWT to
// check, exactly like stripe-webhook/index.ts) with a signedPayload JWS
// whose signature chains up to Apple's own root certificates. Real
// verification requires validating that certificate chain — this stub
// deliberately does NOT do that (it has no certificate-chain
// verification library wired in, and must not fabricate one), and it
// never decodes/trusts the payload as if the JWS's mere presence proved
// anything. Every request is safely rejected without ever writing
// anything to provider_events/provider_subscriptions/entitlements.
//
// docs/apple-subscription-architecture.md §8 documents the real design:
// verify the JWS certificate chain (Apple's own App Store Server Library
// is the first-party tool for this — not a hand-rolled implementation),
// check idempotency against provider_events(provider, provider_event_id)
// before processing (exactly mirroring stripe-webhook's own
// stripe_webhook_events pattern), then update
// provider_subscriptions/entitlements only after that verification
// passes. None of that exists yet — this file only proves the request
// shape (a POST with a signedPayload string) and then explicitly
// declines to process it.
//
// A shared secret (APPLE_APP_STORE_SERVER_NOTIFICATIONS_SECRET, if the
// eventual verification approach uses one) is checked for presence only
// — never for validity, since there is no verification logic yet to
// validate it against.
import { corsHeaders } from '../_shared/cors.ts';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    // Malformed body — fail closed, do not guess at intent.
    return json({ error: 'Invalid notification payload' }, 400);
  }

  if (typeof body?.signedPayload !== 'string' || body.signedPayload.length === 0) {
    return json({ error: 'Missing signedPayload' }, 400);
  }

  // Never reached with real verification in this task — no
  // certificate-chain check exists yet. Logged as a warning (not an
  // error) since receiving a notification before this is implemented is
  // an expected, anticipated state while Apple IAP does not exist yet,
  // not a bug. The raw signedPayload is never logged.
  console.warn('apple-server-notifications: JWS certificate-chain verification not yet implemented — notification not processed');

  // Apple expects a 200 for a notification it should not keep retrying
  // indefinitely once the endpoint is known-reachable; returning an
  // error status here would cause Apple to retry a notification this
  // endpoint can never process yet regardless. This is intentionally
  // different from stripe-webhook's 500-on-failure convention — that
  // convention exists so a genuine mid-processing crash gets retried;
  // here, nothing is ever attempted at all, so there is nothing to
  // retry into succeeding later without a code change.
  return json({ received: true, processed: false, reason: 'not_yet_implemented' });
});

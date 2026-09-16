// Apple Server Verification task, Phase 6 — reconcile-apple-subscriptions.
//
// The backstop for a missed/delayed App Store Server Notification,
// exactly as designed in docs/apple-subscription-architecture.md §8: for
// every provider_subscriptions row not verified recently, re-query
// Apple's own App Store Server API and re-apply the same verified state
// through the SAME code path apple-server-notifications and
// verify-apple-transaction already use
// (_shared/applyVerifiedAppleTransaction.ts) — one source of truth for
// "how does a verified Apple fact become a database write."
//
// *** NOT SCHEDULED OR DEPLOYED BY THIS TASK. *** No pg_cron entry, no
// external scheduler configuration, and this function itself is not
// deployed — see this task's own "Do not schedule or deploy it
// externally in this task" instruction. This file exists so the code is
// written, reviewed, and tested; wiring an actual schedule is future,
// separate, deliberate work requiring explicit owner approval (exactly
// like every migration apply/deploy in this project).
//
// Trust boundary: this is NOT reachable by an ordinary client at all —
// no Supabase user JWT is accepted or checked. It requires a dedicated
// shared secret (APPLE_RECONCILE_TRIGGER_SECRET, a name only — never a
// value — see docs/apple-subscription-implementation.md), deliberately
// separate from SUPABASE_SERVICE_ROLE_KEY so it can be rotated
// independently without touching every other Edge Function's trust
// boundary. Fails closed (401) if the secret is missing, unconfigured,
// or does not match — compared with a constant-time check so response
// timing cannot be used to guess it.
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';
import { verifyAndApplyAppleTransaction } from '../_shared/applyVerifiedAppleTransaction.ts';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

// Constant-time string comparison — a plain `===` on a shared secret
// leaks timing information proportional to the first mismatched byte.
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

// How stale a row must be before this pass re-verifies it. Intentionally
// generous (not seconds/minutes) — this is a backstop for a MISSED
// notification, not the primary update path, and every real call costs
// an Apple App Store Server API request. Rate/cost-conscious per this
// task's own instruction; overridable per-request only for testing a
// deployment manually, never by an untrusted caller (the trigger-secret
// check above already gates the whole endpoint).
const DEFAULT_STALE_AFTER_HOURS = 24;
const MAX_ROWS_PER_RUN = 50;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const configuredSecret = Deno.env.get('APPLE_RECONCILE_TRIGGER_SECRET') ?? '';
  const providedSecret = req.headers.get('X-Reconcile-Secret') ?? '';
  if (!configuredSecret || !providedSecret || !timingSafeEqual(providedSecret, configuredSecret)) {
    console.warn('reconcile-apple-subscriptions: rejected — missing or invalid trigger secret');
    return json({ error: 'Unauthorized' }, 401);
  }

  const environment = Deno.env.get('APPLE_ENVIRONMENT') ?? '';
  if (environment !== 'production' && environment !== 'sandbox') {
    console.error('reconcile-apple-subscriptions: APPLE_ENVIRONMENT misconfigured');
    return json({ error: 'Not configured' }, 501);
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const staleBefore = new Date(Date.now() - DEFAULT_STALE_AFTER_HOURS * 60 * 60 * 1000).toISOString();
  const { data: staleRows, error: queryError } = await supabaseAdmin
    .from('provider_subscriptions')
    .select('user_id, apple_original_transaction_id')
    .eq('provider', 'apple')
    .lt('last_verified_at', staleBefore)
    .limit(MAX_ROWS_PER_RUN);

  if (queryError) {
    console.error('reconcile-apple-subscriptions: failed to query stale rows', queryError.message);
    return json({ error: 'Failed to query stale subscriptions' }, 500);
  }

  const results = [];
  for (const row of staleRows ?? []) {
    // Sequential, not parallel — deliberately rate-conscious against
    // Apple's own API, and each call's bearer token is cheap to
    // recreate but there is no reason to burst them.
    const outcome = await verifyAndApplyAppleTransaction(
      { transactionId: row.apple_original_transaction_id, environment, expectedUserId: row.user_id },
      { supabaseAdmin }
    );
    results.push({ verified: outcome.verified, reason: outcome.reason ?? null });
    if (!outcome.verified) {
      console.warn('reconcile-apple-subscriptions: could not re-verify a subscription', outcome.reason);
    }
  }

  return json({
    checked: staleRows?.length ?? 0,
    reconciled: results.filter((r) => r.verified).length,
    failed: results.filter((r) => !r.verified).length
  });
});

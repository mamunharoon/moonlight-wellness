// Sprint 2 Stage 3A — create-checkout-session
//
// The only things the browser ever sends here are a billing `interval`
// choice ('monthly' | 'yearly') and an opaque `client_attempt_id` (never
// a price id, plan, status, or user id). This function verifies the
// caller's identity server-side from their JWT (never trusts a
// client-supplied user id), rejects guests, and writes only
// `stripe_customer_id` (an identifier, not an entitlement) plus its own
// `checkout_attempts` bookkeeping. It never sets plan/status/provider on
// `subscriptions` — see stripe-webhook/index.ts, the only code path in
// this app allowed to do that.
//
// Duplicate-Subscription Remediation: this function now also enforces
// "at most one non-terminal Stripe subscription per user" (checked
// against LIVE Stripe data, never the DB alone — the DB can go stale,
// which is exactly how a customer ended up with two real concurrent
// Stripe subscriptions before this fix) and "at most one live checkout
// attempt per user" (via the claim_checkout_attempt RPC and the
// checkout_attempts table's own partial unique index — see
// 20260918100000_checkout_attempts_concurrency_guard.sql).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';
import { getStripeClient } from '../_shared/stripeClient.ts';
import { priceIdForInterval, isTrialEligible, isBlockingStripeStatus } from '../_shared/planMapping.ts';
import { buildStripeLedgerFields, upsertStripeLedgerRow } from '../_shared/providerLedger.ts';

// Apple Subscription Architecture task, Phase D — the seven-day trial:
// TRIAL_DAYS mirrors src/lib/pricingConfig.js's own TRIAL_DAYS = 7 (kept
// as a separate constant here rather than imported, since this Deno
// function cannot import a Vite/browser-targeted src/ module — the two
// are expected to be kept in sync by hand, exactly like every other
// duplicated-by-necessity constant between the client and Edge Function
// layers in this codebase).
const TRIAL_DAYS = 7;

// Duplicate-Subscription Remediation — how long a Stripe Checkout Session
// stays usable before it self-expires. Deliberately short and explicit
// (never Stripe's much longer default) so an abandoned checkout attempt
// releases the one-live-attempt-per-user lock within a bounded, sane
// window rather than tying it up for hours. Confirm this value against
// the allowed range for the Stripe API version actually pinned
// (npm:stripe@17.4.0) before relying on it in production.
const CHECKOUT_SESSION_EXPIRY_SECONDS = 30 * 60;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

// Marks a claimed attempt failed with a short, non-sensitive reason —
// never the raw Stripe error object, which can carry more detail than
// this table should hold.
const markAttemptFailed = async (supabaseAdmin, attemptId, failureCode, failureMessage) => {
  const { error } = await supabaseAdmin
    .from('checkout_attempts')
    .update({ status: 'failed', failure_code: failureCode, failure_message: failureMessage ?? null, updated_at: new Date().toISOString() })
    .eq('id', attemptId)
    .in('status', ['pending', 'open']);
  if (error) {
    console.error('create-checkout-session: failed to mark attempt failed', error.message);
  }
};

// Duplicate-Subscription Remediation — the authoritative existing-
// subscription check. Deliberately queries Stripe directly rather than
// relying on public.subscriptions alone: the DB is only ever as fresh as
// the last webhook event it successfully processed, which is exactly how
// a customer ended up with a real, live $50/year Stripe subscription this
// app's own database had no record of. A customer with no Stripe customer
// id yet has never subscribed, so this short-circuits without an API call.
const findBlockingStripeSubscription = async (stripe, customerId) => {
  if (!customerId) return null;
  const { data } = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
  return data.find((subscription) => isBlockingStripeStatus(subscription.status)) ?? null;
};

// Does the actual eligibility check + Stripe Checkout Session creation
// for a freshly claimed (or reclaimed) 'pending' attempt. Every exit path
// leaves the attempt row in a terminal ('failed') or 'open' state — never
// left dangling in 'pending' past this function returning.
const performCheckout = async (supabaseAdmin, stripe, user, attemptId, priceId, environment, origin) => {
  const { data: existingRow, error: fetchError } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id, trial_used_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    console.error('create-checkout-session: failed to read subscriptions row', fetchError.message);
    await markAttemptFailed(supabaseAdmin, attemptId, 'DB_READ_FAILED');
    return json({ error: 'Could not start checkout. Please try again.', code: 'INTERNAL_ERROR' }, 500);
  }

  let customerId = existingRow?.stripe_customer_id ?? null;

  // Server-side trial eligibility (Phase D): decided from this user's own
  // stored subscriptions row, never from anything the client sent.
  const trialEligible = isTrialEligible(existingRow);

  try {
    const blockingSubscription = await findBlockingStripeSubscription(stripe, customerId);
    if (blockingSubscription) {
      // Self-healing: record what Stripe actually says into the ledger
      // now that the guard has surfaced it, so the reconciliation task
      // (and any future guard check) sees accurate data even before the
      // normal webhook path would have caught up.
      await upsertStripeLedgerRow(
        supabaseAdmin,
        buildStripeLedgerFields(user.id, blockingSubscription, customerId),
        environment
      );
      await markAttemptFailed(supabaseAdmin, attemptId, 'ALREADY_SUBSCRIBED');
      return json(
        { error: 'You already have a subscription. Manage it from your account.', code: 'ALREADY_SUBSCRIBED' },
        409
      );
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id }
      });
      customerId = customer.id;

      // Only the identifier is written here — plan/status/provider stay
      // whatever they already were (Stage 1's "no row = free" default)
      // until the webhook, driven by a real Stripe event, says otherwise.
      const { error: upsertError } = await supabaseAdmin
        .from('subscriptions')
        .upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('create-checkout-session: failed to store stripe_customer_id', upsertError.message);
        await markAttemptFailed(supabaseAdmin, attemptId, 'DB_WRITE_FAILED');
        return json({ error: 'Could not start checkout. Please try again.', code: 'INTERNAL_ERROR' }, 500);
      }
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/subscription?checkout=success`,
        cancel_url: `${origin}/subscription?checkout=cancelled`,
        // Duplicate-Subscription Remediation — checkout_attempt_id links
        // checkout.session.completed/expired back to this exact attempt
        // row (see stripe-webhook/index.ts's consumeCheckoutAttempt /
        // releaseExpiredCheckoutAttempt). Server-set, never client-
        // writable once the session exists.
        metadata: { supabase_user_id: user.id, checkout_attempt_id: attemptId },
        expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_EXPIRY_SECONDS,
        subscription_data: {
          metadata: { supabase_user_id: user.id },
          // Phase D: passed explicitly, and only when this specific user
          // is actually eligible — never inferred from the Stripe Price
          // object's own configuration.
          ...(trialEligible ? { trial_period_days: TRIAL_DAYS } : {})
        }
      },
      // Duplicate-Subscription Remediation — this attempt's own internal
      // id as the Stripe idempotency key. A genuine retry of this exact
      // attempt (client_attempt_id unchanged) reuses this same key, so
      // Stripe itself returns the original session rather than creating a
      // second one; a brand new attempt always gets a brand new key.
      { idempotencyKey: attemptId }
    );

    const { error: openError } = await supabaseAdmin
      .from('checkout_attempts')
      .update({
        status: 'open',
        stripe_checkout_session_id: session.id,
        checkout_url: session.url,
        stripe_expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', attemptId)
      .eq('status', 'pending');

    if (openError) {
      // The Stripe session exists regardless — surface the URL to the
      // user, but log loudly, since the attempt row no longer accurately
      // reflects reality until this is investigated.
      console.error('create-checkout-session: failed to record open checkout attempt', openError.message);
    }

    return json({ url: session.url });
  } catch (stripeError) {
    console.error('create-checkout-session: Stripe API call failed', stripeError.message);
    await markAttemptFailed(supabaseAdmin, attemptId, 'STRIPE_ERROR', stripeError.message);
    return json({ error: 'Could not start checkout. Please try again.', code: 'INTERNAL_ERROR' }, 500);
  }
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

  // Verify identity server-side against the JWT itself, not a
  // client-supplied id. Same anon-key + bearer-token pattern the rest of
  // this app's Supabase calls already use. This is also the entire trust
  // boundary for claim_checkout_attempt below: that RPC takes a raw
  // p_user_id with no in-body ownership check (see its own migration
  // comment), so p_user_id must only ever come from this verified user,
  // never from the request body.
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return json({ error: 'Sign in required' }, 401);
  }
  const user = userData.user;

  // Guests (Supabase anonymous sessions) must sign in / create an
  // account first (Stage 3A, section 4). This is the real boundary;
  // Subscription.jsx's own guest gate is only a UX shortcut on top of it.
  if (user.is_anonymous) {
    return json({ error: 'Please sign in or create an account to upgrade.' }, 403);
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    // no body / invalid JSON -> falls through to the validation checks below
  }

  const priceId = priceIdForInterval(body?.interval);
  if (!priceId) {
    return json({ error: 'Invalid or unconfigured billing interval' }, 400);
  }

  // Duplicate-Subscription Remediation — client_attempt_id is required
  // and validated as a well-formed UUID server-side before it ever
  // reaches the RPC or a SQL uuid-typed column, so a malformed value
  // fails cleanly with a 400 rather than a raw DB type-cast error.
  const clientAttemptId = body?.client_attempt_id;
  if (typeof clientAttemptId !== 'string' || !UUID_PATTERN.test(clientAttemptId)) {
    return json({ error: 'A valid client_attempt_id is required', code: 'INVALID_ATTEMPT_ID' }, 400);
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch (configError) {
    console.error('create-checkout-session: not configured', configError.message);
    return json({ error: 'Could not start checkout. Please try again.', code: 'INTERNAL_ERROR' }, 500);
  }

  const environment = Deno.env.get('STRIPE_SECRET_KEY')?.startsWith('sk_live_') ? 'production' : 'sandbox';
  const supabaseAdmin = createSupabaseAdminClient();
  const origin = req.headers.get('Origin') ?? new URL(req.url).origin;

  const { data: claimRows, error: claimError } = await supabaseAdmin.rpc('claim_checkout_attempt', {
    p_user_id: user.id,
    p_client_attempt_id: clientAttemptId,
    p_billing_interval: body.interval
  });

  if (claimError) {
    console.error('create-checkout-session: claim_checkout_attempt failed', claimError.message);
    return json({ error: 'Could not start checkout. Please try again.', code: 'INTERNAL_ERROR' }, 500);
  }

  const claim = claimRows?.[0];
  if (!claim) {
    console.error('create-checkout-session: claim_checkout_attempt returned no row');
    return json({ error: 'Could not start checkout. Please try again.', code: 'INTERNAL_ERROR' }, 500);
  }

  if (claim.outcome === 'existing_open_attempt') {
    return json(
      {
        error: 'A checkout is already in progress for your account.',
        code: 'ALREADY_CHECKOUT_IN_PROGRESS',
        checkout_url: claim.status === 'open' ? claim.checkout_url : null
      },
      409
    );
  }

  if (claim.outcome === 'retry_same_attempt') {
    // Duplicate-Subscription Remediation — terminal retry behaviour is
    // deliberately state-specific: an 'open' retry may safely replay the
    // stored URL; a 'pending' retry may safely continue using the same
    // Stripe idempotency key (it falls through to performCheckout below,
    // exactly like a brand new claim); a 'consumed' retry must be told
    // the subscription already exists, never handed a URL; a
    // 'failed'/'expired' retry must never return a stale Checkout URL and
    // must require the client to generate a genuinely new
    // client_attempt_id rather than being silently revived here.
    if (claim.status === 'open') {
      return json({ url: claim.checkout_url });
    }
    if (claim.status === 'consumed') {
      return json(
        { error: 'You already have a subscription. Manage it from your account.', code: 'ALREADY_SUBSCRIBED' },
        409
      );
    }
    if (claim.status === 'failed' || claim.status === 'expired') {
      return json(
        { error: 'That checkout attempt is no longer valid. Please try again.', code: 'ATTEMPT_NO_LONGER_VALID' },
        409
      );
    }
    // status === 'pending' — this exact attempt is still mid-flight
    // (e.g. a network retry of the same click); safe to just continue
    // processing it below under its own existing id.
  }

  // outcome is 'claimed_new', 'stale_or_expired_reclaimed', or
  // 'retry_same_attempt' with status 'pending' — all three mean "do the
  // real work now, under claim.attempt_id."
  return performCheckout(supabaseAdmin, stripe, user, claim.attempt_id, priceId, environment, origin);
});

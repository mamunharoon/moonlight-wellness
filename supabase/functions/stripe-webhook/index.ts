// Sprint 2 Stage 3A — stripe-webhook
//
// This is the ONLY code path in the whole app allowed to write
// plan/status/provider on a subscriptions row. It is never called from
// the browser — Stripe's servers call it directly — so there is no user
// JWT to check. Trust instead comes entirely from the Stripe-Signature
// verification below: nothing in this file ever reads a value out of
// the incoming payload without that verification having already passed.
//
// Idempotent by construction: every event id is checked against
// stripe_webhook_events before any processing, and recorded only after
// processing succeeds (see the comment above that check for why
// check-then-process-then-record was chosen over insert-first).
import Stripe from 'npm:stripe@17.4.0';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';
import { getStripeClient } from '../_shared/stripeClient.ts';
import {
  mapStripeStatus,
  mapRefundOrDisputeEventToStatus,
  NON_TERMINAL_LEDGER_STATUSES,
  stripeSubscriptionIdentityMismatch,
  checkoutSessionAdmissionFailureReason,
  refundOrDisputeQuarantineReason
} from '../_shared/planMapping.ts';
import { buildStripeLedgerFields, upsertStripeLedgerRow } from '../_shared/providerLedger.ts';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const resolveUserId = async (supabaseAdmin, { metadataUserId, subscriptionId, customerId }) => {
  if (metadataUserId) return metadataUserId;

  if (subscriptionId) {
    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  }

  if (customerId) {
    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  }

  return null;
};

// Writes the single effective public.subscriptions projection the rest
// of the app reads (SubscriptionContext.jsx). Sets plan='plus'
// unconditionally (not conditionally per-status): cancellation flips
// `status`, not `plan`, exactly matching entitlements.js's own documented
// model, so a cancelled subscription correctly stays plan='plus' +
// status='cancelled' rather than being reset to plan='free'.
const writeProjectionFromLedgerFields = async (supabaseAdmin, fields) => {
  const { error } = await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: fields.user_id,
      plan: 'plus',
      status: fields.status,
      provider: 'stripe',
      stripe_customer_id: fields.stripe_customer_id,
      stripe_subscription_id: fields.stripe_subscription_id,
      stripe_price_id: fields.product_id,
      expires_at: fields.current_period_expires_at,
      cancel_at_period_end: fields.cancel_at_period_end
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
};

// Duplicate-Subscription Remediation — every subscription-lifecycle event
// first writes the ledger unconditionally (safe by construction: keyed on
// (provider, stripe_subscription_id), so it can never touch a different
// subscription's row), then decides whether the effective projection may
// change:
//
//   1. If this event is about the subscription the projection ALREADY
//      tracks, update it normally — the ordinary lifecycle path
//      (trialing -> active, cancellation, etc).
//   2. Otherwise, count this user's non-terminal Stripe ledger rows.
//      - Zero: nothing to promote, leave the projection as-is.
//      - Exactly one: unambiguous — safe to (re)promote it as the
//        effective projection (covers a brand-new subscriber, or the
//        previously-tracked subscription having just gone terminal with
//        this being the sole survivor).
//      - More than one: a genuine conflict between real Stripe
//        subscriptions. The ledger keeps recording the full truth; the
//        projection is deliberately left untouched and the conflict is
//        logged rather than guessed at.
//
// This is what makes "an event for subscription A can never cancel or
// overwrite the row currently tracking subscription B" true regardless of
// which order checkout.session.completed / customer.subscription.* events
// arrive in for the same new subscription — everything is keyed off
// stripe_subscription_id, never off event type or arrival order.
//
// Callers are responsible for proving trust BEFORE calling this — see
// checkoutSessionAdmissionFailureReason (checkout.session.completed) and
// the known-subscription-only gate (customer.subscription.updated/deleted)
// below. This function itself performs no admission decision.
const updateLedgerAndProjection = async (supabaseAdmin, userId, stripeSubscription, customerId, environment) => {
  const eventFields = buildStripeLedgerFields(userId, stripeSubscription, customerId);
  await upsertStripeLedgerRow(supabaseAdmin, eventFields, environment);

  const { data: currentProjection, error: fetchError } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (currentProjection?.stripe_subscription_id === stripeSubscription.id) {
    await writeProjectionFromLedgerFields(supabaseAdmin, eventFields);
    return;
  }

  const { data: nonTerminalRows, error: ledgerError } = await supabaseAdmin
    .from('provider_subscriptions')
    .select('stripe_subscription_id, stripe_customer_id, product_id, status, current_period_expires_at, cancel_at_period_end')
    .eq('user_id', userId)
    .eq('provider', 'stripe')
    .in('status', NON_TERMINAL_LEDGER_STATUSES);
  if (ledgerError) throw ledgerError;

  if (!nonTerminalRows || nonTerminalRows.length === 0) {
    return;
  }

  if (nonTerminalRows.length === 1) {
    const winner = nonTerminalRows[0];
    await writeProjectionFromLedgerFields(supabaseAdmin, { user_id: userId, ...winner });
    return;
  }

  console.error(
    'stripe-webhook: reconciliation conflict — multiple non-terminal Stripe subscriptions for user, projection left untouched',
    userId,
    nonTerminalRows.map((row) => `${row.stripe_subscription_id}:${row.status}`)
  );
};

// Duplicate-Subscription Remediation — marks the checkout_attempts row
// that produced this session as consumed. checkout_attempt_id travels
// through server-set (not client-writable) Checkout Session metadata —
// see create-checkout-session/index.ts. By the time this is called, the
// full admission chain (checkoutSessionAdmissionFailureReason) has already
// verified this attempt genuinely belongs to this session/user, so the
// user_id match here is defense in depth, not the primary trust boundary.
// Idempotent under webhook retries: the status filter makes a repeat
// update a harmless no-op.
const consumeCheckoutAttempt = async (supabaseAdmin, userId, checkoutAttemptId) => {
  if (!checkoutAttemptId) return;
  const { data, error } = await supabaseAdmin
    .from('checkout_attempts')
    .update({ status: 'consumed', consumed_at: new Date().toISOString() })
    .eq('id', checkoutAttemptId)
    .eq('user_id', userId)
    .in('status', ['pending', 'open'])
    .select('id');

  if (error) {
    console.error('stripe-webhook: failed to mark checkout attempt consumed', error.message);
    return;
  }
  if (!data || data.length === 0) {
    console.warn('stripe-webhook: checkout attempt not found, mismatched, or already terminal', checkoutAttemptId);
  }
};

// Duplicate-Subscription Remediation — releases an attempt whose Stripe
// Checkout Session expired without completion, so the user is free to
// start a new one. Legacy-Price Webhook Remediation added the session id
// match: an expired-session event may only release the specific attempt
// it actually belongs to, never merely "whatever attempt this id points
// at" — identity, not just presence of an id, is what's trusted. Only
// transitions out of 'open' — a session that somehow expires after
// already being marked consumed (should not happen, since Stripe never
// sends both for the same session) is left alone rather than regressed.
const releaseExpiredCheckoutAttempt = async (supabaseAdmin, checkoutAttemptId, sessionId) => {
  if (!checkoutAttemptId) return;
  const { error } = await supabaseAdmin
    .from('checkout_attempts')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', checkoutAttemptId)
    .eq('stripe_checkout_session_id', sessionId)
    .eq('status', 'open');

  if (error) {
    console.error('stripe-webhook: failed to release expired checkout attempt', error.message);
  }
};

// Phase D: records that this user's one trial has now genuinely been
// used — called only from checkout.session.completed, only when the
// resulting subscription's status actually is 'trialing' (mapStripeStatus
// maps this to 'trial'). Never called merely because a checkout session
// was created (an abandoned checkout must never burn the user's trial),
// and never overwrites an existing trial_used_at (a renewal/upgrade that
// happens to still read as 'trial' status must not reset the clock on an
// already-recorded first use).
const recordTrialUsageIfStarted = async (supabaseAdmin, userId, mappedStatus) => {
  if (mappedStatus !== 'trial') return;
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ trial_used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('trial_used_at', null);
  if (error) {
    console.error('stripe-webhook: failed to record trial_used_at', error.message);
  }
};

// Legacy-Price Webhook Remediation — resolves the EXACT Stripe
// subscription a charge belongs to, via its invoice (a charge billed
// through subscription billing always carries an invoice id; the invoice
// itself carries the subscription id). A charge with no invoice is not
// subscription-related at all. Deliberately never falls back to "the
// customer's other subscription" — that fallback is exactly what let a
// refund for one subscription risk touching an unrelated subscription
// merely because both belonged to the same customer.
const resolveSubscriptionIdForCharge = async (stripe, charge) => {
  if (!charge?.invoice) return null;
  const invoiceId = typeof charge.invoice === 'string' ? charge.invoice : charge.invoice.id;
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (!invoice.subscription) return null;
    return typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
  } catch (retrieveError) {
    console.error('stripe-webhook: failed to retrieve invoice for charge', retrieveError.message);
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch (configError) {
    console.error('stripe-webhook: not configured', configError.message);
    return json({ error: 'Webhook not configured yet' }, 500);
  }

  const signature = req.headers.get('Stripe-Signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  const rawBody = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature ?? '',
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err) {
    console.error('stripe-webhook: signature verification failed', err.message);
    return json({ error: 'Invalid signature' }, 400);
  }

  // Duplicate-Subscription Remediation — derived from the verified event
  // itself (event.livemode), never hardcoded or assumed from which
  // project this function is deployed to.
  const environment = event.livemode ? 'production' : 'sandbox';

  // Legacy-Price Webhook Remediation — a global, event-independent
  // guard: this endpoint is configured for DEV/Sandbox only, so a
  // genuinely livemode event arriving here is a misconfiguration signal,
  // never something to process. Checked before idempotency/DB access.
  if (event.livemode) {
    console.error('stripe-webhook: rejected a livemode event on the DEV/sandbox-only endpoint', event.id);
    return json({ received: true, quarantined: true });
  }

  const supabaseAdmin = createSupabaseAdminClient();

  // Idempotency: a redelivered event id is a safe no-op. Checked before
  // any processing, recorded only after processing succeeds below — a
  // crash mid-processing means the event is correctly NOT marked
  // processed, so a Stripe retry will legitimately try again rather than
  // silently skipping a partially-applied event.
  const { data: existingEvent } = await supabaseAdmin
    .from('stripe_webhook_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();

  if (existingEvent) {
    return json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // Only subscription-mode checkouts are this app's concern —
        // Stage 3A never creates one-off payment sessions.
        if (session.mode === 'subscription' && session.subscription) {
          const resolvedUserId = await resolveUserId(supabaseAdmin, {
            metadataUserId: session.metadata?.supabase_user_id,
            customerId: session.customer
          });

          const checkoutAttemptId = session.metadata?.checkout_attempt_id ?? null;
          let attempt = null;
          if (checkoutAttemptId) {
            const { data: attemptRow } = await supabaseAdmin
              .from('checkout_attempts')
              .select('id, user_id, stripe_checkout_session_id, expected_stripe_price_id')
              .eq('id', checkoutAttemptId)
              .maybeSingle();
            attempt = attemptRow ?? null;
          }

          let stripeSubscription = null;
          try {
            stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
          } catch (retrieveError) {
            console.error('checkout.session.completed: failed to retrieve subscription', retrieveError.message);
          }
          const priceId = stripeSubscription?.items?.data?.[0]?.price?.id ?? null;

          let storedCustomerId = null;
          if (resolvedUserId) {
            const { data: existingRow } = await supabaseAdmin
              .from('subscriptions')
              .select('stripe_customer_id')
              .eq('user_id', resolvedUserId)
              .maybeSingle();
            storedCustomerId = existingRow?.stripe_customer_id ?? null;
          }

          // Legacy-Price Webhook Remediation — the full admission chain.
          // Every reason a brand-new subscription must be refused is
          // checked here in one place (see planMapping.ts for the exact
          // rules); critically, the price check compares against THIS
          // attempt's own immutable expected_stripe_price_id (recorded at
          // session-creation time), never the live current
          // STRIPE_PRICE_PLUS_* secrets — so a rotation between session
          // creation and completion can never break a legitimate checkout.
          const failureReason = checkoutSessionAdmissionFailureReason({
            isLivemode: event.livemode,
            resolvedUserId,
            attempt,
            session,
            stripeSubscription,
            priceId,
            storedCustomerId
          });

          if (failureReason) {
            console.error('checkout.session.completed: admission refused', failureReason, session.id);
            break;
          }

          await updateLedgerAndProjection(supabaseAdmin, resolvedUserId, stripeSubscription, session.customer, environment);
          await recordTrialUsageIfStarted(supabaseAdmin, resolvedUserId, mapStripeStatus(stripeSubscription.status));
          await consumeCheckoutAttempt(supabaseAdmin, resolvedUserId, checkoutAttemptId);
        }
        break;
      }

      // Duplicate-Subscription Remediation — releases the checkout_attempts
      // lock the moment Stripe itself considers the Checkout Session dead,
      // rather than relying solely on the lazy stripe_expires_at check
      // inside claim_checkout_attempt. No ledger/projection impact: an
      // expired session never became a subscription.
      case 'checkout.session.expired': {
        const session = event.data.object;
        await releaseExpiredCheckoutAttempt(supabaseAdmin, session.metadata?.checkout_attempt_id, session.id);
        break;
      }

      // Legacy-Price Webhook Remediation — a refund/dispute may only ever
      // affect the ONE subscription it is unambiguously for, resolved via
      // the charge's own invoice -> subscription relationship, never
      // "some subscription belonging to the same customer." Price is
      // irrelevant here (it never was checked) — what matters is that the
      // resolved subscription is already a known, admitted one.
      case 'charge.refunded':
      case 'charge.dispute.created': {
        const eventObject = event.data.object;
        const status = mapRefundOrDisputeEventToStatus(event.type);
        if (!status) {
          // Cannot happen for these two literal case labels, but never
          // guess — skip rather than write an unmapped value.
          console.warn(`${event.type}: no status mapping, skipping`);
          break;
        }

        let charge = eventObject;
        if (event.type === 'charge.dispute.created') {
          // A Dispute object carries the charge id, not the charge itself.
          const chargeId = typeof eventObject.charge === 'string' ? eventObject.charge : eventObject.charge?.id;
          if (!chargeId) {
            console.warn('charge.dispute.created: dispute has no linked charge, quarantined');
            break;
          }
          try {
            charge = await stripe.charges.retrieve(chargeId);
          } catch (retrieveError) {
            console.error('charge.dispute.created: failed to retrieve charge', retrieveError.message);
            break;
          }
        }

        const subscriptionId = await resolveSubscriptionIdForCharge(stripe, charge);

        let ledgerRow = null;
        if (subscriptionId) {
          const { data } = await supabaseAdmin
            .from('provider_subscriptions')
            .select('*')
            .eq('provider', 'stripe')
            .eq('stripe_subscription_id', subscriptionId)
            .maybeSingle();
          ledgerRow = data ?? null;
        }

        const quarantineReason = refundOrDisputeQuarantineReason(subscriptionId, ledgerRow, {
          customerId: charge.customer,
          environment
        });

        if (quarantineReason) {
          console.warn(`${event.type}: quarantined (${quarantineReason})`, subscriptionId ?? charge.id);
          break;
        }

        const { error: ledgerUpdateError } = await supabaseAdmin
          .from('provider_subscriptions')
          .update({ status, last_verified_at: new Date().toISOString() })
          .eq('id', ledgerRow.id);
        if (ledgerUpdateError) throw ledgerUpdateError;

        const { data: currentProjection, error: projectionFetchError } = await supabaseAdmin
          .from('subscriptions')
          .select('stripe_subscription_id')
          .eq('user_id', ledgerRow.user_id)
          .maybeSingle();
        if (projectionFetchError) throw projectionFetchError;

        // Update the projection only if it's currently tracking THIS exact
        // subscription — a refund/dispute for subscription A must never
        // touch a projection currently tracking a different subscription B,
        // even for the same user.
        if (currentProjection?.stripe_subscription_id === subscriptionId) {
          const { error: projectionUpdateError } = await supabaseAdmin
            .from('subscriptions')
            .update({ status })
            .eq('user_id', ledgerRow.user_id);
          if (projectionUpdateError) throw projectionUpdateError;
        }
        break;
      }

      // Legacy-Price Webhook Remediation — the core fix. A lifecycle event
      // for a subscription already present in the ledger is trusted by
      // SUBSCRIPTION IDENTITY alone, forever, regardless of its (possibly
      // long-retired) price — price is never consulted again once a
      // subscription has been admitted. An event for a subscription this
      // app has never seen is always quarantined, even on a current price:
      // only checkout.session.completed's attempt-linked chain may admit a
      // brand-new subscription.
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const stripeSubscription = event.data.object;

        const { data: ledgerRow, error: ledgerFetchError } = await supabaseAdmin
          .from('provider_subscriptions')
          .select('*')
          .eq('provider', 'stripe')
          .eq('stripe_subscription_id', stripeSubscription.id)
          .maybeSingle();
        if (ledgerFetchError) throw ledgerFetchError;

        if (!ledgerRow) {
          console.warn(`${event.type}: unknown subscription, quarantined for reconciliation`, stripeSubscription.id);
          break;
        }

        // Established user binding comes from the ledger row itself, not
        // re-resolved from this event — see planMapping.ts's
        // stripeSubscriptionIdentityMismatch: absent metadata never
        // invalidates an otherwise-matching known subscription, but a
        // metadata value that IS present and disagrees does.
        const mismatch = stripeSubscriptionIdentityMismatch(ledgerRow, {
          userId: stripeSubscription.metadata?.supabase_user_id ?? null,
          customerId: stripeSubscription.customer,
          environment
        });

        if (mismatch) {
          console.error(`${event.type}: identity mismatch (${mismatch}) for known subscription, quarantined`, stripeSubscription.id);
          break;
        }

        await updateLedgerAndProjection(supabaseAdmin, ledgerRow.user_id, stripeSubscription, stripeSubscription.customer, environment);
        break;
      }

      default:
        // Every other event type is out of this stage's scope — ack and
        // ignore, rather than erroring on events we don't need.
        break;
    }
  } catch (processingError) {
    console.error('stripe-webhook: processing failed', processingError.message);
    // Do NOT record the event id — a genuine failure should be retried
    // by Stripe, not silently treated as done.
    return json({ error: 'Webhook processing failed' }, 500);
  }

  const { error: recordError } = await supabaseAdmin
    .from('stripe_webhook_events')
    .insert({ id: event.id, type: event.type });

  if (recordError && recordError.code !== '23505') {
    // The subscription state was already written successfully above;
    // failing to record the idempotency marker is logged but not fatal
    // — worst case a genuine retry redoes the same (idempotent) upsert.
    console.error('stripe-webhook: failed to record processed event id', recordError.message);
  }

  return json({ received: true });
});

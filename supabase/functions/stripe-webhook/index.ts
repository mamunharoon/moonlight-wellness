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
import { mapStripeStatus, knownPlusPriceIds } from '../_shared/planMapping.ts';

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

// Writes the full Stripe-derived state for one user. Only ever called
// once a price id on the subscription has been confirmed to be one of
// our own known Solas Plus prices — see the isKnownPlusPrice guard at
// each call site. Sets plan='plus' unconditionally here (not
// conditionally per-status): cancellation flips `status`, not `plan`,
// exactly matching entitlements.js's own documented model, so a
// cancelled subscription correctly stays plan='plus' + status='cancelled'
// rather than being reset to plan='free'.
const applySubscriptionState = async (supabaseAdmin, userId, stripeSubscription, customerId) => {
  const firstItem = stripeSubscription.items?.data?.[0] ?? null;
  const priceId = firstItem?.price?.id ?? null;
  const status = mapStripeStatus(stripeSubscription.status);
  // current_period_end moved from the top-level Subscription object to
  // each subscription item on newer Stripe API versions — check both so
  // this works regardless of which API version the account is on.
  const periodEnd = stripeSubscription.current_period_end ?? firstItem?.current_period_end ?? null;
  const expiresAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

  const { error } = await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      plan: 'plus',
      status,
      provider: 'stripe',
      stripe_customer_id: customerId,
      stripe_subscription_id: stripeSubscription.id,
      stripe_price_id: priceId,
      expires_at: expiresAt,
      cancel_at_period_end: Boolean(stripeSubscription.cancel_at_period_end)
    },
    { onConflict: 'user_id' }
  );

  if (error) throw error;
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
          const userId = await resolveUserId(supabaseAdmin, {
            metadataUserId: session.metadata?.supabase_user_id,
            customerId: session.customer
          });

          if (!userId) {
            console.error('checkout.session.completed: could not resolve a Solas user for session', session.id);
            break;
          }

          const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
          const priceId = stripeSubscription.items?.data?.[0]?.price?.id ?? null;

          if (!priceId || !knownPlusPriceIds().includes(priceId)) {
            console.warn('checkout.session.completed: subscription price is not a known Solas Plus price, skipping', priceId);
            break;
          }

          await applySubscriptionState(supabaseAdmin, userId, stripeSubscription, session.customer);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const stripeSubscription = event.data.object;
        const priceId = stripeSubscription.items?.data?.[0]?.price?.id ?? null;

        if (!priceId || !knownPlusPriceIds().includes(priceId)) {
          console.warn(`${event.type}: subscription price is not a known Solas Plus price, skipping`, priceId);
          break;
        }

        const userId = await resolveUserId(supabaseAdmin, {
          metadataUserId: stripeSubscription.metadata?.supabase_user_id,
          subscriptionId: stripeSubscription.id,
          customerId: stripeSubscription.customer
        });

        if (!userId) {
          console.error(`${event.type}: could not resolve a Solas user for subscription`, stripeSubscription.id);
          break;
        }

        await applySubscriptionState(supabaseAdmin, userId, stripeSubscription, stripeSubscription.customer);
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

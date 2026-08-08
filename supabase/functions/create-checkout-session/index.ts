// Sprint 2 Stage 3A — create-checkout-session
//
// The only thing the browser ever sends here is a billing `interval`
// choice ('monthly' | 'yearly') — never a price id, plan, or status.
// This function verifies the caller's identity server-side from their
// JWT (never trusts a client-supplied user id), rejects guests, and
// writes only `stripe_customer_id` (an identifier, not an entitlement).
// It never sets plan/status/provider — see stripe-webhook/index.ts,
// the only code path in this app allowed to do that.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';
import { getStripeClient } from '../_shared/stripeClient.ts';
import { priceIdForInterval } from '../_shared/planMapping.ts';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

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
  // this app's Supabase calls already use.
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
    // no body / invalid JSON -> falls through to the interval check below
  }

  const priceId = priceIdForInterval(body?.interval);
  if (!priceId) {
    return json({ error: 'Invalid or unconfigured billing interval' }, 400);
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: existingRow, error: fetchError } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    console.error('create-checkout-session: failed to read subscriptions row', fetchError.message);
    return json({ error: 'Could not start checkout. Please try again.' }, 500);
  }

  let customerId = existingRow?.stripe_customer_id ?? null;

  try {
    const stripe = getStripeClient();

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
        return json({ error: 'Could not start checkout. Please try again.' }, 500);
      }
    }

    const origin = req.headers.get('Origin') ?? new URL(req.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/subscription?checkout=success`,
      cancel_url: `${origin}/subscription?checkout=cancelled`,
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } }
    });

    return json({ url: session.url });
  } catch (stripeError) {
    console.error('create-checkout-session: Stripe API call failed', stripeError.message);
    return json({ error: 'Could not start checkout. Please try again.' }, 500);
  }
});

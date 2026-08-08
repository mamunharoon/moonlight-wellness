// Sprint 2 Stage 3A — create-portal-session
//
// Replaces the old "Restore purchases" placeholder's job with the
// correct web equivalent: a hosted Stripe Billing Portal session for
// viewing/cancelling/managing an existing Stripe subscription. Same
// identity verification as create-checkout-session — never trusts a
// client-supplied user id, only ever looks up the caller's own row.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';
import { getStripeClient } from '../_shared/stripeClient.ts';

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

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return json({ error: 'Sign in required' }, 401);
  }
  const user = userData.user;

  if (user.is_anonymous) {
    return json({ error: 'Please sign in or create an account first.' }, 403);
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: row, error: fetchError } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    console.error('create-portal-session: failed to read subscriptions row', fetchError.message);
    return json({ error: 'Could not open billing management. Please try again.' }, 500);
  }

  if (!row?.stripe_customer_id) {
    return json({ error: 'No billing account found for this user yet.' }, 400);
  }

  const origin = req.headers.get('Origin') ?? new URL(req.url).origin;

  try {
    const stripe = getStripeClient();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${origin}/subscription`
    });

    return json({ url: portalSession.url });
  } catch (stripeError) {
    console.error('create-portal-session: Stripe API call failed', stripeError.message);
    return json({ error: 'Could not open billing management. Please try again.' }, 500);
  }
});

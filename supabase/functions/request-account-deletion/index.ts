// Safe Account Management and Account Deletion — request-account-deletion
//
// The only thing this function ever writes is a row in
// public.account_deletion_requests with status='pending'. It never calls
// supabase.auth.admin.deleteUser(), never touches profiles/rhythms/
// journal_entries/user_intentions/subscriptions, and never talks to
// Stripe. Permanent processing stays a separate, manual, documented step
// (see docs/account-deletion-processor-spec.md) — this function only
// starts the clock on a cancellable request.
//
// Same identity-verification shape as create-checkout-session/
// create-portal-session: the caller's JWT is verified server-side against
// Supabase Auth itself, never trusted from a client-supplied id, and
// guests (anonymous sessions) are rejected outright.
//
// Password handling: `password` arrives once, in this one POST body, over
// TLS. It is used exactly once here — passed straight to Supabase Auth's
// own signInWithPassword to re-verify the caller's identity "right now"
// (recent authentication) — and is never written to a log, a table, or
// anywhere else. It falls out of scope when this function returns.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';

const CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';
const GRACE_PERIOD_DAYS = 7;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

// Never returns raw plan/status/provider to the client response — only a
// short, non-sensitive classification, matching "generic error messages
// / audit details that do not expose sensitive data."
const classifyBillingStatus = (row) => {
  if (!row) return 'none';
  const activePlus = row.plan === 'plus' && ['trial', 'active'].includes(row.status);
  if (!activePlus) return 'none';
  return row.provider === 'stripe' ? 'active-stripe' : 'active-manual';
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
  const user = userData.user;

  if (user.is_anonymous) {
    return json({ error: 'Please sign in or create an account first.' }, 403);
  }
  if (!user.email) {
    return json({ error: 'Could not verify this account. Please try again.' }, 400);
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const password = typeof body?.password === 'string' ? body.password : '';
  const confirmationPhrase = typeof body?.confirmationPhrase === 'string' ? body.confirmationPhrase : '';

  // Server-side re-check of the exact phrase — the disabled-until-exact-
  // match button on the client is a UX affordance, never the real gate.
  if (confirmationPhrase !== CONFIRMATION_PHRASE) {
    return json({ error: 'Confirmation phrase does not match.' }, 400);
  }
  if (!password) {
    return json({ error: 'Password is required.' }, 400);
  }

  // Recent authentication: the authoritative check. A client-side
  // pre-check happens too (see DeleteAccount.jsx), but this is the one
  // that actually gates the write below — a stolen, merely-valid session
  // token is not enough on its own.
  const { error: reauthError } = await authClient.auth.signInWithPassword({
    email: user.email,
    password
  });
  if (reauthError) {
    return json({ error: 'The password you entered is incorrect.' }, 401);
  }

  const supabaseAdmin = createSupabaseAdminClient();

  // Billing status checked server-side, from the same table the webhook
  // itself writes — never from anything the client asserts.
  const { data: subscriptionRow, error: billingError } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status, provider')
    .eq('user_id', user.id)
    .maybeSingle();

  if (billingError) {
    console.error('request-account-deletion: failed to read billing status', billingError.message);
    return json({ error: "We couldn't verify your billing status. Please try again." }, 503);
  }

  const billingStatusAtRequest = classifyBillingStatus(subscriptionRow);

  // Idempotency: an existing pending request is returned as-is rather
  // than duplicated. Checked after identity/reauth so every call is
  // still fully authenticated, whether or not it ends up writing a row.
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('account_deletion_requests')
    .select('status, requested_at, scheduled_for, billing_status_at_request')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingError) {
    console.error('request-account-deletion: failed to check existing request', existingError.message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }

  if (existing) {
    return json({
      status: existing.status,
      requestedAt: existing.requested_at,
      scheduledFor: existing.scheduled_for,
      billingStatusAtRequest: existing.billing_status_at_request
    });
  }

  const requestedAt = new Date();
  const scheduledFor = new Date(requestedAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('account_deletion_requests')
    .insert({
      user_id: user.id,
      status: 'pending',
      requested_at: requestedAt.toISOString(),
      scheduled_for: scheduledFor.toISOString(),
      billing_status_at_request: billingStatusAtRequest
    })
    .select('status, requested_at, scheduled_for, billing_status_at_request')
    .single();

  if (insertError) {
    // 23505 = unique_violation on the "one pending request per user"
    // partial index — a genuine concurrent double-submit race. Treat it
    // the same as the idempotent-return path above rather than erroring.
    if (insertError.code === '23505') {
      const { data: raceWinner } = await supabaseAdmin
        .from('account_deletion_requests')
        .select('status, requested_at, scheduled_for, billing_status_at_request')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();
      if (raceWinner) {
        return json({
          status: raceWinner.status,
          requestedAt: raceWinner.requested_at,
          scheduledFor: raceWinner.scheduled_for,
          billingStatusAtRequest: raceWinner.billing_status_at_request
        });
      }
    }
    console.error('request-account-deletion: failed to insert request', insertError.message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }

  return json({
    status: inserted.status,
    requestedAt: inserted.requested_at,
    scheduledFor: inserted.scheduled_for,
    billingStatusAtRequest: inserted.billing_status_at_request
  });
});

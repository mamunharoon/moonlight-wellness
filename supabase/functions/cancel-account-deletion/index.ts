// Safe Account Management and Account Deletion — cancel-account-deletion
//
// The only write this function ever makes is flipping the caller's own
// pending account_deletion_requests row to status='cancelled'. Same
// identity verification as request-account-deletion — never trusts a
// client-supplied user id or request id, only ever acts on "the caller's
// own current pending request," found server-side.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';

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

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('account_deletion_requests')
    .select('id, status, scheduled_for')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (fetchError) {
    console.error('cancel-account-deletion: failed to read request', fetchError.message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }

  // Blocks cancellation once the grace period has elapsed, even if a
  // (future, manual) processor run hasn't picked the row up yet — "safe"
  // over "convenient": once the deadline has passed, the request is
  // treated as no longer cancellable rather than silently still open.
  if (!existing || new Date(existing.scheduled_for) <= new Date()) {
    return json({ error: 'No cancellable deletion request found.' }, 400);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from('account_deletion_requests')
    // updated_at has a DEFAULT now() on the table, but defaults only
    // apply at INSERT — an UPDATE must set it explicitly or it goes
    // stale (confirmed live: it stayed at the original insert time
    // after this cancel until this fix).
    .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
    .eq('id', existing.id)
    .eq('user_id', user.id)
    .eq('status', 'pending');

  if (updateError) {
    console.error('cancel-account-deletion: failed to update request', updateError.message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }

  return json({ status: 'cancelled' });
});

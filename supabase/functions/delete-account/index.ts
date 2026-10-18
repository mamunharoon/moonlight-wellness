// Immediate Account Deletion — delete-account
//
// Replaces the UI's old "request deletion, wait 7 days, a manual
// operator completes it" flow (request-account-deletion/
// cancel-account-deletion, both left on disk unchanged — see this
// function's own commit for the reconciliation rationale) with real,
// immediate, server-side deletion in a single call: cancel any active
// Stripe subscription, delete every user-owned row, then remove the
// Supabase Auth user itself. All of the actual decision logic lives in
// the pure, dependency-injected resolveAccountDeletionRequest
// (../_shared/accountDeletion.ts) — this file only supplies real
// Supabase/Stripe implementations and translates its outcome into an
// HTTP response.
//
// Same identity-verification shape as request-account-deletion: the
// caller's JWT is verified server-side against Supabase Auth itself,
// never trusted from a client-supplied id; guests are rejected. Password
// handling is identical too — arrives once, over TLS, used only to
// re-verify identity via signInWithPassword, never logged or stored.
//
// request-account-deletion and cancel-account-deletion are NOT removed,
// deprecated in code, or altered by this change — they still work
// exactly as before for any pre-existing 'pending' row from the old
// model. This function's own getExistingRequestRow (below) is what
// reconciles the two models: it looks up ANY row already in
// ('pending', 'processing') for this user and reuses it (see
// accountDeletion.ts's own header for why), so a user who still has an
// old 7-day request outstanding and now uses this immediate flow
// instead has that exact row carried through to 'completed' — never
// orphaned, never duplicated.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';
import { getStripeClient } from '../_shared/stripeClient.ts';
import {
  resolveAccountDeletionRequest,
  deleteUserOwnedRowsInOrder,
  isAlreadyCancelledStripeError,
  isUserAlreadyDeletedError
} from '../_shared/accountDeletion.ts';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

// Never echoes internal detail (table name, Postgres/Stripe error text)
// back to the caller — only this short, non-sensitive map. Every branch
// is explicit so a new, unmapped outcome fails loudly in review rather
// than silently falling through to a wrong status.
const OUTCOME_RESPONSES = {
  unauthenticated: [401, { error: 'Sign in required' }],
  guest_blocked: [403, { error: 'Please sign in or create an account first.' }],
  no_email: [400, { error: 'Could not verify this account. Please try again.' }],
  phrase_mismatch: [400, { error: 'Confirmation phrase does not match.' }],
  password_required: [400, { error: 'Password is required.' }],
  reauth_failed: [401, { error: 'The password you entered is incorrect.' }],
  already_deleted: [200, { status: 'deleted' }],
  // Genuinely untouched at these three outcomes — nothing is written
  // until AFTER the billing read these two themselves guard. "Your
  // account has not been deleted" is literally accurate here.
  request_lookup_failed: [503, { error: "We couldn't verify your account right now. Please try again." }],
  billing_check_failed: [503, { error: "We couldn't verify your billing status. Please try again." }],
  request_lock_failed: [503, { error: 'Something went wrong starting deletion. Please try again.' }],
  // Still genuinely untouched: this is the step immediately before any
  // data table is ever read for deletion (see accountDeletion.ts's own
  // per-outcome breakdown in its header) — "has not been deleted" is
  // accurate here too.
  stripe_cancel_failed: [503, { error: "We couldn't finish cancelling your subscription. Your account has not been deleted. Please try again." }],
  // NOT "fully intact" - deliberately does not claim it. By this point
  // some of this account's data may already be genuinely, irreversibly
  // deleted (deleteUserOwnedRows failed partway through its own table
  // loop - see accountDeletion.ts's header for exactly what that can
  // mean). The only honest message is "this isn't finished and must be
  // finished" - never anything implying it's safe to simply walk away.
  data_delete_failed: [503, { error: "Deleting your account did not finish and your data may be partially deleted. Please try again to finish deleting it." }],
  // The most advanced partial state: all user-owned data (including the
  // profile) is already confirmed gone - only removing the sign-in
  // credential itself failed. Same "must finish, cannot be left as-is"
  // framing, never "intact".
  auth_delete_failed: [503, { error: "Your data was deleted but removing your account itself did not finish. Please try again to finish deleting it." }],
  deleted: [200, { status: 'deleted' }]
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

  let body = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const password = typeof body?.password === 'string' ? body.password : '';
  const confirmationPhrase = typeof body?.confirmationPhrase === 'string' ? body.confirmationPhrase : '';

  const supabaseAdmin = createSupabaseAdminClient();

  const result = await resolveAccountDeletionRequest(
    { user, password, confirmationPhrase },
    {
      reauthenticate: async (email, pwd) => {
        const { error } = await authClient.auth.signInWithPassword({ email, password: pwd });
        return { error };
      },

      getBillingRow: async () => {
        const { data, error } = await supabaseAdmin
          .from('subscriptions')
          .select('plan, status, provider, stripe_customer_id, stripe_subscription_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) console.error('delete-account: failed to read billing status', error.message);
        return { data, error };
      },

      // Only an OLD-model row still unresolved — 'pending' (never
      // cancelled, never completed) or 'processing' (a prior immediate-
      // deletion attempt that died partway) — is ever reused. A
      // 'cancelled'/'completed' row is resolved history and must never
      // be reopened by a fresh request.
      getExistingRequestRow: async () => {
        const { data, error } = await supabaseAdmin
          .from('account_deletion_requests')
          .select('id, status')
          .eq('user_id', user.id)
          .in('status', ['pending', 'processing'])
          .order('requested_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) console.error('delete-account: failed to read existing request', error.message);
        return { data, error };
      },

      upsertProcessingRow: async ({ existingId, billingStatusAtRequest }) => {
        const nowIso = new Date().toISOString();
        if (existingId) {
          // Carries the old model's row forward rather than creating a
          // second one — see accountDeletion.ts's own header. The WHERE
          // clause only ever matches a row still in ('pending',
          // 'processing') (the same set this was looked up from a
          // moment ago), so a concurrent cancel-account-deletion call
          // racing to move it to 'cancelled' loses cleanly (this UPDATE
          // simply matches zero rows) rather than reviving a row the
          // user just cancelled.
          const { data, error } = await supabaseAdmin
            .from('account_deletion_requests')
            .update({ status: 'processing', billing_status_at_request: billingStatusAtRequest, updated_at: nowIso })
            .eq('id', existingId)
            .in('status', ['pending', 'processing'])
            .select('id')
            .maybeSingle();
          if (error) console.error('delete-account: failed to update existing request to processing', error.message);
          return { data, error };
        }
        // Immediate model: scheduled_for is set to the same instant as
        // requested_at — there is no future date to wait for anymore.
        // The column is kept (not migrated away) so this table's
        // existing NOT NULL constraint, RLS policy, and every other
        // reader of it (getMyDeletionRequest, the account-admin
        // runbook) continue to work unchanged.
        const { data, error } = await supabaseAdmin
          .from('account_deletion_requests')
          .insert({
            user_id: user.id,
            status: 'processing',
            requested_at: nowIso,
            scheduled_for: nowIso,
            billing_status_at_request: billingStatusAtRequest
          })
          .select('id')
          .single();
        if (error) console.error('delete-account: failed to create processing request', error.message);
        return { data, error };
      },

      cancelStripeSubscriptionIfActive: async (billingRow) => {
        if (!billingRow?.provider || billingRow.provider !== 'stripe' || !billingRow.stripe_subscription_id) {
          return { error: null };
        }
        if (!['trial', 'active'].includes(billingRow.status)) {
          return { error: null };
        }
        try {
          const stripe = getStripeClient();
          // cancel_at_period_end, matching the in-app copy already shown
          // to the user before they confirm: no refund for the current
          // period, access/billing simply stops renewing. Immediate
          // cancellation (ending the Stripe subscription right now) was
          // deliberately NOT chosen here, for the same "no refund
          // implied" reasoning request-account-deletion's own comment
          // already documents — only the owner/legal-reviewed copy, not
          // this task, decides that trade-off.
          await stripe.subscriptions.update(billingRow.stripe_subscription_id, { cancel_at_period_end: true });
          return { error: null };
        } catch (err) {
          // Idempotent: a subscription already cancelled, or no longer
          // found in Stripe at all (a retry after a prior attempt's
          // cancellation already succeeded, or Stripe's own test-mode
          // data was reset), is treated as success — never a new
          // failure for the exact same reason this whole module treats
          // every step as idempotent (see accountDeletion.ts's header).
          // isAlreadyCancelledStripeError is a pure, duck-typed check
          // (not instanceof Stripe.errors.StripeError) specifically so
          // it's directly testable with a plain fake error object - see
          // its own comment in accountDeletion.ts for why.
          if (isAlreadyCancelledStripeError(err)) {
            return { error: null };
          }
          console.error('delete-account: failed to cancel Stripe subscription', err?.message);
          return { error: err };
        }
      },

      // deleteUserOwnedRowsInOrder (accountDeletion.ts) owns the actual
      // order/stop-on-first-failure logic - this supplies only the real
      // Supabase delete call per table, and logs which one failed
      // (never echoed to the caller - see OUTCOME_RESPONSES's own
      // header).
      deleteUserOwnedRows: async () => {
        const { error, failedTable } = await deleteUserOwnedRowsInOrder(
          async (table, filterColumn) => supabaseAdmin.from(table).delete().eq(filterColumn, user.id)
        );
        if (error) console.error(`delete-account: failed to delete from ${failedTable}`, error.message);
        return { error };
      },

      deleteAuthUser: async () => {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        // Idempotent: a retry after a prior attempt's own deleteUser()
        // call already succeeded (but a later step, or just the
        // response, was lost) finds the user already gone — GoTrue
        // reports this as a "not found"-shaped error, treated as
        // success rather than a new failure. isUserAlreadyDeletedError
        // is directly tested in accountDeletion.test.js.
        if (error && !isUserAlreadyDeletedError(error)) {
          console.error('delete-account: failed to delete Auth user', error.message);
          return { error };
        }
        return { error: null };
      },

      markRequestCompleted: async (requestId) => {
        const nowIso = new Date().toISOString();
        const { error } = await supabaseAdmin
          .from('account_deletion_requests')
          // user_id is already NULL here — the Auth user's own
          // ON DELETE SET NULL already ran as part of deleteAuthUser()
          // above, the instant that row's FK target vanished.
          .update({ status: 'completed', completed_at: nowIso, updated_at: nowIso })
          .eq('id', requestId);
        if (error) console.error('delete-account: failed to record completion (account is still deleted)', error.message);
        return { error };
      }
    }
  );

  const [status, responseBody] = OUTCOME_RESPONSES[result.outcome] ?? [500, { error: 'Something went wrong. Please try again.' }];
  return json(responseBody, status);
});

// Safe Account Management and Account Deletion — client-side API layer.
//
// Same shape as stripeApi.js: thin, unauthoritative wrappers around
// supabase.functions.invoke (which attaches the current session's access
// token automatically) and a direct, RLS-protected table read. Nothing
// here enforces anything — request-account-deletion/cancel-account-
// deletion (Edge Functions, service-role) are the real authority, exactly
// like create-checkout-session/create-portal-session already are for
// billing.
//
// getMyDeletionRequest() reads public.account_deletion_requests directly
// (RLS: select-own only, see the migration) rather than through an Edge
// Function — this table does not exist on the live database yet (see the
// Phase 5 migration proposal, awaiting owner approval), so this always
// resolves to `null` today via the same isMissingTableError pattern
// SubscriptionContext.jsx already established for exactly this situation
// (migration written, not yet applied). Once the migration is approved
// and applied, this starts working with no code change needed here.
import { supabase } from './supabaseClient';

const isMissingTableError = (fetchError) =>
  fetchError?.code === '42P01' ||
  /relation .* does not exist|could not find the table/i.test(fetchError?.message ?? '');

export const getMyDeletionRequest = async (userId) => {
  if (!supabase || !userId) return { request: null, error: null };

  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('id, status, requested_at, scheduled_for, cancelled_at, completed_at, billing_status_at_request')
    .eq('user_id', userId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      console.warn('account_deletion_requests table not yet provisioned — deletion status unavailable.');
      return { request: null, error: null };
    }
    console.error('getMyDeletionRequest: failed to read request', error.message);
    return { request: null, error: "We couldn't check your deletion request status. Please try again." };
  }

  return { request: data ?? null, error: null };
};

// Reads the caller's own live billing snapshot directly from the
// subscriptions table — deliberately NOT through useSubscription()/
// getEntitlements(), which apply the DEV-only plan override (see
// subscriptionOverride.js). The deletion journey's Step 2 must show the
// same truthful state the server itself will check at submission time,
// never a locally-forced dev value.
export const getMyBillingSnapshot = async (userId) => {
  if (!supabase || !userId) return { subscription: null, error: null };

  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, status, provider, cancel_at_period_end, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('getMyBillingSnapshot: failed to read subscription', error.message);
    return { subscription: null, error: "We couldn't verify your billing status. Please try again." };
  }

  return { subscription: data ?? { plan: 'free', status: 'active', provider: 'manual' }, error: null };
};

// Immediate Account Deletion — replaces the UI's old "submit, wait 7
// days, a manual operator completes it" call (requestAccountDeletion,
// below — kept, unused by DeleteAccount.jsx now, see its own header).
// A 200 response here means the account and its data are genuinely,
// irreversibly gone server-side already (see delete-account/index.ts's
// own header for the exact order of operations) — never a "request
// accepted" acknowledgement. Any error thrown here means NOTHING was
// deleted (an early validation/auth failure) or the attempt is safely
// resumable (see that function's own partial-failure outcomes) — the
// caller must never treat a thrown error as a partial success.
export const deleteAccountNow = async ({ password, confirmationPhrase }) => {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { password, confirmationPhrase }
  });
  if (error) {
    // Same unwrapping as stripeApi.js's own startCheckout — surfaces the
    // Edge Function's real, specific message (e.g. "...your account has
    // not been deleted yet. Please try again.") rather than a generic
    // "Edge Function returned a non-2xx status code", so a retry-safe
    // failure actually reads as retry-safe to the person seeing it.
    let payload = null;
    try {
      payload = await error.context?.json?.();
    } catch {
      // Body wasn't JSON, or already consumed — fall through with no payload.
    }
    throw new Error(payload?.error || error.message);
  }
  return data;
};

// Kept for the old 7-day model's own still-cancellable requests only
// (see request-account-deletion/index.ts's own header) — DeleteAccount.jsx
// no longer calls this for a NEW request; deleteAccountNow above is the
// only path a fresh "Request account deletion" tap reaches.
export const requestAccountDeletion = async ({ password, confirmationPhrase }) => {
  const { data, error } = await supabase.functions.invoke('request-account-deletion', {
    body: { password, confirmationPhrase }
  });
  if (error) throw error;
  return data;
};

// Still fully functional for an existing 'pending' row carried over from
// the old model — see cancel-account-deletion/index.ts, untouched by
// this change.
export const cancelAccountDeletion = async () => {
  const { data, error } = await supabase.functions.invoke('cancel-account-deletion');
  if (error) throw error;
  return data;
};

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

export const requestAccountDeletion = async ({ password, confirmationPhrase }) => {
  const { data, error } = await supabase.functions.invoke('request-account-deletion', {
    body: { password, confirmationPhrase }
  });
  if (error) throw error;
  return data;
};

export const cancelAccountDeletion = async () => {
  const { data, error } = await supabase.functions.invoke('cancel-account-deletion');
  if (error) throw error;
  return data;
};

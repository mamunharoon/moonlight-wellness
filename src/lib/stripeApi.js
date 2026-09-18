// Subscription Model, Sprint 2 Stage 3A — Stripe (test mode) client layer.
//
// Both functions call a Supabase Edge Function via supabase.functions.invoke,
// the same pattern adminApi.js already uses for supabase.rpc(): the shared
// `supabase` client attaches the current session's access token
// automatically, so there is no accessToken parameter to thread through
// here. The Edge Function is what actually verifies that token server-side
// (see supabase/functions/create-checkout-session/index.ts) — this file
// does not and cannot enforce anything; it is a thin, unauthoritative
// wrapper around a redirect URL.
import { supabase } from './supabaseClient';

// Duplicate-Subscription Remediation — client_attempt_id is generated
// fresh on every call. This codebase has no automatic client-side retry
// of a failed request (a failure just re-enables the Upgrade button for
// the user to click again — see Subscription.jsx's startCheckoutFlow), so
// every actual invocation of this function already IS a new logical
// attempt; there is no "same request, retried" case on the client side
// that would need to reuse an id. A true double-click race (two
// invocations before React disables the button) is handled safely
// server-side regardless of the two ids differing — see
// create-checkout-session/index.ts's claim_checkout_attempt usage, which
// only ever allows one of them to proceed.
export const startCheckout = async (interval) => {
  const clientAttemptId = crypto.randomUUID();
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { interval, client_attempt_id: clientAttemptId }
  });
  if (error) {
    // Surface the Edge Function's structured error body (code, and a
    // resumable checkout_url where one exists) when the platform makes it
    // available, so the caller can show a specific message rather than a
    // generic failure — never required, since the response body isn't
    // always readable depending on the failure shape, but always attempted.
    let payload = null;
    try {
      payload = await error.context?.json?.();
    } catch {
      // Body wasn't JSON, or already consumed — fall through with no payload.
    }
    const wrapped = new Error(payload?.error || error.message);
    wrapped.code = payload?.code ?? null;
    wrapped.checkoutUrl = payload?.checkout_url ?? null;
    throw wrapped;
  }
  if (!data?.url) throw new Error('No checkout URL returned');
  window.location.href = data.url;
};

export const openBillingPortal = async () => {
  const { data, error } = await supabase.functions.invoke('create-portal-session');
  if (error) throw error;
  if (!data?.url) throw new Error('No billing portal URL returned');
  window.location.href = data.url;
};

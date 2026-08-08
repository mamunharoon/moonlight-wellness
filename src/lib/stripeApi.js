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

export const startCheckout = async (interval) => {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { interval }
  });
  if (error) throw error;
  if (!data?.url) throw new Error('No checkout URL returned');
  window.location.href = data.url;
};

export const openBillingPortal = async () => {
  const { data, error } = await supabase.functions.invoke('create-portal-session');
  if (error) throw error;
  if (!data?.url) throw new Error('No billing portal URL returned');
  window.location.href = data.url;
};

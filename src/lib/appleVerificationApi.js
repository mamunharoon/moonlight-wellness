// WakeWise — client wrapper for the verify-apple-transaction Edge
// Function (Apple Subscription Architecture task, Phase C). Same thin,
// unauthoritative shape as stripeApi.js: this file does not and cannot
// enforce anything — supabase.functions.invoke attaches the current
// session's access token automatically, and the Edge Function itself is
// the only place identity/eligibility is actually decided.
//
// Never logs the jwsRepresentation or transactionId it sends — those
// stay inside the request body only.
import { supabase } from './supabaseClient';

/**
 * Sends a just-completed (client-side, StoreKit-confirmed but NOT yet
 * server-verified) purchase to the server for real verification. Always
 * resolves — never throws for an expected "not verified yet" response,
 * since that is the correct, honest outcome while Phase C's server-side
 * verification remains a stub (see
 * supabase/functions/verify-apple-transaction/index.ts). Only a genuine
 * network/invoke failure rejects.
 */
export const verifyAppleTransaction = async ({ transactionId, productIdentifier, jwsRepresentation }) => {
  const { data, error } = await supabase.functions.invoke('verify-apple-transaction', {
    body: { transactionId, productIdentifier, jwsRepresentation }
  });
  if (error) throw error;
  return data ?? { verified: false, reason: 'no_response' };
};

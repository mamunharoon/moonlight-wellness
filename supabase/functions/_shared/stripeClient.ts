// Sprint 2 Stage 3A/3B — lazy Stripe client factory.
//
// Deliberately NOT constructed at module top-level: the Stripe SDK
// throws synchronously if the API key is empty, and a top-level throw
// during module evaluation crashes the entire Edge Function at cold
// start — before any request is even handled, and before any of this
// file's own try/catch blocks can run. Deferring construction into the
// request path means "STRIPE_SECRET_KEY not configured yet" fails one
// request cleanly (a catchable Error, turned into a normal JSON error
// response by the caller) instead of taking the whole function down.
import Stripe from 'npm:stripe@17.4.0';

export const getStripeClient = () => {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
};

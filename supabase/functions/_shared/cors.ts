// Sprint 2 Stage 3A — shared CORS headers for the browser-facing Edge
// Functions (create-checkout-session, create-portal-session). The
// stripe-webhook function is never called from a browser (Stripe's
// servers call it directly) and does not need this.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

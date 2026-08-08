// Sprint 2 Stage 3A — service-role Supabase client factory.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected into every
// Supabase Edge Function's environment by the platform itself — nothing
// to set manually via `supabase secrets set` for these two.
//
// This client bypasses RLS by default (service role), exactly the
// "trusted process" the Stage 1 subscriptions migration already
// anticipated as the only writer of plan/status/provider. Every caller
// of this factory is expected to have already independently verified
// caller identity (JWT verification for the two authenticated functions,
// Stripe-Signature verification for the webhook) before using it — this
// client itself enforces nothing.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const createSupabaseAdminClient = () =>
  createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

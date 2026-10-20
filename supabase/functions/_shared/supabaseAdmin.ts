// Sprint 2 Stage 3A — service-role Supabase client factory.
//
// SUPABASE_URL, SUPABASE_SECRET_KEYS and SUPABASE_PUBLISHABLE_KEYS are
// auto-injected into every Supabase Edge Function's environment by the
// platform itself — nothing to set manually via `supabase secrets set`
// for these three. Migrated off the legacy SUPABASE_SERVICE_ROLE_KEY/
// SUPABASE_ANON_KEY (still auto-injected too, but no longer read here) —
// DEV service-role key exposure remediation, see tracker SEC-07/E-37.
// SUPABASE_SECRET_KEYS/SUPABASE_PUBLISHABLE_KEYS are each a JSON object
// keyed by name; this project uses only the 'default' key of each.
//
// This client bypasses RLS by default (service role), exactly the
// "trusted process" the Stage 1 subscriptions migration already
// anticipated as the only writer of plan/status/provider. Every caller
// of this factory is expected to have already independently verified
// caller identity (JWT verification for the two authenticated functions,
// Stripe-Signature verification for the webhook) before using it — this
// client itself enforces nothing.
import { createClient } from 'npm:@supabase/supabase-js@2';

const resolveNamedKey = (rawJson: string | undefined, name = 'default'): string => {
  if (!rawJson) return '';
  try {
    const parsed = JSON.parse(rawJson);
    return typeof parsed?.[name] === 'string' ? parsed[name] : '';
  } catch {
    return '';
  }
};

export const createSupabaseAdminClient = () =>
  createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    resolveNamedKey(Deno.env.get('SUPABASE_SECRET_KEYS')),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

// Low-privilege client used only to verify a caller's own session JWT via
// .auth.getUser(jwt) — the new-key equivalent of every authClient
// previously built inline with Deno.env.get('SUPABASE_ANON_KEY'). Takes
// the same constructor options shape as createClient's third argument so
// get-pilot-video-url's own extra `global.headers.Authorization` override
// keeps working unchanged.
export const createSupabaseAuthClient = (options?: Record<string, unknown>) =>
  createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    resolveNamedKey(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')),
    options
  );

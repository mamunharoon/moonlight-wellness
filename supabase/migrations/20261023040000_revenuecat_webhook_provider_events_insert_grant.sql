-- RevenueCat webhook — the one missing service_role grant it actually
-- needs: INSERT on public.provider_events.
--
-- ROOT CAUSE (2026-10-23 production incident, traced and reproduced
-- directly against wqpszprbuqdjcfmdqdlv, not assumed): service_role has
-- never held SELECT/INSERT/UPDATE/DELETE on provider_events,
-- provider_subscriptions, or entitlements on production — only the
-- inert REFERENCES/TRIGGER/TRUNCATE privileges, confirmed live via
-- information_schema.role_table_grants. Every revenuecat-webhook call
-- that reaches `supabaseAdmin.from('provider_events').insert(...)` fails
-- with 42501 (permission denied) — reproduced with a real RevenueCat
-- TEST event, byte-identical to the reported 500 "Failed to record
-- event".
--
-- WHY ONLY THIS ONE GRANT — traced directly from the deployed code,
-- not copied from DEV:
--   - supabase/functions/revenuecat-webhook/index.ts performs exactly
--     two Supabase operations: `.from('provider_events').insert(row)`
--     (four call sites in revenueCatWebhookHandler.js, all INSERT only
--     — no .select()/.update()/.delete() anywhere in this function) and
--     `.rpc('apply_verified_apple_subscription_event' |
--     'apply_verified_google_subscription_event', args)`.
--   - Both RPCs are owned by `postgres` and SECURITY DEFINER (confirmed
--     live: prosecdef = true, proowner = postgres) — every INSERT/UPDATE
--     they perform on provider_subscriptions, entitlements, and
--     provider_events (their own internal idempotent event-recording
--     insert, a SEPARATE insert from the Edge Function's own direct one
--     above) runs with the FUNCTION OWNER's privileges, not the
--     caller's. service_role therefore needs EXECUTE on these RPCs
--     (already granted, confirmed unaffected by this migration) and
--     NOTHING directly on provider_subscriptions or entitlements for
--     revenuecat-webhook to work — it never queries those tables
--     itself.
--   - DEV's service_role holds full SELECT/INSERT/UPDATE/DELETE on all
--     three tables — that grant set serves DEV's own broader tooling
--     (diagnostic harnesses, ad hoc debugging scripts), not what this
--     specific, currently-deployed function needs. Copying it wholesale
--     to production would grant direct table access this function never
--     uses and this migration deliberately does not request.
--
-- SCOPE: this migration touches service_role's grants on
-- provider_events ONLY. PUBLIC/anon/authenticated are not touched (they
-- already have, and keep, zero grants on this table — confirmed live,
-- RLS stays enabled with its existing zero policies, unchanged).
-- provider_subscriptions and entitlements are not touched at all — no
-- grant is added there, because none is needed.
--
-- Reversible: see the paired rollback file.

BEGIN;

GRANT INSERT ON public.provider_events TO service_role;

COMMIT;

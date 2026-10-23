-- Restore authenticated's SELECT on subscriptions (legacy Stripe/manual
-- table) on production.
--
-- ROOT CAUSE (2026-10-23 production incident, traced and reproduced
-- directly against wqpszprbuqdjcfmdqdlv, not assumed): same class of gap
-- as 20261023050000/20261023060000 - this table was created via a raw SQL
-- migration (20260808150000_sprint2_stage3a_stripe_foundation.sql), which
-- never issued an explicit GRANT, wrongly relying on Supabase's
-- Dashboard-only default privileges. authenticated has therefore never
-- held SELECT on this table on production, while DEV's own table (traced
-- back to the same Dashboard-created-table lineage as profiles/rhythms)
-- has the full set.
--
-- Traced from the actual failing read, not assumed:
-- src/lib/entitlementSnapshot.js's fetchEntitlementRecords() reads
-- `subscriptions` (alongside provider_subscriptions) to resolve the
-- unified entitlement every premium-gated screen (Stretch/Breathe/
-- Meditation video rows, via useProtectedVideo's resolvePremiumGate)
-- depends on. Reproduced directly: `SET LOCAL ROLE authenticated; SELECT
-- * FROM subscriptions ...` returns `42501: permission denied for table
-- subscriptions`, with Postgres's own hint naming exactly this fix. The
-- resulting entitlement-read error resolves to
-- ENTITLEMENT_STATES.VERIFICATION_UNAVAILABLE (entitlementResolver.js),
-- not a thrown exception - traced precisely so this migration's effect
-- can be validated against the real downstream state, not guessed.
--
-- SAFETY, confirmed live before writing this migration, not assumed:
--   - RLS is enabled on subscriptions.
--   - subscriptions_select_own (qual auth.uid() = user_id) is the ONLY
--     policy on this table at all - authenticated only, no permissive
--     clause, and no INSERT/UPDATE/DELETE policy exists (this table is
--     written only via admin_set_subscription_status() and the Stripe
--     webhook, both SECURITY DEFINER / service-role paths - never
--     directly by an authenticated client). This grant only unlocks what
--     RLS already correctly restricts to each row's own owner.
--   - PUBLIC/anon are untouched - grant to authenticated only.
--   - Table-level SELECT only - no column-level restriction exists today
--     and none is introduced; no write privilege of any kind is granted,
--     matching this table's own client-side-read-only design exactly.
--
-- Reversible: see the paired rollback file.

BEGIN;

GRANT SELECT ON public.subscriptions TO authenticated;

COMMIT;

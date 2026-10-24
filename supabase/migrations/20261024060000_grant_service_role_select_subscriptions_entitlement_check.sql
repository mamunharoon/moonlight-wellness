-- Grant service_role SELECT on subscriptions and provider_subscriptions
-- on production — the real cause of the 2026-10-24 "media won't load"
-- incident (Ocean Waves/Forest Ambience/Gentle Wind/Pink Noise/Brown
-- Noise/Soothing Birds/Rustling Leaves, and every other Plus-classified
-- id across the catalogue).
--
-- ROOT CAUSE (traced and reproduced directly against
-- wqpszprbuqdjcfmdqdlv, not assumed): get-beta-video-url's own premium
-- authorization check (checkPremiumAccess -> entitlementRecords.ts's
-- fetchEntitlementRecords, ../_shared/betaVideoUrlAccess.ts) reads
-- `subscriptions` and `provider_subscriptions` with the SERVICE-ROLE
-- admin client, by design (it must see every row for the verified user
-- regardless of RLS - see that file's own header). On production,
-- service_role has only ever held the inert REFERENCES/TRIGGER/TRUNCATE
-- privileges on both tables - confirmed live via
-- information_schema.role_table_grants - never SELECT. Every request for
-- an id outside FREE_EXERCISE_IDS/PREVIEW_ONLY_COVER_IDS/
-- GUEST_ALLOWED_IDS (premiumExerciseIds.ts) - 57 of the 86 ids in
-- EXERCISE_PATHS - therefore fails the entitlement read with Postgres
-- 42501 (permission denied), which fetchEntitlementRecords surfaces as a
-- generic `error` (not matched by isMissingTableError), which
-- resolveBetaVideoUrlRequest turns into a 503 VERIFICATION_UNAVAILABLE -
-- reproduced live, byte-identical to the owner's screenshots
-- ("Something went wrong loading this video."), for every signed-in
-- user regardless of actual subscription status (the check never even
-- reaches isAuthorizedForPremiumAccess).
--
-- This is the SAME underlying gap as 20261023050000/20261023060000/
-- 20261023070000 (a table created via a raw SQL migration on production
-- without Supabase's Dashboard-only default grants, confirmed live: DEV
-- has always had full SELECT/INSERT/UPDATE/DELETE as service_role on
-- both tables) - those three migrations closed it for the `authenticated`
-- role (src/lib/entitlementSnapshot.js's own client-side read, used by
-- useProtectedVideo's resolvePremiumGate for Stretch/Breathe/Meditation
-- rows). None of them touched service_role, because none of them traced
-- get-beta-video-url's own, separate, server-side entitlement read - a
-- different consumer of the same two tables, added later (Phase 2C §6/
-- §7) and never covered by that round's remediation.
--
-- SCOPE, confirmed live before writing this migration:
--   - service_role already has rolbypassrls = true (Supabase's standard
--     configuration) - that attribute skips RLS *policies*, but does
--     NOT substitute for the base table-level SELECT grant this
--     migration adds; a role can bypass every RLS policy on a table and
--     still get 42501 if it was never granted SELECT at all, which is
--     exactly what's live on production today.
--   - SELECT only, on exactly these two tables, to service_role only -
--     matching 20261023040000's own established "the one grant this
--     specific, currently-deployed consumer actually needs" discipline,
--     not DEV's broader INSERT/UPDATE/DELETE (those serve DEV's own
--     diagnostic tooling, not this function - fetchEntitlementRecords
--     only ever calls .select()).
--   - PUBLIC/anon/authenticated are untouched (authenticated's own
--     SELECT on subscriptions was already restored by 20261023070000;
--     provider_subscriptions' authenticated SELECT was never missing -
--     confirmed live, unaffected either way).
--   - RLS stays enabled on both tables, unchanged - service_role's
--     already-live BYPASSRLS is what makes the policies irrelevant to
--     it once this grant exists, not a new or modified policy.
--
-- Reversible: see the paired rollback file.

BEGIN;

GRANT SELECT ON public.subscriptions TO service_role;
GRANT SELECT ON public.provider_subscriptions TO service_role;

COMMIT;

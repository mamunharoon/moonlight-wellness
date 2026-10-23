-- Validation queries for 20261023040000_revenuecat_webhook_provider_events_insert_grant.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. service_role now has INSERT on provider_events, plus the
--    pre-existing inert privileges — and nothing else. This is the one
--    and only change this migration makes.
-- Expected: 4 rows — INSERT, REFERENCES, TRIGGER, TRUNCATE.
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'provider_events' AND grantee = 'service_role'
ORDER BY privilege_type;

-- 2. Specifically confirm SELECT/UPDATE/DELETE were NOT added — the
--    deployed webhook only ever INSERTs into this table, never reads or
--    modifies an existing row.
-- Expected: 0 rows.
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'provider_events' AND grantee = 'service_role'
  AND privilege_type IN ('SELECT', 'UPDATE', 'DELETE');

-- 3. provider_subscriptions and entitlements are untouched — service_role
--    still has only the same inert privileges it had before this
--    migration, confirming no grant was added where none is needed (all
--    writes to these two tables happen inside the SECURITY DEFINER RPCs,
--    as postgres, not as service_role).
-- Expected: 3 rows each — REFERENCES, TRIGGER, TRUNCATE (unchanged).
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'provider_subscriptions' AND grantee = 'service_role'
ORDER BY privilege_type;

SELECT privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'entitlements' AND grantee = 'service_role'
ORDER BY privilege_type;

-- 4. PUBLIC/anon/authenticated gained nothing on provider_events — this
--    migration grants only to service_role.
-- Expected: 0 rows.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'provider_events'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated');

-- 5. RLS on provider_events is unchanged — still enabled, still zero
--    policies (service_role's own BYPASSRLS, Supabase's standard
--    platform configuration, is what actually lets it write once the
--    grant above exists — this migration does not add or rely on any
--    new policy).
-- Expected: relrowsecurity = true.
SELECT relrowsecurity FROM pg_class WHERE relname = 'provider_events' AND relnamespace = 'public'::regnamespace;
-- Expected: 0 rows.
SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'provider_events';

-- 6. The two RPCs' own EXECUTE grants are unaffected — still
--    service_role only, still SECURITY DEFINER owned by postgres. This
--    migration does not touch function grants at all; checked here only
--    as a sanity cross-reference against the same finding this
--    migration's own header cites.
-- Expected: 2 rows, both owner = postgres, prosecdef = true.
SELECT p.proname, r.rolname AS owner, p.prosecdef
FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('apply_verified_apple_subscription_event', 'apply_verified_google_subscription_event');

-- Expected: 0 rows (no PUBLIC/anon/authenticated execute grant).
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('apply_verified_apple_subscription_event', 'apply_verified_google_subscription_event')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated');

-- 7. Live behavioural proof (the actual incident, now fixed) — send a
--    real RevenueCat-shaped TEST event to the deployed endpoint (see
--    the incident reproduction in the prior round) and confirm it now
--    returns 200, not 500. Not a SQL query — a manual HTTP check,
--    listed here for completeness since it's the real-world confirmation
--    this migration exists to produce. Safe to run at any time: TEST
--    events are inert by RevenueCat's own design and this project's
--    code (never reach the RPC, never write an entitlement).

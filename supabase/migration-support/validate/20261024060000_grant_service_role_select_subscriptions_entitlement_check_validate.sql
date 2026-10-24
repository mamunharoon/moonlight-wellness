-- Validation queries for 20261024060000_grant_service_role_select_subscriptions_entitlement_check.sql
-- READ-ONLY. Run each block and compare against "Expected".

-- 1. service_role now has SELECT on subscriptions, plus the pre-existing
--    inert privileges - and nothing else new.
-- Expected: 4 rows - REFERENCES, SELECT, TRIGGER, TRUNCATE.
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'subscriptions' AND grantee = 'service_role'
ORDER BY privilege_type;

-- 2. Same for provider_subscriptions.
-- Expected: 4 rows - REFERENCES, SELECT, TRIGGER, TRUNCATE.
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'provider_subscriptions' AND grantee = 'service_role'
ORDER BY privilege_type;

-- 3. Specifically confirm INSERT/UPDATE/DELETE were NOT added -
--    fetchEntitlementRecords only ever calls .select().
-- Expected: 0 rows.
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('subscriptions', 'provider_subscriptions')
  AND grantee = 'service_role' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

-- 4. PUBLIC/anon gained nothing; authenticated's own grants are
--    unaffected by this migration (subscriptions' authenticated SELECT
--    was already restored by 20261023070000; untouched here either way).
-- Expected: 0 rows.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('subscriptions', 'provider_subscriptions')
  AND grantee IN ('PUBLIC', 'anon');

-- 5. RLS on both tables is unchanged - still enabled, policies untouched
--    by this migration (service_role's own BYPASSRLS, confirmed
--    separately, is what actually lets it read once the base grant
--    above exists).
-- Expected: relrowsecurity = true for both.
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('subscriptions', 'provider_subscriptions');

-- 6. Live behavioural proof (the actual incident, now fixed) - request a
--    signed URL for a Plus-classified id (e.g. SL02) as a real signed-in
--    user and confirm it now returns 200 with a url, not 503
--    VERIFICATION_UNAVAILABLE. Not a SQL query - a manual HTTP/UI check,
--    listed here for completeness since it's the real-world
--    confirmation this migration exists to produce.

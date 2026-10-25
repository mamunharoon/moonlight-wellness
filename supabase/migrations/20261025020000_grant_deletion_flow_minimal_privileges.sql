-- Grant the minimum privileges the account-deletion flow actually uses
-- on production — the real cause of the 2026-10-25 12:37pm AEDT
-- "We couldn't verify your account right now" failure for
-- mamunharoon@yahoo.com.au (ASC-15), and of every other failure this
-- same flow would hit on its very next step if only the one table found
-- first were fixed.
--
-- ROOT CAUSE (traced directly in source, not assumed — see
-- supabase/functions/delete-account/index.ts and
-- supabase/functions/_shared/accountDeletion.ts, and confirmed live
-- against wqpszprbuqdjcfmdqdlv): account_deletion_requests and all 10
-- user-owned tables the deletion loop touches were each created via a
-- raw SQL migration on production without Supabase's Dashboard-only
-- default grants — the SAME root-cause class already found and fixed
-- for subscriptions/provider_subscriptions (20261024060000). service_role
-- has only ever held the inert REFERENCES/TRIGGER/TRUNCATE privileges on
-- every one of these tables on production — confirmed live via
-- information_schema.role_table_grants, never SELECT/INSERT/UPDATE/
-- DELETE. DEV has always had the full set (confirmed live, for
-- comparison only — NOT copied wholesale here; see the minimal-grant
-- reasoning below).
--
-- MINIMAL, NOT DEV's FULL GRANT SET — each privilege below was derived
-- by reading the exact Supabase calls this flow makes, not assumed from
-- DEV's own (broader) grants:
--
--   account_deletion_requests (service_role: SELECT, INSERT, UPDATE —
--   deliberately NOT DELETE):
--     - getExistingRequestRow(): .select('id, status')...maybeSingle()
--     - upsertProcessingRow(): .insert({...}) for a fresh request, or
--       .update({status:'processing',...}) to carry an existing
--       pending/processing row forward
--     - markRequestCompleted(): .update({status:'completed',...})
--     No .delete() call against this table exists anywhere in
--     delete-account/index.ts — DELETE is withheld.
--
--   account_deletion_requests (authenticated: SELECT only):
--     - src/lib/accountDeletionApi.js's getMyDeletionRequest() does a
--       single .select(...).eq('user_id', userId)...maybeSingle() via
--       the client's own RLS-scoped connection, never a write.
--     SAFE TO GRANT — verified live, not assumed: a rolled-back
--     transaction (BEGIN; temporary GRANT; two synthetic rows for two
--     real existing auth.users ids; SET LOCAL ROLE authenticated +
--     request.jwt.claims for one of them; ROLLBACK — nothing persisted)
--     confirmed the account_deletion_requests_select_own policy
--     (20260915100000) genuinely isolates by row: the simulated user saw
--     exactly their own row (1), could not see the other user's row even
--     via an explicit WHERE filter (0), and an entirely unfiltered count
--     still returned only 1, not 2 — RLS filters the rows themselves,
--     not merely what a well-behaved query asks for.
--
--   journal_entries, user_intentions, rhythms, routine_responses,
--   practice_completion_events, provider_subscriptions,
--   entitlements, subscriptions, profiles (service_role: DELETE only):
--     - accountDeletion.ts's deleteUserOwnedRowsInOrder(), called from
--       index.ts's deleteUserOwnedRows(), issues exactly
--       `supabaseAdmin.from(table).delete().eq(filterColumn, user.id)`
--       for each table in this fixed order, profiles last (filtered on
--       `id` there, `user_id` everywhere else) — no .select() is ever
--       chained, so SELECT is not required for this operation.
--     This was found by tracing the REST of the deletion flow after the
--     one table that had already failed once — exactly to avoid
--     surfacing these one retry at a time: every one of these 9 tables
--     currently has ZERO DELETE for service_role on production, confirmed
--     live, individually, not assumed from the one already found.
--
--   NOT INCLUDED HERE — checkout_attempts: this same trace found that
--   public.checkout_attempts does not exist on production AT ALL
--   (information_schema.tables, confirmed live) — it exists on DEV only.
--   Its own creation migration (20260918100000) was previously, separately
--   classified out of launch scope (a Stripe-web-checkout concern) and was
--   deliberately not applied to production. deleteUserOwnedRowsInOrder()
--   still includes 'checkout_attempts' in its fixed table list, so the
--   deletion flow will fail here too (relation does not exist, 42P01) on
--   the very next attempt, after every table before it in the list now
--   succeeds — a SEPARATE blocker from the grants this migration fixes,
--   requiring its own explicit decision (create the table now vs. a
--   different resolution) before full PROD deletion can succeed. Not
--   addressed by this migration.
--
--   subscriptions (service_role SELECT, for the billing check,
--   getBillingRow): already granted — see 20261024060000. Not repeated
--   here.
--
--   cancelStripeSubscriptionIfActive(): calls Stripe's own API only: no
--   Postgres table is touched by this step, confirmed by reading it
--   directly — no grant needed.
--
--   deleteAuthUser(): Supabase Auth's own Admin API (auth.admin.
--   deleteUser), authenticated by the service-role KEY, not a
--   table-level SQL grant — unaffected by, and does not need, anything
--   in this migration.
--
-- SCOPE, confirmed live before writing this migration:
--   - service_role already has rolbypassrls = true (Supabase's standard
--     configuration) - skips RLS *policies*, but does NOT substitute for
--     the base table-level grants this migration adds; a role can bypass
--     every RLS policy and still get 42501 if never granted the
--     privilege at all, which is exactly what has been live on
--     production.
--   - PUBLIC/anon are untouched. authenticated gains ONLY the one SELECT
--     documented and RLS-tested above - no other role or privilege
--     changes on any of these 11 tables.
--   - RLS stays enabled and unchanged on every table here - no policy is
--     created, altered, or dropped by this migration. All existing
--     reauthentication/password-recheck logic in delete-account is
--     entirely untouched - this is a grants-only change.
--
-- Reversible: see the paired rollback file. No data is read, written, or
-- deleted by this migration itself - it only changes what future calls
-- are permitted to do.

BEGIN;

-- account_deletion_requests
GRANT SELECT, INSERT, UPDATE ON public.account_deletion_requests TO service_role;
GRANT SELECT ON public.account_deletion_requests TO authenticated;

-- The 10 tables deleteUserOwnedRowsInOrder() deletes from, in its own
-- fixed order (order doesn't matter for a GRANT, listed here to match)
GRANT DELETE ON public.journal_entries TO service_role;
GRANT DELETE ON public.user_intentions TO service_role;
GRANT DELETE ON public.rhythms TO service_role;
GRANT DELETE ON public.routine_responses TO service_role;
GRANT DELETE ON public.practice_completion_events TO service_role;
GRANT DELETE ON public.provider_subscriptions TO service_role;
GRANT DELETE ON public.entitlements TO service_role;
GRANT DELETE ON public.subscriptions TO service_role;
GRANT DELETE ON public.profiles TO service_role;

COMMIT;

-- Grants the SELECT privilege the deletion flow's own filtered DELETE
-- statements require on their WHERE-clause column, confirmed missing on
-- production for 8 tables - the real cause of the 2026-10-25 2:45pm
-- AEDT "partial deletion" failure for mamunharoon@yahoo.com.au (ASC-15),
-- which occurred AFTER 20261025020000's DELETE-only grants were already
-- applied and validated.
--
-- ROOT CAUSE, CONFIRMED BY DIRECT REPRODUCTION, NOT THEORISED:
-- 20261025020000's own reasoning ("deleteUserOwnedRowsInOrder() never
-- chains .select(), so SELECT is not required") was INCOMPLETE. It
-- correctly traced what the PostgREST client CALLS, but missed what
-- PostgreSQL itself REQUIRES to execute a filtered DELETE: per
-- PostgreSQL's own documented privilege model, `DELETE FROM t WHERE
-- col = $1` requires BOTH the DELETE privilege (to remove rows) AND the
-- SELECT privilege on any column referenced in the WHERE clause (to
-- evaluate which rows match) - regardless of whether the caller's own
-- client code ever reads the result. Reproduced directly, live, against
-- production, for every one of the 10 tables the deletion flow touches
-- (BEGIN; SET LOCAL ROLE service_role; DELETE ... WHERE ...; ROLLBACK -
-- fully non-destructive, confirmed afterward that nothing persisted):
-- subscriptions and provider_subscriptions (which already carry
-- table-level SELECT from 20261024060000/E-153, for a DIFFERENT,
-- multi-column read - getBillingRow()) succeeded; every other table -
-- exactly the 8 below - failed with the identical 42501 error,
-- Postgres's own HINT naming the missing SELECT grant each time.
--
-- COLUMN-LEVEL, NOT TABLE-LEVEL - genuinely least privilege, confirmed
-- empirically, not assumed from the fix that worked for
-- checkout_attempts/account_deletion_requests (table-level there, for
-- different reasons - see their own migrations). Checked PostgREST's own
-- documented behaviour first: supabase-js's plain .delete().eq(...),
-- with no .select() chained, sends Prefer: return=minimal, under which
-- PostgREST generates NO RETURNING clause at all - so the only privilege
-- PostgreSQL itself requires is SELECT on the WHERE-clause column
-- specifically (PostgreSQL's own DELETE documentation: "you must have
-- the DELETE privilege on the table... as well as the SELECT privilege
-- for any table... whose values are read in the condition"). Then
-- directly verified, live, rolled back: GRANT SELECT (user_id) ON
-- journal_entries and GRANT SELECT (id) ON profiles, each alone (no
-- table-level SELECT), both let the real filtered DELETE succeed - a
-- negative control (no grant at all, entitlements) still failed
-- identically, confirming the test methodology itself has no false
-- positive.
--
-- Deliberately NOT including: any column beyond each table's one filter
-- column; any other role (authenticated/anon unaffected); any change to
-- account_deletion_requests (already correct, table-level, for its own
-- genuinely different multi-column INSERT/SELECT/UPDATE needs).

BEGIN;

GRANT SELECT (user_id) ON public.journal_entries TO service_role;
GRANT SELECT (user_id) ON public.user_intentions TO service_role;
GRANT SELECT (user_id) ON public.rhythms TO service_role;
GRANT SELECT (user_id) ON public.routine_responses TO service_role;
GRANT SELECT (user_id) ON public.practice_completion_events TO service_role;
GRANT SELECT (user_id) ON public.entitlements TO service_role;
GRANT SELECT (user_id) ON public.checkout_attempts TO service_role;
GRANT SELECT (id) ON public.profiles TO service_role;

COMMIT;

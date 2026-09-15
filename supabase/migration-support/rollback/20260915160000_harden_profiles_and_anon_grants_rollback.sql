-- Rollback for 20260915160000_harden_profiles_and_anon_grants.sql
--
-- Restores the exact pre-hardening grant state: unrestricted table-level
-- INSERT/UPDATE on public.profiles for authenticated, and full table-
-- level grants on the three tables for anon. Purely a grant change —
-- reversing it is safe and immediate, with no data implications either
-- direction (grants don't affect existing rows).
--
-- Re-running this rollback after it's already been applied is a no-op
-- in effect (re-granting an already-held privilege, and re-revoking a
-- column-level grant that was already removed by the second statement,
-- succeed harmlessly).

BEGIN;

-- ---- Part 1: profiles — restore unrestricted grants ----

REVOKE INSERT (id, first_name, last_name) ON public.profiles FROM authenticated;
REVOKE UPDATE (first_name, last_name, avatar_url) ON public.profiles FROM authenticated;

GRANT INSERT, UPDATE ON public.profiles TO authenticated;

-- ---- Part 2: restore anon's grants on the three tables ----

GRANT ALL ON public.subscriptions TO anon;
GRANT ALL ON public.account_deletion_requests TO anon;
GRANT ALL ON public.stripe_webhook_events TO anon;

COMMIT;

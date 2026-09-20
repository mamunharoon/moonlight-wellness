-- Extend the column-level UPDATE grant on public.profiles to include
-- introduction_completed_version.
--
-- Discovered live during DEV verification of Introduction.jsx's Start/
-- Skip persistence: the write failed with Postgres error 42501
-- ("permission denied for table profiles"), hint "GRANT the required
-- privileges to the current role with: GRANT UPDATE ON public.profiles
-- TO authenticated." This is NOT an RLS problem — profiles_update_own's
-- policy (auth.uid() = id) is correct and untouched — it is that
-- 20260915160000_harden_profiles_and_anon_grants.sql (a deliberate,
-- previously-applied security fix for a real privilege-escalation path)
-- REVOKEd the platform-default unrestricted table-level UPDATE and
-- re-GRANTed it back column-by-column: only first_name, last_name,
-- avatar_url. Column-level grants are evaluated before RLS, so writing
-- any other column — including this new one — is denied outright,
-- regardless of policy correctness. That migration's own header comment
-- explicitly notes "no code path currently performs an UPDATE on
-- profiles at all" at the time it was written; Introduction.jsx's new
-- Start/Skip persistence (20260920120000) is the first to actually need
-- one.
--
-- Security assessment: introduction_completed_version carries no
-- privilege implications, unlike is_admin/beta_access (the actual
-- vulnerability 20260915160000 closed). RLS already restricts this
-- column to the user's OWN row; the worst an authenticated user could do
-- by writing an arbitrary non-negative integer directly is see the
-- Introduction screen again (set it low) or skip a future revised one
-- (set it high) for THEMSELVES only — the same risk class as the
-- already-grantable first_name/last_name/avatar_url, not the same class
-- as is_admin/beta_access. Extending the existing additive column grant
-- (never re-granting broad table-level UPDATE, never touching INSERT,
-- never touching any RLS policy) is the correct, minimal fix — consistent
-- with 20260915160000's own column-level-ACL design, not a reversal of
-- it. Column grants in Postgres accumulate across GRANT statements for
-- the same table/role, so this is purely additive: authenticated keeps
-- exactly the same UPDATE access to first_name/last_name/avatar_url it
-- already had, plus this one new column.

BEGIN;

GRANT UPDATE (introduction_completed_version) ON public.profiles TO authenticated;

COMMIT;

-- Sprint 2 Stage 2: administration foundation — schema only, no UI/app code.
--
-- Scope:
--   1. Additively extend public.profiles with is_admin and beta_access.
--   2. Add public.is_admin() — the single internal "is the caller an
--      administrator" check every admin-only function below depends on.
--   3. Add four SECURITY DEFINER RPC functions that are the ONLY way the
--      client reaches cross-user data or admin writes:
--        - admin_list_users()            (read)
--        - admin_list_subscriptions()    (read)
--        - admin_set_beta_access()       (write)
--        - admin_set_subscription_status() (write)
--
-- Why RPC functions instead of new RLS policies on profiles/subscriptions:
-- every existing policy on both tables (profiles_select_own,
-- profiles_insert_own, profiles_update_own, subscriptions_select_own) is
-- left completely untouched by this migration — zero risk of loosening
-- an existing user's own-row access. An admin needs to read/write OTHER
-- users' rows, which owner-scoped RLS structurally cannot express without
-- adding a second, broader policy directly on the table (which would
-- apply to every future query, not just admin-tool ones). A SECURITY
-- DEFINER function is a narrower blast radius: it bypasses RLS only for
-- the exact statement inside its own body, only when public.is_admin()
-- passes for the calling user, and only via the specific operation that
-- function name describes. This mirrors the "future trusted process"
-- language already in the Stage 1 subscriptions migration.
--
-- Why email comes from auth.users via these functions rather than a new
-- profiles.email column: auth.users is already the single source of
-- truth for email (see AuthContext.jsx, which never stores it in
-- profiles either). Duplicating it into profiles would need a sync
-- mechanism this stage does not build. SECURITY DEFINER is what makes
-- reading auth.users possible at all here — PostgREST does not expose
-- the auth schema directly, and authenticated/anon have no SELECT grant
-- on it.
--
-- is_admin() is intentionally parameterless: it always checks the
-- CALLING user's own auth.uid(), never a caller-supplied id, so it
-- cannot be used to probe whether some other arbitrary user is an admin.
--
-- Out of scope (explicitly untouched by this migration): Stripe/Apple/
-- Google billing, invoices, taxation, coupons, analytics, any change to
-- the plan values a subscription can hold (admin_set_subscription_status
-- only ever changes `status`, never `plan`), and every existing RLS
-- policy on profiles/subscriptions.
--
-- This migration is additive and reversible. See the paired rollback file:
--   supabase/migrations/20260808120000_sprint2_stage2_admin_foundation_rollback.sql
--
-- Per Sprint 2 Stage 1's own precedent, this migration is written but not
-- applied to the live database in this batch — see the Stage 2 report.

BEGIN;

-- ============================================================================
-- 1. Extend public.profiles additively.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beta_access boolean NOT NULL DEFAULT false;

-- ============================================================================
-- 2. public.is_admin() — the one place "is the caller an administrator"
--    is decided. SECURITY DEFINER + fixed empty search_path (fully
--    qualified references only) per Supabase's own hardening guidance for
--    definer functions. Safe to expose to any authenticated caller: it
--    only ever reports on the caller's own row.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================================
-- 3. admin_list_users() — Users view. Returns every registered user
--    (profiles only ever holds registered, non-anonymous accounts — see
--    AuthContext.jsx's loadProfile early-return for anonymous users, so
--    guests never appear here) with their email joined from auth.users.
--    Non-admin callers get zero rows back, not an error, matching this
--    project's existing "closed by default" style (e.g. the missing-table
--    handling in SubscriptionContext.jsx).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  is_admin boolean,
  beta_access boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, u.email, p.first_name, p.last_name, p.is_admin, p.beta_access, p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE public.is_admin()
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- ============================================================================
-- 4. admin_list_subscriptions() — Subscriptions view. LEFT JOINs so every
--    registered user appears even with no subscriptions row yet, defaulted
--    exactly the way SubscriptionContext.jsx's FREE_DEFAULT already
--    defaults it for that user's own screen (plan='free', status='active',
--    provider='manual') — the admin view and the user's own view agree on
--    what "no row" means. email is included only as the row identifier an
--    admin needs to act on a specific subscription; it is not one of this
--    stage's four displayed fields on its own.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_subscriptions()
RETURNS TABLE (
  user_id uuid,
  email text,
  plan text,
  status text,
  provider text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.id AS user_id,
    u.email,
    COALESCE(s.plan, 'free') AS plan,
    COALESCE(s.status, 'active') AS status,
    COALESCE(s.provider, 'manual') AS provider,
    s.expires_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.subscriptions s ON s.user_id = p.id
  WHERE public.is_admin()
  ORDER BY u.email ASC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_subscriptions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_subscriptions() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions() TO authenticated;

-- ============================================================================
-- 5. admin_set_beta_access() — the only write path to profiles.beta_access.
--    Non-admin callers get a hard error, not a silent no-op: unlike the
--    read functions above, a write attempt from an unauthorized caller
--    should fail loudly.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_set_beta_access(target_user_id uuid, enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.profiles SET beta_access = enabled WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_beta_access(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_beta_access(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_beta_access(uuid, boolean) TO authenticated;

-- ============================================================================
-- 6. admin_set_subscription_status() — the only write path to
--    subscriptions.status via the admin tool. Deliberately status-only:
--    it never touches `plan`, matching this stage's brief ("change plan
--    status manually", not "change plan"). Upserts because most users
--    have no subscriptions row yet (Stage 1's expected, correct starting
--    state) — setting a status for such a user must create their row,
--    defaulting plan/provider the same way the read side already does.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_set_subscription_status(target_user_id uuid, new_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF new_status NOT IN ('trial', 'active', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'invalid status: %', new_status;
  END IF;

  INSERT INTO public.subscriptions (user_id, status)
  VALUES (target_user_id, new_status)
  ON CONFLICT (user_id) DO UPDATE SET status = excluded.status, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_subscription_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_subscription_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_subscription_status(uuid, text) TO authenticated;

COMMIT;

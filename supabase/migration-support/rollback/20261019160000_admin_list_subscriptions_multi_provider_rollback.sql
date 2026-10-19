-- Rollback for 20261019160000_admin_list_subscriptions_multi_provider.sql.
-- Restores the pre-fix function body verbatim (20260808120000's original
-- 6-column, Stripe-only shape). Reintroduces N-04's own bug (blind to
-- Apple/Google entitlements) — exists for schema-history symmetry only,
-- never because reverting is expected to be desirable. Not destructive to
-- any table/row; a function replacement only.

BEGIN;

DROP FUNCTION IF EXISTS public.admin_list_subscriptions();

CREATE FUNCTION public.admin_list_subscriptions()
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

COMMIT;

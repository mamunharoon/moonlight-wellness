-- Sprint 2 Stage 2 rollback for 20260808120000_sprint2_stage2_admin_foundation.sql
--
-- Drops the four RPC functions and is_admin() unconditionally (safe —
-- removes access surface, not data). Drops profiles.is_admin/beta_access
-- only if every value in both columns is still the default (false) —
-- same non-destructive philosophy as every prior rollback in this
-- project: if an admin has actually been granted (is_admin = true
-- somewhere) or beta access has actually been toggled on for anyone,
-- this rollback leaves those columns in place and raises a notice
-- instead of silently discarding that state.
--
-- Re-running this rollback after these objects are already gone is a
-- no-op (every statement below is conditional on the object existing).

BEGIN;

DROP FUNCTION IF EXISTS public.admin_set_subscription_status(uuid, text);
DROP FUNCTION IF EXISTS public.admin_set_beta_access(uuid, boolean);
DROP FUNCTION IF EXISTS public.admin_list_subscriptions();
DROP FUNCTION IF EXISTS public.admin_list_users();
DROP FUNCTION IF EXISTS public.is_admin();

DO $$
DECLARE
  changed_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.profiles WHERE is_admin = true OR beta_access = true'
    INTO changed_count;

  IF changed_count = 0 THEN
    ALTER TABLE public.profiles
      DROP COLUMN IF EXISTS is_admin,
      DROP COLUMN IF EXISTS beta_access;
  ELSE
    RAISE NOTICE 'admin foundation rollback: % profile row(s) have is_admin or beta_access set to true — columns not dropped. Drop manually once you have confirmed that state does not need to be kept.', changed_count;
  END IF;
END $$;

COMMIT;

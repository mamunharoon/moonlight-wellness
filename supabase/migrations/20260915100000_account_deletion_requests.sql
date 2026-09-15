-- Safe Account Management and Account Deletion — account_deletion_requests
--
-- Scope:
--   1. Create public.account_deletion_requests: one row per deletion
--      request, tracking its lifecycle (pending -> cancelled, or pending
--      -> completed via a future manual/documented processor run — see
--      docs/account-deletion-processor-spec.md). This migration creates
--      the request/status/cancellation framework only; it does not
--      create, schedule, or run any automated deletion worker.
--   2. Enable RLS: users may read only their own request(s). No
--      INSERT/UPDATE/DELETE policy for `authenticated` — every write
--      (create, cancel, or a future processor's completion update) goes
--      through a service-role Edge Function
--      (request-account-deletion / cancel-account-deletion), exactly the
--      same "service-role only" write boundary the Stage 1 subscriptions
--      migration already established for that table.
--   3. Enforce "one active (pending) request per user" via a partial
--      unique index, so a retried or concurrent submission can never
--      create a second row for the same user — the Edge Function's own
--      idempotency check is the primary defence; this index is the
--      database-level backstop.
--
-- user_id is nullable with ON DELETE SET NULL (not CASCADE, unlike every
-- other user-owned table in this project): once a request reaches
-- status='completed' and the Supabase Auth user is finally removed (the
-- LAST step of the — still manual — processor spec), this row is meant
-- to remain as a non-identifying completion audit record, not vanish at
-- the same instant. Nulling user_id (rather than cascading the delete)
-- is what makes "record a non-identifying completion audit entry"
-- possible at all. While a request is pending, user_id is always
-- populated, so the owner-only SELECT policy below works exactly like
-- every other owner-scoped policy in this project.
--
-- Reversible: see the paired rollback file, which only ever drops this
-- one new table/policy/index. No existing table, column, policy, or
-- Storage object is touched by this migration in any way.
--
-- Applied 2026-09-15 to the linked project (kvdxuhyndevrfvsalgnx) after
-- explicit owner approval — see the Safe Account Management and Account
-- Deletion report for the full risk assessment and approval record.

BEGIN;

-- ============================================================================
-- 1. Create public.account_deletion_requests additively.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'processing', 'completed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz NOT NULL,
  cancelled_at timestamptz,
  completed_at timestamptz,
  billing_status_at_request text NOT NULL,
  processing_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. One active (pending) request per user — idempotent, database-level
--    backstop alongside the Edge Function's own application-level check.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_requests_one_pending_per_user
  ON public.account_deletion_requests (user_id)
  WHERE status = 'pending';

-- ============================================================================
-- 3. RLS: owner-read only. No `authenticated` INSERT/UPDATE/DELETE
--    policy — see the file header for why. No USING (true). No `public`
--    or `anon` role. No service-role key here (service role bypasses RLS
--    by default and needs none).
-- ============================================================================

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_deletion_requests_select_own" ON public.account_deletion_requests;
CREATE POLICY "account_deletion_requests_select_own" ON public.account_deletion_requests
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

COMMIT;

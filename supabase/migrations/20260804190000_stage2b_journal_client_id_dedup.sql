-- Stage 2B Group 5.1: additive client_id support for journal_entries dedup
--
-- Scope:
--   1. Add a nullable client_id uuid column to public.journal_entries.
--   2. Add an idempotent UNIQUE(user_id, client_id) constraint (idempotent
--      via pg_constraint inspection, matching the Group 1 convention --
--      PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS syntax).
--
-- Purpose:
--   Guest journal entries already carry a client-generated local_id
--   (crypto.randomUUID(), set in Journal.jsx's handleSave guest branch) that
--   is never sent to Supabase today. client_id lets a future guest-to-account
--   migration send that same value as a stable idempotency key, so a
--   migration retry can never create a duplicate journal row for the same
--   guest entry. Deterministic dedup on body+timestamp was considered and
--   rejected: journal text is free-form (duplicate text is valid user
--   content), and timestamp matching is not a reliable identity key.
--
-- NULL semantics (see also the paired validation file):
--   PostgreSQL UNIQUE constraints never treat two NULLs as equal to each
--   other, so any number of existing or future rows may carry
--   client_id = NULL for the same user_id without violating this
--   constraint. Uniqueness is therefore enforced ONLY when client_id is
--   populated, exactly as required -- no partial index or WHERE clause is
--   needed to achieve this; a plain UNIQUE(user_id, client_id) constraint
--   already has the correct semantics.
--
-- Existing rows:
--   ADD COLUMN without a DEFAULT populates client_id = NULL for every
--   existing row. No existing row is modified, renamed, or removed by this
--   migration.
--
-- Out of scope (explicitly untouched by this migration): profiles, rhythms,
-- user_intentions, all RLS policies, all triggers, and every index unrelated
-- to this one new constraint. No application code is touched by this file.
--
-- This migration is additive and reversible. See the paired rollback file:
--   supabase/migrations/20260804190000_stage2b_journal_client_id_dedup_rollback.sql

BEGIN;

-- ============================================================================
-- 1. Add client_id additively. Do not assume the column is absent.
-- ============================================================================

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS client_id uuid;

-- ============================================================================
-- 2. Uniqueness constraint on (user_id, client_id), idempotent via
--    pg_constraint inspection.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'journal_entries_user_id_client_id_key'
      AND conrelid = 'public.journal_entries'::regclass
  ) THEN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_user_id_client_id_key UNIQUE (user_id, client_id);
  END IF;
END $$;

COMMIT;

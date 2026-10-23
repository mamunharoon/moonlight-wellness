-- Restore authenticated's INSERT/UPDATE on rhythms on production.
--
-- ROOT CAUSE (2026-10-23 production incident, traced and reproduced
-- directly against wqpszprbuqdjcfmdqdlv, not assumed): same class of gap
-- as 20261023050000 (the baseline reconstruction migration,
-- 20260801000000_initial_baseline_schema.sql, issues no explicit GRANT at
-- all, wrongly assuming Supabase's platform-default privileges apply
-- automatically to a migration-created table - true only for a
-- Dashboard-created one, which is how DEV's own rhythms table came to
-- exist). 20261023050000 already restored SELECT; this migration covers
-- the separate, previously-unneeded-until-now write path.
--
-- Traced from the actual failing write, not assumed: AlarmContext.jsx's
-- confirmTimezone -> rhythmPersistence.js's upsertTimezoneOnly sends
-- `supabase.from('rhythms').upsert({ user_id, timezone, updated_at },
-- { onConflict: 'user_id' })` - PostgREST's upsert requires INSERT (for a
-- genuinely new row) and UPDATE (for the on-conflict branch, every
-- returning user). Reproduced directly: `SET LOCAL ROLE authenticated;
-- INSERT INTO rhythms ... ON CONFLICT (user_id) DO UPDATE ...` returns
-- `42501: permission denied for table rhythms`, with Postgres's own hint
-- naming exactly this fix.
--
-- Checked every real client call against rhythms before scoping this
-- (src/lib/rhythmPersistence.js, src/lib/migrateGuestData.js) - all are
-- SELECT or upsert (INSERT+UPDATE); none ever DELETE a rhythms row. DELETE
-- is therefore deliberately NOT granted here, even though DEV's own
-- table-level grant set happens to include it (a Dashboard-created-table
-- default, not something this app's own write paths use) - granting it
-- on production would be broader than anything currently evidenced as
-- needed.
--
-- SAFETY, confirmed live before writing this migration, not assumed:
--   - RLS is enabled on rhythms (confirmed in 20261023050000's own
--     snapshot, unchanged since).
--   - rhythms_insert_own (INSERT, with_check auth.uid() = user_id) and
--     rhythms_update_own (UPDATE, qual AND with_check auth.uid() =
--     user_id) already exist, scoped to authenticated only - this grant
--     only unlocks what RLS already correctly restricts to each row's
--     own owner.
--   - PUBLIC/anon are untouched - grants to authenticated only.
--   - No column-level restriction exists on rhythms today (confirmed:
--     authenticated's only column-level grants on this table are
--     inert REFERENCES plus the SELECT this migration's own predecessor
--     added) - this migration is table-level INSERT/UPDATE, matching
--     that same shape.
--
-- Reversible: see the paired rollback file.

BEGIN;

GRANT INSERT, UPDATE ON public.rhythms TO authenticated;

COMMIT;

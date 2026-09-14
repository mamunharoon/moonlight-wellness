# Migration support files (rollback / validate)

This directory holds every `_rollback.sql` and `_validate.sql` file that
used to live inside `supabase/migrations/` alongside their forward
migrations. They were moved out in the "Supabase Migration Directory
Safety Cleanup" (2026-09-14) — see that commit for the full audit.

## Why this split exists

The Supabase CLI treats **every `.sql` file in `supabase/migrations/`**
as a migration to potentially apply — it does not know the difference
between a forward migration, a rollback, or a read-only validation
script. Before this cleanup, a rollback/validate file shared its forward
migration's version timestamp (e.g.
`20260804082844_stage2b_profiles_persistence_rls_rollback.sql` next to
`20260804082844_stage2b_profiles_persistence_rls.sql`), which meant:

- `supabase migration list` showed three entries per version instead of
  one, with two always unmatched against the remote ledger.
- A plain `supabase db push` refused to run at all once any of those
  unmatched files existed (out-of-order local files ahead of the last
  applied remote migration).
- The CLI's own suggested fix — `supabase db push --include-all` — would
  have executed **every rollback file as if it were a pending forward
  migration**, including ones that `DROP COLUMN` real user data
  (`profiles.first_name`/`last_name`/`avatar_url`) and revoke every RLS
  policy on `profiles`, `rhythms`, `journal_entries`, and
  `user_intentions`. That command was never run — this reorganization
  exists specifically so it's no longer even possible to reach for it by
  mistake.

## The rule going forward

- **`supabase/migrations/`** contains **only** legitimate forward
  migrations — the files the Supabase CLI is meant to track and apply.
  Never add a `_rollback.sql` or `_validate.sql` file there again.
- **`supabase/migration-support/rollback/`** — potentially destructive.
  A rollback script here must be reviewed by hand and **run manually**
  (e.g. `supabase db query --linked -f <path>` for a single, deliberate
  statement, or pasted into the Supabase SQL Editor) — never through
  `db push`, and never against the production project without explicit
  product-owner approval. Several of these files contain their own
  `*** WARNING ***` sections marking exactly which section is
  destructive and what to confirm before running it (e.g. a row count)
  — read those before running anything.
- **`supabase/migration-support/validate/`** — read-only by design (every
  statement is a `SELECT`). Safe to run any time, against any
  environment, to confirm a migration applied as intended. Still run
  explicitly and deliberately, not automatically.

## Filename convention (unchanged)

Each set of three shares one version timestamp:

```
supabase/migrations/<version>_<name>.sql                       — forward migration
supabase/migration-support/rollback/<version>_<name>_rollback.sql   — manual, potentially destructive
supabase/migration-support/validate/<version>_<name>_validate.sql   — manual, read-only
```

## Applying to production

Nothing in this repository applies a migration to production
automatically. Every migration in this project so far has been applied
to the linked `dev`-environment Supabase project deliberately, by hand,
with the CLI's own remote ledger (`supabase migration list`/`repair`)
kept in sync afterward. Applying any of these files — forward or
rollback — to a production project requires the same explicit,
deliberate process and product-owner approval; it is never something a
routine `db push` should do on its own.

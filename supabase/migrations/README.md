# supabase/migrations/

**Forward migrations only.** Every `.sql` file in this directory is
something the Supabase CLI may apply via `supabase db push`.

Do not add a `_rollback.sql` or `_validate.sql` file here — those belong
in `supabase/migration-support/rollback/` and
`supabase/migration-support/validate/` respectively. See
[`supabase/migration-support/README.md`](../migration-support/README.md)
for why, and for how to run them safely by hand when you actually need
to.

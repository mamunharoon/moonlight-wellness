# WakeWise — Account Deletion Processor Specification

**Status: specification only. Not built. No automated worker exists.**
Per the approved scope for this batch, final destructive processing
stays a manual, documented operator action until its exact targets and
rollback implications have been separately approved and an automated
worker is explicitly requested. This document is what that worker (or a
careful manual run) must do, in this order, against WakeWise's real,
verified schema — not generic placeholders.

## Preconditions

- The `account_deletion_requests` migration (see
  `supabase/migrations/20260915100000_account_deletion_requests.sql`) is
  applied.
- The `request-account-deletion` and `cancel-account-deletion` Edge
  Functions are deployed.
- A row in `public.account_deletion_requests` has `status = 'pending'`
  and `scheduled_for <= now()` — i.e. its 7-day cancellation window has
  closed without the user cancelling.

## Verified schema this spec operates on

Every table below currently has `user_id ... references auth.users(id)
on delete cascade` (confirmed live via `pg_constraint`, see the Phase 1
audit) — **except** `account_deletion_requests` itself, whose `user_id`
is `references auth.users(id) on delete set null`, deliberately, so its
row survives as a non-identifying audit record after step 8.

| Table | Personal data it holds | Cascade behaviour on `auth.users` delete |
|---|---|---|
| `public.profiles` | `first_name`, `last_name`, `avatar_url` | CASCADE |
| `public.rhythms` | `wake_up_time`, `bedtime`, `timezone` | CASCADE |
| `public.journal_entries` | `title`, `body` (user-authored journaling) | CASCADE |
| `public.user_intentions` | `intention` (user-authored text) | CASCADE |
| `public.subscriptions` | `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, plan/status | CASCADE |
| `public.stripe_webhook_events` | None — global Stripe event idempotency ledger, not linked to any user. **Never touched by this processor.** | N/A |
| `public.account_deletion_requests` | `billing_status_at_request` (a short classification, not raw billing detail) | SET NULL (survives) |

No private per-user Storage objects exist today (`profiles.avatar_url`
is a schema column with no working upload path anywhere in the
codebase — confirmed via the Phase 1 audit) — step 6 below is
consequently a no-op until that changes, and is listed for completeness
and future-proofing only.

Because every user-owned table cascades from `auth.users`, **step 8
(removing the Auth user) instantly and irreversibly deletes steps
5's tables too** — this is exactly why Stripe reconciliation (step 3)
must happen strictly before it, not after: `subscriptions.stripe_customer_id`
/`stripe_subscription_id` would otherwise be gone before they could be
used to cancel anything.

## Ordered steps

1. **Lock the request for idempotent processing.**
   `UPDATE account_deletion_requests SET status = 'processing', updated_at = now() WHERE id = :id AND status = 'pending' RETURNING *;`
   If this returns no row, another run already claimed it (or it was
   cancelled) — stop.

2. **Re-check status and cancellation deadline.**
   Re-read the locked row. If `scheduled_for > now()` somehow (clock
   skew, manual error), abort and revert status to `'pending'` — never
   process early.

3. **Reconcile the active Stripe subscription.**
   Read `subscriptions` for this `user_id`. If `stripe_subscription_id`
   is set and the subscription is still active in Stripe, cancel it —
   prefer `cancel_at_period_end: true` per the in-app copy already shown
   to the user ("cancelled at the end of your current billing period...
   no refund for the current period"), unless a specific Apple/Google/
   payment-policy requirement overrides that for a given case (flagged
   for owner/legal review — not resolved by this spec). Do not delete
   the Stripe customer object (see the runbook). Do not issue a refund.

4. **Identify retained billing/security records.**
   Nothing beyond Stripe's own retained invoice/payment history (outside
   this database entirely) and this row's own
   `billing_status_at_request` classification. No separate
   billing/audit table exists in this schema to consult.

5. **Delete or anonymise user-owned application data, in dependency-safe order.**
   `journal_entries`, `user_intentions`, and `rhythms` have no
   inter-table foreign keys to each other — order between them does not
   matter. Delete each with `WHERE user_id = :user_id`. `subscriptions`
   is included here too (its Stripe identifiers are no longer needed
   after step 3) — delete `WHERE user_id = :user_id`. (In practice, step
   8 will CASCADE-delete all four of these automatically; doing it
   explicitly here first is optional but makes a partial-failure retry
   safer to reason about, since it turns step 8 into a single,
   already-clean cascade rather than the first place these deletes are
   attempted.)

6. **Delete private user assets, where applicable.**
   No such assets exist today (see above) — no-op.

7. **Delete or anonymise the profile.**
   `DELETE FROM profiles WHERE id = :user_id` (or handled by step 8's
   cascade, same reasoning as step 5).

8. **Remove the Supabase Auth user last.**
   `supabase.auth.admin.deleteUser(user_id)` (service-role only — this
   is the one call in this whole spec that actually requires the
   service-role key, and it must never be reachable from the browser).
   This cascades any of steps 5/7's tables that weren't already cleared.

9. **Record a non-identifying completion audit entry.**
   `UPDATE account_deletion_requests SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = :id;`
   `user_id` on this row is now `NULL` (the `ON DELETE SET NULL` from
   step 8 already did this automatically) — the row that remains shows
   only that *some* account was deleted, when, and what its billing
   state was at request time, with no identifying link back to who it
   was.

10. **Ensure retry safety after partial failure.**
    If the run dies between steps 3 and 9, the row is left in
    `status = 'processing'` with the Auth user possibly still present.
    A safe retry re-reads the row, re-checks Stripe state (idempotent —
    cancelling an already-cancelled subscription is a no-op in Stripe),
    and re-attempts steps 5/7/8 (all idempotent — deleting rows that are
    already gone, or an Auth user that's already gone, should be treated
    as success, not a hard failure). A `processing` row that is stuck for
    an unexpectedly long time is a signal to investigate manually via the
    runbook, not to silently re-run automatically without review.

## What this spec deliberately does not do

- It does not build the worker that runs these steps. That requires a
  separate, explicit approval once its exact trigger (cron? manual
  button? which project?) and rollback story are agreed.
- It does not decide the Apple In-App Purchase implication for a future
  iOS build — see the Safe Account Management report's final section for
  that flag.
- It does not invent a retention period beyond what `docs/account-admin-runbook.md`
  and the existing Data Retention Policy already state.

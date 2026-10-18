# WakeWise — Owner Administration Runbook (No CRM)

This is the documented operational procedure the owner asked for instead
of a custom admin CRM. Routine user administration happens through the
**Supabase Dashboard** and the **Stripe Dashboard**, which already have
everything needed for the account volumes WakeWise runs at today.

This runbook does not require running SQL. Where a dashboard view is not
enough, the exact read-only SQL is given — never destructive SQL.

## Definitions — know which one you actually want

| Action | What it does | Where |
|---|---|---|
| **Sign out** | Ends that device's session only. The account, data and subscription are untouched. | Nothing to do on your end — the user does this themselves (Profile → Sign out). |
| **Disable / suspend account** | Blocks sign-in without deleting anything. Reversible. | Supabase Dashboard → Authentication → user → **Ban user**. |
| **Cancel subscription** | Stops future billing. The WakeWise account and all personal data are untouched. | Stripe Dashboard (see below). |
| **Request account deletion (current model — Immediate Account Deletion)** | The user's own in-app action. Immediate and automated: cancels any active Stripe subscription, deletes the user's data, then removes the Auth user — all server-side, in one call, with no waiting period. | User-initiated only (Profile → Privacy and Account → Account management → Request account deletion → confirm). Nothing for an operator to do — see `supabase/functions/delete-account/index.ts`. |
| **Permanently delete / anonymise account (legacy, pre-existing 7-day requests only)** | The old model's manual completion step — see `docs/account-deletion-processor-spec.md`, now superseded for any NEW request. Still relevant only if a 'pending' row from BEFORE this change is still outstanding and its owner never completes/cancels it themselves. | Supabase Dashboard, following the processor spec, by hand — expected to be needed rarely or never going forward. |
| **Refund payment** | Returns money for a specific charge. Independent of everything else on this list — deleting an account never triggers or implies a refund. | Stripe Dashboard, only when you've deliberately decided to authorise one. |

These are all different actions. Picking the wrong one is the main risk
this table exists to prevent — e.g. "cancel subscription" never deletes
account data, and "delete account" never issues a refund.

## Supabase Dashboard

Project: the same Supabase project this app's `dev` branch is linked to
(confirmed live via `supabase migration list --linked` — see the audit
in the Safe Account Management report). **Preview and Production Vercel
deployments currently appear to point at this same project** — treat
every write here as potentially affecting real users, not just test
ones, until that is separately confirmed and resolved.

### Find a user by email or user ID
Authentication → Users → search by email. The UUID shown there is the
same `id` used everywhere else (`profiles.id`, `*.user_id`).

### View Auth status
Same Users list shows: confirmed/unconfirmed email, last sign-in, and
whether the account is currently banned. Click into a user for the full
detail view.

### View profile and related user data
Table Editor → `profiles`, filter `id = <uuid>`. Related rows:
`rhythms`, `journal_entries`, `user_intentions`, `subscriptions` — all
filter on `user_id = <uuid>`. Read-only browsing here is safe; **do not
hand-edit rows** unless you are deliberately following the processor
spec or a documented support fix — an ad-hoc edit here is exactly the
kind of "browser-accessible superuser" shortcut this runbook exists to
avoid.

### Identify any outstanding legacy ('pending') deletion requests
Under the current, immediate model, a NEW request never stays
`'pending'` — it moves straight through `'processing'` to `'completed'`
inside one call. A `'pending'` row today can only be a leftover from
BEFORE this change, still un-cancelled and un-completed by its owner.
Table Editor → `account_deletion_requests`, filter `status = eq.pending`.
Columns to check: `requested_at`, `scheduled_for`, `billing_status_at_request`.

Read-only SQL equivalent (SQL Editor, or `supabase db query --linked -f`):
```sql
select id, user_id, requested_at, scheduled_for, billing_status_at_request
from public.account_deletion_requests
where status = 'pending'
order by scheduled_for asc;
```

A row stuck at `status = 'processing'` for an unexpectedly long time
means a delete-account call started but never finished (e.g. the device
lost connectivity) — the account still fully exists in this case; the
user's own next visit to Account management offers to safely resume and
finish it themselves (see DeleteAccount.jsx). This is not something an
operator needs to intervene on unless the user reports being stuck.

### Disable / ban access temporarily
Authentication → Users → select user → **Ban user**. This is fully
reversible (Unban) and does not touch any data. Use this instead of any
deletion action when the goal is "stop this person signing in for now,"
not "remove their account."

### Trigger a password recovery email
Authentication → Users → select user → **Send password recovery**. This
uses Supabase's own `resetPasswordForEmail` flow — the same one
`Auth.jsx`'s "Forgot password?" link already uses — so it matches what a
user would trigger themselves.

### Review database records without editing unrelated data
Use Table Editor's filter bar (`user_id = eq.<uuid>` etc.) rather than
scrolling/sorting the whole table. Never bulk-edit or bulk-delete from a
table view — every write to a user's data should be traceable to a
specific, deliberate reason.

### Confirm whether deletion processing completed
`account_deletion_requests.status = 'completed'` and `completed_at` is
set. Cross-check that the corresponding Auth user no longer appears in
Authentication → Users, and that `profiles`/`rhythms`/`journal_entries`/
`user_intentions`/`subscriptions` rows for that `user_id` are gone (they
cascade-delete automatically the moment the Auth user is removed — see
the processor spec's step 8).

## Stripe Dashboard

### Find the same customer safely
Customers → search by email (the same email as the Supabase Auth user)
or by the `stripe_customer_id` value from that user's `subscriptions`
row in Supabase.

### View subscription status
Open the customer → Subscriptions tab. Shows current status, renewal
date, and whether `cancel_at_period_end` is set — this should match what
`subscriptions.status`/`cancel_at_period_end` shows in Supabase (the
webhook keeps them in sync; if they ever disagree, treat Stripe as the
source of truth for billing and investigate the webhook, not the other
way around).

### Cancel now or at period end
On the subscription → **Cancel subscription**, with the choice between
immediately or at period end. Per the account-deletion flow's own
copy shown to users ("cancelled at the end of your current billing
period... no refund for the current period"), prefer **at period end**
for a deletion-driven cancellation unless a specific situation requires
otherwise.

### Check invoices and payments
Customer page → Invoices / Payments tabs. This is Stripe's own retained
record — WakeWise's database does not duplicate invoice detail, only a
short `billing_status_at_request` classification on the deletion
request row.

### Issue a refund only when intentionally authorised
Payments tab → select the charge → **Refund**. Never do this as a side
effect of a cancellation or a deletion request — the in-app flow
explicitly never promises a refund, and one should only happen when you
have deliberately decided to authorise it (e.g. a billing error).

### Avoid deleting the Stripe customer before required billing records are reconciled
Do not use Stripe's "Delete customer" action as part of processing an
account deletion. It is unnecessary (Stripe retains its own invoice/
payment history against the customer object regardless of subscription
status) and removes your own ability to look up that billing history
later if a question comes up. The processor spec's step 3 only ever
*cancels* the subscription — it never deletes the Stripe customer
object.

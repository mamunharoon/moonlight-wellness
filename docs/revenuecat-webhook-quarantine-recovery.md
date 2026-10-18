# RevenueCat webhook — quarantined-event manual recovery procedure

**Status: documentation only. Confirms current operational reality and
describes the manual response — does not create a scheduler, does not
alter any subscription record, and does not run the procedure against a
real account as part of writing this document.**

## What "quarantined" means here

`supabase/functions/_shared/revenueCatWebhookHandler.js`'s
`processRevenueCatWebhookEvent` never applies a state-changing RevenueCat
event (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `UNCANCELLATION`,
`EXPIRATION`, `BILLING_ISSUE`, `PRODUCT_CHANGE`, `REFUND_REVERSED`) whose
`event_timestamp_ms` is missing, non-numeric, unparseable, or
unreasonably far in the future (beyond `CLOCK_SKEW_TOLERANCE_MS`, 5
minutes). The event is still recorded in `public.provider_events` for
audit/idempotency, but `apply_verified_apple_subscription_event`/
`apply_verified_google_subscription_event` is never called for it. The
function logs this at `console.error` with the literal prefix
`revenuecat-webhook: QUARANTINED (<reason>)` and reason
`missing_or_invalid` or `unreasonable_future` — this is the signal to act
on.

**Why this needs a manual (or scheduled) follow-up, not just a dashboard
glance**: quarantining prevents the ordering key itself from being
corrupted, but it does **not** resolve whatever the quarantined event was
actually trying to tell WakeWise. If it was a renewal, the account's
expiry stays at its old value until something else updates it. If it was
a cancellation/refund-driven status change, the account may still show
more access than it should. Neither direction self-corrects just because
the event was quarantined.

## Current reconciliation scheduling status (confirmed, not assumed)

Checked directly against the linked DEV project (`kvdxuhyndevrfvsalgnx`)
as of this document:

```sql
select extname from pg_extension where extname = 'pg_cron';
-- 0 rows
```

The `pg_cron` extension itself is **not installed** on this project —
there is no `cron.job` table to even hold a schedule. Combined with:

- `grep -r "cron.schedule\|pg_cron" supabase/migrations/` — no matches;
  no migration has ever created a scheduled job.
- `supabase/functions/reconcile-apple-subscriptions/index.ts`'s own
  header: *"NOT SCHEDULED OR DEPLOYED BY THIS TASK. No pg_cron entry, no
  external scheduler configuration... wiring an actual schedule is
  future, separate, deliberate work requiring explicit owner approval."*
- The Supabase CLI has no `cron`/`schedule` subcommand to check a
  dashboard-level schedule instead, and none is referenced anywhere in
  this repo's Codemagic/CI configuration.

**Conclusion: `reconcile-apple-subscriptions` is deployed (confirmed
`ACTIVE` via `supabase functions list`) but genuinely not scheduled by
any mechanism — pg_cron, an external cron, or a dashboard schedule.**
Nothing in this codebase currently re-verifies a stale Apple
`provider_subscriptions` row purely because time passed. This document
does not change that — scheduling it is a separate, explicit, future
decision, per that function's own header.

There is no equivalent reconciliation path at all for Google — this
procedure is Apple-only for the "re-verify against the provider
directly" step; a quarantined Google event has no automated recovery
mechanism today beyond waiting for a later, validly-timestamped event.

## Manual recovery procedure

### 1. Find quarantined events

Read-only; requires no special access beyond what's already used for
DEV read-only checks elsewhere in this project:

```sql
select provider, provider_event_id, event_type, user_id, processed_at, payload_summary
from public.provider_events
where processed_at > now() - interval '7 days'
order by processed_at desc;
```

`provider_events` does not itself record *why* an event was
acknowledge-only (quarantined vs. acknowledge-only-by-design, e.g.
`TEST`/`TRANSFER`) — cross-check against the Edge Function's own logs
(Supabase Dashboard → Edge Functions → `revenuecat-webhook` → Logs) for
the `QUARANTINED (<reason>)` line, which names the exact event
type/id/`app_user_id`. This is the authoritative source for "was this
one quarantined, and why."

### 2. Establish the real current state

For an **Apple** event: call the existing, already-reviewed
`verify-apple-transaction`-style verification directly — i.e. invoke
`verifyAndApplyAppleTransaction` (`supabase/functions/_shared/applyVerifiedAppleTransaction.ts`)
for the quarantined event's `original_transaction_id`. In practice today
this means triggering `reconcile-apple-subscriptions` **manually, once**,
for the affected account — it already re-verifies any `provider_subscriptions`
row (not just ones past its own 24h staleness window; the staleness
window only controls its *automatic* sweep criterion, the function itself
can be invoked directly) via Apple's own App Store Server API, using
Apple's JWS-signed data, not RevenueCat's payload. This is the "verified
provider reconciliation" alternative — it establishes truth independent
of whatever made the original event's timestamp malformed.

For a **Google** event: no equivalent function exists. The practical
manual steps are to read the real current state from the Play Console
(Monetize → Subscriptions → find the order/purchase token referenced in
the quarantined event's `payload_summary`) and compare it by hand against
the stored `provider_subscriptions` row for that `google_purchase_token`.

### 3. Safe replay after correction

Once the real state is known (via step 2, or because the underlying
cause — e.g. a RevenueCat-side payload bug — has since been fixed and a
corrected event is expected), replay is **safe by construction**, not
something requiring a special code path:

- **Apple**: `verifyAndApplyAppleTransaction`'s own write goes through
  `apply_verified_apple_subscription_event`, the same RPC, with
  `p_last_verified_at` taken from Apple's own `transaction.signedDate` —
  a real, verified timestamp. The RPC's existing staleness guard
  (unchanged by any of this work) means replaying is idempotent: if the
  quarantined event's effect has already been superseded by a later
  genuine event, this write is correctly rejected as stale; if not, it
  correctly applies. Nothing needs to be deleted or reset first.
- **Google** (or Apple without re-running reconciliation): if/when
  RevenueCat redelivers the SAME event with a corrected payload
  (RevenueCat's own retry policy, or a manual "resend" from the RevenueCat
  dashboard if available), it carries the same `event.id` — the
  `provider_events` unique constraint means this is a normal, already-
  idempotent redelivery, not a special "quarantine replay" case.
  `revenuecat-webhook` processes it exactly like any other event;
  if its `event_timestamp_ms` is now valid, it applies normally.
- **If no redelivery will ever happen** (e.g. the sending side will never
  resend that exact event): a human operator may re-derive the correct
  state from step 2 and issue the **same verified write a reconciliation
  pass would make** — for Apple, this is exactly what invoking
  `reconcile-apple-subscriptions` (or `verify-apple-transaction` with the
  known transaction id) already does safely; there is no separate
  "quarantine-specific" write path, and none should be built — reusing
  the existing, already-reviewed verification path is the point.

### What this procedure deliberately does not do

- Does not create a pg_cron job, external scheduler, or dashboard
  schedule for `reconcile-apple-subscriptions` — scheduling it remains a
  separate, explicit, future decision belonging to that function's own
  header, not something this document or any quarantine event should
  trigger unilaterally.
- Does not alter any subscription record as part of being written.
- Does not propose a Google reconciliation mechanism — flagged as a gap,
  not solved here.

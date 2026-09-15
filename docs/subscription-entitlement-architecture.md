# WakeWise — Channel-Specific Billing Architecture (Documented, Not Built)

**Status: documentation only.** Nothing in this document is implemented.
No migration has been applied. This exists so a future entitlement-model
migration can be reviewed and approved deliberately, not derived ad hoc.

## Current state (verified)

`public.subscriptions` — one row per user, upserted on `user_id`:

| Column | Type | Notes |
|---|---|---|
| `plan` | text | `'free' \| 'plus'` |
| `status` | text | `'trial' \| 'active' \| 'cancelled' \| 'expired'` |
| `provider` | text | `'manual' \| 'stripe' \| 'apple' \| 'google'` — the enum already anticipates Apple/Google, but no column captures anything channel-specific for them |
| `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id` | text, nullable | Stripe-only identifiers |
| `expires_at`, `cancel_at_period_end`, `started_at` | — | Populated by the Stripe webhook only |

**This table can represent exactly one purchase source's state per user, at a time.** It is a single current-state row, not a per-channel ledger. Concretely:

- If a user has both a lapsed Stripe subscription and a live Apple IAP, there is nowhere to record both — the `stripe_*` columns have no Apple/Google counterparts, and upserting a "new" channel's state overwrites the whole row.
- `mapStripeStatus()` in `supabase/functions/_shared/planMapping.ts` folds Stripe's `past_due` into our `active` (a deliberate short grace period) and `unpaid`/`incomplete` into `expired` — there is no distinct `past_due` or `grace_period` value stored today. A "payment failed" state is not separately representable; it hides inside `active` or `expired`.
- There is no `purchase_source` distinct from `provider` (they'd be the same concept, differently named) and no `last_verified_at` — nothing records when this row was last confirmed against the actual provider's own state, which matters once there's more than one channel to reconcile (e.g. a stale Apple receipt vs. a live Stripe subscription).
- There is no way to distinguish a standard annual subscription from a founding-member introductory-priced one at the data layer — only `stripe_price_id` differs, and nothing here labels *why* a given price id was used.

## Proposed normalized entitlement model (NOT a migration; for review)

A future migration could extend `subscriptions` (additively) or introduce a
new `entitlements` table with one row per (user, purchase_source) — the
second is the more correct fix for "represent multiple sources safely,"
since it stops forcing a single row to represent every channel:

```
entitlement_status   text   -- 'free' | 'trialing' | 'active' | 'grace_period'
                             -- | 'past_due' | 'cancelled_with_access'
                             -- | 'expired' | 'complimentary'
purchase_source       text   -- 'stripe' | 'apple' | 'google' | 'admin'
plan                   text
entitlement_start      timestamptz
entitlement_end        timestamptz nullable
auto_renew             boolean
last_verified_at       timestamptz  -- when this row was last confirmed
                                     -- against the provider's own truth
```

Status meanings, precisely (to stop conflating "still has access" with
"still paying," which the current two-value cancelled/expired split does
today):

- `free` — no paid entitlement.
- `trialing` — in a free trial, not yet charged.
- `active` — paying and current.
- `grace_period` — a renewal is temporarily unresolved (e.g. Apple's
  billing retry period) but access is preserved.
- `past_due` — a Stripe renewal has failed and is being retried; distinct
  from `grace_period` so the two providers' different retry semantics
  aren't forced into one bucket.
- `cancelled_with_access` — the user cancelled, but their already-paid
  period hasn't ended yet (the exact case this batch's audit could not
  confirm is actually configured in the live Stripe Customer Portal —
  see the Legal, Subscription and Free-Trial Readiness report).
- `expired` — no access, nothing pending.
- `complimentary` — admin-granted, no billing provider involved at all
  (today's `provider = 'manual'` case).

**One trusted access state, regardless of channel:** `entitlements.js`
(`isSubscribed`, `canUseX`) would resolve access from whichever
`purchase_source` row is currently most authoritative for that user
(highest-precedence non-expired entitlement — e.g. an active Apple
subscription should grant access even if a much older Stripe row on the
same account is `expired`), not from a single hardcoded provider.

## Channel-by-channel notes (documented, not implemented)

### 1. Stripe (web/PWA) — already implemented, foundation only
Server-verified via `stripe-webhook`. Reconciliation is real-time via
webhook events. `last_verified_at` would be "whenever the webhook last
wrote this row."

### 2. Apple In-App Purchase (future, not built)
Would require: server-side receipt/JWS transaction verification (Apple's
App Store Server API — never trust a client-reported purchase), a
webhook-equivalent (Apple Server Notifications V2) to react to
renewals/cancellations/refunds, and periodic re-verification since Apple
doesn't push every state change reliably. Apple's own App Store Review
Guideline 5.1.1(v) also requires in-app account deletion for apps that
support account creation — WakeWise already satisfies this (commit
528f911) independent of which purchase channel is active.

### 3. Google Play Billing (future, not built)
Similar shape: server-side purchase token verification via the Google
Play Developer API, Real-time Developer Notifications as the
webhook-equivalent. Google Play's account-deletion policy additionally
requires a **web-based** deletion path reachable without the app
installed (support.google.com/googleplay/android-developer/answer/13327111)
— WakeWise's current deletion flow is in-app only; a future Android
release would need a public web page or form offering the same request,
not just the in-app journey.

### 4. Admin-granted complimentary access
Already representable today (`provider = 'manual'`) via the existing
`admin_set_subscription_status()` RPC — no new work needed for this one
beyond folding it into the normalized `entitlement_status` vocabulary
above (`complimentary` instead of a bare `provider` check).

## What this document deliberately does not do

- It does not propose exact column-by-column SQL — that belongs in a
  dedicated migration proposal once Apple/Google integration is actually
  scheduled, following the same dry-run → approve → apply → validate
  process already used for `account_deletion_requests`.
- It does not implement Apple IAP or Google Play Billing.
- It does not change `entitlements.js`'s current single-provider
  resolution logic.

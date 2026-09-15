# WakeWise — Founding-Member Pricing: Recommendation (Not Activated)

**Status: documented recommendation only.** No Stripe or Apple product,
price, or offer has been created for this. Nothing in the live checkout
UI currently offers this price — see "Why this isn't wired into
Subscription.jsx yet" below.

## Required customer wording (as specified)

> Start with a 7-day free trial, then AUD $49.99 for your first year.
> Your subscription renews at AUD $59.99 per year unless cancelled
> before renewal.

This exact copy is implemented as `foundingMemberDisclosureText()` in
`src/lib/pricingConfig.js`, computed from the same `TRIAL_DAYS`,
`FOUNDING_ANNUAL_FIRST_YEAR_PRICE`, and `FOUNDING_ANNUAL_RENEWAL_PRICE`
constants the rest of the app's pricing display uses — so if the
renewal price ever changes, this sentence can't silently drift out of
sync with it. It is not yet called from any live screen.

Requirements it satisfies by construction:
- First-year price and later renewal price are both stated in the same
  sentence, never one without the other.
- Never describes $49.99 as a lifetime price — it explicitly says "your
  first year," then names the renewal price.
- Never conceals automatic renewal — "unless cancelled before renewal"
  is in the same sentence, not a footnote.

## Why this isn't wired into Subscription.jsx yet

`create-checkout-session` charges whatever Stripe Price id
`priceIdForInterval()` resolves to for `'monthly'` or `'yearly'` — there
is no third option today, and this task is explicitly not authorised to
create a new Stripe Price for the founding offer. Displaying "$49.99
first year" on a button that actually charges the standard annual Price
object would show a different price than what Stripe would actually
charge — precisely the "don't show a Stripe price that differs from the
trusted server-side Price" failure mode this readiness task exists to
prevent. So the founding-member copy stays in this document and in
`pricingConfig.js`'s exported string, ready to use, until a real Stripe
Price for the introductory offer exists and `create-checkout-session`
can route to it deliberately (e.g. a third `interval` value like
`'founding-annual'`, or a coupon/promotion-code approach — both are
reasonable, and the choice should be made when this is actually
scheduled, not implied here).

## Recommended eligibility window

Time-box it, don't run it as an evergreen "new user" price — an
open-ended "first year cheaper for everyone new" offer is functionally
just a lower standard price with an extra decision to explain to
customers and to the ACCC. A dated window is what makes "founding
member" a straightforward, honest, non-open-ended claim.

- Define an explicit start and end date/time for eligibility (e.g. tied
  to the initial beta-to-general-availability launch window) before
  building anything — do not launch this offer without one.
- Eligibility should be evaluated once, at the moment of a *new*
  subscriber's first checkout, not retroactively — existing Plus
  subscribers converting from an existing standard-priced subscription
  should not need special-casing here.
- Store which offer a subscriber actually purchased under, at the
  channel-specific entitlement level proposed in
  `docs/subscription-entitlement-architecture.md` (a `purchase_source`/
  price-id-level record), not as a boolean flag disconnected from their
  actual Stripe Price id — so "was this a founding-member subscriber"
  is always answerable from real billing data, not a separately
  maintained list that can drift out of sync.

## Recommended implementation approach (when scheduled)

1. Create the actual Stripe Price object for the $49.99 first-year
   offer (a one-time approval action, per this task's own stop
   conditions — not done here).
2. Extend `priceIdForInterval`/`PRICE_ENV_VAR_BY_INTERVAL` in
   `supabase/functions/_shared/planMapping.ts` with the new price id, or
   introduce a Stripe coupon/promotion code applied on top of the
   existing annual Price — a coupon is often simpler for a *first-year-
   only* discount, since Stripe coupons can be scoped to duration
   (`once` or a fixed number of billing cycles) without a second product
   to maintain long-term; a genuinely separate Price object is easier if
   the founding tier should ever have distinct downstream reporting.
3. Gate eligibility server-side in `create-checkout-session` (never
   trust a client-supplied "I'm eligible" flag) against the approved
   eligibility window from above.
4. Update `Subscription.jsx` to show `foundingMemberDisclosureText()`
   only while eligible, with the same "not preselected, not disguised"
   treatment the standard annual option already gets.
5. Re-run this task's Phase 11 test matrix against the founding flow
   specifically before enabling it for real users.

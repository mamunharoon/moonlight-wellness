# WakeWise — Apple Subscription Architecture and Stripe Compatibility Audit

**Compiled:** 2026-09-16, on `dev`, starting HEAD `a2f4e0457af30d386f2e7916edd9ceb91c89a221`.
**Method:** static repository audit (exact file/line citations throughout) plus primary-source research (Apple Developer Documentation, App Review Guidelines, and official/candidate library repositories — direct links and access dates in §17). No code was written, no dependency was installed, no dashboard was touched, no application behaviour changed. This is an architecture and planning document only.

**Update (2026-09-16 — "Implement Apple Server Verification and Notifications V2"):** §8's verification design is now implemented — see `docs/apple-subscription-implementation.md` Phase F. One real deviation from this section's own text: §8 says Apple's own App Store Server Library "is a first-party tool, not a third-party dependency" for JWS/certificate-chain verification; concrete testing found that library not safely usable in Supabase's current Deno-based Edge Runtime (cited GitHub issues, one of which explicitly names this exact library as the motivating case for a still-unimplemented Deno `node:crypto` API), so the implementation uses two other independently-maintained, WebCrypto-native libraries (`jose`, `@peculiar/x509`) instead — see Phase F §1 for the full evidence and reasoning. The verification flow itself (App Store Server API for client-triggered verification, App Store Server Notifications V2 for ongoing state, a scheduled reconciliation backstop), the security properties, and the provider-neutral schema this section describes are otherwise implemented as designed.

**Further update (2026-09-16 — "Securely Deploy Apple Subscription Edge Functions to DEV"):** §14's dashboard-action table is now mostly complete — App Store Connect product/offer/trial/founding-offer configuration is done, a dedicated App Store Server API key exists, and all six required secrets are configured in the linked DEV Supabase project. The three Edge Functions are deployed and runtime-smoke-tested against real (but non-Apple, non-purchase) HTTP requests. **Apple subscriptions remain operationally unverified — no genuine sandbox transaction has been attempted.** See `docs/apple-subscription-implementation.md` Phase H for the full record, including why this DEV deployment's notification URL must be registered as Apple's **Sandbox** Server URL only, never Production.

---

## 1. Executive recommendation

**Update (2026-09-16):** Phase 1 of this architecture has been implemented — see `docs/apple-subscription-implementation.md` for exactly what exists now (a confirmed-compatible client plugin, a platform-safe UI with Stripe hidden on iOS, a reviewed-but-unapplied schema, and fail-closed server-verification stubs) versus what still requires App Store Connect configuration, Apple credentials, sandbox testing, and physical-iPhone testing. This document's own recommendations below are otherwise unchanged and remain the design that implementation follows.

WakeWise's native iOS build **was not App-Review-safe** at the time this document was written: it let an iOS user complete a real Stripe purchase from inside the native app with zero platform branching (§3). The implementation above fixes the platform branching (Stripe is now hidden on iOS); it does not yet make Apple IAP itself functional (see the implementation document's classification of what remains).

**Recommended architecture, in one sentence:** keep Stripe exactly as-is for existing web subscribers; add a **provider-neutral entitlement model** (new `entitlements` + `provider_subscriptions` tables, §7) fed by two independent, mutually-unaware write paths — the existing Stripe webhook (unchanged) and a new set of Supabase Edge Functions that verify Apple transactions server-side via the real **App Store Server API** and **App Store Server Notifications V2** (never trusting a client-supplied JWS alone, §8) — with the native iOS purchase UI built on a maintained, StoreKit-2-wrapping Capacitor client library (§5) rather than a hand-rolled Swift bridge or a managed SaaS platform.

**Why this is the safest, most proportionate choice for a cost-conscious sole-trader launch:**
- It never makes the client the source of truth for entitlement (Apple's own signed transactions are necessary but not sufficient — see §8's "never trust the device" requirement, which several plugin ecosystems, including RevenueCat, actually satisfy correctly on their own servers, but which this recommendation keeps in WakeWise's own Supabase project rather than a third party's).
- It introduces **no new recurring paid dependency** and **no new third-party data processor** for subscriber transaction data — a real consideration for the Privacy Policy's sub-processor list and App Store Connect's privacy "nutrition label," both of which already exist and would need a new entry for a managed platform like RevenueCat.
- It reuses the existing Stripe webhook's proven idempotency/verification pattern (§7, §8) almost line-for-line, so the new Apple code path is auditable against a pattern this codebase has already had independently verified.
- **Resolved (2026-09-16):** the 7-day free trial and the AUD $49.99 founding first-year price cannot be combined as two introductory offers (Apple allows only one per subscriber, ever), but the founding offer is confirmed feasible through a genuinely different Apple mechanism — an **Offer Code** (Pay Up Front, one year, new-subscriber eligibility, explicitly configured not to also grant the introductory offer) — rather than a second introductory offer. See §6 and §16. This is a confirmed-feasible, approved configuration target, not yet created or tested in App Store Connect.

---

## 2. Existing Stripe implementation — full lifecycle audit

| Stage | File(s) | Exact behaviour |
|---|---|---|
| Pricing/paywall UI | `src/pages/Subscription.jsx`, `src/lib/pricingConfig.js` | `pricingConfig.js:27-28` — `MONTHLY_PRICE = 7.99`, `ANNUAL_PRICE = 59.99` (AUD, hardcoded display constants, not read from Stripe). `Subscription.jsx:126-139` — `handleUpgradeClick` → `startCheckoutFlow()` → `startCheckout(interval)`. |
| Checkout creation | `supabase/functions/create-checkout-session/index.ts` (full file read) | JWT-verified server-side (`:38-46`), anonymous/guest rejected (`:51-53`), only `interval` ever accepted from the client (`:62`) — price id resolved server-side via `priceIdForInterval` (`planMapping.ts:9-13`), never client-supplied. |
| Stripe customer creation/linking | `create-checkout-session/index.ts:69-103` | Reuses an existing `stripe_customer_id` if one is already stored; creates a new Stripe Customer and writes **only** `stripe_customer_id` (an identifier, not an entitlement) on first checkout. |
| Price IDs / env vars | `planMapping.ts:9-13`, `_shared/stripeClient.ts:14` | `STRIPE_PRICE_PLUS_MONTHLY`, `STRIPE_PRICE_PLUS_YEARLY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — names only, values never read. |
| Monthly/annual products | `planMapping.ts:9-12` | Exactly two intervals mapped, `'monthly'` / `'yearly'` → one price env var each. One paid plan (`plan='plus'`) regardless of interval — `entitlements.js`'s own header comment confirms this is deliberate. |
| Customer portal | `supabase/functions/create-portal-session/index.ts`, `Subscription.jsx:148-152` | Same JWT-verification pattern as checkout; opens Stripe's own hosted Customer Portal. |
| Cancellation | Stripe Customer Portal (hosted by Stripe, not this codebase) | WakeWise has no in-app cancel button — cancellation happens entirely inside the Stripe-hosted portal; the resulting `customer.subscription.updated`/`.deleted` webhook event is what actually updates WakeWise's own record. |
| Webhook endpoint | `supabase/functions/stripe-webhook/index.ts` | No user JWT (correct — Stripe calls this directly, `:4-8`). |
| Signature verification | `stripe-webhook/index.ts:98-114` | `stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret, undefined, Stripe.createSubtleCryptoProvider())` — rejects with 400 on failure, never reads the payload before this passes. |
| Handled webhook events | `stripe-webhook/index.ts:135,164-165` | **Exactly three**: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Every other event type is acked and ignored (`:189-192`) — **`charge.refunded` and `charge.dispute.created` are not handled**, so a Stripe-side refund alone does not revoke entitlement (see also §13, "refund/revocation lag"). |
| Subscription DB writes | `stripe-webhook/index.ts:57-83` (`applySubscriptionState`) | Single upsert on `subscriptions` keyed `ON CONFLICT (user_id)` — writes `plan='plus'` unconditionally, `status` via `mapStripeStatus`, `provider='stripe'`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `expires_at`, `cancel_at_period_end`. **One row per user — cannot represent a second, simultaneous provider's state** (core reason for the new schema in §7). |
| Access/entitlement checks | `src/lib/entitlements.js` (full file) | `isSubscribed(plan, status) = plan==='plus' && ['trial','active'].includes(status)` — the single source of truth every `canUseX` wrapper reads through (`:37-44`). |
| Trial UI claim vs. actual | `pricingConfig.js:25` (`TRIAL_DAYS = 7`), `Subscription.jsx:287` (`trialDisclosureText()`), **`create-checkout-session/index.ts:107-115`** | **Confirmed: the live `stripe.checkout.sessions.create()` call passes no `subscription_data.trial_period_days` field at all.** If a trial is actually applied today, it can only be coming from the Stripe **Price** object's own configured trial — this cannot be confirmed from the repository (secret Price configuration lives in the Stripe Dashboard) and is flagged again in this document rather than assumed either way. |
| Refund/revocation handling | `stripe-webhook/index.ts:134-192` | **Not handled** — see "Handled webhook events" above. A Stripe Dashboard-issued refund does not automatically revoke `plan='plus'` today. |
| Grace-period/past-due handling | `planMapping.ts:37-45` (`STRIPE_STATUS_MAP`) | `past_due` folds into `'active'` (a deliberate short grace period, not a distinct state); `unpaid`/`incomplete`/`incomplete_expired` fold into `'expired'`. No distinct `grace_period` or `billing_retry` state exists in the current schema (`subscriptions.status` CHECK constraint: `'trial'|'active'|'cancelled'|'expired'` only — `20260807210000_sprint2_subscriptions_foundation.sql:58`). |
| Account deletion + active subscription | `supabase/functions/request-account-deletion/index.ts:37-41` (`classifyBillingStatus`), `src/pages/DeleteAccount.jsx:348-397` | Billing status is classified server-side at request time (`'active-stripe'` / `'active-manual'` / none, `:37-41`) and **recorded**, not acted on — see §10 for the exact behaviour and its policy-text match. |
| Entitlement tied to auth user ID | `create-checkout-session/index.ts:42-46`, `stripe-webhook/index.ts:25-47` (`resolveUserId`) | Yes — every write path resolves the real Supabase user id server-side (from the verified JWT at checkout time, or from `stripe_subscription_id`/`stripe_customer_id` lookup at webhook time), never from client-asserted data. |
| Client-controlled subscription status | Repo-wide check | **None found.** No code path lets the browser set `plan`/`status`/`provider` directly — RLS on `subscriptions` grants `authenticated` **SELECT-own only** (no client write policy exists at all; confirmed directly against the live database in the prior "Apply and Verify Critical Profile-Privilege Hardening" task in this same series — the harden migration's Part 2 additionally stripped `anon`'s inert grants on this table). |
| Race/replay protection | `stripe-webhook/index.ts:118-131,201-210` | Idempotent by construction: event id checked against `stripe_webhook_events` **before** processing, recorded **only after** processing succeeds — a crash mid-processing is correctly retried by Stripe, never silently double-applied or silently skipped. |

**Summary judgement:** the Stripe implementation is well-designed and defensible as far as it goes (server-verified identity, no client-trusted state, idempotent webhook) — its real gaps are a missing trial parameter, missing refund handling, and a single-row schema that cannot coexist with a second provider. All three are addressed by this architecture (§7, §16).

---

## 3. Native Stripe / App Store compliance audit

**Every route/component reachable from a native iOS build that touches Stripe:**

| Path | File | What a native user can do today |
|---|---|---|
| `/subscription` | `src/pages/Subscription.jsx` | See hardcoded AUD prices (`pricingConfig.js`), tap "Upgrade" → `startCheckoutFlow()` → `startCheckout('monthly'\|'yearly')` |
| (same screen, once subscribed) | `Subscription.jsx:148-152` | Tap "Manage subscription" → `openBillingPortal()` |
| `/profile/delete-account`, billing step | `DeleteAccount.jsx:373-384` | Tap "Manage subscription in Stripe" → same `openBillingPortal()` |
| Underlying redirect | `src/lib/stripeApi.js:12-25` (full file) | `window.location.href = data.url` — a full-page navigation to Stripe's hosted Checkout/Portal, **inside the native WKWebView, with no platform branch of any kind** |

**Confirmed by direct search:** `isNativePlatform()` (the app's own, already-existing Capacitor platform-detection helper — `src/lib/platform.js:3`, already used correctly elsewhere: `useNativeDeepLinks.js:36`, `useMorningReminderNotificationTap.js:17`, `MorningReminderContext.jsx`) **appears zero times in `Subscription.jsx`, `stripeApi.js`, or `DeleteAccount.jsx`.** Nothing in this codebase hides, disables, or reroutes the Stripe purchase/manage flow on a native build.

### Exact Apple App Review risk

This is squarely **Guideline 3.1.1 (In-App Purchase)**, quoted directly from Apple's current App Review Guidelines (accessed 2026-09-16, full URL in §17):

> "If you want to unlock features or functionality within your app, (by way of example: subscriptions, in-game currencies, game levels, access to premium content, or unlocking a full version), you must use in-app purchase."

WakeWise's `plan='plus'` unlock (audio, AI, premium content, advanced insights, extended journaling — `entitlements.js:39-44`) is exactly this category. Today's native build lets a user complete that unlock via Stripe, inside the app, with **no in-app purchase involved at all** — this is a direct violation, not a marginal or reader-app-adjacent case, and does not depend on which country's App Store storefront the reviewer uses (the US-storefront external-link relaxation in Guideline 3.1.1(a)/3.1.3 only concerns **linking to a website**, not completing the purchase **inside the native app itself** — that distinction is not affected by the storefront exception at all).

**Checked and ruled out, per the task's explicit instruction not to assume:**
- **Reader-app exception (3.1.3(a)):** does not apply. Reader apps are for consuming content a user already subscribed to through an external, independent channel (the canonical examples are magazines/newspapers/books/audio/video subscription services like a publisher's own site) — WakeWise is not that shape of product; its subscription **is** the app's feature-unlock mechanism, which 3.1.1 governs directly.
- **Multiplatform-services exception (3.1.3(b)):** partially relevant but does **not** remove the IAP requirement — it explicitly states such items must **also** be available as in-app purchases within the app. This supports "recognise an existing Stripe subscriber's entitlement" as legitimate, but does **not** permit Stripe-only checkout inside the native app once Apple IAP could plausibly apply.
- **External Purchase Link Entitlement:** a real, separate Apple program (StoreKit External Purchase; §17 link) that lets an app **also** link out to a website for purchasing — it does not replace the IAP requirement for unlocking content in-app, requires a specific Apple entitlement application, and (outside the US storefront) still forbids buttons/calls-to-action directing to the external purchase inside the app in many regions. Not recommended as WakeWise's primary path — see §5.

### Required native iOS behaviour (design only — not implemented in this task)

- **Native Apple purchase presentation** must exist for a first-time iOS purchaser (§5, §11).
- **Restore Purchases** must exist once Apple IAP exists (Guideline 3.1.2 requires this for any app with restorable purchases).
- **Manage Subscription** on iOS is conventionally a deep link to the system Settings → Subscriptions screen (`itms-apps://apps.apple.com/account/subscriptions`), not the Stripe portal.
- **Existing Stripe subscriber sign-in/access:** the app **may** recognise a Stripe-purchased entitlement for a signed-in user on iOS (this is what the unified entitlement model in §7 is for) — but per 3.1.3(b) above, this can only ever be an **addition** to a working native IAP path, never a substitute for one.
- **Web-purchase CTAs/links/wording must be hidden on iOS.** The "Upgrade" button, its price display, and "Manage subscription in Stripe" must all be gated behind `isNativePlatform()` (or equivalent) so a native build never shows a Stripe purchase or portal entry point — this is the single most urgent, purely mechanical fix arising from this audit, and does not depend on any Apple-side implementation being ready first (see §16, decision requiring approval).

---

## 4. Primary-source links used in this document

All accessed 2026-09-16. Full citation list is repeated in §17; the most load-bearing are:
- App Review Guidelines (3.1.1, 3.1.3 quoted verbatim above): https://developer.apple.com/app-store/review/guidelines/
- StoreKit overview: https://developer.apple.com/documentation/storekit
- App Store Server API: https://developer.apple.com/documentation/appstoreserverapi
- App Store Server Notifications V2: https://developer.apple.com/documentation/AppStoreServerNotifications/App-Store-Server-Notifications-V2
- Implementing introductory offers in your app: https://developer.apple.com/documentation/storekit/implementing-introductory-offers-in-your-app *(page title confirmed; this session's fetch tool could not render the full JS-driven body text — the eligibility rule quoted in §6 is corroborated by consistent, repeated statements across Apple's own developer forums, cited inline, and should be re-confirmed by a human reading this exact page directly before implementation)*
- Capacitor official "In App Purchases" guide: https://capacitorjs.com/docs/guides/in-app-purchases
- RevenueCat `purchases-capacitor`: https://github.com/RevenueCat/purchases-capacitor
- Cap-go `capacitor-native-purchases`: https://github.com/Cap-go/capacitor-native-purchases
- Family Sharing for subscriptions: https://developer.apple.com/documentation/storekit/testing-family-sharing

---

## 5. Approach comparison

| Criterion | A. Own Capacitor iOS plugin (direct StoreKit 2) | B. Maintained Capacitor purchase plugin (e.g. Cap-go `capacitor-native-purchases`) | C. RevenueCat (`purchases-capacitor`) |
|---|---|---|---|
| Capacitor 7 compatibility | N/A — built in-house, so always compatible by construction | **Unconfirmed for this app.** Cap-go's plugin versions its major release to track Capacitor's major (its `v8` line targets Capacitor 8; WakeWise is pinned to Capacitor **7.6.9**). Must confirm a `v7`-line release exists and is maintained before adopting — not verified in this task (no dependency install performed, per instruction) | Compatibility not pinned to a specific Capacitor major in what this session could access; still must be confirmed against 7.6.9 before adopting, same caveat |
| StoreKit 2 support | Full — hand-written | Yes, directly ("Uses Apple's latest purchase APIs for iOS 15+" per its own docs) | Yes, wraps StoreKit under the hood with a documented "automatic" StoreKit-version selection |
| Maintenance activity | N/A (WakeWise-owned) | Active by its own repo signals (836 commits, 6 open PRs, 0 open issues at last check) but modest adoption (49 stars) | Actively maintained, backed by a funded company, large user base |
| Security model | Fully in WakeWise's control; also fully WakeWise's responsibility to get right | Client-side capture of the signed transaction; verification is left to the app (matches this document's recommended server design in §8) | RevenueCat's own servers verify transactions and are the source of truth for entitlement status by default |
| Server-verification support | Build in-house against App Store Server API/Notifications V2 (§8) | None built-in — same in-house server work required as Option A | Built-in (RevenueCat's core value proposition) |
| Restore Purchases | Must implement (StoreKit 2's `AppStore.sync()`/`Transaction.currentEntitlements`) | Exposed by the plugin | Exposed by the SDK |
| Subscription status/events | Must build from App Store Server API/Notifications V2 | Same — plugin does not provide this | RevenueCat's dashboard/webhooks provide this |
| App Store Server Notifications support | Build in-house (§8) | Not provided by the plugin | RevenueCat ingests and relays these for you |
| Data shared with third parties | None | None (client-side plugin only, no SaaS backend) | **Transaction/subscriber data flows to RevenueCat's platform** — a genuine new sub-processor |
| Privacy-disclosure implications | None new | None new | New Privacy Policy sub-processor entry and App Store Connect "nutrition label" data-sharing disclosure required |
| Vendor lock-in | None | Low (thin client wrapper, swappable) | Higher — entitlement data and history live in RevenueCat's system |
| Free tier / likely future cost | $0 forever (no vendor) | $0 forever (no vendor) | Has a free tier by tracked revenue; **do not cite a specific current threshold without checking RevenueCat's own current pricing page at implementation time** — pricing terms change |
| Required native Swift work | Significant — a real Capacitor plugin (Swift + Capacitor bridge boilerplate) must be authored and maintained | None (already built) | None (already built) |
| Testing complexity | Highest (own code, own bugs) | Moderate | Lowest (vendor has already tested the hard parts) |
| Long-term maintainability | Depends entirely on WakeWise's own ongoing Swift/StoreKit expertise | Depends on the plugin's continued maintenance | Depends on RevenueCat continuing to exist/be affordable |
| Unify with existing Stripe entitlements | Natural — same Edge Functions, same schema (§7) either way | Natural — same Edge Functions, same schema (§7) either way | Possible, but requires either trusting RevenueCat as a second source of truth **or** re-verifying its webhooks server-side anyway, which removes most of the benefit of adopting it |
| Risk of trusting client-side state | Zero, if §8 is followed | Zero, if §8 is followed | Zero if RevenueCat's own server verification is trusted as authoritative — but that is a **new** trust boundary outside WakeWise's own infrastructure |
| Suitability for a cost-conscious sole trader | High effort, but zero ongoing cost/dependency | **Best balance**, once Capacitor-7 compatibility is confirmed | Fastest to ship, but adds an ongoing SaaS dependency and a new data-sharing disclosure for a single-developer, privacy-conscious wellness app |

### Recommendation

**Option B** (a maintained, StoreKit-2-wrapping Capacitor client plugin), **paired with in-house server-side verification** (§8) rather than a managed platform — **conditional on confirming the plugin's actual Capacitor 7.6.9 compatibility before adoption**, which this task was explicitly instructed not to install dependencies to test. If no currently-maintained plugin proves Capacitor-7-compatible, **Option A** (a small, purpose-built native bridge — WakeWise's own reminder feature already demonstrates the team is comfortable authoring/testing a focused Capacitor-adjacent integration) becomes the fallback, not Option C. **Option C (RevenueCat) is not recommended** as WakeWise's primary path: it is the fastest to ship, but its core benefit (managed server-side verification) is exactly the piece this architecture already designs in-house at moderate cost (§8 mirrors the existing, already-proven Stripe webhook pattern), and adopting it would add a recurring third-party dependency, a new data-sharing disclosure, and a second source of truth to reconcile — disproportionate for a single-developer wellness app that already has a working idempotent-webhook pattern to copy.

**Update (2026-09-16 — "Implement the first safe, testable phase of native Apple subscriptions"):** the Capacitor-7 compatibility condition above is now resolved with real evidence, not merely assumed. `@capgo/native-purchases` version `7.19.3` (the maintainer's own `lts-v7` dist-tag) is confirmed peer-compatible (`"@capacitor/core": ">=7.0.0"`), genuinely wraps StoreKit 2 (verified directly from its installed iOS Swift source), and has been installed. Option B is no longer conditional — it has been implemented as Phase A of that task. One real consequence discovered during that verification, not anticipated here: the plugin's own podspec requires iOS 15.0 minimum, so WakeWise's deployment target was raised from 14.0 to 15.0 as part of adopting it (iOS 14 install eligibility is dropped — flagged as a decision for explicit confirmation, not a silent side effect). Full evidence, the exact selected version, and everything implemented on top of it are in `docs/apple-subscription-implementation.md`.

---

## 6. Apple product and offer feasibility

**Proposed subscription group and products** (all identifiers are proposals for App Store Connect — nothing has been created; see §14):

| Field | Proposed value |
|---|---|
| Subscription group | `wakewise_plus` ("WakeWise Plus") |
| Monthly product ID | `com.zavaraai.wakewise.plus.monthly` |
| Annual product ID | `com.zavaraai.wakewise.plus.annual` |
| Display names | "WakeWise Plus (Monthly)", "WakeWise Plus (Annual)" |
| Durations | 1 month / 1 year, both auto-renewable, same group (required so a subscriber can switch tiers within one group) |
| Territory/currency | Apple's global 900-point (up to 200 territory-specific points on newer subscription pricing) price-point system automatically localises from a chosen base price — **the exact price points that resolve closest to AUD $7.99 / $59.99 / $49.99 can only be selected and confirmed inside App Store Connect's own pricing UI at implementation time; this document cannot and does not claim specific tier numbers** (per the task's explicit instruction). GST/tax handling in Australia is Apple's own responsibility as the merchant of record for iOS in-app purchases — no WakeWise-side tax logic is needed for the Apple channel, unlike Stripe (where WakeWise is the merchant of record). |

### The core feasibility question: can the 7-day trial and the $49.99 founding first-year price both exist? — **RESOLVED, confirmed feasible 2026-09-16**

**This document's original research correctly established a narrower fact that still stands**: the 7-day free trial and a AUD $49.99 first-year price **cannot both be configured as two separate introductory offers** on the same product for the same subscriber — Apple limits a subscriber to exactly one introductory offer (Free Trial, Pay-As-You-Go, or Pay-Up-Front) per subscription group, ever, as a first-time subscriber only. That specific combination was, and remains, infeasible.

**What has since been confirmed from Apple's own official documentation is that the founding offer was never required to be a second introductory offer at all.** Apple's **Offer Codes** mechanism is a genuinely separate offer path from introductory offers — a merchant-configured, redeemable-code-gated offer (which can itself use a Pay-Up-Front price, among other types) that App Store Connect lets you explicitly configure as **not** combinable with a product's own introductory offer. This is not a workaround or an inference from this document's own reasoning — it is Apple's documented, first-class mechanism for exactly this kind of "give a specific cohort a different one-time deal without touching the standard introductory offer every other new subscriber sees" scenario, and it removes the "one introductory offer" constraint from the equation entirely, because an offer code redemption and an introductory offer are two different things Apple tracks separately, with an explicit switch to keep them from stacking.

### What Apple's mechanisms can and cannot do here

- **Introductory offers** (trial, pay-as-you-go, pay-up-front) — for **new, first-time** subscribers to the group only; **one per subscriber per group, ever**. WakeWise uses exactly one: the standard 7-day free trial.
- **Offer codes** — a distinct, App-Store-Connect-configured offer (not merely a distribution wrapper around an introductory offer, as this document's earlier draft understated) — redeemable via a code, can itself specify an offer type (including Pay-Up-Front), a customer-eligibility scope (e.g. "New subscribers"), and a duration. Critically, App Store Connect asks explicitly, at configuration time, **whether a customer who redeems an offer code should also still be eligible for the product's separate introductory offer** — WakeWise's founding offer answers **"No"** to that question, which is what actually keeps the trial and the founding offer mutually exclusive, not merely reliance on the "one introductory offer" rule (that rule alone would not have prevented the two from stacking, since they are structurally different mechanisms).
- **Promotional offers** — for **existing or previous** subscribers only, not first-time signups; more flexible (custom eligibility, custom pricing) but require WakeWise's own server to generate a signed JWS for every redemption. Not used for the founding offer (offer codes are the approved mechanism instead) — retained here only as background on the option space.
- Eligibility, offer availability by date, and volume limits are all configured **in App Store Connect at the product/offer level**, not enforced from application code.

### Approved implementation — **confirmed feasible, not yet configured or tested**

1. **Standard customers**: the existing 7-day free trial remains the introductory offer for eligible monthly or annual subscribers — unchanged from this document's original design.
2. **Founding members**: implemented as an **Apple offer code**, not a second introductory offer:

   | Field | Approved value |
   |---|---|
   | Product | `com.zavaraai.wakewise.plus.annual` |
   | Customer eligibility | New subscribers |
   | Offer type | Pay Up Front |
   | Duration | One year |
   | Australian price | AUD $49.99 |
   | Renewal | Automatically renews at the standard AUD $59.99 annual price unless cancelled |
   | Combinable with the introductory offer? | **No** — set explicitly in App Store Connect's offer-code configuration |

3. **A subscriber cannot receive both** — enforced by App Store Connect's own "No" answer above, not by application code and not merely inferred from the one-introductory-offer-per-subscriber rule.
4. **Standard subscribers who do not redeem the founding offer code may still receive the 7-day trial wherever Apple reports them eligible** — the two populations are not the same decision point; a subscriber who never sees or redeems a founding offer code simply goes through the ordinary introductory-offer path.
5. **Eligibility and offer/transaction state must be Apple/server-verified — never granted from a client-supplied flag.** Unchanged from this document's existing design (§8): a client never asserts "I redeemed the founding offer" or "I am trial-eligible" as something the server trusts at face value; the server-side App Store Server API/transaction data is what determines it. `docs/apple-subscription-implementation.md`'s Phase B UI copy ("a free trial or introductory offer may be available — the App Store will show your exact eligibility and terms") already matches this, since it defers to Apple rather than promising anything client-side, and needs no change for this mechanism.
6. **Status: feasible, confirmed from Apple's official documentation — but the offer code itself has not been created, and nothing has been configured or tested in App Store Connect.** This is recorded as a resolved feasibility question and an approved configuration target, not as completed work. See §14/§16 and `docs/ios-xcode-handoff.md` §15 for the exact remaining App Store Connect and sandbox steps.

The three commercial alternatives this document originally weighed before the offer-code mechanism was confirmed (founding-only with no trial; trial-only with no founding offer; a follow-up Promotional Offer after trial conversion) are superseded by the approved offer-code approach above and are kept only as a historical record of the reasoning, not as live alternatives still being considered.

### Other feasibility answers

- **Monthly ↔ annual switching:** supported — both products belong to the same subscription group, which is exactly what makes upgrade/downgrade/crossgrade between them possible via StoreKit's own subscription-group mechanics (immediate for an upgrade to a higher-service-level tier per Apple's ranking within the group, otherwise at the next renewal).
- **Upgrade/downgrade behaviour:** governed entirely by the subscription group's configured **service-level ranking** in App Store Connect (not by application code) — must be set explicitly when the group is created (§14).
- **Existing Stripe subscribers on Apple:** recognised via the unified entitlement model (§7) — they are **not** silently migrated to an Apple product; they simply keep working through Stripe until they either keep using the web or separately choose to subscribe again via Apple. **Approved (2026-09-16):** if a user ends up with both a Stripe and an Apple entitlement simultaneously, **access continues while either remains active — the two are never merged into one billing record, and neither provider's expiry is artificially extended by the other's.** See §7's own updated resolution rule.
- **Family Sharing: approved (2026-09-16) — remains disabled.** No App Store Connect action was taken to enable it (this document's own recommendation not to enable it as a default was accepted as-is); if this is revisited later, it is a one-way decision (Apple does not allow turning it back off once enabled) and would need a fresh, explicit approval at that time.

---

## 7. Unified entitlement architecture

### Decision: extend vs. replace

**Recommended: introduce two new, provider-neutral tables (`entitlements`, `provider_subscriptions`) rather than extending `subscriptions` further.** The existing `subscriptions` table is architecturally a **single-provider snapshot** (one row per user, `ON CONFLICT (user_id)` upserts throughout §2) — it cannot represent "this user has both a lapsed Stripe subscription and an active Apple one" without a redesign that would itself be riskier than adding new tables alongside it. `docs/subscription-entitlement-architecture.md` already independently proposed this exact direction ("Documented, Not Built" — a per-purchase-source entitlements table with precedence rules); this section makes it concrete enough to implement.

**No migration is created in this task**, per instruction — this is the proposed schema for a future implementation task to write as an actual migration.

```
-- Proposed schema (illustrative SQL, NOT a migration to be run)

-- One row per user: the single, precedence-resolved answer to
-- "does this user currently have WakeWise Plus, and until when."
-- This is the ONLY table entitlements.js-equivalent code should read.
create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'plus')),
  status text not null default 'active'
    check (status in ('trial','active','grace_period','billing_retry','cancelled','expired','refunded','revoked')),
  active_provider text check (active_provider in ('stripe','apple','google','manual')),
  expires_at timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

-- One row per (user, provider, provider-specific subscription identity):
-- the full evidence trail. Multiple rows per user are expected and
-- normal (a lapsed Stripe row + a live Apple row, for example).
create table public.provider_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('stripe','apple','google','manual')),
  -- Provider-specific identifiers — nullable because each provider only
  -- populates its own column(s); never a shared/overloaded key.
  stripe_customer_id text,
  stripe_subscription_id text,
  apple_original_transaction_id text,   -- the stable, renewal-spanning Apple identity
  apple_app_account_token uuid,          -- see §9 — links a purchase to this user_id
  google_purchase_token text,            -- reserved for a future Android extension
  product_id text,                       -- e.g. com.zavaraai.wakewise.plus.annual, or the Stripe price id
  status text not null
    check (status in ('trial','active','grace_period','billing_retry','cancelled','expired','refunded','revoked')),
  current_period_expires_at timestamptz,
  cancel_at_period_end boolean not null default false,
  environment text check (environment in ('production','sandbox')), -- Apple only; see §8
  last_verified_at timestamptz not null default now(),
  raw_last_event jsonb, -- minimum evidence retained — see §7's retention note below
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Exactly one live row per provider identity — the idempotency/replay
  -- backstop for both Stripe (already proven, §2) and the new Apple path.
  constraint provider_subscriptions_stripe_sub_unique
    unique (provider, stripe_subscription_id),
  constraint provider_subscriptions_apple_txn_unique
    unique (provider, apple_original_transaction_id)
);

-- Append-only audit trail — minimum evidence for dispute/support/legal
-- purposes, mirroring stripe_webhook_events' own idempotency-marker
-- pattern (§2) but generalised to every provider.
create table public.provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe','apple','google')),
  provider_event_id text not null, -- Stripe event.id, or Apple notificationUUID
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  processed_at timestamptz not null default now(),
  payload_summary jsonb, -- non-sensitive fields only — see retention note
  constraint provider_events_unique unique (provider, provider_event_id)
);

create index provider_subscriptions_user_id_idx on public.provider_subscriptions (user_id);
create index provider_events_user_id_idx on public.provider_events (user_id);

alter table public.entitlements enable row level security;
alter table public.provider_subscriptions enable row level security;
alter table public.provider_events enable row level security;

-- Same owner-SELECT-only pattern already proven correct on `subscriptions`
-- (live-verified in the prior "Apply and Verify Critical Profile-Privilege
-- Hardening" task): authenticated users read only their own row; every
-- write happens via service-role Edge Functions, never a client policy.
create policy entitlements_select_own on public.entitlements
  for select to authenticated using (auth.uid() = user_id);
create policy provider_subscriptions_select_own on public.provider_subscriptions
  for select to authenticated using (auth.uid() = user_id);
-- provider_events is never client-readable at all (support/audit only,
-- accessed exclusively via the service role or a future admin RPC).
```

### Requirements checklist

| Requirement | How this schema satisfies it |
|---|---|
| Stripe + Apple + future Google | `provider_subscriptions.provider` is an open enum already including `'google'`; no redesign needed for a future Android extension |
| One account across web/iOS | `entitlements` is keyed on `user_id` alone, precedence-resolved from every `provider_subscriptions` row for that user |
| Multiple provider records, no double-granting | `entitlements` is a single derived row per user, recomputed (not summed) from `provider_subscriptions` — "double-granting" is structurally impossible since there is only one entitlement row to grant from |
| Provider-specific identifiers | Separate nullable columns per provider, never a shared/overloaded key |
| Full state set (active/trial/grace/retry/cancelled/expired/refunded/revoked) | `status` CHECK constraint lists all eight explicitly — a real extension of today's four-value `subscriptions.status` |
| Current-period expiry, cancel-at-period-end | Present on both tables |
| Last server verification | `provider_subscriptions.last_verified_at` |
| Idempotent event processing | `provider_events` mirrors `stripe_webhook_events`' proven check-before-process pattern (§2), generalised |
| Event history/audit evidence | `provider_events` is append-only |
| Conflict resolution | **Approved (2026-09-16):** the *access* decision is a pure OR across every one of a user's `provider_subscriptions` rows — if **either** a verified Stripe row or a verified Apple row is in an access-granting status, the user has access; the two are **never merged into one billing record, and neither provider's expiry is used to artificially extend the other's.** A precedence function (not shown as SQL here — belongs in an Edge Function or a `SECURITY DEFINER` recompute routine, implemented in this project as the pure `resolveEntitlement()` in `src/lib/entitlementResolution.js`) still has to pick exactly one row's own real data to *report* as `entitlements.active_provider`/`expires_at` for display purposes when more than one row is simultaneously active — the implemented tie-break for that reporting choice only (not for the access decision itself) is "the most-recently-verified row's own unaltered data wins." This original row's earlier wording ("the row with the latest `current_period_expires_at` wins") was corrected here to match what was actually implemented and approved — it never merges or extends an expiry either way. |
| Restore Purchases | Re-running Apple verification for the restored transaction's `apple_original_transaction_id` naturally upserts the same row (unique constraint) rather than creating a duplicate |
| Account changes | Recompute is idempotent and cheap enough to re-run on any relevant event |
| Family Sharing | Deliberately **not** modelled in this schema yet — see §6/§16, a business decision, not solved by table design alone |
| Account deletion | See §10 |
| Minimum required evidence retention | `provider_events.payload_summary` — **non-sensitive fields only** (event type, product id, expiry, status — never the full JWS, never anything from Stripe beyond what's already captured). This satisfies "retain minimum transaction evidence" without accumulating raw payment payloads |

### Non-negotiable security properties (all satisfied by the design above, none require new invention)

- **Client never grants itself premium access** — `entitlements`/`provider_subscriptions` have no client-writable RLS policy at all, exactly matching the already-verified pattern on `subscriptions`.
- **Apple JWS/transaction payloads are not trusted merely because the device supplied them** — see §8; every write to `provider_subscriptions` for Apple must come from a server-side call to the real App Store Server API or a verified App Store Server Notification, never from a client-submitted transaction object taken at face value.
- **Service-role operations stay server-side** — new Edge Functions only, same pattern as every existing Stripe function.
- **Users read only their own entitlement** — RLS as shown above.
- **Webhooks/notifications are idempotent and replay-safe** — `provider_events` unique constraint, same proven pattern as `stripe_webhook_events`.
- **Provider identifiers expose no unnecessary personal information** — `apple_original_transaction_id` and `stripe_subscription_id` are opaque provider identifiers, not personal data; no Apple ID, email, or device identifier is ever stored.

---

## 8. Apple transaction verification architecture

### What belongs where

| Layer | Responsibility |
|---|---|
| **Native iOS client** (StoreKit 2, via the chosen library from §5) | Presents products, initiates purchase, receives the locally-signed `Transaction`/`JWSTransaction`, calls `AppStore.sync()` for restore. **Never itself decides entitlement.** |
| **React/Capacitor layer** | Sends the transaction identifiers (not raw entitlement claims) to a new Edge Function immediately after a successful client-side purchase, for the app to reflect optimistic "verifying…" UI (§11) while the server confirms |
| **Supabase Edge Functions** (new) | The only place that calls the real Apple App Store Server API, verifies JWS signatures against Apple's certificate chain, and writes to `provider_subscriptions`/`entitlements` — exactly mirroring `stripe-webhook`'s existing trust boundary |
| **Database** | Stores only the verified, server-derived state (§7) |
| **Scheduled reconciliation process** | A periodic (e.g. daily) Edge Function invocation (via `pg_cron` or an external scheduler) that calls the App Store Server API's "Get All Subscription Statuses" for any `provider_subscriptions` row not verified recently — the explicit backstop for a missed/delayed Server Notification (see below) |

### Verification flow (proposed, no code written)

1. Client completes a StoreKit 2 purchase → receives a signed `Transaction`.
2. Client calls a new `verify-apple-transaction` Edge Function with the transaction id and the current user's JWT (so the function can verify identity exactly like `create-checkout-session` already does).
3. The Edge Function calls Apple's **App Store Server API** "Get Transaction Info" (or verifies the client-submitted JWS directly against Apple's published root certificates — both are legitimate; the Server API path is recommended since it additionally confirms Apple's own servers currently agree the transaction is valid, not just that it was validly signed at some point).
4. On success, the function upserts `provider_subscriptions` (keyed on `apple_original_transaction_id`) and recomputes `entitlements` for that user.
5. **App Store Server Notifications V2** (a separate, independent HTTPS webhook Apple calls directly, not client-driven) is the primary mechanism for everything that happens **after** the initial purchase — renewal, cancellation, grace period, refund, revocation — handled by a second new Edge Function, `apple-server-notifications`, structured exactly like `stripe-webhook/index.ts` (§2): verify the notification's JWS signature, check `provider_events` for idempotency before processing, write only after success.
6. The scheduled reconciliation process (above) is the backstop for a **missed** notification — Apple's own documentation and developer-forum discussion (§4, §17) acknowledge notification delivery is not unconditionally guaranteed exactly-once or zero-latency, so polling "Get All Subscription Statuses" periodically for any stale row is the correct defensive design, mirroring how this codebase already treats Stripe webhook processing as retryable rather than assumed-reliable.

### Specific technical requirements

- **JWS signature and certificate-chain verification**: verify against Apple's own root of trust (Apple provides the verification library/approach in its App Store Server Library — a first-party tool, not a third-party dependency) — never trust an unverified payload.
- **Production vs. sandbox environments**: every verified transaction/notification carries an explicit `environment` field (`Sandbox` or `Production`) — this must be checked and stored (`provider_subscriptions.environment`) so a sandbox transaction can never silently grant production entitlement, and vice versa. **This task's own instruction is "Apple sandbox only during development, no live Apple payments in this phase"** — the verification code must enforce, not merely assume, this boundary once implementation begins.
- **Original transaction ID vs. transaction ID**: the *original* transaction id is the stable identity across every renewal of one subscription lifetime — this, not the per-event transaction id, is the correct unique key (`provider_subscriptions.apple_original_transaction_id`).
- **App account token**: see §9 — the mechanism for linking a purchase to a specific Supabase user id.
- **Bundle ID and product ID allow-listing**: exactly mirroring `knownPlusPriceIds()`'s existing defensive pattern (`planMapping.ts:31-33`) — a verified transaction is only ever trusted if its bundle id matches `com.zavaraai.wakewise` and its product id is one of the exact proposed identifiers in §6, never inferred from the notification type alone.
- **Environment validation**: see above.
- **Replay/idempotency handling**: `provider_events` unique constraint on `(provider, provider_event_id)`, exactly mirroring `stripe_webhook_events`.
- **Notification history/recovery**: Apple's App Store Server API includes an endpoint for requesting notification history for a given time window — usable for backfilling a gap if the reconciliation process finds evidence of one.
- **Refund/revocation handling**: `REFUND`/`REVOKE` notification types (§4's confirmed notification-type list) must map to `status='refunded'`/`'revoked'` in `provider_subscriptions`, triggering an `entitlements` recompute — this is the exact gap already flagged in Stripe's own webhook (§2) and must not be repeated for Apple.
- **Grace period and billing retry**: `GRACE_PERIOD` and `DID_FAIL_TO_RENEW` (with appropriate subtypes, §4) map to the new `grace_period`/`billing_retry` states this schema adds beyond what `subscriptions` currently supports.
- **Clock and expiry handling**: `current_period_expires_at` is always taken from Apple's own signed transaction data, never computed client-side or assumed from a fixed interval — the same discipline `stripe-webhook`'s `expiresAt` already follows (`stripe-webhook/index.ts:64-65`).

### Required Edge Functions (names only — no secrets, no code)

- `verify-apple-transaction` — client-triggered, post-purchase verification (step 2-4 above)
- `apple-server-notifications` — Apple-triggered webhook (step 5 above)
- `reconcile-apple-subscriptions` — scheduled reconciliation (step 6 above)

### Required secrets (names only — never values)

- `APPLE_ISSUER_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY` (App Store Server API signing key, ES256)
- `APPLE_BUNDLE_ID` (or reuse the existing app-wide bundle id constant)
- `APPLE_APP_STORE_SERVER_NOTIFICATIONS_SHARED_SECRET` (if required by the chosen verification library — confirm against the App Store Server Library's current setup requirements at implementation time)

---

## 9. Identity and account-linking design

**Recommendation: require authentication before purchase, not pre-auth/anonymous purchase.** WakeWise already requires sign-in before Stripe checkout (`create-checkout-session/index.ts:51-53` rejects anonymous sessions) — the same rule should apply to the Apple path for consistency, and because it is the only design that lets `appAccountToken` cleanly carry the real Supabase `user_id` from the very first purchase, rather than needing a post-hoc claim/merge flow for guest purchases.

| Requirement | Design |
|---|---|
| Persist `appAccountToken` safely | Set StoreKit 2's `Product.PurchaseOption.appAccountToken` to a UUID **derived from (not equal to) the Supabase `user_id`** at purchase time — e.g. store the raw `user_id` as a UUID directly in the token field (StoreKit's `appAccountToken` is itself a UUID), and persist it in `provider_subscriptions.apple_app_account_token` for cross-checking on every subsequent verification |
| Restore on the same account | `AppStore.sync()` + `Transaction.currentEntitlements` returns the same `apple_original_transaction_id` — the unique constraint (§7) means re-verifying it simply re-confirms the existing row for the same `user_id`, a safe no-op |
| Detect a transaction already linked to another WakeWise account | The `provider_subscriptions_apple_txn_unique` constraint means a **second** user attempting to claim the same `apple_original_transaction_id` will conflict — the verification Edge Function must detect this conflict explicitly and refuse to reassign it (never silently overwrite the existing `user_id`), instead surfacing a clear "this Apple subscription is already linked to a different WakeWise account" error |
| Prevent entitlement theft via restore | Directly solved by the above — restore only ever confirms a transaction for **the account that purchased it** (via the stored `appAccountToken`) or fails closed |
| Apple ID different from Supabase email | Irrelevant by design — nothing in this architecture ever reads or stores the Apple ID or its associated email; identity is carried entirely through `appAccountToken` → `user_id`, never through email matching |
| Logout/login as another WakeWise user | `Transaction.currentEntitlements` reflects the **device's** App Store account, not the app's signed-in Supabase user — the UI must therefore always verify server-side against the *currently signed-in* `user_id`, never assume the device's Apple purchase history belongs to whoever happens to be signed into WakeWise right now |
| Anonymous/guest mode | Not supported for purchase (see recommendation above) — a guest must sign in or create an account first, exactly matching the existing Stripe gate's UX (`create-checkout-session/index.ts:51-53`; `Subscription.jsx`'s own guest gate, per its existing comment referenced in earlier audits of this repo) |
| Account merge / support escalation | Out of scope for automatic handling — the "already linked to another account" conflict case above should be surfaced as a support-contactable error state, not silently resolved by the app |
| User deletion and later re-registration | See §10 — the deleted account's `provider_subscriptions` row must not be silently reassignable to a new account merely because the same Apple ID re-subscribes; the unique constraint prevents automatic reattachment, and any manual reattachment must be a deliberate support action, not an automatic one |

---

## 10. Account deletion and subscription handling

### Apple

- **WakeWise genuinely cannot cancel an Apple subscription on the user's behalf** — Apple, not WakeWise, is the merchant of record for IAP; only the subscriber (via Settings → Subscriptions, or the in-app Manage Subscription deep link, §3/§11) or Apple itself can end it.
- **Recommendation: account deletion should proceed regardless of an active Apple subscription**, exactly as the existing Stripe-side policy already does (`DeleteAccount.jsx:373-378`'s Stripe copy: continuing does not itself stop billing) — the alternative (blocking deletion until the user manually cancels in Settings) would be a materially worse user experience for a right likely protected under Australian Privacy Act / consumer-data-request expectations, and does not actually prevent the underlying problem (Apple will keep billing the user's Apple ID regardless of what WakeWise's own account state is).
- **UI must clearly warn**, before the user confirms deletion, that Apple billing will continue independently and direct them to Apple's own Manage Subscriptions screen if they also want to stop being charged (§11) — this is new required wording, not implemented in this task (§16).
- **Minimum transaction records to retain**: the same class of evidence `provider_events`/`provider_subscriptions` already keeps (§7) — non-identifying transaction/financial-record data, consistent with `docs/account-deletion-processor-spec.md`'s existing "billing-record retention carve-out" principle for Stripe, extended to Apple. `provider_subscriptions.user_id` should be nulled (not cascaded) on final account deletion — mirroring `account_deletion_requests.user_id`'s existing `ON DELETE SET NULL` design (`20260915100000_account_deletion_requests.sql`) — so a completion audit record survives without remaining personally attributable.
- **Prevent silent reattachment to another account**: covered by §9's unique-constraint design — a deleted account's `apple_original_transaction_id` cannot be silently claimed by a different `user_id` without hitting the same conflict path a live theft attempt would hit.

### Stripe

- **Current actual behaviour, confirmed by code (§2, §10 audit above):** account deletion does **not** cancel the Stripe subscription immediately, and does **not** automatically cancel it at period end either — `request-account-deletion/index.ts` only **records** billing status (`classifyBillingStatus`, `:37-41`) at request time. Actual Stripe-side cancellation is deferred to the still-manual `docs/account-deletion-processor-spec.md` process.
- **This matches the existing legal copy** (`DeleteAccount.jsx:376`: "it will be cancelled at the end of your current billing period when your deletion request is processed") — the written policy and actual behaviour already agree (a manual-processor promise, not an automatic one) — **no inaccuracy found here to correct in the register.**

### Required legal/UI wording changes (design only, not implemented)

- New Apple-specific deletion-flow copy paralleling the existing Stripe billing step (`DeleteAccount.jsx:373-384`): if `provider_subscriptions` shows an active Apple row, show "You have an active WakeWise Plus subscription through Apple. Deleting your WakeWise account does not cancel your Apple subscription — manage or cancel it in iPhone Settings → [Apple ID] → Subscriptions." with a deep link (§11) alongside the existing Stripe-specific copy.
- `legalContent.js`'s Account Deletion Policy should be extended (not implemented here) to state the same Apple-specific fact once the feature exists — it currently only describes the Stripe case.

---

## 11. Native UI requirements

| Requirement | Design | Maps to existing component/route |
|---|---|---|
| Native pricing display | StoreKit-returned localised `Product.displayPrice` strings only — never the hardcoded `pricingConfig.js` AUD constants on iOS | `Subscription.jsx` gains a platform branch; `pricingConfig.js`'s constants remain web-only |
| Monthly/annual selection | Same visual pattern already used for Stripe's interval choice | `Subscription.jsx`'s existing interval-selection UI, re-pointed to native purchase on iOS |
| Trial/offer eligibility messaging | Must reflect `Product.subscription.isEligibleForIntroOffer` (or the App Store Server API's equivalent server-confirmed signal) — never assume every visitor is trial-eligible, since Apple's own "one introductory offer per subscription group, ever" rule (§6) means a returning subscriber will not be | New — no existing equivalent |
| Purchase / purchasing / pending / error states | New state machine around the StoreKit 2 async purchase call plus the `verify-apple-transaction` round-trip (§8) — "purchasing…" (client) → "verifying…" (server round-trip) → success/error | New — no existing equivalent (`Subscription.jsx`'s current Stripe flow is a full-page redirect, structurally different) |
| Restore Purchases | A visible button calling `AppStore.sync()`, replacing/supplementing the comment in `Subscription.jsx:31-39` that currently documents Restore Purchases as deliberately removed for the Stripe-only model | `Subscription.jsx` (new button, iOS-only) |
| Manage Subscription | Deep link to `itms-apps://apps.apple.com/account/subscriptions` on iOS, replacing the Stripe portal button (`Subscription.jsx:148-158`, `DeleteAccount.jsx:380-384`) for native users | Both files, iOS-branched |
| Existing web-subscriber state | If `entitlements.active_provider === 'stripe'`, iOS UI should show "You're subscribed via the web" with a Manage-Subscription-in-Stripe-is-web-only note, rather than offering to purchase again | `Subscription.jsx`, new state |
| Expiry/grace-period state | Surface `entitlements.status` directly (`grace_period`/`billing_retry` get their own honest copy, not silently folded into "active" the way Stripe's `past_due` currently is, §2) | `Subscription.jsx`, extends `STATUS_EXPLANATIONS` (referenced in the release-readiness register's earlier audit of this file) |
| **No Stripe Checkout CTA on native iOS** | `isNativePlatform()` gate around every Stripe entry point (§3) — the single highest-priority, purely mechanical fix from this whole audit | `Subscription.jsx`, `DeleteAccount.jsx` |
| No misleading hard-coded Apple price | Never render `pricingConfig.js`'s AUD constants as if they were the Apple price — always the live StoreKit `displayPrice` | `Subscription.jsx` |
| Links to Privacy Policy / Terms | Already exist (`Subscription.jsx:290-295` per earlier audit) — must remain visible on the native purchase screen too | `Subscription.jsx` |
| Automatic-renewal disclosure | Apple requires explicit renewal-terms disclosure adjacent to the purchase button (length, price, auto-renewal, cancellation instructions) — new copy, not yet written | `Subscription.jsx`, new copy block |
| Accessibility | Match the app's existing focus-visible/aria patterns already used elsewhere (e.g. the reminder feature's `WeekdayPicker`, `Toggle` components) — no new pattern needed, reuse existing | `Subscription.jsx` |
| Network-loss recovery | The purchase state machine above must distinguish "StoreKit succeeded, verification failed to reach the server" from "purchase itself failed" — the former must retry verification (idempotently — §8) without prompting a second real purchase | New |
| Double-submit prevention | Disable the purchase button for the duration of the async call, exactly the same pattern `Subscription.jsx`'s existing `startCheckoutFlow`/`handleManageSubscription` already use (`loading`-state gating, referenced in earlier audits of this file) | `Subscription.jsx` |

---

## 12. Sandbox and test plan

| # | Scenario | Automated (unit/CI) | Apple Sandbox | Physical iPhone |
|---|---|---|---|---|
| 1 | First monthly purchase | Verification-function logic (mocked Apple response) | ✅ required | ✅ required |
| 2 | First annual purchase | Same | ✅ | ✅ |
| 3 | Seven-day trial (if retained per §6 decision) | Eligibility-decision logic | ✅ | ✅ |
| 4 | Trial ineligibility (returning subscriber) | Eligibility-decision logic | ✅ | — |
| 5 | Founding offer eligibility/ineligibility | Eligibility-decision logic | ✅ | — |
| 6 | Successful purchase → entitlement granted | `entitlements` recompute logic | ✅ | ✅ |
| 7 | User cancellation (Settings) | Notification-handler logic (mocked `DID_CHANGE_RENEWAL_STATUS`) | ✅ | ✅ |
| 8 | App-side purchase error | Client error-state handling | ✅ | — |
| 9 | Ask-to-Buy / pending (Family Sharing, if enabled) | — | ✅ | ✅ |
| 10 | Renewal | Notification-handler logic (`DID_RENEW`) | ✅ | — |
| 11 | Billing retry | Notification-handler logic (`DID_FAIL_TO_RENEW`) | ✅ | — |
| 12 | Grace period | Notification-handler logic (`GRACE_PERIOD` subtype) | ✅ | — |
| 13 | Expiry | Notification-handler logic (`EXPIRED`) | ✅ | — |
| 14 | Refund | Notification-handler logic (`REFUND`) | ✅ (sandbox refund tooling) | — |
| 15 | Revocation | Notification-handler logic (`REVOKE`) | ✅ | — |
| 16 | Upgrade/downgrade | Recompute + precedence logic | ✅ | ✅ |
| 17 | Restore on same device | — | ✅ | ✅ |
| 18 | Restore on another device | — | ✅ | ✅ (2 devices) |
| 19 | Restore under the wrong WakeWise account | Conflict-detection logic (§9) unit test | ✅ | ✅ |
| 20 | Logout/login | — | — | ✅ |
| 21 | Reinstallation | — | — | ✅ |
| 22 | Offline launch | Client-side cached-entitlement fallback logic | — | ✅ |
| 23 | Delayed/missed server notification | Reconciliation-function logic | ✅ (can be forced via sandbox timing) | — |
| 24 | Duplicate/replayed notification | Idempotency unit test (`provider_events` conflict) | ✅ | — |
| 25 | Stripe subscriber logging into iOS | Recompute/precedence unit test | — | ✅ |
| 26 | Apple subscriber logging into web | Same | — | ✅ (+ desktop browser) |
| 27 | Account deletion with active Apple subscription | Deletion-flow unit test (§10) | ✅ | ✅ |
| 28 | Account deletion with active Stripe subscription | Already covered by existing `request-account-deletion` tests (none currently exist at the component/integration level per the earlier release-readiness audit — flagged again here, not new) | — | — |

---

## 13. Security and privacy threat model

| Threat | Mitigation | Severity if unmitigated |
|---|---|---|
| Forged client entitlement | Server never trusts client-asserted `plan`/`status` — same as today's proven Stripe design; Apple path adds JWS/cert-chain verification (§8) | **Critical** |
| Forged or replayed Apple transaction | Cert-chain verification + App Store Server API cross-check + `provider_events` idempotency | **Critical** |
| Webhook replay (Apple or Stripe) | `provider_events`/`stripe_webhook_events` unique-constraint idempotency, already proven for Stripe | **High** |
| Product-ID substitution | Allow-list check against the exact proposed identifiers (§6, §8), mirroring `knownPlusPriceIds()` | **High** |
| Bundle-ID/environment mismatch | Explicit bundle-id and `environment` field checks on every verification (§8) | **High** |
| Cross-user restore theft | `appAccountToken` + unique-constraint conflict detection (§9) | **Critical** |
| Race conditions (concurrent verification calls) | Unique constraints make the database itself the race arbiter, same pattern the existing `account_deletion_requests` partial-unique-index already uses for exactly this purpose | **Medium** |
| Duplicate granting | `entitlements` is a single recomputed row, not an accumulator — structurally cannot double-grant (§7) | **Medium** |
| Stale premium access after cancellation/expiry | Scheduled reconciliation (§8) as the backstop for a missed notification | **High** |
| Refund/revocation lag | Explicit `REFUND`/`REVOKE` handling (§8) — the exact gap already found (unfixed) in the existing Stripe webhook (§2); this design must not repeat it for Apple, and fixing the pre-existing Stripe gap should be considered alongside this work | **Medium** |
| Leaked Apple API credentials | Secrets named, never valued, in this document (§8); stored only as Supabase Edge Function secrets, never client-bundled | **Critical** |
| Sensitive transaction logging | `provider_events.payload_summary` stores only non-sensitive fields (§7) — never a full JWS or raw payload | **Medium** |
| Client-bundle secrets | The App Store Server API private key must never ship in the iOS bundle — server-side only, exactly like `STRIPE_SECRET_KEY` today | **Critical** |
| Malicious deep links | Out of scope of this feature specifically — the app's existing deep-link allow-listing pattern (`useNativeDeepLinks.js:19`, already audited and hardened) should be extended, not redesigned, if any new subscription-related deep link is added | **Low** (for this feature) |
| Account-deletion abuse (delete-then-reclaim entitlement) | Unique constraints + nulled (not cascaded) `user_id` on `provider_subscriptions` (§7, §10) prevent silent reattachment | **Medium** |

---

## 14. Required dashboard actions

**Update (2026-09-16 — "Securely Deploy Apple Subscription Edge Functions to DEV"): items 1, 2, 2a, 5, and 7 below are now done** — see `docs/apple-subscription-implementation.md` Phase H for the full record. Items 6 and 8 remain deliberately not done (Phase H's own instruction was not to configure App Store Connect further). Table retained below for the historical/planning record, with completed items struck through.

| # | Action | System |
|---|---|---|
| 1 | ~~Create the `wakewise_plus` subscription group, service-level ranking, and both products (§6 identifiers)~~ — **done.** "WakeWise Plus" group; `com.zavaraai.wakewise.plus.monthly`/`.annual`. | App Store Connect |
| 2 | ~~Configure the standard 7-day trial introductory offer (§6, approved)~~ — **done.** One-week trial, 175 storefronts, no end date, both products. | App Store Connect |
| 2a | ~~Create the founding-member offer code~~ — **the offer mechanism is configured** (`com.zavaraai.wakewise.plus.annual`, New subscribers, Pay Up Front, one year, AUD $49.99, renews at $59.99, does not combine with the introductory trial) — **but the actual redeemable production code `WAKEWISEFOUNDING` cannot be generated until the app passes App Review and reaches Ready for Distribution** — Apple's own constraint, still pending. | App Store Connect → the subscription → Offer Codes |
| 3 | Select price points closest to AUD $7.99/$59.99/$49.99 across territories | App Store Connect — status not confirmed by this task; not re-verified |
| 4 | Family Sharing — no action; approved 2026-09-16 to remain disabled | App Store Connect (deliberately not touched) |
| 5 | ~~Generate an App Store Server API key~~ — **done.** "WakeWise App Store Server", Key ID `K863527LV5`, created separately from Codemagic's existing key. | App Store Connect → Users and Access → Integrations |
| 6 | Configure the App Store Server Notifications V2 URL — **still not done, deliberately.** The exact URL to use is now known: `https://kvdxuhyndevrfvsalgnx.supabase.co/functions/v1/apple-server-notifications` (register as the **Sandbox** Server URL only — see `docs/apple-subscription-implementation.md` Phase H §6 for why this DEV/sandbox-configured deployment must not also be the Production URL). | App Store Connect |
| 7 | ~~Set the new Apple-related secrets~~ — **done.** All six confirmed present by name in the linked DEV Supabase project (values never printed or committed — see Phase H §3). | Supabase Edge Function secrets |
| 8 | Create sandbox tester Apple IDs | App Store Connect → Users and Access → Sandbox — not done, required before any real sandbox test |

**Can be done independently of code, once the commercial decision in §16 is made:**

| # | Action | System |
|---|---|---|
| 9 | None identified — every Apple-side action above depends on the product/offer decision (§6/§16) being made first, and every dashboard action depends on either the product existing or the Edge Function existing |

**Stripe configuration changes, if any:** none required by this architecture — Stripe continues exactly as-is (§2, §7). If the previously-flagged missing `trial_period_days`/`charge.refunded` handling gaps (§2) are separately fixed, that is application code, not a dashboard action, and is out of this task's scope.

---

## 15. Staged implementation plan

1. ~~**Commercial decision** (§6/§16) — resolve the trial-vs-founding-offer conflict and the Family Sharing question.~~ **Done, approved 2026-09-16** — standard trial + founding offer code (not a second introductory offer), Family Sharing disabled. What remains is execution, not decision: creating and configuring the offer code in App Store Connect, then sandbox-testing it (§14/§16, `docs/ios-xcode-handoff.md` §15).
2. **Native-visibility fix** (§3/§11) — gate every existing Stripe CTA behind `isNativePlatform()`. This is independent of every Apple-side item below and is the single most urgent fix from this entire audit; it could ship before any Apple work begins.
3. **Schema migration** (§7) — `entitlements`, `provider_subscriptions`, `provider_events`, RLS, indexes. No behaviour change yet (nothing writes to these tables until step 5).
4. **Confirm client-library Capacitor 7 compatibility** (§5) — resolve the open compatibility question before writing any Swift/plugin-dependent code.
5. **Server verification Edge Functions** (§8) — `verify-apple-transaction`, `apple-server-notifications`, `reconcile-apple-subscriptions`, built and tested against Apple's sandbox environment only, per this task's explicit constraint.
6. **Native purchase UI** (§11) — StoreKit 2 product presentation, purchase flow, Restore Purchases, Manage Subscription deep link.
7. **Account-deletion copy updates** (§10) — Apple-specific warning text.
8. **Legal copy updates** — Account Deletion Policy / Subscription Terms extended for the Apple channel (content only, legal review still required per the existing release-readiness register's standing finding that all legal content is unreviewed).
9. **Sandbox test pass** (§12) — every "Apple Sandbox" row in the matrix.
10. **Physical-iPhone test pass** (§12) — every "Physical iPhone" row.
11. **App Store Connect product/offer setup** (§14, items requiring implementation first).
12. **Fix the two pre-existing, independently-discovered Stripe gaps** (§2: missing `trial_period_days`, missing refund handling) — not required for Apple compliance, but directly relevant to the "unified entitlement" promise and flagged here so they are not lost.

---

## 16. Explicit unresolved decisions requiring user approval

**Update (2026-09-16): items 1, 2, 4, and 6 below are now approved/decided** — see the "Approved (2026-09-16)" notes in §6 and §7 above for the exact decisions. Item 3 was separately resolved by real implementation evidence in `docs/apple-subscription-implementation.md` Phase A. Kept here, marked, rather than deleted, so the historical record of what was open and when it closed stays intact. **No item in this list remains open as a commercial or platform-behaviour decision as of this update — the only remaining work against any of them is App Store Connect configuration, deployment, and testing, none of which is a decision still awaiting approval.**

1. ~~**Trial vs. founding-offer conflict (§6)**~~ — **RESOLVED, confirmed feasible and approved 2026-09-16**: the standard 7-day trial remains the introductory offer; the founding offer is implemented as an **Apple offer code** (product `com.zavaraai.wakewise.plus.annual`, New-subscriber eligibility, Pay Up Front, one year, AUD $49.99, renews at $59.99, explicitly configured **not** to also grant the introductory offer). This is a confirmed-feasible, approved configuration target — **not yet created or tested in App Store Connect.** See §6.
2. ~~**Family Sharing (§6, §14)**~~ — **RESOLVED, approved 2026-09-16: remains disabled.**
3. ~~**Client library choice (§5)**~~ — **RESOLVED by implementation**: `@capgo/native-purchases@7.19.3` (`lts-v7`) confirmed Capacitor-7.6.9-compatible from real registry/source evidence and installed — see `docs/apple-subscription-implementation.md` Phase A.
4. ~~**`provider_subscriptions` conflict-resolution tie-break rule (§7)**~~ — **RESOLVED, approved 2026-09-16**: access is a pure OR across providers (either verified entitlement is sufficient), never merged or artificially extended; "most-recently-verified row's own data wins" is only the tie-break for which single row's real data is *reported*, not for whether access is granted. See §7.
5. **Whether to fix the two pre-existing Stripe gaps (§2, §15 step 12) as part of this work or as a separate task** — **done**: both were fixed as Phase D of `docs/apple-subscription-implementation.md` (still listed here for the historical record, not because it is still open).
6. ~~**Whether to pursue the StoreKit External Purchase Link Entitlement (§3) at all**~~ — **not open; already rejected.** WakeWise will not pursue or display an external purchase link on iOS. Platform behaviour is fixed: native iOS uses Apple IAP; web uses Stripe; existing verified Stripe subscribers retain access on iOS (via the unified entitlement model, §7) without WakeWise ever needing an external-link entitlement to make that work. This document's earlier "still open" framing was a stale artifact of the original research pass and is corrected here, not a re-opening of the question.
7. **`autoAcknowledgePurchases`** — approved to keep the plugin's documented default *unless* its StoreKit 2 implementation requires WakeWise-controlled acknowledgement for server verification to work correctly; the actual verified behaviour must be documented (via macOS/Xcode/sandbox testing — none of which has happened yet) before any change away from the default is made. See `docs/apple-subscription-implementation.md`'s own note on this.
8. **New (2026-09-16): iOS 14 → 15 deployment target increase — approved.**

---

## 17. Primary-source links (accessed 2026-09-16)

- App Review Guidelines (3.1.1, 3.1.3, External Purchase entitlements): https://developer.apple.com/app-store/review/guidelines/
- StoreKit documentation home: https://developer.apple.com/documentation/storekit
- Implementing a store using the StoreKit API: https://developer.apple.com/documentation/storekit/implementing-a-store-in-your-app-using-the-storekit-api
- Implementing introductory offers in your app: https://developer.apple.com/documentation/storekit/implementing-introductory-offers-in-your-app
- App Store Server API: https://developer.apple.com/documentation/appstoreserverapi
- App Store Server Notifications V2: https://developer.apple.com/documentation/AppStoreServerNotifications/App-Store-Server-Notifications-V2
- App Store Server Notifications — Enabling: https://developer.apple.com/documentation/appstoreservernotifications/enabling-app-store-server-notifications
- App Store Server Notifications — Receiving: https://developer.apple.com/documentation/appstoreservernotifications/receiving-app-store-server-notifications
- App Store Server Notifications — Changelog: https://developer.apple.com/documentation/appstoreservernotifications/app-store-server-notifications-changelog
- Testing Family Sharing: https://developer.apple.com/documentation/storekit/testing-family-sharing
- Auto-renewable Subscriptions overview: https://developer.apple.com/app-store/subscriptions/
- Capacitor official "In App Purchases" guide: https://capacitorjs.com/docs/guides/in-app-purchases
- Capacitor Community Plugins index: https://capacitorjs.com/docs/v7/plugins/community
- RevenueCat `purchases-capacitor` (GitHub): https://github.com/RevenueCat/purchases-capacitor
- Cap-go `capacitor-native-purchases` (GitHub): https://github.com/Cap-go/capacitor-native-purchases
- StoreKit External Purchase entitlements: https://developer.apple.com/documentation/storekit/external_purchase

**Note on research limitations:** several Apple pages returned only a title/metadata to this session's fetch tool rather than full rendered body text (JS-driven documentation pages); where that happened, the claim in this document is explicitly marked as corroborated-via-secondary-discussion-of-the-primary-source rather than a direct quote, and flagged for a human to re-confirm by reading the linked page directly before implementation. No claim in this document asserts a specific current Apple price-tier number, RevenueCat pricing figure, or plugin Capacitor-version compatibility without an explicit "requires verification at implementation time" caveat, per the task's instruction.

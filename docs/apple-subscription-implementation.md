# WakeWise — Apple Subscriptions, Phase 1 Implementation

**Compiled:** 2026-09-16, on `dev`, starting HEAD `c5292be7e67c4fbebf7ad20069c9729a053d3eba`.
**Scope:** the first safe, testable phase of native Apple subscriptions, per `docs/apple-subscription-architecture.md`. No real purchase, no build upload, no external dashboard touched, no Apple credential committed.

**Read this document alongside:**
- `docs/apple-subscription-architecture.md` — the design this phase implements (unchanged in its recommendations; a few sections below note where real evidence sharpened or corrected it).
- `docs/release-readiness-register.md` — updated pointers, Workstreams C/D/E.
- `docs/ios-xcode-handoff.md` — updated with the exact dashboard/device steps this phase could not do.

---

## 0. Do not claim more than this actually proves

**Apple billing is not complete.** Nothing in this phase creates a real purchase, verifies a real transaction, or grants entitlement from an Apple purchase. What exists after this phase is: a compatible, installed client library; a platform-safe UI that never shows Stripe on iOS; a reviewed, unapplied schema; and Edge Functions that are deliberately, honestly non-functional until Apple credentials and App Store Connect configuration exist. Completion still requires, in order: App Store Connect product/offer setup, Apple Developer API credentials, applying the two new migrations to the live project, real App Store Server API/Notifications V2 implementation, Apple sandbox testing, and physical-iPhone testing. None of that happened here.

---

## Phase A — Plugin compatibility gate

### Recorded versions (before any change)

| Component | Version |
|---|---|
| `@capacitor/core` | 7.6.9 |
| `@capacitor/ios` | 7.6.9 |
| `@capacitor/cli` | 7.6.9 |
| `@capacitor/app` | 7.1.2 |
| `react` / `react-dom` | 18.3.1 |
| iOS deployment target (`project.pbxproj`, `Podfile`) | 14.0 |

### Candidates assessed, with real evidence (not package name/README/memory)

| Candidate | Evidence gathered | Verdict |
|---|---|---|
| `@revenuecat/purchases-capacitor` | Excluded by explicit instruction ("Do not adopt RevenueCat") — not evaluated further. | Excluded |
| `cordova-plugin-purchase` (the package Capacitor's own official "In App Purchases" guide, https://capacitorjs.com/docs/guides/in-app-purchases, currently recommends) | `npm view`: v13.18.0, MIT. Real-world research (WebSearch, cited in `docs/apple-subscription-architecture.md` §17) confirms v13.15+ can run StoreKit 2 under the hood via `cordova-plugin-purchase-storekit2`, but its own maintainer's more recent guidance is that **Capacitor users should prefer a native Capacitor bridge instead, since v13.15** — it is a large, general-purpose Cordova plugin (Android/iOS/Windows/UWP) with a correspondingly large, non-Capacitor-idiomatic event-based API surface, not "the smallest maintained plugin that meets the requirements." | Not selected |
| `@capgo/native-purchases` **latest** (`8.7.0`) | `npm view @capgo/native-purchases peerDependencies` → `{"@capacitor/core": ">=8.0.0"}`. **Incompatible** with this project's installed Capacitor 7.6.9. | Incompatible (latest) |
| `@capgo/native-purchases` **`lts-v7` dist-tag (`7.19.3`)** | `npm view ... dist-tags` → `{ "lts-v7": "7.19.3", "latest": "8.7.0" }` — the maintainer explicitly publishes and tags a long-term-support line for Capacitor 7. `npm view @capgo/native-purchases@7.19.3 peerDependencies` → `{"@capacitor/core": ">=7.0.0"}` — **confirmed compatible**. `types` field → `dist/esm/index.d.ts` (real TypeScript definitions, fetched and read in full — 1073 lines). Its own README compatibility table: `v7.*.* / Capacitor v7.*.* / Maintained: "On demand"` — noted honestly below, not overstated as fully "✅" like the current major. `podspec`/`Package.swift` both declare **iOS 15.0 minimum** (`s.ios.deployment_target = '15.0'`, `.iOS(.v15)`) — this project's 14.0 target had to rise; see "Native project changes" below. iOS Swift source read directly (`ios/Sources/NativePurchasesPlugin/*.swift`, after install, from `node_modules`, not a web summary): genuinely wraps StoreKit 2 (`import StoreKit`; `Product`, `Transaction`, `AppStore` types; `async`/`await`; a `for await result in Transaction.updates` listener loop) — not the legacy `SKProduct`/`SKPaymentQueue` API (one incidental `SKPaymentQueue` reference exists only for legacy-transaction cleanup inside `restorePurchases`). `restorePurchases()`, `manageSubscriptions()`, `getProducts()`/`getProduct()`, `addListener('transactionUpdated', …)` and `addListener('transactionVerificationFailed', …)` all present and typed. `appAccountToken` is captured and exposed on both the purchase result and every delivered `Transaction`. `jwsRepresentation` (the StoreKit 2 signed transaction, App Store Server API v2-compatible) is exposed for server-side verification — never interpreted as verified by the plugin or by this app's own adapter. License MPL-2.0 (a real, permissive-enough dependency license; does not affect this app's own license, only the plugin's own source). **Real limitation found by reading `Product+CapacitorPurchasesPlugin.swift` directly**: despite the TypeScript `Product` interface declaring `subscriptionPeriod`, `introductoryPrice`, `discounts`, and `subscriptionGroupIdentifier` as present fields, the actual iOS mapping code returns only `identifier`, `description`, `title`, `price`, `priceString`, `currencyCode`, `isFamilyShareable` — those four fields are commented out, never populated, on iOS. This is a genuine gap between the package's declared types and its iOS behaviour, not assumed from documentation. | **Selected** |

### Decision

**`@capgo/native-purchases`, version `7.19.3`** (the `lts-v7` dist-tag), installed with `--save-exact`.

**Why this one, not the alternatives:** it is the smallest, most Capacitor-idiomatic, genuinely StoreKit-2-wrapping option that is actually confirmed peer-compatible with this project's installed Capacitor 7.6.9 — verified from real npm registry metadata and the plugin's own shipped source, not assumed. `cordova-plugin-purchase` works but is a much larger, non-Capacitor-native surface that Capacitor's own docs increasingly steer away from for Capacitor apps. RevenueCat was excluded by explicit instruction, consistent with `docs/apple-subscription-architecture.md`'s own recommendation to keep server-side verification in-house.

**Honest caveat carried forward, not hidden:** the plugin's own README rates its `v7.*.*` line as "Maintained: On demand," not the same active-maintenance guarantee as its current `v8` major. This is an acceptable, disclosed trade-off for a cost-conscious, Capacitor-7-pinned launch — a future task upgrading to Capacitor 8 (a separate, larger decision, not made here) would let WakeWise move to the actively-maintained `v8` line of the same plugin with no adapter-shape change, since `src/lib/applePurchaseAdapter.js` is the only file that imports it directly.

### Native project changes required by this decision (made, not hidden)

The plugin's own podspec/`Package.swift` require iOS 15.0. This project's deployment target was 14.0. **Raised to 15.0** in both:
- `ios/App/Podfile` (`platform :ios, '15.0'`)
- `ios/App/App.xcodeproj/project.pbxproj` (all 4 `IPHONEOS_DEPLOYMENT_TARGET` occurrences, Debug/Release × build config)

**Consequence, disclosed, not a silent side effect:** WakeWise can no longer install on iOS 14 devices. Given the task's own timeframe (2026) and Apple's own real-world iOS adoption curves, iOS 14 install share is expected to be negligible — but this is a real product-facing change or record here for the user to be aware of, not merely a "no big deal" assumption. `IPHONEOS_DEPLOYMENT_TARGET` was NOT raised on `pod install`/Xcode run in this task — CocoaPods and Xcode are both unavailable on this Windows machine (see "macOS/Xcode limitations" below); the project files reflect the change, but it has not been exercised.

`npx cap sync ios` was run after installing: confirmed `Found 3 Capacitor plugins for ios: @capacitor/app@7.1.2, @capacitor/local-notifications@7.0.7, @capgo/native-purchases@7.19.3`. It automatically added `pod 'CapgoNativePurchases', :path => '../../node_modules/@capgo/native-purchases'` to the Podfile — no manual edit was needed for that line. `pod install` itself could not run (CocoaPods not installed on Windows) — expected, same limitation category as every prior iOS-native task in this series.

`npm audit` after install: 13 vulnerable packages, all pre-existing transitive dependencies of the existing toolchain (`vite`, `vitest`, `esbuild`, `react-router`, `@capacitor/cli`, `@trapezedev/project`, `@vitest/mocker`, `sharp`, `tar`, `uuid`, `xcode`, `@capacitor/assets`) — **confirmed none are `@capgo/native-purchases` itself or a new transitive dependency it introduced.**

---

## Phase B — Platform-safe subscription UI

### Architecture

`src/lib/applePurchaseAdapter.js` is the **only** file that imports `@capgo/native-purchases` directly — every plugin call (`getProducts`, `purchaseProduct`, `restorePurchases`, `manageSubscriptions`, `addListener('transactionUpdated', …)`) is wrapped here and exposes only plain, allow-list-checked, non-sensitive results. `src/pages/Subscription.jsx` (and any future component) calls this adapter, never the raw plugin — mirroring `stripeApi.js`'s existing role for Stripe exactly.

### Platform behaviour

`IS_NATIVE_IOS` (`isAppleIAPSupported()` from the adapter, itself `isNativePlatform() && isIOS()` from the existing `src/lib/platform.js`) is computed once and gates every Apple-specific branch in `Subscription.jsx`:

- **Web**: unchanged — Stripe interval toggle, price display, "Upgrade to WakeWise Plus" (Stripe Checkout redirect), "Manage subscription" (Stripe Customer Portal). No behavioural change from before this task.
- **Native iOS**: the Stripe interval/price/upgrade block and the Stripe "Manage subscription" button are **never rendered**. Instead: an Apple purchase block (StoreKit-sourced `priceString`, never a hard-coded price — `pricingConfig.js`'s AUD constants are never rendered on iOS), a "Subscribe with Apple" button, a "Restore Purchases" button (always visible on iOS, per Apple's own restore-accessibility expectation), and, once a `provider === 'apple'` entitlement can genuininely exist (not yet, in this phase), an Apple "Manage subscription" button that deep-links via the plugin's `manageSubscriptions()` call.
- **Existing Stripe subscriber on iOS**: `plusActive` (from `SubscriptionContext`, unchanged, reads the same `subscriptions` table on every platform) still gates the whole purchase block off — an existing Stripe subscriber sees their real "Current plan"/status exactly as before, with no purchase prompt. If `subscription.provider === 'stripe'` on iOS, an informational message ("You're subscribed via the web…") replaces the (hidden) Stripe portal button — no Stripe UI is ever shown, but the user is told the truth about where to manage it.

### Purchase/restore state machine (all required states)

| Required state | Implementation |
|---|---|
| Loading | `appleProductsState === 'loading'` (product fetch) |
| Unavailable | `appleProductsState === 'unavailable'` (product fetch failed/empty) or a purchase `outcome: 'unavailable'` |
| Cancelled | `applePurchaseState === 'cancelled'` — **not** treated as an application error; shown as a neutral status message |
| Pending | `applePurchaseState === 'verifying'` (server round-trip in flight) |
| Purchased | the StoreKit purchase itself resolving is what drives `'verifying'` — see "Never grants access…" below for why there is no separate lingering "purchased" UI state beyond that |
| Failed | `applePurchaseState === 'failed'`, with the adapter's plain error message shown |

**Never grants access from a client success callback.** A resolved StoreKit purchase moves the UI to `'verifying'`, calls the (Phase C, currently fail-closed) `verify-apple-transaction` Edge Function, and — **regardless of that call's outcome** — re-reads real entitlement via the existing `refreshSubscription()` (the same function the Stripe return-from-checkout flow already uses), then shows an honest `'awaiting-confirmation'` message. In this phase, since the Edge Function always returns `verified: false` (no Apple credentials exist), the user correctly never sees themselves granted Plus access from a native purchase — this is the intended, safe behaviour for this phase, not a bug to fix later in this same task.

### Restore Purchases / Manage Subscription

- **Restore Purchases**: `restoreApplePurchases()` → `NativePurchases.restorePurchases()`. Like a fresh purchase, a restored transaction only ever reaches entitlement via the `'transactionUpdated'` listener → the same non-granting verification path above.
- **Manage Subscription**: `openAppleManageSubscriptions()` → `NativePurchases.manageSubscriptions()`, which the plugin documents as opening Apple's own App Store subscription-management page — never WakeWise's own UI, never Stripe's.

### Cancellation detection — an honest caveat

`purchaseAppleProduct`'s cancellation heuristic (checking `error.code`/`error.message` for cancellation-like text) is a best-effort pattern based on the plugin's documented error shape, **not confirmed against a real StoreKit cancellation on a physical device or Xcode simulator** (neither is available in this task's environment). This needs sandbox/device confirmation before being trusted in production — see the "Requires Apple sandbox testing" section below. If the real error shape differs, a genuine user cancellation could currently be misreported as `'failed'` rather than `'cancelled'` — a UX rough edge, not a security issue (either way, no entitlement is granted).

### Security properties honoured (verified in the diff, see §Validation)

- No product id outside `APPLE_PRODUCT_IDS` is ever sent to the plugin or accepted back from it (tested — see `applePurchaseAdapter.test.js`).
- No transaction payload, JWS, receipt, or `appAccountToken` is ever logged — only `productIdentifier` (a fixed constant) or a plain `error.message`.
- Browser build never requires the native plugin: `@capgo/native-purchases` ships a web shim (`dist/esm/web.js`, dynamically imported by Capacitor's own `registerPlugin`), and every adapter function is additionally gated behind `isAppleIAPSupported()` before touching the plugin at all — confirmed by `npm run build` succeeding and by `applePurchaseAdapter.test.js`'s explicit "on web, zero plugin calls" tests.

---

## Phase C — Server-verification boundary

### Schema (written, reviewed, **not applied**)

`supabase/migrations/20260916100000_apple_subscription_entitlements_foundation.sql` — creates `entitlements`, `provider_subscriptions`, `provider_events` exactly as designed in `docs/apple-subscription-architecture.md` §7, with RLS enabled on all three, `authenticated` granted SELECT-own only (no INSERT/UPDATE/DELETE policy exists for `authenticated` on any of the three — matching this project's own already-verified `subscriptions`/`account_deletion_requests` pattern — plus explicit `REVOKE`s as defense-in-depth, mirroring the already-proven `20260915160000_harden_profiles_and_anon_grants.sql` migration's own reasoning), `provider_events` with zero client policy at all, and the two uniqueness constraints (`provider_subscriptions_stripe_sub_unique`, `provider_subscriptions_apple_txn_unique`) that make an Apple original-transaction id structurally unable to attach to two different WakeWise accounts. Rollback and validate files exist at the paired paths under `supabase/migration-support/`, per this project's own established convention.

**Not applied to the live project — per this task's explicit instruction.** `subscriptions` remains the live, authoritative table every existing read path uses; nothing in this phase depends on the new tables existing live.

### Edge Functions — both fail-closed stubs, not working verifiers

| Function | What it does today | What it deliberately does NOT do |
|---|---|---|
| `verify-apple-transaction` | Verifies caller JWT (same pattern as `create-checkout-session`); validates `productIdentifier` against the same allow-list `_shared/planMapping.ts` now exports (`KNOWN_APPLE_PLUS_PRODUCT_IDS`); checks for the *presence* of `APPLE_ISSUER_ID`/`APPLE_KEY_ID`/`APPLE_PRIVATE_KEY` (never their values); since these are never set in this task, always responds `501` with `{ verified: false, reason: 'apple_server_verification_not_yet_configured' }`. | Never decodes/parses `jwsRepresentation` as if that proved anything. Never writes to `entitlements`/`provider_subscriptions`/`provider_events` (both because nothing is verified, and because those tables don't exist live yet). Never calls the real App Store Server API (no credentials to call it with). |
| `apple-server-notifications` | Confirms the request is a `POST` with a `signedPayload` string; always responds `200 { received: true, processed: false, reason: 'not_yet_implemented' }` (a `200`, not an error, specifically so Apple does not endlessly retry a notification this endpoint can never process without a code change — different from `stripe-webhook`'s `500`-on-genuine-failure convention, deliberately, per this file's own header comment). | Never verifies the JWS certificate chain (no such logic is wired in — a real implementation should use Apple's own App Store Server Library, not a hand-rolled check). Never writes anything. |

**`reconcile-apple-subscriptions` (the scheduled reconciliation job) was not written in this phase.** There is no live Apple transaction data yet to reconcile, and writing a scheduled job with nothing real to poll would be speculative code with no way to test it safely in this task — deferred, not forgotten; its design is already in `docs/apple-subscription-architecture.md` §8.

### Provider-neutral entitlement resolution — real, tested, not yet wired into any live read path

`src/lib/entitlementResolution.js`: pure `resolveEntitlement(providerRecords)` implementing the exact precedence rule `docs/apple-subscription-architecture.md` §7 proposed (most-recently-verified access-granting record wins; `grace_period`/`billing_retry` grant access, matching how `past_due` already folds into `active` in the current simpler Stripe mapping). `hasActiveStripeOrAppleEntitlement(stripeRecord, appleRecord)` is the direct, literal implementation of this task's unified-entitlement rule #5. Fully unit-tested (`entitlementResolution.test.js`). **Not called from any live code path yet** — `SubscriptionContext.jsx` still reads `subscriptions` directly, since that remains the live, correct source of truth in this phase. A future task wires this in once `provider_subscriptions` is live and populated.

---

## Phase D — Stripe corrections

### 1. Seven-day trial — now actually passed to Stripe, server-eligibility-gated

- `supabase/migrations/20260916110000_stripe_trial_and_refund_support.sql` (also unapplied) adds `subscriptions.trial_used_at timestamptz` and widens the `status` CHECK constraint to add `'refunded'`.
- `supabase/functions/_shared/planMapping.ts`: new `isTrialEligible(row) = !row?.trial_used_at` — reads only this one column, never a client-supplied "eligible" flag, and never any other field on the row (tested explicitly — a forged `plan`/`status`/`eligible` field on a hypothetical malformed request body cannot influence it, since the function only ever receives the server's own DB row).
- `supabase/functions/create-checkout-session/index.ts`: now reads `trial_used_at` alongside the existing `stripe_customer_id` select, computes `trialEligible = isTrialEligible(existingRow)`, and passes `subscription_data.trial_period_days: 7` **only when eligible** — this is the confirmed-missing piece from the prior audit (`docs/apple-subscription-architecture.md` §2's own citation of the exact line that never included it).
- `supabase/functions/stripe-webhook/index.ts`: new `recordTrialUsageIfStarted(supabaseAdmin, userId, mappedStatus)`, called only from `checkout.session.completed`, only when the resulting subscription's *mapped* status is `'trial'` (i.e. Stripe actually confirmed `trialing`, not merely that a checkout session was created) — an abandoned checkout can never burn a user's one trial. The `UPDATE … WHERE trial_used_at IS NULL` guard means this can never overwrite an already-recorded first use.
- **Founding-offer wording**: `docs/founding-member-pricing-recommendation.md` and `pricingConfig.js`'s existing `foundingMemberDisclosureText()` were re-read; neither ever claimed the founding offer combines with a trial (the founding offer's own copy already states no-trial explicitly, matching the approved product decision in this task's own brief) — **no wording change was needed or made**; this was confirmed, not assumed.

### 2. Refund/dispute webhook handling

- `_shared/planMapping.ts`: `mapRefundOrDisputeEventToStatus('charge.refunded') → 'refunded'`; `mapRefundOrDisputeEventToStatus('charge.dispute.created') → 'cancelled'` (an immediate access-suspension pending resolution, using the existing value rather than adding a second new one — kept minimal per this task's own "minimum reviewed server-side state" instruction).
- `stripe-webhook/index.ts`: two new `switch` cases resolve the affected user via the **already-existing** `resolveUserId(..., { customerId: charge.customer })` path, then call a new, minimal `applyRefundOrDisputeStatus` (`UPDATE subscriptions SET status = ? WHERE user_id = ?` — not the full `applySubscriptionState` upsert, since a `charge` object is not a Stripe `Subscription` object and this must never overwrite unrelated fields).
- **Signature verification and idempotency are unchanged and still apply**: the idempotency check (`stripe_webhook_events`) runs before the `switch`, so it already covers these two new event types with no additional code. Malformed data (missing `charge.customer`) resolves to "could not resolve a user, skip" via the same pre-existing safe path `resolveUserId` already uses for every other event.
- `'refunded'` is deliberately **not** added to `entitlements.js`'s `ACTIVE_STATUSES` — it was never added there, so access is correctly revoked automatically; **no change to `src/lib/entitlements.js` was made or needed**.

---

## Phase E — Tests and documentation

### Tests added (all passing — see §Validation for the full run)

| File | Covers |
|---|---|
| `src/lib/platform.test.js` (new) | Native platform detection (`isNativePlatform`, `getPlatform`, `isIOS`, `isWeb`, `runNative`) — had no dedicated test before this task despite being the exact decision point every native-only feature branches on |
| `src/lib/applePurchaseAdapter.test.js` (new) | Product-id allow-listing (both directions — requesting and filtering results), purchase success/cancellation/failure/unavailable outcomes, restore, manage-subscriptions, transaction-listener registration/cleanup/allow-listing, web/non-native no-op safety (zero plugin calls) |
| `src/lib/entitlementResolution.test.js` (new) | Either-provider-active grants entitlement; neither-active denies; tie-break by most-recently-verified; malformed/empty input safety |
| `src/lib/planMapping.test.js` (new) | Trial eligibility (including that it reads only `trial_used_at`, never a forged field), refund/dispute status mapping, Apple product-id allow-listing, and — for the first time — `mapStripeStatus` itself, which had no dedicated test file before this task |

**Explicit test-coverage boundary, same pattern as the prior native-reminder task in this series**: this repo has no React Testing Library and no Deno test runner. `Subscription.jsx`'s actual JSX branching ("Stripe hidden on iOS," "Stripe retained on web," "no entitlement granted from a client callback" as *rendered UI behaviour*) is not render-tested — the underlying decision functions it branches on (`isAppleIAPSupported`/`isNativePlatform`/`isIOS`, the adapter's outcome shapes, `resolveEntitlement`) are, which is the same documented, deliberate scope boundary used for the morning-reminder feature's own UI testing in this series. `stripe-webhook/index.ts`'s own `Deno.serve` request handling (signature verification wiring, the idempotency check-then-insert sequence) is likewise not directly unit-tested — a pre-existing, repo-wide gap (confirmed in the earlier release-readiness audit: zero Edge Function test coverage existed before this task) this task narrows (by testing every pure decision function the webhook now calls) but does not close wholesale.

### Documentation updated

- `docs/apple-subscription-implementation.md` — this document.
- `docs/apple-subscription-architecture.md` — see "Where implementation differed from the design" below.
- `docs/release-readiness-register.md` — Workstreams C (Capacitor — plugin now installed, deployment target now 15.0), D (native reminder — unaffected), E (Apple subscription — updated to reflect Phase 1's real progress, still correctly not claiming completion).
- `docs/ios-xcode-handoff.md` — new §, exact dashboard/device steps this phase left for later.

---

## Where implementation differed from the architecture document

- **iOS deployment target**: the architecture document did not anticipate needing to raise it; Phase A's real compatibility research found the selected plugin requires iOS 15.0, so this was done and is now recorded as a fact, not a future risk.
- **`autoAcknowledgePurchases`**: not discussed in the architecture document at this level of detail. This phase deliberately leaves it at the plugin's own default (`true`, auto-finish) rather than manual acknowledgment gated on server confirmation, to avoid the "unfinished transactions block future purchases" risk while server verification is a stub anyway. **Flagged as a decision to revisit** once real server verification exists (see §16 below) — switching to manual acknowledgment, finished only after a confirmed server-side grant, closes a narrow window where a transaction could finish before durable server-side recording.
- **Product/offer metadata gap**: the architecture document assumed `Product` metadata from the client library would be available for offer-aware UI copy. Real source inspection found the selected plugin does not populate `introductoryPrice`/`subscriptionPeriod`/`discounts` on iOS. The UI therefore shows only base price plus generic, non-promising offer language ("a free trial or introductory offer may be available — the App Store will show your exact eligibility and terms") — which incidentally satisfies this task's own "must not promise eligibility until Apple confirms it" requirement for the founding offer, rather than fighting it.

---

## Classification

### Implemented and automated-test-verified

- Plugin compatibility research and selection (Phase A) — verified against real registry/source data, not assumed.
- `applePurchaseAdapter.js` — product-id allow-listing, outcome shapes, non-sensitive logging, web no-op safety.
- `Subscription.jsx` platform branching logic's underlying decision functions (`isAppleIAPSupported` et al.).
- `entitlementResolution.js` — the unified either-Stripe-or-Apple rule.
- `planMapping.ts` additions — trial eligibility, refund/dispute mapping, Apple product allow-list.
- `create-checkout-session`/`stripe-webhook` Stripe fixes — code-level logic (trial gating, refund/dispute mapping) is unit-tested via the pure functions it now calls; the Deno request-handling wiring itself is not (see Phase E's explicit boundary note).
- Migration SQL — manually reviewed for syntax and matched against this project's own established RLS pattern; **not** validated by `supabase db lint` (see §Validation — no local Postgres/Docker available in this environment).

### Implemented but requires macOS/Xcode verification

- `pod install` actually succeeding with the new `CapgoNativePurchases` pod and the raised iOS 15.0 deployment target (CocoaPods unavailable on this Windows machine).
- A real Xcode build/archive with the plugin linked.
- Adding the "In-App Purchase" capability in Xcode's Signing & Capabilities (the plugin's own README instructs this; not something a `project.pbxproj` text edit alone can safely replicate without Xcode to confirm the resulting entitlements are correct).
- Confirming the exact error shape StoreKit/this plugin surface for a user-cancelled purchase (this phase's cancellation-detection heuristic is unconfirmed — see Phase B).

### Requires App Store Connect configuration

- Creating the `wakewise_plus` subscription group and the two products (`com.zavaraai.wakewise.plus.monthly`, `com.zavaraai.wakewise.plus.annual`).
- Configuring the standard 7-day trial as the product's introductory offer, and separately creating the founding offer as an **Apple offer code** (product `com.zavaraai.wakewise.plus.annual`, New-subscriber eligibility, Pay Up Front, one year, AUD $49.99, renews at $59.99, explicitly answered "No" to also granting the introductory offer) — the mechanism is now confirmed and approved (`docs/apple-subscription-architecture.md` §6/§16), but neither the introductory offer nor the offer code has actually been created in App Store Connect yet.
- Generating the App Store Server API key (issuer id, key id, private key) `verify-apple-transaction` needs to stop being a stub.
- Configuring the App Store Server Notifications V2 URL once `apple-server-notifications` is deployed and its URL is known.
- Adding the "In-App Purchase" capability (Xcode-side, but the App Store Connect agreement/tax/banking prerequisites are dashboard-side).

### Requires Apple sandbox testing

- Every purchase/restore/cancel/renewal/refund/grace-period/billing-retry scenario in `docs/apple-subscription-architecture.md` §12's sandbox rows.
- Confirming the actual behaviour of a `foreground: false`-equivalent concept doesn't apply here (that was the native-reminder task's concern, not this one) — but confirming `manageSubscriptions()` actually opens the right page, and that `restorePurchases()` actually restores a sandbox purchase under the same or a different WakeWise account correctly (§9's cross-account-theft-prevention design is schema-enforced but has never been exercised against a real device).
- The exact cancellation-error shape (see above).

### Blocked or deferred (explicitly, not silently)

- Real App Store Server API / App Store Server Notifications V2 implementation — blocked on Apple credentials this task must not fabricate or commit.
- `reconcile-apple-subscriptions` scheduled job — deferred, no live data to reconcile yet.
- Applying either new migration to the live project — explicitly out of this task's scope.
- Cutting `SubscriptionContext.jsx`/any live read path over to `entitlements`/`resolveEntitlement` — deferred until the schema is actually live and populated.
- Apple-specific account-deletion warning copy (`DeleteAccount.jsx`) — deferred, since no live Apple entitlement can exist yet to warn about; `docs/apple-subscription-architecture.md` §10 already documents the intended wording for when it's needed.
- The trial-vs-founding-offer commercial decision itself was **approved 2026-09-16, and its exact mechanism (an Apple offer code, not a second introductory offer) confirmed feasible from Apple's official documentation the same day** (see below) — this phase's code already supports the approved outcome (the trial-gating code is provider-agnostic; the Apple introductory offer and the founding offer code are both entirely dashboard-side and still untouched).

---

## Explicit decisions still requiring approval

**Update (2026-09-16): items 1, 2, 3, and 5 below are now approved by the user; item 1's exact mechanism was further corrected and confirmed feasible later the same day.** See `docs/apple-subscription-architecture.md` §6/§7/§16 for the full recorded decisions. Kept here, marked resolved rather than deleted, for the historical record.

Carried over from `docs/apple-subscription-architecture.md` §16:
1. ~~Trial vs. founding-offer conflict~~ — **RESOLVED, approved 2026-09-16, mechanism confirmed feasible from Apple's official documentation the same day**: the standard 7-day trial remains the product's introductory offer; the founding offer is implemented as an **Apple offer code** (not a second introductory offer) — product `com.zavaraai.wakewise.plus.annual`, New-subscriber eligibility, Pay Up Front, one year, AUD $49.99, renews at $59.99, explicitly configured **not** to also grant the introductory offer. A subscriber can never receive both, enforced by that App Store Connect configuration itself, not merely inferred from the one-introductory-offer rule. Eligibility/offer/transaction state must be Apple/server-verified — never the client. An earlier version of this decision described "two mutually exclusive introductory paths" with an unconfirmed technical question and a trial-only fallback — that framing was a misunderstanding of the mechanism (introductory offers and offer codes are two different things), now corrected; the fallback remains available in principle if the offer code itself cannot be configured exactly as specified, but is no longer expected to be needed. No code in this repository needed to change for this correction — the trial-eligibility gating this phase already built (Phase D, server-side `trial_used_at`) is provider-agnostic and unaffected either way, and Apple-side offer configuration is entirely dashboard work, still not done.
2. ~~Family Sharing~~ — **RESOLVED, approved 2026-09-16: remains disabled.** No App Store Connect action was taken to touch this either way, consistent with the approval.
3. `provider_subscriptions` conflict-resolution tie-break rule — **approved 2026-09-16, with an important correction to how it's described**: the *access* decision is a pure OR across providers (either a verified Apple or verified Stripe entitlement is sufficient) — `entitlementResolution.js`'s `resolveEntitlement()`/`hasActiveStripeOrAppleEntitlement()` already implement exactly this (confirmed by re-reading the module: `granting.length === 0` is the only thing that denies access; a non-empty `granting` array always resolves to `plan: 'plus'` regardless of how many records are in it). The "most-recently-verified wins" logic in that same function only decides which *single* row's own unaltered `status`/`activeProvider`/`expiresAt` gets *reported* when more than one is simultaneously active — it was already written to never merge two records or compute an extended/combined expiry (it reports one winning record's own `currentPeriodExpiresAt` verbatim), so no code change was needed to comply with the approved "do not merge billing or extend expiry dates artificially" instruction — this was true of the code as already written, now confirmed and documented as the approved behaviour rather than merely a proposed default.

New, from this phase's real implementation work:
4. **`autoAcknowledgePurchases` default** — **approved 2026-09-16, conditionally**: keep the plugin's documented default *unless* its StoreKit 2 implementation is found to require WakeWise-controlled (manual) acknowledgement for server verification to work correctly. The verified behaviour must be documented — via macOS/Xcode + Apple sandbox testing, none of which has happened yet — **before** any change away from the default is made. Not yet investigated in this repository; tracked as a required step in `docs/ios-xcode-handoff.md` §15.
5. ~~iOS 14 support being dropped~~ — **RESOLVED, approved 2026-09-16.** The iOS 14 → 15 deployment target increase made in Phase A is confirmed acceptable.
6. **Cancellation-detection heuristic** — still needs physical-device/sandbox confirmation before being trusted; if wrong, the user-facing symptom is a cancelled purchase showing a generic "failed" message instead of the correct neutral "cancelled" one — never an entitlement/security issue either way. Not addressed by this approval (a technical-verification item, not a commercial decision).
7. ~~External Purchase Link Entitlement~~ — **not open; already rejected**, confirmed 2026-09-16. Native iOS uses Apple IAP only; web uses Stripe only; existing verified Stripe subscribers retain access on iOS via the unified entitlement model (already built in Phase C); WakeWise will not pursue or display an external purchase link on iOS. No code change was needed — Phase B's platform branching already implements exactly this split.

---

## Validation

Run in this environment (Windows, no Xcode/CocoaPods/Docker/local Postgres — all expected, all reported honestly, never worked around):

| Check | Result |
|---|---|
| `npm test` | **PASS** — 9 test files, **171/171 tests** (up from 120 before this task) |
| `npm run build` | **PASS** — clean, no errors |
| `npm run lint` | **PASS** — 0 errors, the same 4 pre-existing `react-hooks/exhaustive-deps` warnings as before this task, none new |
| `npx cap sync ios` | **PASS** — 3 plugins detected, `CapgoNativePurchases` pod line added automatically; `pod install` itself skipped (CocoaPods not installed — expected) |
| `npx cap doctor` | Ran; confirms `@capacitor/android: not installed` (no Android work occurred) and honestly reports `Xcode is not installed` |
| Migration/static SQL checks | `supabase db lint --local` attempted; failed with `PgClient: Failed to connect` — **no local Postgres/Docker available in this environment**, the same category of limitation as Xcode/CocoaPods. `--linked` was deliberately not attempted (would touch the live project, forbidden). Both new migration files were manually reviewed for syntax and cross-checked against this project's own established RLS/grant pattern instead. |
| `git diff --check` | **PASS** — no whitespace errors |
| Secret-pattern scan | **PASS — no matches.** Scanned every new/changed file for Stripe/Apple-shaped secret patterns (`sk_live_`, `sk_test_`, PEM private-key headers, JWT-shaped tokens) — zero matches. No Apple credential of any kind (`APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` — names only, never values) is set or referenced with a value anywhere in this diff. |

### Diff self-review (the specific risks this task asked to check for)

- **Embedded credentials**: none. Both new Edge Functions only check for the *presence* of Apple env vars via `Deno.env.get(...) → Boolean(...)`, never read or log a value.
- **Accidental client-side entitlement authority**: none — every purchase/restore path ends in a server round-trip and a `refreshSubscription()` re-read, never a direct state grant from a plugin callback (see Phase B).
- **Stripe links still exposed in native UI**: none — verified by reading the final `Subscription.jsx` diff directly; every Stripe-specific button/action is now inside an `!IS_NATIVE_IOS` (or equivalent `!== 'stripe'`/`IS_NATIVE_IOS`-aware) branch.
- **Unprotected database writes**: none — both new tables have zero client write policy; both new Edge Functions write nothing (they're stubs); the two Stripe webhook additions write only through the existing service-role admin client, exactly like every pre-existing write path in that file.
- **Sensitive transaction logging**: none — audited every new `console.*` call by hand; each logs only a plain `error.message`, a productIdentifier, or a boolean presence check.
- **Unrelated changes**: `git status`/`git diff --stat` reviewed — only the files listed in the final report below were touched; `docs/audio-content-specification.md` remains untracked and untouched.

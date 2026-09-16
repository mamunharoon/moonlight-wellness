# WakeWise — Apple Subscriptions, Phase 1 Implementation

**Compiled:** 2026-09-16, on `dev`, starting HEAD `c5292be7e67c4fbebf7ad20069c9729a053d3eba`.
**Scope:** the first safe, testable phase of native Apple subscriptions, per `docs/apple-subscription-architecture.md`. No real purchase, no build upload, no external dashboard touched, no Apple credential committed.

**Updated again 2026-09-16 — "Apply and Verify Subscription Database Foundation in DEV"** (Phase C's schema applied/live-verified), **"Implement Apple Server Verification and Notifications V2"** (Phase F — the real, cryptographically-verifying server-side implementation, starting HEAD `ab68b7f`), **and "Apply and Verify Apple Verified-State RPC Migration"** (Phase G — the one migration Phase F wrote now applied and live-verified, starting HEAD `d06eb46`). These updates are additive sections/edits within this same document — see Phase C's "applied and live-verified" note, Phase F, and Phase G below for what changed; earlier sections are otherwise left as written, with superseded claims struck through rather than deleted.

**Read this document alongside:**
- `docs/apple-subscription-architecture.md` — the design this phase implements (unchanged in its recommendations; a few sections below note where real evidence sharpened or corrected it).
- `docs/release-readiness-register.md` — updated pointers, Workstreams C/D/E.
- `docs/ios-xcode-handoff.md` — updated with the exact dashboard/device steps this phase could not do.

---

## 0. Do not claim more than this actually proves

**Apple billing is not complete.** Nothing in this phase, the subsequent database-foundation task (2026-09-16), the subsequent server-verification task (2026-09-16, Phase F below), or the subsequent RPC-migration apply task (2026-09-16, Phase G below) creates a real purchase, verifies a real transaction, or grants entitlement from an Apple purchase. What exists today is: a compatible, installed client library; a platform-safe UI that never shows Stripe on iOS; a reviewed schema that is **applied and live-verified** in the linked DEV Supabase project (`kvdxuhyndevrfvsalgnx`), including the one atomic write-path RPC (Phase G) — but every one of those tables still holds zero rows and is written to by nothing live; genuine, cryptographically-verifying server-side verification code (real JWS + certificate-chain verification, a real App Store Server API client, real subscription-state mapping) that is unit-tested but has **never been deployed, never run inside the actual Supabase Edge Runtime, and never been exercised against a real Apple-signed payload**; and no Apple credentials anywhere in this repository. Completion still requires, in order: generating dedicated Apple credentials, App Store Connect product/offer setup, deploying the Edge Functions and confirming they actually work on the real Supabase Edge Runtime (not just under Node/Vitest), Apple sandbox testing against the complete matrix, and physical-iPhone testing. **None of that has happened. Apple purchases remain completely non-operational** — writing, testing, and now live-verifying the database write path is a prerequisite for that work, not a step toward it being usable yet.

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

### Schema — applied and live-verified in DEV (2026-09-16)

`supabase/migrations/20260916100000_apple_subscription_entitlements_foundation.sql` — creates `entitlements`, `provider_subscriptions`, `provider_events` exactly as designed in `docs/apple-subscription-architecture.md` §7, with RLS enabled on all three, `authenticated` granted SELECT-own only (no INSERT/UPDATE/DELETE policy exists for `authenticated` on any of the three — matching this project's own already-verified `subscriptions`/`account_deletion_requests` pattern — plus explicit `REVOKE`s as defense-in-depth, mirroring the already-proven `20260915160000_harden_profiles_and_anon_grants.sql` migration's own reasoning), `provider_events` with zero client policy at all, and the three uniqueness/allow-list constraints (`provider_subscriptions_stripe_sub_unique`, `provider_subscriptions_apple_txn_unique`, and `provider_subscriptions_apple_product_id_allowlist` — the last one added during this task's pre-apply security review, mirroring `KNOWN_APPLE_PLUS_PRODUCT_IDS` at the database level) that make an Apple original-transaction id structurally unable to attach to two different WakeWise accounts and reject any Apple `product_id` outside the two known products. Rollback and validate files exist at the paired paths under `supabase/migration-support/`, per this project's own established convention.

**Applied to the linked DEV Supabase project (`kvdxuhyndevrfvsalgnx`, "Moonlight Wellness") on 2026-09-16**, together with `20260916110000_stripe_trial_and_refund_support.sql`, via `supabase db push --linked` after a pre-apply discovery check (git status, `supabase migration list --linked`, and a direct read-only query of `supabase_migrations.schema_migrations` confirmed these were the only two pending migrations and that none of the three new tables pre-existed) and a full live post-migration verification:

- All three tables exist; RLS enabled on all three (`relforcerowsecurity = false`, matching every other table in this project — the table owner and `service_role` bypass RLS by Supabase's own design regardless of `FORCE`, so `FORCE` is not part of this project's security model anywhere).
- `entitlements`/`provider_subscriptions` have exactly one policy each (`*_select_own`, `authenticated`, `SELECT`, `auth.uid() = user_id`); `provider_events` has zero policies. `anon` holds zero privileges on any of the three; `authenticated` holds `SELECT` only (no `INSERT`/`UPDATE`/`DELETE`).
- Rollback-safe behavioural tests (`BEGIN … SET LOCAL ROLE …; SET LOCAL request.jwt.claim.sub = '<uuid>'; …; ROLLBACK;` against two real user ids) confirmed: `anon` gets `permission denied` on SELECT/INSERT for all three tables; an authenticated user can SELECT their own `entitlements`/`provider_subscriptions` row but gets zero rows for another user's; `authenticated` gets `permission denied` on INSERT/UPDATE for `entitlements`/`provider_subscriptions` and on SELECT/INSERT for `provider_events`.
- Constraint tests confirmed: an invalid `provider` value, an Apple `product_id` outside the allow-list, a duplicate `provider_events (provider, provider_event_id)` pair, a duplicate `provider_subscriptions (provider, apple_original_transaction_id)` pair reused for a second user, and a non-existent `user_id` are all rejected by the database (`23514`/`23505`/`23503` respectively). Every synthetic row used in these tests was inserted and verified inside a transaction that was then rolled back; a post-test count confirmed all three new tables hold zero rows.
- The pre-existing `subscriptions` row (1 row, `status = 'cancelled'`) was confirmed unchanged before and after; all 17 pre-existing RLS policies and all pre-existing `anon`/`authenticated` grants on the other 7 tables were confirmed byte-identical before and after (19 total policies post-migration = 17 unchanged + 2 new).

`subscriptions` remains the live, authoritative table every existing read path uses — nothing in this phase cuts any read path over to the new tables; they exist and are verified but are not yet written to by anything (as of this writing, before Phase F below, `verify-apple-transaction` and `apple-server-notifications` were still fail-closed stubs; Phase F replaced them with real verification code, but that code is not deployed — see Phase F for the current, authoritative state).

### Edge Functions — superseded, 2026-09-16

**The table below described this phase's fail-closed stubs and is retained struck through for the historical record. Both functions were replaced with genuine, cryptographically-verifying implementations in the follow-on "Implement Apple Server Verification and Notifications V2" task — see Phase F below, which is now authoritative.**

~~| Function | What it does today | What it deliberately does NOT do |~~
~~|---|---|---|~~
~~| `verify-apple-transaction` | Verifies caller JWT (same pattern as `create-checkout-session`); validates `productIdentifier` against the same allow-list `_shared/planMapping.ts` now exports (`KNOWN_APPLE_PLUS_PRODUCT_IDS`); checks for the *presence* of `APPLE_ISSUER_ID`/`APPLE_KEY_ID`/`APPLE_PRIVATE_KEY` (never their values); since these are never set in this task, always responds `501` with `{ verified: false, reason: 'apple_server_verification_not_yet_configured' }`. | Never decodes/parses `jwsRepresentation` as if that proved anything. Never writes to `entitlements`/`provider_subscriptions`/`provider_events` (both because nothing is verified, and because those tables don't exist live yet). Never calls the real App Store Server API (no credentials to call it with). |~~
~~| `apple-server-notifications` | Confirms the request is a `POST` with a `signedPayload` string; always responds `200 { received: true, processed: false, reason: 'not_yet_implemented' }` (a `200`, not an error, specifically so Apple does not endlessly retry a notification this endpoint can never process without a code change — different from `stripe-webhook`'s `500`-on-genuine-failure convention, deliberately, per this file's own header comment). | Never verifies the JWS certificate chain (no such logic is wired in — a real implementation should use Apple's own App Store Server Library, not a hand-rolled check). Never writes anything. |~~

~~**`reconcile-apple-subscriptions` (the scheduled reconciliation job) was not written in this phase.**~~ Written in Phase F below.

### Provider-neutral entitlement resolution — real, tested, not yet wired into any live read path

`src/lib/entitlementResolution.js`: pure `resolveEntitlement(providerRecords)` implementing the exact precedence rule `docs/apple-subscription-architecture.md` §7 proposed (most-recently-verified access-granting record wins; `grace_period`/`billing_retry` grant access, matching how `past_due` already folds into `active` in the current simpler Stripe mapping). `hasActiveStripeOrAppleEntitlement(stripeRecord, appleRecord)` is the direct, literal implementation of this task's unified-entitlement rule #5. Fully unit-tested (`entitlementResolution.test.js`). **Not called from any live code path yet** — `SubscriptionContext.jsx` still reads `subscriptions` directly, since that remains the live, correct source of truth in this phase. A future task wires this in once `provider_subscriptions` is live and populated.

---

## Phase D — Stripe corrections

### 1. Seven-day trial — now actually passed to Stripe, server-eligibility-gated

- `supabase/migrations/20260916110000_stripe_trial_and_refund_support.sql` (applied and live-verified in DEV on 2026-09-16 — see Phase C above) adds `subscriptions.trial_used_at timestamptz` (nullable, confirmed live) and widens the `status` CHECK constraint to add `'refunded'` (confirmed live as the sole CHECK constraint governing `status`, listing exactly `trial`/`active`/`cancelled`/`expired`/`refunded`). The pre-existing subscription row's `trial_used_at` defaulted to `NULL` as expected; its `status`/`plan`/`provider` were confirmed unchanged by the migration.
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

- `docs/apple-subscription-implementation.md` — this document, updated again 2026-09-16 with the database-foundation apply-and-verify results (see Phase C above).
- `docs/apple-subscription-architecture.md` — see "Where implementation differed from the design" below.
- `docs/release-readiness-register.md` — Workstreams C (Capacitor — plugin now installed, deployment target now 15.0), D (native reminder — unaffected), E (Apple subscription — updated to reflect Phase 1's real progress and, as of 2026-09-16, the applied/verified database foundation — still correctly not claiming Apple subscriptions complete).
- `docs/ios-xcode-handoff.md` — new §, exact dashboard/device steps this phase left for later; updated 2026-09-16 to note the database foundation is live.

---

## Phase F — Server verification and Notifications V2 (real implementation, 2026-09-16)

**Task: "WAKEWISE — IMPLEMENT APPLE SERVER VERIFICATION AND NOTIFICATIONS V2."** Starting commit `ab68b7f`. Replaces the Phase C stubs with genuine, cryptographically-verifying server-side code. **Still not deployed, and Apple purchases are still not operational** — see the Classification section below for exactly what remains.

### 1. Compatibility gate — Apple's official library was evaluated and rejected for this runtime

`@apple/app-store-server-library` (npm, MIT, Apple's own official package, `3.1.0` at the time of this research) was downloaded and its actual source inspected (not assumed from its README) before writing any cryptographic code, per this task's own Phase 1 instruction.

**Finding: not safely usable in Supabase's current Edge Runtime.** Concrete, cited evidence:

| Broken API | Where the library depends on it | Deno issue | Fixed by | Fix merged |
|---|---|---|---|---|
| `crypto.X509Certificate.prototype.publicKey` | `SignedDataVerifier`'s certificate-chain verification (`jws_verification.ts` imports `X509Certificate` directly from Node's built-in `crypto`) | [deno#23307](https://github.com/denoland/deno/issues/23307) — its own title names `@apple/app-store-server-library` as the motivating case | [deno#24988](https://github.com/denoland/deno/pull/24988) | 2024 |
| `crypto.X509Certificate.prototype.verify` | Same class, chain-signature verification | [deno#28494](https://github.com/denoland/deno/issues/28494) — still "Not implemented" as reported against Deno 2.2.2 | [deno#32270](https://github.com/denoland/deno/pull/32270) | — |
| `node:crypto` EC key curve naming (`'p256'` vs. the OpenSSL short name `'prime256v1'` the `jsonwebtoken` package expects) | `AppStoreServerAPIClient.createBearerToken()`'s JWT signing (via `jsonwebtoken`), and `SignedDataVerifier`'s own internal use of the same package | [deno#22879](https://github.com/denoland/deno/issues/22879) — filed by a developer building **exactly this**: "verifying iOS in-app purchases through an edge function backend," Deno 1.41.2 | [deno#32267](https://github.com/denoland/deno/pull/32267) | **2026-03-02** |

**Supabase's own Edge Runtime is confirmed still pinned to Deno 2.1.4** as of the most recent evidence found (an open, unresolved [supabase/edge-runtime discussion #38898](https://github.com/orgs/supabase/discussions/38898) requesting an upgrade to Deno 2.5) — i.e. *after* all three fixes above landed upstream in Deno (the last as recently as 2026-03-02), with no confirmed timeline for Supabase's own runtime to pick them up. Shipping Apple's official library today would mean its core cryptographic path is confirmed broken on the exact runtime version this project's Edge Functions actually run on.

**The one community attempt at a Deno-native port found**, `@xaio/app-store-server-library-deno` on JSR, **has published zero versions** — not a credible, usable alternative.

**Decision: build the verification layer using two independently-maintained, WebCrypto-native libraries instead**, neither of which touches Node's `node:crypto` module at all (so none of the Deno incompatibilities above apply):
- **`jose@6.2.12`** — JWS parsing/signing/verification. Zero dependencies; explicitly designed to run identically across Node/Deno/Browser/Workers via the standard Web Crypto API.
- **`@peculiar/x509@2.1.0`** — X.509 certificate parsing and chain building (`X509ChainBuilder`). Its bundled source was read directly (not assumed): `X509ChainBuilder.findIssuer()` calls `candidateIssuerCert.verify({ publicKey, signatureOnly: true })`, i.e. it genuinely cryptographically verifies each certificate's signature against its candidate issuer via `crypto.subtle.verify` — not a mere subject/issuer string match. Its own dependency tree (`@peculiar/asn1-*`, `asn1js`, `pvtsutils`, `tsyringe`, `tslib`) is pure JS/TypeScript with no native bindings.

This project's own code (`supabase/functions/_shared/appleJwsVerification.ts`) only orchestrates: which candidate certificates to hand the chain builder (the JWS's own `x5c` header entries plus the pinned trusted root), which root to trust, and which additional checks (certificate validity dates, `BasicConstraints` CA flags) to enforce on top of the library's own chain-building signature checks. **It does not implement ASN.1 parsing, signature mathematics, or its own certificate-chain algorithm** — per this task's own "do not create home-grown certificate-chain validation" instruction.

**What this proves, and what it does not.** `appleJwsVerification.test.js` builds a full synthetic 3-tier certificate chain (root → intermediate → leaf, ECDSA P-256/SHA-256 — the exact algorithm Apple signs with) using `@peculiar/x509`'s own certificate generator, signs a JWS with `jose`, and exercises the real verification code end-to-end under Vitest/Node — 13 tests, all passing, covering: a valid chain accepted; a tampered payload rejected; a JWS signed by a key not matching the presented leaf rejected; an untrusted/unrelated root rejected; a self-signed leaf with no intermediate rejected; an expired certificate rejected; a not-yet-valid certificate rejected; the same otherwise-expired chain *accepted* when a synthetic "now" inside its validity window is supplied (proving the date check is real, not vacuous); an unsupported algorithm (`alg: none`) rejected; a missing `x5c` header rejected; malformed/empty input rejected; a non-CA intermediate certificate rejected. Because both `jose` and `@peculiar/x509` are WebCrypto-native — the same Web Crypto API both Node and Deno implement to the same standard — this is real evidence the cryptographic logic itself is correct, not a mock standing in for it. **It has NOT been executed inside the actual Supabase Edge Runtime** (no Docker/Deno CLI available in this task's environment) **and has NOT been exercised against a real Apple-signed JWS** (no Apple credentials exist or were created in this task). Both remain required before this can be trusted in production — see Classification below.

### 2. Security model implemented

**`verify-apple-transaction`** (`supabase/functions/verify-apple-transaction/index.ts`, orchestration in `_shared/applyVerifiedAppleTransaction.ts`):
- Requires a valid Supabase user JWT; resolves the authenticated user server-side (unchanged from Phase C).
- Accepts **only** `{ transactionId }` from the client body — no product, status, expiry, environment, price, offer, or `appAccountToken` claim is ever read from the request and trusted for what gets written.
- Calls Apple's own **App Store Server API** (`_shared/appleServerApi.ts` — a minimal client for exactly the two endpoints this project needs, `GET /inApps/v1/transactions/{id}` and `GET /inApps/v1/subscriptions/{id}`; endpoint paths, the bearer-token claim shape, and both base URLs were read directly out of Apple's own official library's source, not reconstructed from documentation summaries) using WakeWise's own ES256-signed bearer credential (signed with `jose`, sidestepping the `jsonwebtoken` curve-naming bug above entirely) — never trusts a client-submitted JWS.
- Cryptographically verifies every JWS Apple returns (`appleJwsVerification.ts`) before reading a single field out of it.
- Enforces bundle id (hardcoded check against the literal string `com.zavaraai.wakewise`, not merely "the secret is non-empty" — an operator typo in the secret value must not silently widen what is accepted), the Apple product-id allow-list (`isKnownApplePlusProductId`), and the configured environment, all against the **verified** payload.
- Enforces ownership: a present `appAccountToken` that names a different Supabase user is refused outright (`409`); the unconditional enforcement point is the database RPC's own `FOR UPDATE` + exception (see §4).
- Best-effort enriches with `getAllSubscriptionStatuses` for real `autoRenewStatus`/current `Status` data (a bare "Get Transaction Info" response carries neither) — a failure here is non-fatal, it just means `cancel_at_period_end` is left for the database layer to preserve rather than guessed at.
- Returns a minimal response (`verified`, `status`, `expiresAt`, `recorded`) — never the signed payload or any other sensitive Apple field.

**`apple-server-notifications`** (`supabase/functions/apple-server-notifications/index.ts`):
- Public webhook — no Supabase JWT to check, exactly like `stripe-webhook`. Every request is treated as hostile until `signedPayload`'s JWS signature and certificate chain verify against Apple's pinned root.
- Validates bundle id and environment on the verified outer payload (skipped only for Apple's own `TEST` notification type, which carries no `data` object at all).
- Separately, independently verifies the nested `signedTransactionInfo`/`signedRenewalInfo` (Apple signs these as their own JWS values, not merely as part of the outer envelope).
- Uses Apple's `notificationUUID` for replay protection, recorded in `provider_events(provider, provider_event_id)` before any state change, exactly mirroring `stripe_webhook_events`' already-proven idempotency pattern.
- Resolves the WakeWise user from a verified `appAccountToken` (trustworthy once the JWS it came from has been cryptographically verified — see `docs/apple-subscription-architecture.md` §9) or, if absent, the existing `provider_subscriptions` row already on record for that transaction id; an unresolvable notification is recorded for audit and acknowledged (`200`), never retried forever, exactly mirroring `stripe-webhook`'s own `resolveUserId` → "skip" convention.
- Never grants or revokes access from `notificationType` alone without an accompanying, itself-verified transaction/status (see §3's allow-list design).
- Returns `500` (Apple retries) only for a genuine transient failure (a database error); returns `200`/`400` for every other outcome — mirroring `stripe-webhook`'s own "retry only a real failure" convention, and Apple's own guidance not to be retried forever into a permanent condition.
- Never logs a signed payload, transaction identifier, `appAccountToken`, or user id — only `notificationType`/`subtype` (Apple's own non-sensitive enum values), reason codes, and plain error messages (verified by direct review of every log call in the new code — see §Validation below).

**`reconcile-apple-subscriptions`** (`supabase/functions/reconcile-apple-subscriptions/index.ts`, Phase 6) — written, **not scheduled or deployed**:
- Requires a dedicated shared secret (`APPLE_RECONCILE_TRIGGER_SECRET`, compared with a constant-time check — never `===` — to avoid a timing side-channel), deliberately separate from `SUPABASE_SERVICE_ROLE_KEY` so it can be rotated independently.
- Queries `provider_subscriptions` for `provider = 'apple'` rows not verified in the last 24 hours (capped at 50 rows per run — rate/cost-conscious against Apple's own API), and re-verifies each sequentially (not in parallel) through the **same** `verifyAndApplyAppleTransaction` helper `verify-apple-transaction` uses — one source of truth for "how does a verified Apple fact become a database write," never a second, divergent implementation.
- No `pg_cron` entry, no external scheduler wiring, and the function itself is not deployed — per this task's own "do not schedule or deploy it externally" instruction.

### 3. Subscription state mapping (`_shared/appleSubscriptionStateMapping.ts`)

Every enum value referenced (`NotificationTypeV2`, `Subtype`, `Status`, `OfferType`) was read directly out of Apple's own official library's source during this task's research — not reconstructed from documentation summaries. Central, pure, unit-tested (`appleSubscriptionStateMapping.test.js`, 33 tests):

- `resolveProviderStatus(transaction, appleStatus)` maps Apple's numeric `Status` (1=ACTIVE…5=REVOKED) to this project's vocabulary, with `offerType === 1` (INTRODUCTORY_OFFER) distinguishing `'trial'` from `'active'` — the standard 7-day trial's actual mechanism, per the approved commercial decision; `offerType === 3` (OFFER_CODE, the approved founding-offer mechanism) is deliberately **not** treated as a trial.
- `mapVerifiedAppleNotificationToStateChange(...)` gates on an explicit **allowlist** of state-bearing notification types (`SUBSCRIBED`, `DID_RENEW`, `DID_FAIL_TO_RENEW`, `GRACE_PERIOD_EXPIRED`, `REFUND`, `REVOKE`, `EXPIRED`, `OFFER_REDEEMED`, `DID_CHANGE_RENEWAL_PREF`, `DID_CHANGE_RENEWAL_STATUS`, `ONE_TIME_CHARGE`) — **any type not on this list, including one this project has simply never seen before, returns `null` (acknowledge-only) by construction**, the literal implementation of this task's "unknown notification types must not accidentally grant or revoke access" instruction (a test asserts this for a deliberately-invented, never-defined notification type, and an earlier draft that instead used a denylist was caught failing exactly this test during development).
- `DID_CHANGE_RENEWAL_STATUS` / `AUTO_RENEW_DISABLED` sets `cancelAtPeriodEnd: true` while leaving `status` exactly as the transaction's own data says — the literal implementation of "cancellation alone must not end access before the verified expiry time."
- Covers every scenario this task's own brief enumerated: initial purchase, active renewal, renewal-preference change, cancellation-with-continued-access, expiration, billing retry, billing grace period, refund, revocation, offer-code purchase, introductory-trial purchase, and (via the RPC's own idempotency/ordering guards, §4) duplicate and stale/out-of-order events.

### 4. Database write safety — the RPC migration (applied and live-verified, see Phase G)

`supabase/migrations/20260916120000_apple_verified_state_rpc.sql` — written and reviewed here; **applied to the linked DEV project and live-verified in the follow-on "Apply and Verify Apple Verified-State RPC Migration" task (2026-09-16) — see Phase G below, which is now authoritative for its live status.** Adds one `SECURITY DEFINER` function, `public.apply_verified_apple_subscription_event(...)`, replacing what would otherwise be two separate, race-prone client-side upserts:

- **Idempotent event recording**: a duplicate `provider_event_id` is a safe no-op, checked and recorded inside the same transaction as the state write (unlike `stripe-webhook`'s own check-then-process-then-record — this function's single-statement-per-call nature makes a true single-transaction guarantee straightforward).
- **Ownership enforcement**: `SELECT ... FOR UPDATE` locks the candidate row before checking it, closing the read-then-write race a client-side check would leave open; a transaction id already owned by a different `user_id` raises an exception rather than being silently reassigned.
- **Newer-wins ordering**: an incoming event whose `last_verified_at` is not newer than what is already on record is a safe no-op for the subscription/entitlement write (the event itself was still recorded above, for idempotency/audit) — the literal implementation of "newer verified state must not be overwritten by an older notification."
- **Unified entitlement recompute**: reads (never writes) the legacy `subscriptions` table to fold in any existing Stripe entitlement, using the same access-granting-status set and most-recently-verified tie-break rule as `src/lib/entitlementResolution.js` — deliberately re-implemented in SQL rather than called across the Deno/Postgres boundary, matching this project's own established "independently duplicated so one side can never silently drift the other" convention (see `KNOWN_APPLE_PLUS_PRODUCT_IDS`'s own precedent). A dedicated parity test (`entitlementResolution.serverMirror.test.js`) proves the **JavaScript-side** server mirror (`_shared/entitlementResolution.ts`) agrees with the client copy across 9 representative inputs; the **SQL** copy inside this migration could not be executed against a live database in this task and is therefore reviewed, not test-executed — flagged explicitly, not silently assumed correct (see Classification below).
- `EXECUTE` is revoked from `PUBLIC`, `anon`, **and `authenticated`** — granted only to `service_role`. This is deliberately different from this project's existing `admin_*` RPCs (callable by an authenticated admin user, gated by `is_admin()` inside the function body): this function takes a raw `user_id` parameter with no in-body ownership check of "does the caller own this account," so it must never be reachable by any client-authenticated role at all.
- `SET search_path = ''` with every reference fully qualified (`public.`/`auth.`) — this project's own already-established hardening pattern for `SECURITY DEFINER` functions (see `20260808120000_sprint2_stage2_admin_foundation.sql`).
- No SQL string concatenation with any untrusted value — every value arrives as a typed, bound function parameter.
- Does not touch `subscriptions`, its RLS, or any Stripe write path — reads it, never writes it.
- Rollback and validate files exist at the paired paths under `supabase/migration-support/`, per this project's own established convention.

### 5. Credential and configuration boundary (names only — see below)

| Secret name | Purpose | Format |
|---|---|---|
| `APPLE_ISSUER_ID` | App Store Server API JWT `iss` claim | UUID, from App Store Connect → Users and Access → Integrations → Keys |
| `APPLE_KEY_ID` | App Store Server API JWT `kid` header | Alphanumeric key id, same page |
| `APPLE_PRIVATE_KEY` | App Store Server API JWT signing key | PEM-encoded PKCS#8 EC private key (the `.p8` file App Store Connect issues **once**, at key creation — cannot be re-downloaded) |
| `APPLE_BUNDLE_ID` | Bundle id allow-listed by both Edge Functions | The literal string `com.zavaraai.wakewise` |
| `APPLE_ENVIRONMENT` | Which App Store Server API host/environment this deployment targets | Exactly `production` or `sandbox` — never inferred, never both at once in a single deployment |
| `APPLE_RECONCILE_TRIGGER_SECRET` | Authenticates a call to the (unscheduled) `reconcile-apple-subscriptions` function | A random, generated shared secret — deliberately independent of `SUPABASE_SERVICE_ROLE_KEY` so it can be rotated without touching every other function's trust boundary |
| `SUPABASE_SERVICE_ROLE_KEY` | Already auto-injected by the Supabase platform into every Edge Function — nothing to set manually | n/a |

**On the existing Codemagic App Store Connect key**: this task did **not** assume it is technically or operationally suitable for App Store Server API access, and did not reuse it. Codemagic's own key is scoped for **code-signing/build-automation** use (App Store Connect API access for `xcrun altool`/Codemagic's own publishing step) — a fundamentally different **role/permission scope** in App Store Connect than what the App Store Server API needs (an **In-App Purchase**-scoped key, per Apple's own documentation for generating an App Store Server API key). Reusing one key for both purposes would also **couple rotation**: rotating the signing key (e.g. after a CI credential leak) would simultaneously break server-side purchase verification, and vice versa. **Recommendation: generate a separate, dedicated App Store Connect API key scoped only to the App Store Server API / In-App Purchase role**, least-privilege and independently rotatable. Not created in this task (no App Store Connect action was taken).

**Production vs. sandbox handling**: `APPLE_ENVIRONMENT` is a single, explicit, required value per deployment — this task deliberately does **not** implement an automatic "try production, fall back to sandbox" pattern some integrations use, to avoid any ambiguity about which environment a given verification result actually came from. A deployment that needs to test against sandbox sets `APPLE_ENVIRONMENT=sandbox` explicitly.

**Rotation procedure** (for a future task to execute, not performed here): generate the new key in App Store Connect first (a private key, once downloaded, cannot be re-downloaded — the old key must remain valid until the new one is confirmed working); update `APPLE_KEY_ID`/`APPLE_PRIVATE_KEY` together (they identify the same key pair); revoke the old key in App Store Connect only after confirming a real verification succeeds with the new one; `APPLE_ISSUER_ID` does not change on key rotation (it identifies the App Store Connect team, not the individual key) and needs no corresponding update.

**What must never be exposed to the client**: every secret in the table above, plus any raw signed payload/JWS Apple returns (the Edge Functions already never return these — see §2's "minimal response" notes). None of these values exist anywhere in this repository — every reference in the code and in this document is to the secret's **name**, never a value, per this task's own explicit instruction.

### 6. Tests added in this phase (all passing — see §Validation for the full run)

| File | Covers |
|---|---|
| `src/lib/appleJwsVerification.test.js` (new) | Real end-to-end JWS + certificate-chain verification against synthetic chains — see §1 above for the full scenario list (13 tests) |
| `src/lib/appleServerApi.test.js` (new) | App Store Server API bearer-token JWT signing — correct claim shape, correct short expiry, a wrong public key correctly fails verification (2 tests) |
| `src/lib/appleSubscriptionStateMapping.test.js` (new) | Every notification/status-mapping scenario this task's brief enumerated, plus the acknowledge-only allowlist and its fail-closed behaviour on an unknown type (33 tests) |
| `src/lib/applyVerifiedAppleTransaction.test.js` (new) | The orchestration layer itself, with `appleServerApi`/`appleJwsVerification` mocked and a minimal `Deno.env` shim: bundle id / product id / environment / transaction id / `appAccountToken` mismatches all rejected before the database RPC is ever called; a 404 from Apple maps to `transaction_not_found`, not an internal error; an RPC ownership-conflict error maps to `already_linked_to_another_account`; a generic RPC failure maps to `internal_error`; the RPC call's parameter set is asserted to contain nothing beyond what the verified transaction itself carries (10 tests) |
| `src/lib/entitlementResolution.serverMirror.test.js` (new) | Proves the server-side JS mirror (`_shared/entitlementResolution.ts`) and the client copy (`src/lib/entitlementResolution.js`) agree across 9 representative inputs (9 tests) |

**Explicit test-coverage boundary, same pattern as Phase E's own note**: `verify-apple-transaction/index.ts`, `apple-server-notifications/index.ts`, and `reconcile-apple-subscriptions/index.ts`'s own `Deno.serve` request-handling wiring (HTTP method/JWT/header checks, response-status selection) is not directly unit-tested — this repo still has no Deno test runner. What IS tested is every pure decision function these handlers call (JWS verification, state mapping, the full orchestration layer with the network/DB boundary mocked) — narrowing the same pre-existing, repo-wide gap Phase E already narrowed for Stripe, not closing it wholesale. ~~The RPC migration's SQL itself... could not be executed against a live database in this task — reviewed, not test-executed.~~ **Now live-tested — see Phase G.**

---

## Phase G — RPC migration applied and behaviourally verified in DEV (2026-09-16, "Apply and Verify Apple Verified-State RPC Migration")

Starting commit `d06eb46`. Applies and live-verifies `20260916120000_apple_verified_state_rpc.sql` — the one migration Phase F wrote but could not execute against a real database. **Database foundation milestone only — no Edge Function was deployed, no Apple credential was set, no product was configured, and Apple purchases remain completely non-operational.**

### Pre-apply re-review

Every property this task's own checklist named was re-verified by direct reading of the migration (not assumed from Phase F's earlier review): `SECURITY DEFINER` is deliberately used even though only `service_role` may call it — not because `service_role` couldn't otherwise reach these tables, but so the function's behaviour is deterministic and independent of `service_role`'s own implicit grants, matching this project's existing `admin_*` `SECURITY DEFINER` convention; `search_path` is fixed to the empty string with every reference fully qualified; `PUBLIC`/`anon`/`authenticated` are explicitly revoked and only `service_role` is granted `EXECUTE`; required inputs (`user_id`, `apple_original_transaction_id`, `status`) are NULL-checked explicitly, while product-id/environment/status allow-listing is enforced by the existing table `CHECK` constraints the function's own `INSERT` runs through (not re-implemented a second time); `provider` is not a caller-controllable parameter at all — it is hardcoded to the literal `'apple'` in every write, so "wrong provider" is structurally impossible through this function, not merely rejected at runtime; ownership is enforced via `SELECT ... FOR UPDATE` before the conflict check, closing the same read-then-write race a client-side check would leave open; `provider_events` is written idempotently via `ON CONFLICT ... DO NOTHING`; a `last_verified_at` ordering guard rejects a stale/out-of-order event without touching subscription/entitlement state; the whole function body is one Postgres transaction, so a partial failure (e.g. a `CHECK` violation on the product-id allow-list) rolls back every effect of that call, confirmed live (see Constraint tests below); no dynamic SQL (`EXECUTE format(...)` or string concatenation) appears anywhere in the function; and the one `RAISE EXCEPTION` message that includes caller data only includes `apple_original_transaction_id` — an opaque provider identifier this project's own architecture document (§7) already classifies as non-personal data, not a secret or PII. **No issue was found requiring correction — the migration was applied exactly as written by Phase F, with no code change.**

### Pre-mutation baseline (recorded, not printed as sensitive)

Migration head `20260916110000`; `entitlements`/`provider_subscriptions`/`provider_events` all at 0 rows; `subscriptions` at 1 row (`status='cancelled'`, unchanged since first recorded); 19 total RLS policies across the schema; 5 pre-existing `SECURITY DEFINER` functions (`is_admin`, three `admin_*`, and — before this migration — nothing named `apply_verified_apple_subscription_event`); the full constraint set on the three new tables recorded and confirmed to still include `provider_subscriptions_apple_product_id_allowlist`/`provider_subscriptions_apple_txn_unique`/`provider_events_unique` from the prior task.

### Application

`20260916120000_apple_verified_state_rpc.sql` was the only migration pending, locally and remotely, confirmed via `supabase migration list --linked` and a direct read of `supabase_migrations.schema_migrations` before applying. Applied via `supabase db push --linked` — no error, no manual history repair.

### Post-apply verification

The function exists exactly once, owned by `postgres` (matching every other `SECURITY DEFINER` function in this project), `prosecdef = true`, `proconfig = {"search_path=\"\""}` — a genuinely fixed, empty search path, not merely a non-empty default. `anon`/`authenticated`/`PUBLIC` have zero rows in `information_schema.routine_privileges` for this function; `service_role` has exactly one `EXECUTE` row. Every pre-existing policy (19, byte-identical), grant, and the one `subscriptions` row (`status='cancelled'`, `plan='plus'`, `provider='stripe'`) were confirmed unchanged after the apply.

### Behavioural and constraint verification (all inside rollback-safe transactions, real Supabase auth users, zero residual rows confirmed after)

- A valid verified Apple event atomically created a matching `provider_events` row, a `provider_subscriptions` row, and a recomputed `entitlements` row (`plan='plus'`) in one call.
- Calling with the same `provider_event_id` twice returned `(true, 'applied')` then `(false, 'duplicate_event')` — confirmed idempotent, zero duplicate rows.
- An older `last_verified_at` for an already-recorded transaction was rejected (`(false, 'stale_event')`), leaving the existing `status` untouched.
- A genuinely newer `last_verified_at` successfully updated an older row's `status` and expiry.
- An Apple product id outside the allow-list was rejected (`23514 provider_subscriptions_apple_product_id_allowlist`) with zero rows written.
- An invalid `environment` value (`'staging'`) was rejected (`23514 provider_subscriptions_environment_check`) with zero rows written.
- A second, different real user attempting to claim a transaction id already owned by the first was rejected (`23505`, `"is already linked to a different WakeWise account"`), with zero reassignment.
- A `DID_CHANGE_RENEWAL_STATUS`/cancellation event correctly set `cancel_at_period_end = true` while leaving `status='active'` and a still-valid `current_period_expires_at` — access preserved until expiry, exactly as designed.
- An `EXPIRED` event correctly moved `status` to `'expired'` and recomputed the user's `entitlements` row to `plan='free'`.
- A `REFUND` event produced `status='refunded'`; a `REVOKE` event produced `status='revoked'`; both correctly revoked the recomputed entitlement.
- `NULL` required input (`user_id`) was rejected with a clear, non-sensitive error message and zero rows written.
- Both `authenticated` and `anon` roles, impersonated via `SET LOCAL ROLE`, received `42501 permission denied for function apply_verified_apple_subscription_event` — confirmed unable to call the RPC at all.
- **The full two-provider entitlement matrix was live-tested for the first time** (Phase F's own equivalent test only proved the JS mirror, not this SQL): a real Stripe-only-active row correctly resolved `entitlements` to `active_provider='stripe'`; an Apple-only-active row to `active_provider='apple'`; both simultaneously active resolved to `plan='plus'` with the most-recently-verified provider reported; neither active resolved to `plan='free'`, `active_provider=null`. An existing user's real Stripe row (`status='cancelled'`) was confirmed byte-identical before and after an Apple-side write for the same user.

All synthetic rows used two real `auth.users` ids plus one synthetic third-user Stripe row created and rolled back within a transaction (never touching any existing record) — every test ran inside `BEGIN … ROLLBACK`, and a final `SELECT count(*)` across `entitlements`/`provider_subscriptions`/`provider_events` confirmed **0/0/0** residual rows, with `subscriptions` unchanged at its original 1 row.

### Documentation

Updated `docs/apple-subscription-implementation.md` (this section), `docs/release-readiness-register.md`, `docs/ios-xcode-handoff.md` with verified status only. Do not read this section as "Apple subscriptions work" — it verifies the database write boundary is safe and correct; nothing has been deployed, no Apple credential exists, and no product has been configured in App Store Connect.

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
- Migrations `20260916100000`/`20260916110000` — **applied to the linked DEV project and live-verified**; see Phase C above.
- **(Phase F, 2026-09-16) `appleJwsVerification.ts` — genuine JWS signature + X.509 certificate-chain verification**, proven end-to-end against synthetic chains matching Apple's real shape (13 tests) — see Phase F §1.
- **(Phase F) `appleServerApi.ts`'s bearer-token JWT signing** — correct claim shape, correct short expiry, wrong-key rejection proven (2 tests).
- **(Phase F) `appleSubscriptionStateMapping.ts`** — every notification/status scenario this task's brief enumerated, plus the fail-closed unknown-type allowlist behaviour (33 tests).
- **(Phase F) `applyVerifiedAppleTransaction.ts`'s orchestration logic** — bundle/product/environment/transaction-id/`appAccountToken` checks, Apple-API-error mapping, RPC-error mapping, and the RPC call's own parameter surface, all proven with the network/DB boundary mocked (10 tests).
- **(Phase F) `_shared/entitlementResolution.ts` (server-side mirror) agrees with the client copy** across 9 representative inputs — a genuine parity proof, not an assumption.
- **(Phase G, 2026-09-16) RPC migration `20260916120000` — applied to the linked DEV project and behaviourally live-verified.** Owner `postgres`, `prosecdef=true`, `search_path` fixed empty, `anon`/`authenticated`/`PUBLIC` confirmed unable to execute it (`42501`), `service_role` confirmed able to. Idempotency, stale/newer-event ordering, product/environment allow-listing, ownership-conflict rejection, cancellation-preserves-access, expiry/refund/revocation state transitions, and — for the first time — the full four-way Stripe/Apple entitlement precedence matrix (Stripe-only, Apple-only, both, neither) were all exercised against the live database inside rollback-safe transactions, with zero residual rows confirmed after. See Phase G below for the complete record.

### Requires Supabase deployment

- **(Phase F/G) The real verification code in `verify-apple-transaction`/`apple-server-notifications`/`reconcile-apple-subscriptions` has never run inside the actual Supabase Edge Runtime** — no Docker/Deno CLI is available in this task's environment. The cryptographic logic is proven correct under Node/Vitest using the same WebCrypto-based libraries Deno implements to the same standard (Phase F §1), and the database write path it calls into is now live-verified (Phase G), which is strong but not conclusive evidence for the exact deployed runtime.
- The per-function `deno.json` import maps (`jose`/`@peculiar/x509`/`reflect-metadata` → their `npm:` specifiers) added for the three new functions have never been exercised by an actual `supabase functions deploy` — confirm they resolve correctly at real deploy time before assuming this compiles as-is.
- `reconcile-apple-subscriptions` exists in the repository but is not deployed and has no schedule — deploying it (without also scheduling it) is harmless (it stays unreachable without the trigger secret) but does nothing on its own.

### Implemented but requires macOS/Xcode verification

- `pod install` actually succeeding with the new `CapgoNativePurchases` pod and the raised iOS 15.0 deployment target (CocoaPods unavailable on this Windows machine).
- A real Xcode build/archive with the plugin linked.
- Adding the "In-App Purchase" capability in Xcode's Signing & Capabilities (the plugin's own README instructs this; not something a `project.pbxproj` text edit alone can safely replicate without Xcode to confirm the resulting entitlements are correct).
- Confirming the exact error shape StoreKit/this plugin surface for a user-cancelled purchase (this phase's cancellation-detection heuristic is unconfirmed — see Phase B).

### Requires Apple credentials

- **(Phase F)** Generating a dedicated App Store Server API key (issuer id, key id, private key) — scoped separately from Codemagic's existing key, see Phase F §5 for why. Nothing in this repository fabricates, guesses, or commits a value for `APPLE_ISSUER_ID`/`APPLE_KEY_ID`/`APPLE_PRIVATE_KEY`/`APPLE_RECONCILE_TRIGGER_SECRET` — every reference is to the name only.
- Setting `APPLE_BUNDLE_ID=com.zavaraai.wakewise` and `APPLE_ENVIRONMENT=sandbox` (or `production`, once ready) as actual Supabase Edge Function secrets.

### Requires App Store Connect configuration

- Creating the `wakewise_plus` subscription group and the two products (`com.zavaraai.wakewise.plus.monthly`, `com.zavaraai.wakewise.plus.annual`).
- Configuring the standard 7-day trial as the product's introductory offer, and separately creating the founding offer as an **Apple offer code** (product `com.zavaraai.wakewise.plus.annual`, New-subscriber eligibility, Pay Up Front, one year, AUD $49.99, renews at $59.99, explicitly answered "No" to also granting the introductory offer) — the mechanism is now confirmed and approved (`docs/apple-subscription-architecture.md` §6/§16), but neither the introductory offer nor the offer code has actually been created in App Store Connect yet.
- Generating the dedicated App Store Server API key above.
- Configuring the App Store Server Notifications V2 URL once `apple-server-notifications` is deployed and its URL is known.
- Adding the "In-App Purchase" capability (Xcode-side, but the App Store Connect agreement/tax/banking prerequisites are dashboard-side).

### Requires Apple sandbox testing

- Every purchase/restore/cancel/renewal/refund/grace-period/billing-retry scenario in `docs/apple-subscription-architecture.md` §12's sandbox rows.
- Confirming the actual behaviour of a `foreground: false`-equivalent concept doesn't apply here (that was the native-reminder task's concern, not this one) — but confirming `manageSubscriptions()` actually opens the right page, and that `restorePurchases()` actually restores a sandbox purchase under the same or a different WakeWise account correctly (§9's cross-account-theft-prevention design is schema-enforced but has never been exercised against a real device).
- The exact cancellation-error shape (see above).

### Blocked or deferred (explicitly, not silently)

- ~~Real App Store Server API / App Store Server Notifications V2 implementation — blocked on Apple credentials this task must not fabricate or commit.~~ **Implemented (Phase F, 2026-09-16).** The code exists, is verification-real, and is unit-tested; it is still blocked on Apple credentials/App Store Connect setup/deployment before it can actually run — see "Requires Apple credentials"/"Requires App Store Connect configuration"/"Requires Supabase deployment" above.
- ~~`reconcile-apple-subscriptions` scheduled job — deferred, no live data to reconcile yet.~~ **Written (Phase F).** Deliberately still not scheduled or deployed — a future, separate, explicit action.
- All three migrations (`20260916100000`, `20260916110000`, `20260916120000`) are applied and live-verified in DEV (2026-09-16).
- Cutting `SubscriptionContext.jsx`/any live read path over to `entitlements`/`resolveEntitlement` — still deferred; the schema and its write RPC are now both live, but no Edge Function has actually run against them yet — see "Requires Supabase deployment".
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

---

## Phase F Validation (2026-09-16, "Implement Apple Server Verification and Notifications V2")

Run in this environment (Windows, no Xcode/CocoaPods/Docker/local Postgres/Deno CLI — all expected, all reported honestly, never worked around):

| Check | Result |
|---|---|
| `npm test` | **PASS** — 14 test files, **238/238 tests** (up from 171 at the end of Phase E; 67 new tests across 5 new files) |
| `npm run build` | **PASS** — clean, no errors |
| `npm run lint` | **PASS** — 0 errors, the same 4 pre-existing `react-hooks/exhaustive-deps` warnings, none new (one real lint error in a first draft of `appleJwsVerification.test.js` — a Node `Buffer` global ESLint doesn't recognise in this project's browser-style config — was found and fixed by switching to a plain WebCrypto-compatible base64url helper) |
| Edge Function/type checks | This repository has no `tsconfig.json` and no Deno CLI available in this environment — there was no type-check tooling to run before this task, and none was added (a pre-existing gap, not introduced here). `npx tsc --noEmit` was attempted and confirmed there is no project to check. |
| SQL validation for the new migration | `supabase db lint --local`/execution against a real database was not possible (no local Postgres/Docker, same limitation as Phase E) — the RPC was manually reviewed against this project's own established `SECURITY DEFINER` pattern (`20260808120000_sprint2_stage2_admin_foundation.sql`) and its entitlement-precedence SQL was cross-checked line-by-line against the JS logic proven correct by `entitlementResolution.serverMirror.test.js`. |
| `git diff --check` | **PASS** — no whitespace errors |
| Secret-pattern scan | **PASS — no matches.** Every new/changed file scanned for Stripe/Apple-shaped secret patterns (`sk_live_`/`sk_test_`, PEM `PRIVATE KEY` headers, AWS-shaped keys, JWT-shaped tokens) — zero matches. `appleRootCertificates.ts` embeds Apple's own **public** root certificate (downloaded directly from `apple.com` over HTTPS, SHA-256 fingerprint independently corroborated) — a `CERTIFICATE` PEM block, not a `PRIVATE KEY` one, and not a secret. |
| Dependency audit | `npm audit` run and inspected specifically for `jose`, `@peculiar/x509`, `reflect-metadata`, and every package in their dependency trees (`@peculiar/asn1-*`, `asn1js`, `pvtsutils`, `tsyringe`, `tslib`) — **zero vulnerabilities found in any of them.** (The repo's pre-existing `npm audit` findings — `tar`/`vite`/`vitest`/`@capacitor/cli`/etc. — are unrelated to this task and were not introduced by it.) |

### Diff self-review (the specific risks this task asked to check for)

- **Custom/incomplete cryptographic shortcuts**: none — every actual cryptographic operation (JWS signature verification, X.509 certificate-chain building/verification) is delegated to `jose`/`@peculiar/x509`; this project's own code only orchestrates which certificates to check and which business rules (bundle id, product id, environment) to apply to an already-verified payload. See Phase F §1 for the full reasoning.
- **Unverified JWS decoding**: none — `appleJwsVerification.ts` exposes exactly one function, and it either returns a fully verified, decoded payload or throws; there is no "decode without verifying" helper anywhere in the module (an earlier draft had one, exported for logging convenience — removed during this task's own review, before it was ever used anywhere, specifically because it was a needless footgun against this task's "never merely decode and call it verified" rule).
- **Client-controlled entitlement writes**: none — `verify-apple-transaction` accepts only `transactionId` from the client (confirmed by direct code read and by `applyVerifiedAppleTransaction.test.js`'s explicit assertion that the RPC call's parameter set contains nothing beyond what the verified Apple transaction itself carries); `apple-server-notifications` never reads anything from the request except the raw `signedPayload` string, whose contents are only trusted after independent cryptographic verification.
- **Overbroad service-role use**: the new RPC (`apply_verified_apple_subscription_event`) revokes `EXECUTE` from `PUBLIC`/`anon`/`authenticated` and grants it to `service_role` only — confirmed by direct read of the migration's own `REVOKE`/`GRANT` statements, and now confirmed live: `authenticated`/`anon` both received `42501 permission denied` when impersonated against the real, applied function (Phase G).
- **Replay or ordering weaknesses**: `provider_events(provider, provider_event_id)`'s existing unique constraint is used for idempotent event recording; the RPC additionally enforces "newer verified state must not be overwritten by an older notification" via a `last_verified_at` ordering guard — both now live-verified (Phase G): a duplicate `provider_event_id` returned `duplicate_event` with zero new rows, and a stale `last_verified_at` returned `stale_event` while leaving the existing row's `status` untouched.
- **Sensitive logging**: none — every `console.*` call across all three new/changed Edge Functions was read directly (listed in Phase F §2 above); each logs only a reason code, a plain `error.message`, a notification type, or a static label — never a JWS, transaction identifier, `appAccountToken`, user id, or any credential value.
- **Embedded keys**: none — `appleRootCertificates.ts` embeds Apple's own public root certificate only (see the dependency-audit row above); no private key, API key, or other secret value appears anywhere in this diff.
- **Accidental Stripe regressions**: none — `git diff --stat` against every Stripe-related file (`stripe-webhook`, `create-checkout-session`, `create-portal-session`, `_shared/planMapping.ts`, `_shared/stripeClient.ts`) confirmed zero changes; this task touched only the two Apple Edge Functions, new `_shared/apple*.ts`/`entitlementResolution.ts` modules, one new Edge Function (`reconcile-apple-subscriptions`), one new migration, `package.json`/`package-lock.json` (three new devDependencies), five new test files, and the four documentation files. Phase G additionally confirmed live, directly against the DEV database, that the one real Stripe subscription row was byte-identical (`status='cancelled'`, `plan='plus'`, `provider='stripe'`) before and after applying the migration and running every behavioural test.

---

## Phase G Validation (2026-09-16, "Apply and Verify Apple Verified-State RPC Migration")

| Check | Result |
|---|---|
| Migration validation script (`supabase/migration-support/validate/20260916120000_apple_verified_state_rpc_validate.sql`) | **PASS** — every query in the file was run directly against the linked DEV project and matched its own "Expected" comment (function exists with the exact signature; `prosecdef`/`proconfig` correct; zero `anon`/`authenticated`/`PUBLIC` execute rows; one `service_role` execute row; `subscriptions` policy set unchanged) |
| `npm test` | **PASS** — 14 test files, **238/238 tests** (unchanged from Phase F — this task made no code changes, only applied the already-written, already-tested migration) |
| `npm run build` | **PASS** — clean, no errors |
| `npm run lint` | **PASS** — 0 errors, same 4 pre-existing warnings |
| `git diff --check` | **PASS** — no whitespace errors |
| Secret-pattern scan | **PASS — no matches.** This task's only diff is documentation; scanned for the same Stripe/Apple-shaped secret patterns as every prior task. No Apple credential value, connection string, or customer data was printed at any point during the live SQL verification — every query result inspected in this task was either a count, a status/plan/provider enum value, a boolean, or a structural (policy/grant/function) fact. |

No application code, migration, or dependency changed in this task — only the pending migration was applied to DEV and this documentation was updated.

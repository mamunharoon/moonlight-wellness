# WakeWise — Release Readiness and Completion Register

**Compiled:** 2026-09-16, on `dev`, HEAD `9475db85bb552848b2d1788a079beb6e3647ef8e`.
**Method:** static repository audit only — file reads, `git log`/`grep`, and the
project's own migration/report comments. No Supabase, Stripe, Apple, Vercel,
Resend, or Codemagic dashboard was queried. No application behaviour was
changed to produce this document. Every "requires dashboard/CLI verification"
label below means exactly that — the repository shows intent or code, not
confirmed live state.

**Classification key** — every requirement below is exactly one of:
`VERIFIED COMPLETE` · `IMPLEMENTED — DEVICE/DASHBOARD VERIFICATION REQUIRED` ·
`PARTIAL` · `PLANNED ONLY` · `NOT FOUND` · `NOT APPLICABLE`.

---

## 0. Baseline

| Item | Value |
|---|---|
| Branch | `dev` (confirmed, not switched) |
| HEAD | `9475db85bb552848b2d1788a079beb6e3647ef8e` |
| `origin/dev` | `9475db85bb552848b2d1788a079beb6e3647ef8e` — HEAD matches, branch up to date |
| Task's stated "expected" dev/origin-dev commit | `3e7c7a9a0c88ac2b971c2a2bbbfa26c3380a295f` — **dev is 5 commits ahead of this** (all 5 are Codemagic signing/Xcode-version fixes, `7e40b5c`…`9475db8`; see git log below). Flagging this as a discrepancy between the task brief and the actual repo state, not treating it as an error — `dev`/`origin/dev` agreeing with each other is what the task actually asks to confirm. |
| Working tree | Clean except one untracked file: `docs/audio-content-specification.md` (pre-existing, not created by this task — preserved untouched) |
| Staged changes | None |
| `main` (local ref) | `5818ff018dae544a6be26869f56a1eda9fe6fcad` — **1 commit ahead of `origin/main`** (`feat: add beta exercise video preview…`, 2026-09-10). This is a local-only commit never pushed; not touched or investigated further per the task's "main must remain untouched" instruction. |
| `origin/main` | `8ea8faa76579d6aa332e548562848b2908080c1e` — treated as "main's current commit" below since it's the shared/authoritative ref |
| Codemagic build | Not started (confirmed — no build was triggered by this audit) |
| External dashboards | Not modified (confirmed — no MCP/browser/API call to Supabase, Stripe, Apple, Vercel, Resend, or Codemagic was made) |

Commits between the task's expected baseline and current `dev` HEAD:
```
9475db8 fix: pin Xcode 26.6 to satisfy Apple's iOS 26 SDK upload requirement
394bb89 fix: rely on Codemagic's built-in signing setup, drop redundant fetch/keychain steps
4c82228 fix: define BUNDLE_ID explicitly instead of assuming Codemagic exposes it
f466950 fix: add missing signing fetch/keychain/use-profiles steps before archive
7e40b5c fix: use Codemagic's BUILD_NUMBER, not nonexistent CM_BUILD_NUMBER
```

---

## 1. CRITICAL — flag before anything else

**A confirmed privilege-escalation fix is written but, per its own file header, NOT applied to the live database.**

`supabase/migrations/20260915160000_harden_profiles_and_anon_grants.sql` opens with:
> `*** PROPOSED — NOT YET APPLIED. Awaiting explicit owner approval. ***`

The same file documents (as a live-tested, rolled-back-transaction finding) that **any authenticated user can currently set their own `is_admin = true` and `beta_access = true`** via a direct `UPDATE`/`INSERT` on `public.profiles`, because Supabase's platform-default grant gives `authenticated` unrestricted table-level `INSERT`/`UPDATE` on that table, and RLS is row-level (not column-level) — `profiles_update_own`'s `auth.uid() = id` check does not stop a user from writing `is_admin` on their **own** row. Because `public.is_admin()` (which gates every admin RPC) reads this same column, this is a full admin-forgery path, not a cosmetic flag.

- **Evidence:** `supabase/migrations/20260915160000_harden_profiles_and_anon_grants.sql:1-125`
- **Classification: IMPLEMENTED — DASHBOARD/CLI VERIFICATION REQUIRED** (the fix exists as a written, reviewed migration; whether it has since been applied is unknown from the repo alone)
- **Remaining work:** confirm via `supabase migration list --linked` (or the Dashboard's migration history) whether this specific file has been applied. If not applied, this is a **live security hole** and should be treated as the single highest-priority action arising from this audit — apply it (it is additive/reversible per its own header) before any wider distribution.
- **Blocks:** internal TestFlight is arguably fine (small trusted group) but **external TestFlight and public App Store are blocked** until this is confirmed applied.
- **Needs:** Supabase Dashboard/CLI action (apply migration), no code change.

Two other migrations carry the same "written but not applied" self-disclosure and should be checked the same way:
- `supabase/migrations/20260808120000_sprint2_stage2_admin_foundation.sql:51` — "this migration is written but not applied to the live database in this batch." This creates `is_admin()`, `admin_list_users()`, `admin_list_subscriptions()`, `admin_set_beta_access()`, `admin_set_subscription_status()`. **If genuinely unapplied, the entire `/admin` area (`AdminRoute.jsx`, `AdminHome.jsx`, `AdminUsers.jsx`, `AdminSubscriptions.jsx`, `adminApi.js`) is currently broken in the live app** — every RPC call would fail with "function does not exist."
- `supabase/migrations/20260808150000_sprint2_stage3a_stripe_foundation.sql:47` — "written but not applied…in this batch." This adds `stripe_customer_id`/`stripe_subscription_id`/`stripe_price_id` to `subscriptions` and creates `stripe_webhook_events`. **If genuinely unapplied, `create-checkout-session`, `create-portal-session`, and `stripe-webhook` would all fail** on their first read/write to these columns/table.

These three self-reported "not applied" statuses **contradict each other's implied timeline** in one place: `docs/account-deletion-processor-spec.md` and `docs/account-admin-runbook.md` both casually reference "once the Phase 5 migration is applied" and admin-RPC behavior as if the Stage 2/3A schema is live, while the migration files themselves say otherwise. This is flagged in §7 (Contradictions) rather than resolved here — **it can only be resolved by checking the live project**, which this audit could not do.

---

## A. Legal and commercial readiness

| Requirement | Status | Evidence | Complete | Remaining work | Blocks | Needs |
|---|---|---|---|---|---|---|
| Privacy Policy, Terms, Subscription Terms, Refund Policy, Medical Disclaimer, Account Deletion Policy, Data Retention Policy | PARTIAL | `src/lib/legalContent.js:76-505`, rendered via `LegalLayout.jsx`, routed at `/settings/:slug` | Substantive, WakeWise-specific drafts exist for all seven documents, each versioned (`DOCUMENT_VERSIONS`) with a visible draft notice | File header states explicitly: **"authored by an AI assistant… has NOT been reviewed by a lawyer."** Two clauses in Terms of Service are self-flagged as needing legal confirmation before being final (Disclaimer/Limitation of Liability, Governing Law) | Public App Store release (legal review is standard pre-launch diligence); does not block internal/external TestFlight | Legal review |
| Emergency/crisis content | VERIFIED COMPLETE | `src/lib/legalContent.js:393-397` (medical-disclaimer "In an emergency" section, cites Lifeline 13 11 14 and 000) | Present, sourced (`docs/legal-research-sources.md:55-57`) | None found | — | — |
| Legal pages reachable pre-auth | VERIFIED COMPLETE | `docs/consent-versioning-recommendation.md:48-51`; `App.jsx:288-289` (`/settings/:slug` inside unauthenticated-accessible `<Layout>` tree) | Confirmed live as guest per the doc's own note | None | — | — |
| Consent/acceptance recording | NOT FOUND | `docs/consent-versioning-recommendation.md:1-18` | Disclosure links exist at sign-up (`Auth.jsx`) and checkout (`Subscription.jsx`); document versions are centrally defined | No `legal_acceptances` table or any acceptance-recording mechanism exists anywhere — a proposed schema is documented but explicitly "not built" | Does not block TestFlight; recommended before wide public release for evidentiary purposes | Code + migration (new, not yet proposed as a diff) |
| GDPR / Australian Privacy Act applicability | PLANNED ONLY (research only) | `docs/legal-research-sources.md:34-45` | Sources gathered; both APP small-business health-data exemption and GDPR Art. 3(2) extraterritorial scope are flagged as "genuinely ambiguous," "fact-specific and unresolved" | Formal legal determination of which regimes actually apply | Public App Store / general availability, not TestFlight | Legal review |
| App Store / Play Store listing copy | PLANNED ONLY | `docs/app-store-description-recommendations.md:1-52` | Recommendations only (positioning language, prohibited claims, required subscription disclosures) — explicitly states "No app-store listing exists yet in this codebase" | Actual store listing copy needs to be written and reviewed against these recommendations | Public App Store submission | Code/content (App Store Connect listing, external to repo) |
| Stripe cancellation behavior (immediate vs. period-end) matches in-app copy | NOT FOUND (unverified) | `docs/legal-research-sources.md:24` — "cancellation is immediate by default…This codebase's actual live Stripe Customer Portal configuration…was not verified" | In-app copy (`Subscription.jsx:335`, legal content) says access continues "until it ends" | Confirm actual Stripe Customer Portal setting matches the promise made to users | Public release (a mismatch here is a real consumer-protection/ACCC risk per `docs/legal-research-sources.md:28-32`) | Dashboard verification |
| Founding-member offer (AUD 49.99 first year) legal wording | VERIFIED COMPLETE (as documentation) | `src/lib/pricingConfig.js:53-54` (`foundingMemberDisclosureText()`), `docs/founding-member-pricing-recommendation.md` | Exact required customer wording implemented as a reusable, price-linked string; eligibility-window guidance documented | Not called from any live screen yet (see Workstream E) | See Workstream E | Code (wiring), then legal sign-off on the eligibility window |

---

## B. Web and backend security

| Requirement | Status | Evidence | Complete | Remaining work | Blocks | Needs |
|---|---|---|---|---|---|---|
| `public.profiles` privilege-escalation fix | See §1 above — **IMPLEMENTED, dashboard verification required, potentially still live-vulnerable** | `supabase/migrations/20260915160000_harden_profiles_and_anon_grants.sql` | Migration written, reviewed, reversible | Confirm applied to live project | External TestFlight, public release | Dashboard/CLI |
| RLS on `profiles`, `rhythms`, `journal_entries`, `user_intentions` | VERIFIED COMPLETE (as written) | `supabase/migrations/20260804082844_stage2b_profiles_persistence_rls.sql:78-192` — `ENABLE ROW LEVEL SECURITY` + owner-scoped `CREATE POLICY` for every CRUD verb, `TO authenticated` only, no `anon`/`public` role, no `USING (true)` | All four tables have RLS enabled with owner-only policies in the migration | Confirm this migration (undated header, no "not applied" caveat, unlike the three flagged in §1) is actually live | — | Dashboard/CLI verification (routine) |
| RLS on `subscriptions` | VERIFIED COMPLETE (as written), tied to unapplied Stage 3A columns | `supabase/migrations/20260807210000_sprint2_subscriptions_foundation.sql:93-101` | Owner-SELECT-only policy, no self-service write path (by design — writes are service-role/webhook only) | Same live-application question as above | See §1 (Stripe columns) | Dashboard/CLI |
| RLS on `account_deletion_requests` | VERIFIED COMPLETE, confirmed applied | `supabase/migrations/20260915100000_account_deletion_requests.sql:38,78-84` — file header states "Applied 2026-09-15 to the linked project (kvdxuhyndevrfvsalgnx)" | Owner-SELECT-only; no client write path; partial unique index prevents duplicate pending requests | None found in repo | — | — |
| `anon` role stripped from service-role-only tables | IMPLEMENTED — dashboard verification required (same migration as §1) | `supabase/migrations/20260915160000_harden_profiles_and_anon_grants.sql:121-123` | `REVOKE ALL … FROM anon` on `subscriptions`, `account_deletion_requests`, `stripe_webhook_events` | Confirm applied | External TestFlight, public release | Dashboard/CLI |
| Storage buckets / storage RLS policies | NOT FOUND in repo | Grepped all of `supabase/` for `storage.buckets`/`storage.objects`/storage `CREATE POLICY` — zero matches | The `wellness-videos` private bucket is referenced and relied upon (`get-beta-video-url/index.ts:9-12,165-167`) but its creation and access policy live entirely outside this repository | Confirm in Supabase Dashboard → Storage that `wellness-videos` truly has no public/anon read policy | Public release (a misconfigured bucket policy would bypass the signed-URL gate entirely) | Dashboard verification |
| Edge Function auth — `create-checkout-session` | VERIFIED COMPLETE (as written) | `supabase/functions/create-checkout-session/index.ts:30-53` | Verifies caller JWT via `authClient.auth.getUser(jwt)`, rejects missing JWT and anonymous sessions, never trusts a client-supplied user id | None | — | — |
| Edge Function auth — `create-portal-session` | VERIFIED COMPLETE | `supabase/functions/create-portal-session/index.ts:27-44` | Same pattern | None | — | — |
| Edge Function auth — `stripe-webhook` | VERIFIED COMPLETE | `supabase/functions/stripe-webhook/index.ts:98-114` | No user JWT (correct — Stripe calls this directly); trust comes from `stripe.webhooks.constructEventAsync` signature verification against `STRIPE_WEBHOOK_SECRET`; idempotent via `stripe_webhook_events` | None | — | — |
| Edge Function auth — `get-beta-video-url` | VERIFIED COMPLETE | `supabase/functions/get-beta-video-url/index.ts:132-149` | JWT-verified, anonymous rejected, exercise id resolved only through a fixed `Map` allowlist (never a raw Storage path) | None | — | — |
| Edge Function auth — `request-account-deletion` | VERIFIED COMPLETE | `supabase/functions/request-account-deletion/index.ts:52-104` | JWT-verified, anonymous rejected, server-side password re-authentication (`signInWithPassword`) as the real gate, confirmation phrase re-checked server-side, billing status read server-side (never client-asserted) | None | — | — |
| Edge Function auth — `cancel-account-deletion` | VERIFIED COMPLETE | `supabase/functions/cancel-account-deletion/index.ts:26-43` | JWT-verified, anonymous rejected, acts only on caller's own pending row | None | — | — |
| CORS on Edge Functions | VERIFIED COMPLETE (acceptable for this design) | `supabase/functions/_shared/cors.ts:5-9` | `Access-Control-Allow-Origin: '*'` — broad, but every function requires a bearer JWT (not cookies), so wildcard CORS does not by itself expose a CSRF/credential-leak path | None required | — | — |
| Account deletion — request/cancel flow | VERIFIED COMPLETE | `request-account-deletion`, `cancel-account-deletion` functions; `src/pages/DeleteAccount.jsx` | Full UI wizard (status → explain → billing → reauth → confirm), 7-day cancellable grace period, idempotent, race-safe (`23505` handling) | None | — | — |
| Account deletion — **permanent processing** | **PLANNED ONLY / NOT FOUND** | `docs/account-deletion-processor-spec.md:1-4` — "**Status: specification only. Not built. No automated worker exists.**" | A precise, schema-verified, ordered spec exists (10 steps) for what a future worker or careful manual run must do | No automated worker exists. Today, final deletion is a fully manual operator action following the spec by hand via the Supabase Dashboard (`docs/account-admin-runbook.md:19`) | Does not strictly block TestFlight (Apple only requires the *request* be initiable in-app, which it is); recommend building automation before public scale-up, and confirm with legal/App Review whether "manual completion within 30 days" satisfies Apple's expectations at scale | Code (new worker) + legal/App-Review policy confirmation |
| Session handling / token storage | PARTIAL | `src/lib/supabaseClient.js`, `docs/ios-security-privacy-future-requirements.md:62-74` | Default Supabase JS `localStorage` session persistence; inside WKWebView this is app-sandboxed, not shared with Safari | Not iOS Keychain-backed; doc recommends a custom Keychain-backed storage adapter before shipping paid subscriptions, "explicitly out of scope for this phase" | Recommended before public release, not a hard TestFlight blocker | Code (native plugin integration) |
| Native password-recovery deep link security | IMPLEMENTED — dashboard verification required | `src/lib/nativeAuthRecovery.js` (full file), `src/lib/resetPasswordAccess.js`, both fully unit-tested | Token-free one-way fingerprint dedup, fixed allow-listed paths, tokens never logged/persisted, `setSession()`-based establishment, `shouldTreatAsValidRecovery` invariant isolated and tested | **Cannot work end-to-end** until `wakewise://reset-password` is added to Supabase Auth's redirect URL allow-list — "explicitly not made in this phase" (`docs/ios-xcode-handoff.md:359-420`) | External TestFlight (recovery is a core account-safety flow) | Dashboard action (Supabase Auth → URL Configuration), then physical-iPhone test (§11b) |
| Environment variable names in use (values not disclosed) | VERIFIED COMPLETE (inventory only) | grep of `import.meta.env.*` and `Deno.env.get(*)` across `src/` and `supabase/functions/` | Client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SOLAS_SUBSCRIPTION_OVERRIDE`); server (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PLUS_MONTHLY`, `STRIPE_PRICE_PLUS_YEARLY`) | None — this is a complete list from the current codebase | — | — |
| Secret-bearing files excluded from git | VERIFIED COMPLETE | `.gitignore:26-32` (`.env.local`, `.env*`, `.vercel`, `supabase/.temp/`); `git ls-files \| grep -i env` → no results | Confirmed no env file is tracked | None | — | — |
| CSP / security headers (web) | VERIFIED COMPLETE | `vercel.json:9-35` | CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy all present and scoped to actual dependencies (Supabase project host, Vercel, fonts) | None found | — | — |
| Secret-pattern scan of tracked files | VERIFIED COMPLETE (this audit) | `git grep` for Stripe/Google/AWS/private-key/JWT-shaped patterns across all tracked files — zero matches | Scan run as part of this audit (§6) | — | — | — |

---

## C. Capacitor iOS foundation

| Requirement | Status | Evidence | Complete | Remaining work | Blocks | Needs |
|---|---|---|---|---|---|---|
| Capacitor project generated (`ios/`) | VERIFIED COMPLETE | `ios/App/App.xcworkspace`, `App.xcodeproj`, `AppDelegate.swift`, `Info.plist`, Podfile, `capacitor-cordova-ios-plugins/` all present and committed | Full Xcode project scaffolding exists | None (generation itself) | — | — |
| `appId`/bundle identifier consistency | VERIFIED COMPLETE (as documented) | `capacitor.config.json:2` (`com.zavaraai.wakewise`), cross-referenced in `codemagic.yaml:52-62` as "verified identical…to `Info.plist`, `PRODUCT_BUNDLE_IDENTIFIER`" | Consistent across the files this audit could read | Confirm the identifier is registered/available under the actual shipping Apple Developer Team (`docs/ios-xcode-handoff.md:63-76` flags this explicitly as unconfirmed) | TestFlight (build/signing would fail otherwise) | Apple Developer account check (macOS/Xcode) |
| No `server.url` (bundled assets, not remote) | VERIFIED COMPLETE | `docs/ios-security-privacy-future-requirements.md:10-11`; `capacitor.config.json` has no `server` key | App loads from `ios/App/App/public`, not the Vercel site | None | — | — |
| App Transport Security (no cleartext exception) | VERIFIED COMPLETE | `Info.plist` has no `NSAppTransportSecurity` key (confirmed by direct read) | Platform HTTPS-only default applies | None | — | — |
| No unnecessary permission usage-strings | VERIFIED COMPLETE | `Info.plist` (full read) — no camera/microphone/location keys | Matches actual API usage (none of those) | None | — | — |
| `webContentsDebuggingEnabled` disabled before ship | **NOT DONE — must fix before any TestFlight/App Store build** | `capacitor.config.json:9` currently `true`; `docs/ios-security-privacy-future-requirements.md:30-34` and `docs/ios-xcode-handoff.md:106-121` both flag this explicitly | Deliberately `true` for this dev-only phase | Set to `false` in `capacitor.config.json`, then re-run `npx cap sync ios`, before **any** TestFlight build | **Blocks internal TestFlight** (this is an explicit, repo-documented gate) | Code (one-line config change) + `npx cap sync ios` |
| Only public credentials bundled into native build | VERIFIED COMPLETE | `docs/ios-security-privacy-future-requirements.md:25-29` — "confirmed by grep of `dist/` and `ios/App/App/public/`" | Only `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` compiled in; no service-role/Stripe secret in built output | None found | — | — |
| Deep-link scheme (`wakewise://`) registered | VERIFIED COMPLETE | `Info.plist:50-60` (`CFBundleURLSchemes: [wakewise]`); `src/hooks/useNativeDeepLinks.js` | Scheme registered, allow-listed paths enforced client-side (`auth`, `reset-password`) | None (registration itself) — see B for the Supabase-side dependency | — | — |
| CocoaPods dependency footprint | VERIFIED COMPLETE (as of this audit) | `docs/ios-security-privacy-future-requirements.md:114-118` | Only Capacitor's own core/iOS/app packages plus `@capacitor/local-notifications` | Re-review scrutiny recommended for any future native plugin (StoreKit, secure-storage) | — | — |
| `.entitlements` file / Associated Domains | NOT FOUND (not applicable yet) | `Glob` for `ios/**/*.entitlements` → no results | No entitlements file exists — not needed today since only a custom URL scheme (not Universal Links) is used, and no push/StoreKit capability is enabled yet | Will be needed once/if Apple IAP (StoreKit capability) or push notifications are added | Blocks whichever future feature needs it | Xcode (macOS) |

---

## D. Native wake reminder — see the dedicated gap register in §4 below.

## E. Apple subscription sandbox — see the dedicated gap register in §5 below.

## F. Final native security and privacy

| Requirement | Status | Evidence | Complete | Remaining work | Blocks | Needs |
|---|---|---|---|---|---|---|
| Privacy manifest (`PrivacyInfo.xcprivacy`) | NOT FOUND | `Glob` for `ios/**/*xcprivacy*` → no results; `docs/ios-security-privacy-future-requirements.md:54-60` explicitly lists this as a future requirement | None created | Must declare at minimum: user account data (email, via Supabase Auth) and any "required reason" API usage (UserDefaults, timestamps) the final native code uses; should also mention `@capacitor/local-notifications`'s use once drafted | **Blocks public App Store submission** (Apple enforces this at submission); does not block internal/TestFlight-only distribution today, but Apple has been expanding enforcement — treat as required before any App Store Connect submission | Xcode/macOS (create the manifest file) |
| App Store Connect privacy "nutrition label" | NOT FOUND (recommendations only) | `docs/ios-security-privacy-future-requirements.md:105-112` | Current actual data collection surface documented (email/auth identity, app-generated wellness content; no third-party analytics/ad SDKs) | Must be drafted and entered in App Store Connect at submission time | Public App Store release | Dashboard action (App Store Connect) |
| `webContentsDebuggingEnabled: false` before ship | Duplicated from C above — **not yet done** | `capacitor.config.json:9` | — | Same fix as C | Internal TestFlight | Code |
| Keychain-backed session token storage | PARTIAL (documented gap, not built) | `docs/ios-security-privacy-future-requirements.md:62-74` | WKWebView-sandboxed `localStorage`, a real improvement over nothing, but not Keychain-backed | Recommended (not mandated) before shipping paid subscriptions | Recommended before public release | Code (native plugin) |
| App Transport Security exceptions | VERIFIED COMPLETE (none exist, none needed) | Same as C | No exceptions exist; doc states none should be added without narrow scoping + written justification | None currently | — | — |
| Signing / provisioning profile / Team confirmed | NOT FOUND (cannot be from Windows) | `docs/ios-xcode-handoff.md:57-76` | Automatic-signing instructions documented | Requires macOS + Xcode + an actual Apple Developer Team login | Blocks any TestFlight upload | macOS/Xcode + Apple Developer account |

## G. Global performance

| Requirement | Status | Evidence | Complete | Remaining work | Blocks | Needs |
|---|---|---|---|---|---|---|
| Route-level code splitting | VERIFIED COMPLETE | `src/App.jsx:18-30,99` | Every page component (~45) is `React.lazy()`-loaded behind a shared `<Suspense>` fallback; only `Layout`/`AdminRoute` remain static | None | — | — |
| Vendor/dependency chunk splitting | VERIFIED COMPLETE | `vite.config.js:17-26` | `manualChunks` separates `react`/`react-dom`/`react-router-dom` (vendor) and `@supabase/supabase-js` (supabase) into their own long-lived cacheable chunks | None | — | — |
| Production build output size | VERIFIED COMPLETE (measured this audit) | `npm run build` output (§6) | Largest chunks: `supabase-*.js` 218 kB (57 kB gzip), `vendor-*.js` 163 kB (53 kB gzip), `index-*.js` 69 kB (22 kB gzip); every route chunk is small (1–45 kB) | No further action identified from static analysis alone | — | — |
| Real-device perceived performance | IMPLEMENTED — DEVICE VERIFICATION REQUIRED | `docs/ios-xcode-handoff.md:170-172` ("Test on a slow/offline network…confirm the app degrades no worse than the web version") | Code-level splitting work is done | Actual on-device load time, interaction latency, and network-degradation behavior are unverified — this is a physical-iPhone task, not a static-analysis one | External TestFlight (perf regressions are exactly what beta testers surface) | Physical iPhone |

## H. Physical-iPhone regression

**Status across the board: NOT DONE.** `docs/ios-xcode-handoff.md §11` and `§11a` already contain a complete, specific, unchecked checklist (cold launch, sign-in/session persistence, sign-out clears session, forgot-password external-browser fallback, in-app back navigation, media playback + mute/headphones/lock/background, device rotation, safe-area insets, background/resume state survival, slow/offline network — plus the full morning-reminder device matrix in §11a). This audit did not check any of these boxes; none should be reported as passing without running them on real hardware, per that document's own instruction.

- **Evidence:** `docs/ios-xcode-handoff.md:123-251`
- **Classification: NOT FOUND (as completed work) / PLANNED (as a checklist)** — the checklist itself is thorough and ready to execute; execution has not happened.
- **Blocks:** internal TestFlight at minimum (cold-launch/session persistence are basic functional risks), certainly external TestFlight and public release.
- **Needs:** physical iPhone + macOS/Xcode.

## I. TestFlight readiness and distribution

| Requirement | Status | Evidence | Complete | Remaining work | Blocks | Needs |
|---|---|---|---|---|---|---|
| Codemagic workflow defined | VERIFIED COMPLETE | `codemagic.yaml` (full file, 248 lines) | Manual-trigger-only pipeline: `npm ci` → `npm run build` → `npm test` → `npm run lint` → `cap sync` → `pod install` → set build number → automatic signing → archive → upload to TestFlight processing only (`submit_to_testflight: true`, `submit_to_app_store: false`, no `beta_groups`) | None — this is a complete, reviewed, credential-free pipeline definition | — | — |
| Codemagic setup guide | VERIFIED COMPLETE (as documentation) | `docs/codemagic-setup-guide.md` (21 sections) | Step-by-step guide for connecting the repo, App Store Connect record, API key integration, signing, env var group, running/inspecting builds | Guide itself does not perform the setup — that's a one-time dashboard action | Any Codemagic build (setup, not this audit's job) | Dashboard action |
| Xcode/device handoff guide | VERIFIED COMPLETE (as documentation) | `docs/ios-xcode-handoff.md` (full file) | Extremely thorough — prerequisites, signing, on-device test matrix (§11/§11a/§11b), explicit **"Gates before TestFlight"** checklist (§13), Supabase dashboard handoff steps (§14) | Execution of everything it describes (all gated on macOS/Xcode/physical device) | Internal TestFlight (per its own §13 gate list) | macOS/Xcode/physical iPhone |
| CI test/lint gates | VERIFIED COMPLETE (this audit re-ran them) | `codemagic.yaml:130-138`; `npm test`/`npm run lint` results in §6 below | Pipeline runs the same test/lint commands verified in this audit; both currently pass | None | — | — |
| Bundle ID / signing availability under shipping Apple team | NOT FOUND (cannot verify from Windows) | `docs/ios-xcode-handoff.md:63-76` | Flagged explicitly as an open Apple-account decision | Confirm `com.zavaraai.wakewise` isn't registered under a different team than the shipping one | Any TestFlight upload | Apple Developer account (macOS) |
| Explicit TestFlight gate checklist | VERIFIED COMPLETE (as documentation), NOT satisfied yet | `docs/ios-xcode-handoff.md:337-355` | Four explicit gates listed: (1) §11/§11a device tests, (2) native password-reset completing end-to-end including the Supabase dashboard change, (3) `webContentsDebuggingEnabled: false`, (4) privacy manifest + nutrition label drafted | None of the four are yet satisfied per this audit's evidence | Internal TestFlight | All of the above (mixed: code, dashboard, device) |

## J. During-TestFlight work

| Requirement | Status | Evidence | Complete | Remaining work | Blocks | Needs |
|---|---|---|---|---|---|---|
| Crash/error monitoring for TestFlight builds | NOT FOUND | No crash-reporting SDK in `package.json` dependencies; no Sentry/Crashlytics/similar reference anywhere in `src/` or `ios/` | None | Decide on and integrate a crash-reporting solution (or rely solely on App Store Connect's own crash logs) before external TestFlight, so beta issues are diagnosable | External TestFlight (internal-only is lower risk, but still recommended) | Code (new dependency) + a product decision |
| Beta feedback intake | PARTIAL | `src/pages/Feedback.jsx`, `src/lib/feedbackStorage.js`, `src/lib/feedbackCategories.js` exist as an in-app feedback mechanism; `src/pages/Beta.jsx` + `src/components/BetaChecklist.jsx` for the closed-beta program | An in-app feedback path already exists, independent of Apple's own TestFlight feedback screenshot mechanism | Confirm this in-app mechanism is actually monitored/triaged during a TestFlight period (process question, not a code gap) | — | Process decision |
| Release notes for testers | VERIFIED COMPLETE (mechanism exists) | `src/pages/ReleaseNotes.jsx`, `src/lib/releaseNotesContent.js` | In-app release notes page exists and is routed (`/release-notes`) | Ensure content is kept current for each TestFlight build | — | Process (content upkeep) |
| Post-TestFlight iteration plan (fixing found issues, re-submitting) | NOT FOUND | No documented process for this in `docs/` | — | Not a code gap — recommend documenting a lightweight "TestFlight → triage → fix → re-build" loop once the first build is out | — | Process documentation |

---

## 2. Contradictions found in existing documentation

1. **Admin/Stripe schema "applied" status is asserted inconsistently across documents.** `docs/account-admin-runbook.md:18,54` ("once the Phase 5 migration is applied," implying it may not be) is consistent with the migration files' own self-disclosure, but `docs/subscription-entitlement-architecture.md`'s "Current state (verified)" section (lines 7-24) describes the Stripe columns on `subscriptions` as simply existing ("Populated by the Stripe webhook only") without repeating the "not applied in this batch" caveat that `20260808150000_sprint2_stage3a_stripe_foundation.sql:47` itself states. **Resolution requires a live dashboard/CLI check** (`supabase migration list --linked`), not a repo-only judgment call — flagged, not resolved, in this register.
2. **`docs/ios-xcode-handoff.md` and `docs/ios-security-privacy-future-requirements.md` are otherwise fully consistent** with each other and with the actual code (`capacitor.config.json`, `Info.plist`) — no contradiction found between these two.
3. No other material contradiction was found between documentation and code during this audit; where a document's claim could be checked against a file (env vars, RLS policies, CORS, migration contents), it matched.

---

## 3. Validation results

| Check | Result |
|---|---|
| `npm test` | **PASS** — 4 test files, 59 tests, all passed (`resetPasswordAccess.test.js`, `authRedirect.test.js`, `nativeAuthRecovery.test.js`, `nativeMorningReminder.test.js`). One expected `console.error`-level stderr line from a deliberate "native call rejects" test case — not a failure. |
| `npm run build` | **PASS** — Vite production build completed in 1.52s; ~90 route/vendor chunks emitted to `dist/` (gitignored, does not dirty the tree). Largest chunks: `supabase` 218 kB / 57 kB gzip, `vendor` 163 kB / 53 kB gzip. |
| `npm run lint` | **PASS with 4 pre-existing warnings**, 0 errors — all four are `react-hooks/exhaustive-deps` missing-dependency warnings in `AdminRoute.jsx:46`, `Layout.jsx:56`, `SubscriptionContext.jsx:106`, `AccountManagement.jsx:44`. Not introduced by this audit; not blocking. |
| `git diff --check` | **PASS** — no whitespace errors (no diff exists to check; working tree is clean apart from the pre-existing untracked file). |
| Secret-pattern scan | **PASS (clean)** — `git grep` across all tracked files for Stripe live/test keys, webhook secrets, Google API keys, AWS access keys, PEM private-key headers, and JWT-shaped strings (`eyJhbGciOiJ…`) returned zero matches. Filenames only would have been reported had any matched; none did. |

No command failed; none needed to be weakened or bypassed.

---

## 4. Native wake-reminder gap register

Assessed against the installed `@capacitor/local-notifications@7.0.7` package (types read directly from `node_modules/@capacitor/local-notifications/dist/esm/definitions.d.ts` and the bundled `README.md` API docs — not invented). Implementation lives in `src/lib/nativeMorningReminder.js`, `src/context/MorningReminderContext.jsx`, `src/hooks/useMorningReminderNotificationTap.js`, wired into `src/context/AlarmContext.jsx` (the wake-time source) and `src/pages/NotificationSettings.jsx` (the UI).

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Closed-app local notification | VERIFIED COMPLETE (as code) | `nativeMorningReminder.js:83-101` — `LocalNotifications.schedule()` with `schedule: { on: { hour, minute } }` | This is an OS-level `UNCalendarNotificationTrigger`-backed local notification, independent of the app process — correct mechanism for closed-app delivery. Actual closed-app firing is unverified on hardware (see H). |
| User-selected wake time | VERIFIED COMPLETE | `AlarmContext.jsx:73-75` (`alarmTime`, user-editable via Onboarding), consumed by `MorningReminderContext.jsx:35,86` | Single wake time, not per-day times. |
| **Weekday selection** | **NOT FOUND** | `nativeMorningReminder.js:83-101` — `schedule.on` only ever sets `{ hour, minute }`, never `weekday` | The plugin's `ScheduleOn` type **does** support a `weekday` field (`Weekday` enum, Sunday=1..Saturday=7 — confirmed in the plugin's own docs), so weekday selection is technically supported by the plugin; it is simply not used. Today the reminder fires **every day**, with no way to exclude e.g. weekends. Note: the separate web-only `notificationPreferences.js` categories (`wakeUp`, etc.) do have a `weekdays` array and a "Custom days" UI (`NotificationSettings.jsx:73-100`), but that is a **different, foreground-only, non-native** reminder system — it does not control the native morning reminder. |
| Device-local timezone behaviour | IMPLEMENTED — DEVICE VERIFICATION REQUIRED | `nativeMorningReminder.js:79-81` (doc comment: "using the device's local calendar/time-zone behaviour…so it follows DST and local-time changes on its own") | Relies on iOS's own `UNCalendarNotificationTrigger` wall-clock semantics. Plausible but unverified without a physical device across a DST boundary or timezone change — explicitly listed as untested in `docs/ios-xcode-handoff.md:208-211`. |
| **Explicit timezone-change rescheduling** | **NOT FOUND** | No code path in `nativeMorningReminder.js` or `MorningReminderContext.jsx` listens for a timezone-change event and re-schedules the *native* notification. `AlarmContext.jsx:91-108` has device-timezone-mismatch detection, but it only drives a UI banner (`timezoneMismatch`) and the **in-app alarm clock check** (`getZonedParts(effectiveTimezone, …)`) — it is never wired to call `scheduleMorningReminder()` again. | Since the native trigger is a device-local wall-clock calendar trigger, this may be a non-issue in practice (iOS recomputes the next fire time using the current system calendar), but this has not been verified, and no code explicitly forces a reschedule on a detected zone change the way the in-app alarm clock's own logic does. |
| Custom sound | **NOT FOUND** | `nativeMorningReminder.js:88-97` — the scheduled notification object has no `sound` key | The plugin supports a custom `sound` field (README: "Name of the audio file to play…On iOS, the file should be in the app bundle"). Today the reminder uses the OS default sound only. |
| Notification permission explanation | PARTIAL | `NotificationSettings.jsx:142-146` — "This is a reminder, not a guaranteed alarm…We'll ask permission the first time you turn this on." | Minimal inline copy exists *before* the toggle is tapped, satisfying the letter of "explain before prompting," but there is no dedicated priming screen and no handling of the plugin's distinct `'prompt-with-rationale'` permission state (the code only branches on `'denied'` vs. everything else). |
| Denied-permission handling | VERIFIED COMPLETE | `NotificationSettings.jsx:137-141`; `nativeMorningReminder.js:128-139` (`enableMorningReminder` never schedules unless permission is `'granted'`) | UI clearly shows "Enable them in iPhone Settings…" and the toggle reflects `off`. |
| Notification tap routing | VERIFIED COMPLETE | `nativeMorningReminder.js:43-49` (`resolveTapTarget`) + `useMorningReminderNotificationTap.js` | Hardcoded id + `extra.target` check only — cannot be redirected by a forged payload; well-designed and unit-tested. |
| **Begin action** | **NOT FOUND** | No `registerActionTypes()` call anywhere in the codebase (grepped); `nativeMorningReminder.js:88-97` sets no `actionTypeId` | The plugin fully supports this (`registerActionTypes`, `ActionType.actions[]`, `Action.id`/`title`/`foreground`) — simply unused. Tapping the notification body opens the app to `/morning-start` (see routing above), which functions as an implicit "Begin," but there is no explicit notification-level "Begin" action button. |
| **Snooze action** | **NOT FOUND** (as a notification action) | Same as above — no registered action | A "Snooze" concept exists in-app (`AlarmContext.jsx:365-392`, `snooze()`), but it is only reachable from the in-app `AlarmActive` screen after opening the app, not as a direct action button on the notification itself (which iOS supports via `UNNotificationAction`/`registerActionTypes`). |
| **Skip action** | **NOT FOUND** (as a notification action) | Same as above | Same situation as Snooze — an in-app "Skip Routine" concept exists (referenced in `AlarmContext.jsx:349-357`) but not as a notification action. |
| Rescheduling after wake-time changes | VERIFIED COMPLETE | `MorningReminderContext.jsx:82-93` — effect keyed on `alarmTime`, calls `scheduleMorningReminder(alarmTime)` (same fixed id replaces, no duplication) | Correct and unit-tested indirectly via `nativeMorningReminder.test.js`. |
| Rescheduling after permission changes | IMPLEMENTED — DEVICE VERIFICATION REQUIRED | `MorningReminderContext.jsx:65-80` — reconciles real permission/pending state on every mount (app start/resume), never trusts a stored flag | Reconciliation is mount-based, not a live OS permission-change listener (the plugin exposes no such event) — this is the correct available pattern given the plugin's API, but its actual behavior after a mid-session Settings change is untested on hardware (`docs/ios-xcode-handoff.md:195-199`). |
| Duplicate prevention | VERIFIED COMPLETE | `nativeMorningReminder.js:6-12` (fixed `MORNING_REMINDER_NOTIFICATION_ID = 990001`); unit-tested (`nativeMorningReminder.test.js:117-126`) | iOS replaces a pending request sharing the same identifier — no explicit cancel-then-schedule needed, and none is done. |
| Logout cancellation | VERIFIED COMPLETE | `MorningReminderContext.jsx:98-109` — effect on `user` transitioning to `null` calls `cancelMorningReminder()` | Correct; guards against carrying a stale account's reminder into the next session on a shared device. |
| **Account-deletion cancellation** | **NOT FOUND (as an explicit code path)** | Grepped `accountDeletionApi.js`, `request-account-deletion/index.ts`, `DeleteAccount.jsx` for any call to `cancelMorningReminder`/`disableMorningReminder` — none found | Submitting an account-deletion *request* does not sign the user out (the account remains active during the 7-day grace period), so the existing logout-based cancellation does not fire at request time — matching `docs/ios-xcode-handoff.md:241-246`'s own open test item ("submit an account-deletion request…and confirm the reminder is cancelled at that point too" — explicitly unverified/undone). At final (manual, server-side) deletion, there is in any case no device present to cancel a local notification on — this is an inherent limitation of local (not push) notifications, not something a code fix alone can close. |
| Foreground behaviour | NOT FOUND (unconfigured, default assumed) | `nativeMorningReminder.js:88-97` sets no `silent` key (plugin supports `silent: boolean` for iOS foreground suppression) | Default OS/plugin foreground presentation behavior applies; not explicitly decided or tested. |
| Background behaviour | IMPLEMENTED — DEVICE VERIFICATION REQUIRED | Standard iOS local-notification guarantee | Untested on hardware (`docs/ios-xcode-handoff.md:228-231`). |
| Locked-device behaviour | IMPLEMENTED — DEVICE VERIFICATION REQUIRED | Standard iOS guarantee | Untested (`docs/ios-xcode-handoff.md:200-203`). |
| Terminated-app behaviour | IMPLEMENTED — DEVICE VERIFICATION REQUIRED | Standard iOS guarantee (local notifications are OS-scheduled, not app-process-dependent) | Untested (`docs/ios-xcode-handoff.md:232-234`, cold-launch tap). |
| Device-restart persistence | IMPLEMENTED — DEVICE VERIFICATION REQUIRED | Standard iOS guarantee, explicitly called out as unconfirmed | `docs/ios-xcode-handoff.md:204-207` — "iOS local notifications are expected to survive a restart, but this has not been confirmed for this app." |

### Ordered implementation plan for the missing/partial items

1. **Weekday selection** — extend `nativeMorningReminder.js` to accept a set of weekdays; schedule one `LocalNotifications.schedule()` call per selected weekday (distinct fixed ids, e.g. `990001`–`990007`), using the plugin's native `ScheduleOn.weekday` field; update `cancelMorningReminder()`/`getPendingMorningReminder()` to operate over the full id range; add a weekday-picker UI to the "Morning reminder" section in `NotificationSettings.jsx` (the existing `WEEKDAY_LABELS`/day-toggle UI pattern in the same file, currently used for the unrelated web category reminders, can be reused as a visual model).
2. **Custom sound** — add a `sound` field to the scheduled notification once a sound asset is chosen and bundled into the iOS app target (requires an Xcode/macOS step to add the audio file to the app bundle, per the plugin's own requirement that iOS sounds be bundle-resident).
3. **Begin / Snooze / Skip notification actions** — call `LocalNotifications.registerActionTypes()` once at app start with a category (e.g. `morning-reminder-actions`) carrying three `Action`s (`begin`, `snooze`, `skip`); set `actionTypeId` on the scheduled notification; extend `useMorningReminderNotificationTap.js`'s listener to branch on `actionPerformed.actionId` (not just the default tap) and route/snooze/dismiss accordingly, reusing the existing in-app `snooze()`/skip logic from `AlarmContext.jsx` where possible without requiring the app to be foregrounded first for a snooze/skip action.
4. **Explicit timezone-change rescheduling** — wire a device-timezone-change detection (e.g. re-derive `detectDeviceTimezone()` on `App.appStateChange`/resume, comparing against the last-known value) to call `scheduleMorningReminder(alarmTime)` again, rather than relying solely on the OS's own calendar-trigger recomputation.
5. **Account-deletion cancellation** — add a `cancelMorningReminder()` call at the point `requestAccountDeletion()` succeeds in `accountDeletionApi.js`/`DeleteAccount.jsx`, so the reminder stops during the 7-day grace period rather than only at final (server-side) deletion.
6. **Foreground behaviour** — explicitly decide and set the `silent` flag (or leave the OS default deliberately, documented as a choice rather than an oversight).
7. **Permission-explanation depth** — branch UI copy on the plugin's `'prompt-with-rationale'` state distinctly from `'prompt'`, if richer copy is wanted before a second-chance prompt.

**Cannot be proven without a physical iPhone** (independent of the above code work): closed-app/background/locked/terminated/restart delivery, DST/timezone-change firing behavior, Focus/silent-mode suppression behavior, and DND interaction — all explicitly called out as unverified in `docs/ios-xcode-handoff.md §11a`.

---

## 5. Apple-subscription gap register

**Overall status: PLANNED ONLY.** No StoreKit code, product identifiers, receipt/transaction verification, or purchase UI exists anywhere in this repository. `package.json` has no IAP-related dependency (no `cordova-plugin-purchase`, no RevenueCat SDK, no `@capacitor-community/*` purchase plugin). All subscription commerce today is Stripe-only, web-checkout-only.

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| AUD 7.99 monthly | IMPLEMENTED (Stripe only) — DASHBOARD RECONCILIATION REQUIRED | `src/lib/pricingConfig.js:27` (`MONTHLY_PRICE = 7.99`) | Display-only constant. `pricingConfig.js`'s own header states these figures are "ZavaraAI's PROPOSED…pricing," **not reconciled against the actual Stripe Price object** `STRIPE_PRICE_PLUS_MONTHLY` points to — secret values aren't readable from the repo. No Apple product exists for this at all. |
| AUD 59.99 annual | Same as above | `pricingConfig.js:28` (`ANNUAL_PRICE = 59.99`) | Same Stripe-reconciliation caveat; no Apple product. |
| 7-day trial | IMPLEMENTED (documented in legal copy and pricing config) — DASHBOARD VERIFICATION REQUIRED | `pricingConfig.js:25` (`TRIAL_DAYS = 7`), `legalContent.js:270-273` | Whether the live Stripe Checkout session is actually configured with a matching 7-day trial period was not verified (Stripe Checkout session creation in `create-checkout-session/index.ts:107-115` does not pass a `trial_period_days` — **this is worth a direct look**: the trial appears to need to be configured on the Stripe Price/Product itself, not in this function, but that was not independently confirmed). No Apple StoreKit trial exists. |
| AUD 49.99 founding first year | **PLANNED ONLY** | `docs/founding-member-pricing-recommendation.md` (full file), `pricingConfig.js:34-35,53-54` | Copy and constants exist; "not yet called from any live screen"; no Stripe Price object created; explicitly requires a separate approval step before implementation. No Apple product. |
| Purchase (Apple IAP) | **NOT FOUND** | No StoreKit/IAP code anywhere | Purchases today only happen via Stripe Checkout (`stripeApi.js` → `create-checkout-session`), which is itself an App Store Review Guideline 3.1.1 risk for any digital content unlocked *inside* the iOS app once it ships — Apple requires IAP for that, not an external payment redirect, unless the app qualifies for an external-link exception. `docs/subscription-entitlement-architecture.md:80-88` documents this as a known future project, not resolved. |
| Restore Purchases | **NOT FOUND** (removed by design for the web flow) | `Subscription.jsx:31-39` (doc comment): "The old 'Restore purchases' placeholder is gone entirely: a hosted-redirect flow has no separate restore concept" | Correct for Stripe-only web billing; will need to be **added back** specifically for Apple IAP (StoreKit's restore-purchases API), since that's an Apple requirement distinct from Stripe's model. |
| Manage Subscription | IMPLEMENTED (Stripe only) | `Subscription.jsx:310-323` (`handleManageSubscription` → `openBillingPortal()` → `create-portal-session` Edge Function) | Works for Stripe subscribers; no equivalent exists for a future Apple-channel subscriber (Apple's own subscription management is typically a deep link to iOS Settings, not this in-app button). |
| Renewal / grace-period / expiry / refund / revocation states | PARTIAL (Stripe only, coarse) | `supabase/functions/_shared/planMapping.ts:37-48` (`STRIPE_STATUS_MAP`) | Only four stored states (`trial`/`active`/`cancelled`/`expired`); Stripe's `past_due` is folded into `active` (a deliberate short grace period), `unpaid`/`incomplete` folded into `expired` — **no distinct grace-period or past-due state is stored**, as `docs/subscription-entitlement-architecture.md:22,34-64` itself documents and proposes fixing. No Apple-side state (grace period, billing retry, revocation, refund via Apple) exists at all — Apple's own renewal/grace/refund semantics differ from Stripe's and are not modeled anywhere. |
| Server-side Apple transaction verification | **NOT FOUND** | No App Store Server API / JWS receipt-verification code anywhere | Fully unbuilt; `docs/subscription-entitlement-architecture.md:81-85` documents exactly what would be required (server-side receipt/JWS verification, Apple Server Notifications V2 webhook-equivalent, periodic re-verification). |
| Stripe and Apple unified entitlements | **NOT FOUND / PLANNED ONLY** | `docs/subscription-entitlement-architecture.md` (full file) — explicitly "Status: documentation only. Nothing in this document is implemented." | `public.subscriptions` can represent exactly one purchase-source's state per user at a time; a proposed normalized `entitlements` model (one row per user × purchase_source) is documented but not migrated. `entitlements.js`'s `isSubscribed()` resolution logic does not change. |
| Account deletion with active subscriptions | VERIFIED COMPLETE (for Stripe; Apple not applicable yet) | `request-account-deletion/index.ts:37-42,107-120` (`classifyBillingStatus`), `docs/account-deletion-processor-spec.md` step 3 | Billing status is classified and recorded server-side at request time; the (manual) processor spec's step 3 requires reconciling/cancelling the Stripe subscription before the Auth user is removed. No Apple-specific handling exists because no Apple channel exists yet — `docs/subscription-entitlement-architecture.md:86-88` correctly notes Apple's own account-deletion guideline (5.1.1(v)) is already satisfied by the existing in-app deletion request flow, independent of purchase channel. |
| Sandbox-only testing | **NOT APPLICABLE (nothing to sandbox yet)** | No StoreKit configuration file, no Apple sandbox tester setup found anywhere in the repo | Cannot be tested until Apple IAP is actually built; Stripe itself is currently in **test mode** per multiple migration comments ("Stripe (test mode) foundation") — confirm current Stripe mode (test vs. live) via the Stripe Dashboard before any public release, since this repo cannot distinguish the two from code alone. |

**This task did not implement any Apple billing code, per its own instruction — the above is a gap inventory only.**

---

## 6. Summary by workstream

| Workstream | Overall readiness |
|---|---|
| A. Legal and commercial readiness | Substantive, unreviewed drafts complete; legal review and consent-recording remain |
| B. Web and backend security | Strong design throughout, **but the most important fix (privilege-escalation) is unconfirmed-applied** — treat as the top priority |
| C. Capacitor iOS foundation | Solid; one concrete, easy, already-flagged fix outstanding (`webContentsDebuggingEnabled`) |
| D. Native wake reminder | Core mechanism (schedule/permission/dedupe/tap-routing/reschedule-on-change/logout-cancel) is real and unit-tested; weekday selection, custom sound, and notification actions (Begin/Snooze/Skip) are the concrete gaps; device-level behavior entirely unverified |
| E. Apple subscription | Entirely unbuilt by design; Stripe-only today; extensive, honest planning documentation exists |
| F. Final native security and privacy | Two concrete pre-submission requirements outstanding (privacy manifest, nutrition label) plus the debugging-flag fix shared with C |
| G. Global performance | Code-level work (route/vendor splitting) is genuinely done and measured; perceived on-device performance unverified |
| H. Physical-iPhone regression | Comprehensive checklist exists, zero items executed |
| I. TestFlight readiness | Pipeline and guides are thorough and ready; none of the four documented pre-TestFlight gates are yet satisfied |
| J. During-TestFlight work | Feedback/release-notes mechanisms exist; crash monitoring and a formal iteration process are gaps |

---

## 7. Recommended next task

Given the findings above, the single highest-leverage next action is **not** a new feature — it's resolving the unknown in §1: **confirm, via Supabase Dashboard or CLI (`supabase migration list --linked`), the actual applied/unapplied state of the three flagged migrations** (`20260808120000_sprint2_stage2_admin_foundation`, `20260808150000_sprint2_stage3a_stripe_foundation`, `20260915160000_harden_profiles_and_anon_grants`), and apply the security-hardening one if it is not already live. Everything else in this register (admin area functioning, Stripe columns existing, the actual live severity of the privilege-escalation gap) is downstream of that one check. After that: flip `webContentsDebuggingEnabled` to `false` and begin the macOS/Xcode/physical-iPhone phase (`docs/ios-xcode-handoff.md §11`/`§11a`), since nothing in Workstreams D/G/H can be verified further from this Windows environment.

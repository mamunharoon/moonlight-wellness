# WakeWise — Codemagic iOS/TestFlight Setup Guide

This is the manual setup needed once, by the project owner, before the
`wakewise-ios-testflight` workflow in `codemagic.yaml` can be started.
None of this has been done as part of preparing the pipeline — no
Codemagic account, App Store Connect record, or Apple Developer
resource has been created or touched.

The workflow never triggers itself (see `codemagic.yaml`'s top comment)
— every build is a deliberate "Start new build," started by you, with
`dev` picked by hand each time.

## 1–4. Connect Codemagic to this repository

1. Create or sign in to a Codemagic account at codemagic.io (an
   individual account is sufficient for this; a Team account works too
   if you want to invite others later).
2. **Add application** → connect your GitHub account if not already
   linked → select the `mamunharoon/moonlight-wellness` repository.
3. When Codemagic asks which branch to build from, select **`dev`**
   (not `main`) — this only sets the default branch shown in the UI;
   you still pick the branch explicitly every time you start a build.
4. Codemagic auto-detects a `codemagic.yaml` at the repo root and
   should show **"Configuration file detected"** / offer "Edit
   workflow starting from `codemagic.yaml`" rather than its visual
   workflow editor. If it doesn't, double-check the file is present in
   the branch you selected and named exactly `codemagic.yaml` at the
   repo root (it is, as of this commit).

## 5–6. App Store Connect record

5. In [App Store Connect](https://appstoreconnect.apple.com) → **Apps**
   → **+** → **New App**, if a WakeWise record doesn't already exist:
   - Platform: iOS
   - Name: WakeWise (or your preferred App Store listing name — this
     can differ from the in-app display name)
   - Primary language: your choice
   - Bundle ID: select `com.zavaraai.wakewise` from the dropdown — see
     item 6.
   - SKU: any unique internal identifier (e.g. `wakewise-ios`)
6. **Confirm the bundle ID exists and is available first**, before
   creating the App Store Connect record: [Apple Developer
   → Certificates, Identifiers & Profiles → Identifiers →
   +](https://developer.apple.com/account/resources/identifiers/list)
   → App → check whether `com.zavaraai.wakewise` is already registered
   under your team. If not, register it there (Capability
   requirements: none beyond the default — this app doesn't use Push
   Notifications, Sign in with Apple, or any other capability requiring
   an App ID capability toggle at this stage). If it's already
   registered (e.g. from earlier manual Xcode signing attempts),
   confirm it's under the correct Apple Developer Team before
   proceeding.

## 7–10. App Store Connect API key (for Codemagic's integration)

7. [App Store Connect → Users and Access → Integrations → App Store
   Connect API](https://appstoreconnect.apple.com/access/integrations/api)
   → **+** to generate a new key.
   - **Role**: use the minimum practical role. **App Manager** is
     the standard minimum that can both manage signing (certificates/
     profiles) and upload/submit TestFlight builds. Do not grant
     **Admin** unless you have a separate reason to. (Apple's role
     list may show "App Manager" as the closest fit — if a narrower
     "Developer"-only role is offered in your account and Codemagic's
     automatic signing still works with it, that's an acceptable
     further reduction; test with App Manager first since it's the
     documented safe default for this exact use case.)
8. Record the **Issuer ID** (shown at the top of the Integrations page,
   one per account) and the new key's **Key ID** somewhere secure —
   a password manager, not a text file in this repo or a chat message.
   Neither of these two IDs is secret on its own (they identify the
   key, they don't authenticate with it), but treat them as
   confidential operational data regardless.
9. Click **Download API Key** — **you can only download the `.p8` file
   once, ever.** Save it immediately to a secure location (password
   manager attachment, encrypted drive) — if you lose it, you must
   revoke that key and generate a new one, updating the Codemagic
   integration to match.
10. In Codemagic: **Teams/Personal account → Integrations → App Store
    Connect → Add integration**. Name it exactly
    **`wakewise_app_store_connect`** (matching `codemagic.yaml`'s
    `integrations.app_store_connect` reference — if you name it
    differently, update that line in `codemagic.yaml` to match). Paste
    in the Issuer ID, Key ID, and upload the `.p8` file here — this is
    Codemagic's encrypted integration storage, never a repository
    variable, never committed source code, never pasted into the YAML
    file itself.

## 11–12. Code signing and Apple Developer Team

11. Automatic code signing is already configured on the pipeline side —
    `codemagic.yaml`'s `ios_signing: { distribution_type: app_store,
    bundle_identifier: com.zavaraai.wakewise }` combined with the
    integration from step 10 is sufficient; Codemagic creates/renews
    the Apple Distribution certificate and App Store provisioning
    profile itself on each build. There is nothing further to
    configure for signing specifically, **provided** the API key from
    step 7 has a role capable of managing certificates (App Manager
    does).
12. Confirm which Apple Developer Team the API key in step 7 belongs
    to matches the team you intend to publish WakeWise under (visible
    at the top of the App Store Connect Integrations page, and in
    Apple Developer → Membership). If you're part of multiple teams,
    this is the one detail most worth double-checking before your
    first build.

## 13. Public Vite environment variables

13. In Codemagic: **Teams/Personal account → Environment variables** →
    create a new group named exactly **`wakewise_vite_public`**
    (matching `codemagic.yaml`'s `environment.groups` reference).
    Inside it, add exactly two variables:
    - `VITE_SUPABASE_URL` — the same public Supabase project URL
      already used by the Vercel `dev` deployment (not secret; find it
      in your local `.env.local` or the Supabase dashboard's API
      settings).
    - `VITE_SUPABASE_ANON_KEY` — the same public anon key already used
      by the Vercel `dev` deployment (not secret — it's designed to be
      client-visible and is protected by Postgres RLS server-side; it
      is *not* the service-role key, which must never go here or
      anywhere in this pipeline).

    You can mark both as "Secure" in Codemagic's UI if you'd like them
    masked in build logs regardless — harmless, just extra caution.
    Do **not** add any Stripe, Resend, or Supabase service-role value
    to this group or any other Codemagic variable group; nothing in
    this build needs them (confirmed in Phase 1's audit below).

## 14–17. Running and inspecting a build

14. Codemagic → your app → **Start new build** → branch: `dev` →
    workflow: **WakeWise iOS TestFlight** → Start build. This is the
    *only* way this workflow ever runs — there is no automatic trigger
    to disable.
15. Watch each step in the Codemagic build log as it runs — they're
    named exactly as they appear in `codemagic.yaml`: npm ci → vite
    build → test suite → lint → cap sync → pod install → build number
    → archive/IPA build → (if all of that succeeded) TestFlight
    publish.
16. On success, the **Artifacts** tab of that build lists the `.ipa`,
    the `.xcarchive`, and any collected `.dSYM`/log files per
    `codemagic.yaml`'s `artifacts:` list — download them from there if
    you need a local copy.
17. A few minutes after a successful publish step, the build should
    appear in [App Store Connect → your WakeWise app →
    TestFlight](https://appstoreconnect.apple.com) under "iOS Builds,"
    initially in **"Processing"** status.

## 18–19. Testing it yourself

18. Once the build finishes Apple's own processing (see the
    troubleshooting section below for typical delays), go to
    TestFlight → **Internal Testing** in App Store Connect, create an
    internal testing group if one doesn't exist, and add **only
    yourself** as a tester for now — do not add anyone else at this
    stage, and do not create/enable an External Testing group (that
    requires a separate Apple Beta App Review, which this task
    explicitly does not start).
19. Install the **TestFlight** app from the App Store on your iPhone
    (if not already installed), accept the email/in-app invitation,
    and install WakeWise through it. Future builds update the same way
    from within TestFlight.

## 20. Controlling build-minute usage

20. This workflow has no automatic trigger by design (no push, pull
    request, tag, or schedule in `codemagic.yaml`) — every build
    consumes minutes only when you deliberately start one. If you ever
    *do* want automatic builds later, that's a separate, deliberate
    change to `codemagic.yaml`'s `triggering:` block — don't add it
    without a specific reason, and be aware of what it will cost in
    minutes on your plan.

## 21. If you ever discontinue Codemagic access

21. Revoke the App Store Connect API key from step 7 (App Store
    Connect → Integrations → API Keys → revoke), which immediately
    invalidates Codemagic's ability to sign or publish regardless of
    what's still configured on Codemagic's side. Separately, remove
    the `wakewise_app_store_connect` integration and the
    `wakewise_vite_public` variable group from Codemagic itself, and
    disconnect the GitHub repository connection under Codemagic's
    application settings.

---

## Troubleshooting

**Repository access** — Codemagic can't see `moonlight-wellness`: check
the GitHub App/OAuth connection under Codemagic → your account →
Integrations → GitHub still has access to this specific repository
(GitHub's own "Installed GitHub Apps" org/account settings can quietly
lose repo access if permissions were changed there).

**Missing environment variables** — the `npm run build` step fails or
produces a build that can't reach Supabase: confirm the
`wakewise_vite_public` group (step 13) is actually attached to the
`wakewise-ios-testflight` workflow — Codemagic requires a variable
group to both exist *and* be referenced (already done, in
`codemagic.yaml`'s `environment.groups`) *and* actually contain the two
variables with those exact names (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` — case-sensitive, `VITE_` prefix required or
Vite silently ignores them, as documented in
`src/lib/subscriptionOverride.js`'s own comment on this exact
footgun).

**CocoaPods failure** — `pod install` errors: usually a stale
`Podfile.lock` vs. the plugins actually installed by `npx cap sync
ios`. Confirm the "Capacitor sync" step ran and succeeded immediately
before "Install CocoaPods dependencies" in the build log (their order
in `codemagic.yaml` matters). If it persists, the CocoaPods cache
(`$HOME/Library/Caches/CocoaPods`, the only thing this pipeline caches)
can be cleared by disabling caching for one build via Codemagic's UI.

**Xcode-version mismatch** — build tools complain about an unsupported
Xcode version, or Codemagic can't find `xcode: 16.4`: Codemagic
periodically retires old Xcode images. Check Codemagic's current
[supported Xcode
versions](https://docs.codemagic.io/specs/versions/) list and update
the `xcode:` value in `codemagic.yaml` to another 16.x release — do not
jump to an unpinned "latest," which risks landing on an untested major
version.

**Signing certificate/profile failure** — automatic signing errors
(e.g. "No signing certificate found," "profile doesn't match
entitlements"): confirm the API key's role (step 7) is App Manager or
higher — a narrower role can successfully authenticate but lack
permission to *create* new certificates/profiles, which is what
automatic signing needs the first time it runs for this bundle ID.

**Duplicate build number** — App Store Connect rejects an upload with
"The bundle version must be higher than the previously uploaded
version": this pipeline sets `CFBundleVersion` from Codemagic's own
`$CM_BUILD_NUMBER`, which is monotonically increasing *per workflow* —
if you've previously uploaded a build through Xcode directly (or a
different pipeline) with a higher number, the counters can be
momentarily out of sync. Codemagic's build-number counter can be
manually bumped from the workflow's build history if this happens.

**Bundle-ID mismatch** — App Store Connect can't find a matching app
record: confirm the App Store Connect app record (step 5) really uses
`com.zavaraai.wakewise`, exactly matching both `codemagic.yaml`'s
`ios_signing.bundle_identifier` and `ios/App/App.xcodeproj`'s
`PRODUCT_BUNDLE_IDENTIFIER`.

**App Store Connect API authorization failure** — "Authentication
credentials are missing or invalid" during the publish step: the `.p8`
key may have been revoked or regenerated since the integration (step
10) was configured — re-upload a fresh key to the Codemagic
integration; Codemagic cannot recover a revoked key on its own.

**Upload succeeds but the build isn't visible yet in App Store
Connect** — this is normal for a few minutes; Apple processes each
upload asynchronously after Codemagic's publish step reports success.
Refresh the TestFlight tab after 5–10 minutes before assuming something
went wrong.

**TestFlight processing delays** — Apple's own build processing
(virus/malware scan, missing-compliance checks, etc.) can occasionally
take 30–60+ minutes, longer during peak periods. If a build stays in
"Processing" far longer than that, check for an email from Apple about
export compliance (WakeWise doesn't use non-exempt encryption beyond
standard HTTPS/TLS, so this should auto-resolve, but Apple sometimes
still asks the first time a bundle ID is used) or missing compliance
answers in App Store Connect's build details page.

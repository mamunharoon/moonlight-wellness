# WakeWise iOS — Security & Privacy: Current State and Future Requirements

Written as part of the Capacitor iOS Foundation phase. Covers what this
foundation phase deliberately did and did not do, and what real native
work (wake reminders, Apple subscriptions, TestFlight) will require
later.

## Current state (this phase)

- **No `server.url`**: the app loads locally bundled web assets from
  `ios/App/App/public` (populated by `npx cap copy ios` /
  `npx cap sync ios`), never the remote Vercel site.
- **No Arbitrary Loads / cleartext exception**: `Info.plist` has no
  `NSAppTransportSecurity` key at all, so the platform's secure default
  (HTTPS-only, no exceptions) applies untouched.
- **No unnecessary permission descriptions**: `Info.plist` requests no
  camera/microphone/location/etc. usage strings — the app doesn't use
  any of those APIs, native or web.
- **CSP applied natively via `<meta>` tag** in `index.html`, mirroring
  the existing `vercel.json` header policy exactly. Per the CSP spec,
  `frame-ancestors` and report-uri directives are ignored when set via
  `<meta>` — clickjacking protection on web still comes from the
  `X-Frame-Options` header; there is no framing risk inside the native
  app itself.
- **Only public credentials bundled**: `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` are the only Supabase values compiled into
  the JS bundle (confirmed by grep of `dist/` and
  `ios/App/App/public/`). No service-role key, Stripe secret key, or
  webhook secret exists anywhere in the built output.
- **`webContentsDebuggingEnabled: true`**: deliberately on for this
  foundation phase to support Safari Web Inspector debugging during
  Xcode/device work. **Must be set to `false` before any TestFlight or
  App Store build** — it does not expose anything over the network (it
  is a local/USB-only Safari feature), but it should never ship.
- **Supabase Auth dashboard redirect URLs are unchanged.** The proposed
  `wakewise://` deep-link scheme (see `useNativeDeepLinks.js` and
  `Info.plist`'s `CFBundleURLTypes`) is registered natively but not yet
  wired into Supabase's allowed redirect URLs — that is an external
  dashboard change requiring explicit approval, out of scope here.
  Today, password-reset emails still link to the Vercel web URL
  (`Auth.jsx`'s `redirectTo: \`${window.location.origin}/reset-password\``),
  which is correct on web but would resolve to `capacitor://localhost/
  reset-password` if evaluated inside the native app — this code path
  is never reached natively yet since no in-app flow calls it from a
  native context in a way that matters for this phase, but it's the
  first thing that needs to change when native password-reset is
  implemented.

## Future requirements (not implemented in this phase)

### Privacy manifest (`PrivacyInfo.xcprivacy`)
Apple requires an iOS privacy manifest declaring data collection and
"required reason" API usage for apps submitted after the enforcement
deadline. This app will need one before App Store submission, declaring
at minimum: user account data (email, via Supabase Auth), and any
timestamp/UserDefaults API usage the final native code ends up using.
Not created in this phase — no such submission is happening yet.

### Keychain / secure token storage
Supabase's JS client currently persists the session/refresh token in
`localStorage` (the default, no custom `storage` option is configured
in `supabaseClient.js`). Inside WKWebView this is app-sandboxed local
storage, not shared with Safari — a real improvement over nothing, but
still not iOS Keychain-backed. Before shipping wake reminders or paid
subscriptions (higher-value sessions worth protecting more), consider a
custom Supabase `storage` adapter backed by an iOS Keychain plugin
(e.g. `capacitor-secure-storage-plugin`) so the token survives app
deletion/reinstall in a controlled way and isn't readable by anything
that can read the app's WebKit local storage directory. This was
explicitly out of scope for this phase ("do not perform a broad storage
migration ... without approval").

### Notification permission — implemented (Capacitor iOS Native Morning Reminders)
`@capacitor/local-notifications@7.0.7` is now installed and used for one
daily morning reminder (see `src/lib/nativeMorningReminder.js` and
`src/context/MorningReminderContext.jsx`). Permission is requested only
after a deliberate user action (toggling "Morning reminder" on in
Settings → Notifications), never on launch/sign-in. No new `Info.plist`
key was needed or added — iOS's local-notification permission dialog is
system-generated and, unlike camera/microphone/location, has no
corresponding usage-description string to declare. `notificationService.js`
(the browser `Notification` API) is unchanged and still web-only.
Native wake-reminder scheduling itself (the local-notification plugin
wiring above) is done; a separate, still-open item is the privacy
manifest declaration below, which should mention this plugin's use once
drafted.

### Apple subscriptions (In-App Purchase)
No StoreKit code, product identifiers, or purchase logic exists. Apple
requires In-App Purchase (not Stripe) for digital subscription content
consumed inside an iOS app; reconciling that with the existing Stripe
subscription model is a significant separate project (server-side
entitlement bridging, receipt validation, restore-purchases flow) and
was explicitly excluded from this phase.

### App Transport Security beyond the default
No exceptions exist today and none should be added. If a future
third-party SDK requires a specific ATS exception, it should be scoped
as narrowly as possible (a single domain, not `NSAllowsArbitraryLoads`)
and justified in writing before being added.

### App Store privacy "nutrition label" disclosures
App Store Connect requires declaring what data is collected and how
it's used (linked to identity or not, used for tracking or not). This
should be drafted alongside the privacy manifest above, based on the
final feature set at TestFlight time (this app currently collects:
email/auth identity via Supabase, and app-generated wellness content
like journal/routine data — no third-party analytics or ad SDKs are
integrated as of this phase).

### CocoaPods/SPM dependency review
Only Capacitor's own core/iOS/app packages are in the project. Any
future native plugin (local-notifications, secure-storage, StoreKit
helpers) should get the same "don't blindly install latest" scrutiny
applied to the Capacitor version choice itself in this phase.

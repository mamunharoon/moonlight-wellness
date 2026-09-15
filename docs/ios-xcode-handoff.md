# WakeWise iOS — macOS/Xcode Handoff Guide

This covers the steps that can only be performed on macOS with Xcode, a
physical iPhone, and (for signing) an Apple Developer account — none of
which are available in the Windows environment that built this Capacitor
foundation. Everything up to "generate the iOS project" has already been
done and is committed to the `dev` branch (see `ios/`).

## 1. Prerequisites

- macOS with Xcode 16.0 or later (Capacitor 7 requirement).
- CocoaPods installed (`sudo gem install cocoapods`, or via Homebrew).
- Node.js 20+ and npm (match the version used to build `dev` — currently
  Node 24.x works too; Capacitor 7 only requires 20+).
- An Apple Developer Program membership with access to a Team, to sign
  and run on a physical device (a free Apple ID is enough for the
  simulator and 7-day on-device sideloading, but not for TestFlight).
- Xcode Command Line Tools (`xcode-select --install`).

## 2. Clone and fetch the `dev` branch

```bash
git clone <repo-url> wakewise
cd wakewise
git checkout dev
git pull origin dev
```

## 3. Install dependencies, build the web app, and sync Capacitor

```bash
npm install
npm run build          # produces dist/
npx cap sync ios       # copies dist/ into ios/App/App/public and runs pod install
```

`npm run cap:sync` does the same as the last two commands together. If
`pod install` fails or was skipped, run it directly:

```bash
cd ios/App
pod install
cd ../..
```

## 4. Open the iOS workspace

Always open the **workspace**, not the `.xcodeproj`, once CocoaPods has
run (the workspace links the Pods project):

```bash
npm run cap:open:ios
# or directly:
open ios/App/App.xcworkspace
```

## 5. Select the Apple Development Team

In Xcode: select the **App** target → **Signing & Capabilities** tab →
set **Team** to your Apple Developer account/organization. Leave
"Automatically manage signing" checked (see step 7).

## 6. Confirm the bundle identifier is available

The app is configured with `appId: com.zavaraai.wakewise`
(`capacitor.config.json`, mirrored into `PRODUCT_BUNDLE_IDENTIFIER` in the
Xcode project). Before building:

- Confirm this identifier isn't already registered under a different
  Apple Developer account/team than the one you intend to ship from.
- If it conflicts, the bundle identifier needs to change in **both**
  `capacitor.config.json` (`appId`) and the Xcode target's General tab,
  then re-run `npx cap sync ios`. This is exactly the kind of
  Apple-account decision this foundation phase was told to stop and
  flag rather than guess at from Windows — treat any conflict as a
  blocker requiring explicit confirmation before proceeding.

## 7. Automatic signing

With "Automatically manage signing" enabled and a Team selected, Xcode
will provision a development certificate and profile itself the first
time you build to a connected device. No manual provisioning profile
management should be needed for development/ad-hoc testing.

## 8. Connect and trust the physical iPhone

1. Connect the iPhone via USB (or pair over Wi-Fi in Xcode's Devices
   window once USB-paired once).
2. On the iPhone, tap **Trust This Computer** when prompted.
3. In Xcode's device/scheme selector (top toolbar), choose the physical
   device instead of a simulator.
4. First run only: on the iPhone, go to **Settings → General → VPN &
   Device Management** and trust the developer certificate before the
   app will launch.

## 9. Build and launch on device

Press **Run** (▶) in Xcode, or `Cmd+R`. Xcode will build, install, and
launch WakeWise on the connected iPhone. Watch the Xcode status bar for
build errors — most first-run issues are signing/provisioning related
and are resolved by re-selecting the Team or toggling automatic signing
off/on.

## 10. Capturing native console errors

`capacitor.config.json` has `ios.webContentsDebuggingEnabled: true` for
this foundation phase specifically so you can inspect the running
WebView:

1. On the Mac, open Safari → **Develop** menu → select the connected
   iPhone → select WakeWise's WebView.
2. This opens Safari Web Inspector against the live app — console logs,
   network requests, and DOM inspection all work exactly like a desktop
   tab.
3. Xcode's own console (View → Debug Area → Activate Console) shows
   native Swift/Capacitor-level logs (plugin errors, lifecycle events).

**Before any TestFlight/App Store build**, set
`webContentsDebuggingEnabled` back to `false` in `capacitor.config.json`
and re-run `npx cap sync ios` — this flag should never ship to
production.

## 11. Tests to run on-device

None of these have been performed yet — they require the hardware this
guide is written for. Run through all of them and note pass/fail:

- [ ] Cold launch from a fully-terminated state (not resumed from
      background).
- [ ] Sign in with a real Supabase account; confirm it lands on Home.
- [ ] Force-quit the app and relaunch — confirm the session persisted
      (still signed in, no re-auth prompt). This exercises
      `supabase-js`'s default `localStorage`-backed session persistence
      inside WKWebView, which has not been verified on-device.
- [ ] Sign out — confirm the WebView's session is actually cleared (no
      stale user data visible after signing back in as someone else).
- [ ] Trigger "Forgot password" from `/auth`. The reset-link email
      still points at the Vercel web URL (Supabase's dashboard redirect
      URL has intentionally NOT been changed in this phase — see
      `docs/ios-security-privacy-future-requirements.md`), so today the
      correct/expected behavior is that the link opens in the device's
      **external browser**, not the native app. Confirm it does not
      crash or dead-end inside the native app.
    - As a stretch check only (not a pass/fail gate for this phase): if
      you want to test the proposed `wakewise://reset-password` deep
      link path in isolation, you can trigger it manually from Safari on
      the device (type `wakewise://reset-password` in the address bar)
      once the app is installed, and confirm it opens the app to
      `/reset-password` without navigating anywhere else.
- [ ] Navigate several levels deep (e.g. Library → an audio item →
      back), then use the in-app back button/gesture — confirm it
      matches web behavior and never exits the app unexpectedly.
- [ ] Play a signed video/audio item from the Library; confirm playback
      controls and the sleep timer behave the same as on web.
- [ ] While media is playing: toggle the hardware mute switch, plug/
      unplug headphones, lock the screen, and background the app —
      note what actually happens for each (this is explicitly
      unverified and was flagged as a gap in this phase).
- [ ] Rotate the device (portrait/landscape) on a few screens — check
      for layout breakage.
- [ ] Visually inspect every screen for content hidden behind the
      status bar/Dynamic Island (top) or the home indicator (bottom),
      especially the main tabbed frame's header (`Layout.jsx`), which
      has no explicit `env(safe-area-inset-top)` padding in code — it
      currently relies on `capacitor.config.json`'s
      `ios.contentInset: "always"` to inset the WebView automatically.
      This mechanism is unverified on real hardware.
- [ ] Background the app for an extended period, then resume — confirm
      state (auth session, in-progress session/routine) survives.
- [ ] Test on a slow/offline network (Xcode's Network Link Conditioner,
      or airplane mode) — confirm the app degrades no worse than the
      web version does.

### 11a. Morning reminder tests (Capacitor iOS Native Morning Reminders)

None of these have been performed — they require `@capacitor/local-notifications`
running on a real device (the simulator can deliver local notifications,
but permission prompts, Focus mode, and device-restart persistence should
be confirmed on a physical iPhone). Go to Settings → Notifications inside
WakeWise for all of these.

- [ ] **First permission request**: with iOS notification permission not
      yet decided for WakeWise, turn the "Morning reminder" toggle on —
      confirm the explanatory copy is visible *before* the toggle is
      tapped, and that the native iOS permission dialog only appears
      after tapping the toggle (never on app launch or sign-in).
- [ ] **Permission allowed**: accept the dialog — confirm the toggle
      shows on and displays "Scheduled for HH:MM on this device."
- [ ] **Permission denied**: deny the dialog — confirm the toggle shows
      off, no "scheduled" text appears, and the UI shows the "enable in
      iPhone Settings" guidance instead. Confirm turning the toggle off
      and back on again does *not* re-prompt automatically in a way that
      feels like nagging (iOS itself blocks a second native prompt after
      a denial — confirm WakeWise's own UI doesn't imply one is coming).
- [ ] **Permission later revoked in Settings**: with the reminder on,
      go to iPhone Settings → Notifications → WakeWise and turn
      notifications off, then return to WakeWise's Notification settings
      screen — confirm it reconciles to "off" (does not keep claiming the
      reminder is active).
- [ ] **Reminder delivery at the selected local time**: set a wake time a
      few minutes in the future, enable the reminder, lock the phone, and
      confirm "Good morning / Your WakeWise morning routine is ready."
      arrives at that exact local time.
- [ ] **Delivery across device restart**: with the reminder enabled,
      restart the iPhone fully, and confirm the reminder still fires at
      the next scheduled time (iOS local notifications are expected to
      survive a restart, but this has not been confirmed for this app).
- [ ] **DST/time-zone behaviour**: change the device's time zone (or test
      across a DST transition if one falls during the test window) and
      confirm the reminder still fires at the same local wall-clock wake
      time, not a fixed UTC offset.
- [ ] **Wake-time change**: with the reminder on, change the wake time in
      Onboarding — confirm the reminder now fires at the new time and
      not also at the old one (only one pending notification should ever
      exist — check via a second device/enough wait, or Xcode console
      logging if added temporarily).
- [ ] **Disable/re-enable**: turn the reminder off, confirm no
      notification arrives at the previously-scheduled time; turn it back
      on, confirm exactly one reminder is scheduled again (not two).
- [ ] **Duplicate-notification prevention**: rapidly toggle the reminder
      off/on/off/on a few times — confirm only ever one WakeWise morning
      reminder is pending/fires, never multiple.
- [ ] **Foreground receipt**: trigger a reminder (or use a very-near-term
      test time) while WakeWise is open and in the foreground — confirm
      the app does not crash and behaves reasonably (iOS's default
      foreground banner behavior for this plugin has not been confirmed
      for this app).
- [ ] **Background tap**: background WakeWise (don't force-quit), let the
      reminder fire, tap it from the notification center/lock screen —
      confirm it opens WakeWise directly to the morning-routine screen
      (`/morning-start`).
- [ ] **Cold-launch tap**: force-quit WakeWise entirely, let the reminder
      fire, tap it — confirm a cold launch also lands on
      `/morning-start`, not the default Home route.
- [ ] **Focus mode / silent-mode limitation**: enable a Focus mode (e.g.
      Do Not Disturb) that would normally silence notifications, and
      confirm the reminder is delayed/suppressed as iOS dictates — this
      is expected platform behavior, not a bug, and the in-app copy
      should already be setting this expectation ("iPhone Focus, silent
      mode and notification settings can affect delivery").
- [ ] **Logout/account-deletion cancellation**: enable the reminder while
      signed in, then sign out — confirm no further reminder fires and
      the toggle shows off on next sign-in prompt/screen. Separately,
      enable the reminder, submit an account-deletion request (does not
      need to complete), and confirm the reminder is cancelled at that
      point too.
- [ ] **Not a guaranteed alarm**: as a sanity check on the copy itself,
      confirm nowhere in the UI (toggle label, helper text, this
      checklist) implies WakeWise is a guaranteed/critical alarm — it
      should read as "reminder" throughout, with the delivery caveats
      visible.

## 12. Evidence to return

For each test above: pass/fail, and for any failure, a screenshot or
screen recording plus the relevant Safari Web Inspector console output
or Xcode console log. For signing/build issues, include the exact Xcode
error text and the Signing & Capabilities screenshot.

## 13. Gates before TestFlight

None of these have been done yet, and none should be skipped:

- [ ] All of §11 and §11a run on a physical iPhone with results recorded.
- [ ] Native password-reset/deep-link (`wakewise://reset-password`)
      actually completing end-to-end, including the Supabase dashboard
      redirect-URL change this still requires (explicitly not made yet).
- [ ] `capacitor.config.json`'s `ios.webContentsDebuggingEnabled` set to
      `false`, with `npx cap sync ios` re-run afterward.
- [ ] Signing team, provisioning profile, and bundle-ID availability
      confirmed for the account this ships from (§5–§7 above).
- [ ] iOS privacy manifest (`PrivacyInfo.xcprivacy`) and App Store privacy
      ("nutrition label") disclosures drafted and reviewed — see
      `docs/ios-security-privacy-future-requirements.md`; local
      notifications add no new third-party data collection, but the
      manifest itself still needs to be created before submission.

**Do not report any of the above as passing without actually running
it on real hardware.**

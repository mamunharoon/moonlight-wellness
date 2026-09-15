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

### 11b. Password-recovery tests (Secure Native Password Recovery)

**None of these can pass until the Supabase Auth redirect-URL change in
§14 below has actually been made in the dashboard** — until then, a
native recovery email link will 400 at Supabase before it ever reaches
the app. Once that's done, run through all of these on a physical
iPhone:

- [ ] **Request password recovery from the iPhone**: open WakeWise (or
      Safari, either works since the request itself is a normal HTTPS
      call), go to Sign In → Forgot password, submit the account's
      email. Confirm the generic "if an account exists…" message shows
      regardless of whether the email exists (no account enumeration).
- [ ] **Open the email link with WakeWise installed**: tap the link in
      the recovery email on the iPhone. Confirm it opens WakeWise
      directly (not Safari) and lands on the password-reset screen in
      its "ready to reset" state, not "invalid or expired."
- [ ] **Cold-launch recovery**: force-quit WakeWise first, then tap a
      fresh recovery link — confirms `App.getLaunchUrl()` is doing its
      job, not just `appUrlOpen`.
- [ ] **Background-app recovery**: leave WakeWise open in the
      background (not force-quit), tap a fresh recovery link — confirms
      `appUrlOpen` handles the warm case.
- [ ] **Already-open-app recovery**: with WakeWise in the foreground on
      some other screen, tap a fresh recovery link — confirm it
      navigates to the reset screen without any visual glitch or a
      stuck/duplicate loading state.
- [ ] **Successful password update**: set a new password (≥8 characters,
      confirmation matches), submit, confirm the success screen appears
      and "Continue" lands on `/profile` signed in (existing behaviour,
      intentionally retained — see the final report for why).
- [ ] **Sign in using the new password**: sign out, sign back in with
      the new password to confirm it actually took effect server-side.
- [ ] **Expired link**: use a recovery link older than Supabase's
      recovery-link expiry window — confirm the reset screen shows
      "invalid or expired," not a crash, and never accepts a password
      submission in that state.
- [ ] **Reused link**: successfully complete a reset once, then tap the
      *same* email link again — confirm it's rejected the same way
      (Supabase invalidates the token after first use).
- [ ] **Malformed link**: manually type a broken variant in Safari (e.g.
      `wakewise://reset-password#access_token=garbled`, missing
      `refresh_token`, or `type=signup` instead of `recovery`) — confirm
      WakeWise opens to "invalid or expired," never a crash, and no
      password field ever becomes submittable.
- [ ] **Non-recovery WakeWise deep link**: open `wakewise://auth`
      directly (e.g. by typing it in Safari) — confirm it still routes
      to `/auth` exactly as before; recovery handling must not have
      broken the existing, unrelated deep link.
- [ ] **Link opened without WakeWise installed**: uninstall WakeWise,
      tap a recovery email link — confirm iOS falls back sensibly (no
      crash reported anywhere; the link simply can't open the
      unregistered scheme). Reinstall WakeWise afterward for the rest of
      this checklist.
- [ ] **Confirm no token appears anywhere visible**: for at least one
      successful native recovery, check that the access/refresh token
      never appears in: the visible in-app route (it shouldn't — only
      `/reset-password`, no fragment/query with tokens), any screenshot
      you take for this report, Safari Web Inspector's console output,
      or the "invalid/expired" or any other user-facing error text.
      **Do not paste the actual recovery link or token into this
      report or any screenshot** — describe what you saw instead.
- [ ] **Confirm the web reset-password link continues to work**:
      request a reset from a desktop/laptop browser (not the app),
      confirm the existing web flow at
      `https://wakewise-git-dev-mamun65.vercel.app/reset-password`
      still works exactly as before this phase.
- [ ] **Confirm the morning-reminder tap still opens the morning flow**:
      unrelated regression check — trigger (or wait for) a scheduled
      morning reminder and confirm tapping it still opens
      `/morning-start`, not `/reset-password` or anywhere else. This
      confirms the two native listeners aren't interfering with each
      other.

## 12. Evidence to return

For each test above: pass/fail, and for any failure, a screenshot or
screen recording plus the relevant Safari Web Inspector console output
or Xcode console log. For signing/build issues, include the exact Xcode
error text and the Signing & Capabilities screenshot. **Never include a
recovery token, access token, refresh token, or a full recovery URL in
any screenshot, log excerpt, or report text** — redact it or describe it
instead.

## 13. Gates before TestFlight

None of these have been done yet, and none should be skipped:

- [ ] All of §11 and §11a run on a physical iPhone with results recorded.
- [ ] Native password-reset/deep-link (`wakewise://reset-password`)
      actually completing end-to-end on a physical iPhone — see §11b —
      including the Supabase dashboard redirect-URL change in §14
      (explicitly not made in this phase).
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

## 14. Supabase Auth dashboard handoff — password recovery

**Not done in this phase — this is a manual action for the project
owner.** No Supabase dashboard setting was changed by this work; the
native recovery flow cannot complete end-to-end until this is done and
verified.

1. **Exact native redirect URL to add to the allow-list**:
   ```
   wakewise://reset-password
   ```
   This is the literal value the app requests via `redirectTo` when
   running natively (see `src/lib/authRedirect.js`). Add it as its own
   exact entry — do not rely on a partial or prefix match.

2. **Existing URLs that must remain** (do not remove these):
   - `https://wakewise-git-dev-mamun65.vercel.app/reset-password` — the
     `dev` branch's Preview URL, used by the web app's redirect
     (`src/lib/authRedirect.js`'s `WEB_RESET_PASSWORD_URL`).
   - Whatever localhost entry already exists for local development
     (e.g. `http://localhost:5173/reset-password`), if one was already
     configured before this phase — `authRedirect.js`'s explicit
     localhost rule depends on it still being allowed.

3. **The old Moonlight URL**: this phase did not reference, restore, or
   otherwise touch any `moonlight-wellness.vercel.app` redirect entry.
   Whether it can be removed depends on whether any other
   still-in-use flow (e.g. an old bookmark, a stale mobile session, or
   Production itself if Production still points at that legacy alias)
   relies on it — that's outside this phase's audit. Recommend leaving
   it in place until Production's own configuration is separately
   confirmed not to need it, rather than removing it as a side effect
   of this task.

4. **Exact dashboard page**: Supabase Dashboard → select the WakeWise
   project (ref `kvdxuhyndevrfvsalgnx`) → **Authentication** (left
   sidebar) → **URL Configuration** → **Redirect URLs** section. Add the
   native URL from item 1 as a new entry and **Save**.

5. **Do not use a wildcard pattern** (e.g. `wakewise://**` or
   `wakewise://*`) to "cover" this — add the exact
   `wakewise://reset-password` string only. A wildcard would let *any*
   path under the `wakewise://` scheme receive a valid Supabase
   redirect, which is broader than this app's own deep-link allow-list
   (`src/hooks/useNativeDeepLinks.js`'s `ALLOWED_DEEP_LINK_PATHS`)
   actually needs and widens the attack surface for no benefit.

6. **Validating the generated recovery email without exposing its
   token**: request a reset for a test account you control, open the
   email, and confirm the link's structure (scheme, host/path, and that
   it carries `type=recovery` plus token parameters) **without copying
   the full link or its token into any report, chat message, ticket, or
   screenshot**. If you need to show someone the link exists and looks
   right, screenshot only the email's visible text (subject/body) with
   the link itself covered/cropped out, or describe its shape in words
   (e.g. "the link starts with `wakewise://reset-password#access_token=`
   followed by a token, then `&refresh_token=`, then `&type=recovery`")
   rather than pasting the real value anywhere persisted.

**Do not claim the native recovery flow works end-to-end until this
allow-list entry has been added and §11b above has been run on a
physical iPhone.**

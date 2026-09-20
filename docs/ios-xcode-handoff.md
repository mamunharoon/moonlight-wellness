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

### 11a. Morning reminder tests (Complete Native Wake Reminder Functionality)

**Implementation summary** (see `src/lib/nativeMorningReminder.js`, `src/context/MorningReminderContext.jsx`, `src/hooks/useMorningReminderNotificationTap.js`, `src/pages/NotificationSettings.jsx` for the full implementation; `src/lib/nativeMorningReminder.test.js` and `src/lib/notificationPreferences.test.js` for the unit-test coverage — 66 + 14 tests, all passing as of this writing):

- **Weekday scheduling**: one repeating calendar notification per selected weekday, using `@capacitor/local-notifications`' own `Weekday` enum (Sunday=1..Saturday=7) in `schedule.on.weekday`. Each weekday has a fixed, deterministic notification id (`990011`-`990017` = `990010 + weekday`), so re-scheduling a selected day always *replaces* its own pending request (no duplicate-prevention logic needed beyond the id scheme itself) and a deselected day is explicitly cancelled. Defaults to every day for any existing/older stored preference with no weekday field, so behaviour never silently changes for a current user.
- **Legacy id retired**: the old single fixed id (`990001`, daily-only, no weekday field) is explicitly cancelled every time the weekday schedule is (re)applied, as a one-time migration/cleanup step. It remains exported and unit-tested for backward compatibility, but the app no longer schedules it.
- **Notification actions**: a fixed action type (`wakewise-morning-reminder`) with three fixed, allow-listed actions — **Begin** (`foreground: true` — opens the app to the real alarm/decision screen), **Snooze** (`foreground: false` — the plugin's own documented way to act without opening the app; schedules one deterministic one-time snooze notification, fixed id `990020`, **10 minutes** later — matching `notificationPreferences.js`'s own pre-existing `snoozeMinutes` default rather than inventing a new value), **Skip** (`foreground: false` — cancels only the pending snooze, never touches the weekday schedule, never disables the reminder).
- **Corrected routing**: the default tap *and* the Begin action both now open **`/alarm-trigger`** (`AlarmActive.jsx` — the real Begin-slide/Snooze/Skip alarm screen), not `/morning-start` (routine Step 1) as before. This was the task's own confirmed gap; the fix is evidenced by direct audit of `App.jsx`/`Layout.jsx`/`sessionDefinitions.js`, not assumed.
- **Sound**: no local audio asset exists anywhere in this repository (checked: `src/assets/`, `public/`, and a repo-wide search for `.wav`/`.caf`/`.aiff`/`.mp3`/`.m4a` outside `node_modules`/`dist` — none found). The schedule call now explicitly sets `sound: 'default'` — confirmed via this plugin's own iOS source (`LocalNotificationsPlugin.swift`: `content.sound` is only set when the `sound` key is present at all) and its bundled README ("If not provided, it will produce ... no sound on iOS") that **omitting the field entirely means the reminder fires silently on iOS** — this is a real, pre-existing bug in the original implementation (which never set `sound`), fixed here as a side effect of implementing this feature, not something newly introduced. **Custom sound remains blocked purely by the missing asset, not by code**: to complete it, add a short (Apple's guidance is commonly cited as 30 seconds or shorter — confirm the current figure against Apple's own documentation before sourcing one) `.wav`/`.caf`/`.aiff` file to the `ios/App/App` Xcode target's "Copy Bundle Resources" build phase, then pass its exact filename (with extension) as the `sound` field via `applyMorningReminderSchedule(wakeTime, weekdays, { sound: 'exact-filename.wav' })` — the option already exists and is unit-tested; only the asset itself is missing.
- **Foreground behaviour**: scheduled with `silent: true` (iOS-only) — while WakeWise is open, `AlarmContext.jsx`'s own second-by-second wall-clock check already surfaces the in-app Begin/Snooze/Skip alarm screen at the same real wake time; showing the native banner *as well* would be a redundant second alarm. This is a deliberate "least surprising" design decision, not a platform default — see the code comment on `weekdayReminderNotification` in `nativeMorningReminder.js`. **The actual foreground timing interplay between this suppression and `AlarmContext`'s own trigger has not been confirmed on a device — see the checklist below.**
- **Timezone/DST + permission reconciliation**: an idempotent reconciliation path (`MorningReminderContext.reconcile`, driven by `@capacitor/app`'s `appStateChange` listener as well as mount and wake-time-change) rechecks permission (read-only, never requests it), reconciles the user's stored on/off intent against live device state, and rebuilds the schedule only when a fingerprint of `wake time | weekdays | device UTC offset | device IANA zone` actually differs from the last-reconciled one **or** live device state (`getPending()`) doesn't match — never on every render/resume unconditionally. The decision logic itself (`decideMorningReminderReconciliation` in `nativeMorningReminder.js`) is unit-tested directly, including the "permission granted after returning from Settings without re-tapping the toggle" and "unchanged fingerprint avoids unnecessary rescheduling" cases explicitly.
- **Permission intent vs. live state**: the user's last explicit enable/disable choice is persisted separately from the live "is something actually scheduled and permitted right now" state the toggle displays — a denial no longer permanently forgets that the user wanted the reminder on, so granting permission again from iPhone Settings can resume it without the user re-finding the toggle. Permission is requested from exactly one place (`enable()`, on an explicit user tap) — reconciliation never requests it.

None of the items below have been performed — they require `@capacitor/local-notifications`
running on a real device (the simulator can deliver local notifications,
but permission prompts, Focus mode, background/terminated action delivery,
and device-restart persistence should be confirmed on a physical iPhone).
Go to Settings → Notifications inside WakeWise for all of these.

- [ ] **First permission request**: with iOS notification permission not
      yet decided for WakeWise, turn the "Morning reminder" toggle on —
      confirm the explanatory copy is visible *before* the toggle is
      tapped, and that the native iOS permission dialog only appears
      after tapping the toggle (never on app launch or sign-in).
- [ ] **Permission allowed**: accept the dialog — confirm the toggle
      shows on and displays the schedule summary (e.g. "Scheduled: Every
      day at HH:MM on this device.").
- [ ] **Permission denied**: deny the dialog — confirm the toggle shows
      off, no "scheduled" text appears, and the UI shows the "enable in
      iPhone Settings" guidance instead. Confirm turning the toggle off
      and back on again does *not* re-prompt automatically in a way that
      feels like nagging (iOS itself blocks a second native prompt after
      a denial — confirm WakeWise's own UI doesn't imply one is coming).
- [ ] **Permission later revoked in Settings**: with the reminder on,
      go to iPhone Settings → Notifications → WakeWise and turn
      notifications off, then return to WakeWise's Notification settings
      screen (or background/foreground the app) — confirm it reconciles
      to "off" (does not keep claiming the reminder is active).
- [ ] **Permission re-granted in Settings without re-tapping the toggle**:
      from the denied state above, turn notifications back on for
      WakeWise from iPhone Settings, then return to (or foreground) the
      app — confirm the reminder resumes on its own via reconciliation,
      matching `decideMorningReminderReconciliation`'s unit-tested
      "permission granted after returning from Settings" behaviour.
- [ ] **Weekday selection**: with the reminder on, deselect all but two or
      three days — confirm only those days' notifications fire, and that
      the schedule summary text updates to match (e.g. "Mon, Wed, Fri").
      Attempt to deselect the very last remaining day — confirm the UI
      refuses (at least one day must always remain selected).
- [ ] **Weekday change cancels obsolete days**: with Mon/Wed/Fri selected,
      deselect Wednesday — confirm Wednesday's reminder no longer fires,
      while Monday's and Friday's still do.
- [ ] **Reminder delivery at the selected local time**: set a wake time a
      few minutes in the future, enable the reminder, lock the phone, and
      confirm "Good morning / Your WakeWise morning routine is ready."
      arrives at that exact local time, audibly (default iOS sound).
- [ ] **Delivery across device restart**: with the reminder enabled,
      restart the iPhone fully, and confirm the reminder still fires at
      the next scheduled time (iOS local notifications are expected to
      survive a restart, but this has not been confirmed for this app).
- [ ] **DST/time-zone behaviour**: change the device's time zone (or test
      across a DST transition if one falls during the test window) and
      confirm the reminder still fires at the same local wall-clock wake
      time, not a fixed UTC offset, and that the reconciliation
      fingerprint-based reschedule (see the implementation summary above)
      does not produce duplicate or missing notifications across the
      change.
- [ ] **Wake-time change**: with the reminder on, change the wake time in
      Onboarding — confirm the reminder now fires at the new time and
      not also at the old one for every selected weekday.
- [ ] **Disable/re-enable**: turn the reminder off, confirm no
      notification arrives at the previously-scheduled time for any
      selected day; turn it back on, confirm exactly the selected
      weekdays are scheduled again (not duplicated).
- [ ] **Duplicate-notification prevention**: rapidly toggle the reminder
      off/on/off/on, and separately rapidly change the weekday selection,
      a few times — confirm only ever one pending notification per
      selected weekday, never multiple, and no stray legacy (990001) or
      snooze (990020) notification left behind.
- [ ] **Foreground behaviour**: trigger a reminder (or use a very-near-term
      test time) while WakeWise is open and in the foreground — confirm
      the native banner does **not** appear (per the deliberate
      `silent: true` decision above) and that `AlarmContext`'s own
      in-app alarm screen appears instead, without any duplicate
      navigation or double-triggering.
- [ ] **Begin action / default tap (background)**: background WakeWise
      (don't force-quit), let the reminder fire, tap the notification
      body (or the Begin action) from the notification center/lock
      screen — confirm it opens WakeWise directly to `/alarm-trigger`
      (the Begin-slide/Snooze/Skip alarm screen), **not** `/morning-start`.
- [ ] **Begin action / default tap (cold launch)**: force-quit WakeWise
      entirely, let the reminder fire, tap it — confirm a cold launch
      also lands on `/alarm-trigger`. This exercises the native plugin's
      `retainUntilConsumed` event-retention behaviour (confirmed in this
      plugin's own iOS source) for a cold-launch tap.
- [ ] **Snooze action (background, app not foregrounded)**: let the
      reminder fire, tap the Snooze action directly (not the notification
      body) from the lock screen/notification center **without** opening
      the app — confirm a new notification arrives exactly 10 minutes
      later, and that this does not require the app to have been opened.
      This specifically exercises whether a `foreground: false` action is
      reliably delivered to the app's background listener while the app
      is fully terminated, not merely backgrounded — the bundled plugin
      docs do not make an explicit guarantee about this either way.
- [ ] **Snooze action (app terminated)**: repeat the above with WakeWise
      fully force-quit beforehand — confirm the same 10-minutes-later
      behaviour, or note precisely if it does not (see the note above).
- [ ] **Snooze replaces, does not accumulate**: tap Snooze twice on two
      separate firings without letting the first snooze fire — confirm
      only one pending snooze notification ever exists.
- [ ] **Skip action**: let the reminder fire, tap Skip — confirm no
      snooze notification is scheduled, the reminder is not disabled, and
      the next selected weekday's regular reminder still fires normally.
- [ ] **Cold-launch tap routes correctly after an action**: after tapping
      Snooze or Skip from a terminated launch, confirm the app does not
      unexpectedly navigate anywhere (only a default tap or Begin should
      navigate to `/alarm-trigger`).
- [ ] **Locked-device behaviour**: confirm the reminder (and its actions,
      where iOS surfaces them on the lock screen) behave correctly with
      the device locked.
- [ ] **Focus mode / silent-mode limitation**: enable a Focus mode (e.g.
      Do Not Disturb) that would normally silence notifications, and
      confirm the reminder is delayed/suppressed as iOS dictates — this
      is expected platform behavior, not a bug, and the in-app copy
      should already be setting this expectation ("iPhone Focus, silent
      mode and notification settings can affect delivery").
- [ ] **Logout/account-deletion cancellation**: enable the reminder while
      signed in, then sign out — confirm no further reminder fires for
      any selected weekday and the toggle shows off on next sign-in
      prompt/screen. Separately, enable the reminder, submit an
      account-deletion request (does not need to complete), and confirm
      every owned notification (weekday set + any pending snooze) is
      cancelled at that point too.
- [ ] **Custom sound wording matches reality**: confirm the in-app copy
      states the reminder uses the iPhone's default notification sound
      (not a custom WakeWise sound), matching the actual implementation.
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
- [ ] **Confirm the morning-reminder tap still opens the right screen**:
      unrelated regression check — trigger (or wait for) a scheduled
      morning reminder and confirm tapping it opens `/alarm-trigger` (the
      real alarm/decision screen — see §11a's "Complete Native Wake
      Reminder Functionality" summary for why this is `/alarm-trigger`,
      not `/morning-start`), not `/reset-password` or anywhere else. This
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
- [x] **Done (2026-09-20):** `webContentsDebuggingEnabled` now defaults
      to `false` — `capacitor.config.json` was replaced with
      `capacitor.config.ts`; see `docs/ios-security-privacy-future-requirements.md`
      and `docs/release-readiness-register.md` for the fix and its guards.
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

## 15. Apple subscriptions — macOS/Xcode and dashboard handoff

**Not done in this phase.** Phase 1 of `docs/apple-subscription-architecture.md`
was implemented on Windows — see `docs/apple-subscription-implementation.md`
for the full detail. Everything below requires macOS/Xcode, a physical
iPhone, App Store Connect, or Apple sandbox testing, none of which this
task had access to.

### macOS/Xcode steps

1. **Run `pod install`** (or `npx cap sync ios` again from macOS) to
   actually resolve the newly-added `CapgoNativePurchases` pod — this
   task's `npx cap sync ios` correctly added the Podfile entry, but
   CocoaPods itself is not installed on this Windows machine, so the pod
   was never actually fetched/linked.
2. **Confirm the iOS deployment target change took effect cleanly.** This
   task raised `IPHONEOS_DEPLOYMENT_TARGET` (all 4 occurrences in
   `project.pbxproj`) and `Podfile`'s `platform :ios` from 14.0 to 15.0
   (required by the plugin's own podspec — see the implementation
   document's Phase A). Open the project in Xcode and confirm no
   conflicting per-target setting remains, and that this doesn't
   surprise any other already-configured signing/capability setting.
3. **Add the "In-App Purchase" capability** in Xcode → the App target →
   Signing & Capabilities. The plugin's own README states this
   explicitly as a required manual step; a `project.pbxproj` text edit
   alone was not attempted for this, since Xcode is the safer place to
   confirm the resulting entitlements are correct.
4. **Confirm a clean build and archive** with the new plugin linked.
5. **Confirm the exact StoreKit purchase-cancellation error shape** this
   plugin surfaces (e.g. via a StoreKit Testing configuration in Xcode,
   or a sandbox purchase attempt cancelled mid-flow) and compare against
   `src/lib/applePurchaseAdapter.js`'s `purchaseAppleProduct` cancellation
   heuristic — update it if the real shape differs (see the
   implementation document's own flagged caveat).

### App Store Connect steps (in order)

1. **Commercial decision approved 2026-09-16, mechanism confirmed feasible from Apple's official documentation** (`docs/apple-subscription-architecture.md` §6/§16) — **not an open question any more**:
   - Configure the standard **introductory offer** (Free Trial, 7 days) on the subscription products, for standard customers.
   - Separately create a **founding-member offer code** (App Store Connect → the subscription → Offer Codes, not the product's own introductory-offer field): product `com.zavaraai.wakewise.plus.annual`, customer eligibility **New subscribers**, offer type **Pay Up Front**, duration **one year**, Australian price **AUD $49.99**, renews at the standard **AUD $59.99** annual price. When App Store Connect asks whether offer-code redeemers should also be eligible for the introductory offer, **answer "No"** — this is what keeps the two mutually exclusive, not the product configuration itself.
   - This is a genuinely different mechanism from a second introductory offer, and does not carry the earlier-flagged risk of two introductory offers being unconfigurable together — that specific risk no longer applies to this approach. **Still to be done, still requires hands-on App Store Connect work**: the introductory offer and the offer code have not been created; confirm during configuration that App Store Connect's actual UI matches this description exactly (offer-code field names/options can change between App Store Connect releases) and that the "No" answer is selected before publishing the campaign.
2. Create the `wakewise_plus` subscription group.
3. Create the two products: `com.zavaraai.wakewise.plus.monthly`,
   `com.zavaraai.wakewise.plus.annual`.
4. Configure the subscription group's service-level ranking (needed for
   correct upgrade/downgrade behaviour between the two products).
5. Configure the introductory offer and the founding offer code per step 1.
6. Select the price points closest to AUD $7.99 / $59.99 / $49.99 —
   cannot be predicted exactly from documentation; must be chosen
   directly in App Store Connect's own pricing UI.
7. Family Sharing: **approved 2026-09-16 to remain disabled** — no
   action needed here. Note for the record only: Apple does not allow
   turning Family Sharing back off once enabled for a subscription, so
   this stays a deliberate no-action item unless a fresh approval changes it.
8. Create Apple sandbox tester accounts.
9. Generate an App Store Server API key (issuer id, key id, private
   key) — `supabase/functions/verify-apple-transaction` is genuine
   verification code as of 2026-09-16 (see step 2 above), but it still
   responds fail-closed at runtime (`501`, `apple_server_verification_not_yet_configured`)
   until this key's values are actually set as secrets.
10. Once `verify-apple-transaction` and `apple-server-notifications`
    are actually deployed (a Supabase dashboard action, not done in this
    phase either — see below), configure the App Store Server
    Notifications V2 URL to point at the deployed
    `apple-server-notifications` function's public URL.

### Supabase dashboard steps

1. ~~Apply `supabase/migrations/20260916100000_apple_subscription_entitlements_foundation.sql`
   and `supabase/migrations/20260916110000_stripe_trial_and_refund_support.sql`
   to the linked project~~ — **done, 2026-09-16.** Both migrations are applied
   to the linked DEV project (`kvdxuhyndevrfvsalgnx`) and live-verified
   (tables, RLS, policies, grants, uniqueness/allow-list constraints, and
   authenticated/anon access boundaries all confirmed directly against
   the live database — see `docs/apple-subscription-implementation.md`
   Phase C for the full record). The three new tables hold zero rows;
   nothing writes to them yet. **This does not make Apple purchases
   functional** — it only means the schema those future writes need
   already exists and is verified secure.
2. ~~Set the Apple-related Edge Function secrets~~ — **done, 2026-09-16.**
   All six confirmed present by NAME in the linked DEV project (never a
   value — see `docs/apple-subscription-implementation.md` Phase H §3):
   `APPLE_ISSUER_ID`, `APPLE_KEY_ID` (`K863527LV5`), `APPLE_PRIVATE_KEY`,
   `APPLE_BUNDLE_ID` (`com.zavaraai.wakewise`), `APPLE_ENVIRONMENT`
   (currently `sandbox`), and `APPLE_RECONCILE_TRIGGER_SECRET` (a
   generated shared secret, deliberately separate from
   `SUPABASE_SERVICE_ROLE_KEY`, gating the unscheduled
   `reconcile-apple-subscriptions` function). The dedicated App Store
   Connect API key **"WakeWise App Store Server"** (Key ID `K863527LV5`)
   was used — **not** Codemagic's existing signing key, per Phase F §5's
   own reasoning (different permission scope, and reusing one key would
   couple unrelated rotations). **Rotation note**: to switch to
   `production` later, this requires a *separate* `APPLE_ENVIRONMENT`
   value — this DEV project remains `sandbox`-only; do not simply flip
   this value in place without also considering whether a separate
   deployment is more appropriate (see Phase H §6's notification-URL
   reasoning).
3. ~~Apply `supabase/migrations/20260916120000_apple_verified_state_rpc.sql`
   to the linked project~~ — **done, 2026-09-16.** Applied to the linked
   DEV project (`kvdxuhyndevrfvsalgnx`) and behaviourally live-verified —
   owner `postgres`, `search_path` fixed empty, `anon`/`authenticated`/
   `PUBLIC` confirmed unable to execute it, `service_role` confirmed
   able to; idempotency, stale/newer-event ordering, product/environment
   allow-listing, ownership-conflict rejection, cancellation/expiry/
   refund/revocation state transitions, and the full Stripe/Apple
   entitlement precedence matrix were all exercised against the live
   database — see `docs/apple-subscription-implementation.md` Phase G
   for the full record. The one `SECURITY DEFINER`, `service_role`-only
   RPC (`apply_verified_apple_subscription_event`) the verification code
   below writes through now exists live. **This alone does not make
   Apple purchases functional** — no Edge Function has been deployed and
   no Apple credential exists yet.
4. ~~Deploy `supabase/functions/verify-apple-transaction` and
   `supabase/functions/apple-server-notifications`~~ — **done,
   2026-09-16.** Both deployed to DEV (`ACTIVE`, version 1) via
   `supabase functions deploy <name> --import-map
   supabase/functions/<name>/deno.json` — the per-function `deno.json`
   import maps resolved correctly with no local Docker (the CLI bundled
   server-side, printing only `WARNING: Docker is not running`).
   `verify-apple-transaction` deployed with the CLI's default gateway
   JWT verification ON (`verify_jwt=true` — it already authenticates the
   caller in its own code, so this is a genuine extra layer, not a
   redundant risk); `apple-server-notifications` deployed with
   `--no-verify-jwt` (**required** — Apple has no way to send a Supabase
   JWT; security comes entirely from this function's own cryptographic
   `signedPayload` verification). Runtime-smoke-tested with real HTTP
   calls (no Apple credential, no purchase): a cryptographically-forged
   JWS presented to `apple-server-notifications` was correctly rejected
   by the real, deployed `jose`/`@peculiar/x509` code — direct proof the
   cryptographic dependencies load and run correctly on the actual
   Supabase Edge Runtime, not merely under Node/Vitest. Full results in
   `docs/apple-subscription-implementation.md` Phase H §5. **This still
   does not make Apple purchases functional** — no genuine Apple-signed
   payload has been presented to either function; only their rejection
   of invalid/forged/unauthenticated input is proven.
5. ~~Once deployed and confirmed reachable, optionally deploy
   `supabase/functions/reconcile-apple-subscriptions`~~ — **done,
   2026-09-16.** Deployed to DEV (`ACTIVE`, version 1, gateway JWT
   verification ON as an additional layer on top of its own
   `X-Reconcile-Secret` check). Confirmed via real HTTP calls that an
   unauthenticated request, an ordinary valid-shaped JWT with no secret
   header, and a wrong secret value are all rejected (`401`). **Still
   not scheduled** — no `pg_cron` entry, no external trigger — it does
   nothing on its own; deliberately left for a later, separate decision
   (see Phase F §2's reconciliation notes).

### Apple sandbox testing (still not started — a build is now ready for it)

**Update (2026-09-16 — "Verify and Upload Subscription-Enabled TestFlight
Build"):** ~~register the notification URL... and create at least one
sandbox tester Apple ID~~ — **both already done**, confirmed via direct
evidence (the notification URL is registered as the Sandbox Server URL
V2, confirmed in a Codemagic publish log; two Australian sandbox Apple
Accounts already exist, per the task's own known state) — the user's
own App Store Connect actions, not performed by any task in this
repository. **TestFlight build 1.0 (8), commit `a1e63df`, containing
the complete Apple subscription implementation, is now confirmed
available to the `WakeWise Internal Testers` group** — see
`docs/apple-subscription-implementation.md` Phase I for the exact
verification evidence and the exact remaining physical-device steps.
Nothing below has actually been attempted yet.

Every row in `docs/apple-subscription-architecture.md` §12's sandbox
test matrix — first purchase (monthly/annual), trial eligibility/
ineligibility, founding-offer-code redemption/eligibility/ineligibility
(the commercial decision and mechanism are already approved, configured
in App Store Connect, and confirmed feasible — this is sandbox
verification of the actual configuration, not a further decision; note
the *production* redeemable code `WAKEWISEFOUNDING` cannot exist until
App Review approval, so only the trial and Pay-Up-Front-offer mechanics
themselves — not that specific code — can be sandbox-tested before
then), explicitly confirming a founding-offer-code redemption does
**not** also grant the introductory trial (and vice versa), cancellation,
restore (same device, another device, wrong account), renewal, refund,
and the terminated-app/cold-launch scenarios equivalent to those already
run for the native reminder feature. **None of this was attempted in
the 2026-09-16 secure-deployment task** — it was explicitly forbidden
from performing any real or sandbox purchase; it deployed and
runtime-smoke-tested the server-side rejection paths only.

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

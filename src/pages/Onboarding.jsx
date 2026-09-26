/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { COMMON_TIMEZONES, detectDeviceTimezone, isValidTimezone } from '../lib/timezone';
import { JourneyHeader } from '../components/journey/JourneyHeader';
import { Toggle } from '../components/Toggle';
import { AlarmSoundPicker } from '../components/AlarmSoundPicker';

/*
 * Onboarding simplification (removal of the middle "Set Your
 * Intentions" goals screen).
 *
 * Audited before removing: the three onboarding goals (Reduce Anxiety /
 * Deep Focus / Better Sleep) were stored by writing their raw ids
 * ('Anxiety'/'Focus'/'Sleep') into the SAME `intentions` array/
 * localStorage key (moonlight_intentions) and Supabase user_intentions
 * row that Morning's own daily intentions feature (IntentionSetup.jsx,
 * Home's "Change intention") now uses as its single source of truth.
 * Nothing else in the app ever read those specific ids back out - no
 * breathing/soundscape customization, no recommendation logic, no
 * notification content, and no analytics event fires for them
 * (onboarding_completed in analyticsEvents.js is defined but never
 * actually called anywhere) - so the removed
 * "We'll personalize your breathing and soundscapes based on these"
 * claim was never true. Worse, selecting a goal here actively
 * corrupted the Morning intentions data model (a raw id like 'Focus'
 * would show up as a Morning "intention"). Daily Morning intentions now
 * own the concept of "intentions" - this screen must never write to
 * `intentions` again.
 *
 * Target flow (2 screens, not 4): Welcome -> Sync with Your Nature
 * (wake time/bedtime/timezone) -> completing that step persists the
 * rhythm exactly as before (updateRhythm) and navigates to Home. The
 * former step 4 "Your Journey Begins" summary screen is also removed -
 * its content was purely a recap of the immediately-preceding step, and
 * "Complete onboarding and navigate to Home" is the action Continue on
 * the schedule step performs, not a third screen to show.
 *
 * No step-progress persistence exists anywhere for this flow (grepped
 * the whole repo - no onboarding-step localStorage key was ever
 * written), so there is no partially-completed old-onboarding state to
 * migrate; `step` starting at 1 is always a valid, safe starting point.
 * Nothing here is a gate new/existing users are ever automatically
 * routed through - Auth.jsx's redirectAfterAuth() already sends every
 * sign-in and sign-up straight to Home ('/'); this route is only ever
 * reached voluntarily via Profile's "Wake time"/"Bedtime" rows, exactly
 * as before.
 *
 * Return-navigation remediation — this is entirely a VOLUNTARY, replay-
 * able settings screen (confirmed above: the only real entry points are
 * Profile's own two rows; Auth.jsx never routes here; no auth/consent/
 * security step is ever involved), never first-time-onboarding proper -
 * so it gets Case 1 treatment (a visible Back/Close, safe Home
 * fallback), not a mandatory-flow exemption. JourneyHeader (already
 * shared by Anytime Reset/Meditate/Change Intention) supplies both:
 * showBackButton on step 1 renders the real, shared BackButton
 * (fallback="/" - Home, the documented safe fallback; goBack() itself
 * still prefers real in-app history first, landing back on Profile for
 * every genuine entry) with the app's one accessible "Go back" name; the
 * step 2 slot instead renders JourneyHeader's own circular 44x44
 * step-back arrow wired to this file's existing local `handleBack`
 * (replacing the old undersized text-only "← Back" link, which carried
 * no confirmed touch-target size and didn't match the shared circular
 * BackButton style used everywhere else in the app). onClose is an
 * unconditional, always-present "Close" control (JourneyHeader's own
 * accessible name) straight to Home on every step - the one guarantee
 * that holds even for a direct
 * `/onboarding` URL open or a mid-step-2 refresh (this flow keeps no
 * step-progress persistence, so a refresh always lands back on step 1,
 * where Close/Back both already resolve safely). Existing progress bar,
 * step state, and rhythm-persistence logic are completely untouched -
 * this is a navigation-only change.
 */
const TOTAL_STEPS = 2;

export const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Welcome alarm-status card — Set/Change/Manage alarm links here as
  // /onboarding?returnTo=/introduction (URL-encoded) so this shared
  // settings screen knows to land the user back on Welcome rather than
  // Home once they finish, and so Close/Back return somewhere coherent
  // too (a user who arrived from Welcome expects Close to go back to
  // Welcome, not Home). Absent entirely for Profile's own existing
  // "Wake time"/"Bedtime" entry points - both keep navigating to Home
  // exactly as before.
  const returnTo = searchParams.get('returnTo');
  const homeOrReturnTo = returnTo || '/';
  const { updateRhythm, alarmTime, bedTime, isAlarmSet, effectiveTimezone } = useAlarm();
  // Welcome alarm-status card — arriving via returnTo means the user
  // tapped Set/Change/Manage alarm specifically to manage their alarm,
  // not to read the generic "Welcome to WakeWise" step-1 blurb - skips
  // straight to the real step-2 form, the "relevant Morning alarm
  // section" rather than landing ambiguously on an unrelated first step.
  const [step, setStep] = useState(() => (returnTo ? 2 : 1));
  // Bug found while wiring the Welcome alarm-status card in: these two
  // used to be two hardcoded useState literals holding the factory
  // default wake/bed times, completely ignoring the user's real,
  // already-saved alarmTime/bedTime - opening this screen from Profile's
  // own "Wake time" row (its only pre-existing entry point) always
  // showed that factory default regardless of what was actually saved,
  // and clicking Continue without noticing would have silently
  // overwritten a real, deliberately-set time back to the default. Fixed
  // with the exact same derive-instead-of-sync shape localTimezone below
  // already uses: an override that starts null (untouched) and a
  // derived value that always reflects the
  // latest real state once it resolves, no effect required.
  const [alarmOverride, setAlarmOverride] = useState(null);
  const [bedOverride, setBedOverride] = useState(null);
  const [enabledOverride, setEnabledOverride] = useState(null);
  const localAlarm = alarmOverride ?? alarmTime;
  const localBed = bedOverride ?? bedTime;
  const localEnabled = enabledOverride ?? isAlarmSet;
  const setLocalAlarm = setAlarmOverride;
  const setLocalBed = setBedOverride;
  const setLocalEnabled = setEnabledOverride;
  const detectedTimezone = detectDeviceTimezone();
  // Global timezone correctness: detected via Intl (no GPS permission),
  // shown for explicit accept/correction.
  //
  // Product Journey Closure fix: this used to be `useState(effectiveTimezone
  // || detectDeviceTimezone)`, snapshotting effectiveTimezone once at
  // mount. For a registered user, effectiveTimezone starts out null on
  // every fresh mount (AlarmContext resets it before its async Supabase
  // fetch resolves - see AlarmContext.jsx's own syncRhythm effect), so
  // that snapshot could capture the device-detected default instead of
  // the real saved zone if this page rendered before the fetch settled.
  // Confirmed live: revisiting Onboarding (e.g. from Profile's Wake time
  // row) showed the device zone instead of the real saved one, and
  // clicking through without noticing would have silently overwritten a
  // correctly-saved non-default timezone.
  //
  // Fixed by deriving instead of syncing: timezoneOverride holds only the
  // user's own explicit in-page choice (null until they touch the
  // picker), and localTimezone is computed from it each render - so it
  // always reflects the latest effectiveTimezone once that resolves,
  // with no effect needed to keep it in sync.
  const [timezoneOverride, setTimezoneOverride] = useState(null);
  const localTimezone = timezoneOverride ?? effectiveTimezone ?? detectedTimezone;
  const setLocalTimezone = setTimezoneOverride;
  const [showTimezonePicker, setShowTimezonePicker] = useState(false);

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleNext = () => {
    if (step === 2 && !isValidTimezone(localTimezone)) return;
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      // The one real, deliberate save this screen ever makes - marks
      // alarmConfigured true and persists isAlarmSet inside updateRhythm
      // itself (see AlarmContext.jsx). Never fires from Close/Back below,
      // so cancelling out of this screen can never falsely mark an
      // unconfigured alarm as configured.
      updateRhythm(localAlarm, localBed, localTimezone, localEnabled);
      navigate(homeOrReturnTo);
    }
  };

  return (
    // Welcome alarm-status card — this "Full-Screen flow" route (outside
    // <Layout>, see App.jsx) had no scroll container of its own before
    // this: index.html sets overflow:hidden on body/html deliberately
    // (see Introduction.jsx's own top doc comment for why), and this
    // screen's previous min-h-[80vh]-only wrapper relied entirely on
    // document scroll - already borderline for the original step 2 (4
    // cards), now genuinely overflowing a real phone viewport once the
    // enable/disable row and the full 5-row sound picker are added. Same
    // proven fix as Introduction.jsx's own: an outer h-dvh box plus one
    // real internal overflow-y-auto scroll container, so every control
    // stays reachable by scrolling rather than becoming unreachable below
    // the fold.
    <div className="h-dvh overflow-hidden">
      <div className="h-full w-full overflow-y-auto overflow-x-hidden scroll-hide" style={{ overscrollBehaviorY: 'contain' }}>
    <div
      className="min-h-full flex flex-col items-center justify-center py-6 max-w-xl mx-auto space-y-10"
      style={{
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))'
      }}
    >

      <div className="w-full">
        <JourneyHeader showBackButton={step === 1} backFallback={homeOrReturnTo} onStepBack={handleBack} onClose={() => navigate(homeOrReturnTo)} />
      </div>

      <section className="text-center space-y-2 w-full">
        <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">Personalizing Your Journey</span>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}></div>
        </div>
      </section>

      {step === 1 && (
        <div className="space-y-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-4xl">spa</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">Welcome to WakeWise</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed px-4">
            Align your daily rituals with the natural flow of time. From the softest dawn to the deepest midnight, we guide you through a seamless cycle of rejuvenation.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 w-full">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold text-white">Sync with Your Nature</h2>
            <p className="text-xs text-on-surface-variant">Setting your schedule enables automatically adjusted lighting and soundscapes.</p>
          </div>

          <div className="space-y-4">
            <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
              <div className="flex gap-4 items-center">
                <span className="material-symbols-outlined text-primary text-3xl">wb_twilight</span>
                <div>
                  <h4 className="font-label-md text-sm text-on-surface font-bold">Morning Rise</h4>
                  <p className="text-[10px] text-on-surface-variant font-semibold">Wake-up alarm clock</p>
                </div>
              </div>
              <input
                type="time"
                value={localAlarm}
                onChange={(e) => setLocalAlarm(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl p-2 text-sm text-white focus:ring-1 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>

            {/* Welcome alarm-status card — the real enable/disable
                control isAlarmSet never had anywhere in the app before
                this. Sits directly under the wake-time row it governs. */}
            <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
              <div className="flex gap-4 items-center">
                <span className="material-symbols-outlined text-primary text-3xl">
                  {localEnabled ? 'alarm_on' : 'alarm_off'}
                </span>
                <div>
                  <h4 className="font-label-md text-sm text-on-surface font-bold">Wake-up alarm</h4>
                  <p className="text-[10px] text-on-surface-variant font-semibold">
                    {localEnabled ? 'On - will wake you at the time above' : 'Off - paused until you turn it back on'}
                  </p>
                </div>
              </div>
              <Toggle checked={localEnabled} onChange={setLocalEnabled} label="Wake-up alarm enabled" />
            </div>

            <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
              <div className="flex gap-4 items-center">
                <span className="material-symbols-outlined text-secondary text-3xl">bedtime</span>
                <div>
                  <h4 className="font-label-md text-sm text-on-surface font-bold">Night Rest</h4>
                  <p className="text-[10px] text-on-surface-variant font-semibold">Target bedtime goal</p>
                </div>
              </div>
              <input
                type="time"
                value={localBed}
                onChange={(e) => setLocalBed(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl p-2 text-sm text-white focus:ring-1 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>

            {/* Global timezone correctness: detected via Intl (no GPS
                permission), shown for explicit accept/correction - this
                is what turns the wall-clock times above into an actual
                moment WakeWise can schedule against. */}
            <div className="glass-panel p-5 rounded-2xl space-y-3">
              <div className="flex gap-4 items-center">
                <span className="material-symbols-outlined text-tertiary text-3xl">public</span>
                <div>
                  <h4 className="font-label-md text-sm text-on-surface font-bold">Timezone</h4>
                  <p className="text-[10px] text-on-surface-variant font-semibold">
                    Detected as {detectedTimezone}
                  </p>
                </div>
              </div>
              {!showTimezonePicker ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-on-surface">{localTimezone}</span>
                  <button
                    type="button"
                    onClick={() => setShowTimezonePicker(true)}
                    className="text-xs font-bold uppercase tracking-wider text-primary hover:opacity-80 active:scale-95 transition-all"
                  >
                    Not right? Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={COMMON_TIMEZONES.some((tz) => tz.id === localTimezone) ? localTimezone : ''}
                    onChange={(e) => e.target.value && setLocalTimezone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:ring-1 focus:ring-primary focus:border-transparent outline-none"
                  >
                    <option value="" disabled>Choose a timezone...</option>
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz.id} value={tz.id}>{tz.label} — {tz.id}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={isValidTimezone(localTimezone) && !COMMON_TIMEZONES.some((tz) => tz.id === localTimezone) ? localTimezone : ''}
                    onChange={(e) => e.target.value && setLocalTimezone(e.target.value)}
                    placeholder="Or type an exact IANA name (Region/City)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:ring-1 focus:ring-primary focus:border-transparent outline-none placeholder:text-on-surface-variant/40"
                  />
                </div>
              )}
            </div>

            {/* Welcome alarm-status card — the real sound picker
                (alarmSounds.js), reused verbatim from
                NotificationSettings.jsx rather than a second
                implementation. #alarm-sound is this screen's own deep-
                link target too, matching NotificationSettings.jsx's. */}
            <AlarmSoundPicker />
          </div>
        </div>
      )}

      <button
        onClick={handleNext}
        className="w-full bg-primary text-on-primary py-4 rounded-full font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
      >
        {/* Welcome alarm-status card — a user who arrived here via
            returnTo is managing an existing/new alarm, not starting
            their first morning routine (this screen never starts one -
            see this file's own top doc comment); "Save" says so
            honestly instead of the onboarding wizard's own completion
            copy, which would be misleading here. */}
        <span>{step < TOTAL_STEPS ? 'Continue' : returnTo ? 'Save' : 'Start My First Morning'}</span>
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </button>

    </div>
      </div>
    </div>
  );
};

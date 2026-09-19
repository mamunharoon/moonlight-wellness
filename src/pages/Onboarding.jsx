import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { COMMON_TIMEZONES, detectDeviceTimezone, isValidTimezone } from '../lib/timezone';

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
 */
const TOTAL_STEPS = 2;

export const Onboarding = () => {
  const navigate = useNavigate();
  const { updateRhythm, effectiveTimezone } = useAlarm();
  const [step, setStep] = useState(1);
  const [localAlarm, setLocalAlarm] = useState('07:30');
  const [localBed, setLocalBed] = useState('22:00');
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
      updateRhythm(localAlarm, localBed, localTimezone);
      navigate('/');
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-6 max-w-xl mx-auto space-y-10">

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
          <div className="flex items-center">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-on-surface active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Back
            </button>
          </div>
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
          </div>
        </div>
      )}

      <button
        onClick={handleNext}
        className="w-full bg-primary text-on-primary py-4 rounded-full font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
      >
        <span>{step === TOTAL_STEPS ? 'Start My First Morning' : 'Continue'}</span>
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </button>

    </div>
  );
};

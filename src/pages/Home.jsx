/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { MORNING_DISPLAY_STEP_NUMBERS, MORNING_DISPLAY_STEP_COUNT } from '../session/sessionConstants';
import { MORNING_STEP_IDS } from '../session/sessionConstants';
import { getStepIndex } from '../session/sessionRegistry';
import { now as devNow } from '../lib/devClock';
import { getZonedParts } from '../lib/timezone';
import { getGreeting } from '../lib/greeting';
import { TimezoneBanner } from '../components/TimezoneBanner';

// Daily Journey & Content Architecture: friendly title/route for the
// Session Engine's two sessions, so an in-progress routine can be
// resumed from a single explicit Home card instead of Layout.jsx
// silently forcing the user back into it on every render (see
// Layout.jsx's own comment on that fix). Deliberately not imported from
// sessionRegistry: this is just display copy for the two sessions that
// exist today, not a general-purpose session lookup.
const SESSION_LABELS = {
  'morning-routine': 'Rise & Reset',
  'evening-wind-down': 'Begin Wind-Down'
};

const MORNING_DONE_KEY = 'moonlight_morning_completed_date';
const EVENING_DONE_KEY = 'moonlight_evening_completed_date';
const MEDITATION_DONE_KEY = 'moonlight_meditation_completed_date';

export const Home = () => {
  const navigate = useNavigate();
  const { alarmTime, bedTime, intentions, effectiveTimezone } = useAlarm();
  const { profile, user } = useAuth();
  const { state, currentStep, resumeSession, startSession, resetSession } = useSession();

  // Global timezone correctness: every "what day/time is it for this
  // user" question below goes through getZonedParts(effectiveTimezone),
  // never new Date()'s raw local getters or toDateString()/toISOString().
  // devNow() layers in on top purely for the DEV-only clock-injection
  // test seam (see lib/devClock.js) - it still resolves to the real
  // instant in production, so this is exactly "the real current instant,
  // interpreted in the user's own timezone" in a shipped build.
  const zoned = getZonedParts(effectiveTimezone, devNow());
  const today = zoned.dateKey;
  const isMorningDone = localStorage.getItem(MORNING_DONE_KEY) === today;
  const isEveningDone = localStorage.getItem(EVENING_DONE_KEY) === today;
  // Meditation experience: mirrors the morning/evening pattern exactly -
  // a local-date-keyed flag using the same timezone-correct dateKey, so
  // it resets at the user's own local midnight, never Sydney server time
  // or UTC. Only ever shown once earned (see the pill below), not as a
  // persistent unchecked placeholder like Morning/Evening.
  const isMeditatedToday = localStorage.getItem(MEDITATION_DONE_KEY) === today;

  const isMorningActive = state.sessionId === 'morning-routine' && (state.status === 'playing' || state.status === 'interrupted');
  const isEveningActive = state.sessionId === 'evening-wind-down' && (state.status === 'playing' || state.status === 'interrupted');

  // Derived timeState. "Before wake" is compared against the user's own
  // configured alarmTime (not a fixed clock band) per the required Today
  // experience — every other band stays the same fixed daypart split
  // this page already used.
  const nowMinutes = zoned.minutesSinceMidnight;
  const [alarmH, alarmM] = (alarmTime || '07:30').split(':').map(Number);
  const alarmMinutes = (alarmH || 0) * 60 + (alarmM || 0);
  const hours = zoned.hour;

  let timeState;
  if (nowMinutes < alarmMinutes) {
    timeState = 'before-wake';
  } else if (hours < 12) {
    timeState = 'daytime-morning';
  } else if (hours < 18) {
    timeState = 'daytime';
  } else if (hours < 22) {
    timeState = 'evening';
  } else {
    timeState = 'night';
  }

  // Morning/Evening selector: null means "automatic" (the timeState
  // logic above decides, unchanged) - only becomes 'morning'/'evening'
  // once the user actually taps a pill, and then stays that way for the
  // rest of this page view (component state, not persisted - a fresh
  // visit re-derives from the real clock again). Only overrides during
  // daytime-morning/daytime/evening: before-wake and night are real
  // time-based constraints (before your alarm; late enough that winding
  // down further doesn't make sense), not a ritual choice to toggle.
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const overridableTimeStates = timeState === 'daytime-morning' || timeState === 'daytime' || timeState === 'evening';
  const effectiveTimeState =
    overridableTimeStates && selectedPeriod === 'morning'
      ? 'daytime-morning'
      : overridableTimeStates && selectedPeriod === 'evening'
        ? 'evening'
        : timeState;
  // Which pill looks active. Once the user has picked one, show that
  // choice; otherwise reflect the real clock (existing daypart rules) -
  // evening/night lean the Evening pill, everything else leans Morning.
  const activePeriod = selectedPeriod ?? (timeState === 'evening' || timeState === 'night' ? 'evening' : 'morning');

  const primaryIntention = intentions[0] || 'Stay calm';

  // Resuming an 'interrupted' routine must flip it back to 'playing'
  // first — every step page's own Continue/Skip guards only advance the
  // Session Engine when status is genuinely 'playing' (see
  // MorningStart.jsx etc.), so navigating straight to currentStep.route
  // while still 'interrupted' would silently strand the user on that
  // step with a Continue button that does nothing.
  const handleContinueSession = () => {
    if (state.status === 'interrupted') resumeSession();
    navigate(currentStep.route);
  };

  // Close Remaining Daily-Journey Limitations: Today's own "Begin Rise &
  // Reset" card used to be a bare Link straight to /morning-start, which
  // is now just Step 1 of the routine (see MorningStart.jsx's own doc
  // comment) and assumes the Session Engine was already started by
  // whoever navigated here — a real entry point (RoutineDetail.jsx's own
  // Start Routine) already does this, but Today's card didn't, so a
  // routine begun from here never actually engaged the Session Engine
  // (no step tracking, no resume, no "Continue where you left off").
  // Mirrors RoutineDetail.jsx's beginRiseAndReset exactly: reset-before-
  // start guard, then start fresh at Step 1.
  const handleBeginRiseAndReset = () => {
    if (state.status === 'playing' || state.status === 'interrupted') {
      resetSession();
    }
    startSession('morning-routine', { startIndex: getStepIndex('morning-routine', MORNING_STEP_IDS.START) });
    navigate('/morning-start');
  };

  const morningStepNumber = isMorningActive ? MORNING_DISPLAY_STEP_NUMBERS[currentStep?.id] : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      <TimezoneBanner />

      {/* Morning/Evening selector — also shows each ritual's daily
          completion status (the ✓ prefix), same as before this was made
          functional. */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSelectedPeriod('morning')}
          aria-pressed={activePeriod === 'morning'}
          className={`flex-1 text-center text-[10px] font-bold uppercase tracking-wider py-2 rounded-full transition-all ${activePeriod === 'morning' ? 'bg-primary/15 text-primary' : 'glass-panel text-on-surface-variant/60 hover:bg-white/5'}`}
        >
          {isMorningDone ? '✓ Morning' : 'Morning'}
        </button>
        <button
          type="button"
          onClick={() => setSelectedPeriod('evening')}
          aria-pressed={activePeriod === 'evening'}
          className={`flex-1 text-center text-[10px] font-bold uppercase tracking-wider py-2 rounded-full transition-all ${activePeriod === 'evening' ? 'bg-secondary/15 text-secondary' : 'glass-panel text-on-surface-variant/60 hover:bg-white/5'}`}
        >
          {isEveningDone ? '✓ Evening' : 'Evening'}
        </button>
        {isMeditatedToday && (
          <span className="flex-1 text-center text-[10px] font-bold uppercase tracking-wider py-2 rounded-full bg-tertiary/15 text-tertiary">
            ✓ Meditated today
          </span>
        )}
      </div>

      {/* Continue an in-progress routine (morning OR evening) — the
          user-initiated replacement for the forced-redirect Layout.jsx
          used to apply on every render. Resuming is a tap the user
          chooses, never something imposed. */}
      {(isMorningActive || isEveningActive) && currentStep?.route && (
        <button
          type="button"
          onClick={handleContinueSession}
          className="block w-full text-left glass-panel p-5 rounded-3xl border-l-4 border-l-primary shadow-sm hover:bg-white/5 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] text-primary uppercase font-bold tracking-wider">
                {state.status === 'interrupted' ? 'Paused — resume' : 'Continue where you left off'}
              </span>
              <h3 className="text-base font-bold text-on-surface mt-0.5 truncate">
                {SESSION_LABELS[state.sessionId] || 'Your routine'}
                {morningStepNumber ? ` — Step ${morningStepNumber} of ${MORNING_DISPLAY_STEP_COUNT}` : ''}
              </h3>
            </div>
            <span className="material-symbols-outlined text-primary text-2xl shrink-0">play_circle</span>
          </div>
        </button>
      )}

      {/* Persistent, always-reachable actions — never gated on having
          set an intention, regardless of time of day. */}
      <div className="space-y-3">
        <div className="glass-panel px-4 py-3 rounded-2xl flex items-center gap-3">
          <span className="material-symbols-outlined text-tertiary text-lg shrink-0">spa</span>
          <p className="text-xs text-on-surface-variant min-w-0 truncate">
            <span className="font-bold uppercase tracking-wider text-[10px] text-tertiary mr-1.5">Intention</span>
            "{primaryIntention}"
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          <Link
            to="/support"
            className="glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center hover:bg-white/5 active:scale-95 transition-all min-h-[44px]"
          >
            <span className="material-symbols-outlined text-primary text-xl">self_improvement</span>
            <span className="text-[11px] font-semibold text-on-surface leading-tight">Need a moment?</span>
          </Link>
          {/* Meditation experience: quick action, not a fifth bottom-nav
              tab. Routes to /meditate — see Meditate.jsx's own doc
              comment for the full journey it owns from here. */}
          <Link
            to="/meditate"
            className="glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center hover:bg-white/5 active:scale-95 transition-all min-h-[44px]"
          >
            <span className="material-symbols-outlined text-primary text-xl">spa</span>
            <span className="text-[11px] font-semibold text-on-surface leading-tight">Meditate</span>
          </Link>
          <Link
            to="/library"
            className="glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center hover:bg-white/5 active:scale-95 transition-all min-h-[44px]"
          >
            <span className="material-symbols-outlined text-primary text-xl">video_library</span>
            <span className="text-[11px] font-semibold text-on-surface leading-tight">Browse exercises</span>
          </Link>
          <Link
            to="/library?category=sleep-soundscapes"
            className="glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center hover:bg-white/5 active:scale-95 transition-all min-h-[44px]"
          >
            <span className="material-symbols-outlined text-primary text-xl">bedtime</span>
            <span className="text-[11px] font-semibold text-on-surface leading-tight">Sleep sounds</span>
          </Link>
        </div>
      </div>

      {/* BEFORE WAKE TIME */}
      {timeState === 'before-wake' && (
        <div className="space-y-8 text-center py-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary text-3xl">bedtime</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-on-surface">Still resting</h2>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              Next wake reminder at {alarmTime}. Bedtime was set for {bedTime}.
            </p>
          </div>
        </div>
      )}

      {/* MORNING WINDOW — not started */}
      {effectiveTimeState === 'daytime-morning' && !isMorningActive && !isMorningDone && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">{getGreeting('morning', { profile, user })}</h2>
            <p className="text-xs text-on-surface-variant font-medium">Ready for your breath of fresh air today?</p>
          </div>
          <div className="glass-panel p-8 rounded-3xl text-center space-y-6 border-primary/20 shadow-sm bg-gradient-to-tr from-[#fffdfa] via-[#fff5f2] to-[#ffebd2] dark:from-[#1e1a17] dark:to-[#2d221c]">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">
              Rise &amp; Reset
            </span>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold leading-tight text-on-surface">Ready when you are</h3>
              <p className="text-sm text-on-surface-variant font-medium">A short 5-step sequence to start your day grounded.</p>
            </div>
            <button
              type="button"
              onClick={handleBeginRiseAndReset}
              className="block w-full py-4 rounded-xl bg-primary text-on-primary font-bold text-center hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/10"
            >
              Begin Rise &amp; Reset
            </button>
          </div>
        </div>
      )}

      {/* MORNING WINDOW — complete */}
      {effectiveTimeState === 'daytime-morning' && isMorningDone && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">Rise &amp; Reset complete</h2>
            <p className="text-xs text-on-surface-variant font-medium">You started today with intention.</p>
          </div>
          <div className="glass-panel p-6 rounded-3xl space-y-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Today's Intention</p>
            <p className="text-lg italic font-medium text-on-surface">"{primaryIntention}"</p>
          </div>
        </div>
      )}

      {/* DAYTIME */}
      {effectiveTimeState === 'daytime' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">{getGreeting('afternoon', { profile, user })}</h2>
            <p className="text-xs text-on-surface-variant font-medium">One small step at a time.</p>
          </div>
          <div className="glass-panel p-6 rounded-3xl space-y-6 shadow-sm bg-gradient-to-br from-[#ffffff]/5 to-transparent">
            <div className="space-y-2">
              <p className="text-xs text-primary font-bold uppercase tracking-wider">Active Intention</p>
              <p className="text-lg font-bold text-on-surface">"{primaryIntention}"</p>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">Take a gentle 60-second breathing break to center your focus and reduce anxiety.</p>
            <Link to="/breathe" className="block w-full py-3 rounded-xl bg-primary text-on-primary text-center font-bold hover:opacity-90 active:scale-95 transition-all shadow-md">
              60-Second Reset
            </Link>
          </div>
        </div>
      )}

      {/* EVENING */}
      {effectiveTimeState === 'evening' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-[#ffc5b7] tracking-tight">{getGreeting('evening', { profile, user })}</h2>
            <p className="text-xs text-on-surface-variant font-medium">
              {isEveningDone ? 'Tonight\'s wind-down is complete. Rest well.' : 'You\'ve done enough for today. Let\'s prepare for tomorrow.'}
            </p>
          </div>
          {!isEveningDone && (
            <div className="glass-panel p-6 rounded-3xl space-y-6 border-white/5 shadow-sm bg-gradient-to-br from-[#121b2e]/30 to-transparent">
              <div className="space-y-1">
                <p className="text-xs text-primary font-bold uppercase tracking-widest">Evening Reflection</p>
                <h3 className="text-xl font-bold text-on-surface">
                  {isEveningActive ? 'Continue your wind-down' : 'What are you grateful for today?'}
                </h3>
              </div>
              {isEveningActive ? (
                <button
                  type="button"
                  onClick={handleContinueSession}
                  className="block w-full py-4 rounded-xl bg-primary text-on-primary text-center font-bold hover:opacity-90 active:scale-95 transition-all shadow-md"
                >
                  Continue Wind-Down
                </button>
              ) : (
                <Link to="/evening-wind-down" className="block w-full py-4 rounded-xl bg-primary text-on-primary text-center font-bold hover:opacity-90 active:scale-95 transition-all shadow-md">
                  Begin Wind-Down
                </Link>
              )}
              <Link to="/library?category=sleep-soundscapes" className="block w-full py-4 rounded-xl glass-panel text-on-surface-variant text-center font-semibold hover:bg-white/10 active:scale-95 transition-all border-white/10">
                Sleep Soundscapes
              </Link>
            </div>
          )}
        </div>
      )}

      {/* LATE NIGHT */}
      {timeState === 'night' && (
        <div className="space-y-8 text-center py-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary text-3xl">dark_mode</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-on-surface">Rest Well</h2>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              Circadian rhythms are settling. Tomorrow's wake reminder is set for {alarmTime}. Sleep soundly.
            </p>
          </div>
          <Link to="/library?category=sleep-soundscapes" className="inline-block px-6 py-3 rounded-full glass-panel text-on-surface-variant text-sm font-semibold hover:bg-white/10 active:scale-95 transition-all border-white/10">
            Sleep Soundscapes
          </Link>
        </div>
      )}

    </div>
  );
};

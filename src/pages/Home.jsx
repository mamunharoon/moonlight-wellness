/* eslint-disable no-unused-vars */
import { Link } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';

// Mobile navigation repair, Phase 2: friendly title/route for the
// Session Engine's two sessions, so an in-progress routine can be
// resumed from a single explicit Home card instead of Layout.jsx
// silently forcing the user back into it on every render (see
// Layout.jsx's own comment on that fix). Deliberately not imported from
// sessionRegistry: this is just display copy for the two sessions that
// exist today, not a general-purpose session lookup.
const SESSION_LABELS = {
  'morning-routine': 'Morning Awakening',
  'evening-wind-down': 'Evening Wind-down'
};

export const Home = () => {
    const { alarmTime, intentions } = useAlarm();
    const { state, currentStep } = useSession();

  // Retrieve real completion data from local storage
  const isMorningDone = localStorage.getItem('moonlight_morning_completed_date') === new Date().toDateString();

  // Derived timeState logic (0% chance of set-state-in-effect errors)
  const hours = new Date().getHours();
  let timeState = 'daytime';
  if (hours >= 5 && hours < 12) {
    timeState = isMorningDone ? 'morning-post' : 'morning-pre';
  } else if (hours >= 12 && hours < 18) {
    timeState = 'daytime';
  } else if (hours >= 18 && hours < 22) {
    timeState = 'evening';
  } else {
    timeState = 'night';
  }

  const primaryIntention = intentions[0] || 'Stay calm';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Mobile navigation repair, Phase 2: explicit "Continue" card,
          shown only while a session is genuinely 'playing' (never for
          'completed'/'skipped'/'idle' — same rule Layout.jsx's own
          redirect effect uses). This is the user-initiated replacement
          for the forced-redirect that used to fire on every render: the
          routine is still easy to resume, but resuming is now a tap the
          user chooses, not something imposed on every navigation. */}
      {state.status === 'playing' && currentStep?.route && (
        <Link
          to={currentStep.route}
          className="block glass-panel p-5 rounded-3xl border-l-4 border-l-primary shadow-sm hover:bg-white/5 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Continue where you left off</span>
              <h3 className="text-base font-bold text-on-surface mt-0.5 truncate">
                {SESSION_LABELS[state.sessionId] || 'Your routine'}
              </h3>
            </div>
            <span className="material-symbols-outlined text-primary text-2xl shrink-0">play_circle</span>
          </div>
        </Link>
      )}

      {/* Mobile navigation repair, Phase 2: the four required Home
          affordances (Continue routine above; Need a moment, Browse
          exercises, Sleep sounds below) so a signed-in user can reach
          any of them in one tap, from Home, regardless of time of day —
          none of this requires intention setup first, since nothing in
          the app gates exercises or sleep sounds on having set an
          intention. Current intention is shown here unconditionally too
          (previously only visible in the morning-post/daytime branches
          below) since it's one of the required "obvious" Home actions. */}
      <div className="space-y-3">
        <div className="glass-panel px-4 py-3 rounded-2xl flex items-center gap-3">
          <span className="material-symbols-outlined text-tertiary text-lg shrink-0">spa</span>
          <p className="text-xs text-on-surface-variant min-w-0 truncate">
            <span className="font-bold uppercase tracking-wider text-[10px] text-tertiary mr-1.5">Intention</span>
            "{primaryIntention}"
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Link
            to="/support"
            className="glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center hover:bg-white/5 active:scale-95 transition-all min-h-[44px]"
          >
            <span className="material-symbols-outlined text-primary text-xl">self_improvement</span>
            <span className="text-[11px] font-semibold text-on-surface leading-tight">Need a moment?</span>
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

      {/* MORNING - BEFORE COMPLETION (Peach & Cream theme-aware background container) */}
      {timeState === 'morning-pre' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">Good morning, Sun</h2>
            <p className="text-xs text-on-surface-variant font-medium">Ready for your breath of fresh air today?</p>
          </div>
          <div className="glass-panel p-8 rounded-3xl text-center space-y-6 border-primary/20 shadow-sm bg-gradient-to-tr from-[#fffdfa] via-[#fff5f2] to-[#ffebd2] dark:from-[#1e1a17] dark:to-[#2d221c]">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">
              Morning Awakening
            </span>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold leading-tight text-on-surface">Waking Goal</h3>
              <p className="text-sm text-on-surface-variant font-medium">Scheduled for {alarmTime} with 'Gentle Breeze'</p>
            </div>
            {/* Navigates directly to the beginning of your morning flow */}
            <Link to="/morning-start" className="block w-full py-4 rounded-xl bg-primary text-on-primary font-bold text-center hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/10">
              Begin Your Morning
            </Link>
          </div>
        </div>
      )}

      {/* MORNING - AFTER COMPLETION */}
      {timeState === 'morning-post' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">Morning Awakening</h2>
            <p className="text-xs text-on-surface-variant font-medium">You started today with intention.</p>
          </div>
          <div className="glass-panel p-6 rounded-3xl space-y-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Today's Intention</p>
            <p className="text-lg italic font-medium text-on-surface">"{primaryIntention}"</p>
          </div>
        </div>
      )}

      {/* DAYTIME */}
      {timeState === 'daytime' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">Stay Centered</h2>
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
      {timeState === 'evening' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-[#ffc5b7] tracking-tight">Begin Wind-Down</h2>
            <p className="text-xs text-on-surface-variant font-medium">You've done enough for today. Let's prepare for tomorrow.</p>
          </div>
          <div className="glass-panel p-6 rounded-3xl space-y-6 border-white/5 shadow-sm bg-gradient-to-br from-[#121b2e]/30 to-transparent">
            <div className="space-y-1">
              <p className="text-xs text-primary font-bold uppercase tracking-widest">Evening Reflection</p>
              <h3 className="text-xl font-bold text-on-surface">What are you grateful for today?</h3>
            </div>
            <p className="text-xs text-on-surface-variant">Log your daily gratitude entry before starting your wind-down.</p>
            <Link to="/journal" className="block w-full py-4 rounded-xl bg-primary text-on-primary text-center font-bold hover:opacity-90 active:scale-95 transition-all shadow-md">
              Log Gratitude
            </Link>
            {/* Stage 4 Batch F3: entry point into the evening-wind-down
                Session Engine flow, distinct from the Log Gratitude journal
                feature above. A plain navigation link, no session-engine
                calls here — EveningWindDown.jsx's own Begin button starts
                the session, mirroring how Home never starts the morning
                session either (checkTime() in AlarmContext.jsx does). */}
            <Link to="/evening-wind-down" className="block w-full py-4 rounded-xl glass-panel text-on-surface-variant text-center font-semibold hover:bg-white/10 active:scale-95 transition-all border-white/10">
              Begin Evening Wind-down
            </Link>
          </div>
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
              circadian rhythms are settling. Tomorrow's RISE alarm is set for {alarmTime}. Sleep soundly.
            </p>
          </div>
        </div>
      )}

    </div>
  );
};

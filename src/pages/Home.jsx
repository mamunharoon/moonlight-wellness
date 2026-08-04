/* eslint-disable no-unused-vars */
import { Link } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';

export const Home = () => {
    const { alarmTime, intentions } = useAlarm();

  // Retrieve real completion data from local storage
  const isMorningDone = localStorage.getItem('moonlight_morning_completed_date') === new Date().toDateString();
  const streak = parseInt(localStorage.getItem('moonlight_streak') || '0');

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

  const primaryIntention = intentions[0] || localStorage.getItem('moonlight_today_intention') || 'Stay calm';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
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
            <div className="flex justify-between items-center pt-4 border-t border-white/5 text-xs text-on-surface-variant">
              <span>Current Streak</span>
              <span className="text-secondary font-bold">{streak > 0 ? `${streak} Days` : 'Not started yet'}</span>
            </div>
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

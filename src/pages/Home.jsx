import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAlarm } from '../context/AlarmContext';

export const Home = () => {
  const { isDark, toggleTheme } = useTheme();
  const { alarmTime, intentions } = useAlarm();
  const [timeState, setTimeState] = useState('daytime'); // 'morning-pre', 'morning-post', 'daytime', 'evening', 'night'
  const [isMorningDone, setIsMorningCompleted] = useState(false);

  // Time-of-day detector
  useEffect(() => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) {
      setTimeState(isMorningDone ? 'morning-post' : 'morning-pre');
    } else if (hours >= 12 && hours < 18) {
      setTimeState('daytime');
    } else if (hours >= 18 && hours < 22) {
      setTimeState('evening');
    } else {
      setTimeState('night');
    }
  }, [isMorningDone]);

  // Adjust theme color accents depending on time state
  useEffect(() => {
    const shouldBeDark = ['evening', 'night'].includes(timeState);
    if (shouldBeDark !== isDark) {
      toggleTheme();
    }
  }, [timeState]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. Time State Override Controls (Discreet developer trigger - HIDDEN IN PRODUCTION) */}
      {import.meta.env.DEV && (
        <div className="glass-panel p-2 rounded-xl flex flex-wrap gap-1.5 justify-between text-[10px] text-on-surface-variant/60">
          <span className="font-bold flex items-center px-1">QA Simulator:</span>
          <button onClick={() => { setTimeState('morning-pre'); setIsMorningCompleted(false); }} className={`px-2 py-1 rounded ${timeState === 'morning-pre' ? 'bg-primary/20 text-primary font-bold' : ''}`}>Morning Pre</button>
          <button onClick={() => { setTimeState('morning-post'); setIsMorningCompleted(true); }} className={`px-2 py-1 rounded ${timeState === 'morning-post' ? 'bg-primary/20 text-primary font-bold' : ''}`}>Morning Post</button>
          <button onClick={() => setTimeState('daytime')} className={`px-2 py-1 rounded ${timeState === 'daytime' ? 'bg-primary/20 text-primary font-bold' : ''}`}>Daytime</button>
          <button onClick={() => setTimeState('evening')} className={`px-2 py-1 rounded ${timeState === 'evening' ? 'bg-primary/20 text-primary font-bold' : ''}`}>Evening</button>
          <button onClick={() => setTimeState('night')} className={`px-2 py-1 rounded ${timeState === 'night' ? 'bg-primary/20 text-primary font-bold' : ''}`}>Late Night</button>
        </div>
      )}

      {/* 2. RENDER STATE: MORNING - BEFORE COMPLETION (Uplifting Peach & Cream) */}
      {timeState === 'morning-pre' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Good morning, Sun</h2>
            <p className="text-xs text-on-surface-variant font-medium">Ready for your breath of fresh air today?</p>
          </div>
          <div className="glass-panel p-8 rounded-3xl text-center space-y-6 border-primary/10 shadow-[0_8px_30px_rgba(149,72,53,0.04)] bg-gradient-to-tr from-[#fffdfa] via-[#fff5f2] to-[#ffebd2] text-slate-800">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">
              Morning Awakening
            </span>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold leading-tight text-slate-800">Waking Goal</h3>
              <p className="text-sm text-slate-700 font-medium">Scheduled for {alarmTime} with 'Gentle Breeze'</p>
            </div>
            <Link to="/morning-flow" className="block w-full py-4 rounded-xl bg-primary text-on-primary font-semibold text-center hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary/10">
              Begin Your Morning
            </Link>
          </div>
        </div>
      )}

      {/* 3. RENDER STATE: MORNING - AFTER COMPLETION (Bright Coral Summary) */}
      {timeState === 'morning-post' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Morning Awakening</h2>
            <p className="text-xs text-on-surface-variant font-medium">You started today with intention.</p>
          </div>
          <div className="glass-panel p-6 rounded-3xl space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Today's Intention</p>
            <p className="text-lg italic font-medium">"{intentions.join(', ') || 'Reduce Anxiety'}"</p>
            <div className="flex justify-between items-center pt-4 border-t border-white/5 text-xs text-on-surface-variant">
              <span>Current Streak</span>
              <span className="text-secondary font-bold">12 Days</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. RENDER STATE: DAYTIME (Clean, Minimalist Blue/Grey) */}
      {timeState === 'daytime' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Stay Centered</h2>
            <p className="text-xs text-on-surface-variant font-medium">One small step at a time.</p>
          </div>
          <div className="glass-panel p-6 rounded-3xl space-y-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] bg-gradient-to-br from-[#ffffff] to-[#f4f7f9]">
            <div className="space-y-2">
              <p className="text-xs text-primary font-bold uppercase tracking-wider">Active Intention</p>
              <p className="text-lg font-bold text-slate-800">"{intentions.join(', ') || 'Reduce Anxiety'}"</p>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">Take a gentle 60-second breathing break to center your focus and reduce anxiety.</p>
            <Link to="/breathe" className="block w-full py-3 rounded-xl bg-primary text-on-primary text-center font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md">
              60-Second Reset
            </Link>
          </div>
        </div>
      )}

      {/* 5. RENDER STATE: EVENING (Calm, Restorative Moonlit Navy) */}
      {timeState === 'evening' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-[#ffc5b7] tracking-tight">Begin Wind-Down</h2>
            <p className="text-xs text-on-surface-variant font-medium">You've done enough for today. Let's prepare for tomorrow.</p>
          </div>
          <div className="glass-panel p-6 rounded-3xl space-y-6 border-[#ff9d85]/10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] bg-gradient-to-br from-[#121b2e] to-[#0a101f]">
            <div className="space-y-1">
              <p className="text-xs text-primary-container font-bold uppercase tracking-widest">Evening Reflection</p>
              <h3 className="text-xl font-bold text-[#ffc5b7]">What are you grateful for today?</h3>
            </div>
            <p className="text-xs text-on-surface-variant">Log your daily gratitude entry before starting your soundscape.</p>
            <Link to="/journal" className="block w-full py-4 rounded-xl bg-[#ff9d85] text-[#783221] text-center font-bold hover:opacity-90 active:scale-95 transition-all shadow-md">
              Log Gratitude
            </Link>
          </div>
        </div>
      )}

      {/* 6. RENDER STATE: LATE NIGHT (Deep Rest) */}
      {timeState === 'night' && (
        <div className="space-y-8 text-center py-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary text-3xl">dark_mode</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Rest Well</h2>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              circadian rhythms are settling. Tomorrow's RISE alarm is set for {alarmTime}. Sleep soundly.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

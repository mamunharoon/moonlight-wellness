import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';

export const SessionComplete = () => {
  const navigate = useNavigate();
  const { intentions, setJourneyStep } = useAlarm();

  const handleReturnHome = () => {
    setJourneyStep('');
    navigate('/');
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-xl mx-auto space-y-10 select-none">
      
      {/* Circular Progress Gauge */}
      <div className="relative w-48 h-48 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" fill="transparent" r="44" stroke="rgba(255,255,255,0.05)" strokeWidth="4"></circle>
          <circle cx="50" cy="50" fill="transparent" r="44" stroke="var(--color-primary)" strokeDasharray="276.46" strokeDashoffset="0" strokeLinecap="round" strokeWidth="5"></circle>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-primary text-2xl">check_circle</span>
          <span className="text-3xl font-extrabold text-on-surface mt-1">100%</span>
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Complete</span>
        </div>
      </div>

      {/* Centered Message */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold text-white tracking-tight">Session Finished</h2>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          You've centered yourself beautifully. Take this moment of clarity with you as you move forward.
        </p>
      </div>

      {/* Rewards Row */}
      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="glass-panel p-5 rounded-2xl text-center space-y-1">
          <span className="material-symbols-outlined text-primary text-2xl">auto_awesome</span>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">Vibe Points</p>
          <p className="text-2xl font-extrabold text-primary">+450</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl text-center space-y-1">
          <span className="material-symbols-outlined text-secondary text-2xl">local_fire_department</span>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">Daily Streak</p>
          <p className="text-2xl font-extrabold text-secondary">12 Days</p>
        </div>
      </div>

      {/* Summary card */}
      <div className="glass-panel p-4 rounded-2xl text-left text-xs text-on-surface-variant w-full max-w-sm mx-auto space-y-1">
        <span className="font-semibold uppercase text-primary">Your Morning Intention</span>
        <p className="text-white font-medium italic">"{intentions.join(', ') || 'Reduce Anxiety'}"</p>
      </div>

      <div className="space-y-3 w-full">
        <button 
          onClick={handleReturnHome}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
        >
          <span>Continue to Today</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};



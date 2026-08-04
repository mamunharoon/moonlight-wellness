import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';

export const SessionComplete = () => {
  const navigate = useNavigate();
  const { intentions, setJourneyStep } = useAlarm();

  const handleReturnHome = () => {
    localStorage.setItem('moonlight_morning_completed_date', new Date().toDateString());
    setJourneyStep('');
    navigate('/');
  };

  const primaryIntention = intentions[0] || localStorage.getItem('moonlight_today_intention') || 'Stay calm';

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-md mx-auto space-y-10 select-none">
      
      {/* Circular Gauge */}
      <div className="relative w-40 h-40 mx-auto flex items-center justify-center mt-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" fill="transparent" r="44" stroke="rgba(255,255,255,0.05)" strokeWidth="4"></circle>
          <circle cx="50" cy="50" fill="transparent" r="44" stroke="var(--color-primary)" strokeDasharray="276.46" strokeDashoffset="0" strokeLinecap="round" strokeWidth="5"></circle>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-primary text-2xl font-bold">check_circle</span>
          <span className="text-3xl font-extrabold text-on-surface mt-0.5">100%</span>
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Complete</span>
        </div>
      </div>

      {/* Text Success Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-extrabold text-on-surface leading-tight">You started today with intention.</h2>
        <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          "Carry this feeling into your day." One small step at a time.
        </p>
      </div>

      {/* Summary card */}
      <div className="glass-panel p-5 rounded-2xl text-left text-xs text-on-surface-variant w-full max-w-sm mx-auto space-y-2 shadow-sm">
        <span className="font-semibold uppercase text-primary">Your Morning Intention</span>
        <p className="text-on-surface font-medium italic">"{primaryIntention}"</p>
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



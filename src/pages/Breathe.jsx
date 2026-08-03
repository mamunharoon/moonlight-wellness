import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { ProgressIndicator } from '../components/ProgressIndicator';

export const Breathe = () => {
  const navigate = useNavigate();
  const { setJourneyStep } = useAlarm();
  const [breatheState, setBreatheState] = useState('Inhale'); // 'Inhale', 'Hold', 'Exhale'
  const [secondsLeft, setSecondsLeft] = useState(56);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    if (secondsLeft <= 0) {
      setJourneyStep('intention');
      navigate('/intention-setup');
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, isPaused, navigate, setJourneyStep]);

  useEffect(() => {
    if (isPaused || secondsLeft <= 0) return;

    const cycleTime = (56 - secondsLeft) % 14;

    if (cycleTime < 4) {
      setBreatheState('Inhale');
    } else if (cycleTime < 8) {
      setBreatheState('Hold');
    } else {
      setBreatheState('Exhale');
    }
  }, [secondsLeft, isPaused]);

  const handleComplete = () => {
    setJourneyStep('intention');
    navigate('/intention-setup');
  };

  const handleSkip = () => {
    setJourneyStep('intention');
    navigate('/intention-setup');
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-xl mx-auto space-y-10 select-none">
      <ProgressIndicator activeStep="breathe" />

      <div className="text-center space-y-2">
        <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">Grounding Exercise</span>
        <h2 className="text-2xl font-bold text-on-surface">Center Yourself</h2>
        <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          Take a deep breath. Let the world fade away for just a minute.
        </p>
      </div>

      <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
        <div className={`absolute inset-0 rounded-full bg-primary/10 blur-3xl transition-all duration-[4000ms] ${
          breatheState === 'Inhale' ? 'scale-125 opacity-100' : 'scale-95 opacity-50'
        }`}></div>

        <div className="absolute inset-0 border-2 border-white/5 rounded-full"></div>

        <div className={`rounded-full bg-gradient-to-br from-[#954835] to-[#ff9d85] flex flex-col items-center justify-center shadow-xl shadow-primary/10 text-white transition-all duration-[4000ms] ease-in-out ${
          breatheState === 'Inhale' ? 'w-48 h-48' : breatheState === 'Hold' ? 'w-48 h-48 brightness-110' : 'w-36 h-36'
        }`}>
          <span className="text-lg font-bold tracking-wider uppercase">{breatheState}</span>
          <span className="text-xs text-white/60 mt-1 font-semibold">{secondsLeft}s left</span>
        </div>
      </div>

      <div className="text-center space-y-2">
        <span className="text-[10px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-on-surface-variant/80 font-bold uppercase tracking-wider">
          Deep Belly Breath (4-4-6)
        </span>
      </div>

      <div className="space-y-3 w-full">
        <div className="flex gap-3">
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className="flex-1 py-4 glass-panel text-on-surface rounded-full font-bold flex items-center justify-center gap-2 border-white/10"
          >
            <span className="material-symbols-outlined text-sm">{isPaused ? 'play_arrow' : 'pause'}</span>
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
          <button 
            onClick={handleComplete}
            className="flex-1 bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            <span>Continue</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
        <button 
          onClick={handleSkip}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
        >
          Skip Breathing
        </button>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { ProgressIndicator } from '../components/ProgressIndicator';

export const MorningFlow = () => {
  const navigate = useNavigate();
  const { setJourneyStep, routineDuration } = useAlarm();
  const [activeStep, setActiveStep] = useState(0);

  const getStepDuration = () => {
    if (routineDuration === 'extended') return 45;
    return 15;
  };

  const [timeLeft, setTimeLeft] = useState(getStepDuration());

  const steps = [
    { title: 'Reach to the Sky', desc: 'Extend your arms high and breathe deep.', icon: 'wb_sunny' },
    { title: 'Neck Rolls', desc: 'Gently roll your head in a slow circle.', icon: 'autorenew' },
    { title: 'Shoulder Shrugs', desc: 'Lift your shoulders to your ears and release.', icon: 'spa' }
  ];

  useEffect(() => {
    const stepDur = routineDuration === 'extended' ? 45 : 15;

    if (timeLeft <= 0) {
      if (activeStep < steps.length - 1) {
        setActiveStep(prev => prev + 1);
        setTimeLeft(stepDur);
      } else {
        setJourneyStep('breathe');
        navigate('/breathe');
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, activeStep, navigate, setJourneyStep, steps.length, routineDuration]);

  const handleNextStep = () => {
    const stepDur = routineDuration === 'extended' ? 45 : 15;
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
      setTimeLeft(stepDur);
    } else {
      setJourneyStep('breathe');
      navigate('/breathe');
    }
  };

  const handleSkip = () => {
    setJourneyStep('breathe');
    navigate('/breathe');
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-xl mx-auto space-y-8 select-none">
      <ProgressIndicator activeStep="stretch" />

      <div className="text-center space-y-2">
        <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">Morning Awakening</span>
        <h2 className="text-2xl font-bold text-on-surface">Light Morning Stretching</h2>
        <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
          Wake up your body with 2 minutes of gentle movement.
        </p>
      </div>

      <div className="glass-panel p-5 rounded-2xl space-y-3 shadow-sm">
        <div className="flex justify-between text-xs font-semibold text-on-surface-variant">
          <span>Overall Progress</span>
          <span>Exercise {activeStep + 1} of {steps.length}</span>
        </div>
        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-1000" 
            style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((step, idx) => {
          const isCompleted = idx < activeStep;
          const isActive = idx === activeStep;

          return (
            <div 
              key={idx}
              className={`glass-panel p-5 rounded-2xl flex items-center justify-between border transition-all duration-300 ${
                isActive ? 'border-primary/30 opacity-100 shadow-md shadow-primary/5 bg-primary/5' : isCompleted ? 'opacity-50 border-transparent' : 'opacity-30 border-transparent'
              }`}
            >
              <div className="flex gap-4 items-center">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isActive ? 'bg-primary/25 text-primary' : 'bg-white/5 text-on-surface-variant'
                }`}>
                  <span className="material-symbols-outlined text-2xl">{step.icon}</span>
                </div>
                <div>
                  <h4 className="font-label-md text-sm text-on-surface font-bold flex items-center gap-2">
                    {step.title}
                    {isCompleted && <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>}
                  </h4>
                  <p className="text-xs text-on-surface-variant mt-1">{step.desc}</p>
                </div>
              </div>

              {isActive && (
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold text-primary">0:{timeLeft.toString().padStart(2, '0')}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase font-semibold">Remaining</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-3 w-full">
        <button 
          onClick={handleNextStep}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          <span>{activeStep === steps.length - 1 ? 'Continue' : 'Next Step'}</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button 
          onClick={handleSkip}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
        >
          Skip Stretching
        </button>
      </div>
    </div>
  );
};

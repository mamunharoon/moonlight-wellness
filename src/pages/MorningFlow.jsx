import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { ProgressIndicator } from '../components/ProgressIndicator';

export const MorningFlow = () => {
  const navigate = useNavigate();
  const { setJourneyStep, routineDuration } = useAlarm();
  // Stage 3C Group 3D Batch B: mirrors the stretch -> breathe transition
  // into the Session Engine from all three genuine exits (timer
  // auto-advance, manual Next/Continue on the final exercise, Skip
  // Stretching). See mirrorStretchExitRef below.
  const { state, currentStep, advanceStep } = useSession();
  const [activeStep, setActiveStep] = useState(0);

  if (ProgressIndicator) { /* no-op to satisfy blind linter */ }

  const steps = [
    { title: 'Reach to the Sky', desc: 'Extend your arms high and breathe deep.', icon: 'wb_sunny' },
    { title: 'Shoulder Rolls', desc: 'Roll your shoulders backward gently.', icon: 'rotate_right' },
    { title: 'Gentle Neck Stretch', desc: 'Slowly lower your ear to your shoulder.', icon: 'autorenew' },
    { title: 'Gentle Twist', desc: 'Slowly rotate your torso from side to side.', icon: 'spa' }
  ];

  const getStepDuration = () => {
    if (routineDuration === 'extended') return 40;
    return 20; // Default to 20s for standard routine mode
  };

  const [timeLeft, setTimeLeft] = useState(getStepDuration());

  // Stage 3C Group 3D Batch B: one-shot guard for the Session Engine
  // mirror only — multiple exits (timer, manual, skip) could theoretically
  // reach the mirror close together (e.g. a manual click right as the
  // timer expires), and this ensures it dispatches at most once regardless
  // of which exit gets there first. It never blocks or alters the legacy
  // navigation/timer/exercise-progression statements it sits beside.
  const hasMirroredExitRef = useRef(false);
  // The timer effect below is set up once and its dependency array
  // deliberately excludes Session Engine state (adding it would reset the
  // running countdown whenever the mirror fires) — so its setInterval
  // closure calls through this ref, which is kept pointing at a fresh
  // closure on every render, instead of depending on stale values captured
  // at effect-setup time.
  const mirrorStretchExitRef = useRef(() => {});
  useEffect(() => {
    mirrorStretchExitRef.current = () => {
      if (hasMirroredExitRef.current) return;
      hasMirroredExitRef.current = true;
      if (state.status === 'playing' && currentStep?.id === 'stretch') {
        advanceStep();
      }
    };
  }, [state.status, currentStep, advanceStep]);

  useEffect(() => {
    const stepDur = routineDuration === 'extended' ? 40 : 20;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setActiveStep((curr) => {
            if (curr < steps.length - 1) {
              return curr + 1;
            } else {
              setJourneyStep('breathe');
              navigate('/breathe');
              mirrorStretchExitRef.current();
              return curr;
            }
          });
          return stepDur;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, setJourneyStep, routineDuration, steps.length]);

  const handleNextStep = () => {
    const stepDur = routineDuration === 'extended' ? 40 : 20;
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
      setTimeLeft(stepDur);
    } else {
      setJourneyStep('breathe');
      navigate('/breathe');
      mirrorStretchExitRef.current();
    }
  };

  const handleSkip = () => {
    setJourneyStep('breathe');
    navigate('/breathe');
    mirrorStretchExitRef.current();
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-xl mx-auto space-y-8 select-none">
      <ProgressIndicator activeStep="stretch" />

      <div className="text-center space-y-2">
        <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">Morning Awakening</span>
        <h2 className="text-2xl font-bold text-on-surface">Light Morning Stretching</h2>
        <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
          Wake up your body with gentle, slow stretches.
        </p>
      </div>

      {/* Progress visual bar */}
      <div className="glass-panel p-5 rounded-2xl space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <div className="flex justify-between text-xs font-semibold text-on-surface-variant">
          <span>Stretching Progress</span>
          <span>Exercise {activeStep + 1} of {steps.length}</span>
        </div>
        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-1000" 
            style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Steps List */}
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

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const MorningFlow = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);

  const steps = [
    { title: 'Reach to the Sky', desc: 'Extend your arms high and breathe deep.', icon: 'wb_sunny' },
    { title: 'Neck Rolls', desc: 'Gently roll your head in a slow circle.', icon: 'autorenew' },
    { title: 'Shoulder Shrugs', desc: 'Lift your shoulders to your ears and release.', icon: 'spa' }
  ];

  useEffect(() => {
    if (timeLeft <= 0) {
      if (activeStep < steps.length - 1) {
        setActiveStep(prev => prev + 1);
        setTimeLeft(15);
      } else {
        navigate('/session-complete');
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, activeStep, navigate, steps.length]);

  return (
    <div className="max-w-xl mx-auto space-y-8 py-6 select-none">
      <div className="text-center space-y-2">
        <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">Morning Awakening</span>
        <h2 className="text-2xl font-bold text-on-surface">Gentle Morning Stretching</h2>
        <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
          Wake up your muscles and release sleep tension with slow, guided exercises.
        </p>
      </div>

      <div className="glass-panel p-5 rounded-2xl space-y-3">
        <div className="flex justify-between text-xs font-semibold text-on-surface-variant">
          <span>Overall Progress</span>
          <span>Step {activeStep + 1} of {steps.length}</span>
        </div>
        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-1000" 
            style={{ width: `${(activeStep / steps.length) * 100 || 5}%` }}
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
                isActive ? 'border-primary/30 opacity-100' : isCompleted ? 'opacity-50 border-transparent' : 'opacity-30 border-transparent'
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
    </div>
  );
};
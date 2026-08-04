import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';

export const Onboarding = () => {
  const navigate = useNavigate();
  const { intentions, setIntentions, updateRhythm } = useAlarm();
  const [step, setStep] = useState(1);
  const [localAlarm, setLocalAlarm] = useState('07:30');
  const [localBed, setLocalBed] = useState('22:00');

  const intentOptions = [
    { id: 'Anxiety', label: 'Reduce Anxiety', desc: 'Calm your nervous system with rhythmic patterns.', icon: 'air' },
    { id: 'Focus', label: 'Deep Focus', desc: 'Sharpen your mind with clarity-driven flows.', icon: 'track_changes' },
    { id: 'Sleep', label: 'Better Sleep', desc: 'Drift away with gentle nature soundscapes.', icon: 'bedtime' }
  ];

  const handleToggleIntention = (id) => {
    if (intentions.includes(id)) {
      setIntentions(intentions.filter(item => item !== id));
    } else {
      setIntentions([...intentions, id]);
    }
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      updateRhythm(localAlarm, localBed);
      navigate('/');
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-6 max-w-xl mx-auto space-y-10">
      
      <section className="text-center space-y-2 w-full">
        <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">Personalizing Your Journey</span>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(step / 4) * 100}%` }}></div>
        </div>
      </section>

      {step === 1 && (
        <div className="space-y-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-4xl">spa</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">Welcome to Moonlight</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed px-4">
            Align your daily rituals with the natural flow of time. From the softest dawn to the deepest midnight, we guide you through a seamless cycle of rejuvenation.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 w-full">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold text-white">Set Your Intentions</h2>
            <p className="text-xs text-on-surface-variant">We'll personalize your breathing and soundscapes based on these.</p>
          </div>
          <div className="space-y-3">
            {intentOptions.map((opt) => {
              const isSelected = intentions.includes(opt.id);
              return (
                <div 
                  key={opt.id}
                  onClick={() => handleToggleIntention(opt.id)}
                  className={`glass-panel p-4 rounded-2xl flex items-center justify-between border cursor-pointer transition-all duration-300 ${
                    isSelected ? 'border-primary bg-primary/10' : 'border-transparent'
                  }`}
                >
                  <div className="flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-on-surface-variant">
                      <span className="material-symbols-outlined">{opt.icon}</span>
                    </div>
                    <div>
                      <h4 className="font-label-md text-sm text-on-surface font-bold">{opt.label}</h4>
                      <p className="text-xs text-on-surface-variant">{opt.desc}</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-primary bg-primary text-white' : 'border-white/20'
                  }`}>
                    {isSelected && <span className="material-symbols-outlined text-[12px] font-bold">check</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 w-full">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold text-white">Sync with Your Nature</h2>
            <p className="text-xs text-on-surface-variant">Setting your schedule enables automatically adjusted lighting and soundscapes.</p>
          </div>

          <div className="space-y-4">
            <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
              <div className="flex gap-4 items-center">
                <span className="material-symbols-outlined text-primary text-3xl">wb_twilight</span>
                <div>
                  <h4 className="font-label-md text-sm text-on-surface font-bold">Morning Rise</h4>
                  <p className="text-[10px] text-on-surface-variant font-semibold">Wake-up alarm clock</p>
                </div>
              </div>
              <input 
                type="time" 
                value={localAlarm}
                onChange={(e) => setLocalAlarm(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl p-2 text-sm text-white focus:ring-1 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>

            <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
              <div className="flex gap-4 items-center">
                <span className="material-symbols-outlined text-secondary text-3xl">bedtime</span>
                <div>
                  <h4 className="font-label-md text-sm text-on-surface font-bold">Night Rest</h4>
                  <p className="text-[10px] text-on-surface-variant font-semibold">Target bedtime goal</p>
                </div>
              </div>
              <input 
                type="time" 
                value={localBed}
                onChange={(e) => setLocalBed(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl p-2 text-sm text-white focus:ring-1 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 w-full text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20">
            <span className="material-symbols-outlined text-4xl">done</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white">Your Journey Begins</h2>
            <p className="text-sm text-on-surface-variant">Everything is ready for your transformation.</p>
          </div>
          <div className="glass-panel p-5 rounded-2xl space-y-3 text-left max-w-sm mx-auto">
            <div className="flex items-center gap-3 text-xs text-on-surface">
              <span className="material-symbols-outlined text-primary text-sm">alarm</span>
              <span>First Wake-up scheduled for {localAlarm}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-on-surface">
              <span className="material-symbols-outlined text-secondary text-sm">spa</span>
              <span>2-minute guided Morning Stretching set</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-on-surface">
              <span className="material-symbols-outlined text-tertiary text-sm">edit_note</span>
              <span>Mindset intention tracking enabled</span>
            </div>
          </div>
        </div>
      )}

      <button 
        onClick={handleNext}
        className="w-full bg-primary text-on-primary py-4 rounded-full font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
      >
        <span>{step === 4 ? 'Start My First Morning' : 'Continue'}</span>
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </button>

    </div>
  );
};

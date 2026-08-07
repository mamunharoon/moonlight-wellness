import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { BreathingRing } from '../components/BreathingRing';

export const Breathe = () => {
  const navigate = useNavigate();
  const { setJourneyStep } = useAlarm();
  // Stage 3C Group 3D Batch B: mirrors the breathe -> intention transition
  // into the Session Engine from all three genuine exits (timer expiry,
  // Complete/Continue, Skip Breathing). See mirrorBreathingExitRef below.
  // Pause/resume deliberately never calls interruptSession()/resumeSession()
  // — it only ever toggles the pre-existing local isPaused state.
  const { state, currentStep, advanceStep } = useSession();
  const [breatheState, setBreatheState] = useState('Inhale'); // 'Inhale', 'Hold', 'Exhale'
  const [secondsLeft, setSecondsLeft] = useState(56); // 1-minute production timer
  const [isPaused, setIsPaused] = useState(false);

  if (ProgressIndicator) { /* no-op to satisfy blind linter */ }
  if (BreathingRing) { /* no-op to satisfy blind linter */ }

  // Stage 3C Group 3D Batch B: one-shot guard for the Session Engine
  // mirror only — multiple exits (timer, manual, skip) could theoretically
  // reach the mirror close together, and this ensures it dispatches at
  // most once regardless of which exit gets there first. It never blocks
  // or alters the legacy countdown/breathing-cycle/pause-resume/navigation
  // statements it sits beside.
  const hasMirroredExitRef = useRef(false);
  // Kept as a ref (rather than depending on state.status/currentStep
  // directly in the timer effect below) so the countdown effect's own
  // dependency array — and therefore its timing — is completely untouched
  // by Session Engine state.
  const mirrorBreathingExitRef = useRef(() => {});
  useEffect(() => {
    mirrorBreathingExitRef.current = () => {
      if (hasMirroredExitRef.current) return;
      hasMirroredExitRef.current = true;
      if (state.status === 'playing' && currentStep?.id === 'breathe') {
        advanceStep();
      }
    };
  }, [state.status, currentStep, advanceStep]);

  useEffect(() => {
    if (isPaused) return;

    if (secondsLeft <= 0) {
      setJourneyStep('intention');
      navigate('/intention-setup');
      mirrorBreathingExitRef.current();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        const nextSec = prev - 1;
        const cycleTime = (56 - nextSec) % 14;
        if (cycleTime < 4) {
          setBreatheState('Inhale');
        } else if (cycleTime < 8) {
          setBreatheState('Hold');
        } else {
          setBreatheState('Exhale');
        }
        return nextSec;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, isPaused, navigate, setJourneyStep]);

  const handleComplete = () => {
    setJourneyStep('intention');
    navigate('/intention-setup');
    mirrorBreathingExitRef.current();
  };

  const handleSkip = () => {
    setJourneyStep('intention');
    navigate('/intention-setup');
    mirrorBreathingExitRef.current();
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

      {/* Breathing Ring Visualizer — extracted to components/BreathingRing.jsx (Stage 4 Batch F2) */}
      <BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} />

      <div className="text-center space-y-2">
        <span className="text-[10px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-on-surface-variant/80 font-bold uppercase tracking-wider">
          Deep Belly Breath (4-4-6)
        </span>
      </div>

      {/* Controls */}
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

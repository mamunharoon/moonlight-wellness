import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { BreathingRing } from '../components/BreathingRing';
import { ProgressIndicator } from '../components/ProgressIndicator';

/*
 * Stage 4 Batch F6 — EveningBreathing
 *
 * Fourth step of the evening-wind-down session. Reuses BreathingRing
 * (F2) as-is — the visual is unchanged; only the timing driving it
 * changes. "A calmer evening rhythm than the morning flow" is
 * implemented as a slower cadence, not a different look: a 4-7-8 cycle
 * (inhale 4s, hold 7s, exhale 8s = 19s, a well-known slow/calming
 * breathing pattern) over 4 full cycles (76s total), versus
 * Breathe.jsx's 4-4-6/14s cycle over 56s. Same mirrorBreathingExitRef
 * one-shot-guard pattern as Breathe.jsx, targeting the 'breathing' step
 * and advanceStep() (immediately adjacent to 'sleepPreparation').
 *
 * "One clear action only": no Pause control (Breathe.jsx has one; this
 * screen deliberately doesn't, to keep visual/interactive stimulation
 * low). Continue and Skip both call the same handleAdvance — identical
 * behaviour, exactly like Breathe.jsx's own handleComplete/handleSkip —
 * Skip exists as its own labelled, de-emphasised affordance per this
 * batch's explicit "Support Skip" requirement, not as a second distinct
 * path.
 */
const CYCLE_SECONDS = 19;
const TOTAL_SECONDS = 76;

export const EveningBreathing = () => {
  const navigate = useNavigate();
  const { state, currentStep, advanceStep } = useSession();
  const [breatheState, setBreatheState] = useState('Inhale');
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);

  if (EveningSceneShell && BreathingRing && ProgressIndicator) { /* no-op to satisfy blind linter */ }

  const hasMirroredExitRef = useRef(false);
  const mirrorExitRef = useRef(() => {});
  useEffect(() => {
    mirrorExitRef.current = () => {
      if (hasMirroredExitRef.current) return;
      hasMirroredExitRef.current = true;
      if (state.status === 'playing' && currentStep?.id === 'breathing') {
        advanceStep();
      }
    };
  }, [state.status, currentStep, advanceStep]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      navigate('/prepare-for-rest');
      mirrorExitRef.current();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        const nextSec = prev - 1;
        const cycleTime = (TOTAL_SECONDS - nextSec) % CYCLE_SECONDS;
        if (cycleTime < 4) {
          setBreatheState('Inhale');
        } else if (cycleTime < 11) {
          setBreatheState('Hold');
        } else {
          setBreatheState('Exhale');
        }
        return nextSec;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, navigate]);

  const handleAdvance = () => {
    navigate('/prepare-for-rest');
    mirrorExitRef.current();
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }}>
      <ProgressIndicator activeStep="breathing" sessionId="evening-wind-down" />

      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
        <div className="space-y-2">
          <h1 className="font-serif italic text-2xl text-on-surface">Breathe with the night.</h1>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
            Slow, easy breaths. There is nowhere else to be.
          </p>
        </div>

        <BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} />
      </div>

      <div className="space-y-3 w-full">
        <button
          onClick={handleAdvance}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          <span>Continue</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button
          onClick={handleAdvance}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
        >
          Skip
        </button>
      </div>
    </EveningSceneShell>
  );
};

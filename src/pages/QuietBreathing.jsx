import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { BreathingRing } from '../components/BreathingRing';

/*
 * Solas — Support & Calm, Sprint 1 Phase 2: Quiet Breathing
 *
 * Reuses BreathingRing (src/components/BreathingRing.jsx) exactly as
 * EveningBreathing.jsx does — same component, no visual changes — only
 * the cadence differs: inhale 4 / hold 4 / exhale 8 (16s/cycle) per this
 * batch's spec, gentler than both Breathe.jsx's 4-4-6 morning cycle and
 * EveningBreathing.jsx's 4-7-8 evening cycle. No ProgressIndicator, no
 * session copy beyond one short line — "keep visual stimulation
 * extremely low" means the ring is the only thing to look at.
 *
 * No Session Engine (no useSession/advanceStep) and no audio, matching
 * every other Support & Calm page and this batch's explicit exclusions.
 * Continue and Skip both go straight to /support-complete, exactly like
 * EveningBreathing's own Continue/Skip pairing; the timer additionally
 * auto-advances after a fixed number of cycles so the screen never runs
 * forever with no way to know it's "done" if the user takes no action.
 */
const CYCLE_SECONDS = 16; // 4 inhale + 4 hold + 8 exhale
const TOTAL_CYCLES = 4;
const TOTAL_SECONDS = CYCLE_SECONDS * TOTAL_CYCLES;

export const QuietBreathing = () => {
  const navigate = useNavigate();
  const [breatheState, setBreatheState] = useState('Inhale');
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);

  if (EveningSceneShell && BreathingRing) { /* no-op to satisfy blind linter */ }

  useEffect(() => {
    if (secondsLeft <= 0) {
      navigate('/support-complete');
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        const nextSec = prev - 1;
        const cycleTime = (TOTAL_SECONDS - nextSec) % CYCLE_SECONDS;
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
  }, [secondsLeft, navigate]);

  const handleAdvance = () => {
    navigate('/support-complete');
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }}>
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          Just breathe. There is nowhere else to be.
        </p>

        <BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} />
      </div>

      <div className="space-y-3 w-full">
        <button
          onClick={handleAdvance}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          <span>Continue</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button
          onClick={handleAdvance}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Skip
        </button>
      </div>
    </EveningSceneShell>
  );
};

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { BreathingRing } from '../components/BreathingRing';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { InteractiveAmbientMusic } from '../components/InteractiveAmbientMusic';
import { MusicEntryChoice } from '../components/MusicEntryChoice';
import { isFeatureEnabled } from '../lib/featureFlags';
import { isInteractiveMusicEligible } from '../lib/backgroundMusicSelection';
import { getBetaVideoById } from '../lib/mediaCatalog';

// Background Music — reserved id for the shared interactive-breathing
// ambient loop (see docs/background-music-asset-manifest.md). Not yet
// registered in betaVideoManifest.js/the Edge Function's EXERCISE_PATHS
// map, so InteractiveAmbientMusic renders nothing until it is - see
// isInteractiveMusicEligible's own doc comment.
const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';

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
  // Entry choice, asked once per visit before the countdown starts at all
  // (see MusicEntryChoice's own doc comment). Distinct from musicEnabled
  // itself, which InteractiveAmbientMusic owns internally.
  const [musicChoiceMade, setMusicChoiceMade] = useState(false);
  const musicPlayerRef = useRef(null);
  const musicEligible = isInteractiveMusicEligible({
    musicVariantId: INTERACTIVE_BREATHING_MUSIC_ID,
    featureEnabled: isFeatureEnabled('backgroundMusic'),
    getEntryById: getBetaVideoById
  });
  // Only actually blocks anything when there's a real choice to make -
  // a screen with no eligible music (flag off / no asset) behaves exactly
  // as before this feature existed: the timer starts immediately.
  const awaitingMusicChoice = musicEligible && !musicChoiceMade;
  const handleStartWithMusic = () => {
    setMusicChoiceMade(true);
    musicPlayerRef.current?.start();
  };
  const handleContinueWithoutMusic = () => {
    setMusicChoiceMade(true);
  };

  if (EveningSceneShell && BreathingRing && ProgressIndicator && InteractiveAmbientMusic && MusicEntryChoice) { /* no-op to satisfy blind linter */ }

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
    if (awaitingMusicChoice) return;

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
  }, [secondsLeft, navigate, awaitingMusicChoice]);

  const handleAdvance = () => {
    navigate('/prepare-for-rest');
    mirrorExitRef.current();
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/gratitude">
      <ProgressIndicator activeStep="breathing" sessionId="evening-wind-down" />
      <span className="block text-center text-[10px] text-primary uppercase font-bold tracking-wider">Step 4 of 6</span>

      {awaitingMusicChoice && (
        <MusicEntryChoice onStartWithMusic={handleStartWithMusic} onContinueWithoutMusic={handleContinueWithoutMusic} />
      )}

      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
        <div className="space-y-2">
          <h1 className="font-serif italic text-2xl text-on-surface">Breathe with the night.</h1>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
            Slow, easy breaths. There is nowhere else to be.
          </p>
        </div>

        <BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} />
      </div>

      <InteractiveAmbientMusic ref={musicPlayerRef} musicVariantId={INTERACTIVE_BREATHING_MUSIC_ID} />

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
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/40"
        >
          Skip
        </button>
      </div>
    </EveningSceneShell>
  );
};

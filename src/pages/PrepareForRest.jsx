import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { useAuth } from '../context/AuthContext';
import { fetchOwnBetaAccess } from '../lib/betaAccess';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { BetaVideoModal } from '../components/BetaVideoModal';

const NIGHT_TIME_VIDEO = getBetaVideoById('E05');

/*
 * Stage 4 Batch F6 — PrepareForRest
 *
 * Fifth (terminal-before-completion) step of the evening-wind-down
 * session. "Prepare for Rest" — deliberately not a clinical label like
 * "Sleep Hygiene Checklist". REST_ITEMS below are static, presentational
 * only: no local state, no persistence, no database write, no
 * gamification, per this batch's explicit requirements — there is
 * nothing to check off, only four short lines to read.
 *
 * advanceStep() is guarded exactly like every other Session-Engine-
 * consuming page in this codebase — see Reflection.jsx's own doc comment
 * for the full reasoning. sleepPreparation -> completion is immediately
 * adjacent, so advanceStep() (not advanceToStep) is correct here.
 *
 * Beta Video Integration: one additional, beta-gated row below
 * REST_ITEMS offers E05 (Night-time Calm) — still nothing to check off,
 * REST_ITEMS itself is untouched, and Continue/advanceStep() below are
 * completely unaffected by whether the video row is shown or watched.
 * This is the closing step of the routine, right before Completion —
 * the natural place for a night-time calming video, without displacing
 * Gratitude.jsx (an earlier, distinct step) or Reflection.jsx.
 */
const REST_ITEMS = [
  { icon: 'smartphone', text: 'Put your phone down soon.' },
  { icon: 'water_drop', text: 'Have a little water.' },
  { icon: 'lightbulb', text: 'Dim the room.' },
  { icon: 'nights_stay', text: 'Let the day finish.' },
];

export const PrepareForRest = () => {
  const navigate = useNavigate();
  const { state, currentStep, advanceStep } = useSession();
  const { user, isGuest, loading: authLoading } = useAuth();
  const [betaAccess, setBetaAccess] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  if (EveningSceneShell && ProgressIndicator && BetaVideoModal) { /* no-op to satisfy blind linter */ }

  // Same inline fetchOwnBetaAccess check as Beta.jsx/Support.jsx.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (authLoading) return;
      if (isGuest) {
        setBetaAccess(false);
        return;
      }
      const value = await fetchOwnBetaAccess(user.id);
      if (!cancelled) setBetaAccess(value);
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [user, isGuest, authLoading]);

  const handleContinue = () => {
    if (state.status === 'playing' && currentStep?.id === 'sleepPreparation') {
      advanceStep();
    }
    navigate('/evening-complete');
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }}>
      <ProgressIndicator activeStep="sleepPreparation" sessionId="evening-wind-down" />

      <div className="flex-1 flex flex-col justify-center space-y-8">
        <h1 className="font-serif italic text-3xl text-on-surface text-center">Prepare for Rest</h1>

        <div className="space-y-4">
          {REST_ITEMS.map((item) => (
            <div key={item.text} className="flex items-center gap-4 glass-panel rounded-2xl p-4">
              <span className="material-symbols-outlined text-primary text-2xl">{item.icon}</span>
              <p className="text-sm text-on-surface">{item.text}</p>
            </div>
          ))}

          {betaAccess && NIGHT_TIME_VIDEO && (
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="w-full flex items-center gap-4 glass-panel rounded-2xl p-4 hover:bg-white/5 active:scale-[0.99] transition-all text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            >
              <span className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-xl">play_circle</span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-on-surface">Watch: {NIGHT_TIME_VIDEO.title}</span>
                <span className="block text-xs text-on-surface-variant">A short guided video to ease toward sleep.</span>
              </span>
              <span className="material-symbols-outlined text-sm text-on-surface-variant shrink-0">chevron_right</span>
            </button>
          )}
        </div>
      </div>

      <button
        onClick={handleContinue}
        className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
      >
        <span>Continue</span>
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </button>

      {/* Closing this leaves the user right here on Prepare for Rest —
          already "Evening Wind-down", no navigation needed for a return
          path. Continue/advanceStep() above are entirely unaffected. */}
      {videoOpen && (
        <BetaVideoModal entry={NIGHT_TIME_VIDEO} onClose={() => setVideoOpen(false)} />
      )}
    </EveningSceneShell>
  );
};

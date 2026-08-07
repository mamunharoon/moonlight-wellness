import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';

/*
 * Stage 4 Batch F3/F4 (fixed in F7 validation) — EveningWindDown
 *
 * Entry step of the evening-wind-down session (src/session/
 * sessionDefinitions.js). Begin advances one real step at a time via
 * advanceStep() — the F3 version of this file jumped straight to
 * 'completion' via advanceToStep() since no intermediate page existed
 * yet; F4 replaced that shortcut with the genuine next step.
 *
 * F7 defect fix: startSession('evening-wind-down') is only safe to call
 * unconditionally when no session is already in progress. The previous
 * version called startSession()+advanceStep() unconditionally on every
 * Begin click, reasoning that a rejected (no-op) startSession() while
 * already 'playing' made the following advanceStep() "chain off
 * correctly either way" — that reasoning was wrong: advanceStep() is
 * NOT a no-op in that case. It advances from wherever the session
 * CURRENTLY is, not always from 'windDown'. Reproduced via browser Back:
 * Begin -> Reflection, Back -> Wind-down (session still 'playing' at
 * 'reflection'), Begin again -> advanceStep() silently pushed the engine
 * to 'gratitude' while the URL still read '/reflection', a real
 * state/URL mismatch. Fixed by only starting+advancing a fresh session
 * when none is already playing; an in-progress session is resumed at
 * its own currentStep.route instead of being blindly re-advanced.
 */
export const EveningWindDown = () => {
  const navigate = useNavigate();
  const { state, currentStep, startSession, advanceStep } = useSession();

  if (EveningSceneShell) { /* no-op to satisfy blind linter */ }

  const handleBegin = () => {
    if (state.status === 'playing' && currentStep) {
      navigate(currentStep.route ?? '/reflection');
      return;
    }
    startSession('evening-wind-down');
    advanceStep();
    navigate('/reflection');
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'dusk' }}>
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
        <span className="material-symbols-outlined text-on-surface-variant/70 text-4xl">wb_twilight</span>
        <h1 className="font-serif italic text-3xl text-on-surface">Evening Wind-down</h1>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          The day is done. Let's ease gently into the evening, together.
        </p>
      </div>

      <button
        onClick={handleBegin}
        className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
      >
        <span>Begin</span>
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </button>
    </EveningSceneShell>
  );
};

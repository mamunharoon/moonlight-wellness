import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';

/*
 * Stage 4 Batch F3/F4 — EveningWindDown
 *
 * Entry step of the evening-wind-down session (src/session/
 * sessionDefinitions.js). Breathing/Sleep Preparation (F6, not this
 * batch) still don't have pages, but Reflection/Gratitude (F4) now do,
 * so Begin advances one real step at a time via advanceStep() — the
 * F3 version of this file jumped straight to 'completion' via
 * advanceToStep() since no intermediate page existed yet; that shortcut
 * is now replaced with the genuine next step.
 *
 * startSession('evening-wind-down') is called unconditionally on Begin,
 * mirroring checkTime()'s role for the morning session (AlarmContext.jsx)
 * — whatever triggers entry into a flow is what starts it. It is safe to
 * call every time regardless of how this page was reached (via Home's
 * link or a direct /evening-wind-down visit): the reducer rejects
 * START_SESSION outright while a session is already 'playing'/
 * 'interrupted' and no-ops back the same state, which the following
 * advanceStep call then chains off correctly either way.
 */
export const EveningWindDown = () => {
  const navigate = useNavigate();
  const { startSession, advanceStep } = useSession();

  if (EveningSceneShell) { /* no-op to satisfy blind linter */ }

  const handleBegin = () => {
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

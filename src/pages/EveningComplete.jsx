import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useAlarm } from '../context/AlarmContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';

/*
 * Stage 4 Batch F3 — EveningComplete
 *
 * Terminal step of the evening-wind-down session. Mirrors
 * SessionComplete.jsx's own mount-effect pattern exactly: only calls
 * completeSession() when the engine is genuinely 'playing' at this
 * step, so a direct /evening-complete visit with no active session (or
 * mid-navigation from an unrelated route) renders the closing message
 * without touching Session Engine state. No StrictMode guard ref is
 * needed here either, for the same reason SessionComplete.jsx doesn't
 * need one — COMPLETE_SESSION is idempotent in the reducer itself (a
 * repeat call once status is already 'completed' returns the exact same
 * state reference, so a double-invoked effect is harmless).
 */
export const EveningComplete = () => {
  const navigate = useNavigate();
  const { state, currentStep, completeSession, resetSession } = useSession();
  const { effectiveTimezone } = useAlarm();

  if (EveningSceneShell) { /* no-op to satisfy blind linter */ }

  useEffect(() => {
    if (state.status === 'playing' && currentStep?.id === 'completion') {
      completeSession();
    }
  }, [state.status, currentStep, completeSession]);

  const handleReturnHome = () => {
    // Daily Journey & Content Architecture: mirrors SessionComplete.jsx's
    // own moonlight_morning_completed_date write — Today's "simple daily
    // completion status" (Home.jsx) needs an equivalent evening marker,
    // which never existed before this batch.
    //
    // Global timezone correctness: same YYYY-MM-DD local-day key as the
    // morning write above, not device toDateString() - see that file's
    // comment for why (local-midnight-spanning routines, format parity
    // with what Home.jsx reads back).
    localStorage.setItem('moonlight_evening_completed_date', getZonedParts(effectiveTimezone, devNow()).dateKey);
    navigate('/');
    resetSession();
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
        <span className="material-symbols-outlined text-on-surface-variant/70 text-4xl">bedtime</span>
        <span className="block text-[10px] text-primary uppercase font-bold tracking-wider">Step 6 of 6</span>
        <h1 className="font-serif italic text-3xl text-on-surface">You have done enough for today.</h1>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          Allow yourself to rest.
        </p>
      </div>

      <button
        onClick={handleReturnHome}
        className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
      >
        <span>Return Home</span>
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </button>
    </EveningSceneShell>
  );
};

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useAlarm } from '../context/AlarmContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { getPinnedRoutineDate, unpinRoutineDate, clearRoutineProgress } from '../session/routineProgress';
import { shouldWriteCompletionDate } from '../lib/routineCardState';
import { getEveningCompletionKey } from '../lib/dailyCompletion';

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
  const { effectiveTimezone, userId } = useAlarm();

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
    // "Repeat Evening Routine" / "Resume Previous Routine" remediation —
    // see SessionComplete.jsx's own handleReturnHome for the full
    // rationale: a session resumed from a genuinely stale snapshot is
    // pinned to its own original dateKey, so its completion credits that
    // original day, never today; an ordinary session (including one
    // spanning a local midnight) still credits "now" exactly as before.
    // The write itself is skipped entirely once the flag already holds
    // this exact value - a same-day repeat completion is a no-op, never
    // a second "credit", since this data model has no counter to
    // increment in the first place.
    const pinnedDateKey = getPinnedRoutineDate(state.sessionId);
    const attributionDateKey = pinnedDateKey ?? getZonedParts(effectiveTimezone, devNow()).dateKey;
    // User-scoped daily completion audit — writes to the CURRENT
    // identity's own key (see dailyCompletion.js's own doc comment), so
    // this completion is never later read back as a different user's.
    const eveningDoneKey = getEveningCompletionKey(userId);
    if (shouldWriteCompletionDate(localStorage.getItem(eveningDoneKey), attributionDateKey)) {
      localStorage.setItem(eveningDoneKey, attributionDateKey);
    }
    if (state.sessionId) {
      unpinRoutineDate(state.sessionId);
      clearRoutineProgress(state.sessionId);
    }
    navigate('/');
    resetSession();
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
        <span className="material-symbols-outlined text-on-surface-variant/70 text-4xl">bedtime</span>
        <span className="block text-[10px] text-primary uppercase font-bold tracking-wider">Step 6 of 6</span>
        <h1 className="font-serif italic text-3xl text-on-surface">Your wind-down is complete</h1>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          You can finish here, or choose a sleep experience to help you settle gently into rest.
        </p>
      </div>

      <div className="space-y-3 w-full">
        <button
          onClick={() => navigate('/library?category=sleep-soundscapes')}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          <span>Choose a Sleep Experience</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button
          onClick={handleReturnHome}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Finish for Tonight
        </button>
      </div>
    </EveningSceneShell>
  );
};

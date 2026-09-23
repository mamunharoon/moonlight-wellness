import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
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
 *
 * Evening completed-review (Build 15) — the daily completion-date flag
 * (Home.jsx's own isEveningDone signal, and the ONLY thing
 * ReflectionReview.jsx/GratitudeReview.jsx trust to decide "is there a
 * completed journey to show") now writes HERE, in this same mount
 * effect, the instant the session genuinely completes - not later,
 * gated behind the user actually tapping "Return Home" as it used to be.
 * Without this move, a user who reaches this screen and immediately taps
 * "Review Tonight's Journey" (the single most likely first thing to tap)
 * would see "Nothing to review yet", even though their Reflection/
 * Gratitude answers are already safely saved in Supabase - the flag was
 * simply the one signal lagging behind. shouldWriteCompletionDate still
 * guards it exactly as before (no write once the flag already holds this
 * exact value - a revisit or a StrictMode double-invoke stays a genuine
 * no-op, never a second "credit").
 *
 * This screen is also safe to revisit at any later point, including
 * after the Session Engine has been fully reset back to idle (state.
 * sessionId null): the mount effect's own `status === 'playing'` guard
 * is then simply false, so nothing above re-fires - no second
 * completion event, no re-write of the (already-correct) completion
 * flag, no change to any routine_responses row. It just renders the
 * same static summary and the same action set every time.
 */
export const EveningComplete = () => {
  const navigate = useNavigate();
  const { state, currentStep, completeSession, resetSession } = useSession();
  const { isGuest } = useAuth();
  const { effectiveTimezone, userId } = useAlarm();

  if (EveningSceneShell) { /* no-op to satisfy blind linter */ }

  useEffect(() => {
    if (state.status === 'playing' && currentStep?.id === 'completion') {
      completeSession();
      // "Repeat Morning/Evening Routine" remediation — a session resumed
      // from a genuinely stale (prior local day) snapshot is pinned to
      // its own original dateKey, so its completion credits that
      // original day, never today; an ordinary session (including one
      // spanning a local midnight) still credits "now" exactly as
      // before. User-scoped: writes to the CURRENT identity's own key
      // (dailyCompletion.js), so this completion is never later read
      // back as a different user's.
      const pinnedDateKey = getPinnedRoutineDate(state.sessionId);
      const attributionDateKey = pinnedDateKey ?? getZonedParts(effectiveTimezone, devNow()).dateKey;
      const eveningDoneKey = getEveningCompletionKey(userId);
      if (shouldWriteCompletionDate(localStorage.getItem(eveningDoneKey), attributionDateKey)) {
        localStorage.setItem(eveningDoneKey, attributionDateKey);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, currentStep, completeSession]);

  const handleReturnHome = () => {
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
        <h1 className="font-serif italic text-3xl text-on-surface">Your Evening Wind-Down is complete</h1>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          You've taken time to reflect, appreciate the day and prepare for rest.
        </p>
      </div>

      <div className="space-y-3 w-full">
        {/* Guests never have persisted routine_responses (Reflection.jsx/
            Gratitude.jsx both early-return before ever writing for a
            guest) - offering "Review Tonight's Journey" here would open
            a page with nothing genuine to show. Kept truthful: guests
            see only the two actions that are actually true for them. */}
        {!isGuest && (
          <button
            onClick={() => navigate('/review/reflection?q=1')}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            <span>Review Tonight's Journey</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        )}
        <button
          onClick={() => navigate('/library?category=sleep-soundscapes')}
          className={`w-full py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all ${
            isGuest
              ? 'bg-primary text-on-primary shadow-lg'
              : 'glass-panel text-on-surface border-white/10 focus-visible:ring-2 focus-visible:ring-primary'
          }`}
        >
          <span>Choose a Sleep Experience</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button
          onClick={handleReturnHome}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Return Home
        </button>
      </div>
    </EveningSceneShell>
  );
};

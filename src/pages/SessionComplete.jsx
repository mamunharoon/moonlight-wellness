/* eslint-disable no-unused-vars */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { BackButton } from '../components/BackButton';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { getPinnedRoutineDate, unpinRoutineDate, clearRoutineProgress } from '../session/routineProgress';
import { shouldWriteCompletionDate } from '../lib/routineCardState';
import { roleForIndex } from '../lib/intentionSelection';

const MORNING_DONE_KEY = 'moonlight_morning_completed_date';

export const SessionComplete = () => {
  const navigate = useNavigate();
  const { intentions, setJourneyStep, effectiveTimezone } = useAlarm();
  // Stage 3C Group 3D Batch C: mirrors the final intention -> complete
  // completion into the Session Engine on mount, and resets the mirror on
  // Return Home. COMPLETE_SESSION is idempotent in the reducer itself (a
  // repeat call once status is already 'completed' returns the exact same
  // state reference, no new completionEventId) — this is what keeps a
  // StrictMode double-invoke of the mount effect below safe without needing
  // an extra guard ref here.
  const { state, currentStep, completeSession, resetSession } = useSession();

  useEffect(() => {
    if (state.status === 'playing' && currentStep?.id === 'complete') {
      completeSession();
    }
  }, [state.status, currentStep, completeSession]);

  const handleReturnHome = () => {
    // "Repeat Morning Routine" / "Resume Previous Routine" remediation —
    // a session resumed from a genuinely stale (prior local day) snapshot
    // via resumeStaleRoutine() is pinned to ITS OWN original dateKey
    // (routineProgress.js), so completing it credits that original day,
    // never today - "today's routine must remain independently
    // available" afterwards, which only holds if today's own completion
    // flag was never touched by finishing yesterday's carried-over run.
    // An ordinary (unpinned) session - including one that happens to
    // span a local midnight during continuous play - still credits
    // "now", exactly as before: global timezone correctness is
    // getZonedParts' dateKey, never device toDateString().
    const pinnedDateKey = getPinnedRoutineDate(state.sessionId);
    const attributionDateKey = pinnedDateKey ?? getZonedParts(effectiveTimezone, devNow()).dateKey;
    // Same-day-repeat / no-double-credit policy: this data model tracks
    // daily completion as one boolean-per-day flag, not a counter or a
    // per-session history table (see routineCardState.js's own doc
    // comment on shouldWriteCompletionDate) - repeating Rise & Reset a
    // second time today must not create a second "credit", so the write
    // is skipped entirely once the flag already holds this exact value.
    if (shouldWriteCompletionDate(localStorage.getItem(MORNING_DONE_KEY), attributionDateKey)) {
      localStorage.setItem(MORNING_DONE_KEY, attributionDateKey);
    }
    if (state.sessionId) {
      unpinRoutineDate(state.sessionId);
      clearRoutineProgress(state.sessionId);
    }
    setJourneyStep('');
    navigate('/');
    resetSession();
  };

  const displayIntentions = intentions.length > 0 ? intentions : ['Stay calm'];

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-md mx-auto space-y-10 select-none">
      <div className="flex items-center gap-3">
        <BackButton fallback="/" />
      </div>

      {/* Circular Gauge */}
      <div className="relative w-40 h-40 mx-auto flex items-center justify-center mt-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" fill="transparent" r="44" stroke="rgba(255,255,255,0.05)" strokeWidth="4"></circle>
          <circle cx="50" cy="50" fill="transparent" r="44" stroke="var(--color-primary)" strokeDasharray="276.46" strokeDashoffset="0" strokeLinecap="round" strokeWidth="5"></circle>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-primary text-2xl font-bold">check_circle</span>
          <span className="text-3xl font-extrabold text-on-surface mt-0.5">100%</span>
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Complete</span>
        </div>
      </div>

      {/* Text Success Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-extrabold text-on-surface leading-tight">You started today with intention.</h2>
        <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          Your direction is set. Take this feeling with you into the day.
        </p>
      </div>

      {/* Summary card */}
      <div className="glass-panel p-5 rounded-2xl text-left text-xs text-on-surface-variant w-full max-w-sm mx-auto space-y-2 shadow-sm">
        <span className="font-semibold uppercase text-primary">
          {displayIntentions.length > 1 ? 'Your Morning Intentions' : 'Your Morning Intention'}
        </span>
        {displayIntentions.map((item, idx) => (
          <p key={item.toLowerCase()} className="text-on-surface font-medium italic flex items-baseline gap-2">
            {displayIntentions.length > 1 && (
              <span className="text-[9px] not-italic font-bold uppercase tracking-wider text-primary shrink-0">{roleForIndex(idx)}</span>
            )}
            <span>"{item}"</span>
          </p>
        ))}
      </div>

      <div className="space-y-3 w-full">
        <button 
          onClick={handleReturnHome}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
        >
          <span>Continue to Today</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};



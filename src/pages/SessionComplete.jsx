/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { BackButton } from '../components/BackButton';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { getPinnedRoutineDate, unpinRoutineDate, clearRoutineProgress } from '../session/routineProgress';
import { shouldWriteCompletionDate } from '../lib/routineCardState';
import { roleForIndex } from '../lib/intentionSelection';
import { getMorningCompletionKey } from '../lib/dailyCompletion';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { JourneyGlow } from '../components/JourneyGlow';
import { OUTCOME, JOURNEY, getOutcomeMessage } from '../lib/outcomeMessages';
import { getReducedMotionPreference } from '../lib/reducedMotionPreference';

const RING_CIRCUMFERENCE = 276.46;

export const SessionComplete = () => {
  const navigate = useNavigate();
  const { intentions, setJourneyStep, effectiveTimezone, userId } = useAlarm();
  // Stage 3C Group 3D Batch C: mirrors the final intention -> complete
  // completion into the Session Engine on mount, and resets the mirror on
  // Return Home. COMPLETE_SESSION is idempotent in the reducer itself (a
  // repeat call once status is already 'completed' returns the exact same
  // state reference, no new completionEventId) — this is what keeps a
  // StrictMode double-invoke of the mount effect below safe without needing
  // an extra guard ref here.
  const { state, currentStep, completeSession, resetSession } = useSession();

  // WakeWise Phase 3B (3B.1) — captured once, before the mount effect below
  // can flip state.status to 'completed': true only for a genuine natural
  // completion arriving with the session still 'playing' (the exact same
  // signal the effect itself gates completeSession() on). A direct/
  // refreshed visit, or a Review Mode revisit, mounts with status already
  // 'completed' and never animates - matching this file's own established
  // "same static screen either way" precedent for those cases, just now
  // additionally deciding whether the ring animates rather than only what
  // copy it shows.
  const [isFreshCompletion] = useState(() => state.status === 'playing');
  const [reducedMotion] = useState(() => {
    try {
      return Boolean(getReducedMotionPreference() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  });
  // Starts empty only when it genuinely needs to animate; a revisit or
  // Reduced Motion renders the final 100% state immediately, no flash of
  // an empty ring first.
  const [ringFilled, setRingFilled] = useState(() => !isFreshCompletion || reducedMotion);

  useEffect(() => {
    if (state.status === 'playing' && currentStep?.id === 'complete') {
      completeSession();
    }
  }, [state.status, currentStep, completeSession]);

  useEffect(() => {
    if (ringFilled) return;
    // A short delay (not requestAnimationFrame's next-paint timing alone)
    // reliably lets the browser commit the initial empty-ring paint first,
    // so the stroke-dashoffset transition below is actually observed
    // rather than the fill appearing to jump straight to 100%.
    const timer = setTimeout(() => setRingFilled(true), 80);
    return () => clearTimeout(timer);
    // Runs once - deliberately not re-armed by any later state change, so
    // the fill never replays (e.g. on an unrelated re-render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // User-scoped daily completion audit — writes to the CURRENT
    // identity's own key (see dailyCompletion.js's own doc comment), so
    // this completion is never later read back as a different user's.
    const morningDoneKey = getMorningCompletionKey(userId);
    if (shouldWriteCompletionDate(localStorage.getItem(morningDoneKey), attributionDateKey)) {
      localStorage.setItem(morningDoneKey, attributionDateKey);
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

  // WakeWise Phase 2 (B6) — this screen is reached ONLY on a genuine
  // natural completion (the mount effect above gates completeSession() on
  // state.status==='playing'; a direct/refreshed visit or a mismatched
  // step still renders this same static screen, unaffected). The
  // headline/body now rotate through 5 curated, uplifting variants keyed
  // to the user's own local calendar day (same dayIndexFromDateKey
  // technique greeting.js already uses) instead of one fixed string -
  // stable all day, never re-rolled on rerender/reopen.
  const today = getZonedParts(effectiveTimezone, devNow()).dateKey;
  const { headline, body } = getOutcomeMessage(OUTCOME.COMPLETED, JOURNEY.MORNING, today);

  return (
    // Build 16 physical-iPhone correction (F8) - see Affirmation.jsx's
    // identical block for the full rationale.
    <div
      className="min-h-[85vh] flex flex-col justify-between pb-6 max-w-md mx-auto space-y-10 select-none"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))'
      }}
    >
      {/* WakeWise DEV — colour glow extension: subtle warm-gold ambient
          backdrop behind this step's own completion ring/badge. */}
      <JourneyGlow journey="morning" />

      <div className="flex items-center justify-between gap-3">
        {/* Back-navigation repair (Morning canonical map) — Morning is
            finished; there is no "leave this routine" concept left, so
            guardActiveRoute is off. alwaysFallback forces a plain replace
            to Home instead of BackButton's normal goBack (which would
            otherwise navigate(-1) straight back into the just-completed
            Affirmation step - "do not re-enter a completed journey using
            browser Back"). */}
        <BackButton fallback="/" guardActiveRoute={false} alwaysFallback />
        {/* Morning Visual Uplift (Build 16) — a small decorative orienting
            badge, the same established pattern Home's own "YOUR MORNING"
            pill already uses (Build 15) - not new data, just a label. */}
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-morning-accent/10 border border-morning-accent-tint/25 text-morning-accent text-[10px] font-bold uppercase tracking-wider">
          Morning Flow
        </span>
      </div>

      {/* Circular Gauge */}
      <div className="relative w-40 h-40 mx-auto flex items-center justify-center mt-6 rounded-full shadow-morning-glow">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" fill="transparent" r="44" stroke="rgba(255,255,255,0.05)" strokeWidth="4"></circle>
          {/* WakeWise Phase 3B (3B.1) — animates from empty to full only on
              a genuine fresh completion with Reduced Motion off (see
              ringFilled above); a revisit or Reduced Motion renders this
              at strokeDashoffset 0 from the very first paint, no
              transition attached. */}
          <circle
            cx="50"
            cy="50"
            fill="transparent"
            r="44"
            stroke="var(--color-gratitude-accent)"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={ringFilled ? 0 : RING_CIRCUMFERENCE}
            strokeLinecap="round"
            strokeWidth="5"
            style={isFreshCompletion && !reducedMotion ? { transition: 'stroke-dashoffset 900ms ease-out' } : undefined}
          ></circle>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-morning-accent text-2xl font-bold">check_circle</span>
          <span className="text-3xl font-extrabold text-on-surface mt-0.5">100%</span>
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Complete</span>
        </div>
      </div>

      {/* Text Success Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-morning-display italic font-semibold text-on-surface leading-tight">{headline}</h2>
        <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          {body}
        </p>
      </div>

      {/* Summary card */}
      <div className="glass-panel p-5 rounded-2xl text-left text-xs text-on-surface-variant w-full max-w-sm mx-auto space-y-2 shadow-sm">
        <span className="font-semibold uppercase text-morning-accent">
          {displayIntentions.length > 1 ? 'Your Morning Intentions' : 'Your Morning Intention'}
        </span>
        {displayIntentions.map((item, idx) => (
          <p key={item.toLowerCase()} className="text-on-surface font-medium italic flex items-baseline gap-2">
            {displayIntentions.length > 1 && (
              <span className="text-[9px] not-italic font-bold uppercase tracking-wider text-morning-accent shrink-0">{roleForIndex(idx)}</span>
            )}
            <span>"{item}"</span>
          </p>
        ))}
      </div>

      <div className="space-y-3 w-full">
        <button
          onClick={handleReturnHome}
          className={`w-full ${getJourneyPrimaryActionClasses('morning')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-morning-glow`}
        >
          <span>Continue to Today</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};



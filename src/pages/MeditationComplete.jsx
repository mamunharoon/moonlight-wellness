/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { BackButton } from '../components/BackButton';
import { getMeditationCompletionKey } from '../lib/dailyCompletion';
import { OUTCOME, JOURNEY, getOutcomeMessage } from '../lib/outcomeMessages';

const CHECK_IN_OPTIONS = [
  { id: 'calmer', label: 'Calmer' },
  { id: 'same', label: 'About the same' },
  { id: 'not-yet', label: 'Not yet' }
];

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

/*
 * Meditation experience — completion screen.
 *
 * Reached only via Meditate.jsx's handleVideoClose, which passes the
 * completed session's real id/title/duration through router state (not
 * a query string — this is one-shot, not something to deep-link to or
 * restore after a refresh). A direct or refreshed visit with no state
 * still renders safely, just without session-specific detail, exactly
 * the same "no crash on refresh" guarantee Meditate.jsx itself gives.
 *
 * "Meditated today" is written to localStorage only on Return to Today,
 * mirroring SessionComplete.jsx/EveningComplete.jsx's own established
 * pattern (reaching the completion screen alone doesn't count - the
 * explicit tap does), using the same getZonedParts(effectiveTimezone)
 * local dateKey every other daily-completion flag already uses, so it
 * resets at the user's own local midnight, never Sydney server time or
 * UTC. Local-storage-only for this MVP, per the explicit instruction not
 * to introduce a database migration unless durable cross-device history
 * is genuinely required — it isn't, for a same-device "did I meditate
 * today" indicator.
 *
 * WakeWise Phase 2 (B4) — root cause fixed: Meditate.jsx's handleVideoClose
 * used to route here unconditionally, with no natural-end check at all, so
 * closing a guided video early was indistinguishable from genuinely
 * finishing it - this screen would show "Meditation complete" AND write
 * the daily completion flag either way. `session.endedEarly` (real,
 * Meditate.jsx's own onEnded-driven distinction - see that file's own doc
 * comment) now gates both: the headline/body (via the shared
 * outcomeMessages.js model, 'anytime' tone) and whether Return Home/Choose
 * another actually record today's completion. A direct/refreshed visit
 * with no session state at all (`session` null) has no way to know either
 * way, so it keeps the prior, pre-Phase-2 completed-style presentation
 * exactly as before - the defect only ever existed for a genuine
 * early-closed session, which now always carries real state.
 */
export const MeditationComplete = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { effectiveTimezone, userId } = useAlarm();
  const [checkIn, setCheckIn] = useState(null);

  const session = location.state || null;
  const durationLabel = session ? formatDuration(session.durationSeconds) : null;
  const endedEarly = Boolean(session?.endedEarly);
  const today = getZonedParts(effectiveTimezone, devNow()).dateKey;
  const { headline, body: outcomeBody } = endedEarly
    ? getOutcomeMessage(OUTCOME.ENDED_EARLY, JOURNEY.ANYTIME, today)
    : getOutcomeMessage(OUTCOME.COMPLETED, JOURNEY.ANYTIME, today);

  // User-scoped daily completion audit — writes to the CURRENT identity's
  // own key (see dailyCompletion.js's own doc comment), so this
  // completion is never later read back as a different user's. Never
  // written for a genuine early exit (B4) - an ended_early outcome must
  // not record completion.
  const handleReturnHome = () => {
    if (!endedEarly) localStorage.setItem(getMeditationCompletionKey(userId), today);
    navigate('/');
  };

  const handleChooseAnother = () => {
    if (!endedEarly) localStorage.setItem(getMeditationCompletionKey(userId), today);
    navigate('/meditate');
  };

  return (
    // Build 16 physical-iPhone correction (F8) - see Affirmation.jsx's
    // identical block for the full rationale.
    <div
      className="min-h-[85vh] flex flex-col justify-between pb-6 max-w-md mx-auto space-y-10"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))'
      }}
    >
      <div className="flex items-center gap-3">
        <BackButton fallback="/meditate" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
        <div className="space-y-4">
          <span className="material-symbols-outlined text-primary text-4xl">self_improvement</span>
          <h1 className="font-serif italic text-3xl text-on-surface">{headline}</h1>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">{outcomeBody}</p>
          {session && (
            <div className="glass-panel rounded-2xl p-5 space-y-1 text-left max-w-xs mx-auto">
              <p className="text-xs text-primary font-bold uppercase tracking-wider">{session.title}</p>
              {durationLabel && (
                <p className="text-xs text-on-surface-variant">Session length: {durationLabel}</p>
              )}
            </div>
          )}
        </div>

        <div className="w-full max-w-xs space-y-3">
          <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">How do you feel now?</p>
          <div className="flex gap-2">
            {CHECK_IN_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setCheckIn(option.id)}
                aria-pressed={checkIn === option.id}
                className={`flex-1 py-3 px-2 rounded-2xl text-xs font-semibold transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary ${
                  checkIn === option.id
                    ? 'bg-primary text-on-primary'
                    : 'glass-panel text-on-surface-variant hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleReturnHome}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          <span>Return to Today</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button
          onClick={handleChooseAnother}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Choose another meditation
        </button>
      </div>
    </div>
  );
};

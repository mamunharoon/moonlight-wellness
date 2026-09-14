import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';

const MEDITATION_DONE_KEY = 'moonlight_meditation_completed_date';

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
 */
export const MeditationComplete = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { effectiveTimezone } = useAlarm();
  const [checkIn, setCheckIn] = useState(null);

  const session = location.state || null;
  const durationLabel = session ? formatDuration(session.durationSeconds) : null;

  const handleReturnHome = () => {
    localStorage.setItem(MEDITATION_DONE_KEY, getZonedParts(effectiveTimezone, devNow()).dateKey);
    navigate('/');
  };

  const handleChooseAnother = () => {
    localStorage.setItem(MEDITATION_DONE_KEY, getZonedParts(effectiveTimezone, devNow()).dateKey);
    navigate('/meditate');
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-md mx-auto space-y-10">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
        <div className="space-y-4">
          <span className="material-symbols-outlined text-primary text-4xl">self_improvement</span>
          <h1 className="font-serif italic text-3xl text-on-surface">Meditation complete</h1>
          {session ? (
            <div className="glass-panel rounded-2xl p-5 space-y-1 text-left max-w-xs mx-auto">
              <p className="text-xs text-primary font-bold uppercase tracking-wider">{session.title}</p>
              {durationLabel && (
                <p className="text-xs text-on-surface-variant">Session length: {durationLabel}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">Nice work taking that moment for yourself.</p>
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

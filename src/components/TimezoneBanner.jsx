import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';

/*
 * Global timezone correctness — the required timezone-change prompt.
 *
 * Two distinct cases share this one inline banner (top of Today, where
 * it's impossible to miss but never blocks navigation):
 *
 *   - Ongoing mismatch: a CONFIRMED timezone no longer matches the
 *     device's detected zone (the "have you travelled?" case). Exact
 *     required copy and three actions: Use current timezone / Keep
 *     saved timezone / Ask me later.
 *   - First-time confirmation: an existing user backfilled with a NULL
 *     timezone (see the migration's own doc comment), or a brand new
 *     guest who hasn't been through onboarding. Two actions instead of
 *     three - there's no "saved" value yet to keep.
 *
 * Both cases fall back to the device-detected zone for all calculations
 * even before being confirmed/resolved here (see AlarmContext's
 * effectiveTimezone) - this banner is about the user's explicit choice,
 * never about anything being broken while it's unanswered.
 */
export const TimezoneBanner = () => {
  const navigate = useNavigate();
  const {
    timezoneMismatch,
    timezoneUnconfirmed,
    deviceTimezone,
    timezone,
    useCurrentTimezone,
    keepSavedTimezone,
    askTimezoneLater
  } = useAlarm();

  if (!timezoneMismatch && !timezoneUnconfirmed) return null;

  return (
    <div className="glass-panel p-5 rounded-2xl space-y-4 border-primary/20 bg-primary/5">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-primary text-xl shrink-0">public</span>
        <div className="space-y-1">
          {timezoneMismatch ? (
            <>
              <p className="text-sm font-semibold text-on-surface">
                Your timezone appears to have changed.
              </p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Should WakeWise use your current timezone ({deviceTimezone}) for reminders, or keep
                using {timezone}?
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-on-surface">
                We've detected your timezone as {deviceTimezone}.
              </p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                This is what WakeWise will use to time your reminders. Is that right?
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={useCurrentTimezone}
          className="px-4 py-2.5 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
        >
          Use current timezone
        </button>

        {timezoneMismatch && (
          <button
            type="button"
            onClick={keepSavedTimezone}
            className="px-4 py-2.5 rounded-full glass-panel border border-white/10 text-on-surface text-xs font-bold uppercase tracking-wider hover:bg-white/5 active:scale-95 transition-all"
          >
            Keep saved timezone
          </button>
        )}

        {timezoneUnconfirmed && (
          <button
            type="button"
            onClick={() => navigate('/settings/timezone')}
            className="px-4 py-2.5 rounded-full glass-panel border border-white/10 text-on-surface text-xs font-bold uppercase tracking-wider hover:bg-white/5 active:scale-95 transition-all"
          >
            Choose a different timezone
          </button>
        )}

        <button
          type="button"
          onClick={askTimezoneLater}
          className="px-4 py-2.5 rounded-full text-on-surface-variant text-xs font-bold uppercase tracking-wider hover:text-on-surface active:scale-95 transition-all"
        >
          Ask me later
        </button>
      </div>
    </div>
  );
};

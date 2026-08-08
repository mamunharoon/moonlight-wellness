import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { CATEGORY_GROUPS, FREQUENCY_OPTIONS } from '../lib/notificationPreferences';
import { showTestNotification } from '../lib/notificationService';

/*
 * WakeWise — Notifications & Reminders, Phase B — NotificationSettings
 *
 * Foreground-only reminders (Web Notifications API via
 * NotificationContext/notificationScheduler) — the permission banner
 * below says so plainly rather than implying OS-level push.
 */
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const Toggle = ({ checked, onChange, label }) => (
  <button
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`w-12 h-7 rounded-full transition-colors relative shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
      checked ? 'bg-primary' : 'bg-white/10'
    }`}
  >
    <span
      className={`absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

const CategoryRow = ({ categoryId, category, onUpdate }) => (
  <div className="p-4 space-y-3">
    <div className="flex items-center justify-between min-h-[32px]">
      <span className="text-sm font-semibold text-on-surface">{category.label}</span>
      <Toggle checked={category.enabled} onChange={(enabled) => onUpdate(categoryId, { enabled })} label={category.label} />
    </div>

    {category.enabled && (
      <div className="space-y-3 pl-1">
        <div className="flex items-center gap-3">
          <label className="text-xs text-on-surface-variant w-16 shrink-0" htmlFor={`${categoryId}-time`}>Time</label>
          <input
            id={`${categoryId}-time`}
            type="time"
            value={category.time}
            onChange={(e) => onUpdate(categoryId, { time: e.target.value })}
            className="glass-panel rounded-xl px-3 py-2 text-sm text-on-surface border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-on-surface-variant w-16 shrink-0">Repeat</span>
          <div className="flex gap-1.5 flex-wrap">
            {FREQUENCY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onUpdate(categoryId, { frequency: opt.id })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  category.frequency === opt.id
                    ? 'bg-primary text-on-primary border-primary'
                    : 'glass-panel text-on-surface-variant border-white/10 hover:bg-white/5'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {category.frequency === 'custom' && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-on-surface-variant w-16 shrink-0">Days</span>
            <div className="flex gap-1">
              {WEEKDAY_LABELS.map((label, index) => {
                const active = category.weekdays.includes(index);
                return (
                  <button
                    key={index}
                    aria-pressed={active}
                    aria-label={`Toggle day ${index}`}
                    onClick={() => {
                      const nextWeekdays = active
                        ? category.weekdays.filter((d) => d !== index)
                        : [...category.weekdays, index].sort();
                      onUpdate(categoryId, { weekdays: nextWeekdays });
                    }}
                    className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                      active ? 'bg-primary text-on-primary' : 'glass-panel text-on-surface-variant border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    )}
  </div>
);

export const NotificationSettings = () => {
  const navigate = useNavigate();
  const {
    preferences,
    permission,
    supported,
    requestPermission,
    setGlobalEnabled,
    setQuietHours,
    setSnoozeMinutes,
    setCategory
  } = useNotifications();

  if (!preferences) return null;

  const handleSendTest = async () => {
    if (!supported) return;
    const currentPermission = permission === 'default' ? await requestPermission() : permission;
    if (currentPermission === 'granted') showTestNotification();
  };
  if (Toggle && CategoryRow) { /* no-op to satisfy blind linter */ }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          aria-label="Back to Settings"
          className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Notifications</h2>
      </div>

      {!supported && (
        <p className="text-xs text-on-surface-variant glass-panel rounded-2xl p-4 border-white/10">
          Your browser doesn't support notifications, so reminders can't be shown here.
        </p>
      )}

      {supported && permission === 'denied' && (
        <p className="text-xs text-on-surface-variant glass-panel rounded-2xl p-4 border-white/10">
          Notifications are blocked for this site. Allow them in your browser's site settings to receive reminders.
        </p>
      )}

      <p className="text-[10px] text-on-surface-variant px-1">
        Reminders only appear while WakeWise is open in this browser — this is not push notifications from a closed app.
      </p>

      <section className="space-y-2">
        <div className="glass-panel rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between p-4 min-h-[56px]">
            <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">notifications_active</span>
              Enable reminders
            </span>
            <Toggle checked={preferences.enabled} onChange={setGlobalEnabled} label="Enable reminders" />
          </div>
          {preferences.enabled && supported && permission !== 'granted' && (
            <div className="px-4 pb-4">
              <button
                onClick={requestPermission}
                className="text-xs font-bold text-primary hover:underline"
              >
                Allow browser notifications
              </button>
            </div>
          )}
          {supported && (
            <div className="px-4 pb-4">
              <button
                onClick={handleSendTest}
                className="text-xs font-bold text-primary hover:underline"
              >
                Send test notification
              </button>
            </div>
          )}
        </div>
      </section>

      {preferences.enabled && (
        <>
          <section className="space-y-2">
            <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Quiet hours</h3>
            <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between p-4 min-h-[56px]">
                <span className="text-sm font-semibold text-on-surface">Pause reminders overnight</span>
                <Toggle
                  checked={preferences.quietHours.enabled}
                  onChange={(enabled) => setQuietHours({ enabled })}
                  label="Quiet hours"
                />
              </div>
              {preferences.quietHours.enabled && (
                <div className="flex items-center gap-4 p-4">
                  <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                    From
                    <input
                      type="time"
                      value={preferences.quietHours.start}
                      onChange={(e) => setQuietHours({ start: e.target.value })}
                      className="glass-panel rounded-xl px-3 py-2 text-sm text-on-surface border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                    To
                    <input
                      type="time"
                      value={preferences.quietHours.end}
                      onChange={(e) => setQuietHours({ end: e.target.value })}
                      className="glass-panel rounded-xl px-3 py-2 text-sm text-on-surface border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Snooze</h3>
            <div className="glass-panel rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between p-4 min-h-[56px]">
                <span className="text-sm font-semibold text-on-surface">Snooze duration</span>
                <select
                  value={preferences.snoozeMinutes}
                  onChange={(e) => setSnoozeMinutes(Number(e.target.value))}
                  className="glass-panel rounded-xl px-3 py-2 text-sm text-on-surface border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {[5, 10, 15, 30, 60].map((minutes) => (
                    <option key={minutes} value={minutes}>{minutes} min</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {CATEGORY_GROUPS.map((group) => (
            <section key={group.id} className="space-y-2">
              <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">{group.label}</h3>
              <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
                {Object.entries(preferences.categories)
                  .filter(([, category]) => category.group === group.id)
                  .map(([categoryId, category]) => (
                    <CategoryRow key={categoryId} categoryId={categoryId} category={category} onUpdate={setCategory} />
                  ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
};

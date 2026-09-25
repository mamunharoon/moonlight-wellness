/* eslint-disable no-unused-vars */
import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useMorningReminder } from '../context/MorningReminderContext';
import { useAudio } from '../context/AudioContext';
import { useAlarm } from '../context/AlarmContext';
import { CATEGORY_GROUPS, FREQUENCY_OPTIONS } from '../lib/notificationPreferences';
import { showTestNotification } from '../lib/notificationService';
import { MORNING_REMINDER_WEEKDAY_DISPLAY_ORDER, MORNING_REMINDER_WEEKDAY_LABELS } from '../lib/nativeMorningReminder';
import { ALARM_CHIME_URL, ALARM_CHIME_TITLE } from '../lib/alarmSound';
import { isNativePlatform } from '../lib/platform';
import { BackButton } from '../components/BackButton';

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

// Capacitor iOS Native Morning Reminders: one device-level (OS) reminder
// tied to the real saved wake time, deliberately separate from the
// "Wake-up reminder" row inside the reminder categories below (that one
// is a web-only, foreground-only, independently-timed reminder — see
// notificationPreferences.js's CATEGORY_DEFAULTS.wakeUp). Renders nothing
// on web/PWA (useMorningReminder().supported is false there).
// Same visual/interaction pattern as CategoryRow's own weekday picker
// below (rounded pill, aria-pressed, active/inactive colouring), sized
// slightly larger for a friendlier touch target on this, the reminder
// most likely to be tapped half-asleep. This is a genuinely separate
// weekday selection from CategoryRow's — see MorningReminderContext.jsx's
// header comment for why the two systems (native vs. web/foreground) are
// never coupled.
const WeekdayPicker = ({ selected, onToggle }) => (
  <div className="flex gap-1.5" role="group" aria-label="Reminder days">
    {MORNING_REMINDER_WEEKDAY_DISPLAY_ORDER.map((day) => {
      const active = selected.includes(day);
      const label = MORNING_REMINDER_WEEKDAY_LABELS[day];
      return (
        <button
          key={day}
          type="button"
          aria-pressed={active}
          aria-label={label}
          onClick={() => onToggle(day)}
          className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-full text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:scale-90 ${
            active ? 'bg-primary text-on-primary' : 'glass-panel text-on-surface-variant border-white/10 hover:bg-white/5'
          }`}
        >
          {label[0]}
        </button>
      );
    })}
  </div>
);

const MorningReminderSection = () => {
  const { supported, enabled, permissionStatus, wakeTime, weekdays, setWeekdays, scheduleSummary, enable, disable } =
    useMorningReminder();
  if (!supported) return null;

  // Enforced again here (not just in MorningReminderContext.setWeekdays,
  // which already refuses an empty result) so the UI itself never even
  // attempts to remove the last remaining day — "at least one selected
  // day while the reminder is enabled" as a visible constraint, not just
  // a silent no-op.
  const handleToggleDay = (day) => {
    const next = weekdays.includes(day) ? weekdays.filter((d) => d !== day) : [...weekdays, day];
    if (next.length === 0) return;
    setWeekdays(next);
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Morning reminder</h3>
      <div className="glass-panel rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between p-4 min-h-[56px]">
          <span className="flex items-center gap-3 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">notifications</span>
            Morning reminder
          </span>
          <Toggle
            checked={enabled}
            onChange={(next) => (next ? enable() : disable())}
            label="Morning reminder"
          />
        </div>
        <div className="px-4 pb-4 space-y-3">
          {wakeTime && (
            <p className="text-xs text-on-surface-variant">
              {enabled && scheduleSummary
                ? `Scheduled: ${scheduleSummary} on this device.`
                : `Uses your wake time (${wakeTime}) from Onboarding.`}
            </p>
          )}

          {(enabled || permissionStatus === 'denied') && (
            <div className="space-y-1.5">
              <span className="text-xs text-on-surface-variant font-semibold" id="morning-reminder-days-label">
                Days
              </span>
              <div aria-labelledby="morning-reminder-days-label">
                <WeekdayPicker selected={weekdays} onToggle={handleToggleDay} />
              </div>
            </div>
          )}

          {permissionStatus === 'denied' && (
            <p className="text-xs text-primary">
              Notifications are turned off for WakeWise. Enable them in iPhone Settings → Notifications → WakeWise to turn this on.
            </p>
          )}
          {!enabled && permissionStatus !== 'denied' && (
            <p className="text-[11px] text-on-surface-variant">
              This is a reminder, not a guaranteed alarm — iPhone Focus, silent mode and notification settings can affect delivery. We'll ask permission the first time you turn this on.
            </p>
          )}
          {enabled && (
            <p className="text-[11px] text-on-surface-variant">
              Uses your iPhone's default notification sound — WakeWise doesn't yet include a custom reminder sound. Tap the
              notification's Begin, Snooze, or Skip actions, or open the app, to respond.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

const ALARM_SOUND_PREVIEW_MS = 3000;

// "Test alarm sound" — lets a user confirm, from a genuine tap, that
// WakeWise's bundled foreground alarm chime (see
// docs/wakewise-alarm-sound-provenance.md) actually plays on this
// device/browser, without touching the alarm schedule, wake time, or
// Morning progress in any way. Deliberately its own section, not nested
// inside MorningReminderSection above (which renders nothing on web -
// `if (!supported) return null` - since it's specifically about native
// scheduling; this foreground chime is the same in-page mechanism on
// both web and native).
//
// previewActiveRef (not just previewState) is the real ownership flag:
// it's checked before ever calling stopTrack() so this component only
// ever stops audio IT started - never an unrelated track already playing
// elsewhere in the app (e.g. background meditation music) just because
// the user happened to navigate through this screen.
const AlarmSoundSection = () => {
  const { playTrack, stopTrack, playbackError } = useAudio();
  const { isRinging } = useAlarm();
  const native = isNativePlatform();
  const [previewState, setPreviewState] = useState('idle'); // idle | playing | success | error
  const previewActiveRef = useRef(false);
  const previewTimeoutRef = useRef(null);

  const endPreview = (nextState) => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    if (previewActiveRef.current) {
      previewActiveRef.current = false;
      stopTrack();
    }
    setPreviewState(nextState);
  };

  const handleTestAlarmSound = () => {
    if (previewActiveRef.current) {
      // Tapping again while a preview is playing is the compact "stop
      // early" control - same single button, no separate Stop icon.
      endPreview('idle');
      return;
    }
    previewActiveRef.current = true;
    setPreviewState('playing');
    const playPromise = playTrack({ title: `${ALARM_CHIME_TITLE} Preview`, url: ALARM_CHIME_URL });
    Promise.resolve(playPromise)
      .then(() => {
        if (!previewActiveRef.current) return; // stopped/unmounted already
        if (isRinging) {
          // A real alarm started ringing while the preview was starting -
          // leave it playing rather than have the preview's own auto-stop
          // cut a genuine alarm short. The preview simply hands off.
          previewActiveRef.current = false;
          return;
        }
        previewTimeoutRef.current = setTimeout(() => {
          if (!previewActiveRef.current || isRinging) return;
          endPreview('success');
        }, ALARM_SOUND_PREVIEW_MS);
      })
      .catch(() => {
        if (!previewActiveRef.current) return;
        previewActiveRef.current = false;
        setPreviewState('error');
      });
  };

  // Stop on navigation/unmount - but only a preview this component
  // itself started (see previewActiveRef's own comment above).
  useEffect(
    () => () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      if (previewActiveRef.current) {
        previewActiveRef.current = false;
        stopTrack();
      }
    },
    [stopTrack]
  );

  const isPreviewing = previewState === 'playing';

  return (
    <section className="space-y-2">
      <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Alarm sound</h3>
      <div className="glass-panel rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <div className="p-4 space-y-2">
          <p className="text-xs text-on-surface-variant">
            Preview the sound WakeWise plays when your alarm goes off.
          </p>
          <button
            type="button"
            onClick={handleTestAlarmSound}
            aria-label={isPreviewing ? 'Stop alarm sound preview' : 'Test alarm sound'}
            className="min-h-[44px] min-w-[44px] inline-flex items-center text-xs font-bold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded active:scale-95 transition-transform"
          >
            {isPreviewing ? 'Stop preview' : 'Test alarm sound'}
          </button>
          {!native && (
            <p className="text-[11px] text-on-surface-variant">
              Keep WakeWise open and allow site sound for browser alarms.
            </p>
          )}
          <p role="status" aria-live="polite" className="text-[11px] min-h-[14px] font-semibold text-on-surface-variant">
            {previewState === 'playing' && 'Playing preview…'}
            {previewState === 'success' && 'Alarm sound played successfully.'}
            {previewState === 'error' &&
              (playbackError
                ? `Couldn't play the alarm sound (${playbackError.name}). Check that site sound is allowed for WakeWise and try again.`
                : "Couldn't play the alarm sound. Check that site sound is allowed for WakeWise and try again.")}
          </p>
        </div>
      </div>
    </section>
  );
};

export const NotificationSettings = () => {
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
  if (Toggle && CategoryRow && MorningReminderSection && WeekdayPicker && AlarmSoundSection) { /* no-op to satisfy blind linter */ }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallback="/settings" label="Back to Settings" />
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

      <MorningReminderSection />
      <AlarmSoundSection />

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

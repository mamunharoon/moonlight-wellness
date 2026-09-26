// Welcome alarm-status card — pure, independently testable decision
// logic shared by both Welcome copy variants (first-use and returning).
// Reads AlarmContext's own real state (alarmConfigured, isAlarmSet,
// alarmTime, alarmSoundId) - no second localStorage key, no separate
// persistence model.
import { resolvePlayableAlarmSound } from './alarmSounds';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// 'HH:MM' (24h, this app's own stored wall-clock shape - see
// timezone.js) -> '6:30 AM'. Returns null for anything that isn't
// exactly that shape, rather than guessing - callers fall back to the
// raw stored value so a display never goes blank.
export const formatWakeTime12h = (value) => {
  const match = typeof value === 'string' ? TIME_PATTERN.exec(value) : null;
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2];
  const displayHour = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${displayHour}:${minutes} ${ampm}`;
};

// Resolves the card's underlying state (which of the three real states
// applies, plus the two display strings every variant's copy is built
// from) independently of which Welcome screen is asking. `alarmConfigured`
// is checked first - a genuinely never-configured alarm is shown as
// "not set" even if isAlarmSet happens to still be at its own default
// (true), since alarmConfigured === false means no one has ever actually
// chosen a time/sound at all. soundLabel always resolves via
// resolvePlayableAlarmSound - the exact same fallback logic
// AlarmContext.jsx itself uses when the alarm actually rings - so a
// missing/no-longer-available stored sound id never shows a stale or
// broken label, only the real sound that will actually play.
export const resolveAlarmStatus = ({ alarmConfigured, isAlarmSet, alarmTime, alarmSoundId }) => {
  const formattedTime = formatWakeTime12h(alarmTime);
  const soundLabel = resolvePlayableAlarmSound(alarmSoundId).label;
  if (!alarmConfigured) return { kind: 'unset', formattedTime, soundLabel };
  if (!isAlarmSet) return { kind: 'off', formattedTime, soundLabel };
  return { kind: 'set', formattedTime, soundLabel };
};

// Per-variant copy matrix - both Welcome screens specify their own exact
// wording for the same three underlying states (see AlarmStatusCard.jsx),
// so this composes the final heading/detail/action strings from
// resolveAlarmStatus's state-only output rather than hardcoding copy
// into the decision function above.
export const getAlarmStatusCardCopy = ({ variant, alarmConfigured, isAlarmSet, alarmTime, alarmSoundId }) => {
  const { kind, formattedTime, soundLabel } = resolveAlarmStatus({ alarmConfigured, isAlarmSet, alarmTime, alarmSoundId });
  const time = formattedTime ?? alarmTime;

  if (kind === 'unset') {
    return variant === 'first-use'
      ? { kind, heading: 'Wake-up alarm not set', detail: 'Choose a time and sound for your morning.', actionLabel: 'Set alarm' }
      : { kind, heading: 'Set a wake-up alarm', detail: 'Wake gently, then begin your guided morning routine.', actionLabel: 'Set alarm' };
  }

  if (kind === 'off') {
    return { kind, heading: 'Morning alarm is off', detail: 'Your wake-up alarm is currently paused.', actionLabel: 'Manage alarm' };
  }

  return variant === 'first-use'
    ? { kind, heading: `Alarm set for ${time}`, detail: soundLabel, actionLabel: 'Change alarm' }
    : { kind, heading: 'Morning alarm set', detail: `${time} · ${soundLabel}`, actionLabel: 'Change alarm' };
};

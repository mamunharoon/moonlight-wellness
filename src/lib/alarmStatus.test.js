// Welcome alarm-status card — real-execution tests for the pure decision
// logic shared by both Welcome copy variants.
import { describe, it, expect } from 'vitest';
import { formatWakeTime12h, resolveAlarmStatus, getAlarmStatusCardCopy } from './alarmStatus';

describe('formatWakeTime12h', () => {
  it('formats a real HH:MM string into 12-hour clock form', () => {
    expect(formatWakeTime12h('06:30')).toBe('6:30 AM');
    expect(formatWakeTime12h('00:00')).toBe('12:00 AM');
    expect(formatWakeTime12h('12:00')).toBe('12:00 PM');
    expect(formatWakeTime12h('13:05')).toBe('1:05 PM');
    expect(formatWakeTime12h('23:59')).toBe('11:59 PM');
  });

  it('returns null for anything that is not exactly HH:MM, rather than guessing', () => {
    expect(formatWakeTime12h('7:30')).toBeNull();
    expect(formatWakeTime12h('25:00')).toBeNull();
    expect(formatWakeTime12h('06:60')).toBeNull();
    expect(formatWakeTime12h('')).toBeNull();
    expect(formatWakeTime12h(null)).toBeNull();
    expect(formatWakeTime12h(undefined)).toBeNull();
  });
});

describe('resolveAlarmStatus', () => {
  it('"unset" when alarmConfigured is false, regardless of isAlarmSet', () => {
    expect(resolveAlarmStatus({ alarmConfigured: false, isAlarmSet: true, alarmTime: '06:30', alarmSoundId: 'gentle-chimes' }).kind).toBe('unset');
    expect(resolveAlarmStatus({ alarmConfigured: false, isAlarmSet: false, alarmTime: '06:30', alarmSoundId: 'gentle-chimes' }).kind).toBe('unset');
  });

  it('"off" when configured but isAlarmSet is false', () => {
    expect(resolveAlarmStatus({ alarmConfigured: true, isAlarmSet: false, alarmTime: '06:30', alarmSoundId: 'gentle-chimes' }).kind).toBe('off');
  });

  it('"set" when configured and enabled', () => {
    expect(resolveAlarmStatus({ alarmConfigured: true, isAlarmSet: true, alarmTime: '06:30', alarmSoundId: 'gentle-chimes' }).kind).toBe('set');
  });

  it('always resolves a real, playable sound label - a missing/unavailable/unknown stored id falls back to the true default, never a stale or blank label (same resolvePlayableAlarmSound AlarmContext.jsx itself plays on ring)', () => {
    expect(resolveAlarmStatus({ alarmConfigured: true, isAlarmSet: true, alarmTime: '06:30', alarmSoundId: 'morning-piano' }).soundLabel).toBe('Gentle Chimes');
    expect(resolveAlarmStatus({ alarmConfigured: true, isAlarmSet: true, alarmTime: '06:30', alarmSoundId: 'not-a-real-id' }).soundLabel).toBe('Gentle Chimes');
    expect(resolveAlarmStatus({ alarmConfigured: true, isAlarmSet: true, alarmTime: '06:30', alarmSoundId: undefined }).soundLabel).toBe('Gentle Chimes');
    expect(resolveAlarmStatus({ alarmConfigured: true, isAlarmSet: true, alarmTime: '06:30', alarmSoundId: 'gentle-chimes' }).soundLabel).toBe('Gentle Chimes');
  });
});

describe('getAlarmStatusCardCopy — first-use variant', () => {
  const base = { variant: 'first-use', alarmTime: '06:30', alarmSoundId: 'gentle-chimes' };

  it('unset: "Wake-up alarm not set" / choose a time and sound / Set alarm', () => {
    const copy = getAlarmStatusCardCopy({ ...base, alarmConfigured: false, isAlarmSet: true });
    expect(copy).toEqual({
      kind: 'unset',
      heading: 'Wake-up alarm not set',
      detail: 'Choose a time and sound for your morning.',
      actionLabel: 'Set alarm'
    });
  });

  it('off: "Morning alarm is off" / paused / Manage alarm', () => {
    const copy = getAlarmStatusCardCopy({ ...base, alarmConfigured: true, isAlarmSet: false });
    expect(copy).toEqual({
      kind: 'off',
      heading: 'Morning alarm is off',
      detail: 'Your wake-up alarm is currently paused.',
      actionLabel: 'Manage alarm'
    });
  });

  it('set: "Alarm set for 6:30 AM" / sound name alone / Change alarm', () => {
    const copy = getAlarmStatusCardCopy({ ...base, alarmConfigured: true, isAlarmSet: true });
    expect(copy).toEqual({
      kind: 'set',
      heading: 'Alarm set for 6:30 AM',
      detail: 'Gentle Chimes',
      actionLabel: 'Change alarm'
    });
  });
});

describe('getAlarmStatusCardCopy — returning variant', () => {
  const base = { variant: 'returning', alarmTime: '06:30', alarmSoundId: 'gentle-chimes' };

  it('unset: "Set a wake-up alarm" / wake gently.../ Set alarm', () => {
    const copy = getAlarmStatusCardCopy({ ...base, alarmConfigured: false, isAlarmSet: true });
    expect(copy).toEqual({
      kind: 'unset',
      heading: 'Set a wake-up alarm',
      detail: 'Wake gently, then begin your guided morning routine.',
      actionLabel: 'Set alarm'
    });
  });

  it('off: identical copy to the first-use variant', () => {
    const copy = getAlarmStatusCardCopy({ ...base, alarmConfigured: true, isAlarmSet: false });
    expect(copy).toEqual({
      kind: 'off',
      heading: 'Morning alarm is off',
      detail: 'Your wake-up alarm is currently paused.',
      actionLabel: 'Manage alarm'
    });
  });

  it('set: "Morning alarm set" / "6:30 AM · Gentle Chimes" / Change alarm', () => {
    const copy = getAlarmStatusCardCopy({ ...base, alarmConfigured: true, isAlarmSet: true });
    expect(copy).toEqual({
      kind: 'set',
      heading: 'Morning alarm set',
      detail: '6:30 AM · Gentle Chimes',
      actionLabel: 'Change alarm'
    });
  });
});

describe('getAlarmStatusCardCopy — invalid stored time falls back to the raw value, never a blank/broken heading', () => {
  it('an unparseable alarmTime still produces a real heading string, using the raw value verbatim', () => {
    const copy = getAlarmStatusCardCopy({
      variant: 'first-use',
      alarmConfigured: true,
      isAlarmSet: true,
      alarmTime: 'garbage',
      alarmSoundId: 'gentle-chimes'
    });
    expect(copy.heading).toBe('Alarm set for garbage');
    expect(copy.heading).not.toContain('null');
    expect(copy.heading).not.toContain('undefined');
  });
});

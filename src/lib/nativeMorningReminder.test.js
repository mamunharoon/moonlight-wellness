import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocked before importing the module under test so its module-scope
// `import { LocalNotifications } from '@capacitor/local-notifications'`
// binds to these mocks.
const mockLocalNotifications = {
  schedule: vi.fn(),
  cancel: vi.fn(),
  getPending: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
};
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: mockLocalNotifications,
}));

let nativeFlag = true;
vi.mock('./platform', () => ({
  isNativePlatform: () => nativeFlag,
}));

const mod = await import('./nativeMorningReminder');
const {
  MORNING_REMINDER_NOTIFICATION_ID,
  parseWakeTime,
  resolveTapTarget,
  isSupported,
  checkPermission,
  requestPermission,
  scheduleMorningReminder,
  cancelMorningReminder,
  getPendingMorningReminder,
  enableMorningReminder,
  disableMorningReminder,
} = mod;

beforeEach(() => {
  nativeFlag = true;
  vi.clearAllMocks();
});

describe('parseWakeTime', () => {
  it('parses valid HH:MM 24h times', () => {
    expect(parseWakeTime('07:00')).toEqual({ hour: 7, minute: 0 });
    expect(parseWakeTime('00:00')).toEqual({ hour: 0, minute: 0 });
    expect(parseWakeTime('23:59')).toEqual({ hour: 23, minute: 59 });
  });

  it('rejects invalid or malformed wake times', () => {
    expect(parseWakeTime('24:00')).toBeNull();
    expect(parseWakeTime('7:00')).toBeNull();
    expect(parseWakeTime('07:60')).toBeNull();
    expect(parseWakeTime('not-a-time')).toBeNull();
    expect(parseWakeTime('')).toBeNull();
    expect(parseWakeTime(null)).toBeNull();
    expect(parseWakeTime(undefined)).toBeNull();
    expect(parseWakeTime(700)).toBeNull();
  });
});

describe('MORNING_REMINDER_NOTIFICATION_ID', () => {
  it('is a fixed, stable integer', () => {
    expect(Number.isInteger(MORNING_REMINDER_NOTIFICATION_ID)).toBe(true);
    expect(MORNING_REMINDER_NOTIFICATION_ID).toBe(990001);
  });
});

describe('resolveTapTarget', () => {
  const validNotification = {
    id: MORNING_REMINDER_NOTIFICATION_ID,
    extra: { target: 'morning-reminder' },
  };

  it('resolves the fixed morning-routine route for a genuine reminder tap', () => {
    expect(resolveTapTarget({ notification: validNotification })).toBe('/morning-start');
  });

  it('rejects a mismatched notification id', () => {
    expect(resolveTapTarget({ notification: { ...validNotification, id: 1 } })).toBeNull();
  });

  it('rejects a payload with the right id but an untrusted/mismatched extra.target', () => {
    expect(
      resolveTapTarget({ notification: { ...validNotification, extra: { target: '/admin' } } })
    ).toBeNull();
  });

  it('rejects missing/malformed payloads without throwing', () => {
    expect(resolveTapTarget({})).toBeNull();
    expect(resolveTapTarget(null)).toBeNull();
    expect(resolveTapTarget(undefined)).toBeNull();
  });
});

describe('scheduleMorningReminder', () => {
  it('schedules with the fixed id, calendar-based on:{hour,minute}, and no sensitive content', async () => {
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    const ok = await scheduleMorningReminder('07:30');
    expect(ok).toBe(true);
    expect(mockLocalNotifications.schedule).toHaveBeenCalledTimes(1);
    const [{ notifications }] = mockLocalNotifications.schedule.mock.calls[0];
    expect(notifications).toHaveLength(1);
    const [n] = notifications;
    expect(n.id).toBe(MORNING_REMINDER_NOTIFICATION_ID);
    expect(n.schedule).toEqual({ on: { hour: 7, minute: 30 } });
    expect(n.title).toBe('Good morning');
    expect(n.body).toBe('Your WakeWise morning routine is ready.');
    expect(n.extra).toEqual({ target: 'morning-reminder' });
  });

  it('rejects an invalid wake time without calling the native plugin', async () => {
    const ok = await scheduleMorningReminder('25:99');
    expect(ok).toBe(false);
    expect(mockLocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it('rescheduling reuses the same id instead of accumulating a new one', async () => {
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    await scheduleMorningReminder('07:00');
    await scheduleMorningReminder('08:15');
    expect(mockLocalNotifications.schedule).toHaveBeenCalledTimes(2);
    const firstId = mockLocalNotifications.schedule.mock.calls[0][0].notifications[0].id;
    const secondId = mockLocalNotifications.schedule.mock.calls[1][0].notifications[0].id;
    expect(firstId).toBe(MORNING_REMINDER_NOTIFICATION_ID);
    expect(secondId).toBe(MORNING_REMINDER_NOTIFICATION_ID);
  });

  it('returns false instead of throwing if the native call rejects', async () => {
    mockLocalNotifications.schedule.mockRejectedValue(new Error('boom'));
    await expect(scheduleMorningReminder('07:00')).resolves.toBe(false);
  });
});

describe('cancelMorningReminder', () => {
  it('cancels the reminder by its fixed id', async () => {
    mockLocalNotifications.cancel.mockResolvedValue(undefined);
    const ok = await cancelMorningReminder();
    expect(ok).toBe(true);
    expect(mockLocalNotifications.cancel).toHaveBeenCalledWith({
      notifications: [{ id: MORNING_REMINDER_NOTIFICATION_ID }],
    });
  });
});

describe('enableMorningReminder', () => {
  it('schedules once permission is already granted', async () => {
    mockLocalNotifications.checkPermissions.mockResolvedValue({ display: 'granted' });
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    const result = await enableMorningReminder('07:00');
    expect(result).toEqual({ ok: true, permission: 'granted' });
    expect(mockLocalNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(mockLocalNotifications.schedule).toHaveBeenCalledTimes(1);
  });

  it('requests permission when not yet granted, then schedules on approval', async () => {
    mockLocalNotifications.checkPermissions.mockResolvedValue({ display: 'prompt' });
    mockLocalNotifications.requestPermissions.mockResolvedValue({ display: 'granted' });
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    const result = await enableMorningReminder('07:00');
    expect(result.ok).toBe(true);
    expect(mockLocalNotifications.requestPermissions).toHaveBeenCalledTimes(1);
    expect(mockLocalNotifications.schedule).toHaveBeenCalledTimes(1);
  });

  it('does not schedule when permission is denied', async () => {
    mockLocalNotifications.checkPermissions.mockResolvedValue({ display: 'prompt' });
    mockLocalNotifications.requestPermissions.mockResolvedValue({ display: 'denied' });
    const result = await enableMorningReminder('07:00');
    expect(result).toEqual({ ok: false, permission: 'denied' });
    expect(mockLocalNotifications.schedule).not.toHaveBeenCalled();
  });
});

describe('disableMorningReminder', () => {
  it('cancels the pending reminder', async () => {
    mockLocalNotifications.cancel.mockResolvedValue(undefined);
    const result = await disableMorningReminder();
    expect(result).toEqual({ ok: true });
    expect(mockLocalNotifications.cancel).toHaveBeenCalledTimes(1);
  });
});

describe('web / non-native platform safety', () => {
  beforeEach(() => {
    nativeFlag = false;
  });

  it('never touches the native plugin and never throws when unsupported', async () => {
    expect(isSupported()).toBe(false);
    await expect(checkPermission()).resolves.toBe('unsupported');
    await expect(requestPermission()).resolves.toBe('unsupported');
    await expect(scheduleMorningReminder('07:00')).resolves.toBe(false);
    await expect(cancelMorningReminder()).resolves.toBe(false);
    await expect(getPendingMorningReminder()).resolves.toBeNull();
    await expect(enableMorningReminder('07:00')).resolves.toEqual({ ok: false, permission: 'unsupported' });
    await expect(disableMorningReminder()).resolves.toEqual({ ok: false });

    expect(mockLocalNotifications.schedule).not.toHaveBeenCalled();
    expect(mockLocalNotifications.cancel).not.toHaveBeenCalled();
    expect(mockLocalNotifications.checkPermissions).not.toHaveBeenCalled();
    expect(mockLocalNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(mockLocalNotifications.getPending).not.toHaveBeenCalled();
  });
});

describe('getPendingMorningReminder', () => {
  it('finds the reminder among other pending notifications by id', async () => {
    mockLocalNotifications.getPending.mockResolvedValue({
      notifications: [
        { id: 1, title: 'unrelated' },
        { id: MORNING_REMINDER_NOTIFICATION_ID, title: 'Good morning', schedule: { on: { hour: 7, minute: 0 } } },
      ],
    });
    const pending = await getPendingMorningReminder();
    expect(pending?.id).toBe(MORNING_REMINDER_NOTIFICATION_ID);
  });

  it('returns null when nothing is pending', async () => {
    mockLocalNotifications.getPending.mockResolvedValue({ notifications: [] });
    await expect(getPendingMorningReminder()).resolves.toBeNull();
  });
});

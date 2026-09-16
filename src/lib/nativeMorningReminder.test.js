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
  registerActionTypes: vi.fn(),
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
  // Complete Native Wake Reminder Functionality
  ALL_MORNING_REMINDER_WEEKDAYS,
  MORNING_REMINDER_WEEKDAY_ID_BASE,
  MORNING_REMINDER_SNOOZE_NOTIFICATION_ID,
  MORNING_REMINDER_ACTION_TYPE_ID,
  MORNING_REMINDER_ACTIONS,
  MORNING_REMINDER_SNOOZE_MINUTES,
  MORNING_REMINDER_ALARM_ROUTE,
  MORNING_REMINDER_DEFAULT_SOUND,
  isValidMorningReminderWeekday,
  getWeekdayReminderId,
  getAllOwnedMorningReminderIds,
  formatMorningReminderScheduleSummary,
  registerMorningReminderActions,
  applyMorningReminderSchedule,
  cancelAllMorningReminders,
  getPendingMorningReminderWeekdays,
  scheduleSnoozeMorningReminder,
  cancelSnoozeMorningReminder,
  handleMorningReminderAction,
  validateWeekdaySelectionChange,
  decideMorningReminderReconciliation
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

  // Complete Native Wake Reminder Functionality: this is the one
  // deliberate behaviour change to an existing assertion in this file —
  // the task's own confirmed gap was "notification tap opens the routine
  // Step 1 page ('/morning-start') rather than the actual alarm/decision
  // screen." resolveTapTarget now resolves to the real alarm screen
  // (AlarmActive.jsx, '/alarm-trigger' — see MORNING_REMINDER_ALARM_ROUTE's
  // own comment for the audit evidence) instead. No other existing test
  // in this file was changed.
  it('resolves the real alarm/decision screen for a genuine reminder tap', () => {
    expect(resolveTapTarget({ notification: validNotification })).toBe('/alarm-trigger');
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

// ---------------------------------------------------------------------
// Complete Native Wake Reminder Functionality — weekday scheduling,
// notification actions, snooze, and reconciliation.
// ---------------------------------------------------------------------

describe('weekday id scheme', () => {
  it('produces a stable, deterministic id per weekday, distinct from the legacy and snooze ids', () => {
    expect(ALL_MORNING_REMINDER_WEEKDAYS).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const ids = ALL_MORNING_REMINDER_WEEKDAYS.map(getWeekdayReminderId);
    expect(new Set(ids).size).toBe(7); // no collisions with each other
    expect(ids).not.toContain(MORNING_REMINDER_NOTIFICATION_ID);
    expect(ids).not.toContain(MORNING_REMINDER_SNOOZE_NOTIFICATION_ID);
    ids.forEach((id) => expect(id).toBe(MORNING_REMINDER_WEEKDAY_ID_BASE + ALL_MORNING_REMINDER_WEEKDAYS[ids.indexOf(id)]));
    // Stable across repeated calls, not re-derived differently each time.
    expect(getWeekdayReminderId(3)).toBe(getWeekdayReminderId(3));
  });

  it('rejects an invalid weekday rather than returning a wrong/colliding id', () => {
    expect(getWeekdayReminderId(0)).toBeNull();
    expect(getWeekdayReminderId(8)).toBeNull();
    expect(getWeekdayReminderId(3.5)).toBeNull();
    expect(getWeekdayReminderId('3')).toBeNull();
    expect(isValidMorningReminderWeekday(1)).toBe(true);
    expect(isValidMorningReminderWeekday(7)).toBe(true);
    expect(isValidMorningReminderWeekday(0)).toBe(false);
    expect(isValidMorningReminderWeekday(8)).toBe(false);
  });

  it('MORNING_REMINDER_SNOOZE_NOTIFICATION_ID is a fixed, stable integer distinct from every other owned id', () => {
    expect(Number.isInteger(MORNING_REMINDER_SNOOZE_NOTIFICATION_ID)).toBe(true);
    expect(MORNING_REMINDER_SNOOZE_NOTIFICATION_ID).toBe(990020);
    expect(ALL_MORNING_REMINDER_WEEKDAYS.map(getWeekdayReminderId)).not.toContain(MORNING_REMINDER_SNOOZE_NOTIFICATION_ID);
  });

  it('getAllOwnedMorningReminderIds includes the legacy id, every weekday id, and the snooze id, with no duplicates', () => {
    const ids = getAllOwnedMorningReminderIds();
    expect(ids).toContain(MORNING_REMINDER_NOTIFICATION_ID);
    expect(ids).toContain(MORNING_REMINDER_SNOOZE_NOTIFICATION_ID);
    ALL_MORNING_REMINDER_WEEKDAYS.forEach((day) => expect(ids).toContain(getWeekdayReminderId(day)));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('applyMorningReminderSchedule', () => {
  it('seven selected days produce seven scheduled notifications, one per weekday id', async () => {
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    mockLocalNotifications.cancel.mockResolvedValue(undefined);
    const ok = await applyMorningReminderSchedule('07:00', ALL_MORNING_REMINDER_WEEKDAYS);
    expect(ok).toBe(true);
    const [{ notifications }] = mockLocalNotifications.schedule.mock.calls[0];
    expect(notifications).toHaveLength(7);
    expect(notifications.map((n) => n.id).sort((a, b) => a - b)).toEqual(
      ALL_MORNING_REMINDER_WEEKDAYS.map(getWeekdayReminderId).sort((a, b) => a - b)
    );
  });

  it('a selected subset schedules only that subset, and cancels every unselected weekday id plus the legacy id', async () => {
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    mockLocalNotifications.cancel.mockResolvedValue(undefined);
    await applyMorningReminderSchedule('07:00', [2, 4, 6]); // Mon, Wed, Fri
    const [{ notifications }] = mockLocalNotifications.schedule.mock.calls[0];
    expect(notifications.map((n) => n.id).sort((a, b) => a - b)).toEqual(
      [2, 4, 6].map(getWeekdayReminderId).sort((a, b) => a - b)
    );
    const [{ notifications: cancelled }] = mockLocalNotifications.cancel.mock.calls[0];
    const cancelledIds = cancelled.map((n) => n.id);
    expect(cancelledIds).toContain(MORNING_REMINDER_NOTIFICATION_ID); // legacy id cleanup
    [1, 3, 5, 7].forEach((day) => expect(cancelledIds).toContain(getWeekdayReminderId(day))); // Sun/Tue/Thu/Sat obsolete
    [2, 4, 6].forEach((day) => expect(cancelledIds).not.toContain(getWeekdayReminderId(day))); // still-selected days untouched by cancel
  });

  it('changing the selection cancels exactly the obsolete weekday ids on the next call', async () => {
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    mockLocalNotifications.cancel.mockResolvedValue(undefined);
    await applyMorningReminderSchedule('07:00', [1, 2, 3]);
    await applyMorningReminderSchedule('07:00', [1, 2]); // day 3 dropped
    const [{ notifications: secondCancel }] = mockLocalNotifications.cancel.mock.calls[1];
    expect(secondCancel.map((n) => n.id)).toContain(getWeekdayReminderId(3));
  });

  it('repeated scheduling of the same selection produces the exact same ids every time — no accumulation', async () => {
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    mockLocalNotifications.cancel.mockResolvedValue(undefined);
    await applyMorningReminderSchedule('07:00', [2, 3]);
    await applyMorningReminderSchedule('07:15', [2, 3]);
    const firstIds = mockLocalNotifications.schedule.mock.calls[0][0].notifications.map((n) => n.id).sort();
    const secondIds = mockLocalNotifications.schedule.mock.calls[1][0].notifications.map((n) => n.id).sort();
    expect(firstIds).toEqual(secondIds);
  });

  it('uses the documented default-sound literal and suppresses the foreground banner (silent) by default', async () => {
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    mockLocalNotifications.cancel.mockResolvedValue(undefined);
    await applyMorningReminderSchedule('07:00', [1]);
    const [{ notifications }] = mockLocalNotifications.schedule.mock.calls[0];
    expect(notifications[0].sound).toBe(MORNING_REMINDER_DEFAULT_SOUND);
    expect(notifications[0].silent).toBe(true);
    expect(notifications[0].actionTypeId).toBe(MORNING_REMINDER_ACTION_TYPE_ID);
    expect(notifications[0].extra).toEqual({ target: 'morning-reminder' });
    expect(notifications[0].title).toBe('Good morning');
    expect(notifications[0].body).toBe('Your WakeWise morning routine is ready.');
  });

  it('accepts a caller-supplied sound filename instead of the default', async () => {
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    mockLocalNotifications.cancel.mockResolvedValue(undefined);
    await applyMorningReminderSchedule('07:00', [1], { sound: 'wakewise-chime.wav' });
    const [{ notifications }] = mockLocalNotifications.schedule.mock.calls[0];
    expect(notifications[0].sound).toBe('wakewise-chime.wav');
  });

  it('an invalid or malformed weekday selection falls back to every day', async () => {
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    mockLocalNotifications.cancel.mockResolvedValue(undefined);
    await applyMorningReminderSchedule('07:00', []);
    expect(mockLocalNotifications.schedule.mock.calls[0][0].notifications).toHaveLength(7);
  });

  it('rejects an invalid wake time without calling the native plugin at all', async () => {
    const ok = await applyMorningReminderSchedule('not-a-time', [1]);
    expect(ok).toBe(false);
    expect(mockLocalNotifications.schedule).not.toHaveBeenCalled();
    expect(mockLocalNotifications.cancel).not.toHaveBeenCalled();
  });

  it('returns false instead of throwing if the native call rejects', async () => {
    mockLocalNotifications.cancel.mockResolvedValue(undefined);
    mockLocalNotifications.schedule.mockRejectedValue(new Error('boom'));
    await expect(applyMorningReminderSchedule('07:00', [1])).resolves.toBe(false);
  });
});

describe('cancelAllMorningReminders', () => {
  it('cancels every owned id — the full weekday set, the snooze id, and the legacy id — and nothing else', async () => {
    mockLocalNotifications.cancel.mockResolvedValue(undefined);
    const ok = await cancelAllMorningReminders();
    expect(ok).toBe(true);
    const [{ notifications }] = mockLocalNotifications.cancel.mock.calls[0];
    const ids = notifications.map((n) => n.id);
    expect(ids.sort((a, b) => a - b)).toEqual(getAllOwnedMorningReminderIds().sort((a, b) => a - b));
  });
});

describe('getPendingMorningReminderWeekdays', () => {
  it('reports only the weekdays whose id is actually pending on-device', async () => {
    mockLocalNotifications.getPending.mockResolvedValue({
      notifications: [
        { id: getWeekdayReminderId(2) },
        { id: getWeekdayReminderId(5) },
        { id: 12345 }, // unrelated notification, must be ignored
        { id: MORNING_REMINDER_SNOOZE_NOTIFICATION_ID }
      ]
    });
    await expect(getPendingMorningReminderWeekdays()).resolves.toEqual([2, 5]);
  });

  it('returns an empty array when nothing owned is pending', async () => {
    mockLocalNotifications.getPending.mockResolvedValue({ notifications: [] });
    await expect(getPendingMorningReminderWeekdays()).resolves.toEqual([]);
  });
});

describe('scheduleSnoozeMorningReminder / cancelSnoozeMorningReminder', () => {
  it('schedules exactly one, deterministic, one-time snooze notification at the documented fixed duration', async () => {
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    const before = Date.now();
    const ok = await scheduleSnoozeMorningReminder();
    expect(ok).toBe(true);
    expect(MORNING_REMINDER_SNOOZE_MINUTES).toBe(10);
    const [{ notifications }] = mockLocalNotifications.schedule.mock.calls[0];
    expect(notifications).toHaveLength(1);
    expect(notifications[0].id).toBe(MORNING_REMINDER_SNOOZE_NOTIFICATION_ID);
    expect(notifications[0].schedule.at.getTime()).toBeGreaterThanOrEqual(before + MORNING_REMINDER_SNOOZE_MINUTES * 60 * 1000 - 1000);
    expect(notifications[0].actionTypeId).toBe(MORNING_REMINDER_ACTION_TYPE_ID);
    expect(notifications[0].extra).toEqual({ target: 'morning-reminder' });
  });

  it('snoozing again replaces the same pending snooze rather than accumulating a second one', async () => {
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    await scheduleSnoozeMorningReminder();
    await scheduleSnoozeMorningReminder();
    expect(mockLocalNotifications.schedule).toHaveBeenCalledTimes(2);
    const firstId = mockLocalNotifications.schedule.mock.calls[0][0].notifications[0].id;
    const secondId = mockLocalNotifications.schedule.mock.calls[1][0].notifications[0].id;
    expect(firstId).toBe(secondId); // same fixed id -> iOS replaces, never accumulates
  });

  it('never schedules or cancels any weekday id — the next regular reminder is preserved untouched', async () => {
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    mockLocalNotifications.cancel.mockResolvedValue(undefined);
    await scheduleSnoozeMorningReminder();
    expect(mockLocalNotifications.cancel).not.toHaveBeenCalled();
    const [{ notifications }] = mockLocalNotifications.schedule.mock.calls[0];
    expect(notifications.every((n) => n.id !== getWeekdayReminderId(1))).toBe(true);
  });

  it('cancelSnoozeMorningReminder cancels only the snooze id', async () => {
    mockLocalNotifications.cancel.mockResolvedValue(undefined);
    await cancelSnoozeMorningReminder();
    expect(mockLocalNotifications.cancel).toHaveBeenCalledWith({
      notifications: [{ id: MORNING_REMINDER_SNOOZE_NOTIFICATION_ID }]
    });
  });
});

describe('registerMorningReminderActions', () => {
  it('registers the fixed Begin/Snooze/Skip action type — Begin foregrounds, Snooze/Skip do not', async () => {
    mockLocalNotifications.registerActionTypes.mockResolvedValue(undefined);
    const ok = await registerMorningReminderActions();
    expect(ok).toBe(true);
    const [{ types }] = mockLocalNotifications.registerActionTypes.mock.calls[0];
    expect(types).toHaveLength(1);
    expect(types[0].id).toBe(MORNING_REMINDER_ACTION_TYPE_ID);
    const byId = Object.fromEntries(types[0].actions.map((a) => [a.id, a]));
    expect(Object.keys(byId).sort()).toEqual(['begin', 'skip', 'snooze']);
    expect(byId[MORNING_REMINDER_ACTIONS.BEGIN].foreground).toBe(true);
    expect(byId[MORNING_REMINDER_ACTIONS.SNOOZE].foreground).toBe(false);
    expect(byId[MORNING_REMINDER_ACTIONS.SKIP].foreground).toBe(false);
  });

  it('returns false instead of throwing if registration fails', async () => {
    mockLocalNotifications.registerActionTypes.mockRejectedValue(new Error('boom'));
    await expect(registerMorningReminderActions()).resolves.toBe(false);
  });
});

describe('handleMorningReminderAction', () => {
  const ownedNotification = (id = getWeekdayReminderId(2)) => ({ id, extra: { target: 'morning-reminder' } });

  it('a default tap ("tap") on an owned notification resolves the real alarm/decision screen', async () => {
    await expect(
      handleMorningReminderAction({ actionId: 'tap', notification: ownedNotification() })
    ).resolves.toEqual({ route: MORNING_REMINDER_ALARM_ROUTE });
  });

  it('the Begin action resolves the same alarm/decision screen, allow-listed by fixed id', async () => {
    await expect(
      handleMorningReminderAction({ actionId: MORNING_REMINDER_ACTIONS.BEGIN, notification: ownedNotification() })
    ).resolves.toEqual({ route: MORNING_REMINDER_ALARM_ROUTE });
  });

  it('Snooze schedules exactly one replacement notification and returns no navigation route', async () => {
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    const result = await handleMorningReminderAction({
      actionId: MORNING_REMINDER_ACTIONS.SNOOZE,
      notification: ownedNotification()
    });
    expect(result).toEqual({ route: null });
    expect(mockLocalNotifications.schedule).toHaveBeenCalledTimes(1);
    expect(mockLocalNotifications.schedule.mock.calls[0][0].notifications[0].id).toBe(MORNING_REMINDER_SNOOZE_NOTIFICATION_ID);
  });

  it('Skip cancels any pending snooze, preserves every future regular weekday reminder, and does not disable the reminder', async () => {
    mockLocalNotifications.cancel.mockResolvedValue(undefined);
    const result = await handleMorningReminderAction({
      actionId: MORNING_REMINDER_ACTIONS.SKIP,
      notification: ownedNotification()
    });
    expect(result).toEqual({ route: null });
    expect(mockLocalNotifications.cancel).toHaveBeenCalledWith({
      notifications: [{ id: MORNING_REMINDER_SNOOZE_NOTIFICATION_ID }]
    });
    expect(mockLocalNotifications.cancel).toHaveBeenCalledTimes(1); // never touches any weekday id
  });

  it('rejects an unrecognised action id with no side effect at all', async () => {
    const result = await handleMorningReminderAction({ actionId: 'dismiss', notification: ownedNotification() });
    expect(result).toEqual({ route: null });
    expect(mockLocalNotifications.schedule).not.toHaveBeenCalled();
    expect(mockLocalNotifications.cancel).not.toHaveBeenCalled();
  });

  it('rejects an action on a notification id this feature does not own', async () => {
    const result = await handleMorningReminderAction({
      actionId: MORNING_REMINDER_ACTIONS.BEGIN,
      notification: { id: 12345, extra: { target: 'morning-reminder' } }
    });
    expect(result).toEqual({ route: null });
  });

  it('rejects an owned id with a mismatched/untrusted extra.target', async () => {
    const result = await handleMorningReminderAction({
      actionId: MORNING_REMINDER_ACTIONS.BEGIN,
      notification: { id: getWeekdayReminderId(2), extra: { target: '/admin' } }
    });
    expect(result).toEqual({ route: null });
  });

  it('rejects malformed/missing payloads without throwing', async () => {
    await expect(handleMorningReminderAction(null)).resolves.toEqual({ route: null });
    await expect(handleMorningReminderAction(undefined)).resolves.toEqual({ route: null });
    await expect(handleMorningReminderAction({})).resolves.toEqual({ route: null });
    await expect(handleMorningReminderAction({ actionId: 'tap' })).resolves.toEqual({ route: null });
    await expect(handleMorningReminderAction({ notification: ownedNotification() })).resolves.toEqual({ route: null });
  });

  it('concurrent/duplicate delivery of the same action is idempotent — no error, no inconsistent end state', async () => {
    mockLocalNotifications.schedule.mockResolvedValue({ notifications: [] });
    const payload = { actionId: MORNING_REMINDER_ACTIONS.SNOOZE, notification: ownedNotification() };
    const [first, second] = await Promise.all([handleMorningReminderAction(payload), handleMorningReminderAction(payload)]);
    expect(first).toEqual({ route: null });
    expect(second).toEqual({ route: null });
    // Both calls scheduled the same fixed snooze id — the second is a
    // replacement, not a second distinct pending notification.
    mockLocalNotifications.schedule.mock.calls.forEach((call) => {
      expect(call[0].notifications[0].id).toBe(MORNING_REMINDER_SNOOZE_NOTIFICATION_ID);
    });
  });
});

describe('formatMorningReminderScheduleSummary', () => {
  it('summarises every day selected', () => {
    expect(formatMorningReminderScheduleSummary(ALL_MORNING_REMINDER_WEEKDAYS, '07:30')).toBe('Every day at 07:30');
  });

  it('summarises the Mon-Fri weekdays shortcut', () => {
    expect(formatMorningReminderScheduleSummary([2, 3, 4, 5, 6], '07:00')).toBe('Weekdays at 07:00');
  });

  it('summarises a custom subset in Monday-first order regardless of input order', () => {
    expect(formatMorningReminderScheduleSummary([1, 4, 2], '06:45')).toBe('Mon, Wed, Sun at 06:45');
  });

  it('returns null without a wake time', () => {
    expect(formatMorningReminderScheduleSummary(ALL_MORNING_REMINDER_WEEKDAYS, null)).toBeNull();
  });
});

describe('validateWeekdaySelectionChange', () => {
  it('accepts a valid, unsorted, duplicate-containing selection and normalises it', () => {
    expect(validateWeekdaySelectionChange([5, 2, 2, 7])).toEqual({ ok: true, weekdays: [2, 5, 7] });
  });

  it('refuses (does not fall back to every day) an empty or fully-invalid selection', () => {
    expect(validateWeekdaySelectionChange([])).toEqual({ ok: false, weekdays: null });
    expect(validateWeekdaySelectionChange([0, 8, 99])).toEqual({ ok: false, weekdays: null });
  });

  it('refuses a malformed (non-array) input the same way', () => {
    expect(validateWeekdaySelectionChange(null)).toEqual({ ok: false, weekdays: null });
    expect(validateWeekdaySelectionChange('everyday')).toEqual({ ok: false, weekdays: null });
  });
});

describe('decideMorningReminderReconciliation', () => {
  const base = { intentEnabled: true, wakeTime: '07:00', weekdays: [1, 2, 3], fingerprint: 'fp-a', lastReconciledFingerprint: 'fp-a' };

  it('permission denied with something pending: cancel it, show honestly off', () => {
    expect(
      decideMorningReminderReconciliation({ ...base, permission: 'denied', pendingWeekdays: [1, 2, 3] })
    ).toEqual({ action: 'cancel-all', liveEnabled: false, scheduledTime: null });
  });

  it('permission denied with nothing pending: no-op', () => {
    expect(decideMorningReminderReconciliation({ ...base, permission: 'denied', pendingWeekdays: [] })).toEqual({
      action: 'none',
      liveEnabled: false,
      scheduledTime: null
    });
  });

  it('permission not yet decided (prompt): never schedules, never implies a request was made', () => {
    expect(decideMorningReminderReconciliation({ ...base, permission: 'prompt', pendingWeekdays: [] })).toEqual({
      action: 'none',
      liveEnabled: false,
      scheduledTime: null
    });
    expect(decideMorningReminderReconciliation({ ...base, permission: 'prompt-with-rationale', pendingWeekdays: [] }).action).toBe(
      'none'
    );
  });

  it('permission granted after returning from Settings, with the stored preference still enabled: schedules', () => {
    expect(
      decideMorningReminderReconciliation({
        ...base,
        permission: 'granted',
        pendingWeekdays: [],
        fingerprint: 'fp-new',
        lastReconciledFingerprint: null
      })
    ).toEqual({ action: 'apply-schedule', liveEnabled: true, scheduledTime: '07:00' });
  });

  it('user intent is off: cancels anything stray, never schedules', () => {
    expect(
      decideMorningReminderReconciliation({ ...base, intentEnabled: false, permission: 'granted', pendingWeekdays: [1] })
    ).toEqual({ action: 'cancel-all', liveEnabled: false, scheduledTime: null });
  });

  it('unchanged fingerprint and matching pending state: no unnecessary rescheduling', () => {
    expect(
      decideMorningReminderReconciliation({ ...base, permission: 'granted', pendingWeekdays: [1, 2, 3] })
    ).toEqual({ action: 'none', liveEnabled: true, scheduledTime: '07:00' });
  });

  it('a changed fingerprint (e.g. a timezone/DST offset change) triggers exactly one reconciliation', () => {
    expect(
      decideMorningReminderReconciliation({ ...base, permission: 'granted', pendingWeekdays: [1, 2, 3], fingerprint: 'fp-b' })
    ).toEqual({ action: 'apply-schedule', liveEnabled: true, scheduledTime: '07:00' });
  });

  it('an unchanged fingerprint but device-truth mismatch (e.g. iOS dropped a pending notification) still reschedules', () => {
    expect(
      decideMorningReminderReconciliation({ ...base, permission: 'granted', pendingWeekdays: [1, 2] })
    ).toEqual({ action: 'apply-schedule', liveEnabled: true, scheduledTime: '07:00' });
  });
});

describe('web / non-native platform safety (Complete Native Wake Reminder Functionality additions)', () => {
  beforeEach(() => {
    nativeFlag = false;
  });

  it('every new native-facing function no-ops safely and never touches the plugin', async () => {
    await expect(registerMorningReminderActions()).resolves.toBe(false);
    await expect(applyMorningReminderSchedule('07:00', [1])).resolves.toBe(false);
    await expect(cancelAllMorningReminders()).resolves.toBe(false);
    await expect(getPendingMorningReminderWeekdays()).resolves.toEqual([]);
    await expect(scheduleSnoozeMorningReminder()).resolves.toBe(false);
    await expect(cancelSnoozeMorningReminder()).resolves.toBe(false);

    expect(mockLocalNotifications.schedule).not.toHaveBeenCalled();
    expect(mockLocalNotifications.cancel).not.toHaveBeenCalled();
    expect(mockLocalNotifications.getPending).not.toHaveBeenCalled();
    expect(mockLocalNotifications.registerActionTypes).not.toHaveBeenCalled();
  });
});

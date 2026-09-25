import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildAlarmOccurrenceKey,
  getHandledAlarmOccurrence,
  markAlarmOccurrenceHandled,
  clearHandledAlarmOccurrence,
} from './alarmOccurrence';

// This suite's vite.config.js test environment is 'node' (no DOM, no
// global localStorage) - alarmOccurrence.js's own try/catch around every
// localStorage call already tolerates that (see its "Storage unavailable"
// comments), but that would make every persistence assertion below
// observe a permanent no-op instead of exercising the real read/write
// path. A minimal in-memory Storage-compatible shim gives the module's
// real, unmodified code a real localStorage to call - still genuine
// execution of buildAlarmOccurrenceKey/markAlarmOccurrenceHandled/
// getHandledAlarmOccurrence/clearHandledAlarmOccurrence, not a mock of
// them.
class MemoryStorage {
  #store = new Map();
  getItem(key) { return this.#store.has(key) ? this.#store.get(key) : null; }
  setItem(key, value) { this.#store.set(key, String(value)); }
  removeItem(key) { this.#store.delete(key); }
}
globalThis.localStorage = new MemoryStorage();

// Same-minute re-trigger defect fix — real-execution tests. Pure
// functions plus real (jsdom/node-shim) localStorage, no component
// rendering required.
describe('buildAlarmOccurrenceKey', () => {
  it('combines identity, dateKey and alarmTime into one exact key', () => {
    expect(buildAlarmOccurrenceKey({ identity: 'user-123', dateKey: '2026-09-24', alarmTime: '07:30' }))
      .toBe('user-123:2026-09-24T07:30');
  });

  it('falls back to the literal "guest" when identity is missing/falsy', () => {
    expect(buildAlarmOccurrenceKey({ identity: null, dateKey: '2026-09-24', alarmTime: '07:30' }))
      .toBe('guest:2026-09-24T07:30');
    expect(buildAlarmOccurrenceKey({ identity: undefined, dateKey: '2026-09-24', alarmTime: '07:30' }))
      .toBe('guest:2026-09-24T07:30');
    expect(buildAlarmOccurrenceKey({ identity: '', dateKey: '2026-09-24', alarmTime: '07:30' }))
      .toBe('guest:2026-09-24T07:30');
  });

  it('two different users on the exact same date+time produce two different keys (identity scoping)', () => {
    const a = buildAlarmOccurrenceKey({ identity: 'user-A', dateKey: '2026-09-24', alarmTime: '07:30' });
    const b = buildAlarmOccurrenceKey({ identity: 'user-B', dateKey: '2026-09-24', alarmTime: '07:30' });
    expect(a).not.toBe(b);
  });

  it('the same user on two different calendar dates produces two different keys (local date separation, next-day recurrence)', () => {
    const day1 = buildAlarmOccurrenceKey({ identity: 'user-A', dateKey: '2026-09-24', alarmTime: '07:30' });
    const day2 = buildAlarmOccurrenceKey({ identity: 'user-A', dateKey: '2026-09-25', alarmTime: '07:30' });
    expect(day1).not.toBe(day2);
  });

  it('the same user on the same date but a different alarmTime produces two different keys (edited alarm time, snooze target)', () => {
    const original = buildAlarmOccurrenceKey({ identity: 'user-A', dateKey: '2026-09-24', alarmTime: '07:30' });
    const snoozed = buildAlarmOccurrenceKey({ identity: 'user-A', dateKey: '2026-09-24', alarmTime: '07:35' });
    expect(original).not.toBe(snoozed);
  });
});

describe('markAlarmOccurrenceHandled / getHandledAlarmOccurrence / clearHandledAlarmOccurrence', () => {
  beforeEach(() => {
    clearHandledAlarmOccurrence();
  });

  it('returns null when nothing has ever been marked handled', () => {
    expect(getHandledAlarmOccurrence()).toBeNull();
  });

  it('round-trips exactly the key that was marked handled', () => {
    const key = buildAlarmOccurrenceKey({ identity: 'user-A', dateKey: '2026-09-24', alarmTime: '07:30' });
    markAlarmOccurrenceHandled(key);
    expect(getHandledAlarmOccurrence()).toBe(key);
  });

  it('a later mark overwrites the previous one — single-value storage never grows without limit', () => {
    const first = buildAlarmOccurrenceKey({ identity: 'user-A', dateKey: '2026-09-24', alarmTime: '07:30' });
    const second = buildAlarmOccurrenceKey({ identity: 'user-A', dateKey: '2026-09-24', alarmTime: '07:35' });
    markAlarmOccurrenceHandled(first);
    markAlarmOccurrenceHandled(second);
    expect(getHandledAlarmOccurrence()).toBe(second);
    expect(getHandledAlarmOccurrence()).not.toBe(first);
  });

  it('clearHandledAlarmOccurrence removes the marker entirely (sign-out sweep)', () => {
    const key = buildAlarmOccurrenceKey({ identity: 'user-A', dateKey: '2026-09-24', alarmTime: '07:30' });
    markAlarmOccurrenceHandled(key);
    expect(getHandledAlarmOccurrence()).toBe(key);
    clearHandledAlarmOccurrence();
    expect(getHandledAlarmOccurrence()).toBeNull();
  });

  it('a stale marker from a different identity never matches a freshly-computed key for another identity (cross-user isolation)', () => {
    const userAKey = buildAlarmOccurrenceKey({ identity: 'user-A', dateKey: '2026-09-24', alarmTime: '07:30' });
    markAlarmOccurrenceHandled(userAKey);
    const userBKey = buildAlarmOccurrenceKey({ identity: 'user-B', dateKey: '2026-09-24', alarmTime: '07:30' });
    expect(getHandledAlarmOccurrence()).not.toBe(userBKey);
  });
});

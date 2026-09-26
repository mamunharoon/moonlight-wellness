// WakeWise DEV — alarm wake-up sound picker: focused unit coverage for
// alarmSounds.js, real execution (not just source-text assertions - see
// notificationSettingsAlarmSound.test.js for the source-level wiring
// proof of the picker UI that consumes this module).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ALARM_SOUNDS,
  DEFAULT_ALARM_SOUND_ID,
  getAlarmSoundById,
  resolvePlayableAlarmSound,
  getStoredAlarmSoundId,
  setStoredAlarmSoundId
} from './alarmSounds';

// This repo's Vitest environment is 'node' (no DOM), so there is no
// built-in localStorage - matching alarmOccurrence.test.js's own
// established in-memory shim rather than pulling in jsdom.
class MemoryStorage {
  #store = new Map();
  getItem(key) { return this.#store.has(key) ? this.#store.get(key) : null; }
  setItem(key, value) { this.#store.set(key, String(value)); }
  removeItem(key) { this.#store.delete(key); }
  clear() { this.#store.clear(); }
}
globalThis.localStorage = new MemoryStorage();

describe('ALARM_SOUNDS registry', () => {
  it('has exactly 5 entries, Gentle Chimes first and the only one available', () => {
    expect(ALARM_SOUNDS.length).toBe(5);
    expect(ALARM_SOUNDS[0].id).toBe('gentle-chimes');
    expect(ALARM_SOUNDS.filter((s) => s.available).map((s) => s.id)).toEqual(['gentle-chimes']);
  });

  it('every unavailable sound has no url - never a fallback/unrelated asset silently assigned', () => {
    for (const sound of ALARM_SOUNDS.filter((s) => !s.available)) {
      expect(sound.url).toBeNull();
    }
  });

  it('is frozen - cannot be mutated at runtime', () => {
    expect(Object.isFrozen(ALARM_SOUNDS)).toBe(true);
  });
});

describe('getAlarmSoundById', () => {
  it('finds a real entry by id', () => {
    expect(getAlarmSoundById('gentle-chimes')?.label).toBe('Gentle Chimes');
    expect(getAlarmSoundById('warm-marimba')?.label).toBe('Warm Marimba');
  });

  it('returns null for an unknown id', () => {
    expect(getAlarmSoundById('not-a-real-sound')).toBeNull();
  });
});

describe('resolvePlayableAlarmSound', () => {
  it('returns the sound itself when it is available', () => {
    expect(resolvePlayableAlarmSound('gentle-chimes').id).toBe('gentle-chimes');
  });

  it('falls back to the real default for an unavailable sound', () => {
    const resolved = resolvePlayableAlarmSound('morning-piano');
    expect(resolved.id).toBe(DEFAULT_ALARM_SOUND_ID);
    expect(resolved.available).toBe(true);
    expect(resolved.url).not.toBeNull();
  });

  it('falls back to the real default for a completely unknown id - never throws, never returns null', () => {
    const resolved = resolvePlayableAlarmSound('does-not-exist');
    expect(resolved.id).toBe(DEFAULT_ALARM_SOUND_ID);
  });
});

describe('getStoredAlarmSoundId / setStoredAlarmSoundId — user-scoped persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to the real default sound when nothing is stored', () => {
    expect(getStoredAlarmSoundId(null)).toBe(DEFAULT_ALARM_SOUND_ID);
    expect(getStoredAlarmSoundId('user-123')).toBe(DEFAULT_ALARM_SOUND_ID);
  });

  it('a guest (null userId) and a registered user use different storage keys - selecting one never affects the other', () => {
    setStoredAlarmSoundId(null, 'bright-chimes');
    setStoredAlarmSoundId('user-123', 'warm-marimba');
    expect(getStoredAlarmSoundId(null)).toBe('bright-chimes');
    expect(getStoredAlarmSoundId('user-123')).toBe('warm-marimba');
  });

  it('two different registered users on the same device never see each other\'s selection', () => {
    setStoredAlarmSoundId('user-A', 'morning-piano');
    setStoredAlarmSoundId('user-B', 'birdsong-chimes');
    expect(getStoredAlarmSoundId('user-A')).toBe('morning-piano');
    expect(getStoredAlarmSoundId('user-B')).toBe('birdsong-chimes');
  });

  it('a selection survives being read again later (persists across "edits" - re-reading after re-selecting reflects the latest choice)', () => {
    setStoredAlarmSoundId('user-123', 'bright-chimes');
    expect(getStoredAlarmSoundId('user-123')).toBe('bright-chimes');
    setStoredAlarmSoundId('user-123', 'gentle-chimes');
    expect(getStoredAlarmSoundId('user-123')).toBe('gentle-chimes');
  });

  it('never throws when localStorage is unavailable - falls back to the default (get) or silently no-ops (set)', () => {
    const original = globalThis.localStorage;
    // Simulate a private-browsing/storage-disabled environment.
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('unavailable');
      }
    });
    try {
      expect(getStoredAlarmSoundId('user-123')).toBe(DEFAULT_ALARM_SOUND_ID);
      expect(() => setStoredAlarmSoundId('user-123', 'bright-chimes')).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
    }
  });
});

// Context-aware Meditation/Breathing theming — real-execution tests for
// the pure capture/read/clear/resolve logic behind the transition matrix
// (Morning/Anytime/Evening journey launched from Home quick action,
// embedded journey, or direct-URL fallback; preserved across setup ->
// countdown -> active -> completion; cleared on real exit-to-Home;
// never leaking into a later, unrelated practice).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeJourneyTone,
  capturePracticeJourneyTone,
  readCapturedPracticeJourneyTone,
  clearPracticeJourneyTone,
  resolvePracticeJourneyTone,
  exitPracticeToHome
} from './practiceJourneyContext';

// This repo's Vitest environment is 'node' (no DOM), so there is no
// built-in sessionStorage - matching alarmOccurrence.test.js's own
// established in-memory shim.
class MemoryStorage {
  #store = new Map();
  getItem(key) { return this.#store.has(key) ? this.#store.get(key) : null; }
  setItem(key, value) { this.#store.set(key, String(value)); }
  removeItem(key) { this.#store.delete(key); }
  clear() { this.#store.clear(); }
}

beforeEach(() => {
  globalThis.sessionStorage = new MemoryStorage();
});

describe('normalizeJourneyTone', () => {
  it('accepts only the three real values', () => {
    expect(normalizeJourneyTone('morning')).toBe('morning');
    expect(normalizeJourneyTone('anytime')).toBe('anytime');
    expect(normalizeJourneyTone('evening')).toBe('evening');
  });

  it('rejects anything else, including a plausible-looking near miss', () => {
    expect(normalizeJourneyTone('primary')).toBeNull();
    expect(normalizeJourneyTone('Morning')).toBeNull();
    expect(normalizeJourneyTone('')).toBeNull();
    expect(normalizeJourneyTone(null)).toBeNull();
    expect(normalizeJourneyTone(undefined)).toBeNull();
  });
});

describe('capture / read / clear round trip', () => {
  it('a captured tone is read back exactly', () => {
    capturePracticeJourneyTone('evening');
    expect(readCapturedPracticeJourneyTone()).toBe('evening');
  });

  it('an invalid tone captured falls back to anytime (never silently stores garbage)', () => {
    capturePracticeJourneyTone('not-a-real-tone');
    expect(readCapturedPracticeJourneyTone()).toBe('anytime');
  });

  it('reading with nothing captured yet returns null, not a guessed default', () => {
    expect(readCapturedPracticeJourneyTone()).toBeNull();
  });

  it('clearing removes it - a later read returns null again', () => {
    capturePracticeJourneyTone('morning');
    clearPracticeJourneyTone();
    expect(readCapturedPracticeJourneyTone()).toBeNull();
  });

  it('starting another practice overwrites the previous one - a later Anytime launch is never still tinted by an earlier Evening practice that never explicitly cleared', () => {
    capturePracticeJourneyTone('evening');
    capturePracticeJourneyTone('anytime');
    expect(readCapturedPracticeJourneyTone()).toBe('anytime');
  });

  it('never throws when sessionStorage is unavailable - falls back to null (read) or silently no-ops (capture/clear)', () => {
    const original = globalThis.sessionStorage;
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() { throw new DOMException('unavailable'); }
    });
    try {
      expect(() => capturePracticeJourneyTone('morning')).not.toThrow();
      expect(readCapturedPracticeJourneyTone()).toBeNull();
      expect(() => clearPracticeJourneyTone()).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, writable: true, value: original });
    }
  });
});

describe('resolvePracticeJourneyTone — the transition-matrix precedence', () => {
  it('1. explicit context always wins, regardless of anything captured or any fallback', () => {
    capturePracticeJourneyTone('evening');
    expect(resolvePracticeJourneyTone({ explicitTone: 'morning', daypartFallback: 'anytime' })).toBe('morning');
  });

  it('2. with no explicit context, a captured Home-quick-action launch wins over the daypart fallback', () => {
    capturePracticeJourneyTone('evening');
    expect(resolvePracticeJourneyTone({ daypartFallback: 'morning' })).toBe('evening');
  });

  it('3. with neither explicit nor captured context, falls back to the supplied daypart value (direct URL / missing context)', () => {
    expect(resolvePracticeJourneyTone({ daypartFallback: 'morning' })).toBe('morning');
  });

  it('an invalid daypartFallback still resolves to a real value (anytime) rather than null/undefined', () => {
    expect(resolvePracticeJourneyTone({ daypartFallback: 'not-real' })).toBe('anytime');
    expect(resolvePracticeJourneyTone({})).toBe('anytime');
  });

  // Full transition matrix (launch source x active context x expected
  // tone) - each row exercises the exact precedence a real screen would
  // hit.
  it.each([
    ['Morning journey (embedded, explicit)', { explicitTone: 'morning', daypartFallback: 'anytime' }, 'morning'],
    ['Evening journey (embedded, explicit)', { explicitTone: 'evening', daypartFallback: 'anytime' }, 'evening'],
    ['Anytime Reset (embedded, explicit)', { explicitTone: 'anytime', daypartFallback: 'morning' }, 'anytime'],
    ['Home quick action, Morning active (captured)', { captured: 'morning', daypartFallback: 'evening' }, 'morning'],
    ['Home quick action, Anytime active (captured)', { captured: 'anytime', daypartFallback: 'evening' }, 'anytime'],
    ['Home quick action, Evening active (captured)', { captured: 'evening', daypartFallback: 'morning' }, 'evening'],
    ['Direct URL / missing context, morning daypart', { daypartFallback: 'morning' }, 'morning'],
    ['Direct URL / missing context, evening daypart', { daypartFallback: 'evening' }, 'evening']
  ])('%s -> %s', (_label, { explicitTone, captured, daypartFallback }, expected) => {
    if (captured) capturePracticeJourneyTone(captured);
    expect(resolvePracticeJourneyTone({ explicitTone, daypartFallback })).toBe(expected);
  });

  it('Anytime completion -> Home Evening context -> a new practice launch resolves to evening, not a leftover anytime', () => {
    // Simulates: standalone practice captured 'anytime', the app's own
    // exit-to-Home clearing ran, then Home is now Evening-active and the
    // user launches a fresh practice - Home's own quick-action capture
    // (not resolvePracticeJourneyTone) is what writes the new value, so
    // this exercises capture -> clear -> capture -> resolve end to end.
    capturePracticeJourneyTone('anytime');
    clearPracticeJourneyTone();
    capturePracticeJourneyTone('evening');
    expect(resolvePracticeJourneyTone({ daypartFallback: 'morning' })).toBe('evening');
  });
});

describe('exitPracticeToHome — the one centralized clear-and-navigate helper every real terminal exit should use', () => {
  it('clears the captured tone AND navigates, in that order (real execution against a fake navigate)', () => {
    capturePracticeJourneyTone('morning');
    const calls = [];
    const fakeNavigate = (...args) => calls.push(args);
    exitPracticeToHome(fakeNavigate, '/');
    expect(readCapturedPracticeJourneyTone()).toBeNull();
    expect(calls).toEqual([['/', undefined]]);
  });

  it('defaults the destination to Home ("/") when omitted', () => {
    capturePracticeJourneyTone('evening');
    const calls = [];
    exitPracticeToHome((...args) => calls.push(args));
    expect(calls).toEqual([['/', undefined]]);
  });

  it('forwards an arbitrary destination and navigate options through unchanged', () => {
    capturePracticeJourneyTone('anytime');
    const calls = [];
    exitPracticeToHome((...args) => calls.push(args), '/support', { replace: true });
    expect(calls).toEqual([['/support', { replace: true }]]);
    expect(readCapturedPracticeJourneyTone()).toBeNull();
  });

  it('leaves no captured tone for a subsequent resolve to pick up - the exact "abandoned practice cannot resurrect stale tone" guarantee', () => {
    capturePracticeJourneyTone('evening');
    exitPracticeToHome((() => {}), '/');
    expect(resolvePracticeJourneyTone({ daypartFallback: 'anytime' })).toBe('anytime');
  });
});

describe('cross-user isolation — the same guarantee sign-out cleanup relies on', () => {
  it('a fresh identity (no captured tone at all) always resolves from explicit/daypart, never a leftover value a different user left behind', () => {
    // Simulates: User A launches Evening Breathe, sign-out sweeps
    // sessionStorage (signOutCleanup.js's own moonlight_-prefix sweep,
    // covering this exact key - not re-tested here, that sweep is
    // generic and already covered by signOutCleanup.test.js), User B
    // signs in and opens a practice with no explicit context of their
    // own.
    capturePracticeJourneyTone('evening');
    clearPracticeJourneyTone(); // stands in for the sign-out sweep
    expect(resolvePracticeJourneyTone({ daypartFallback: 'morning' })).toBe('morning');
    expect(resolvePracticeJourneyTone({ daypartFallback: 'morning' })).not.toBe('evening');
  });
});

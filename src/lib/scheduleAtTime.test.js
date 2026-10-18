import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleAtTime } from './scheduleAtTime';

describe('scheduleAtTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires once the target instant is reached', () => {
    const callback = vi.fn();
    const now = Date.now();
    scheduleAtTime(now + 5000, callback, () => Date.now());

    vi.advanceTimersByTime(4999);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('fires immediately (synchronously) if the target is already in the past', () => {
    const callback = vi.fn();
    const now = Date.now();
    scheduleAtTime(now - 1000, callback, () => Date.now());
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cancel() prevents the callback from ever firing', () => {
    const callback = vi.fn();
    const now = Date.now();
    const cancel = scheduleAtTime(now + 5000, callback, () => Date.now());
    cancel();
    vi.advanceTimersByTime(10000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('calling cancel() more than once is safe (idempotent)', () => {
    const callback = vi.fn();
    const cancel = scheduleAtTime(Date.now() + 5000, callback, () => Date.now());
    cancel();
    expect(() => cancel()).not.toThrow();
    vi.advanceTimersByTime(10000);
    expect(callback).not.toHaveBeenCalled();
  });

  // The real motivating case: an annual subscription's expiry is roughly
  // 365 days out, far past setTimeout's 32-bit-signed-int delay limit
  // (~24.8 days / 2147483647ms). A naive `setTimeout(cb, delay)` would
  // overflow and fire almost immediately in that case — the exact
  // failure this module exists to prevent.
  it('a far-future target (well over the 32-bit setTimeout limit) does not fire early — it chains safe-sized hops', () => {
    const callback = vi.fn();
    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    scheduleAtTime(now + oneYearMs, callback, () => Date.now());

    // Advance in large chunks well past the 32-bit overflow threshold,
    // but still short of the real target — must never have fired yet.
    vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1000); // 30 days
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300 * 24 * 60 * 60 * 1000); // +300 days (330 total)
    expect(callback).not.toHaveBeenCalled();

    // Cross the real one-year target.
    vi.advanceTimersByTime(40 * 24 * 60 * 60 * 1000); // +40 days (370 total)
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('never fires twice for a single schedule', () => {
    const callback = vi.fn();
    scheduleAtTime(Date.now() + 1000, callback, () => Date.now());
    vi.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

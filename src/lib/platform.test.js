import { describe, it, expect, vi, beforeEach } from 'vitest';

// Apple Subscription Architecture task, Phase E — native platform
// detection tests. platform.js had no dedicated test file before this
// task despite being the exact decision point every native-only feature
// in this app (the morning reminder, deep links, and now Apple IAP)
// branches on — Subscription.jsx's "Stripe hidden on iOS / retained on
// web" behaviour is a JSX conditional on isAppleIAPSupported(), which is
// itself built directly on the functions tested here; this repo has no
// React Testing Library to render-test the JSX branch itself (see this
// task's other new test files for the same documented boundary), so this
// file is the correct, real test of the actual branching decision.
const mockCapacitor = {
  isNativePlatform: vi.fn(),
  getPlatform: vi.fn()
};
vi.mock('@capacitor/core', () => ({
  Capacitor: mockCapacitor
}));

const { isNativePlatform, getPlatform, isIOS, isWeb, runNative } = await import('./platform');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isNativePlatform', () => {
  it('reflects Capacitor.isNativePlatform() exactly', () => {
    mockCapacitor.isNativePlatform.mockReturnValue(true);
    expect(isNativePlatform()).toBe(true);
    mockCapacitor.isNativePlatform.mockReturnValue(false);
    expect(isNativePlatform()).toBe(false);
  });
});

describe('getPlatform / isIOS / isWeb', () => {
  it('reports ios correctly', () => {
    mockCapacitor.getPlatform.mockReturnValue('ios');
    expect(getPlatform()).toBe('ios');
    expect(isIOS()).toBe(true);
    expect(isWeb()).toBe(false);
  });

  it('reports web correctly', () => {
    mockCapacitor.getPlatform.mockReturnValue('web');
    expect(getPlatform()).toBe('web');
    expect(isIOS()).toBe(false);
    expect(isWeb()).toBe(true);
  });

  it('reports android as neither ios nor web (this app targets iOS only)', () => {
    mockCapacitor.getPlatform.mockReturnValue('android');
    expect(isIOS()).toBe(false);
    expect(isWeb()).toBe(false);
  });
});

describe('runNative', () => {
  it('runs the function and returns its result when native', () => {
    mockCapacitor.isNativePlatform.mockReturnValue(true);
    expect(runNative(() => 'result')).toBe('result');
  });

  it('never calls the function on web/non-native', () => {
    mockCapacitor.isNativePlatform.mockReturnValue(false);
    const fn = vi.fn(() => 'result');
    expect(runNative(fn)).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it('catches a thrown error and returns undefined rather than propagating', () => {
    mockCapacitor.isNativePlatform.mockReturnValue(true);
    expect(
      runNative(() => {
        throw new Error('boom');
      })
    ).toBeUndefined();
  });
});

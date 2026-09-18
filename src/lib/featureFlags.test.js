import { describe, it, expect, afterEach } from 'vitest';
import { isBetaProgramVisible } from './featureFlags';

describe('isBetaProgramVisible', () => {
  afterEach(() => {
    delete import.meta.env.VITE_SHOW_BETA_PROGRAM;
  });

  it('defaults to visible when the flag is unset (today\'s local dev, DEV Vercel, and every TestFlight build)', () => {
    expect(isBetaProgramVisible()).toBe(true);
  });

  it('hides only when explicitly set to the literal string "false" (the eventual production build)', () => {
    import.meta.env.VITE_SHOW_BETA_PROGRAM = 'false';
    expect(isBetaProgramVisible()).toBe(false);
  });

  it('stays visible for any other value, never silently hiding on a typo', () => {
    import.meta.env.VITE_SHOW_BETA_PROGRAM = 'no';
    expect(isBetaProgramVisible()).toBe(true);
  });
});

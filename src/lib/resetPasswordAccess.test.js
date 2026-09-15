import { describe, it, expect } from 'vitest';
import { shouldTreatAsValidRecovery } from './resetPasswordAccess';

describe('shouldTreatAsValidRecovery', () => {
  it('accepts a genuine PASSWORD_RECOVERY event regardless of anything else (existing web flow, unchanged)', () => {
    expect(
      shouldTreatAsValidRecovery({ recoveryEventFired: true, nativeRecoveryVerified: false, hasSession: false })
    ).toBe(true);
  });

  it('accepts a verified native recovery link with an actually-established session', () => {
    expect(
      shouldTreatAsValidRecovery({ recoveryEventFired: false, nativeRecoveryVerified: true, hasSession: true })
    ).toBe(true);
  });

  it('rejects the native recoveryVerified flag alone without a real session (never trust the flag by itself)', () => {
    expect(
      shouldTreatAsValidRecovery({ recoveryEventFired: false, nativeRecoveryVerified: true, hasSession: false })
    ).toBe(false);
  });

  it('rejects an ordinary/pre-existing session with no recovery signal at all — a direct visit', () => {
    expect(
      shouldTreatAsValidRecovery({ recoveryEventFired: false, nativeRecoveryVerified: false, hasSession: true })
    ).toBe(false);
  });

  it('rejects a fully bare direct visit', () => {
    expect(
      shouldTreatAsValidRecovery({ recoveryEventFired: false, nativeRecoveryVerified: false, hasSession: false })
    ).toBe(false);
  });

  it('rejects a session with an undefined/missing recoveryVerified value (e.g. no router state at all)', () => {
    expect(
      shouldTreatAsValidRecovery({ recoveryEventFired: false, nativeRecoveryVerified: undefined, hasSession: true })
    ).toBe(false);
  });
});

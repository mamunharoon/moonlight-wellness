import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuth = {
  verifyOtp: vi.fn(),
};
vi.mock('./supabaseClient', () => ({
  supabase: { auth: mockAuth },
}));

const { parseResetConfirmParams, confirmPasswordReset, RECOVERY_CONFIRM_TYPE } = await import('./resetPasswordConfirm');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseResetConfirmParams', () => {
  it('extracts a genuine recovery token_hash/type pair', () => {
    expect(parseResetConfirmParams('?token_hash=abc123&type=recovery')).toEqual({
      token_hash: 'abc123',
      type: 'recovery',
    });
  });

  it('never calls supabase.auth.verifyOtp — parsing is pure, regardless of how many times it runs', () => {
    parseResetConfirmParams('?token_hash=abc123&type=recovery');
    parseResetConfirmParams('?token_hash=abc123&type=recovery');
    parseResetConfirmParams('?token_hash=abc123&type=recovery');
    expect(mockAuth.verifyOtp).not.toHaveBeenCalled();
  });

  it('rejects a missing token_hash', () => {
    expect(parseResetConfirmParams('?type=recovery')).toBeNull();
  });

  it('rejects a missing or wrong type (never accepts a non-recovery link at this path)', () => {
    expect(parseResetConfirmParams('?token_hash=abc123')).toBeNull();
    expect(parseResetConfirmParams('?token_hash=abc123&type=signup')).toBeNull();
    expect(parseResetConfirmParams('?token_hash=abc123&type=magiclink')).toBeNull();
  });

  it('rejects an empty or missing query string', () => {
    expect(parseResetConfirmParams('')).toBeNull();
    expect(parseResetConfirmParams(undefined)).toBeNull();
  });

  it('RECOVERY_CONFIRM_TYPE is the literal Supabase verifyOtp recovery type', () => {
    expect(RECOVERY_CONFIRM_TYPE).toBe('recovery');
  });
});

describe('confirmPasswordReset', () => {
  it('calls supabase.auth.verifyOtp with exactly the parsed token_hash/type, and only once', async () => {
    mockAuth.verifyOtp.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });
    const ok = await confirmPasswordReset({ token_hash: 'abc123', type: 'recovery' });
    expect(ok).toBe(true);
    expect(mockAuth.verifyOtp).toHaveBeenCalledTimes(1);
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc123', type: 'recovery' });
  });

  it('returns false when Supabase reports an error (e.g. expired/already-used token)', async () => {
    mockAuth.verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'Token has expired or is invalid' } });
    const ok = await confirmPasswordReset({ token_hash: 'abc123', type: 'recovery' });
    expect(ok).toBe(false);
  });

  it('returns false instead of throwing, and never leaks the token hash in a logged value', async () => {
    mockAuth.verifyOtp.mockRejectedValue(new Error('network down'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = await confirmPasswordReset({ token_hash: 'super-secret-token-hash', type: 'recovery' });
    expect(ok).toBe(false);
    const loggedText = warnSpy.mock.calls.flat().join(' ');
    expect(loggedText).not.toContain('super-secret-token-hash');
    warnSpy.mockRestore();
  });
});

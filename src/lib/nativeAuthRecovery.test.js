import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuth = {
  setSession: vi.fn(),
};
vi.mock('./supabaseClient', () => ({
  supabase: { auth: mockAuth },
}));

const {
  classifyNativeAuthUrl,
  establishRecoverySession,
  resolveIncomingUrl,
} = await import('./nativeAuthRecovery');

const VALID_TOKENS = 'access_token=abc123.def456.ghi789&refresh_token=rrr111&type=recovery';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('classifyNativeAuthUrl', () => {
  it('accepts a genuine host-form recovery URL', () => {
    const result = classifyNativeAuthUrl(`wakewise://reset-password#${VALID_TOKENS}`);
    expect(result).toEqual({ kind: 'recovery', access_token: 'abc123.def456.ghi789', refresh_token: 'rrr111' });
  });

  it('accepts a genuine path-form (triple-slash) recovery URL identically', () => {
    const result = classifyNativeAuthUrl(`wakewise:///reset-password#${VALID_TOKENS}`);
    expect(result).toEqual({ kind: 'recovery', access_token: 'abc123.def456.ghi789', refresh_token: 'rrr111' });
  });

  it('rejects an unknown scheme', () => {
    expect(classifyNativeAuthUrl(`https://evil.example.com/reset-password#${VALID_TOKENS}`)).toEqual({ kind: 'invalid' });
    expect(classifyNativeAuthUrl(`otherapp://reset-password#${VALID_TOKENS}`)).toEqual({ kind: 'invalid' });
  });

  it('rejects a malformed URL without throwing', () => {
    expect(classifyNativeAuthUrl('not a url at all')).toEqual({ kind: 'invalid' });
    expect(classifyNativeAuthUrl('')).toEqual({ kind: 'invalid' });
  });

  it('routes an unrelated but known path as "other" for the generic allow-list', () => {
    expect(classifyNativeAuthUrl('wakewise://auth')).toEqual({ kind: 'other', path: 'auth', search: '' });
  });

  it('routes an unknown path as "other" too (caller decides via its own allow-list)', () => {
    expect(classifyNativeAuthUrl('wakewise://some-other-path')).toEqual({
      kind: 'other',
      path: 'some-other-path',
      search: '',
    });
  });

  it('rejects a normal (non-recovery) auth link presented at the recovery path', () => {
    expect(
      classifyNativeAuthUrl('wakewise://reset-password#access_token=abc&refresh_token=def&type=signup')
    ).toEqual({ kind: 'incomplete-recovery' });
    expect(
      classifyNativeAuthUrl('wakewise://reset-password#access_token=abc&refresh_token=def&type=magiclink')
    ).toEqual({ kind: 'incomplete-recovery' });
  });

  it('rejects a recovery-typed link missing required tokens', () => {
    expect(classifyNativeAuthUrl('wakewise://reset-password#type=recovery')).toEqual({ kind: 'incomplete-recovery' });
    expect(classifyNativeAuthUrl('wakewise://reset-password#access_token=abc&type=recovery')).toEqual({
      kind: 'incomplete-recovery',
    });
  });

  it('rejects a bare reset-password URL with no payload at all', () => {
    expect(classifyNativeAuthUrl('wakewise://reset-password')).toEqual({ kind: 'incomplete-recovery' });
  });
});

describe('establishRecoverySession', () => {
  it('returns true only when Supabase confirms a real session', async () => {
    mockAuth.setSession.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });
    const ok = await establishRecoverySession({ access_token: 'a', refresh_token: 'b' });
    expect(ok).toBe(true);
    expect(mockAuth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'b' });
  });

  it('returns false when Supabase reports an error (e.g. expired/reused token)', async () => {
    mockAuth.setSession.mockResolvedValue({ data: { session: null }, error: { message: 'invalid token' } });
    const ok = await establishRecoverySession({ access_token: 'a', refresh_token: 'b' });
    expect(ok).toBe(false);
  });

  it('returns false instead of throwing, and never leaks the tokens in a thrown/logged value', async () => {
    mockAuth.setSession.mockRejectedValue(new Error('network down'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = await establishRecoverySession({ access_token: 'super-secret-access', refresh_token: 'super-secret-refresh' });
    expect(ok).toBe(false);
    const loggedText = warnSpy.mock.calls.flat().join(' ');
    expect(loggedText).not.toContain('super-secret-access');
    expect(loggedText).not.toContain('super-secret-refresh');
    warnSpy.mockRestore();
  });
});

describe('resolveIncomingUrl', () => {
  const allowedPaths = new Set(['auth']);

  it('establishes the session and points to reset-password with a verified flag on success', async () => {
    const establishSession = vi.fn().mockResolvedValue(true);
    const result = await resolveIncomingUrl(`wakewise://reset-password#${VALID_TOKENS}`, {
      processedUrls: new Set(),
      establishSession,
      allowedPaths,
    });
    expect(establishSession).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ path: '/reset-password', options: { replace: true, state: { recoveryVerified: true } } });
  });

  it('does not set recoveryVerified when session establishment fails', async () => {
    const establishSession = vi.fn().mockResolvedValue(false);
    const result = await resolveIncomingUrl(`wakewise://reset-password#${VALID_TOKENS}`, {
      processedUrls: new Set(),
      establishSession,
      allowedPaths,
    });
    expect(result).toEqual({ path: '/reset-password', options: { replace: true, state: undefined } });
  });

  it('never calls establishSession for a non-recovery/incomplete link', async () => {
    const establishSession = vi.fn();
    const result = await resolveIncomingUrl('wakewise://reset-password', {
      processedUrls: new Set(),
      establishSession,
      allowedPaths,
    });
    expect(establishSession).not.toHaveBeenCalled();
    expect(result).toEqual({ path: '/reset-password', options: { replace: true } });
  });

  it('routes an allow-listed generic path without touching Supabase at all', async () => {
    const establishSession = vi.fn();
    const result = await resolveIncomingUrl('wakewise://auth?foo=bar', {
      processedUrls: new Set(),
      establishSession,
      allowedPaths,
    });
    expect(establishSession).not.toHaveBeenCalled();
    expect(result).toEqual({ path: '/auth?foo=bar', options: undefined });
  });

  it('returns null (does nothing) for an unrecognized path not on the allow-list', async () => {
    const result = await resolveIncomingUrl('wakewise://not-allowed', {
      processedUrls: new Set(),
      establishSession: vi.fn(),
      allowedPaths,
    });
    expect(result).toBeNull();
  });

  it('processes the same URL only once (duplicate appUrlOpen firing)', async () => {
    const establishSession = vi.fn().mockResolvedValue(true);
    const processedUrls = new Set();
    const url = `wakewise://reset-password#${VALID_TOKENS}`;

    const first = await resolveIncomingUrl(url, { processedUrls, establishSession, allowedPaths });
    const second = await resolveIncomingUrl(url, { processedUrls, establishSession, allowedPaths });

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(establishSession).toHaveBeenCalledTimes(1);
  });

  it('dedupes across a simulated cold-launch getLaunchUrl() + appUrlOpen delivering the same URL', async () => {
    const establishSession = vi.fn().mockResolvedValue(true);
    const processedUrls = new Set();
    const url = `wakewise://reset-password#${VALID_TOKENS}`;

    // Simulates useNativeDeepLinks.js calling handleUrl once from
    // getLaunchUrl() and once from an appUrlOpen event for the same URL.
    const [fromLaunch, fromAppUrlOpen] = await Promise.all([
      resolveIncomingUrl(url, { processedUrls, establishSession, allowedPaths }),
      resolveIncomingUrl(url, { processedUrls, establishSession, allowedPaths }),
    ]);

    const results = [fromLaunch, fromAppUrlOpen].filter(Boolean);
    expect(results).toHaveLength(1);
    expect(establishSession).toHaveBeenCalledTimes(1);
  });
});

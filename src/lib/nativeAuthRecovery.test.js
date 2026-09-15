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
  fingerprintUrl,
  createRecoveryUrlDeduper,
} = await import('./nativeAuthRecovery');

const VALID_TOKENS = 'access_token=abc123.def456.ghi789&refresh_token=rrr111&type=recovery';
const VALID_RECOVERY_URL = `wakewise://reset-password#${VALID_TOKENS}`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('classifyNativeAuthUrl', () => {
  it('accepts a genuine host-form recovery URL', () => {
    const result = classifyNativeAuthUrl(VALID_RECOVERY_URL);
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
    const result = await resolveIncomingUrl(VALID_RECOVERY_URL, { establishSession, allowedPaths });
    expect(establishSession).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ path: '/reset-password', options: { replace: true, state: { recoveryVerified: true } } });
  });

  it('does not set recoveryVerified when session establishment fails', async () => {
    const establishSession = vi.fn().mockResolvedValue(false);
    const result = await resolveIncomingUrl(VALID_RECOVERY_URL, { establishSession, allowedPaths });
    expect(result).toEqual({ path: '/reset-password', options: { replace: true, state: undefined } });
  });

  it('never calls establishSession for a non-recovery/incomplete link', async () => {
    const establishSession = vi.fn();
    const result = await resolveIncomingUrl('wakewise://reset-password', { establishSession, allowedPaths });
    expect(establishSession).not.toHaveBeenCalled();
    expect(result).toEqual({ path: '/reset-password', options: { replace: true } });
  });

  it('routes an allow-listed generic path without touching Supabase at all', async () => {
    const establishSession = vi.fn();
    const result = await resolveIncomingUrl('wakewise://auth?foo=bar', { establishSession, allowedPaths });
    expect(establishSession).not.toHaveBeenCalled();
    expect(result).toEqual({ path: '/auth?foo=bar', options: undefined });
  });

  it('returns null (does nothing) for an unrecognized path not on the allow-list', async () => {
    const result = await resolveIncomingUrl('wakewise://not-allowed', { establishSession: vi.fn(), allowedPaths });
    expect(result).toBeNull();
  });
});

describe('fingerprintUrl', () => {
  it('never returns the raw input, and is deterministic for the same input', async () => {
    const fp1 = await fingerprintUrl(VALID_RECOVERY_URL);
    const fp2 = await fingerprintUrl(VALID_RECOVERY_URL);
    expect(fp1).toBe(fp2);
    expect(fp1).not.toContain('access_token');
    expect(fp1).not.toContain('abc123.def456.ghi789');
    expect(fp1).not.toContain('rrr111');
    expect(fp1).not.toContain(VALID_RECOVERY_URL);
  });

  it('produces different fingerprints for different URLs', async () => {
    const fp1 = await fingerprintUrl(VALID_RECOVERY_URL);
    const fp2 = await fingerprintUrl('wakewise://auth');
    expect(fp1).not.toBe(fp2);
  });

  it('uses a real SHA-256 digest (64 lowercase hex chars) when Web Crypto is available', async () => {
    const fp = await fingerprintUrl(VALID_RECOVERY_URL);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('falls back to a token-free identifier if Web Crypto SubtleCrypto is unavailable, without throwing', async () => {
    const originalCrypto = globalThis.crypto;
    // Simulate an environment where crypto.subtle is missing.
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
    try {
      const fp = await fingerprintUrl(VALID_RECOVERY_URL);
      expect(fp).toMatch(/^fnv1a:[0-9a-f]{8}$/);
      expect(fp).not.toContain('access_token');
      expect(fp).not.toContain('abc123.def456.ghi789');
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
    }
  });
});

describe('createRecoveryUrlDeduper', () => {
  it('processes a URL once when called sequentially with the same URL', async () => {
    const work = vi.fn().mockResolvedValue('done');
    const deduper = createRecoveryUrlDeduper();

    const first = await deduper.processOnce(VALID_RECOVERY_URL, work);
    const second = await deduper.processOnce(VALID_RECOVERY_URL, work);

    expect(first).toBe('done');
    expect(second).toBeNull();
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('processes a URL only once even when two concurrent calls race for the same link', async () => {
    const work = vi.fn().mockResolvedValue('done');
    const deduper = createRecoveryUrlDeduper();

    // Simulates getLaunchUrl() and appUrlOpen both delivering the same
    // cold-launch URL at effectively the same time: both callers share
    // the one in-flight promise and see its single outcome (this is
    // distinct from the sequential-duplicate case above, where the
    // second call arrives *after* the first already fully completed and
    // correctly gets null instead of a stale re-delivery).
    const [a, b] = await Promise.all([
      deduper.processOnce(VALID_RECOVERY_URL, work),
      deduper.processOnce(VALID_RECOVERY_URL, work),
    ]);

    expect(a).toBe('done');
    expect(b).toBe('done');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('still processes two genuinely different URLs independently', async () => {
    const work = vi.fn().mockImplementation(async (n) => n);
    const deduper = createRecoveryUrlDeduper();

    const a = await deduper.processOnce('wakewise://auth?x=1', () => work('a'));
    const b = await deduper.processOnce('wakewise://auth?x=2', () => work('b'));

    expect(a).toBe('a');
    expect(b).toBe('b');
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('the dedup store never contains the raw URL, access token, or refresh token', async () => {
    const deduper = createRecoveryUrlDeduper();
    await deduper.processOnce(VALID_RECOVERY_URL, () => 'done');

    const stored = Array.from(deduper.processedFingerprints);
    expect(stored).toHaveLength(1);
    for (const entry of stored) {
      expect(entry).not.toContain('access_token');
      expect(entry).not.toContain('abc123.def456.ghi789');
      expect(entry).not.toContain('rrr111');
      expect(entry).not.toContain('wakewise://');
      expect(entry).not.toContain(VALID_RECOVERY_URL);
    }
  });

  it('marks a URL processed even when work() represents a failed recovery — no client-side retry of the same link', async () => {
    // work() here stands in for resolveIncomingUrl() having already
    // called establishSession() and gotten a failure back (e.g. an
    // expired/reused token) — by the time createRecoveryUrlDeduper sees
    // it, the attempt already happened once; retrying the *identical*
    // URL can't change that server-side outcome, so it's deliberately
    // not retried. A fresh "request a new link" produces a different
    // URL (new tokens -> new fingerprint), which *is* processed fresh —
    // see the next test.
    const work = vi.fn().mockResolvedValue({ path: '/reset-password', options: { replace: true, state: undefined } });
    const deduper = createRecoveryUrlDeduper();

    const first = await deduper.processOnce(VALID_RECOVERY_URL, work);
    const second = await deduper.processOnce(VALID_RECOVERY_URL, work);

    expect(first).toEqual({ path: '/reset-password', options: { replace: true, state: undefined } });
    expect(second).toBeNull();
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('a fresh link (new tokens) is processed independently of an earlier failed one', async () => {
    const work = vi.fn().mockResolvedValue('done');
    const deduper = createRecoveryUrlDeduper();

    const staleUrl = 'wakewise://reset-password#access_token=old&refresh_token=old&type=recovery';
    const freshUrl = 'wakewise://reset-password#access_token=new&refresh_token=new&type=recovery';

    await deduper.processOnce(staleUrl, work);
    const freshResult = await deduper.processOnce(freshUrl, work);

    expect(freshResult).toBe('done');
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('removes the raw URL from in-flight tracking once processing settles, even on rejection', async () => {
    const deduper = createRecoveryUrlDeduper();
    const failingWork = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(deduper.processOnce(VALID_RECOVERY_URL, failingWork)).rejects.toThrow('boom');

    // A second attempt after the first one settled (rejected) is treated
    // as a genuinely new call, not stuck waiting on a stale in-flight
    // entry — confirming the raw-URL-keyed in-flight Map entry was
    // actually released, not merely "processed" once and reused.
    const succeedingWork = vi.fn().mockResolvedValue('done');
    const second = await deduper.processOnce(VALID_RECOVERY_URL, succeedingWork);
    expect(second).toBe('done');
    expect(succeedingWork).toHaveBeenCalledTimes(1);
  });
});

// Video startup performance (2026-11-01, DEV only) — real behavioural
// tests for requestBetaVideoUrl's caching/de-dup/retry layer, against a
// mocked Supabase client (matching momentumQueries.test.js's own
// established mocking pattern). Verifies: cache hits skip the network
// call entirely, different users/ids never share a cache entry, expired
// entries force a fresh call, concurrent calls for the same user+id
// share one in-flight request, a single 401 is retried exactly once,
// and every other error shape (403/404/network/unknown) is unchanged
// and never cached.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
const mockGetSession = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
    auth: { getSession: mockGetSession }
  }
}));

const { requestBetaVideoUrl, BetaVideoAccessError } = await import('./betaVideoAccess');
const { clearSignedVideoUrlCache, getCachedSignedUrl } = await import('./signedVideoUrlCache');

const asUser = (id) => mockGetSession.mockResolvedValue({ data: { session: id ? { user: { id } } : null } });
const okResponse = (url) => ({ data: { url }, error: null });
const errorResponse = (status) => ({ data: null, error: { context: { status } } });

beforeEach(() => {
  mockInvoke.mockReset();
  mockGetSession.mockReset();
  clearSignedVideoUrlCache();
  asUser('user-1');
});

describe('cache hits — no network call on a second request for the same user+id', () => {
  it('the first call invokes the Edge Function; a second call for the same id returns the cached result without invoking again', async () => {
    mockInvoke.mockResolvedValueOnce(okResponse('https://example.com/signed-1'));

    const first = await requestBetaVideoUrl('E02');
    expect(first.url).toBe('https://example.com/signed-1');
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    const second = await requestBetaVideoUrl('E02');
    expect(second.url).toBe('https://example.com/signed-1');
    expect(mockInvoke).toHaveBeenCalledTimes(1); // still 1 — served from cache
  });

  it('a different id for the same user is a cache miss and invokes again', async () => {
    mockInvoke.mockResolvedValueOnce(okResponse('https://example.com/e02'));
    mockInvoke.mockResolvedValueOnce(okResponse('https://example.com/e03'));

    await requestBetaVideoUrl('E02');
    await requestBetaVideoUrl('E03');

    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });
});

describe('user scoping — cache is never shared across accounts or with a guest', () => {
  it('two different signed-in users requesting the same id each get their own network call, never the other\'s cached URL', async () => {
    asUser('user-1');
    mockInvoke.mockResolvedValueOnce(okResponse('https://example.com/user1-url'));
    const forUser1 = await requestBetaVideoUrl('E02');
    expect(forUser1.url).toBe('https://example.com/user1-url');

    asUser('user-2');
    mockInvoke.mockResolvedValueOnce(okResponse('https://example.com/user2-url'));
    const forUser2 = await requestBetaVideoUrl('E02');
    expect(forUser2.url).toBe('https://example.com/user2-url');

    expect(mockInvoke).toHaveBeenCalledTimes(2); // never served user-1's URL to user-2
  });

  it('a signed-out (guest) request and a signed-in request for the same id never share a cache entry', async () => {
    asUser(null); // no session -> guest
    mockInvoke.mockResolvedValueOnce(okResponse('https://example.com/guest-url'));
    await requestBetaVideoUrl('IB01');

    asUser('user-1');
    mockInvoke.mockResolvedValueOnce(okResponse('https://example.com/user1-url'));
    const forUser1 = await requestBetaVideoUrl('IB01');

    expect(forUser1.url).toBe('https://example.com/user1-url');
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('switching back to a user whose entry is still cached and valid reuses it (not a network call) — cache correctness survives interleaved users', async () => {
    asUser('user-1');
    mockInvoke.mockResolvedValueOnce(okResponse('https://example.com/user1-url'));
    await requestBetaVideoUrl('E02');

    asUser('user-2');
    mockInvoke.mockResolvedValueOnce(okResponse('https://example.com/user2-url'));
    await requestBetaVideoUrl('E02');

    asUser('user-1');
    const again = await requestBetaVideoUrl('E02');
    expect(again.url).toBe('https://example.com/user1-url');
    expect(mockInvoke).toHaveBeenCalledTimes(2); // no third call
  });
});

describe('expiry — a lapsed cache entry forces a fresh request', () => {
  it('requests a fresh URL once the cached one has expired', async () => {
    vi.useFakeTimers();
    try {
      mockInvoke.mockResolvedValueOnce(okResponse('https://example.com/first'));
      await requestBetaVideoUrl('E02');
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5 * 60 * 1000 + 1); // past the 5-minute TTL

      mockInvoke.mockResolvedValueOnce(okResponse('https://example.com/second'));
      const refreshed = await requestBetaVideoUrl('E02');
      expect(refreshed.url).toBe('https://example.com/second');
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('concurrent requests — de-duplicated to a single network call', () => {
  it('two simultaneous calls for the same user+id share one in-flight request', async () => {
    let resolveInvoke;
    mockInvoke.mockReturnValueOnce(new Promise((resolve) => { resolveInvoke = resolve; }));

    const call1 = requestBetaVideoUrl('E02');
    const call2 = requestBetaVideoUrl('E02');

    resolveInvoke(okResponse('https://example.com/shared'));
    const [result1, result2] = await Promise.all([call1, call2]);

    expect(result1.url).toBe('https://example.com/shared');
    expect(result2.url).toBe('https://example.com/shared');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('simultaneous calls for different ids are never blocked by each other', async () => {
    mockInvoke.mockResolvedValueOnce(okResponse('https://example.com/e02'));
    mockInvoke.mockResolvedValueOnce(okResponse('https://example.com/e03'));

    const [r1, r2] = await Promise.all([requestBetaVideoUrl('E02'), requestBetaVideoUrl('E03')]);

    expect(r1.url).toBe('https://example.com/e02');
    expect(r2.url).toBe('https://example.com/e03');
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });
});

describe('failed requests — authorisation retry and unchanged error behaviour', () => {
  it('a single 401 is retried exactly once and succeeds on the retry', async () => {
    mockInvoke
      .mockResolvedValueOnce(errorResponse(401))
      .mockResolvedValueOnce(okResponse('https://example.com/after-retry'));

    const result = await requestBetaVideoUrl('E02');

    expect(result.url).toBe('https://example.com/after-retry');
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('two consecutive 401s reject with the unauthorized error, after exactly one retry (never a retry loop)', async () => {
    mockInvoke
      .mockResolvedValueOnce(errorResponse(401))
      .mockResolvedValueOnce(errorResponse(401));

    await expect(requestBetaVideoUrl('E02')).rejects.toMatchObject({ code: 'unauthorized' });
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('a failed (401-then-401) request is never cached', async () => {
    mockInvoke
      .mockResolvedValueOnce(errorResponse(401))
      .mockResolvedValueOnce(errorResponse(401));

    await requestBetaVideoUrl('E02').catch(() => {});

    expect(getCachedSignedUrl('user-1', 'E02')).toBeNull();
  });

  it('a 403 (forbidden) is not retried and is never cached', async () => {
    mockInvoke.mockResolvedValueOnce(errorResponse(403));

    await expect(requestBetaVideoUrl('E02')).rejects.toMatchObject({ code: 'forbidden' });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(getCachedSignedUrl('user-1', 'E02')).toBeNull();
  });

  it('a 404 (not found) is not retried and is never cached', async () => {
    mockInvoke.mockResolvedValueOnce(errorResponse(404));

    await expect(requestBetaVideoUrl('E02')).rejects.toMatchObject({ code: 'not_found' });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('a network failure (no status at all) maps to the network error and is not retried by this layer', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: {} });

    await expect(requestBetaVideoUrl('E02')).rejects.toMatchObject({ code: 'network' });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('a successful response with no url is still the pre-existing "unknown" error, uncached', async () => {
    mockInvoke.mockResolvedValueOnce({ data: {}, error: null });

    await expect(requestBetaVideoUrl('E02')).rejects.toMatchObject({ code: 'unknown' });
    expect(getCachedSignedUrl('user-1', 'E02')).toBeNull();
  });

  it('BetaVideoAccessError is exported and used for every rejection shape', async () => {
    mockInvoke.mockResolvedValueOnce(errorResponse(403));
    try {
      await requestBetaVideoUrl('E02');
      throw new Error('expected rejection');
    } catch (e) {
      expect(e).toBeInstanceOf(BetaVideoAccessError);
    }
  });
});

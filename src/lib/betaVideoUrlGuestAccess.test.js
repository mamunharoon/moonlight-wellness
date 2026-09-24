// Real-execution behavioural/security regression coverage for
// get-beta-video-url's guest-allowlist decision - imports the actual
// pure module the Edge Function itself calls
// (supabase/functions/_shared/betaVideoUrlAccess.ts), exactly like
// entitlementResolution.serverMirror.test.js already imports its own
// edge function's shared `.ts` module from src/lib/. This is genuine
// behavioural coverage of the real branching (every fake below stands in
// for Supabase Auth's getUser / the service-role signed-URL call), not a
// source-text regex guess at it.
import { describe, it, expect, vi } from 'vitest';
import {
  resolveBetaVideoUrlRequest,
  GUEST_ALLOWED_IDS,
  isGuestAllowedId
} from '../../supabase/functions/_shared/betaVideoUrlAccess.ts';

const REAL_PATHS = {
  IB01: 'faststart-v1/WW_IB01_InteractiveBreathingLoop_MusicBed_v2_faststart.m4a',
  IS01: 'faststart-v1/WW_IS01_InteractiveStretchingLoop_MusicBed_v2_faststart.m4a',
  IM01: 'faststart-v1/WW_IM01_InteractiveMeditation_MusicBed_v1.m4a',
  E02: 'faststart-v1/WW_E02_OverwhelmedMind_Final_v2.mp4Use_faststart.mp4'
};

const resolvePath = (id) => REAL_PATHS[id];

const okSignUrl = vi.fn(async (path) => ({ signedUrl: `https://signed.example/${encodeURIComponent(path)}` }));
const anonymousUser = { user: { is_anonymous: true } };
const realUser = { user: { is_anonymous: false } };

const baseArgs = (overrides = {}) => ({
  authorizationHeader: null,
  body: {},
  resolvePath,
  verifyUser: vi.fn(),
  signUrl: okSignUrl,
  ...overrides
});

describe('GUEST_ALLOWED_IDS — the fixed, explicit set', () => {
  it('contains exactly IB01, IS01, IM01 - IM02 deliberately excluded', () => {
    expect([...GUEST_ALLOWED_IDS].sort()).toEqual(['IB01', 'IM01', 'IS01']);
    expect(isGuestAllowedId('IM02')).toBe(false);
  });

  it('never matches a non-string or nullish value', () => {
    expect(isGuestAllowedId(undefined)).toBe(false);
    expect(isGuestAllowedId(null)).toBe(false);
    expect(isGuestAllowedId(123)).toBe(false);
    expect(isGuestAllowedId({ toString: () => 'IB01' })).toBe(false);
  });
});

describe('resolveBetaVideoUrlRequest — guest (no Authorization header) requests for allowlisted ids succeed', () => {
  it('IB01 succeeds without ever calling verifyUser', async () => {
    const verifyUser = vi.fn();
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: 'IB01' }, verifyUser }));
    expect(result.status).toBe(200);
    expect(result.body.url).toContain(encodeURIComponent(REAL_PATHS.IB01));
    expect(verifyUser).not.toHaveBeenCalled();
  });

  it('IS01 succeeds without ever calling verifyUser', async () => {
    const verifyUser = vi.fn();
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: 'IS01' }, verifyUser }));
    expect(result.status).toBe(200);
    expect(result.body.url).toContain(encodeURIComponent(REAL_PATHS.IS01));
    expect(verifyUser).not.toHaveBeenCalled();
  });

  it('IM01 succeeds without ever calling verifyUser', async () => {
    const verifyUser = vi.fn();
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: 'IM01' }, verifyUser }));
    expect(result.status).toBe(200);
    expect(result.body.url).toContain(encodeURIComponent(REAL_PATHS.IM01));
    expect(verifyUser).not.toHaveBeenCalled();
  });
});

describe('resolveBetaVideoUrlRequest — every non-allowlisted id keeps the exact original requirement', () => {
  it('a guided video (E02) with no Authorization header is rejected 401, verifyUser/signUrl never called', async () => {
    const verifyUser = vi.fn();
    const signUrl = vi.fn();
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: 'E02' }, verifyUser, signUrl }));
    expect(result).toEqual({ status: 401, body: { error: 'Sign in required' } });
    expect(verifyUser).not.toHaveBeenCalled();
    expect(signUrl).not.toHaveBeenCalled();
  });

  it('a guided video (E02) with an anonymous (is_anonymous) authenticated session is rejected 403', async () => {
    const verifyUser = vi.fn(async () => anonymousUser);
    const result = await resolveBetaVideoUrlRequest(
      baseArgs({ authorizationHeader: 'Bearer sometoken', body: { exerciseId: 'E02' }, verifyUser })
    );
    expect(result).toEqual({ status: 403, body: { error: 'Please sign in to watch this preview.' } });
  });

  it('a guided video (E02) with a real, non-anonymous, signed-in session still succeeds exactly as before', async () => {
    const verifyUser = vi.fn(async () => realUser);
    const result = await resolveBetaVideoUrlRequest(
      baseArgs({ authorizationHeader: 'Bearer sometoken', body: { exerciseId: 'E02' }, verifyUser })
    );
    expect(result.status).toBe(200);
    expect(result.body.url).toContain(encodeURIComponent(REAL_PATHS.E02));
    expect(verifyUser).toHaveBeenCalledWith('sometoken');
  });

  it('verifyUser returning an error or no user is rejected 401, same as before', async () => {
    const verifyUser = vi.fn(async () => ({ user: null, error: new Error('invalid token') }));
    const result = await resolveBetaVideoUrlRequest(
      baseArgs({ authorizationHeader: 'Bearer bad', body: { exerciseId: 'E02' }, verifyUser })
    );
    expect(result).toEqual({ status: 401, body: { error: 'Sign in required' } });
  });
});

describe('resolveBetaVideoUrlRequest — unknown IDs remain rejected either way', () => {
  it('an unknown id with no Authorization header is rejected 401 (auth is still checked first for a non-allowlisted id)', async () => {
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: 'ZZZ99' } }));
    expect(result).toEqual({ status: 401, body: { error: 'Sign in required' } });
  });

  it('an unknown id from a real signed-in user is rejected 404 "Unknown video" - never leaks that no path exists via a different message', async () => {
    const verifyUser = vi.fn(async () => realUser);
    const signUrl = vi.fn();
    const result = await resolveBetaVideoUrlRequest(
      baseArgs({ authorizationHeader: 'Bearer sometoken', body: { exerciseId: 'ZZZ99' }, verifyUser, signUrl })
    );
    expect(result).toEqual({ status: 404, body: { error: 'Unknown video' } });
    expect(signUrl).not.toHaveBeenCalled();
  });

  it('a missing/non-string exerciseId is treated as unknown, never as guest-allowed', async () => {
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: {} }));
    expect(result.status).toBe(401); // no exerciseId -> not guest-allowed -> auth required first, same as an unknown id with no auth
  });
});

describe('resolveBetaVideoUrlRequest — caller-supplied paths/buckets/URLs can never be used', () => {
  it('a guest request carrying its own path/bucket/returnUrl fields is ignored - signUrl only ever receives the real, fixed, resolved path', async () => {
    const signUrl = vi.fn(okSignUrl);
    const result = await resolveBetaVideoUrlRequest(
      baseArgs({
        body: {
          exerciseId: 'IB01',
          path: 'exercises/some-other-object.mp4',
          bucket: 'a-different-bucket',
          returnUrl: 'https://evil.example/steal'
        },
        signUrl
      })
    );
    expect(result.status).toBe(200);
    expect(signUrl).toHaveBeenCalledTimes(1);
    expect(signUrl).toHaveBeenCalledWith(REAL_PATHS.IB01);
    expect(signUrl.mock.calls[0][0]).not.toBe('exercises/some-other-object.mp4');
  });

  it('resolvePath is only ever called with the exact exerciseId string, never with any other body field', async () => {
    const resolvePathSpy = vi.fn(resolvePath);
    await resolveBetaVideoUrlRequest(
      baseArgs({
        body: { exerciseId: 'IM01', path: 'attacker/controlled/path.m4a' },
        resolvePath: resolvePathSpy
      })
    );
    expect(resolvePathSpy).toHaveBeenCalledTimes(1);
    expect(resolvePathSpy).toHaveBeenCalledWith('IM01');
  });
});

describe('resolveBetaVideoUrlRequest — signing failure never leaks internal storage detail to a guest-facing error', () => {
  it('a failed signUrl for an allowlisted id returns the generic message, with no path/bucket/signError content', async () => {
    const signUrl = vi.fn(async () => ({ error: new Error('storage.objects: object not found at faststart-v1/secret-internal-path.m4a') }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: 'IB01' }, signUrl }));
    expect(result).toEqual({ status: 404, body: { error: "This video isn't available right now." } });
    expect(JSON.stringify(result.body)).not.toMatch(/faststart-v1|secret-internal-path|storage\.objects/);
  });
});

describe('resolveBetaVideoUrlRequest — repeated/duplicate-shaped calls stay independent (no shared mutable state leaks between requests)', () => {
  it('a rejected guest guided-video request does not affect a subsequent allowlisted guest request', async () => {
    const verifyUser = vi.fn();
    const first = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: 'E02' }, verifyUser }));
    const second = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: 'IM01' }, verifyUser }));
    expect(first.status).toBe(401);
    expect(second.status).toBe(200);
    expect(verifyUser).not.toHaveBeenCalled();
  });
});

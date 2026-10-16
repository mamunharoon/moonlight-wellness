import { describe, it, expect, vi } from 'vitest';
import { resolveBetaVideoUrlRequest } from '../../supabase/functions/_shared/betaVideoUrlAccess.ts';

// Phase 2C — the real, unweakened server-side authorization boundary
// (docs/phase-2c-access-specification.md §6/§7). get-beta-video-url/
// index.ts is the only real caller; this exercises resolveBetaVideoUrlRequest
// directly with fakes for verifyUser/resolvePath/signUrl/checkPremiumAccess,
// the same dependency-injection approach the pre-existing guest-allowlist
// behaviour was already designed for (see that function's own header).

const FREE_ID = 'S04'; // §3b — Morning journey default stretch, Free.
const PREMIUM_ID = 'B04'; // §3c — Coherent Breathing (video), Plus variety.
const GUEST_ID = 'IB01'; // §3a — out of scope, guest-allowed.
const UNKNOWN_ID = 'ZZ99'; // never in EXERCISE_PATHS.
const COVER_ID = 'S06COVER'; // preview-only cover image — never independently Plus-gated (see premiumExerciseIds.ts).

const okUser = (overrides = {}) => ({ user: { id: 'user-1', is_anonymous: false, ...overrides } });

const baseArgs = (overrides = {}) => ({
  authorizationHeader: 'Bearer real-jwt',
  body: { exerciseId: FREE_ID },
  resolvePath: (id) =>
    ({ [FREE_ID]: 'path/free.mp4', [PREMIUM_ID]: 'path/premium.mp4', [GUEST_ID]: 'path/guest.m4a', [COVER_ID]: 'path/cover.png' }[id]),
  verifyUser: vi.fn(async () => okUser()),
  signUrl: vi.fn(async () => ({ signedUrl: 'https://signed.example/x' })),
  checkPremiumAccess: vi.fn(async () => ({ records: [], error: null })),
  ...overrides
});

describe('resolveBetaVideoUrlRequest — identity gate (unaffected by Phase 2C)', () => {
  it('401s with no Authorization header for a non-guest-allowed id', async () => {
    const result = await resolveBetaVideoUrlRequest(baseArgs({ authorizationHeader: null }));
    expect(result.status).toBe(401);
  });

  it('401s when verifyUser reports an error', async () => {
    const result = await resolveBetaVideoUrlRequest(baseArgs({ verifyUser: vi.fn(async () => ({ user: null, error: 'bad jwt' })) }));
    expect(result.status).toBe(401);
  });

  it('403s for an anonymous (guest) user', async () => {
    const result = await resolveBetaVideoUrlRequest(baseArgs({ verifyUser: vi.fn(async () => okUser({ is_anonymous: true })) }));
    expect(result.status).toBe(403);
  });

  it('a guest-allowed id needs no JWT at all, and never calls checkPremiumAccess', async () => {
    const checkPremiumAccess = vi.fn(async () => ({ records: [], error: null }));
    const result = await resolveBetaVideoUrlRequest(
      baseArgs({ authorizationHeader: null, body: { exerciseId: GUEST_ID }, checkPremiumAccess })
    );
    expect(result.status).toBe(200);
    expect(checkPremiumAccess).not.toHaveBeenCalled();
  });

  it('an unknown id 404s before the premium check ever runs (premiumExerciseIds.ts usage contract)', async () => {
    const checkPremiumAccess = vi.fn(async () => ({ records: [], error: null }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: UNKNOWN_ID }, checkPremiumAccess }));
    expect(result.status).toBe(404);
    expect(checkPremiumAccess).not.toHaveBeenCalled();
  });
});

describe('resolveBetaVideoUrlRequest — §6 premium authorization boundary', () => {
  it('a Free id is authorized for any signed-in, non-anonymous user without ever checking entitlements', async () => {
    const checkPremiumAccess = vi.fn(async () => ({ records: [], error: null }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: FREE_ID }, checkPremiumAccess }));
    expect(result.status).toBe(200);
    expect(result.body.url).toBe('https://signed.example/x');
    expect(checkPremiumAccess).not.toHaveBeenCalled();
  });

  it('denies a Premium id with zero entitlement records (never-subscribed)', async () => {
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: PREMIUM_ID } }));
    expect(result.status).toBe(403);
    expect(result.body.error).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('authorizes a Premium id for a trial record', async () => {
    const checkPremiumAccess = vi.fn(async () => ({
      records: [{ provider: 'apple', status: 'trial', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }],
      error: null
    }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess }));
    expect(result.status).toBe(200);
  });

  it('authorizes a Premium id for an active, paid record', async () => {
    const checkPremiumAccess = vi.fn(async () => ({
      records: [{ provider: 'stripe', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }],
      error: null
    }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess }));
    expect(result.status).toBe(200);
  });

  it('authorizes a cancelled-but-still-active record (status active, real future expiry) — never revoked early', async () => {
    const checkPremiumAccess = vi.fn(async () => ({
      records: [{ provider: 'apple', status: 'active', currentPeriodExpiresAt: '2099-06-01T00:00:00Z' }],
      error: null
    }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess }));
    expect(result.status).toBe(200);
  });

  it('denies an expired record', async () => {
    const checkPremiumAccess = vi.fn(async () => ({
      records: [{ provider: 'apple', status: 'expired', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' }],
      error: null
    }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess }));
    expect(result.status).toBe(403);
  });

  it('fails closed on a stale "active" row whose expires_at has already passed (webhook lag never implies continued access)', async () => {
    const checkPremiumAccess = vi.fn(async () => ({
      records: [{ provider: 'stripe', status: 'active', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' }],
      error: null
    }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess }));
    expect(result.status).toBe(403);
  });

  it('fails closed on a recurring-provider record with a missing expires_at (data-integrity problem, never implicit unlimited access)', async () => {
    const checkPremiumAccess = vi.fn(async () => ({
      records: [{ provider: 'google', status: 'active', currentPeriodExpiresAt: null }],
      error: null
    }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess }));
    expect(result.status).toBe(403);
  });

  it('authorizes a manual (admin-granted) record with a null expires_at — the one documented exception', async () => {
    const checkPremiumAccess = vi.fn(async () => ({
      records: [{ provider: 'manual', status: 'active', currentPeriodExpiresAt: null }],
      error: null
    }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess }));
    expect(result.status).toBe(200);
  });

  it('grace_period and billing_retry continue access only while before the known expiry', async () => {
    const grace = vi.fn(async () => ({
      records: [{ provider: 'apple', status: 'grace_period', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }],
      error: null
    }));
    const graceResult = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess: grace }));
    expect(graceResult.status).toBe(200);

    const graceExpired = vi.fn(async () => ({
      records: [{ provider: 'apple', status: 'grace_period', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' }],
      error: null
    }));
    const graceExpiredResult = await resolveBetaVideoUrlRequest(
      baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess: graceExpired })
    );
    expect(graceExpiredResult.status).toBe(403);
  });

  it('one still-valid provider grants access even if another provider record on the same account has lapsed (pure OR)', async () => {
    const checkPremiumAccess = vi.fn(async () => ({
      records: [
        { provider: 'stripe', status: 'expired', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' },
        { provider: 'apple', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }
      ],
      error: null
    }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess }));
    expect(result.status).toBe(200);
  });

  it('fails closed (never silently Free, never silently granted) when the entitlement read itself errors — a signed URL is never issued', async () => {
    const signUrl = vi.fn(async () => ({ signedUrl: 'should-never-be-returned' }));
    const checkPremiumAccess = vi.fn(async () => ({ records: [], error: 'db unreachable' }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess, signUrl }));
    expect(result.status).toBe(503);
    expect(result.body.error).toBe('VERIFICATION_UNAVAILABLE');
    expect(signUrl).not.toHaveBeenCalled();
  });

  it('a Free id still succeeds even when the (unused) checkPremiumAccess dependency would itself error — a transient verification failure never takes down free content', async () => {
    const checkPremiumAccess = vi.fn(async () => ({ records: [], error: 'db unreachable' }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: FREE_ID }, checkPremiumAccess }));
    expect(result.status).toBe(200);
    expect(checkPremiumAccess).not.toHaveBeenCalled();
  });
});

describe('resolveBetaVideoUrlRequest — account switching', () => {
  it('passes the freshly-verified caller\'s own user id to checkPremiumAccess, never a client-supplied one', async () => {
    const checkPremiumAccess = vi.fn(async () => ({ records: [], error: null }));
    const verifyUser = vi.fn(async () => okUser({ id: 'user-currently-authenticated' }));
    // A client-supplied userId anywhere in `body` must never be trusted —
    // resolveBetaVideoUrlRequest's own body parsing only ever reads
    // `exerciseId`, so this also proves a spoofed field is silently ignored.
    await resolveBetaVideoUrlRequest(
      baseArgs({ body: { exerciseId: PREMIUM_ID, userId: 'attacker-supplied-id' }, checkPremiumAccess, verifyUser })
    );
    expect(checkPremiumAccess).toHaveBeenCalledWith('user-currently-authenticated');
  });

  it('switching accounts re-evaluates fresh — a verified entitlement never carries over to a different signed-in user', async () => {
    const checkPremiumAccess = vi.fn(async (userId) =>
      userId === 'subscriber'
        ? { records: [{ provider: 'stripe', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }], error: null }
        : { records: [], error: null }
    );
    const subscriberResult = await resolveBetaVideoUrlRequest(
      baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess, verifyUser: vi.fn(async () => okUser({ id: 'subscriber' })) })
    );
    expect(subscriberResult.status).toBe(200);

    const freeUserResult = await resolveBetaVideoUrlRequest(
      baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess, verifyUser: vi.fn(async () => okUser({ id: 'someone-else' })) })
    );
    expect(freeUserResult.status).toBe(403);
  });
});

describe('resolveBetaVideoUrlRequest — direct protected-resource requests', () => {
  it('a direct request for a Premium id with a valid JWT but no Plus entitlement is denied server-side regardless of any client-supplied flag', async () => {
    const result = await resolveBetaVideoUrlRequest(
      baseArgs({ body: { exerciseId: PREMIUM_ID, premium: false, isEntitled: true, plan: 'plus' } })
    );
    expect(result.status).toBe(403);
    expect(result.body.error).toBe('SUBSCRIPTION_REQUIRED');
  });
});

// Found and fixed this round: a cover image (S06COVER etc.) is a still
// PNG sidecar, never an independent paid activity (see
// premiumExerciseIds.ts's own PREVIEW_ONLY_COVER_IDS comment and
// mediaCatalogPremiumClassification.test.js's dedicated coverage of all
// 5 covers). Before the fix, isPremiumExerciseId's own "not in the Free
// set is Plus" rule misclassified every cover as Plus, which would 403
// a signed-in, non-entitled, non-anonymous user's cover-image request
// even for a would-be-Free parent - this is the exact end-to-end
// regression test for that fix, through the real request-resolution
// path (not just the unit-level premiumExerciseIds.ts check).
describe('resolveBetaVideoUrlRequest — a cover image is never independently Plus-gated', () => {
  it('a signed-in, non-entitled, non-anonymous user can still fetch a cover image directly, with no entitlement check at all', async () => {
    const checkPremiumAccess = vi.fn(async () => ({ records: [], error: null }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: COVER_ID }, checkPremiumAccess }));
    expect(result.status).toBe(200);
    expect(checkPremiumAccess).not.toHaveBeenCalled();
  });
});

describe('resolveBetaVideoUrlRequest — manual (admin-granted) records honor a real expiry when one is present', () => {
  it('a manual record with a null expires_at is authorized (the one documented exception)', async () => {
    const checkPremiumAccess = vi.fn(async () => ({
      records: [{ provider: 'manual', status: 'active', currentPeriodExpiresAt: null }],
      error: null
    }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess }));
    expect(result.status).toBe(200);
  });

  it('a manual record with a real, still-future expires_at is authorized', async () => {
    const checkPremiumAccess = vi.fn(async () => ({
      records: [{ provider: 'manual', status: 'active', currentPeriodExpiresAt: '2099-01-01T00:00:00Z' }],
      error: null
    }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess }));
    expect(result.status).toBe(200);
  });

  it('a manual record with a real, already-PAST expires_at is denied — §9a requires a mandatory, honored expiry once a real one is set, never an unconditional bypass just because provider==="manual"', async () => {
    const checkPremiumAccess = vi.fn(async () => ({
      records: [{ provider: 'manual', status: 'active', currentPeriodExpiresAt: '2020-01-01T00:00:00Z' }],
      error: null
    }));
    const result = await resolveBetaVideoUrlRequest(baseArgs({ body: { exerciseId: PREMIUM_ID }, checkPremiumAccess }));
    expect(result.status).toBe(403);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let nativeFlag = false;
vi.mock('./platform', () => ({
  isNativePlatform: () => nativeFlag,
}));

const { getPasswordResetRedirectUrl } = await import('./authRedirect');

beforeEach(() => {
  nativeFlag = false;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getPasswordResetRedirectUrl', () => {
  it('returns the fixed native wakewise:// url on native platforms, regardless of web args', () => {
    nativeFlag = true;
    expect(
      getPasswordResetRedirectUrl({ hostname: 'wakewise.vercel.app', origin: 'https://wakewise.vercel.app' })
    ).toBe('wakewise://reset-password');
  });

  it('returns the fixed DEV preview url on the web for a normal hostname', () => {
    expect(
      getPasswordResetRedirectUrl({ hostname: 'wakewise-git-dev-mamun65.vercel.app', origin: 'https://wakewise-git-dev-mamun65.vercel.app' })
    ).toBe('https://wakewise-git-dev-mamun65.vercel.app/reset-password');
  });

  it('never trusts an arbitrary/untrusted origin, even if it looks plausible', () => {
    expect(
      getPasswordResetRedirectUrl({ hostname: 'wakewise.vercel.app', origin: 'https://wakewise.vercel.app' })
    ).toBe('https://wakewise-git-dev-mamun65.vercel.app/reset-password');
    expect(
      getPasswordResetRedirectUrl({ hostname: 'evil.example.com', origin: 'https://evil.example.com' })
    ).toBe('https://wakewise-git-dev-mamun65.vercel.app/reset-password');
  });

  it('never restores the old Moonlight production URL', () => {
    const result = getPasswordResetRedirectUrl({ hostname: 'moonlight-wellness.vercel.app', origin: 'https://moonlight-wellness.vercel.app' });
    expect(result).not.toMatch(/moonlight/i);
  });

  it('uses the current origin only for the explicit localhost development rule', () => {
    expect(getPasswordResetRedirectUrl({ hostname: 'localhost', origin: 'http://localhost:5173' })).toBe(
      'http://localhost:5173/reset-password'
    );
    expect(getPasswordResetRedirectUrl({ hostname: '127.0.0.1', origin: 'http://127.0.0.1:5173' })).toBe(
      'http://127.0.0.1:5173/reset-password'
    );
  });

  it('falls back to the fixed constant with no window at all (SSR/build-tooling safety)', () => {
    expect(getPasswordResetRedirectUrl({ hostname: undefined, origin: undefined })).toBe(
      'https://wakewise-git-dev-mamun65.vercel.app/reset-password'
    );
  });
});

// WEB_RESET_PASSWORD_URL is a module-level const, computed once at import
// time from import.meta.env.VITE_WEB_RESET_PASSWORD_URL (authRedirect.js)
// - the same shape as buildInfo.js's own IS_DEV_BACKEND, and tested the
// same way: vi.stubEnv + vi.resetModules + a fresh dynamic import per
// case, rather than asserting on the already-imported value above (which
// only ever reflects whatever this process's own env happened to have at
// first import, never a case this test controls).
describe('WEB_RESET_PASSWORD_URL — re-evaluated under controlled VITE_WEB_RESET_PASSWORD_URL values', () => {
  const loadFresh = async () => {
    vi.resetModules();
    return import('./authRedirect');
  };

  it('a non-native, non-localhost caller uses VITE_WEB_RESET_PASSWORD_URL when it is set (the Production case)', async () => {
    vi.stubEnv('VITE_WEB_RESET_PASSWORD_URL', 'https://production-example.invalid/reset-password');
    const fresh = await loadFresh();
    expect(
      fresh.getPasswordResetRedirectUrl({ hostname: 'production-example.invalid', origin: 'https://production-example.invalid' })
    ).toBe('https://production-example.invalid/reset-password');
  });

  it('still falls back to the DEV preview constant when the var is unset (Preview/DEV needs no new config)', async () => {
    vi.stubEnv('VITE_WEB_RESET_PASSWORD_URL', '');
    const fresh = await loadFresh();
    expect(
      fresh.getPasswordResetRedirectUrl({ hostname: 'wakewise-git-dev-mamun65.vercel.app', origin: 'https://wakewise-git-dev-mamun65.vercel.app' })
    ).toBe('https://wakewise-git-dev-mamun65.vercel.app/reset-password');
  });

  it('native still returns the fixed wakewise:// scheme even when VITE_WEB_RESET_PASSWORD_URL is set - this var is web-only', async () => {
    vi.stubEnv('VITE_WEB_RESET_PASSWORD_URL', 'https://production-example.invalid/reset-password');
    nativeFlag = true;
    const fresh = await loadFresh();
    expect(fresh.getPasswordResetRedirectUrl({ hostname: 'anything', origin: 'https://anything' })).toBe('wakewise://reset-password');
  });

  it('the explicit localhost development rule still wins even when VITE_WEB_RESET_PASSWORD_URL is set', async () => {
    vi.stubEnv('VITE_WEB_RESET_PASSWORD_URL', 'https://production-example.invalid/reset-password');
    const fresh = await loadFresh();
    expect(fresh.getPasswordResetRedirectUrl({ hostname: 'localhost', origin: 'http://localhost:5173' })).toBe(
      'http://localhost:5173/reset-password'
    );
  });
});

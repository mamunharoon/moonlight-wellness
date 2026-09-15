import { describe, it, expect, vi, beforeEach } from 'vitest';

let nativeFlag = false;
vi.mock('./platform', () => ({
  isNativePlatform: () => nativeFlag,
}));

const { getPasswordResetRedirectUrl } = await import('./authRedirect');

beforeEach(() => {
  nativeFlag = false;
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

// DEV build-freshness indicator (2026-10-22) — real executable coverage
// for buildInfo.js's own logic (the real exported function, not a copy),
// plus source-level checks for DevBuildIndicator.jsx/Auth.jsx/Layout.jsx's
// gating and mounting (this repo's Vitest has no DOM rendering
// capability; see libraryCategoryNavigation.test.js's own header comment
// for the established precedent).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUILD_COMMIT, BUILD_COMMIT_FULL, BUILD_TIME_ISO, BUILD_TIME_LABEL, isDevBackendUrl } from './buildInfo';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isDevBackendUrl — the real function IS_DEV_BACKEND is built from', () => {
  it('recognises the real DEV Supabase project URL', () => {
    expect(isDevBackendUrl('https://kvdxuhyndevrfvsalgnx.supabase.co')).toBe(true);
  });

  it('rejects a different (e.g. production) Supabase project URL', () => {
    expect(isDevBackendUrl('https://some-other-project-ref.supabase.co')).toBe(false);
  });

  it('rejects null/undefined/empty without throwing', () => {
    expect(isDevBackendUrl(null)).toBe(false);
    expect(isDevBackendUrl(undefined)).toBe(false);
    expect(isDevBackendUrl('')).toBe(false);
  });
});

// IS_DEV_BACKEND is a module-level const, computed once at import time from
// import.meta.env.VITE_SUPABASE_URL (buildInfo.js line 48) - the exact
// value this *process's* own .env.local happened to resolve to at the
// moment Vitest first loaded the module. Asserting on the already-imported
// IS_DEV_BACKEND above (as this block used to) makes the test's result
// depend entirely on whichever machine/CI job runs it and what its
// .env.local (or CI env) happens to contain - true under a DEV-pointed
// local checkout, false under this same repo built with production
// environment selection (e.g. the wakewise-ios-production Codemagic
// workflow, which hard-requires VITE_SUPABASE_URL to target
// wqpszprbuqdjcfmdqdlv, never DEV). That is backwards for a test: it
// should prove the DEV/production decision logic itself is correct for
// every real input, not assert today's ambient machine state and call
// a legitimate, expected difference a failure.
//
// Fixed by controlling the input directly: vi.stubEnv sets
// import.meta.env.VITE_SUPABASE_URL for this test only (auto-reverted by
// the afterEach above), and vi.resetModules() + a fresh dynamic import
// forces buildInfo.js's module-level const to be re-evaluated against
// that stubbed value - the same technique revenueCatConfig.test.js
// already established for its own import.meta.env-dependent exports. This
// never touches the real .env.local, never changes buildInfo.js's own
// logic, and never forces a DEV value into a production-targeted run -
// it only makes the test assert the real decision rule against inputs it
// chooses, independent of whatever environment happens to be running it.
describe('IS_DEV_BACKEND — the real module export, re-evaluated under controlled VITE_SUPABASE_URL values', () => {
  const loadFreshBuildInfo = async () => {
    vi.resetModules();
    return import('./buildInfo');
  };

  it('is true when VITE_SUPABASE_URL is the real DEV project URL', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://kvdxuhyndevrfvsalgnx.supabase.co');
    const fresh = await loadFreshBuildInfo();
    expect(fresh.IS_DEV_BACKEND).toBe(true);
  });

  it('is false when VITE_SUPABASE_URL is the real production project URL (wqpszprbuqdjcfmdqdlv)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://wqpszprbuqdjcfmdqdlv.supabase.co');
    const fresh = await loadFreshBuildInfo();
    expect(fresh.IS_DEV_BACKEND).toBe(false);
  });

  it('is false when VITE_SUPABASE_URL is missing (unset/empty)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    const fresh = await loadFreshBuildInfo();
    expect(fresh.IS_DEV_BACKEND).toBe(false);
  });

  it('is false for an unknown/unrelated Supabase project URL', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://some-other-project-ref.supabase.co');
    const fresh = await loadFreshBuildInfo();
    expect(fresh.IS_DEV_BACKEND).toBe(false);
  });
});

describe('build commit/time are real, baked-in values, never the literal "unknown" in a real build', () => {
  it('BUILD_COMMIT_FULL looks like a real git SHA (40 hex chars) under this test run', () => {
    expect(BUILD_COMMIT_FULL).toMatch(/^[0-9a-f]{40}$/);
  });

  it('BUILD_COMMIT is the first 7 characters of BUILD_COMMIT_FULL', () => {
    expect(BUILD_COMMIT).toBe(BUILD_COMMIT_FULL.slice(0, 7));
  });

  it('BUILD_TIME_ISO is a real, parseable timestamp, and BUILD_TIME_LABEL renders it in UTC', () => {
    expect(Number.isNaN(new Date(BUILD_TIME_ISO).getTime())).toBe(false);
    expect(BUILD_TIME_LABEL).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/);
  });
});

describe('DevBuildIndicator.jsx — only ever rendered for a DEV-backend build', () => {
  const source = readFileSync(fileURLToPath(new URL('../components/DevBuildIndicator.jsx', import.meta.url)), 'utf-8');

  it('returns null before rendering anything when IS_DEV_BACKEND is false', () => {
    expect(source).toMatch(/if \(!IS_DEV_BACKEND\) return null;/);
  });

  it('shows the short commit and the UTC build-time label, not the full 40-char SHA', () => {
    expect(source).toMatch(/\{BUILD_COMMIT\}/);
    expect(source).not.toMatch(/BUILD_COMMIT_FULL/);
    expect(source).toMatch(/\{BUILD_TIME_LABEL\}/);
  });
});

describe('mounted on the login screen and inside the app shell', () => {
  it('Auth.jsx (the login screen) imports and renders DevBuildIndicator', () => {
    const authSource = readFileSync(fileURLToPath(new URL('../pages/Auth.jsx', import.meta.url)), 'utf-8');
    expect(authSource).toMatch(/import \{ DevBuildIndicator \} from '\.\.\/components\/DevBuildIndicator';/);
    expect(authSource).toMatch(/<DevBuildIndicator \/>/);
  });

  it('Layout.jsx (the app shell every main bottom-nav page renders inside) imports and renders DevBuildIndicator', () => {
    const layoutSource = readFileSync(fileURLToPath(new URL('../components/Layout.jsx', import.meta.url)), 'utf-8');
    expect(layoutSource).toMatch(/import \{ DevBuildIndicator \} from '\.\/DevBuildIndicator';/);
    expect(layoutSource).toMatch(/<DevBuildIndicator \/>/);
  });
});

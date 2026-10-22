// DEV build-freshness indicator (2026-10-22) — real executable coverage
// for buildInfo.js's own logic (the real exported function, not a copy),
// plus source-level checks for DevBuildIndicator.jsx/Auth.jsx/Layout.jsx's
// gating and mounting (this repo's Vitest has no DOM rendering
// capability; see libraryCategoryNavigation.test.js's own header comment
// for the established precedent).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUILD_COMMIT, BUILD_COMMIT_FULL, BUILD_TIME_ISO, BUILD_TIME_LABEL, IS_DEV_BACKEND, isDevBackendUrl } from './buildInfo';

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

describe('IS_DEV_BACKEND reflects this test run\'s own real VITE_SUPABASE_URL (.env.local)', () => {
  it('is true here, since this repo\'s own .env.local points at the DEV project', () => {
    // If this ever fails, .env.local no longer points at the DEV project —
    // a real, meaningful signal, not a test that should be "fixed" to pass.
    expect(IS_DEV_BACKEND).toBe(true);
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

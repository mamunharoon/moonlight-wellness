import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatEnvironmentBuildLabel } from './environmentBuildInfo';

describe('formatEnvironmentBuildLabel', () => {
  it('shows DEV, the native build, and the commit together', () => {
    expect(formatEnvironmentBuildLabel({ isDevBackend: true, nativeBuild: '42', commit: 'a1b2c3d' }))
      .toBe('DEV · Build 42 · a1b2c3d');
  });

  it('shows PRODUCTION (not DEV) when isDevBackend is false', () => {
    expect(formatEnvironmentBuildLabel({ isDevBackend: false, nativeBuild: '56', commit: '3ccb82c' }))
      .toBe('PRODUCTION · Build 56 · 3ccb82c');
  });

  it('omits the build segment entirely on web, where no native build number exists', () => {
    expect(formatEnvironmentBuildLabel({ isDevBackend: false, nativeBuild: null, commit: '3ccb82c' }))
      .toBe('PRODUCTION · 3ccb82c');
  });

  it('omits the commit segment when it is the literal "unknown" fallback (define did not apply)', () => {
    expect(formatEnvironmentBuildLabel({ isDevBackend: true, nativeBuild: '42', commit: 'unknown' }))
      .toBe('DEV · Build 42');
  });

  it('never includes a key, token, URL, or any value beyond environment/build/commit', () => {
    const result = formatEnvironmentBuildLabel({ isDevBackend: true, nativeBuild: '42', commit: 'a1b2c3d' });
    expect(result).not.toMatch(/https?:\/\/|key|token|secret/i);
  });
});

describe('Settings.jsx — Environment row wired from real data, not a hardcoded constant', () => {
  const source = readFileSync(fileURLToPath(new URL('../pages/Settings.jsx', import.meta.url)), 'utf-8');

  it('imports IS_DEV_BACKEND/BUILD_COMMIT from buildInfo.js - the same real, build-time-injected values DevBuildIndicator.jsx already uses', () => {
    expect(source).toMatch(/import \{ IS_DEV_BACKEND, BUILD_COMMIT \} from '\.\.\/lib\/buildInfo';/);
  });

  it('reads the native build number at runtime via @capacitor/app, never a hardcoded literal', () => {
    expect(source).toMatch(/CapacitorApp\.getInfo\(\)/);
    expect(source).toMatch(/if \(!isNativePlatform\(\)\) return;/);
  });

  it('renders the Environment row via formatEnvironmentBuildLabel, passing the real derived values', () => {
    expect(source).toMatch(/formatEnvironmentBuildLabel\(\{ isDevBackend: IS_DEV_BACKEND, nativeBuild, commit: BUILD_COMMIT \}\)/);
  });

  it('the pre-existing Version/Build number rows are untouched - this is an additive third row, not a replacement', () => {
    expect(source).toMatch(/APP_VERSION/);
    expect(source).toMatch(/BUILD_NUMBER/);
  });
});

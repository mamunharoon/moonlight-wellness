import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveEnvironmentLabel, formatBuildCommitLabel } from './environmentBuildInfo';

describe('resolveEnvironmentLabel — the real decision Settings.jsx shows', () => {
  it('is DEV for the real DEV Supabase project URL', () => {
    expect(resolveEnvironmentLabel('https://kvdxuhyndevrfvsalgnx.supabase.co')).toBe('DEV');
  });

  it('is PRODUCTION for the real production Supabase project URL', () => {
    expect(resolveEnvironmentLabel('https://wqpszprbuqdjcfmdqdlv.supabase.co')).toBe('PRODUCTION');
  });

  it('is UNKNOWN for an unrecognised Supabase project URL, never silently PRODUCTION', () => {
    expect(resolveEnvironmentLabel('https://some-other-project-ref.supabase.co')).toBe('UNKNOWN');
  });

  it('is UNKNOWN for missing configuration (null/undefined/empty), never thrown or silently PRODUCTION', () => {
    expect(resolveEnvironmentLabel(null)).toBe('UNKNOWN');
    expect(resolveEnvironmentLabel(undefined)).toBe('UNKNOWN');
    expect(resolveEnvironmentLabel('')).toBe('UNKNOWN');
  });
});

describe('formatBuildCommitLabel', () => {
  it('joins the native build and commit together', () => {
    expect(formatBuildCommitLabel({ nativeBuild: '42', commit: 'a1b2c3d' })).toBe('Build 42 · a1b2c3d');
  });

  it('omits the build segment entirely on web, where no native build number exists', () => {
    expect(formatBuildCommitLabel({ nativeBuild: null, commit: '3ccb82c' })).toBe('3ccb82c');
  });

  it('omits the commit segment when it is the literal "unknown" fallback (define did not apply)', () => {
    expect(formatBuildCommitLabel({ nativeBuild: '42', commit: 'unknown' })).toBe('Build 42');
  });

  it('never includes a key, token, URL, or any value beyond build/commit', () => {
    const result = formatBuildCommitLabel({ nativeBuild: '42', commit: 'a1b2c3d' });
    expect(result).not.toMatch(/https?:\/\/|key|token|secret/i);
  });
});

describe('Settings.jsx — Environment row wired from real data, not a hardcoded constant', () => {
  const source = readFileSync(fileURLToPath(new URL('../pages/Settings.jsx', import.meta.url)), 'utf-8');

  it('imports BUILD_COMMIT from buildInfo.js - the same real, build-time-injected value DevBuildIndicator.jsx already uses', () => {
    expect(source).toMatch(/import \{ BUILD_COMMIT \} from '\.\.\/lib\/buildInfo';/);
  });

  it('imports ENVIRONMENT_LABEL from environmentBuildInfo.js, derived from the configured Supabase project - never a branch name or build number', () => {
    expect(source).toMatch(/import \{ ENVIRONMENT_LABEL, formatBuildCommitLabel \} from '\.\.\/lib\/environmentBuildInfo';/);
  });

  it('reads the native build number at runtime via @capacitor/app, never a hardcoded literal', () => {
    expect(source).toMatch(/CapacitorApp\.getInfo\(\)/);
    expect(source).toMatch(/if \(!isNativePlatform\(\)\) return;/);
  });

  it('renders ENVIRONMENT_LABEL directly (DEV/PRODUCTION/UNKNOWN) as its own clearly-shown value', () => {
    expect(source).toMatch(/\{ENVIRONMENT_LABEL\}/);
  });

  it('renders the build number and commit underneath the environment label, via formatBuildCommitLabel', () => {
    expect(source).toMatch(/formatBuildCommitLabel\(\{ nativeBuild, commit: BUILD_COMMIT \}\)/);
  });

  it('the Environment row is additive, independent of the separate Version/Build number rows - 2026-11-05 "native TestFlight display fix" (ported from dev commit dece7dd) corrected those two rows to also read real native data (useNativeAppInfo, a second/different App.getInfo() consumer), but this Environment row/its own nativeBuild effect/BUILD_COMMIT/ENVIRONMENT_LABEL wiring is completely untouched by that change - still the exact same imports and rendering verified by every other test in this file', () => {
    expect(source).toMatch(/import \{ useNativeAppInfo \} from '\.\.\/hooks\/useNativeAppInfo';/);
    expect(source).not.toMatch(/const APP_VERSION/);
    expect(source).not.toMatch(/const BUILD_NUMBER/);
    // The pre-existing Environment row's own nativeBuild state/effect -
    // a SEPARATE App.getInfo() consumer from useNativeAppInfo - survives
    // byte-for-byte: still exactly one, never merged or removed.
    // useNativeAppInfo's own CapacitorApp.getInfo() call lives in its own
    // file (src/hooks/useNativeAppInfo.js - see that file's own test),
    // not inlined here, so this file's own source text still shows only
    // the pre-existing Environment row's single call.
    expect((source.match(/const \[nativeBuild, setNativeBuild\] = useState\(null\);/g) ?? []).length).toBe(1);
    expect((source.match(/CapacitorApp\.getInfo\(\)/g) ?? []).length).toBe(1);
  });

  it('the Environment row sits in the always-rendered Application section, not behind the gated Diagnostics section', () => {
    const applicationSectionStart = source.indexOf('Application');
    const diagnosticsGateStart = source.indexOf("isSubscriptionSandboxTestVisible()");
    const environmentRowIndex = source.indexOf('{ENVIRONMENT_LABEL}');
    expect(applicationSectionStart).toBeGreaterThan(-1);
    expect(environmentRowIndex).toBeGreaterThan(applicationSectionStart);
    // The Diagnostics gate (if present at all) must not wrap the Environment row.
    if (diagnosticsGateStart > -1) {
      expect(environmentRowIndex < diagnosticsGateStart || environmentRowIndex > source.indexOf('</section>', diagnosticsGateStart)).toBe(true);
    }
  });
});

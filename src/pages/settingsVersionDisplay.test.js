// Regression guard for the 2026-11-05 Settings "Application" version/
// build display fix (ported from dev commit dece7dd onto this
// PROD-bound branch). Owner report: the installed DEV TestFlight app
// showed "Version 0.0.0 / Build number 1" - both hardcoded constants
// mirroring package.json's own stale "version": "0.0.0" placeholder,
// never the real native CFBundleShortVersionString/CFBundleVersion.
// This branch's own separate Environment row (nativeBuild/
// buildCommitLabel/ENVIRONMENT_LABEL) is a different, pre-existing
// feature left completely untouched - see environmentBuildInfo.test.js.
//
// No DOM/component rendering is available in this repo's Vitest (node
// environment - see vite.config.js) - source-level checks, matching
// every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Settings.jsx', import.meta.url)), 'utf-8');

describe('Settings.jsx — Application version/build now read from useNativeAppInfo, never hardcoded', () => {
  it('no hardcoded APP_VERSION/BUILD_NUMBER constants or the old "0.0.0" literal remain', () => {
    expect(source).not.toMatch(/const APP_VERSION/);
    expect(source).not.toMatch(/const BUILD_NUMBER/);
    expect(source).not.toMatch(/'0\.0\.0'/);
  });

  it('imports and calls useNativeAppInfo', () => {
    expect(source).toMatch(/import \{ useNativeAppInfo \} from '\.\.\/hooks\/useNativeAppInfo';/);
    expect(source).toMatch(/const appInfo = useNativeAppInfo\(\);/);
  });

  it('versionDisplay/buildDisplay use the real native value when ready, falling back to an honest (never fabricated) label for every other status', () => {
    expect(source).toMatch(/const versionDisplay = appInfo\.status === 'ready' \? appInfo\.version : VERSION_DISPLAY\[appInfo\.status\];/);
    expect(source).toMatch(/const buildDisplay = appInfo\.status === 'ready' \? appInfo\.build : VERSION_DISPLAY\[appInfo\.status\];/);
  });

  it('VERSION_DISPLAY covers web/loading/error with non-numeric, clearly-not-a-real-version labels - a browser preview can never be mistaken for real native build info', () => {
    const mapBlock = source.match(/const VERSION_DISPLAY = Object\.freeze\(\{[\s\S]*?\}\);/)?.[0] ?? '';
    expect(mapBlock).not.toBe('');
    expect(mapBlock).toMatch(/web: 'Web preview'/);
    expect(mapBlock).toMatch(/loading: 'Loading…'/);
    expect(mapBlock).toMatch(/error: 'Unavailable'/);
  });

  it('the Application section\'s Version and Build number rows render versionDisplay/buildDisplay, not a literal string', () => {
    expect(source).toMatch(/<span className="text-sm font-semibold text-on-surface-variant">Version<\/span>\s*\n\s*<span className="text-sm text-on-surface-variant">\{versionDisplay\}<\/span>/);
    expect(source).toMatch(/<span className="text-sm font-semibold text-on-surface-variant">Build number<\/span>\s*\n\s*<span className="text-sm text-on-surface-variant">\{buildDisplay\}<\/span>/);
  });

  it('this branch\'s own pre-existing Environment row (nativeBuild/buildCommitLabel/ENVIRONMENT_LABEL) is completely untouched by this fix - a separate, additive third row', () => {
    expect(source).toMatch(/const \[nativeBuild, setNativeBuild\] = useState\(null\);/);
    expect(source).toMatch(/const buildCommitLabel = formatBuildCommitLabel\(\{ nativeBuild, commit: BUILD_COMMIT \}\);/);
    expect(source).toMatch(/\{ENVIRONMENT_LABEL\}/);
  });
});

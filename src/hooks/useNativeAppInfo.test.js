// Regression guard for the 2026-11-05 Settings "Application" version/
// build display fix (ported from dev commit dece7dd onto this
// PROD-bound branch): the installed TestFlight app was showing
// hardcoded "Version 0.0.0 / Build number 1" instead of the real native
// values. useNativeAppInfo reads them from @capacitor/app's
// App.getInfo() at runtime - the one source that's always correct for
// whatever build is actually running. This is a separate concern from
// this branch's own pre-existing Environment row (environmentBuildInfo.js)
// - see environmentBuildInfo.test.js for that row's own, unmodified
// coverage.
//
// No DOM/component rendering is available in this repo's Vitest (node
// environment, no testing-library - see vite.config.js) - this hook
// uses useState/useEffect and genuinely needs a renderer to execute, so
// source-level checks are used here, matching every other regression
// guard in this codebase that hits the same constraint.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./useNativeAppInfo.js', import.meta.url)), 'utf-8');

describe('useNativeAppInfo.js — native source of truth, web-safe', () => {
  it('imports App.getInfo from @capacitor/app and isNativePlatform from lib/platform - the same imports/convention this branch\'s own Environment row effect and useNativeDeepLinks.js/MorningReminderContext.jsx already use', () => {
    expect(source).toMatch(/import \{ App as CapacitorApp \} from '@capacitor\/app';/);
    expect(source).toMatch(/import \{ isNativePlatform \} from '\.\.\/lib\/platform';/);
  });

  it('never calls CapacitorApp.getInfo() without first checking isNativePlatform() - getInfo() has no web implementation (@capacitor/app\'s own web shim throws "Not implemented on web.")', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[\]\);/)?.[0] ?? '';
    expect(effectBody).not.toBe('');
    expect(effectBody).toMatch(/if \(!isNativePlatform\(\)\) return undefined;/);
    const guardIndex = effectBody.indexOf('if (!isNativePlatform())');
    const getInfoIndex = effectBody.indexOf('CapacitorApp.getInfo()');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(getInfoIndex).toBeGreaterThan(guardIndex);
  });

  it('the lazy initial state is also derived from isNativePlatform() - web starts as "web", native starts as "loading", never a fabricated version', () => {
    expect(source).toMatch(/useState\(\(\) => \(isNativePlatform\(\) \? \{ status: 'loading' \} : \{ status: 'web' \}\)\);/);
  });

  it('a successful getInfo() call sets status "ready" with the real version/build fields, never a hardcoded value', () => {
    expect(source).toMatch(/CapacitorApp\.getInfo\(\)/);
    expect(source).toMatch(/\.then\(\(\{ version, build \}\) => \{/);
    expect(source).toMatch(/setState\(\{ status: 'ready', version, build \}\);/);
  });

  it('a failed getInfo() call sets status "error" - never silently falls back to a fabricated number, and logs via console.warn (never throws/crashes the Settings screen)', () => {
    const catchBlock = source.match(/\.catch\(\(error\) => \{[\s\S]*?\n {6}\}\);/)?.[0] ?? '';
    expect(catchBlock).not.toBe('');
    expect(catchBlock).toMatch(/console\.warn\(/);
    expect(catchBlock).toMatch(/setState\(\{ status: 'error' \}\);/);
  });

  it('guards against a race (unmount/re-run before the promise resolves) via a cancelled flag, same pattern used throughout this codebase\'s async effects', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[\]\);/)?.[0] ?? '';
    expect(effectBody).toMatch(/let cancelled = false;/);
    expect(effectBody).toMatch(/if \(cancelled\) return;/);
    expect(effectBody).toMatch(/return \(\) => \{\s*\n\s*cancelled = true;\s*\n\s*\};/);
  });
});

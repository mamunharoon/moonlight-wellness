// WakeWise — native purchase integration: useNativeRestore.js. Source-level
// checks, same convention as useAppleRestore.test.js / useRevenueCatIdentity.test.js
// (no DOM/renderer available in this Vitest environment).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./useNativeRestore.js', import.meta.url)), 'utf-8');
const restoreBody = () => source.match(/const restore = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

describe('useNativeRestore — platform support covers both iOS and Android (readiness-gap item 1)', () => {
  it('supported is derived from platform.js directly (isNativePlatform + isIOS/isAndroid), never the legacy iOS-only isAppleIAPSupported', () => {
    expect(source).toMatch(/const supported = isNativePlatform\(\) && \(isIOS\(\) \|\| isAndroid\(\)\);/);
    expect(source).not.toMatch(/isAppleIAPSupported/);
  });

  it('exposes supported so a caller can hide the row entirely rather than show a non-functional control, exactly like the hook it replaces', () => {
    expect(source).toMatch(/return \{ state, error, restore, supported \};/);
  });
});

describe('useNativeRestore — identity readiness gates restore() before any SDK call (readiness-gap item 3)', () => {
  it('checks isRevenueCatIdentityReadyFor before calling restoreRevenueCatPurchases, and refuses with identity_not_ready rather than attempting the call', () => {
    const body = restoreBody();
    const readyCheckIdx = body.indexOf('isRevenueCatIdentityReadyFor(identityStatus, user?.id)');
    const sdkCallIdx = body.indexOf('await restoreRevenueCatPurchases()');
    expect(readyCheckIdx).toBeGreaterThan(-1);
    expect(sdkCallIdx).toBeGreaterThan(readyCheckIdx);
    expect(body).toMatch(/setState\('identity_not_ready'\);\s*\n\s*setError\(IDENTITY_NOT_READY_MESSAGE\);\s*\n\s*return;/);
  });

  it('the duplicate-tap guard runs before the identity check, so a second tap while restoring is still a no-op regardless of identity state', () => {
    const body = restoreBody();
    const dupGuardIdx = body.indexOf("state === 'restoring') return;");
    const readyCheckIdx = body.indexOf('isRevenueCatIdentityReadyFor');
    expect(dupGuardIdx).toBeGreaterThan(-1);
    expect(readyCheckIdx).toBeGreaterThan(dupGuardIdx);
  });
});

describe('useNativeRestore — never grants access from the native call alone; only a fresh entitlement read confirms it (readiness-gap item 4)', () => {
  it('a non-"restored" outcome (including receipt_already_in_use) never starts the confirmation poll', () => {
    const body = restoreBody();
    const outcomeCheckIdx = body.indexOf("if (result.outcome !== 'restored')");
    const pollIdx = body.indexOf('for (let attempt = 0');
    expect(outcomeCheckIdx).toBeGreaterThan(-1);
    expect(pollIdx).toBeGreaterThan(outcomeCheckIdx);
  });

  it('the confirmation poll is bounded (a fixed max attempt count), and only setTimeout-paced between real refreshEntitlement() calls - never a single timeout used to infer failure', () => {
    expect(source).toMatch(/export const CONFIRMATION_MAX_ATTEMPTS = 5;/);
    expect(source).toMatch(/export const CONFIRMATION_RETRY_DELAY_MS = 4000;/);
    const body = restoreBody();
    expect(body).toMatch(/for \(let attempt = 0; attempt < CONFIRMATION_MAX_ATTEMPTS; attempt \+= 1\) \{/);
    expect(body).toMatch(/await new Promise\(\(resolve\) => setTimeout\(resolve, CONFIRMATION_RETRY_DELAY_MS\)\);/);
    expect(body).toMatch(/const refreshed = await refreshEntitlement\(\);/);
  });

  it('only a real refreshed.isEntitled flag (from the unified entitlement read) can set "restored" - never the native call\'s own outcome string', () => {
    const body = restoreBody();
    expect(body).toMatch(/if \(refreshed\?\.isEntitled\) \{\s*\n\s*setState\('restored'\);/);
  });

  it('exhausting the bound without confirmation sets the honest neutral "completed" state, never a false "restored" or a false failure', () => {
    const body = restoreBody();
    expect(body).toMatch(/setState\(\(current\) => \(current === 'restored' \? current : 'completed'\)\);/);
  });
});

describe('useNativeRestore — a late callback can never update a different signed-in account (readiness-gap item 5)', () => {
  it('captures the user id the attempt started for in a ref BEFORE the native call, and rechecks it after the native call before applying any result', () => {
    const body = restoreBody();
    const captureIdx = body.indexOf('startedForUserIdRef.current = forUserId;');
    const nativeCallIdx = body.indexOf('await restoreRevenueCatPurchases()');
    const recheckIdx = body.indexOf('if (startedForUserIdRef.current !== forUserId) return;', nativeCallIdx);
    expect(captureIdx).toBeGreaterThan(-1);
    expect(captureIdx).toBeLessThan(nativeCallIdx);
    expect(recheckIdx).toBeGreaterThan(nativeCallIdx);
  });

  it('rechecks the started-for user id on every single confirmation poll iteration, both before and after the real refresh call', () => {
    const body = restoreBody();
    const loopStart = body.indexOf('for (let attempt = 0');
    const loopBody = body.slice(loopStart);
    const recheckCount = (loopBody.match(/if \(startedForUserIdRef\.current !== forUserId\) return;/g) ?? []).length;
    expect(recheckCount).toBeGreaterThanOrEqual(2); // once after the delay, once after refreshEntitlement()
  });

  it('the CustomerInfo listener only reacts when it is for the account this hook\'s own in-flight restore was started for - never an unrelated/unstarted account', () => {
    const listenerBody = source.match(/addRevenueCatCustomerInfoListener\(\(\) => \{[\s\S]*?\n\s{4}\}\);/)?.[0] ?? '';
    expect(listenerBody).not.toBe('');
    expect(listenerBody).toMatch(/if \(startedForUserIdRef\.current && startedForUserIdRef\.current === user\?\.id\) \{/);
    expect(listenerBody).toMatch(/refreshEntitlement\(\);/);
  });

  it('an account switch (signed-in user id changes while a previous restore is still tracked) forgets it entirely - resets to idle, never lets its poll/listener touch the new user', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(startedForUserIdRef\.current[\s\S]*?\n {2}\}, \[user\?\.id\]\);/)?.[0] ?? '';
    expect(effectBody).not.toBe('');
    expect(effectBody).toMatch(/startedForUserIdRef\.current !== \(user\?\.id \?\? null\)/);
    expect(effectBody).toMatch(/startedForUserIdRef\.current = null;/);
    expect(effectBody).toMatch(/setState\('idle'\);/);
  });

  it('the listener subscription itself is cleaned up (removeListener returned from the effect), not left dangling across unmounts/platform changes', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!supported\) return undefined;[\s\S]*?\n {2}\}, \[supported\]\);/)?.[0] ?? '';
    expect(effectBody).not.toBe('');
    expect(effectBody).toMatch(/const removeListener = addRevenueCatCustomerInfoListener/);
    expect(effectBody).toMatch(/return removeListener;/);
  });
});

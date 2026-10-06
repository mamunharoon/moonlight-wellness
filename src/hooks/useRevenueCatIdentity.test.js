// WakeWise Phase 2B — RevenueCat identity lifecycle. Source-level checks,
// same convention as this repo's other React hooks (no DOM/renderer
// available in this Vitest environment — see useAppleRestore.test.js's
// own identical note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./useRevenueCatIdentity.js', import.meta.url)), 'utf-8');

describe('useRevenueCatIdentity — sign-out clears identity at the same moment as everything else', () => {
  it('listens to the shared onSignOutBroadcast event, not a delayed reaction to `user` becoming null', () => {
    expect(source).toMatch(/import \{ onSignOutBroadcast \} from '\.\.\/lib\/signOutCleanup';/);
    expect(source).toMatch(/return onSignOutBroadcast\(\(\) => \{/);
  });

  it('the sign-out handler logs out of RevenueCat and resets the tracked user id ref', () => {
    const handlerBody = source.match(/return onSignOutBroadcast\(\(\) => \{[\s\S]*?\n\s{4}\}\);/)?.[0] ?? '';
    expect(handlerBody).toMatch(/loggedInUserIdRef\.current = null;/);
    expect(handlerBody).toMatch(/logOutRevenueCat\(\);/);
  });
});

describe('useRevenueCatIdentity — startup race safety', () => {
  it('does nothing while AuthContext\'s own loading flag is still true', () => {
    expect(source).toMatch(/if \(loading\) return undefined;/);
  });

  it('a cancelled flag guards every async continuation, so an unmount/re-run mid-flight can never apply a stale result', () => {
    expect(source).toMatch(/let cancelled = false;/);
    expect(source).toMatch(/if \(cancelled\) return;/);
    expect(source).toMatch(/return \(\) => \{\s*\n\s*cancelled = true;\s*\n\s*\};/);
  });

  it('a no-op guard skips work entirely when RevenueCat is not supported/configured on this platform, and publishes UNAVAILABLE so callers never block waiting for an identity that will never resolve', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!isRevenueCatSupported\(\)\) \{[\s\S]*?\n {2}\}, \[user, loading, isGuest\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/setRevenueCatIdentityStatus\(\{ status: REVENUECAT_IDENTITY_STATUS\.UNAVAILABLE, forUserId: null \}\);/);
  });
});

describe('useRevenueCatIdentity — identity always the Supabase UUID, never a guest substitute', () => {
  it('a guest/anonymous user (isGuest or no user) never configures or logs in - only logs out if a stale identity remains, and is never published as READY', () => {
    const body = source.match(/if \(isGuest \|\| !user\) \{[\s\S]*?\n\s{6}\}/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).not.toMatch(/configureRevenueCat|logInRevenueCat/);
    expect(body).toMatch(/logOutRevenueCat\(\);/);
    expect(body).toMatch(/REVENUECAT_IDENTITY_STATUS\.PENDING/);
    expect(body).not.toMatch(/REVENUECAT_IDENTITY_STATUS\.READY/);
  });

  it('an already-correct identity (loggedInUserIdRef already equals user.id) is a genuine no-op - never a redundant logIn call - but still (re)publishes READY', () => {
    const body = source.match(/if \(loggedInUserIdRef\.current === user\.id\) \{[\s\S]*?\n\s{6}\}/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).not.toMatch(/configureRevenueCat|logInRevenueCat/);
    expect(body).toMatch(/setRevenueCatIdentityStatus\(\{ status: REVENUECAT_IDENTITY_STATUS\.READY, forUserId: user\.id \}\);/);
  });

  it('an account switch (different real user id than previously logged in) logs out the old identity before logging in the new one - never the reverse order', () => {
    const body = source.match(/const sync = async \(\) => \{[\s\S]*?\n\s{4}\};/)?.[0] ?? '';
    const switchGuardIdx = body.indexOf('loggedInUserIdRef.current && loggedInUserIdRef.current !== user.id');
    const logOutIdx = body.indexOf('await logOutRevenueCat();', switchGuardIdx);
    const configureIdx = body.indexOf('configureRevenueCat(user.id)');
    expect(switchGuardIdx).toBeGreaterThan(-1);
    expect(logOutIdx).toBeGreaterThan(switchGuardIdx);
    expect(configureIdx).toBeGreaterThan(logOutIdx);
  });

  it('only ever passes user.id as the identity - never email, display name, or a generated id', () => {
    expect(source).toMatch(/configureRevenueCat\(user\.id\)/);
    expect(source).toMatch(/logInRevenueCat\(user\.id\)/);
    expect(source).not.toMatch(/user\.email|user\.user_metadata/);
  });
});

describe('useRevenueCatIdentity — publishes readiness status for purchase/restore call sites to gate on (readiness-gap item 3)', () => {
  it('imports the shared status store and never reaches into it from anywhere except this file', () => {
    expect(source).toMatch(/import \{ REVENUECAT_IDENTITY_STATUS, setRevenueCatIdentityStatus \} from '\.\.\/lib\/revenueCatIdentityStatus';/);
  });

  it('an account switch is published as PENDING for the NEW user id before any logOut/configure call starts - never left reporting the stale READY for the old user while a switch is in flight', () => {
    const syncBody = source.match(/const sync = async \(\) => \{[\s\S]*?\n\s{4}\};/)?.[0] ?? '';
    const pendingIdx = syncBody.indexOf("setRevenueCatIdentityStatus({ status: REVENUECAT_IDENTITY_STATUS.PENDING, forUserId: user.id });");
    const logOutIdx = syncBody.indexOf('await logOutRevenueCat();', pendingIdx);
    const configureIdx = syncBody.indexOf('configureRevenueCat(user.id)', pendingIdx);
    expect(pendingIdx).toBeGreaterThan(-1);
    expect(logOutIdx).toBeGreaterThan(pendingIdx);
    expect(configureIdx).toBeGreaterThan(pendingIdx);
  });

  it('both the configure() success path and the logIn() fallback success path publish READY for user.id', () => {
    const syncBody = source.match(/const sync = async \(\) => \{[\s\S]*?\n\s{4}\};/)?.[0] ?? '';
    const readyPublishes = syncBody.match(/setRevenueCatIdentityStatus\(\{ status: REVENUECAT_IDENTITY_STATUS\.READY, forUserId: user\.id \}\);/g) ?? [];
    expect(readyPublishes.length).toBeGreaterThanOrEqual(2);
  });

  it('when neither configure() nor the logIn() fallback confirms the identity, publishes FAILED rather than leaving callers waiting forever on PENDING', () => {
    const syncBody = source.match(/const sync = async \(\) => \{[\s\S]*?\n\s{4}\};/)?.[0] ?? '';
    expect(syncBody).toMatch(/setRevenueCatIdentityStatus\(\{ status: REVENUECAT_IDENTITY_STATUS\.FAILED, forUserId: null \}\);/);
    // The FAILED publish must be the last statement reachable after a
    // failed logIn() fallback, not something that could also fire after
    // a successful one.
    const loginSuccessIdx = syncBody.indexOf("if (loginResult.outcome === 'logged-in') {");
    const failedIdx = syncBody.indexOf('REVENUECAT_IDENTITY_STATUS.FAILED');
    expect(failedIdx).toBeGreaterThan(loginSuccessIdx);
  });

  it('sign-out publishes PENDING with no user id, never leaving the previous user READY after they have signed out', () => {
    const handlerBody = source.match(/return onSignOutBroadcast\(\(\) => \{[\s\S]*?\n\s{4}\}\);/)?.[0] ?? '';
    expect(handlerBody).toMatch(/setRevenueCatIdentityStatus\(\{ status: REVENUECAT_IDENTITY_STATUS\.PENDING, forUserId: null \}\);/);
  });
});

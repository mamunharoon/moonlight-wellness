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
    expect(source).toMatch(/if \(loading\) return;/);
  });

  it('a cancelled flag guards every async continuation, so an unmount/re-run mid-flight can never apply a stale result', () => {
    expect(source).toMatch(/let cancelled = false;/);
    expect(source).toMatch(/if \(cancelled\) return;/);
    expect(source).toMatch(/return \(\) => \{\s*\n\s*cancelled = true;\s*\n\s*\};/);
  });

  it('a no-op guard skips work entirely when RevenueCat is not supported/configured on this platform', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!isRevenueCatSupported\(\)\) return;[\s\S]*?\n {2}\}, \[user, loading, isGuest\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
  });
});

describe('useRevenueCatIdentity — identity always the Supabase UUID, never a guest substitute', () => {
  it('a guest/anonymous user (isGuest or no user) never configures or logs in - only logs out if a stale identity remains', () => {
    const body = source.match(/if \(isGuest \|\| !user\) \{[\s\S]*?\n\s{6}\}/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).not.toMatch(/configureRevenueCat|logInRevenueCat/);
    expect(body).toMatch(/logOutRevenueCat\(\);/);
  });

  it('an already-correct identity (loggedInUserIdRef already equals user.id) is a genuine no-op - never a redundant logIn call', () => {
    expect(source).toMatch(/if \(loggedInUserIdRef\.current === user\.id\) return; \/\/ already correct — no-op/);
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

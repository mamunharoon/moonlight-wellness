// Immediate Account Deletion — review finding, symmetric to
// AuthContext.stuckDeletionGuard.test.js: redirectAfterAuth makes its
// OWN independent profiles query (deliberately not AuthContext's own
// separately-timed `profile` state — see this function's own header),
// so it needs the identical "don't treat a stuck, incomplete deletion
// as a brand-new signup" guard, checked independently rather than
// relying on AuthContext's guard alone (a race between the two on a
// fresh sign-in would otherwise leave this exact path unguarded).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Auth.jsx', import.meta.url)), 'utf-8');

const redirectAfterAuthBody = () => source.match(/const redirectAfterAuth = async \(authUser, \{ isSignIn = false \} = \{\}\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

describe('Auth.jsx — redirectAfterAuth checks for a stuck deletion before ever treating a missing profile as "brand new"', () => {
  it('imports getMyDeletionRequest from the real, shared deletion API module', () => {
    expect(source).toMatch(/import \{ getMyDeletionRequest \} from '\.\.\/lib\/accountDeletionApi';/);
  });

  it('only checks when the profile read itself succeeded AND genuinely found no row - never on a real read error, never when a row exists', () => {
    const body = redirectAfterAuthBody();
    expect(body).not.toBe('');
    expect(body).toMatch(/if \(!profileError && !profileRow\) \{/);
  });

  it('a stuck "processing" request routes straight to the resume screen, replacing history, and returns before Introduction/Home can ever be reached', () => {
    const body = redirectAfterAuthBody();
    const guardBlock = body.match(/if \(hasStuckDeletion\) \{[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(guardBlock).not.toBe('');
    expect(guardBlock).toMatch(/navigate\('\/profile\/delete-account', \{ replace: true \}\);/);
    expect(guardBlock).toMatch(/return;/);
  });

  it('this check runs BEFORE the existing shouldShowIntroduction branch, so a stuck account can never be routed to Introduction as if newly signed up', () => {
    const body = redirectAfterAuthBody();
    const stuckCheckIndex = body.indexOf('if (hasStuckDeletion)');
    const introCheckIndex = body.indexOf('shouldShowIntroduction(profileRow?.introduction_completed_version)');
    expect(stuckCheckIndex).toBeGreaterThan(-1);
    expect(introCheckIndex).toBeGreaterThan(stuckCheckIndex);
  });

  it('a real profile-read error never triggers the deletion-request lookup - fails toward the existing "default to Home" behaviour instead, per this function\'s own established policy', () => {
    const body = redirectAfterAuthBody();
    const lookupBody = body.match(/if \(!profileError && !profileRow\) \{[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(lookupBody).toMatch(/getMyDeletionRequest\(authUser\.id\)/);
    // The condition itself already requires !profileError - a genuine
    // read failure short-circuits this whole block via && before ever
    // reaching getMyDeletionRequest.
  });
});

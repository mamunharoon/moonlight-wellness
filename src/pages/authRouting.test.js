// Regression guard for the sign-in/sign-out routing policy fix. No DOM/
// component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks, plus
// direct unit tests of the pure pendingContent helpers (see
// pendingContent.test.js for the full round-trip/security suite this
// complements).
//
// Bug fix, found live: an ordinary sign-in (sign out, sign back in with
// nothing pending) landed on /profile instead of Home - redirectAfterAuth
// unconditionally fell back to navigate('/profile') whenever
// consumePendingContent() returned null, which is exactly what happens
// for a plain Welcome/Auth sign-in.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const authSource = read('./Auth.jsx');
const authContextSource = read('../context/AuthContext.jsx');
const signInPromptDialogSource = read('../components/SignInPromptDialog.jsx');
const useProtectedVideoSource = read('../hooks/useProtectedVideo.js');
const routineDetailSource = read('./RoutineDetail.jsx');

describe('Auth.jsx redirectAfterAuth — ordinary sign-in goes Home, never Profile', () => {
  it('falls back to navigate(\'/\') when nothing is pending - the exact fixed line', () => {
    const body = authSource.match(/const redirectAfterAuth = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/navigate\('\/'\);\s*\n {2}\};$/);
    expect(body).not.toMatch(/navigate\('\/profile'\)/);
  });

  it('an explicit pending destination with no id navigates straight to its returnPath (protected-routine flow)', () => {
    const body = authSource.match(/const redirectAfterAuth = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!pending\.id\) \{\s*\n\s*navigate\(pending\.returnPath\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('an explicit pending destination WITH an id (protected-media flow) navigates to returnPath with ?openId= attached', () => {
    const body = authSource.match(/const redirectAfterAuth = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/navigate\(`\$\{pending\.returnPath\}\$\{separator\}openId=\$\{encodeURIComponent\(pending\.id\)\}`\);/);
  });

  it('reads the pending destination via consumePendingContent - which itself both validates safety and clears on read, so an external/invalid/already-used destination can never be replayed and always falls through to the Home fallback', () => {
    expect(authSource).toMatch(/import \{ consumePendingContent \} from '\.\.\/lib\/pendingContent';/);
    expect(authSource).toMatch(/const pending = consumePendingContent\(\);/);
  });

  it('both handleSignIn and handleSignUp call redirectAfterAuth on success - one routing decision, not two', () => {
    const occurrences = authSource.match(/redirectAfterAuth\(\);/g) ?? [];
    expect(occurrences.length).toBe(2);
  });

  it('"Continue as guest" never sets a pending destination - only marks guest entry chosen and navigates directly', () => {
    expect(authSource).toMatch(/<Link to="\/profile" onClick=\{markGuestEntryChosen\} className="block text-center text-xs text-on-surface-variant">/);
    expect(authSource).not.toMatch(/setPendingContent/);
  });
});

describe('AuthContext.jsx signOut — clears pending return destinations and protected-action state', () => {
  it('imports and calls clearPendingContent alongside the existing routine-progress/guest-entry cleanup', () => {
    expect(authContextSource).toMatch(/import \{ clearPendingContent \} from '\.\.\/lib\/pendingContent';/);
    const body = authContextSource.match(/const signOut = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/clearAllRoutineProgress\(\);\s*\n\s*clearGuestEntryChoice\(\);\s*\n\s*clearPendingContent\(\);/);
  });
});

describe('SignInPromptDialog.jsx — "Continue Browsing" never creates a future return destination', () => {
  it('the dismiss action is a plain callback prop, not wired to any pendingContent/navigation call inside this component', () => {
    expect(signInPromptDialogSource).not.toMatch(/setPendingContent|navigate\(/);
    expect(signInPromptDialogSource).toMatch(/onClick=\{onDismiss\}[\s\S]{0,300}Continue Browsing/);
  });
});

describe('useProtectedVideo.js — dismissPrompt (Continue Browsing) never sets a pending destination', () => {
  it('dismissPrompt only clears local promptId state', () => {
    expect(useProtectedVideoSource).toMatch(/const dismissPrompt = \(\) => setPromptId\(null\);/);
  });

  it('confirmSignIn/confirmCreateAccount are the only calls that set a pending destination, and always include the tapped id', () => {
    const setCalls = useProtectedVideoSource.match(/setPendingContent\(\{ id: promptId, returnPath \}\);/g) ?? [];
    expect(setCalls.length).toBe(2);
  });
});

describe('RoutineDetail.jsx — protected-routine sign-in sets an id-less pending destination back to the routine', () => {
  it('handleSignIn/handleCreateAccount both point returnPath at this exact routine, with no id (nothing to reopen, just resume the gate)', () => {
    const setCalls = routineDetailSource.match(/setPendingContent\(\{ returnPath: `\/routines\/\$\{routineId\}` \}\);/g) ?? [];
    expect(setCalls.length).toBe(2);
  });
});

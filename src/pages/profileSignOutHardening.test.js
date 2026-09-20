// Sign-out failure semantics — Profile.jsx's own retry/re-entrancy guard.
// Source-level checks, matching this codebase's established pattern (see
// Home.routineState.test.js's own note); performSupabaseSignOut's own
// success/failure decision logic is unit-tested directly (real behaviour)
// in signOutFlow.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const profileSource = read('./Profile.jsx');
const confirmDialogSource = read('../components/ConfirmDialog.jsx');

describe('Profile.jsx — avoids double-click/re-entrant logout', () => {
  it('handleSignOut bails out immediately if a sign-out is already in flight', () => {
    const body = profileSource.match(/const handleSignOut = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(signingOut\) return;/);
  });

  it('the confirm dialog itself is passed confirmPending, disabling both its buttons while a request is in flight', () => {
    expect(profileSource).toMatch(/confirmPending=\{signingOut\}/);
    // ConfirmDialog genuinely disables both buttons on confirmPending, not
    // just the caller's own intent - this is what makes re-entrancy
    // impossible at the DOM level, not merely logically.
    expect(confirmDialogSource).toMatch(/disabled=\{confirmPending\}[\s\S]*?\{cancelLabel\}/);
    expect(confirmDialogSource).toMatch(/disabled=\{confirmPending\}[\s\S]*?\{confirmLabel\}/);
  });

  it('dismissing (Cancel/Escape/backdrop) is also blocked while a request is in flight', () => {
    const body = profileSource.match(/const dismissSignOut = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(signingOut\) return;/);
  });
});

describe('Profile.jsx — sign-out success behaviour', () => {
  it('on success, navigates with replace so browser Back can never return to authenticated Profile content', () => {
    const body = profileSource.match(/const handleSignOut = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/await signOut\(\);/);
    expect(body).toMatch(/navigate\('\/', \{ replace: true \}\);/);
  });
});

describe('Profile.jsx — sign-out failure behaviour', () => {
  it('a thrown error (performSupabaseSignOut only throws when a real session still exists) surfaces a clear, non-technical retry message and stays on Profile', () => {
    const body = profileSource.match(/const handleSignOut = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/\} catch \{\s*\n\s*setSigningOut\(false\);\s*\n\s*setSignOutError\("We couldn't sign you out\. Please try again\."\);\s*\n\s*\}/);
    // No navigate() call anywhere in the catch branch - a failure must
    // never also silently redirect as if it had succeeded.
    const catchBlock = body.match(/\} catch \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(catchBlock).not.toMatch(/navigate\(/);
  });

  it('the failure message names no technical detail (no "Supabase", "network", "500", stack, or raw error object)', () => {
    const userFacingMessage = profileSource.match(/"We couldn't sign you out\. Please try again\."/)?.[0] ?? '';
    expect(userFacingMessage.length).toBeGreaterThan(0);
    expect(userFacingMessage).not.toMatch(/Supabase|network|500|stack|error\.message/i);
  });
});

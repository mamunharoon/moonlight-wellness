// WakeWise Phase 2A — in-app Change Password. Source-level checks, same
// convention as ResetPassword.passwordPolicy.test.js (no DOM rendering
// available in this repo's Vitest — see that file's own note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./ChangePassword.jsx');

const handleSubmitBody = () => source.match(/const handleSubmit = async \(e\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

describe('ChangePassword — guest and provider guards', () => {
  it('a guest is redirected to /profile, never shown the form', () => {
    expect(source).toMatch(/if \(isGuest\) \{\s*\n\s*return <Navigate to="\/profile" replace \/>;\s*\n\s*\}/);
  });

  it('a non-email-provider account sees an honest message instead of the form', () => {
    expect(source).toMatch(/const provider = user\?\.app_metadata\?\.provider \?\? 'email';/);
    expect(source).toMatch(/const supportsPasswordChange = provider === 'email';/);
    expect(source).toMatch(/\{!supportsPasswordChange && \(/);
    expect(source).toMatch(/there's no WakeWise password to change here/);
  });

  it('the real form only ever renders when supportsPasswordChange is true', () => {
    expect(source).toMatch(/\{supportsPasswordChange && !success && \(/);
  });
});

describe('ChangePassword — same approved password rule as Sign Up/Reset (no current-password field)', () => {
  it('imports the shared policy instead of a local constant', () => {
    expect(source).toMatch(
      /import \{ NEW_PASSWORD_HINT, getPasswordTooShortMessage, isPasswordTooShort, PASSWORD_MISMATCH_MESSAGE \} from '\.\.\/lib\/passwordPolicy';/
    );
  });

  it('never asks for the current password - the existing authenticated session is the identity proof', () => {
    expect(source).not.toMatch(/currentPassword/i);
    expect(source).not.toMatch(/id="password"[^>]*autoComplete="current-password"/);
  });

  it('rejects a too-short new password before calling supabase.auth.updateUser', () => {
    const body = handleSubmitBody();
    const tooShortIndex = body.indexOf('isPasswordTooShort(password)');
    const updateCallIndex = body.indexOf('supabase.auth.updateUser(');
    expect(tooShortIndex).toBeGreaterThan(-1);
    expect(updateCallIndex).toBeGreaterThan(tooShortIndex);
  });

  it('mismatch uses the shared PASSWORD_MISMATCH_MESSAGE constant and focuses confirmPassword', () => {
    const body = handleSubmitBody();
    const mismatchBlock = body.match(/if \(password !== confirmPassword\) \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(mismatchBlock).toMatch(/setConfirmPasswordError\(PASSWORD_MISMATCH_MESSAGE\);/);
    expect(mismatchBlock).toMatch(/confirmPasswordInputRef\.current\?\.focus\(\);/);
  });

  it('a weak_password rejection uses the shared message and focuses password', () => {
    const body = handleSubmitBody();
    const weakBlock = body.match(/if \(isWeakPasswordError\(updateError\)\) \{[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(weakBlock).toMatch(/setPasswordError\(WEAK_PASSWORD_MESSAGE\);/);
    expect(weakBlock).not.toBe('');
  });

  it('re-entrancy guard: a second submit while isSubmitting is true never reaches supabase.auth.updateUser', () => {
    const body = handleSubmitBody();
    const guardIndex = body.indexOf('if (isSubmitting || !supabase) return;');
    const updateCallIndex = body.indexOf('supabase.auth.updateUser(');
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(updateCallIndex).toBeGreaterThan(guardIndex);
  });
});

describe('ChangePassword — never logs or persists the password', () => {
  it('both fields are cleared immediately after the update call resolves, success or failure', () => {
    const body = handleSubmitBody();
    const afterCallIdx = body.indexOf('setIsSubmitting(false);');
    const clearPasswordIdx = body.indexOf("setPassword('');", afterCallIdx);
    const clearConfirmIdx = body.indexOf("setConfirmPassword('');", afterCallIdx);
    expect(clearPasswordIdx).toBeGreaterThan(afterCallIdx);
    expect(clearConfirmIdx).toBeGreaterThan(afterCallIdx);
  });

  it('never calls console.log/warn/error with the password value, and never writes it to storage', () => {
    expect(source).not.toMatch(/console\.(log|warn|error)\([^)]*password[^)]*\)/i);
    expect(source).not.toMatch(/localStorage|sessionStorage/);
  });

  it('logAuthDiagnostic only ever receives the resolved/structured error, never the raw password or error object', () => {
    expect(source).toMatch(/logAuthDiagnostic\('changePassword', resolved\);/);
  });
});

describe('ChangePassword — success state', () => {
  it('shows a clear confirmation and a way back to Profile, not an automatic redirect', () => {
    expect(source).toMatch(/Your password has been updated successfully\./);
    expect(source).toMatch(/onClick=\{\(\) => navigate\('\/profile'\)\}/);
  });
});

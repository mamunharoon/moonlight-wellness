// Password-creation consistency audit (final consolidated spec, section 7):
// the reset/new-password flow gets the same approved 8-character rule and
// weak_password handling as Sign Up, applied the same source-level way as
// Auth.signupUx.test.js (no DOM rendering available in this repo's Vitest
// - see that file's own note). Does not touch the confirmation-link
// architecture itself (useEffect/onAuthStateChange block above) - only the
// password-entry form below it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./ResetPassword.jsx');

const handleSubmitBody = () => source.match(/const handleSubmit = async \(e\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

describe('ResetPassword — same approved 8-character new-password rule as Sign Up (12 never reintroduced)', () => {
  it('no "12 characters" text or symbol survives anywhere in ResetPassword.jsx', () => {
    expect(source).not.toMatch(/12[\s-]*characters?/i);
  });

  it('imports the shared policy instead of a local constant', () => {
    expect(source).toMatch(
      /import \{ NEW_PASSWORD_HINT, getPasswordTooShortMessage, isPasswordTooShort, PASSWORD_MISMATCH_MESSAGE \} from '\.\.\/lib\/passwordPolicy';/
    );
    expect(source).not.toMatch(/const MIN_PASSWORD_LENGTH/);
  });

  it('rejects a too-short new password before calling supabase.auth.updateUser', () => {
    const body = handleSubmitBody();
    const tooShortIndex = body.indexOf('isPasswordTooShort(password)');
    const updateCallIndex = body.indexOf('supabase.auth.updateUser(');
    expect(tooShortIndex).toBeGreaterThan(-1);
    expect(updateCallIndex).toBeGreaterThan(tooShortIndex);
    expect(body).toMatch(/setPasswordError\(getPasswordTooShortMessage\(\)\);/);
    expect(body).toMatch(/passwordInputRef\.current\?\.focus\(\);/);
  });

  it('mismatch uses the shared PASSWORD_MISMATCH_MESSAGE constant, focuses confirmPassword, without clearing values', () => {
    const body = handleSubmitBody();
    const mismatchBlock = body.match(/if \(password !== confirmPassword\) \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(mismatchBlock).toMatch(/setConfirmPasswordError\(PASSWORD_MISMATCH_MESSAGE\);/);
    expect(mismatchBlock).toMatch(/confirmPasswordInputRef\.current\?\.focus\(\);/);
    expect(mismatchBlock).not.toMatch(/setPassword\(/);
    expect(source).not.toMatch(/'Passwords do not match\.'/);
  });

  it('a weak_password rejection from updateUser clears both password fields, uses the shared message, and focuses password', () => {
    const body = handleSubmitBody();
    const weakBlock = body.match(/if \(isWeakPasswordError\(updateError\)\) \{[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(weakBlock).toMatch(/setPassword\(''\);/);
    expect(weakBlock).toMatch(/setConfirmPassword\(''\);/);
    expect(weakBlock).toMatch(/setPasswordError\(WEAK_PASSWORD_MESSAGE\);/);
    expect(weakBlock).toMatch(/passwordInputRef\.current\?\.focus\(\);/);
    expect(weakBlock).not.toBe('');
  });

  it('weak_password is checked via the structured helper BEFORE the generic resolveAuthError fallback', () => {
    const body = handleSubmitBody();
    const weakIndex = body.indexOf('isWeakPasswordError(updateError)');
    const resolveIndex = body.indexOf('resolveAuthError(updateError');
    expect(weakIndex).toBeGreaterThan(-1);
    expect(resolveIndex).toBeGreaterThan(weakIndex);
  });

  it('a non-weak_password update failure still falls back to the original recovery-link guidance, via resolveAuthError\'s fallbackMessage override (not a raw "||" on possibly-empty text)', () => {
    const body = handleSubmitBody();
    expect(body).toMatch(
      /resolveAuthError\(updateError, \{\s*\n\s*fallbackMessage: 'Something went wrong updating your password\. Please request a new reset link\.',\s*\n\s*\}\);/
    );
    expect(body).toMatch(/logAuthDiagnostic\('updateUser', resolved\);/);
    expect(body).toMatch(/setError\(resolved\.message\);/);
  });

  it('shows the new approved 8-character hint, not a hardcoded copy', () => {
    expect(source).toMatch(/\{NEW_PASSWORD_HINT\}/);
  });

  it('accessible wiring: aria-invalid/aria-describedby on both password fields, role="alert" on both error paragraphs, no duplicate alert nodes', () => {
    const passwordBlock = source.match(/id="newPassword"[\s\S]*?\/>/)?.[0] ?? '';
    expect(passwordBlock).toMatch(/aria-invalid=\{Boolean\(passwordError\)\}/);
    expect(passwordBlock).toMatch(/aria-describedby=\{passwordError \? 'newPasswordHint newPasswordError' : 'newPasswordHint'\}/);
    expect(source.match(/id="newPasswordError" role="alert"/g) ?? []).toHaveLength(1);

    const confirmBlock = source.match(/id="confirmNewPassword"[\s\S]*?\/>/)?.[0] ?? '';
    expect(confirmBlock).toMatch(/aria-invalid=\{Boolean\(confirmPasswordError\)\}/);
    expect(confirmBlock).toMatch(/aria-describedby=\{confirmPasswordError \? 'confirmNewPasswordError' : undefined\}/);
    expect(source.match(/id="confirmNewPasswordError" role="alert"/g) ?? []).toHaveLength(1);
  });

  it('field errors clear as the user retypes', () => {
    const onChangeBlock = source.match(/id="newPassword"[\s\S]*?onChange=\{\(e\) => \{[\s\S]*?\}\}/)?.[0] ?? '';
    expect(onChangeBlock).toMatch(/if \(passwordError\) setPasswordError\(''\);/);
  });

  it('re-entrancy guard: a second submit while isSubmitting is true never reaches supabase.auth.updateUser', () => {
    const body = handleSubmitBody();
    const guardIndex = body.indexOf('if (isSubmitting || !supabase) return;');
    const updateCallIndex = body.indexOf('supabase.auth.updateUser(');
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(updateCallIndex).toBeGreaterThan(guardIndex);
  });

  it('the Update Password button is disabled while pending', () => {
    expect(source).toMatch(/disabled=\{isSubmitting\}/);
    expect(source).toMatch(/\{isSubmitting \? 'Updating\.\.\.' : 'Update Password'\}/);
  });

  it('does not introduce a new confirmation mechanism or automatic sign-in - the existing recovery-session/onAuthStateChange architecture and the plain "success -> Continue button" path are unchanged', () => {
    expect(source).toMatch(/onAuthStateChange\(\(event\) => \{/);
    expect(source).toMatch(/if \(event === 'PASSWORD_RECOVERY'\) \{/);
    expect(source).not.toMatch(/signInWithPassword|signInWithOtp|signInWithOAuth/);
    const successBlock = source.match(/\{status === 'success' && \([\s\S]*?\)\}/)?.[0] ?? '';
    expect(successBlock).toMatch(/Your password has been updated successfully\./);
    expect(successBlock).not.toMatch(/navigate\('\/'\)|redirectAfterAuth/);
  });
});

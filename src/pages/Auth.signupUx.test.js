// Signup UX Remediation (final consolidated spec) — regression guard.
// Source-level checks, matching this codebase's established pattern for
// Auth.jsx (see authRouting.test.js and authIntroductionGate.test.js's own
// notes: no DOM/component rendering is available in this repo's Vitest -
// vite.config.js's `test.environment` is 'node', not 'jsdom'). Pure-logic
// pieces (error-code mapping, password length rule) are unit-tested
// directly in authErrorMessages.test.js and passwordPolicy.test.js; this
// file verifies Auth.jsx actually wires them up the way the final spec
// requires. Real rendered behavior (focus, aria attributes, the outcome
// panel, the rate-limit friendly message) was additionally verified live
// against the local dev server connected to the real DEV Supabase project
// - see the session's verification evidence.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const authSource = read('./Auth.jsx');

const fnBody = (name) => authSource.match(new RegExp(`const ${name} = async \\(e\\) => \\{[\\s\\S]*?\\n {2}\\};`))?.[0] ?? '';

// Non-greedy `[\s\S]*?\)\}` regexes are unsafe for the outcome panel: it
// contains its own earlier `)}` sequences (e.g. `switchMode('signIn')}`),
// so slicing between two known source markers is used instead of a regex
// end-anchor that could stop too early.
const sliceBetween = (startMarker, endMarker) => {
  const startIdx = authSource.indexOf(startMarker);
  const endIdx = authSource.indexOf(endMarker);
  expect(startIdx, `start marker not found: ${startMarker}`).toBeGreaterThan(-1);
  expect(endIdx, `end marker not found: ${endMarker}`).toBeGreaterThan(startIdx);
  return authSource.slice(startIdx, endIdx);
};

const signupOutcomePanelBlock = () =>
  sliceBetween("{mode === 'signUp' && signupOutcome && (", "{mode === 'signUp' && !signupOutcome && (");

describe('Password minimum — approved 8-character decision (12 was superseded, never reintroduced)', () => {
  it('no "12 characters" text or symbol survives anywhere in Auth.jsx', () => {
    expect(authSource).not.toMatch(/12[\s-]*characters?/i);
    expect(authSource).not.toMatch(/NEW_PASSWORD_MIN_LENGTH\s*=\s*12/);
  });

  it('handleSignUp rejects a too-short password via the shared isPasswordTooShort helper before any network call', () => {
    const body = fnBody('handleSignUp');
    expect(body).toMatch(/if \(isPasswordTooShort\(password\)\) \{/);
    expect(body).toMatch(/setPasswordError\(getPasswordTooShortMessage\(\)\);/);
    const tooShortIndex = body.indexOf('isPasswordTooShort(password)');
    const signUpCallIndex = body.indexOf('supabase.auth.signUp(');
    expect(tooShortIndex).toBeGreaterThan(-1);
    expect(signUpCallIndex).toBeGreaterThan(tooShortIndex);
  });

  it('imports the shared policy rather than redefining a local constant', () => {
    expect(authSource).toMatch(
      /import \{ NEW_PASSWORD_HINT, getPasswordTooShortMessage, isPasswordTooShort, PASSWORD_MISMATCH_MESSAGE \} from '\.\.\/lib\/passwordPolicy';/
    );
    expect(authSource).not.toMatch(/const MIN_PASSWORD_LENGTH/);
  });

  it('the Sign In form applies none of the signup/reset password-policy helpers - existing users keep whatever password length they already have', () => {
    const signInBody = fnBody('handleSignIn');
    expect(signInBody).not.toMatch(/isPasswordTooShort|NEW_PASSWORD_MIN_LENGTH|getPasswordTooShortMessage/);
    const signInInputBlock = authSource.match(/id="signInPassword"[\s\S]*?\/>/)?.[0] ?? '';
    expect(signInInputBlock).not.toMatch(/aria-invalid|aria-describedby/);
  });

  it('the Sign Up password field renders the shared hint text, not a hardcoded copy', () => {
    expect(authSource).toMatch(/\{NEW_PASSWORD_HINT\}/);
  });
});

describe('Structured error mapping — signIn/signUp/forgotPassword all use resolveAuthError, never bare substring matching', () => {
  it('no local getFriendlyErrorMessage substring-matcher remains', () => {
    expect(authSource).not.toMatch(/getFriendlyErrorMessage/);
  });

  it('handleSignIn resolves and logs via the shared helpers', () => {
    const body = fnBody('handleSignIn');
    expect(body).toMatch(/const resolved = resolveAuthError\(signInError\);/);
    expect(body).toMatch(/logAuthDiagnostic\('signIn', resolved\);/);
    expect(body).toMatch(/setError\(resolved\.message\);/);
  });

  it('handleForgotPassword resolves and logs via the shared helpers', () => {
    const body = fnBody('handleForgotPassword');
    expect(body).toMatch(/const resolved = resolveAuthError\(resetError\);/);
    expect(body).toMatch(/logAuthDiagnostic\('resetPasswordForEmail', resolved\);/);
  });

  it('handleSignUp checks account-already-exists, weak_password, and the email rate limit BEFORE falling through to the generic resolver, and supplies the signup-specific fallback message', () => {
    const body = fnBody('handleSignUp');
    const alreadyExistsIndex = body.indexOf('isAccountAlreadyExistsError(signUpError)');
    const weakPasswordIndex = body.indexOf('isWeakPasswordError(signUpError)');
    const rateLimitIndex = body.indexOf('isEmailRateLimitError(signUpError)');
    const resolveIndex = body.indexOf('resolveAuthError(signUpError');
    expect(alreadyExistsIndex).toBeGreaterThan(-1);
    expect(weakPasswordIndex).toBeGreaterThan(alreadyExistsIndex);
    expect(rateLimitIndex).toBeGreaterThan(weakPasswordIndex);
    expect(resolveIndex).toBeGreaterThan(rateLimitIndex);
    expect(body).toMatch(/resolveAuthError\(signUpError, \{ fallbackMessage: SIGNUP_FALLBACK_MESSAGE \}\)/);
  });

  it('never falls back to the generic banner for a recognized weak_password error - it returns before reaching resolveAuthError/setError', () => {
    const body = fnBody('handleSignUp');
    const weakBlock = body.match(/if \(isWeakPasswordError\(signUpError\)\) \{[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(weakBlock).toMatch(/return;/);
    expect(weakBlock).not.toMatch(/setError\(/);
  });

  it('password mismatch uses the shared PASSWORD_MISMATCH_MESSAGE constant, not an inline literal', () => {
    const body = fnBody('handleSignUp');
    expect(body).toMatch(/setConfirmPasswordError\(PASSWORD_MISMATCH_MESSAGE\);/);
    expect(body).not.toMatch(/setConfirmPasswordError\('Passwords do not match\.'\)/);
  });
});

describe('weak_password corrective UX — clears password fields, focuses password, accessible error, exact approved copy', () => {
  it('clears both password and confirmPassword, preserves name/email, sets the field error, and focuses the password input', () => {
    const body = fnBody('handleSignUp');
    const weakBlock = body.match(/if \(isWeakPasswordError\(signUpError\)\) \{[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(weakBlock).toMatch(/setPassword\(''\);/);
    expect(weakBlock).toMatch(/setConfirmPassword\(''\);/);
    expect(weakBlock).toMatch(/setPasswordError\(WEAK_PASSWORD_MESSAGE\);/);
    expect(weakBlock).toMatch(/passwordInputRef\.current\?\.focus\(\);/);
    expect(weakBlock).not.toMatch(/setFirstName|setLastName|setEmail\(/);
  });

  it('the generic "Something went wrong" text is never used for this or any other recognized structured error', () => {
    expect(authSource).not.toMatch(/Something went wrong/);
  });

  it('the password input has aria-invalid, aria-describedby referencing the error paragraph, and the error paragraph is role="alert"', () => {
    const passwordInputBlock = authSource.match(/id="signUpPassword"[\s\S]*?\/>/)?.[0] ?? '';
    expect(passwordInputBlock).toMatch(/aria-invalid=\{Boolean\(passwordError\)\}/);
    expect(passwordInputBlock).toMatch(/aria-describedby=\{passwordError \? 'signUpPasswordHint signUpPasswordError' : 'signUpPasswordHint'\}/);
    expect(authSource).toMatch(/<p id="signUpPasswordError" role="alert"/);
  });

  it('exactly one role="alert" paragraph exists for the password field - no duplicate announcement', () => {
    const alertMatches = authSource.match(/id="signUpPasswordError" role="alert"/g) ?? [];
    expect(alertMatches.length).toBe(1);
  });

  it('the password hint stays visible regardless of the error - it is always rendered, unconditionally', () => {
    expect(authSource).toMatch(/<p id="signUpPasswordHint"[^>]*>\{NEW_PASSWORD_HINT\}<\/p>/);
  });

  it('the field error clears itself as soon as the user starts typing a replacement password, independent of the static hint', () => {
    const onChangeBlock = authSource.match(/id="signUpPassword"[\s\S]*?onChange=\{\(e\) => \{[\s\S]*?\}\}/)?.[0] ?? '';
    expect(onChangeBlock).toMatch(/if \(passwordError\) setPasswordError\(''\);/);
  });
});

describe('Mismatch and too-short corrective UX — focus only, values preserved (no clearing)', () => {
  it('password-too-short sets the field error and focuses password, without clearing it', () => {
    const body = fnBody('handleSignUp');
    const tooShortBlock = body.match(/if \(isPasswordTooShort\(password\)\) \{[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(tooShortBlock).toMatch(/passwordInputRef\.current\?\.focus\(\);/);
    expect(tooShortBlock).not.toMatch(/setPassword\(''\)/);
  });

  it('mismatch sets confirmPasswordError and focuses confirmPassword, without clearing either field', () => {
    const body = fnBody('handleSignUp');
    const mismatchBlock = body.match(/if \(password !== confirmPassword\) \{[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(mismatchBlock).toMatch(/setConfirmPasswordError\(PASSWORD_MISMATCH_MESSAGE\);/);
    expect(mismatchBlock).toMatch(/confirmPasswordInputRef\.current\?\.focus\(\);/);
    expect(mismatchBlock).not.toMatch(/setPassword\(|setConfirmPassword\(''\)/);
  });

  it('the confirmPassword input carries the same accessible-error wiring', () => {
    const confirmBlock = authSource.match(/id="confirmPassword"[\s\S]*?\/>/)?.[0] ?? '';
    expect(confirmBlock).toMatch(/aria-invalid=\{Boolean\(confirmPasswordError\)\}/);
    expect(confirmBlock).toMatch(/aria-describedby=\{confirmPasswordError \? 'confirmPasswordError' : undefined\}/);
    expect(authSource).toMatch(/<p id="confirmPasswordError" role="alert"/);
  });
});

describe('Invalid-email corrective UX', () => {
  it('an empty email sets emailError and focuses the email field, without touching password fields', () => {
    const body = fnBody('handleSignUp');
    const emptyEmailBlock = body.match(/if \(!trimmedEmail\) \{[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(emptyEmailBlock).toMatch(/setEmailError\('Please enter your email address\.'\);/);
    expect(emptyEmailBlock).toMatch(/emailInputRef\.current\?\.focus\(\);/);
  });

  it('a server-side email_address_invalid/validation_failed result is routed to the email field, not the generic banner', () => {
    const body = fnBody('handleSignUp');
    expect(body).toMatch(/resolved\.code === 'email_address_invalid' \|\| resolved\.code === 'validation_failed'/);
    const routeBlock = body.match(/if \(resolved\.code === 'email_address_invalid'[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(routeBlock).toMatch(/setEmailError\(resolved\.message\);/);
    expect(routeBlock).toMatch(/emailInputRef\.current\?\.focus\(\);/);
  });

  it('the email input has accessible-error wiring', () => {
    const emailBlock = authSource.match(/id="signUpEmail"[\s\S]*?\/>/)?.[0] ?? '';
    expect(emailBlock).toMatch(/aria-invalid=\{Boolean\(emailError\)\}/);
    expect(emailBlock).toMatch(/aria-describedby=\{emailError \? 'signUpEmailError' : undefined\}/);
    expect(authSource).toMatch(/<p id="signUpEmailError" role="alert"/);
  });
});

describe('Enumeration-safe confirmation outcome — one panel, two signup-error-routed states, identical rendered structure', () => {
  it('a genuine new unconfirmed signup (data.user && !data.session) sets signupOutcome to "neutral" - never claims "Account created"', () => {
    const body = fnBody('handleSignUp');
    const noSessionBlock = body.match(/if \(data\.user && !data\.session\) \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(noSessionBlock).toMatch(/setSignupOutcome\('neutral'\);/);
    // "Account created" may still appear in an explanatory code comment
    // about the old, fixed defect - it must never appear as an actual
    // rendered/set string anywhere.
    expect(authSource).not.toMatch(/setMessage\([^)]*Account created/);
    expect(authSource).not.toMatch(/>\s*Account created/);
  });

  it("Supabase's obfuscated duplicate-signup error (user_already_exists) sets the SAME 'neutral' outcome as the no-session success — not a distinct message", () => {
    const body = fnBody('handleSignUp');
    const alreadyExistsBlock = body.match(/if \(isAccountAlreadyExistsError\(signUpError\)\) \{[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(alreadyExistsBlock).toMatch(/setSignupOutcome\('neutral'\);/);
  });

  it('the real Supabase email-send rate limit sets its own "rateLimited" outcome - a distinct state, but rendered through the identical panel structure', () => {
    const body = fnBody('handleSignUp');
    const rateLimitBlock = body.match(/if \(isEmailRateLimitError\(signUpError\)\) \{[\s\S]*?\n {6}\}/)?.[0] ?? '';
    expect(rateLimitBlock).toMatch(/setSignupOutcome\('rateLimited'\);/);
  });

  it('the neutral outcome never branches its copy on identities, a returned user id, or any other enumerating signal', () => {
    expect(authSource).not.toMatch(/identities\.length|identities\[0\]|data\.user\.id ===|existingAccount|isExistingUser/i);
  });

  it('SIGNUP_OUTCOME_MESSAGES maps both outcome kinds to their exact imported constant - never an inline literal duplicate', () => {
    expect(authSource).toMatch(/const SIGNUP_OUTCOME_MESSAGES = \{\s*\n\s*neutral: NEUTRAL_NO_SESSION_MESSAGE,\s*\n\s*rateLimited: EMAIL_RATE_LIMIT_MESSAGE,\s*\n\s*\};/);
  });

  it('the panel renders {SIGNUP_OUTCOME_MESSAGES[signupOutcome]} - the exact same expression regardless of which outcome is active, so "neutral" and "rateLimited" produce structurally identical markup, differing only in the one text node', () => {
    const panelBlock = signupOutcomePanelBlock();
    const occurrences = panelBlock.match(/\{SIGNUP_OUTCOME_MESSAGES\[signupOutcome\]\}/g) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it('offers exactly the two required actions: Go to Sign In and Forgot Password', () => {
    const panelBlock = signupOutcomePanelBlock();
    expect(panelBlock).toMatch(/Go to Sign In/);
    expect(panelBlock).toMatch(/Forgot Password/);
  });

  it('"Go to Sign In" uses goToSignInAfterSignup (preserves the banner); "Forgot Password" uses switchMode and never auto-sends a reset email', () => {
    const panelBlock = signupOutcomePanelBlock();
    expect(panelBlock).toMatch(/onClick=\{goToSignInAfterSignup\}/);
    expect(panelBlock).toMatch(/onClick=\{\(\) => switchMode\('forgotPassword'\)\}/);
    expect(panelBlock).not.toMatch(/resetPasswordForEmail/);
  });

  it('the outcome panel replaces the form (form only renders when NOT showing an outcome) - form and panel are mutually exclusive, so the same request can never be resubmitted from that state', () => {
    expect(authSource).toMatch(/\{mode === 'signUp' && !signupOutcome && \(\s*\n\s*<form onSubmit=\{handleSignUp\}/);
  });

  it('the outcome panel has no dismiss/close control other than the two explicit actions - it remains until the user acts', () => {
    const panelBlock = signupOutcomePanelBlock();
    const buttonCount = (panelBlock.match(/<button/g) ?? []).length;
    expect(buttonCount).toBe(2);
  });
});

describe('Confirmation banner survives the transition to Sign In (the original setMessage/switchMode race, fixed structurally)', () => {
  it('switchMode clears signupOutcome (ordinary navigation resets it) - the fix is that this state is no longer coupled to the generic `message` slot at all', () => {
    const switchModeBody = authSource.match(/const switchMode = \(nextMode\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(switchModeBody).toMatch(/setSignupOutcome\(null\);/);
  });

  it('goToSignInAfterSignup moves to Sign In WITHOUT clearing signupOutcome - the one deliberate exception, so the banner survives', () => {
    const fnMatch = authSource.match(/const goToSignInAfterSignup = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fnMatch).toMatch(/setMode\('signIn'\);/);
    expect(fnMatch).not.toMatch(/setSignupOutcome/);
  });

  it('the Sign In form renders the persisted banner using the same SIGNUP_OUTCOME_MESSAGES lookup, guarded on mode === \'signIn\' && signupOutcome', () => {
    expect(authSource).toMatch(
      /\{mode === 'signIn' && signupOutcome && \(\s*\n\s*<div role="status"[\s\S]*?\{SIGNUP_OUTCOME_MESSAGES\[signupOutcome\]\}/
    );
  });

  it('handleSignIn clears signupOutcome once the user actually attempts to sign in - the banner does not linger past a real action', () => {
    const body = fnBody('handleSignIn');
    expect(body).toMatch(/setSignupOutcome\(null\);/);
  });

  it('no timers or direct DOM manipulation were introduced to manage this state', () => {
    expect(authSource).not.toMatch(/setTimeout|setInterval|document\.getElementById|\.innerHTML/);
  });

  it('there is exactly one old-style setMessage(\'Account created...\') + switchMode(\'signIn\') pairing left in the file - i.e. none: the original defect\'s call shape is gone', () => {
    expect(authSource).not.toMatch(/setMessage\([^)]*Account created/);
  });
});

describe('Double-submission / email-spam prevention', () => {
  it('handleSignUp guards re-entrancy at the very top - a second call while isSubmitting is true returns immediately, never issuing a second supabase.auth.signUp', () => {
    const body = fnBody('handleSignUp');
    const guardIndex = body.indexOf('if (isSubmitting || !supabase) return;');
    const signUpCallIndex = body.indexOf('supabase.auth.signUp(');
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(signUpCallIndex).toBeGreaterThan(guardIndex);
    // The guard must be the very first statement after e.preventDefault() -
    // nothing (no state read/write) happens before this re-entrancy check.
    // Matched with \s* (not a literal \n) so this survives either LF or
    // CRLF line endings - a Windows `git checkout` materializes committed
    // LF as CRLF locally (core.autocrlf=true), which an exact '\n' string
    // comparison would otherwise fail on despite zero actual content
    // difference in the commit itself.
    const preventDefaultIndex = body.indexOf('e.preventDefault();');
    expect(body.slice(preventDefaultIndex, guardIndex)).toMatch(/^e\.preventDefault\(\);\s*$/);
  });

  it('the Create Account button is disabled while isSubmitting and shows "Creating account..."', () => {
    const formBlock = sliceBetween("{mode === 'signUp' && !signupOutcome && (", '{mode === \'signIn\' && signupOutcome && (');
    expect(formBlock).toMatch(/disabled=\{isSubmitting\}/);
    expect(formBlock).toMatch(/\{isSubmitting \? 'Creating account\.\.\.' : 'Create Account'\}/);
  });

  it('a successful no-session response hides the form entirely (mutually exclusive with the outcome panel - see the enumeration-safety describe block above), so there is no Create Account button left to double-tap', () => {
    expect(authSource).toMatch(/\{mode === 'signUp' && !signupOutcome && \(/);
  });
});

describe('Safe diagnostics wiring', () => {
  it('every resolveAuthError call site in Auth.jsx is paired with logAuthDiagnostic before the message is shown', () => {
    const resolveCalls = [...authSource.matchAll(/const resolved = resolveAuthError\([^;]*\);/g)];
    expect(resolveCalls.length).toBeGreaterThanOrEqual(2); // signIn, signUp (forgotPassword shares the pattern too)
    for (const call of resolveCalls) {
      const after = authSource.slice(call.index, call.index + 200);
      expect(after).toMatch(/logAuthDiagnostic\(/);
    }
  });

  it('no signup/reset handler ever logs an email, password, or raw error object directly - console.warn only ever appears via logAuthDiagnostic or the pre-existing profile-fetch warning, never with password/email/user variables', () => {
    const consoleCalls = [...authSource.matchAll(/console\.(warn|error|log)\([^)]*\)/g)].map((m) => m[0]);
    for (const call of consoleCalls) {
      expect(call).not.toMatch(/\bpassword\b|\bconfirmPassword\b|\btrimmedEmail\b|\bemail\b|signUpError\.message|signInError\.message/);
    }
  });
});

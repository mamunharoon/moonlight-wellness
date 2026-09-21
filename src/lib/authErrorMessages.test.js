import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveAuthError,
  logAuthDiagnostic,
  isAccountAlreadyExistsError,
  isWeakPasswordError,
  isEmailRateLimitError,
  NEUTRAL_NO_SESSION_MESSAGE,
  WEAK_PASSWORD_MESSAGE,
  EMAIL_RATE_LIMIT_MESSAGE,
  SIGNUP_FALLBACK_MESSAGE,
} from './authErrorMessages';

// Minimal stand-ins for @supabase/auth-js's real error shapes (confirmed
// against the installed 2.112.0 in node_modules/@supabase/auth-js/dist/
// main/lib/errors.js): AuthApiError carries `.code` (GoTrue's error_code
// string) and `.status` (HTTP status); AuthRetryableFetchError carries
// neither, only `.name`.
const apiError = (message, status, code) => ({ name: 'AuthApiError', message, status, code });
const retryableFetchError = (message = 'network error') => ({ name: 'AuthRetryableFetchError', message });

describe('resolveAuthError — structured code takes priority over message text', () => {
  it('weak_password: exact required copy, regardless of the message text or breach reasons', () => {
    const resolved = resolveAuthError(
      apiError('Password is known to be weak and easy to guess, please choose a different one.', 422, 'weak_password')
    );
    expect(resolved).toEqual({ message: WEAK_PASSWORD_MESSAGE, code: 'weak_password', status: 422, isUnknown: false });
  });

  it('weak_password never leaks HaveIBeenPwned/breach-corpus internals into the message', () => {
    const resolved = resolveAuthError(apiError('...', 422, 'weak_password'));
    expect(resolved.message).not.toMatch(/pwned|breach|haveibeenpwned/i);
  });

  it('existing account + weak password produces the identical password message as a new account + weak password (same code, different context)', () => {
    // Confirmed live this session: GoTrue's weak_password check runs BEFORE
    // its duplicate-account check, so an existing, already-registered email
    // gets the exact same weak_password error shape as a brand-new one.
    const newAccountAttempt = apiError('Password is known to be weak and easy to guess, please choose a different one.', 422, 'weak_password');
    const existingAccountAttempt = apiError('Password is known to be weak and easy to guess, please choose a different one.', 422, 'weak_password');
    expect(resolveAuthError(newAccountAttempt).message).toBe(resolveAuthError(existingAccountAttempt).message);
  });

  it('user_already_exists resolves to the exact same neutral copy as the no-session success outcome — no enumerating difference', () => {
    const resolved = resolveAuthError(apiError('A user with this email address has already been registered', 409, 'user_already_exists'));
    expect(resolved.message).toBe(NEUTRAL_NO_SESSION_MESSAGE);
  });

  it('validation_failed and email_address_invalid both map to the same plain, actionable email message', () => {
    expect(resolveAuthError(apiError('invalid request', 422, 'validation_failed')).message).toBe('Please enter a valid email address.');
    expect(resolveAuthError(apiError('invalid email', 400, 'email_address_invalid')).message).toBe('Please enter a valid email address.');
  });

  it('invalid_credentials and email_not_confirmed are resolved by code (previously substring-only)', () => {
    expect(resolveAuthError(apiError('Invalid login credentials', 400, 'invalid_credentials')).message).toBe(
      'The email or password you entered is incorrect.'
    );
    expect(resolveAuthError(apiError('Email not confirmed', 400, 'email_not_confirmed')).message).toBe(
      'Please verify your email before signing in. Check your inbox for the verification link.'
    );
  });

  it('over_request_rate_limit', () => {
    expect(resolveAuthError(apiError('rate limited', 429, 'over_request_rate_limit')).message).toBe(
      'Too many attempts. Please wait a few minutes and try again.'
    );
  });

  it('over_email_send_rate_limit — exact approved (non-punitive) copy', () => {
    expect(resolveAuthError(apiError('rate limited', 429, 'over_email_send_rate_limit')).message).toBe(EMAIL_RATE_LIMIT_MESSAGE);
    expect(EMAIL_RATE_LIMIT_MESSAGE).toBe(
      'A confirmation email may already be on its way. Check your inbox and spam folder, then wait a few minutes before trying again.'
    );
  });

  it('isEmailRateLimitError recognizes the structured code first, falls back to message text', () => {
    expect(isEmailRateLimitError(apiError('x', 429, 'over_email_send_rate_limit'))).toBe(true);
    expect(isEmailRateLimitError({ message: 'email rate limit exceeded' })).toBe(true);
    expect(isEmailRateLimitError(apiError('x', 429, 'over_request_rate_limit'))).toBe(false);
    expect(isEmailRateLimitError(null)).toBe(false);
  });

  it('email_provider_error (literal code, if a future/self-hosted GoTrue ever returns it) — exact approved copy', () => {
    const resolved = resolveAuthError(apiError('smtp failure', 500, 'email_provider_error'));
    expect(resolved.message).toBe("We couldn't send your confirmation email. Please wait a moment and try again.");
  });

  it('unexpected_failure + an email-related message is heuristically treated as an email-provider failure (the shape this SDK actually returns for an SMTP failure today, per error-codes.ts having no dedicated code for it)', () => {
    const resolved = resolveAuthError(apiError('Error sending confirmation email', 500, 'unexpected_failure'));
    expect(resolved.message).toBe("We couldn't send your confirmation email. Please wait a moment and try again.");
  });

  it('a plain unexpected_failure with no email-related message does not get the email-provider message', () => {
    const resolved = resolveAuthError(apiError('Something failed internally', 500, 'unexpected_failure'));
    expect(resolved.message).not.toMatch(/confirmation email/i);
    expect(resolved.isUnknown).toBe(true);
  });

  it('network/offline failure: AuthRetryableFetchError — exact approved copy', () => {
    expect(resolveAuthError(retryableFetchError()).message).toBe('You appear to be offline. Check your internet connection and try again.');
  });

  it('network/offline failure: a raw "Failed to fetch" message with no code', () => {
    const resolved = resolveAuthError({ message: 'Failed to fetch' });
    expect(resolved.message).toBe('You appear to be offline. Check your internet connection and try again.');
    expect(resolved.isUnknown).toBe(false);
  });

  it('unknown/unmapped code and message falls back to the generic message by default and is flagged isUnknown', () => {
    const resolved = resolveAuthError(apiError('some brand-new GoTrue error text', 500, 'some_future_code'));
    expect(resolved.message).toBe('Something went wrong. Please try again.');
    expect(resolved.isUnknown).toBe(true);
    expect(resolved.code).toBe('some_future_code');
    expect(resolved.status).toBe(500);
  });

  it('a caller-supplied fallbackMessage overrides the default generic message for an unknown error only', () => {
    const resolved = resolveAuthError(apiError('some brand-new GoTrue error text', 500, 'some_future_code'), {
      fallbackMessage: SIGNUP_FALLBACK_MESSAGE,
    });
    expect(resolved.message).toBe(SIGNUP_FALLBACK_MESSAGE);
    expect(SIGNUP_FALLBACK_MESSAGE).toBe("We couldn't create your account right now. Please try again shortly.");
  });

  it('a caller-supplied fallbackMessage is ignored when the error is actually recognized', () => {
    const resolved = resolveAuthError(apiError('x', 422, 'weak_password'), { fallbackMessage: SIGNUP_FALLBACK_MESSAGE });
    expect(resolved.message).toBe(WEAK_PASSWORD_MESSAGE);
    expect(resolved.isUnknown).toBe(false);
  });

  it('never uses the generic fallback when a recognized structured code is available, even with unfamiliar message text', () => {
    const resolved = resolveAuthError(apiError('some totally new wording GoTrue has never used before', 422, 'weak_password'));
    expect(resolved.message).toBe(WEAK_PASSWORD_MESSAGE);
    expect(resolved.isUnknown).toBe(false);
  });

  describe('backward-compatible message-substring fallback (used only when .code is absent entirely)', () => {
    it('invalid_credentials-equivalent text', () => {
      expect(resolveAuthError({ message: 'Invalid login credentials' }).message).toBe('The email or password you entered is incorrect.');
    });
    it('user_already_exists-equivalent text', () => {
      expect(resolveAuthError({ message: 'User already registered' }).message).toBe(NEUTRAL_NO_SESSION_MESSAGE);
    });
    it('weak_password-equivalent text', () => {
      expect(resolveAuthError({ message: 'Password should be at least 8 characters.' }).message).toBe(WEAK_PASSWORD_MESSAGE);
    });
    it('email_address_invalid-equivalent text', () => {
      expect(resolveAuthError({ message: 'Unable to validate email address: invalid format' }).message).toBe(
        'Please enter a valid email address.'
      );
    });
    it('a code that IS present but unrecognized still falls through to the message-substring net when the text itself is recognizable', () => {
      const resolved = resolveAuthError(apiError('Invalid login credentials', 400, 'some_unrelated_new_code'));
      expect(resolved.message).toBe('The email or password you entered is incorrect.');
      expect(resolved.isUnknown).toBe(false);
    });

    it('a present-but-unrecognized code with genuinely unrecognizable message text is the true unknown case', () => {
      const resolved = resolveAuthError(apiError('some totally novel server text', 400, 'some_unrelated_new_code'));
      expect(resolved.message).toBe('Something went wrong. Please try again.');
      expect(resolved.isUnknown).toBe(true);
    });
  });

  it('no error at all resolves to an empty, non-unknown result', () => {
    expect(resolveAuthError(null)).toEqual({ message: '', code: null, status: null, isUnknown: false });
  });

  it('reads .code/.status defensively - never throws or requires both fields to be present (real AuthApiError from the installed auth-js always has both, but this must not assume it)', () => {
    expect(() => resolveAuthError({ message: 'no code or status at all' })).not.toThrow();
    expect(() => resolveAuthError({ message: 'has code only', code: 'weak_password' })).not.toThrow();
    expect(resolveAuthError({ message: 'has code only', code: 'weak_password' })).toEqual({
      message: WEAK_PASSWORD_MESSAGE,
      code: 'weak_password',
      status: null,
      isUnknown: false,
    });
  });
});

describe('isAccountAlreadyExistsError / isWeakPasswordError', () => {
  it('recognizes the structured code first', () => {
    expect(isAccountAlreadyExistsError(apiError('x', 409, 'user_already_exists'))).toBe(true);
    expect(isWeakPasswordError(apiError('x', 422, 'weak_password'))).toBe(true);
  });

  it('falls back to legacy message text when code is absent', () => {
    expect(isAccountAlreadyExistsError({ message: 'User already registered' })).toBe(true);
    expect(isWeakPasswordError({ message: 'Password should be at least 8 characters.' })).toBe(true);
  });

  it('is false for unrelated errors', () => {
    expect(isAccountAlreadyExistsError(apiError('x', 400, 'invalid_credentials'))).toBe(false);
    expect(isWeakPasswordError(apiError('x', 400, 'invalid_credentials'))).toBe(false);
    expect(isAccountAlreadyExistsError(null)).toBe(false);
    expect(isWeakPasswordError(null)).toBe(false);
  });
});

describe('logAuthDiagnostic — safe diagnostics only', () => {
  let warnSpy;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('logs operation name, code, and status for an unknown error only', () => {
    const resolved = resolveAuthError(apiError('brand new text', 500, 'some_future_code'));
    logAuthDiagnostic('signUp', resolved);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [, operation, payload] = warnSpy.mock.calls[0];
    expect(operation).toBe('signUp');
    expect(payload).toEqual({ code: 'some_future_code', status: 500 });
  });

  it('never logs for a recognized/mapped error', () => {
    const resolved = resolveAuthError(apiError('x', 422, 'weak_password'));
    logAuthDiagnostic('signUp', resolved);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('the logged payload never contains an email, password, token, or raw response — only code/status', () => {
    const resolved = resolveAuthError(apiError('brand new text mentioning nothing sensitive', 500, 'some_future_code'));
    logAuthDiagnostic('signUp', resolved);
    const [, , payload] = warnSpy.mock.calls[0];
    expect(Object.keys(payload).sort()).toEqual(['code', 'status']);
  });

  it('does nothing when called with no resolved error', () => {
    logAuthDiagnostic('signUp', null);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

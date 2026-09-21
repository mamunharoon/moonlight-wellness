// New-password requirements shared by every "create/replace a password"
// flow - account signup (Auth.jsx) and password reset (ResetPassword.jsx).
// Deliberately NOT imported by Sign In: an existing user must always be
// able to enter whatever password they already have, however long it is -
// raising this minimum must never retroactively lock anyone out.
//
// Product decision: the hard minimum stays 8 (a briefly-considered 12 was
// superseded before shipping - do not reintroduce it without a fresh
// product decision). No mandatory uppercase/lowercase/number/symbol
// composition rules either - length is the only client-side rule. The
// actual defense against weak/breached passwords is Supabase Auth's own
// leaked-password (HaveIBeenPwned) protection, confirmed live this session
// to be enabled on this project and left untouched - see
// authErrorMessages.js's WEAK_PASSWORD_MESSAGE for the copy shown when it
// rejects a password this rule alone would have allowed through.
export const NEW_PASSWORD_MIN_LENGTH = 8;

export const NEW_PASSWORD_HINT = 'Use at least 8 characters. For better security, try a longer, unique password or passphrase.';

export const getPasswordTooShortMessage = () => `Password must be at least ${NEW_PASSWORD_MIN_LENGTH} characters.`;

export const isPasswordTooShort = (password) => (password?.length ?? 0) < NEW_PASSWORD_MIN_LENGTH;

export const PASSWORD_MISMATCH_MESSAGE = 'Your passwords do not match. Please enter them again.';

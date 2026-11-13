import { supabase } from './supabaseClient';

// WakeWise Password Reset — Click-to-Confirm Page.
//
// Root cause (PROD, 13 Nov 2026 Yahoo-account incident): the existing
// email link goes straight to Supabase's hosted GET /verify endpoint
// (the default {{ .ConfirmationURL }} template), which redeems the
// one-time recovery token on that bare GET, before any redirect to the
// app happens at all. Per Supabase's own documented guidance on this
// exact failure mode, some mail providers/gateways prefetch links in
// incoming mail to scan them — a GET-redeems-the-token endpoint has no
// way to tell that prefetch apart from the real user's tap, and whichever
// request reaches /verify first silently burns the single-use token for
// the other.
//
// The fix: stop linking to {{ .ConfirmationURL }}. Link instead to this
// app's own confirmation page with the token carried as an inert query
// parameter ({{ .TokenHash }}, a hashed, lookup-only value Supabase
// documents specifically for building a custom link like this one — not
// the bearer access/refresh token pair). Loading this page does nothing
// to the token; it is only ever redeemed by verifyOtp() below, called
// from the page's "Continue" button tap, never automatically. A
// prefetching scanner that loads the page costs nothing; only a real tap
// can consume the link.
//
// See reports/ for the exact PROD email-template change this requires —
// not applied by this module or anywhere in this commit. Nothing here
// changes PROD's Supabase Auth settings, email template, or redirect
// configuration.

export const RECOVERY_CONFIRM_TYPE = 'recovery';

/**
 * Pure, synchronous, and side-effect-free — reads the confirmation link's
 * token_hash/type from a query string (e.g. location.search) without ever
 * touching Supabase. Safe to call on every render/mount; calling it any
 * number of times can never consume the token, because it never calls
 * verifyOtp (see confirmPasswordReset below, the only thing that does).
 * Returns null for a missing/incomplete/wrong-type payload — same
 * "safe to treat as invalid, no session ever attempted" shape as
 * nativeAuthRecovery.js's classifyNativeAuthUrl.
 */
export const parseResetConfirmParams = (search) => {
  const params = new URLSearchParams(search ?? '');
  const token_hash = params.get('token_hash');
  const type = params.get('type');
  if (!token_hash || type !== RECOVERY_CONFIRM_TYPE) return null;
  return { token_hash, type };
};

/**
 * The only function in this module that ever redeems the token. Must
 * only ever be called from an explicit user action (the page's
 * "Continue" button), never from a mount effect or any automatic timer -
 * that distinction is the entire security property this page exists to
 * provide. Returns true only once Supabase confirms a real session;
 * never throws. Never logs the token hash itself, only a generic
 * failure message on error.
 */
export const confirmPasswordReset = async ({ token_hash, type }) => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
    return Boolean(data?.session) && !error;
  } catch (error) {
    console.warn('[resetPasswordConfirm] failed to verify recovery token:', error?.message);
    return false;
  }
};

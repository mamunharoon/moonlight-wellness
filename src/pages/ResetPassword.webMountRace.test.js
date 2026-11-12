// Web password recovery fix — lazy-chunk mount race.
//
// Root cause traced via PROD Supabase Auth logs: a genuine recovery-link
// click produced a successful /verify + session (logged as a normal
// "Login" grant, since establishing a recovery session is the same
// underlying code path as any other sign-in), yet this page still showed
// "invalid or expired". App.jsx lazy-loaded ResetPassword like every
// other page (see its own route-level code-splitting comment) — but this
// one is reached only via an external email link, never in-app
// navigation, so its separate chunk fetch races Supabase's own one-time
// PASSWORD_RECOVERY event, fired while the main bundle (and the
// Supabase client within it) evaluates, well before a lazy chunk for
// this specific route could finish loading. onAuthStateChange never
// replays a missed event to a late subscriber, and getSession() alone is
// deliberately not accepted as proof of recovery (see
// resetPasswordAccess.js's own header) — so a missed event left no path
// to 'valid' at all.
//
// Source-level check, same convention as ResetPassword.nativeRecoveryRace.test.js/
// ResetPassword.passwordPolicy.test.js/ResetPassword.mobileSafeArea.test.js
// (no DOM rendering available in this repo's Vitest - see any of those
// files' own note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appSource = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf-8');

describe('App.jsx — ResetPassword is a static import, not lazy-loaded like other pages', () => {
  it('imports ResetPassword as a plain named import, not via lazy()', () => {
    expect(appSource).toMatch(/^import \{ ResetPassword \} from '\.\/pages\/ResetPassword';$/m);
  });

  it('no longer defines a lazy-loaded ResetPassword binding', () => {
    expect(appSource).not.toMatch(/lazy\(\(\) => import\('\.\/pages\/ResetPassword'\)/);
  });

  it('the /reset-password route renders it directly, not wrapped in the lazy-route Suspense fallback', () => {
    expect(appSource).toMatch(/<Route path="reset-password" element=\{<ResetPassword \/>\} \/>/);
    expect(appSource).not.toMatch(/path="reset-password" element=\{withFallback\(<ResetPassword \/>\)\}/);
  });
});

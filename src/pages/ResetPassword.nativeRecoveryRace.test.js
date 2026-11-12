// Native password recovery fix — warm-start race.
//
// Root cause traced: nativeAuthRecovery.js's resolveIncomingUrl() routes
// a fresh, genuinely-verified recovery link to this exact page via
// navigate('/reset-password', { replace: true, state: { recoveryVerified: true } }).
// react-router matches the SAME route for a path-only replace and does
// NOT remount an already-mounted component, so this page's own
// confirmation-check effect — previously deps: [] — only ever read
// location.state once, at whatever mount first happened (e.g. an
// earlier expired/reused link, landing on 'invalid'). A second, fresh,
// valid link arriving while this page was already warm from that
// earlier attempt was silently ignored: no remount, no dependency
// change, no re-check, status stuck on 'invalid' forever.
//
// Source-level check, same convention as ResetPassword.passwordPolicy.test.js/
// ResetPassword.mobileSafeArea.test.js (no DOM rendering available in
// this repo's Vitest - see either file's own note).
//
// 2026-11-12 update: the effect's own subscribe/getSession/
// shouldTreatAsValidRecovery body was extracted into
// resetPasswordRecoverySession.js (see its own header - a separate, web
// mount-timing race fix), leaving ResetPassword.jsx's own effect as a
// thin call-through. The dependency-array/re-run behaviour this file
// protects is unchanged and still lives here; the extracted body's own
// behaviour is covered by ResetPassword.recoveryLatchRace.test.js
// instead, against a fake Supabase client.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./ResetPassword.jsx', import.meta.url)), 'utf-8');
const sessionModuleSource = readFileSync(fileURLToPath(new URL('../lib/resetPasswordRecoverySession.js', import.meta.url)), 'utf-8');

const confirmationEffectBody = () =>
  source.match(/useEffect\(\(\) => subscribeToRecoverySession\(\{[\s\S]*?\}\), \[location\.state\?\.recoveryVerified\]\);/)?.[0] ?? '';

describe('ResetPassword.jsx — confirmation-check effect re-runs on a fresh native recovery link, even while already mounted', () => {
  it('found the effect, now keyed on location.state?.recoveryVerified rather than []', () => {
    const body = confirmationEffectBody();
    expect(body).not.toBe('');
  });

  it('no longer suppresses exhaustive-deps with a hardcoded [] - the real dependency is declared instead of silenced', () => {
    expect(source).not.toMatch(/eslint-disable-next-line react-hooks\/exhaustive-deps/);
  });

  it('passes nativeRecoveryVerified through from location.state on every re-run, not just the original mount', () => {
    const body = confirmationEffectBody();
    expect(body).toMatch(/nativeRecoveryVerified: location\.state\?\.recoveryVerified/);
  });

  it('the extracted subscribeToRecoverySession still subscribes onAuthStateChange and calls getSession() exactly as before - only its location (not its logic) changed', () => {
    expect(sessionModuleSource).toMatch(/onAuthStateChange\(\(event\) => \{/);
    expect(sessionModuleSource).toMatch(/getSession\(\)\.then\(/);
    expect(sessionModuleSource).toMatch(/shouldTreatAsValidRecovery\(\{/);
    expect(sessionModuleSource).toMatch(/return \(\) => subscription\.unsubscribe\(\);/);
  });

  it('still never downgrades an already-"valid" status on re-run (the functional setStatus guard)', () => {
    expect(sessionModuleSource).toMatch(/setStatus\(\(current\) => \(current === 'valid' \? current : valid \? 'valid' : 'invalid'\)\);/);
  });
});

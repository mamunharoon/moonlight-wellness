// passwordRecoveryLatch.js — carry-over check.
//
// The latch exists to bridge a missed PASSWORD_RECOVERY event (see this
// module's own header), but a plain set-and-read boolean would stay
// `true` for the entire tab's JS runtime, not just the one page load
// that needed it. These tests confirm a completed reset, a sign-out, or
// switching accounts in the same tab can never inherit a stale `true`
// left over from an earlier, already-handled (or even never-consumed)
// recovery event.
//
// Fake-client pattern matches ResetPassword.recoveryLatchRace.test.js
// and nativeAuthRecovery.test.js (no DOM rendering available in this
// repo's Vitest - see either file's own note).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const makeFakeSupabase = () => {
  const subscribers = [];
  return {
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        subscribers.push(callback);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      __fireAuthEvent: (event) => {
        subscribers.forEach((cb) => cb(event));
      },
    },
  };
};

beforeEach(() => {
  vi.resetModules();
});

describe('passwordRecoveryLatch — cannot carry a stale recovery grant across a reset, sign-out, or account switch', () => {
  it('consumes itself on read: a successful reset cannot be read as latched a second time with no new event', async () => {
    const fakeSupabase = makeFakeSupabase();
    vi.doMock('../lib/supabaseClient', () => ({ supabase: fakeSupabase }));

    const { wasPasswordRecoveryLatched } = await import('./passwordRecoveryLatch');
    fakeSupabase.auth.__fireAuthEvent('PASSWORD_RECOVERY');

    expect(wasPasswordRecoveryLatched()).toBe(true);
    // Simulates the user finishing the reset, signing out, and a
    // different account signing in afterward, in the same tab — no new
    // recovery event has fired since the one already consumed above.
    expect(wasPasswordRecoveryLatched()).toBe(false);
  });

  it('an explicit sign-out clears a latched-but-never-consumed event (ResetPassword never mounted to read it)', async () => {
    const fakeSupabase = makeFakeSupabase();
    vi.doMock('../lib/supabaseClient', () => ({ supabase: fakeSupabase }));

    const { wasPasswordRecoveryLatched } = await import('./passwordRecoveryLatch');
    fakeSupabase.auth.__fireAuthEvent('PASSWORD_RECOVERY');
    fakeSupabase.auth.__fireAuthEvent('SIGNED_OUT');

    expect(wasPasswordRecoveryLatched()).toBe(false);
  });

  it('switching accounts in the same tab never inherits the previous account\'s recovery grant', async () => {
    const fakeSupabase = makeFakeSupabase();
    vi.doMock('../lib/supabaseClient', () => ({ supabase: fakeSupabase }));

    const { wasPasswordRecoveryLatched } = await import('./passwordRecoveryLatch');

    // Account A completes a genuine recovery.
    fakeSupabase.auth.__fireAuthEvent('PASSWORD_RECOVERY');
    expect(wasPasswordRecoveryLatched()).toBe(true);

    // Account A signs out; Account B signs in on the same device/tab —
    // this app's own account-switch path always signs out first (see
    // AuthContext.jsx's signOut()), so SIGNED_OUT is the real-world
    // signal a switch is happening.
    fakeSupabase.auth.__fireAuthEvent('SIGNED_OUT');
    fakeSupabase.auth.__fireAuthEvent('SIGNED_IN');

    expect(wasPasswordRecoveryLatched()).toBe(false);
  });

  it('a genuinely new recovery event after a sign-out still latches normally — this is only about stale state, not disabling the mechanism', async () => {
    const fakeSupabase = makeFakeSupabase();
    vi.doMock('../lib/supabaseClient', () => ({ supabase: fakeSupabase }));

    const { wasPasswordRecoveryLatched } = await import('./passwordRecoveryLatch');

    fakeSupabase.auth.__fireAuthEvent('PASSWORD_RECOVERY');
    expect(wasPasswordRecoveryLatched()).toBe(true);
    fakeSupabase.auth.__fireAuthEvent('SIGNED_OUT');

    // A second, genuinely new recovery link clicked later in the same
    // tab must still work.
    fakeSupabase.auth.__fireAuthEvent('PASSWORD_RECOVERY');
    expect(wasPasswordRecoveryLatched()).toBe(true);
  });
});

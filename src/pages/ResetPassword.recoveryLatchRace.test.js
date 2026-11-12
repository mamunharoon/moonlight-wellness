// Web password-recovery mount-timing race — behavioural reproduction.
//
// Root cause traced via PROD Supabase Auth logs (2026-11-12): a real
// recovery-link click produced a successful /verify + session, yet the
// page still showed "invalid or expired". Supabase's one-time
// PASSWORD_RECOVERY event fires once, as soon as the client processes
// the URL; onAuthStateChange never replays a missed event to a listener
// that subscribes afterward.
//
// This file reproduces that exact ordering directly, without rendering
// the page (this repo's Vitest has no DOM - same convention as
// nativeAuthRecovery.test.js's own fake-client tests): a fake Supabase
// client lets each test fire PASSWORD_RECOVERY to whichever listeners
// happen to be registered at that moment, so "before the page
// subscribes" is something the test controls explicitly, not something
// inferred from bundling strategy.
//
// Each test gets its own fresh module graph (vi.resetModules()) so
// passwordRecoveryLatch.js's own module-level subscription — which, in
// the real app, only ever happens once per page load — behaves the same
// way here: exactly one subscription per test, matching exactly one
// simulated page load.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const makeFakeSupabase = (initialSession = null) => {
  const subscribers = [];
  let currentSession = initialSession;
  return {
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        subscribers.push(callback);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getSession: vi.fn(() => Promise.resolve({ data: { session: currentSession } })),
      // Test-only helper, not part of the real supabase-js API: lets a
      // test fire an event to every subscriber registered so far,
      // exactly like a real GoTrue client would broadcast one.
      __fireAuthEvent: (event, session) => {
        if (session !== undefined) currentSession = session;
        subscribers.forEach((cb) => cb(event, currentSession));
      },
    },
  };
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.resetModules();
});

describe('ResetPassword mount-timing race — PASSWORD_RECOVERY fires before the page subscribes', () => {
  it('the static-import fix alone (an ordinary live subscription with no latch) still loses this race', async () => {
    const fakeSupabase = makeFakeSupabase();

    // No passwordRecoveryLatch import here — this reproduces exactly
    // what a plain, unmodified onAuthStateChange subscription sees: the
    // event already happened, and there is nothing to ask about it
    // after the fact.
    const recoverySession = { user: { id: 'user-1' } };
    fakeSupabase.auth.__fireAuthEvent('PASSWORD_RECOVERY', recoverySession);

    const { shouldTreatAsValidRecovery } = await import('../lib/resetPasswordAccess');
    let status = 'checking';
    const setStatus = (next) => {
      status = typeof next === 'function' ? next(status) : next;
    };

    // The page's own subscription, registered AFTER the event already
    // fired — recoveryEventFired can only ever be false here, by
    // construction, exactly like a real late-mounting ResetPassword.
    let recoveryEventFired = false;
    fakeSupabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') recoveryEventFired = true;
    });
    const { data: { session } } = await fakeSupabase.auth.getSession();
    const valid = shouldTreatAsValidRecovery({
      recoveryEventFired,
      nativeRecoveryVerified: undefined,
      hasSession: Boolean(session),
      latchedEarlier: false,
    });
    setStatus(valid ? 'valid' : 'invalid');

    expect(status).toBe('invalid');
  });

  it('with passwordRecoveryLatch.js loaded first (as main.jsx always does), the new-password form still opens', async () => {
    const fakeSupabaseForThisTest = makeFakeSupabase();
    vi.doMock('../lib/supabaseClient', () => ({ supabase: fakeSupabaseForThisTest }));

    // Simulates main.jsx's own very first import, before App ever
    // renders — the real app does this unconditionally, on every route.
    await import('../lib/passwordRecoveryLatch');

    // The race itself: Supabase's hash-detection fires PASSWORD_RECOVERY
    // with a real recovery session before ResetPassword (or anything
    // route-specific) has subscribed to anything.
    const recoverySession = { user: { id: 'user-1' } };
    fakeSupabaseForThisTest.auth.__fireAuthEvent('PASSWORD_RECOVERY', recoverySession);

    // Only now does the page mount and subscribe - exactly the losing
    // order from the test above, but this time the latch already
    // caught it.
    const { subscribeToRecoverySession } = await import('../lib/resetPasswordRecoverySession');

    let status = 'checking';
    const setStatus = vi.fn((next) => {
      status = typeof next === 'function' ? next(status) : next;
    });

    subscribeToRecoverySession({ supabase: fakeSupabaseForThisTest, setStatus, nativeRecoveryVerified: undefined });
    await flushMicrotasks();

    // 'valid' is the sole condition gating the new-password form in
    // ResetPassword.jsx ({status === 'valid' && (<form>...)}) - this is
    // the form opening.
    expect(status).toBe('valid');
  });

  it('a normal signed-in session alone — no PASSWORD_RECOVERY event, ever — still never opens the form', async () => {
    const existingSession = { user: { id: 'user-1' } };
    const fakeSupabaseForThisTest = makeFakeSupabase(existingSession);
    vi.doMock('../lib/supabaseClient', () => ({ supabase: fakeSupabaseForThisTest }));

    await import('../lib/passwordRecoveryLatch');
    // No recovery event is ever fired in this test - only an ordinary
    // pre-existing session, exactly the case resetPasswordAccess.js's
    // own header says must never be mistaken for recovery.

    const { subscribeToRecoverySession } = await import('../lib/resetPasswordRecoverySession');

    let status = 'checking';
    const setStatus = vi.fn((next) => {
      status = typeof next === 'function' ? next(status) : next;
    });

    subscribeToRecoverySession({ supabase: fakeSupabaseForThisTest, setStatus, nativeRecoveryVerified: undefined });
    await flushMicrotasks();

    expect(status).toBe('invalid');
  });

  it('the live-event path still works unassisted when subscription genuinely happens first (the common, non-race case)', async () => {
    const fakeSupabaseForThisTest = makeFakeSupabase();
    vi.doMock('../lib/supabaseClient', () => ({ supabase: fakeSupabaseForThisTest }));

    await import('../lib/passwordRecoveryLatch');
    const { subscribeToRecoverySession } = await import('../lib/resetPasswordRecoverySession');

    let status = 'checking';
    const setStatus = vi.fn((next) => {
      status = typeof next === 'function' ? next(status) : next;
    });

    // Subscribe BEFORE the event fires this time.
    subscribeToRecoverySession({ supabase: fakeSupabaseForThisTest, setStatus, nativeRecoveryVerified: undefined });
    fakeSupabaseForThisTest.auth.__fireAuthEvent('PASSWORD_RECOVERY', { user: { id: 'user-1' } });
    await flushMicrotasks();

    expect(status).toBe('valid');
  });
});

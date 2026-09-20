// Sign-out failure semantics — real behaviour tests against a fake
// Supabase client (not just a source-level regex check), per the audit
// requirement to verify the actual signOut path.
import { describe, it, expect, vi } from 'vitest';
import { performSupabaseSignOut } from './signOutFlow';

const makeFakeClient = ({ signOutError = null, sessionAfterError = null } = {}) => ({
  auth: {
    signOut: vi.fn().mockResolvedValue({ error: signOutError }),
    getSession: vi.fn().mockResolvedValue({ data: { session: sessionAfterError } })
  }
});

describe('performSupabaseSignOut — successful sign-out', () => {
  it('resolves cleanly and never checks getSession when signOut reports no error', async () => {
    const client = makeFakeClient({ signOutError: null });
    await expect(performSupabaseSignOut(client)).resolves.toBeUndefined();
    expect(client.auth.signOut).toHaveBeenCalledTimes(1);
    expect(client.auth.getSession).not.toHaveBeenCalled();
  });
});

describe('performSupabaseSignOut — no Supabase client configured', () => {
  it('is a safe no-op', async () => {
    await expect(performSupabaseSignOut(null)).resolves.toBeUndefined();
    await expect(performSupabaseSignOut(undefined)).resolves.toBeUndefined();
  });
});

describe('performSupabaseSignOut — signOut() reports an error but the local session is already gone', () => {
  it('does not throw - matches auth-js\'s own "global" scope behaviour, which clears the local session in nearly every outcome', async () => {
    const networkError = { message: 'network request failed', status: 0 };
    const client = makeFakeClient({ signOutError: networkError, sessionAfterError: null });
    await expect(performSupabaseSignOut(client)).resolves.toBeUndefined();
    expect(client.auth.getSession).toHaveBeenCalledTimes(1);
  });
});

describe('performSupabaseSignOut — signOut() reports an error AND a real session still exists', () => {
  it('throws the original error - the one case genuinely worth surfacing to the user', async () => {
    const realError = { message: 'server unavailable', status: 500 };
    const stillValidSession = { access_token: 'still-valid', user: { id: 'user-a' } };
    const client = makeFakeClient({ signOutError: realError, sessionAfterError: stillValidSession });
    await expect(performSupabaseSignOut(client)).rejects.toBe(realError);
  });

  it('never claims success when a session genuinely remains', async () => {
    const realError = { message: 'server unavailable' };
    const client = makeFakeClient({ signOutError: realError, sessionAfterError: { access_token: 'x' } });
    let threw = false;
    try {
      await performSupabaseSignOut(client);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

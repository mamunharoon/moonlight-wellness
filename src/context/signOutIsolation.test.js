// Logout / cross-user client-state audit — regression guard for the
// sign-out signal wiring across the providers AuthContext.signOut()
// cannot reach directly (AudioContext/SessionContext/AlarmContext/
// OnboardingGate are all its own descendants in App.jsx's provider tree
// - a parent context can never consume a child context's hook). Source-
// level checks, matching this codebase's established pattern for logic
// that isn't practically renderable in this repo's Node-environment
// Vitest (see Home.routineState.test.js's own note). The pure cleanup
// helpers themselves are unit-tested directly in signOutCleanup.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const authContextSource = read('./AuthContext.jsx');
const audioContextSource = read('./AudioContext.jsx');
const sessionContextSource = read('./SessionContext.jsx');
const alarmContextSource = read('./AlarmContext.jsx');
const onboardingGateSource = read('../components/OnboardingGate.jsx');
const appSource = read('../App.jsx');

describe('AuthContext.signOut() broadcasts sign-out and delegates the Supabase call to the testable failure-detection helper', () => {
  it('imports and calls every cleanup helper before performSupabaseSignOut', () => {
    expect(authContextSource).toMatch(
      /import \{ broadcastSignOut, clearAppSessionStorage \} from '\.\.\/lib\/signOutCleanup';/
    );
    expect(authContextSource).toMatch(/import \{ performSupabaseSignOut \} from '\.\.\/lib\/signOutFlow';/);
    const body = authContextSource.match(/const signOut = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/clearAllRoutineProgress\(\);/);
    expect(body).toMatch(/clearGuestEntryChoice\(\);/);
    expect(body).toMatch(/clearPendingContent\(\);/);
    expect(body).toMatch(/clearAppSessionStorage\(\);/);
    expect(body).toMatch(/broadcastSignOut\(\);/);
    expect(body).toMatch(/await performSupabaseSignOut\(supabase\);/);
    // Order matters: every local clear/broadcast must run before the
    // Supabase call, same reasoning as the pre-existing
    // clearAllRoutineProgress() etc. - never fails/blocks sign-out, and
    // the app already looks signed-out the instant this function is
    // called. A genuine failure is still propagated (performSupabaseSignOut
    // is awaited, not swallowed), so Profile.jsx's own catch/retry UI
    // still fires when a real session survives the attempt.
    expect(body.indexOf('broadcastSignOut();')).toBeLessThan(body.indexOf('await performSupabaseSignOut(supabase);'));
    expect(body).not.toMatch(/await performSupabaseSignOut\(supabase\)\.catch/);
  });

  it('never marks the guest-entry flag or daily completion via a bare unconditional clear anymore - correctness now comes from user-scoping, not clearing (see dailyCompletion.js)', () => {
    expect(authContextSource).not.toMatch(/clearDailyCompletionFlags/);
  });
});

describe('AudioContext stops and fully releases active playback on sign-out', () => {
  it('subscribes to the sign-out broadcast and resets every playback-related state field', () => {
    expect(audioContextSource).toMatch(/import \{ onSignOutBroadcast \} from '\.\.\/lib\/signOutCleanup';/);
    const handler = audioContextSource.match(/onSignOutBroadcast\(\(\) => \{[\s\S]*?\n {4}\}\);/)?.[0] ?? '';
    expect(handler).toMatch(/audio\.pause\(\);/);
    expect(handler).toMatch(/audio\.removeAttribute\('src'\);/);
    expect(handler).toMatch(/setIsPlaying\(false\);/);
    expect(handler).toMatch(/setCurrentTrack\(null\);/);
  });
});

describe('SessionContext resets the live Session Engine session on sign-out', () => {
  it('dispatches RESET_SESSION when the sign-out broadcast fires', () => {
    expect(sessionContextSource).toMatch(/import \{ onSignOutBroadcast \} from '\.\.\/lib\/signOutCleanup';/);
    expect(sessionContextSource).toMatch(
      /onSignOutBroadcast\(\(\) => dispatch\(\{ type: SESSION_ACTION_TYPES\.RESET_SESSION \}\)\);/
    );
  });
});

describe('AlarmContext clears the legacy journeyStep tracker on sign-out', () => {
  it('resets journeyStep to empty when the sign-out broadcast fires', () => {
    expect(alarmContextSource).toMatch(/import \{ onSignOutBroadcast \} from '\.\.\/lib\/signOutCleanup';/);
    expect(alarmContextSource).toMatch(/onSignOutBroadcast\(\(\) => setJourneyStep\(''\)\);/);
  });
});

describe('OnboardingGate re-syncs guestEntryChosen the moment sign-out is invoked - the actual "return to Welcome" fix', () => {
  it('subscribes to the sign-out broadcast and forces guestEntryChosen back to false', () => {
    expect(onboardingGateSource).toMatch(/import \{ onSignOutBroadcast \} from '\.\.\/lib\/signOutCleanup';/);
    expect(onboardingGateSource).toMatch(/onSignOutBroadcast\(\(\) => setGuestEntryChosen\(false\)\);/);
  });

  it('this fix does not change needsWelcome\'s own decision logic - only what guestEntryChosen can be at the moment of sign-out', () => {
    expect(onboardingGateSource).toMatch(/const needsWelcome = !user && !guestEntryChosen && !isAllowedPreEntryPath;/);
  });
});

describe('Provider tree order is unchanged - the fix uses a signal, not a reorder', () => {
  it('AuthProvider still wraps AudioProvider/SessionProvider/AlarmProvider as descendants, exactly as before', () => {
    const order = ['<AuthProvider>', '<AudioProvider>', '<SessionProvider>', '<AlarmProvider>'];
    const indices = order.map((tag) => appSource.indexOf(tag));
    expect(indices.every((i) => i !== -1)).toBe(true);
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });
});

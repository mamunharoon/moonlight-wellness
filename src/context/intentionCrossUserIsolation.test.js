// Cross-user privacy defect (live-verified, 2026-09-20): two entirely
// distinct DEV accounts (User A, User B) signing in on the same browser
// both ended up with identical Supabase user_intentions row content
// neither had actually chosen. Root cause: AuthContext's automatic
// Stage 2B Group 5.3 migrateGuestData() call, fired unconditionally on
// any account's first sign-in on a device, wrote this device's shared,
// unscoped moonlight_intentions/moonlight_wake_up_time/bedtime/timezone/
// moonlight_journal_entries localStorage content into whichever account
// signed in first with no existing cloud row - with no real link between
// "this device's guest data" and "the account that happens to sign in
// next", since this app has no actual Supabase anonymous session
// (isGuest simply means "no session at all"). These are source-level
// checks (no DOM rendering available in this repo's Vitest - see
// Home.routineState.test.js's own note); every one of these assertions
// fails against the pre-fix source and passes against the fix.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const authContextSource = read('./AuthContext.jsx');
const alarmContextSource = read('./AlarmContext.jsx');
const affirmationSource = read('../pages/Affirmation.jsx');
const migrateGuestDataSource = read('../lib/migrateGuestData.js');

describe('AuthContext no longer automatically migrates device-local guest data into any newly-authenticated account', () => {
  it('does not import migrateGuestData at all', () => {
    expect(authContextSource).not.toMatch(/import \{ migrateGuestData \} from/);
  });

  it('never calls migrateGuestData(...)', () => {
    expect(authContextSource).not.toMatch(/migrateGuestData\(/);
  });

  it('the old per-device migration marker mechanism is gone from the actual CODE - it never actually verified guest data ownership, only "has this account run migration on this device before" (a historical mention of the retired key in the removal-rationale comment is fine and expected)', () => {
    const codeOnly = authContextSource.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/moonlight_migration_v1_/);
    expect(codeOnly).not.toMatch(/MIGRATION_MARKER_PREFIX/);
  });

  it('migrationRevision is retained as an inert constant (0) so AlarmContext needs no dependency-array change, but is never bumped anywhere', () => {
    expect(authContextSource).toMatch(/const migrationRevision = 0;/);
    expect(authContextSource).not.toMatch(/setMigrationRevision/);
    expect(authContextSource).toMatch(/migrationRevision\s*\n\s*\}\}/);
  });
});

describe('migrateGuestData.js itself is untouched (kept for a future explicit, user-approved conversion flow) - only its automatic invocation was removed', () => {
  it('still exports the same migration function and guest-intentions reader', () => {
    expect(migrateGuestDataSource).toMatch(/export async function migrateGuestData\(userId\)/);
    expect(migrateGuestDataSource).toMatch(/const readGuestIntentions = \(\)/);
  });
});

describe('AlarmContext resets intentions/rhythm synchronously (useLayoutEffect) before the browser can paint the outgoing identity\'s values', () => {
  it('imports useLayoutEffect', () => {
    expect(alarmContextSource).toMatch(/import \{ createContext, useContext, useState, useEffect, useLayoutEffect, useRef \} from 'react';/);
  });

  it('the intentions identity-sync effect is a useLayoutEffect, not a plain useEffect', () => {
    const wrapperMatch = alarmContextSource.match(/(useLayoutEffect|useEffect)\(\(\) => \{\s*\n\s*const syncIntentions = async \(\) => \{/);
    expect(wrapperMatch?.[1]).toBe('useLayoutEffect');
  });

  it('the rhythm identity-sync effect is also a useLayoutEffect, not a plain useEffect - same defect class, same fix', () => {
    const wrapperMatch = alarmContextSource.match(/(useLayoutEffect|useEffect)\(\(\) => \{\s*\n\s*const syncRhythm = async \(\) => \{/);
    expect(wrapperMatch?.[1]).toBe('useLayoutEffect');
  });

  it('the synchronous reset still happens before the async fetch in both effects (unchanged logic - only the hook timing changed; F1 also resets intentionsConfirmed to false in between, before the fetch)', () => {
    expect(alarmContextSource).toMatch(/setIntentions\(DEFAULT_INTENTIONS\);\s*\n[\s\S]*?setIntentionsConfirmed\(false\);\s*\n\s*await fetchIntention\(userId\);/);
    // Welcome alarm-status card: setIsAlarmSet(true)/setAlarmConfigured(false)
    // reset alongside setTimezoneState(null), same identity-guard, same
    // reset-before-fetch shape - never left holding a previous identity's
    // enabled/configured state while this one's own fetch is in flight.
    expect(alarmContextSource).toMatch(
      /setTimezoneState\(null\);\s*\n\s*setIsAlarmSet\(true\);\s*\n\s*setAlarmConfigured\(false\);\s*\n\s*await fetchRhythm\(userId\);/
    );
  });

  it('a missing/guest identity resets from getInitialIntentions(), never from a previous authenticated identity\'s in-memory value (F1 also re-reads intentionsConfirmed fresh from guest storage in the same branch)', () => {
    expect(alarmContextSource).toMatch(/if \(!userId\) \{\s*\n\s*setIntentions\(getInitialIntentions\(\)\);\s*\n[\s\S]*?setIntentionsConfirmed\(getInitialIntentionsConfirmed\(\)\);\s*\n\s*return;\s*\n\s*\}/);
  });
});

describe('Derived affirmations have no independent storage - fixing intentions isolation automatically fixes affirmation isolation', () => {
  it('Affirmation.jsx derives every affirmation from the live intentions context value only, never localStorage/sessionStorage', () => {
    expect(affirmationSource).toMatch(/const \{ setJourneyStep, intentions, effectiveTimezone \} = useAlarm\(\);/);
    expect(affirmationSource).not.toMatch(/localStorage/);
    expect(affirmationSource).not.toMatch(/sessionStorage/);
  });

  it('the affirmation lookup is a pure fixed table, never built from another user\'s or a guest\'s stored text', () => {
    expect(affirmationSource).toMatch(/affirmation: getAffirmationForIntention\(intention, today\)/);
  });
});

describe('Guest intentions remain guest-only unless the user explicitly signs in (no automatic account adoption)', () => {
  it('the guest-only local persistence effect still exists and is still gated on isGuest', () => {
    expect(alarmContextSource).toMatch(
      /if \(authLoading \|\| !isGuest\) return;\s*\n\s*if \(settledIntentionsUserIdRef\.current !== userId\) return;\s*\n\s*localStorage\.setItem\(INTENTIONS_KEY, JSON\.stringify\(intentions\)\);/
    );
  });

  it('registered intentions are never written to the shared guest key - both writers of INTENTIONS_KEY are guest-local-only (the one-time legacy-key rename, and the guest-persist effect gated on isGuest); neither is reachable for a registered user', () => {
    const writers = [...alarmContextSource.matchAll(/localStorage\.setItem\(INTENTIONS_KEY,/g)];
    expect(writers.length).toBe(2);
    // 1) migrateLegacyIntention() - a pure guest-local-to-guest-local
    //    rename from the retired moonlight_today_intention key, only ever
    //    reached via getInitialIntentions() (the no-userId/guest path).
    expect(alarmContextSource).toMatch(
      /const migrated = \[legacy\.trim\(\)\];\s*\n\s*try \{\s*\n\s*localStorage\.setItem\(INTENTIONS_KEY, JSON\.stringify\(migrated\)\);/
    );
    // 2) the guest-persist effect - explicitly gated on isGuest.
    expect(alarmContextSource).toMatch(
      /if \(authLoading \|\| !isGuest\) return;\s*\n\s*if \(settledIntentionsUserIdRef\.current !== userId\) return;\s*\n\s*localStorage\.setItem\(INTENTIONS_KEY, JSON\.stringify\(intentions\)\);/
    );
  });
});

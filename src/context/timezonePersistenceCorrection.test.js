// Timezone persistence correction — real found defect: both
// useCurrentTimezone and TimezoneSettings.jsx's Save button (via
// updateRhythm) marked the timezone "confirmed" by setting local React
// state IMMEDIATELY and firing saveRhythm's Supabase upsert off
// unawaited, with no check of whether it actually succeeded. The banner/
// Settings screen both dismissed themselves right away regardless. If
// the upsert then failed (network error, an unapplied migration, an RLS/
// constraint issue), the user never saw any of that - the local UI
// already looked confirmed, then the NEXT sign-in's fetchRhythm read back
// the still-NULL row and re-asked, with no explanation. This is the
// "stored timezone and confirmed state are separate but only one
// persists" root cause explicitly named in the correction brief.
//
// Fixed by unifying both into one shared, awaited, verified path
// (confirmTimezone) that only marks `timezone` state confirmed once
// saveRhythm has genuinely resolved true, and surfaces an honest
// timezoneSaveError otherwise - "do not mark timezone confirmed if
// persistence fails" is now a structural guarantee, not a hope.
//
// No DOM/component rendering is available in this repo's Vitest (a
// Provider component's internal functions can't be unit-tested by
// import+call without a React render harness this repo doesn't have) -
// source-level checks of the actual function bodies, matching every
// other regression guard in this codebase (see timezoneRaceGuard.test.js's
// own identical constraint/precedent).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const contextSource = read('./AlarmContext.jsx');
const bannerSource = read('../components/TimezoneBanner.jsx');
const settingsSource = read('../pages/TimezoneSettings.jsx');

const confirmTimezoneBody = contextSource.match(/const confirmTimezone = async \(newTimezone\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
const saveRhythmBody = contextSource.match(/const saveRhythm = async \(newAlarm, newBed, newTimezone, newEnabled, newConfigured\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

describe('sanity - both function bodies were located correctly', () => {
  it('confirmTimezone and saveRhythm both exist and were matched', () => {
    expect(confirmTimezoneBody).not.toBe('');
    expect(saveRhythmBody).not.toBe('');
  });
});

describe('persisted confirmation - a registered user\'s "confirmed" local state only changes AFTER a real, awaited save succeeds', () => {
  it('confirmTimezone awaits saveRhythm before deciding anything - never a synchronous setTimezoneState followed by a fire-and-forget save', () => {
    const iAwait = confirmTimezoneBody.indexOf('await saveRhythm(');
    const iSetOnSuccess = confirmTimezoneBody.indexOf('if (saved) {');
    expect(iAwait).toBeGreaterThan(0);
    expect(iSetOnSuccess).toBeGreaterThan(iAwait);
  });

  it('setTimezoneState(newTimezone) for a registered user is reachable ONLY inside the `if (saved)` branch - never unconditionally before or after the await', () => {
    const afterAwait = confirmTimezoneBody.slice(confirmTimezoneBody.indexOf('await saveRhythm('));
    const setCalls = [...afterAwait.matchAll(/setTimezoneState\(newTimezone\);/g)];
    expect(setCalls.length).toBe(1);
    const savedBranch = afterAwait.match(/if \(saved\) \{\s*\n\s*setTimezoneState\(newTimezone\);\s*\n\s*\}/);
    expect(savedBranch).not.toBeNull();
  });

  it('the guest/unauthenticated path is the one deliberate exception - no cloud round-trip exists to await, so local state (the guest\'s own durable source of truth) is set immediately', () => {
    expect(confirmTimezoneBody).toMatch(/if \(authLoading \|\| isGuest \|\| !userId\) \{\s*\n\s*setTimezoneState\(newTimezone\);\s*\n\s*return true;\s*\n\s*\}/);
  });
});

describe('save failure - timezone is never marked confirmed, and an honest error surfaces instead of nothing', () => {
  it('a failed saveRhythm leaves timezone state completely untouched and sets timezoneSaveError, never silently doing nothing', () => {
    expect(confirmTimezoneBody).toMatch(/\} else \{\s*\n\s*setTimezoneSaveError\("Couldn't save your timezone\. Please try again\."\);\s*\n\s*\}/);
  });

  it('saveRhythm itself now catches a thrown/rejected call (not just a Postgrest {error} response) and returns false either way - previously there was no catch at all, so a network-level rejection could propagate uncaught', () => {
    expect(saveRhythmBody).toMatch(/try \{/);
    expect(saveRhythmBody).toMatch(/\} catch \(e\) \{\s*\n\s*console\.error\('Error saving rhythm:', e\?\.message\);\s*\n\s*return false;\s*\n\s*\}/);
    expect(saveRhythmBody).toMatch(/if \(!result\.success\) \{\s*\n\s*console\.error\('Error saving rhythm:', result\.error\?\.message\);\s*\n\s*return false;\s*\n\s*\}/);
    expect(saveRhythmBody).toMatch(/return true;/);
  });

  // Timezone persistence correction, part 2 — the real "underlying
  // Supabase persistence operation is failing" root cause (confirmed live:
  // rhythms.alarm_enabled/alarm_configured return Postgres 42703 on DEV,
  // even though the migration adding them is already committed) lives in
  // upsertRhythmWithFallback (rhythmPersistence.js), with its own
  // dedicated, REAL executed test coverage in rhythmPersistence.test.js -
  // this just confirms saveRhythm actually delegates to it, with the
  // correct core/extended field split.
  it('saveRhythm delegates the actual upsert-with-fallback logic to upsertRhythmWithFallback, splitting the payload into core fields (always present) and extended fields (alarm_enabled/alarm_configured - the ones confirmed missing on live DEV today)', () => {
    expect(contextSource).toMatch(/import \{ upsertRhythmWithFallback \} from '\.\.\/lib\/rhythmPersistence';/);
    expect(saveRhythmBody).toMatch(/const corePayload = \{\s*\n\s*user_id: userId,\s*\n\s*wake_up_time: newAlarm,\s*\n\s*bedtime: newBed,\s*\n\s*timezone: newTimezone \?\? null,\s*\n\s*updated_at: new Date\(\)\.toISOString\(\)\s*\n\s*\};/);
    expect(saveRhythmBody).toMatch(/const result = await upsertRhythmWithFallback\(supabase, corePayload, \{\s*\n\s*alarm_enabled: newEnabled,\s*\n\s*alarm_configured: newConfigured\s*\n\s*\}\);/);
  });

  it('confirmTimezone clears any previous error at the start of every attempt, so retrying (tapping the same action again) is the one, sufficient retry mechanism', () => {
    const iGuard = confirmTimezoneBody.indexOf('if (!isValidTimezone(newTimezone)) return false;');
    const iClear = confirmTimezoneBody.indexOf('setTimezoneSaveError(null);');
    const iAwait = confirmTimezoneBody.indexOf('await saveRhythm(');
    expect(iGuard).toBeGreaterThanOrEqual(0);
    expect(iClear).toBeGreaterThan(iGuard);
    expect(iClear).toBeLessThan(iAwait);
  });

  it('TimezoneBanner.jsx renders timezoneSaveError as a real, announced alert and disables its action while saving - never a silently-stuck button', () => {
    expect(bannerSource).toMatch(/role="alert" className="text-xs text-red-400 font-medium">\{timezoneSaveError\}/);
    expect(bannerSource).toMatch(/disabled=\{timezoneSaving\}/);
    expect(bannerSource).toMatch(/\{timezoneSaving \? 'Saving…' : 'Use current timezone'\}/);
  });

  it('TimezoneSettings.jsx renders the same honest error/saving state, and "Saved" is never shown while saving or after a failure', () => {
    expect(settingsSource).toMatch(/role="alert" className="text-xs text-red-400 font-medium text-center">\{timezoneSaveError\}/);
    expect(settingsSource).toMatch(/disabled=\{!isValidTimezone\(selected\) \|\| timezoneSaving\}/);
    const handleSaveBody = settingsSource.match(/const handleSave = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handleSaveBody).toMatch(/setSaved\(false\);/);
    expect(handleSaveBody).toMatch(/const succeeded = await confirmTimezone\(selected\);/);
    expect(handleSaveBody).toMatch(/if \(succeeded\) setSaved\(true\);/);
  });
});

describe('one shared, unified confirmation path - "stored timezone and confirmed state" no longer risk diverging between two independent writers', () => {
  it('useCurrentTimezone is a thin wrapper around confirmTimezone - the banner\'s "Use current timezone" and Settings\' "Save timezone" now share the exact same verified logic', () => {
    expect(contextSource).toMatch(/const useCurrentTimezone = \(\) => confirmTimezone\(deviceTimezone\);/);
  });

  it('TimezoneSettings.jsx calls confirmTimezone directly, not the old updateRhythm(alarmTime, bedTime, selected) call', () => {
    expect(settingsSource).not.toMatch(/updateRhythm\(/);
    expect(settingsSource).toMatch(/import \{ useAlarm \} from '\.\.\/context\/AlarmContext';/);
  });

  it('confirmTimezone/timezoneSaving/timezoneSaveError are all exposed on the context value, alongside the pre-existing useCurrentTimezone', () => {
    expect(contextSource).toMatch(/useCurrentTimezone,\s*\n\s*confirmTimezone,\s*\n\s*timezoneSaving,\s*\n\s*timezoneSaveError,/);
  });
});

describe('Ask Me Later is never treated as confirmation (unaffected by this correction)', () => {
  it('askTimezoneLater only ever sets the in-memory, session-only snooze flag - it never calls setTimezoneState, confirmTimezone, or saveRhythm', () => {
    const body = contextSource.match(/const askTimezoneLater = \(\) => [^\n]+/)?.[0] ?? '';
    expect(body).toMatch(/setMismatchSnoozedThisSession\(true\)/);
    expect(body).not.toMatch(/setTimezoneState|confirmTimezone|saveRhythm/);
  });
});

describe('cross-user isolation and the pre-existing profile-hydration race guard are both unaffected by this correction', () => {
  it('rhythmSettledUserId still only advances to the current userId AFTER fetchRhythm resolves - confirmTimezone adds no new path that could set it early', () => {
    const syncRhythmBody = contextSource.match(/useLayoutEffect\(\(\) => \{\s*\n\s*const syncRhythm = async \(\) => \{[\s\S]*?\}, \[userId, migrationRevision\]\);/)?.[0] ?? '';
    expect(syncRhythmBody).toMatch(/await fetchRhythm\(userId\);/);
    const iAwait = syncRhythmBody.indexOf('await fetchRhythm(userId);');
    const iSettle = syncRhythmBody.lastIndexOf('setRhythmSettledUserId(userId);');
    expect(iSettle).toBeGreaterThan(iAwait);
  });

  it('confirmTimezone reads userId/isGuest/authLoading fresh from the enclosing render, never a cached/global identity - the same guard shape every other identity-scoped write in this file already uses', () => {
    expect(confirmTimezoneBody).toMatch(/if \(authLoading \|\| isGuest \|\| !userId\)/);
  });

  it('saveRhythm always scopes its upsert to the current userId, and refuses to run at all without one', () => {
    expect(saveRhythmBody).toMatch(/if \(!supabase \|\| !userId\) return false;/);
    expect(saveRhythmBody).toMatch(/user_id: userId,/);
  });
});

describe('device-timezone change never silently overwrites a confirmed choice (unaffected by this correction)', () => {
  it('effectiveTimezone still only ever falls back to deviceTimezone for calculations while `timezone` is null - it never assigns deviceTimezone INTO `timezone` on its own', () => {
    expect(contextSource).toMatch(/const effectiveTimezone = timezone \|\| deviceTimezone;/);
    expect(contextSource).not.toMatch(/setTimezoneState\(deviceTimezone\);\s*\n\s*\/\/ auto/);
  });

  it('the only two places deviceTimezone is ever written into `timezone` are both explicit user actions (confirmTimezone via useCurrentTimezone, and keepSavedTimezone which deliberately does NOT touch timezone at all)', () => {
    const keepSavedBody = contextSource.match(/const keepSavedTimezone = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(keepSavedBody).not.toMatch(/setTimezoneState/);
    expect(keepSavedBody).toMatch(/setDismissedMismatchTimezone\(deviceTimezone\);/);
  });
});

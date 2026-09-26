// Welcome alarm-status card — Onboarding.jsx's new role as the "real
// existing alarm configuration experience" the Set/Change/Manage alarm
// action opens: wake time, enable/disable, timezone and alarm sound
// together, entered via ?returnTo=, saved once, returning to wherever
// returnTo points (or Home for Profile's own pre-existing entry points,
// unaffected). Source-level regression guard (no DOM rendering in this
// repo's Vitest - see signOutIsolation.test.js's own note); the
// bug-fix reasoning and step-count/back-navigation shape are covered by
// onboardingReturnNavigation.test.js/onboardingSimplification.test.js -
// this file covers what's specific to the new alarm-setup content and
// the returnTo mechanism itself.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./Onboarding.jsx');

describe('returnTo: read from the URL, drives step-skip and every exit destination', () => {
  it('reads returnTo via useSearchParams, never a second router mechanism', () => {
    expect(source).toMatch(/import \{ useNavigate, useSearchParams \} from 'react-router-dom';/);
    expect(source).toMatch(/const \[searchParams\] = useSearchParams\(\);/);
    expect(source).toMatch(/const returnTo = searchParams\.get\('returnTo'\);/);
  });

  it('homeOrReturnTo falls back to Home - Profile\'s own pre-existing "Wake time"/"Bedtime" links (which never pass returnTo) are completely unaffected', () => {
    expect(source).toMatch(/const homeOrReturnTo = returnTo \|\| '\/';/);
  });

  it('step starts at 2 (skips the unrelated step-1 "Welcome to WakeWise" blurb) only when returnTo is present', () => {
    expect(source).toMatch(/const \[step, setStep\] = useState\(\(\) => \(returnTo \? 2 : 1\)\);/);
  });
});

describe('the real bug this work found and fixed: the form used to always show hardcoded 07:30/22:00 defaults, ignoring the user\'s real saved alarm', () => {
  it('localAlarm/localBed/localEnabled now derive from the real live alarmTime/bedTime/isAlarmSet (useAlarm()), the same override-not-sync shape localTimezone already used', () => {
    expect(source).toMatch(/const \{ updateRhythm, alarmTime, bedTime, isAlarmSet, effectiveTimezone \} = useAlarm\(\);/);
    expect(source).toMatch(/const \[alarmOverride, setAlarmOverride\] = useState\(null\);/);
    expect(source).toMatch(/const \[bedOverride, setBedOverride\] = useState\(null\);/);
    expect(source).toMatch(/const \[enabledOverride, setEnabledOverride\] = useState\(null\);/);
    expect(source).toMatch(/const localAlarm = alarmOverride \?\? alarmTime;/);
    expect(source).toMatch(/const localBed = bedOverride \?\? bedTime;/);
    expect(source).toMatch(/const localEnabled = enabledOverride \?\? isAlarmSet;/);
  });

  it('never reintroduces the old hardcoded literal defaults', () => {
    expect(source).not.toMatch(/useState\('07:30'\)/);
    expect(source).not.toMatch(/useState\('22:00'\)/);
  });
});

describe('the real enable/disable control (isAlarmSet never had one anywhere in the app before this)', () => {
  it('imports and renders the shared Toggle, wired to localEnabled/setLocalEnabled', () => {
    expect(source).toMatch(/import \{ Toggle \} from '\.\.\/components\/Toggle';/);
    expect(source).toMatch(/<Toggle checked=\{localEnabled\} onChange=\{setLocalEnabled\} label="Wake-up alarm enabled" \/>/);
  });

  it('the row is inside step 2 (Sync with Your Nature), not gated behind a separate unexplained collapsed panel', () => {
    const stepTwoBlock = source.match(/\{step === 2 && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    expect(stepTwoBlock).toMatch(/<Toggle checked=\{localEnabled\}/);
  });
});

describe('the real sound picker, reused (not duplicated)', () => {
  it('imports and renders the exact same AlarmSoundPicker NotificationSettings.jsx uses', () => {
    expect(source).toMatch(/import \{ AlarmSoundPicker \} from '\.\.\/components\/AlarmSoundPicker';/);
    expect(source).toMatch(/<AlarmSoundPicker \/>/);
  });

  it('the picker is inside step 2, alongside wake time/enable/bedtime/timezone - one screen, one Save', () => {
    const stepTwoBlock = source.match(/\{step === 2 && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    expect(stepTwoBlock).toMatch(/<AlarmSoundPicker \/>/);
  });
});

describe('save button label is honest about what this screen does when reached via returnTo', () => {
  it('says "Save" (not "Start My First Morning") whenever returnTo is present, on the real last step', () => {
    expect(source).toMatch(/\{step < TOTAL_STEPS \? 'Continue' : returnTo \? 'Save' : 'Start My First Morning'\}/);
  });
});

describe('saving never starts the Morning journey and never touches pendingJourneyIntent', () => {
  it('no Session Engine call exists anywhere in this file', () => {
    expect(source).not.toMatch(/startSession|useSession/);
  });

  it('no pendingJourneyIntent import/usage exists anywhere in this file', () => {
    expect(source).not.toMatch(/pendingJourneyIntent/);
  });
});

describe('cancelling never falsely marks an alarm as configured', () => {
  it('updateRhythm (the only place alarmConfigured is ever set true) is reachable from exactly one place - the real Save branch of handleNext - never from Close/Back/the step-back arrow', () => {
    const updateRhythmCalls = source.match(/updateRhythm\(/g) ?? [];
    expect(updateRhythmCalls.length).toBe(1);
    // onClose is a single-expression arrow (=> navigate(...)), never a
    // block body that could call anything else.
    expect(source).toMatch(/onClose=\{\(\) => navigate\(homeOrReturnTo\)\}/);
    const handleBackBody = source.match(/const handleBack = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handleBackBody).not.toBe('');
    expect(handleBackBody).not.toMatch(/updateRhythm/);
  });
});

describe('this "Full-Screen flow" route now has a real scroll container - the enable/disable row plus the full sound picker made the previous document-scroll-only layout genuinely overflow a real phone viewport', () => {
  it('wraps its content in the same proven h-dvh + overflow-y-auto shell Introduction.jsx already established, not just min-h-[80vh]', () => {
    expect(source).toMatch(/<div className="h-dvh overflow-hidden">/);
    expect(source).toMatch(/overflow-y-auto overflow-x-hidden scroll-hide/);
  });

  it('keeps bottom safe-area clearance now that the button can sit below the fold on a short viewport', () => {
    expect(source).toMatch(/paddingBottom: 'calc\(1rem \+ env\(safe-area-inset-bottom\)\)'/);
  });
});

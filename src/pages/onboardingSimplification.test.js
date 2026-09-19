// Regression guard for the onboarding simplification: removal of the
// middle "Set Your Intentions" goals screen (Reduce Anxiety / Deep Focus
// / Better Sleep). Audited before removing (see Onboarding.jsx's own
// header doc comment): those goals were written into the SAME
// `intentions` array/localStorage key/Supabase row Morning's own daily
// intentions feature (IntentionSetup.jsx, Home's "Change intention") now
// uses - nothing else ever read the raw ids back out for any real
// behaviour, and no analytics event fired for them. No DOM/component
// rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks, matching
// every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const onboardingSource = read('./Onboarding.jsx');
const authSource = read('./Auth.jsx');
const onboardingGateSource = read('../components/OnboardingGate.jsx');
const profileSource = read('./Profile.jsx');

// The header doc comment on Onboarding.jsx deliberately explains and
// quotes exactly what was removed and why (this repo's established
// "why" comment style) - so the "must not contain" assertions below
// check the actual CODE with block comments stripped, not the file's
// own audit-trail prose about its own history.
const onboardingCode = onboardingSource.replace(/\/\*[\s\S]*?\*\//g, '');

describe('Onboarding.jsx - the goals screen and its intentions-array writes are gone entirely', () => {
  it('never imports or reads/writes the intentions array - Morning daily intentions own that concept now', () => {
    expect(onboardingCode).not.toMatch(/intentions/i);
    expect(onboardingCode).not.toMatch(/setIntentions/);
  });

  it('no trace of the three removed goal options or the toggle handler that wrote them', () => {
    expect(onboardingCode).not.toMatch(/Reduce Anxiety/);
    expect(onboardingCode).not.toMatch(/Deep Focus/);
    expect(onboardingCode).not.toMatch(/Better Sleep/);
    expect(onboardingCode).not.toMatch(/intentOptions/);
    expect(onboardingCode).not.toMatch(/handleToggleIntention/);
  });

  it('the misleading personalization claim is gone', () => {
    expect(onboardingCode).not.toMatch(/personalize your breathing and soundscapes/i);
  });

  it('has exactly two content steps - Welcome and Sync with Your Nature - no third/fourth summary screen', () => {
    expect(onboardingSource).toMatch(/const TOTAL_STEPS = 2;/);
    expect(onboardingSource).toMatch(/\{step === 1 && \(/);
    expect(onboardingSource).toMatch(/\{step === 2 && \(/);
    expect(onboardingSource).not.toMatch(/\{step === 3 && \(/);
    expect(onboardingSource).not.toMatch(/\{step === 4 && \(/);
    expect(onboardingSource).toMatch(/Welcome to WakeWise/);
    expect(onboardingSource).toMatch(/Sync with Your Nature/);
  });
});

describe('Onboarding.jsx - progress indication and step count', () => {
  it('the progress bar width is computed against the real total step count, not a hardcoded stale denominator', () => {
    expect(onboardingSource).toMatch(/width: `\$\{\(step \/ TOTAL_STEPS\) \* 100\}%`/);
  });

  it('the final button only ever finishes on the real last step', () => {
    expect(onboardingSource).toMatch(/\{step === TOTAL_STEPS \? 'Start My First Morning' : 'Continue'\}/);
  });
});

describe('Onboarding.jsx - back/forward navigation between the two steps', () => {
  it('Continue from Welcome (step 1) advances to the schedule step, never skipping past TOTAL_STEPS', () => {
    expect(onboardingSource).toMatch(/if \(step < TOTAL_STEPS\) \{\s*\n\s*setStep\(step \+ 1\);/);
  });

  it('a Back control on the schedule step returns to step 1 (Welcome), and only ever renders on step 2', () => {
    expect(onboardingSource).toMatch(/const handleBack = \(\) => \{\s*\n\s*if \(step > 1\) setStep\(step - 1\);\s*\n\s*\};/);
    const stepTwoBlock = onboardingSource.match(/\{step === 2 && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    expect(stepTwoBlock).toMatch(/onClick=\{handleBack\}/);
    const stepOneBlock = onboardingSource.match(/\{step === 1 && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    expect(stepOneBlock).not.toMatch(/handleBack/);
  });

  it('completing the schedule step (the real last step) persists wake time, bedtime and timezone exactly as before, then navigates Home', () => {
    expect(onboardingSource).toMatch(/updateRhythm\(localAlarm, localBed, localTimezone\);\s*\n\s*navigate\('\/'\);/);
  });
});

describe('Onboarding.jsx - no persisted partial-onboarding step state exists to migrate', () => {
  it('step is a plain, always-valid in-memory useState(1) - no localStorage-backed step key of any kind', () => {
    expect(onboardingSource).toMatch(/const \[step, setStep\] = useState\(1\);/);
    expect(onboardingSource).not.toMatch(/localStorage\.getItem\('.*step.*'\)/i);
    expect(onboardingSource).not.toMatch(/localStorage\.setItem\('.*step.*'\)/i);
  });
});

describe('Existing/fresh-signup users are never forced through onboarding', () => {
  it('Auth.jsx sends both sign-in and sign-up straight to Home via redirectAfterAuth, never to /onboarding', () => {
    expect(authSource).toMatch(/const redirectAfterAuth = \(\) => \{/);
    expect(authSource).not.toMatch(/navigate\('\/onboarding'\)/);
    const signUpBody = authSource.match(/const handleSignUp = async \(e\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(signUpBody).toMatch(/redirectAfterAuth\(\);/);
  });

  it('OnboardingGate (the guest Welcome screen) has no concept of the /onboarding wizard or any "has completed onboarding" flag - it gates only on auth/guest-choice state', () => {
    expect(onboardingGateSource).not.toMatch(/\/onboarding/);
    expect(onboardingGateSource).not.toMatch(/onboarding_complete|onboardingComplete|hasCompletedOnboarding/i);
  });

  it('/onboarding is reached only voluntarily, from Profile\'s Wake time/Bedtime rows - never an automatic redirect target anywhere else in the app', () => {
    expect(profileSource).toMatch(/<Link to="\/onboarding" className=\{rowClass\}>/);
  });
});

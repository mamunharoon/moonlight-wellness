// Build 15 Phase B remediation (Task 5) — Onboarding.jsx return-
// navigation regression guard.
//
// Investigation summary (see Onboarding.jsx's own updated doc comment
// for the full trace): the "Personalizing Your Journey" 2-step sequence
// (step 1 "Welcome to WakeWise", step 2 "Sync with Your Nature") is
// ENTIRELY VOLUNTARY - reached only from Profile's "Wake time"/"Bedtime"
// rows (see onboardingSimplification.test.js's own "reached only
// voluntarily" coverage), never an auth/signup gate, never involving any
// consent/security step. It therefore gets Case 1 treatment (visible
// Back/Close, Home as the safe fallback), not a mandatory-onboarding
// exemption.
//
// Step table:
//   Step 1 "Welcome to WakeWise"    | Onboarding.jsx @ /onboarding, step=1
//     previous destination: Profile (voluntary entry)
//     Continue destination: step 2
//     Back: real shared BackButton (fallback="/") - lands on Profile via
//       real in-app history for a genuine entry, Home for a direct
//       URL/refresh
//     Close: JourneyHeader's own unconditional Close -> Home
//     completion-state effect: none (no persistence on this step)
//   Step 2 "Sync with Your Nature"  | Onboarding.jsx @ /onboarding, step=2
//     previous destination: step 1
//     Continue destination: Home (updateRhythm then navigate('/'))
//     Back: JourneyHeader's own circular 44x44 step-back arrow -> step 1
//       (replaces the old undersized text-only "<- Back" link)
//     Close: JourneyHeader's own unconditional Close -> Home
//     completion-state effect: updateRhythm(localAlarm, localBed,
//       localTimezone) - existing, unchanged, fires exactly once, only
//       from the real last step
//
// Introduction.jsx (a separate screen, reached via Auth.jsx post-signup/
// -signin when shouldShowIntroduction() is true, Home's "Watch: How
// WakeWise works" link, and Profile's "About WakeWise" row) was also
// investigated and found to ALREADY have a compliant <BackButton
// fallback="/" /> plus a "Skip for now" secondary action - no change
// needed there. Welcome.jsx has zero references anywhere in App.jsx's
// route table or any other source file - genuinely unreachable dead
// code, out of scope.
//
// No DOM/component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const onboardingSource = read('./Onboarding.jsx');
const introductionSource = read('./Introduction.jsx');
const journeyHeaderSource = read('../components/journey/JourneyHeader.jsx');
const appSource = read('../App.jsx');

describe('Onboarding.jsx — a consistent header is present on every step', () => {
  it('imports and renders JourneyHeader exactly once, unconditionally (not inside either step === N block)', () => {
    expect(onboardingSource).toMatch(/import \{ JourneyHeader \} from '\.\.\/components\/journey\/JourneyHeader';/);
    const usages = onboardingSource.match(/<JourneyHeader\b/g) ?? [];
    expect(usages.length).toBe(1);
    const stepOneBlock = onboardingSource.match(/\{step === 1 && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    const stepTwoBlock = onboardingSource.match(/\{step === 2 && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    expect(stepOneBlock).not.toMatch(/JourneyHeader/);
    expect(stepTwoBlock).not.toMatch(/JourneyHeader/);
  });

  it('step 1 shows the real shared BackButton (fallback Home, or back to Welcome when arrived via the Welcome alarm-status card\'s returnTo); step 2 shows the local step-back arrow instead', () => {
    expect(onboardingSource).toMatch(/showBackButton=\{step === 1\}/);
    expect(onboardingSource).toMatch(/backFallback=\{homeOrReturnTo\}/);
    expect(onboardingSource).toMatch(/onStepBack=\{handleBack\}/);
  });

  it('Close is unconditional (not step-gated) and always goes Home or back to wherever returnTo points - never an arbitrary/external destination outside this app\'s own control', () => {
    expect(onboardingSource).toMatch(/onClose=\{\(\) => navigate\(homeOrReturnTo\)\}/);
    // homeOrReturnTo itself is only ever '/' or a query-param-read string -
    // never accepts anything but this app's own /introduction routes in
    // practice (see the Welcome alarm-status card's own AlarmStatusCard.jsx,
    // the only caller that ever supplies returnTo).
    expect(onboardingSource).toMatch(/const homeOrReturnTo = returnTo \|\| '\/';/);
  });

  it('the header sits in a safe-area-aware top position - the root container carries the same env(safe-area-inset-top) calc() every other full-bleed screen (Introduction.jsx, AnytimeReset.jsx, etc.) uses', () => {
    expect(onboardingSource).toMatch(/paddingTop: 'calc\(1rem \+ env\(safe-area-inset-top\)\)'/);
  });

  it('stays inside the existing bounded/centred frame (max-w-xl mx-auto, unchanged) - never removed or widened', () => {
    expect(onboardingSource).toMatch(/max-w-xl mx-auto/);
  });
});

describe('Onboarding.jsx — the old undersized text-only step-2 Back link is gone', () => {
  it('no longer renders its own bespoke "<- Back" text button', () => {
    expect(onboardingSource).not.toMatch(/text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-on-surface active:scale-95 transition-all"\s*\n\s*>\s*\n\s*<span className="material-symbols-outlined text-sm">arrow_back/);
  });

  it('JourneyHeader\'s own step-back arrow (the one now used here) is confirmed 44x44 and shares the app\'s circular BackButton visual style - see JourneyHeader.test.js for the full assertion, spot-checked here too', () => {
    expect(journeyHeaderSource).toMatch(/onClick=\{onStepBack\}[\s\S]{0,300}w-11 h-11/);
  });
});

describe('Onboarding.jsx — direct route/refresh cannot trap the user', () => {
  it('step always starts at a safe, valid value - 1 for a direct URL/refresh with no returnTo, or 2 (skip the unrelated step-1 blurb) only when reached deliberately via the Welcome alarm-status card\'s own returnTo - no persisted partial-step state to restore or corrupt either way', () => {
    expect(onboardingSource).toMatch(/const \[step, setStep\] = useState\(\(\) => \(returnTo \? 2 : 1\)\);/);
  });

  it('step 1 (the only step a plain, returnTo-less direct URL/refresh ever lands on) always shows the real BackButton, its fallback resolving safely to Home when no returnTo was ever supplied', () => {
    expect(onboardingSource).toMatch(/showBackButton=\{step === 1\}[\s\S]{0,20}backFallback=\{homeOrReturnTo\}/);
    expect(onboardingSource).toMatch(/const homeOrReturnTo = returnTo \|\| '\/';/);
  });
});

describe('Onboarding.jsx — state, progress, and completion logic are completely untouched by this navigation-only change', () => {
  it('handleBack is byte-for-byte the same; handleNext\'s rhythm-persistence call now also passes localEnabled (Welcome alarm-status card) and navigates to homeOrReturnTo instead of an unconditional Home', () => {
    expect(onboardingSource).toMatch(/const handleBack = \(\) => \{\s*\n\s*if \(step > 1\) setStep\(step - 1\);\s*\n\s*\};/);
    expect(onboardingSource).toMatch(/if \(step < TOTAL_STEPS\) \{\s*\n\s*setStep\(step \+ 1\);\s*\n\s*\} else \{[\s\S]*?updateRhythm\(localAlarm, localBed, localTimezone, localEnabled\);\s*\n\s*navigate\(homeOrReturnTo\);/);
  });

  it('completion (updateRhythm) is reachable through exactly one code path - the else branch of handleNext, only when step === TOTAL_STEPS - never called from Back, Close, or a second location', () => {
    const updateRhythmCalls = onboardingSource.match(/updateRhythm\(/g) ?? [];
    expect(updateRhythmCalls.length).toBe(1);
  });

  it('the progress bar is still derived live from `step` on every render, so it moves correctly both forward (Continue) and backward (the new Back control)', () => {
    expect(onboardingSource).toMatch(/width: `\$\{\(step \/ TOTAL_STEPS\) \* 100\}%`/);
  });

  it('local wake/bed/timezone state is untouched by step changes - no reset-on-navigate logic exists, so values survive stepping backward and forward again', () => {
    expect(onboardingSource).not.toMatch(/setLocalAlarm\('07:30'\)/);
    expect(onboardingSource).not.toMatch(/setLocalBed\('22:00'\)/);
  });

  it('never writes to the intentions array (pre-existing guarantee, reconfirmed unaffected)', () => {
    const codeOnly = onboardingSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/setIntentions/);
  });
});

describe('Introduction.jsx — already compliant (Build 16 redesign superseded "Skip for now"/"Start with WakeWise" with "Go to Home" + three destination cards, same safe-exit guarantee)', () => {
  it('already has a real shared BackButton with a safe Home fallback', () => {
    expect(introductionSource).toMatch(/<BackButton fallback="\/" \/>/);
  });

  it('offers a non-competing secondary "Go to Home" action alongside the three primary destination cards', () => {
    expect(introductionSource).toMatch(/Go to Home/);
  });
});

describe('Welcome.jsx — confirmed unreachable, correctly left untouched', () => {
  it('App.jsx never imports or routes to Welcome.jsx', () => {
    expect(appSource).not.toMatch(/from '\.\/pages\/Welcome'/);
    expect(appSource).not.toMatch(/path="welcome"/);
  });
});

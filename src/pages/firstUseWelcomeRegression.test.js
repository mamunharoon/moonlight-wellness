// First-use Welcome — Build 16 UX correction regression guard.
//
// Consolidates direct proof of the eight specific properties the
// approved correction requires, in one place, even where a piece is
// already covered elsewhere (Introduction.test.js, OnboardingGate.test.js,
// authIntroductionGate.test.js, introductionVersion.test.js) — this file
// exists so each property is individually, unambiguously checkable
// against the exact request, not scattered across other files' own
// framing.
//
// No DOM/component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks for the
// JSX-structural properties; real execution for the pure version-compare
// logic (shouldShowIntroduction is trivially importable/callable).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CURRENT_INTRODUCTION_VERSION, shouldShowIntroduction } from '../lib/introductionVersion';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const introductionSource = read('./Introduction.jsx');
const onboardingGateSource = read('../components/OnboardingGate.jsx');
const introductionCompletionSource = read('../lib/introductionCompletion.js');
const authSource = read('./Auth.jsx');
const authContextSource = read('../context/AuthContext.jsx');

describe('1. Automatic first-use Welcome has no Back control', () => {
  it('the Back control is wrapped in a check for the ?auto=1 marker', () => {
    expect(introductionSource).toMatch(/const isAutomaticFirstUse = searchParams\.get\('auto'\) === '1';/);
    expect(introductionSource).toMatch(
      /\{!isAutomaticFirstUse && \(\s*\n\s*<div className="flex items-center gap-3">\s*\n\s*<BackButton fallback="\/" \/>\s*\n\s*<\/div>\s*\n\s*\)\}/
    );
  });

  it('both automatic-redirect call sites pass the ?auto=1 marker', () => {
    expect(onboardingGateSource).toMatch(/navigate\('\/introduction\?auto=1', \{ replace: true \}\);/);
    expect(authSource).toMatch(/navigate\(`\/introduction\?auto=1\$\{existingParam\}`, \{ replace: true \}\);/);
  });

  it('a deliberate replay (Profile\'s "About WakeWise" row, Home\'s "Watch: How WakeWise works" pill) never adds the marker, so the Back control still shows there', () => {
    const profileSource = read('./Profile.jsx');
    const homeSource = read('./Home.jsx');
    expect(profileSource).toMatch(/<Link to="\/introduction" className=\{rowClass\}>/);
    expect(profileSource).not.toMatch(/\/introduction\?auto=1/);
    expect(homeSource).toMatch(/<Link\s+to="\/introduction"/);
    expect(homeSource).not.toMatch(/\/introduction\?auto=1/);
  });
});

describe('2. Go to Home remains available regardless of ?auto=1', () => {
  it('the Go to Home action is not inside the isAutomaticFirstUse conditional - it is a separate, unconditional block', () => {
    const backControlBlock = introductionSource.match(/\{!isAutomaticFirstUse && \([\s\S]*?\n\s*\)\}/)?.[0] ?? '';
    expect(backControlBlock).not.toMatch(/Go to Home/);
    expect(introductionSource).toMatch(/onClick=\{\(\) => persistAndContinue\('\/'\)\}/);
    expect(introductionSource).toMatch(/\{saving \? 'Saving…' : 'Go to Home'\}/);
  });
});

describe('3 & 4. Every action (a card, or Go to Home) completes version 2 before navigating away', () => {
  it('CURRENT_INTRODUCTION_VERSION is 2 for this DEV/Build 16 redesign', () => {
    expect(CURRENT_INTRODUCTION_VERSION).toBe(2);
  });

  it('Go to Home calls persistAndContinue directly; every card tap calls handleCardTap, which reaches persistAndContinue for every card except a guest-gated one still awaiting sign-in - never a bare navigate either way (Remove Routines from the Visible User Flow: Morning/Evening now need real Session Engine initialization, not a plain path, so cards route through one extra dispatcher rather than calling persistAndContinue inline)', () => {
    expect(introductionSource).toMatch(/onClick=\{\(\) => persistAndContinue\('\/'\)\}/);
    expect(introductionSource).toMatch(/onClick=\{\(\) => handleCardTap\(card\)\}/);
    const handleCardTapBody = introductionSource.match(/const handleCardTap = \(card\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handleCardTapBody).toMatch(/persistAndContinue\(CARD_DESTINATIONS\[card\.id\]\);/);
  });

  it('persistAndContinue writes exactly CURRENT_INTRODUCTION_VERSION (via the shared completeIntroductionVersion - see introductionCompletion.test.js for real-execution proof of the write itself), and only navigates after that write is confirmed', () => {
    expect(introductionCompletionSource).toMatch(/\.update\(\{ introduction_completed_version: CURRENT_INTRODUCTION_VERSION \}\)/);
    const body = introductionSource.match(/const persistAndContinue = async \(destination = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const callIndex = body.indexOf('completeIntroductionVersion(');
    const finalContinueIndex = body.lastIndexOf('continueTo(destination);');
    expect(finalContinueIndex).toBeGreaterThan(callIndex);
  });
});

describe('5 & 6. Version-gated visibility: below version 2 sees Welcome once, at version 2 never sees it again', () => {
  it('shouldShowIntroduction(2) is false - a returning user already at CURRENT_INTRODUCTION_VERSION bypasses Welcome', () => {
    expect(shouldShowIntroduction(2)).toBe(false);
  });

  it('shouldShowIntroduction(1) is true - an existing signed-in user still on version 1 sees the refreshed Welcome once more', () => {
    expect(shouldShowIntroduction(1)).toBe(true);
  });

  it('shouldShowIntroduction(0/undefined) is true - a brand-new signed-in user sees Welcome after their first sign-in', () => {
    expect(shouldShowIntroduction(0)).toBe(true);
    expect(shouldShowIntroduction(undefined)).toBe(true);
  });

  it('after persistAndContinue writes version 2, the SAME account is now at CURRENT_INTRODUCTION_VERSION - "exactly once" holds by construction, not by a separate seen-flag', () => {
    // The write target and the comparison target are the exact same
    // constant - there is no second, driftable "has this been shown"
    // value anywhere in this flow.
    expect(introductionCompletionSource).toMatch(/introduction_completed_version: CURRENT_INTRODUCTION_VERSION/);
    expect(shouldShowIntroduction(CURRENT_INTRODUCTION_VERSION)).toBe(false);
  });

  it('redirectAfterAuth (Auth.jsx) is the one gate for both a brand-new sign-up and an existing below-version account - shouldShowIntroduction makes no distinction between them', () => {
    const body = authSource.match(/const redirectAfterAuth = async \(authUser\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/shouldShowIntroduction\(profileRow\?\.introduction_completed_version\)/);
  });
});

describe('7. A first-time guest sees Welcome exactly once', () => {
  it('OnboardingGate only shows Welcome (needsWelcome) while guestEntryChosen is false, and the guest-entry tap sets it true before redirecting to /introduction', () => {
    expect(onboardingGateSource).toMatch(/const needsWelcome = !user && !guestEntryChosen && !isAllowedPreEntryPath;/);
    const handler = onboardingGateSource.match(/onContinueAsGuest=\{\(\) => \{[\s\S]*?\n {8}\}\}/)?.[0] ?? '';
    expect(handler).toMatch(/markGuestEntryChosen\(\);/);
    expect(handler).toMatch(/setGuestEntryChosen\(true\);/);
    expect(handler).toMatch(/navigate\('\/introduction\?auto=1', \{ replace: true \}\);/);
  });

  it('guestEntryChosen is seeded from the persisted device flag, so a returning guest (flag already true) never sees needsWelcome become true again', () => {
    expect(onboardingGateSource).toMatch(/useState\(hasChosenGuestEntry\)/);
  });
});

describe('8. Sign-out resets the device guest-entry path, exactly as already designed', () => {
  it('AuthContext.signOut clears the persisted guest-entry choice unconditionally, before the Supabase call', () => {
    expect(authContextSource).toMatch(/import \{ clearGuestEntryChoice \} from '\.\.\/lib\/guestEntry';/);
    expect(authContextSource).toMatch(/const signOut = async \(\) => \{\s*\n\s*clearAllRoutineProgress\(\);\s*\n\s*clearGuestEntryChoice\(\);/);
  });

  it('OnboardingGate re-syncs its own guestEntryChosen state the moment sign-out is broadcast, so an already-mounted instance cannot keep stale state', () => {
    expect(onboardingGateSource).toMatch(/import \{ onSignOutBroadcast \} from '\.\.\/lib\/signOutCleanup';/);
    expect(onboardingGateSource).toMatch(/onSignOutBroadcast\(\(\) => setGuestEntryChosen\(false\)\);/);
  });

  it('this makes the very next launch on the device land back on Welcome, not silently continue as the previous guest', () => {
    // needsWelcome recomputes from user (null after sign-out) and the
    // now-false guestEntryChosen - both conditions for Welcome are met.
    expect(onboardingGateSource).toMatch(/const needsWelcome = !user && !guestEntryChosen && !isAllowedPreEntryPath;/);
  });
});

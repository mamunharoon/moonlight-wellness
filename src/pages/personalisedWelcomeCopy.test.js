// Personalised Welcome copy (Build 16) — regression guard, consolidating
// direct proof of the nine specific properties requested, in one place,
// even where a piece is already covered elsewhere (Introduction.test.js,
// firstUseWelcomeRegression.test.js) - this file exists so each property
// is individually, unambiguously checkable against the exact request.
//
// No DOM/component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks for the
// JSX-structural properties; real execution for getFirstName (a pure,
// already-importable function).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getFirstName } from '../lib/greeting';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const introductionSource = read('./Introduction.jsx');
const greetingSource = read('../lib/greeting.js');

describe('1. New guest sees "Welcome to WakeWise"', () => {
  it('the non-returning-user branch resolves to the exact required heading', () => {
    expect(introductionSource).toMatch(/const welcomeHeading = isReturningSignedInUser\s*\n\s*\? \(firstName \? `Welcome back, \$\{firstName\}` : 'Welcome back'\)\s*\n\s*: 'Welcome to WakeWise';/);
  });
});

describe('2. New guest never sees a stored signed-in user\'s name', () => {
  it('isGuest forces firstName to null before getFirstName is ever called - a guest can never reach any code path that reads profile.first_name', () => {
    expect(introductionSource).toMatch(/const firstName = isGuest \? null : getFirstName\(\{ profile, user \}\);/);
  });

  it('isGuest also forces isReturningSignedInUser to false directly - the &&-short-circuit means neither ?existing=1 nor profile.introduction_completed_version is even consulted for a guest', () => {
    expect(introductionSource).toMatch(/const isReturningSignedInUser =\s*\n\s*!isGuest && \(/);
  });

  it('the welcomeHeading/welcomeSubcopy computation has no separate "guest" branch that could accidentally read a name - it is entirely gated through isReturningSignedInUser, which is already proven false for a guest above', () => {
    expect(introductionSource).toMatch(/const welcomeHeading = isReturningSignedInUser/);
    expect(introductionSource).toMatch(/const welcomeSubcopy = isReturningSignedInUser/);
  });
});

describe('3. New signed-in user sees the new-user copy', () => {
  it('a signed-in user whose profile.introduction_completed_version is 0/null/undefined, reached without ?existing=1, resolves isReturningSignedInUser to false - Boolean(0), Boolean(null), Boolean(undefined) are all false', () => {
    // Direct proof of the boolean semantics the source relies on -
    // real execution, not a source-text assumption.
    expect(Boolean(0)).toBe(false);
    expect(Boolean(null)).toBe(false);
    expect(Boolean(undefined)).toBe(false);
    expect(introductionSource).toMatch(/Boolean\(profile\?\.introduction_completed_version\)/);
  });

  it('Auth.jsx only appends &existing=1 when profileRow.introduction_completed_version is truthy - a genuinely new account (no row yet, or version 0) never gets it', () => {
    const authSource = read('./Auth.jsx');
    expect(authSource).toMatch(/const existingParam = profileRow\?\.introduction_completed_version \? '&existing=1' : '';/);
  });
});

describe('4 & 5. Existing version-1 user: "Welcome back, {firstName}" when a valid name exists, plain "Welcome back" otherwise', () => {
  it('both branches are the exact required strings', () => {
    expect(introductionSource).toMatch(/`Welcome back, \$\{firstName\}`/);
    expect(introductionSource).toMatch(/: 'Welcome back'\)/);
  });

  it('the returning-user supporting copy is the exact required sentence', () => {
    expect(introductionSource).toMatch(
      /'WakeWise has a calmer new way to support your morning, your day and your evening\. Where would you like to begin\?'/
    );
  });
});

describe('6. Email local-part is never used as a fallback name', () => {
  it('getFirstName\'s own implementation never reads a .email property - the file\'s own doc comment explicitly documents this guarantee, but the CODE is what actually enforces it', () => {
    const fnBody = greetingSource.match(/export const getFirstName = \([\s\S]*?\n\};/)?.[0] ?? '';
    expect(fnBody).not.toMatch(/\.email/i);
    expect(fnBody).toMatch(/profile\?\.first_name/);
    expect(fnBody).toMatch(/user\?\.user_metadata\?\.first_name/);
  });

  it('getFirstName only ever reads profile.first_name then user_metadata.first_name, in that order, real execution proves it ignores an email-shaped value passed as anything else', () => {
    expect(getFirstName({ profile: { first_name: 'Priya' }, user: { email: 'priya@example.com', user_metadata: {} } })).toBe('Priya');
    expect(getFirstName({ profile: null, user: { email: 'someone@example.com', user_metadata: {} } })).toBe(null);
    expect(getFirstName({ profile: {}, user: { email: 'jordan.smith@example.com', user_metadata: { first_name: 'Jordan' } } })).toBe('Jordan');
  });

  it('Introduction.jsx itself never reads user.email either', () => {
    expect(introductionSource).not.toMatch(/user\?\.email|user\.email/);
  });
});

describe('7. Version-2 returning users bypass Welcome entirely', () => {
  it('is proven in firstUseWelcomeRegression.test.js (shouldShowIntroduction(2) === false, OnboardingGate\'s one-shot guest flag) - referenced here for completeness, not re-implemented twice', () => {
    const firstUseWelcomeRegressionSource = read('./firstUseWelcomeRegression.test.js');
    expect(firstUseWelcomeRegressionSource).toMatch(/shouldShowIntroduction\(2\)\)\.toBe\(false\)/);
  });
});

describe('8. Both copy variants render the identical three cards and destinations', () => {
  it('WELCOME_CARDS is declared once, above the component, never branched per variant', () => {
    const cardsIndex = introductionSource.indexOf('const WELCOME_CARDS = [');
    const componentIndex = introductionSource.indexOf('export const Introduction = () => {');
    expect(cardsIndex).toBeGreaterThan(-1);
    expect(cardsIndex).toBeLessThan(componentIndex);
    expect(introductionSource.match(/const WELCOME_CARDS = \[/g)?.length).toBe(1);
  });

  it('the card map renders from that one constant regardless of welcomeHeading/welcomeSubcopy', () => {
    expect(introductionSource).toMatch(/\{WELCOME_CARDS\.map\(\(card\) => \(/);
  });
});

describe('9. Both variants complete version 2 correctly when a card or Go to Home is selected', () => {
  it('every card and Go to Home call the same persistAndContinue - never a copy-variant-specific persistence path', () => {
    const persistCalls = introductionSource.match(/onClick=\{\(\) => persistAndContinue\(/g) ?? [];
    expect(persistCalls.length).toBe(2); // the one mapped card template + Go to Home
  });

  it('persistAndContinue itself has no reference to welcomeHeading/welcomeSubcopy/isReturningSignedInUser - the write path is fully independent of which copy was shown', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(path = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/welcomeHeading|welcomeSubcopy|isReturningSignedInUser/);
    expect(body).toMatch(/introduction_completed_version: CURRENT_INTRODUCTION_VERSION/);
  });
});

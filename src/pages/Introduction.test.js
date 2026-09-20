// First-use WakeWise introduction — regression guard. Source-level checks,
// matching this codebase's established pattern for logic that isn't
// practically renderable in this repo's Node-environment Vitest (see
// Home.routineState.test.js's own note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const introductionSource = read('./Introduction.jsx');
const introductionMediaSource = read('../lib/introductionMedia.js');
const appSource = read('../App.jsx');
const profileSource = read('./Profile.jsx');

describe('Introduction.jsx — required copy', () => {
  it('has the exact required heading and body', () => {
    expect(introductionSource).toMatch(/Welcome to WakeWise/);
    expect(introductionSource).toMatch(
      /WakeWise helps you begin your morning with intention and end your day with calm\. Follow short guided\s*\n\s*routines, choose practices that suit what you need, and move at your own pace\./
    );
  });

  it('lists the exact four "What you can do" items', () => {
    expect(introductionSource).toMatch(/Start your morning with intention/);
    expect(introductionSource).toMatch(/Wind down gently in the evening/);
    expect(introductionSource).toMatch(/Choose a quick calming practice/);
    expect(introductionSource).toMatch(/Explore meditation, breathing and sleep experiences/);
  });

  it('has an "Introduction guides" section with the exact two guides and their supporting text', () => {
    expect(introductionSource).toMatch(/Introduction guides/);
    expect(introductionMediaSource).toMatch(/title: 'Why WakeWise'/);
    expect(introductionMediaSource).toMatch(
      /description: 'A brief introduction to the purpose of WakeWise and how it can support your daily wellbeing\.'/
    );
    expect(introductionMediaSource).toMatch(/title: 'How to Use WakeWise'/);
    expect(introductionMediaSource).toMatch(
      /description: 'A quick guide to Morning, Evening, calming practices and the Library\.'/
    );
  });

  it('has the exact required Primary/Secondary actions', () => {
    expect(introductionSource).toMatch(/Start with WakeWise/);
    expect(introductionSource).toMatch(/Skip for now/);
  });
});

describe('Introduction.jsx — no fake/working media before real assets exist', () => {
  it('every guide entry defaults to unavailable, with no storage reference or duration', () => {
    const entries = introductionMediaSource.match(/\{\s*id: '[\s\S]*?\}/g) ?? [];
    expect(entries.length).toBe(2);
    entries.forEach((entry) => {
      expect(entry).toMatch(/storageRef: null/);
      expect(entry).toMatch(/durationSeconds: null/);
      expect(entry).toMatch(/captionRef: null/);
      expect(entry).toMatch(/available: false/);
    });
  });

  it('renders a "Coming soon" label instead of a working Play control whenever a guide is unavailable', () => {
    expect(introductionSource).toMatch(/\{!guide\.available && \([\s\S]*?Coming soon/);
    // The icon itself only switches to a play affordance once available -
    // never a clickable/enabled play button while available is false.
    expect(introductionSource).toMatch(/\{guide\.available \? 'play_circle' : 'movie'\}/);
    expect(introductionSource).not.toMatch(/<button[^>]*onClick=\{[^}]*[Pp]lay/);
  });

  it('never invents a storage URL, id, or path for the two guides', () => {
    expect(introductionMediaSource).not.toMatch(/https?:\/\//);
    expect(introductionMediaSource).not.toMatch(/exercises\//);
  });

  it('the unavailable guide card is a plain <div>, not a <button>/<a> - no clickable/enabled control at all while unavailable', () => {
    const cardOpenTag = introductionSource.match(/<div key=\{guide\.id\}[^>]*>/)?.[0] ?? '';
    expect(cardOpenTag).toMatch(/^<div /);
    expect(introductionSource).not.toMatch(/onClick=\{.*guide/i);
  });

  it('produces no network requests for the unavailable guides - nothing ever dereferences guide.storageRef into an <img>/<video>/<audio> src or a fetch call', () => {
    expect(introductionSource).not.toMatch(/guide\.storageRef/);
    expect(introductionSource).not.toMatch(/<video|<audio|<img/);
    expect(introductionSource).not.toMatch(/fetch\(/);
  });

  it('"Coming soon" is styled as a neutral badge, not an error/disabled-looking treatment (no red/error color classes)', () => {
    const badge = introductionSource.match(/<span className="[^"]*">\s*\n\s*Coming soon/)?.[0] ?? '';
    expect(badge).not.toMatch(/red|error|destructive/i);
    expect(badge).toMatch(/bg-white\/5/);
  });

  it('can only ever be enabled by changing introductionMedia.js - Introduction.jsx itself has no other place that decides availability', () => {
    expect(introductionSource).not.toMatch(/available:\s*(true|false)/);
    expect(introductionSource).toMatch(/guide\.available/);
  });
});

describe('Introduction.jsx — Start/Skip both call the same persistAndContinue function - one persistence decision, not two', () => {
  it('both buttons call persistAndContinue, never continueToHome directly', () => {
    const occurrences = introductionSource.match(/onClick=\{persistAndContinue\}/g) ?? [];
    expect(occurrences.length).toBe(2);
  });

  it('does not write any local-only "onboarding complete" flag - persistence is server-side only, via the approved migration', () => {
    expect(introductionSource).not.toMatch(/localStorage\.setItem/);
    expect(introductionSource).not.toMatch(/onboarding_complete|onboardingComplete|tutorial_seen|onboarding_seen/i);
  });
});

describe('Introduction.jsx — guest behaviour is explicit: no Supabase write is ever attempted for a guest', () => {
  it('persistAndContinue short-circuits to continueToHome for a guest/missing user, before touching supabase at all', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const guestGuardIndex = body.indexOf('if (isGuest || !user || !supabase)');
    expect(guestGuardIndex).toBeGreaterThanOrEqual(0);
    expect(body.slice(0, guestGuardIndex)).not.toMatch(/supabase/);
  });
});

describe('Introduction.jsx — profile-row race handling reuses the existing ensure-profile mechanism', () => {
  it('calls refreshProfile() (AuthContext\'s own existing safe upsert-then-reselect) when the row is missing, never a separate/partial profile-creation implementation', () => {
    expect(introductionSource).toMatch(/import \{ useAuth \} from '\.\.\/context\/AuthContext';/);
    expect(introductionSource).toMatch(/const \{ user, isGuest, refreshProfile \} = useAuth\(\);/);
    const body = introductionSource.match(/const persistAndContinue = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!profileRow\) \{\s*\n\s*await refreshProfile\(\);/);
    expect(body).not.toMatch(/\.insert\(/);
    expect(body).not.toMatch(/first_name|last_name/);
  });
});

describe('Introduction.jsx — confirms exactly one row updated, never treats a zero-row update as success', () => {
  it('checks updatedRows.length === 1 before continuing to Home', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/\.update\(\{ introduction_completed_version: CURRENT_INTRODUCTION_VERSION \}\)/);
    expect(body).toMatch(/if \(updateError \|\| !updatedRows \|\| updatedRows\.length !== 1\) \{/);
  });

  it('only navigates Home after confirmed persistence - continueToHome is not called before the update check resolves', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const updateCallIndex = body.indexOf('.update({');
    const finalContinueIndex = body.lastIndexOf('continueToHome();');
    expect(finalContinueIndex).toBeGreaterThan(updateCallIndex);
  });
});

describe('Introduction.jsx — replay never resets or lowers an already-saved version', () => {
  it('short-circuits to Home without writing anything when the account is already at/above CURRENT_INTRODUCTION_VERSION', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(
      /if \(\(profileRow\.introduction_completed_version \?\? 0\) >= CURRENT_INTRODUCTION_VERSION\) \{\s*\n\s*setSaving\(false\);\s*\n\s*continueToHome\(\);\s*\n\s*return;\s*\n\s*\}/
    );
  });
});

describe('Introduction.jsx — prevents repeated clicks while saving, and shows a friendly retryable error on failure', () => {
  it('guards re-entrancy with a saving flag, and disables both buttons while true', () => {
    expect(introductionSource).toMatch(/if \(saving\) return; \/\/ prevent repeated clicks while saving/);
    const occurrences = introductionSource.match(/disabled=\{saving\}/g) ?? [];
    expect(occurrences.length).toBe(2);
  });

  it('shows a non-technical, retryable error message on any failure - never silently pretends success', () => {
    const occurrences = introductionSource.match(/setSaveError\("We couldn't save that\. Please try again\."\);/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3); // read error, missing-row retry failure, update failure
    expect(introductionSource).toMatch(/role="alert"[\s\S]{0,120}\{saveError\}/);
  });

  it('remains on the Introduction screen on failure - no navigate/continueToHome call inside any error branch', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const errorBranches = body.match(/setSaveError\("We couldn't save that\. Please try again\."\);\s*\n\s*return;/g) ?? [];
    expect(errorBranches.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Introduction.jsx — reuses the existing Back control and visual system', () => {
  it('imports and renders the shared BackButton, falling back to Home', () => {
    expect(introductionSource).toMatch(/import \{ BackButton \} from '\.\.\/components\/BackButton';/);
    expect(introductionSource).toMatch(/<BackButton fallback="\/" \/>/);
  });

  it('every section has a real heading element for screen readers, not a styled <p>', () => {
    expect(introductionSource).toMatch(/<h1 className="[^"]*">Welcome to WakeWise<\/h1>/);
    expect(introductionSource).toMatch(/<h2 id="what-you-can-do-heading"/);
    expect(introductionSource).toMatch(/<h2 id="introduction-guides-heading"/);
    expect(introductionSource).toMatch(/aria-labelledby="what-you-can-do-heading"/);
    expect(introductionSource).toMatch(/aria-labelledby="introduction-guides-heading"/);
  });
});

describe('Introduction is routed and reachable from Profile', () => {
  it('App.jsx registers the /introduction route outside <Layout>, same placement as onboarding/auth', () => {
    expect(appSource).toMatch(/<Route path="introduction" element=\{withFallback\(<Introduction \/>\)\} \/>/);
  });

  it('Profile.jsx has an "About WakeWise" row linking to /introduction, visible to guests and registered users alike', () => {
    const row = profileSource.match(/<Link to="\/introduction" className=\{rowClass\}>[\s\S]*?<\/Link>/)?.[0] ?? '';
    expect(row).toMatch(/About WakeWise/);
    // Not inside the `{!isGuest && (...)}` guard that hides Sign out from guests.
    const guestGuardIndex = profileSource.indexOf('{!isGuest && (');
    const rowIndex = profileSource.indexOf('<Link to="/introduction"');
    expect(guestGuardIndex === -1 || rowIndex < guestGuardIndex).toBe(true);
  });
});

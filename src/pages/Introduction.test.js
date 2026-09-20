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

describe('Introduction.jsx — real guide videos (I01/I02), reusing the established private-video mechanism', () => {
  it('both guides are available, connected by manifest id (never a raw storage path/URL)', () => {
    const entries = introductionMediaSource.match(/\{\s*id: '[\s\S]*?\}/g) ?? [];
    expect(entries.length).toBe(2);
    expect(entries[0]).toMatch(/storageRef: 'I01'/);
    expect(entries[0]).toMatch(/available: true/);
    expect(entries[1]).toMatch(/storageRef: 'I02'/);
    expect(entries[1]).toMatch(/available: true/);
    expect(introductionMediaSource).not.toMatch(/https?:\/\//);
    expect(introductionMediaSource).not.toMatch(/exercises\//);
  });

  it('an available guide renders as a real <button> that calls handleSelect with its manifest id', () => {
    expect(introductionSource).toMatch(
      /onClick=\{\(\) => handleSelect\(guide\.storageRef\)\}/
    );
  });

  it('an unavailable guide (a future, not-yet-released third guide) would still render as a plain, non-interactive <div> with a "Coming soon" badge - the availability guarantee is unchanged', () => {
    expect(introductionSource).toMatch(/if \(!guide\.available\) \{/);
    expect(introductionSource).toMatch(/\{!guide\.available && \([\s\S]*?Coming soon/);
    expect(introductionSource).toMatch(/\{guide\.available \? 'play_circle' : 'movie'\}/);
  });

  it('reuses the existing shared hook/modal/dialog - never a bespoke player', () => {
    expect(introductionSource).toMatch(/import \{ useProtectedVideo \} from '\.\.\/hooks\/useProtectedVideo';/);
    expect(introductionSource).toMatch(/import \{ BetaVideoModal \} from '\.\.\/components\/BetaVideoModal';/);
    expect(introductionSource).toMatch(/import \{ SignInPromptDialog \} from '\.\.\/components\/SignInPromptDialog';/);
    expect(introductionSource).not.toMatch(/<video/);
    expect(introductionSource).not.toMatch(/createSignedUrl|functions\.invoke/);
  });

  it('resolves I01/I02 via getBetaVideoById, not the general Library catalog they are excluded from', () => {
    expect(introductionSource).toMatch(/import \{ getBetaVideoById \} from '\.\.\/lib\/mediaCatalog';/);
    expect(introductionSource).toMatch(/useProtectedVideo\(undefined, getBetaVideoById\)/);
  });

  it('only one BetaVideoModal is ever mounted - openVideo is a single piece of state, so selecting the other guide replaces it rather than stacking a second player', () => {
    const modalOccurrences = introductionSource.match(/<BetaVideoModal/g) ?? [];
    expect(modalOccurrences.length).toBe(1);
    expect(introductionSource).toMatch(/\{openVideo && \(\s*\n\s*<BetaVideoModal entry=\{openVideo\} onClose=\{closeVideo\} \/>/);
  });

  it('a guest tap opens SignInPromptDialog - handleSelect (from useProtectedVideo) is the only thing guide buttons call, never a direct video-open', () => {
    expect(introductionSource).toMatch(
      /<SignInPromptDialog\s*\n\s*open=\{promptOpen\}\s*\n\s*onSignIn=\{confirmSignIn\}\s*\n\s*onCreateAccount=\{confirmCreateAccount\}\s*\n\s*onDismiss=\{dismissPrompt\}\s*\n\s*\/>/
    );
  });

  it('"Coming soon" (the still-reachable unavailable-guide state) is styled as a neutral badge, not an error/disabled-looking treatment', () => {
    const badge = introductionSource.match(/<span className="[^"]*">\s*\n\s*Coming soon/)?.[0] ?? '';
    expect(badge).not.toMatch(/red|error|destructive/i);
    expect(badge).toMatch(/bg-white\/5/);
  });

  it('availability is decided only by introductionMedia.js - Introduction.jsx itself has no other place that hardcodes true/false', () => {
    expect(introductionSource).not.toMatch(/available:\s*(true|false)/);
    expect(introductionSource).toMatch(/guide\.available/);
  });

  it('watching, starting or closing a video never touches introduction_completed_version - that write path is owned entirely by persistAndContinue', () => {
    const videoRelatedSlice = introductionSource.slice(
      introductionSource.indexOf('useProtectedVideo('),
      introductionSource.indexOf('const continueToHome')
    );
    expect(videoRelatedSlice).not.toMatch(/introduction_completed_version/);
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

  it('goes straight from the version update to setSaving(false) - no cached-profile refresh in between, since nothing reads that cached field anymore', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const updateCallIndex = body.indexOf('.update({');
    const setSavingFalseIndex = body.indexOf('setSaving(false);', updateCallIndex);
    const between = body.slice(updateCallIndex, setSavingFalseIndex);
    expect(between).not.toMatch(/refreshProfile/);
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

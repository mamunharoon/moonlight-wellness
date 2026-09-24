// First-use WakeWise welcome screen (Build 16 redesign) — regression
// guard. Source-level checks, matching this codebase's established
// pattern for logic that isn't practically renderable in this repo's
// Node-environment Vitest (see Home.routineState.test.js's own note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const introductionSource = read('./Introduction.jsx');
const introductionMediaSource = read('../lib/introductionMedia.js');
const manifestSource = read('../lib/betaVideoManifest.js');
const routinesCatalogSource = read('../lib/routinesCatalog.js');
const appSource = read('../App.jsx');
const profileSource = read('./Profile.jsx');

describe('Introduction.jsx — personalised opening copy (Build 16)', () => {
  it('new-guest / new-signed-in-user variant has the exact required heading and supporting copy', () => {
    expect(introductionSource).toMatch(/: 'Welcome to WakeWise';/);
    expect(introductionSource).toMatch(/: 'What would help you most today\?';/);
  });

  it('existing signed-in version-1 user variant has the exact required heading and supporting copy', () => {
    expect(introductionSource).toMatch(/\? `Welcome back, \$\{firstName\}`/);
    expect(introductionSource).toMatch(
      /'WakeWise has a calmer new way to support your morning, your day and your evening\. Where would you like to begin\?'/
    );
  });

  it('an existing user without a valid first name gets the plain "Welcome back" fallback, never a dangling comma/placeholder', () => {
    expect(introductionSource).toMatch(/\? `Welcome back, \$\{firstName\}` : 'Welcome back'/);
  });

  it('the first name is resolved by the exact same getFirstName() Home.jsx\'s own greeting uses - never derived from email', () => {
    expect(introductionSource).toMatch(/import \{ getFirstName \} from '\.\.\/lib\/greeting';/);
    expect(introductionSource).toMatch(/const firstName = isGuest \? null : getFirstName\(\{ profile, user \}\);/);
    // getFirstName itself (lib/greeting.js) never reads user.email - see
    // greeting.test.js/homeGreetingFallback-style coverage for that
    // guarantee at its own source; this only confirms Introduction.jsx
    // calls that exact function rather than inventing a second name
    // resolver that could read email.
    expect(introductionSource).not.toMatch(/user\?\.email|user\.email/);
  });

  it('a guest can never see any name here - isGuest is checked before firstName is ever computed, and again before the returning-user variant can be selected', () => {
    expect(introductionSource).toMatch(/const firstName = isGuest \? null : getFirstName/);
    expect(introductionSource).toMatch(/const isReturningSignedInUser =\s*\n\s*!isGuest && /);
  });

  it('the returning-user signal comes from ?existing=1 (Auth.jsx\'s own redirect) or AuthContext\'s already-loaded profile.introduction_completed_version - never a new stored flag, never re-asking the user anything', () => {
    expect(introductionSource).toMatch(/searchParams\.get\('existing'\) === '1' \|\| Boolean\(profile\?\.introduction_completed_version\)/);
    expect(introductionSource).not.toMatch(/localStorage/);
  });

  it('has the exact required Go to Home action', () => {
    expect(introductionSource).toMatch(/Go to Home/);
  });

  it('both copy variants render the identical three cards and destinations - WELCOME_CARDS is not itself variant-dependent', () => {
    // WELCOME_CARDS is a single module-level constant, defined once,
    // never conditionally reassigned or duplicated per variant.
    const constDeclarations = introductionSource.match(/^const WELCOME_CARDS = \[/gm) ?? [];
    expect(constDeclarations.length).toBe(1);
    expect(introductionSource).toMatch(/path: '\/routines\/rise-reset'/);
    expect(introductionSource).toMatch(/path: '\/routines\/gentle-reset'/);
    expect(introductionSource).toMatch(/path: '\/routines\/wind-down'/);
  });

  it('both variants complete version 2 the same way - persistAndContinue and CURRENT_INTRODUCTION_VERSION are not themselves variant-dependent', () => {
    const persistFnDeclarations = introductionSource.match(/^ {2}const persistAndContinue = /gm) ?? [];
    expect(persistFnDeclarations.length).toBe(1);
    expect(introductionSource).toMatch(/\.update\(\{ introduction_completed_version: CURRENT_INTRODUCTION_VERSION \}\)/);
  });
});

describe('Introduction.jsx — three tappable destination cards', () => {
  it('has exactly the three required card titles', () => {
    expect(introductionSource).toMatch(/title: 'Start my morning'/);
    expect(introductionSource).toMatch(/title: 'Take a calming pause'/);
    expect(introductionSource).toMatch(/title: 'Wind down for sleep'/);
  });

  it('each card routes to a real, existing Routines Hub destination, not an invented one', () => {
    expect(introductionSource).toMatch(/path: '\/routines\/rise-reset'/);
    expect(introductionSource).toMatch(/path: '\/routines\/gentle-reset'/);
    expect(introductionSource).toMatch(/path: '\/routines\/wind-down'/);
    // All three ids are real entries in routinesCatalog.js - never a
    // fabricated route this app doesn't actually have.
    expect(routinesCatalogSource).toMatch(/id: 'rise-reset'/);
    expect(routinesCatalogSource).toMatch(/id: 'gentle-reset'/);
    expect(routinesCatalogSource).toMatch(/id: 'wind-down'/);
  });

  it('"Take a calming pause" opens Gentle Reset (real guided breathing), never "Instant Calm" (a narrated exercise video, not a breathing practice)', () => {
    const calmCard = introductionSource.match(/\{\s*id: 'calm',[\s\S]*?\n {2}\},/)?.[0] ?? '';
    expect(calmCard).toMatch(/path: '\/routines\/gentle-reset'/);
    expect(calmCard).not.toMatch(/Instant Calm/);
    // Gentle Reset's own catalogue description confirms it is genuinely
    // guided breathing, not music-only - the destination this card's
    // copy is accountable to.
    const gentleResetDetail = routinesCatalogSource.match(/id: 'gentle-reset',[\s\S]*?description: '([^']*)'/);
    expect(gentleResetDetail?.[1]).toMatch(/breathing/i);
  });

  it('card durations match routinesCatalog.js\'s own real, already-established values - never an invented estimate', () => {
    const riseReset = routinesCatalogSource.match(/id: 'rise-reset',[\s\S]*?duration: '([^']*)'/)?.[1];
    const gentleReset = routinesCatalogSource.match(/id: 'gentle-reset',[\s\S]*?duration: '([^']*)'/)?.[1];
    const windDown = routinesCatalogSource.match(/id: 'wind-down',[\s\S]*?duration: '([^']*)'/)?.[1];
    expect(introductionSource).toMatch(new RegExp(`subtitle: '.*${riseReset}.*'`));
    expect(introductionSource).toMatch(new RegExp(`subtitle: '.*${gentleReset}.*'`));
    expect(introductionSource).toMatch(new RegExp(`subtitle: '.*${windDown}.*'`));
  });

  it('Circadian Colors: each card reuses an existing design token (dawn-gold morning-accent, mint tertiary, lavender evening-accent) - never a new invented hex value', () => {
    expect(introductionSource).toMatch(/iconClass: 'bg-morning-accent\/15 text-morning-accent'/);
    expect(introductionSource).toMatch(/subtitleClass: 'text-morning-accent'/);
    expect(introductionSource).toMatch(/iconClass: 'bg-tertiary\/15 text-tertiary'/);
    expect(introductionSource).toMatch(/subtitleClass: 'text-tertiary'/);
    expect(introductionSource).toMatch(/iconClass: 'bg-evening-accent\/15 text-evening-accent'/);
    expect(introductionSource).toMatch(/subtitleClass: 'text-evening-accent'/);
    // No arbitrary/inline hex color styling (e.g. a Stitch-style
    // style="color: #...") was introduced for the cards themselves.
    expect(introductionSource).not.toMatch(/style=\{\{[^}]*color:\s*['"]#/);
  });

  it('the sleep card restores a real moon icon (bedtime, filled) - not left blank', () => {
    const sleepCard = introductionSource.match(/\{\s*id: 'sleep',[\s\S]*?\n {2}\},?/)?.[0] ?? '';
    expect(sleepCard).toMatch(/icon: 'bedtime'/);
    expect(introductionSource).toMatch(/card\.id === 'sleep' \? \{ fontVariationSettings: "'FILL' 1" \} : undefined/);
  });

  it('every card tap calls persistAndContinue with its own destination path, never a bare navigate', () => {
    expect(introductionSource).toMatch(/onClick=\{\(\) => persistAndContinue\(card\.path\)\}/);
  });

  it('cards are disabled while saving, same re-entrancy guard as Go to Home', () => {
    // One occurrence for the single mapped card template (rendered three
    // times at runtime via WELCOME_CARDS.map, but written once in source)
    // plus one for the Go to Home button.
    const occurrences = introductionSource.match(/disabled=\{saving\}/g) ?? [];
    expect(occurrences.length).toBe(2);
  });
});

describe('Introduction.jsx — optional "Watch introduction" pill, gated on real availability', () => {
  it('only renders when introductionMedia.js\'s own `available` flag for I01 is true', () => {
    expect(introductionSource).toMatch(/const introVideo = INTRODUCTION_MEDIA\.find\(\(guide\) => guide\.id === 'why-wakewise'\);/);
    expect(introductionSource).toMatch(/const introVideoAvailable = Boolean\(introVideo\?\.available\);/);
    expect(introductionSource).toMatch(/\{introVideoAvailable && \(/);
    expect(introductionMediaSource).toMatch(/id: 'why-wakewise',[\s\S]*?available: true/);
  });

  it('its "(1 min)" duration is the video\'s real, verified duration - present in betaVideoManifest.js, not fabricated here', () => {
    expect(introductionSource).toMatch(/Watch introduction \(1 min\) · Why WakeWise works/);
    expect(manifestSource).toMatch(/id: 'I01',[\s\S]*?durationLabel: '1 min'/);
  });

  it('never autoplays - opens via the same shared BetaVideoModal every other private video uses, which always requires its own explicit Play tap', () => {
    expect(introductionSource).toMatch(/onClick=\{\(\) => handleSelect\(introVideo\.storageRef\)\}/);
    expect(introductionSource).toMatch(/\{openVideo && \(\s*\n\s*<BetaVideoModal entry=\{openVideo\} onClose=\{closeVideo\} \/>/);
    expect(introductionSource).not.toMatch(/autoPlay=/);
  });

  it('reuses the existing shared hook/modal/dialog - never a bespoke player', () => {
    expect(introductionSource).toMatch(/import \{ useProtectedVideo \} from '\.\.\/hooks\/useProtectedVideo';/);
    expect(introductionSource).toMatch(/import \{ BetaVideoModal \} from '\.\.\/components\/BetaVideoModal';/);
    expect(introductionSource).toMatch(/import \{ SignInPromptDialog \} from '\.\.\/components\/SignInPromptDialog';/);
    expect(introductionSource).not.toMatch(/<video/);
    expect(introductionSource).not.toMatch(/createSignedUrl|functions\.invoke/);
  });

  it('resolves I01 via getBetaVideoById, not the general Library catalog it is excluded from', () => {
    expect(introductionSource).toMatch(/import \{ getBetaVideoById \} from '\.\.\/lib\/mediaCatalog';/);
    expect(introductionSource).toMatch(/useProtectedVideo\(undefined, getBetaVideoById, GUEST_ALLOWED_VIDEO_IDS\)/);
  });

  it('only one BetaVideoModal is ever mounted', () => {
    const modalOccurrences = introductionSource.match(/<BetaVideoModal/g) ?? [];
    expect(modalOccurrences.length).toBe(1);
  });

  it('a guest tap opens SignInPromptDialog, never a direct video-open', () => {
    expect(introductionSource).toMatch(
      /<SignInPromptDialog\s*\n\s*open=\{promptOpen\}\s*\n\s*onSignIn=\{confirmSignIn\}\s*\n\s*onCreateAccount=\{confirmCreateAccount\}\s*\n\s*onDismiss=\{dismissPrompt\}\s*\n\s*\/>/
    );
  });

  it('watching, starting or closing the video never touches introduction_completed_version - that write path is owned entirely by persistAndContinue', () => {
    const videoRelatedSlice = introductionSource.slice(
      introductionSource.indexOf('useProtectedVideo('),
      introductionSource.indexOf('const continueTo')
    );
    expect(videoRelatedSlice).not.toMatch(/introduction_completed_version/);
  });
});

describe('Introduction.jsx — persistAndContinue is parameterised by destination, one persistence decision for every action', () => {
  it('defaults to Home (\'/\') when no destination is given', () => {
    expect(introductionSource).toMatch(/const persistAndContinue = async \(path = '\/'\) => \{/);
  });

  it('Go to Home explicitly passes \'/\'', () => {
    expect(introductionSource).toMatch(/onClick=\{\(\) => persistAndContinue\('\/'\)\}/);
  });

  it('does not write any local-only "onboarding complete" flag - persistence is server-side only', () => {
    expect(introductionSource).not.toMatch(/localStorage\.setItem/);
    expect(introductionSource).not.toMatch(/onboarding_complete|onboardingComplete|tutorial_seen|onboarding_seen/i);
  });

  it('goes straight from the version update to setSaving(false) - no cached-profile refresh in between', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(path = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const updateCallIndex = body.indexOf('.update({');
    const setSavingFalseIndex = body.indexOf('setSaving(false);', updateCallIndex);
    const between = body.slice(updateCallIndex, setSavingFalseIndex);
    expect(between).not.toMatch(/refreshProfile/);
  });
});

describe('Introduction.jsx — guest behaviour is explicit: no Supabase write is ever attempted for a guest', () => {
  it('persistAndContinue short-circuits to continueTo(path) for a guest/missing user, before touching supabase at all', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(path = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const guestGuardIndex = body.indexOf('if (isGuest || !user || !supabase)');
    expect(guestGuardIndex).toBeGreaterThanOrEqual(0);
    expect(body.slice(0, guestGuardIndex)).not.toMatch(/supabase/);
    expect(body).toMatch(/if \(isGuest \|\| !user \|\| !supabase\) \{\s*\n\s*continueTo\(path\);/);
  });
});

describe('Introduction.jsx — profile-row race handling reuses the existing ensure-profile mechanism', () => {
  it('calls refreshProfile() (AuthContext\'s own existing safe upsert-then-reselect) when the row is missing, never a separate/partial profile-creation implementation', () => {
    expect(introductionSource).toMatch(/import \{ useAuth \} from '\.\.\/context\/AuthContext';/);
    expect(introductionSource).toMatch(/const \{ user, isGuest, profile, refreshProfile \} = useAuth\(\);/);
    const body = introductionSource.match(/const persistAndContinue = async \(path = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!profileRow\) \{\s*\n\s*await refreshProfile\(\);/);
    expect(body).not.toMatch(/\.insert\(/);
    expect(body).not.toMatch(/first_name|last_name/);
  });
});

describe('Introduction.jsx — confirms exactly one row updated, never treats a zero-row update as success', () => {
  it('checks updatedRows.length === 1 before continuing', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(path = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/\.update\(\{ introduction_completed_version: CURRENT_INTRODUCTION_VERSION \}\)/);
    expect(body).toMatch(/if \(updateError \|\| !updatedRows \|\| updatedRows\.length !== 1\) \{/);
  });

  it('only navigates after confirmed persistence - continueTo is not called before the update check resolves', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(path = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const updateCallIndex = body.indexOf('.update({');
    const finalContinueIndex = body.lastIndexOf('continueTo(path);');
    expect(finalContinueIndex).toBeGreaterThan(updateCallIndex);
  });
});

describe('Introduction.jsx — replay never resets or lowers an already-saved version', () => {
  it('short-circuits to the chosen destination without writing anything when the account is already at/above CURRENT_INTRODUCTION_VERSION', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(path = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(
      /if \(\(profileRow\.introduction_completed_version \?\? 0\) >= CURRENT_INTRODUCTION_VERSION\) \{\s*\n\s*setSaving\(false\);\s*\n\s*continueTo\(path\);\s*\n\s*return;\s*\n\s*\}/
    );
  });
});

describe('Introduction.jsx — prevents repeated clicks while saving, and shows a friendly retryable error on failure', () => {
  it('guards re-entrancy with a saving flag', () => {
    expect(introductionSource).toMatch(/if \(saving\) return; \/\/ prevent repeated clicks while saving/);
  });

  it('shows a non-technical, retryable error message on any failure - never silently pretends success', () => {
    const occurrences = introductionSource.match(/setSaveError\("We couldn't save that\. Please try again\."\);/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3); // read error, missing-row retry failure, update failure
    expect(introductionSource).toMatch(/role="alert"[\s\S]{0,120}\{saveError\}/);
  });

  it('remains on the Introduction screen on failure - no navigate/continueTo call inside any error branch', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(path = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
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
    expect(introductionSource).toMatch(/<h1 className="[^"]*">/);
    expect(introductionSource).toMatch(/<h2 id="welcome-cards-heading"/);
    expect(introductionSource).toMatch(/aria-labelledby="welcome-cards-heading"/);
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

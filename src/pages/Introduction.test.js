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
    // Remove Routines from the Visible User Flow: cards no longer carry a
    // `path` at all (Morning needs real Session Engine initialization,
    // not a bare navigate) - see CARD_DESTINATIONS below.
    expect(introductionSource).toMatch(/id: 'morning',[\s\S]*?requiresAuth: true/);
    expect(introductionSource).toMatch(/id: 'calm',[\s\S]*?requiresAuth: false/);
    expect(introductionSource).toMatch(/id: 'sleep',[\s\S]*?requiresAuth: true/);
  });

  it('both variants complete version 2 the same way - persistAndContinue is not itself variant-dependent, and delegates the real write to the one shared completeIntroductionVersion (see introductionCompletion.test.js for its own real-execution coverage)', () => {
    const persistFnDeclarations = introductionSource.match(/^ {2}const persistAndContinue = /gm) ?? [];
    expect(persistFnDeclarations.length).toBe(1);
    expect(introductionSource).toMatch(/import \{ completeIntroductionVersion \} from '\.\.\/lib\/introductionCompletion';/);
    expect(introductionSource).toMatch(/completeIntroductionVersion\(\{ supabase, userId: user\.id, refreshProfile \}\)/);
  });
});

describe('Introduction.jsx — three tappable destination cards', () => {
  it('has exactly the three required card titles', () => {
    expect(introductionSource).toMatch(/title: 'Start my morning'/);
    expect(introductionSource).toMatch(/title: 'Take a calming pause'/);
    expect(introductionSource).toMatch(/title: 'Wind down for sleep'/);
  });

  it('each card routes directly to a real canonical entry point, traced from Home.jsx\'s own Morning/Evening handlers and RoutineDetail.jsx\'s Gentle Reset handling - not through the (now unrouted) Routines Hub, not an invented destination', () => {
    // CARD_DESTINATIONS resolves 'morning' to the real beginRiseAndReset
    // (Session-Engine-initializing, same as Home.jsx's own
    // handleBeginRiseAndReset), 'calm' to a plain navigate to Gentle
    // Reset's real non-standalone route, and 'sleep' to a plain navigate
    // to Evening Wind-Down's real intro route (same as Home.jsx's own
    // handleBeginEveningWindDown - EveningWindDown.jsx's own Begin button
    // starts the session, not this navigate).
    expect(introductionSource).toMatch(
      /const CARD_DESTINATIONS = \{\s*\n\s*morning: beginRiseAndReset,\s*\n\s*calm: \(\) => navigate\('\/quiet-breathing'\),\s*\n\s*sleep: \(\) => navigate\('\/evening-wind-down'\)\s*\n\s*\};/
    );
    // beginRiseAndReset itself mirrors Home.jsx's own
    // handleBeginRiseAndReset / RoutineDetail.jsx's own beginRiseAndReset
    // exactly: reset-before-start guard, then start fresh at Step 1.
    const beginBody = introductionSource.match(/const beginRiseAndReset = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(beginBody).toMatch(/if \(state\.status === 'playing' \|\| state\.status === 'interrupted'\) \{\s*\n\s*resetSession\(\);\s*\n\s*\}/);
    expect(beginBody).toMatch(/startSession\('morning-routine', \{ startIndex: getStepIndex\('morning-routine', MORNING_STEP_IDS\.INTENTION\) \}\);/);
    expect(beginBody).toMatch(/navigate\('\/intention-setup'\);/);
    // Still the same real routines this app actually has - Gentle Reset's
    // and Wind-Down's own catalogue entries are unaffected/unmodified.
    expect(routinesCatalogSource).toMatch(/id: 'rise-reset'/);
    expect(routinesCatalogSource).toMatch(/id: 'gentle-reset'/);
    expect(routinesCatalogSource).toMatch(/id: 'wind-down'/);
  });

  it('"Take a calming pause" opens Gentle Reset (real guided breathing) directly, never "Instant Calm" (a narrated exercise video, not a breathing practice)', () => {
    expect(introductionSource).toMatch(/calm: \(\) => navigate\('\/quiet-breathing'\)/);
    // Comments legitimately name "Instant Calm" in prose explaining what
    // this card deliberately does NOT open - only the real code matters here.
    const codeOnly = introductionSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/Instant Calm/);
    // Gentle Reset's own catalogue description confirms it is genuinely
    // guided breathing, not music-only - the destination this card's
    // copy is accountable to.
    const gentleResetDetail = routinesCatalogSource.match(/id: 'gentle-reset',[\s\S]*?description: '([^']*)'/);
    expect(gentleResetDetail?.[1]).toMatch(/breathing/i);
    // requiresAuth: false, matching Gentle Reset's own real
    // routinesCatalog.js/RoutineDetail.jsx gate - a guest reaches it
    // directly, never a sign-in prompt.
    const calmCard = introductionSource.match(/\{\s*id: 'calm',[\s\S]*?\n {2}\},/)?.[0] ?? '';
    expect(calmCard).toMatch(/requiresAuth: false/);
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

  it('every card tap calls handleCardTap, never a bare navigate or a direct persistAndContinue call that could skip the guest gate', () => {
    expect(introductionSource).toMatch(/onClick=\{\(\) => handleCardTap\(card\)\}/);
  });

  it('handleCardTap gates requiresAuth cards behind the guest sign-in prompt (remembering which card via pendingCardId), and only ever reaches persistAndContinue (never a bare navigate) once that gate is cleared', () => {
    const body = introductionSource.match(/const handleCardTap = \(card\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(card\.requiresAuth && isGuest\) \{\s*\n\s*setPendingCardId\(card\.id\);\s*\n\s*setRoutineSignInPromptOpen\(true\);\s*\n\s*return;\s*\n\s*\}/);
    expect(body).toMatch(/persistAndContinue\(CARD_DESTINATIONS\[card\.id\]\);/);
  });

  it('an already-authenticated user (isGuest false) tapping a requiresAuth card starts the journey directly - the guard is `requiresAuth && isGuest`, so a non-guest always falls straight through to the single persistAndContinue call below it, never opening the sign-in prompt, never a second/duplicated start call', () => {
    const body = introductionSource.match(/const handleCardTap = \(card\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const guardIndex = body.indexOf('if (card.requiresAuth && isGuest)');
    const persistIndex = body.indexOf('persistAndContinue(CARD_DESTINATIONS[card.id]);');
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(persistIndex).toBeGreaterThan(guardIndex);
    // Exactly one call site for persistAndContinue inside this function -
    // a signed-in user's tap can never trigger it twice.
    const persistCalls = body.match(/persistAndContinue\(/g) ?? [];
    expect(persistCalls.length).toBe(1);
  });

  it('a guest tap on a requiresAuth card opens the same SignInPromptDialog Home.jsx\'s own promptRoutineSignIn uses, but stashes a real pendingJourneyIntent (the tapped card\'s own id) rather than pendingContent\'s returnPath: \'/\' - this is the fix that lets sign-in continue straight into the selected journey (see the "authentication continuity" describe block below)', () => {
    expect(introductionSource).toMatch(/const confirmRoutineSignIn = \(\) => \{\s*\n\s*setPendingJourneyIntent\(pendingCardId\);\s*\n\s*setRoutineSignInPromptOpen\(false\);\s*\n\s*navigate\('\/auth'\);\s*\n\s*\};/);
    expect(introductionSource).toMatch(/const confirmRoutineCreateAccount = \(\) => \{\s*\n\s*setPendingJourneyIntent\(pendingCardId\);\s*\n\s*setRoutineSignInPromptOpen\(false\);\s*\n\s*navigate\('\/auth\?tab=signup'\);\s*\n\s*\};/);
    expect(introductionSource).toMatch(
      /<SignInPromptDialog\s*\n\s*open=\{routineSignInPromptOpen\}\s*\n\s*onSignIn=\{confirmRoutineSignIn\}\s*\n\s*onCreateAccount=\{confirmRoutineCreateAccount\}\s*\n\s*onDismiss=\{dismissRoutineSignInPrompt\}\s*\n\s*\/>/
    );
  });

  it('cancelling the sign-in prompt (dismissRoutineSignInPrompt) never stashes a pending journey intent - setPendingJourneyIntent is called only from the two confirm handlers, never from the dismiss path', () => {
    expect(introductionSource).toMatch(/const dismissRoutineSignInPrompt = \(\) => setRoutineSignInPromptOpen\(false\);/);
    const dismissLine = introductionSource.match(/const dismissRoutineSignInPrompt = \(\) => setRoutineSignInPromptOpen\(false\);/)?.[0] ?? '';
    expect(dismissLine).not.toMatch(/setPendingJourneyIntent/);
  });

  it('Gentle Reset (requiresAuth: false) never triggers the guest gate - a guest reaches persistAndContinue directly, same as any other card once past the gate', () => {
    // handleCardTap's guard is `card.requiresAuth && isGuest` - false for
    // the calm card regardless of isGuest, so execution always falls
    // through to persistAndContinue for it.
    const calmCard = introductionSource.match(/\{\s*id: 'calm',[\s\S]*?\n {2}\},/)?.[0] ?? '';
    expect(calmCard).toMatch(/requiresAuth: false/);
  });

  it('cards are disabled while saving, same re-entrancy guard as Go to Home', () => {
    // One occurrence for the single mapped card template (rendered three
    // times at runtime via WELCOME_CARDS.map, but written once in source)
    // plus one for the Go to Home button.
    const occurrences = introductionSource.match(/disabled=\{saving\}/g) ?? [];
    expect(occurrences.length).toBe(2);
  });
});

describe('Introduction.jsx — Remove Routines from the Visible User Flow: real Session Engine wiring, not a guess', () => {
  it('imports the exact same Session Engine primitives Home.jsx/RoutineDetail.jsx already use for this exact action - useSession, getStepIndex, MORNING_STEP_IDS', () => {
    expect(introductionSource).toMatch(/import \{ useSession \} from '\.\.\/context\/SessionContext';/);
    expect(introductionSource).toMatch(/import \{ getStepIndex \} from '\.\.\/session\/sessionRegistry';/);
    expect(introductionSource).toMatch(/import \{ MORNING_STEP_IDS \} from '\.\.\/session\/sessionConstants';/);
    expect(introductionSource).toMatch(/const \{ state, startSession, resetSession \} = useSession\(\);/);
  });

  it('imports the fixed-allowlist journey-intent module, never the media pendingContent module, for the Morning/Evening guest gate', () => {
    expect(introductionSource).toMatch(/import \{ setPendingJourneyIntent, isAllowedJourneyAction \} from '\.\.\/lib\/pendingJourneyIntent';/);
    expect(introductionSource).not.toMatch(/from '\.\.\/lib\/pendingContent'/);
  });
});

describe('Introduction.jsx — Morning/Evening authentication continuity: the resume mechanism', () => {
  it('resumeAction is captured ONCE via a lazy useState initializer, validated against the fixed allowlist - never trusted from the URL unchecked', () => {
    expect(introductionSource).toMatch(
      /const \[resumeAction\] = useState\(\(\) => \{\s*\n\s*const action = searchParams\.get\('resume'\);\s*\n\s*return isAllowedJourneyAction\(action\) \? action : null;\s*\n\s*\}\);/
    );
  });

  it('a dedicated effect strips the `resume` marker from the URL immediately, mirroring AnytimeReset.jsx\'s own restore-param strip pattern - it can never re-trigger on Back/forward/reload', () => {
    expect(introductionSource).toMatch(
      /useEffect\(\(\) => \{\s*\n\s*if \(!searchParams\.get\('resume'\)\) return;\s*\n\s*const next = new URLSearchParams\(searchParams\);\s*\n\s*next\.delete\('resume'\);\s*\n\s*setSearchParams\(next, \{ replace: true \}\);/
    );
  });

  it('the trigger effect fires at most once (hasResumedRef), only once auth has finished loading and the user is genuinely not a guest, and calls the real persistAndContinue with the real CARD_DESTINATIONS lookup - the exact same call a genuine tap would make, never a second/parallel start path', () => {
    expect(introductionSource).toMatch(/const hasResumedRef = useRef\(false\);/);
    const body = introductionSource.match(/useEffect\(\(\) => \{\s*\n\s*if \(!resumeAction \|\| authLoading \|\| isGuest \|\| hasResumedRef\.current\) return;[\s\S]*?\}, \[resumeAction, authLoading, isGuest\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/hasResumedRef\.current = true;/);
    expect(body).toMatch(/persistAndContinue\(CARD_DESTINATIONS\[resumeAction\]\);/);
  });

  it('authLoading comes from AuthContext itself (aliased from its own `loading`), not a locally-invented flag - the effect can correctly re-evaluate once the post-redirect session fetch resolves', () => {
    expect(introductionSource).toMatch(/const \{ user, isGuest, profile, refreshProfile, loading: authLoading \} = useAuth\(\);/);
  });

  it('the guard order checks resumeAction/authLoading/isGuest BEFORE hasResumedRef - a guest can never cause the ref to latch true and permanently block a later, genuine resume once they actually finish signing in', () => {
    const body = introductionSource.match(/if \(!resumeAction \|\| authLoading \|\| isGuest \|\| hasResumedRef\.current\) return;/)?.[0] ?? '';
    expect(body).not.toBe('');
  });
});

describe('Introduction.jsx — optional "Watch introduction" pill, gated on real availability', () => {
  it('only renders when introductionMedia.js\'s own `available` flag for I01 is true', () => {
    expect(introductionSource).toMatch(/const introVideo = INTRODUCTION_MEDIA\.find\(\(guide\) => guide\.id === 'why-wakewise'\);/);
    expect(introductionSource).toMatch(/const introVideoAvailable = Boolean\(introVideo\?\.available\);/);
    expect(introductionSource).toMatch(/\{introVideoAvailable && \(/);
    expect(introductionMediaSource).toMatch(/id: 'why-wakewise',[\s\S]*?available: true/);
  });

  it('its "1 min" duration is the video\'s real, verified duration - present in betaVideoManifest.js, not fabricated here (connection-copy fix: pill text is now "See how WakeWise can help · 1 min", replacing the old product-focused "Watch introduction (1 min) · Why WakeWise works")', () => {
    expect(introductionSource).toMatch(/See how WakeWise can help · 1 min/);
    expect(introductionSource).not.toMatch(/Watch introduction \(1 min\) · Why WakeWise works/);
    expect(manifestSource).toMatch(/id: 'I01',[\s\S]*?durationLabel: '1 min'/);
  });

  it('carries an explicit accessible label matching the required copy exactly - the pill\'s own play_circle icon is aria-hidden, so this label is the button\'s real accessible name', () => {
    expect(introductionSource).toMatch(/aria-label="Play one-minute introduction: See how WakeWise can help\."/);
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
    expect(introductionSource).toMatch(/const persistAndContinue = async \(destination = '\/'\) => \{/);
  });

  it('Go to Home explicitly passes \'/\'', () => {
    expect(introductionSource).toMatch(/onClick=\{\(\) => persistAndContinue\('\/'\)\}/);
  });

  it('does not write any local-only "onboarding complete" flag - persistence is server-side only', () => {
    expect(introductionSource).not.toMatch(/localStorage\.setItem/);
    expect(introductionSource).not.toMatch(/onboarding_complete|onboardingComplete|tutorial_seen|onboarding_seen/i);
  });
});

describe('Introduction.jsx — guest behaviour is explicit: no Supabase write is ever attempted for a guest', () => {
  it('persistAndContinue short-circuits to continueTo(destination) for a guest/missing user, before ever calling completeIntroductionVersion', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(destination = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const guestGuardIndex = body.indexOf('if (isGuest || !user || !supabase)');
    expect(guestGuardIndex).toBeGreaterThanOrEqual(0);
    expect(body.slice(0, guestGuardIndex)).not.toMatch(/completeIntroductionVersion/);
    expect(body).toMatch(/if \(isGuest \|\| !user \|\| !supabase\) \{\s*\n\s*continueTo\(destination\);/);
  });
});

describe('Introduction.jsx — the real Supabase persistence logic lives in one shared place, not duplicated here', () => {
  it('refreshProfile is still threaded through from AuthContext into completeIntroductionVersion\'s own call - the profile-row race handling (see introductionCompletion.test.js) still gets the same real ensure-profile mechanism', () => {
    expect(introductionSource).toMatch(/import \{ useAuth \} from '\.\.\/context\/AuthContext';/);
    expect(introductionSource).toMatch(/const \{ user, isGuest, profile, refreshProfile, loading: authLoading \} = useAuth\(\);/);
    expect(introductionSource).toMatch(/completeIntroductionVersion\(\{ supabase, userId: user\.id, refreshProfile \}\)/);
  });

  it('persistAndContinue itself contains no raw Supabase read/update calls for introduction_completed_version - that logic was extracted, never duplicated', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(destination = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/\.update\(\{ introduction_completed_version/);
    expect(body).not.toMatch(/\.select\('introduction_completed_version'\)/);
    expect(body).not.toMatch(/\.insert\(/);
  });
});

describe('Introduction.jsx — result handling around the shared completeIntroductionVersion call', () => {
  it('shows a retryable error and stays on screen when the result is not ok, never continuing', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(destination = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!result\.ok\) \{\s*\n\s*setSaveError\("We couldn't save that\. Please try again\."\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('only calls continueTo after a genuinely ok result - never before completeIntroductionVersion resolves', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(destination = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const callIndex = body.indexOf('completeIntroductionVersion(');
    const finalContinueIndex = body.lastIndexOf('continueTo(destination);');
    expect(finalContinueIndex).toBeGreaterThan(callIndex);
  });
});

describe('Introduction.jsx — prevents repeated clicks while saving, and shows a friendly retryable error on failure', () => {
  it('guards re-entrancy with a saving flag, and clears it before checking the result either way', () => {
    expect(introductionSource).toMatch(/if \(saving\) return; \/\/ prevent repeated clicks while saving/);
    const body = introductionSource.match(/const persistAndContinue = async \(destination = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const callIndex = body.indexOf('completeIntroductionVersion(');
    const setSavingFalseIndex = body.indexOf('setSaving(false);', callIndex);
    expect(setSavingFalseIndex).toBeGreaterThan(callIndex);
  });

  it('shows a non-technical, retryable error message on failure - never silently pretends success', () => {
    expect(introductionSource).toMatch(/setSaveError\("We couldn't save that\. Please try again\."\);/);
    expect(introductionSource).toMatch(/role="alert"[\s\S]{0,120}\{saveError\}/);
  });

  it('remains on the Introduction screen on failure - no navigate/continueTo call inside the error branch', () => {
    const body = introductionSource.match(/const persistAndContinue = async \(destination = '\/'\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const errorBranch = body.match(/if \(!result\.ok\) \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(errorBranch).not.toBe('');
    expect(errorBranch).not.toMatch(/continueTo|navigate\(/);
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

describe('Journey Embedding — Welcome card optional-meditation context, accessible-only (no new visible line, no crowding)', () => {
  it('Morning and Evening cards each carry a `note` naming the 2/5/10-minute optional addition - Calming Pause does not (no meditation involved)', () => {
    const morningCard = introductionSource.match(/\{\s*id: 'morning',[\s\S]*?\n {2}\},/)?.[0] ?? '';
    const sleepCard = introductionSource.match(/\{\s*id: 'sleep',[\s\S]*?\n {2}\}/)?.[0] ?? '';
    const calmCard = introductionSource.match(/\{\s*id: 'calm',[\s\S]*?\n {2}\},/)?.[0] ?? '';
    expect(morningCard).toMatch(/note: 'Meditation is optional and can add 2, 5 or 10 minutes\.'/);
    expect(sleepCard).toMatch(/note: 'Meditation is optional and can add 2, 5 or 10 minutes\.'/);
    expect(calmCard).not.toMatch(/note:/);
  });

  it('the note is folded into an explicit aria-label on the card button - not a third visible text line', () => {
    expect(introductionSource).toMatch(/aria-label=\{card\.note \? `\$\{card\.title\}\. \$\{card\.subtitle\}\. \$\{card\.note\}` : undefined\}/);
    // Still exactly one title span and one subtitle span per card - no new
    // <span> was added for the note.
    expect(introductionSource).toMatch(/<span className="block text-base font-bold text-on-surface">\{card\.title\}<\/span>/);
    expect(introductionSource).toMatch(/<span className=\{`block text-xs font-medium \$\{card\.subtitleClass\}`\}>\{card\.subtitle\}<\/span>/);
  });

  it('Welcome subtitles use "From" wording, never a flat number that a 10-minute meditation choice would make inaccurate', () => {
    expect(introductionSource).toMatch(/subtitle: 'Rise & Reset · From 5 min'/);
    expect(introductionSource).toMatch(/subtitle: 'Begin Wind-Down · From 10 min'/);
  });
});

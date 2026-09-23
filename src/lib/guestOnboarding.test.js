// Regression guard for WakeWise Guest Onboarding (DEV-only). No DOM/
// component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - these are source-level checks,
// matching every other regression guard in this codebase for exactly
// that reason. Pure-logic pieces (the persisted guest-entry flag itself,
// and the open-redirect guard) are unit-tested directly in
// guestEntry.test.js and pendingContent.test.js instead.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const onboardingGateSource = read('../components/OnboardingGate.jsx');
const welcomeSource = read('../pages/Welcome.jsx');
const appSource = read('../App.jsx');
const authContextSource = read('../context/AuthContext.jsx');
const authPageSource = read('../pages/Auth.jsx');
const homeSource = read('../pages/Home.jsx');
const journalSource = read('../pages/Journal.jsx');
const routineDetailSource = read('../pages/RoutineDetail.jsx');
const profileSource = read('../pages/Profile.jsx');
const useProtectedVideoSource = read('../hooks/useProtectedVideo.js');
const subscriptionSource = read('../pages/Subscription.jsx');
const signInPromptDialogSource = read('../components/SignInPromptDialog.jsx');

describe('First unauthenticated launch shows the Welcome screen', () => {
  it('OnboardingGate requires no user AND no persisted guest choice AND a non-allowlisted path before showing Welcome', () => {
    expect(onboardingGateSource).toMatch(/const needsWelcome = !user && !guestEntryChosen && !isAllowedPreEntryPath;/);
  });

  it('shows a loading screen (never Welcome) while the auth session is still resolving, matching AdminRoute.jsx\'s own pattern', () => {
    expect(onboardingGateSource).toMatch(/if \(loading\) \{/);
    expect(onboardingGateSource).toMatch(/Loading…/);
  });

  it('is mounted around the whole <Routes> tree in App.jsx', () => {
    expect(appSource).toMatch(/<OnboardingGate>\s*\n\s*<Routes>/);
    expect(appSource).toMatch(/<\/Routes>\s*\n\s*<\/OnboardingGate>/);
  });

  it('Welcome offers exactly the three required actions with the required explanatory copy', () => {
    expect(welcomeSource).toMatch(/Create Free Account/);
    expect(welcomeSource).toMatch(/>\s*Sign In\s*</);
    expect(welcomeSource).toMatch(/Continue as Guest/);
    expect(welcomeSource).toMatch(/browse/i);
    expect(welcomeSource).toMatch(/play audio or video/i);
  });

  it('Welcome never auto-navigates to /auth on its own - only an explicit tap does', () => {
    const bodyOutsideHandlers = welcomeSource.replace(/onClick=\{[^}]*\}/g, '');
    expect(bodyOutsideHandlers).not.toMatch(/navigate\(/);
  });
});

describe('"Continue as Guest" persistence and returning-user behaviour', () => {
  it('OnboardingGate seeds its state from hasChosenGuestEntry() and marks it on Continue as Guest', () => {
    expect(onboardingGateSource).toMatch(/useState\(hasChosenGuestEntry\)/);
    expect(onboardingGateSource).toMatch(/markGuestEntryChosen\(\);/);
    expect(onboardingGateSource).toMatch(/setGuestEntryChosen\(true\);/);
  });

  it('an authenticated user (a truthy `user`) always bypasses Welcome, regardless of the guest flag', () => {
    // needsWelcome's own `!user &&` short-circuit already covers this;
    // this test locks in that the check is on `user` from useAuth(), not
    // some other proxy that could drift out of sync.
    expect(onboardingGateSource).toMatch(/const \{ user, loading \} = useAuth\(\);/);
  });

  it('sign-out clears the persisted guest-entry choice, so it returns to Welcome next time - never silently restoring the previous decision', () => {
    expect(authContextSource).toMatch(/import \{ clearGuestEntryChoice \} from '\.\.\/lib\/guestEntry';/);
    expect(authContextSource).toMatch(/const signOut = async \(\) => \{\s*\n\s*clearAllRoutineProgress\(\);\s*\n\s*clearGuestEntryChoice\(\);/);
  });

  it('the alternate "Continue as guest" link on the Auth page persists the same flag as Welcome\'s own button', () => {
    expect(authPageSource).toMatch(/import \{ markGuestEntryChosen \} from '\.\.\/lib\/guestEntry';/);
    expect(authPageSource).toMatch(/onClick=\{markGuestEntryChosen\}/);
  });
});

describe('Guests can still browse catalogue screens - no new per-route guard added', () => {
  it('Home/Routines/Library/Profile routes are unchanged plain routes, not wrapped in any new guard component', () => {
    expect(appSource).toMatch(/<Route index element=\{withFallback\(<Home \/>\)\} \/>/);
    expect(appSource).toMatch(/<Route path="routines" element=\{withFallback\(<Routines \/>\)\} \/>/);
    expect(appSource).toMatch(/<Route path="library" element=\{withFallback\(<Library \/>\)\} \/>/);
    expect(appSource).toMatch(/<Route path="profile" element=\{withFallback\(<Profile \/>\)\} \/>/);
  });

  it('Profile.jsx already shows a distinct guest identity ("Guest Profile" / "Local Mode") rather than hiding the screen', () => {
    expect(profileSource).toMatch(/Guest Profile/);
    expect(profileSource).toMatch(/Local Mode/);
  });

  it('Profile\'s own Create Account action goes to the sign-up tab specifically, distinct from Sign In', () => {
    expect(profileSource).toMatch(/to="\/auth\?tab=signup"[\s\S]{0,300}Create Account/);
  });
});

describe('Every audio/video entry point invokes the same authentication gate (useProtectedVideo)', () => {
  // Morning-flow redesign: Affirmation.jsx and IntentionSetup.jsx no longer
  // show any guided-video rows at all (removed per the approved redesign -
  // see mediaCatalog.js's own MORNING-FLOW REDESIGN REACHABILITY UPDATE
  // comment), so useProtectedVideo is no longer imported by either.
  // MorningStart.jsx is deleted entirely (the former /morning-start
  // video-selection screen is removed from the routine).
  //
  // Phase 3 (Reflection/Gratitude tap-first redesign): Reflection.jsx no
  // longer imports useProtectedVideo directly - per-question guidance
  // moved into PromptStepper.jsx, which now owns the single
  // useProtectedVideo instance shared by every Reflection AND Gratitude
  // question (Gratitude gained guidance for the first time this phase).
  // Both pages are still gated end-to-end; the import just moved one
  // level down into their shared component - see the dedicated check
  // below.
  const VIDEO_GATED_PAGES = [
    '../pages/Breathe.jsx',
    '../pages/Grounding.jsx',
    '../pages/Library.jsx',
    '../pages/Meditate.jsx',
    '../pages/MorningFlow.jsx',
    '../pages/PrepareForRest.jsx',
    '../pages/Support.jsx'
  ];

  it('useProtectedVideo only intercepts the guest path - an authenticated tap still opens the player exactly as before', () => {
    expect(useProtectedVideoSource).toMatch(/if \(isGuest\) \{\s*\n\s*setPromptId\(id\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*setOpenVideoId\(id\);/);
  });

  it('every known video/sleep-sound page imports useProtectedVideo - no page was left ungated', () => {
    for (const page of VIDEO_GATED_PAGES) {
      expect(read(page)).toMatch(/useProtectedVideo/);
    }
  });

  it('Reflection.jsx/Gratitude.jsx no longer import useProtectedVideo directly - PromptStepper.jsx (their shared component) is the single owner instead', () => {
    expect(read('../pages/Reflection.jsx')).not.toMatch(/useProtectedVideo/);
    expect(read('../pages/Gratitude.jsx')).not.toMatch(/useProtectedVideo/);
    expect(read('../components/evening/PromptStepper.jsx')).toMatch(/useProtectedVideo/);
  });
});

describe('Guests cannot create saved routine/subscription data - every launch point checks isGuest before touching real state', () => {
  it('Home.jsx gates every routine-starting/resuming/resetting action behind isGuest', () => {
    expect(homeSource).toMatch(/const \{ profile, user, isGuest \} = useAuth\(\);/);
    expect(homeSource).toMatch(/const handleMorningAction = \(\) => \{\s*\n\s*if \(isGuest\) \{ promptRoutineSignIn\(\); return; \}/);
    expect(homeSource).toMatch(/const handleEveningAction = \(\) => \{\s*\n\s*if \(isGuest\) \{ promptRoutineSignIn\(\); return; \}/);
    expect(homeSource).toMatch(/const handleResumeStaleMorning = \(\) => \{\s*\n\s*if \(isGuest\) \{ promptRoutineSignIn\(\); return; \}/);
    expect(homeSource).toMatch(/const handleResumeStaleEvening = \(\) => \{\s*\n\s*if \(isGuest\) \{ promptRoutineSignIn\(\); return; \}/);
    expect(homeSource).toMatch(/const handleConfirmDialog = \(\) => \{\s*\n\s*if \(!activeDialog\) return;\s*\n\s*if \(isGuest\) \{/);
  });

  it('RoutineDetail.jsx now requires auth for Wind-Down too (previously guest-open), routed to a plain navigation rather than the Rise & Reset-specific starter', () => {
    const windDownBlock = routineDetailSource.match(/'wind-down': \{[\s\S]*?\n {2}\},?/)?.[0] ?? '';
    expect(windDownBlock).toMatch(/requiresAuth: true/);
    expect(routineDetailSource).toMatch(/if \(routineId === 'rise-reset'\) \{\s*\n\s*beginRiseAndReset\(\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*navigate\(detail\.startRoute\);/);
  });

  it('Journal.jsx no longer writes a guest entry to localStorage - it opens the sign-in prompt instead', () => {
    expect(journalSource).toMatch(/if \(isGuest\) \{\s*\n\s*setShowSignInPrompt\(true\);\s*\n\s*return;\s*\n\s*\}/);
    expect(journalSource).not.toMatch(/localStorage\.setItem\(JOURNAL_KEY/);
  });

  it('Subscription.jsx already gates both the Apple purchase and the upgrade/checkout entry points behind isGuest (pre-existing, unaffected by this change)', () => {
    expect(subscriptionSource).toMatch(/const handleApplePurchase = async \(\) => \{\s*\n\s*if \(isGuest\) \{/);
    expect(subscriptionSource).toMatch(/const handleUpgradeClick = \(\) => \{\s*\n\s*if \(isGuest\) \{/);
  });
});

describe('Sign In/Create Account retains a safe intended destination', () => {
  it('Home.jsx stashes a same-page, id-less pending redirect before navigating to /auth', () => {
    expect(homeSource).toMatch(/setPendingContent\(\{ returnPath: '\/' \}\);/);
  });

  it('Journal.jsx stashes its own returnPath the same way', () => {
    expect(journalSource).toMatch(/setPendingContent\(\{ returnPath: '\/journal' \}\);/);
  });
});

describe('"Continue Browsing" / dismiss never changes the route', () => {
  it('SignInPromptDialog\'s dismiss path is a plain callback prop, never a navigation the dialog performs itself', () => {
    expect(signInPromptDialogSource).not.toMatch(/navigate\(/);
    expect(signInPromptDialogSource).not.toMatch(/useNavigate/);
  });

  it('Home.jsx\'s own dismiss handler only closes the prompt, never navigates', () => {
    expect(homeSource).toMatch(/const dismissRoutineSignInPrompt = \(\) => setRoutineSignInPromptOpen\(false\);/);
  });
});

describe('SignInPromptDialog copy - exact required wording, reused everywhere', () => {
  it('has the exact title, message, and the three required button labels', () => {
    expect(signInPromptDialogSource).toMatch(/Sign in to continue/);
    expect(signInPromptDialogSource).toMatch(/Create a free account or sign in to play this session and save your WakeWise progress\./);
    expect(signInPromptDialogSource).toMatch(/>\s*Sign In\s*</);
    expect(signInPromptDialogSource).toMatch(/Create Free Account/);
    expect(signInPromptDialogSource).toMatch(/Continue Browsing/);
  });
});

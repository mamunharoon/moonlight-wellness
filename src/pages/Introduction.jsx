/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { useAlarm } from '../context/AlarmContext';
import { supabase } from '../lib/supabaseClient';
import { BackButton } from '../components/BackButton';
import { AlarmStatusCard } from '../components/AlarmStatusCard';
import { getFirstName } from '../lib/greeting';
import { INTRODUCTION_MEDIA } from '../lib/introductionMedia';
import { getBetaVideoById } from '../lib/mediaCatalog';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { getStepIndex } from '../session/sessionRegistry';
import { MORNING_STEP_IDS } from '../session/sessionConstants';
import { setPendingJourneyIntent, isAllowedJourneyAction } from '../lib/pendingJourneyIntent';
import { completeIntroductionVersion } from '../lib/introductionCompletion';

/*
 * First-use WakeWise welcome screen (Build 16 redesign).
 *
 * Reached automatically, exactly once per the account/device it applies
 * to, in two cases - both pass `?auto=1` (see isAutomaticFirstUse below):
 *   - a NEW signed-in user sees this immediately after their first
 *     sign-in/sign-up (Auth.jsx's redirectAfterAuth);
 *   - an EXISTING signed-in user whose own
 *     profile.introduction_completed_version is still below
 *     CURRENT_INTRODUCTION_VERSION sees this refreshed Welcome again,
 *     once, the next time they sign in (same redirectAfterAuth check -
 *     "existing" and "new" are not two different code paths, just two
 *     ways of landing at the same "below current version" condition);
 *   - a brand-new GUEST sees it once, the moment they first tap
 *     "Continue as Guest" (OnboardingGate.jsx's one-shot redirect).
 * A returning user already AT CURRENT_INTRODUCTION_VERSION never sees
 * this automatically again - confirmed by shouldShowIntroduction() and
 * OnboardingGate's own one-shot guest flag.
 *
 * Also reachable deliberately, without `?auto=1`, via Profile's existing
 * "About WakeWise" row or Home's existing "Watch: How WakeWise works"
 * pill - a pure replay (persistAndContinue's own "already at/above
 * current version" short-circuit never re-writes or lowers an
 * already-saved version merely because the screen was opened again).
 * Both of those entry points already existed before this redesign; none
 * was added by it.
 *
 * Three tappable cards replace the old static "What you can do" list and
 * two-video guide list - each one is both an explanation AND the actual
 * destination, so a first-time visitor can go straight into whichever
 * part of WakeWise matches what they need right now, never forced to
 * finish reading or watch anything first.
 *
 * Remove Routines from the Visible User Flow — these three cards used to
 * route through the Routines Hub (RoutineDetail.jsx via /routines/:id),
 * now hidden from the visible app. They route directly to the same real,
 * canonical entry points Home.jsx's own Morning/Evening actions and
 * Gentle Reset already use, traced from those exact handlers rather than
 * guessed:
 *   - "Start my morning" -> the same reset-before-start + startSession +
 *     navigate('/intention-setup') sequence as Home.jsx's own
 *     handleBeginRiseAndReset / RoutineDetail.jsx's own beginRiseAndReset
 *     (see beginRiseAndReset below, a direct copy of that exact shape).
 *   - "Take an Anytime Reset" -> navigate('/anytime-reset') directly - the
 *     real, existing Anytime Reset entry point (need -> duration ->
 *     recommendation -> practice), the same three-step wizard Home's own
 *     Anytime surfaces already use. requiresAuth: false - AnytimeReset.jsx
 *     itself already lets a guest walk the whole wizard and only gates
 *     the final Start tap (its own SignInPromptDialog), matching this
 *     card's previous no-gate behaviour exactly; nothing new is guarded
 *     here.
 *     WakeWise DEV — F3 correction: this card previously jumped straight
 *     into /breathe-standalone (QuietBreathing.jsx's standalone pattern
 *     picker), skipping the actual Anytime entry experience entirely -
 *     inconsistent with "Start my morning"/"Wind down for sleep", both of
 *     which open their own real journey's front door rather than one
 *     fixed exercise inside it. Anytime's own front door is
 *     /anytime-reset (need -> duration -> recommendation -> practice);
 *     /breathe-standalone remains fully reachable as before, just no
 *     longer the first thing a first-time visitor sees - Home's own
 *     "Breathe" quick-action tile is unchanged and still opens it
 *     directly, as does Anytime Reset's own recommendation flow for
 *     whichever real practice it resolves to.
 *   - "Wind down for sleep" -> navigate('/evening-wind-down') directly,
 *     the same plain navigate Home.jsx's own handleBeginEveningWindDown
 *     uses (EveningWindDown.jsx's own Begin button is what actually
 *     starts the Session Engine - see that handler's own doc comment for
 *     why no startSession call belongs here).
 * Card copy still states each destination's own real name and the
 * Routines catalogue's own already-established duration
 * (routinesCatalog.js, still present and unmodified), never an invented
 * estimate - only the ROUTING changed, not what each card promises.
 *
 * Morning/Evening authentication continuity (delivery follow-up) — a
 * guest tapping either card must actually continue into that journey
 * once signed in, not just land back on Home needing a second tap. The
 * naive fix (reusing pendingContent.js's id-less shape, returnPath: '/')
 * loses the selection entirely - the user re-arrives at Home and has to
 * pick Morning/Evening again themselves. The real fix is
 * pendingJourneyIntent.js: handleCardTap's guest branch stashes a FIXED,
 * allowlisted action ('morning' | 'sleep', never a caller-supplied
 * URL) via setPendingJourneyIntent before opening the sign-in prompt;
 * confirmRoutineSignIn/confirmRoutineCreateAccount below persist that
 * intent through the /auth round-trip exactly like pendingContent.js
 * already does for media. Auth.jsx's redirectAfterAuth consumes it via
 * resolveJourneyResumeTarget and sends the newly-authenticated user to
 * /introduction?auto=1&resume=<action> - this exact component, which
 * reads `resume` via a lazy initializer (captured once, before the strip
 * effect below clears it from the URL) and, once isGuest has resolved to
 * false, calls persistAndContinue(CARD_DESTINATIONS[resumeAction])
 * itself: the SAME real function a genuine tap would call, so the
 * introduction-version write, the Session Engine initialization
 * (beginRiseAndReset), and the final navigation are all the one true
 * code path, not a second, parallel implementation. hasResumedRef
 * guards against firing twice (React 18 StrictMode's dev-only double-
 * effect-invoke, or a later Back navigation into the same URL after the
 * `resume` param has already been stripped) - matching the same
 * double-tap-protection shape already used elsewhere in this app
 * (Breathe.jsx's hasBegunOnceRef, QuietBreathing.jsx's own).
 *
 * The optional "Watch introduction" pill only renders when
 * introductionMedia.js's own `available` flag for I01 ("Why WakeWise")
 * is true - if a future change ever makes that video unavailable, this
 * pill disappears with it, automatically. Its "(1 min)" duration is the
 * video's real, ffprobe-measured length (~57s), not an estimate. Opens
 * the exact same shared signed-URL mechanism/player every other private
 * video in this app uses (useProtectedVideo + BetaVideoModal +
 * SignInPromptDialog) - a guest tap opens the sign-in prompt instead of
 * ever requesting a signed URL, and BetaVideoModal never autoplays
 * (requires its own explicit Play tap) - never a bespoke player.
 *
 * Start/Skip/every card all call the exact same persistAndContinue
 * function, now parameterised by destination - one persistence decision,
 * not several. Guest behaviour is explicit: a guest (isGuest/no user)
 * never attempts a Supabase write at all, matching "guests may view this
 * screen, but no completion write should be attempted for a guest" -
 * they simply continue to their chosen destination (or Home).
 *
 * Full-bleed, no bottom-nav chrome - same placement as Welcome.jsx/
 * Onboarding.jsx (a focused, single-purpose screen, not part of the
 * tabbed app frame).
 *
 * Back control: shown only for a deliberate replay (reached without
 * `?auto=1`) - there is a real previous screen to return to (Profile,
 * Home). Hidden for an automatic first-use visit (`?auto=1`): the
 * screen immediately before it was either the Auth form (already
 * submitted, nothing to resubmit - see Auth.jsx's own replace:true
 * comment) or Welcome.jsx (no longer mounted once guest entry is
 * chosen) - neither is a real place to go back to, so no Back control is
 * offered rather than one that would behave strangely. Every other
 * action on this screen (the three cards, the Home fallback action)
 * remains fully available either way; only the Back control changes.
 *
 * Personalised opening copy: one component, two copy variants, never a
 * second page. `isReturningSignedInUser` is true only for a signed-in,
 * non-guest user who already had a real, previously-completed
 * introduction_completed_version - a guest (no profile at all) and a
 * genuinely brand-new account (version 0/null) both get the same
 * neutral "Start your morning with purpose. End your day with calm."
 * First Visit copy (approved Stitch design). The signal itself comes from
 * two places, in priority order:
 *   1. the `?existing=1` query param, set by Auth.jsx's redirectAfterAuth
 *      at the one moment it already has this exact data freshly fetched
 *      - avoiding any dependency on AuthContext's own separately-timed
 *      profile fetch, which could still be loading for a just-created
 *      account at this exact instant;
 *   2. AuthContext's own `profile.introduction_completed_version`
 *      (the SAME trusted, already-loaded mechanism Home.jsx's own
 *      greeting already reads via getFirstName/getGreeting) - used for a
 *      deliberate replay (Profile/Home), where no query param exists and
 *      no such race exists either (the profile has been loaded for a
 *      while by the time someone deliberately taps back into this
 *      screen).
 * The first name itself is resolved by the exact same getFirstName()
 * Home.jsx's greeting uses - profiles.first_name first, then
 * user_metadata.first_name, NEVER email - with the exact same neutral
 * "Welcome back" fallback (no dangling comma/placeholder) when no valid
 * name exists. A guest can therefore never see any name here: isGuest
 * alone already forces the neutral variant, before firstName is ever
 * read.
 */
// Build 16 — the one id a guest may open here without signing in, mirroring
// the server's own GUEST_ALLOWED_IDS exactly (see
// supabase/functions/_shared/betaVideoUrlAccess.ts). Module-level so the
// same Set instance is passed to useProtectedVideo on every render.
const GUEST_ALLOWED_VIDEO_IDS = new Set(['I01']);

// Circadian Colors (design refresh): dawn gold for Morning, mint for a
// calming pause, lavender for Evening - each one REUSES an existing
// design token already established elsewhere in this app rather than
// inventing a new color:
//   - morning-accent (--color-gratitude-accent, #fdba74 dawn gold) - already
//     Home.jsx's own Morning pill color, itself a warm gold.
//   - tertiary (--color-tertiary, #7fe4d0) - already used throughout the
//     app, a mint/teal green.
//   - evening-accent (--color-evening-accent, #9fb4f0) - already
//     Home.jsx's own Evening pill color, a soft lavender-blue.
// WakeWise's own dark surface and peach `primary` (used by the intro-
// video pill and every other primary action in this app) are unchanged.
// `requiresAuth` (Remove Routines from the Visible User Flow) mirrors
// each destination's own real gate exactly, per routinesCatalog.js/
// RoutineDetail.jsx: Morning and Evening require sign-in, Gentle Reset
// does not. `path` is gone - each card's real destination is no longer a
// single navigate() target (Morning needs Session Engine
// initialization first), so it is resolved by id in beginCardDestination
// below instead.
const WELCOME_CARDS = [
  {
    id: 'morning',
    icon: 'wb_twilight',
    iconClass: 'bg-morning-accent/15 text-morning-accent',
    subtitleClass: 'text-morning-accent',
    title: 'Start my morning',
    // Journey Embedding — 'From 5 min' rather than a flat '5 min': the new
    // optional Meditate step (2/5/10 min, skippable) means the routine's
    // true length now varies by the user's own choice, and "From" is
    // truthful at every one of those durations, including the widest
    // (10-minute) choice - never a claim that a recommended duration is
    // the maximum possible total. `note` is accessible-only (folded into
    // this card's own aria-label below), not a third visible text line -
    // the compact single-line title/subtitle row has no room to add one
    // without crowding.
    subtitle: 'Rise & Reset · From 5 min',
    note: 'Meditation is optional and can add 2, 5 or 10 minutes.',
    requiresAuth: true
  },
  {
    id: 'calm',
    icon: 'air',
    iconClass: 'bg-tertiary/15 text-tertiary',
    subtitleClass: 'text-tertiary',
    // WakeWise DEV — F3 correction: title stays "Take a calming pause"
    // (explicitly approved as-is) - only the destination changed, from a
    // fixed jump straight into standalone Breathing to the real Anytime
    // Reset entry (need -> time -> recommendation), the same short flow
    // Home's own "Start Anytime Reset" already opens. Subtitle updated to
    // describe that real flow honestly rather than one fixed exercise.
    title: 'Take a calming pause',
    subtitle: 'Choose your need and your time.',
    requiresAuth: false
  },
  {
    id: 'sleep',
    // Restores the moon icon the design reference was missing on this
    // card - 'bedtime', filled, the same icon/variant Home.jsx's own
    // Evening pill already uses.
    icon: 'bedtime',
    iconClass: 'bg-evening-accent/15 text-evening-accent',
    subtitleClass: 'text-evening-accent',
    title: 'Wind down for sleep',
    // Journey Embedding — same "From" treatment as the Morning card above.
    subtitle: 'Begin Wind-Down · From 10 min',
    note: 'Meditation is optional and can add 2, 5 or 10 minutes.',
    requiresAuth: true
  }
];

export const Introduction = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // See this file's own "Back control" doc comment above - the only
  // consumer of this flag is the Back-control render below.
  const isAutomaticFirstUse = searchParams.get('auto') === '1';
  const { user, isGuest, profile, refreshProfile, loading: authLoading } = useAuth();
  const { state, startSession, resetSession } = useSession();
  // Welcome alarm-status card — real, live state, no second persistence
  // model. Works for guests too (AlarmContext's own guest-device-local
  // storage path already gives every guest a genuinely working local
  // alarm).
  const { alarmTime, isAlarmSet, alarmSoundId, alarmConfigured } = useAlarm();
  const [saving, setSaving] = useState(false);

  // Morning/Evening authentication continuity — captured ONCE, at the
  // first render, via a lazy initializer (same established shape as
  // AnytimeReset.jsx's own openVideoId restore) so the value survives the
  // strip effect below clearing it from the URL a moment later. Only a
  // real allowlisted action is ever kept - anything else (missing,
  // tampered, unrecognised) resolves to null and this screen behaves
  // exactly as an ordinary Welcome visit.
  const [resumeAction] = useState(() => {
    const action = searchParams.get('resume');
    return isAllowedJourneyAction(action) ? action : null;
  });

  // Strips the `resume` marker immediately so it can never re-trigger on
  // a later re-render, browser Back/forward, or a reload - same
  // established pattern as AnytimeReset.jsx's own restore-params effect.
  useEffect(() => {
    if (!searchParams.get('resume')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('resume');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Personalised opening copy - see this file's own doc comment above
  // for the full "?existing=1 vs profile.introduction_completed_version"
  // priority rationale. isGuest short-circuits first, so a guest can
  // never reach the name-bearing branch at all, regardless of any other
  // state.
  const isReturningSignedInUser =
    !isGuest && (searchParams.get('existing') === '1' || Boolean(profile?.introduction_completed_version));
  const firstName = isGuest ? null : getFirstName({ profile, user });
  // WakeWise DEV — approved welcome-screen copy (Stitch "First Visit"/
  // "Welcome Back" states). A missing first name (getFirstName already
  // returns null for that case) falls back to the plain 'Welcome back'
  // heading with no dangling comma/placeholder, exactly as before.
  const welcomeHeading = isReturningSignedInUser
    ? (firstName ? `Welcome back, ${firstName}` : 'Welcome back')
    : 'Start your morning with purpose. End your day with calm.';
  // WakeWise DEV — First Visit purpose update: describes two real,
  // already-shipped features, not aspirational copy. The wake-up alarm
  // is genuinely active by default for every user, on or off native
  // (AlarmContext.jsx's own background clock observer; a native
  // background notification is a separate, opt-in layer on top of it -
  // see nativeMorningReminder.js), adjustable via Profile once signed
  // in. "About 5-10 minutes" is this app's own already-established
  // Morning duration claim (see nextStepCard.js's identical phrase,
  // already shown on Home's own Morning card) - not a new number.
  // Intention is genuinely the routine's real first step
  // (sessionConstants.js: Intention -> Stretch -> Breathe -> Meditate
  // (optional) -> Affirm -> Complete); "other steps" covers the rest
  // without listing all five and crowding this short explanation.
  const welcomeSubcopy = isReturningSignedInUser
    ? 'What would you like to do today?'
    : 'Set a gentle wake-up alarm, then follow a guided morning routine - about 5-10 minutes, starting with setting an intention and moving through stretching, breathing and other steps.';
  const [saveError, setSaveError] = useState('');

  // Reuses the exact same shared signed-URL/guest-gating mechanism every
  // other private video in this app already uses (Library, Support,
  // Prepare for Rest, etc.) - resolveEntry is getBetaVideoById rather than
  // useProtectedVideo's own default (the general Library catalog) because
  // I01/I02 are deliberately excluded from that catalog (see
  // mediaCatalog.js's INTERACTIVE_ONLY_IDS) and would never resolve there.
  //
  // guestAllowedIds (Build 16): a guest tap on I01 specifically opens the
  // player directly, matching the server's own GUEST_ALLOWED_IDS
  // exception (supabase/functions/_shared/betaVideoUrlAccess.ts) - see
  // that file's own doc comment for the full rationale. A guest tap on
  // anything else this hook might ever be asked to open still opens
  // SignInPromptDialog and never calls the Edge Function at all.
  const {
    openVideo,
    handleSelect,
    closeVideo,
    promptOpen,
    dismissPrompt,
    confirmSignIn,
    confirmCreateAccount
  } = useProtectedVideo(undefined, getBetaVideoById, GUEST_ALLOWED_VIDEO_IDS);

  const introVideo = INTRODUCTION_MEDIA.find((guide) => guide.id === 'why-wakewise');
  const introVideoAvailable = Boolean(introVideo?.available);

  // Remove Routines from the Visible User Flow — the real "Start my
  // morning" entry point, traced directly from Home.jsx's own
  // handleBeginRiseAndReset / RoutineDetail.jsx's own beginRiseAndReset
  // (both already identical to each other): reset any other in-progress
  // routine before starting fresh, initialize the Session Engine at Step
  // 1 (Set Intention), then land on its real screen. Nothing here is
  // invented - every call is the same real function those two existing
  // handlers already use.
  const beginRiseAndReset = () => {
    if (state.status === 'playing' || state.status === 'interrupted') {
      resetSession();
    }
    startSession('morning-routine', { startIndex: getStepIndex('morning-routine', MORNING_STEP_IDS.INTENTION) });
    navigate('/intention-setup');
  };

  // Evening's own canonical entry needs no Session Engine call here at
  // all - EveningWindDown.jsx's own Begin button is what actually starts
  // the session (see Home.jsx's handleBeginEveningWindDown, which this
  // matches exactly). Gentle Reset is simpler still: a plain, stateless
  // navigate, matching RoutineDetail.jsx's own gentle-reset handling.
  const CARD_DESTINATIONS = {
    morning: beginRiseAndReset,
    // WakeWise DEV — "Repair Take a calming pause": routes to this app's
    // established, coherent standalone breathing screen (see this file's
    // own top doc comment) instead of the ambiguous non-standalone flow.
    // WakeWise DEV — F3 correction: now opens the real Anytime Reset
    // entry (need -> time -> recommendation) instead of jumping straight
    // into one fixed exercise - see this file's own top doc comment.
    calm: () => navigate('/anytime-reset'),
    sleep: () => navigate('/evening-wind-down')
  };

  const continueTo = (destination) => {
    if (typeof destination === 'function') {
      destination();
      return;
    }
    navigate(destination);
  };

  // Guest gate for Morning/Evening — reuses the exact same
  // SignInPromptDialog + redirect-after-auth mechanism Home.jsx's own
  // promptRoutineSignIn/confirmRoutineSignIn/confirmRoutineCreateAccount
  // already use for the identical gesture ("sign in to launch a
  // routine"), but stashes a real pendingJourneyIntent (see this file's
  // own top doc comment) instead of pendingContent's returnPath: '/' -
  // that is what lets the user continue straight into their selected
  // journey once signed in, rather than landing back on Home needing a
  // second tap. A second, independent SignInPromptDialog instance (the
  // existing one above is scoped to the "Watch introduction" video only)
  // - see this screen's own render below.
  const [routineSignInPromptOpen, setRoutineSignInPromptOpen] = useState(false);
  // Which card opened the prompt - the ONLY thing confirmRoutineSignIn/
  // confirmRoutineCreateAccount need to know to stash the right fixed
  // action. Never itself passed to navigate() or used as a URL.
  const [pendingCardId, setPendingCardId] = useState(null);
  const dismissRoutineSignInPrompt = () => setRoutineSignInPromptOpen(false);
  const confirmRoutineSignIn = () => {
    setPendingJourneyIntent(pendingCardId);
    setRoutineSignInPromptOpen(false);
    navigate('/auth');
  };
  const confirmRoutineCreateAccount = () => {
    setPendingJourneyIntent(pendingCardId);
    setRoutineSignInPromptOpen(false);
    navigate('/auth?tab=signup');
  };

  const handleCardTap = (card) => {
    if (card.requiresAuth && isGuest) {
      setPendingCardId(card.id);
      setRoutineSignInPromptOpen(true);
      return;
    }
    persistAndContinue(CARD_DESTINATIONS[card.id]);
  };

  // `destination` is where this specific action should land once
  // persistence (or the guest short-circuit) resolves - '/' for the Home
  // fallback action, or one of CARD_DESTINATIONS' functions for a card
  // tap (a plain path string for Gentle Reset's own destination function,
  // or the real Session-Engine-initializing beginRiseAndReset for
  // Morning - continueTo above handles either shape). Guest-gated cards
  // (requiresAuth: true) never reach this function for a guest at all -
  // handleCardTap intercepts them first (see above). The actual Supabase
  // read/upsert-if-missing/conditional-update logic lives in
  // introductionCompletion.js's completeIntroductionVersion, shared with
  // Auth.jsx's own resume-continuation path (see this file's top doc
  // comment) - this function owns only the UI-facing saving/error state
  // and the final continueTo call.
  const persistAndContinue = async (destination = '/') => {
    // Guest behaviour is explicit: no Supabase write is ever attempted
    // for a guest - viewing this screen is fine, persisting completion
    // to an account that doesn't exist is not.
    if (isGuest || !user || !supabase) {
      continueTo(destination);
      return;
    }
    if (saving) return; // prevent repeated clicks while saving

    setSaving(true);
    setSaveError('');

    const result = await completeIntroductionVersion({ supabase, userId: user.id, refreshProfile });

    setSaving(false);

    if (!result.ok) {
      setSaveError("We couldn't save that. Please try again.");
      return;
    }

    continueTo(destination);
  };

  // Morning/Evening authentication continuity — the resume trigger
  // itself. Fires at most once (hasResumedRef): as soon as a real,
  // allowlisted resumeAction was captured AND AuthContext has finished
  // loading AND the now-signed-in user is genuinely not a guest, this
  // calls the EXACT same persistAndContinue a real tap on that card would
  // - same version write, same CARD_DESTINATIONS lookup, same Session
  // Engine initialization for Morning, same final navigate. Never fires
  // for a guest (a resume param can only ever have been minted by
  // Auth.jsx after a real, successful authentication - but this guard
  // stays anyway as defense in depth, matching every other guest check in
  // this app). authLoading in the dependency array is what lets this
  // effect correctly re-evaluate once AuthContext's own initial session
  // fetch resolves, rather than reading a stale isGuest===true at the
  // very first render right after the /auth redirect.
  const hasResumedRef = useRef(false);
  useEffect(() => {
    if (!resumeAction || authLoading || isGuest || hasResumedRef.current) return;
    hasResumedRef.current = true;
    persistAndContinue(CARD_DESTINATIONS[resumeAction]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeAction, authLoading, isGuest]);

  return (
    // Mobile scroll repair: Introduction is one of a handful of routes
    // rendered outside <Layout> (full-bleed, no bottom-nav chrome — see
    // this file's own top comment), so it never got Layout's own h-dvh +
    // flex-1 min-h-0 + overflow-y-auto scroll container. It relied on the
    // document (body/html) scrolling instead — which index.html
    // deliberately sets `overflow: hidden` on for BOTH axes, specifically
    // because every Layout-wrapped page already has its own internal
    // scroll container and two competing scrollers was the actual bug
    // that fix solved. Confirmed live: on a short viewport, desktop mouse-
    // wheel still happened to reach the rest of the page (Chrome falls
    // back to scrolling <html> when <body> alone is overflow:hidden), but
    // iOS Safari/WKWebView specifically blocks touch-driven scrolling
    // once <body> has overflow:hidden — body{overflow:hidden} is a
    // well-known technique for exactly that suppression — so a real
    // iPhone had no way to reach content past the fold at all. Fix: this
    // screen now owns its own single scroll container, the same proven
    // shape Layout.jsx already uses, instead of depending on document
    // scroll.
    <div className="h-dvh overflow-hidden">
      <div className="h-full w-full overflow-y-auto overflow-x-hidden scroll-hide" style={{ overscrollBehaviorY: 'contain' }}>
        <div
          className="min-h-full flex flex-col px-6 max-w-md mx-auto space-y-2"
          style={{
            // WakeWise DEV — Welcome vertical-space fix: found live at
            // 390x844 (both Welcome variants) - adding AlarmStatusCard
            // pushed real content height to ~1145px against an ~844px
            // device viewport (301px measured overflow in a browser with
            // zero safe-area inset; a real notched/Dynamic-Island iPhone
            // adds ~47-59px top + ~34px bottom on top of that), putting
            // "Go to Home" and even the third journey card below the
            // fold. Fixed the same way this app's own established
            // convention always does first - trimming padding/gaps/icon
            // sizes before ever touching body copy or the primary
            // action's own touch target: 2rem -> 1.25rem here (was
            // space-y-8, now space-y-4 above - both together are the
            // bulk of the real saving, see the hero block/cards/
            // AlarmStatusCard's own matching trims below).
            paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
            // WakeWise DEV — welcome screens: this route now renders its
            // own Home/Library/Profile navigation (see the fixed <nav>
            // below), matching the approved design. 88px covers that
            // nav's own footprint (72px height + the 1rem gap below it) -
            // kept exactly as-is (the nav itself is unchanged). The flat
            // base clearance above it went 2rem -> 0.5rem as part of the
            // original Welcome vertical-space fix, then back up to
            // 1.25rem after live-testing at 390x844 with a simulated real
            // safe-area/home-indicator inset found "Go to Home" touching
            // (0px clearance from) the fixed nav - min-h-full's own
            // flex-1 spacer absorbs any slack from content trimmed above,
            // so this flat constant - not the content above it - is what
            // actually controls "Go to Home"'s clearance from the nav.
            paddingBottom: 'calc(1.25rem + 88px + env(safe-area-inset-bottom))'
          }}
        >
      {!isAutomaticFirstUse && (
        <div className="flex items-center gap-3">
          <BackButton fallback="/" />
        </div>
      )}

      {/* WakeWise DEV — Welcome vertical-space fix: this hero block alone
          measured 343px live at 390x844 (icon 48 + heading/subcopy 207 +
          video pill 50, plus its own space-y-4 gaps) - the single
          largest contributor to "Go to Home" landing below the fold.
          Trimmed spacing/icon/heading size first, per this app's own
          established convention (see the outer container's own doc
          comment) - the subcopy's own real words are untouched. */}
      <div className="text-center space-y-2">
        <span
          className="material-symbols-outlined text-primary text-2xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
          aria-hidden="true"
        >
          spa
        </span>
        <div className="space-y-1.5">
          <h1 className="text-lg font-extrabold text-on-surface tracking-tight">
            {welcomeHeading}
          </h1>
          <p className="text-sm text-on-surface-variant leading-snug max-w-sm mx-auto">
            {welcomeSubcopy}
          </p>
        </div>

        {introVideoAvailable && (
          <button
            type="button"
            onClick={() => handleSelect(introVideo.storageRef)}
            aria-label="Play one-minute introduction: Why WakeWise."
            className="inline-flex items-center gap-2 mx-auto px-4 py-1.5 min-h-[44px] rounded-full glass-panel hover:bg-white/10 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span
              className="material-symbols-outlined text-primary text-lg"
              style={{ fontVariationSettings: "'FILL' 1" }}
              aria-hidden="true"
            >
              play_circle
            </span>
            <span className="text-xs font-semibold text-on-surface">Why WakeWise · 1 min</span>
          </button>
        )}
      </div>

      {/* Welcome alarm-status card — sits directly above the three
          journey choices (Morning first among them), compact, never the
          full alarm setup form itself. Same component, same real state,
          on both the First Visit and Welcome Back copy variants - only
          the copy differs (see alarmStatus.js's own per-variant matrix). */}
      <AlarmStatusCard
        variant={isReturningSignedInUser ? 'returning' : 'first-use'}
        alarmConfigured={alarmConfigured}
        isAlarmSet={isAlarmSet}
        alarmTime={alarmTime}
        alarmSoundId={alarmSoundId}
        returnTo={isAutomaticFirstUse ? '/introduction?auto=1' : '/introduction'}
      />

      <section aria-labelledby="welcome-cards-heading" className="space-y-3">
        {/* Visually hidden: the visible question is already asked above,
            in whichever variant of welcomeSubcopy is showing - a second,
            always-identical visible heading here would just repeat it
            (word-for-word for the new-guest variant, awkwardly for the
            returning-user variant, whose own question is different).
            Kept as a real heading element for screen readers, matching
            every other section on this screen. */}
        <h2 id="welcome-cards-heading" className="sr-only">
          Choose what would help you most
        </h2>
        {/* WakeWise DEV — Welcome vertical-space fix: space-y-3 -> space-y-2
            between cards, p-4 -> p-3 -> p-1.5 and the icon chip
            w-12 h-12/text-2xl -> w-9 h-9/text-lg on each card below (same
            trim-spacing-first approach as AlarmStatusCard.jsx's own
            matching fix) - title/subtitle text and every tap target/
            destination are unchanged. The final p-1.5 trim (live-verified,
            390x844 with a simulated real safe-area/home-indicator inset)
            was needed to clear "Go to Home" from under the fixed bottom
            nav - source-level checks alone can't catch this kind of real
            device geometry. */}
        <div className="space-y-2">
          {WELCOME_CARDS.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => handleCardTap(card)}
              disabled={saving}
              // Journey Embedding — an explicit aria-label folding in
              // card.note (when present) so screen-reader users hear the
              // "+2/5/10 minutes optional" context this card's own visible
              // text doesn't have room to show without crowding. Omitted
              // entirely for a card with no note (Calming Pause), so its
              // accessible name still derives naturally from the visible
              // title/subtitle exactly as before.
              aria-label={card.note ? `${card.title}. ${card.subtitle}. ${card.note}` : undefined}
              className="w-full text-left glass-panel rounded-2xl p-1.5 flex items-center gap-3.5 hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            >
              <span className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${card.iconClass}`}>
                <span
                  className="material-symbols-outlined text-lg"
                  aria-hidden="true"
                  style={card.id === 'sleep' ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {card.icon}
                </span>
              </span>
              <span className="flex-1 min-w-0 space-y-0.5">
                <span className="block text-base font-bold text-on-surface">{card.title}</span>
                <span className={`block text-xs font-medium ${card.subtitleClass}`}>{card.subtitle}</span>
              </span>
              <span className="material-symbols-outlined text-on-surface-variant text-xl shrink-0" aria-hidden="true">
                arrow_forward
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="flex-1" />

      {/* WakeWise DEV — Welcome vertical-space fix: pt-4 -> pt-1.5 (the
          button itself keeps its own full py-4 - the primary action's
          touch target/prominence is deliberately untouched). */}
      <div className="space-y-3 pt-1.5">
        {saveError && (
          <p role="alert" className="text-xs text-red-400 font-medium text-center">
            {saveError}
          </p>
        )}
        {/* WakeWise DEV — welcome screens: prominent peach primary
            action, matching the approved design (was a plain text link)
            and this app's own established primary-button treatment
            (bg-primary/text-on-primary, the same pill every other primary
            CTA on this screen and elsewhere already uses). */}
        <button
          type="button"
          onClick={() => persistAndContinue('/')}
          disabled={saving}
          className="w-full py-4 inline-flex items-center justify-center gap-2 bg-primary text-on-primary font-bold text-center rounded-full hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
        >
          <span>{saving ? 'Saving…' : 'Go to Home'}</span>
          {!saving && (
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              arrow_forward
            </span>
          )}
        </button>
      </div>
        </div>
      </div>

      {/* WakeWise DEV — welcome screens: Home/Library/Profile navigation,
          matching the approved design (shown on both the First Visit and
          Welcome Back states). A local, self-contained copy of Layout.jsx's
          own nav markup rather than an extracted shared component -
          Layout.jsx and its own dense test suite
          (Layout.bottomNavVisualUplift.test.js/Layout.safeArea.test.js)
          pin its exact inline structure byte-for-byte, and this screen
          renders outside <Layout> entirely (see this file's own top doc
          comment) - moving it inside <Layout> is out of scope for this
          pass. `fixed` (not `absolute`, unlike Layout.jsx's own nav)
          since this screen has no positioned ancestor to anchor to; "Home"
          is always the active tab here, the only one this screen can ever
          be reached from within the tabbed frame. */}
      <nav
        className="fixed left-4 right-4 z-40 rounded-full h-[72px] backdrop-blur-xl shadow-2xl border border-white/10 flex items-stretch px-2 max-w-md mx-auto"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))', backgroundColor: 'rgba(6, 14, 32, 0.9)' }}
      >
        {[
          { label: 'Home', path: '/', icon: 'home_health', active: true },
          { label: 'Library', path: '/library', icon: 'video_library', active: false },
          { label: 'Profile', path: '/profile', icon: 'person', active: false }
        ].map((item) => (
          <Link
            key={item.path}
            to={item.path}
            aria-current={item.active ? 'page' : undefined}
            className={`flex-1 min-w-[44px] min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-full transition-all duration-150 active:scale-90 ${
              item.active ? 'text-primary' : 'text-on-surface hover:text-primary active:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: item.active ? "'FILL' 1" : "'FILL' 0" }}>
              {item.icon}
            </span>
            <span className={`text-[11px] leading-none ${item.active ? 'font-bold' : 'font-semibold'}`}>{item.label}</span>
          </Link>
        ))}
      </nav>

      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={closeVideo} />
      )}

      <SignInPromptDialog
        open={promptOpen}
        onSignIn={confirmSignIn}
        onCreateAccount={confirmCreateAccount}
        onDismiss={dismissPrompt}
      />

      {/* Remove Routines from the Visible User Flow — a second, independent
          SignInPromptDialog for the Morning/Evening card guest gate (see
          handleCardTap above). The one above is scoped entirely to the
          "Watch introduction" video and is otherwise unrelated. */}
      <SignInPromptDialog
        open={routineSignInPromptOpen}
        onSignIn={confirmRoutineSignIn}
        onCreateAccount={confirmRoutineCreateAccount}
        onDismiss={dismissRoutineSignInPrompt}
      />
    </div>
  );
};

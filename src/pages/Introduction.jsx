/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { BackButton } from '../components/BackButton';
import { getFirstName } from '../lib/greeting';
import { INTRODUCTION_MEDIA } from '../lib/introductionMedia';
import { CURRENT_INTRODUCTION_VERSION } from '../lib/introductionVersion';
import { getBetaVideoById } from '../lib/mediaCatalog';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { SignInPromptDialog } from '../components/SignInPromptDialog';

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
 * finish reading or watch anything first. All three route to an
 * EXISTING Routines Hub entry (RoutineDetail.jsx via /routines/:id),
 * reusing that screen's own real guest-gating (Rise & Reset/Wind-Down
 * require sign-in to Start; Gentle Reset does not) rather than
 * duplicating any of that logic here:
 *   - "Start my morning"    -> /routines/rise-reset  (Morning journey)
 *   - "Take a calming pause" -> /routines/gentle-reset (a real one-step
 *     guided-breathing visualizer, no sign-in required - deliberately
 *     NOT "Instant Calm" (E03 in betaVideoManifest.js), which is a
 *     narrated exercise VIDEO, not a breathing practice; Gentle Reset is
 *     the actual guided-breathing quick-pause experience in this app)
 *   - "Wind down for sleep"  -> /routines/wind-down   (Evening journey)
 * Card copy states each destination's own real name and the Routines
 * catalogue's own already-established duration (routinesCatalog.js),
 * never an invented estimate.
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
 * neutral "Welcome to WakeWise" copy. The signal itself comes from two
 * places, in priority order:
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
//   - morning-accent (--color-gratitude-accent, #f4c56a) - already
//     Home.jsx's own Morning pill color, itself a warm gold.
//   - tertiary (--color-tertiary, #7fe4d0) - already used throughout the
//     app, a mint/teal green.
//   - evening-accent (--color-evening-accent, #9fb4f0) - already
//     Home.jsx's own Evening pill color, a soft lavender-blue.
// WakeWise's own dark surface and peach `primary` (used by the intro-
// video pill and every other primary action in this app) are unchanged.
const WELCOME_CARDS = [
  {
    id: 'morning',
    icon: 'wb_twilight',
    iconClass: 'bg-morning-accent/15 text-morning-accent',
    subtitleClass: 'text-morning-accent',
    title: 'Start my morning',
    subtitle: 'Rise & Reset · 5 min',
    path: '/routines/rise-reset'
  },
  {
    id: 'calm',
    icon: 'air',
    iconClass: 'bg-tertiary/15 text-tertiary',
    subtitleClass: 'text-tertiary',
    title: 'Take a calming pause',
    subtitle: 'Gentle Reset · 1 min guided breathing',
    path: '/routines/gentle-reset'
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
    subtitle: 'Begin Wind-Down · 10 min',
    path: '/routines/wind-down'
  }
];

export const Introduction = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // See this file's own "Back control" doc comment above - the only
  // consumer of this flag is the Back-control render below.
  const isAutomaticFirstUse = searchParams.get('auto') === '1';
  const { user, isGuest, profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  // Personalised opening copy - see this file's own doc comment above
  // for the full "?existing=1 vs profile.introduction_completed_version"
  // priority rationale. isGuest short-circuits first, so a guest can
  // never reach the name-bearing branch at all, regardless of any other
  // state.
  const isReturningSignedInUser =
    !isGuest && (searchParams.get('existing') === '1' || Boolean(profile?.introduction_completed_version));
  const firstName = isGuest ? null : getFirstName({ profile, user });
  const welcomeHeading = isReturningSignedInUser
    ? (firstName ? `Welcome back, ${firstName}` : 'Welcome back')
    : 'Welcome to WakeWise';
  const welcomeSubcopy = isReturningSignedInUser
    ? 'WakeWise has a calmer new way to support your morning, your day and your evening. Where would you like to begin?'
    : 'What would help you most today?';
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

  const continueTo = (path) => navigate(path);

  // Handle profile-row races safely: if the row is temporarily missing
  // (e.g. a fresh sign-up racing AuthContext's own upsert-on-first-load),
  // reuse that EXACT existing ensure-profile mechanism (refreshProfile,
  // which selects, upserts only if missing - never overwriting an
  // existing row's name/preferences - then re-selects) rather than
  // inventing a second, separate profile-creation path here.
  const readIntroductionVersion = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('introduction_completed_version')
      .eq('id', userId)
      .maybeSingle();
    return { data, error };
  };

  // `path` is where this specific action should land once persistence
  // (or the guest short-circuit) resolves - '/' for the Home fallback
  // action, one of WELCOME_CARDS' own paths for a card tap.
  const persistAndContinue = async (path = '/') => {
    // Guest behaviour is explicit: no Supabase write is ever attempted
    // for a guest - viewing this screen is fine, persisting completion
    // to an account that doesn't exist is not.
    if (isGuest || !user || !supabase) {
      continueTo(path);
      return;
    }
    if (saving) return; // prevent repeated clicks while saving

    setSaving(true);
    setSaveError('');

    let { data: profileRow, error: readError } = await readIntroductionVersion(user.id);

    if (readError) {
      setSaving(false);
      setSaveError("We couldn't save that. Please try again.");
      return;
    }

    if (!profileRow) {
      await refreshProfile();
      ({ data: profileRow, error: readError } = await readIntroductionVersion(user.id));
      if (readError || !profileRow) {
        setSaving(false);
        setSaveError("We couldn't save that. Please try again.");
        return;
      }
    }

    // Replay-safety: never write a value that could reset or lower an
    // already-saved version - if this account is already at or above the
    // current version, there is nothing to persist.
    if ((profileRow.introduction_completed_version ?? 0) >= CURRENT_INTRODUCTION_VERSION) {
      setSaving(false);
      continueTo(path);
      return;
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from('profiles')
      .update({ introduction_completed_version: CURRENT_INTRODUCTION_VERSION })
      .eq('id', user.id)
      .select('id');

    setSaving(false);

    // A zero-row update (no error, but nothing matched) is never silently
    // treated as success - something changed underneath us (e.g. the row
    // vanished between the read and this write), so this is surfaced as
    // a retryable failure exactly like a genuine error would be.
    if (updateError || !updatedRows || updatedRows.length !== 1) {
      setSaveError("We couldn't save that. Please try again.");
      return;
    }

    continueTo(path);
  };

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
          className="min-h-full flex flex-col px-6 max-w-md mx-auto space-y-8"
          style={{
            paddingTop: 'calc(2rem + env(safe-area-inset-top))',
            // iPhone home-indicator clearance — this route has no bottom
            // nav of its own to already reserve that space (unlike
            // Layout.jsx's content container).
            paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))'
          }}
        >
      {!isAutomaticFirstUse && (
        <div className="flex items-center gap-3">
          <BackButton fallback="/" />
        </div>
      )}

      <div className="text-center space-y-4">
        <span
          className="material-symbols-outlined text-primary text-5xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
          aria-hidden="true"
        >
          spa
        </span>
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">
            {welcomeHeading}
          </h1>
          <p className="text-sm text-on-surface-variant leading-relaxed max-w-sm mx-auto">
            {welcomeSubcopy}
          </p>
        </div>

        {introVideoAvailable && (
          <button
            type="button"
            onClick={() => handleSelect(introVideo.storageRef)}
            className="inline-flex items-center gap-2 mx-auto px-4 py-2.5 rounded-full glass-panel hover:bg-white/10 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span
              className="material-symbols-outlined text-primary text-lg"
              style={{ fontVariationSettings: "'FILL' 1" }}
              aria-hidden="true"
            >
              play_circle
            </span>
            <span className="text-xs font-semibold text-on-surface">Watch introduction (1 min) · Why WakeWise works</span>
          </button>
        )}
      </div>

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
        <div className="space-y-3">
          {WELCOME_CARDS.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => persistAndContinue(card.path)}
              disabled={saving}
              className="w-full text-left glass-panel rounded-2xl p-4 flex items-center gap-3.5 hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            >
              <span className={`flex items-center justify-center w-12 h-12 rounded-xl shrink-0 ${card.iconClass}`}>
                <span
                  className="material-symbols-outlined text-2xl"
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

      <div className="space-y-3 pt-4">
        {saveError && (
          <p role="alert" className="text-xs text-red-400 font-medium text-center">
            {saveError}
          </p>
        )}
        <button
          type="button"
          onClick={() => persistAndContinue('/')}
          disabled={saving}
          className="w-full py-3 inline-flex items-center justify-center gap-1.5 text-center text-sm text-on-surface-variant font-semibold hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full disabled:opacity-60"
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

      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={closeVideo} />
      )}

      <SignInPromptDialog
        open={promptOpen}
        onSignIn={confirmSignIn}
        onCreateAccount={confirmCreateAccount}
        onDismiss={dismissPrompt}
      />
    </div>
  );
};

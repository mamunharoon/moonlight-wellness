/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  MEDITATION_DURATION_GROUPS,
  MEDITATION_NEEDS,
  getCatalogEntryById
} from '../lib/mediaCatalog';
import { recommendMeditations } from '../lib/meditationRecommendations';
import { setPendingContent } from '../lib/pendingContent';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { JourneyHeader } from '../components/journey/JourneyHeader';
import { SelectionChip } from '../components/journey/SelectionChip';
import { SelectionRow } from '../components/journey/SelectionRow';
import { RecommendationCard } from '../components/journey/RecommendationCard';

// Build 15 Phase B — Material Symbols icon per need, for the restyled
// SelectionChip grid. A local lookup, not a mediaCatalog.js field (out
// of scope this phase) - never an emoji, per the approved design
// direction. Purely decorative (aria-hidden inside SelectionChip); the
// 8 need ids/labels themselves are completely unchanged. Deliberately a
// separate lookup from AnytimeReset.jsx's own NEED_ICONS - the two
// pages' need lists only partially overlap (e.g. Meditate has
// "mindfulness"/"gratitude"/"self-compassion", Anytime Reset doesn't).
const NEED_ICONS = {
  calm: 'air',
  focus: 'center_focus_strong',
  mindfulness: 'psychology',
  'stress-relief': 'self_improvement',
  'body-awareness': 'accessibility_new',
  gratitude: 'favorite',
  'self-compassion': 'volunteer_activism',
  'deep-relaxation': 'nightlight'
};

/*
 * Meditation experience (WakeWise "Meditate")
 *
 * Today -> Meditate -> Choose available time -> Choose current need ->
 * Recommended sessions -> Play -> Completion -> Return to Today or Choose
 * Another. One route (/meditate), three local wizard steps, matching the
 * exact structural pattern Support.jsx already established for the
 * "Need a moment?" flow — reused deliberately rather than inventing a
 * second navigation shape:
 *   - a single top-left back control per step (BackButton on step 1 for
 *     real navigation home; a local "step back" arrow on steps 2-3, same
 *     as Support.jsx's own recommendation-view back button)
 *   - guest Begin -> SignInPromptDialog -> setPendingContent(returnPath)
 *     -> /auth -> back here with the exact same time+need+item restored
 *     via query params, same mechanism as Support.jsx/useProtectedVideo.js
 *   - "Choose Another" cycles between the current recommendation's
 *     results without re-selecting time/need, matching Support.jsx's own
 *     handleChooseAnother
 *   - BetaVideoModal reused completely unchanged — no second player.
 *
 * Refreshing /meditate is always safe: step/durationGroupId/needId are
 * local component state (no other persistence), so a hard refresh always
 * re-initialises to step 1 unless valid ?need=&duration= restore params
 * are present (the post-sign-in return trip), in which case it restores
 * directly to the recommendation step — never a crash, never a stale view.
 */
export const Meditate = () => {
  const navigate = useNavigate();
  const { isGuest, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // Build 15 Phase B remediation — the same stale-session gap
  // AnytimeReset.jsx's own verifyingAuth/handleBegin already closed:
  // isGuest only ever reflects the locally cached session
  // (supabase.auth.getSession(), never revalidated against the server),
  // so it can say "signed in" for a session the server no longer honours
  // (expired token, or the account removed server-side). verifyAndOpenVideo
  // below adds the one genuine, server-revalidating supabase.auth.getUser()
  // check immediately before ever opening BetaVideoModal - read-only, no
  // write, get-beta-video-url's own server-side auth remains the real,
  // unweakened gate regardless of what this resolves to.
  const [verifyingAuth, setVerifyingAuth] = useState(false);
  // Re-entrancy guard, a plain ref not the verifyingAuth STATE above -
  // exactly AnytimeReset.jsx's own reasoning: state updates are
  // asynchronous, so two click events dispatched before the next render
  // would both still close over the pre-update `verifyingAuth === false`
  // and could both start a getUser() call. A ref is mutated synchronously,
  // so the second handleBegin invocation in the same tick sees the
  // updated value immediately.
  const verifyingAuthRef = useRef(false);

  const restoredNeed = searchParams.get('need');
  const restoredDuration = searchParams.get('duration');
  const restoredIsValid =
    restoredNeed &&
    restoredDuration &&
    MEDITATION_NEEDS.some((n) => n.id === restoredNeed) &&
    MEDITATION_DURATION_GROUPS.some((g) => g.id === restoredDuration);

  const [step, setStep] = useState(() => (restoredIsValid ? 'recommend' : 'duration'));
  const [durationGroupId, setDurationGroupId] = useState(() => (restoredIsValid ? restoredDuration : null));
  const [needId, setNeedId] = useState(() => (restoredIsValid ? restoredNeed : null));
  const [optionIndex, setOptionIndex] = useState(0);

  // Post-auth return trip: a matching openId (only meaningful once signed
  // in) auto-opens the video the user originally tapped Begin on, without
  // auto-playing it — BetaVideoModal always requires its own explicit tap
  // regardless of how it was opened. Same lazy-initializer pattern as
  // Support.jsx/useProtectedVideo.js, for the same set-state-in-effect
  // reason (computed once, on mount, not inside an effect).
  const [openVideoId, setOpenVideoId] = useState(() => {
    const openId = searchParams.get('openId');
    return openId && !isGuest && getCatalogEntryById(openId) ? openId : null;
  });
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);

  // Strips the now-consumed params so they can't re-trigger on a later
  // re-render or a browser back/forward — touches only router state.
  //
  // Back-button repair: `need`/`duration` used to be stripped here only
  // implicitly (never, in fact) — they were read once by the lazy
  // initializers above but left sitting in the URL indefinitely. Any
  // reload while the wizard had since moved to a *different* step (e.g.
  // via "Change need"/"Change time", or the on-screen back arrow on the
  // "What would help right now?" step) re-ran `restoredIsValid` against
  // those same stale params and silently snapped back to the `recommend`
  // step — discarding whatever step the user was actually on, which is
  // exactly what a WKWebView memory reload (a normal iOS event after
  // backgrounding, or after returning from a video's native fullscreen)
  // can trigger. The on-screen back control's own click handler was never
  // broken — confirmed live, it correctly steps `need` -> `duration` — a
  // reload is what silently undid it. Stripping `need`/`duration` here
  // too, the same one-time-restore-then-clear treatment `openId` already
  // got, means a reload after this point always falls through to the
  // step's own local-state default (`duration`) instead of a stale
  // restore target — a predictable, safe landing spot rather than a
  // confusing jump.
  useEffect(() => {
    const hasOpenId = searchParams.get('openId');
    const hasRestoreParams = searchParams.get('need') || searchParams.get('duration');
    if (!hasOpenId && !hasRestoreParams) return;
    const next = new URLSearchParams(searchParams);
    next.delete('openId');
    next.delete('need');
    next.delete('duration');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recommendation = durationGroupId && needId ? recommendMeditations({ durationGroupId, needId }) : null;
  const items = recommendation?.items || [];
  const current = items.length > 0 ? items[optionIndex % items.length] : null;
  const openVideo = openVideoId ? getCatalogEntryById(openVideoId) : null;

  const handleSelectDuration = (id) => {
    setDurationGroupId(id);
    setStep('need');
  };

  const handleSelectNeed = (id) => {
    setNeedId(id);
    setOptionIndex(0);
    setStep('recommend');
  };

  const handleStepBack = () => {
    if (step === 'need') setStep('duration');
    else if (step === 'recommend') setStep('need');
  };

  const handleChangeTime = () => setStep('duration');
  const handleChangeNeed = () => setStep('need');
  const handleChooseAnother = () => setOptionIndex((i) => i + 1);

  const returnPath = () => `/meditate?need=${needId}&duration=${durationGroupId}`;

  // Never treat "auth not resolved yet" as authenticated - a tap that
  // lands while AuthContext is still loading is simply ignored rather
  // than racing ahead on a guess; the Begin button itself is also
  // disabled during authLoading/verifyingAuth (see the RecommendationCard
  // wiring below), so this is defense-in-depth, matching
  // AnytimeReset.jsx's own handleBegin exactly.
  const handleBegin = () => {
    if (!current || authLoading || verifyingAuthRef.current) return;
    if (isGuest) {
      setSignInPromptOpen(true);
      return;
    }
    verifyAndOpenVideo(current.id);
  };

  // The one, single source-revalidating auth check before ever opening
  // BetaVideoModal for a client that currently looks signed in - see this
  // file's own top-of-component comment for why. Exactly one
  // supabase.auth.getUser() call per Start/Begin tap (guarded by
  // verifyingAuthRef above). Read-only: no table write, no localStorage
  // write, and get-beta-video-url's own server-side check remains the
  // real, unweakened access gate regardless of what this resolves to.
  const verifyAndOpenVideo = async (id) => {
    verifyingAuthRef.current = true;
    setVerifyingAuth(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user || data.user.is_anonymous) {
        setSignInPromptOpen(true);
        return;
      }
      setOpenVideoId(id);
    } catch {
      setSignInPromptOpen(true);
    } finally {
      verifyingAuthRef.current = false;
      setVerifyingAuth(false);
    }
  };

  const handleSignIn = () => {
    setPendingContent({ id: current.id, returnPath: returnPath() });
    setSignInPromptOpen(false);
    navigate('/auth');
  };

  const handleCreateAccount = () => {
    setPendingContent({ id: current.id, returnPath: returnPath() });
    setSignInPromptOpen(false);
    navigate('/auth?tab=signup');
  };

  const handleVideoClose = () => {
    const entry = getCatalogEntryById(openVideoId);
    setOpenVideoId(null);
    navigate('/meditation-complete', {
      state: {
        id: entry.id,
        title: entry.title,
        durationSeconds: entry.meditation?.durationSeconds ?? null
      }
    });
  };

  // Build 15 Phase B — "Back/Close alignment" per the approved design:
  // Anytime Reset's header already carries a Close control that returns
  // to Home from any step; Meditate's own header never had one. Adding
  // it here is a deliberate, explicitly-approved header-consistency
  // change, not a new route or new behaviour - it navigates to the same
  // '/' every existing BackButton fallback on step 1 already goes to.
  const handleClose = () => navigate('/');

  const durationLabel = (group) => (group.description ? `${group.label} — ${group.description}` : group.label);
  const stepIndex = step === 'duration' ? 0 : step === 'need' ? 1 : 2;
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      className="max-w-md w-full mx-auto space-y-8 animate-in fade-in duration-500 pb-4"
      style={{
        // Build 15 Phase B — 20px mobile margin, reducing safely to 16px
        // on very small screens, combined with the existing
        // safe-area-inset handling in one calc - matches
        // AnytimeReset.jsx's identical mechanism for the identical
        // requirement.
        paddingLeft: 'calc(clamp(1rem, 4vw, 1.25rem) + env(safe-area-inset-left))',
        paddingRight: 'calc(clamp(1rem, 4vw, 1.25rem) + env(safe-area-inset-right))',
        paddingTop: 'calc(1rem + env(safe-area-inset-top))'
      }}
    >
      <JourneyHeader
        showBackButton={step === 'duration'}
        backFallback="/"
        onStepBack={handleStepBack}
        onClose={handleClose}
        stepIndex={stepIndex}
        stepCount={3}
      />

      {step === 'duration' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <span className="material-symbols-outlined text-primary text-3xl" aria-hidden="true">spa</span>
            <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight mt-2">How much time do you have?</h1>
            <p className="text-xs text-on-surface-variant">We'll only suggest sessions that genuinely fit.</p>
          </div>
          <div className="space-y-3" role="group" aria-label="How much time do you have?">
            {MEDITATION_DURATION_GROUPS.map((group) => (
              <SelectionRow
                key={group.id}
                label={group.label}
                description={group.description}
                selected={durationGroupId === group.id}
                onClick={() => handleSelectDuration(group.id)}
              />
            ))}
          </div>
        </div>
      )}

      {step === 'need' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">What would help right now?</h1>
            <p className="text-xs text-on-surface-variant">{durationGroupId && durationLabel(MEDITATION_DURATION_GROUPS.find((g) => g.id === durationGroupId))}</p>
          </div>
          <div className="grid grid-cols-2 gap-3" role="group" aria-label="What would help right now?">
            {MEDITATION_NEEDS.map((need) => (
              <SelectionChip
                key={need.id}
                label={need.label}
                icon={NEED_ICONS[need.id]}
                selected={needId === need.id}
                onClick={() => handleSelectNeed(need.id)}
              />
            ))}
          </div>
        </div>
      )}

      {step === 'recommend' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Recommended for you</h1>
            <p className="text-xs text-on-surface-variant">
              {MEDITATION_NEEDS.find((n) => n.id === needId)?.label} · {durationGroupId && durationLabel(MEDITATION_DURATION_GROUPS.find((g) => g.id === durationGroupId))}
            </p>
          </div>

          {current ? (
            <RecommendationCard
              title={current.title}
              durationLabel={formatDuration(current.meditation.durationSeconds)}
              description={current.description}
              isClosestMatch={recommendation.matchQuality === 'closest'}
              matchReason={current.matchReason}
              onStart={handleBegin}
              startLabel="Begin"
              startDisabled={authLoading || verifyingAuth}
              startBusy={verifyingAuth}
              onChooseAnother={handleChooseAnother}
              showChooseAnother={items.length > 1}
              chooseAnotherLabel="Choose Another"
            />
          ) : (
            <div className="glass-panel rounded-3xl p-6 text-center space-y-2">
              <span className="material-symbols-outlined text-on-surface-variant/50 text-3xl" aria-hidden="true">search_off</span>
              <p className="text-sm text-on-surface-variant">No session matches that combination yet.</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleChangeTime}
              className="flex-1 glass-panel text-on-surface-variant py-3 rounded-full text-xs font-bold uppercase tracking-wider text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Change time
            </button>
            <button
              type="button"
              onClick={handleChangeNeed}
              className="flex-1 glass-panel text-on-surface-variant py-3 rounded-full text-xs font-bold uppercase tracking-wider text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Change need
            </button>
          </div>
        </div>
      )}

      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={handleVideoClose} />
      )}
      <SignInPromptDialog
        open={signInPromptOpen}
        onSignIn={handleSignIn}
        onCreateAccount={handleCreateAccount}
        onDismiss={() => setSignInPromptOpen(false)}
      />
    </div>
  );
};

/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { ANYTIME_RESET_DURATIONS, ANYTIME_RESET_NEEDS, getCatalogEntryById } from '../lib/mediaCatalog';
import { recommendAnytimeReset } from '../lib/anytimeResetRecommendations';
import { setPendingContent } from '../lib/pendingContent';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { JourneyHeader } from '../components/journey/JourneyHeader';
import { AnytimeResetProgress } from '../components/journey/AnytimeResetProgress';
import { SelectionChip } from '../components/journey/SelectionChip';
import { SelectionRow } from '../components/journey/SelectionRow';
import { RecommendationCard } from '../components/journey/RecommendationCard';
import { JourneyGlow } from '../components/JourneyGlow';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';

// Build 15 Phase B — Material Symbols icon per need, for the restyled
// SelectionChip grid. A local lookup, not a mediaCatalog.js field (out
// of scope this phase) - never an emoji, per the approved design
// direction. Purely decorative (aria-hidden inside SelectionChip); the
// 8 need ids/labels themselves are completely unchanged.
const NEED_ICONS = {
  calm: 'air',
  focus: 'center_focus_strong',
  energy: 'bolt',
  'stress-relief': 'self_improvement',
  'body-reset': 'accessibility_new',
  'quiet-time': 'nightlight',
  'better-mood': 'mood',
  'not-sure': 'help'
};

// WakeWise DEV — Anytime quick-reset alternatives (correction: Anytime is
// a quick/flexible hub, never a sequential Morning/Evening-style
// journey). Exactly three REAL, already-shipped WakeWise experiences -
// no invented/duplicate practice. A standalone "Stretch" was considered
// and dropped: no such route exists anywhere in this app (grepped
// App.jsx) - MorningFlow.jsx's own stretching is embedded in the Morning
// routine only, not a genuine standalone Anytime-reachable screen, so
// showing it here would be exactly the "invented/duplicate practice"
// this correction explicitly forbids. Durations are each real: Breathe's
// own patterns run 56-76s (see QuietBreathing.jsx's PATTERNS), Meditate
// genuinely offers 2/5/10 minutes (SelfGuidedMeditation.jsx), Instant
// Calm (E03) is a real catalog video at 100.1s (mediaCatalog.js) - not
// one of them is a flat invented estimate.
const QUICK_RESET_ALTERNATIVES = [
  { id: 'breathe', icon: 'air', label: 'Breathe', durationLabel: 'About 1-2 min' },
  { id: 'meditate', icon: 'self_improvement', label: 'Meditate', durationLabel: '2, 5 or 10 min' },
  { id: 'instant-calm', icon: 'bolt', label: 'Instant Calm', durationLabel: 'About 2 min' }
];

/*
 * WakeWise — Anytime Reset (Build 15 UX remediation)
 *
 * Home -> Anytime Reset -> What do you need right now? -> How much time
 * do you have? -> Recommendation -> Play -> back to Recommendation.
 * Deliberately modeled on Meditate.jsx's own proven three-step wizard
 * shape (same local-state-only architecture, same guest/query-param
 * restore mechanism, same BetaVideoModal reuse) - Meditate.jsx itself is
 * untouched; this is a genuinely separate route/component/recommendation
 * engine, not a modification of it. Step order is reversed from
 * Meditate's own (need first, duration second) per the approved design.
 *
 * Single-select only (never multi, never a custom text field, never the
 * keyboard) - tap-only by design. State is 100% local component state:
 * no Supabase write, no localStorage, nothing survives a reload except
 * the one-time post-sign-in query-param restore below (need/duration id
 * only, allowlist-validated, stripped immediately after read) - it never
 * touches user_intentions or any other persisted record, so it can
 * neither overwrite the morning intention nor leak between users.
 */
export const AnytimeReset = () => {
  const navigate = useNavigate();
  const { isGuest, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // Guest/auth wrong-modal fix (Build 15 remediation): a signed-in-looking
  // client can still hold a STALE local session - e.g. its access token
  // expired, or (as reproduced live during this remediation) the account
  // behind it was removed server-side while this tab still had it cached.
  // AuthContext's own isGuest only ever reads that local cache
  // (supabase.auth.getSession(), never revalidated against the server), so
  // it can say "signed in" for a session the server no longer honours -
  // BetaVideoModal then opens, its signed-URL fetch 401s server-side, and
  // the guest sees that modal's own Retry-only error UI instead of ever
  // being offered a real sign-in path. verifyingAuth/handleBegin below
  // close that gap with one genuine, server-revalidating
  // supabase.auth.getUser() check immediately before ever opening the
  // video - read-only, no write, no weakening of get-beta-video-url's own
  // server-side auth (that remains the real gate; this is only ever a
  // client-side pre-check to route a stale session to sign-in instead of
  // to a confusing playback error).
  const [verifyingAuth, setVerifyingAuth] = useState(false);
  // Re-entrancy guard for verifyAndOpenVideo: a plain ref, not the
  // verifyingAuth STATE above, because state updates are asynchronous - two
  // click events dispatched before React re-renders (a fast real
  // double-tap, or a scripted/automated double-click) would both still
  // close over the pre-update `verifyingAuth === false` and could both
  // start a getUser() call. A ref is mutated synchronously, so the second
  // handleBegin invocation in the same tick sees the updated value
  // immediately - genuinely single-flight, not just "usually fine because
  // clicks are rarely that fast". verifyingAuth (state) still exists
  // separately to drive the disabled/"Checking…" UI, which does need a
  // render to reflect.
  const verifyingAuthRef = useRef(false);

  const restoredNeed = searchParams.get('need');
  const restoredDuration = searchParams.get('duration');
  const restoredIsValid =
    restoredNeed &&
    restoredDuration &&
    ANYTIME_RESET_NEEDS.some((n) => n.id === restoredNeed) &&
    ANYTIME_RESET_DURATIONS.some((d) => d.id === restoredDuration);

  const [step, setStep] = useState(() => (restoredIsValid ? 'recommend' : 'need'));
  const [needId, setNeedId] = useState(() => (restoredIsValid ? restoredNeed : null));
  const [durationId, setDurationId] = useState(() => (restoredIsValid ? restoredDuration : null));
  const [optionIndex, setOptionIndex] = useState(0);

  // Post-auth return trip: a matching openId (only meaningful once signed
  // in) auto-opens the video the user originally tapped Start on, without
  // auto-playing it - BetaVideoModal always requires its own explicit tap
  // regardless of how it was opened. Same lazy-initializer pattern as
  // Meditate.jsx/Support.jsx, for the same set-state-in-effect reason
  // (computed once, on mount, not inside an effect).
  const [openVideoId, setOpenVideoId] = useState(() => {
    const openId = searchParams.get('openId');
    return openId && !isGuest && getCatalogEntryById(openId) ? openId : null;
  });
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);
  // Anytime Reset completion fix — true only once the recommended media's
  // own natural end event fires (BetaVideoModal's new onEnded callback,
  // below); closing the modal early (handleVideoClose) never sets this.
  // Reset to false by every action that changes what's being recommended
  // (a fresh recommendation should never inherit a stale completion state).
  const [isComplete, setIsComplete] = useState(false);

  // Strips consumed restore params immediately so they can never
  // re-trigger on a later re-render, browser back/forward, or a reload
  // after the user has since moved to a different step - same repair
  // Meditate.jsx already carries for the identical reason (see that
  // file's own comment on this exact effect).
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

  const recommendation = needId && durationId ? recommendAnytimeReset({ needId, durationId }) : null;
  const items = recommendation?.items || [];
  const current = items.length > 0 ? items[optionIndex % items.length] : null;
  const openVideo = openVideoId ? getCatalogEntryById(openVideoId) : null;

  const handleSelectNeed = (id) => {
    setNeedId(id);
    setStep('duration');
    setIsComplete(false);
  };

  const handleSelectDuration = (id) => {
    setDurationId(id);
    setOptionIndex(0);
    setStep('recommend');
    setIsComplete(false);
  };

  // Required Back semantics: recommendation -> duration -> need -> Home.
  const handleStepBack = () => {
    if (step === 'duration') setStep('need');
    else if (step === 'recommend') setStep('duration');
  };

  const handleChangeTime = () => {
    setStep('duration');
    setIsComplete(false);
  };
  const handleChangeNeed = () => {
    setStep('need');
    setIsComplete(false);
  };
  // Never immediately repeats the item just shown while alternatives
  // exist - a plain increment only wraps back to the first item after
  // cycling through every other one, exactly like Meditate.jsx's own
  // handleChooseAnother.
  const handleChooseAnother = () => {
    setOptionIndex((i) => i + 1);
    setIsComplete(false);
  };

  const returnPath = () => `/anytime-reset?need=${needId}&duration=${durationId}`;

  // WakeWise DEV — Anytime quick-reset alternatives: "Instant Calm" opens
  // the real E03 catalog video through this screen's own existing
  // BetaVideoModal mechanism (same guest/auth gate as the recommended
  // item); "Breathe"/"Meditate" leave this page entirely for their own
  // real, already-shipped standalone screens, carrying journeyTone via
  // router state - the same location.state.journeyTone shape
  // usePracticeJourneyTone already reads (see practiceJourneyContext.js),
  // so mint carries through their own setup/countdown/active/completion
  // exactly as if launched from Home's own Anytime quick-action tile.
  const handleQuickResetAlternative = (id) => {
    if (id === 'instant-calm') {
      if (authLoading || verifyingAuthRef.current) return;
      if (isGuest) {
        setSignInPromptOpen(true);
        return;
      }
      verifyAndOpenVideo('E03');
      return;
    }
    const path = id === 'breathe' ? '/breathe-standalone' : '/self-guided-meditation';
    // WakeWise DEV — Anytime completion correction: needId/durationId ride
    // along so the destination practice's own "Choose another quick
    // reset" (QuietBreathing.jsx/SelfGuidedMeditationComplete.jsx) can
    // return here via the same allowlisted ?need=&duration= restore this
    // component already uses after sign-in, landing back on this exact
    // recommendation instead of restarting the wizard from step 1.
    navigate(path, { state: { journeyTone: 'anytime', anytimeNeed: needId, anytimeDuration: durationId } });
  };

  // Never treat "auth not resolved yet" as authenticated - a tap that
  // lands while AuthContext is still loading (e.g. a direct/refresh
  // navigation straight to /anytime-reset) is simply ignored rather than
  // racing ahead on a guess; the button itself is also disabled during
  // authLoading/verifyingAuth below, so this is defense-in-depth, not the
  // only guard.
  const handleBegin = () => {
    if (!current || authLoading || verifyingAuthRef.current) return;
    if (isGuest) {
      setSignInPromptOpen(true);
      return;
    }
    verifyAndOpenVideo(current.id);
  };

  // The one, single source-revalidating auth check before ever opening
  // BetaVideoModal for a client that currently looks signed in.
  // supabase.auth.getUser() (unlike getSession(), which only ever reads
  // the locally cached token) asks the server whether this session is
  // still genuinely valid - a expired/revoked/deleted-account session
  // fails here and is routed to the exact same SignInPromptDialog a plain
  // guest sees, never to BetaVideoModal's own Retry-only error state.
  // Read-only: no table write, no localStorage write, and
  // get-beta-video-url's own server-side check remains the real,
  // unweakened access gate regardless of what this resolves to.
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

  // Closing the video returns to the recommendation step, not out of the
  // journey entirely - required by the approved design. Deliberately
  // never touches isComplete - completion is tracked independently of
  // closing (see BetaVideoModal's own onEnded callback below), so an
  // early close here always falls through to the ordinary "Recommended
  // for you" state, never the completion state.
  const handleVideoClose = () => setOpenVideoId(null);

  const handleClose = () => navigate('/');

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const stepIndex = step === 'need' ? 0 : step === 'duration' ? 1 : 2;

  return (
    // Mobile scroll repair (Build 15 viewport audit): rendered outside
    // <Layout> with no scroll container of its own, relying on document
    // scroll - which index.html deliberately disables on both axes (see
    // Introduction.jsx's own identical fix and doc comment). Step 1's need
    // grid and Step 3's recommendation actions were unreachable on small
    // phones as a result. Same proven shape as Introduction.jsx/
    // Layout.jsx: this screen now owns its own single scroll container.
    <div className="h-dvh overflow-hidden">
    <div className="h-full w-full overflow-y-auto overflow-x-hidden scroll-hide" style={{ overscrollBehaviorY: 'contain' }}>
    <div
      className="min-h-full max-w-md w-full mx-auto space-y-8 animate-in fade-in duration-500 pb-4"
      style={{
        // Build 15 Phase B — 20px mobile margin, reducing safely to 16px
        // on very small screens (clamp between the two, scaling on
        // viewport width in between) combined with the existing
        // safe-area-inset handling in one calc - a Tailwind responsive
        // class can't also carry the safe-area addition without an
        // inline style winning and making the class dead, so this stays
        // a single inline mechanism for both.
        paddingLeft: 'calc(clamp(1rem, 4vw, 1.25rem) + env(safe-area-inset-left))',
        paddingRight: 'calc(clamp(1rem, 4vw, 1.25rem) + env(safe-area-inset-right))',
        paddingTop: 'calc(1rem + env(safe-area-inset-top))'
      }}
    >
      {/* WakeWise DEV — colour glow extension: subtle sage/mint ambient
          backdrop, matching Anytime's own established tertiary/mint
          identity (the need-selection icons and progress bar already
          use it). */}
      <JourneyGlow journey="anytime" />

      <JourneyHeader
        showBackButton={step === 'need'}
        backFallback="/"
        onStepBack={handleStepBack}
        onClose={handleClose}
      />
      {/* Build 15 release-quality pass — dedicated, more visible progress
          indicator, replacing JourneyHeader's own small dots (never
          passed stepIndex/stepCount above any more, so its dot block
          never renders). See AnytimeResetProgress.jsx's own doc comment;
          JourneyHeader itself and Meditate.jsx's own identical dots are
          completely unmodified. */}
      <AnytimeResetProgress stepIndex={stepIndex} stepCount={3} />

      {step === 'need' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <span className="material-symbols-outlined text-tertiary text-3xl" aria-hidden="true">bolt</span>
            <h1 className="font-headline-lg text-3xl text-on-surface font-bold tracking-tight mt-2">Take an Anytime Reset</h1>
            {/* F3 (pre-Build-15 usability pass) — found live: a guest could
                complete the whole Need -> Time -> Recommendation wizard
                and only discover the sign-in requirement after tapping
                Start. One calm, early disclosure at the first useful
                point (this subtitle), guest-only - authenticated copy is
                completely unchanged. See Step 3's RecommendationCard
                `locked` badge + "Sign in to start" label below for the
                second half of this fix. */}
            <p className="text-sm text-on-surface-variant">
              {isGuest
                ? 'Choose what you need and how much time you have. Sign in is required to play your personalised recommendation.'
                : 'Choose what you need and how much time you have.'}
            </p>
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-on-surface">What do you need right now?</h2>
          </div>
          <div className="grid grid-cols-2 gap-3" role="group" aria-label="What do you need right now?">
            {ANYTIME_RESET_NEEDS.map((need) => (
              <SelectionChip
                key={need.id}
                label={need.label}
                icon={NEED_ICONS[need.id]}
                selected={needId === need.id}
                onClick={() => handleSelectNeed(need.id)}
                accent="anytime"
              />
            ))}
          </div>
        </div>
      )}

      {step === 'duration' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="font-headline-lg text-3xl text-on-surface font-bold tracking-tight">How much time do you have?</h1>
            <p className="text-sm text-on-surface-variant">{ANYTIME_RESET_NEEDS.find((n) => n.id === needId)?.label}</p>
          </div>
          <div className="space-y-3" role="group" aria-label="How much time do you have?">
            {ANYTIME_RESET_DURATIONS.map((duration) => (
              <SelectionRow
                key={duration.id}
                label={duration.label}
                selected={durationId === duration.id}
                onClick={() => handleSelectDuration(duration.id)}
                accent="anytime"
              />
            ))}
          </div>
        </div>
      )}

      {step === 'recommend' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="font-headline-lg text-3xl text-on-surface font-bold tracking-tight">
              {isComplete ? 'Reset complete' : 'Recommended for you'}
            </h1>
            <p className="text-sm text-on-surface-variant">
              {isComplete
                ? 'Take a moment to notice how you feel.'
                : `${ANYTIME_RESET_NEEDS.find((n) => n.id === needId)?.label} · ${ANYTIME_RESET_DURATIONS.find((d) => d.id === durationId)?.label}`}
            </p>
          </div>

          {isComplete ? (
            // WakeWise DEV — Anytime completion correction: exactly two
            // actions, matching the same pair QuietBreathing.jsx now
            // shows for an anytime-tone completion. "Choose another quick
            // reset" un-completes this same screen (keeps needId/
            // durationId, so the full recommendation + alternatives below
            // reappears immediately) rather than forcing a fresh need/
            // duration pick or auto-starting anything new.
            <div className="space-y-3 w-full">
              <button
                type="button"
                onClick={() => setIsComplete(false)}
                className={`w-full ${getJourneyPrimaryActionClasses('anytime')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg`}
              >
                <span>Choose another quick reset</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Return to Home
              </button>
            </div>
          ) : current ? (
            <RecommendationCard
              title={current.title}
              durationLabel={formatDuration(current.anytimeReset.durationSeconds)}
              description={current.description}
              isClosestMatch={recommendation.matchQuality === 'closest'}
              matchReason={current.matchReason}
              onStart={handleBegin}
              // F3 — a guest sees "Sign in to start" instead of a
              // normal-looking "Start" that unexpectedly opens a gate;
              // the actual gate mechanism (handleBegin -> SignInPromptDialog)
              // is completely unchanged, only the label differs.
              startLabel={isGuest ? 'Sign in to start' : 'Start'}
              startDisabled={authLoading || verifyingAuth}
              startBusy={verifyingAuth}
              onChooseAnother={handleChooseAnother}
              showChooseAnother={items.length > 1}
              chooseAnotherLabel="Choose another"
              accent="anytime"
              locked={isGuest}
            />
          ) : (
            <div className="glass-panel rounded-3xl p-6 text-center space-y-2">
              <span className="material-symbols-outlined text-on-surface-variant/50 text-3xl" aria-hidden="true">search_off</span>
              <p className="text-sm text-on-surface-variant">No reset matches that combination yet.</p>
            </div>
          )}

          {/* WakeWise DEV — Anytime quick-reset alternatives: real,
              already-shipped WakeWise practices, never a placeholder or
              a duplicate of the current recommendation. No "Stretch"
              entry - no standalone Stretch route exists anywhere in this
              app (MorningFlow.jsx's own stretching is embedded in the
              Morning routine only), and showing one here would be
              exactly the invented/duplicate practice this correction
              forbids. Recommended item stays prominent above; changing
              need/duration below updates it without ever hiding this
              row. Hidden during the completion state - "Choose another
              quick reset" there is the one, unambiguous way back to this
              same set of choices. */}
          {!isComplete && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Or choose another quick reset</h2>
              <div className="space-y-2" role="group" aria-label="Or choose another quick reset">
                {QUICK_RESET_ALTERNATIVES.map((alt) => (
                  <button
                    key={alt.id}
                    type="button"
                    onClick={() => handleQuickResetAlternative(alt.id)}
                    className="w-full text-left glass-panel rounded-2xl p-3 flex items-center gap-3 hover:bg-white/5 active:scale-[0.99] transition-all border-white/10 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary"
                  >
                    <span className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-tertiary/15 text-tertiary">
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">{alt.icon}</span>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-on-surface">{alt.label}</span>
                      <span className="block text-xs text-tertiary">{alt.durationLabel}</span>
                    </span>
                    <span className="material-symbols-outlined text-on-surface-variant text-lg shrink-0" aria-hidden="true">arrow_forward</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isComplete && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleChangeNeed}
                className="flex-1 glass-panel text-on-surface-variant py-3 rounded-full text-xs font-bold uppercase tracking-wider text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Change need
              </button>
              <button
                type="button"
                onClick={handleChangeTime}
                className="flex-1 glass-panel text-on-surface-variant py-3 rounded-full text-xs font-bold uppercase tracking-wider text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Change time
              </button>
            </div>
          )}
        </div>
      )}

      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={handleVideoClose} onEnded={() => setIsComplete(true)} />
      )}
      <SignInPromptDialog
        open={signInPromptOpen}
        onSignIn={handleSignIn}
        onCreateAccount={handleCreateAccount}
        onDismiss={() => setSignInPromptOpen(false)}
      />
    </div>
    </div>
    </div>
  );
};

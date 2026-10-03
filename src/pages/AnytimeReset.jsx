/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlarm } from '../context/AlarmContext';
import { supabase } from '../lib/supabaseClient';
import { ANYTIME_RESET_DURATIONS, ANYTIME_RESET_NEEDS, getCatalogEntryById } from '../lib/mediaCatalog';
import { recommendAnytimeReset } from '../lib/anytimeResetRecommendations';
import { setPendingContent } from '../lib/pendingContent';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { OUTCOME, JOURNEY, getOutcomeMessage } from '../lib/outcomeMessages';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { JourneyHeader } from '../components/journey/JourneyHeader';
import { SelectionChip } from '../components/journey/SelectionChip';
import { SelectionRow } from '../components/journey/SelectionRow';
import { RecommendationCard } from '../components/journey/RecommendationCard';
import { JourneyGlow } from '../components/JourneyGlow';
import { ExploreCard } from '../components/ExploreCard';
import { getAnytimeExploreCatalog } from '../lib/exploreFiltering';
import { AnytimePathway } from '../components/AnytimePathway';
import { ExerciseScreenShell } from '../components/journey/ExerciseScreenShell';

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
// journey). Durations are each real: Breathe's own patterns run 56-76s
// (see QuietBreathing.jsx's PATTERNS), Meditate genuinely offers 2/5/10
// minutes (SelfGuidedMeditation.jsx), Instant Calm (E03) is a real
// catalog video at 100.1s (mediaCatalog.js) - not one of them is a flat
// invented estimate.
//
// DEV integration (Supabase-backed) — "Stretch" added below, routing to the new
// AnytimeStretch.jsx (4 real guided-stretch narration sessions, 57-96s
// each, fetched via requestBetaVideoUrl/get-beta-video-url - ids S06-S09,
// same private `wellness-videos` bucket and signed-URL mechanism as every
// other beta exercise - see AnytimeStretch.jsx's own doc comment). This
// reverses the standalone-Stretch decision this comment previously
// recorded ("no such route exists... would be invented/duplicate
// practice") now that a genuine route and real Storage-backed media
// exist.
const QUICK_RESET_ALTERNATIVES = [
  { id: 'stretch', icon: 'accessibility_new', label: 'Stretch', durationLabel: 'About 1-2 min' },
  { id: 'breathe', icon: 'air', label: 'Breathe', durationLabel: 'About 1-2 min' },
  { id: 'meditate', icon: 'self_improvement', label: 'Meditate', durationLabel: '2, 5 or 10 min' },
  { id: 'instant-calm', icon: 'bolt', label: 'Instant Calm', durationLabel: 'About 2 min' }
];

/*
 * WakeWise — Anytime Reset (Build 15 UX remediation)
 *
 * Home -> Anytime Reset -> What would support you now? -> How much time
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
  const { effectiveTimezone } = useAlarm();
  const today = getZonedParts(effectiveTimezone, devNow()).dateKey;
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
  // WakeWise Phase 2 (B4) — root cause: handleVideoClose deliberately never
  // touched isComplete on an early close (correct - it must never claim
  // completion), but that also meant NO acknowledgement of any kind was
  // ever shown for stopping early; the screen just silently fell back to
  // the ordinary "Recommended for you" state as if nothing had happened.
  // This is the honest, non-blocking middle ground: a transient flag,
  // cleared by the exact same actions that already clear isComplete
  // (a fresh recommendation should never inherit a stale acknowledgement
  // any more than it should inherit a stale completion).
  const [justEndedEarly, setJustEndedEarly] = useState(false);
  // WakeWise Phase 2 (B5) — progressive disclosure: the recommended
  // practice + Start stays visually primary; every real alternative (the
  // recommendation engine's own other matching items, AND the three
  // existing quick-reset practices) is collapsed behind this one toggle
  // by default, rather than always-visible competing with the
  // recommendation. Independent of items.length - always available, so
  // Breathe/Meditate/Instant Calm (item 7) stay reachable even when the
  // recommendation engine returns only a single match.
  const [alternativesOpen, setAlternativesOpen] = useState(false);

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
  // WakeWise guided-media completion phase — the natural-completion
  // acknowledgement now lives entirely inside BetaVideoModal's own shared
  // overlay (completionContext below), never here; isComplete is kept
  // purely so handleVideoClose can still tell a genuine natural end apart
  // from a real early close (it no longer drives any of this page's own
  // rendering). outcomeMessage is therefore only ever the early-close
  // acknowledgement now.
  const outcomeMessage = justEndedEarly ? getOutcomeMessage(OUTCOME.ENDED_EARLY, JOURNEY.ANYTIME, today) : null;

  const handleSelectNeed = (id) => {
    setNeedId(id);
    setStep('duration');
    setIsComplete(false);
    setJustEndedEarly(false);
    setAlternativesOpen(false);
  };

  const handleSelectDuration = (id) => {
    setDurationId(id);
    setOptionIndex(0);
    setStep('recommend');
    setIsComplete(false);
    setJustEndedEarly(false);
    setAlternativesOpen(false);
  };

  // Required Back semantics: recommendation -> duration -> need -> Home.
  const handleStepBack = () => {
    if (step === 'duration') setStep('need');
    else if (step === 'recommend') setStep('duration');
  };

  const handleChangeTime = () => {
    setStep('duration');
    setIsComplete(false);
    setJustEndedEarly(false);
    setAlternativesOpen(false);
  };
  const handleChangeNeed = () => {
    setStep('need');
    setIsComplete(false);
    setJustEndedEarly(false);
    setAlternativesOpen(false);
  };

  // WakeWise Phase 2 (B5) — root cause: "Choose another" used to silently
  // cycle optionIndex forward with no visible list at all, so a user
  // could only ever discover alternatives by repeatedly tapping and
  // hoping. It's now a real progressive-disclosure toggle: collapsed by
  // default (matches the recommended practice + Start staying visually
  // primary), and expanding it reveals the genuine other matching items
  // (if any) plus the three existing quick-reset practices below -
  // nothing invented, nothing hidden that used to be reachable.
  const handleToggleAlternatives = () => setAlternativesOpen((open) => !open);

  // Selecting a SPECIFIC other item from the revealed list - a real,
  // direct choice (never a blind cycle). needId/durationId are completely
  // untouched, so the recommendation criteria survive this exactly like
  // every other alternative-selection path already does.
  const handleSelectAlternativeItem = (index) => {
    setOptionIndex(index);
    setAlternativesOpen(false);
    setIsComplete(false);
    setJustEndedEarly(false);
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
    const path = id === 'breathe' ? '/breathe-standalone' : id === 'stretch' ? '/anytime-stretch' : '/self-guided-meditation';
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
    setJustEndedEarly(false);
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
  //
  // WakeWise Phase 2 (B4) — an early close (isComplete still false at the
  // moment this fires - onEnded, not this handler, is what ever sets it
  // true) now also raises justEndedEarly, so the ordinary "Recommended for
  // you" state it falls through to shows a brief, honest "A short pause
  // still matters" acknowledgement instead of silently pretending nothing
  // happened. A genuine natural end (isComplete already true) never
  // touches this flag either way.
  const handleVideoClose = () => {
    if (!isComplete) setJustEndedEarly(true);
    // The modal's own completion overlay was the only representation of a
    // natural completion; once it's dismissed (via its own X/backdrop, or
    // via one of its own action buttons below), this screen never shows a
    // second, duplicate completion state of its own.
    setIsComplete(false);
    setOpenVideoId(null);
  };

  const handleClose = () => navigate('/');

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Physical-iPhone correction — "Recommended for you" is the one Anytime
  // step with enough content to ever need to scroll (alternatives list +
  // quick resets + Change need/time + Explore Anytime), so it's the one
  // step that gets the same ExerciseScreenShell fixed-header/scrolling-
  // body split already proven on Morning (Breathe.jsx/MorningFlow.jsx):
  // Back/Close + the Need/Time/Reset progress row move into the shell's
  // non-scrolling `header` slot (opaque, safe-area-aware, divider below),
  // so they can never scroll away or let real content render under the
  // status bar. Need/Time selection below are each a single short grid/
  // list that always fits without scrolling on real devices, so they
  // deliberately keep their own original single-scroll-container shape
  // unchanged - this is a per-step fix, not a shared-component rewrite.
  if (step === 'recommend') {
    return (
      <ExerciseScreenShell
        journeyTone="anytime"
        maxWidthClassName="max-w-md"
        header={
          <>
            <JourneyHeader
              showBackButton={false}
              backFallback="/"
              onStepBack={handleStepBack}
              onClose={handleClose}
            />
            <AnytimePathway currentStageId="reset" needSelected={Boolean(needId)} timeSelected={Boolean(durationId)} />
          </>
        }
      >
        {/* WakeWise DEV — colour glow extension: subtle sage/mint ambient
            backdrop, matching Anytime's own established tertiary/mint
            identity (the need-selection icons and progress bar already
            use it). */}
        <JourneyGlow journey="anytime" />

        {step === 'recommend' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="space-y-1">
            {/* A genuine natural completion is now acknowledged entirely
                inside BetaVideoModal's own shared overlay (completionContext
                below) - it never reaches this headline any more. This is
                only ever the real early-close acknowledgement
                (justEndedEarly - closing early still shows an honest "A
                short pause still matters" here, unchanged from before), or
                the ordinary pre-completion recommendation view. */}
            <h1 className="font-headline-lg text-3xl text-on-surface font-bold tracking-tight">
              {outcomeMessage ? outcomeMessage.headline : 'Recommended for you'}
            </h1>
            <p className="text-sm text-on-surface-variant">
              {outcomeMessage
                ? outcomeMessage.body
                : `${ANYTIME_RESET_NEEDS.find((n) => n.id === needId)?.label} · ${ANYTIME_RESET_DURATIONS.find((d) => d.id === durationId)?.label}`}
            </p>
          </div>

          {current ? (
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
              onChooseAnother={handleToggleAlternatives}
              showChooseAnother
              chooseAnotherLabel={alternativesOpen ? 'Hide alternatives' : 'Choose another'}
              expanded={alternativesOpen}
              controlsId="anytime-reset-alternatives"
              accent="anytime"
              locked={isGuest}
            />
          ) : (
            <div className="glass-panel rounded-3xl p-6 text-center space-y-2">
              <span className="material-symbols-outlined text-on-surface-variant/50 text-3xl" aria-hidden="true">search_off</span>
              <p className="text-sm text-on-surface-variant">No reset matches that combination yet.</p>
            </div>
          )}

          {/* WakeWise Phase 2 (B5) — progressive disclosure: collapsed by
              default so the recommendation above stays visually primary
              and these no longer compete equally with it. Expanding
              "Choose another" reveals the genuine other matching items
              (if any) plus the three existing quick-reset practices below
              - nothing invented, nothing removed, still real WakeWise
              practices/no "Stretch" entry (no standalone Stretch route
              exists anywhere in this app). Hidden during the completion
              state - "Choose another quick reset" there is the one,
              unambiguous way back to this same set of choices. */}
          {!isComplete && alternativesOpen && (
            <div id="anytime-reset-alternatives" className="space-y-4">
              {items.length > 1 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Other matches for this need</h2>
                  <div className="space-y-2" role="group" aria-label="Other matches for this need">
                    {items.map((item, index) => {
                      if (index === optionIndex % items.length) return null;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectAlternativeItem(index)}
                          className="w-full text-left glass-panel rounded-2xl p-3 flex items-center gap-3 hover:bg-white/5 active:scale-[0.99] transition-all border-white/10 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary"
                        >
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold text-on-surface">{item.title}</span>
                            <span className="block text-xs text-tertiary">{formatDuration(item.anytimeReset.durationSeconds)}</span>
                          </span>
                          <span className="material-symbols-outlined text-on-surface-variant text-lg shrink-0" aria-hidden="true">arrow_forward</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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

          {/* "Explore More" discovery, Phase 5 — optional, secondary,
              rendered only at this recommend step's own resting state
              (never while a video is open/playing/showing its own
              completion overlay - `!openVideo` below - matching "not
              inside a running breathing timer, meditation or active
              media session"). journey="anytime" links into the Library
              already showing the prioritised, shorter-first quick-reset
              set by default (getAnytimeExploreCatalog, exploreFiltering.js)
              with "View All Library content" as the explicit escape
              hatch into the full, broader catalogue. `need`/`duration`
              (this exact selection, not a guess) let Back return to the
              precise Anytime origin - see Library.jsx's own
              resolveAnytimeRecommendContext. */}
          {!isComplete && !openVideo && (
            <ExploreCard
              journey="anytime"
              icon="explore"
              title="Want another way to reset?"
              supportingText="Explore quick practices for the time and need you have."
              ctaLabel="Explore Anytime"
              to={`/library?journey=anytime&from=anytime-recommend&need=${encodeURIComponent(needId)}&duration=${encodeURIComponent(durationId)}`}
              itemCount={getAnytimeExploreCatalog().length}
            />
          )}
        </div>
        )}

        {openVideo && (
          <BetaVideoModal
            entry={openVideo}
            onClose={handleVideoClose}
            onEnded={() => setIsComplete(true)}
            completionContext={{
              journey: 'anytime',
              // Anytime Visual Flow and Closing Handoff uplift (Part 9) —
              // the shared three-action row: "Continue My Day" (primary
              // slot) leaves the wizard entirely; "Choose Another Reset"
              // (secondary slot) un-completes this same screen (needId/
              // durationId untouched) so the full recommendation +
              // alternatives reappears immediately - exactly what the
              // former two-action overlay's own "Choose Another Session"
              // already did, just now the secondary rather than the primary
              // action, matching the approved action order everywhere else
              // this closing handoff appears; "Explore More" opens the same
              // filtered Anytime Library this screen's own ExploreCard
              // below already links to, preserving this exact Need/Time
              // selection via the identical allowlisted query params.
              onPrimaryAction: () => {
                setIsComplete(false);
                setOpenVideoId(null);
                navigate('/');
              },
              onSecondaryAction: () => {
                setIsComplete(false);
                setOpenVideoId(null);
              },
              onExploreMore: () => {
                navigate(`/library?journey=anytime&from=anytime-recommend&need=${encodeURIComponent(needId)}&duration=${encodeURIComponent(durationId)}`);
              }
            }}
          />
        )}
        <SignInPromptDialog
          open={signInPromptOpen}
          onSignIn={handleSignIn}
          onCreateAccount={handleCreateAccount}
          onDismiss={() => setSignInPromptOpen(false)}
        />
      </ExerciseScreenShell>
    );
  }

  return (
    // Mobile scroll repair (Build 15 viewport audit): rendered outside
    // <Layout> with no scroll container of its own, relying on document
    // scroll - which index.html deliberately disables on both axes (see
    // Introduction.jsx's own identical fix and doc comment). Step 1's need
    // grid and Step 2's duration list were unreachable on small phones as
    // a result. Same proven shape as Introduction.jsx/Layout.jsx: these
    // two steps keep their own single scroll container - each is a single
    // short grid/list that always fits without scrolling on real devices,
    // so neither needs the ExerciseScreenShell fixed-header split the
    // recommend step above now uses (see this component's own doc
    // comment on that branch for the full root cause/fix).
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
      {/* Anytime Visual Flow and Closing Handoff uplift — the Need -> Time
          -> Reset decision pathway, replacing the former plain 3-segment
          AnytimeResetProgress bar (still on disk, now dormant - its own
          getSegmentClassName unit test is unaffected either way). Genuine
          stage icons stay visible in every state; Need/Time only ever
          receive their own small secondary check once that step's real
          value is genuinely already set (needSelected/timeSelected -
          never inferred from step position); the current step gets the
          existing mint highlight. Selecting Need or Time is a plain
          navigation action, never itself recorded as a completion - see
          this component's own doc comment for the full contract. */}
      <AnytimePathway currentStageId={step === 'need' ? 'need' : step === 'duration' ? 'time' : 'reset'} needSelected={Boolean(needId)} timeSelected={Boolean(durationId)} />

      {step === 'need' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <span className="material-symbols-outlined text-tertiary text-3xl" aria-hidden="true">bolt</span>
            {/* Anytime Visual Flow and Closing Handoff uplift — one
                heading, one short supporting sentence (Part 4/Part 12),
                replacing the former two-heading "Take an Anytime Reset" /
                "What do you need right now?" pair. */}
            <h1 className="font-headline-lg text-3xl text-on-surface font-bold tracking-tight mt-2">What would support you now?</h1>
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
                ? 'Sign in is required to play your personalised recommendation.'
                : 'Choose what fits, then how much time you have.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3" role="group" aria-label="What would support you now?">
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
                icon={duration.id === 'any' ? 'all_inclusive' : 'schedule'}
                iconAlwaysAccent
              />
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
    </div>
  );
};

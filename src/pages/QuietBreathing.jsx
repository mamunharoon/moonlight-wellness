/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { BreathingRing } from '../components/BreathingRing';
import { BreathingPatternRow } from '../components/BreathingPatternRow';
import { InteractiveAmbientMusic } from '../components/InteractiveAmbientMusic';
import { MusicEntryChoice } from '../components/MusicEntryChoice';
import { CompactSoundControl } from '../components/CompactSoundControl';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { isFeatureEnabled } from '../lib/featureFlags';
import { isInteractiveMusicEligible } from '../lib/backgroundMusicSelection';
import { getBetaVideoById } from '../lib/mediaCatalog';
import { useAuth } from '../context/AuthContext';
import { getMusicPreference, setMusicPreferenceForUser } from '../lib/musicPreference';
import { BREATHING_PATTERNS, getBreathingPatternById, resolveBreathPhase } from '../lib/breathingPatterns';
import { BREATHE_VIDEOS, BREATHING_SESSION_VIDEOS } from '../lib/guidedBreathingVideos';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';
import { getReducedMotionPreference } from '../lib/reducedMotionPreference';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { usePreparationCountdown } from '../hooks/usePreparationCountdown';
import { PreparationCountdown } from '../components/PreparationCountdown';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { usePracticeJourneyTone } from '../hooks/usePracticeJourneyTone';
import { clearPracticeJourneyTone, exitPracticeToHome } from '../lib/practiceJourneyContext';
import { getJourneyToneTokens } from '../lib/journeyTone';
import { getBreathingAcknowledgement, getCompletionGreeting } from '../lib/outcomeMessages';
import { createBreathingSession } from '../lib/breathingSession';
import { CompletionReveal } from '../components/CompletionReveal';
import { useCompletionHandoff } from '../hooks/useCompletionHandoff';
import { resolveAnytimeOrigin } from '../lib/anytimeOrigin';
import { AnytimeClosingHandoffMessage, AnytimeClosingHandoffActions } from '../components/AnytimeClosingHandoff';

// Background Music — same shared, reserved interactive-breathing loop id
// as EveningBreathing.jsx/Breathe.jsx.
const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';
const DEFAULT_STANDALONE_PATTERN_ID = 'quiet';

// Anytime Visual Flow and Closing Handoff uplift (Part 7) — one real
// Material Symbol per real breathing pattern (BreathingPatternRow's
// existing, additive `icon` prop), the exact same mapping Breathe.jsx's/
// EveningBreathing.jsx's own BREATHING_PATTERN_ICONS already use - the
// same activity, same icon, across journeys. No pattern is renamed,
// reordered, or given a different cadence/timing to acquire this icon.
const BREATHING_PATTERN_ICONS = {
  morning: 'air',
  evening: 'bedtime',
  quiet: 'self_improvement',
  box: 'crop_square',
  coherent: 'waves'
};

/*
 * Solas — Support & Calm, Sprint 1 Phase 2: Quiet Breathing
 *
 * Build 15 — extended with an explicit, additive `standalone` prop
 * (approved Option A) rather than a second parallel page. Every existing
 * caller (Support's own embedded usage, `standalone` omitted/false) is
 * COMPLETELY UNCHANGED: same fixed 4-4-8 pattern, no picker, same
 * MusicEntryChoice-gated auto-start-once-chosen behaviour, same
 * `/support`/`/support-complete` back-fallback/completion route, same
 * JSX structure, same InteractiveAmbientMusic mount position (between
 * the ring and the Continue/Skip buttons) - none of this is inferred
 * from a URL parameter, only from this one explicit, controlled prop the
 * ROUTE ITSELF decides (see App.jsx's two separate route registrations).
 *
 * `standalone={true}` (the new Home-launched Breathe entry) is a
 * genuinely different rendering path: real pattern selection (the same
 * three real cadences Morning Breathe offers, defaulting to this
 * screen's own established 4-4-8), a Background music preference, and a
 * real "Begin Breathing" gesture - nothing starts on mount. No Session
 * Engine coupling either way (this file has never imported useSession).
 *
 * Because `standalone` is a fixed prop for the lifetime of one mounted
 * instance (the router decides it, not runtime state), branching the
 * top-level render on it is safe - React never has to reconcile between
 * the two top-level shapes mid-life. Only the STANDALONE branch's own
 * internal pre-start/active transition needs InteractiveAmbientMusic to
 * be a single, stable, never-remounted instance (see MorningFlow.jsx's
 * own fix/doc comment for exactly why two separate mount points across a
 * hasBegun transition orphans audio started via a ref) - so its own
 * InteractiveAmbientMusic sits once, outside that inner ternary, with
 * conditional props instead of two mount points. Non-standalone never
 * has this transition at all (hasBegun starts true and never changes),
 * so its own single, original mount position is already safe exactly as
 * it always was.
 *
 * Guest pre-start-music correction (Build 18, complete) — BOTH branches
 * are now fixed. The standalone branch's MusicPreferenceToggle no longer
 * routes a guest's tap to sign-in; handleToggleMusicPreference persists
 * through the shared setMusicPreferenceForUser; the Begin handler's own
 * `&& !isGuest` guard is removed. Non-standalone (Support's embedded
 * usage)'s MusicEntryChoice is fixed the same way - see that component's
 * own updated doc comment. The former confirmSignInForMusic handler (a
 * local setPendingContent+navigate('/auth') pair, previously shared by
 * both branches' now-removed gates) is removed entirely: nothing in this
 * file navigates to sign-in for music any more, in either branch.
 */
export const QuietBreathing = ({ standalone = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isGuest } = useAuth();

  // WakeWise DEV — Anytime completion correction: AnytimeReset.jsx's own
  // "Or choose another quick reset" passes needId/durationId here via
  // router state so "Choose another quick reset" below can return to the
  // exact recommendation the user was on (the same allowlisted
  // ?need=&duration= restore AnytimeReset.jsx already uses after
  // sign-in), rather than restarting that wizard from step 1.
  //
  // WakeWise DEV — Anytime Back-navigation correction: `anytimeOrigin` is
  // the one EXPLICIT marker this whole standalone lifecycle (setup,
  // countdown, active, early exit, completion) uses to know it was
  // genuinely launched from Anytime Reset - never inferred from
  // journeyTone (which also defaults to 'anytime' for an unrelated
  // reason: no morning/evening session active and no explicit tone at
  // all - see usePracticeJourneyTone.js's own fallback chain), and never
  // from navigate(-1)/browser history, which is exactly what let Back
  // eject a guest all the way past Anytime Reset to Home/Welcome before
  // this fix (found live: Welcome -> Take a calming pause -> Anytime
  // Step 1 -> Calm -> Breathe -> Back from the pre-start/pattern-picker
  // screen fell straight through to backFallback='/' unconditionally,
  // with no memory of the Anytime Reset screen it came from).
  const { anytimeOrigin, anytimeResetDestination } = resolveAnytimeOrigin(location.state);

  // Context-aware Breathing/Meditation theming — standalone only (see
  // usePracticeJourneyTone's own `enabled` doc comment for why this is
  // called unconditionally but disabled for Support's embedded usage,
  // which has its own fixed journey identity already and must never
  // touch this key). Falls back to 'anytime' for the disabled branch so
  // any accidental read still resolves to a real, valid tone rather than
  // null reaching a class-lookup.
  const journeyTone = usePracticeJourneyTone(undefined, standalone) ?? 'anytime';

  // Build 15 — standalone mode's own return targets. Support's existing
  // embedded usage keeps its exact original targets, unconditionally.
  //
  // WakeWise DEV — Anytime Back-navigation correction: standalone's own
  // Back (the single EveningSceneShell button covering pre-start/pattern-
  // picker setup AND, via handleBackFromActive's own confirm-then-return-
  // to-setup logic below, the point a confirmed active-session Back lands
  // on too) now resolves to the preserved Anytime Reset recommendation
  // when anytimeOrigin is true, instead of unconditionally '/' - a direct
  // standalone visit (e.g. Home's own "Breathe" tile, no anytimeNeed in
  // state) still resolves to '/' exactly as before, completely unchanged.
  const backFallback = standalone ? (anytimeOrigin ? anytimeResetDestination : '/') : '/support';
  const completionRoute = standalone ? '/' : '/support-complete';

  // Pattern selection - standalone only. Non-standalone (Support) never
  // renders a picker and always uses the fixed 'quiet' pattern, exactly
  // as before this phase - selectedPatternId simply never changes away
  // from its default when !standalone, since no picker UI exists to
  // change it.
  const [selectedPatternId, setSelectedPatternId] = useState(DEFAULT_STANDALONE_PATTERN_ID);
  const activePattern = getBreathingPatternById(selectedPatternId) ?? getBreathingPatternById(DEFAULT_STANDALONE_PATTERN_ID);

  // Release-quality guided-breathing discoverability — standalone only
  // (Support's own embedded usage is untouched, see below). Collapsed by
  // default, same shared 7-entry catalogue Breathe.jsx now uses. This
  // screen has no pause/interrupt system of its own (unlike Breathe.jsx/
  // MorningFlow.jsx) - opening a video simply shows the existing
  // BetaVideoModal overlay; it does not pause or affect the countdown,
  // matching this page's own deliberately simple design.
  const [guidedSessionsOpen, setGuidedSessionsOpen] = useState(false);
  const {
    openVideo,
    handleSelect: handleSelectVideo,
    closeVideo,
    promptOpen,
    dismissPrompt,
    confirmSignIn: confirmSignInForVideo,
    confirmCreateAccount: confirmCreateAccountForVideo
  } = useProtectedVideo();

  const [breatheState, setBreatheState] = useState('Inhale');
  const [secondsLeft, setSecondsLeft] = useState(activePattern.totalSeconds);
  // WakeWise Phase 1 correction — same OS-or-manual-preference snapshot
  // SelfGuidedMeditation.jsx already uses for MeditationProgressRing; the
  // ring previously never read either signal at all.
  const [reducedMotion] = useState(() => {
    try {
      return Boolean(getReducedMotionPreference() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  });

  // Legacy entry-choice gate - Support's own existing, byte-for-byte
  // unchanged behaviour (see MusicEntryChoice.jsx's own doc comment).
  // Standalone mode never renders MusicEntryChoice and never reads
  // awaitingMusicChoice for its own gate - see hasBegun/canRun below.
  const [musicChoiceMade, setMusicChoiceMade] = useState(false);
  const musicPlayerRef = useRef(null);
  const musicEligible = isInteractiveMusicEligible({
    musicVariantId: INTERACTIVE_BREATHING_MUSIC_ID,
    featureEnabled: isFeatureEnabled('backgroundMusic'),
    getEntryById: getBetaVideoById
  });
  const awaitingMusicChoice = musicEligible && !musicChoiceMade;
  const handleStartWithMusic = () => {
    setMusicChoiceMade(true);
    musicPlayerRef.current?.start();
  };
  const handleContinueWithoutMusic = () => {
    setMusicChoiceMade(true);
  };

  // Build 15 — standalone mode's own real pre-start gate. Non-standalone
  // starts (and stays) true: Support's own screen has never had a
  // separate "Begin" concept - awaitingMusicChoice alone remains its
  // only gate, unchanged.
  const [hasBegun, setHasBegun] = useState(() => !standalone);
  const [musicPreferenceOn, setMusicPreferenceOn] = useState(() => {
    if (isGuest) return false;
    return musicEligible && getMusicPreference();
  });
  const handleToggleMusicPreference = () => {
    setMusicPreferenceOn((prev) => {
      const next = !prev;
      setMusicPreferenceForUser(next, { isGuest });
      return next;
    });
  };
  // Double-tap protection - see Breathe.jsx's identical rationale.
  const hasBegunOnceRef = useRef(false);

  // Build 16 physical-iPhone correction (F3/F4) — standalone mode's own
  // Begin Breathing now transitions into the shared 5-second preparation
  // countdown instead of starting the timer/music immediately - see
  // MorningFlow.jsx's identical block for the full rationale. Support's
  // own embedded (`!standalone`) usage is unaffected: it has no Begin
  // gesture at all (MusicEntryChoice is its own, deliberately unchanged
  // legacy gate - see this file's own top doc comment), so this hook is
  // simply never started from that branch.
  //
  // WakeWise DEV — Anytime Breathing silent-music fix: onComplete now
  // only unmute()s (see InteractiveAmbientMusic.jsx's own doc comment on
  // start()/unmute() for the full root-cause trace) - the real start(true)
  // call already happened synchronously in handleBeginBreathing below, at
  // the moment of the actual tap, so audio is already genuinely playing
  // (muted) by the time this fires; unmute() is a plain property set with
  // no gesture requirement of its own, safe to call from this
  // setInterval-derived callback.
  const countdown = usePreparationCountdown({
    seconds: 5,
    onComplete: () => {
      // Anytime Breathing completion correction — standalone-only: the
      // one true "start a fresh session" entry point, always creating a
      // BRAND NEW controller for whichever pattern is currently selected
      // (never reusing a previous instance across patterns/visits).
      // Non-standalone (Support) never reaches this countdown at all
      // (see handleBeginBreathing above), so sessionRef stays untouched
      // for that branch.
      sessionRef.current = createBreathingSession({ pattern: activePattern, resolveBreathPhase });
      sessionRef.current.begin();
      setSecondsLeft(sessionRef.current.getSecondsLeft());
      setBreatheState(sessionRef.current.getBreatheState());
      setIsCompleted(false);
      setCompletionGreeting(null);
      setHasBegun(true);
      if (musicEligible && musicPreferenceOn) {
        musicPlayerRef.current?.unmute();
      }
    }
  });

  // WakeWise DEV — Anytime Breathing silent-music fix: calls the REAL
  // start(true) (muted) here, synchronously within this actual tap - the
  // one genuine user gesture this screen has - instead of only preload()
  // (network fetch, no play()). A muted play() still passes iOS/WKWebView's
  // gesture-before-playback check and produces no audible sound during
  // the 5-second "get ready" countdown; onComplete above then reveals it
  // with a plain unmute() once the active breathing phase actually
  // begins. Fixes the real defect: the previous preload()-then-deferred-
  // start() shape called the REAL play() from onComplete, several seconds
  // and a setInterval/useEffect hop removed from the tap - not a
  // synchronous continuation of it - which iOS silently rejected.
  const handleBeginBreathing = () => {
    if (hasBegunOnceRef.current) return;
    hasBegunOnceRef.current = true;
    if (musicEligible && musicPreferenceOn) {
      musicPlayerRef.current?.start(true);
    }
    countdown.start();
  };

  if (EveningSceneShell && BreathingRing && InteractiveAmbientMusic && MusicEntryChoice && BreathingPatternRow && CompactSoundControl && BetaVideoModal && BetaVideoRow && SignInPromptDialog && ConfirmDialog && PreparationCountdown) { /* no-op to satisfy blind linter */ }

  // Early-end result state - declared here (ahead of `canRun`, which reads
  // it) so the countdown effect below can stop the instant an early end is
  // confirmed. See the fuller doc comment further down, by handleEndEarly.
  const [earlyEnded, setEarlyEnded] = useState(false);

  // Back/early-exit pause correction — declared here (ahead of the
  // completion-controller effect below, which reads endConfirmOpen as
  // part of its own run-gate) so it can never be accessed before
  // declaration. See handleEndEarly/handleBackFromActive further down for
  // the full doc comment on why this now exists.
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [endConfirmSource, setEndConfirmSource] = useState('back');

  // Anytime Breathing completion correction — reuses Breathe.jsx's
  // approved, physical-iPhone-tested architecture exactly. The previous
  // "Standalone completion redesign" replaced the immediate silent
  // navigate() with a distinct completion state, but that state
  // (isComplete) was still a render-time-DERIVED value (secondsLeft <=
  // 0) - the same defect class Morning/Evening breathing had before their
  // own fixes. Fix: a pure, synchronous createBreathingSession controller
  // (breathingSession.js, already journey-agnostic and real-execution
  // tested - see breathingSession.test.js) driven by ONE real interval,
  // whose own callback is the single place that detects the final tick
  // AND synchronously stops itself, stops music, picks the completion
  // greeting (Anytime tone only - see below), and flips the explicit
  // isCompleted state. Non-standalone (Support's embedded usage) is
  // completely unaffected - it keeps its own separate, unchanged interval
  // effect below, never touching sessionRef/isCompleted at all.
  const sessionRef = useRef(null);
  const intervalRef = useRef(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionGreeting, setCompletionGreeting] = useState(null);
  // Completion-transition-tuning pass — purely additive/visual; isCompleted/
  // earlyEnded themselves keep their exact original timing for every other
  // consumer. Only the render ternary below (standalone branch) swaps from
  // isCompleted || earlyEnded to showCompletionPanel - see
  // useCompletionHandoff.js's own doc comment. Fed the combined flag since
  // EITHER genuinely ends the active exercise the same way here.
  const { activeViewExiting, showCompletionPanel } = useCompletionHandoff(isCompleted || earlyEnded);
  // Back/early-exit pause correction — found live: endConfirmOpen never
  // gated the timer/music at all, so both kept running behind "End this
  // breathing session?" (the same "doesn't pause behind the dialog"
  // defect class Morning/Evening's own Back dialogs had before their
  // fixes). Captured the instant the dialog opens (handleBackFromActive/
  // handleEndEarly, below), so "Keep Breathing" can restore exactly what
  // was genuinely playing before, never a guess.
  const wasMusicPlayingRef = useRef(false);

  const stopBreathingInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };
  useEffect(() => () => stopBreathingInterval(), []);

  useEffect(() => {
    if (!standalone) return;
    if (!hasBegun || earlyEnded || isCompleted || endConfirmOpen) return;
    const session = sessionRef.current;
    if (!session) return;

    intervalRef.current = setInterval(() => {
      const current = sessionRef.current;
      if (!current) return;
      const { completed, secondsLeft: nextSecondsLeft, breatheState: nextBreatheState } = current.tick();
      setSecondsLeft(nextSecondsLeft);
      setBreatheState(nextBreatheState);
      if (completed) {
        // All completion side-effects happen synchronously, in this same
        // callback, the instant the boundary is reached - stop the
        // interval (so a stray extra tick can never fire), stop the
        // music, and enter the completed state, all in one step, exactly
        // once per real completion. Anytime Visual Flow and Closing
        // Handoff uplift (Part 11, entry-context isolation) — the new
        // rotating greeting/mint closing handoff is now gated on the
        // explicit, validated `anytimeOrigin` marker, never the merely-
        // cosmetic `journeyTone` (which also resolves to 'anytime' for an
        // unrelated reason - a Home-direct quick-action tap or a direct
        // visit during a plain midday daypart fallback, with no real
        // preserved Need/Time selection to return to). A standalone visit
        // that isn't genuinely anytimeOrigin keeps the original single
        // getBreathingAcknowledgement string and Done/Breathe again pair,
        // completely unchanged - "existing direct completion behaviour."
        stopBreathingInterval();
        musicPlayerRef.current?.stop();
        if (anytimeOrigin) {
          setCompletionGreeting(getCompletionGreeting({ journey: 'anytime', practice: 'reset' }));
        }
        setIsCompleted(true);
      }
    }, 1000);

    return () => stopBreathingInterval();
  }, [standalone, hasBegun, earlyEnded, isCompleted, endConfirmOpen, anytimeOrigin]);

  // Non-standalone (Support's embedded usage) - completely unchanged: the
  // exact original naive interval, keyed off plain secondsLeft state,
  // immediately navigating away at 0 with no distinct completion state.
  useEffect(() => {
    if (standalone) return;
    if (awaitingMusicChoice) return;

    if (secondsLeft <= 0) {
      navigate(completionRoute);
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        const nextSec = prev - 1;
        setBreatheState(resolveBreathPhase(activePattern, nextSec));
        return nextSec;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, navigate, awaitingMusicChoice, activePattern, completionRoute, standalone]);

  const handleAdvance = () => {
    navigate(completionRoute);
  };

  // Early-end result correction — found live: the bottom "End early"
  // button had NO confirmation at all and navigated straight Home with no
  // distinct result state, unlike natural completion's own "Breathing
  // complete" screen. Now opens the same confirm dialog Back already
  // uses (ending this breathing session means the same thing regardless
  // of which control asked), tracked via `endConfirmSource` (declared
  // above, alongside endConfirmOpen) so the two controls can still resolve
  // differently on confirm: Back -> straight to setup (unchanged), End
  // early -> the new `earlyEnded` result panel.
  const handleEndEarly = () => {
    wasMusicPlayingRef.current = musicPlayerRef.current?.isPlaying() ?? false;
    setEndConfirmSource('button');
    setEndConfirmOpen(true);
  };

  // "Breathe again" - returns to this same screen's own pattern-choice
  // setup, not a direct restart, per spec ("Breathe again -> standalone
  // setup"). No remount: just resets local state back to pre-start.
  // Also clears `earlyEnded` so it works identically from either result
  // panel (natural completion or early end).
  const handleBreatheAgain = () => {
    hasBegunOnceRef.current = false;
    setHasBegun(false);
    setEarlyEnded(false);
    // Mobile correction (sequential breathing-pattern completion
    // lifecycle) — defensive reset so a second/third pattern in this same
    // mount always starts from a genuinely fresh timer state, never a
    // leftover secondsLeft<=0 from the pattern just finished. Not
    // currently reachable in practice (the preparation countdown's own
    // onComplete already resets secondsLeft before hasBegun flips back to
    // true), but this is the one true "start a fresh session" entry point
    // for this screen and must never rely on that ordering elsewhere.
    setSecondsLeft(activePattern.totalSeconds);
    setBreatheState('Inhale');
    setIsCompleted(false);
    setCompletionGreeting(null);
  };

  // Standalone Home quick-action correction — Back while active, found
  // live: EveningSceneShell's shared BackButton (guardActiveRoute={false},
  // no onBeforeLeave) always resolved straight to backFallback ('/' for
  // standalone) regardless of hasBegun, so a single Back tap during active
  // breathing silently ejected the user all the way to Home mid-session -
  // never a local "stop and reconsider" action the way every embedded
  // Breathe screen (Breathe.jsx/EveningBreathing.jsx) already has via their
  // own handleBackFromActive. `onBeforeLeave` only intercepts the ordinary
  // Back path while genuinely active (hasBegun, not yet complete) -
  // returning false cancels that tap's navigation so BackButton never
  // calls goBack(); setup and the "Breathing complete" screen are
  // unaffected (this returns undefined there, so Back proceeds normally
  // to Home) - matching "Back from Breathe setup returns Home" and
  // "Back must not jump directly from active breathing to Home."
  const handleBackFromActive = () => {
    // Build 16 physical-iPhone correction (F3) — Back/Cancel during the
    // preparation countdown returns to this same pre-start screen without
    // ever marking breathing started or begun, no confirmation needed
    // (nothing has started yet).
    if (countdown.isActive) {
      countdown.cancel();
      hasBegunOnceRef.current = false;
      return false;
    }
    if (!hasBegun || isCompleted || earlyEnded) {
      // Context-aware Breathing/Meditation theming — Back from the
      // pre-start setup screen, or from the "Breathing complete"/"Session
      // ended early" result screen, is a real exit to Home. This function
      // never calls navigate() itself - EveningSceneShell's own BackButton
      // (wired to onBeforeLeave, below) performs the actual navigation
      // once this returns anything other than false - so the clear
      // happens here, synchronously, before that navigation proceeds.
      clearPracticeJourneyTone();
      return;
    }
    // Repeated-Back-tap guard — never re-capture wasMusicPlayingRef (it
    // would now read false, since the music is already suspended for the
    // open dialog) and never open a second dialog.
    if (endConfirmOpen) return false;
    wasMusicPlayingRef.current = musicPlayerRef.current?.isPlaying() ?? false;
    setEndConfirmSource('back');
    setEndConfirmOpen(true);
    return false;
  };
  // "Keep Breathing" — dismiss the dialog and resume from the exact
  // remaining time (nothing was ever reset), restoring music only if it
  // was genuinely playing before the dialog opened.
  const keepBreathing = () => {
    setEndConfirmOpen(false);
    if (wasMusicPlayingRef.current) {
      wasMusicPlayingRef.current = false;
      musicPlayerRef.current?.start();
    }
  };
  // Shared confirm handler for both sources (see `endConfirmSource` above):
  // Back always resolves straight to setup, unchanged; the bottom "End
  // early" button resolves to the new truthful `earlyEnded` result panel.
  // Neither ever records completion (never calls advanceStep/mirrors
  // anything - this screen has no Session Engine coupling at all, see this
  // file's own top doc comment).
  const handleConfirmEndSession = () => {
    setEndConfirmOpen(false);
    musicPlayerRef.current?.stop();
    wasMusicPlayingRef.current = false;
    if (endConfirmSource === 'button') {
      setEarlyEnded(true);
    } else {
      hasBegunOnceRef.current = false;
      setHasBegun(false);
    }
  };

  // WakeWise DEV — Anytime Back-navigation correction: found live -
  // BackButton's own goBack() (NavigationHistoryContext) prefers a real
  // navigate(-1) over the fallback prop whenever this app instance's own
  // in-app history stack has more than one entry - which it always does
  // once Welcome -> Anytime Reset -> Breathe has been visited - so
  // backFallback alone (however correctly computed) was silently
  // ignored, landing Back on Anytime Reset's OWN bare, state-less
  // previous history entry (step 1) instead of the preserved
  // recommendation. alwaysFallback (the same escape hatch
  // EveningComplete.jsx already uses to stop goBack from re-entering a
  // completed routine via history) forces Back straight to backFallback
  // when anytimeOrigin - an explicit marker, never navigate(-1)/browser
  // history - completely unchanged (still goBack's normal "prefer real
  // previous screen" behaviour) for a direct standalone visit.
  if (standalone) {
    return (
      <EveningSceneShell atmosphere={{ phase: 'moonlight' }} journey={journeyTone} showBack backFallback={backFallback} onBeforeLeave={handleBackFromActive} alwaysFallback={anytimeOrigin}>
        {showCompletionPanel ? (
          // "Your Momentum" foundation, Phase 3, retuned by the
          // completion-transition-tuning pass — the shared completion-
          // reveal transition. showCompletionPanel (useCompletionHandoff,
          // fed isCompleted || earlyEnded) starts false and flips true
          // exactly once per genuine end, after its own brief hold+exit-
          // fade of the active view below, so CompletionReveal's auto-
          // freshness detection applies directly. celebratory is gated on
          // isCompleted alone (never earlyEnded) - per the approved
          // brief, a real early exit gets only a plain supportive
          // cross-fade, never the completed-check scale/glow treatment
          // this same shared block also renders for a genuine completion.
          // Standalone Anytime Breathing alone is not one of the three
          // Phase 2 tracked activities, so there is no factual insight/
          // milestone to show here - this is the shared visual transition
          // only.
          isCompleted && anytimeOrigin ? (
            // Anytime Visual Flow and Closing Handoff uplift (Part 9) —
            // the shared closing handoff's own message half (badge +
            // "RESET COMPLETE" + rotating greeting + "What feels right
            // now?"). Gated on the explicit, validated `anytimeOrigin`
            // marker (Part 11), never the merely-cosmetic journeyTone.
            // Its own actions render separately below, as an early,
            // undelayed sibling - see this screen's own established
            // "keep the CTA visible/tappable early" pattern, preserved
            // exactly (AnytimeClosingHandoffActions, gated on the RAW
            // isCompleted flag alongside earlyEnded's own actions).
            <AnytimeClosingHandoffMessage active={showCompletionPanel} greeting={completionGreeting} />
          ) : (
            <CompletionReveal
              active={showCompletionPanel}
              journeyTone={journeyTone}
              celebratory={isCompleted}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
              stagger={[
                <div key="greeting" className="space-y-2">
                  <h2 className="text-2xl font-bold text-on-surface" role={isCompleted ? 'status' : undefined}>
                    {earlyEnded ? 'Session ended early' : 'Breathing complete'}
                  </h2>
                  {earlyEnded ? (
                    <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                      Your {activePattern.label} session ended before the timer finished.
                    </p>
                  ) : (
                    <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                      {getBreathingAcknowledgement(journeyTone)}
                    </p>
                  )}
                </div>
              ]}
            />
          )
        ) : countdown.isActive ? (
          // Build 16 physical-iPhone correction (F3) — shared preparation
          // countdown. Back/Cancel is handled entirely by this screen's
          // own EveningSceneShell Back (handleBackFromActive, above).
          <PreparationCountdown
            secondsRemaining={countdown.secondsRemaining}
            cue="Find a comfortable, steady position."
            onSkip={countdown.skip}
            accent={journeyTone}
          />
        ) : !hasBegun ? (
          <>
            {/* Anytime Visual Flow and Closing Handoff uplift (Part 7) —
                compact Sound control in the header area, replacing the
                large full-width MusicPreferenceToggle card, matching the
                approved Morning/Evening Breathing setup screens exactly
                (same musicPreferenceOn/handleToggleMusicPreference state -
                no second audio state). */}
            {musicEligible && (
              <div className="flex justify-end">
                <CompactSoundControl isOn={musicPreferenceOn} onToggle={handleToggleMusicPreference} journeyTone={journeyTone} />
              </div>
            )}

            <div className="text-center space-y-2">
              <span className={`font-label-sm text-xs ${getJourneyToneTokens(journeyTone).text} uppercase tracking-widest font-bold`}>Mindful Breathing</span>
              <h2 className="text-2xl font-bold text-on-surface">Choose Your Breathing Practice</h2>
              <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
                Choose a breathing rhythm, then begin when you&rsquo;re ready.
              </p>
            </div>

            {/* Anytime Visual Flow and Closing Handoff uplift (Part 7) —
                vertically stacked, full-width breathing option rows
                (matching Breathe.jsx's/EveningBreathing.jsx's own
                corrected structure), each with a real Material Symbol and
                its complete cadence/exact duration shown inline -
                BreathingPatternDescription's own separate block is no
                longer needed. The exact same five real patterns, same
                order - nothing renamed, reordered, or retimed. */}
            <div className="space-y-2" role="radiogroup" aria-label="Choose your breathing practice">
              {BREATHING_PATTERNS.map((pattern) => (
                <BreathingPatternRow
                  key={pattern.id}
                  accent={journeyTone}
                  pattern={pattern}
                  selected={selectedPatternId === pattern.id}
                  onSelect={setSelectedPatternId}
                  groupName="breathing-pattern"
                  icon={BREATHING_PATTERN_ICONS[pattern.id]}
                />
              ))}
            </div>

            {/* Anytime Visual Flow and Closing Handoff uplift (Part 7) —
                "Explore guided breathing" now sits BEFORE Begin Breathing
                (the same approved choices-first-one-obvious-primary-
                action-last order Breathe.jsx's own Phase 6 correction
                already established). Same shared catalogue, same
                guidedSessionsOpen state/content as before - only its
                position moved. */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setGuidedSessionsOpen((v) => !v)}
                aria-expanded={guidedSessionsOpen}
                aria-controls="standalone-breathe-guided-sessions"
                className="w-full flex items-center justify-between gap-3 bg-surface-container border border-white/15 rounded-2xl p-4 min-h-[44px] hover:bg-white/10 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="text-sm font-semibold text-on-surface text-left">Explore guided breathing</span>
                <span
                  className="material-symbols-outlined text-on-surface-variant transition-transform shrink-0"
                  style={{ transform: guidedSessionsOpen ? 'rotate(180deg)' : 'none' }}
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </button>
              {guidedSessionsOpen && (
                <div id="standalone-breathe-guided-sessions" className="space-y-4">
                  <div className="space-y-3">
                    {BREATHE_VIDEOS.map(({ id, blurb }) => {
                      const entry = getBetaVideoById(id);
                      if (!entry) return null;
                      return (
                        <BetaVideoRow
                          key={id}
                          title={entry.title}
                          description={blurb}
                          onClick={() => handleSelectVideo(id)}
                        />
                      );
                    })}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Breathing Sessions</h3>
                    {BREATHING_SESSION_VIDEOS.map(({ id, blurb }) => {
                      const entry = getBetaVideoById(id);
                      if (!entry) return null;
                      return (
                        <BetaVideoRow
                          key={id}
                          title={entry.title}
                          description={blurb}
                          onClick={() => handleSelectVideo(id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 w-full">
              <button
                type="button"
                onClick={handleBeginBreathing}
                className={`w-full ${getJourneyPrimaryActionClasses(journeyTone)} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg`}
              >
                <span>Begin Breathing</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </>
        ) : (
          // Completion-transition-tuning pass — the outgoing active view
          // (below) is held at full opacity during the brief hold, then
          // fades over EXIT_FADE_MS (useCompletionHandoff.js) once
          // activeViewExiting is true, rather than being unmounted the
          // instant isCompleted/earlyEnded flips true. `flex-1 flex
          // flex-col justify-between` replicates EveningSceneShell's own
          // content-container class exactly, since this wrapper div
          // (unlike the Fragment it replaces) now sits between this
          // branch's own children and that container. pointerEvents is
          // set to 'none' from the very instant isCompleted/earlyEnded is
          // true (the whole hold+exiting window) - the exercise has
          // already genuinely ended, so its own End early/video-row
          // controls must never remain tappable behind the result panel.
          <div
            className="flex-1 flex flex-col justify-between"
            style={(isCompleted || earlyEnded) ? { pointerEvents: 'none', ...(activeViewExiting ? { opacity: 0, transition: 'opacity 350ms ease-out' } : null) } : undefined}
          >
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
              <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                Just breathe. There is nowhere else to be.
              </p>

              <BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} journeyTone={journeyTone} reducedMotion={reducedMotion} />
            </div>

            <div className="space-y-3 w-full">
              {/* Standalone completion redesign — no active-phase Continue
                  (it previously allowed premature exit while misleadingly
                  implying real completion). "End early" is the only
                  early-exit action; it never claims completion - only
                  genuine natural completion (the countdown effect above)
                  reveals the "Breathing complete" screen. */}
              <button
                onClick={handleEndEarly}
                className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
              >
                End early
              </button>
            </div>

            {/* Same disclosure, reusing the same guidedSessionsOpen state -
                still reachable once the exercise is active. */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setGuidedSessionsOpen((v) => !v)}
                aria-expanded={guidedSessionsOpen}
                aria-controls="standalone-breathe-guided-sessions-active"
                className="w-full flex items-center justify-between gap-3 bg-surface-container border border-white/15 rounded-2xl p-4 min-h-[44px] hover:bg-white/10 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="text-sm font-semibold text-on-surface text-left">Explore guided breathing</span>
                <span
                  className="material-symbols-outlined text-on-surface-variant transition-transform shrink-0"
                  style={{ transform: guidedSessionsOpen ? 'rotate(180deg)' : 'none' }}
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </button>
              {guidedSessionsOpen && (
                <div id="standalone-breathe-guided-sessions-active" className="space-y-4">
                  <div className="space-y-3">
                    {BREATHE_VIDEOS.map(({ id, blurb }) => {
                      const entry = getBetaVideoById(id);
                      if (!entry) return null;
                      return (
                        <BetaVideoRow
                          key={id}
                          title={entry.title}
                          description={blurb}
                          onClick={() => handleSelectVideo(id)}
                        />
                      );
                    })}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Breathing Sessions</h3>
                    {BREATHING_SESSION_VIDEOS.map(({ id, blurb }) => {
                      const entry = getBetaVideoById(id);
                      if (!entry) return null;
                      return (
                        <BetaVideoRow
                          key={id}
                          title={entry.title}
                          description={blurb}
                          onClick={() => handleSelectVideo(id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Completion-transition-tuning pass — rendered as its own
            sibling, gated on the RAW isCompleted || earlyEnded (never
            showCompletionPanel), so these actions stay visible/tappable
            immediately per the approved brief's "keep the CTA visible/
            tappable early" - never delayed behind CompletionReveal's own
            hold+exit-fade+stagger sequence above, matching
            MorningFlow.jsx/Breathe.jsx/EveningBreathing.jsx's own
            identical pattern (their own CTA also lives outside
            CompletionReveal).
            Anytime Visual Flow and Closing Handoff uplift (Part 9/Part 10,
            Part 11 entry-context isolation) — gated on the explicit,
            validated `anytimeOrigin` marker, never the merely-cosmetic
            journeyTone. A genuine completion (isCompleted) gets the
            shared two-action AnytimeClosingHandoffActions row (Continue
            My Day / Choose Another Reset) - the same shared component
            BetaVideoModal.jsx's own overlay uses. WakeWise DEV —
            simplified Anytime completion panel: "Explore More" was
            removed from this panel entirely; Library/Explore access
            elsewhere in the app is unaffected. An honest early exit
            (earlyEnded, never isCompleted) gets the same "Choose Another
            Reset"/"Continue My Day" pair, no RESET COMPLETE styling above
            (see the CompletionReveal branch this replaces). Every other
            standalone visit (not anytimeOrigin) is completely untouched -
            same Done/Breathe again pair as before. */}
        {(isCompleted || earlyEnded) && (
          <div className="space-y-3 w-full">
            {isCompleted && anytimeOrigin ? (
              <AnytimeClosingHandoffActions
                onContinueMyDay={() => exitPracticeToHome(navigate, '/')}
                onChooseAnotherReset={() => exitPracticeToHome(navigate, anytimeResetDestination)}
              />
            ) : earlyEnded && anytimeOrigin ? (
              <>
                <button
                  type="button"
                  onClick={() => exitPracticeToHome(navigate, anytimeResetDestination)}
                  className={`w-full ${getJourneyPrimaryActionClasses('anytime')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
                >
                  <span>Choose Another Reset</span>
                </button>
                <button
                  type="button"
                  onClick={() => exitPracticeToHome(navigate, '/')}
                  className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Continue My Day
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => exitPracticeToHome(navigate, '/')}
                  className={`w-full ${getJourneyPrimaryActionClasses(journeyTone)} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
                >
                  <span>Done</span>
                </button>
                <button
                  type="button"
                  onClick={handleBreatheAgain}
                  className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Breathe again
                </button>
              </>
            )}
          </div>
        )}

        {/* Build 15 fix — a SINGLE, stable InteractiveAmbientMusic
            instance, never remounted across the pre-start -> active
            transition above - see MorningFlow.jsx's identical fix/doc
            comment for the full rationale. */}
        <InteractiveAmbientMusic
          ref={musicPlayerRef}
          musicVariantId={INTERACTIVE_BREATHING_MUSIC_ID}
          suspended={endConfirmOpen}
          hideToggle={!hasBegun || isCompleted}
        />

        {openVideo && (
          <BetaVideoModal
            entry={openVideo}
            onClose={closeVideo}
            completionContext={{ journey: 'direct', onPrimaryAction: closeVideo }}
          />
        )}
        <SignInPromptDialog
          open={promptOpen}
          onSignIn={confirmSignInForVideo}
          onCreateAccount={confirmCreateAccountForVideo}
          onDismiss={dismissPrompt}
        />
        {/* Standalone Home quick-action correction — describes ending THIS
            breathing session, never "leaving the entire Breathe feature"
            (this dialog only ever opens from an active session; Back from
            setup or the completion screen proceeds straight Home with no
            dialog at all, per handleBackFromActive above). */}
        <ConfirmDialog
          open={endConfirmOpen}
          title="End this breathing session?"
          message="Your current breathing session will end."
          confirmLabel="Leave Exercise"
          cancelLabel="Keep Breathing"
          mildDestructive
          onConfirm={handleConfirmEndSession}
          onDismiss={keepBreathing}
        />
      </EveningSceneShell>
    );
  }

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} journey="anytime" showBack backFallback={backFallback} protectedHeader>
      {awaitingMusicChoice && (
        <MusicEntryChoice
          onStartWithMusic={handleStartWithMusic}
          onContinueWithoutMusic={handleContinueWithoutMusic}
          accent="anytime"
        />
      )}

      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
        {/* Anytime Reset Visual Uplift (Phase 2 follow-up) — a small,
            decorative mint accent for this shared Gentle Reset/Support
            experience (approved: Support's identical "calming breath"
            entry may share this presentation). No new copy - BreathingRing
            below stays completely untouched/peach, per the approved brief. */}
        <span className="material-symbols-outlined text-tertiary text-3xl" aria-hidden="true">air</span>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          Just breathe. There is nowhere else to be.
        </p>

        <BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} reducedMotion={reducedMotion} />
      </div>

      <InteractiveAmbientMusic ref={musicPlayerRef} musicVariantId={INTERACTIVE_BREATHING_MUSIC_ID} />

      <div className="space-y-3 w-full">
        <button
          onClick={handleAdvance}
          className={`w-full ${getJourneyPrimaryActionClasses('anytime')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
        >
          <span>Continue</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button
          onClick={handleAdvance}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Skip
        </button>
      </div>
    </EveningSceneShell>
  );
};

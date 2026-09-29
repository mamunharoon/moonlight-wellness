/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { JourneyGlow } from '../components/JourneyGlow';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { getStepLabel } from '../lib/stepLabels';
import { BreathingRing } from '../components/BreathingRing';
import { BreathingPatternRow } from '../components/BreathingPatternRow';
import { InteractiveAmbientMusic } from '../components/InteractiveAmbientMusic';
import { CompactSoundControl } from '../components/CompactSoundControl';
import { ExercisePausedPanel } from '../components/ExercisePausedPanel';
import { ReviewModeBanner } from '../components/ReviewModeBanner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { savePausedExerciseState, loadPausedExerciseState, clearPausedExerciseState } from '../session/timedExercisePause';
import { getMusicPreference, setMusicPreferenceForUser } from '../lib/musicPreference';
import { BREATHING_PATTERNS, getBreathingPatternById, resolveBreathPhase } from '../lib/breathingPatterns';
import { BREATHE_VIDEOS, BREATHING_SESSION_VIDEOS, GUIDED_BREATHING_VIDEO_COUNT } from '../lib/guidedBreathingVideos';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { BackButton } from '../components/BackButton';
import { isFeatureEnabled } from '../lib/featureFlags';
import { isInteractiveMusicEligible } from '../lib/backgroundMusicSelection';
import { usePreparationCountdown } from '../hooks/usePreparationCountdown';
import { PreparationCountdown } from '../components/PreparationCountdown';
import { getReducedMotionPreference } from '../lib/reducedMotionPreference';
import { getBreathingCompletionGreeting, getMorningBreathingEarlyExitMessage } from '../lib/outcomeMessages';
import { createBreathingSession } from '../lib/breathingSession';
import { CompletionReveal } from '../components/CompletionReveal';
import { useCompletionHandoff } from '../hooks/useCompletionHandoff';
import { ExerciseScreenShell } from '../components/journey/ExerciseScreenShell';

// Background Music — shared with EveningBreathing.jsx/QuietBreathing.jsx/
// MorningFlow.jsx (see InteractiveAmbientMusic.jsx's own doc comment).
const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';

const DEFAULT_PATTERN_ID = 'morning';

// Morning Visual Uplift (Phase 6) — one real Material Symbol per real
// breathing pattern (BreathingPatternRow's new, additive `icon` prop),
// purely a presentation lookup keyed by the existing pattern ids from
// breathingPatterns.js - no pattern is renamed, reordered, or given a
// different cadence/timing to acquire this icon.
const BREATHING_PATTERN_ICONS = {
  morning: 'air',
  evening: 'bedtime',
  quiet: 'self_improvement',
  box: 'crop_square',
  coherent: 'waves'
};

/*
 * Build 15 — Morning Breathe pre-start screen. The three real breathing
 * cadences this app has ever shipped (BREATHING_PATTERNS, shared with
 * Evening/standalone Breathe) are now shown and selectable BEFORE
 * anything starts, defaulting to this screen's own established 4-4-6
 * pattern. A real native <input type="radio"> per pattern (via
 * BreathingPatternRow) - exactly one selected at a time.
 *
 * Video Integration: additional rows offering "Deep Breathing" and
 * "Mindful Breathing" alongside the morning routine's own breathing step
 * - reuses this exact page rather than adding a parallel breathing
 * screen. Shown to any signed-in user (guests excluded).
 *
 * Morning-flow redesign — interactive timer vs. optional guided video:
 * this screen's own Inhale/Hold/Exhale ring has no narration or audio of
 * its own (confirmed by direct audit - the rows below open a completely
 * separate, same-page BetaVideoModal, never mixed with the ring itself).
 * Selecting any row now: (1) marks videoOpenedDuringExercise so the timer
 * stops advancing and background music is suspended (via
 * InteractiveAmbientMusic's own `suspended` prop, driven by openVideo
 * directly), and (2) requires a deliberate "Resume Exercise" tap to
 * continue afterward — closing the video alone never restarts the timer
 * or the music, exactly as required.
 *
 * Guest pre-start-music correction (Build 18) — the pre-start
 * MusicPreferenceToggle below no longer routes a guest's tap to sign-in;
 * `confirmSignIn` (from useProtectedVideo, shared with this screen's own
 * guided-video sign-in prompts) is no longer passed to it at all.
 * handleToggleMusicPreference now persists through the shared
 * setMusicPreferenceForUser (musicPreference.js) so a guest's choice
 * still drives real playback this mount without ever reaching the
 * shared, device-scoped preference key. handleBeginBreathing's own
 * `&& !isGuest` guard is removed too - IB01 is server-allowlisted for
 * guests, same as every other interactive-breathing screen.
 */
export const Breathe = () => {
  const navigate = useNavigate();
  const { setJourneyStep } = useAlarm();
  // Stage 3C Group 3D Batch B: mirrors the breathe -> affirmation transition
  // into the Session Engine on genuine natural/Continue completion. See
  // mirrorBreathingExitRef below. Skip uses the canonical, separately-
  // validated skipStep() action instead (Continue-lock/Skip-semantics
  // fix) - see handleSkip.
  const { state, currentStep, advanceStep, skipStep, abandonSession, recordStepEndedEarly } = useSession();
  const { isReviewMode, isLiveStep } = useStepReviewMode('breathe', 'morning-routine');
  // isRepeatGated hidden-options defect fix — see MorningFlow.jsx's
  // identical fix for the full rationale (found live: reviewing an
  // earlier, already-passed Breathe step showed "You already completed
  // this step - Repeat?" instead of the real setup screen with all
  // pattern/music choices, blocking the approved "review the previous
  // step with setup options" behaviour). Always false now.
  const isRepeatGated = false;
  const { isGuest } = useAuth();

  // Pause-and-resume-exact-state fix - see MorningFlow.jsx's identical
  // block for the full rationale (session/timedExercisePause.js). Build
  // 15: the snapshot now also carries which pattern was selected and
  // whether music was enabled.
  const [pausedSnapshot] = useState(() => loadPausedExerciseState('morning-routine', 'breathe'));
  useEffect(() => {
    if (pausedSnapshot) clearPausedExerciseState('morning-routine', 'breathe');
  }, [pausedSnapshot]);

  // Review-mode auto-start defect fix — a pausedSnapshot only represents
  // a genuine "I left THIS exact live step mid-run to review something
  // else" resume. If this mount is not currently the live step
  // (isLiveStep false - e.g. arrived here via an ordinary Back/forward
  // navigation while a stale, un-consumed snapshot from an earlier,
  // unrelated interrupted round-trip still sits in sessionStorage), it
  // must never be trusted to auto-restore an already-active exercise
  // with no setup/pattern choices shown - found live on Evening's
  // identical mechanism ("Back from Meditation opened an already-running
  // Breathing countdown"). The raw snapshot is still read and cleared
  // unconditionally above so a stale one can never resurface later
  // either way; only TRUSTED for seeding initial UI state when
  // isLiveStep is true at mount.
  const trustedSnapshot = isLiveStep ? pausedSnapshot : null;

  // Build 15 — pattern selection, pre-start only. Defaults to Morning's
  // own established 4-4-6 pattern.
  const [selectedPatternId, setSelectedPatternId] = useState(() => trustedSnapshot?.patternId ?? DEFAULT_PATTERN_ID);
  // Release-quality guided-breathing discoverability — one collapsed-by-
  // default disclosure combining both video collections, mirroring
  // MorningFlow.jsx's own "Explore guided stretching sessions" pattern:
  // never forced open by Begin, reachable both pre-start and once the
  // exercise is active (preserving the existing interrupt-to-watch
  // affordance).
  const [guidedSessionsOpen, setGuidedSessionsOpen] = useState(false);
  const activePattern = getBreathingPatternById(selectedPatternId) ?? BREATHING_PATTERNS[0];

  // hasBegun: false until the user explicitly taps "Begin Breathing" -
  // true immediately when resuming from a TRUSTED paused snapshot (this
  // genuinely is the live step being returned to).
  const [hasBegun, setHasBegun] = useState(() => Boolean(trustedSnapshot));

  const { requestReview, confirmLeave, cancelLeave, isConfirming, routeForStep } = useReviewNavigation({
    sessionId: 'morning-routine',
    isLiveStep,
    hasUnsavedProgress: true,
    onLeaveLiveStep: () => savePausedExerciseState('morning-routine', 'breathe', {
      secondsLeft,
      breatheState,
      patternId: selectedPatternId,
      musicEnabled: musicPreferenceOn
    })
  });
  const [breatheState, setBreatheState] = useState(() => trustedSnapshot?.breatheState ?? 'Inhale');
  const [secondsLeft, setSecondsLeft] = useState(() => trustedSnapshot?.secondsLeft ?? activePattern.totalSeconds);
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
  // Morning-flow redesign: set the moment any guided-video row is tapped
  // (from that same click handler, never from an effect), never cleared
  // automatically — only the deliberate "Resume Exercise" tap clears it.
  const [videoOpenedDuringExercise, setVideoOpenedDuringExercise] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(() => Boolean(trustedSnapshot));
  const isInterrupted = videoOpenedDuringExercise || manuallyPaused;
  const {
    openVideo,
    handleSelect,
    closeVideo,
    promptOpen,
    dismissPrompt,
    confirmSignIn,
    confirmCreateAccount
  } = useProtectedVideo();

  if (ProgressIndicator) { /* no-op to satisfy blind linter */ }
  if (BreathingRing && BetaVideoModal && BetaVideoRow) { /* no-op to satisfy blind linter */ }

  const musicPlayerRef = useRef(null);
  // Build 16 physical-iPhone correction (F6) — captures whether music was
  // genuinely playing at the exact moment an interruption begins (before
  // `suspended` pauses it below), so the single Resume action can restore
  // the same choice automatically. See ExercisePausedPanel.jsx's own doc
  // comment for the full rationale.
  const wasMusicPlayingRef = useRef(false);

  const handlePauseExercise = () => {
    wasMusicPlayingRef.current = musicPlayerRef.current?.isPlaying() ?? false;
    setManuallyPaused(true);
  };

  const handleSelectVideo = (id) => {
    wasMusicPlayingRef.current = musicPlayerRef.current?.isPlaying() ?? false;
    setVideoOpenedDuringExercise(true);
    handleSelect(id);
  };

  const handleResume = () => {
    setVideoOpenedDuringExercise(false);
    setManuallyPaused(false);
    if (wasMusicPlayingRef.current) {
      wasMusicPlayingRef.current = false;
      musicPlayerRef.current?.start();
    }
  };

  const musicEligible = isInteractiveMusicEligible({
    musicVariantId: INTERACTIVE_BREATHING_MUSIC_ID,
    featureEnabled: isFeatureEnabled('backgroundMusic'),
    getEntryById: getBetaVideoById
  });

  // Build 15 — a real pre-start preference, safe to seed from the
  // persisted cross-app preference now that Begin Breathing is a genuine
  // mandatory gesture before any playback - see MorningFlow.jsx's
  // identical rationale.
  const [musicPreferenceOn, setMusicPreferenceOn] = useState(() => {
    if (trustedSnapshot) return Boolean(trustedSnapshot.musicEnabled);
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

  // Stage 3C Group 3D Batch B: one-shot guard for the Session Engine
  // mirror only.
  const hasMirroredExitRef = useRef(false);
  const mirrorBreathingExitRef = useRef(() => {});
  useEffect(() => {
    mirrorBreathingExitRef.current = () => {
      if (hasMirroredExitRef.current) return;
      hasMirroredExitRef.current = true;
      if (state.status === 'playing' && currentStep?.id === 'breathe') {
        advanceStep();
      }
    };
  }, [state.status, currentStep, advanceStep]);

  // Morning breathing completion correction — physical-iPhone defect:
  // after reaching 0s left, the screen stayed in the active exercise
  // state (ring still visible, no completion panel, no Continue). Root
  // cause: completion was a render-time-DERIVED value (secondsLeft <= 0,
  // computed fresh every render) rather than a single, authoritative
  // decision made the instant the timer actually reaches the boundary -
  // whether that render-then-effect round trip ever completed in time on
  // a real device could not be verified or guaranteed. Replaced with the
  // exact proven shape useMeditationSession.js/meditationSession.js
  // already use: a pure, synchronous createBreathingSession controller
  // (breathingSession.js, real-execution tested with no fake timers -
  // see breathingSession.test.js) driven by ONE real interval, whose own
  // callback is the single place that detects the final tick AND
  // synchronously stops itself, stops music, and flips isCompleted -
  // zero renders/effects in between. isCompleted is explicit React state
  // (never re-derived), so "reached 0" and "app decided completion
  // happened" are the same instant, not two separately-timed events.
  const sessionRef = useRef(null);
  const intervalRef = useRef(null);
  const [isCompleted, setIsCompleted] = useState(false);
  // Completion-transition-tuning pass — purely additive/visual; isCompleted
  // itself (above) keeps its exact original timing for every other
  // consumer. Only the render ternary below swaps from isCompleted to
  // showCompletionPanel - see useCompletionHandoff.js's own doc comment.
  const { activeViewExiting, showCompletionPanel } = useCompletionHandoff(isCompleted);
  // Picked exactly once, the instant natural completion is detected
  // (inside the interval callback below) - never recomputed on
  // re-render, and never touched by Skip/Exit/interruption, which never
  // set isCompleted at all.
  const [completionGreeting, setCompletionGreeting] = useState(null);

  // Morning breathing Back/early-exit correction — pressing the top Back
  // button during an active exercise previously reset everything
  // immediately with ZERO confirmation (found live). backConfirmOpen
  // gates the same interval-management effect below and
  // InteractiveAmbientMusic's own `suspended` prop, exactly like the
  // pre-existing "Review an earlier step?" dialog (isConfirming) already
  // does - so the timer/animation/music all genuinely pause the instant
  // this dialog opens, not just visually. earlyExitMessage is picked
  // exactly once when the user confirms "Leave Exercise" and shown on
  // the pre-start/selection screen - never blocking, never touched by
  // natural completion or Skip.
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);
  const [earlyExitMessage, setEarlyExitMessage] = useState(null);

  const stopBreathingInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Covers unmount and any navigation away from this screen (Continue/
  // Skip/Exit/Back) - the one place that guarantees the interval is
  // never left running behind a screen the user is no longer on.
  useEffect(() => () => stopBreathingInterval(), []);

  useEffect(() => {
    // Nothing runs until hasBegun (or a genuine resume from a paused
    // snapshot, which already implies hasBegun=true), and never again
    // once isCompleted - a completed session's own controller is
    // terminal (breathingSession.js's tick() is a permanent no-op after
    // completion), so this guard is defence-in-depth, not the primary
    // idempotency mechanism. Pause-during-review fix - freeze the
    // countdown the instant the confirmation dialog opens, not only
    // after the user confirms.
    // Morning breathing Back/early-exit correction - backConfirmOpen
    // freezes the timer the same way while the new "Leave this breathing
    // exercise?" dialog is open.
    if (!hasBegun || isInterrupted || isRepeatGated || isConfirming || isCompleted || backConfirmOpen) return;
    const session = sessionRef.current;
    if (!session) return;

    intervalRef.current = setInterval(() => {
      const current = sessionRef.current;
      if (!current) return;
      const { completed, secondsLeft: nextSecondsLeft, breatheState: nextBreatheState } = current.tick();
      setSecondsLeft(nextSecondsLeft);
      setBreatheState(nextBreatheState);
      if (completed) {
        // All three completion side-effects happen synchronously, in
        // this same callback, the instant the boundary is reached -
        // stop the interval (so a stray extra tick can never fire),
        // stop the music, and enter the completed state, all in one
        // step, exactly once per real completion.
        stopBreathingInterval();
        musicPlayerRef.current?.stop();
        setCompletionGreeting(getBreathingCompletionGreeting('morning'));
        setIsCompleted(true);
      }
    }, 1000);

    return () => stopBreathingInterval();
  }, [hasBegun, isInterrupted, isRepeatGated, isConfirming, isCompleted, backConfirmOpen]);

  // Double-tap protection: a ref, checked and set before anything else
  // runs - see MorningFlow.jsx's identical rationale.
  const hasBegunOnceRef = useRef(false);

  // WakeWise DEV — Morning Breathing silent-music fix. Root cause (traced
  // live, same defect class already found and fixed for Anytime Breathing/
  // Morning Stretch - see InteractiveAmbientMusic.jsx's own start()/unmute()
  // doc comment for the full root-cause trace): handleBeginBreathing used to
  // call only preload() (a network fetch, never touching playback) and
  // deferred the real, audible start() call to this onComplete - which
  // fires from usePreparationCountdown's own setInterval tick + effect, 5
  // REAL SECONDS after the Begin tap, not a synchronous continuation of it.
  // iOS/WKWebView's gesture-before-unmuted-playback rule does not survive
  // that gap, so audio.play() was silently rejected.
  //
  // Fix: onComplete now only unmute()s - the real start(true) call already
  // happened synchronously in handleBeginBreathing below, at the moment of
  // the actual tap, so audio is already genuinely playing (muted) by the
  // time this fires; unmute() is a plain property set with no gesture
  // requirement of its own, safe to call from this setInterval-derived
  // callback.
  const countdown = usePreparationCountdown({
    seconds: 5,
    onComplete: () => {
      // Sequential-pattern correctness — the one true "start a fresh
      // session" entry point: always creates a BRAND NEW controller for
      // whichever pattern is currently selected, never reusing a
      // previous instance. This is what guarantees the 2nd/3rd pattern
      // completed in the same mounted visit behaves identically to the
      // 1st - no leftover elapsed time, no leftover COMPLETED status,
      // from whichever pattern finished last.
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

  // WakeWise DEV — Morning Breathing silent-music fix (see the countdown's
  // own doc comment above for the full root-cause trace). Calls the REAL
  // start(true) (muted) here, synchronously within this actual tap - the
  // one genuine user gesture this screen has - instead of only preload()
  // (network fetch, no play()). A muted play() still passes iOS/WKWebView's
  // gesture-before-playback check and produces no audible sound during the
  // 5-second "get ready" countdown; the countdown's own onComplete then
  // reveals it with a plain unmute() once the active breathing phase
  // actually begins.
  const handleBeginBreathing = () => {
    if (hasBegunOnceRef.current) return;
    hasBegunOnceRef.current = true;
    if (musicEligible && musicPreferenceOn) {
      musicPlayerRef.current?.start(true);
    }
    countdown.start();
  };

  // Only reachable once isCompleted (Continue to Meditate is hidden until
  // then, see render below) - records genuine completion and advances.
  const handleComplete = () => {
    setJourneyStep('meditate');
    navigate('/morning-meditate');
    mirrorBreathingExitRef.current();
  };

  // Continue-lock/Skip-semantics fix — Skip is the explicit early-exit
  // action while still running (or at any point), genuinely distinct from
  // Continue/natural completion: it calls the Session Engine's own
  // canonical skipStep() (validated against currentStep.skippable and
  // 'playing' status by the reducer itself) rather than the
  // completion-mirror's advanceStep(), so it can never be recorded as
  // completing the step.
  const handleSkip = () => {
    setJourneyStep('meditate');
    navigate('/morning-meditate');
    skipStep();
  };

  // Dialog-severity correction — previously exited immediately with zero
  // confirmation, despite being the more final of this screen's two exit
  // paths: abandonSession() marks the whole session SKIPPED, a terminal
  // status routineCardState.js deliberately never resurfaces as
  // "resume?" - unlike Back/Close's own mildDestructive-confirmed
  // interruptSession() (handleBackFromActive/BackButton's guard), which
  // IS resumable. Reuses the existing shared ConfirmDialog rather than a
  // new component; mildDestructive (same tier as Back/Close) since only
  // this step's temporary, unsaved progress is lost - never saved
  // history - and the action itself is completely unchanged, just now
  // confirmed first.
  const [exitRoutineConfirmOpen, setExitRoutineConfirmOpen] = useState(false);
  const handleExitRoutine = () => setExitRoutineConfirmOpen(true);
  const confirmExitRoutine = () => {
    setExitRoutineConfirmOpen(false);
    setJourneyStep('');
    navigate('/');
    if (state.status === 'playing' && currentStep?.id === 'breathe') abandonSession();
  };

  // Back-navigation repair (Morning canonical map) — Active Breathe Back
  // must safely stop breathing and return to THIS step's own pre-start
  // screen, never straight to Stretch and never the whole-routine "Leave
  // this routine?" confirmation (guardActiveRoute is off on this screen's
  // BackButton below - only Skip/Exit still leave the routine outright).
  // A subsequent Back tap, once hasBegun is false again, falls through to
  // BackButton's own ordinary previous-step navigation. Pre-start (and the
  // gated repeat-intro) are untouched - only a genuinely active run is
  // ever stopped here. Mirrors MorningFlow.jsx's identical handler.
  const handleBackFromActive = () => {
    // Build 16 physical-iPhone correction (F3) — Back/Cancel during the
    // preparation countdown returns to this same pre-start screen without
    // ever marking breathing started or begun.
    if (countdown.isActive) {
      countdown.cancel();
      hasBegunOnceRef.current = false;
      return false;
    }
    if (!hasBegun || isRepeatGated) return;
    // Morning breathing Back/early-exit correction — Back from the
    // COMPLETED panel is ordinary navigation, never an early exit: the
    // exercise already finished, so this must never open the "Leave this
    // breathing exercise?" dialog or touch isCompleted/completionGreeting
    // (leaving after completing must not change the completed outcome to
    // ended_early). Falls through to BackButton's own normal navigation.
    if (isCompleted) return;
    // Repeated-Back-tap guard — if the dialog is already open, do
    // nothing: in particular, never re-capture wasMusicPlayingRef (it
    // would now read false, since the music is already suspended for
    // the open dialog, wrongly clobbering the real pre-dialog value) and
    // never open a second dialog.
    if (backConfirmOpen) return false;
    // Previously: reset everything immediately with ZERO confirmation
    // (found live). Now: capture whether music was genuinely playing
    // BEFORE the dialog suspends it (same pattern as
    // handlePauseExercise/handleSelectVideo above), then just open the
    // dialog - the timer/animation/music all pause via the interval
    // effect's/InteractiveAmbientMusic's own backConfirmOpen gate above,
    // never reset, until the user actually chooses Leave Exercise.
    wasMusicPlayingRef.current = musicPlayerRef.current?.isPlaying() ?? false;
    setBackConfirmOpen(true);
    return false;
  };

  // "Keep Breathing" — dismiss the dialog and resume from the exact
  // remaining time (nothing was ever reset), restoring music only if it
  // was genuinely playing before the dialog opened.
  const keepBreathing = () => {
    setBackConfirmOpen(false);
    if (wasMusicPlayingRef.current) {
      wasMusicPlayingRef.current = false;
      musicPlayerRef.current?.start();
    }
  };

  // "Leave Exercise" — the one true confirmed-early-exit path: stops and
  // disposes of the timer/session/music, records nothing (never calls
  // mirrorBreathingExitRef/advanceStep - this is Skip's canonical
  // completion-mirror path, not this one's), and shows one stable,
  // honest, non-celebratory message on the pre-start screen the user
  // lands back on.
  const leaveExercise = () => {
    setBackConfirmOpen(false);
    recordStepEndedEarly();
    hasBegunOnceRef.current = false;
    setVideoOpenedDuringExercise(false);
    setManuallyPaused(false);
    stopBreathingInterval();
    sessionRef.current?.end();
    sessionRef.current = null;
    setBreatheState('Inhale');
    setSecondsLeft(activePattern.totalSeconds);
    setIsCompleted(false);
    setCompletionGreeting(null);
    setEarlyExitMessage(getMorningBreathingEarlyExitMessage());
    setHasBegun(false);
    musicPlayerRef.current?.stop();
    wasMusicPlayingRef.current = false;
  };

  return (
    // Physical-iPhone correction — Morning Breathing's own Back/Sound row
    // and ProgressIndicator now live in ExerciseScreenShell's dedicated,
    // non-scrolling `header` slot (opaque, safe-area-aware, divider below)
    // instead of ordinary in-flow children of the one scrollable region -
    // see MorningFlow.jsx's identical fix/doc comment for the full root
    // cause. Setup, prep countdown, and active phase all still share this
    // one shell (single-return structure, unchanged).
    <ExerciseScreenShell
      journeyTone="morning"
      header={
        <>
          {/* Morning Visual Uplift (Phase 6) — compact Sound control,
              top-right, replacing the large full-width Background Music
              card below. Same musicPreferenceOn/handleToggleMusicPreference
              state as before - no second audio state. Hidden once hasBegun
              (InteractiveAmbientMusic renders its own toggle once active)
              and during the preparation countdown - matching the original
              MusicPreferenceToggle's own pre-start-only scope. */}
          <div className="flex items-center justify-between gap-3">
            <BackButton fallback="/morning-flow" guardActiveRoute={false} onBeforeLeave={handleBackFromActive} />
            {musicEligible && !hasBegun && !countdown.isActive && (
              <CompactSoundControl isOn={musicPreferenceOn} onToggle={handleToggleMusicPreference} journeyTone="morning" />
            )}
          </div>
          <ProgressIndicator activeStep="breathe" onReviewStep={requestReview} />

          {isReviewMode && currentStep && (
            <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
          )}
        </>
      }
    >
    <div className="flex flex-col space-y-5 select-none">
      {/* WakeWise DEV — colour glow extension: Morning's Breathe step
          (setup, prep countdown, and active phase all share this one
          root - see this file's own single-return structure). */}
      <JourneyGlow journey="morning" />

      {/* Build 16 physical-iPhone correction (F3) — shared preparation
          countdown, shown in place of the pre-start/active content below
          while running. Back/Cancel is handled entirely by this screen's
          own header BackButton above (handleBackFromActive). */}
      {countdown.isActive && (
        <PreparationCountdown
          secondsRemaining={countdown.secondsRemaining}
          cue="Find a comfortable, steady position."
          onSkip={countdown.skip}
          accent="morning"
        />
      )}

      {!countdown.isActive && (!hasBegun ? (
        <>
          {/* Build 15 — pre-start pattern selection. Nothing below this
              point runs a timer, animation, or plays music - see
              handleBeginBreathing above for the one gesture that starts
              all three together. */}
          <div className="text-center space-y-1.5">
            <span className="font-label-sm text-xs text-morning-accent uppercase tracking-widest font-bold">Mindful Breathing</span>
            <h2 className="text-2xl font-bold text-on-surface font-morning-display italic">Choose Your Breath</h2>
            <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
              Choose a rhythm that feels right.
            </p>
          </div>

          {/* Morning breathing Back/early-exit correction — a short,
              honest, non-celebratory acknowledgement after a confirmed
              early exit (Back -> Leave Exercise). Purely informational,
              never blocking: every control below (pattern choice, Begin,
              Skip, Exit) remains immediately usable underneath it. */}
          {earlyExitMessage && (
            <p className="text-xs text-center text-on-surface-variant glass-panel rounded-2xl py-2.5 px-4" role="status">
              {earlyExitMessage}
            </p>
          )}

          {/* Morning Visual Uplift (Phase 6) — vertically stacked,
              scannable breathing option cards (BreathingPatternRow's
              full-width, non-compact row, now with a real Material Symbol
              per pattern), replacing the compact 2-column grid. Each row
              already shows the pattern's complete cadence and exact
              duration inline (formatCadence/formatBreathingDuration), so
              the separate BreathingPatternDescription block below the grid
              is no longer needed - its information is never duplicated.
              The exact same five real patterns, in their existing order -
              nothing renamed, reordered, or retimed. */}
          <div className="space-y-2" role="radiogroup" aria-label="Choose your breathing practice">
            {BREATHING_PATTERNS.map((pattern) => (
              <BreathingPatternRow
                key={pattern.id}
                pattern={pattern}
                selected={selectedPatternId === pattern.id}
                onSelect={setSelectedPatternId}
                groupName="breathing-pattern"
                accent="morning"
                icon={BREATHING_PATTERN_ICONS[pattern.id]}
              />
            ))}
          </div>

          {/* Release-quality guided-breathing discoverability — collapsed
              by default, mirrors PrepareForRest.jsx's own "Choose a
              bedtime video or sleep sound" precedent: aria-expanded/
              aria-controls, never navigates. Morning Visual Uplift (Phase
              6) — moved above Begin Breathing (the approved Stitch-
              direction order: choices first, one obvious primary action
              last); same guidedSessionsOpen state/content as before, only
              its position moved. */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setGuidedSessionsOpen((v) => !v)}
              aria-expanded={guidedSessionsOpen}
              aria-controls="breathe-guided-sessions"
              className="w-full flex items-center justify-between gap-3 bg-surface-container border border-white/15 rounded-2xl p-4 min-h-[44px] hover:bg-white/10 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="text-sm font-semibold text-on-surface text-left">Explore guided breathing sessions — {GUIDED_BREATHING_VIDEO_COUNT} available</span>
              <span
                className="material-symbols-outlined text-on-surface-variant transition-transform shrink-0"
                style={{ transform: guidedSessionsOpen ? 'rotate(180deg)' : 'none' }}
                aria-hidden="true"
              >
                expand_more
              </span>
            </button>
            {guidedSessionsOpen && (
              <div id="breathe-guided-sessions" className="space-y-4">
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
              className={`w-full ${getJourneyPrimaryActionClasses('morning')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg`}
            >
              <span>Begin Breathing</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
            {/* Morning journey UX correction — Skip has no meaning while
                reviewing an already-completed Breathe from a later step
                (Meditate/Affirm): the ReviewModeBanner's own "Return to
                [current step]" above already covers that, and "remains
                available only before the activity has ever been started in
                that forward visit" excludes review entirely. The
                whole-routine exit link below stays available either way -
                leaving the routine is valid regardless of review state,
                matching MorningMeditate.jsx's identical precedent. */}
            {!isReviewMode && (
              <button
                onClick={handleSkip}
                className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
              >
                Skip this step
              </button>
            )}
            <button
              onClick={handleExitRoutine}
              className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors -my-1.5 py-3.5"
            >
              Exit routine
            </button>
          </div>
        </>
      ) : showCompletionPanel ? (
        // Morning breathing completion correction — a genuine dedicated
        // completed panel, replacing the active exercise interface
        // entirely (ring, the active screen's own heading copy, pattern-
        // label pill are ALL gone here, not just overlaid) so there is
        // never any doubt
        // the exercise is over. Warm-gold visual language reused from
        // this app's own existing tokens (IntentionSetup.jsx/
        // SessionComplete.jsx's own bg-morning-accent/10 + border-
        // morning-accent-tint/25 + shadow-morning-glow badge shape) -
        // never a new colour, never a literal Stitch copy.
        // "Your Momentum" foundation, Phase 3, retuned by the
        // completion-transition-tuning pass — the shared completion-
        // reveal transition. showCompletionPanel (useCompletionHandoff)
        // starts false and flips true exactly once per genuine
        // completion, after its own brief hold+exit-fade of the active
        // view below, so CompletionReveal's auto-freshness detection
        // applies directly - no explicit isFresh needed, matching every
        // other ternary-swap screen. Morning Breathing alone is not one
        // of the three Phase 2 tracked activities (only the full Morning
        // routine is), so there is no factual insight/milestone to show
        // here - this is the shared visual transition only.
        <CompletionReveal
          active={showCompletionPanel}
          journeyTone="morning"
          className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
          stagger={[
            <div key="badge" className="w-20 h-20 rounded-full bg-morning-accent/10 border border-morning-accent-tint/25 shadow-morning-glow flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-morning-accent text-4xl" aria-hidden="true">check_circle</span>
            </div>,
            <div key="greeting" className="space-y-2">
              <span className="font-label-sm text-xs text-morning-accent uppercase tracking-widest font-bold">Exercise Completed</span>
              <h2 className="text-2xl font-bold text-on-surface font-morning-display italic max-w-xs mx-auto" role="status">
                {completionGreeting}
              </h2>
              <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                Take this steadiness with you as you continue your morning.
              </p>
            </div>
          ]}
        />
      ) : (
        // Completion-transition-tuning pass — the outgoing active view
        // (below) is held at full opacity during the brief hold, then
        // fades over EXIT_FADE_MS (useCompletionHandoff.js) once
        // activeViewExiting is true, rather than being unmounted the
        // instant isCompleted flips true. `space-y-5` replicates the
        // outer page container's own spacing class exactly, since this
        // wrapper div (unlike the Fragment it replaces) now sits between
        // this branch's own children and that container.
        // pointerEvents is set to 'none' from the very instant isCompleted
        // is true (the whole hold+exiting window) - the exercise has
        // already genuinely finished, so its own controls must never
        // remain tappable behind the completion panel.
        <div
          className="space-y-5"
          style={isCompleted ? { pointerEvents: 'none', ...(activeViewExiting ? { opacity: 0, transition: 'opacity 350ms ease-out' } : null) } : undefined}
        >
          <div className="text-center space-y-2">
            <span className="font-label-sm text-xs text-morning-accent uppercase tracking-widest font-bold">Grounding Exercise</span>
            <h2 className="text-2xl font-bold text-on-surface font-morning-display italic">Center Yourself</h2>
            <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
              Bring your attention to the present before the day becomes busy.
            </p>
          </div>

          {/* Breathing Ring Visualizer — src/components/BreathingRing.jsx */}
          <BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} journeyTone="morning" reducedMotion={reducedMotion} />

          <div className="text-center space-y-2">
            <span className="text-[10px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-on-surface-variant/80 font-bold uppercase tracking-wider">
              {activePattern.supportingLabel ? `${activePattern.supportingLabel} (${activePattern.label})` : activePattern.label}
            </span>
          </div>
        </div>
      ))}

      {/* Build 15 fix — a SINGLE, stable InteractiveAmbientMusic instance,
          never remounted across the pre-start -> active transition - see
          MorningFlow.jsx's identical fix/doc comment for the full
          rationale (a ref-triggered start() on an instance that's about
          to unmount orphans the audio element). */}
      {!isRepeatGated && (
        <InteractiveAmbientMusic
          ref={musicPlayerRef}
          musicVariantId={INTERACTIVE_BREATHING_MUSIC_ID}
          suspended={hasBegun ? (isCompleted || Boolean(openVideo) || manuallyPaused || backConfirmOpen) : false}
          hideToggle={!hasBegun || isCompleted}
        />
      )}

      {hasBegun && !isRepeatGated && !isCompleted && isInterrupted && !openVideo && (
        <ExercisePausedPanel onResume={handleResume} journeyTone="morning" />
      )}

      {/* Morning breathing completion correction — Pause Exercise
          previously had no !isCompleted guard at all, so it kept
          rendering (nonsensically - pausing a finished exercise) right
          where the completion panel now takes over instead. */}
      {hasBegun && !isRepeatGated && !isCompleted && !isInterrupted && !openVideo && (
        <button
          type="button"
          onClick={handlePauseExercise}
          className="w-full py-4 glass-panel text-on-surface rounded-full font-bold flex items-center justify-center gap-2 border-white/10"
        >
          <span className="material-symbols-outlined text-sm">pause</span>
          <span>Pause Exercise</span>
        </button>
      )}

      {/* Same "Explore guided breathing sessions" disclosure as the
          pre-start screen, reusing the same guidedSessionsOpen state -
          opening it before Begin and then starting the exercise never
          silently closes it. Only rendered once the exercise is active;
          the pre-start branch above already renders its own copy while
          !hasBegun. Still reachable mid-exercise, preserving the
          existing interrupt-to-watch affordance handleSelectVideo
          already provides. Gated on !isCompleted - the completed panel
          below has its own, optional "Explore guided breathing" entry
          point instead, reusing this same guidedSessionsOpen state. */}
      {hasBegun && !isRepeatGated && !isCompleted && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setGuidedSessionsOpen((v) => !v)}
            aria-expanded={guidedSessionsOpen}
            aria-controls="breathe-guided-sessions-active"
            className="w-full flex items-center justify-between gap-3 bg-surface-container border border-white/15 rounded-2xl p-4 min-h-[44px] hover:bg-white/10 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="text-sm font-semibold text-on-surface text-left">Explore guided breathing sessions — {GUIDED_BREATHING_VIDEO_COUNT} available</span>
            <span
              className="material-symbols-outlined text-on-surface-variant transition-transform shrink-0"
              style={{ transform: guidedSessionsOpen ? 'rotate(180deg)' : 'none' }}
              aria-hidden="true"
            >
              expand_more
            </span>
          </button>
          {guidedSessionsOpen && (
            <div id="breathe-guided-sessions-active" className="space-y-4">
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
      )}

      {hasBegun && !isRepeatGated && (
        <div className="space-y-3 w-full">
          {/* Duplicate-return-action fix, found live: reviewing Breathe
              from a later step (e.g. Meditate/Affirm) and then tapping
              "Begin Breathing" to replay it used to show BOTH the
              ReviewModeBanner's own "Return to X" (top, always rendered
              whenever isReviewMode) AND this identical button here -
              two controls doing the exact same thing on screen at once.
              The banner already covers it; nothing replaces this branch
              while reviewing (Skip/Exit were already hidden here too, for
              the same reason - reviewing never exposes them). */}
          {!isReviewMode && (
            <>
              {isCompleted ? (
                <>
                  {/* Morning breathing completion correction — the
                      required primary action, gated purely on the new
                      explicit isCompleted state (never derived, never
                      shown for Skip/Exit/interrupted). Tapping it is the
                      one place completion is ever mirrored into the
                      Session Engine (handleComplete, unchanged) - exactly
                      once, guarded by hasMirroredExitRef. */}
                  <button
                    onClick={handleComplete}
                    className={`w-full ${getJourneyPrimaryActionClasses('morning')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg`}
                  >
                    <span>Continue to Meditate</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                  {/* Optional secondary action (approved brief) - reuses
                      the exact same guidedSessionsOpen state/disclosure
                      content as the active screen's own entry point,
                      just rendered inline here instead, so opening it
                      never competes with Continue to Meditate for
                      attention above the fold. */}
                  <button
                    type="button"
                    onClick={() => setGuidedSessionsOpen((v) => !v)}
                    aria-expanded={guidedSessionsOpen}
                    aria-controls="breathe-guided-sessions-completed"
                    className="w-full glass-panel text-on-surface-variant py-3.5 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
                  >
                    Explore guided breathing
                  </button>
                  {guidedSessionsOpen && (
                    <div id="breathe-guided-sessions-completed" className="space-y-4 pt-1">
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
                  <button
                    onClick={handleExitRoutine}
                    className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors -my-1.5 py-3.5"
                  >
                    Exit routine
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleSkip}
                    className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
                  >
                    Skip this step
                  </button>
                  <button
                    onClick={handleExitRoutine}
                    className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors -my-1.5 py-3.5"
                  >
                    Exit routine
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {openVideo && (
        <BetaVideoModal
          entry={openVideo}
          onClose={closeVideo}
          completionContext={{ journey: 'morning', onPrimaryAction: closeVideo, onSecondaryAction: closeVideo }}
        />
      )}
      <SignInPromptDialog
        open={promptOpen}
        onSignIn={confirmSignIn}
        onCreateAccount={confirmCreateAccount}
        onDismiss={dismissPrompt}
      />
      <ConfirmDialog
        open={isConfirming}
        title="Review an earlier step?"
        message="Your current exercise will be paused."
        confirmLabel="Review Step"
        cancelLabel="Cancel"
        onConfirm={confirmLeave}
        onDismiss={cancelLeave}
      />
      <ConfirmDialog
        open={exitRoutineConfirmOpen}
        title="Exit this routine?"
        message="You'll leave without finishing today's Morning routine - it won't be saved to resume later."
        confirmLabel="Exit Routine"
        cancelLabel="Stay"
        mildDestructive
        onConfirm={confirmExitRoutine}
        onDismiss={() => setExitRoutineConfirmOpen(false)}
      />
      {/* Morning breathing Back/early-exit correction — mild warning
          (temporary, resumable progress lost; no saved history erased),
          matching every other "exit an active session" dialog in this
          app's own approved severity tier. Keep Breathing dismisses with
          zero state change (nothing was ever reset); Leave Exercise is
          the one confirmed early-exit path (leaveExercise, above). */}
      <ConfirmDialog
        open={backConfirmOpen}
        title="Leave this breathing exercise?"
        message="Your progress in this exercise won’t be completed."
        confirmLabel="Leave Exercise"
        cancelLabel="Keep Breathing"
        mildDestructive
        onConfirm={leaveExercise}
        onDismiss={keepBreathing}
      />
    </div>
    </ExerciseScreenShell>
  );
};

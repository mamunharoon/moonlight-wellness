/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { InteractiveAmbientMusic } from '../components/InteractiveAmbientMusic';
import { MusicPreferenceToggle } from '../components/MusicPreferenceToggle';
import { ExercisePausedPanel } from '../components/ExercisePausedPanel';
import { ReviewModeBanner } from '../components/ReviewModeBanner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { savePausedExerciseState, loadPausedExerciseState, clearPausedExerciseState } from '../session/timedExercisePause';
import { getMusicPreference, setMusicPreferenceForUser } from '../lib/musicPreference';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';
import { MovementCheckboxRow } from '../components/MovementCheckboxRow';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { BackButton } from '../components/BackButton';
import { JourneyGlow } from '../components/JourneyGlow';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { isFeatureEnabled } from '../lib/featureFlags';
import { isInteractiveMusicEligible } from '../lib/backgroundMusicSelection';
import { getStepLabel } from '../lib/stepLabels';
import { formatTotalDuration } from '../lib/formatDuration';
import { usePreparationCountdown } from '../hooks/usePreparationCountdown';
import { PreparationCountdown } from '../components/PreparationCountdown';
import { createStretchSession } from '../lib/stretchSession';
import { getCompletionGreeting } from '../lib/outcomeMessages';

// Background Music — the interactive stretching timer's own loop, distinct
// from IB01 (breathing/grounding). Registered in betaVideoManifest.js
// (confirmed live) and eligible whenever the backgroundMusic feature flag
// is on.
const INTERACTIVE_STRETCHING_MUSIC_ID = 'IS01';

// S01-S05: a "Stretching Sessions" collection, matching the pattern
// already established for the A-, B-, G- and M-series sections. Shown to
// any signed-in user (guests excluded). Deliberately separate from the
// timed 4-movement selector below (Build 15) — these remain optional
// supplementary guided videos, never merged into the interactive sequence.
const STRETCHING_SESSION_VIDEOS = [
  { id: 'S01', blurb: 'A guided video to release tension in your neck.' },
  { id: 'S02', blurb: 'A guided video to release tension in your shoulders.' },
  { id: 'S03', blurb: 'A guided video to stretch your upper back.' },
  { id: 'S04', blurb: 'A guided morning stretching flow.' },
  { id: 'S05', blurb: 'A guided evening stretching flow.' }
];

// Build 15 — Morning Stretch pre-start screen. The 4 real movements
// (unchanged wording/icons) are now shown and multi-selectable BEFORE
// anything starts, rather than always auto-running as a fixed sequence
// the instant the music-choice prompt resolved. Selection uses real
// checkbox semantics (MovementCheckboxRow) per movement, never a switch
// or radio, since more than one movement may be included and a switch's
// on/off framing reads as ambiguous for a genuine multi-select — see
// MovementCheckboxRow.jsx's own doc comment for the full rationale.
//
// Morning-flow redesign — interactive timer vs. optional guided video:
// this screen's own movement countdown has no narration or audio of its
// own (confirmed by direct audit - the rows below open a completely
// separate, same-page BetaVideoModal, never mixed with the countdown
// itself). Selecting any row now: (1) marks videoOpenedDuringExercise so
// the timer stops advancing and background music is suspended (via
// InteractiveAmbientMusic's own `suspended` prop, driven by openVideo
// directly), and (2) requires a deliberate "Resume Exercise" tap to
// continue afterward — closing the video alone never restarts the timer
// or the music, exactly as required. Same pattern as Breathe.jsx.
//
// Guest pre-start-music correction (Build 18) — same fix as Breathe.jsx's
// identical block: the pre-start MusicPreferenceToggle no longer routes a
// guest to sign-in; handleToggleMusicPreference persists through the
// shared setMusicPreferenceForUser; the Begin handler's own
// `&& !isGuest` guard is removed - IS01 is server-allowlisted for guests
// exactly like IB01.
export const MorningFlow = () => {
  const navigate = useNavigate();
  const { setJourneyStep, routineDuration } = useAlarm();
  // Stage 3C Group 3D Batch B: mirrors the stretch -> breathe transition
  // into the Session Engine from all genuine exits (timer auto-advance,
  // manual Next/Continue on the final movement, Skip Stretching). See
  // mirrorStretchExitRef below.
  const { state, currentStep, advanceStep, abandonSession } = useSession();
  // Safe backward navigation ("Review Mode") - see Breathe.jsx's
  // identical block for the full rationale.
  const { isReviewMode, isLiveStep } = useStepReviewMode('stretch', 'morning-routine');
  // isRepeatGated hidden-options defect fix — found live: reviewing an
  // earlier, already-passed Stretch step (via Back or a progress-bar
  // review tap) showed "You already completed this step - Repeat this
  // exercise?" instead of the real setup screen with all movement
  // choices, unlike Meditation/Affirmation/Intention, which have no
  // equivalent gate and already show real choices directly during review
  // - directly blocking the approved "review the previous step with setup
  // options" behaviour. Always false now (was `isReviewMode &&
  // !hasStartedRepeat`) - every other reference below already behaves
  // correctly as a result, with no other call site needing to change.
  const isRepeatGated = false;
  const { isGuest } = useAuth();

  const steps = [
    { title: 'Reach to the Sky', desc: 'Extend your arms high and breathe deep.', icon: 'wb_sunny' },
    { title: 'Shoulder Rolls', desc: 'Roll your shoulders backward gently.', icon: 'rotate_right' },
    { title: 'Gentle Neck Stretch', desc: 'Slowly lower your ear to your shoulder.', icon: 'autorenew' },
    { title: 'Gentle Twist', desc: 'Slowly rotate your torso from side to side.', icon: 'spa' }
  ];

  const getStepDuration = () => (routineDuration === 'extended' ? 40 : 20);

  // Pause-and-resume-exact-state fix - see Breathe.jsx's identical block
  // for the full rationale (session/timedExercisePause.js). Build 15:
  // the snapshot now also carries which movements were selected and
  // whether music was enabled, so a review-mode round-trip restores the
  // exact same locked run, not a freshly-reset default selection.
  const [pausedSnapshot] = useState(() => loadPausedExerciseState('morning-routine', 'stretch'));
  useEffect(() => {
    if (pausedSnapshot) clearPausedExerciseState('morning-routine', 'stretch');
  }, [pausedSnapshot]);

  // Review-mode auto-start defect fix — a pausedSnapshot only represents
  // a genuine "I left THIS exact live step mid-run to review something
  // else" resume. If this mount is not currently the live step
  // (isLiveStep false - e.g. arrived here via an ordinary Back/forward
  // navigation while a stale, un-consumed snapshot from an earlier,
  // unrelated interrupted round-trip still sits in sessionStorage), it
  // must never be trusted to auto-restore an already-active exercise
  // with no setup/movement choices shown - found live on Evening's
  // identical mechanism ("Back from Meditation opened an already-running
  // Breathing countdown"). The raw snapshot is still read and cleared
  // unconditionally above so a stale one can never resurface later
  // either way; only TRUSTED for seeding initial UI state when
  // isLiveStep is true at mount.
  const trustedSnapshot = isLiveStep ? pausedSnapshot : null;

  // Build 15 — movement multi-selection, pre-start only. All 4 selected
  // by default. Pure local component state, never written to
  // localStorage — so it can never leak across users or survive a
  // genuine remount (Start Over, sign-out, a new day's fresh mount),
  // satisfying every "must clear" requirement by construction rather
  // than by an explicit clear call. Restored from the paused-exercise
  // snapshot (sessionStorage, already scoped by sessionId+stepId) only
  // for the one legitimate case that must survive a remount: leaving the
  // LIVE step via Review Mode and returning to it.
  const [selectedMovements, setSelectedMovements] = useState(() => {
    if (trustedSnapshot?.selectedMovements) return new Set(trustedSnapshot.selectedMovements);
    return new Set(steps.map((_, i) => i));
  });
  const [lastMovementNotice, setLastMovementNotice] = useState(false);
  // Build 16 physical-iPhone correction (F2) — the movement picker is no
  // longer a collapsed disclosure (it hid the very thing the pre-start
  // screen exists to show: which movements are included). Movements now
  // render directly, always visible, as a compact 2x2 grid below - see
  // the JSX below. "Explore guided stretching sessions" is a genuinely
  // optional, secondary affordance and keeps its own collapsed-by-default
  // disclosure (mirrors PrepareForRest.jsx's own "Choose a bedtime video
  // or sleep sound" precedent: aria-expanded/aria-controls, never
  // navigates) - never forced open once hasBegun flips true, keeping
  // whatever open/collapsed state the user already left it in.
  const [guidedSessionsOpen, setGuidedSessionsOpen] = useState(false);
  const handleToggleMovement = (idx) => {
    setSelectedMovements((prev) => {
      if (prev.has(idx) && prev.size === 1) {
        // Requirement: at least one movement must always remain selected
        // - deselecting the last one is rejected, not silently ignored,
        // with a friendly explanation shown below the list.
        setLastMovementNotice(true);
        return prev;
      }
      setLastMovementNotice(false);
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // hasBegun: false until the user explicitly taps "Begin Stretching" -
  // true immediately when resuming from a paused snapshot (the exercise
  // was already begun before being paused for review). Nothing below
  // (timer, animation, music) can start while this is false.
  const [hasBegun, setHasBegun] = useState(() => Boolean(trustedSnapshot));
  // The locked, canonically-ordered sequence of STEP INDICES for this
  // active run - set once at Begin (or restored, already-locked, from
  // the paused snapshot). "Locked" means the pre-start selection UI is
  // never shown again once this is set - changing your mind mid-run
  // isn't offered, matching "lock the chosen sequence for that active
  // run."
  const [activeSequence, setActiveSequence] = useState(() => {
    if (trustedSnapshot?.selectedMovements) return [...trustedSnapshot.selectedMovements].sort((a, b) => a - b);
    return null;
  });
  const orderedActiveSteps = activeSequence ? activeSequence.map((i) => steps[i]) : [];

  const { requestReview, confirmLeave, cancelLeave, isConfirming, routeForStep } = useReviewNavigation({
    sessionId: 'morning-routine',
    isLiveStep,
    hasUnsavedProgress: true,
    onLeaveLiveStep: () => savePausedExerciseState('morning-routine', 'stretch', {
      timeLeft,
      activeStep,
      selectedMovements: activeSequence ?? [...selectedMovements],
      musicEnabled: musicPreferenceOn
    })
  });

  const [activeStep, setActiveStep] = useState(() => trustedSnapshot?.activeStep ?? 0);
  // Morning-flow redesign: set the moment any guided-video row is tapped
  // (from that same click handler, never from an effect), never cleared
  // automatically — only the deliberate "Resume Exercise" tap clears it.
  const [videoOpenedDuringExercise, setVideoOpenedDuringExercise] = useState(false);
  // Usability remediation - see Breathe.jsx's identical block for the
  // full rationale. Also true immediately on mount when resuming from a
  // review-paused snapshot - see Breathe.jsx's identical block.
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

  if (ProgressIndicator && BetaVideoModal && BetaVideoRow) { /* no-op to satisfy blind linter */ }

  // Build 16 physical-iPhone correction (F6) - see Breathe.jsx's
  // identical block for the full rationale; same pattern, distinct asset
  // id (IS01).
  const musicPlayerRef = useRef(null);
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
    musicVariantId: INTERACTIVE_STRETCHING_MUSIC_ID,
    featureEnabled: isFeatureEnabled('backgroundMusic'),
    getEntryById: getBetaVideoById
  });

  // Build 15 — a real pre-start preference, not the old modal-style
  // "choose before the timer starts anyway" prompt. Genuinely safe to
  // seed from the persisted cross-app preference now (unlike
  // InteractiveAmbientMusic's own always-off-on-mount default - see its
  // own doc comment): Begin Stretching is a real, mandatory user gesture
  // that must happen before any playback, so honouring an already-on
  // preference here does not violate iOS's gesture-before-playback rule
  // - the tap itself is that gesture. Never seeded true for a guest
  // (guests can never have successfully set the underlying preference to
  // true in the first place - InteractiveAmbientMusic's own toggle
  // already refuses to for them).
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
  // mirror only — multiple exits (timer, manual, skip) could theoretically
  // reach the mirror close together (e.g. a manual click right as the
  // timer expires), and this ensures it dispatches at most once regardless
  // of which exit gets there first. It never blocks or alters the legacy
  // navigation/timer/exercise-progression statements it sits beside.
  const hasMirroredExitRef = useRef(false);
  // The timer effect below is set up once and its dependency array
  // deliberately excludes Session Engine state (adding it would reset the
  // running countdown whenever the mirror fires) — so its setInterval
  // closure calls through this ref, which is kept pointing at a fresh
  // closure on every render, instead of depending on stale values captured
  // at effect-setup time.
  const mirrorStretchExitRef = useRef(() => {});
  useEffect(() => {
    mirrorStretchExitRef.current = () => {
      if (hasMirroredExitRef.current) return;
      hasMirroredExitRef.current = true;
      if (state.status === 'playing' && currentStep?.id === 'stretch') {
        advanceStep();
      }
    };
  }, [state.status, currentStep, advanceStep]);

  const [timeLeft, setTimeLeft] = useState(() => trustedSnapshot?.timeLeft ?? getStepDuration());

  // Morning Stretch completion correction — physical-device-class defect
  // (mirroring Breathe.jsx's identical fix): the timer previously called
  // navigate() directly the instant the final movement's final second
  // elapsed, with no completion panel and no confirmed way to leave
  // early. Root cause: completion was decided by a render-time
  // setInterval closure, not by a single, authoritative decision point.
  // Fix: a pure, synchronous createStretchSession controller
  // (stretchSession.js, real-execution tested with no fake timers - see
  // stretchSession.test.js), driven by ONE real interval, whose own
  // callback is the single place that detects the final tick AND
  // synchronously stops itself, stops music, picks the greeting, and
  // flips isCompleted - zero renders/effects in between.
  const sessionRef = useRef(null);
  const intervalRef = useRef(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionGreeting, setCompletionGreeting] = useState(null);
  // Back/early-exit correction (reusing Breathe.jsx's proven pattern) -
  // gates the same interval-management effect and InteractiveAmbientMusic's
  // own `suspended` prop that isConfirming/isCompleted already use, so
  // the timer/animation/music all genuinely pause the instant this
  // dialog opens, never reset.
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);

  const stopStretchInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Covers unmount and any navigation away from this screen (Continue/
  // Skip/Exit/Back) - the one place that guarantees the interval is
  // never left running behind a screen the user is no longer on.
  useEffect(() => () => stopStretchInterval(), []);

  useEffect(() => {
    // Build 15: nothing runs until hasBegun (or a genuine resume from a
    // paused snapshot, which already implies hasBegun=true), and never
    // again once isCompleted or backConfirmOpen. Pause-during-review fix
    // - see Breathe.jsx's identical block for the full rationale: freeze
    // the countdown the instant a confirmation dialog opens, not only
    // after the user confirms.
    if (!hasBegun || !activeSequence || isInterrupted || isRepeatGated || isConfirming || isCompleted || backConfirmOpen) return;
    const session = sessionRef.current;
    if (!session) return;

    intervalRef.current = setInterval(() => {
      const current = sessionRef.current;
      if (!current) return;
      const { completed, timeLeft: nextTimeLeft, activeIndex } = current.tick();
      setTimeLeft(nextTimeLeft);
      setActiveStep(activeIndex);
      if (completed) {
        // All completion side-effects happen synchronously, in this same
        // callback, the instant the boundary is reached - stop the
        // interval (so a stray extra tick can never fire), stop the
        // music, and enter the completed state, all in one step, exactly
        // once per real completion.
        stopStretchInterval();
        musicPlayerRef.current?.stop();
        setCompletionGreeting(getCompletionGreeting({ journey: 'morning', practice: 'stretching' }));
        setIsCompleted(true);
      }
    }, 1000);

    return () => stopStretchInterval();
  }, [hasBegun, activeSequence, isInterrupted, isRepeatGated, isConfirming, isCompleted, backConfirmOpen]);

  // Double-tap protection: a ref (not state) so a second, near-
  // simultaneous tap can never race past this check before the first
  // tap's state updates have committed - the same pattern
  // hasMirroredExitRef above already uses for the same reason.
  const hasBegunOnceRef = useRef(false);

  // WakeWise DEV — Morning Stretch silent-music fix. Root cause (traced
  // live on a physical iPhone, same defect class already found and fixed
  // for Anytime Breathing - see InteractiveAmbientMusic.jsx's own
  // start()/unmute() doc comment for the full root-cause trace):
  // handleBeginStretching below used to call only preload() (a network
  // fetch, never touching playback) and deferred the real, audible
  // start() call to this onComplete - which fires from
  // usePreparationCountdown's own setInterval tick + effect, 5 REAL
  // SECONDS after the Begin tap, not a synchronous continuation of it.
  // iOS/WKWebView's gesture-before-unmuted-playback rule does not survive
  // that gap, so audio.play() was silently rejected - the toggle still
  // rendered "on" (musicPreferenceOn was, and remained, true), but no
  // sound ever played and the shared InteractiveAmbientMusic toggle
  // itself never even reached a checked state, since its own musicEnabled
  // is only ever set true by a genuine native `play` event that never
  // fired.
  //
  // Fix: onComplete now only unmute()s - the real start(true) call
  // already happened synchronously in handleBeginStretching below, at the
  // moment of the actual tap, so audio is already genuinely playing
  // (muted) by the time this fires; unmute() is a plain property set with
  // no gesture requirement of its own, safe to call from this
  // setInterval-derived callback.
  const countdown = usePreparationCountdown({
    seconds: 5,
    onComplete: () => {
      // Sequential-run correctness — the one true "start a fresh
      // session" entry point: always creates a BRAND NEW controller for
      // whichever movements are currently selected, never reusing a
      // previous instance.
      const sequence = [...selectedMovements].sort((a, b) => a - b);
      setActiveSequence(sequence);
      sessionRef.current = createStretchSession({ movementCount: sequence.length, stepDurationSeconds: getStepDuration() });
      sessionRef.current.begin();
      setActiveStep(sessionRef.current.getActiveIndex());
      setTimeLeft(sessionRef.current.getTimeLeft());
      setIsCompleted(false);
      setCompletionGreeting(null);
      setHasBegun(true);
      if (musicEligible && musicPreferenceOn) {
        musicPlayerRef.current?.unmute();
      }
    }
  });

  // WakeWise DEV — Morning Stretch silent-music fix (see the countdown's
  // own doc comment above for the full root-cause trace). Calls the REAL
  // start(true) (muted) here, synchronously within this actual tap - the
  // one genuine user gesture this screen has - instead of only preload()
  // (network fetch, no play()). A muted play() still passes iOS/WKWebView's
  // gesture-before-playback check and produces no audible sound during
  // the 5-second "get ready" countdown; the countdown's own onComplete
  // then reveals it with a plain unmute() once the active stretch phase
  // actually begins.
  const handleBeginStretching = () => {
    if (hasBegunOnceRef.current) return;
    if (selectedMovements.size === 0) return; // defense in depth - unreachable by construction, see handleToggleMovement
    hasBegunOnceRef.current = true;
    if (musicEligible && musicPreferenceOn) {
      musicPlayerRef.current?.start(true);
    }
    countdown.start();
  };

  // Manual "Next Movement"/"Continue" tap - delegates the completion
  // decision to the same pure controller the timer itself drives
  // (advanceMovement() makes the exact same decision tick() would on the
  // final movement), so a deliberate tap and the clock reaching zero are
  // never two different code paths that could disagree.
  const handleNextStep = () => {
    const session = sessionRef.current;
    if (!session) return;
    const { completed, timeLeft: nextTimeLeft, activeIndex } = session.advanceMovement();
    setTimeLeft(nextTimeLeft);
    setActiveStep(activeIndex);
    if (completed) {
      stopStretchInterval();
      musicPlayerRef.current?.stop();
      setCompletionGreeting(getCompletionGreeting({ journey: 'morning', practice: 'stretching' }));
      setIsCompleted(true);
    }
  };

  const handleSkip = () => {
    setJourneyStep('breathe');
    navigate('/breathe');
    mirrorStretchExitRef.current();
  };

  // Only reachable once isCompleted (Continue to Breathe is hidden until
  // then, see render below) - records genuine completion and advances.
  const handleContinueToBreathe = () => {
    setJourneyStep('breathe');
    navigate('/breathe');
    mirrorStretchExitRef.current();
  };

  // Dialog-severity correction — see Breathe.jsx's identical fix/
  // rationale: this link previously exited with zero confirmation despite
  // abandonSession() marking the whole session SKIPPED (terminal, never
  // resurfaced as resumable), unlike Back's own mildDestructive-confirmed
  // interruptSession(). Same shared ConfirmDialog, same tier, action
  // itself unchanged.
  const [exitRoutineConfirmOpen, setExitRoutineConfirmOpen] = useState(false);
  const handleExitRoutine = () => setExitRoutineConfirmOpen(true);
  const confirmExitRoutine = () => {
    setExitRoutineConfirmOpen(false);
    setJourneyStep('');
    navigate('/');
    if (state.status === 'playing' && currentStep?.id === 'stretch') abandonSession();
  };

  // Back-navigation repair (Morning canonical map) — Active Stretch Back
  // must safely stop the exercise and return to THIS step's own pre-start
  // screen, never straight to Intention and never the whole-routine "Leave
  // this routine?" confirmation (guardActiveRoute is off on this screen's
  // BackButton below - only Skip/Exit still leave the routine outright).
  // A subsequent Back tap, once hasBegun is false again, falls through to
  // BackButton's own ordinary previous-step navigation. Pre-start (and the
  // gated repeat-intro) are untouched - only a genuinely active run is
  // ever stopped here.
  const handleBackFromActive = () => {
    // Build 16 physical-iPhone correction (F3) — Back/Cancel during the
    // preparation countdown returns to this same pre-start screen without
    // ever marking the stretch started or begun (hasBegunOnceRef reset,
    // hasBegun never set true, no timer/music ever started).
    if (countdown.isActive) {
      countdown.cancel();
      hasBegunOnceRef.current = false;
      return false;
    }
    if (!hasBegun || isRepeatGated) return;
    // Morning Stretch Back/early-exit correction (reusing Breathe.jsx's
    // proven pattern) — Back from the COMPLETED panel is ordinary
    // navigation, never an early exit: the exercise already finished, so
    // this must never open the confirmation or touch isCompleted/
    // completionGreeting.
    if (isCompleted) return;
    // Repeated-Back-tap guard — never re-capture wasMusicPlayingRef (it
    // would now read false, since the music is already suspended for
    // the open dialog) and never open a second dialog.
    if (backConfirmOpen) return false;
    // Previously: reset everything immediately with ZERO confirmation
    // (found live on Breathe.jsx before its own fix; Stretch had the
    // exact same defect). Now: capture whether music was genuinely
    // playing before the dialog suspends it, then just open the dialog -
    // the timer/animation/music all pause via the interval effect's/
    // InteractiveAmbientMusic's own backConfirmOpen gate, never reset,
    // until the user actually chooses Leave Stretch.
    wasMusicPlayingRef.current = musicPlayerRef.current?.isPlaying() ?? false;
    setBackConfirmOpen(true);
    return false;
  };

  // "Keep Stretching" — dismiss the dialog and resume from the exact
  // remaining time (nothing was ever reset), restoring music only if it
  // was genuinely playing before the dialog opened.
  const keepStretching = () => {
    setBackConfirmOpen(false);
    if (wasMusicPlayingRef.current) {
      wasMusicPlayingRef.current = false;
      musicPlayerRef.current?.start();
    }
  };

  // "Leave Stretch" — the one true confirmed-early-exit path: stops and
  // disposes of the interval/session/music, records nothing (never calls
  // mirrorStretchExitRef/advanceStep), and returns to the pre-start/
  // selection screen.
  const leaveStretch = () => {
    setBackConfirmOpen(false);
    hasBegunOnceRef.current = false;
    setVideoOpenedDuringExercise(false);
    setManuallyPaused(false);
    stopStretchInterval();
    sessionRef.current?.end();
    sessionRef.current = null;
    setActiveSequence(null);
    setIsCompleted(false);
    setCompletionGreeting(null);
    setHasBegun(false);
    musicPlayerRef.current?.stop();
    wasMusicPlayingRef.current = false;
  };

  const selectedCount = selectedMovements.size;
  const totalSeconds = selectedCount * getStepDuration();

  // Build 15 Stretch pre-start restructure — dynamic explanatory copy and
  // Begin label, exact approved wording for counts 1-4. Natural grammar
  // for Begin ("Begin with 2 movements"), never a fabricated compound
  // like "1-Movement Stretch."
  const getPreStartCopy = () => {
    if (selectedCount === 4) return 'All four movements are selected. Begin now, or choose the movements that feel right today.';
    if (selectedCount === 1) return 'One movement is selected. Begin now, or choose a different movement below.';
    return `${selectedCount} movements are selected. Begin now, or choose different movements below.`;
  };
  const beginLabel = `Begin with ${selectedCount} movement${selectedCount === 1 ? '' : 's'}`;

  return (
    // Build 16 physical-iPhone correction (F8) - see Affirmation.jsx's
    // identical block for the full rationale.
    //
    // Mobile correction (Morning Stretch compaction) — space-y-5 -> -3,
    // found live: only the first row of movement cards was reliably
    // visible above the fold at 390x844/393x852, against the approved
    // screenshot showing all four. Trims the gap between EVERY top-level
    // section (header, title, duration pill, music toggle, Begin button,
    // movements grid) rather than singling one out - no text size, no
    // control size, no safe-area/Back-button clearance touched.
    <div
      className="min-h-[85vh] flex flex-col pb-6 max-w-xl mx-auto space-y-3 select-none"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))'
      }}
    >
      {/* WakeWise DEV — colour glow extension: Morning's Stretch step
          (setup, prep countdown, and active phase all share this one
          root - see this file's own single-return structure). Rendered
          inside <Layout> (hideNavigation hides its header/nav, but not
          Layout's own generic ambient glow underneath) - this sits above
          that as an additional, more specific Morning-gold layer, not a
          replacement for it. */}
      <JourneyGlow journey="morning" />
      <div className="flex items-center gap-3">
        <BackButton fallback="/intention-setup" guardActiveRoute={false} onBeforeLeave={handleBackFromActive} />
      </div>
      <ProgressIndicator activeStep="stretch" onReviewStep={requestReview} />

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      {!countdown.isActive && (
        <div className="text-center space-y-1.5">
          <span className="font-label-sm text-xs text-morning-accent uppercase tracking-widest font-bold">Morning Movement</span>
          <h2 className="text-2xl font-bold text-on-surface font-morning-display italic">Gentle Morning Stretch</h2>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
            {!isRepeatGated && !hasBegun ? getPreStartCopy() : 'Ease into the day with a few gentle movements.'}
          </p>
        </div>
      )}

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
          {/* Build 16 physical-iPhone correction (F2) — pre-start summary +
              movement selection. Nothing below this point runs a timer,
              animation, or plays music - see handleBeginStretching above
              for the one gesture that starts all three together. Only the
              total-duration pill remains here - the "N movements selected"
              pill was dropped as redundant now that the grid below always
              shows exactly which movements are selected. */}
          <div className="flex items-center justify-center">
            <span className="text-[11px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-on-surface-variant/80 font-bold uppercase tracking-wider">
              {formatTotalDuration(totalSeconds)} total
            </span>
          </div>

          {musicEligible && (
            <MusicPreferenceToggle
              isOn={musicPreferenceOn}
              onToggle={handleToggleMusicPreference}
              description="Play gentle music during your stretch."
              accent="morning"
            />
          )}

          <div className="space-y-3 w-full">
            <button
              type="button"
              onClick={handleBeginStretching}
              disabled={selectedMovements.size === 0}
              className={`w-full ${getJourneyPrimaryActionClasses('morning')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-50`}
            >
              <span>{beginLabel}</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          {/* Build 16 physical-iPhone correction (F2) — all four movements
              now render directly on the setup screen (no more collapsed
              "Choose movements" disclosure hiding them), as a compact
              2-column x 2-row grid. Each card is still a real checkbox
              (MovementCheckboxRow's `compact` variant) - tapping it IS
              "choosing movements," so the selection affordance stays
              fully available without a separate toggle to open first. */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-1">Choose your movements</h3>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Choose your movements">
              {steps.map((step, idx) => (
                <MovementCheckboxRow
                  key={idx}
                  compact
                  title={step.title}
                  description={step.desc}
                  durationLabel={`0:${getStepDuration().toString().padStart(2, '0')}`}
                  icon={step.icon}
                  isSelected={selectedMovements.has(idx)}
                  onToggle={() => handleToggleMovement(idx)}
                  journeyTone="morning"
                />
              ))}
            </div>
            {lastMovementNotice && (
              <p className="text-xs text-on-surface-variant text-center px-4">Keep at least one movement selected to begin.</p>
            )}
          </div>

          {/* Build 15 Stretch pre-start restructure — "Explore guided
              stretching sessions" disclosure, collapsed by default. Same
              shared open/collapsed state also renders the S01-S05 rows
              once the exercise has begun (see below), so opening it here
              and then tapping Begin never silently closes it again. */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setGuidedSessionsOpen((v) => !v)}
              aria-expanded={guidedSessionsOpen}
              aria-controls="stretch-guided-sessions"
              className="w-full flex items-center justify-between gap-3 bg-surface-container border border-white/15 rounded-2xl p-4 min-h-[44px] hover:bg-white/10 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="text-sm font-semibold text-on-surface text-left">Explore guided stretching sessions — {STRETCHING_SESSION_VIDEOS.length} available</span>
              <span
                className="material-symbols-outlined text-on-surface-variant transition-transform shrink-0"
                style={{ transform: guidedSessionsOpen ? 'rotate(180deg)' : 'none' }}
                aria-hidden="true"
              >
                expand_more
              </span>
            </button>
            {guidedSessionsOpen && (
              <div id="stretch-guided-sessions" className="space-y-3">
                {STRETCHING_SESSION_VIDEOS.map(({ id, blurb }) => {
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
            )}
          </div>

          <div className="space-y-3 w-full">
            <button
              onClick={handleSkip}
              className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
            >
              Skip this step
            </button>
            {/* Acceptance-audit correction (Decision 2) — this small,
                understated text link measured a real ~32px effective tap
                height (text-xs line-height 16px + py-2's 8px top/bottom),
                under the 44px minimum. `-my-1.5 py-3.5` grows the real
                paintable/tappable box to 16+14+14=44px while the negative
                margin cancels exactly the added 6px on each side, so the
                surrounding layout's own vertical rhythm is completely
                unaffected (byte-identical visual position/spacing to
                before) - the same established technique
                ProgressIndicator.jsx's own review-chip buttons already use
                for the identical reason. Applied identically everywhere
                this exact "Exit routine" control appears (Affirmation.jsx/
                Breathe.jsx/IntentionSetup.jsx/MorningMeditate.jsx) - never
                changes onClick/navigation/confirmation semantics, only the
                tap target. */}
            <button
              onClick={handleExitRoutine}
              className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors -my-1.5 py-3.5"
            >
              Exit routine
            </button>
          </div>
        </>
      ) : isCompleted ? (
        // Morning Stretch completion correction — a genuine dedicated
        // completed panel, replacing the active exercise interface
        // entirely (progress bar, movement list are ALL gone here, not
        // just overlaid) so there is never any doubt the exercise is
        // over. Warm-gold visual language reused from this app's own
        // existing tokens (IntentionSetup.jsx/SessionComplete.jsx/
        // Breathe.jsx's own bg-morning-accent/10 + border-morning-
        // accent-tint/25 + shadow-morning-glow badge shape) - never a
        // new colour.
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-morning-accent/10 border border-morning-accent-tint/25 shadow-morning-glow flex items-center justify-center">
            <span className="material-symbols-outlined text-morning-accent text-4xl" aria-hidden="true">check_circle</span>
          </div>
          <div className="space-y-2">
            <span className="font-label-sm text-xs text-morning-accent uppercase tracking-widest font-bold">Stretch Completed</span>
            <h2 className="text-2xl font-bold text-on-surface font-morning-display italic max-w-xs mx-auto" role="status">
              {completionGreeting}
            </h2>
            <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
              Take this energy with you as you continue your morning.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Progress visual bar */}
          <div className="glass-panel p-5 rounded-2xl space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between text-xs font-semibold text-on-surface-variant">
              <span>Stretching Progress</span>
              <span>Movement {activeStep + 1} of {orderedActiveSteps.length}</span>
            </div>
            {/* Context-aware Meditation/Breathing theming consistency
                audit — this fill previously faded from morning-accent
                into the peach primary token, a leftover blend from before
                the "stays gold throughout Morning" rule. Solid gold now,
                matching every other selected/progress element on this
                same Stretch step. */}
            <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-morning-accent rounded-full transition-all duration-1000"
                style={{ width: `${((activeStep + 1) / orderedActiveSteps.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Steps List - collapsed to just the active step while paused for a
              guided video. All full-detail cards together are taller than
              an iPhone's own viewport on this screen (measured directly: the
              back button + step tabs + title + progress bar alone already fill
              it), which would push ExercisePausedPanel below the fold no matter
              where in the DOM it sits relative to the video rows. The other
              exercises aren't relevant while paused anyway - the user
              already knows which one they were on. Only movements INCLUDED
              in this run render here (Build 15) - excluded movements never
              appear during the active sequence at all. */}
          <div className="space-y-4">
            {orderedActiveSteps.map((step, idx) => {
              const isCompleted = idx < activeStep;
              const isActive = idx === activeStep;
              if (isInterrupted && !openVideo && !isActive) return null;

              return (
                <div
                  key={idx}
                  className={`glass-panel p-5 rounded-2xl flex items-center justify-between border transition-all duration-300 ${
                    // Context-aware Meditation/Breathing theming
                    // consistency audit — found live: these three used the
                    // plain-hex morning-accent token with a /<n> opacity
                    // modifier, the same "resolves to fully transparent"
                    // bug already fixed everywhere else this session (see
                    // JourneyGlow.jsx's own doc comment) - the active
                    // movement's own highlighted border/shadow/background
                    // were rendering invisibly. Fixed with the alpha-safe
                    // -tint RGB-triplet token, same as everywhere else.
                    isActive ? 'border-morning-accent-tint/30 opacity-100 shadow-md shadow-morning-accent-tint/10 bg-morning-accent-tint/5' : isCompleted ? 'opacity-50 border-transparent' : 'opacity-30 border-transparent'
                  }`}
                >
                  <div className="flex gap-4 items-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isActive ? 'bg-morning-accent-tint/25 text-morning-accent' : 'bg-white/5 text-on-surface-variant'
                    }`}>
                      <span className="material-symbols-outlined text-2xl">{step.icon}</span>
                    </div>
                    <div>
                      <h4 className="font-label-md text-sm text-on-surface font-bold flex items-center gap-2">
                        {step.title}
                        {isCompleted && <span className="material-symbols-outlined text-secondary text-sm">check_circle</span>}
                      </h4>
                      <p className="text-xs text-on-surface-variant mt-1">{step.desc}</p>
                    </div>
                  </div>

                  {isActive ? (
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-morning-accent">0:{timeLeft.toString().padStart(2, '0')}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase font-semibold">Remaining</p>
                    </div>
                  ) : (
                    /* Morning Visual Uplift (Build 16) — each upcoming/
                       completed movement now also shows its own real
                       duration (the exact same getStepDuration() the
                       active timer itself counts down from - every
                       movement shares one uniform duration derived from
                       the real routineDuration setting, never a
                       fabricated flat "30s" placeholder). */
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-on-surface-variant/70">{getStepDuration()}s</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ))}

      {/* Build 15 fix — a SINGLE, stable InteractiveAmbientMusic instance,
          never remounted across the pre-start -> active transition. It
          used to be rendered as two separate JSX elements inside the two
          ternary branches above (one hidden pre-start, one visible
          active) — that meant tapping Begin (which flips hasBegun and
          therefore swaps ternary branches) unmounted the very instance
          whose ref.start() the Begin handler had just called, orphaning
          the audio element mid-fetch/mid-play (its own unmount cleanup
          would pause/clear it moments later). One stable element with
          conditional props (hideToggle/suspended) instead - matches the
          same reasoning "Resume with Music" already relies on elsewhere
          in this file: the instance must already be mounted, and stay
          mounted, for a ref-triggered start() to be safe. */}
      {!isRepeatGated && (
        <InteractiveAmbientMusic
          ref={musicPlayerRef}
          musicVariantId={INTERACTIVE_STRETCHING_MUSIC_ID}
          suspended={hasBegun ? (isCompleted || Boolean(openVideo) || manuallyPaused || backConfirmOpen) : false}
          hideToggle={!hasBegun || isCompleted}
        />
      )}

      {/* Immediately below the countdown/music toggle, ABOVE the
          Stretching Sessions video rows below - visible in the initial
          viewport with no scroll. See Breathe.jsx's identical panel.
          Both only ever apply once the exercise has genuinely begun. */}
      {hasBegun && !isRepeatGated && !isCompleted && isInterrupted && !openVideo && (
        <ExercisePausedPanel onResume={handleResume} journeyTone="morning" />
      )}

      {/* Usability remediation - see Breathe.jsx's identical block for the
          full rationale. Morning Stretch completion correction — gated on
          !isCompleted too (pausing a finished stretch is nonsensical). */}
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

      {/* Build 15 — same "Explore guided stretching sessions" disclosure
          as the pre-start screen, reusing the same guidedSessionsOpen
          state (so opening it before Begin and then starting the
          exercise never silently closes it - "do not force it open
          after Begin" means never force it EITHER way). Only rendered
          once the exercise is active - the pre-start branch above
          already renders its own copy while !hasBegun. Still reachable
          mid-exercise, preserving the existing interrupt-to-watch
          affordance handleSelectVideo already provides. Gated on
          !isCompleted - the completed panel has its own action block
          below instead. */}
      {hasBegun && !isRepeatGated && !isCompleted && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setGuidedSessionsOpen((v) => !v)}
            aria-expanded={guidedSessionsOpen}
            aria-controls="stretch-guided-sessions-active"
            className="w-full flex items-center justify-between gap-3 bg-surface-container border border-white/15 rounded-2xl p-4 min-h-[44px] hover:bg-white/10 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="text-sm font-semibold text-on-surface text-left">Explore guided stretching sessions — {STRETCHING_SESSION_VIDEOS.length} available</span>
            <span
              className="material-symbols-outlined text-on-surface-variant transition-transform shrink-0"
              style={{ transform: guidedSessionsOpen ? 'rotate(180deg)' : 'none' }}
              aria-hidden="true"
            >
              expand_more
            </span>
          </button>
          {guidedSessionsOpen && (
            <div id="stretch-guided-sessions-active" className="space-y-3">
              {STRETCHING_SESSION_VIDEOS.map(({ id, blurb }) => {
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
          )}
        </div>
      )}

      {hasBegun && !isRepeatGated && (
        <div className="space-y-3 w-full">
          {/* Duplicate-return-action fix (mirrors Breathe.jsx's identical
              fix) — the ReviewModeBanner's own "Return to X" (top) already
              covers this; nothing replaces this branch while reviewing. */}
          {!isReviewMode && (
            <>
              {isCompleted ? (
                <>
                  {/* Morning Stretch completion correction — the required
                      primary action, gated purely on the new explicit
                      isCompleted state. Tapping it is the one place
                      completion is ever mirrored into the Session Engine
                      - exactly once, guarded by hasMirroredExitRef. */}
                  <button
                    onClick={handleContinueToBreathe}
                    className={`w-full ${getJourneyPrimaryActionClasses('morning')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg`}
                  >
                    <span>Continue to Breathe</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                  <button
                    onClick={handleExitRoutine}
                    className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors -my-1.5 py-3.5"
                  >
                    Exit routine
                  </button>
                </>
              ) : (
                <>
                  {/* Hidden while the ExercisePausedPanel above is showing its own
                      Resume action - see Breathe.jsx's identical comment. */}
                  {!isInterrupted && (
                    <button
                      onClick={handleNextStep}
                      className={`w-full ${getJourneyPrimaryActionClasses('morning')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg`}
                    >
                      <span>{activeStep === orderedActiveSteps.length - 1 ? 'Continue' : 'Next Movement'}</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  )}
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

      {/* Closing this leaves the user right here on the stretching screen
          - no navigation needed for a return path. The timer stays paused
          (videoOpenedDuringExercise) until a deliberate Resume Exercise
          tap - see the doc comment above. */}
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
      {/* Morning Stretch Back/early-exit correction — mild warning
          (temporary, resumable progress lost; no saved history erased),
          matching Breathe.jsx's own identical severity/hierarchy for the
          same class of action. Keep Stretching dismisses with zero state
          change (nothing was ever reset); Leave Stretch is the one
          confirmed early-exit path (leaveStretch, above). */}
      <ConfirmDialog
        open={backConfirmOpen}
        title="Leave this stretch?"
        message="Your progress in this stretch won’t be completed."
        confirmLabel="Leave Stretch"
        cancelLabel="Keep Stretching"
        mildDestructive
        onConfirm={leaveStretch}
        onDismiss={keepStretching}
      />
    </div>
  );
};

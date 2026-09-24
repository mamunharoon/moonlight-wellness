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
import { getMusicPreference, setMusicPreference } from '../lib/musicPreference';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';
import { MovementCheckboxRow } from '../components/MovementCheckboxRow';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { BackButton } from '../components/BackButton';
import { isFeatureEnabled } from '../lib/featureFlags';
import { isInteractiveMusicEligible } from '../lib/backgroundMusicSelection';
import { getStepLabel } from '../lib/stepLabels';
import { formatTotalDuration } from '../lib/formatDuration';

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
  const [hasStartedRepeat, setHasStartedRepeat] = useState(false);
  const isRepeatGated = isReviewMode && !hasStartedRepeat;
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
    if (pausedSnapshot?.selectedMovements) return new Set(pausedSnapshot.selectedMovements);
    return new Set(steps.map((_, i) => i));
  });
  const [lastMovementNotice, setLastMovementNotice] = useState(false);
  // Build 15 Stretch pre-start restructure — two independent, collapsed-
  // by-default disclosures (mirrors PrepareForRest.jsx's own "Choose a
  // bedtime video or sleep sound" precedent: aria-expanded/aria-controls,
  // never navigates). Neither is forced open once hasBegun flips true -
  // both keep whatever open/collapsed state the user already left them
  // in, satisfying "remain collapsed before and during the timed
  // exercise unless the user deliberately opens it."
  const [movementsOpen, setMovementsOpen] = useState(false);
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
  const [hasBegun, setHasBegun] = useState(() => Boolean(pausedSnapshot));
  // The locked, canonically-ordered sequence of STEP INDICES for this
  // active run - set once at Begin (or restored, already-locked, from
  // the paused snapshot). "Locked" means the pre-start selection UI is
  // never shown again once this is set - changing your mind mid-run
  // isn't offered, matching "lock the chosen sequence for that active
  // run."
  const [activeSequence, setActiveSequence] = useState(() => {
    if (pausedSnapshot?.selectedMovements) return [...pausedSnapshot.selectedMovements].sort((a, b) => a - b);
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

  const [activeStep, setActiveStep] = useState(() => pausedSnapshot?.activeStep ?? 0);
  // Morning-flow redesign: set the moment any guided-video row is tapped
  // (from that same click handler, never from an effect), never cleared
  // automatically — only the deliberate "Resume Exercise" tap clears it.
  const [videoOpenedDuringExercise, setVideoOpenedDuringExercise] = useState(false);
  // Usability remediation - see Breathe.jsx's identical block for the
  // full rationale. Also true immediately on mount when resuming from a
  // review-paused snapshot - see Breathe.jsx's identical block.
  const [manuallyPaused, setManuallyPaused] = useState(() => Boolean(pausedSnapshot));
  const handlePauseExercise = () => setManuallyPaused(true);
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

  const handleSelectVideo = (id) => {
    setVideoOpenedDuringExercise(true);
    handleSelect(id);
  };

  const handleResumeExercise = () => {
    setVideoOpenedDuringExercise(false);
    setManuallyPaused(false);
  };

  // "Resume with Music" - see Breathe.jsx's identical doc comment on its
  // own copy of this handler; same pattern, distinct asset id (IS01).
  const musicPlayerRef = useRef(null);
  const handleResumeWithMusic = () => {
    setVideoOpenedDuringExercise(false);
    setManuallyPaused(false);
    musicPlayerRef.current?.start();
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
    if (pausedSnapshot) return Boolean(pausedSnapshot.musicEnabled);
    if (isGuest) return false;
    return musicEligible && getMusicPreference();
  });
  const handleToggleMusicPreference = () => {
    setMusicPreferenceOn((prev) => {
      const next = !prev;
      setMusicPreference(next);
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

  const [timeLeft, setTimeLeft] = useState(() => pausedSnapshot?.timeLeft ?? getStepDuration());

  useEffect(() => {
    // Build 15: nothing runs until hasBegun (or a genuine resume from a
    // paused snapshot, which already implies hasBegun=true). Pause-
    // during-review fix - see Breathe.jsx's identical block for the full
    // rationale: freeze the countdown the instant the confirmation
    // dialog opens, not only after the user confirms.
    if (!hasBegun || !activeSequence || isInterrupted || isRepeatGated || isConfirming) return;

    const stepDur = getStepDuration();

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setActiveStep((curr) => {
            if (curr < activeSequence.length - 1) {
              return curr + 1;
            } else {
              setJourneyStep('breathe');
              navigate('/breathe');
              mirrorStretchExitRef.current();
              return curr;
            }
          });
          return stepDur;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBegun, activeSequence, navigate, setJourneyStep, routineDuration, isInterrupted, isRepeatGated, isConfirming]);

  // Double-tap protection: a ref (not state) so a second, near-
  // simultaneous tap can never race past this check before the first
  // tap's state updates have committed - the same pattern
  // hasMirroredExitRef above already uses for the same reason.
  const hasBegunOnceRef = useRef(false);
  const handleBeginStretching = () => {
    if (hasBegunOnceRef.current) return;
    if (selectedMovements.size === 0) return; // defense in depth - unreachable by construction, see handleToggleMovement
    hasBegunOnceRef.current = true;
    const sequence = [...selectedMovements].sort((a, b) => a - b);
    setActiveSequence(sequence);
    setActiveStep(0);
    setTimeLeft(getStepDuration());
    setHasBegun(true);
    // Called synchronously within this real click handler - the exact
    // same proven, gesture-safe pattern "Resume with Music" already uses
    // (see handleResumeWithMusic above). InteractiveAmbientMusic is
    // already mounted (hideToggle=true) before this tap, so its ref/
    // audio element already exist.
    if (musicEligible && musicPreferenceOn && !isGuest) {
      musicPlayerRef.current?.start();
    }
  };

  const handleNextStep = () => {
    const stepDur = getStepDuration();
    if (activeStep < activeSequence.length - 1) {
      setActiveStep((prev) => prev + 1);
      setTimeLeft(stepDur);
    } else {
      setJourneyStep('breathe');
      navigate('/breathe');
      mirrorStretchExitRef.current();
    }
  };

  const handleSkip = () => {
    setJourneyStep('breathe');
    navigate('/breathe');
    mirrorStretchExitRef.current();
  };

  const handleExitRoutine = () => {
    setJourneyStep('');
    navigate('/');
    if (state.status === 'playing' && currentStep?.id === 'stretch') abandonSession();
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
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-xl mx-auto space-y-8 select-none">
      <div className="flex items-center gap-3">
        <BackButton fallback="/intention-setup" />
      </div>
      <ProgressIndicator activeStep="stretch" onReviewStep={requestReview} />

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      <div className="text-center space-y-2">
        <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">Morning Movement</span>
        <h2 className="text-2xl font-bold text-on-surface">Gentle Morning Stretch</h2>
        <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
          {!isRepeatGated && !hasBegun ? getPreStartCopy() : 'Ease into the day with a few gentle movements.'}
        </p>
      </div>

      {isRepeatGated ? (
        <div className="glass-panel rounded-2xl p-6 text-center space-y-4 border-white/10">
          <p className="text-sm text-on-surface-variant">You already completed this step. Repeating it starts the stretch sequence from the beginning.</p>
          <button
            type="button"
            onClick={() => setHasStartedRepeat(true)}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            <span className="material-symbols-outlined text-sm">replay</span>
            <span>Repeat this exercise</span>
          </button>
        </div>
      ) : !hasBegun ? (
        <>
          {/* Build 15 — pre-start summary + movement selection. Nothing
              below this point runs a timer, animation, or plays music -
              see handleBeginStretching above for the one gesture that
              starts all three together. */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-[11px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-on-surface-variant/80 font-bold uppercase tracking-wider">
              {formatTotalDuration(totalSeconds)} total
            </span>
            <span className="text-[11px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-on-surface-variant/80 font-bold uppercase tracking-wider">
              {selectedCount} movement{selectedCount === 1 ? '' : 's'} selected
            </span>
          </div>

          {musicEligible && (
            <MusicPreferenceToggle
              isOn={musicPreferenceOn}
              onToggle={handleToggleMusicPreference}
              isGuest={isGuest}
              onSignIn={confirmSignIn}
              description="Play gentle music during your stretch."
            />
          )}

          <div className="space-y-3 w-full">
            <button
              type="button"
              onClick={handleBeginStretching}
              disabled={selectedMovements.size === 0}
              className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-50"
            >
              <span>{beginLabel}</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          {/* Build 15 Stretch pre-start restructure — "Choose movements"
              disclosure, collapsed by default. The movement rows and the
              last-movement notice move inside unchanged in every other
              respect (same Set-based selection, same canonical order,
              same last-remaining-movement guard). */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setMovementsOpen((v) => !v)}
              aria-expanded={movementsOpen}
              aria-controls="stretch-choose-movements"
              className="w-full flex items-center justify-between gap-3 bg-surface-container border border-white/15 rounded-2xl p-4 min-h-[44px] hover:bg-white/10 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="text-sm font-semibold text-on-surface text-left">Choose movements — {selectedCount} selected</span>
              <span
                className="material-symbols-outlined text-on-surface-variant transition-transform shrink-0"
                style={{ transform: movementsOpen ? 'rotate(180deg)' : 'none' }}
                aria-hidden="true"
              >
                expand_more
              </span>
            </button>
            {movementsOpen && (
              <div id="stretch-choose-movements" className="space-y-3" role="group" aria-label="Choose your movements">
                {steps.map((step, idx) => (
                  <MovementCheckboxRow
                    key={idx}
                    title={step.title}
                    description={step.desc}
                    durationLabel={`0:${getStepDuration().toString().padStart(2, '0')}`}
                    icon={step.icon}
                    isSelected={selectedMovements.has(idx)}
                    onToggle={() => handleToggleMovement(idx)}
                  />
                ))}
                {lastMovementNotice && (
                  <p className="text-xs text-on-surface-variant text-center px-4">Keep at least one movement selected to begin.</p>
                )}
              </div>
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
            <button
              onClick={handleExitRoutine}
              className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors py-2"
            >
              Exit routine
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Progress visual bar */}
          <div className="glass-panel p-5 rounded-2xl space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between text-xs font-semibold text-on-surface-variant">
              <span>Stretching Progress</span>
              <span>Movement {activeStep + 1} of {orderedActiveSteps.length}</span>
            </div>
            <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-1000"
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
                    isActive ? 'border-primary/30 opacity-100 shadow-md shadow-primary/5 bg-primary/5' : isCompleted ? 'opacity-50 border-transparent' : 'opacity-30 border-transparent'
                  }`}
                >
                  <div className="flex gap-4 items-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isActive ? 'bg-primary/25 text-primary' : 'bg-white/5 text-on-surface-variant'
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

                  {isActive && (
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-primary">0:{timeLeft.toString().padStart(2, '0')}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase font-semibold">Remaining</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

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
          suspended={hasBegun ? (Boolean(openVideo) || manuallyPaused) : false}
          hideToggle={!hasBegun}
        />
      )}

      {/* Immediately below the countdown/music toggle, ABOVE the
          Stretching Sessions video rows below - visible in the initial
          viewport with no scroll. See Breathe.jsx's identical panel.
          Both only ever apply once the exercise has genuinely begun. */}
      {hasBegun && !isRepeatGated && isInterrupted && !openVideo && (
        <ExercisePausedPanel
          onResumeExercise={handleResumeExercise}
          onResumeWithMusic={handleResumeWithMusic}
          showResumeWithMusic={musicEligible}
          isGuest={isGuest}
          onSignIn={confirmSignIn}
        />
      )}

      {/* Usability remediation - see Breathe.jsx's identical block for the
          full rationale. */}
      {hasBegun && !isRepeatGated && !isInterrupted && !openVideo && (
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
          affordance handleSelectVideo already provides. */}
      {hasBegun && !isRepeatGated && (
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
          {isReviewMode ? (
            currentStep && (
              <button
                onClick={() => navigate(routeForStep(currentStep.id))}
                className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
              >
                <span>Return to {getStepLabel(currentStep.id)}</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            )
          ) : (
            <>
              {/* Hidden while the ExercisePausedPanel above is showing its own
                  two resume actions - see Breathe.jsx's identical comment. */}
              {!isInterrupted && (
                <button
                  onClick={handleNextStep}
                  className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
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
                className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors py-2"
              >
                Exit routine
              </button>
            </>
          )}
        </div>
      )}

      {/* Closing this leaves the user right here on the stretching screen
          - no navigation needed for a return path. The timer stays paused
          (videoOpenedDuringExercise) until a deliberate Resume Exercise
          tap - see the doc comment above. */}
      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={closeVideo} />
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
    </div>
  );
};

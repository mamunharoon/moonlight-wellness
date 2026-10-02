/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { BackButton } from '../components/BackButton';
import { ReviewModeBanner } from '../components/ReviewModeBanner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { useActiveRoutineStep } from '../hooks/useActiveRoutineStep';
import { getStepLabel } from '../lib/stepLabels';
import { useMeditationSession } from '../hooks/useMeditationSession';
import { usePreparationCountdown } from '../hooks/usePreparationCountdown';
import { PreparationCountdown } from '../components/PreparationCountdown';
import { MeditationSetupPanel } from '../components/journey/MeditationSetupPanel';
import { MeditationActiveSession } from '../components/journey/MeditationActiveSession';
import { MEDITATION_CONTEXTS, getRecommendedDurationId } from '../lib/meditationDurations';
import { JourneyGlow } from '../components/JourneyGlow';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { getCompletionGreeting } from '../lib/outcomeMessages';
import { CompletionReveal } from '../components/CompletionReveal';
import { ExerciseScreenShell } from '../components/journey/ExerciseScreenShell';

/*
 * WakeWise — Journey Embedding (Self-Guided Meditation) — Morning embedded
 * step, inserted immediately after Breathe (Intend -> Stretch -> Breathe ->
 * Meditate (optional) -> Affirm -> Complete).
 *
 * Reuses useMeditationSession.js/MeditationSetupPanel.jsx/
 * MeditationActiveSession.jsx verbatim - the exact same real timer/
 * controller/audio behaviour the standalone /self-guided-meditation page
 * uses, never a second implementation. Recommended defaults: Mindful
 * Pause, 2 minutes (its own "Recommended" badge via
 * MEDITATION_CONTEXTS.MORNING_EMBEDDED - the shared registry's own
 * `recommended` flag, which still marks 5min for standalone, is never
 * mutated), Gentle Ambient (IM01) - matching meditationSounds.js's own
 * existing style-aware suggestion for 'mindful-pause', so no override is
 * needed for the sound to land correctly.
 *
 * Session-local, independent of Evening's own embedded selections and of
 * standalone meditation - this page's own useMeditationSession() call is
 * a completely separate hook instance/closure.
 *
 * Skip, "Finish & continue", and natural completion all continue to
 * Affirmation via the exact same setJourneyStep+navigate+mirror-to-
 * Session-Engine pattern Breathe.jsx already established for its own
 * transitions (see mirrorMeditateExitRef below) - never a duplicated/
 * divergent mechanism. None of them navigate to
 * /self-guided-meditation-complete.
 *
 * Morning journey UX correction — the active screen's header Back arrow
 * and its bottom action now mean two genuinely different things (found
 * live: they previously both opened the exact same "End this meditation?"
 * dialog and both always landed back on Meditation setup, leaving no way
 * to finish early and actually move on - the only forward action from
 * setup was the since-misleading "Skip meditation," even after a real
 * attempt at Meditation):
 *   - Back (and, unchanged, MeditationActiveSession's own local dialog):
 *     "End this meditation?" - stops the timer/audio and returns to THIS
 *     step's own pre-start screen. The parent Morning session stays
 *     exactly where it was (no advanceStep, no interruptSession, no
 *     navigate) - the user hasn't left the journey, only paused this
 *     optional sub-activity. The pre-start screen then shows "Continue to
 *     Affirmation" instead of "Skip meditation" (`hasStartedThisVisit`),
 *     since skip is misleading once the user has already engaged.
 *   - The bottom action is now `bottomAction` ("Finish & continue" / "Finish
 *     meditation?"): a deliberate, distinct early finish that stops the
 *     timer/audio (handleFinishAndContinue -> session.endSession()) and
 *     advances straight to Affirmation via the same guarded handleComplete()
 *     every other completion path uses - never returns to setup.
 *

 * Whole-journey exit while meditation is ACTIVE (correction, found live):
 * an earlier revision wired the active screen's Close/X to the SAME local
 * "End this meditation?" dialog as Back, leaving no way to exit the whole
 * Morning routine while meditation was running. Fixed via
 * MeditationActiveSession's own `onRequestClose` prop
 * (handleRequestExitRoutine below) - Close/X now opens THIS page's own
 * separate "Leave this routine?" dialog (same copy/severity BackButton.jsx
 * uses everywhere else in Morning), and confirming calls the real shared
 * leaveActiveRoutine() (useActiveRoutineStep.js - interruptSession(), the
 * SAME resumable mechanism BackButton's own guard uses, never
 * abandonSession()) before navigating Home. Because stepIndex is never
 * advanced by this path, Home's own Continue card resumes exactly back to
 * this step's own pre-start screen - never a fake "still running" state
 * (no elapsed-seconds persistence exists for this or any other timed
 * Morning step).
 *
 * The PRE-START screen's header Back returns to Breathe (guardActiveRoute
 * is off - see Back-navigation repair, Morning canonical map: the
 * whole-routine "Leave this routine?" confirmation belongs only to
 * Intention, the first step, and to this screen's own active-phase
 * Close/X above), plus the same plain, unconfirmed "Exit routine" link
 * every other Morning step already has.
 */
export const MorningMeditate = () => {
  const navigate = useNavigate();
  const { setJourneyStep } = useAlarm();
  const { state, currentStep, advanceStep, abandonSession, recordStepEndedEarly } = useSession();
  const { isReviewMode, isLiveStep } = useStepReviewMode('meditate', 'morning-routine');
  // Whole-journey exit while meditation is active - see this file's own
  // top-of-file doc comment. The same shared mechanism BackButton.jsx's
  // own "Leave this routine?" guard uses everywhere else in Morning.
  const { leaveActiveRoutine } = useActiveRoutineStep();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  const hasMirroredExitRef = useRef(false);
  const mirrorMeditateExitRef = useRef(() => {});
  // Morning journey UX correction — distinguishes "never started Meditation
  // this visit" (setup shows "Skip meditation") from "started, then backed
  // out to setup via Back -> End Meditation" (setup shows "Continue to
  // Affirmation" instead - "skip" is misleading once the user has already
  // engaged with the activity). Session-local only (component state, not
  // persisted anywhere) - resets naturally on a fresh mount of this route,
  // exactly matching "the current visit" as the state model requires. Real
  // React state, not a ref: this value is read during render (the setup
  // panel's skipLabel below), and refs must never be read during render
  // (react-hooks/refs - found by lint, not just a style preference: a ref
  // read during render can silently miss a re-render entirely).
  const [hasStartedThisVisit, setHasStartedThisVisit] = useState(false);

  // Morning Meditation completion correction — reuses Breathe.jsx/
  // MorningFlow.jsx's approved, physical-iPhone-tested completion-panel
  // architecture. useMeditationSession.js's own timer already runs the
  // ONE real interval and already decides completion authoritatively
  // (see its own doc comment) — cleanupSession()/setPhase('setup') have
  // already run by the time onComplete fires, so the only new work here
  // is intercepting that exact moment to show a dedicated completion
  // panel instead of silently falling through to the setup screen.
  // advanceToAffirmation is the real mirror+navigate step (previously
  // named handleComplete) — now reached only once the user taps Continue
  // on the completed panel, or via the pre-existing Finish & continue/
  // Skip paths, which are left entirely unchanged.
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionGreeting, setCompletionGreeting] = useState(null);

  const advanceToAffirmation = () => {
    mirrorMeditateExitRef.current();
    setJourneyStep('affirmation');
    navigate('/affirmation');
  };

  // The natural-completion path only: picks the rotating greeting and
  // shows the completed panel. Deliberately does NOT navigate or mirror
  // yet — that only happens once the user taps Continue to Affirmation,
  // mirroring Breathe.jsx/MorningFlow.jsx's own "Continue-lock" pattern.
  const handleNaturalCompletion = () => {
    setCompletionGreeting(getCompletionGreeting({ journey: 'morning', practice: 'meditation' }));
    setIsCompleted(true);
  };

  const session = useMeditationSession({
    initialStyleId: 'mindful-pause',
    initialDurationId: '2min',
    initialSoundId: 'IM01',
    onComplete: handleNaturalCompletion
  });

  // Build 16 physical-iPhone correction (F3/F4) — Begin now transitions
  // into a shared 5-second preparation countdown instead of starting the
  // timer/audio immediately. preload() kicks off the sound's signed-URL
  // resolution right away, in the same gesture, so it has the whole
  // countdown to finish before begin() (at zero, or "Start now") actually
  // needs it - see meditationAudioController.js's own doc comment for why
  // this is the real fix for "music starts late."
  const countdown = usePreparationCountdown({
    seconds: 5,
    onComplete: () => {
      // Sequential-run correctness (mirrors Breathe.jsx/MorningFlow.jsx) —
      // a fresh Begin always clears any stale completed state.
      setIsCompleted(false);
      setCompletionGreeting(null);
      session.begin();
    }
  });

  const handleBegin = () => {
    setHasStartedThisVisit(true);
    session.preload();
    countdown.start();
  };

  // "Finish & continue" (active-screen bottom action, Morning journey UX
  // correction) — a deliberate EARLY finish, genuinely distinct from
  // natural completion: stops the timer/audio first (session.endSession(),
  // the exact same cleanup Back -> End Meditation already uses), then
  // reuses advanceToAffirmation() verbatim, so it goes through the
  // identical mirror-to-Session-Engine-exactly-once guard
  // (hasMirroredExitRef) and navigation as natural completion's Continue
  // action and Skip - never a second, divergent advance-to-Affirmation
  // path. Never claims the full selected duration elapsed (no completion
  // summary is fabricated); the Morning progress checkmark for Meditate
  // means "consciously moved past," not "every selected minute ran." This
  // is a deliberate early finish, not a natural completion, so it never
  // shows the completed panel — unchanged, out of this correction's scope.
  const handleFinishAndContinue = () => {
    session.endSession();
    advanceToAffirmation();
  };

  // "Choose another meditation" (active-screen secondary action, Morning
  // journey meditation-selection fix) — found live: once a meditation
  // started, there was no way to switch STYLE or DURATION (only the sound
  // choice was ever exposed on the active screen); the only route back to
  // the picker was Back's "End this meditation?". This ends the current
  // session (same session.endSession() cleanup as Back/Finish & continue -
  // stops timer/audio, never claims completion, never advances the
  // journey, never navigates Home/standalone/a later step) and returns to
  // this same step's own setup panel. Meditation ↔ Breathing alignment
  // correction — MeditationSetupPanel.jsx no longer has a collapsed/
  // expanded state to restore (every choice always renders immediately,
  // matching Breathing's own setup screens), so there is nothing left to
  // re-expand here.
  const handleChooseAnother = () => {
    session.endSession();
  };

  useEffect(() => {
    mirrorMeditateExitRef.current = () => {
      if (hasMirroredExitRef.current) return;
      hasMirroredExitRef.current = true;
      if (state.status === 'playing' && currentStep?.id === 'meditate') {
        advanceStep();
      }
    };
  }, [state.status, currentStep, advanceStep]);

  const { requestReview, confirmLeave, cancelLeave, isConfirming, routeForStep } = useReviewNavigation({
    sessionId: 'morning-routine',
    isLiveStep,
    hasUnsavedProgress: session.phase === 'active'
  });

  const handleSkip = () => advanceToAffirmation();

  // "End Meditation" (Back / active-screen "End this meditation?" confirm)
  // — genuinely distinct from Finish & continue/Choose another (see this
  // file's own top-of-file doc comment: this path stops the timer/audio
  // and returns to THIS step's own pre-start screen without advancing or
  // interrupting the parent Morning session at all). Records the honest
  // ended_early outcome for Meditate; session.endSession() is otherwise
  // unchanged local cleanup shared by the other two paths, which must NOT
  // record ended_early since they genuinely continue the journey.
  const handleEndMeditation = () => {
    recordStepEndedEarly();
    session.endSession();
  };

  // Dialog-severity correction — see Breathe.jsx's identical fix/
  // rationale. Distinct state from exitConfirmOpen above (that one is the
  // ACTIVE-screen Close/X dialog, already confirmed) - this is the
  // separate, plain pre-start "Exit routine" link, which previously had
  // zero confirmation despite abandonSession() marking the whole session
  // SKIPPED (terminal, never resurfaced as resumable).
  const [exitRoutineLinkConfirmOpen, setExitRoutineLinkConfirmOpen] = useState(false);
  const handleExitRoutine = () => setExitRoutineLinkConfirmOpen(true);
  const confirmExitRoutine = () => {
    setExitRoutineLinkConfirmOpen(false);
    setJourneyStep('');
    navigate('/');
    if (state.status === 'playing' && currentStep?.id === 'meditate') abandonSession();
  };

  // Active-screen Close/X - genuinely distinct from End Meditation (see
  // this file's own doc comment). Opens this page's own dialog rather
  // than MeditationActiveSession's local one.
  const handleRequestExitRoutine = () => setExitConfirmOpen(true);
  const handleConfirmExitRoutine = () => {
    setExitConfirmOpen(false);
    leaveActiveRoutine();
    navigate('/');
  };

  if (countdown.isActive) {
    return (
      // Physical-iPhone correction (exercise-screen safe-area architecture)
      // — see MorningFlow.jsx's identical fix/doc comment for the root
      // cause. This screen's own Back control now lives in
      // ExerciseScreenShell's dedicated, non-scrolling `header` slot.
      <ExerciseScreenShell
        journeyTone="morning"
        header={
          <div className="flex items-center gap-3">
            <BackButton
              fallback="/breathe"
              guardActiveRoute={false}
              onBeforeLeave={() => {
                countdown.cancel();
                session.cancelPreload();
                return false;
              }}
            />
          </div>
        }
      >
        {/* WakeWise DEV — colour glow extension: Morning's own embedded
            meditation step. */}
        <JourneyGlow journey="morning" />
        <PreparationCountdown
          secondsRemaining={countdown.secondsRemaining}
          cue="Find a comfortable position and let your shoulders soften."
          onSkip={countdown.skip}
          accent="morning"
        />
      </ExerciseScreenShell>
    );
  }

  // Morning Meditation completion correction — a genuine dedicated
  // completed panel, checked BEFORE the active-session branch below.
  // useMeditationSession.js's own onComplete fires only after it has
  // already flipped phase back to 'setup' (see its own doc comment), so
  // without this explicit isCompleted branch the render would silently
  // fall through to the ordinary setup screen with no acknowledgement at
  // all. Warm-gold visual language reused verbatim from Breathe.jsx/
  // MorningFlow.jsx's own completed panels - never a new colour.
  if (isCompleted) {
    return (
      // Physical-iPhone correction (exercise-screen safe-area architecture)
      // — see MorningFlow.jsx's identical fix/doc comment for the root
      // cause. Back-after-completion (ordinary navigation, never an
      // early-exit confirmation) now lives in ExerciseScreenShell's
      // dedicated, non-scrolling `header` slot.
      <ExerciseScreenShell
        journeyTone="morning"
        header={
          <div className="flex items-center gap-3">
            <BackButton fallback="/breathe" guardActiveRoute={false} />
          </div>
        }
      >
      <div className="flex flex-col min-h-full">
        <JourneyGlow journey="morning" />
        {/* "Your Momentum" foundation, Phase 3 — the shared completion-
            reveal transition. This is an early-return architecture: the
            branch above only ever renders once isCompleted is ALREADY
            true (it's skipped entirely while false), so CompletionReveal
            would only ever mount here with active already true from its
            own very first render - its usual auto-freshness detection
            (comparing `active` at its own mount) would then incorrectly
            read "already active at mount" and skip the entrance
            animation for a genuine live completion. isCompleted's own
            initializer above is a hardcoded `false`, never restored from
            persisted/session state, so reaching this branch at all
            necessarily means it just flipped true during this exact
            mount - isFresh is passed explicitly as `true` for that
            reason, the same "always-rendered completion" case
            SessionComplete.jsx's own isFreshCompletion already handles. */}
        <CompletionReveal
          active
          isFresh
          journeyTone="morning"
          className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
          stagger={[
            <div key="badge" className="w-20 h-20 rounded-full bg-morning-accent/10 border border-morning-accent-tint/25 shadow-morning-glow flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-morning-accent text-4xl" aria-hidden="true">check_circle</span>
            </div>,
            <div key="greeting" className="space-y-2">
              <span className="font-label-sm text-xs text-morning-accent uppercase tracking-widest font-bold">Meditation Completed</span>
              <h2 className="text-2xl font-bold text-on-surface font-morning-display max-w-xs mx-auto" role="status">
                {completionGreeting}
              </h2>
              <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                Carry this stillness into the rest of your morning.
              </p>
            </div>
          ]}
        />
        <div className="space-y-3 w-full">
          <button
            onClick={advanceToAffirmation}
            className={`w-full ${getJourneyPrimaryActionClasses('morning')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg`}
          >
            <span>Continue to Affirmation</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
          <button
            onClick={handleExitRoutine}
            className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors -my-1.5 py-3.5"
          >
            Exit routine
          </button>
        </div>
        <ConfirmDialog
          open={exitRoutineLinkConfirmOpen}
          title="Exit this routine?"
          message="You'll leave without finishing today's Morning routine - it won't be saved to resume later."
          confirmLabel="Exit Routine"
          cancelLabel="Stay"
          mildDestructive
          onConfirm={confirmExitRoutine}
          onDismiss={() => setExitRoutineLinkConfirmOpen(false)}
        />
      </div>
      </ExerciseScreenShell>
    );
  }

  if (session.phase === 'active' && session.snapshot) {
    return (
      <>
        {/* WakeWise DEV — colour glow extension: Morning's own embedded
            meditation step. MeditationActiveSession itself is a shared
            presentation component with no page-level background of its
            own by design - each caller (Morning/Anytime/Evening) owns
            its own atmosphere. */}
        <JourneyGlow journey="morning" />
        <MeditationActiveSession
          journeyTone="morning"
          style={session.style}
          snapshot={session.snapshot}
          soundId={session.soundId}
          soundUnavailable={session.soundUnavailable}
          onSelectSound={session.selectSound}
          onPause={session.pause}
          onResume={session.resume}
          onRequestLeave={handleEndMeditation}
          onRequestClose={handleRequestExitRoutine}
          endCopy={{
            buttonLabel: 'End Meditation',
            buttonAriaLabel: 'End meditation',
            dialogTitle: 'End this meditation?',
            dialogMessage: 'Your current meditation will end. Your Morning routine stays right where it is.',
            confirmLabel: 'End Meditation',
            cancelLabel: 'Keep Meditating'
          }}
          bottomAction={{
            buttonLabel: 'Finish & continue',
            buttonAriaLabel: 'Finish meditation and continue to Affirmation',
            dialogTitle: 'Finish meditation?',
            dialogMessage: 'Your meditation will end and your Morning routine will continue to Affirmation.',
            confirmLabel: 'Finish & continue',
            cancelLabel: 'Keep meditating',
            onConfirm: handleFinishAndContinue
          }}
          onChooseAnother={handleChooseAnother}
        />
        {/* Same copy/severity as BackButton.jsx's own default "Leave this
            routine?" guard - the canonical whole-Morning-routine exit
            confirmation, reused verbatim rather than inventing new wording
            for this one screen. */}
        {/* WakeWise Phase 2 (B7, dialog severity audit) — mirrors
            BackButton.jsx's own identical correction: this only pauses
            progress (interruptSession, resumable from Home), it erases
            nothing, so it's this app's "exit an active session" tier, not
            its "erases meaningful progress" tier. */}
        <ConfirmDialog
          open={exitConfirmOpen}
          title="Leave this routine?"
          message="Your current progress may be paused."
          confirmLabel="Leave routine"
          cancelLabel="Stay"
          mildDestructive
          onConfirm={handleConfirmExitRoutine}
          onDismiss={() => setExitConfirmOpen(false)}
        />
      </>
    );
  }

  return (
    // Physical-iPhone correction (exercise-screen safe-area architecture)
    // — see MorningFlow.jsx's identical fix/doc comment for the root
    // cause. Back/ProgressIndicator now live in ExerciseScreenShell's
    // dedicated, non-scrolling `header` slot instead of ordinary in-flow
    // children of the one scrollable region.
    <ExerciseScreenShell
      journeyTone="morning"
      header={
        <>
          <div className="flex items-center gap-3">
            {/* Back-navigation repair (Morning canonical map) — Meditation
                setup Back returns to Breathe; the whole-routine "Leave this
                routine?" confirmation belongs only to Intention (the first
                step) and to this screen's own active-phase Close/X control
                above (handleRequestExitRoutine), never here. */}
            <BackButton fallback="/breathe" guardActiveRoute={false} />
          </div>
          <ProgressIndicator activeStep="meditate" onReviewStep={requestReview} />

          {isReviewMode && currentStep && (
            <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
          )}
        </>
      }
    >
    <div
      // Physical-iPhone correction — `justify-between` (a min-h-full flex
      // column with few, short children) was distributing all the
      // viewport's leftover vertical space as extra gaps BETWEEN those
      // children, on top of the already-generous space-y-10 - the real
      // cause of the excessive blank space between ProgressIndicator and
      // MeditationSetupPanel's own icon/heading. Removed entirely (this
      // screen never needed content pinned to the bottom edge - Exit
      // routine now simply follows the panel in normal flow, matching
      // every other Morning setup screen's own convention) and space-y-10
      // tightened to space-y-4, matching MorningFlow.jsx's/Breathe.jsx's
      // own established "compact inter-section gap" values.
      className="flex flex-col space-y-4"
    >
      {/* WakeWise DEV — colour glow extension: Morning's own embedded
          meditation step. */}
      <JourneyGlow journey="morning" />

      <MeditationSetupPanel
        journeyTone="morning"
        heading="Mindful Pause"
        purpose="A quiet moment before your affirmation."
        recommendedDurationId={getRecommendedDurationId(MEDITATION_CONTEXTS.MORNING_EMBEDDED)}
        // Defect fix — beginLabel omitted entirely: it previously
        // hardcoded "Begin 2-Minute Meditation" regardless of the
        // actually-selected duration, going stale the moment the user
        // picked 5/10 minutes. Omitting it lets MeditationSetupPanel.jsx
        // compute the live label from `duration` (below) instead - see
        // that file's own doc comment.
        style={session.style}
        duration={session.duration}
        soundId={session.soundId}
        onSelectStyle={session.selectStyle}
        onSelectDuration={session.setDurationId}
        onSelectSound={session.selectSound}
        onBegin={handleBegin}
        // Morning journey UX correction: no forward-skip action at all
        // while reviewing an already-completed Meditation from Affirmation
        // - the ReviewModeBanner's own "Return to Affirmation" already
        // covers that. Outside review mode, the label reflects whether the
        // user has actually engaged with Meditation this visit yet.
        onSkip={isReviewMode ? undefined : handleSkip}
        skipLabel={hasStartedThisVisit ? 'Continue to Affirmation' : 'Skip meditation'}
      />

      <button
        type="button"
        onClick={handleExitRoutine}
        className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors -my-1.5 py-3.5"
      >
        Exit routine
      </button>

      <ConfirmDialog
        open={isConfirming}
        title="Leave this meditation?"
        message="Your meditation in progress will end if you review an earlier step."
        confirmLabel="Leave Meditation"
        cancelLabel="Stay"
        mildDestructive
        onConfirm={confirmLeave}
        onDismiss={cancelLeave}
      />
      <ConfirmDialog
        open={exitRoutineLinkConfirmOpen}
        title="Exit this routine?"
        message="You'll leave without finishing today's Morning routine - it won't be saved to resume later."
        confirmLabel="Exit Routine"
        cancelLabel="Stay"
        mildDestructive
        onConfirm={confirmExitRoutine}
        onDismiss={() => setExitRoutineLinkConfirmOpen(false)}
      />
    </div>
    </ExerciseScreenShell>
  );
};

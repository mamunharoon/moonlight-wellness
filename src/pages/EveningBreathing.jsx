import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { BreathingRing } from '../components/BreathingRing';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { BreathingPatternRow } from '../components/BreathingPatternRow';
import { InteractiveAmbientMusic } from '../components/InteractiveAmbientMusic';
import { MusicPreferenceToggle } from '../components/MusicPreferenceToggle';
import { ExercisePausedPanel } from '../components/ExercisePausedPanel';
import { isFeatureEnabled } from '../lib/featureFlags';
import { isInteractiveMusicEligible } from '../lib/backgroundMusicSelection';
import { getBetaVideoById } from '../lib/mediaCatalog';
import { getMusicPreference, setMusicPreferenceForUser } from '../lib/musicPreference';
import { BREATHING_PATTERNS, getBreathingPatternById, resolveBreathPhase } from '../lib/breathingPatterns';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { loadEveningBreathingPattern, saveEveningBreathingPattern } from '../lib/eveningBreathingSelection';
import { ReviewModeBanner } from '../components/ReviewModeBanner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { savePausedExerciseState, loadPausedExerciseState, clearPausedExerciseState } from '../session/timedExercisePause';
import { getStepLabel } from '../lib/stepLabels';

// Background Music — reserved id for the shared interactive-breathing
// ambient loop (see docs/background-music-asset-manifest.md).
const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';

// Build 15 Evening UX correction — Evening now offers the same three real
// shared patterns Morning/standalone already do (BREATHING_PATTERNS),
// defaulting to its own established 4-7-8 recommendation rather than
// being permanently fixed to it. Nothing (timer, ring animation, or
// music) starts before "Begin Breathing" is tapped - same proven
// pre-start shape already used by Breathe.jsx/QuietBreathing.jsx.
const DEFAULT_PATTERN_ID = 'evening';

/*
 * Stage 4 Batch F6 — EveningBreathing
 *
 * Fourth step of the evening-wind-down session. Reuses BreathingRing
 * (F2) as-is — the visual is unchanged; only the timing driving it
 * changes. Same mirrorBreathingExitRef one-shot-guard pattern as
 * Breathe.jsx, targeting the 'breathing' step and advanceStep()
 * (immediately adjacent to 'sleepPreparation').
 *
 * Guest pre-start-music correction (Build 18, complete) — neither the
 * pre-start MusicPreferenceToggle nor the paused-state ExercisePausedPanel
 * below route a guest's tap to sign-in any more (see each component's own
 * updated doc comment). The former confirmSignInForMusic handler (a local
 * setPendingContent+navigate('/auth') pair - this screen has no guided-
 * video rows to borrow a confirmSignIn from) is removed entirely, now
 * genuinely dead: nothing on this screen navigates to sign-in for music
 * any more. handleToggleMusicPreference persists through the shared
 * setMusicPreferenceForUser (musicPreference.js) instead of the raw
 * setter, so a guest's choice still drives real playback this mount but
 * is never written to the shared, device-scoped key.
 * handleBeginBreathing's own `&& !isGuest` guard is removed too - a guest
 * who left the switch On now genuinely gets InteractiveAmbientMusic's
 * start() called on Begin, exactly like an authenticated user (IB01 is
 * server-allowlisted for guests - see interactiveAmbientMusic.test.js).
 */
export const EveningBreathing = () => {
  const navigate = useNavigate();
  const { effectiveTimezone, userId } = useAlarm();
  const today = getZonedParts(effectiveTimezone, devNow()).dateKey;
  const { isGuest } = useAuth();
  const { state, currentStep, advanceStep, skipStep } = useSession();
  const { isReviewMode, isLiveStep } = useStepReviewMode('breathing', 'evening-wind-down');
  // isRepeatGated hidden-options defect fix — the exact same defect and
  // fix as MorningFlow.jsx/Breathe.jsx (found live: "Back from Meditation
  // opened an already-running Breathing countdown, with no pattern
  // choices available" was actually two separate bugs - the paused-
  // snapshot auto-start fixed above via trustedSnapshot, and this
  // isRepeatGated gate independently hiding the real setup screen behind
  // a "Repeat this exercise?" tap whenever reviewing an already-passed
  // step). Always false now.
  const isRepeatGated = false;
  const [pausedSnapshot] = useState(() => loadPausedExerciseState('evening-wind-down', 'breathing'));
  useEffect(() => {
    if (pausedSnapshot) clearPausedExerciseState('evening-wind-down', 'breathing');
  }, [pausedSnapshot]);

  // Review-mode auto-start defect fix — found live: "Back from Meditation
  // opened an already-running Breathing countdown, with no pattern
  // choices available." A pausedSnapshot only represents a genuine "I
  // left THIS exact live step mid-run to review something else" resume;
  // if this mount is not currently the live step (isLiveStep false - a
  // stale, un-consumed snapshot from an earlier, unrelated interrupted
  // round-trip can still sit in sessionStorage), it must never be
  // trusted to auto-restore an already-active exercise. The raw snapshot
  // is still read and cleared unconditionally above so a stale one can
  // never resurface later either way; only TRUSTED for seeding initial
  // UI state when isLiveStep is true at mount.
  const trustedSnapshot = isLiveStep ? pausedSnapshot : null;

  const [hasBegun, setHasBegun] = useState(() => Boolean(trustedSnapshot));

  // Build 15 Evening UX correction — tonight's selected pattern. Priority:
  // a genuine review-round-trip snapshot (same as Breathe.jsx's own
  // precedent) first, then whatever was already persisted/selected
  // earlier tonight (survives backgrounding/remount/leaving to Home and
  // resuming), then the established 4-7-8 default.
  const [selectedPatternId, setSelectedPatternId] = useState(
    () => trustedSnapshot?.patternId ?? loadEveningBreathingPattern(userId, today) ?? DEFAULT_PATTERN_ID
  );
  const activePattern = getBreathingPatternById(selectedPatternId) ?? getBreathingPatternById(DEFAULT_PATTERN_ID);
  const handleSelectPattern = (patternId) => {
    setSelectedPatternId(patternId);
    saveEveningBreathingPattern(userId, patternId, today);
  };

  const { requestReview, confirmLeave, cancelLeave, isConfirming, routeForStep } = useReviewNavigation({
    sessionId: 'evening-wind-down',
    isLiveStep,
    hasUnsavedProgress: true,
    onLeaveLiveStep: () => savePausedExerciseState('evening-wind-down', 'breathing', {
      secondsLeft,
      breatheState,
      patternId: selectedPatternId,
      musicEnabled: musicPreferenceOn
    })
  });
  const [breatheState, setBreatheState] = useState(() => trustedSnapshot?.breatheState ?? 'Inhale');
  const [secondsLeft, setSecondsLeft] = useState(() => trustedSnapshot?.secondsLeft ?? activePattern.totalSeconds);
  const [manuallyPaused, setManuallyPaused] = useState(() => Boolean(trustedSnapshot));
  const handlePauseExercise = () => setManuallyPaused(true);
  const handleResumeExercise = () => setManuallyPaused(false);
  const musicPlayerRef = useRef(null);
  const handleResumeWithMusic = () => {
    setManuallyPaused(false);
    musicPlayerRef.current?.start();
  };
  const musicEligible = isInteractiveMusicEligible({
    musicVariantId: INTERACTIVE_BREATHING_MUSIC_ID,
    featureEnabled: isFeatureEnabled('backgroundMusic'),
    getEntryById: getBetaVideoById
  });
  // Build 15 — genuinely safe to seed from the persisted preference now:
  // Begin Breathing is a real mandatory gesture before any playback.
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

  if (EveningSceneShell && BreathingRing && ProgressIndicator && BreathingPatternRow && InteractiveAmbientMusic && MusicPreferenceToggle && ExercisePausedPanel && ReviewModeBanner && ConfirmDialog) { /* no-op to satisfy blind linter */ }

  const hasMirroredExitRef = useRef(false);
  const mirrorExitRef = useRef(() => {});
  useEffect(() => {
    mirrorExitRef.current = () => {
      if (hasMirroredExitRef.current) return;
      hasMirroredExitRef.current = true;
      if (state.status === 'playing' && currentStep?.id === 'breathing') {
        advanceStep();
      }
    };
  }, [state.status, currentStep, advanceStep]);

  // Continue-lock/Skip-semantics fix, found live: "Continue was tappable
  // with 50 seconds still remaining, and doing so marked the step as
  // completed." Natural timer completion used to auto-navigate
  // immediately (identical to a manual Continue tap), and Continue itself
  // was tappable at any point while active/unpaused - not gated on the
  // timer actually finishing. Now: reaching 0 only STOPS the countdown
  // (no navigation) and hasFinished (below) unlocks the Continue button -
  // Continue itself, tapped afterward, is what records completion and
  // advances. Skip remains the only early-exit action while still
  // running, and now calls the canonical, separately-validated
  // skipStep() (see handleSkip) instead of sharing this completion path -
  // previously Continue and Skip were the exact same handler.
  const hasFinished = secondsLeft <= 0;
  useEffect(() => {
    // Build 15: nothing runs until hasBegun. Pause-during-review fix -
    // freeze the countdown the instant the confirmation dialog opens.
    if (!hasBegun || manuallyPaused || isRepeatGated || isConfirming || hasFinished) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        const nextSec = prev - 1;
        setBreatheState(resolveBreathPhase(activePattern, nextSec));
        return nextSec;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasFinished, hasBegun, manuallyPaused, isRepeatGated, isConfirming, activePattern]);

  // Double-tap protection - see Breathe.jsx's identical rationale. Also
  // where the selected pattern is effectively "locked" for the active
  // run - the picker UI below only renders while !hasBegun, so
  // selectedPatternId can never change again once this fires.
  const hasBegunOnceRef = useRef(false);
  const handleBeginBreathing = () => {
    if (hasBegunOnceRef.current) return;
    hasBegunOnceRef.current = true;
    setSecondsLeft(activePattern.totalSeconds);
    setBreatheState('Inhale');
    setHasBegun(true);
    if (musicEligible && musicPreferenceOn) {
      musicPlayerRef.current?.start();
    }
  };

  // Only reachable once hasFinished (Continue is hidden until then, see
  // render below) or from the pre-start Skip-equivalent Skip button -
  // records genuine completion and advances.
  const handleComplete = () => {
    navigate('/evening-meditate');
    mirrorExitRef.current();
  };

  // Continue-lock/Skip-semantics fix — Skip is the explicit early-exit
  // action while still running (or at any point), genuinely distinct from
  // Continue/natural completion: it calls the Session Engine's own
  // canonical skipStep() (validated against currentStep.skippable and
  // 'playing' status by the reducer itself) rather than the
  // completion-mirror's advanceStep(), so it can never be recorded as
  // completing the step.
  const handleSkip = () => {
    navigate('/evening-meditate');
    skipStep();
  };

  // Back-navigation repair (canonical Morning/Evening map) — Active
  // Breathing Back must safely stop the exercise and return to this
  // step's own pre-start screen, never straight to Gratitude and never
  // the whole-routine exit (this screen never opts into EveningSceneShell's
  // guardActiveRoute prop, so Back here stays unguarded - only its
  // separate showExit control leaves the routine outright). A subsequent
  // Back tap, once hasBegun is false again, falls through to the ordinary
  // previous-step navigation. Mirrors Breathe.jsx's identical handler.
  const handleBackFromActive = () => {
    if (!hasBegun || isRepeatGated) return;
    hasBegunOnceRef.current = false;
    setManuallyPaused(false);
    setBreatheState('Inhale');
    setSecondsLeft(activePattern.totalSeconds);
    setHasBegun(false);
    musicPlayerRef.current?.stop();
    return false;
  };

  return (
    // Build 15 Evening UX correction — fixes the confirmed Back-matrix bug:
    // the missing `?q=3` meant Back landed on Gratitude Q1 (parseActiveIndex
    // defaults a missing q to index 0), not Gratitude Q3 as required.
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/gratitude?q=3" onBeforeLeave={handleBackFromActive} showExit>
      <ProgressIndicator activeStep="breathing" sessionId="evening-wind-down" onReviewStep={requestReview} />
      {/* Journey Embedding (correction) — total is now 7, not 6. */}
      <span className="block text-center text-[10px] text-primary uppercase font-bold tracking-wider">Step 4 of 7</span>

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      {!hasBegun ? (
        <>
          {/* Build 15 Evening UX correction — real pattern selection,
              replacing the former fixed-4-7-8-only preview. Nothing
              below this point runs a timer, animation, or plays music -
              see handleBeginBreathing above for the one gesture that
              starts all three together. */}
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="text-center space-y-2">
              <h1 className="font-serif italic text-2xl text-on-surface">Breathe with the night.</h1>
              <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                Slow, easy breaths. There is nowhere else to be.
              </p>
            </div>

            <div className="space-y-3" role="radiogroup" aria-label="Choose your breathing practice">
              {BREATHING_PATTERNS.map((pattern) => (
                <BreathingPatternRow
                  key={pattern.id}
                  pattern={pattern}
                  selected={selectedPatternId === pattern.id}
                  onSelect={handleSelectPattern}
                  groupName="evening-breathing-pattern"
                  accent="evening"
                />
              ))}
            </div>

            {musicEligible && (
              <MusicPreferenceToggle
                isOn={musicPreferenceOn}
                onToggle={handleToggleMusicPreference}
                description="Play gentle music during your breathing practice."
                accent="evening"
              />
            )}
          </div>

          <div className="space-y-3 w-full">
            <button
              type="button"
              onClick={handleBeginBreathing}
              className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
            >
              <span>Begin Breathing</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
            <button
              onClick={handleSkip}
              className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/40"
            >
              Skip
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
            <div className="space-y-2">
              <h1 className="font-serif italic text-2xl text-on-surface">Breathe with the night.</h1>
              <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                Slow, easy breaths. There is nowhere else to be.
              </p>
            </div>

            <BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} />
          </div>
        </>
      )}

      {/* Build 15 fix — a SINGLE, stable InteractiveAmbientMusic instance,
          never remounted across the pre-start -> active transition - see
          MorningFlow.jsx's identical fix/doc comment for the full
          rationale (a ref-triggered start() on an instance that's about
          to unmount orphans the audio element). */}
      {!isRepeatGated && (
        <InteractiveAmbientMusic
          ref={musicPlayerRef}
          musicVariantId={INTERACTIVE_BREATHING_MUSIC_ID}
          suspended={hasBegun ? manuallyPaused : false}
          hideToggle={!hasBegun}
        />
      )}

      {hasBegun && !isRepeatGated && manuallyPaused && (
        <ExercisePausedPanel
          onResumeExercise={handleResumeExercise}
          onResumeWithMusic={handleResumeWithMusic}
          showResumeWithMusic={musicEligible}
        />
      )}

      {hasBegun && !isRepeatGated && !manuallyPaused && (
        <button
          type="button"
          onClick={handlePauseExercise}
          className="w-full py-4 glass-panel text-on-surface rounded-full font-bold flex items-center justify-center gap-2 border-white/10"
        >
          <span className="material-symbols-outlined text-sm">pause</span>
          <span>Pause Exercise</span>
        </button>
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
              {hasFinished && !manuallyPaused && (
                <button
                  onClick={handleComplete}
                  className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
                >
                  <span>Continue</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              )}
              <button
                onClick={handleSkip}
                className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/40"
              >
                Skip
              </button>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={isConfirming}
        title="Review an earlier step?"
        message="Your current exercise will be paused."
        confirmLabel="Review Step"
        cancelLabel="Cancel"
        onConfirm={confirmLeave}
        onDismiss={cancelLeave}
      />
    </EveningSceneShell>
  );
};

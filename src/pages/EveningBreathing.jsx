import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { setPendingContent } from '../lib/pendingContent';
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
import { getMusicPreference, setMusicPreference } from '../lib/musicPreference';
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
 */
export const EveningBreathing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { effectiveTimezone, userId } = useAlarm();
  const today = getZonedParts(effectiveTimezone, devNow()).dateKey;
  const { isGuest } = useAuth();
  // Guest lock state (Build 11 RC fix) - see MusicEntryChoice.jsx's own
  // doc comment. This page has no guided-video rows (no useProtectedVideo
  // instance to borrow a confirmSignIn from), so it stashes/navigates
  // directly.
  const confirmSignInForMusic = () => {
    setPendingContent({ returnPath: `${location.pathname}${location.search}` });
    navigate('/auth');
  };
  const { state, currentStep, advanceStep } = useSession();
  const { isReviewMode, isLiveStep } = useStepReviewMode('breathing', 'evening-wind-down');
  const [hasStartedRepeat, setHasStartedRepeat] = useState(false);
  const isRepeatGated = isReviewMode && !hasStartedRepeat;
  const [pausedSnapshot] = useState(() => loadPausedExerciseState('evening-wind-down', 'breathing'));
  useEffect(() => {
    if (pausedSnapshot) clearPausedExerciseState('evening-wind-down', 'breathing');
  }, [pausedSnapshot]);

  const [hasBegun, setHasBegun] = useState(() => Boolean(pausedSnapshot));

  // Build 15 Evening UX correction — tonight's selected pattern. Priority:
  // a genuine review-round-trip snapshot (same as Breathe.jsx's own
  // precedent) first, then whatever was already persisted/selected
  // earlier tonight (survives backgrounding/remount/leaving to Home and
  // resuming), then the established 4-7-8 default.
  const [selectedPatternId, setSelectedPatternId] = useState(
    () => pausedSnapshot?.patternId ?? loadEveningBreathingPattern(userId, today) ?? DEFAULT_PATTERN_ID
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
  const [breatheState, setBreatheState] = useState(() => pausedSnapshot?.breatheState ?? 'Inhale');
  const [secondsLeft, setSecondsLeft] = useState(() => pausedSnapshot?.secondsLeft ?? activePattern.totalSeconds);
  const [manuallyPaused, setManuallyPaused] = useState(() => Boolean(pausedSnapshot));
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

  useEffect(() => {
    // Build 15: nothing runs until hasBegun. Pause-during-review fix -
    // freeze the countdown the instant the confirmation dialog opens.
    if (!hasBegun || manuallyPaused || isRepeatGated || isConfirming) return;

    if (secondsLeft <= 0) {
      navigate('/prepare-for-rest');
      mirrorExitRef.current();
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
  }, [secondsLeft, navigate, hasBegun, manuallyPaused, isRepeatGated, isConfirming, activePattern]);

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
    if (musicEligible && musicPreferenceOn && !isGuest) {
      musicPlayerRef.current?.start();
    }
  };

  const handleAdvance = () => {
    navigate('/prepare-for-rest');
    mirrorExitRef.current();
  };

  return (
    // Build 15 Evening UX correction — fixes the confirmed Back-matrix bug:
    // the missing `?q=3` meant Back landed on Gratitude Q1 (parseActiveIndex
    // defaults a missing q to index 0), not Gratitude Q3 as required.
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/gratitude?q=3" showExit>
      <ProgressIndicator activeStep="breathing" sessionId="evening-wind-down" onReviewStep={requestReview} />
      <span className="block text-center text-[10px] text-primary uppercase font-bold tracking-wider">Step 4 of 6</span>

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      {isRepeatGated ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
          <div className="space-y-2">
            <h1 className="font-serif italic text-2xl text-on-surface">Breathe with the night.</h1>
            <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
              Slow, easy breaths. There is nowhere else to be.
            </p>
          </div>
          <div className="glass-panel rounded-2xl p-6 text-center space-y-4 border-white/10 w-full">
            <p className="text-sm text-on-surface-variant">You already completed this step. Repeating it starts the breathing exercise from the beginning.</p>
            <button
              type="button"
              onClick={() => setHasStartedRepeat(true)}
              className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
            >
              <span className="material-symbols-outlined text-sm">replay</span>
              <span>Repeat this exercise</span>
            </button>
          </div>
        </div>
      ) : !hasBegun ? (
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
                isGuest={isGuest}
                onSignIn={confirmSignInForMusic}
                description="Play gentle music during your breathing practice."
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
              onClick={handleAdvance}
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
          isGuest={isGuest}
          onSignIn={confirmSignInForMusic}
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
              {!manuallyPaused && (
                <button
                  onClick={handleAdvance}
                  className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
                >
                  <span>Continue</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              )}
              <button
                onClick={handleAdvance}
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

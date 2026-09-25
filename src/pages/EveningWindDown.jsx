import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { getStepLabel } from '../lib/stepLabels';

/*
 * Stage 4 Batch F3/F4 (fixed in F7 validation) — EveningWindDown
 *
 * Entry step of the evening-wind-down session (src/session/
 * sessionDefinitions.js). Begin advances one real step at a time via
 * advanceStep() — the F3 version of this file jumped straight to
 * 'completion' via advanceToStep() since no intermediate page existed
 * yet; F4 replaced that shortcut with the genuine next step.
 *
 * F7 defect fix: startSession('evening-wind-down') is only safe to call
 * unconditionally when no session is already in progress. The previous
 * version called startSession()+advanceStep() unconditionally on every
 * Begin click, reasoning that a rejected (no-op) startSession() while
 * already 'playing' made the following advanceStep() "chain off
 * correctly either way" — that reasoning was wrong: advanceStep() is
 * NOT a no-op in that case. It advances from wherever the session
 * CURRENTLY is, not always from 'windDown'. Reproduced via browser Back:
 * Begin -> Reflection, Back -> Wind-down (session still 'playing' at
 * 'reflection'), Begin again -> advanceStep() silently pushed the engine
 * to 'gratitude' while the URL still read '/reflection', a real
 * state/URL mismatch. Fixed by only starting+advancing a fresh session
 * when none is already playing; an in-progress session is resumed at
 * its own currentStep.route instead of being blindly re-advanced.
 */
export const EveningWindDown = () => {
  const navigate = useNavigate();
  const { state, currentStep, startSession, advanceStep, resetSession, resumeSession } = useSession();
  // Safe backward navigation ("Review Mode") - this screen has no timer
  // and no input of its own (static copy + one Begin button), so review-
  // only viewing needs no repeat-confirmation gate at all - see
  // Breathe.jsx's identical block for the general rationale.
  const { isReviewMode, isLiveStep } = useStepReviewMode('windDown', 'evening-wind-down');
  const { routeForStep } = useReviewNavigation({ sessionId: 'evening-wind-down', isLiveStep, hasUnsavedProgress: false });

  if (EveningSceneShell) { /* no-op to satisfy blind linter */ }

  const handleBegin = () => {
    if (state.status === 'playing' && state.sessionId === 'evening-wind-down' && currentStep) {
      navigate(currentStep.route ?? '/reflection');
      return;
    }

    // Close Remaining Daily-Journey Limitations: an 'interrupted' session
    // for THIS SAME routine (e.g. left via BackButton's "Leave routine")
    // must be resumed at its own paused step, not reset and restarted
    // from Step 1 — that was silently discarding real progress (and
    // Home.jsx's "Continue Wind-Down" landed here expecting exactly this
    // resume). A stale/incompatible session (any other sessionId) still
    // falls through to the reset-before-start guard below, unchanged.
    if (state.status === 'interrupted' && state.sessionId === 'evening-wind-down' && currentStep) {
      resumeSession();
      navigate(currentStep.route ?? '/reflection');
      return;
    }
    // Back-navigation repair: START_SESSION rejects outright if a session
    // is already 'playing' or 'interrupted' — including a stale, unrelated
    // one (e.g. Rise & Reset left via the Leave-routine confirmation).
    // Same guard as RoutineDetail.jsx's beginRiseAndReset and
    // AlarmContext.jsx's own startSession('morning-routine') call.
    if (state.status === 'playing' || state.status === 'interrupted') {
      resetSession();
    }
    startSession('evening-wind-down');
    advanceStep();
    navigate('/reflection');
  };

  return (
    // Release-candidate verification fix: `guardActiveRoute` opts this one
    // screen back into BackButton's "Leave this routine?" confirmation
    // (every other Evening screen keeps it off - see EveningSceneShell.jsx's
    // own doc comment for why). Wind-Down is the routine's first step with
    // no internal sub-questions of its own, so this only ever fires for the
    // genuine duration Wind-Down itself is the live step - matching Exit's
    // existing confirmation instead of Back silently going Home unguarded.
    <EveningSceneShell atmosphere={{ phase: 'dusk' }} showBack backFallback="/" showExit guardActiveRoute>
      {/* Build 15 Evening UX correction — this screen deliberately never
          renders ReviewModeBanner, even though useStepReviewMode reports
          isReviewMode=true whenever the journey is already mid-flight
          (e.g. Reflection Q1's Back lands here while currentStep.id is
          still 'reflection'). That banner's "Reviewing — your place is
          still X" wording describes revisiting an EARLIER STEP mid-
          journey (the genuine ProgressIndicator/onReviewStep use case
          every other step page renders it for) - landing on the entry
          screen while further along is a different, non-confusing case:
          the button below already reflects the real state honestly
          (Return to {step} vs Begin My Wind-Down) with no banner needed.
          Viewing this page never changes currentStep or deletes anything
          either way - isReviewMode only decides which button renders. */}

      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
        <span className="material-symbols-outlined text-on-surface-variant/70 text-4xl">wb_twilight</span>
        {/* Journey Embedding (correction) — total is now 7, not 6 (Meditate
            is a counted step) - this screen's own number (1) is unchanged. */}
        <span className="block text-[10px] text-primary uppercase font-bold tracking-wider">Step 1 of 7</span>
        <h1 className="font-serif italic text-3xl text-on-surface">Evening Wind-Down</h1>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          Together, we'll reflect on your day, notice something positive, release what's weighing on you, breathe slowly, and prepare for rest.
        </p>
        <p className="text-xs text-on-surface-variant/80 max-w-xs mx-auto leading-relaxed">
          There are no right answers. Take what helps tonight and skip anything you don't need.
        </p>
      </div>

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
        <button
          onClick={handleBegin}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          <span>Begin My Wind-Down</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      )}
    </EveningSceneShell>
  );
};

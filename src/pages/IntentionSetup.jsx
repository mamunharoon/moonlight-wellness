/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { BackButton } from '../components/BackButton';
import { INTENTION_PRESETS } from '../lib/intentionAffirmations';
import { saveIntentionsToCloud } from '../lib/intentionPersistence';
import { toggleIntention, roleForIndex, LIMIT_MESSAGE } from '../lib/intentionSelection';
import { ReviewModeBanner } from '../components/ReviewModeBanner';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { getStepLabel } from '../lib/stepLabels';

/*
 * Morning-flow redesign — Intention step, now Step 1 of 4 (was Step 5 of
 * 5, immediately before Complete). Home's "Begin Rise & Reset",
 * RoutineDetail's "Start Routine", and AlarmActive's slide-to-unlock all
 * now start the Session Engine directly at this step (see each file's
 * own updated startSession(..., { startIndex: getStepIndex(...,
 * MORNING_STEP_IDS.INTENTION) }) call) - the former /morning-start
 * video-selection screen is removed from the routine entirely.
 *
 * F01-F03 "Focus Sessions" video rows are removed from this in-routine
 * step per the approved redesign (guided-video catalogues must not
 * interrupt the core routine) - not deleted from the catalogue or
 * Storage, still fully browsable via Library (see mediaCatalog.js's own
 * MORNING-FLOW REDESIGN REACHABILITY UPDATE comment).
 *
 * "Start Your Journey" renamed to "Continue" (this is no longer the last
 * screen before Complete - Stretch/Breathe/Affirm still follow).
 *
 * Quick-routine branch relocated here from Affirmation.jsx: this step
 * used to be immediately before Complete, so Affirmation.jsx (immediately
 * before Stretch/Breathe in the old order) owned the "skip Stretching
 * entirely for a quick routine" decision. Now Intention is immediately
 * before Stretch, so this screen owns that decision instead - the
 * destination step is the only thing that changed; the branch logic
 * itself (advanceToStep('breathe') vs advanceStep()) is copied verbatim
 * from Affirmation.jsx's own previous handleNext/handleSkip.
 */
export const IntentionSetup = () => {
  const navigate = useNavigate();
  const { userId, intentions, setIntentions, setJourneyStep, routineDuration } = useAlarm();
  const { state, currentStep, advanceStep, advanceToStep, abandonSession } = useSession();
  // Safe backward navigation ("Review Mode") - handleSelectPreset/
  // handleAddCustom below already only ever call setIntentions (no
  // Session Engine call at all), so changing today's intention while
  // reviewing this step is already exactly as safe as Home's own "Change
  // intention" - nothing extra to gate there. Only Continue/Skip/Exit
  // (which DO drive the Session Engine forward) need to be replaced by a
  // plain "Return to current step" while reviewing.
  const { isReviewMode, isLiveStep } = useStepReviewMode('intention', 'morning-routine');
  const [customIntention, setCustomIntention] = useState('');
  const [limitMessage, setLimitMessage] = useState('');
  // A typed-but-not-yet-added custom intention is real unsaved input -
  // confirm before leaving the LIVE step via the progress bar with it
  // still sitting there.
  // No ProgressIndicator is rendered on this page today (Intend is Step
  // 1 - nothing before it to review from here), so confirmLeave/
  // cancelLeave/isConfirming below are dormant unless a future change
  // adds one; routeForStep is what "Return to current step" already uses.
  const { routeForStep } = useReviewNavigation({
    sessionId: 'morning-routine',
    isLiveStep,
    hasUnsavedProgress: customIntention.trim().length > 0
  });
  const [isSaving, setIsSaving] = useState(false);

  const presets = INTENTION_PRESETS;

  // Safe backward navigation ("Review Mode") fix: while reviewing this
  // step, Continue/Skip (the only place that otherwise calls
  // saveIntentionsToCloud, in handleComplete below) is replaced by
  // "Return to [current step]" and is never reachable - so a change made
  // here during review would update the live intentions the rest of the
  // app reads (correct), but silently never reach Supabase, reverting on
  // the next reload/device. Saving immediately here (only in review
  // mode) closes that gap without changing the ordinary live-step flow,
  // which still defers to its own explicit Continue tap.
  //
  // One or two intentions - toggleIntention owns every rule (dedup,
  // deselect, promote Supporting to Primary when index 0 is removed, the
  // two-item limit). Never mutates `intentions` - always a new array.
  const applySelection = (value) => {
    const { intentions: next, limitReached } = toggleIntention(intentions, value);
    if (limitReached) {
      setLimitMessage(LIMIT_MESSAGE);
      setTimeout(() => setLimitMessage(''), 2500);
      return;
    }
    setLimitMessage('');
    setIntentions(next);
    if (isReviewMode) saveIntentionsToCloud(userId, next);
  };

  const handleSelectPreset = (preset) => applySelection(preset);

  const handleAddCustom = () => {
    const trimmed = customIntention.trim();
    if (!trimmed) return;
    applySelection(trimmed);
    setCustomIntention('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  // Mirror only when the engine is genuinely playing at the 'intention'
  // step — a direct-route visit with no active session, or a mismatched
  // mirror, silently does nothing here.
  const mirrorTransition = () => {
    if (state.status !== 'playing' || currentStep?.id !== 'intention') return;
    if (routineDuration === 'quick') {
      advanceToStep('breathe');
    } else {
      advanceStep();
    }
  };

  const handleComplete = async () => {
    setIsSaving(true);

    // Continue itself is disabled below whenever intentions is empty, so
    // this fallback only ever actually applies to Skip - which, unlike
    // Continue, deliberately lets the user move on without an explicit
    // choice, exactly like it always has (previously a preset tap always
    // left exactly one item selected, so intentions could never be empty
    // here at all; now that deselection is possible, Skip keeps that
    // same "always proceeds" behaviour by falling back to the default).
    const toSave = intentions.length > 0 ? intentions : ['Stay calm'];
    if (intentions.length === 0) setIntentions(toSave);

    await saveIntentionsToCloud(userId, toSave);

    setIsSaving(false);

    if (routineDuration === 'quick') {
      setJourneyStep('breathe');
      navigate('/breathe'); // Quick routine skips stretching entirely
    } else {
      setJourneyStep('stretch');
      navigate('/morning-flow');
    }
    mirrorTransition();
  };

  const handleExitRoutine = () => {
    setJourneyStep('');
    navigate('/');
    if (state.status === 'playing' && currentStep?.id === 'intention') abandonSession();
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-md mx-auto space-y-8 select-none">
      <div className="flex items-center gap-3">
        <BackButton fallback="/routines/rise-reset" />
      </div>

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      <div className="text-center space-y-2">
        <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">Your Intentions</span>
        <h2 className="text-2xl font-bold text-on-surface">Set your intention</h2>
        <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
          Choose one or two intentions for today.
        </p>
        {limitMessage && (
          <p className="text-xs text-secondary font-semibold" role="status">{limitMessage}</p>
        )}
      </div>

      {/* Preset List */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {presets.map((preset, idx) => {
          const selectedIndex = intentions.findIndex((item) => item.toLowerCase() === preset.toLowerCase());
          const isSelected = selectedIndex !== -1;
          const role = roleForIndex(selectedIndex);
          return (
            <button
              key={idx}
              onClick={() => handleSelectPreset(preset)}
              aria-pressed={isSelected}
              className={`relative p-4 rounded-2xl border text-xs font-semibold text-center transition-all duration-200 ${
                isSelected
                  ? 'bg-primary-container/20 border-primary text-primary font-bold shadow-md shadow-primary/5'
                  : 'glass-panel border-white/5 text-on-surface-variant hover:bg-white/10'
              }`}
            >
              {role && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-on-primary text-[9px] font-bold uppercase tracking-wider shadow-sm">
                  {role}
                </span>
              )}
              {preset}
            </button>
          );
        })}
      </div>

      {/* Selected summary - the only place a selected CUSTOM intention is
          shown (it never appears in the preset grid above), and the
          shared way to deselect either kind by role. */}
      {intentions.length > 0 && (
        <div className="flex flex-wrap gap-2 w-full justify-center">
          {intentions.map((item, idx) => (
            <button
              key={item.toLowerCase()}
              onClick={() => applySelection(item)}
              className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-primary-container/20 border border-primary text-primary text-xs font-semibold"
            >
              <span className="text-[9px] font-bold uppercase tracking-wider">{roleForIndex(idx)}</span>
              <span>{item}</span>
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          ))}
        </div>
      )}

      {/* Unified custom input/button control */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-panel border border-white/10 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
        <input
          type="text"
          value={customIntention}
          onChange={(e) => setCustomIntention(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 bg-transparent border-none text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none px-3"
          placeholder="Write your own..."
        />
        <button
          onClick={handleAddCustom}
          disabled={!customIntention.trim()}
          className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container text-xs font-bold uppercase tracking-wider active:scale-95 disabled:opacity-40 transition-all shrink-0"
        >
          Add
        </button>
      </div>

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
            <button
              onClick={handleComplete}
              disabled={isSaving || intentions.length === 0}
              className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-40"
            >
              <span>{isSaving ? 'Saving...' : 'Continue'}</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
            <button
              onClick={handleComplete}
              disabled={isSaving}
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
    </div>
  );
};

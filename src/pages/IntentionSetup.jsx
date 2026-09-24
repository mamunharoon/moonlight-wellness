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
 * Morning-flow redesign — Intention step, now Step 1 of 5 (Journey
 * Embedding correction; was Step 1 of 4 before Meditate was counted, and
 * Step 5 of 5 before that, immediately before Complete). Home's "Begin
 * Rise & Reset",
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
 * Release-blocking DEV defect fix (reported: Morning "Start over" skips
 * Stretch) — the "quick routine skips Stretching entirely" branch that
 * used to live here (relocated, unchanged, from Affirmation.jsx during
 * the redesign above) is REMOVED. Root cause: `routineDuration` was a
 * context value with no UI to ever set it until Profile.jsx's later
 * "Daily Journey & Content Architecture" batch added a plain 3-way
 * Quick/Standard/Extended toggle (see that file's own doc comment: "no
 * UI anywhere ever let a user change it... a small self contained
 * three-way toggle, not a rebuild of anything") - that toggle never
 * disclosed, and its own author evidently never knew, that "Quick" also
 * silently skipped this screen's entire next step once it became
 * reachable. Confirmed live on DEV: an account with `routineDuration`
 * ==='quick' in localStorage reproduced the exact reported symptom
 * (Continue jumped straight to Breathe; ProgressIndicator showed
 * Stretch "completed" purely because its own `isCompleted = idx <
 * activeIndex` check has no way to distinguish "visited" from "index
 * jumped past via ADVANCE_TO_STEP"). MorningFlow.jsx's own stretch-
 * duration logic already treats 'quick' identically to 'standard' (both
 * 20s reps, only 'extended' differs) - skipping the step outright was
 * never how "Quick" behaves anywhere else in this app. The single
 * canonical step order (sessionDefinitions.js's MORNING_ROUTINE_SESSION)
 * has always been Intend -> Stretch -> Breathe -> Affirm -> Complete
 * with no conditional branch - Continue and Skip now both always follow
 * it, unconditionally, matching every other duration value and matching
 * this file's own single source of truth for step order.
 */
export const IntentionSetup = () => {
  const navigate = useNavigate();
  const { userId, intentions, setIntentions, setJourneyStep } = useAlarm();
  const { state, currentStep, advanceStep, abandonSession } = useSession();
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
  // Morning Introduction (two-phase render, same route/component - every
  // real entry point already pre-starts the Session Engine directly at
  // this step before navigating here, so a distinct intro route/step
  // would require touching three separate callers; a local phase flag
  // reuses this screen instead). Skipped entirely in Review Mode -
  // ReviewModeBanner below already orients a returning user, and this
  // phase has nothing to add for a step already complete.
  //
  // Audit fix: a bare useState(!isReviewMode) re-showed the intro on
  // every remount of the LIVE step too - e.g. the user backs out at the
  // intro (BackButton's "Leave routine?" interrupts the session, per
  // useActiveRoutineStep's leaveActiveRoutine) and later taps "Begin My
  // Morning" on Home again; Home's handleBeginRiseAndReset calls
  // startSession() again, which the reducer silently no-ops (a session
  // already 'playing'/'interrupted' rejects a second START_SESSION) but
  // still navigates here - remounting with isReviewMode still false
  // (currentStep.id === 'intention' still matches). A sessionStorage flag
  // keyed to this specific live session's own startedAt (unique per
  // genuine START_SESSION dispatch, never reused across a later fresh
  // start) remembers "already dismissed" across that remount without any
  // new persistence layer or database change - cleared automatically the
  // moment a new session starts (new startedAt = new key).
  const introSeenKey = isLiveStep && state.startedAt ? `moonlight_morning_intro_seen:${state.startedAt}` : null;
  const [showIntro, setShowIntro] = useState(() => {
    if (isReviewMode) return false;
    if (introSeenKey) {
      try {
        if (sessionStorage.getItem(introSeenKey) === '1') return false;
      } catch {
        // sessionStorage unavailable - fall through to showing the intro.
      }
    }
    return true;
  });

  const dismissIntro = () => {
    if (introSeenKey) {
      try {
        sessionStorage.setItem(introSeenKey, '1');
      } catch {
        // storage unavailable - the intro may reappear on a later remount,
        // same as any other sessionStorage-unavailable environment; never
        // blocks the user from proceeding.
      }
    }
    setShowIntro(false);
  };

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
  // mirror, silently does nothing here. Always a single ADVANCE_STEP (one
  // step forward, to Stretch) - never a multi-step jump, so
  // ProgressIndicator's own idx-based "completed" inference can never
  // mark a step the user hasn't actually reached.
  const mirrorTransition = () => {
    if (state.status !== 'playing' || currentStep?.id !== 'intention') return;
    advanceStep();
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

    // Always Stretch next - the one and only canonical step order (see
    // this file's own top comment for the bug this fixes). Continue and
    // Skip already shared this exact call (both invoke handleComplete),
    // so both are fixed by the same change.
    setJourneyStep('stretch');
    navigate('/morning-flow');
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
        <BackButton fallback="/" />
      </div>

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      {showIntro ? (
        <>
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
            {/* Morning Visual Uplift (Build 16) — a restrained glow circle
                behind the sun icon, one of the few "prominent moments" the
                approved sunrise glow token is meant for (see
                tailwind.config.js's own morning-glow comment: sparing,
                never an ambient/default shadow). */}
            <span className="w-16 h-16 rounded-full bg-morning-accent/10 border border-morning-accent/25 shadow-morning-glow flex items-center justify-center">
              <span className="material-symbols-outlined text-morning-accent text-3xl">wb_sunny</span>
            </span>
            {/* Journey Embedding (correction) — total is now 5, not 4. */}
            <span className="block text-[10px] text-morning-accent uppercase font-bold tracking-wider">Step 1 of 5</span>
            <h1 className="font-morning-display italic text-3xl text-on-surface">Start Your Day with Intention</h1>
            <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
              We'll begin by setting an intention for today, then move gently through stretching, grounding, and a closing affirmation to carry with you.
            </p>
            <p className="text-xs text-on-surface-variant/80 max-w-xs mx-auto leading-relaxed">
              Move at your own pace and skip anything that doesn't feel right this morning.
            </p>
          </div>
          <div className="space-y-3 w-full">
            <button
              onClick={dismissIntro}
              className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-morning-glow"
            >
              <span>Begin My Morning</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
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
      <div className="text-center space-y-2">
        <span className="font-label-sm text-xs text-morning-accent uppercase tracking-widest font-bold">Your Intentions</span>
        <h2 className="text-2xl font-bold text-on-surface font-morning-display italic">Set your intention</h2>
        <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
          Choose one or two qualities you want to carry into today.
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
                  ? 'bg-morning-accent/15 border-morning-accent text-morning-accent font-bold shadow-md shadow-morning-accent/10'
                  : 'glass-panel border-white/5 text-on-surface-variant hover:bg-white/10'
              }`}
            >
              {role && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-morning-accent text-on-morning-accent text-[9px] font-bold uppercase tracking-wider shadow-sm">
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
              className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-morning-accent/15 border border-morning-accent text-morning-accent text-xs font-semibold"
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
        </>
      )}
    </div>
  );
};

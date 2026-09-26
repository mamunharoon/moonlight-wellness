/* eslint-disable no-unused-vars */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { BackButton } from '../components/BackButton';
import { INTENTION_PRESETS } from '../lib/intentionAffirmations';
import { saveIntentionsToCloud } from '../lib/intentionPersistence';
import {
  setPrimaryIntention,
  setSupportingIntention,
  clearSupportingIntention,
  MAX_CUSTOM_INTENTION_LENGTH,
  DUPLICATE_INTENTION_MESSAGE,
  TOO_LONG_INTENTION_MESSAGE
} from '../lib/intentionSelection';
import { getIntentionIcon } from '../lib/intentionIcons';
import { SelectionChip } from '../components/journey/SelectionChip';
import { ReviewModeBanner } from '../components/ReviewModeBanner';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { getStepLabel } from '../lib/stepLabels';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { JourneyGlow } from '../components/JourneyGlow';

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
  const { userId, intentions, setIntentions, intentionsConfirmed, setIntentionsConfirmed, setJourneyStep } = useAlarm();
  const { state, currentStep, advanceStep, abandonSession } = useSession();
  // Safe backward navigation ("Review Mode") - handleSelectPrimary/
  // handleSelectSupporting/handleAddCustom below already only ever call
  // setIntentions (no Session Engine call at all), so changing today's
  // intention while reviewing this step is already exactly as safe as
  // Home's own "Change intention" - nothing extra to gate there. Only
  // Set My Intention/Skip/Exit (which DO drive the Session Engine
  // forward) need to be replaced by a plain "Return to current step"
  // while reviewing.
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

  // WakeWise Phase 2 (B1) — guided intention ladder. Replaces the former
  // flat "choose one or two qualities" grid with a progressive Stage 1
  // (primary, exactly one) -> Stage 2 (supporting, optional) -> Summary
  // flow. Starts on 'summary' when there is already a genuine confirmed
  // selection (a returning/review visit shouldn't re-ask questions
  // already answered) or while reviewing this step from later in the
  // journey - both cases fall back to 'primary' if `intentions` is
  // somehow empty, so this can never render a summary with nothing in it.
  // A fresh, unconfirmed visit (including the two DEFAULT_INTENTIONS
  // AlarmContext seeds for a brand new identity) always starts at
  // 'primary' - the two-stage ladder is the intended path even when a
  // suggested default already sits in `intentions`; the primary/
  // supporting grids below simply show it pre-selected, exactly like the
  // former flat grid already did, via the same "Suggested starting
  // points" banner.
  const [stage, setStage] = useState(() => {
    if (intentions.length === 0) return 'primary';
    return isReviewMode || intentionsConfirmed ? 'summary' : 'primary';
  });
  const stageHeadingRef = useRef(null);
  // Screen-reader announcement (item 8): moving focus to the new stage's
  // own heading on every stage change means a screen reader announces
  // that heading's text automatically - "Would another intention support
  // you?" clearly differs from "What matters most today?"/"Today's
  // focus", so Primary vs. Supporting vs. Summary is always unambiguous,
  // without a second, separate live-region announcement to keep in sync.
  useEffect(() => {
    stageHeadingRef.current?.focus();
  }, [stage]);

  // Safe backward navigation ("Review Mode") fix: while reviewing this
  // step, Continue/Skip (the only place that otherwise calls
  // saveIntentionsToCloud, in handleComplete below) is replaced by
  // "Return to [current step]" and is never reachable - so a change made
  // here during review would update the live intentions the rest of the
  // app reads (correct), but silently never reach Supabase, reverting on
  // the next reload/device. Saving immediately here (only in review
  // mode) closes that gap without changing the ordinary live-step flow,
  // which still defers to its own explicit "Set My Intention" tap. Shared
  // by every stage transition below - the one place `intentions` is ever
  // actually written.
  const commit = (next) => {
    setIntentions(next);
    if (isReviewMode) {
      saveIntentionsToCloud(userId, next);
      setIntentionsConfirmed(true);
    }
  };

  const showLimitMessage = (message) => {
    setLimitMessage(message);
    setTimeout(() => setLimitMessage(''), 2500);
  };

  // Stage 1 — exactly one primary. setPrimaryIntention (intentionSelection.js)
  // replaces index 0 outright (never a toggle) and drops a now-conflicting
  // supporting intention for free, so tapping any preset here always
  // leaves a valid, single primary.
  const handleSelectPrimary = (preset) => {
    setLimitMessage('');
    commit(setPrimaryIntention(intentions, preset));
    setStage('supporting');
  };

  // Stage 2 — optional supporting, must differ from the primary. The
  // preset grid for this stage already excludes whichever preset is the
  // current primary (see the render below), so a chip tap here can never
  // collide with it; setSupportingIntention's own defensive equal-to-
  // primary guard exists only for the free-text path immediately below.
  const handleSelectSupporting = (preset) => {
    setLimitMessage('');
    commit(setSupportingIntention(intentions, preset));
    setStage('summary');
  };

  const handleSkipSupporting = () => {
    setLimitMessage('');
    commit(clearSupportingIntention(intentions));
    setStage('summary');
  };

  const handleBackToPrimary = () => {
    setLimitMessage('');
    setStage('primary');
  };

  // Custom-intention defect fix (unchanged rule, applied at whichever
  // stage is active): blank input is a silent no-op, an excessively long
  // one shows TOO_LONG_INTENTION_MESSAGE, and at Stage 2 a value equal to
  // the primary (case-insensitively) shows DUPLICATE_INTENTION_MESSAGE
  // rather than silently being dropped by setSupportingIntention's own
  // defensive guard - the user gets an actual, visible reason.
  const handleAddCustom = () => {
    const value = customIntention.trim();
    if (!value) return;
    if (value.length > MAX_CUSTOM_INTENTION_LENGTH) {
      showLimitMessage(TOO_LONG_INTENTION_MESSAGE);
      return;
    }
    if (stage === 'supporting' && intentions[0] && value.toLowerCase() === intentions[0].toLowerCase()) {
      showLimitMessage(DUPLICATE_INTENTION_MESSAGE);
      return;
    }
    setCustomIntention('');
    if (stage === 'primary') {
      handleSelectPrimary(value);
    } else {
      handleSelectSupporting(value);
    }
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

  // F1 correction — found on review: Continue and Skip previously shared
  // one unconditional setIntentionsConfirmed(true), treating a Skip
  // exactly like a deliberate accept. That's wrong: Skip's own purpose is
  // "let the user move on WITHOUT an explicit choice" (see the toSave
  // fallback's own established comment below) - it must never be read as
  // endorsing whatever happens to sit in `intentions` at that moment,
  // suggested defaults included. Continue is different: it is disabled
  // whenever intentions is empty (below), so a reachable Continue tap
  // always means the user is deliberately submitting a real, non-empty
  // selection via the intended form action - genuinely confirming,
  // regardless of whether that selection happens to still equal the
  // untouched defaults (tapping Continue on them IS the deliberate
  // accept). `confirmed` is a plain caller-supplied boolean, not inferred
  // from which intentions are present - the smallest change that
  // separates "confirm" from "advance" without duplicating the shared
  // save-and-advance logic between two near-identical functions.
  const handleComplete = async (confirmed) => {
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
    // F1 — only a genuine Continue confirms (see this function's own top
    // comment); Skip never does, even when it just fell back to the
    // suggested default above.
    if (confirmed) setIntentionsConfirmed(true);

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
    // Build 16 physical-iPhone correction (F8) - see Affirmation.jsx's
    // identical block for the full rationale.
    <div
      className="min-h-[85vh] flex flex-col justify-between pb-6 max-w-md mx-auto space-y-8 select-none"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))'
      }}
    >
      {/* WakeWise DEV — colour glow extension: subtle warm-gold ambient
          backdrop, matching this step's own established morning-accent
          identity (the intro icon/badge/presets below already use it). */}
      <JourneyGlow journey="morning" />

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
              className={`w-full ${getJourneyPrimaryActionClasses('morning')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-morning-glow`}
            >
              <span>Begin My Morning</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
            <button
              onClick={handleExitRoutine}
              className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors -my-1.5 py-3.5"
            >
              Exit routine
            </button>
          </div>
        </>
      ) : (
        <>
      <div className="text-center space-y-2">
        <span className="font-label-sm text-xs text-morning-accent uppercase tracking-widest font-bold">Your Intentions</span>
        {/* WakeWise Phase 2 (B1) — one heading per stage, focused on every
            stage change (see the `stage` effect above) so a screen reader
            announces which stage is active from the heading text alone
            (item 8). */}
        {stage === 'primary' && (
          <>
            <h2 ref={stageHeadingRef} tabIndex={-1} className="text-2xl font-bold text-on-surface font-morning-display italic outline-none">
              What matters most today?
            </h2>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              Choose one intention to guide your day.
            </p>
          </>
        )}
        {stage === 'supporting' && (
          <>
            <h2 ref={stageHeadingRef} tabIndex={-1} className="text-2xl font-bold text-on-surface font-morning-display italic outline-none">
              Would another intention support you?
            </h2>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              Choose one, or continue with your main intention.
            </p>
          </>
        )}
        {stage === 'summary' && (
          <h2 ref={stageHeadingRef} tabIndex={-1} className="text-2xl font-bold text-on-surface font-morning-display italic outline-none">
            Today's focus
          </h2>
        )}
        {/* F1 — visible only until the user has genuinely confirmed a
            selection (Set My Intention/Skip on the live step, or a saved
            edit while reviewing); the two starting presets are real
            defaults, not a previous choice, and must not be presented as
            one. Stage 1 only - Stage 2/Summary already show a real,
            deliberately-made primary by the time they render. */}
        {stage === 'primary' && !intentionsConfirmed && (
          <p className="text-[11px] text-morning-accent/90 font-semibold max-w-sm mx-auto leading-relaxed">
            Suggested starting points — keep, remove or add your own.
          </p>
        )}
        {limitMessage && (
          <p className="text-xs text-secondary font-semibold" role="status">{limitMessage}</p>
        )}
      </div>

      {/* Stage 1 — Primary: exactly one, via SelectionChip's own morning
          accent (icons, B2) - selected state carried through four
          channels at once (fill/border/weight/check_circle), never colour
          alone (item 9). */}
      {stage === 'primary' && (
        <>
          <div className="grid grid-cols-2 gap-3 w-full">
            {presets.map((preset) => (
              <SelectionChip
                key={preset}
                large
                accent="morning"
                icon={getIntentionIcon(preset)}
                label={preset}
                selected={intentions[0]?.toLowerCase() === preset.toLowerCase()}
                onClick={() => handleSelectPrimary(preset)}
              />
            ))}
          </div>

          <div className="space-y-1.5 w-full">
            <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-panel border border-white/10 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
              <input
                type="text"
                value={customIntention}
                onChange={(e) => setCustomIntention(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={MAX_CUSTOM_INTENTION_LENGTH}
                aria-label="Write your own primary intention"
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
            {/* Custom-intention defect fix — a second, reliably-visible copy
                of limitMessage right next to the input, since the banner
                further up can be scrolled out of view or hidden behind the
                on-screen keyboard once this input has focus (same fix as
                ChangeIntention.jsx). */}
            {limitMessage && (
              <p className="text-xs text-secondary font-semibold px-1" role="status">{limitMessage}</p>
            )}
          </div>
        </>
      )}

      {/* Stage 2 — Supporting: optional, must differ from the primary (the
          grid below excludes it entirely, so a chip tap can never
          collide). Back returns to Stage 1 without exiting the routine
          (item 2); "No thanks" explicitly proceeds with one intention. */}
      {stage === 'supporting' && (
        <>
          <button
            type="button"
            onClick={handleBackToPrimary}
            className="flex items-center gap-1 min-h-[44px] -ml-2 pl-2 pr-3 self-start text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_back</span>
            Back
          </button>

          <div className="flex items-center justify-center gap-1.5 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-morning-accent text-base" aria-hidden="true">{getIntentionIcon(intentions[0])}</span>
            <span>Primary: <span className="font-bold text-on-surface">{intentions[0]}</span></span>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            {presets
              .filter((preset) => preset.toLowerCase() !== intentions[0]?.toLowerCase())
              .map((preset) => (
                <SelectionChip
                  key={preset}
                  large
                  accent="morning"
                  icon={getIntentionIcon(preset)}
                  label={preset}
                  selected={intentions[1]?.toLowerCase() === preset.toLowerCase()}
                  onClick={() => handleSelectSupporting(preset)}
                />
              ))}
          </div>

          <div className="space-y-1.5 w-full">
            <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-panel border border-white/10 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
              <input
                type="text"
                value={customIntention}
                onChange={(e) => setCustomIntention(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={MAX_CUSTOM_INTENTION_LENGTH}
                aria-label="Write your own supporting intention"
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
            {limitMessage && (
              <p className="text-xs text-secondary font-semibold px-1" role="status">{limitMessage}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleSkipSupporting}
            className="w-full min-h-[44px] text-center text-xs text-on-surface-variant/80 font-semibold hover:text-on-surface-variant transition-colors"
          >
            No thanks — one is enough
          </button>
        </>
      )}

      {/* Summary — primary, an optional downward "supported by" connector,
          then the optional supporting intention (matches the approved
          visual: icon + label, connector, icon + label). "Change
          primary"/"Change supporting" reopen the matching stage without
          losing the other selection. */}
      {stage === 'summary' && (
        <div className="glass-panel rounded-2xl p-6 space-y-4 text-center w-full">
          <div className="flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-morning-accent text-2xl" aria-hidden="true">{getIntentionIcon(intentions[0])}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-morning-accent">Primary</span>
            <span className="text-lg font-bold text-on-surface">{intentions[0]}</span>
          </div>

          {intentions[1] && (
            <>
              <div className="flex flex-col items-center gap-0.5 text-on-surface-variant">
                <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_downward</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider">supported by</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="material-symbols-outlined text-morning-accent/80 text-xl" aria-hidden="true">{getIntentionIcon(intentions[1])}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-morning-accent/80">Supporting</span>
                <span className="text-base font-semibold text-on-surface">{intentions[1]}</span>
              </div>
            </>
          )}

          <div className="flex justify-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => setStage('primary')}
              className="min-h-[44px] px-2 text-xs font-bold text-primary hover:opacity-80 active:scale-95 transition-all"
            >
              Change primary
            </button>
            <button
              type="button"
              onClick={() => setStage('supporting')}
              className="min-h-[44px] px-2 text-xs font-bold text-primary hover:opacity-80 active:scale-95 transition-all"
            >
              {intentions[1] ? 'Change supporting' : 'Add a supporting intention'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3 w-full">
        {/* Duplicate-return-action fix, found live: the ReviewModeBanner
            above already renders its own "Return to X" whenever
            isReviewMode is true - this screen has no active/pre-start
            split (unlike Breathe/Stretch), so reviewing Intend from any
            later step (very commonly reached via the progress menu)
            always showed BOTH controls simultaneously. Nothing replaces
            this branch while reviewing; the banner covers it. */}
        {!isReviewMode && (
          <>
            {stage === 'summary' ? (
              <button
                onClick={() => handleComplete(true)}
                disabled={isSaving || intentions.length === 0}
                className={`w-full ${getJourneyPrimaryActionClasses('morning')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-40`}
              >
                <span>{isSaving ? 'Saving...' : 'Set My Intention'}</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            ) : (
              // Stage 1/2 escape hatch - lets a user move on WITHOUT
              // completing the ladder, exactly like before (handleComplete's
              // own default-fallback logic is unchanged).
              <button
                onClick={() => handleComplete(false)}
                disabled={isSaving}
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
          </>
        )}
      </div>
        </>
      )}
    </div>
  );
};

/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import {
  MORNING_DISPLAY_STEP_NUMBERS,
  MORNING_DISPLAY_STEP_COUNT,
  EVENING_DISPLAY_STEP_NUMBERS,
  EVENING_DISPLAY_STEP_COUNT,
  MORNING_STEP_IDS
} from '../session/sessionConstants';
import { getStepIndex, getSessionById } from '../session/sessionRegistry';
import { getStepLabel } from '../lib/stepLabels';
import { consumeMorningFlowMigrationNotice } from '../session/morningFlowMigration';

// Morning-flow redesign — one-time migration notice, read at MODULE
// EVALUATION time (a plain top-level statement), not inside the component
// or an effect. This module is only ever evaluated once per page load no
// matter how many times <Home> itself later mounts/unmounts/re-renders
// (ES module caching) - unlike a lazy useState initializer or a mount
// effect, it is never subject to React 18 StrictMode's dev-only double-
// invocation, which would otherwise call this read-and-clear function
// twice and silently swallow the notice (the first call sees "pending"
// and clears it; a second, discarded call sees it already cleared).
const shouldShowMorningFlowMigrationNoticeOnLoad = consumeMorningFlowMigrationNotice();
import { getRoutineProgress, getRoutineProgressIncludingStale } from '../session/routineProgress';
import {
  RITUAL_SESSION_IDS,
  resolveRoutineCardState,
  resolveRoutineStepIndex,
  shouldShowCrossRoutineBanner,
  shouldOfferStaleRoutineChoice,
  formatStaleRoutineDate
} from '../lib/routineCardState';
import { resolveNextStepCard, resolveMorningDaypart } from '../lib/nextStepCard';
import { now as devNow } from '../lib/devClock';
import { getZonedParts } from '../lib/timezone';
import { getGreeting } from '../lib/greeting';
import { TimezoneBanner } from '../components/TimezoneBanner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { ActiveIntentionCard } from '../components/ActiveIntentionCard';
import { setPendingContent } from '../lib/pendingContent';
import { getMorningCompletionKey, getEveningCompletionKey, getMeditationCompletionKey } from '../lib/dailyCompletion';
import { redoEveningWindDown } from '../lib/routineResponses';
import { clearEveningBreathingPattern } from '../lib/eveningBreathingSelection';

export const Home = () => {
  const navigate = useNavigate();
  const { alarmTime, bedTime, intentions, effectiveTimezone, userId } = useAlarm();
  const { profile, user, isGuest } = useAuth();
  const { state, startSession, resetSession, resumeRoutine, resetRoutine, resumeStaleRoutine, discardStaleRoutine } = useSession();

  // Global timezone correctness: every "what day/time is it for this
  // user" question below goes through getZonedParts(effectiveTimezone),
  // never new Date()'s raw local getters or toDateString()/toISOString().
  // devNow() layers in on top purely for the DEV-only clock-injection
  // test seam (see lib/devClock.js) - it still resolves to the real
  // instant in production, so this is exactly "the real current instant,
  // interpreted in the user's own timezone" in a shipped build.
  const zoned = getZonedParts(effectiveTimezone, devNow());
  const today = zoned.dateKey;
  // User-scoped daily completion audit — reads the CURRENT identity's own
  // key (userId, from useAlarm() above, is null for a guest) so a
  // registered user's completion is never confused with a guest's, or
  // with a different registered user's, on the same device. See
  // dailyCompletion.js's own doc comment for the full rationale.
  const isMorningDone = localStorage.getItem(getMorningCompletionKey(userId)) === today;
  const isEveningDone = localStorage.getItem(getEveningCompletionKey(userId)) === today;
  // Meditation experience: mirrors the morning/evening pattern exactly -
  // a local-date-keyed flag using the same timezone-correct dateKey, so
  // it resets at the user's own local midnight, never Sydney server time
  // or UTC. Only ever shown once earned (see the pill below), not as a
  // persistent unchecked placeholder like Morning/Evening. User-scoped
  // the same way as isMorningDone/isEveningDone above.
  const isMeditatedToday = localStorage.getItem(getMeditationCompletionKey(userId)) === today;

  // Build 10 remediation — the critical "Evening selected opens Morning"
  // defect traced back to this exact spot: isMorningActive/isEveningActive
  // (and the single "Continue where you left off" card built from them
  // below) only ever reflected the Session Engine's one global live slot
  // (state.sessionId), never which routine the user actually had
  // SELECTED on the Morning/Evening pill, and never a routine that was
  // paused but is no longer the live one (starting the other routine
  // requires resetSession() first — see routineProgress.js's own root-
  // cause doc comment). Each routine's own card state is now resolved
  // independently via routineCardState.js, reading BOTH the live reducer
  // state AND that routine's own persisted-today snapshot — so a paused
  // Morning session can never be shown, resumed, or navigated to from an
  // Evening-selected card, and vice versa.
  const morningSnapshotToday = getRoutineProgress(RITUAL_SESSION_IDS.morning);
  const eveningSnapshotToday = getRoutineProgress(RITUAL_SESSION_IDS.evening);

  const morningCardState = resolveRoutineCardState({
    sessionId: RITUAL_SESSION_IDS.morning,
    liveState: state,
    snapshot: morningSnapshotToday,
    doneToday: isMorningDone
  });
  const eveningCardState = resolveRoutineCardState({
    sessionId: RITUAL_SESSION_IDS.evening,
    liveState: state,
    snapshot: eveningSnapshotToday,
    doneToday: isEveningDone
  });

  const morningResolvedStepIndex = resolveRoutineStepIndex({ sessionId: RITUAL_SESSION_IDS.morning, liveState: state, snapshot: morningSnapshotToday });
  const eveningResolvedStepIndex = resolveRoutineStepIndex({ sessionId: RITUAL_SESSION_IDS.evening, liveState: state, snapshot: eveningSnapshotToday });

  // "Yesterday's unfinished routine" remediation — a routine can have
  // genuinely nothing recorded for TODAY (morningCardState/
  // eveningCardState above both correctly resolve to 'not-started') while
  // still having a genuinely unfinished snapshot from an earlier local
  // day sitting in routineProgress.js. shouldOfferStaleRoutineChoice is
  // the single gate for "should the stale-choice card render instead of
  // the ordinary Begin card" — it already excludes today's own entries,
  // already-completed-today routines, and stale entries that were
  // actually completed/deliberately abandoned (not genuinely unfinished).
  const morningStaleSnapshot = getRoutineProgressIncludingStale(RITUAL_SESSION_IDS.morning);
  const eveningStaleSnapshot = getRoutineProgressIncludingStale(RITUAL_SESSION_IDS.evening);
  const morningHasStaleChoice = shouldOfferStaleRoutineChoice({
    doneToday: isMorningDone,
    todaySnapshot: morningSnapshotToday,
    staleSnapshot: morningStaleSnapshot
  });
  const eveningHasStaleChoice = shouldOfferStaleRoutineChoice({
    doneToday: isEveningDone,
    todaySnapshot: eveningSnapshotToday,
    staleSnapshot: eveningStaleSnapshot
  });

  const resolveStepLabel = (sessionId, stepIndex) => {
    const session = getSessionById(sessionId);
    const stepId = session?.steps[stepIndex]?.id;
    if (sessionId === RITUAL_SESSION_IDS.morning) {
      const num = MORNING_DISPLAY_STEP_NUMBERS[stepId];
      return num ? `Step ${num} of ${MORNING_DISPLAY_STEP_COUNT}` : '';
    }
    const num = EVENING_DISPLAY_STEP_NUMBERS[stepId];
    return num ? `Step ${num} of ${EVENING_DISPLAY_STEP_COUNT}` : '';
  };

  // Home redesign — plain current-step NAME (e.g. "Stretch", "Reflect"),
  // for the new unified "You're on {stepName}—your next step is ready."
  // copy - always resolved from the existing canonical session registry
  // (sessionRegistry.js's own step ids, via stepLabels.js's shared
  // STEP_LABELS map - the same source ProgressIndicator.jsx/
  // ReviewModeBanner already use), never hard-coded here. Distinct from
  // resolveStepLabel above (kept, unchanged, "Step X of Y" format) which
  // the stale-routine choice card and the cross-routine banner still use.
  const resolveCurrentStepName = (sessionId, stepIndex) => {
    const session = getSessionById(sessionId);
    const stepId = session?.steps[stepIndex]?.id;
    return getStepLabel(stepId);
  };

  // Guest Onboarding — starting, resuming, repeating, or resetting either
  // routine all persist real progress (routineProgress.js) and eventually
  // a completion flag, which guests must never be able to create. Every
  // one of Home's routine-launching actions below checks this first, so
  // a guest sees the exact same card/copy as anyone else (never hidden)
  // but tapping the actual CTA opens this prompt instead of touching the
  // Session Engine. Reuses pendingContent.js's existing id-less
  // "routine-start" shape (see its own doc comment) — after signing in,
  // Auth.jsx's redirectAfterAuth() returns the user to '/' with nothing
  // auto-started, ready for their own fresh tap.
  // Morning-flow redesign — one-time migration notice. The actual read
  // (consumeMorningFlowMigrationNotice) already happened once, at module
  // load time, above - see that constant's own doc comment for why. This
  // is a plain, ordinary (non-lazy) initial state value, safe under
  // StrictMode double-rendering like any other.
  const [showMorningFlowMigrationNotice, setShowMorningFlowMigrationNotice] = useState(
    shouldShowMorningFlowMigrationNoticeOnLoad
  );
  const [routineSignInPromptOpen, setRoutineSignInPromptOpen] = useState(false);
  const promptRoutineSignIn = () => {
    setRoutineSignInPromptOpen(true);
    return true;
  };
  const dismissRoutineSignInPrompt = () => setRoutineSignInPromptOpen(false);
  const confirmRoutineSignIn = () => {
    setPendingContent({ returnPath: '/' });
    setRoutineSignInPromptOpen(false);
    navigate('/auth');
  };
  const confirmRoutineCreateAccount = () => {
    setPendingContent({ returnPath: '/' });
    setRoutineSignInPromptOpen(false);
    navigate('/auth?tab=signup');
  };

  // Completed-routine "Do Again" defect fix + stale-routine confirmation —
  // one dialog, three distinct kinds, discriminated by `kind`:
  //   'start-over'    — an IN-PROGRESS routine's own "Start Over" (still
  //                      resets only that routine's active step progress).
  //   'repeat'        — a COMPLETED routine's own "Repeat Morning/Evening
  //                      Routine" — replaces the old, broken "Do Again"
  //                      (which only called resetRoutine() and never
  //                      actually launched anything). Non-destructive: the
  //                      previous completion/reflections are preserved,
  //                      this only starts a brand new session.
  //   'discard-stale' — "Start Today's Routine" while a genuinely
  //                      unfinished PRIOR-day snapshot exists for this
  //                      routine — the one case here that is actually
  //                      destructive (the old, unfinished snapshot is
  //                      cleared, not archived; see discardStaleRoutine's
  //                      own doc comment in SessionContext.jsx).
  // null means the dialog is closed.
  const [activeDialog, setActiveDialog] = useState(null);

  const periodLabel = (period) => (period === 'morning' ? 'Morning' : 'Evening');

  const dialogCopy = (() => {
    if (!activeDialog) return null;
    const label = periodLabel(activeDialog.period);
    if (activeDialog.kind === 'start-over') {
      // Start Over parity fix, found live: this dialog never actually
      // named which routine it was about to reset - both Morning and
      // Evening shared the exact same generic "Start this routine
      // again?" copy, with no `label` interpolation at all (unlike the
      // 'repeat' branch just below, which already did this correctly).
      return {
        title: `Start ${label} Routine Over?`,
        message: `Your current ${label} step progress will be reset. Saved history and journal entries will not be deleted.`,
        confirmLabel: 'Start Over',
        // Build 15 muted-destructive addition — Morning's own Start Over
        // only resets resumable step progress, never saved history, so it
        // gets the lighter severity. Evening's own Start Over (identical
        // wording, different period) keeps the strong treatment: scoped
        // explicitly by period, never both muted together.
        destructive: true,
        mildDestructive: activeDialog.period === 'morning'
      };
    }
    if (activeDialog.kind === 'repeat') {
      return {
        title: `Repeat ${label} Routine?`,
        message: 'Your completed routine and saved reflections will remain in your history.',
        confirmLabel: 'Start Again',
        destructive: false
      };
    }
    // Safe routine switching, Section 2 — shown only when the OTHER
    // routine is genuinely, actively running (state.status === 'playing'
    // for a different sessionId) right when the user taps to begin/
    // resume THIS one. Exact required wording/labels.
    if (activeDialog.kind === 'switch-routine') {
      return {
        title: `Switch to the ${label} routine?`,
        message: 'Your current routine will be paused and can be resumed later.',
        confirmLabel: 'Switch Routine',
        cancelLabel: 'Stay Here',
        destructive: false
      };
    }
    // 'discard-stale' — discards only a resumable, unfinished snapshot
    // (never saved history/reflections), so it gets the muted severity
    // for both Morning and Evening alike.
    return {
      title: "Start today's routine?",
      message: 'Your unfinished previous routine progress will be cleared.',
      confirmLabel: "Start Today's Routine",
      destructive: true,
      mildDestructive: true
    };
  })();

  const handleConfirmDialog = () => {
    if (!activeDialog) return;
    if (isGuest) {
      setActiveDialog(null);
      promptRoutineSignIn();
      return;
    }
    const { kind, period } = activeDialog;
    const sessionId = RITUAL_SESSION_IDS[period];
    if (kind === 'start-over') {
      resetRoutine(sessionId);
      // Build 15 Evening UX correction — a genuine Evening Start Over
      // also clears tonight's selected Evening breathing pattern, so the
      // restarted journey begins fresh at the established 4-7-8 default
      // rather than silently reusing whatever was selected before.
      // Morning's own Start Over is completely unaffected (this helper
      // only ever touches the Evening-scoped key).
      if (period === 'evening') clearEveningBreathingPattern(userId);
    } else if (kind === 'repeat') {
      if (period === 'morning') handleBeginRiseAndReset();
      else handleBeginEveningWindDown();
    } else if (kind === 'switch-routine') {
      // The confirmation itself is the only gate here - proceeding just
      // re-runs the exact same routine action that would have happened
      // immediately had the OTHER routine not been actively running.
      // Pausing/persisting the currently-running routine and stopping
      // its music both happen structurally: whichever page is showing
      // it unmounts as part of this same navigation, and its own
      // existing unmount cleanup (timer/audio) already handles both -
      // see Breathe.jsx/MorningFlow.jsx/EveningBreathing.jsx and
      // InteractiveAmbientMusic.jsx's own cleanup effects. That
      // routine's own step-level progress is independently preserved by
      // the Session Engine's per-sessionId mirror (routineProgress.js),
      // never touched by starting/resuming a DIFFERENT sessionId.
      if (period === 'morning') proceedWithMorningAction();
      else proceedWithEveningAction();
    } else if (kind === 'discard-stale') {
      discardStaleRoutine(sessionId);
      if (period === 'morning') handleBeginRiseAndReset();
      else handleBeginEveningWindDown();
    }
    setActiveDialog(null);
  };

  // Redo Tonight's Wind-Down (Build 15 addendum) — kept as its own
  // separate confirmation state/dialog, deliberately not folded into the
  // activeDialog/dialogCopy/handleConfirmDialog system above: every kind
  // in that system is a synchronous, always-succeeds action, while Redo
  // is a real network delete that can fail and needs its own pending/
  // error UI (confirmPending, a retry-safe error state) - exactly
  // mirroring EveningComplete.jsx's own separate redoConfirmOpen/
  // isRedoing/redoError state, which this reuses the same shape of. The
  // actual eligibility/delete/flag/routine-reset sequence itself is never
  // duplicated here - both this handler and EveningComplete.jsx's own
  // call the one shared routineResponses.js#redoEveningWindDown.
  const [redoConfirmOpen, setRedoConfirmOpen] = useState(false);
  const [isRedoing, setIsRedoing] = useState(false);
  const [redoError, setRedoError] = useState(false);

  const handleRedoTap = () => {
    setRedoError(false);
    setRedoConfirmOpen(true);
  };

  const handleConfirmRedo = async () => {
    if (isRedoing) return;
    setIsRedoing(true);
    setRedoError(false);

    const result = await redoEveningWindDown({ userId, isGuest, localDate: today, resetRoutine });

    setIsRedoing(false);
    setRedoConfirmOpen(false);
    if (!result.ok) {
      setRedoError(true);
      return;
    }
    navigate('/evening-wind-down');
  };

  // "Resume Previous Routine" — resumes the EXACT stale snapshot (its own
  // saved step, its own original date identity — see resumeStaleRoutine's
  // own doc comment), then navigates straight to that same step's own
  // route, scoped to this one sessionId only, mirroring
  // handleMorningAction/handleEveningAction's existing pattern exactly.
  const handleResumeStaleMorning = () => {
    if (isGuest) { promptRoutineSignIn(); return; }
    if (!resumeStaleRoutine(RITUAL_SESSION_IDS.morning)) return;
    const session = getSessionById(RITUAL_SESSION_IDS.morning);
    const stepIndex = morningStaleSnapshot?.stepIndex ?? 0;
    navigate(session?.steps[stepIndex]?.route ?? '/intention-setup');
  };
  const handleResumeStaleEvening = () => {
    if (isGuest) { promptRoutineSignIn(); return; }
    if (!resumeStaleRoutine(RITUAL_SESSION_IDS.evening)) return;
    const session = getSessionById(RITUAL_SESSION_IDS.evening);
    const stepIndex = eveningStaleSnapshot?.stepIndex ?? 0;
    navigate(session?.steps[stepIndex]?.route ?? '/reflection');
  };

  // Derived timeState. "Before wake" is compared against the user's own
  // configured alarmTime (not a fixed clock band) per the required Today
  // experience — every other band stays the same fixed daypart split
  // this page already used.
  const nowMinutes = zoned.minutesSinceMidnight;
  const [alarmH, alarmM] = (alarmTime || '07:30').split(':').map(Number);
  const alarmMinutes = (alarmH || 0) * 60 + (alarmM || 0);
  const hours = zoned.hour;

  let timeState;
  if (nowMinutes < alarmMinutes) {
    timeState = 'before-wake';
  } else if (hours < 12) {
    timeState = 'daytime-morning';
  } else if (hours < 18) {
    timeState = 'daytime';
  } else if (hours < 22) {
    timeState = 'evening';
  } else {
    timeState = 'night';
  }

  // Home redesign — every timeState band now maps to a real, actionable
  // "Your Next Step" card (see nextStepCard.js): 'before-wake' folds into
  // the ordinary morning daypart (still chronologically morning, just
  // ahead of the user's own alarm - a clear next step here is exactly
  // this redesign's own goal, replacing the old passive "still resting"
  // screen with no action to take), and 'night' folds into the same
  // combined evening/night variant Morning's own copy explicitly calls
  // for. This is the one deliberate architecture change from the
  // previous design - see the implementation report for the full
  // rationale (both retired full-page states offered no actionable next
  // step, which is exactly what this redesign exists to fix).
  const morningDaypart = resolveMorningDaypart(timeState);

  // Morning/Anytime/Evening selector: null means "automatic" (the logic
  // below decides) - only becomes 'morning'/'anytime'/'evening' once the
  // user actually taps a card, and then stays that way for the rest of
  // this page view (component state, not persisted - a fresh visit
  // re-derives automatically again). Home redesign: all three are
  // reachable/actionable at any real time once selected (or by default,
  // per the fallback below) - Morning's own copy already varies by
  // daypart via morningDaypart above; Evening's copy is intentionally
  // constant regardless of clock time, per the approved design.
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  // Build 15 — Today's Rhythm default selection. An active routine
  // (genuinely in-progress right now) always takes priority over the
  // clock. Otherwise: evening/night hours lean Evening (the existing
  // daypart rule, unchanged); morning hours lean Morning UNLESS it's
  // already completed today, since a completed Morning must not keep
  // blocking a useful default suggestion - Anytime is shown instead;
  // every other time (daytime, once Morning is behind you) defaults to
  // Anytime. Evening's own detail card already shows Review once
  // completed regardless of which card is selected - no separate rule
  // needed here for that.
  const defaultPeriod = (() => {
    if (morningCardState === 'in-progress') return 'morning';
    if (eveningCardState === 'in-progress') return 'evening';
    if (timeState === 'evening' || timeState === 'night') return 'evening';
    if (timeState === 'daytime-morning' || timeState === 'before-wake') {
      return morningCardState === 'completed' ? 'anytime' : 'morning';
    }
    return 'anytime';
  })();
  // Which card looks active, and which routine's/Anytime's detail card
  // actually renders. Once the user has picked one, show that choice;
  // otherwise use the real-context default above.
  const activePeriod = selectedPeriod ?? defaultPeriod;

  const displayIntentions = intentions.length > 0 ? intentions : ['Stay calm'];

  // Home redesign — single greeting line, shown once regardless of which
  // period is selected (Greeting is its own fixed item in the approved
  // Home order, independent of the Morning/Evening pill). Every timeState
  // band now maps to one of the three greeted dayparts (see morningDaypart
  // above for why before-wake/night are folded the way they are) -
  // getGreeting itself, and its own neutral/no-name fallback, are
  // completely unchanged.
  const greetingText =
    timeState === 'daytime-morning' || timeState === 'before-wake'
      ? getGreeting('morning', { profile, user })
      : timeState === 'daytime'
        ? getGreeting('afternoon', { profile, user })
        : getGreeting('evening', { profile, user });

  // Home redesign — the six possible "Your Next Step" card contents,
  // precomputed up front (cheap, pure - resolveNextStepCard does no I/O)
  // exactly like morningCardState/eveningCardState above already are.
  // Only the one matching the routine's own resolved cardState is ever
  // actually rendered, per the JSX below.
  const morningNotStartedCard = resolveNextStepCard({
    period: 'morning',
    cardState: 'not-started',
    morningDaypart
  });
  const morningInProgressCard = resolveNextStepCard({
    period: 'morning',
    cardState: 'in-progress',
    stepName: resolveCurrentStepName(RITUAL_SESSION_IDS.morning, morningResolvedStepIndex)
  });
  const morningCompletedCard = resolveNextStepCard({
    period: 'morning',
    cardState: 'completed'
  });
  const eveningNotStartedCard = resolveNextStepCard({
    period: 'evening',
    cardState: 'not-started'
  });
  const eveningInProgressCard = resolveNextStepCard({
    period: 'evening',
    cardState: 'in-progress',
    stepName: resolveCurrentStepName(RITUAL_SESSION_IDS.evening, eveningResolvedStepIndex)
  });
  const eveningCompletedCard = resolveNextStepCard({
    period: 'evening',
    cardState: 'completed'
  });

  // Build 15 Phase B remediation — "Change intention" (ActiveIntentionCard)
  // now only navigates to the dedicated /change-intention screen
  // (ChangeIntention.jsx), which owns setIntentions/saveIntentionsToCloud
  // itself - Home no longer calls either directly. Guests never reach
  // that screen from here (ActiveIntentionCard's own isGuest check
  // intercepts the tap with the sign-in prompt before any navigation).

  // Build 10 remediation — the single source of truth for "what happens
  // when this routine's own card CTA is tapped", replacing the old bug
  // where a bare <Link to="/evening-wind-down"> (or the standalone
  // "Continue where you left off" card) could launch/resume whichever
  // routine happened to be live in the Session Engine, regardless of
  // which pill was selected. Each handler only ever touches its OWN
  // sessionId: resumeRoutine(sessionId) (SessionContext.jsx) only
  // activates a routine if IT genuinely has playing/interrupted/saved
  // state, so this can never accidentally resume the other routine, and
  // the navigate() target is always computed from that SAME sessionId's
  // own registry step list — never a global currentStep read.
  // Safe routine switching, Section 2 — true only while the OTHER
  // routine is genuinely, actively RUNNING (a real timer could be mid-
  // flight), never merely paused/interrupted ("Do not show this
  // confirmation when nothing is actively running" - an interrupted
  // session is already paused, there is nothing to interrupt further).
  const isOtherRoutineActivelyRunning = (targetSessionId) =>
    state.status === 'playing' && Boolean(state.sessionId) && state.sessionId !== targetSessionId;

  const proceedWithMorningAction = () => {
    if (morningCardState === 'in-progress') {
      resumeRoutine(RITUAL_SESSION_IDS.morning);
      const session = getSessionById(RITUAL_SESSION_IDS.morning);
      navigate(session?.steps[morningResolvedStepIndex]?.route ?? '/intention-setup');
      return;
    }
    handleBeginRiseAndReset();
  };

  const proceedWithEveningAction = () => {
    if (eveningCardState === 'in-progress') {
      resumeRoutine(RITUAL_SESSION_IDS.evening);
      const session = getSessionById(RITUAL_SESSION_IDS.evening);
      navigate(session?.steps[eveningResolvedStepIndex]?.route ?? '/reflection');
      return;
    }
    handleBeginEveningWindDown();
  };

  const handleMorningAction = () => {
    if (isGuest) { promptRoutineSignIn(); return; }
    if (isOtherRoutineActivelyRunning(RITUAL_SESSION_IDS.morning)) {
      setActiveDialog({ kind: 'switch-routine', period: 'morning' });
      return;
    }
    proceedWithMorningAction();
  };

  const handleEveningAction = () => {
    if (isGuest) { promptRoutineSignIn(); return; }
    if (isOtherRoutineActivelyRunning(RITUAL_SESSION_IDS.evening)) {
      setActiveDialog({ kind: 'switch-routine', period: 'evening' });
      return;
    }
    proceedWithEveningAction();
  };

  // Close Remaining Daily-Journey Limitations: Today's own "Begin Rise &
  // Reset" card starts the Session Engine itself before navigating, same
  // as RoutineDetail.jsx's own Start Routine, so a routine begun from here
  // always engages step tracking/resume/"Continue where you left off".
  // Morning-flow redesign: Step 1 is now Set Your Intention
  // (/intention-setup) — the former /morning-start video-selection screen
  // is removed from the routine entirely. Mirrors RoutineDetail.jsx's
  // beginRiseAndReset exactly: reset-before-start guard, then start fresh
  // at Step 1.
  const handleBeginRiseAndReset = () => {
    if (state.status === 'playing' || state.status === 'interrupted') {
      resetSession();
    }
    startSession('morning-routine', { startIndex: getStepIndex('morning-routine', MORNING_STEP_IDS.INTENTION) });
    navigate('/intention-setup');
  };

  // Build 10 fresh-start parity fix — this used to call
  // startSession('evening-wind-down') + advanceStep() + navigate to
  // '/reflection' directly, skipping the Wind-Down intro (Step 1 of 6)
  // entirely: the user's first-ever glimpse of an Evening session was
  // "Step 2 of 6", never "Step 1 of 6". That was inconsistent with the
  // one other real "start a fresh Evening routine" entry point,
  // RoutineDetail.jsx's own "Start Routine" for Wind-Down — a plain
  // <Link to="/evening-wind-down"> that starts NOTHING in the Session
  // Engine yet, deferring entirely to EveningWindDown.jsx's own "Begin"
  // button (which shows the real "Step 1 of 6 — Evening Wind-down"
  // screen first, and only starts/advances to Reflection once THAT
  // button is tapped). It was also inconsistent with Morning's own
  // parity: handleBeginRiseAndReset below and RoutineDetail.jsx's
  // beginRiseAndReset already always land on IntentionSetup.jsx's genuine
  // "Step 1 of 4" — no equivalent skip exists for Morning. Fixed by
  // matching RoutineDetail.jsx's own already-correct pattern exactly: a
  // plain navigation, nothing more. This is what makes both "Begin
  // Wind-Down" (this card's ordinary not-started CTA) and "Repeat
  // Evening Routine" (handleConfirmDialog's 'repeat' branch, which calls
  // this same function) behave identically to a genuinely fresh Evening
  // routine — both now stop at Wind-Down's own Step 1 screen, exactly
  // like Start Routine does, rather than silently skipping it.
  const handleBeginEveningWindDown = () => {
    navigate('/evening-wind-down');
  };

  // Home redesign — the unified "Your Next Step" card's inner content
  // (eyebrow/title/supporting text/duration), shared by every state/
  // period so the visual shape can never drift between them. The card
  // SHELL (gradient, primary button, optional secondary) stays inline per
  // branch below, not extracted here, so each branch's own onClick stays
  // a literal, directly-grep-able reference to that routine's own handler
  // (handleMorningAction/handleEveningAction/setActiveDialog(...)) - never
  // a generically-named prop indirection.
  // Build 15 Phase B — `stepProgressLabel` is an OPTIONAL third param, used
  // only by the in-progress card variants below. It's the exact same
  // "Step X of Y" string `resolveStepLabel` already computes from real
  // Session Registry data (already used elsewhere on this page, for the
  // stale-choice card and cross-routine banner) - never a new value, just
  // a second place the same real data is shown, so a paused routine's
  // card states its progress as plainly as its title already does.
  //
  // Morning Visual Uplift (Build 16) / Home Visual Uplift (typography
  // contract, both Home Stitch review rounds) — `period` replaces the
  // original boolean `isMorning` param, additive in the same spirit:
  // default 'anytime' reproduces the exact same peach eyebrow / plain
  // heading every pre-existing call site (Evening included) already
  // rendered, byte-for-byte, since Evening never passed a third argument
  // before this change either. Only the real Morning call sites now pass
  // 'morning' (unchanged behaviour, gold eyebrow + Playfair/font-morning-
  // display) and the real Evening call sites now pass 'evening' (NEW:
  // Evening's eyebrow chip was still rendering the generic peach/primary
  // treatment before this change, and its heading was still plain sans -
  // found during the Home Visual Uplift Stitch audit, since only the
  // outer card SHELL below had ever been given
  // border-evening-accent/shadow-evening-glow, never this shared inner
  // body - now genuinely periwinkle-badged + font-serif italic
  // (Newsreader), matching the approved circadian typography contract for
  // Evening exactly as it already did for Morning).
  const nextStepCardBody = (card, stepProgressLabel, period = 'anytime') => {
    const isMorningPeriod = period === 'morning';
    const isEveningPeriod = period === 'evening';
    return (
      <>
        {/* inline-flex (not flex/block) deliberately - Morning's cards are
            text-center, Evening's are not, and an inline-level box is what
            lets this chip row inherit whichever alignment its own card
            ancestor already uses (the same way the original bare <span>
            did) rather than this wrapper imposing its own justify-content
            and silently re-centering Evening's otherwise left-aligned
            cards. */}
        <div className="inline-flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isMorningPeriod
                ? 'bg-morning-accent/10 border border-morning-accent/30 text-morning-accent'
                : isEveningPeriod
                ? 'bg-evening-accent/10 border border-evening-accent/30 text-evening-accent'
                : 'bg-primary/10 border border-primary/20 text-primary'
            }`}
          >
            {card.eyebrow}
          </span>
          {stepProgressLabel && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/5 border border-white/10 text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">
              {stepProgressLabel}
            </span>
          )}
        </div>
        <div className="space-y-2">
          <h3
            className={`text-2xl font-bold leading-tight text-on-surface ${
              isMorningPeriod ? 'font-morning-display italic' : isEveningPeriod ? 'font-serif italic' : ''
            }`}
          >
            {card.title}
          </h3>
          {card.supportingText && (
            <p className="text-sm text-on-surface-variant font-medium">{card.supportingText}</p>
          )}
          {card.duration && (
            <p className="text-xs text-on-surface-variant/70 font-semibold">{card.duration}</p>
          )}
        </div>
      </>
    );
  };

  return (
    // Home Visual Uplift — Home-scoped background (see index.css/
    // tailwind.config.js's matching "home-background" comments): -m-4 p-4
    // bleeds this div out to Layout.jsx's own existing px-4 content
    // padding and reclaims it as this element's own solid fill instead,
    // and min-h-full asks that fill to cover at least the full scrollable
    // viewport (Layout's Outlet container genuinely has a real computed
    // height - h-dvh flex column - so min-h-full resolves to it, not 0),
    // growing further if Home's own content is taller. This paints over
    // Layout's shared bg-background/ambient-glow layer only for the
    // vertical extent of THIS page's own root element - every other route
    // rendered through the same <Outlet> is completely unaffected, and
    // Layout.jsx itself is never touched.
    <div className="relative -m-4 p-4 min-h-full bg-home-background space-y-8 animate-in fade-in duration-500">

      {/* Morning-flow redesign — one-time migration notice. Required exact
          copy: "Your Morning routine has been refreshed. Start today's
          updated routine from the beginning." Shown only when Build 10
          left unfinished Morning progress that this deploy could not
          safely resume (see morningFlowMigration.js) - never framed as an
          error, and never shown again once dismissed (the underlying flag
          is consumed, not just hidden, the moment this component mounted). */}
      {showMorningFlowMigrationNotice && (
        <div className="glass-panel p-5 rounded-2xl space-y-3 border-primary/20 bg-primary/5">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary text-xl shrink-0">wb_sunny</span>
            <p className="text-sm font-semibold text-on-surface leading-relaxed">
              Your Morning routine has been refreshed. Start today's updated routine from the beginning.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMorningFlowMigrationNotice(false)}
            className="min-h-[44px] px-4 py-2.5 rounded-full glass-panel border border-white/10 text-on-surface text-xs font-bold uppercase tracking-wider hover:bg-white/5 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Got it
          </button>
        </div>
      )}

      <TimezoneBanner />

      {/* 1. Build 15 — "Today's Rhythm" selector. Replaces the old 2-pill
          Morning/Evening tablist with three always-visible compact cards
          (Morning/Anytime/Evening), each its own approved colour identity
          (morning-accent sunrise gold / primary WakeWise peach /
          evening-accent soft blue - see tailwind.config.js's own comment
          on morning-accent), so Anytime Reset finally sits alongside the
          other two rituals instead of living only in the quick-actions
          grid below. Tapping a card only changes which one is selected
          (and therefore which larger detail card renders below) - it
          never navigates on its own, exactly like the pills it replaces.
          Completion is shown as a non-colour ✓ indicator + label, never a
          numeric "X of Y" count (no such data exists in this app - see
          the Phase 1 investigation). role="tablist"/"tab" + aria-selected
          remains the correct ARIA pattern for this mutually-exclusive
          selector. */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-2 px-1">
          Today's Rhythm
        </p>
        {/* Home Visual Uplift — compact treatment (Stitch reference, all
            three Home mockups): min-h-[64px] -> min-h-[52px] (still clears
            the 44px floor with room to spare) and the active tab's own
            shadow-sm swapped for its already-existing named circadian glow
            (shadow-morning-glow/shadow-mint-glow/shadow-evening-glow -
            tailwind.config.js, already used on the main cards below) so
            the selector itself gets the same restrained per-period glow
            Stitch shows, reusing tokens rather than inventing new ones.
            Fill/text colours (bg-morning-accent/on-morning-accent etc.) are
            completely unchanged - they already matched Stitch's own active-
            tab treatment exactly (dark accessible text on a light circadian
            fill), confirmed against all three Stitch references. */}
        <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Today's rhythm">
          <button
            type="button"
            role="tab"
            onClick={() => setSelectedPeriod('morning')}
            aria-selected={activePeriod === 'morning'}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morning-accent ${
              activePeriod === 'morning'
                ? 'bg-morning-accent text-on-morning-accent border-morning-accent shadow-morning-glow'
                : 'bg-white/5 text-on-surface-variant/60 border-transparent hover:bg-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-lg">wb_twilight</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {isMorningDone ? '✓ Morning' : 'Morning'}
            </span>
          </button>
          {/* Anytime Reset Visual Uplift (Phase 2, approved decision A) —
              completes the three-part Today's Rhythm identity: Morning
              gold, Anytime mint (tertiary/on-tertiary), Evening
              periwinkle. Morning's and Evening's own tabs above/below are
              completely untouched by this change. */}
          <button
            type="button"
            role="tab"
            onClick={() => setSelectedPeriod('anytime')}
            aria-selected={activePeriod === 'anytime'}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary ${
              activePeriod === 'anytime'
                ? 'bg-tertiary text-on-tertiary border-tertiary shadow-mint-glow'
                : 'bg-white/5 text-on-surface-variant/60 border-transparent hover:bg-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-lg">bolt</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Anytime</span>
          </button>
          <button
            type="button"
            role="tab"
            onClick={() => setSelectedPeriod('evening')}
            aria-selected={activePeriod === 'evening'}
            className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-evening-accent ${
              activePeriod === 'evening'
                ? 'bg-evening-accent text-on-evening-accent border-evening-accent shadow-evening-glow'
                : 'bg-white/5 text-on-surface-variant/60 border-transparent hover:bg-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-lg">bedtime</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {isEveningDone ? '✓ Evening' : 'Evening'}
            </span>
          </button>
        </div>
        {isMeditatedToday && (
          <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-wider py-1.5 rounded-full bg-tertiary/15 text-tertiary">
            ✓ Meditated today
          </p>
        )}
      </div>

      {/* Build 10 remediation — replaces the old single, session-engine-
          global "Continue where you left off" card (see the critical
          defect this fixes, in morningCardState/eveningCardState's own
          doc comment above): a distinct, clearly-labelled banner for the
          OTHER routine only, never presented as the selected routine's
          own state, and never the thing that actually opens a route on
          its own tap — tapping it only switches the pill, so the main
          card below (which always matches whatever IS selected) is what
          actually navigates. This is what keeps "the selected tab and
          its card must always agree" true at every step, including the
          instant right after tapping this banner. */}
      {shouldShowCrossRoutineBanner({
        selectedSessionId: RITUAL_SESSION_IDS[activePeriod],
        otherSessionId: RITUAL_SESSION_IDS.evening,
        otherCardState: eveningCardState
      }) && (
        <button
          type="button"
          onClick={() => setSelectedPeriod('evening')}
          className="block w-full text-left glass-panel p-4 rounded-2xl border-l-4 border-l-secondary shadow-sm hover:bg-white/5 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-on-surface truncate">
              Evening routine paused — {resolveStepLabel(RITUAL_SESSION_IDS.evening, eveningResolvedStepIndex)}
            </span>
            <span className="material-symbols-outlined text-secondary text-xl shrink-0">chevron_right</span>
          </div>
        </button>
      )}
      {shouldShowCrossRoutineBanner({
        selectedSessionId: RITUAL_SESSION_IDS[activePeriod],
        otherSessionId: RITUAL_SESSION_IDS.morning,
        otherCardState: morningCardState
      }) && (
        <button
          type="button"
          onClick={() => setSelectedPeriod('morning')}
          className="block w-full text-left glass-panel p-4 rounded-2xl border-l-4 border-l-primary shadow-sm hover:bg-white/5 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-on-surface truncate">
              Morning routine paused — {resolveStepLabel(RITUAL_SESSION_IDS.morning, morningResolvedStepIndex)}
            </span>
            <span className="material-symbols-outlined text-primary text-xl shrink-0">chevron_right</span>
          </div>
        </button>
      )}

      {/* 2-3. Greeting + the permanent Introduction replay control, grouped
          into one layout unit (space-y-2 - a tight internal gap) so the
          page's outer space-y-8 rhythm treats the pair as a single child:
          one normal 2rem gap above the group, one normal 2rem gap below it
          before the recommended card - no negative margins, no fighting
          the parent's own cascade. Still exactly one control, still routes
          to /introduction, still reachable by both guests and registered
          users (Introduction.jsx's own persistAndContinue already short-
          circuits to Home without any write for an already-completed
          registered user, and never writes at all for a guest).

          Discoverability fix: phone testing found the original plain-text
          row too small/subdued to notice next to the greeting. Now a
          compact tinted pill (bg-primary/10 + border-primary/20 +
          text-primary) - the exact same "chip" treatment as the eyebrow
          badge on the card below (line ~545) - so it reads as WakeWise's
          own peach accent, not a generic link, while staying visually
          lighter than the primary CTA's solid bg-primary fill. inline-flex
          (not w-full) keeps it sized to its own content - a real button,
          not an edge-to-edge bar - centred under the greeting by the
          shared flex justify-center wrapper. min-h-[44px] preserves the
          touch target regardless of the shorter label's own line height. */}
      <div className="space-y-2">
        {greetingText && (
          // Home Visual Uplift — text-4xl (36px) -> text-3xl (30px),
          // matching Stitch's own reduced hierarchy (all three Home
          // references land between 30-36px; 30px is the shared, moderate
          // choice). break-words (new) is the actual long-name safety net -
          // this heading had no wrap guard before, so a genuinely long
          // first name could threaten horizontal overflow; an ordinary name
          // ("Mamun") is unaffected and still renders on one line at 375px.
          <h2 className="text-3xl font-extrabold text-on-surface tracking-tight break-words">{greetingText}</h2>
        )}
        <div className="flex justify-center">
          <Link
            to="/introduction"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/15 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
            <span>Watch: How WakeWise works</span>
          </Link>
        </div>
      </div>

      {/* 4-5. Recommended "Your Next Step" card + its one primary action
          button, for whichever period (activePeriod) is currently
          selected. The "yesterday's unfinished routine" stale-choice card
          (an existing, distinct two-choice feature - Resume Previous /
          Start Today's, never silently resumed/deleted/relabelled) takes
          priority over the ordinary not-started card, exactly as before -
          only its position in the page has moved, not its own logic. */}
      {activePeriod === 'morning' && (
        <>
          {/* MORNING — an unfinished routine from an earlier local day
              exists (shouldOfferStaleRoutineChoice), and nothing has been
              recorded for TODAY yet. Never silently resumes it as today's
              routine, deletes it, or presents it as today's own progress —
              both explicit choices are always shown side by side. */}
          {morningCardState === 'not-started' && morningHasStaleChoice && (
            <div
              className="glass-panel p-5 rounded-3xl space-y-5 border-morning-accent/30 shadow-morning-glow"
              // Build 15 Phase B fix: an inline style, not the
              // bg-morning-tint/10 utility class - .glass-panel's own
              // plain-CSS `background` shorthand sits later in the
              // compiled stylesheet than any Tailwind utility (it isn't
              // inside @layer utilities), so it silently wins over a
              // same-specificity bg-* class every time, discovered live
              // during this phase's own visual verification. An inline
              // style always wins regardless of stylesheet order - the
              // same fix already established for the safe-area padding
              // elsewhere in this app.
              style={{ backgroundColor: 'rgb(var(--color-morning-tint) / 0.1)' }}
              role="region"
              aria-label="Unfinished previous Rise & Reset routine"
            >
              <div className="space-y-1">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-morning-accent/10 border border-morning-accent/30 text-morning-accent text-[10px] font-bold uppercase tracking-wider">
                  Rise &amp; Reset
                </span>
                <h3 className="text-xl font-bold leading-tight text-on-surface pt-2 font-morning-display italic">
                  {formatStaleRoutineDate(morningStaleSnapshot?.dateKey, today)}'s Morning routine is unfinished.
                </h3>
                <p className="text-sm text-on-surface-variant font-medium">
                  {resolveStepLabel(RITUAL_SESSION_IDS.morning, morningStaleSnapshot?.stepIndex ?? 0)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleResumeStaleMorning}
                aria-label={`Resume previous Morning routine, ${resolveStepLabel(RITUAL_SESSION_IDS.morning, morningStaleSnapshot?.stepIndex ?? 0)}`}
                className="block w-full min-h-[44px] py-3.5 rounded-xl bg-primary text-on-primary font-bold text-center hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Resume Previous Routine
              </button>
              <button
                type="button"
                onClick={() => setActiveDialog({ kind: 'discard-stale', period: 'morning' })}
                aria-label="Start today's Morning routine and clear the unfinished previous one"
                className="block w-full min-h-[44px] py-3 rounded-xl glass-panel text-on-surface-variant font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Start Today's Routine
              </button>
            </div>
          )}

          {/* MORNING — not started, no stale choice: the ordinary
              recommended card, copy varying by the real time of day
              (morning/afternoon/evening-night) per nextStepCard.js. */}
          {morningCardState === 'not-started' && !morningHasStaleChoice && (
            <div
              className="glass-panel p-5 rounded-3xl text-center space-y-6 border-morning-accent/25 shadow-morning-glow"
              style={{ backgroundColor: 'rgb(var(--color-morning-tint) / 0.1)' }}
            >
              {nextStepCardBody(morningNotStartedCard, undefined, 'morning')}
              <button
                type="button"
                onClick={handleMorningAction}
                className="block w-full py-3.5 rounded-xl bg-primary text-on-primary font-bold text-center hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/10"
              >
                {morningNotStartedCard.buttonLabel}
              </button>
            </div>
          )}

          {/* MORNING — paused today. */}
          {morningCardState === 'in-progress' && (
            <div
              className="glass-panel p-5 rounded-3xl text-center space-y-6 border-morning-accent/25 shadow-morning-glow"
              style={{ backgroundColor: 'rgb(var(--color-morning-tint) / 0.1)' }}
            >
              {nextStepCardBody(morningInProgressCard, resolveStepLabel(RITUAL_SESSION_IDS.morning, morningResolvedStepIndex), 'morning')}
              <button
                type="button"
                onClick={handleMorningAction}
                className="block w-full py-3.5 rounded-xl bg-primary text-on-primary font-bold text-center hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/10"
              >
                {morningInProgressCard.buttonLabel}
              </button>
              <button
                type="button"
                onClick={() => setActiveDialog({ kind: 'start-over', period: 'morning' })}
                className="block w-full py-3 rounded-xl glass-panel text-on-surface-variant font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/30"
              >
                Start Over
              </button>
            </div>
          )}

          {/* MORNING — completed today. */}
          {morningCardState === 'completed' && (
            <div
              className="glass-panel p-5 rounded-3xl text-center space-y-6 border-morning-accent/25 shadow-morning-glow"
              style={{ backgroundColor: 'rgb(var(--color-morning-tint) / 0.1)' }}
            >
              {nextStepCardBody(morningCompletedCard, undefined, 'morning')}
              <button
                type="button"
                onClick={() => setActiveDialog({ kind: 'repeat', period: 'morning' })}
                className="block w-full py-3 rounded-xl glass-panel text-on-surface-variant font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/30"
              >
                {morningCompletedCard.buttonLabel}
              </button>
            </div>
          )}
        </>
      )}

      {activePeriod === 'evening' && (
        <>
          {/* Evening Visual Uplift (Build 17) — all four Evening card
              shells below (stale-choice, not-started, in-progress,
              completed) gained `border-evening-accent/25 shadow-evening-
              glow`, the same restrained boxShadow-token shape Build 16
              already established for the Morning cards, just built from
              evening-accent periwinkle instead - see tailwind.config.js's
              own evening-glow comment. Card logic (which state renders,
              completion/Resume/Redo behaviour, button labels/handlers)
              is completely untouched - only the outer className/style. */}
          {/* EVENING — an unfinished routine from an earlier local day
              exists, and nothing recorded for TODAY yet. Mirrors the
              Morning stale-choice card exactly. */}
          {eveningCardState === 'not-started' && eveningHasStaleChoice && (
            <div
              className="glass-panel p-5 rounded-3xl space-y-5 border-evening-accent/25 shadow-evening-glow"
              style={{ backgroundColor: 'rgb(var(--color-evening-tint) / 0.2)' }}
              role="region"
              aria-label="Unfinished previous Evening Wind-Down routine"
            >
              <div className="space-y-1">
                <p className="text-xs text-primary font-bold uppercase tracking-widest">Evening Reflection</p>
                <h3 className="text-xl font-bold text-on-surface">
                  {formatStaleRoutineDate(eveningStaleSnapshot?.dateKey, today)}'s Evening routine is unfinished.
                </h3>
                <p className="text-xs text-on-surface-variant font-medium">
                  {resolveStepLabel(RITUAL_SESSION_IDS.evening, eveningStaleSnapshot?.stepIndex ?? 0)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleResumeStaleEvening}
                aria-label={`Resume previous Evening routine, ${resolveStepLabel(RITUAL_SESSION_IDS.evening, eveningStaleSnapshot?.stepIndex ?? 0)}`}
                className="block w-full min-h-[44px] py-3.5 rounded-xl bg-primary text-on-primary text-center font-bold hover:opacity-90 active:scale-95 transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
              >
                Resume Previous Routine
              </button>
              <button
                type="button"
                onClick={() => setActiveDialog({ kind: 'discard-stale', period: 'evening' })}
                aria-label="Start today's Evening routine and clear the unfinished previous one"
                className="block w-full min-h-[44px] py-3.5 rounded-xl glass-panel text-on-surface-variant text-center font-semibold hover:bg-white/10 active:scale-95 transition-all !border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
              >
                Start Today's Routine
              </button>
            </div>
          )}

          {/* EVENING — not started, no stale choice. */}
          {eveningCardState === 'not-started' && !eveningHasStaleChoice && (
            <div
              className="glass-panel p-5 rounded-3xl space-y-6 border-evening-accent/25 shadow-evening-glow"
              style={{ backgroundColor: 'rgb(var(--color-evening-tint) / 0.2)' }}
            >
              {nextStepCardBody(eveningNotStartedCard, undefined, 'evening')}
              <button
                type="button"
                onClick={handleEveningAction}
                className="block w-full py-3.5 rounded-xl bg-primary text-on-primary text-center font-bold hover:opacity-90 active:scale-95 transition-all shadow-md"
              >
                {eveningNotStartedCard.buttonLabel}
              </button>
            </div>
          )}

          {/* EVENING — paused today. */}
          {eveningCardState === 'in-progress' && (
            <div
              className="glass-panel p-5 rounded-3xl space-y-6 border-evening-accent/25 shadow-evening-glow"
              style={{ backgroundColor: 'rgb(var(--color-evening-tint) / 0.2)' }}
            >
              {nextStepCardBody(eveningInProgressCard, resolveStepLabel(RITUAL_SESSION_IDS.evening, eveningResolvedStepIndex), 'evening')}
              <button
                type="button"
                onClick={handleEveningAction}
                className="block w-full py-3.5 rounded-xl bg-primary text-on-primary text-center font-bold hover:opacity-90 active:scale-95 transition-all shadow-md"
              >
                {eveningInProgressCard.buttonLabel}
              </button>
              <button
                type="button"
                onClick={() => setActiveDialog({ kind: 'start-over', period: 'evening' })}
                className="block w-full py-3 rounded-xl glass-panel text-on-surface-variant font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/30"
              >
                Start Over
              </button>
            </div>
          )}

          {/* EVENING — completed today.
              Evening completed-review (Build 15): the investigation
              confirmed a repeated same-day Evening session would
              silently overwrite tonight's already-saved Reflection/
              Gratitude answers (routine_responses' own UNIQUE
              (user_id, session_id, step_id, prompt_id, local_date)
              constraint has no room for a second same-day run - see the
              Phase 1 report). The old "Repeat Evening Routine" action
              (which claimed those answers "will remain in your
              history") is removed for authenticated users, replaced
              with a safe, read-only "Review Tonight's Journey" -
              guests never see it (they have no persisted
              routine_responses to review at all - Reflection.jsx/
              Gratitude.jsx both early-return before ever writing for a
              guest), and instead get a truthful, non-destructive way to
              simply begin the routine again. */}
          {eveningCardState === 'completed' && (
            <div
              className="glass-panel p-5 rounded-3xl space-y-6 border-evening-accent/25 shadow-evening-glow"
              style={{ backgroundColor: 'rgb(var(--color-evening-tint) / 0.2)' }}
            >
              {nextStepCardBody(eveningCompletedCard, undefined, 'evening')}
              {isGuest ? (
                <button
                  type="button"
                  onClick={handleBeginEveningWindDown}
                  className="block w-full py-3 rounded-xl glass-panel text-on-surface-variant font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/30"
                >
                  Begin Evening Wind-Down
                </button>
              ) : (
                <div className="space-y-2">
                  {/* Build 15 Evening UX correction — Review and Edit
                      combined into one action, matching EveningComplete.jsx's
                      own Step 6 screen: opens read-only Review first; Edit
                      is reached from Review's own banner (see
                      EveningReviewBanner.jsx), never a separate button
                      here. */}
                  <button
                    type="button"
                    onClick={() => navigate('/review/reflection?q=1')}
                    className="block w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-center hover:opacity-90 active:scale-95 transition-all"
                  >
                    Review or Edit Tonight's Responses
                  </button>
                  {/* Redo Tonight's Wind-Down (Build 15 addendum) — same
                      quiet, text-only destructive styling as
                      EveningComplete.jsx's own action, deliberately never
                      a filled/primary button so it never visually
                      competes with Review. The actual delete/flag/reset
                      sequence is the one shared
                      routineResponses.js#redoEveningWindDown - never a
                      second, hand-rolled copy of that logic here. */}
                  {redoError && (
                    <div className="glass-panel rounded-2xl p-4 border-red-400/30 bg-red-500/10">
                      <p className="text-sm text-on-surface">
                        Couldn't redo tonight's Wind-Down. Your existing journey is unchanged — please try again.
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleRedoTap}
                    className="block w-full py-3 text-center text-sm font-semibold text-red-300 hover:text-red-200 active:scale-95 transition-all"
                  >
                    Redo Tonight's Wind-Down
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Build 15 — ANYTIME. Unlike Morning/Evening, this isn't a
          routine with its own start/pause/complete state (no such
          tracking exists for Anytime Reset anywhere in this codebase -
          see the Phase 1 investigation), so there is no not-started/
          in-progress/completed branching here - just a single, honest
          "available anytime" card that opens the same /anytime-reset
          flow the quick-action tile always has. No streak, duration, or
          completion-count copy is invented for it. */}
      {activePeriod === 'anytime' && (
        // Anytime Reset Visual Uplift (Phase 2, approved decision B) —
        // restrained mint border + shadow-mint-glow, mint informational
        // badge, and its own tertiary-tint background (replacing a
        // pre-existing oddity where this card reused Morning's own
        // morning-tint token) - the peach "Start Anytime Reset" CTA below
        // is completely unchanged. Morning's/Evening's own detail cards
        // above/below are untouched. Uses tertiary-tint (the alpha-safe
        // RGB-triplet token, see index.css/tailwind.config.js) rather than
        // an opacity-modified `tertiary/NN` class - `tertiary` is a plain
        // hex string like `primary`/`morning-accent`/`evening-accent` and
        // cannot support a /<n> modifier (the same class of defect this
        // phase's AnytimeResetProgress.jsx fix addresses).
        <div
          className="glass-panel p-5 rounded-3xl text-center space-y-6 border-tertiary-tint/40 shadow-mint-glow"
          style={{ backgroundColor: 'rgb(var(--color-tertiary-tint) / 0.05)' }}
        >
          <div className="space-y-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-tertiary-tint/15 border border-tertiary-tint/30 text-tertiary text-[10px] font-bold uppercase tracking-wider">
              Available anytime
            </span>
            <h3 className="text-xl font-bold leading-tight text-on-surface pt-2">
              Take a moment to reset
            </h3>
            <p className="text-sm text-on-surface-variant font-medium">
              A short guided pause whenever you need one - no need to wait for Morning or Evening.
            </p>
          </div>
          <Link
            to="/anytime-reset"
            className="block w-full py-3.5 rounded-xl bg-primary text-on-primary font-bold text-center hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/10"
          >
            Start Anytime Reset
          </Link>
        </div>
      )}

      {/* 6. Active intentions — always visible, one fixed position, right
          below the recommended card+button, for both guests (gated on
          tap, not on visibility - onRequireSignIn) and registered users.
          Home Visual Uplift — "same refined surface depth/shadow language
          as the primary card, but keep it visually secondary": reuses the
          SAME period border-colour token the main card above already uses
          (morning-accent/tertiary-tint/evening-accent), at roughly half its
          opacity (/12 vs the main card's /25-/40) and with no glow shadow
          at all - still a plain shadow-sm, exactly as before. This is
          additive/restrained on purpose, never competing with the primary
          card's own stronger border+glow. */}
      <div
        className={`glass-panel p-5 rounded-3xl shadow-sm ${
          activePeriod === 'morning'
            ? 'border-morning-accent/12'
            : activePeriod === 'evening'
            ? 'border-evening-accent/12'
            : 'border-tertiary-tint/20'
        }`}
      >
        <ActiveIntentionCard
          label="Active Intention"
          intentions={displayIntentions}
          isGuest={isGuest}
          onRequireSignIn={promptRoutineSignIn}
        />
      </div>

      {/* 7-8. "Or choose something quick" + three shortcut cards -
          unchanged destinations/behaviour for every survivor, only their
          position (now after the recommended journey, never before it)
          and this label are new.
          Navigation simplification (Remove Routines from the Visible User
          Flow, follow-up) — the former fourth tile, "Explore Library",
          is removed: Library is already permanently available in the
          bottom nav, so this tile was a second, redundant way to reach
          the exact same destination Home's own nav bar already offers on
          every screen. grid-cols-4 -> grid-cols-3 is the only layout
          change needed for the three survivors to share the row's width
          evenly (same mechanism as Layout.jsx's own nav bar - a plain
          CSS grid, no other math to touch). No replacement tile added
          merely to keep the count at four. */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60 text-center">
          Or choose something quick
        </p>
        <div className="grid grid-cols-3 gap-2.5">
          {/* Build 15 — Anytime Reset now has its own "Today's Rhythm"
              card above (see the activePeriod === 'anytime' block), so
              this first quick-action tile is freed up for a standalone
              Breathe entry point (-> /breathe-standalone, QuietBreathing
              with its own pattern picker/Begin gesture - see
              standaloneBreathe.test.js). /support itself is untouched and
              still reachable (Library, Support.jsx's own sub-flows,
              existing tests) - only this one Home tile's destination
              changed.

              Desktop/keyboard tooltip, added alongside this fix: each
              tile is a `group` with a `role="tooltip"` span, hidden by
              default (opacity-0, pointer-events-none so it can never
              intercept a tap or a click) and shown only on
              group-hover/group-focus-visible - :focus-visible specifically
              (not plain :focus) so a mouse click never triggers it, only
              real keyboard Tab focus. The tooltip's text always mirrors
              the tile's own permanently-visible label - it is a
              supplementary aria-describedby, never the tile's accessible
              NAME (that's still the visible label text), and it never
              replaces or hides that label. On touch devices `:hover`
              typically only sticks for an instant before the tap's own
              navigation fires, so this never meaningfully obstructs a
              normal mobile tap. min-h-[44px] (already present) and the
              tile's own full tap area are unchanged. */}
          <Link
            to="/breathe-standalone"
            aria-describedby="quick-action-tip-breathe"
            className="group relative glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center hover:bg-white/5 active:scale-95 transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {/* Circadian Colors — sage/mint pause/breathing accent. */}
            <span className="material-symbols-outlined text-tertiary text-2xl">air</span>
            <span className="text-[11px] font-semibold text-on-surface leading-tight">Breathe</span>
            <span
              id="quick-action-tip-breathe"
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-lg bg-surface-container-highest px-2.5 py-1.5 text-[10px] font-semibold text-on-surface opacity-0 shadow-lg border border-white/10 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 z-50"
            >
              Breathe
            </span>
          </Link>
          {/* Self-Guided Meditation: quick action, not a fifth bottom-nav
              tab. Routes to the new self-guided setup screen (see
              SelfGuidedMeditation.jsx's own doc comment) - repurposed from
              the previous guided-video wizard (Meditate.jsx), which stays
              fully intact and is now reached via that setup screen's own
              "Explore Guided Meditations" action into Library's real
              Meditation category, or by direct URL - never deleted, never
              altered. `from=home` is this feature's own allowlisted entry
              context (selfGuidedMeditationNav.js). */}
          <Link
            to="/self-guided-meditation?from=home"
            aria-describedby="quick-action-tip-meditate"
            className="group relative glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center hover:bg-white/5 active:scale-95 transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-primary text-2xl">spa</span>
            <span className="text-[11px] font-semibold text-on-surface leading-tight">Meditate</span>
            <span
              id="quick-action-tip-meditate"
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-lg bg-surface-container-highest px-2.5 py-1.5 text-[10px] font-semibold text-on-surface opacity-0 shadow-lg border border-white/10 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 z-50"
            >
              Meditate
            </span>
          </Link>
          <Link
            to="/library?category=sleep-soundscapes&from=home"
            aria-describedby="quick-action-tip-sleep-sounds"
            className="group relative glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center hover:bg-white/5 active:scale-95 transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {/* Circadian Colors — twilight lavender, matching every other
                Evening/sleep surface in the app (Home.jsx's own Evening
                pill, Introduction.jsx's welcome card, the Routines Hub's
                Wind-Down card). */}
            <span className="material-symbols-outlined text-evening-accent text-2xl">bedtime</span>
            <span className="text-[11px] font-semibold text-on-surface leading-tight">Sleep &amp; Unwind</span>
            <span
              id="quick-action-tip-sleep-sounds"
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-lg bg-surface-container-highest px-2.5 py-1.5 text-[10px] font-semibold text-on-surface opacity-0 shadow-lg border border-white/10 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 z-50"
            >
              Sleep &amp; Unwind
            </span>
          </Link>
        </div>
      </div>

      {/* "Start Over" / "Repeat Morning/Evening Routine" / "Start Today's
          Routine" confirmation — one dialog, driven entirely by
          dialogCopy (see activeDialog's own doc comment above). Every
          confirm path is scoped to exactly one routine's own sessionId:
          never the other routine's progress, never journal entries/
          reflections/intentions/completed-session history, never
          subscription/entitlement data. */}
      <ConfirmDialog
        open={activeDialog !== null}
        title={dialogCopy?.title ?? ''}
        message={dialogCopy?.message ?? ''}
        confirmLabel={dialogCopy?.confirmLabel ?? 'Confirm'}
        cancelLabel={dialogCopy?.cancelLabel ?? 'Cancel'}
        destructive={dialogCopy?.destructive ?? false}
        mildDestructive={dialogCopy?.mildDestructive ?? false}
        onConfirm={handleConfirmDialog}
        onDismiss={() => setActiveDialog(null)}
      />

      {/* Redo Tonight's Wind-Down (Build 15 addendum) — same exact
          approved copy as EveningComplete.jsx's own dialog, kept as its
          own separate ConfirmDialog instance (see handleConfirmRedo's own
          doc comment above for why). */}
      <ConfirmDialog
        open={redoConfirmOpen}
        title="Redo tonight's Wind-Down?"
        message="This will permanently delete tonight's saved Reflection and Gratitude responses and restart the Evening journey from the beginning. If you leave before completing it again, your previous responses cannot be restored."
        confirmLabel="Delete Responses & Redo"
        cancelLabel="Keep Existing Journey"
        destructive
        confirmPending={isRedoing}
        onConfirm={handleConfirmRedo}
        onDismiss={() => setRedoConfirmOpen(false)}
      />

      {/* Guest Onboarding — shown instead of actually starting/resuming/
          repeating/resetting either routine for a guest (see
          promptRoutineSignIn's own doc comment above). Content and cards
          stay fully visible either way; only the CTA's behaviour changes. */}
      <SignInPromptDialog
        open={routineSignInPromptOpen}
        onSignIn={confirmRoutineSignIn}
        onCreateAccount={confirmRoutineCreateAccount}
        onDismiss={dismissRoutineSignInPrompt}
      />
    </div>
  );
};

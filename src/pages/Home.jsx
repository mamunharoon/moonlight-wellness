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
import { getRoutineProgress, getRoutineProgressIncludingStale } from '../session/routineProgress';
import {
  RITUAL_SESSION_IDS,
  resolveRoutineCardState,
  resolveRoutineStepIndex,
  shouldShowCrossRoutineBanner,
  shouldOfferStaleRoutineChoice,
  formatStaleRoutineDate
} from '../lib/routineCardState';
import { now as devNow } from '../lib/devClock';
import { getZonedParts } from '../lib/timezone';
import { getGreeting } from '../lib/greeting';
import { TimezoneBanner } from '../components/TimezoneBanner';
import { ConfirmDialog } from '../components/ConfirmDialog';

const MORNING_DONE_KEY = 'moonlight_morning_completed_date';
const EVENING_DONE_KEY = 'moonlight_evening_completed_date';
const MEDITATION_DONE_KEY = 'moonlight_meditation_completed_date';

export const Home = () => {
  const navigate = useNavigate();
  const { alarmTime, bedTime, intentions, effectiveTimezone } = useAlarm();
  const { profile, user } = useAuth();
  const { state, startSession, advanceStep, resetSession, resumeRoutine, resetRoutine, resumeStaleRoutine, discardStaleRoutine } = useSession();

  // Global timezone correctness: every "what day/time is it for this
  // user" question below goes through getZonedParts(effectiveTimezone),
  // never new Date()'s raw local getters or toDateString()/toISOString().
  // devNow() layers in on top purely for the DEV-only clock-injection
  // test seam (see lib/devClock.js) - it still resolves to the real
  // instant in production, so this is exactly "the real current instant,
  // interpreted in the user's own timezone" in a shipped build.
  const zoned = getZonedParts(effectiveTimezone, devNow());
  const today = zoned.dateKey;
  const isMorningDone = localStorage.getItem(MORNING_DONE_KEY) === today;
  const isEveningDone = localStorage.getItem(EVENING_DONE_KEY) === today;
  // Meditation experience: mirrors the morning/evening pattern exactly -
  // a local-date-keyed flag using the same timezone-correct dateKey, so
  // it resets at the user's own local midnight, never Sydney server time
  // or UTC. Only ever shown once earned (see the pill below), not as a
  // persistent unchecked placeholder like Morning/Evening.
  const isMeditatedToday = localStorage.getItem(MEDITATION_DONE_KEY) === today;

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
      return {
        title: 'Start this routine again?',
        message: 'Your current step progress will be reset. Saved history and journal entries will not be deleted.',
        confirmLabel: 'Start Over',
        destructive: true
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
    return {
      title: "Start today's routine?",
      message: 'Your unfinished previous routine progress will be cleared.',
      confirmLabel: "Start Today's Routine",
      destructive: true
    };
  })();

  const handleConfirmDialog = () => {
    if (!activeDialog) return;
    const { kind, period } = activeDialog;
    const sessionId = RITUAL_SESSION_IDS[period];
    if (kind === 'start-over') {
      resetRoutine(sessionId);
    } else if (kind === 'repeat') {
      if (period === 'morning') handleBeginRiseAndReset();
      else handleBeginEveningWindDown();
    } else if (kind === 'discard-stale') {
      discardStaleRoutine(sessionId);
      if (period === 'morning') handleBeginRiseAndReset();
      else handleBeginEveningWindDown();
    }
    setActiveDialog(null);
  };

  // "Resume Previous Routine" — resumes the EXACT stale snapshot (its own
  // saved step, its own original date identity — see resumeStaleRoutine's
  // own doc comment), then navigates straight to that same step's own
  // route, scoped to this one sessionId only, mirroring
  // handleMorningAction/handleEveningAction's existing pattern exactly.
  const handleResumeStaleMorning = () => {
    if (!resumeStaleRoutine(RITUAL_SESSION_IDS.morning)) return;
    const session = getSessionById(RITUAL_SESSION_IDS.morning);
    const stepIndex = morningStaleSnapshot?.stepIndex ?? 0;
    navigate(session?.steps[stepIndex]?.route ?? '/morning-start');
  };
  const handleResumeStaleEvening = () => {
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

  // Morning/Evening selector: null means "automatic" (the timeState
  // logic above decides, unchanged) - only becomes 'morning'/'evening'
  // once the user actually taps a pill, and then stays that way for the
  // rest of this page view (component state, not persisted - a fresh
  // visit re-derives from the real clock again). Only overrides during
  // daytime-morning/daytime/evening: before-wake and night are real
  // time-based constraints (before your alarm; late enough that winding
  // down further doesn't make sense), not a ritual choice to toggle.
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const overridableTimeStates = timeState === 'daytime-morning' || timeState === 'daytime' || timeState === 'evening';
  const effectiveTimeState =
    overridableTimeStates && selectedPeriod === 'morning'
      ? 'daytime-morning'
      : overridableTimeStates && selectedPeriod === 'evening'
        ? 'evening'
        : timeState;
  // Which pill looks active. Once the user has picked one, show that
  // choice; otherwise reflect the real clock (existing daypart rules) -
  // evening/night lean the Evening pill, everything else leans Morning.
  const activePeriod = selectedPeriod ?? (timeState === 'evening' || timeState === 'night' ? 'evening' : 'morning');

  const primaryIntention = intentions[0] || 'Stay calm';

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
  const handleMorningAction = () => {
    if (morningCardState === 'in-progress') {
      resumeRoutine(RITUAL_SESSION_IDS.morning);
      const session = getSessionById(RITUAL_SESSION_IDS.morning);
      navigate(session?.steps[morningResolvedStepIndex]?.route ?? '/morning-start');
      return;
    }
    handleBeginRiseAndReset();
  };

  const handleEveningAction = () => {
    if (eveningCardState === 'in-progress') {
      resumeRoutine(RITUAL_SESSION_IDS.evening);
      const session = getSessionById(RITUAL_SESSION_IDS.evening);
      navigate(session?.steps[eveningResolvedStepIndex]?.route ?? '/reflection');
      return;
    }
    handleBeginEveningWindDown();
  };

  // Close Remaining Daily-Journey Limitations: Today's own "Begin Rise &
  // Reset" card used to be a bare Link straight to /morning-start, which
  // is now just Step 1 of the routine (see MorningStart.jsx's own doc
  // comment) and assumes the Session Engine was already started by
  // whoever navigated here — a real entry point (RoutineDetail.jsx's own
  // Start Routine) already does this, but Today's card didn't, so a
  // routine begun from here never actually engaged the Session Engine
  // (no step tracking, no resume, no "Continue where you left off").
  // Mirrors RoutineDetail.jsx's beginRiseAndReset exactly: reset-before-
  // start guard, then start fresh at Step 1.
  const handleBeginRiseAndReset = () => {
    if (state.status === 'playing' || state.status === 'interrupted') {
      resetSession();
    }
    startSession('morning-routine', { startIndex: getStepIndex('morning-routine', MORNING_STEP_IDS.START) });
    navigate('/morning-start');
  };

  // Same reset-before-start guard, for a genuinely fresh Evening Wind-
  // down start — mirrors EveningWindDown.jsx's own fresh-start branch
  // (advances straight past the content-free "windDown" step to
  // Reflection, exactly as tapping Begin on that page itself does).
  const handleBeginEveningWindDown = () => {
    if (state.status === 'playing' || state.status === 'interrupted') {
      resetSession();
    }
    startSession('evening-wind-down');
    advanceStep();
    navigate('/reflection');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      <TimezoneBanner />

      {/* Morning/Evening selector — also shows each ritual's daily
          completion status (the ✓ prefix), same as before this was made
          functional. Segmented-control styling fix: the previous
          treatment gave the INACTIVE pill glass-panel's own visible
          border while the active pill had none at all - backwards from
          what a selected state should look like, and genuinely
          confusing. Active now gets each option's own solid accent fill
          (bg-primary/text-on-primary for Morning, bg-secondary/
          text-on-secondary for Evening - the same high-contrast pairs
          already used for this app's primary CTA buttons elsewhere, not
          a new colour choice) with a matching border and a subtle shadow
          for depth; inactive drops the border entirely and uses a much
          quieter fill, so there is never any ambiguity about which one
          is selected. role="tablist"/"tab" + aria-selected is the
          semantically correct ARIA pattern for a mutually-exclusive
          segmented selector like this one (replacing the previous
          aria-pressed, which is for independent toggle buttons, not a
          tab-like choice) - keyboard/touch/screen-reader operability is
          unaffected, since these remain plain, fully-focusable <button>
          elements with only their role/state attributes and visual
          classes changed. */}
      <div className="flex gap-2" role="tablist" aria-label="Time of day">
        <button
          type="button"
          role="tab"
          onClick={() => setSelectedPeriod('morning')}
          aria-selected={activePeriod === 'morning'}
          className={`flex-1 text-center text-[10px] font-bold uppercase tracking-wider py-2 rounded-full transition-all border ${
            activePeriod === 'morning'
              ? 'bg-primary text-on-primary border-primary shadow-sm'
              : 'bg-white/5 text-on-surface-variant/60 border-transparent hover:bg-white/10'
          }`}
        >
          {isMorningDone ? '✓ Morning' : 'Morning'}
        </button>
        <button
          type="button"
          role="tab"
          onClick={() => setSelectedPeriod('evening')}
          aria-selected={activePeriod === 'evening'}
          className={`flex-1 text-center text-[10px] font-bold uppercase tracking-wider py-2 rounded-full transition-all border ${
            activePeriod === 'evening'
              ? 'bg-secondary text-on-secondary border-secondary shadow-sm'
              : 'bg-white/5 text-on-surface-variant/60 border-transparent hover:bg-white/10'
          }`}
        >
          {isEveningDone ? '✓ Evening' : 'Evening'}
        </button>
        {isMeditatedToday && (
          <span className="flex-1 text-center text-[10px] font-bold uppercase tracking-wider py-2 rounded-full bg-tertiary/15 text-tertiary">
            ✓ Meditated today
          </span>
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

      {/* Persistent, always-reachable actions — never gated on having
          set an intention, regardless of time of day. */}
      <div className="space-y-3">
        <div className="glass-panel px-4 py-3 rounded-2xl flex items-center gap-3">
          <span className="material-symbols-outlined text-tertiary text-lg shrink-0">spa</span>
          <p className="text-xs text-on-surface-variant min-w-0 truncate">
            <span className="font-bold uppercase tracking-wider text-[10px] text-tertiary mr-1.5">Intention</span>
            "{primaryIntention}"
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          <Link
            to="/support"
            className="glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center hover:bg-white/5 active:scale-95 transition-all min-h-[44px]"
          >
            <span className="material-symbols-outlined text-primary text-xl">self_improvement</span>
            <span className="text-[11px] font-semibold text-on-surface leading-tight">Need a moment?</span>
          </Link>
          {/* Meditation experience: quick action, not a fifth bottom-nav
              tab. Routes to /meditate — see Meditate.jsx's own doc
              comment for the full journey it owns from here. */}
          <Link
            to="/meditate"
            className="glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center hover:bg-white/5 active:scale-95 transition-all min-h-[44px]"
          >
            <span className="material-symbols-outlined text-primary text-xl">spa</span>
            <span className="text-[11px] font-semibold text-on-surface leading-tight">Meditate</span>
          </Link>
          <Link
            to="/library"
            className="glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center hover:bg-white/5 active:scale-95 transition-all min-h-[44px]"
          >
            <span className="material-symbols-outlined text-primary text-xl">video_library</span>
            <span className="text-[11px] font-semibold text-on-surface leading-tight">Browse exercises</span>
          </Link>
          <Link
            to="/library?category=sleep-soundscapes"
            className="glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center hover:bg-white/5 active:scale-95 transition-all min-h-[44px]"
          >
            <span className="material-symbols-outlined text-primary text-xl">bedtime</span>
            <span className="text-[11px] font-semibold text-on-surface leading-tight">Sleep sounds</span>
          </Link>
        </div>
      </div>

      {/* BEFORE WAKE TIME */}
      {timeState === 'before-wake' && (
        <div className="space-y-8 text-center py-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary text-3xl">bedtime</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-on-surface">Still resting</h2>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              Next wake reminder at {alarmTime}. Bedtime was set for {bedTime}.
            </p>
          </div>
        </div>
      )}

      {/* MORNING WINDOW — not started today, and no unfinished routine
          from an earlier day either (see the stale-choice card below for
          the other case) */}
      {effectiveTimeState === 'daytime-morning' && morningCardState === 'not-started' && !morningHasStaleChoice && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">{getGreeting('morning', { profile, user })}</h2>
            <p className="text-xs text-on-surface-variant font-medium">Ready for your breath of fresh air today?</p>
          </div>
          <div className="glass-panel p-8 rounded-3xl text-center space-y-6 border-primary/20 shadow-sm bg-gradient-to-tr from-[#fffdfa] via-[#fff5f2] to-[#ffebd2] dark:from-[#1e1a17] dark:to-[#2d221c]">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">
              Rise &amp; Reset
            </span>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold leading-tight text-on-surface">Ready when you are</h3>
              <p className="text-sm text-on-surface-variant font-medium">A short 5-step sequence to start your day grounded.</p>
            </div>
            <button
              type="button"
              onClick={handleMorningAction}
              className="block w-full py-4 rounded-xl bg-primary text-on-primary font-bold text-center hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/10"
            >
              Begin Rise &amp; Reset
            </button>
          </div>
        </div>
      )}

      {/* MORNING WINDOW — an unfinished routine from an earlier local day
          exists (shouldOfferStaleRoutineChoice), and nothing has been
          recorded for TODAY yet. Never silently resumes it as today's
          routine, deletes it, or presents it as today's own progress —
          both explicit choices are always shown side by side. */}
      {effectiveTimeState === 'daytime-morning' && morningCardState === 'not-started' && morningHasStaleChoice && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">{getGreeting('morning', { profile, user })}</h2>
            <p className="text-xs text-on-surface-variant font-medium">You have an unfinished routine waiting.</p>
          </div>
          <div
            className="glass-panel p-6 rounded-3xl space-y-5 border-primary/30 shadow-sm bg-gradient-to-tr from-[#fffdfa] via-[#fff5f2] to-[#ffebd2] dark:from-[#1e1a17] dark:to-[#2d221c]"
            role="region"
            aria-label="Unfinished previous Rise & Reset routine"
          >
            <div className="space-y-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">
                Rise &amp; Reset
              </span>
              <h3 className="text-xl font-bold leading-tight text-on-surface pt-2">
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
              className="block w-full min-h-[44px] py-4 rounded-xl bg-primary text-on-primary font-bold text-center hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
        </div>
      )}

      {/* MORNING WINDOW — paused today (Build 10: previously indistinguishable
          from "not started" — resolveRoutineCardState/routineProgress.js
          now track this independently of Evening's own progress). */}
      {effectiveTimeState === 'daytime-morning' && morningCardState === 'in-progress' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">{getGreeting('morning', { profile, user })}</h2>
            <p className="text-xs text-on-surface-variant font-medium">Pick up right where you paused.</p>
          </div>
          <div className="glass-panel p-8 rounded-3xl text-center space-y-6 border-primary/20 shadow-sm bg-gradient-to-tr from-[#fffdfa] via-[#fff5f2] to-[#ffebd2] dark:from-[#1e1a17] dark:to-[#2d221c]">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">
              Rise &amp; Reset — {resolveStepLabel(RITUAL_SESSION_IDS.morning, morningResolvedStepIndex)}
            </span>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold leading-tight text-on-surface">Resume Rise &amp; Reset</h3>
            </div>
            <button
              type="button"
              onClick={handleMorningAction}
              className="block w-full py-4 rounded-xl bg-primary text-on-primary font-bold text-center hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/10"
            >
              Resume — {resolveStepLabel(RITUAL_SESSION_IDS.morning, morningResolvedStepIndex)}
            </button>
            <button
              type="button"
              onClick={() => setActiveDialog({ kind: 'start-over', period: 'morning' })}
              className="block w-full py-3 rounded-xl glass-panel text-on-surface-variant font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/30"
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* MORNING WINDOW — completed today */}
      {effectiveTimeState === 'daytime-morning' && morningCardState === 'completed' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">Rise &amp; Reset complete</h2>
            <p className="text-xs text-on-surface-variant font-medium">You started today with intention.</p>
          </div>
          <div className="glass-panel p-6 rounded-3xl space-y-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Today's Intention</p>
            <p className="text-lg italic font-medium text-on-surface">"{primaryIntention}"</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveDialog({ kind: 'repeat', period: 'morning' })}
            className="block w-full py-3 rounded-xl glass-panel text-on-surface-variant font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/30"
          >
            Repeat Morning Routine
          </button>
        </div>
      )}

      {/* DAYTIME */}
      {effectiveTimeState === 'daytime' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">{getGreeting('afternoon', { profile, user })}</h2>
            <p className="text-xs text-on-surface-variant font-medium">One small step at a time.</p>
          </div>
          <div className="glass-panel p-6 rounded-3xl space-y-6 shadow-sm bg-gradient-to-br from-[#ffffff]/5 to-transparent">
            <div className="space-y-2">
              <p className="text-xs text-primary font-bold uppercase tracking-wider">Active Intention</p>
              <p className="text-lg font-bold text-on-surface">"{primaryIntention}"</p>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">Take a gentle 60-second breathing break to center your focus and reduce anxiety.</p>
            <Link to="/breathe" className="block w-full py-3 rounded-xl bg-primary text-on-primary text-center font-bold hover:opacity-90 active:scale-95 transition-all shadow-md">
              60-Second Reset
            </Link>
          </div>
        </div>
      )}

      {/* EVENING — not started today, and no unfinished routine from an
          earlier day either (see the stale-choice card below) */}
      {effectiveTimeState === 'evening' && eveningCardState === 'not-started' && !eveningHasStaleChoice && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-[#ffc5b7] tracking-tight">{getGreeting('evening', { profile, user })}</h2>
            <p className="text-xs text-on-surface-variant font-medium">You've done enough for today. Let's prepare for tomorrow.</p>
          </div>
          <div className="glass-panel p-6 rounded-3xl space-y-6 border-white/5 shadow-sm bg-gradient-to-br from-[#121b2e]/30 to-transparent">
            <div className="space-y-1">
              <p className="text-xs text-primary font-bold uppercase tracking-widest">Evening Reflection</p>
              <h3 className="text-xl font-bold text-on-surface">What are you grateful for today?</h3>
            </div>
            <button
              type="button"
              onClick={handleEveningAction}
              className="block w-full py-4 rounded-xl bg-primary text-on-primary text-center font-bold hover:opacity-90 active:scale-95 transition-all shadow-md"
            >
              Begin Wind-Down
            </button>
            <Link to="/library?category=sleep-soundscapes" className="block w-full py-4 rounded-xl glass-panel text-on-surface-variant text-center font-semibold hover:bg-white/10 active:scale-95 transition-all !border-white/10">
              Sleep Soundscapes
            </Link>
          </div>
        </div>
      )}

      {/* EVENING — an unfinished routine from an earlier local day exists,
          and nothing recorded for TODAY yet. Mirrors the Morning stale-
          choice card exactly (see its own doc comment above). */}
      {effectiveTimeState === 'evening' && eveningCardState === 'not-started' && eveningHasStaleChoice && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-[#ffc5b7] tracking-tight">{getGreeting('evening', { profile, user })}</h2>
            <p className="text-xs text-on-surface-variant font-medium">You have an unfinished routine waiting.</p>
          </div>
          <div
            className="glass-panel p-6 rounded-3xl space-y-5 border-white/5 shadow-sm bg-gradient-to-br from-[#121b2e]/30 to-transparent"
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
              className="block w-full min-h-[44px] py-4 rounded-xl bg-primary text-on-primary text-center font-bold hover:opacity-90 active:scale-95 transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
            >
              Resume Previous Routine
            </button>
            <button
              type="button"
              onClick={() => setActiveDialog({ kind: 'discard-stale', period: 'evening' })}
              aria-label="Start today's Evening routine and clear the unfinished previous one"
              className="block w-full min-h-[44px] py-4 rounded-xl glass-panel text-on-surface-variant text-center font-semibold hover:bg-white/10 active:scale-95 transition-all !border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
            >
              Start Today's Routine
            </button>
          </div>
        </div>
      )}

      {/* EVENING — paused today (Build 10: the exact defect reported —
          this card previously came from whichever routine was globally
          live, so an Evening pause could be shown/resumed while Morning
          was selected and vice versa; both are now resolved
          independently per sessionId, and this block only ever renders
          for Evening's OWN in-progress state). */}
      {effectiveTimeState === 'evening' && eveningCardState === 'in-progress' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-[#ffc5b7] tracking-tight">{getGreeting('evening', { profile, user })}</h2>
            <p className="text-xs text-on-surface-variant font-medium">Pick up right where you paused.</p>
          </div>
          <div className="glass-panel p-6 rounded-3xl space-y-6 border-white/5 shadow-sm bg-gradient-to-br from-[#121b2e]/30 to-transparent">
            <div className="space-y-1">
              <p className="text-xs text-primary font-bold uppercase tracking-widest">
                Evening Reflection — {resolveStepLabel(RITUAL_SESSION_IDS.evening, eveningResolvedStepIndex)}
              </p>
              <h3 className="text-xl font-bold text-on-surface">Continue your wind-down</h3>
            </div>
            <button
              type="button"
              onClick={handleEveningAction}
              className="block w-full py-4 rounded-xl bg-primary text-on-primary text-center font-bold hover:opacity-90 active:scale-95 transition-all shadow-md"
            >
              Resume — {resolveStepLabel(RITUAL_SESSION_IDS.evening, eveningResolvedStepIndex)}
            </button>
            <button
              type="button"
              onClick={() => setActiveDialog({ kind: 'start-over', period: 'evening' })}
              className="block w-full py-3 rounded-xl glass-panel text-on-surface-variant font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/30"
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* EVENING — completed today */}
      {effectiveTimeState === 'evening' && eveningCardState === 'completed' && (
        <div className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold text-[#ffc5b7] tracking-tight">{getGreeting('evening', { profile, user })}</h2>
            <p className="text-xs text-on-surface-variant font-medium">Tonight's wind-down is complete. Rest well.</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveDialog({ kind: 'repeat', period: 'evening' })}
            className="block w-full py-3 rounded-xl glass-panel text-on-surface-variant font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/30"
          >
            Repeat Evening Routine
          </button>
        </div>
      )}

      {/* LATE NIGHT */}
      {timeState === 'night' && (
        <div className="space-y-8 text-center py-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary text-3xl">dark_mode</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-on-surface">Rest Well</h2>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              Circadian rhythms are settling. Tomorrow's wake reminder is set for {alarmTime}. Sleep soundly.
            </p>
          </div>
          <Link to="/library?category=sleep-soundscapes" className="inline-block px-6 py-3 rounded-full glass-panel text-on-surface-variant text-sm font-semibold hover:bg-white/10 active:scale-95 transition-all border-white/10">
            Sleep Soundscapes
          </Link>
        </div>
      )}

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
        cancelLabel="Cancel"
        destructive={dialogCopy?.destructive ?? false}
        onConfirm={handleConfirmDialog}
        onDismiss={() => setActiveDialog(null)}
      />
    </div>
  );
};

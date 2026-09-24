/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { getSessionById } from '../session/sessionRegistry';
import {
  sessionReducer,
  initialSessionState,
  SESSION_ACTION_TYPES,
  SESSION_STATUS,
} from '../session/sessionReducer';
import { loadSessionState, saveSessionState } from '../session/sessionPersistence';
import {
  saveRoutineProgress,
  getRoutineProgress,
  getRoutineProgressIncludingStale,
  clearRoutineProgress,
  pinRoutineDate,
  unpinRoutineDate
} from '../session/routineProgress';
import { runMorningFlowMigration } from '../session/morningFlowMigration';
import { runEmbeddedMeditationMigration } from '../session/embeddedMeditationMigration';
import { onSignOutBroadcast } from '../lib/signOutCleanup';

// Morning-flow reorder migration — run once, at module-evaluation time,
// deliberately NOT inside a React effect. ES module evaluation is
// synchronous and completes before main.jsx ever calls ReactDOM's
// render(), so this always finishes before the first render of anything
// — including Home.jsx, which reads routineProgress.js's stores directly
// during render, not just through this provider's own restore effect
// below. Running it any later (e.g. in SessionProvider's mount effect)
// would still be too late for that direct read, since React fires child
// effects before parent effects. See morningFlowMigration.js's own doc
// comment for the full migration behaviour.
runMorningFlowMigration();
// Journey Embedding (Self-Guided Meditation) migration — same reasoning,
// same call-site pattern, run immediately after the one above. Each
// migration is independently gated by its own marker key and touches only
// the exact keys it documents, so running both here in sequence is safe
// regardless of order — see embeddedMeditationMigration.js's own doc
// comment for the full migration behaviour.
runEmbeddedMeditationMigration();

/*
 * Stage 3C — Session Engine core, provider (Ticket Group 2)
 *
 * Wraps the pure reducer (src/session/sessionReducer.js) with React
 * state, mount-time restoration from localStorage, and a write-through
 * persist effect. This is the only place in the Session Engine that
 * touches localStorage-adjacent side effects at the React level — the
 * actual read/write calls live in src/session/sessionPersistence.js.
 * Derives currentSession/currentStep/etc. from the Group 1 registry on
 * every render rather than duplicating any step data into state.
 *
 * INTEGRATION BOUNDARY (Group 2)
 *   This provider is NOT mounted around the live application tree. Per
 *   the Group 2 task brief, it is wrapped only locally by
 *   SessionEnginePreview.jsx. It has no effect on AlarmProvider, Layout,
 *   authentication, persistence, or existing routing — importing this
 *   file does nothing until a component actually renders
 *   <SessionProvider>. Group 3 will separately decide and verify the
 *   real provider order before any production integration.
 *
 * STRICTMODE NOTE
 *   src/main.jsx wraps the app in <React.StrictMode>, which
 *   double-invokes effects on mount in development (mount → cleanup →
 *   mount again) to surface missing-cleanup bugs. The mount-restore
 *   effect below therefore guards itself with `hasRestoredRef` — a ref
 *   persists across that synthetic double-invoke (only effects are
 *   replayed, not the component instance), so without the guard a
 *   development-only session would be restored twice and persisted
 *   twice in a row. Production builds never double-invoke, but the
 *   guard costs nothing and keeps behaviour identical in both.
 */

const SessionContext = createContext(null);

export const SessionProvider = ({ children }) => {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);

  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    const restored = loadSessionState();
    if (restored) {
      dispatch({ type: SESSION_ACTION_TYPES.RESTORE_SESSION, payload: restored });
    }
  }, []);

  // Logout / cross-user client-state audit — a signed-out user's live
  // 'playing'/'interrupted' session was otherwise left exactly as-is in
  // this reducer's own in-memory state (nothing outside this provider can
  // dispatch to it — AuthContext.signOut() cannot reach useSession()
  // directly, see signOutCleanup.js's own doc comment), surviving into
  // the very next signed-in identity on the same tab with no refresh
  // required, and also driving a stale RoutineRestoreGuard redirect.
  // RESET_SESSION returns canonical idle synchronously, so the write-
  // through persist effect below fires right after and overwrites
  // moonlight_session_progress with that same idle state — no separate
  // localStorage clear needed for this key.
  useEffect(() => {
    return onSignOutBroadcast(() => dispatch({ type: SESSION_ACTION_TYPES.RESET_SESSION }));
  }, []);

  // Write-through persistence. Fires once per genuine state change.
  // COMPLETE_SESSION's idempotent repeat call returns the exact same
  // state reference from the reducer, so useReducer does not re-render
  // and this effect does not re-fire — no duplicate-write path exists
  // for that case, and every other action only ever produces one state
  // change per dispatch.
  useEffect(() => {
    saveSessionState(state);
  }, [state]);

  // Build 10 remediation — per-routine progress mirror (see
  // routineProgress.js's own doc comment for the full root-cause
  // explanation). This engine only ever tracks ONE session as "live" at
  // a time; this second, additive write keeps a running, independent
  // snapshot per sessionId, so starting a DIFFERENT routine (which
  // requires resetSession() first, wiping the live slot back to
  // canonical idle) never destroys the routine that was just left
  // behind — its last real state was already durably saved here on its
  // own last genuine state change, before the reset ever happened. Never
  // fires for the canonical-idle state (sessionId null) — nothing
  // routine-specific to store for "no active session".
  useEffect(() => {
    if (!state.sessionId) return;
    saveRoutineProgress(state.sessionId, {
      stepIndex: state.stepIndex,
      status: state.status,
      startedAt: state.startedAt,
      updatedAt: state.updatedAt,
      completionEventId: state.completionEventId
    });
  }, [state]);

  const currentSession = useMemo(() => getSessionById(state.sessionId), [state.sessionId]);
  const currentStep = useMemo(
    () => currentSession?.steps[state.stepIndex] ?? null,
    [currentSession, state.stepIndex]
  );
  const totalSteps = currentSession?.steps.length ?? 0;
  const hasPreviousStep = currentSession != null && state.stepIndex > 0;
  const hasNextStep = currentSession != null && state.stepIndex < totalSteps - 1;
  const isTerminalStep = currentSession != null && state.stepIndex === totalSteps - 1;
  const canSkipCurrentStep = state.status === SESSION_STATUS.PLAYING && currentStep?.skippable === true;
  const progress = totalSteps > 0 ? Math.min((state.stepIndex + 1) / totalSteps, 1) : 0;

  const startSession = useCallback((sessionId, options) => {
    dispatch({ type: SESSION_ACTION_TYPES.START_SESSION, payload: { sessionId, startIndex: options?.startIndex } });
  }, []);
  const advanceStep = useCallback(() => dispatch({ type: SESSION_ACTION_TYPES.ADVANCE_STEP }), []);
  // Plain, dedicated method — deliberately not folded into advanceStep, so
  // callers stay explicit about whether they mean "next step" or "jump
  // forward to a specific step" (Stage 3C Group 3D Batch A, Unit 3).
  const advanceToStep = useCallback((stepId) => {
    dispatch({ type: SESSION_ACTION_TYPES.ADVANCE_TO_STEP, payload: { stepId } });
  }, []);
  const skipStep = useCallback(() => dispatch({ type: SESSION_ACTION_TYPES.SKIP_STEP }), []);
  const interruptSession = useCallback((reason) => {
    dispatch({ type: SESSION_ACTION_TYPES.INTERRUPT_SESSION, payload: { reason } });
  }, []);
  const resumeSession = useCallback(() => dispatch({ type: SESSION_ACTION_TYPES.RESUME_SESSION }), []);
  const completeSession = useCallback(() => dispatch({ type: SESSION_ACTION_TYPES.COMPLETE_SESSION }), []);
  // "Resume Previous Routine" remediation — abandoning/resetting whatever
  // is currently live also unpins its date (if any). Both are genuine
  // endpoints for a run (deliberate exit; explicit reset/fresh-start), so
  // a NEXT session for this same sessionId must save under today's real
  // date again, not the old pinned one. Pinning is otherwise dormant for
  // routines that were never resumed from a stale entry - unpinning one
  // that was never pinned is already a safe no-op (routineProgress.js's
  // own unpinRoutineDate).
  const abandonSession = useCallback(() => {
    if (state.sessionId) unpinRoutineDate(state.sessionId);
    dispatch({ type: SESSION_ACTION_TYPES.ABANDON_SESSION });
  }, [state.sessionId]);
  const resetSession = useCallback(() => {
    if (state.sessionId) unpinRoutineDate(state.sessionId);
    dispatch({ type: SESSION_ACTION_TYPES.RESET_SESSION });
  }, [state.sessionId]);

  // Build 10 remediation — resumes a SPECIFIC routine by sessionId,
  // never "whatever is currently live". If that routine is already the
  // live one, this just un-pauses it (RESUME_SESSION); otherwise it
  // restores that routine's own last saved snapshot (routineProgress.js,
  // today only) as the new live state via the reducer's existing,
  // already-validated RESTORE_SESSION action — the exact mechanism that
  // fixes "Evening selected resumes/opens Morning": the caller always
  // names the routine it wants, and this never falls back to reading
  // some other routine's step. No-ops (returns false) if there is
  // nothing valid to resume for that sessionId.
  const resumeRoutine = useCallback((sessionId) => {
    if (state.sessionId === sessionId) {
      if (state.status === SESSION_STATUS.INTERRUPTED) {
        dispatch({ type: SESSION_ACTION_TYPES.RESUME_SESSION });
      }
      return true;
    }
    const snapshot = getRoutineProgress(sessionId);
    if (!snapshot) return false;
    dispatch({
      type: SESSION_ACTION_TYPES.RESTORE_SESSION,
      payload: {
        sessionId,
        stepIndex: snapshot.stepIndex,
        status: SESSION_STATUS.PLAYING,
        startedAt: snapshot.startedAt,
        updatedAt: snapshot.updatedAt,
        interruptionReason: null,
        completionEventId: null
      }
    });
    return true;
  }, [state.sessionId, state.status]);

  // Build 10 remediation — "Start Over"/"Do Again": resets ONLY the named
  // routine's progress, never the other one's, and never anything
  // outside routine step position (journal entries, reflections,
  // intentions, completed-session history/streaks, subscription/
  // entitlement data are all untouched — see routineProgress.js's own
  // doc comment). If that routine happens to be the live one, the live
  // reducer is also reset to canonical idle so its own next Begin starts
  // genuinely fresh; if it's a different (or no) live routine, only its
  // stored snapshot is cleared. Idempotent either way.
  const resetRoutine = useCallback((sessionId) => {
    if (state.sessionId === sessionId) {
      dispatch({ type: SESSION_ACTION_TYPES.RESET_SESSION });
    }
    unpinRoutineDate(sessionId);
    clearRoutineProgress(sessionId);
  }, [state.sessionId]);

  // "Resume Previous Routine" remediation — resumes a routine's own
  // STALE (prior local day) snapshot specifically, never today's. Only
  // ever called for a sessionId that resolveRoutineCardState/
  // shouldOfferStaleRoutineChoice has already determined has no live or
  // today entry (otherwise the ordinary resumeRoutine path above already
  // handles it) — still re-validated here independently rather than
  // trusting the caller. Pins the snapshot's own original dateKey BEFORE
  // dispatching, so the very next persistence-mirror write (this
  // component's own useEffect below) keeps stamping that original date,
  // not today's — this is what keeps the resumed run's identity/date
  // "not falsely recorded as today's routine" for as long as it stays
  // active. No-ops (returns false) if there is genuinely nothing stale
  // and unfinished to resume for this sessionId.
  const resumeStaleRoutine = useCallback((sessionId) => {
    const stale = getRoutineProgressIncludingStale(sessionId);
    const isUnfinished = stale?.status === SESSION_STATUS.PLAYING || stale?.status === SESSION_STATUS.INTERRUPTED;
    if (!stale || !stale.isStale || !isUnfinished) return false;
    pinRoutineDate(sessionId, stale.dateKey);
    dispatch({
      type: SESSION_ACTION_TYPES.RESTORE_SESSION,
      payload: {
        sessionId,
        stepIndex: stale.stepIndex,
        status: SESSION_STATUS.PLAYING,
        startedAt: stale.startedAt,
        updatedAt: stale.updatedAt,
        interruptionReason: null,
        completionEventId: null
      }
    });
    return true;
  }, []);

  // "Start Today's Routine" (discarding an unfinished stale snapshot) —
  // never touches the live reducer, since by construction a routine only
  // ever shows the stale-choice card when it is NOT the currently-live
  // session (see resolveRoutineCardState/shouldOfferStaleRoutineChoice).
  // Idempotent: clearing an already-cleared/unpinned routine is a safe
  // no-op (routineProgress.js's own clearRoutineProgress/unpinRoutineDate).
  const discardStaleRoutine = useCallback((sessionId) => {
    unpinRoutineDate(sessionId);
    clearRoutineProgress(sessionId);
  }, []);

  const value = useMemo(
    () => ({
      state,
      currentSession,
      currentStep,
      currentStepIndex: state.stepIndex,
      totalSteps,
      hasPreviousStep,
      hasNextStep,
      isTerminalStep,
      canSkipCurrentStep,
      progress,
      startSession,
      advanceStep,
      advanceToStep,
      skipStep,
      interruptSession,
      resumeSession,
      completeSession,
      abandonSession,
      resetSession,
      resumeRoutine,
      resetRoutine,
      resumeStaleRoutine,
      discardStaleRoutine,
    }),
    [
      state,
      currentSession,
      currentStep,
      totalSteps,
      hasPreviousStep,
      hasNextStep,
      isTerminalStep,
      canSkipCurrentStep,
      progress,
      startSession,
      advanceStep,
      advanceToStep,
      skipStep,
      interruptSession,
      resumeSession,
      completeSession,
      abandonSession,
      resetSession,
      resumeRoutine,
      resetRoutine,
      resumeStaleRoutine,
      discardStaleRoutine,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

// Throws outside a provider, unlike useAuth/useAlarm/useAudio (which
// return undefined) — a deliberate deviation from this codebase's usual
// convention. Group 2's own integration boundary requires that no
// existing page can accidentally consume this hook; failing loudly and
// immediately makes that mistake obvious instead of producing a
// confusing downstream crash from a silently-undefined context value.
export const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
};

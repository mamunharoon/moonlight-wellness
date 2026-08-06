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

  // Write-through persistence. Fires once per genuine state change.
  // COMPLETE_SESSION's idempotent repeat call returns the exact same
  // state reference from the reducer, so useReducer does not re-render
  // and this effect does not re-fire — no duplicate-write path exists
  // for that case, and every other action only ever produces one state
  // change per dispatch.
  useEffect(() => {
    saveSessionState(state);
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
  const skipStep = useCallback(() => dispatch({ type: SESSION_ACTION_TYPES.SKIP_STEP }), []);
  const interruptSession = useCallback((reason) => {
    dispatch({ type: SESSION_ACTION_TYPES.INTERRUPT_SESSION, payload: { reason } });
  }, []);
  const resumeSession = useCallback(() => dispatch({ type: SESSION_ACTION_TYPES.RESUME_SESSION }), []);
  const completeSession = useCallback(() => dispatch({ type: SESSION_ACTION_TYPES.COMPLETE_SESSION }), []);
  const abandonSession = useCallback(() => dispatch({ type: SESSION_ACTION_TYPES.ABANDON_SESSION }), []);
  const resetSession = useCallback(() => dispatch({ type: SESSION_ACTION_TYPES.RESET_SESSION }), []);

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
      skipStep,
      interruptSession,
      resumeSession,
      completeSession,
      abandonSession,
      resetSession,
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
      skipStep,
      interruptSession,
      resumeSession,
      completeSession,
      abandonSession,
      resetSession,
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

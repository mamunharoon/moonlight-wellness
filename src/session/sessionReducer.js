import { getSessionById } from './sessionRegistry';

/*
 * Stage 3C — Session Engine core, reducer (Ticket Group 2)
 *
 * Pure function only — no React, no localStorage, no Supabase, no
 * navigation, no timers. Every side effect (persistence, restoration
 * source) lives in src/context/SessionContext.jsx, which is the only
 * caller of this reducer. `getSessionById` is the one Group 1 registry
 * accessor this file needs, imported directly (per the Group 2 brief's
 * "pure registry accessors from Group 1" instruction) — nothing here
 * copies or duplicates the step list itself.
 *
 * STATUS ENUM
 *   'idle' | 'playing' | 'interrupted' | 'completed' | 'skipped'
 *
 * VALID TRANSITIONS (anything not listed is an invalid action — see
 * INVALID ACTIONS below)
 *   idle        --START_SESSION-->    playing
 *   completed   --START_SESSION-->    playing   (a new session; see note)
 *   skipped     --START_SESSION-->    playing   (a new session; see note)
 *   playing     --ADVANCE_STEP-->     playing   (only when a next step exists)
 *   playing     --SKIP_STEP-->        playing   (only when currentStep.skippable)
 *   playing     --INTERRUPT_SESSION-->interrupted
 *   interrupted --RESUME_SESSION-->   playing
 *   playing     --COMPLETE_SESSION--> completed (only at the terminal step)
 *   completed   --COMPLETE_SESSION--> completed (idempotent no-op, same state reference)
 *   playing     --ABANDON_SESSION-->  skipped
 *   interrupted --ABANDON_SESSION-->  skipped
 *   (any)       --RESET_SESSION-->    idle       (canonical, unconditional)
 *   (any)       --RESTORE_SESSION-->  <payload>  (see note)
 *
 *   Note on START_SESSION from 'completed'/'skipped': the brief's own
 *   example ("completed → playing must require a new START_SESSION")
 *   confirms this is how a finished/abandoned session gives way to a
 *   new one. START_SESSION is INVALID from 'playing'/'interrupted' — an
 *   already-active session must be explicitly completed, abandoned, or
 *   reset first, so a second START_SESSION can never silently discard
 *   in-progress state.
 *
 *   Note on RESTORE_SESSION: unlike every other action, this does not
 *   transition *from* the reducer's current in-memory state — it
 *   replaces state wholesale with an already-validated payload handed in
 *   by SessionContext.jsx (which validates it via
 *   sessionPersistence.js's own schema/staleness checks before ever
 *   dispatching this action). It exists as an explicit action, not a raw
 *   setState, so every state change in this engine — including
 *   restoration — flows through one auditable reducer. As defense in
 *   depth it re-checks the payload's `status` is a real enum value
 *   before accepting it; anything else falls back to canonical idle.
 *
 * INVALID ACTIONS
 *   Every action has an explicit precondition (see the transition table
 *   above). An action dispatched from the wrong status, or with invalid
 *   arguments (e.g. SKIP_STEP on a non-skippable step, ADVANCE_STEP at
 *   the terminal step), returns the exact same state reference
 *   unchanged — never throws in production; optionally warns via
 *   `console.warn` in development only (see `devWarn`).
 *
 * ADVANCE_STEP AT THE TERMINAL STEP — explicit decision
 *   ADVANCE_STEP never implicitly completes a session. At the terminal
 *   step it is treated as an invalid action, exactly like any other
 *   precondition failure. Completion is always a separate, explicit
 *   COMPLETE_SESSION dispatch — this keeps "advance" meaning exactly one
 *   thing (move to the next step) and keeps completion (which mints a
 *   completionEventId) a single, auditable code path rather than
 *   something that can also happen as a side effect of advancing.
 *
 * ABANDON_SESSION -> 'skipped' — explicit decision
 *   The brief states "skipped is a terminal session state only when the
 *   whole session is skipped or abandoned by an approved action" — read
 *   literally, ABANDON_SESSION is that approved action, so it
 *   transitions to 'skipped' (not 'idle' — that's what RESET_SESSION is
 *   for). sessionId/stepIndex/startedAt are preserved on abandon (a
 *   record of what was abandoned and where); interruptionReason is
 *   cleared (abandonment supersedes any prior interruption reason).
 */

export const SESSION_STATUS = Object.freeze({
  IDLE: 'idle',
  PLAYING: 'playing',
  INTERRUPTED: 'interrupted',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
});

const VALID_STATUSES = Object.values(SESSION_STATUS);

export const SESSION_ACTION_TYPES = Object.freeze({
  START_SESSION: 'START_SESSION',
  ADVANCE_STEP: 'ADVANCE_STEP',
  SKIP_STEP: 'SKIP_STEP',
  INTERRUPT_SESSION: 'INTERRUPT_SESSION',
  RESUME_SESSION: 'RESUME_SESSION',
  COMPLETE_SESSION: 'COMPLETE_SESSION',
  ABANDON_SESSION: 'ABANDON_SESSION',
  RESTORE_SESSION: 'RESTORE_SESSION',
  RESET_SESSION: 'RESET_SESSION',
});

export const CANONICAL_IDLE_STATE = Object.freeze({
  sessionId: null,
  stepIndex: 0,
  status: SESSION_STATUS.IDLE,
  startedAt: null,
  updatedAt: null,
  interruptionReason: null,
  completionEventId: null,
});

export const initialSessionState = CANONICAL_IDLE_STATE;

const devWarn = (message) => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.warn(`[SessionEngine] ${message}`);
  }
};

const now = () => new Date().toISOString();

// crypto.randomUUID() when available; a non-cryptographic but unique
// enough fallback otherwise (older browsers). The only intentionally
// non-deterministic code in this file — acceptable here because it
// exists purely to mint a unique client-side identifier, not to make a
// transition decision.
const generateCompletionEventId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-complete-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const sessionReducer = (state, action) => {
  switch (action.type) {
    case SESSION_ACTION_TYPES.START_SESSION: {
      const { sessionId, startIndex } = action.payload ?? {};

      if (state.status === SESSION_STATUS.PLAYING || state.status === SESSION_STATUS.INTERRUPTED) {
        devWarn(`START_SESSION rejected — a session is already "${state.status}". Complete, abandon, or reset it first.`);
        return state;
      }

      const session = getSessionById(sessionId);
      if (!session) {
        devWarn(`START_SESSION rejected — unknown session id "${sessionId}".`);
        return state;
      }

      const totalSteps = session.steps.length;
      const resolvedStartIndex =
        Number.isInteger(startIndex) && startIndex >= 0 && startIndex < totalSteps ? startIndex : 0;

      const timestamp = now();
      return {
        sessionId: session.id,
        stepIndex: resolvedStartIndex,
        status: SESSION_STATUS.PLAYING,
        startedAt: timestamp,
        updatedAt: timestamp,
        interruptionReason: null,
        completionEventId: null,
      };
    }

    case SESSION_ACTION_TYPES.ADVANCE_STEP: {
      if (state.status !== SESSION_STATUS.PLAYING) {
        devWarn(`ADVANCE_STEP rejected — session status is "${state.status}", not "playing".`);
        return state;
      }
      const session = getSessionById(state.sessionId);
      if (!session) {
        devWarn('ADVANCE_STEP rejected — current sessionId no longer resolves in the registry.');
        return state;
      }
      if (state.stepIndex >= session.steps.length - 1) {
        devWarn('ADVANCE_STEP rejected — already at the terminal step; call COMPLETE_SESSION explicitly.');
        return state;
      }
      return { ...state, stepIndex: state.stepIndex + 1, updatedAt: now() };
    }

    case SESSION_ACTION_TYPES.SKIP_STEP: {
      if (state.status !== SESSION_STATUS.PLAYING) {
        devWarn(`SKIP_STEP rejected — session status is "${state.status}", not "playing".`);
        return state;
      }
      const session = getSessionById(state.sessionId);
      if (!session) {
        devWarn('SKIP_STEP rejected — current sessionId no longer resolves in the registry.');
        return state;
      }
      const currentStep = session.steps[state.stepIndex];
      if (!currentStep?.skippable) {
        devWarn(`SKIP_STEP rejected — step "${currentStep?.id}" is not skippable.`);
        return state;
      }
      if (state.stepIndex >= session.steps.length - 1) {
        devWarn('SKIP_STEP rejected — already at the terminal step; call COMPLETE_SESSION explicitly.');
        return state;
      }
      return { ...state, stepIndex: state.stepIndex + 1, updatedAt: now() };
    }

    case SESSION_ACTION_TYPES.INTERRUPT_SESSION: {
      if (state.status !== SESSION_STATUS.PLAYING) {
        devWarn(`INTERRUPT_SESSION rejected — session status is "${state.status}", not "playing".`);
        return state;
      }
      const reason = action.payload?.reason ?? null;
      return { ...state, status: SESSION_STATUS.INTERRUPTED, interruptionReason: reason, updatedAt: now() };
    }

    case SESSION_ACTION_TYPES.RESUME_SESSION: {
      if (state.status !== SESSION_STATUS.INTERRUPTED) {
        devWarn(`RESUME_SESSION rejected — session status is "${state.status}", not "interrupted".`);
        return state;
      }
      return { ...state, status: SESSION_STATUS.PLAYING, interruptionReason: null, updatedAt: now() };
    }

    case SESSION_ACTION_TYPES.COMPLETE_SESSION: {
      if (state.status === SESSION_STATUS.COMPLETED) {
        // Idempotent — no new event id, no state change at all (same
        // object reference returned), per the completion-idempotency
        // requirement.
        return state;
      }
      if (state.status !== SESSION_STATUS.PLAYING) {
        devWarn(`COMPLETE_SESSION rejected — session status is "${state.status}", not "playing".`);
        return state;
      }
      const session = getSessionById(state.sessionId);
      if (!session) {
        devWarn('COMPLETE_SESSION rejected — current sessionId no longer resolves in the registry.');
        return state;
      }
      if (state.stepIndex !== session.steps.length - 1) {
        devWarn('COMPLETE_SESSION rejected — not at the terminal step.');
        return state;
      }
      return {
        ...state,
        status: SESSION_STATUS.COMPLETED,
        completionEventId: generateCompletionEventId(),
        updatedAt: now(),
      };
    }

    case SESSION_ACTION_TYPES.ABANDON_SESSION: {
      if (state.status !== SESSION_STATUS.PLAYING && state.status !== SESSION_STATUS.INTERRUPTED) {
        devWarn(`ABANDON_SESSION rejected — session status is "${state.status}"; nothing active to abandon.`);
        return state;
      }
      return { ...state, status: SESSION_STATUS.SKIPPED, interruptionReason: null, updatedAt: now() };
    }

    case SESSION_ACTION_TYPES.RESET_SESSION: {
      return { ...CANONICAL_IDLE_STATE, updatedAt: now() };
    }

    case SESSION_ACTION_TYPES.RESTORE_SESSION: {
      const payload = action.payload;
      if (!payload || !VALID_STATUSES.includes(payload.status)) {
        devWarn('RESTORE_SESSION given an invalid payload — falling back to canonical idle.');
        return CANONICAL_IDLE_STATE;
      }
      return payload;
    }

    default:
      devWarn(`Unknown action type "${action.type}" — ignored.`);
      return state;
  }
};

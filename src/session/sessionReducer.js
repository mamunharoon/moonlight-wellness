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
 *   playing     --ADVANCE_TO_STEP-->  playing   (only forward, to an existing step)
 *   playing     --INTERRUPT_SESSION-->interrupted
 *   interrupted --RESUME_SESSION-->   playing
 *   playing     --COMPLETE_SESSION--> completed (only at the terminal step)
 *   completed   --COMPLETE_SESSION--> completed (idempotent no-op, same state reference)
 *   playing     --ABANDON_SESSION-->  skipped
 *   interrupted --ABANDON_SESSION-->  skipped
 *   playing     --RECORD_STEP_ENDED_EARLY--> playing (annotation only; see note)
 *   (any)       --RESET_SESSION-->    idle       (canonical, unconditional)
 *   (any)       --RESTORE_SESSION-->  <payload>  (see note)
 *
 * STEP OUTCOMES (Phase 9 — Truthful Journey Outcomes)
 *   `stepOutcomes` is a `{ [stepId]: 'completed' | 'skipped' | 'ended_early' }`
 *   map, additive to the position-only state this engine already tracked.
 *   A step id absent from the map is simply "not yet resolved" (the caller
 *   derives not_started/in_progress from stepIndex/status as before — this
 *   engine never writes a "not_started"/"in_progress" entry). Written only
 *   by the four actions below; every other action leaves it untouched.
 *     ADVANCE_STEP/ADVANCE_TO_STEP -> marks the step being LEFT 'completed'
 *     SKIP_STEP                    -> marks the step being LEFT 'skipped'
 *     RECORD_STEP_ENDED_EARLY      -> marks the given step 'ended_early',
 *                                     without moving stepIndex or status —
 *                                     the confirmed-abandonment signal for
 *                                     a "Leave Exercise"/"End Meditation"
 *                                     handler that otherwise leaves the
 *                                     user on that same step's own screen
 *     ABANDON_SESSION              -> defensively marks the CURRENT step
 *                                     'ended_early', but only if that step
 *                                     has no outcome yet — never overwrites
 *                                     a genuine prior 'completed'/'skipped'
 *   INTERRUPT_SESSION/RESUME_SESSION deliberately never touch this map —
 *   pausing is not abandoning. START_SESSION/RESET_SESSION reset it to
 *   `{}` (a fresh outcome set for a new or repeated routine). All four
 *   writes are idempotent — setting the same key to the same value twice
 *   is a no-op in effect.
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
 * ADVANCE_TO_STEP — explicit forward-only jump
 *   Added for callers that need to mirror a multi-step legacy transition
 *   (e.g. a quick-routine branch that legally skips an intermediate step)
 *   as a single atomic dispatch rather than several ADVANCE_STEP calls.
 *   Same preconditions as ADVANCE_STEP (status must be 'playing', current
 *   sessionId must resolve) plus its own target checks: the target step id
 *   must exist in the current session, and its index must be strictly
 *   greater than the current stepIndex — same-step, backward, and unknown
 *   targets are all rejected exactly like any other precondition failure
 *   (same state reference returned, optional dev-only warning). This does
 *   not introduce a new persistence shape; the resulting state is the same
 *   shape ADVANCE_STEP produces.
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
  ADVANCE_TO_STEP: 'ADVANCE_TO_STEP',
  SKIP_STEP: 'SKIP_STEP',
  INTERRUPT_SESSION: 'INTERRUPT_SESSION',
  RESUME_SESSION: 'RESUME_SESSION',
  COMPLETE_SESSION: 'COMPLETE_SESSION',
  ABANDON_SESSION: 'ABANDON_SESSION',
  RECORD_STEP_ENDED_EARLY: 'RECORD_STEP_ENDED_EARLY',
  RESTORE_SESSION: 'RESTORE_SESSION',
  RESET_SESSION: 'RESET_SESSION',
});

export const STEP_OUTCOME = Object.freeze({
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  ENDED_EARLY: 'ended_early',
});

const VALID_STEP_OUTCOMES = Object.values(STEP_OUTCOME);

export const CANONICAL_IDLE_STATE = Object.freeze({
  sessionId: null,
  stepIndex: 0,
  status: SESSION_STATUS.IDLE,
  startedAt: null,
  updatedAt: null,
  interruptionReason: null,
  completionEventId: null,
  stepOutcomes: Object.freeze({}),
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
        stepOutcomes: {},
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
      const leavingStep = session.steps[state.stepIndex];
      return {
        ...state,
        stepIndex: state.stepIndex + 1,
        updatedAt: now(),
        stepOutcomes: { ...state.stepOutcomes, [leavingStep.id]: STEP_OUTCOME.COMPLETED },
      };
    }

    case SESSION_ACTION_TYPES.ADVANCE_TO_STEP: {
      if (state.status !== SESSION_STATUS.PLAYING) {
        devWarn(`ADVANCE_TO_STEP rejected — session status is "${state.status}", not "playing".`);
        return state;
      }
      const session = getSessionById(state.sessionId);
      if (!session) {
        devWarn('ADVANCE_TO_STEP rejected — current sessionId no longer resolves in the registry.');
        return state;
      }
      const targetStepId = action.payload?.stepId;
      const targetIndex = session.steps.findIndex((step) => step.id === targetStepId);
      if (targetIndex === -1) {
        devWarn(`ADVANCE_TO_STEP rejected — unknown step id "${targetStepId}" for session "${session.id}".`);
        return state;
      }
      if (targetIndex <= state.stepIndex) {
        devWarn(`ADVANCE_TO_STEP rejected — target step "${targetStepId}" (index ${targetIndex}) is not ahead of the current step (index ${state.stepIndex}).`);
        return state;
      }
      const leavingStep = session.steps[state.stepIndex];
      return {
        ...state,
        stepIndex: targetIndex,
        updatedAt: now(),
        stepOutcomes: { ...state.stepOutcomes, [leavingStep.id]: STEP_OUTCOME.COMPLETED },
      };
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
      return {
        ...state,
        stepIndex: state.stepIndex + 1,
        updatedAt: now(),
        stepOutcomes: { ...state.stepOutcomes, [currentStep.id]: STEP_OUTCOME.SKIPPED },
      };
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
      const session = getSessionById(state.sessionId);
      const currentStep = session?.steps[state.stepIndex];
      // Defensive only — never overwrites a genuine outcome the current
      // step already earned (e.g. an ended-early annotation already
      // recorded, or a step somehow already marked completed/skipped).
      const stepOutcomes =
        currentStep && !state.stepOutcomes[currentStep.id]
          ? { ...state.stepOutcomes, [currentStep.id]: STEP_OUTCOME.ENDED_EARLY }
          : state.stepOutcomes;
      return { ...state, status: SESSION_STATUS.SKIPPED, interruptionReason: null, updatedAt: now(), stepOutcomes };
    }

    case SESSION_ACTION_TYPES.RECORD_STEP_ENDED_EARLY: {
      if (state.status !== SESSION_STATUS.PLAYING) {
        devWarn(`RECORD_STEP_ENDED_EARLY rejected — session status is "${state.status}", not "playing".`);
        return state;
      }
      const stepId = action.payload?.stepId;
      if (!stepId) {
        devWarn('RECORD_STEP_ENDED_EARLY rejected — no stepId given.');
        return state;
      }
      if (state.stepOutcomes[stepId] === STEP_OUTCOME.ENDED_EARLY) {
        // Already recorded — same reference, matching COMPLETE_SESSION's
        // own idempotency precedent.
        return state;
      }
      return {
        ...state,
        updatedAt: now(),
        stepOutcomes: { ...state.stepOutcomes, [stepId]: STEP_OUTCOME.ENDED_EARLY },
      };
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
      const stepOutcomes =
        payload.stepOutcomes && typeof payload.stepOutcomes === 'object'
          ? Object.fromEntries(
              Object.entries(payload.stepOutcomes).filter(([, value]) => VALID_STEP_OUTCOMES.includes(value))
            )
          : {};
      return { ...payload, stepOutcomes };
    }

    default:
      devWarn(`Unknown action type "${action.type}" — ignored.`);
      return state;
  }
};

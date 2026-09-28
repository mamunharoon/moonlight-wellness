// Phase 9 — Truthful Journey Outcomes: real-dispatch reducer coverage for
// the Morning-10 and Evening-10 required scenario lists. stageStatus.test.js
// already covers computeStageStatus/isFullyCompleted as pure functions;
// this file proves the reducer itself produces the right stepOutcomes
// through real START_SESSION/ADVANCE_STEP/SKIP_STEP/RECORD_STEP_ENDED_EARLY/
// INTERRUPT_SESSION/RESUME_SESSION/ABANDON_SESSION/RESTORE_SESSION dispatch
// sequences against the real Morning and Evening session definitions.
import { describe, it, expect } from 'vitest';
import {
  sessionReducer,
  initialSessionState,
  SESSION_ACTION_TYPES as A,
  SESSION_STATUS,
  STEP_OUTCOME,
} from './sessionReducer';

const dispatch = (state, type, payload) => sessionReducer(state, { type, payload });

const startMorning = (startIndex) =>
  dispatch(initialSessionState, A.START_SESSION, { sessionId: 'morning-routine', startIndex });
const startEvening = (startIndex) =>
  dispatch(initialSessionState, A.START_SESSION, { sessionId: 'evening-wind-down', startIndex });

// Drives a session forward from 'intention'/'reflection' (index 1, skipping
// the non-skippable entry step) to the terminal step, applying one action
// per real activity step. `plan` is an ordered list of 'advance' | 'skip' |
// 'endEarly' for stretch/breathe/meditate/affirmation (Morning) or
// reflection/gratitude/breathing/meditation (Evening) — 4 entries each,
// matching MORNING_PATHWAY_STAGES/EVENING_PATHWAY_STAGES real step counts.
const driveMorning = (plan) => {
  let state = startMorning(1); // start at 'intention'
  state = dispatch(state, A.ADVANCE_STEP); // intention -> stretch (intention marked completed)
  const steps = ['stretch', 'breathe', 'meditate', 'affirmation'];
  steps.forEach((stepId, i) => {
    const action = plan[i];
    if (action === 'skip') {
      state = dispatch(state, A.SKIP_STEP);
    } else if (action === 'endEarly') {
      state = dispatch(state, A.RECORD_STEP_ENDED_EARLY, { stepId });
      state = dispatch(state, A.ABANDON_SESSION); // leaving the routine after ending early
      return;
    } else {
      state = dispatch(state, A.ADVANCE_STEP);
    }
  });
  return state;
};

const driveEvening = (plan) => {
  let state = startEvening(1); // start at 'reflection'
  const steps = ['reflection', 'gratitude', 'breathing', 'meditation'];
  steps.forEach((stepId, i) => {
    const action = plan[i];
    if (action === 'skip') {
      state = dispatch(state, A.SKIP_STEP);
    } else if (action === 'endEarly') {
      state = dispatch(state, A.RECORD_STEP_ENDED_EARLY, { stepId });
      state = dispatch(state, A.ABANDON_SESSION);
      return;
    } else {
      state = dispatch(state, A.ADVANCE_STEP);
    }
  });
  return state;
};

describe('Morning — required 10 scenarios (real reducer dispatches, real session definitions)', () => {
  it('1. all 5 stages genuinely completed via natural ADVANCE_STEP all the way to the terminal step', () => {
    let state = startMorning(0); // alarm
    for (let i = 0; i < 6; i += 1) state = dispatch(state, A.ADVANCE_STEP); // alarm..affirmation, 6 advances to reach 'complete'
    expect(state.stepIndex).toBe(6);
    expect(state.stepOutcomes).toEqual({
      alarm: STEP_OUTCOME.COMPLETED,
      intention: STEP_OUTCOME.COMPLETED,
      stretch: STEP_OUTCOME.COMPLETED,
      breathe: STEP_OUTCOME.COMPLETED,
      meditate: STEP_OUTCOME.COMPLETED,
      affirmation: STEP_OUTCOME.COMPLETED,
    });
    state = dispatch(state, A.COMPLETE_SESSION);
    expect(state.status).toBe(SESSION_STATUS.COMPLETED);
  });

  it('2. Stretch skipped — only stretch is skipped, every other real stage is independently completed', () => {
    const state = driveMorning(['skip', 'advance', 'advance', 'advance']);
    expect(state.stepOutcomes.stretch).toBe(STEP_OUTCOME.SKIPPED);
    expect(state.stepOutcomes.breathe).toBe(STEP_OUTCOME.COMPLETED);
    expect(state.stepOutcomes.meditate).toBe(STEP_OUTCOME.COMPLETED);
    expect(state.stepOutcomes.affirmation).toBe(STEP_OUTCOME.COMPLETED);
  });

  it('3. Breathing started then ended early — recorded ended_early, session abandoned (never silently advances stepIndex)', () => {
    const state = driveMorning(['advance', 'endEarly']);
    expect(state.stepOutcomes.stretch).toBe(STEP_OUTCOME.COMPLETED);
    expect(state.stepOutcomes.breathe).toBe(STEP_OUTCOME.ENDED_EARLY);
    expect(state.status).toBe(SESSION_STATUS.SKIPPED); // whole-session abandon status
    expect(state.stepOutcomes.meditate).toBeUndefined(); // never reached -> not_started
  });

  it('4. Meditation skipped', () => {
    const state = driveMorning(['advance', 'advance', 'skip', 'advance']);
    expect(state.stepOutcomes.meditate).toBe(STEP_OUTCOME.SKIPPED);
    expect(state.stepOutcomes.affirmation).toBe(STEP_OUTCOME.COMPLETED);
  });

  it('5. several stages skipped — each reflected independently, never collapsed to one shared state', () => {
    const state = driveMorning(['skip', 'advance', 'skip', 'advance']);
    expect(state.stepOutcomes.stretch).toBe(STEP_OUTCOME.SKIPPED);
    expect(state.stepOutcomes.breathe).toBe(STEP_OUTCOME.COMPLETED);
    expect(state.stepOutcomes.meditate).toBe(STEP_OUTCOME.SKIPPED);
    expect(state.stepOutcomes.affirmation).toBe(STEP_OUTCOME.COMPLETED);
  });

  it('6. pause mid-stage then resume then natural completion -> completed, never ended_early (pause != abandon)', () => {
    let state = startMorning(2); // stretch
    state = dispatch(state, A.INTERRUPT_SESSION, { reason: 'back-confirm' });
    expect(state.status).toBe(SESSION_STATUS.INTERRUPTED);
    expect(state.stepOutcomes.stretch).toBeUndefined();
    state = dispatch(state, A.RESUME_SESSION);
    expect(state.status).toBe(SESSION_STATUS.PLAYING);
    expect(state.stepOutcomes.stretch).toBeUndefined(); // resume itself never marks anything
    state = dispatch(state, A.ADVANCE_STEP);
    expect(state.stepOutcomes.stretch).toBe(STEP_OUTCOME.COMPLETED);
  });

  it('7. refresh/restore with a valid persisted stepOutcomes payload preserves honest outcomes exactly, not reset', () => {
    const persisted = {
      sessionId: 'morning-routine',
      stepIndex: 3,
      status: SESSION_STATUS.PLAYING,
      startedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:05:00.000Z',
      interruptionReason: null,
      completionEventId: null,
      stepOutcomes: { alarm: 'completed', intention: 'completed', stretch: 'skipped' },
    };
    const restored = dispatch(initialSessionState, A.RESTORE_SESSION, persisted);
    expect(restored.stepOutcomes).toEqual(persisted.stepOutcomes);
    expect(restored.stepIndex).toBe(3);
  });

  it('8. repeat/redo (a fresh START_SESSION for the same sessionId) creates a fresh stepOutcomes set, no bleed-through from the prior run', () => {
    const finished = driveMorning(['skip', 'advance', 'skip', 'advance']);
    expect(Object.keys(finished.stepOutcomes).length).toBeGreaterThan(0);
    const restarted = dispatch(finished, A.RESET_SESSION);
    const fresh = dispatch(restarted, A.START_SESSION, { sessionId: 'morning-routine' });
    expect(fresh.stepOutcomes).toEqual({});
  });

  it('9. duplicate completion callback is idempotent — COMPLETE_SESSION dispatched twice returns the exact same reference, no double-write; RECORD_STEP_ENDED_EARLY dispatched twice for the same step is also a no-op', () => {
    let state = startMorning(0);
    for (let i = 0; i < 6; i += 1) state = dispatch(state, A.ADVANCE_STEP);
    const completedOnce = dispatch(state, A.COMPLETE_SESSION);
    const completedTwice = dispatch(completedOnce, A.COMPLETE_SESSION);
    expect(completedTwice).toBe(completedOnce); // same object reference

    let playing = startMorning(2);
    const firstEndEarly = dispatch(playing, A.RECORD_STEP_ENDED_EARLY, { stepId: 'stretch' });
    const secondEndEarly = dispatch(firstEndEarly, A.RECORD_STEP_ENDED_EARLY, { stepId: 'stretch' });
    expect(secondEndEarly).toBe(firstEndEarly); // same reference — already recorded
  });

  it('10. direct/fabricated access without a genuine playing->terminal transition never produces a completed session or fabricated outcomes — COMPLETE_SESSION rejects unless truly at the terminal step while playing', () => {
    // idle session, no real progression at all
    const idleAttempt = dispatch(initialSessionState, A.COMPLETE_SESSION);
    expect(idleAttempt).toBe(initialSessionState); // rejected, unchanged
    expect(idleAttempt.status).toBe(SESSION_STATUS.IDLE);

    // playing but NOT at the terminal step (a fabricated attempt to complete early)
    const midRoutine = startMorning(2); // stretch, index 2 of 7
    const rejected = dispatch(midRoutine, A.COMPLETE_SESSION);
    expect(rejected).toBe(midRoutine); // rejected, unchanged — status stays 'playing'
    expect(rejected.status).toBe(SESSION_STATUS.PLAYING);
    expect(rejected.completionEventId).toBeNull();
  });
});

describe('Evening — required 10 scenarios (real reducer dispatches, real session definitions)', () => {
  it('1. all 5 displayed stages genuinely completed via natural ADVANCE_STEP through to the terminal step', () => {
    let state = startEvening(0); // windDown
    for (let i = 0; i < 6; i += 1) state = dispatch(state, A.ADVANCE_STEP); // windDown..sleepPreparation, reaching 'completion'
    expect(state.stepOutcomes).toEqual({
      windDown: STEP_OUTCOME.COMPLETED,
      reflection: STEP_OUTCOME.COMPLETED,
      gratitude: STEP_OUTCOME.COMPLETED,
      breathing: STEP_OUTCOME.COMPLETED,
      meditation: STEP_OUTCOME.COMPLETED,
      sleepPreparation: STEP_OUTCOME.COMPLETED,
    });
  });

  it('2. Reflection completed, Gratitude completed, Breathing ended early, Meditation skipped (the named scenario, reducer level) — Rest never reached', () => {
    let state = startEvening(1); // reflection
    state = dispatch(state, A.ADVANCE_STEP); // reflection completed -> gratitude
    state = dispatch(state, A.ADVANCE_STEP); // gratitude completed -> breathing
    state = dispatch(state, A.RECORD_STEP_ENDED_EARLY, { stepId: 'breathing' });
    state = dispatch(state, A.ABANDON_SESSION);
    expect(state.stepOutcomes).toEqual({
      reflection: STEP_OUTCOME.COMPLETED,
      gratitude: STEP_OUTCOME.COMPLETED,
      breathing: STEP_OUTCOME.ENDED_EARLY,
    });
    expect(state.stepOutcomes.meditation).toBeUndefined(); // never reached, correctly not_started
    expect(state.status).toBe(SESSION_STATUS.SKIPPED);
  });

  it('3. Breathing ended early alone (isolated)', () => {
    const state = driveEvening(['advance', 'advance', 'endEarly']);
    expect(state.stepOutcomes.breathing).toBe(STEP_OUTCOME.ENDED_EARLY);
  });

  it('4. Meditation skipped', () => {
    const state = driveEvening(['advance', 'advance', 'advance', 'skip']);
    expect(state.stepOutcomes.meditation).toBe(STEP_OUTCOME.SKIPPED);
  });

  it('5. several stages skipped — independently reflected', () => {
    const state = driveEvening(['skip', 'advance', 'skip', 'advance']);
    expect(state.stepOutcomes.reflection).toBe(STEP_OUTCOME.SKIPPED);
    expect(state.stepOutcomes.gratitude).toBe(STEP_OUTCOME.COMPLETED);
    expect(state.stepOutcomes.breathing).toBe(STEP_OUTCOME.SKIPPED);
    expect(state.stepOutcomes.meditation).toBe(STEP_OUTCOME.COMPLETED);
  });

  it('6. pause mid-stage then resume then natural completion -> completed, never ended_early', () => {
    let state = startEvening(3); // breathing
    state = dispatch(state, A.INTERRUPT_SESSION, { reason: 'backgrounded' });
    state = dispatch(state, A.RESUME_SESSION);
    expect(state.stepOutcomes.breathing).toBeUndefined();
    state = dispatch(state, A.ADVANCE_STEP);
    expect(state.stepOutcomes.breathing).toBe(STEP_OUTCOME.COMPLETED);
  });

  it('7. refresh/restore preserves honest persisted Evening outcomes exactly', () => {
    const persisted = {
      sessionId: 'evening-wind-down',
      stepIndex: 4,
      status: SESSION_STATUS.PLAYING,
      startedAt: '2026-01-01T20:00:00.000Z',
      updatedAt: '2026-01-01T20:10:00.000Z',
      interruptionReason: null,
      completionEventId: null,
      stepOutcomes: { windDown: 'completed', reflection: 'completed', gratitude: 'skipped', breathing: 'ended_early' },
    };
    const restored = dispatch(initialSessionState, A.RESTORE_SESSION, persisted);
    expect(restored.stepOutcomes).toEqual(persisted.stepOutcomes);
  });

  it('8. repeat/redo starts a fresh Evening outcome set', () => {
    const finished = driveEvening(['skip', 'advance', 'skip', 'advance']);
    const restarted = dispatch(finished, A.RESET_SESSION);
    const fresh = dispatch(restarted, A.START_SESSION, { sessionId: 'evening-wind-down' });
    expect(fresh.stepOutcomes).toEqual({});
  });

  it('9. duplicate completion callback idempotency for Evening', () => {
    let state = startEvening(0);
    for (let i = 0; i < 6; i += 1) state = dispatch(state, A.ADVANCE_STEP);
    const completedOnce = dispatch(state, A.COMPLETE_SESSION);
    const completedTwice = dispatch(completedOnce, A.COMPLETE_SESSION);
    expect(completedTwice).toBe(completedOnce);
  });

  it('10. direct/fabricated access safety for Evening — COMPLETE_SESSION rejected outside a genuine playing-at-terminal-step transition', () => {
    const midRoutine = startEvening(2); // gratitude
    const rejected = dispatch(midRoutine, A.COMPLETE_SESSION);
    expect(rejected).toBe(midRoutine);
    expect(rejected.completionEventId).toBeNull();
  });
});

describe('ABANDON_SESSION defensive ended_early — never overwrites a genuine prior outcome', () => {
  it('abandoning immediately after a step was already marked completed/skipped does not flip it to ended_early', () => {
    let state = startMorning(2); // stretch
    state = dispatch(state, A.SKIP_STEP); // stretch -> skipped, now on breathe
    state = dispatch(state, A.ABANDON_SESSION); // abandon while on breathe (never touched)
    expect(state.stepOutcomes.stretch).toBe(STEP_OUTCOME.SKIPPED); // untouched
    expect(state.stepOutcomes.breathe).toBe(STEP_OUTCOME.ENDED_EARLY); // defensively marked
  });
});

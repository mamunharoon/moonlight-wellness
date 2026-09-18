import { describe, it, expect } from 'vitest';
import {
  RITUAL_SESSION_IDS,
  resolveRoutineCardState,
  resolveRoutineStepIndex,
  shouldShowCrossRoutineBanner,
  shouldOfferStaleRoutineChoice
} from './routineCardState';

const MORNING = RITUAL_SESSION_IDS.morning;
const EVENING = RITUAL_SESSION_IDS.evening;

describe('resolveRoutineCardState — the critical "Evening selected opens Morning" fix', () => {
  it('not-started: nothing live, no snapshot, not done', () => {
    expect(resolveRoutineCardState({ sessionId: MORNING, liveState: { sessionId: null, status: 'idle' }, snapshot: null, doneToday: false })).toBe('not-started');
  });

  it('in-progress: this routine IS the live, playing session', () => {
    expect(resolveRoutineCardState({ sessionId: MORNING, liveState: { sessionId: MORNING, status: 'playing' }, snapshot: null, doneToday: false })).toBe('in-progress');
  });

  it('in-progress: this routine IS the live, interrupted session', () => {
    expect(resolveRoutineCardState({ sessionId: EVENING, liveState: { sessionId: EVENING, status: 'interrupted' }, snapshot: null, doneToday: false })).toBe('in-progress');
  });

  it('in-progress: NOT the live session, but has its own saved (today) snapshot — the exact scenario the bug lost', () => {
    expect(
      resolveRoutineCardState({
        sessionId: EVENING,
        liveState: { sessionId: MORNING, status: 'playing' }, // Morning is live
        snapshot: { stepIndex: 1, status: 'interrupted' }, // Evening's own paused snapshot
        doneToday: false
      })
    ).toBe('in-progress');
  });

  it('completed takes priority over any live/snapshot state', () => {
    expect(
      resolveRoutineCardState({ sessionId: MORNING, liveState: { sessionId: MORNING, status: 'playing' }, snapshot: null, doneToday: true })
    ).toBe('completed');
  });

  it('the OTHER routine being live never makes this routine look in-progress', () => {
    expect(
      resolveRoutineCardState({
        sessionId: MORNING,
        liveState: { sessionId: EVENING, status: 'playing' },
        snapshot: null,
        doneToday: false
      })
    ).toBe('not-started');
  });

  it('a completed/skipped snapshot (not playing/interrupted) does not count as in-progress', () => {
    expect(
      resolveRoutineCardState({ sessionId: MORNING, liveState: { sessionId: null, status: 'idle' }, snapshot: { stepIndex: 4, status: 'completed' }, doneToday: false })
    ).toBe('not-started');
  });
});

describe('resolveRoutineStepIndex', () => {
  it('prefers the live reducer\'s own stepIndex when this routine is genuinely live', () => {
    expect(resolveRoutineStepIndex({ sessionId: MORNING, liveState: { sessionId: MORNING, stepIndex: 3 }, snapshot: { stepIndex: 1 } })).toBe(3);
  });

  it('falls back to the snapshot\'s stepIndex when this routine is not the live one', () => {
    expect(resolveRoutineStepIndex({ sessionId: EVENING, liveState: { sessionId: MORNING, stepIndex: 3 }, snapshot: { stepIndex: 2 } })).toBe(2);
  });

  it('never reads the OTHER routine\'s step index for this routine', () => {
    const result = resolveRoutineStepIndex({ sessionId: EVENING, liveState: { sessionId: MORNING, stepIndex: 3 }, snapshot: null });
    expect(result).toBe(0);
    expect(result).not.toBe(3);
  });
});

describe('shouldShowCrossRoutineBanner', () => {
  it('shows when the other routine is in-progress and a different one is selected', () => {
    expect(shouldShowCrossRoutineBanner({ selectedSessionId: EVENING, otherSessionId: MORNING, otherCardState: 'in-progress' })).toBe(true);
  });

  it('never shows for the currently-selected routine itself', () => {
    expect(shouldShowCrossRoutineBanner({ selectedSessionId: MORNING, otherSessionId: MORNING, otherCardState: 'in-progress' })).toBe(false);
  });

  it('never shows when the other routine has nothing in progress', () => {
    expect(shouldShowCrossRoutineBanner({ selectedSessionId: EVENING, otherSessionId: MORNING, otherCardState: 'not-started' })).toBe(false);
    expect(shouldShowCrossRoutineBanner({ selectedSessionId: EVENING, otherSessionId: MORNING, otherCardState: 'completed' })).toBe(false);
  });
});

describe('shouldOfferStaleRoutineChoice', () => {
  it('offers the choice only when today has no entry and a stale one exists', () => {
    expect(shouldOfferStaleRoutineChoice({ doneToday: false, todaySnapshot: null, staleSnapshot: { isStale: true } })).toBe(true);
  });

  it('never offers it once today already has its own entry', () => {
    expect(shouldOfferStaleRoutineChoice({ doneToday: false, todaySnapshot: { stepIndex: 0 }, staleSnapshot: { isStale: true } })).toBe(false);
  });

  it('never offers it once already completed today', () => {
    expect(shouldOfferStaleRoutineChoice({ doneToday: true, todaySnapshot: null, staleSnapshot: { isStale: true } })).toBe(false);
  });

  it('never offers it when there is no stale entry at all', () => {
    expect(shouldOfferStaleRoutineChoice({ doneToday: false, todaySnapshot: null, staleSnapshot: null })).toBe(false);
  });
});

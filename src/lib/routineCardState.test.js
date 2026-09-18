import { describe, it, expect } from 'vitest';
import {
  RITUAL_SESSION_IDS,
  resolveRoutineCardState,
  resolveRoutineStepIndex,
  shouldShowCrossRoutineBanner,
  shouldOfferStaleRoutineChoice,
  formatStaleRoutineDate,
  shouldWriteCompletionDate
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
  it('offers the choice only when today has no entry and a genuinely unfinished stale one exists (playing)', () => {
    expect(shouldOfferStaleRoutineChoice({ doneToday: false, todaySnapshot: null, staleSnapshot: { isStale: true, status: 'playing' } })).toBe(true);
  });

  it('offers the choice for a stale interrupted entry too', () => {
    expect(shouldOfferStaleRoutineChoice({ doneToday: false, todaySnapshot: null, staleSnapshot: { isStale: true, status: 'interrupted' } })).toBe(true);
  });

  it('never offers it once today already has its own entry', () => {
    expect(shouldOfferStaleRoutineChoice({ doneToday: false, todaySnapshot: { stepIndex: 0 }, staleSnapshot: { isStale: true, status: 'playing' } })).toBe(false);
  });

  it('never offers it once already completed today', () => {
    expect(shouldOfferStaleRoutineChoice({ doneToday: true, todaySnapshot: null, staleSnapshot: { isStale: true, status: 'playing' } })).toBe(false);
  });

  it('never offers it when there is no stale entry at all', () => {
    expect(shouldOfferStaleRoutineChoice({ doneToday: false, todaySnapshot: null, staleSnapshot: null })).toBe(false);
  });

  it('never offers it when the stale entry already completed - a resolved outcome, not unfinished progress', () => {
    expect(shouldOfferStaleRoutineChoice({ doneToday: false, todaySnapshot: null, staleSnapshot: { isStale: true, status: 'completed' } })).toBe(false);
  });

  it('never offers it when the stale entry was deliberately abandoned (skipped)', () => {
    expect(shouldOfferStaleRoutineChoice({ doneToday: false, todaySnapshot: null, staleSnapshot: { isStale: true, status: 'skipped' } })).toBe(false);
  });
});

describe('formatStaleRoutineDate', () => {
  it('labels the exact same dateKey as today as "Today"', () => {
    expect(formatStaleRoutineDate('2026-09-18', '2026-09-18')).toBe('Today');
  });

  it('labels one calendar day before today as "Yesterday"', () => {
    expect(formatStaleRoutineDate('2026-09-17', '2026-09-18')).toBe('Yesterday');
  });

  it('labels anything older than yesterday with a short formatted date', () => {
    expect(formatStaleRoutineDate('2026-09-10', '2026-09-18')).toBe('Sep 10');
  });

  it('handles a local-midnight/month boundary deterministically (pure calendar-day arithmetic, no real clock)', () => {
    expect(formatStaleRoutineDate('2026-08-31', '2026-09-01')).toBe('Yesterday');
    expect(formatStaleRoutineDate('2025-12-31', '2026-01-01')).toBe('Yesterday');
  });

  it('returns an empty string for missing input rather than throwing', () => {
    expect(formatStaleRoutineDate(null, '2026-09-18')).toBe('');
    expect(formatStaleRoutineDate('2026-09-18', null)).toBe('');
  });
});

describe('shouldWriteCompletionDate', () => {
  it('needs a write when nothing is stored yet', () => {
    expect(shouldWriteCompletionDate(null, '2026-09-18')).toBe(true);
  });

  it('needs a write when today\'s date differs from what is stored', () => {
    expect(shouldWriteCompletionDate('2026-09-17', '2026-09-18')).toBe(true);
  });

  it('is a no-op (no write) when the exact same date is already stored - the same-day-repeat / no-double-credit case', () => {
    expect(shouldWriteCompletionDate('2026-09-18', '2026-09-18')).toBe(false);
  });
});

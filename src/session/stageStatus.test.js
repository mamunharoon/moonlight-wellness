// Phase 9 — Truthful Journey Outcomes: computeStageStatus/isFullyCompleted,
// real execution. Pure functions - no rendering needed.
import { describe, it, expect } from 'vitest';
import { computeStageStatus, isFullyCompleted, STAGE_STATUS } from './stageStatus';
import { SESSION_STATUS } from './sessionReducer';

const MORNING_STAGES = [
  { id: 'focus', label: 'Focus', icon: 'flag', stepIds: ['intention'] },
  { id: 'stretch', label: 'Stretch', icon: 'self_improvement', stepIds: ['stretch'] },
  { id: 'breathe', label: 'Breathe', icon: 'air', stepIds: ['breathe'] },
  { id: 'meditate', label: 'Meditate', icon: 'spa', stepIds: ['meditate'] },
  { id: 'affirm', label: 'Affirm', icon: 'auto_awesome', stepIds: ['affirmation'] }
];

const EVENING_STAGES = [
  { id: 'reflect', label: 'Reflect', icon: 'chat_bubble', stepIds: ['reflection'] },
  { id: 'gratitude', label: 'Gratitude', icon: 'favorite', stepIds: ['gratitude'] },
  { id: 'breathe', label: 'Breathe', icon: 'air', stepIds: ['breathing'] },
  { id: 'meditate', label: 'Meditate', icon: 'spa', stepIds: ['meditation'] },
  { id: 'rest', label: 'Rest', icon: 'bedtime', stepIds: ['sleepPreparation', 'completion'] }
];

describe('computeStageStatus - never infers from position; only stepOutcomes + explicit current step', () => {
  it('no stepOutcomes and no current step: every stage is not_started', () => {
    const stages = computeStageStatus({ stages: MORNING_STAGES, stepOutcomes: {}, currentStepId: null, sessionStatus: null });
    expect(stages.map((s) => s.status)).toEqual(Array(5).fill('not_started'));
  });

  it('missing/undefined stepOutcomes (legacy snapshot) defaults safely to {} - never throws, never manufactures a completion', () => {
    const stages = computeStageStatus({ stages: MORNING_STAGES, stepOutcomes: undefined, currentStepId: null, sessionStatus: null });
    expect(stages.every((s) => s.status === 'not_started')).toBe(true);
  });

  it('a stage with a recorded outcome shows exactly that outcome, regardless of its position relative to other stages', () => {
    const stages = computeStageStatus({
      stages: MORNING_STAGES,
      stepOutcomes: { intention: 'completed', stretch: 'skipped', breathe: 'ended_early' },
      currentStepId: 'meditate',
      sessionStatus: SESSION_STATUS.PLAYING
    });
    expect(stages.map((s) => s.status)).toEqual(['completed', 'skipped', 'ended_early', 'current', 'not_started']);
  });

  it('the active session\'s current step reads "current" only while genuinely playing or interrupted (paused) - never merely because a later stage was reached', () => {
    const playing = computeStageStatus({ stages: MORNING_STAGES, stepOutcomes: {}, currentStepId: 'stretch', sessionStatus: SESSION_STATUS.PLAYING });
    expect(playing[1].status).toBe('current');
    const interrupted = computeStageStatus({ stages: MORNING_STAGES, stepOutcomes: {}, currentStepId: 'stretch', sessionStatus: SESSION_STATUS.INTERRUPTED });
    expect(interrupted[1].status).toBe('current');
  });

  it('a completed/skipped/idle session never shows any stage as current, even if currentStepId is supplied', () => {
    for (const sessionStatus of [SESSION_STATUS.COMPLETED, SESSION_STATUS.SKIPPED, SESSION_STATUS.IDLE, null]) {
      const stages = computeStageStatus({ stages: MORNING_STAGES, stepOutcomes: {}, currentStepId: 'stretch', sessionStatus });
      expect(stages[1].status).toBe('not_started');
    }
  });

  it('a genuine recorded outcome always wins over "current" - resumed-and-then-completed reads as completed, not current, even while the session is still on that step transitioning away', () => {
    const stages = computeStageStatus({
      stages: MORNING_STAGES,
      stepOutcomes: { intention: 'completed' },
      currentStepId: 'intention',
      sessionStatus: SESSION_STATUS.PLAYING
    });
    expect(stages[0].status).toBe('completed');
  });

  it('Evening\'s "rest" stage covers two real step ids (sleepPreparation, completion) - an outcome or current-match on EITHER real id resolves the one display stage', () => {
    const viaPrepare = computeStageStatus({
      stages: EVENING_STAGES,
      stepOutcomes: {},
      currentStepId: 'sleepPreparation',
      sessionStatus: SESSION_STATUS.PLAYING
    });
    expect(viaPrepare[4].status).toBe('current');

    const viaCompletionScreen = computeStageStatus({
      stages: EVENING_STAGES,
      stepOutcomes: {},
      currentStepId: 'completion',
      sessionStatus: SESSION_STATUS.PLAYING
    });
    expect(viaCompletionScreen[4].status).toBe('current');

    const viaOutcome = computeStageStatus({
      stages: EVENING_STAGES,
      stepOutcomes: { sleepPreparation: 'completed' },
      currentStepId: 'completion',
      sessionStatus: SESSION_STATUS.PLAYING
    });
    expect(viaOutcome[4].status).toBe('completed');
  });

  it('an invalid/garbage stepOutcomes value for a stage is ignored, falling back to not_started/current rather than propagating garbage', () => {
    const stages = computeStageStatus({
      stages: MORNING_STAGES,
      stepOutcomes: { intention: 'bogus-value' },
      currentStepId: null,
      sessionStatus: null
    });
    expect(stages[0].status).toBe('not_started');
  });

  it('preserves each stage\'s own label/icon unchanged alongside the computed status', () => {
    const stages = computeStageStatus({ stages: MORNING_STAGES, stepOutcomes: {}, currentStepId: null, sessionStatus: null });
    expect(stages[1]).toEqual({ id: 'stretch', label: 'Stretch', icon: 'self_improvement', status: 'not_started' });
  });
});

describe('isFullyCompleted - true only when every displayed stage is genuinely completed', () => {
  it('all completed -> true', () => {
    const stages = computeStageStatus({
      stages: MORNING_STAGES,
      stepOutcomes: { intention: 'completed', stretch: 'completed', breathe: 'completed', meditate: 'completed', affirmation: 'completed' },
      currentStepId: null,
      sessionStatus: null
    });
    expect(isFullyCompleted(stages)).toBe(true);
  });

  it('one skipped stage among four completed -> false (this is exactly the named Evening test scenario\'s shape: partial completion must never read as full)', () => {
    const stages = computeStageStatus({
      stages: MORNING_STAGES,
      stepOutcomes: { intention: 'completed', stretch: 'skipped', breathe: 'completed', meditate: 'completed', affirmation: 'completed' },
      currentStepId: null,
      sessionStatus: null
    });
    expect(isFullyCompleted(stages)).toBe(false);
  });

  it('one ended_early stage -> false', () => {
    const stages = computeStageStatus({
      stages: MORNING_STAGES,
      stepOutcomes: { intention: 'completed', stretch: 'completed', breathe: 'ended_early', meditate: 'completed', affirmation: 'completed' },
      currentStepId: null,
      sessionStatus: null
    });
    expect(isFullyCompleted(stages)).toBe(false);
  });

  it('a not_started (never-reached) stage -> false, even if every other stage is completed', () => {
    const stages = computeStageStatus({
      stages: MORNING_STAGES,
      stepOutcomes: { intention: 'completed', stretch: 'completed', breathe: 'completed', meditate: 'completed' },
      currentStepId: null,
      sessionStatus: null
    });
    expect(isFullyCompleted(stages)).toBe(false);
  });

  it('a still-current stage -> false, even mid-final-screen-mount - reaching the terminal route is never by itself sufficient', () => {
    const stages = computeStageStatus({
      stages: EVENING_STAGES,
      stepOutcomes: { reflection: 'completed', gratitude: 'completed', breathing: 'completed', meditation: 'completed' },
      currentStepId: 'completion',
      sessionStatus: SESSION_STATUS.PLAYING
    });
    expect(isFullyCompleted(stages)).toBe(false);
  });

  it('empty list -> false (never vacuously "complete")', () => {
    expect(isFullyCompleted([])).toBe(false);
  });

  it('STAGE_STATUS exposes the exact same status vocabulary the reducer\'s STEP_OUTCOME uses, plus current/not_started', () => {
    expect(Object.values(STAGE_STATUS).sort()).toEqual(
      ['completed', 'current', 'ended_early', 'not_started', 'skipped'].sort()
    );
  });
});

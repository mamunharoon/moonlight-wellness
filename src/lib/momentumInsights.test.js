// "Your Momentum" foundation, Phase 3 — genuine behavioural tests for
// momentumInsights.js: pure functions throughout (selectFactualInsight,
// selectMilestone, computeMomentumForCompletion) plus a real localStorage
// mock for the same-device acknowledgement guard (this repo's Vitest runs
// in a plain Node environment with no real localStorage - see
// musicPreference.test.js's own established note on this exact point).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  selectFactualInsight,
  MOMENTUM_MILESTONES,
  selectMilestone,
  hasAcknowledgedMilestone,
  acknowledgeMilestone,
  computeMomentumForCompletion
} from './momentumInsights';

const localStorageStore = new Map();
const localStorageMock = {
  getItem: (key) => (localStorageStore.has(key) ? localStorageStore.get(key) : null),
  setItem: (key, value) => localStorageStore.set(key, String(value)),
  removeItem: (key) => localStorageStore.delete(key),
  clear: () => localStorageStore.clear()
};
globalThis.localStorage = localStorageMock;

beforeEach(() => {
  localStorageStore.clear();
});

const totalsWith = (overrides) => ({
  totalPractices: 0,
  morningTotal: 0,
  eveningTotal: 0,
  meditationCount: 0,
  meditationMinutes: 0,
  activeDateCount: 0,
  ...overrides
});

describe('selectFactualInsight — Morning', () => {
  it('a single completion reads "Morning Reset complete for today." - never claims a count', () => {
    expect(selectFactualInsight({ journey: 'morning', practiceType: 'full_routine', totals: totalsWith({ morningTotal: 1 }) }))
      .toBe('Morning Reset complete for today.');
  });

  it('two or more completions read the exact count', () => {
    expect(selectFactualInsight({ journey: 'morning', practiceType: 'full_routine', totals: totalsWith({ morningTotal: 3 }) }))
      .toBe('3 Morning Resets completed.');
  });

  it('never mentions minutes - Morning routine duration is intentionally NULL', () => {
    const insight = selectFactualInsight({ journey: 'morning', practiceType: 'full_routine', totals: totalsWith({ morningTotal: 5 }) });
    expect(insight).not.toMatch(/minute/i);
  });
});

describe('selectFactualInsight — Evening', () => {
  it('a single completion reads "Tonight\'s Wind-Down is complete."', () => {
    expect(selectFactualInsight({ journey: 'evening', practiceType: 'full_routine', totals: totalsWith({ eveningTotal: 1 }) }))
      .toBe("Tonight's Wind-Down is complete.");
  });

  it('two or more completions read the exact count', () => {
    expect(selectFactualInsight({ journey: 'evening', practiceType: 'full_routine', totals: totalsWith({ eveningTotal: 4 }) }))
      .toBe('4 Evening Wind-Downs completed.');
  });

  it('never mentions minutes - Evening routine duration is intentionally NULL', () => {
    const insight = selectFactualInsight({ journey: 'evening', practiceType: 'full_routine', totals: totalsWith({ eveningTotal: 5 }) });
    expect(insight).not.toMatch(/minute/i);
  });
});

describe('selectFactualInsight — guided-video meditation', () => {
  it('uses genuine minutes when a positive duration total exists', () => {
    expect(selectFactualInsight({ journey: 'direct', practiceType: 'meditation', totals: totalsWith({ meditationCount: 2, meditationMinutes: 15 }) }))
      .toBe('15 guided meditation minutes completed.');
  });

  it('singular minute wording for exactly 1', () => {
    expect(selectFactualInsight({ journey: 'direct', practiceType: 'meditation', totals: totalsWith({ meditationCount: 1, meditationMinutes: 1 }) }))
      .toBe('1 guided meditation minute completed.');
  });

  it('falls back to a count-based line when no genuine duration exists (meditationMinutes is 0)', () => {
    expect(selectFactualInsight({ journey: 'direct', practiceType: 'meditation', totals: totalsWith({ meditationCount: 3, meditationMinutes: 0 }) }))
      .toBe('3 guided meditations completed.');
  });

  it('never describes meditation minutes as total WakeWise mindful time - the wording always scopes to guided meditation specifically', () => {
    const insight = selectFactualInsight({ journey: 'direct', practiceType: 'meditation', totals: totalsWith({ meditationMinutes: 20 }) });
    expect(insight).toMatch(/guided meditation/i);
    expect(insight).not.toMatch(/mindful time|wakewise time|total time/i);
  });
});

describe('selectFactualInsight — untracked activity never fabricates a count', () => {
  it('returns null for any journey/practiceType combination Phase 2 does not track', () => {
    expect(selectFactualInsight({ journey: 'anytime', practiceType: 'breathing', totals: totalsWith({}) })).toBeNull();
    expect(selectFactualInsight({ journey: 'morning', practiceType: 'stretching', totals: totalsWith({}) })).toBeNull();
  });

  it('returns null when totals is missing entirely', () => {
    expect(selectFactualInsight({ journey: 'morning', practiceType: 'full_routine', totals: null })).toBeNull();
  });
});

describe('No historical/first-ever claims anywhere in the milestone or insight copy', () => {
  it('no milestone label or supporting line ever claims "first" or lifetime history before Phase 2', () => {
    for (const milestone of MOMENTUM_MILESTONES) {
      expect(milestone.label.toLowerCase()).not.toMatch(/first ever|first time|since you started|all time/);
      expect((milestone.supportingLine ?? '').toLowerCase()).not.toMatch(/first ever|first time|since you started|all time/);
    }
  });
});

describe('Milestone crossing — threshold minus one / exact / plus one (count-based metric)', () => {
  const rowsWithMorningCount = (n, currentId) => {
    const rows = [];
    for (let i = 0; i < n; i++) {
      rows.push({ session_id: i === n - 1 ? currentId : `old-${i}`, journey: 'morning', practice_type: 'full_routine', duration_seconds: null, local_date: `2026-09-${20 + i}` });
    }
    return rows;
  };

  it('threshold minus one: 2 total Morning completions (this one included) does not earn the 3-completion milestone', () => {
    const rows = rowsWithMorningCount(2, 'current');
    const milestone = selectMilestone({ rows, currentSessionId: 'current', journey: 'morning', practiceType: 'full_routine' });
    expect(milestone?.id).not.toBe('morning-practices-3');
  });

  it('exact threshold: the 3rd Morning completion earns the milestone', () => {
    const rows = rowsWithMorningCount(3, 'current');
    const milestone = selectMilestone({ rows, currentSessionId: 'current', journey: 'morning', practiceType: 'full_routine' });
    expect(milestone?.id).toBe('morning-practices-3');
  });

  it('threshold plus one: the 4th Morning completion does not newly earn the 3-completion milestone again', () => {
    const rows = rowsWithMorningCount(4, 'current');
    const milestone = selectMilestone({ rows, currentSessionId: 'current', journey: 'morning', practiceType: 'full_routine' });
    expect(milestone?.id).not.toBe('morning-practices-3');
  });
});

describe('Milestone crossing — current event genuinely identified by session_id, never by "latest timestamp"', () => {
  it('excludes the row matching currentSessionId when computing the "before" total - the row order in the array does not matter', () => {
    // Deliberately out of chronological order and the "current" row is
    // NOT last in the array - proves the current event is identified by
    // its own session_id, never by array position or a timestamp guess.
    const rows = [
      { session_id: 'current', journey: 'morning', practice_type: 'full_routine', local_date: '2026-09-28' },
      { session_id: 'older-1', journey: 'morning', practice_type: 'full_routine', local_date: '2026-09-26' },
      { session_id: 'older-2', journey: 'morning', practice_type: 'full_routine', local_date: '2026-09-27' }
    ];
    const milestone = selectMilestone({ rows, currentSessionId: 'current', journey: 'morning', practiceType: 'full_routine' });
    expect(milestone?.id).toBe('morning-practices-3');
  });
});

describe('Milestone crossing — verified meditation-minute threshold can jump past the exact value in one completion', () => {
  it('a single long session pushing total minutes from 7 straight to 19 still correctly registers the 10-minute milestone', () => {
    const rows = [
      { session_id: 'old', practice_type: 'meditation', duration_seconds: 420 }, // 7 min
      { session_id: 'current', practice_type: 'meditation', duration_seconds: 720 } // +12 min = 19 total
    ];
    const milestone = selectMilestone({ rows, currentSessionId: 'current', journey: 'direct', practiceType: 'meditation' });
    expect(milestone?.id).toBe('meditation-minutes-10');
  });

  it('does not re-trigger on a later completion once already past the threshold', () => {
    const rows = [
      { session_id: 'old', practice_type: 'meditation', duration_seconds: 720 }, // 12 min - already past 10
      { session_id: 'current', practice_type: 'meditation', duration_seconds: 60 } // +1 min = 13 total
    ];
    const milestone = selectMilestone({ rows, currentSessionId: 'current', journey: 'direct', practiceType: 'meditation' });
    expect(milestone?.id).not.toBe('meditation-minutes-10');
  });
});

describe('Milestone crossing — active local dates uses distinct stored local_date, never a UTC recomputation', () => {
  it('the completion that pushes distinct active dates from 2 to 3 earns the milestone (morningTotal here is only 1, so no journey-specific milestone competes for priority)', () => {
    const rows = [
      { session_id: 'old-1', journey: 'evening', practice_type: 'full_routine', local_date: '2026-09-26' },
      { session_id: 'old-2', journey: 'evening', practice_type: 'full_routine', local_date: '2026-09-27' },
      { session_id: 'current', journey: 'morning', practice_type: 'full_routine', local_date: '2026-09-28' }
    ];
    const milestone = selectMilestone({ rows, currentSessionId: 'current', journey: 'morning', practiceType: 'full_routine' });
    expect(milestone?.id).toBe('active-dates-3');
  });

  it('a second completion on an already-counted local date does not re-earn the active-dates milestone', () => {
    const rows = [
      { session_id: 'old-1', journey: 'evening', practice_type: 'full_routine', local_date: '2026-09-26' },
      { session_id: 'old-2', journey: 'evening', practice_type: 'full_routine', local_date: '2026-09-27' },
      { session_id: 'old-3', journey: 'morning', practice_type: 'full_routine', local_date: '2026-09-28' },
      { session_id: 'current', journey: 'evening', practice_type: 'full_routine', local_date: '2026-09-28' }
    ];
    const milestone = selectMilestone({ rows, currentSessionId: 'current', journey: 'anytime', practiceType: 'meditation' });
    expect(milestone?.id).not.toBe('active-dates-3');
  });
});

describe('Milestone crossing — only one milestone shown when several qualify, by documented priority', () => {
  it('a completion that is simultaneously the 3rd Morning AND the 3rd total practice shows the journey-specific milestone, not the generic total', () => {
    const rows = [
      { session_id: 'old-1', journey: 'morning', practice_type: 'full_routine', local_date: '2026-09-26' },
      { session_id: 'old-2', journey: 'morning', practice_type: 'full_routine', local_date: '2026-09-27' },
      { session_id: 'current', journey: 'morning', practice_type: 'full_routine', local_date: '2026-09-28' }
    ];
    const milestone = selectMilestone({ rows, currentSessionId: 'current', journey: 'morning', practiceType: 'full_routine' });
    expect(milestone?.id).toBe('morning-practices-3');
    expect(milestone?.id).not.toBe('total-practices-3');
  });

  it('a completion that is simultaneously the 3rd active date AND the 3rd total practice shows the active-dates milestone, not the generic total (priority 2 over priority 3)', () => {
    const rows = [
      { session_id: 'old-1', journey: 'morning', practice_type: 'full_routine', local_date: '2026-09-26' },
      { session_id: 'old-2', journey: 'evening', practice_type: 'full_routine', local_date: '2026-09-27' },
      { session_id: 'current', journey: 'evening', practice_type: 'full_routine', local_date: '2026-09-28' }
    ];
    const milestone = selectMilestone({ rows, currentSessionId: 'current', journey: 'evening', practiceType: 'full_routine' });
    expect(milestone?.id).toBe('active-dates-3');
    expect(milestone?.id).not.toBe('total-practices-3');
  });

  it('a meditation completion with no active-dates or meditation-minute crossing still earns the generic total-practices milestone', () => {
    // Two of the three rows deliberately share the same local_date, so
    // activeDateCount stays at 2 (never crosses 3) and meditationMinutes
    // stays at 1 (never crosses 10) - isolating this test to prove only
    // the generic total-practices-3 crossing, with nothing else competing
    // for priority.
    const rows = [
      { session_id: 'old-1', journey: 'morning', practice_type: 'full_routine', local_date: '2026-09-28' },
      { session_id: 'old-2', journey: 'evening', practice_type: 'full_routine', local_date: '2026-09-27' },
      { session_id: 'current', journey: 'direct', practice_type: 'meditation', local_date: '2026-09-28', duration_seconds: 60 }
    ];
    const milestone = selectMilestone({ rows, currentSessionId: 'current', journey: 'direct', practiceType: 'meditation' });
    expect(milestone?.id).toBe('total-practices-3');
  });
});

describe('Same-device milestone acknowledgement guard', () => {
  it('a milestone is not yet acknowledged before it is ever recorded', () => {
    expect(hasAcknowledgedMilestone('user-1', 'morning-practices-3')).toBe(false);
  });

  it('acknowledging a milestone makes hasAcknowledgedMilestone return true for that exact id', () => {
    acknowledgeMilestone('user-1', 'morning-practices-3');
    expect(hasAcknowledgedMilestone('user-1', 'morning-practices-3')).toBe(true);
  });

  it('acknowledging one milestone id never marks a different id as acknowledged', () => {
    acknowledgeMilestone('user-1', 'morning-practices-3');
    expect(hasAcknowledgedMilestone('user-1', 'morning-practices-7')).toBe(false);
  });

  it('cross-user isolation: user A acknowledging a milestone never marks it acknowledged for user B', () => {
    acknowledgeMilestone('user-a', 'morning-practices-3');
    expect(hasAcknowledgedMilestone('user-b', 'morning-practices-3')).toBe(false);
  });

  it('computeMomentumForCompletion suppresses an already-acknowledged milestone (duplicate callback / revisit never retriggers it)', () => {
    const rows = [
      { session_id: 'old-1', journey: 'morning', practice_type: 'full_routine', local_date: '2026-09-26' },
      { session_id: 'old-2', journey: 'morning', practice_type: 'full_routine', local_date: '2026-09-27' },
      { session_id: 'current', journey: 'morning', practice_type: 'full_routine', local_date: '2026-09-28' }
    ];
    const first = computeMomentumForCompletion({ rows, currentSessionId: 'current', userId: 'user-1', journey: 'morning', practiceType: 'full_routine' });
    expect(first.milestone?.id).toBe('morning-practices-3');

    // Simulate the caller having already acknowledged it (as
    // useMomentumCompletion.js does immediately after a genuine display).
    acknowledgeMilestone('user-1', 'morning-practices-3');

    const second = computeMomentumForCompletion({ rows, currentSessionId: 'current', userId: 'user-1', journey: 'morning', practiceType: 'full_routine' });
    expect(second.milestone).toBeNull();
    // The factual insight itself is unaffected by acknowledgement - it is
    // not a one-time celebration, it is always the current honest count.
    expect(second.insight).toBe(first.insight);
  });
});

describe('computeMomentumForCompletion — rerender stability', () => {
  it('calling it twice with identical inputs returns the identical insight and milestone id', () => {
    const rows = [
      { session_id: 'current', journey: 'evening', practice_type: 'full_routine', local_date: '2026-09-28' }
    ];
    const a = computeMomentumForCompletion({ rows, currentSessionId: 'current', userId: 'user-1', journey: 'evening', practiceType: 'full_routine' });
    const b = computeMomentumForCompletion({ rows, currentSessionId: 'current', userId: 'user-1', journey: 'evening', practiceType: 'full_routine' });
    expect(a.insight).toBe(b.insight);
    expect(a.milestone?.id).toBe(b.milestone?.id);
  });
});

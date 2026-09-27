// WakeWise DEV — cross-cutting integration check for the whole "add
// positive, rotating completion experiences to Morning Stretch, Morning
// Meditation and 100% Morning routine completion" pass. Per-file/per-pool
// mechanics (rotation, non-repeat, storage-unavailable safety, pool
// isolation) are already exhaustively covered in outcomeMessages.test.js's
// own getCompletionGreeting describe block, and per-page completion-panel
// wiring/Back-behaviour is covered in stretchCompletionLifecycle.test.js/
// meditationCompletionLifecycle.test.js/morningRoutineCompletionUplift.
// test.js/breathingCompletionLifecycle.test.js. This file only checks the
// one thing none of those, individually, can: that all four Morning
// completion pools are genuinely distinct from one another and that each
// of the four completion surfaces (Breathing/Stretch/Meditation/routine)
// really does request its own, correct practice - never sharing or
// swapping one another's pool.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const outcomeMessagesSource = read('../lib/outcomeMessages.js');
const morningFlowSource = read('./MorningFlow.jsx');
const morningMeditateSource = read('./MorningMeditate.jsx');
const sessionCompleteSource = read('./SessionComplete.jsx');
const breatheSource = read('./Breathe.jsx');

const extractPool = (practice) => {
  const block = outcomeMessagesSource.match(new RegExp(`${practice}: \\[([\\s\\S]*?)\\]`))?.[1] ?? '';
  return block.match(/'[^']+'/g) ?? [];
};

describe('outcomeMessages.js — the four Morning completion pools are genuinely distinct, exactly 5 messages each', () => {
  const pools = {
    breathing: extractPool('breathing'),
    stretching: extractPool('stretching'),
    meditation: extractPool('meditation'),
    routine: extractPool('routine')
  };

  it('each pool has exactly 5 approved messages', () => {
    for (const [practice, pool] of Object.entries(pools)) {
      expect(pool.length, `${practice} pool should have 5 messages`).toBe(5);
    }
  });

  it('no message is shared between any two of the four pools - each practice gets its own honest, distinct copy', () => {
    const entries = Object.entries(pools);
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const [nameA, poolA] = entries[i];
        const [nameB, poolB] = entries[j];
        const overlap = poolA.filter((m) => poolB.includes(m));
        expect(overlap, `${nameA} and ${nameB} should never share a message`).toEqual([]);
      }
    }
  });
});

describe('Each of the four Morning completion surfaces requests its own, correct practice - never another\'s pool', () => {
  it('Breathe.jsx (via the getBreathingCompletionGreeting wrapper) resolves to practice: \'breathing\' - unchanged, approved, physical-iPhone-tested', () => {
    expect(breatheSource).toMatch(/getBreathingCompletionGreeting\('morning'\)/);
    expect(outcomeMessagesSource).toMatch(/export const getBreathingCompletionGreeting = \(journey\) =>\s*\n\s*getCompletionGreeting\(\{ journey: COMPLETION_GREETINGS\[journey\] \? journey : 'anytime', practice: 'breathing' \}\);/);
  });

  it('MorningFlow.jsx (Stretch) requests practice: \'stretching\' - never \'breathing\'/\'meditation\'/\'routine\'', () => {
    const calls = morningFlowSource.match(/getCompletionGreeting\(\{ journey: 'morning', practice: '(\w+)' \}\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toContain("practice: 'stretching'");
    }
  });

  it('MorningMeditate.jsx requests practice: \'meditation\' - never \'breathing\'/\'stretching\'/\'routine\'', () => {
    const calls = morningMeditateSource.match(/getCompletionGreeting\(\{ journey: 'morning', practice: '(\w+)' \}\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toContain("practice: 'meditation'");
    }
  });

  it('SessionComplete.jsx (full routine) requests practice: \'routine\' - never \'breathing\'/\'stretching\'/\'meditation\'', () => {
    const calls = sessionCompleteSource.match(/getCompletionGreeting\(\{ journey: 'morning', practice: '(\w+)' \}\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toContain("practice: 'routine'");
    }
  });
});

describe('Anytime/Evening have no Stretch step and no dedicated whole-routine-completion screen of their own (Evening Breathing/Meditation, then Anytime Breathing/Meditation completion corrections - see eveningCompletionCrossCutting.test.js/quietBreathingAnytimeCompletionLifecycle.test.js for their own full coverage)', () => {
  // Rotating 100% Evening completion messages correction — Evening now
  // ALSO has a 'routine' pool (its own whole-routine-completion screen,
  // EveningComplete.jsx, migrated onto this shared architecture); Anytime
  // still has no Stretch step and no dedicated whole-routine-completion
  // screen of its own, so it correctly still has neither.
  it('COMPLETION_GREETINGS: anytime has breathing AND meditation pools, no stretching/routine pool; evening has breathing, meditation AND routine pools, no stretching pool', () => {
    const completionGreetingsBlock = outcomeMessagesSource.match(/const COMPLETION_GREETINGS = \{([\s\S]*?)\n\};/)?.[1] ?? '';
    expect(completionGreetingsBlock).not.toBe('');
    const anytimeBlock = completionGreetingsBlock.match(/anytime: \{([\s\S]*?)\n {2}\},/)?.[1] ?? '';
    const eveningBlock = completionGreetingsBlock.match(/evening: \{([\s\S]*?)\n {2}\}\s*$/)?.[1] ?? '';
    expect(anytimeBlock).toMatch(/breathing:/);
    expect(anytimeBlock).toMatch(/meditation:/);
    expect(anytimeBlock).not.toMatch(/stretching:|routine:/);
    expect(eveningBlock).toMatch(/breathing:/);
    expect(eveningBlock).toMatch(/meditation:/);
    expect(eveningBlock).toMatch(/routine:/);
    expect(eveningBlock).not.toMatch(/stretching:/);
  });
});

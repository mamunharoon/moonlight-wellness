// WakeWise DEV — cross-cutting integration check for "add positive,
// rotating completion experiences to Evening Breathing and Evening
// Meditation." Per-file/per-pool mechanics (rotation, non-repeat,
// storage-unavailable safety, pool isolation) are already exhaustively
// covered in outcomeMessages.test.js's own Evening describe block, and
// per-page completion-panel wiring/Back-behaviour is covered in
// eveningBreathingCompletionLifecycle.test.js/
// eveningMeditationCompletionLifecycle.test.js. This file only checks the
// one thing none of those, individually, can: that Evening's two
// completion pools are genuinely distinct from Morning's four (and from
// each other), that each Evening completion surface really does request
// its own, correct practice, and that Evening's own periwinkle visual
// tokens never leak Morning gold or Anytime mint.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const outcomeMessagesSource = read('../lib/outcomeMessages.js');
const eveningBreathingSource = read('./EveningBreathing.jsx');
const eveningMeditateSource = read('./EveningMeditate.jsx');

const extractPool = (journeyBlock, practice) => {
  const block = journeyBlock.match(new RegExp(`${practice}: \\[([\\s\\S]*?)\\]`))?.[1] ?? '';
  return block.match(/'[^']+'/g) ?? [];
};

describe('outcomeMessages.js — Evening\'s two completion pools are genuinely distinct from each other and from every Morning pool', () => {
  const completionGreetingsBlock = outcomeMessagesSource.match(/const COMPLETION_GREETINGS = \{([\s\S]*?)\n\};/)?.[1] ?? '';
  const morningBlock = completionGreetingsBlock.match(/morning: \{([\s\S]*?)\n {2}\},/)?.[1] ?? '';
  const eveningBlock = completionGreetingsBlock.match(/evening: \{([\s\S]*?)\n {2}\}\s*$/)?.[1] ?? '';

  const eveningPools = {
    breathing: extractPool(eveningBlock, 'breathing'),
    meditation: extractPool(eveningBlock, 'meditation')
  };
  const morningPools = {
    breathing: extractPool(morningBlock, 'breathing'),
    stretching: extractPool(morningBlock, 'stretching'),
    meditation: extractPool(morningBlock, 'meditation'),
    routine: extractPool(morningBlock, 'routine')
  };

  it('each Evening pool has exactly 5 approved messages', () => {
    for (const [practice, pool] of Object.entries(eveningPools)) {
      expect(pool.length, `evening.${practice} should have 5 messages`).toBe(5);
    }
  });

  it('no message is shared between evening.breathing and evening.meditation', () => {
    const overlap = eveningPools.breathing.filter((m) => eveningPools.meditation.includes(m));
    expect(overlap).toEqual([]);
  });

  it('no Evening message is shared with any Morning pool', () => {
    const allMorningMessages = Object.values(morningPools).flat();
    for (const [practice, pool] of Object.entries(eveningPools)) {
      const overlap = pool.filter((m) => allMorningMessages.includes(m));
      expect(overlap, `evening.${practice} should never share a message with any Morning pool`).toEqual([]);
    }
  });

  it('Evening still has no stretching/routine pool of its own - out of scope for this pass (no Stretch step, no dedicated 100%-completion screen wired to this architecture yet)', () => {
    expect(eveningBlock).not.toMatch(/stretching:|routine:/);
  });
});

describe('Each of the two Evening completion surfaces requests its own, correct practice - never the other\'s, never Morning\'s', () => {
  it('EveningBreathing.jsx requests practice: \'breathing\' - never \'meditation\'', () => {
    const calls = eveningBreathingSource.match(/getCompletionGreeting\(\{ journey: 'evening', practice: '(\w+)' \}\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toContain("practice: 'breathing'");
    }
  });

  it('EveningMeditate.jsx requests practice: \'meditation\' - never \'breathing\'', () => {
    const calls = eveningMeditateSource.match(/getCompletionGreeting\(\{ journey: 'evening', practice: '(\w+)' \}\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call).toContain("practice: 'meditation'");
    }
  });
});

describe('Evening\'s own periwinkle visual tokens never leak Morning gold or Anytime mint', () => {
  it('EveningBreathing.jsx\'s and EveningMeditate.jsx\'s completed panels use only evening-accent tokens - never morning-accent/anytime-accent', () => {
    for (const source of [eveningBreathingSource, eveningMeditateSource]) {
      const completedPanel = source.match(/(?:\) : isCompleted \? \(|if \(isCompleted\) \{)([\s\S]*?)(?:\n\s*\) : \(|\n {2}\}\s*\n\s*\n {2}if \(session\.phase)/)?.[1] ?? '';
      expect(completedPanel).not.toBe('');
      expect(completedPanel).toMatch(/evening-accent/);
      expect(completedPanel).not.toMatch(/morning-accent|anytime-accent/);
    }
  });
});

describe('Morning breathing/Stretch/Meditation/routine-completion regression tests were not broken by this Evening pass (spot-check - the full suite is the authoritative check)', () => {
  it('Breathe.jsx (Morning) is untouched by this Evening pass - it still keys off its own isCompleted state, unaffected by EveningBreathing.jsx\'s identical-but-separate upgrade', () => {
    const breatheSource = read('./Breathe.jsx');
    expect(breatheSource).toMatch(/getBreathingCompletionGreeting\('morning'\)/);
    expect(breatheSource).not.toMatch(/getCompletionGreeting\(\{ journey: 'evening'/);
  });

  it('MorningMeditate.jsx/MorningFlow.jsx/SessionComplete.jsx are untouched by this Evening pass - none of them reference an evening practice', () => {
    for (const path of ['./MorningMeditate.jsx', './MorningFlow.jsx', './SessionComplete.jsx']) {
      const source = read(path);
      expect(source).not.toMatch(/journey: 'evening'/);
    }
  });
});

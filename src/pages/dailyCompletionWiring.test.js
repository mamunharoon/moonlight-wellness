// User-scoped daily completion — wiring guard for the three files that
// read/write MORNING_DONE_KEY/EVENING_DONE_KEY. Source-level checks,
// matching this codebase's established pattern (see
// Home.routineState.test.js's own note); the pure scoping logic itself is
// unit-tested directly in dailyCompletion.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const homeSource = read('./Home.jsx');
const sessionCompleteSource = read('./SessionComplete.jsx');
const eveningCompleteSource = read('./EveningComplete.jsx');
const meditationCompleteSource = read('./MeditationComplete.jsx');

describe('Home.jsx reads the CURRENT identity\'s own completion key, never a bare unscoped one', () => {
  it('imports the scoped key getters and no longer defines its own unscoped constants', () => {
    expect(homeSource).toMatch(
      /import \{ getMorningCompletionKey, getEveningCompletionKey, getMeditationCompletionKey \} from '\.\.\/lib\/dailyCompletion';/
    );
    expect(homeSource).not.toMatch(/const MORNING_DONE_KEY = 'moonlight_morning_completed_date';/);
    expect(homeSource).not.toMatch(/const EVENING_DONE_KEY = 'moonlight_evening_completed_date';/);
    expect(homeSource).not.toMatch(/const MEDITATION_DONE_KEY = 'moonlight_meditation_completed_date';/);
  });

  it('derives isMorningDone/isEveningDone/isMeditatedToday from the scoped key, keyed off the destructured userId', () => {
    expect(homeSource).toMatch(/const \{ alarmTime, bedTime, intentions, setIntentions, effectiveTimezone, userId \} = useAlarm\(\);/);
    expect(homeSource).toMatch(/localStorage\.getItem\(getMorningCompletionKey\(userId\)\) === today/);
    expect(homeSource).toMatch(/localStorage\.getItem\(getEveningCompletionKey\(userId\)\) === today/);
    expect(homeSource).toMatch(/localStorage\.getItem\(getMeditationCompletionKey\(userId\)\) === today/);
  });
});

describe('MeditationComplete.jsx writes Meditation completion to the CURRENT identity\'s own scoped key', () => {
  it('imports getMeditationCompletionKey and destructures userId from useAlarm()', () => {
    expect(meditationCompleteSource).toMatch(/import \{ getMeditationCompletionKey \} from '\.\.\/lib\/dailyCompletion';/);
    expect(meditationCompleteSource).toMatch(/const \{ effectiveTimezone, userId \} = useAlarm\(\);/);
    expect(meditationCompleteSource).not.toMatch(/const MEDITATION_DONE_KEY = 'moonlight_meditation_completed_date';/);
  });

  it('both Return to Today and Choose another meditation write to the scoped key', () => {
    const occurrences = meditationCompleteSource.match(/localStorage\.setItem\(getMeditationCompletionKey\(userId\), getZonedParts\(effectiveTimezone, devNow\(\)\)\.dateKey\);/g) ?? [];
    expect(occurrences.length).toBe(2);
  });
});

describe('SessionComplete.jsx writes Morning completion to the CURRENT identity\'s own scoped key', () => {
  it('imports getMorningCompletionKey and destructures userId from useAlarm()', () => {
    expect(sessionCompleteSource).toMatch(/import \{ getMorningCompletionKey \} from '\.\.\/lib\/dailyCompletion';/);
    expect(sessionCompleteSource).toMatch(/const \{ intentions, setJourneyStep, effectiveTimezone, userId \} = useAlarm\(\);/);
    expect(sessionCompleteSource).not.toMatch(/const MORNING_DONE_KEY = 'moonlight_morning_completed_date';/);
  });

  it('resolves the scoped key once and writes/reads that same variable, never a bare literal', () => {
    expect(sessionCompleteSource).toMatch(/const morningDoneKey = getMorningCompletionKey\(userId\);/);
    expect(sessionCompleteSource).toMatch(/shouldWriteCompletionDate\(localStorage\.getItem\(morningDoneKey\), attributionDateKey\)/);
    expect(sessionCompleteSource).toMatch(/localStorage\.setItem\(morningDoneKey, attributionDateKey\);/);
  });
});

describe('EveningComplete.jsx writes Evening completion to the CURRENT identity\'s own scoped key', () => {
  it('imports getEveningCompletionKey and destructures userId from useAlarm()', () => {
    expect(eveningCompleteSource).toMatch(/import \{ getEveningCompletionKey \} from '\.\.\/lib\/dailyCompletion';/);
    expect(eveningCompleteSource).toMatch(/const \{ effectiveTimezone, userId \} = useAlarm\(\);/);
    expect(eveningCompleteSource).not.toMatch(/const EVENING_DONE_KEY = 'moonlight_evening_completed_date';/);
  });

  it('resolves the scoped key once and writes/reads that same variable, never a bare literal', () => {
    expect(eveningCompleteSource).toMatch(/const eveningDoneKey = getEveningCompletionKey\(userId\);/);
    expect(eveningCompleteSource).toMatch(/shouldWriteCompletionDate\(localStorage\.getItem\(eveningDoneKey\), attributionDateKey\)/);
    expect(eveningCompleteSource).toMatch(/localStorage\.setItem\(eveningDoneKey, attributionDateKey\);/);
  });
});

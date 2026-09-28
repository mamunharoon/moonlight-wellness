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
    // Phase 9 — Truthful Journey Outcomes (Part 8/9) added two more
    // getters (getMorningFullyCompletedKey/getEveningFullyCompletedKey)
    // to this same import - now multi-line, still one single import
    // statement from the same module, still no locally-defined constant.
    expect(homeSource).toMatch(/import \{\s*\n\s*getMorningCompletionKey,\s*\n\s*getEveningCompletionKey,\s*\n\s*getMeditationCompletionKey,\s*\n\s*getMorningFullyCompletedKey,\s*\n\s*getEveningFullyCompletedKey\s*\n\} from '\.\.\/lib\/dailyCompletion';/);
    expect(homeSource).not.toMatch(/const MORNING_DONE_KEY = 'moonlight_morning_completed_date';/);
    expect(homeSource).not.toMatch(/const EVENING_DONE_KEY = 'moonlight_evening_completed_date';/);
    expect(homeSource).not.toMatch(/const MEDITATION_DONE_KEY = 'moonlight_meditation_completed_date';/);
  });

  it('derives isMorningDone/isEveningDone/isMeditatedToday from the scoped key, keyed off the destructured userId', () => {
    expect(homeSource).toMatch(/const \{ alarmTime, bedTime, intentions, intentionsConfirmed, effectiveTimezone, userId \} = useAlarm\(\);/);
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

  it('both Return to Today and Choose another meditation write to the scoped key, using the once-resolved local "today" - WakeWise Phase 2 (B4) gates both behind !endedEarly, since an early exit must not record completion - and ("Your Momentum" foundation, Phase 2) also requires genuine session state, since this unlinked route is otherwise reachable only by a direct URL visit with session null', () => {
    expect(meditationCompleteSource).toMatch(/const today = getZonedParts\(effectiveTimezone, devNow\(\)\)\.dateKey;/);
    const occurrences = meditationCompleteSource.match(/if \(session && !endedEarly\) localStorage\.setItem\(getMeditationCompletionKey\(userId\), today\);/g) ?? [];
    expect(occurrences.length).toBe(2);
  });
});

describe('SessionComplete.jsx writes Morning completion to the CURRENT identity\'s own scoped key', () => {
  it('imports getMorningCompletionKey and destructures userId from useAlarm()', () => {
    // Phase 9 — Truthful Journey Outcomes (Part 8/9) added
    // getMorningFullyCompletedKey to this same import, additively.
    expect(sessionCompleteSource).toMatch(/import \{ getMorningCompletionKey, getMorningFullyCompletedKey \} from '\.\.\/lib\/dailyCompletion';/);
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
    // Build 15 addendum — clearEveningCompletionKey moved out of this
    // file's own import (it now lives inside the ONE shared
    // routineResponses.js#redoEveningWindDown workflow, used identically
    // by this screen and Home.jsx - see routineResponses.test.js). This
    // file keeps only the plain getEveningCompletionKey read it still
    // needs for its own mount-effect completion write above.
    // Phase 9 — Truthful Journey Outcomes (Part 8/9) added
    // getEveningFullyCompletedKey to this same import, additively.
    expect(eveningCompleteSource).toMatch(/import \{ getEveningCompletionKey, getEveningFullyCompletedKey \} from '\.\.\/lib\/dailyCompletion';/);
    expect(eveningCompleteSource).toMatch(/const \{ effectiveTimezone, userId \} = useAlarm\(\);/);
    expect(eveningCompleteSource).not.toMatch(/const EVENING_DONE_KEY = 'moonlight_evening_completed_date';/);
  });

  it('resolves the scoped key once and writes/reads that same variable, never a bare literal', () => {
    expect(eveningCompleteSource).toMatch(/const eveningDoneKey = getEveningCompletionKey\(userId\);/);
    expect(eveningCompleteSource).toMatch(/shouldWriteCompletionDate\(localStorage\.getItem\(eveningDoneKey\), attributionDateKey\)/);
    expect(eveningCompleteSource).toMatch(/localStorage\.setItem\(eveningDoneKey, attributionDateKey\);/);
  });
});

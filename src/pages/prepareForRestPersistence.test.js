// WakeWise Phase 1 correction — Prepare for Rest's four preparation
// toggles and selected bedtime media used to be plain component state
// only, which reset on any full unmount/remount - including the ordinary
// case of reviewing an earlier Evening step (Back to Evening Breathing/
// Meditate) and returning. Now backed by eveningPrepareSelection.js,
// mirroring eveningBreathingSelection.js's own already-approved
// "tonight's selection" convention. Source-level regression guard (no DOM
// rendering is available in this repo's Vitest - see prepareForRest.test.js's
// own established pattern for this file).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./PrepareForRest.jsx', import.meta.url)), 'utf-8');

describe('PrepareForRest.jsx — checklist/bedtime selection persists across leaving and returning to this step', () => {
  it('imports the tonight\'s-selection persistence helpers, mirroring eveningBreathingSelection.js\'s own convention', () => {
    expect(source).toMatch(/import \{ loadEveningPrepareSelection, saveEveningPrepareSelection, clearEveningPrepareSelection \} from '\.\.\/lib\/eveningPrepareSelection';/);
  });

  it('resolves userId/today via useAlarm + getZonedParts, the same source EveningBreathing.jsx already uses for the identical persistence shape', () => {
    expect(source).toMatch(/const \{ effectiveTimezone, userId \} = useAlarm\(\);/);
    expect(source).toMatch(/const today = getZonedParts\(effectiveTimezone, devNow\(\)\)\.dateKey;/);
  });

  it('seeds both selectedPrep and selectedBedtimeId from one single loadEveningPrepareSelection call at mount, never two independent reads that could disagree', () => {
    expect(source).toMatch(/const \[savedSelection\] = useState\(\(\) => loadEveningPrepareSelection\(userId, today\)\);/);
    expect(source).toMatch(/const \[selectedPrep, setSelectedPrep\] = useState\(\(\) => new Set\(savedSelection\?\.prepIds \?\? \[\]\)\);/);
    expect(source).toMatch(/const \[selectedBedtimeId, setSelectedBedtimeId\] = useState\(\(\) => savedSelection\?\.bedtimeId \?\? null\);/);
  });

  it('togglePrep persists the new checklist state immediately (not just on navigation), passing along the current bedtime selection unchanged', () => {
    const body = source.match(/const togglePrep = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/persistSelection\(\[\.\.\.next\], selectedBedtimeId\);/);
  });

  it('choosing a bedtime item persists immediately too, passing along the current checklist unchanged', () => {
    const body = source.match(/const handleChooseBedtimeMedia = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/persistSelection\(\[\.\.\.selectedPrep\], id\);/);
  });

  it('persistSelection is the one place both fields are ever written together', () => {
    expect(source).toMatch(/const persistSelection = \(nextPrepIds, nextBedtimeId\) => \{\s*\n\s*saveEveningPrepareSelection\(userId, \{ prepIds: nextPrepIds, bedtimeId: nextBedtimeId \}, today\);\s*\n\s*\};/);
  });

  it('never marks the checklist as a completed Session Engine step or a routine_responses answer - advanceStep is still only ever called for the real sleepPreparation step transition, never per-toggle', () => {
    const toggleBody = source.match(/const togglePrep = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const chooseBody = source.match(/const handleChooseBedtimeMedia = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(toggleBody).not.toMatch(/advanceStep|upsertRoutineResponse/);
    expect(chooseBody).not.toMatch(/advanceStep|upsertRoutineResponse/);
  });

  it('clears tonight\'s selection the moment the journey actually completes (handleReadyForSleep), before navigating to /evening-complete', () => {
    const body = source.match(/const handleReadyForSleep = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const clearIdx = body.indexOf('clearEveningPrepareSelection(userId);');
    const navigateIdx = body.indexOf("navigate('/evening-complete');");
    expect(clearIdx).toBeGreaterThan(-1);
    expect(navigateIdx).toBeGreaterThan(clearIdx);
  });

  it('chooserOpen (just whether the full-catalogue overlay is showing) is deliberately left as plain, non-persisted UI state', () => {
    expect(source).toMatch(/const \[chooserOpen, setChooserOpen\] = useState\(false\);/);
  });
});

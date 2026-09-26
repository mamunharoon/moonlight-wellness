// WakeWise Phase 2 (B1/B3) — custom-intention correctness inside the
// guided intention ladder. Supersedes the pre-ladder version of this file
// (flat toggleIntention/applySelection + ADD-only addCustomIntention),
// which no longer describes IntentionSetup.jsx's actual interaction
// model - the underlying pure logic itself (setPrimaryIntention/
// setSupportingIntention/clearSupportingIntention) is exhaustively unit-
// tested once, directly, in intentionSelection.test.js; this file only
// proves IntentionSetup.jsx is wired to it correctly, stage by stage.
//
// No DOM/component rendering is available in this repo's Vitest - source-
// level checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./IntentionSetup.jsx', import.meta.url)), 'utf-8');

const handleAddCustomBody = source.match(/const handleAddCustom = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

describe('IntentionSetup.jsx — imports the ladder primitives and message constants, no second implementation', () => {
  it('imports setPrimaryIntention/setSupportingIntention/clearSupportingIntention plus MAX_CUSTOM_INTENTION_LENGTH, DUPLICATE_INTENTION_MESSAGE and TOO_LONG_INTENTION_MESSAGE', () => {
    expect(source).toMatch(/import \{\s*\n\s*setPrimaryIntention,\s*\n\s*setSupportingIntention,\s*\n\s*clearSupportingIntention,\s*\n\s*MAX_CUSTOM_INTENTION_LENGTH,\s*\n\s*DUPLICATE_INTENTION_MESSAGE,\s*\n\s*TOO_LONG_INTENTION_MESSAGE\s*\n\s*\} from '\.\.\/lib\/intentionSelection';/);
  });
});

describe('IntentionSetup.jsx — handleAddCustom validates blank/too-long/duplicate before committing, one path for both stages', () => {
  it('locates the handleAddCustom body', () => {
    expect(handleAddCustomBody).not.toBe('');
  });

  it('blank input is a silent no-op (trims first)', () => {
    expect(handleAddCustomBody).toMatch(/const value = customIntention\.trim\(\);\s*\n\s*if \(!value\) return;/);
  });

  it('an excessively long value shows TOO_LONG_INTENTION_MESSAGE and never proceeds to select it (B3.6)', () => {
    const tooLongBranch = handleAddCustomBody.match(/if \(value\.length > MAX_CUSTOM_INTENTION_LENGTH\) \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(tooLongBranch).toMatch(/showLimitMessage\(TOO_LONG_INTENTION_MESSAGE\);/);
    expect(tooLongBranch).toMatch(/return;/);
  });

  it('at Stage 2, a value equal to the primary (case-insensitively) shows DUPLICATE_INTENTION_MESSAGE - a visible reason, not a silent drop', () => {
    const duplicateBranch = handleAddCustomBody.match(/if \(stage === 'supporting' && intentions\[0\][\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(duplicateBranch).toMatch(/showLimitMessage\(DUPLICATE_INTENTION_MESSAGE\);/);
    expect(duplicateBranch).toMatch(/return;/);
  });

  it('a genuine add clears the typed text and routes to the correct stage handler (Stage 1 -> primary, Stage 2 -> supporting)', () => {
    expect(handleAddCustomBody).toMatch(/setCustomIntention\(''\);\s*\n\s*if \(stage === 'primary'\) \{\s*\n\s*handleSelectPrimary\(value\);\s*\n\s*\} else \{\s*\n\s*handleSelectSupporting\(value\);\s*\n\s*\}/);
  });

  it('rejection branches (too-long, duplicate) never clear customIntention - the typed text survives so the user can edit/retry', () => {
    const beforeTooLong = handleAddCustomBody.indexOf('MAX_CUSTOM_INTENTION_LENGTH');
    const beforeDuplicate = handleAddCustomBody.indexOf("stage === 'supporting'");
    const clearIndex = handleAddCustomBody.indexOf("setCustomIntention('');");
    expect(clearIndex).toBeGreaterThan(beforeTooLong);
    expect(clearIndex).toBeGreaterThan(beforeDuplicate);
  });
});

describe('IntentionSetup.jsx — Stage 1: setPrimaryIntention wiring', () => {
  const body = source.match(/const handleSelectPrimary = \(preset\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

  it('locates handleSelectPrimary', () => {
    expect(body).not.toBe('');
  });

  it('commits via setPrimaryIntention against the live intentions array, then advances to Stage 2', () => {
    expect(body).toMatch(/commit\(setPrimaryIntention\(intentions, preset\)\);/);
    expect(body).toMatch(/setStage\('supporting'\);/);
  });

  it('the Stage 1 grid renders every preset with the morning-accent SelectionChip, selected only when it matches intentions[0]', () => {
    const gridBlock = source.match(/\{stage === 'primary' && \(\s*\n\s*<>\s*\n\s*<div className="grid grid-cols-2 gap-3 w-full">[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(gridBlock).toMatch(/accent="morning"/);
    expect(gridBlock).toMatch(/icon=\{getIntentionIcon\(preset\)\}/);
    expect(gridBlock).toMatch(/selected=\{intentions\[0\]\?\.toLowerCase\(\) === preset\.toLowerCase\(\)\}/);
    expect(gridBlock).toMatch(/onClick=\{\(\) => handleSelectPrimary\(preset\)\}/);
  });
});

describe('IntentionSetup.jsx — Stage 2: setSupportingIntention wiring, primary excluded from choices', () => {
  const body = source.match(/const handleSelectSupporting = \(preset\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

  it('locates handleSelectSupporting', () => {
    expect(body).not.toBe('');
  });

  it('commits via setSupportingIntention, then advances to Summary', () => {
    expect(body).toMatch(/commit\(setSupportingIntention\(intentions, preset\)\);/);
    expect(body).toMatch(/setStage\('summary'\);/);
  });

  it('the Stage 2 grid filters out whichever preset is the current primary, so a supporting choice can never collide with it', () => {
    const gridBlock = source.match(/\{stage === 'supporting' && \([\s\S]*?presets\s*\n\s*\.filter\(\(preset\) => preset\.toLowerCase\(\) !== intentions\[0\]\?\.toLowerCase\(\)\)/)?.[0] ?? '';
    expect(gridBlock).not.toBe('');
  });

  it('"No thanks - one is enough" clears any supporting selection via clearSupportingIntention and advances to Summary', () => {
    const skipBody = source.match(/const handleSkipSupporting = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(skipBody).toMatch(/commit\(clearSupportingIntention\(intentions\)\);/);
    expect(skipBody).toMatch(/setStage\('summary'\);/);
    expect(source).toMatch(/onClick=\{handleSkipSupporting\}[\s\S]{0,300}>\s*\n\s*No thanks — one is enough/);
  });

  it('Back returns to Stage 1 without exiting the routine (item 2) - a plain stage change, never navigate()/handleExitRoutine', () => {
    const backBody = source.match(/const handleBackToPrimary = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(backBody).toMatch(/setStage\('primary'\);/);
    expect(backBody).not.toMatch(/navigate|handleExitRoutine|abandonSession/);
  });
});

describe('IntentionSetup.jsx — Summary: role display, edit affordances, final CTA', () => {
  it('"Change primary" and "Change supporting"/"Add a supporting intention" jump back into the matching stage without discarding the other selection', () => {
    expect(source).toMatch(/onClick=\{\(\) => setStage\('primary'\)\}[\s\S]{0,150}>\s*\n\s*Change primary/);
    expect(source).toMatch(/\{intentions\[1\] \? 'Change supporting' : 'Add a supporting intention'\}/);
  });

  it('the final CTA is only ever "Set My Intention" and calls the same, unchanged handleComplete(true)', () => {
    expect(source).toMatch(/stage === 'summary' \? \(\s*\n\s*<button\s*\n\s*onClick=\{\(\) => handleComplete\(true\)\}/);
    expect(source).toMatch(/<span>\{isSaving \? 'Saving\.\.\.' : 'Set My Intention'\}<\/span>/);
  });

  it('never marks the checklist/ladder itself as a completed Session Engine step - advanceStep is still only reached via handleComplete\'s own existing mirrorTransition call, never per-stage-transition', () => {
    const primaryBody = source.match(/const handleSelectPrimary = \(preset\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const supportingBody = source.match(/const handleSelectSupporting = \(preset\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(primaryBody).not.toMatch(/advanceStep|mirrorTransition/);
    expect(supportingBody).not.toMatch(/advanceStep|mirrorTransition/);
  });
});

describe('IntentionSetup.jsx — 44px tap targets and keyboard operation preserved through the ladder (items 10, custom-input Enter-to-add)', () => {
  it('Back, "No thanks", and both Summary edit links all carry min-h-[44px]', () => {
    const backButton = source.match(/onClick=\{handleBackToPrimary\}[\s\S]{0,40}className="([^"]*)"/)?.[1] ?? '';
    expect(backButton).toMatch(/min-h-\[44px\]/);
    const skipSupportingButton = source.match(/onClick=\{handleSkipSupporting\}[\s\S]{0,40}className="([^"]*)"/)?.[1] ?? '';
    expect(skipSupportingButton).toMatch(/min-h-\[44px\]/);
    const changeButtons = source.match(/onClick=\{\(\) => setStage\('(primary|supporting)'\)\}[\s\S]{0,40}className="([^"]*)"/g) ?? [];
    expect(changeButtons.length).toBeGreaterThanOrEqual(2);
    for (const match of changeButtons) {
      expect(match).toMatch(/min-h-\[44px\]/);
    }
  });

  it('the custom-input Enter key still submits via the same handleKeyDown/handleAddCustom pair, unchanged', () => {
    expect(source).toMatch(/const handleKeyDown = \(e\) => \{\s*\n\s*if \(e\.key === 'Enter'\) \{\s*\n\s*e\.preventDefault\(\);\s*\n\s*handleAddCustom\(\);\s*\n\s*\}\s*\n\s*\};/);
  });

  it('both stages\' custom inputs carry the maxLength guard (defense in depth alongside the pure-function check) and a distinct accessible label', () => {
    const inputs = source.match(/<input[\s\S]*?\/>/g) ?? [];
    expect(inputs.length).toBe(2);
    for (const input of inputs) {
      expect(input).toMatch(/maxLength=\{MAX_CUSTOM_INTENTION_LENGTH\}/);
    }
    expect(inputs[0]).toMatch(/aria-label="Write your own primary intention"/);
    expect(inputs[1]).toMatch(/aria-label="Write your own supporting intention"/);
  });
});

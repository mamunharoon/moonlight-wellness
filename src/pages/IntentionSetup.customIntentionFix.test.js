// Custom-intention defect fix — IntentionSetup.jsx (Morning routine's own
// Step 1). Mirrors the identical fix already shipped to ChangeIntention.jsx
// (see that file's own dedicated test file) via the SAME shared, ADD-only
// addCustomIntention helper (intentionSelection.js) — deliberately not a
// second implementation. This file covers only what's specific to
// IntentionSetup.jsx's own, structurally different LIVE persistence model
// (there is no draft state here - `intentions` from useAlarm() IS the
// selection at all times, and a review-mode edit saves to Supabase
// immediately via applySelection's existing isReviewMode gate, which this
// fix mirrors for the custom-add path too).
//
// No DOM/component rendering is available in this repo's Vitest - source-
// level checks, matching every other regression guard in this codebase.
// The pure add/reject/limit/duplicate logic itself is exhaustively unit-
// tested once, directly, in intentionSelection.test.js - this file only
// proves IntentionSetup.jsx is wired to that shared helper correctly.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./IntentionSetup.jsx', import.meta.url)), 'utf-8');

const handleAddCustomBody = source.match(/const handleAddCustom = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
const applySelectionBody = source.match(/const applySelection = \(value\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

describe('IntentionSetup.jsx — imports the exact same ADD-only helper and messages as ChangeIntention.jsx, no second implementation', () => {
  it('imports addCustomIntention, CUSTOM_LIMIT_MESSAGE and DUPLICATE_INTENTION_MESSAGE alongside the existing chip-tap helpers', () => {
    expect(source).toMatch(/import \{\s*\n\s*toggleIntention,\s*\n\s*addCustomIntention,\s*\n\s*roleForIndex,\s*\n\s*LIMIT_MESSAGE,\s*\n\s*CUSTOM_LIMIT_MESSAGE,\s*\n\s*DUPLICATE_INTENTION_MESSAGE\s*\n\s*\} from '\.\.\/lib\/intentionSelection';/);
  });
});

describe('IntentionSetup.jsx — handleAddCustom uses addCustomIntention (ADD-only), never the chip-tap toggleIntention/applySelection path (items 1, 2, 3, 4, 5, 6)', () => {
  it('calls addCustomIntention with the LIVE intentions array (no draft state exists on this screen)', () => {
    expect(handleAddCustomBody).toMatch(/const \{ intentions: next, status \} = addCustomIntention\(intentions, customIntention\);/);
    expect(handleAddCustomBody).not.toMatch(/applySelection/);
  });

  it('blank is a silent no-op (item 3: reject blank input)', () => {
    expect(handleAddCustomBody).toMatch(/if \(status === 'blank'\) return;/);
  });

  it('duplicate shows DUPLICATE_INTENTION_MESSAGE and never reaches setIntentions - the existing selection is never deselected (item 4)', () => {
    expect(handleAddCustomBody).toMatch(/if \(status === 'duplicate'\) \{\s*\n\s*setLimitMessage\(DUPLICATE_INTENTION_MESSAGE\);/);
    const duplicateBranch = handleAddCustomBody.match(/if \(status === 'duplicate'\) \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(duplicateBranch).not.toMatch(/setIntentions/);
  });

  it('limit-reached shows the exact required CUSTOM_LIMIT_MESSAGE copy and never reaches setIntentions (item 5: reject a third with the exact visible message)', () => {
    expect(handleAddCustomBody).toMatch(/if \(status === 'limit-reached'\) \{\s*\n\s*setLimitMessage\(CUSTOM_LIMIT_MESSAGE\);/);
    const limitBranch = handleAddCustomBody.match(/if \(status === 'limit-reached'\) \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(limitBranch).not.toMatch(/setIntentions/);
  });

  it('customIntention (the typed text) is cleared ONLY on a genuine add - both rejection branches (duplicate/limit-reached) preserve it (item 6: retain typed text)', () => {
    const clears = handleAddCustomBody.match(/setCustomIntention\(''\);/g) ?? [];
    expect(clears.length).toBe(1);
    const lastClearIndex = handleAddCustomBody.lastIndexOf("setCustomIntention('');");
    const duplicateBranchIndex = handleAddCustomBody.indexOf("status === 'duplicate'");
    const limitBranchIndex = handleAddCustomBody.indexOf("status === 'limit-reached'");
    expect(lastClearIndex).toBeGreaterThan(duplicateBranchIndex);
    expect(lastClearIndex).toBeGreaterThan(limitBranchIndex);
  });

  it('a genuine add writes directly into the LIVE AlarmContext intentions (setIntentions), and mirrors applySelection\'s own review-mode immediate cloud-save (parity with the chip-tap path, item 9: appears on Home via the same context Home.jsx reads)', () => {
    expect(handleAddCustomBody).toMatch(/setIntentions\(next\);\s*\n\s*if \(isReviewMode\) saveIntentionsToCloud\(userId, next\);\s*\n\s*setCustomIntention\(''\);/);
  });
});

describe('IntentionSetup.jsx — after removing one selection, the retained custom value becomes addable (item 7)', () => {
  it('applySelection (the chip-removal path) never touches customIntention/setCustomIntention, so a value preserved by a prior rejection survives a chip removal untouched', () => {
    expect(applySelectionBody).not.toMatch(/customIntention/);
  });

  it('addCustomIntention is called fresh against the current `intentions` on every Add tap, so a removal that drops the count below the limit is picked up automatically on the very next tap (no stale snapshot)', () => {
    expect(handleAddCustomBody).toMatch(/addCustomIntention\(intentions, customIntention\)/);
  });
});

describe('IntentionSetup.jsx — Primary/Supporting ordering preserved through Save (item 8)', () => {
  it('a custom addition is appended to the existing order (addCustomIntention\'s own pure-function contract: [...current, value] - see intentionSelection.test.js), and handleComplete saves that same `intentions` array, order intact', () => {
    expect(source).toMatch(/const toSave = intentions\.length > 0 \? intentions : \['Stay calm'\];/);
    expect(source).toMatch(/await saveIntentionsToCloud\(userId, toSave\);/);
  });

  it('role display (Primary/Supporting) on the selected-summary chips is still purely positional via roleForIndex, unchanged', () => {
    expect(source).toMatch(/\{roleForIndex\(idx\)\}/);
  });
});

describe('IntentionSetup.jsx — the limit/duplicate message is rendered a second time, directly beside the custom-input row (keyboard/scroll cannot hide it)', () => {
  it('a second copy sits inside the custom-input wrapper, matching the exact pattern already shipped in ChangeIntention.jsx', () => {
    const customInputBlock = source.match(/\{\/\* Unified custom input\/button control \*\/\}[\s\S]*?role="status">\{limitMessage\}<\/p>\s*\n\s*\)\}\s*\n\s*<\/div>/)?.[0] ?? '';
    expect(customInputBlock.length).toBeGreaterThan(0);
    expect(customInputBlock).toMatch(/\{limitMessage && \(\s*\n\s*<p className="text-xs text-secondary font-semibold px-1" role="status">\{limitMessage\}<\/p>\s*\n\s*\)\}/);
  });

  it('the original top-of-page banner is still present too (both copies share the same limitMessage state)', () => {
    const matches = source.match(/\{limitMessage && \(/g) ?? [];
    expect(matches.length).toBe(2);
  });
});

describe('IntentionSetup.jsx — existing preset chip-tap behaviour is completely untouched (item 10)', () => {
  it('applySelection (handleSelectPreset and summary-chip removal) still uses the original toggleIntention/LIMIT_MESSAGE path, byte-for-byte', () => {
    expect(applySelectionBody).toMatch(/const \{ intentions: next, limitReached \} = toggleIntention\(intentions, value\);/);
    expect(applySelectionBody).toMatch(/setLimitMessage\(LIMIT_MESSAGE\);/);
    expect(applySelectionBody).toMatch(/setIntentions\(next\);\s*\n\s*if \(isReviewMode\) saveIntentionsToCloud\(userId, next\);/);
  });

  it('handleSelectPreset and the summary-chip removal buttons still call applySelection directly, not handleAddCustom', () => {
    expect(source).toMatch(/const handleSelectPreset = \(preset\) => applySelection\(preset\);/);
    expect(source).toMatch(/onClick=\{\(\) => applySelection\(item\)\}/);
  });
});

// Regression guard for Home.jsx's "Change intention" feature, and its
// one-or-two-intentions rules shared with IntentionSetup.jsx. No DOM/
// component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks, plus
// direct unit tests of the two genuinely pure pieces (INTENTION_PRESETS,
// shared between IntentionSetup.jsx and ActiveIntentionCard.jsx, and
// intentionSelection.js's own toggle/limit/sanitize logic - see that
// module's own dedicated test file for its exhaustive unit coverage).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { INTENTION_PRESETS } from '../lib/intentionAffirmations';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const homeSource = read('./Home.jsx');
const cardSource = read('../components/ActiveIntentionCard.jsx');
const intentionSetupSource = read('./IntentionSetup.jsx');
const persistenceSource = read('../lib/intentionPersistence.js');

describe('INTENTION_PRESETS - the single shared preset list', () => {
  it('has exactly the six approved presets', () => {
    expect(INTENTION_PRESETS).toEqual([
      'Stay calm',
      'Be grateful',
      'Be patient',
      'Stay focused',
      'Take one step forward',
      'Be kind to yourself'
    ]);
  });
});

describe('IntentionSetup.jsx now imports the shared preset list, selection helper, and save helper, rather than its own inline copies', () => {
  it('imports INTENTION_PRESETS instead of a local hardcoded array', () => {
    expect(intentionSetupSource).toMatch(/import \{ INTENTION_PRESETS \} from '\.\.\/lib\/intentionAffirmations';/);
    expect(intentionSetupSource).toMatch(/const presets = INTENTION_PRESETS;/);
  });

  it('imports and calls the shared saveIntentionsToCloud helper instead of its own inline supabase upsert', () => {
    expect(intentionSetupSource).toMatch(/import \{ saveIntentionsToCloud \} from '\.\.\/lib\/intentionPersistence';/);
    expect(intentionSetupSource).toMatch(/await saveIntentionsToCloud\(userId, toSave\);/);
    expect(intentionSetupSource).not.toMatch(/from\('user_intentions'\)\s*\n\s*\.upsert/);
  });

  it('imports the shared intentionSelection helpers - toggleIntention, roleForIndex, LIMIT_MESSAGE', () => {
    expect(intentionSetupSource).toMatch(/import \{ toggleIntention, roleForIndex, LIMIT_MESSAGE \} from '\.\.\/lib\/intentionSelection';/);
  });

  it('the instruction copy asks for one or two intentions, never "exactly one"', () => {
    expect(intentionSetupSource).toMatch(/Choose one or two qualities you want to carry into today\./);
    expect(intentionSetupSource).not.toMatch(/Choose one primary intention/);
  });

  it('Continue is disabled whenever nothing is selected - Skip is not (it deliberately still lets the user move on)', () => {
    const continueButton = intentionSetupSource.match(/<button\s*\n\s*onClick=\{handleComplete\}\s*\n\s*disabled=\{isSaving \|\| intentions\.length === 0\}[\s\S]*?<\/button>/);
    expect(continueButton).not.toBeNull();
    expect(continueButton[0]).toMatch(/Continue/);
    const skipButton = intentionSetupSource.match(/<button\s*\n\s*onClick=\{handleComplete\}\s*\n\s*disabled=\{isSaving\}[\s\S]*?Skip this step/);
    expect(skipButton).not.toBeNull();
  });

  it('shows the "up to two" limit message when toggleIntention reports limitReached, and self-clears it', () => {
    expect(intentionSetupSource).toMatch(/setLimitMessage\(LIMIT_MESSAGE\);\s*\n\s*setTimeout\(\(\) => setLimitMessage\(''\), 2500\);/);
    expect(intentionSetupSource).toMatch(/\{limitMessage && \(/);
  });

  it('shows a small Primary/Supporting role label on a selected preset, derived purely from its index', () => {
    expect(intentionSetupSource).toMatch(/const role = roleForIndex\(selectedIndex\);/);
  });

  it('the selected-summary chips let a CUSTOM intention be deselected too (not just presets), via the same applySelection path', () => {
    expect(intentionSetupSource).toMatch(/onClick=\{\(\) => applySelection\(item\)\}/);
  });
});

describe('intentionPersistence.js - the one shared save mechanism, now array-based', () => {
  it('is a no-op without a userId (guests, or a not-yet-resolved auth state) - never writes to Supabase', () => {
    expect(persistenceSource).toMatch(/if \(!supabase \|\| !userId\) return;/);
  });

  it('is a no-op for an empty or non-array selection - never upserts a blank row', () => {
    expect(persistenceSource).toMatch(/if \(!Array\.isArray\(intentions\) \|\| intentions\.length === 0\) return;/);
  });

  it('upserts by user_id, never inserting a second row per user, writing BOTH the full ordered intentions array and the mirrored single-value intention column', () => {
    expect(persistenceSource).toMatch(/\.upsert\(\{ user_id: userId, intention: intentions\[0\], intentions \}, \{ onConflict: 'user_id' \}\)/);
  });

  it('a cloud failure only logs - never throws, never blocks the caller', () => {
    expect(persistenceSource).toMatch(/console\.warn\('Intentions saved locally only/);
  });
});

describe('Home.jsx wires ActiveIntentionCard into both places intentions are shown, using the exact same save mechanism IntentionSetup.jsx uses', () => {
  it('imports ActiveIntentionCard and the shared saveIntentionsToCloud helper', () => {
    expect(homeSource).toMatch(/import \{ ActiveIntentionCard \} from '\.\.\/components\/ActiveIntentionCard';/);
    expect(homeSource).toMatch(/import \{ saveIntentionsToCloud \} from '\.\.\/lib\/intentionPersistence';/);
  });

  it('destructures setIntentions and userId from useAlarm - the exact same context setter/id IntentionSetup.jsx uses', () => {
    expect(homeSource).toMatch(/const \{ alarmTime, bedTime, intentions, setIntentions, effectiveTimezone, userId \} = useAlarm\(\);/);
  });

  it('handleSaveIntention only ever calls setIntentions + saveIntentionsToCloud with the full ordered array - no Session Engine call, no routine start/resume/reset', () => {
    const body = homeSource.match(/const handleSaveIntention = async \(values\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setIntentions\(values\);/);
    expect(body).toMatch(/await saveIntentionsToCloud\(userId, values\);/);
    expect(body).not.toMatch(/startSession|resumeRoutine|resetRoutine|resetSession|advanceStep|abandonSession/);
  });

  it('both the Morning-complete "Today\'s Intention" card and the plain-daytime "Active Intention" card render ActiveIntentionCard with the same isGuest/onRequireSignIn/onSave wiring and the full intentions array', () => {
    const cardUsages = homeSource.match(/<ActiveIntentionCard[\s\S]*?\/>/g) ?? [];
    expect(cardUsages.length).toBe(2);
    for (const usage of cardUsages) {
      expect(usage).toMatch(/intentions=\{displayIntentions\}/);
      expect(usage).toMatch(/isGuest=\{isGuest\}/);
      expect(usage).toMatch(/onRequireSignIn=\{promptRoutineSignIn\}/);
      expect(usage).toMatch(/onSave=\{handleSaveIntention\}/);
    }
    expect(cardUsages.some((u) => /label="Today's Intention"/.test(u))).toBe(true);
    expect(cardUsages.some((u) => /label="Active Intention"/.test(u))).toBe(true);
  });

  it('displayIntentions falls back to the same default only when genuinely empty, never silently dropping a real second intention', () => {
    expect(homeSource).toMatch(/const displayIntentions = intentions\.length > 0 \? intentions : \['Stay calm'\];/);
  });

  it('the persistent Home banner shows every selected intention, pluralising the label only when there are two', () => {
    expect(homeSource).toMatch(/\{displayIntentions\.length > 1 \? 'Intentions' : 'Intention'\}/);
    expect(homeSource).toMatch(/\{displayIntentions\.map\(\(item\) => `"\$\{item\}"`\)\.join\(' {2}• {2}'\)\}/);
  });
});

describe('ActiveIntentionCard.jsx - explicit edit mode, guest gating, one-or-two selection, no auto-start of anything routine-related', () => {
  it('a guest tap calls onRequireSignIn and never enters edit mode', () => {
    expect(cardSource).toMatch(/const handleChangeTap = \(\) => \{\s*\n\s*if \(isGuest\) \{\s*\n\s*onRequireSignIn\(\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('seeds the edit draft from the current intentions, never from an empty selection, when edit mode opens', () => {
    expect(cardSource).toMatch(/setDraftSelection\(intentions\);/);
  });

  it('uses the shared toggleIntention helper - same rules as IntentionSetup.jsx, never a bespoke tap-to-save-immediately path', () => {
    expect(cardSource).toMatch(/import \{ toggleIntention, roleForIndex, LIMIT_MESSAGE \} from '\.\.\/lib\/intentionSelection';/);
    expect(cardSource).toMatch(/const \{ intentions: next, limitReached \} = toggleIntention\(draftSelection, value\);/);
  });

  it('Save is disabled until at least one intention is selected, and only Save (not every preset tap) calls onSave', () => {
    expect(cardSource).toMatch(/disabled=\{draftSelection\.length === 0\}/);
    const presetButtons = cardSource.match(/onClick=\{\(\) => applySelection\(preset\)\}/g) ?? [];
    expect(presetButtons.length).toBe(1);
    expect(cardSource).not.toMatch(/onClick=\{\(\) => handleSave\(preset\)\}/);
  });

  it('offers all six shared presets plus a custom text input', () => {
    expect(cardSource).toMatch(/import \{ INTENTION_PRESETS \} from '\.\.\/lib\/intentionAffirmations';/);
    expect(cardSource).toMatch(/\{INTENTION_PRESETS\.map/);
    expect(cardSource).toMatch(/placeholder="Write your own\.\.\."/);
  });

  it('shows a brief, self-clearing success confirmation after a save, never a persistent banner', () => {
    expect(cardSource).toMatch(/setJustSaved\(true\);\s*\n\s*setTimeout\(\(\) => setJustSaved\(false\), 2500\);/);
  });

  it('clarifies in-UI that this does not rewrite a completed routine\'s historical affirmation record', () => {
    expect(cardSource).toMatch(/does not rewrite a completed routine's saved affirmation record/);
  });

  it('displays both intentions with a Primary/Supporting label when two are set, and no role label at all for a single one', () => {
    expect(cardSource).toMatch(/\{intentions\.length > 1 && \(/);
    expect(cardSource).toMatch(/\{roleForIndex\(idx\)\}/);
  });

  it('never imports or references the Session Engine, routine start/resume, or journal/history writes', () => {
    expect(cardSource).not.toMatch(/useSession|startSession|resumeRoutine|resetRoutine|supabase/);
  });
});

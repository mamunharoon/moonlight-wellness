// Regression guard for "Change intention", now a dedicated screen
// (ChangeIntention.jsx, at /change-intention) rather than Home.jsx's old
// expanded-inline editor. Also covers the one-or-two-intentions rules
// shared with IntentionSetup.jsx. No DOM/component rendering is
// available in this repo's Vitest (see Home.routineState.test.js's own
// note) - source-level checks, plus direct unit tests of the two
// genuinely pure pieces (INTENTION_PRESETS, shared between
// IntentionSetup.jsx and ChangeIntention.jsx, and intentionSelection.js's
// own toggle/limit/sanitize logic - see that module's own dedicated test
// file for its exhaustive unit coverage).
//
// ChangeIntention.jsx's own preload/selection/save/cancel/custom-field
// behaviour has its own dedicated test file: ChangeIntention.test.js.
//
// Filename note: deliberately NOT "changeIntention.test.js" - this repo
// is checked out on a case-insensitive filesystem (Windows), where that
// name collides with ChangeIntention.jsx's own "ChangeIntention.test.js"
// as the exact same file on disk. Named for what this file actually
// covers (ActiveIntentionCard.jsx + Home.jsx's wiring + the untouched
// IntentionSetup.jsx/intentionPersistence.js contracts) instead.
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

describe('IntentionSetup.jsx — Morning routine\'s own Step 1, a distinct Session-Engine-coupled screen (chip-tap path untouched by the Change Intention remediation; its own custom-input path has its own dedicated fix, see IntentionSetup.customIntentionFix.test.js)', () => {
  it('imports INTENTION_PRESETS instead of a local hardcoded array', () => {
    expect(intentionSetupSource).toMatch(/import \{ INTENTION_PRESETS \} from '\.\.\/lib\/intentionAffirmations';/);
    expect(intentionSetupSource).toMatch(/const presets = INTENTION_PRESETS;/);
  });

  it('imports and calls the shared saveIntentionsToCloud helper instead of its own inline supabase upsert', () => {
    expect(intentionSetupSource).toMatch(/import \{ saveIntentionsToCloud \} from '\.\.\/lib\/intentionPersistence';/);
    expect(intentionSetupSource).toMatch(/await saveIntentionsToCloud\(userId, toSave\);/);
    expect(intentionSetupSource).not.toMatch(/from\('user_intentions'\)\s*\n\s*\.upsert/);
  });

  it('imports the shared intentionSelection helpers - toggleIntention (chip-tap), addCustomIntention (custom-input fix), roleForIndex and both message constants', () => {
    expect(intentionSetupSource).toMatch(/import \{\s*\n\s*toggleIntention,\s*\n\s*addCustomIntention,\s*\n\s*roleForIndex,\s*\n\s*LIMIT_MESSAGE,\s*\n\s*CUSTOM_LIMIT_MESSAGE,\s*\n\s*DUPLICATE_INTENTION_MESSAGE\s*\n\s*\} from '\.\.\/lib\/intentionSelection';/);
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

describe('Home.jsx — no longer owns intention save logic at all; ActiveIntentionCard only navigates', () => {
  it('imports ActiveIntentionCard but no longer imports saveIntentionsToCloud - that now lives entirely in ChangeIntention.jsx', () => {
    expect(homeSource).toMatch(/import \{ ActiveIntentionCard \} from '\.\.\/components\/ActiveIntentionCard';/);
    expect(homeSource).not.toMatch(/import \{ saveIntentionsToCloud \}/);
  });

  it('no longer destructures setIntentions from useAlarm (Home never mutates intentions directly any more) - checked in real code only, since a prose comment is free to name the identifier that moved away', () => {
    expect(homeSource).toMatch(/const \{ alarmTime, bedTime, intentions, effectiveTimezone, userId \} = useAlarm\(\);/);
    const codeOnly = homeSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/setIntentions/);
  });

  it('handleSaveIntention no longer exists on Home.jsx', () => {
    expect(homeSource).not.toMatch(/const handleSaveIntention/);
  });

  it('Home redesign — Active Intentions is still a single, always-visible section, rendered via exactly one ActiveIntentionCard with the same isGuest/onRequireSignIn wiring and the full intentions array, but no onSave prop any more', () => {
    const cardUsages = homeSource.match(/<ActiveIntentionCard[\s\S]*?\/>/g) ?? [];
    expect(cardUsages.length).toBe(1);
    const usage = cardUsages[0];
    expect(usage).toMatch(/intentions=\{displayIntentions\}/);
    expect(usage).toMatch(/isGuest=\{isGuest\}/);
    expect(usage).toMatch(/onRequireSignIn=\{promptRoutineSignIn\}/);
    expect(usage).toMatch(/label="Active Intention"/);
    expect(usage).not.toMatch(/onSave=/);
  });

  it('displayIntentions falls back to the same default only when genuinely empty, never silently dropping a real second intention', () => {
    expect(homeSource).toMatch(/const displayIntentions = intentions\.length > 0 \? intentions : \['Stay calm'\];/);
  });

  it('Home redesign — the old, separate read-only "Intentions/Intention" pill banner is retired (ActiveIntentionCard alone now shows and pluralises the selection - see its own describe block below, unchanged)', () => {
    expect(homeSource).not.toMatch(/\{displayIntentions\.length > 1 \? 'Intentions' : 'Intention'\}/);
  });
});

describe('ActiveIntentionCard.jsx — display-only, navigates to the dedicated screen, no local editing state at all', () => {
  it('holds no state - no isEditing/draftSelection/customIntention any more', () => {
    expect(cardSource).not.toMatch(/useState/);
  });

  it('a guest tap calls onRequireSignIn and never navigates', () => {
    expect(cardSource).toMatch(/const handleChangeTap = \(\) => \{\s*\n\s*if \(isGuest\) \{\s*\n\s*onRequireSignIn\(\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('a non-guest tap navigates to the dedicated /change-intention route, never expanding an inline editor', () => {
    expect(cardSource).toMatch(/import \{ useNavigate \} from 'react-router-dom';/);
    expect(cardSource).toMatch(/navigate\('\/change-intention'\);/);
  });

  it('the "Change intention" control carries a 44px effective hit area, keeping its small compact label text', () => {
    const body = cardSource.match(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{handleChangeTap\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(body).toMatch(/min-h-\[44px\]/);
    expect(body).toMatch(/text-\[11px\] font-bold text-primary/);
  });

  it('carries a visible focus-visible ring', () => {
    expect(cardSource).toMatch(/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/);
  });

  it('displays both intentions with a Primary/Supporting label when two are set, and no role label at all for a single one - unchanged display logic', () => {
    expect(cardSource).toMatch(/\{intentions\.length > 1 && \(/);
    expect(cardSource).toMatch(/\{roleForIndex\(idx\)\}/);
  });

  it('never imports or references the Session Engine, routine start/resume, journal/history writes, or the selection/persistence helpers (all of that now lives only in ChangeIntention.jsx) - checked in real code only, since this file\'s own prose comment names what moved away', () => {
    const codeOnly = cardSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/useSession|startSession|resumeRoutine|resetRoutine|supabase|toggleIntention|saveIntentionsToCloud|INTENTION_PRESETS/);
  });
});

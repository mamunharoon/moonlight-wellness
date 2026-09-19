// Regression guard for Home.jsx's "Change intention" feature. No DOM/
// component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks, plus
// direct unit tests of the one genuinely pure piece (INTENTION_PRESETS
// shared between IntentionSetup.jsx and ActiveIntentionCard.jsx).
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

describe('IntentionSetup.jsx now imports the shared preset list and save helper, rather than its own inline copies', () => {
  it('imports INTENTION_PRESETS instead of a local hardcoded array', () => {
    expect(intentionSetupSource).toMatch(/import \{ INTENTION_PRESETS \} from '\.\.\/lib\/intentionAffirmations';/);
    expect(intentionSetupSource).toMatch(/const presets = INTENTION_PRESETS;/);
  });

  it('imports and calls the shared saveIntentionToCloud helper instead of its own inline supabase upsert', () => {
    expect(intentionSetupSource).toMatch(/import \{ saveIntentionToCloud \} from '\.\.\/lib\/intentionPersistence';/);
    expect(intentionSetupSource).toMatch(/await saveIntentionToCloud\(userId, primaryIntention\);/);
    expect(intentionSetupSource).not.toMatch(/from\('user_intentions'\)\s*\n\s*\.upsert/);
  });
});

describe('intentionPersistence.js - the one shared save mechanism', () => {
  it('is a no-op without a userId (guests, or a not-yet-resolved auth state) - never writes to Supabase', () => {
    expect(persistenceSource).toMatch(/if \(!supabase \|\| !userId\) return;/);
  });

  it('upserts by user_id, never inserting a second row per user', () => {
    expect(persistenceSource).toMatch(/\.upsert\(\{ user_id: userId, intention \}, \{ onConflict: 'user_id' \}\)/);
  });

  it('a cloud failure only logs - never throws, never blocks the caller', () => {
    expect(persistenceSource).toMatch(/console\.warn\('Intention saved locally only/);
  });
});

describe('Home.jsx wires ActiveIntentionCard into both places the primary intention is shown, using the exact same save mechanism IntentionSetup.jsx uses', () => {
  it('imports ActiveIntentionCard and the shared saveIntentionToCloud helper', () => {
    expect(homeSource).toMatch(/import \{ ActiveIntentionCard \} from '\.\.\/components\/ActiveIntentionCard';/);
    expect(homeSource).toMatch(/import \{ saveIntentionToCloud \} from '\.\.\/lib\/intentionPersistence';/);
  });

  it('destructures setIntentions and userId from useAlarm - the exact same context setter/id IntentionSetup.jsx uses', () => {
    expect(homeSource).toMatch(/const \{ alarmTime, bedTime, intentions, setIntentions, effectiveTimezone, userId \} = useAlarm\(\);/);
  });

  it('handleSaveIntention only ever calls setIntentions + saveIntentionToCloud - no Session Engine call, no routine start/resume/reset', () => {
    const body = homeSource.match(/const handleSaveIntention = async \(value\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setIntentions\(\[value\]\);/);
    expect(body).toMatch(/await saveIntentionToCloud\(userId, value\);/);
    expect(body).not.toMatch(/startSession|resumeRoutine|resetRoutine|resetSession|advanceStep|abandonSession/);
  });

  it('both the Morning-complete "Today\'s Intention" card and the plain-daytime "Active Intention" card render ActiveIntentionCard with the same isGuest/onRequireSignIn/onSave wiring', () => {
    const cardUsages = homeSource.match(/<ActiveIntentionCard[\s\S]*?\/>/g) ?? [];
    expect(cardUsages.length).toBe(2);
    for (const usage of cardUsages) {
      expect(usage).toMatch(/isGuest=\{isGuest\}/);
      expect(usage).toMatch(/onRequireSignIn=\{promptRoutineSignIn\}/);
      expect(usage).toMatch(/onSave=\{handleSaveIntention\}/);
    }
    expect(cardUsages.some((u) => /label="Today's Intention"/.test(u))).toBe(true);
    expect(cardUsages.some((u) => /label="Active Intention"/.test(u))).toBe(true);
  });
});

describe('ActiveIntentionCard.jsx - explicit edit mode, guest gating, no auto-start of anything routine-related', () => {
  it('a guest tap calls onRequireSignIn and never enters edit mode', () => {
    expect(cardSource).toMatch(/const handleChangeTap = \(\) => \{\s*\n\s*if \(isGuest\) \{\s*\n\s*onRequireSignIn\(\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*setIsEditing\(true\);\s*\n\s*\};/);
  });

  it('validates: an empty/whitespace-only custom value is never saved', () => {
    expect(cardSource).toMatch(/const trimmed = value\.trim\(\);\s*\n\s*if \(!trimmed\) return;/);
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

  it('never imports or references the Session Engine, routine start/resume, or journal/history writes', () => {
    expect(cardSource).not.toMatch(/useSession|startSession|resumeRoutine|resetRoutine|supabase/);
  });
});

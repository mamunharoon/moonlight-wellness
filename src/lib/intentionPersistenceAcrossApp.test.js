// Regression guard for "one or two Morning intentions" persistence across
// every consumer NOT already covered by changeIntention.test.js
// (IntentionSetup.jsx/Home.jsx/ActiveIntentionCard.jsx) or
// intentionSelection.test.js (the pure toggle/sanitize helper itself):
// AlarmContext's local-storage legacy loading and Supabase fetch,
// migrateGuestData's guest-to-account migration, and the two remaining
// display consumers (SessionComplete.jsx, Affirmation.jsx). No DOM/
// component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks, matching
// every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const alarmContextSource = read('../context/AlarmContext.jsx');
const migrateGuestDataSource = read('./migrateGuestData.js');
const sessionCompleteSource = read('../pages/SessionComplete.jsx');
const affirmationSource = read('../pages/Affirmation.jsx');

describe('AlarmContext.jsx - legacy single-value loading and ordered Supabase fetch', () => {
  it('readStoredIntentions runs every localStorage read through the shared sanitizeIntentions validator - a legacy one-item record loads as a one-item collection, never rejected', () => {
    expect(alarmContextSource).toMatch(/import \{ sanitizeIntentions \} from '\.\.\/lib\/intentionSelection';/);
    expect(alarmContextSource).toMatch(/const sanitized = sanitizeIntentions\(parsed\);\s*\n\s*return sanitized\.length > 0 \? sanitized : null;/);
  });

  it('the one-time legacy moonlight_today_intention migration still produces a one-item array, unchanged', () => {
    expect(alarmContextSource).toMatch(/const migrated = \[legacy\.trim\(\)\];/);
  });

  it('fetchIntention selects both intention and intentions from Supabase, preferring the ordered intentions column', () => {
    expect(alarmContextSource).toMatch(/\.select\('intention, intentions'\)/);
    expect(alarmContextSource).toMatch(/const fetched = sanitizeIntentions\(data\.intentions\);\s*\n\s*if \(fetched\.length > 0\) \{\s*\n\s*setIntentions\(fetched\);/);
  });

  it('falls back to the single intention column only when intentions is missing/empty - defensive, not the normal path', () => {
    expect(alarmContextSource).toMatch(/\} else if \(typeof data\.intention === 'string' && data\.intention\.trim\(\)\.length > 0\) \{\s*\n\s*setIntentions\(\[data\.intention\]\);/);
  });
});

describe('migrateGuestData.js - migrates the FULL ordered guest selection, not just the first item', () => {
  it('readGuestIntentions uses the shared sanitizeIntentions validator, matching AlarmContext\'s own load path exactly', () => {
    expect(migrateGuestDataSource).toMatch(/import \{ sanitizeIntentions \} from '\.\/intentionSelection';/);
    expect(migrateGuestDataSource).toMatch(/const sanitized = sanitizeIntentions\(parsed\);\s*\n\s*return sanitized\.length > 0 \? sanitized : null;/);
  });

  it('migrateIntention upserts both the mirrored primary intention column and the full ordered intentions array', () => {
    expect(migrateGuestDataSource).toMatch(/\.upsert\(\s*\n\s*\{ user_id: userId, intention: guestIntentions\[0\], intentions: guestIntentions \},/);
  });
});

describe('SessionComplete.jsx - "Your Morning Intention(s)" card shows every selected intention in order', () => {
  it('falls back to the same default only when genuinely empty', () => {
    expect(sessionCompleteSource).toMatch(/const displayIntentions = intentions\.length > 0 \? intentions : \['Stay calm'\];/);
  });

  it('pluralises the heading and shows a Primary/Supporting role label only when two are set', () => {
    expect(sessionCompleteSource).toMatch(/\{displayIntentions\.length > 1 \? 'Your Morning Intentions' : 'Your Morning Intention'\}/);
    expect(sessionCompleteSource).toMatch(/\{displayIntentions\.length > 1 && \(/);
    expect(sessionCompleteSource).toMatch(/import \{ roleForIndex \} from '\.\.\/lib\/intentionSelection';/);
  });
});

describe('Affirmation.jsx - shows the mapped affirmation for each selected intention, Primary then Supporting order', () => {
  it('maps every intention (in its existing, already-ordered array order) through the same getAffirmationForIntention lookup - never re-sorted, never dynamically generated from the intention text itself (WakeWise Phase 2, B6: now also rotates by the caller\'s own local "today", see intentionAffirmations.test.js)', () => {
    expect(affirmationSource).toMatch(/const affirmations = intentions\.map\(\(intention\) => \(\{\s*\n\s*intention,\s*\n\s*affirmation: getAffirmationForIntention\(intention, today\)\s*\n\s*\}\)\);/);
  });

  it('renders one affirmation block per selected intention, labelling Primary/Supporting only when there are two', () => {
    expect(affirmationSource).toMatch(/\{affirmations\.map\(\(\{ intention, affirmation \}, idx\) => \(/);
    expect(affirmationSource).toMatch(/\{affirmations\.length > 1 && \(/);
  });
});

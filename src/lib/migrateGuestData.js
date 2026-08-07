import { supabase } from './supabaseClient';

// Stage 2B Group 5.2: guest-to-account migration service.
//
// Reads guest data already written by AlarmContext.jsx (rhythm, intentions)
// and Journal.jsx (journal entries), and migrates it into Supabase for a
// newly-authenticated permanent user - but only for tables that don't
// already have cloud data for that user, so an existing cloud value is
// never silently overwritten.
//
// This module deliberately does not touch React state, does not write or
// clear any localStorage key, and does not write a migration-completion
// marker - all three are the caller's responsibility (Group 5.3+).

const WAKE_KEY = 'moonlight_wake_up_time';
const BED_KEY = 'moonlight_bedtime';
const INTENTIONS_KEY = 'moonlight_intentions';
const JOURNAL_KEY = 'moonlight_journal_entries';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const isValidTimeString = (value) => typeof value === 'string' && TIME_PATTERN.test(value);

// Reads and validates the guest's wake/bed time. Both must be present and
// valid - this never fabricates one from a default just to complete a row.
const readGuestRhythm = () => {
  try {
    const wakeUpTime = localStorage.getItem(WAKE_KEY);
    const bedtime = localStorage.getItem(BED_KEY);
    if (!isValidTimeString(wakeUpTime) || !isValidTimeString(bedtime)) return null;
    return { wakeUpTime, bedtime };
  } catch {
    return null;
  }
};

const isValidIntentionsArray = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => typeof item === 'string' && item.trim().length > 0);

// Reads and validates the guest's primary (first) intention only - matches
// the single-primary-intention convention used by IntentionSetup.jsx.
const readGuestPrimaryIntention = () => {
  try {
    const raw = localStorage.getItem(INTENTIONS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidIntentionsArray(parsed)) return null;
    const primary = parsed[0].trim();
    return primary.length > 0 ? primary : null;
  } catch {
    return null;
  }
};

// Stricter than Journal.jsx's own isValidJournalEntry: also requires
// local_id, since a missing client_id would defeat the point of this
// migration's idempotency guarantee.
const isValidGuestJournalEntry = (entry) =>
  entry !== null &&
  typeof entry === 'object' &&
  typeof entry.local_id === 'string' &&
  entry.local_id.trim().length > 0 &&
  typeof entry.body === 'string' &&
  entry.body.trim().length > 0 &&
  typeof entry.created_at === 'string' &&
  !Number.isNaN(new Date(entry.created_at).getTime());

// Reads guest journal entries, separating valid entries from malformed ones
// rather than dropping the whole set if one entry is bad.
const readGuestJournalEntries = () => {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return { valid: [], malformedCount: 0 };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { valid: [], malformedCount: 0 };
    const valid = parsed.filter(isValidGuestJournalEntry);
    return { valid, malformedCount: parsed.length - valid.length };
  } catch {
    return { valid: [], malformedCount: 0 };
  }
};

// Rhythm: cloud-first check, additive-only upsert on rhythms_user_id_key.
const migrateRhythm = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('rhythms')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('migrateGuestData: error checking cloud rhythm:', error.message);
      return { migrated: 0, skipped: 0, failed: 1, reason: 'cloud rhythm check failed' };
    }

    if (data) {
      return { migrated: 0, skipped: 1, failed: 0, reason: 'cloud rhythm already exists' };
    }

    const guestRhythm = readGuestRhythm();
    if (!guestRhythm) {
      return { migrated: 0, skipped: 1, failed: 0, reason: 'no valid guest rhythm data' };
    }

    const { error: upsertError } = await supabase
      .from('rhythms')
      .upsert(
        {
          user_id: userId,
          wake_up_time: guestRhythm.wakeUpTime,
          bedtime: guestRhythm.bedtime,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      console.error('migrateGuestData: error migrating rhythm:', upsertError.message);
      return { migrated: 0, skipped: 0, failed: 1, reason: 'rhythm upsert failed' };
    }

    return { migrated: 1, skipped: 0, failed: 0 };
  } catch (e) {
    console.error('migrateGuestData: unexpected rhythm migration error:', e.message);
    return { migrated: 0, skipped: 0, failed: 1, reason: 'unexpected rhythm migration error' };
  }
};

// Intention: cloud-first check, additive-only upsert on
// user_intentions_user_id_key. Only intentions[0] is ever migrated.
const migrateIntention = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_intentions')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('migrateGuestData: error checking cloud intention:', error.message);
      return { migrated: 0, skipped: 0, failed: 1, reason: 'cloud intention check failed' };
    }

    if (data) {
      return { migrated: 0, skipped: 1, failed: 0, reason: 'cloud intention already exists' };
    }

    const guestIntention = readGuestPrimaryIntention();
    if (!guestIntention) {
      return { migrated: 0, skipped: 1, failed: 0, reason: 'no valid guest intention' };
    }

    const { error: upsertError } = await supabase
      .from('user_intentions')
      .upsert(
        { user_id: userId, intention: guestIntention },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      console.error('migrateGuestData: error migrating intention:', upsertError.message);
      return { migrated: 0, skipped: 0, failed: 1, reason: 'intention upsert failed' };
    }

    return { migrated: 1, skipped: 0, failed: 0 };
  } catch (e) {
    console.error('migrateGuestData: unexpected intention migration error:', e.message);
    return { migrated: 0, skipped: 0, failed: 1, reason: 'unexpected intention migration error' };
  }
};

// Journal: idempotent upsert keyed on (user_id, client_id). client_id is
// the guest's own local_id, so retrying this migration - or migrating a
// second guest device into the same account - can never create a
// duplicate row. ignoreDuplicates means a conflicting client_id is
// silently omitted from the returned representation rather than erroring,
// which is what lets skipped-as-duplicate be counted accurately below.
const migrateJournal = async (userId) => {
  const { valid, malformedCount } = readGuestJournalEntries();

  if (valid.length === 0) {
    return {
      migrated: 0,
      skipped: malformedCount,
      failed: 0,
      reason: malformedCount > 0
        ? 'no valid guest journal entries (malformed entries present)'
        : 'no guest journal entries'
    };
  }

  try {
    const rows = valid.map((entry) => ({
      user_id: userId,
      client_id: entry.local_id,
      body: entry.body,
      created_at: entry.created_at
    }));

    const { data, error } = await supabase
      .from('journal_entries')
      .upsert(rows, { onConflict: 'user_id,client_id', ignoreDuplicates: true })
      .select('client_id');

    if (error) {
      console.error('migrateGuestData: error migrating journal entries:', error.message);
      return { migrated: 0, skipped: malformedCount, failed: rows.length, reason: 'journal upsert failed' };
    }

    const migratedCount = data ? data.length : 0;
    const duplicateCount = rows.length - migratedCount;

    return {
      migrated: migratedCount,
      skipped: malformedCount + duplicateCount,
      failed: 0,
      reason: migratedCount === 0 ? 'all valid guest entries already migrated' : undefined
    };
  } catch (e) {
    console.error('migrateGuestData: unexpected journal migration error:', e.message);
    return { migrated: 0, skipped: malformedCount, failed: valid.length, reason: 'unexpected journal migration error' };
  }
};

// Migrates a guest's locally-stored rhythm, primary intention, and journal
// entries into Supabase for the given permanent authenticated user. Safe to
// call repeatedly: every write path either checks cloud-absence first
// (rhythm, intention) or is protected by the journal_entries_user_id_client_id_key
// unique constraint (journal), so a retry after a partial failure can never
// duplicate data or overwrite an existing cloud value. Never writes or
// clears localStorage, never writes a migration marker, never touches React
// state - the caller decides what to do with the result.
export async function migrateGuestData(userId) {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    const reason = 'invalid userId';
    return {
      success: false,
      rhythm: { migrated: 0, skipped: 0, failed: 1, reason },
      intention: { migrated: 0, skipped: 0, failed: 1, reason },
      journal: { migrated: 0, skipped: 0, failed: 1, reason }
    };
  }

  const [rhythm, intention, journal] = await Promise.all([
    migrateRhythm(userId),
    migrateIntention(userId),
    migrateJournal(userId)
  ]);

  const success = rhythm.failed === 0 && intention.failed === 0 && journal.failed === 0;

  return { success, rhythm, intention, journal };
}

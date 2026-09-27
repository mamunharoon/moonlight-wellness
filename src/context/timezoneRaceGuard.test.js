// Repeated-timezone-prompt fix (mobile correction #1). Root cause: on every
// sign-in, `timezone` state is synchronously reset to null while the
// registered user's real, already-saved rhythms.timezone is still being
// fetched from Supabase. timezoneUnconfirmed used to only guard on
// authLoading, which resolves before that fetch does - so the "confirm your
// timezone" banner could re-appear on login even for a user with a genuine,
// previously-saved timezone. Fix: gate timezoneUnconfirmed on a reactive
// "this identity's rhythm fetch has settled" flag, mirroring the existing
// settledRhythmUserIdRef pattern used for guest-write gating.
// Source-level regression guard (no DOM rendering - see
// alarmEnabledAndConfigured.test.js's own note for why this repo tests
// AlarmContext.jsx this way).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./AlarmContext.jsx');

describe('rhythmSettledUserId - reactive settle flag for the current identity', () => {
  it('is initialized from the current userId, same shape as settledRhythmUserIdRef', () => {
    expect(source).toMatch(/const \[rhythmSettledUserId, setRhythmSettledUserId\] = useState\(userId\);/);
  });

  it('timezoneUnconfirmed requires the CURRENT identity to have settled, not just authLoading to be false', () => {
    const fn = source.match(/const timezoneUnconfirmed = Boolean\(\s*\n[\s\S]*?\n\s*\);/)?.[0] ?? '';
    expect(fn).not.toBe('');
    expect(fn).toMatch(/!authLoading &&/);
    expect(fn).toMatch(/rhythmSettledUserId === userId &&/);
    expect(fn).toMatch(/timezone === null &&/);
    expect(fn).toMatch(/!mismatchSnoozedThisSession/);
  });

  it('the guest branch marks the (null) identity settled immediately, matching settledRhythmUserIdRef', () => {
    const guestBranch = source.match(/if \(!userId\) \{[\s\S]*?settledRhythmUserIdRef\.current = userId;\s*\n\s*setRhythmSettledUserId\(userId\);\s*\n\s*return;\s*\n\s*\}/)?.[0] ?? '';
    expect(guestBranch).not.toBe('');
  });

  it('the registered-user branch only marks the identity settled AFTER fetchRhythm resolves, never before', () => {
    expect(source).toMatch(
      /await fetchRhythm\(userId\);\s*\n[\s\S]*?settledRhythmUserIdRef\.current = userId;\s*\n\s*setRhythmSettledUserId\(userId\);/
    );
  });
});

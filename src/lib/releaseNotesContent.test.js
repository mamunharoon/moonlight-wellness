// WakeWise — Profile/Settings cleanup, 2026-10-24: release notes accuracy.
// Real execution against the actual exported content, not source regex —
// this content is data, not component logic (same approach
// legalContentAccuracy.test.js already established for the legal pages).
import { describe, it, expect } from 'vitest';
import { RELEASE_NOTES } from './releaseNotesContent';

const flattenText = (entry) =>
  entry.sections
    .flatMap((section) => [section.heading ?? '', ...(section.paragraphs ?? []), ...(section.list ?? [])])
    .join('\n');

describe('RELEASE_NOTES — latest entry is current, not the stale August-only entry', () => {
  const latest = RELEASE_NOTES[0];

  it('the latest entry is dated after August 2026', () => {
    expect(latest.date).not.toBe('August 2026');
  });

  it('no longer claims guided audio is unavailable - the Library exists', () => {
    const text = flattenText(latest);
    expect(text).not.toMatch(/guided audio is not yet available/i);
  });

  it('no longer claims self-service account deletion is unavailable - it exists (AUTH-06, Passed)', () => {
    const text = flattenText(latest);
    expect(text).not.toMatch(/self-service account deletion is not yet available/i);
  });

  it('does not claim subscription/billing verification is complete', () => {
    const text = flattenText(latest);
    expect(text).not.toMatch(/subscriptions? (have been|is|are) verified/i);
    expect(text).not.toMatch(/billing (has been|is) (fully )?verified/i);
  });

  it('does mention the real, current Library content', () => {
    const text = flattenText(latest);
    expect(text).toMatch(/Library/);
    expect(text).toMatch(/Sleep Soundscapes/);
  });

  it('does mention self-service account deletion as a real, available feature', () => {
    const text = flattenText(latest);
    expect(text).toMatch(/self-service account deletion|Request account deletion/i);
  });

  it('never mentions internal-only tooling (the Settings environment/build indicator) as a user-facing feature', () => {
    const text = flattenText(latest);
    expect(text).not.toMatch(/environment label|build number|source commit/i);
  });
});

describe('RELEASE_NOTES — prior entry preserved, not deleted', () => {
  it('the original Closed Beta 1 / August 2026 entry still exists, unedited', () => {
    const original = RELEASE_NOTES.find((r) => r.version === 'Closed Beta 1' && r.date === 'August 2026');
    expect(original).toBeTruthy();
    const text = flattenText(original);
    expect(text).toMatch(/Guided audio is not yet available\./);
  });
});

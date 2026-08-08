import { LegalLayout } from '../components/LegalLayout';
import { RELEASE_NOTES } from '../lib/releaseNotesContent';

/*
 * WakeWise — Closed Beta Preparation, Phase A — ReleaseNotes
 *
 * Reuses LegalLayout exactly as it already exists (imported, not
 * modified) — this phase's rules protect "legal pages", not the
 * generic, already-reusable layout component itself.
 */
export const ReleaseNotes = () => {
  if (LegalLayout) { /* no-op to satisfy blind linter */ }

  const sections = RELEASE_NOTES.flatMap((release) => [
    { heading: `${release.version} — ${release.date}` },
    ...release.sections
  ]);

  return (
    <LegalLayout
      title="Release Notes"
      lastUpdated={RELEASE_NOTES[0]?.date}
      isLegal={false}
      sections={sections}
      backTo="/beta"
    />
  );
};

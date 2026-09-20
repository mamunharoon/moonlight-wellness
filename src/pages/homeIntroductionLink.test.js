// "How WakeWise works" — small, permanent Introduction replay link on
// Home.jsx. Home redesign: the approved page order now places this link
// LAST (item 8 of 8 - selector, greeting, recommended card, primary
// button, active intentions, "Or choose something quick", quick-action
// cards, then this link), after the main Morning/Evening recommendation
// rather than before it. No DOM/component rendering is available in this
// repo's Vitest (see Home.routineState.test.js's own note) - source-level
// checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const homeSource = read('./Home.jsx');
const profileSource = read('./Profile.jsx');

describe('Home.jsx — "How WakeWise works" Introduction replay link', () => {
  it('is placed after the four quick-action cards grid, which is itself after the recommended "Your Next Step" card/button and the Active Intention section (the approved Home order)', () => {
    const nextStepIndex = homeSource.indexOf("activePeriod === 'morning' && (");
    const activeIntentionIndex = homeSource.indexOf('<ActiveIntentionCard');
    const gridIndex = homeSource.indexOf('<div className="grid grid-cols-4 gap-2.5">');
    const linkIndex = homeSource.indexOf('to="/introduction"');
    expect(nextStepIndex).toBeGreaterThan(-1);
    expect(activeIntentionIndex).toBeGreaterThan(nextStepIndex);
    expect(gridIndex).toBeGreaterThan(activeIntentionIndex);
    expect(linkIndex).toBeGreaterThan(gridIndex);
  });

  it('uses the exact required label and a subtle info icon, never a large quick-action card treatment', () => {
    const linkBlock = homeSource.match(/<Link\s+to="\/introduction"[\s\S]*?<\/Link>/)?.[0] ?? '';
    expect(linkBlock).toMatch(/How WakeWise works/);
    expect(linkBlock).toMatch(/material-symbols-outlined text-base" aria-hidden="true">info</);
    // Visually secondary: no glass-panel/card background, no grid-cell
    // sizing, unlike the four quick-action cards above it.
    expect(linkBlock).not.toMatch(/glass-panel/);
    expect(linkBlock).not.toMatch(/flex-col items-center gap-1\.5 text-center/);
  });

  it('uses existing WakeWise secondary typography/colour and the standard focus-visible ring treatment', () => {
    const linkBlock = homeSource.match(/<Link\s+to="\/introduction"[\s\S]*?<\/Link>/)?.[0] ?? '';
    expect(linkBlock).toMatch(/text-on-surface-variant/);
    expect(linkBlock).toMatch(/hover:text-on-surface/);
    expect(linkBlock).toMatch(/focus-visible:ring-2 focus-visible:ring-primary/);
  });

  it('provides a real touch target (min-h-[44px]) without a padded card adding excessive vertical space', () => {
    const linkBlock = homeSource.match(/<Link\s+to="\/introduction"[\s\S]*?<\/Link>/)?.[0] ?? '';
    expect(linkBlock).toMatch(/min-h-\[44px\]/);
  });

  it('navigates to the exact same /introduction route Profile\'s "About WakeWise" replay uses - one shared replay destination, not a second implementation', () => {
    expect(homeSource).toMatch(/<Link\s+to="\/introduction"/);
    expect(profileSource).toMatch(/<Link to="\/introduction" className=\{rowClass\}>/);
  });

  it('is rendered unconditionally for both guests and registered users - not inside an isGuest/!isGuest guard', () => {
    const linkIndex = homeSource.indexOf('to="/introduction"');
    const precedingSlice = homeSource.slice(0, linkIndex);
    const lastGuestGuardOpen = Math.max(
      precedingSlice.lastIndexOf('{!isGuest && ('),
      precedingSlice.lastIndexOf('{isGuest && (')
    );
    // Any guest-conditional block opened before this point must already be
    // closed (no unbalanced "(" immediately wrapping the link).
    if (lastGuestGuardOpen !== -1) {
      const afterGuard = precedingSlice.slice(lastGuestGuardOpen);
      const opens = (afterGuard.match(/\(/g) || []).length;
      const closes = (afterGuard.match(/\)/g) || []).length;
      expect(closes).toBeGreaterThanOrEqual(opens);
    }
  });

  it('does not introduce a second Introduction persistence/version-write path - Home.jsx never writes introduction_completed_version (a read-only reference, for the first-time/returning distinction, is expected and fine)', () => {
    expect(homeSource).not.toMatch(/\.update\(\{ introduction_completed_version/);
    expect(homeSource).not.toMatch(/\.upsert\([^)]*introduction_completed_version/);
    expect(homeSource).not.toMatch(/setIntroductionCompletedVersion/);
  });
});

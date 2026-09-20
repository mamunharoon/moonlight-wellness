// "How WakeWise works" — small, permanent Introduction replay link on
// Home.jsx. Usability fix: DEV manual testing found the link unreachable
// without scrolling when it sat below the quick-action cards (item 8 of
// 8 in the original approved order). It now sits directly under the
// greeting and above the recommended "Your Next Step" card (item 3 of 8 -
// selector, greeting, this link, recommended card, primary button, active
// intentions, "Or choose something quick", quick-action cards) - visible
// on first load, above the fold, without competing with the primary CTA
// below it. No DOM/component rendering is available in this repo's Vitest
// (see Home.routineState.test.js's own note) - source-level checks,
// matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const homeSource = read('./Home.jsx');
const profileSource = read('./Profile.jsx');

describe('Home.jsx — "How WakeWise works" Introduction replay link', () => {
  it('is placed directly after the greeting and before the recommended "Your Next Step" card, Active Intention section and quick-action grid (the approved, visible-without-scrolling Home order)', () => {
    const greetingIndex = homeSource.indexOf('{greetingText && (');
    const linkIndex = homeSource.indexOf('to="/introduction"');
    const nextStepIndex = homeSource.indexOf("activePeriod === 'morning' && (");
    const activeIntentionIndex = homeSource.indexOf('<ActiveIntentionCard');
    const gridIndex = homeSource.indexOf('<div className="grid grid-cols-4 gap-2.5">');
    expect(greetingIndex).toBeGreaterThan(-1);
    expect(linkIndex).toBeGreaterThan(greetingIndex);
    expect(nextStepIndex).toBeGreaterThan(linkIndex);
    expect(activeIntentionIndex).toBeGreaterThan(nextStepIndex);
    expect(gridIndex).toBeGreaterThan(activeIntentionIndex);
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

  it('is grouped with the greeting in a plain space-y-2 wrapper - no inline style or negative-margin utility to force the gap, letting the page\'s normal space-y-8 rhythm treat the pair as a single child', () => {
    const groupMatch = homeSource.match(/<div className="space-y-2">\s*\{greetingText[\s\S]*?<\/Link>\s*<\/div>/);
    expect(groupMatch).not.toBeNull();
    const group = groupMatch[0];
    expect(group).toMatch(/<h2 className="text-3xl font-extrabold text-on-surface tracking-tight">\{greetingText\}<\/h2>/);
    expect(group).toMatch(/<Link\s+to="\/introduction"/);
    // The link itself carries no inline style and no negative-margin utility.
    const linkBlock = group.match(/<Link\s+to="\/introduction"[\s\S]*?<\/Link>/)[0];
    expect(linkBlock).not.toMatch(/style=\{/);
    expect(linkBlock).not.toMatch(/-m[tbxy]?-/);
  });
});

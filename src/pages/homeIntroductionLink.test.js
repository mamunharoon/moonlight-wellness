// "Watch: How WakeWise works" — the permanent Introduction replay control
// on Home.jsx. Sits directly under the greeting and above the recommended
// "Your Next Step" card (item 3 of 8 - selector, greeting, this control,
// recommended card, primary button, active intentions, "Or choose
// something quick", quick-action cards) - visible on first load, above
// the fold, without competing with the primary CTA below it.
//
// Discoverability fix: phone testing found the original plain-text link
// (a neutral-coloured info-icon row) too small/subdued to notice next to
// the greeting. It is now a compact tinted pill button - WakeWise's own
// peach accent (bg-primary/10 + border-primary/20 + text-primary, the
// same "chip" treatment as the card's own eyebrow badge), a play-circle
// icon, and the label "Watch: How WakeWise works" - while staying
// visually lighter than the primary CTA's solid bg-primary fill below it.
// Same single control, same /introduction route, same replay behaviour.
//
// No DOM/component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks, matching
// every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const homeSource = read('./Home.jsx');
const profileSource = read('./Profile.jsx');

describe('Home.jsx — "Watch: How WakeWise works" Introduction replay control', () => {
  it('is placed directly after the greeting and before the recommended "Your Next Step" card, Active Intention section and quick-action grid (the approved, visible-without-scrolling Home order)', () => {
    const greetingIndex = homeSource.indexOf('{greetingText && (');
    const linkIndex = homeSource.indexOf('to="/introduction"');
    const nextStepIndex = homeSource.indexOf("activePeriod === 'morning' && (");
    const activeIntentionIndex = homeSource.indexOf('<ActiveIntentionCard');
    const gridIndex = homeSource.indexOf('<div className="grid grid-cols-3 gap-2.5">');
    expect(greetingIndex).toBeGreaterThan(-1);
    expect(linkIndex).toBeGreaterThan(greetingIndex);
    expect(nextStepIndex).toBeGreaterThan(linkIndex);
    expect(activeIntentionIndex).toBeGreaterThan(nextStepIndex);
    expect(gridIndex).toBeGreaterThan(activeIntentionIndex);
  });

  it('uses the exact required label and a play-circle icon, never the old plain-text info-icon treatment', () => {
    const linkBlock = homeSource.match(/<Link\s+to="\/introduction"[\s\S]*?<\/Link>/)?.[0] ?? '';
    expect(linkBlock).toMatch(/Watch: How WakeWise works/);
    expect(linkBlock).toMatch(/material-symbols-outlined text-lg" aria-hidden="true"[\s\S]*?>play_circle</);
    expect(linkBlock).not.toMatch(/>info</);
  });

  it('is a compact tinted/outlined pill using WakeWise\'s own peach accent (bg-primary/10 + border-primary/20 + text-primary) - the same chip treatment as the card\'s own eyebrow badge - never the plain neutral-variant text row it replaced', () => {
    const linkBlock = homeSource.match(/<Link\s+to="\/introduction"[\s\S]*?<\/Link>/)?.[0] ?? '';
    expect(linkBlock).toMatch(/bg-primary\/10/);
    expect(linkBlock).toMatch(/border-primary\/20/);
    expect(linkBlock).toMatch(/text-primary/);
    expect(linkBlock).not.toMatch(/text-on-surface-variant/);
    // No glass-panel/card background or grid-cell sizing, unlike the four
    // quick-action cards further down the page.
    expect(linkBlock).not.toMatch(/glass-panel/);
    expect(linkBlock).not.toMatch(/flex-col items-center gap-1\.5 text-center/);
  });

  it('stays visually lighter than the primary CTA - a tinted/outlined pill (bg-primary/10, a fraction-opacity fill), never the CTA\'s own solid bg-primary fill', () => {
    const linkBlock = homeSource.match(/<Link\s+to="\/introduction"[\s\S]*?<\/Link>/)?.[0] ?? '';
    expect(linkBlock).not.toMatch(/\bbg-primary\b(?!\/)/);
    expect(linkBlock).not.toMatch(/font-bold/);
  });

  it('is sized to its own content (inline-flex, centred by a wrapper) rather than stretching edge-to-edge like the primary CTA below it', () => {
    const linkBlock = homeSource.match(/<Link\s+to="\/introduction"[\s\S]*?<\/Link>/)?.[0] ?? '';
    expect(linkBlock).toMatch(/inline-flex/);
    expect(linkBlock).not.toMatch(/\bw-full\b/);
    expect(linkBlock).not.toMatch(/\bblock\b/);
  });

  it('keeps the standard focus-visible ring treatment', () => {
    const linkBlock = homeSource.match(/<Link\s+to="\/introduction"[\s\S]*?<\/Link>/)?.[0] ?? '';
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

  it('exists exactly once on the page - a single <Link to="/introduction"> in Home.jsx', () => {
    const matches = homeSource.match(/to="\/introduction"/g) ?? [];
    expect(matches.length).toBe(1);
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
    const groupMatch = homeSource.match(/<div className="space-y-2">\s*\{greetingText[\s\S]*?<\/Link>\s*<\/div>\s*<\/div>/);
    expect(groupMatch).not.toBeNull();
    const group = groupMatch[0];
    // Build 15 Phase B bumped text-3xl -> text-4xl; Home Visual Uplift
    // reduces it back to text-3xl (Stitch's own less-oversized hierarchy)
    // and adds break-words as a long-name overflow guard - the group
    // structure itself (still the first thing in this space-y-2 wrapper)
    // is what this test actually guards.
    expect(group).toMatch(/<h2 className="text-3xl font-extrabold text-on-surface tracking-tight break-words">\{greetingText\}<\/h2>/);
    expect(group).toMatch(/<div className="flex justify-center">/);
    expect(group).toMatch(/<Link\s+to="\/introduction"/);
    // The link itself carries no inline style and no negative-margin utility.
    const linkBlock = group.match(/<Link\s+to="\/introduction"[\s\S]*?<\/Link>/)[0];
    // The Link's own opening tag carries no inline style/margin override -
    // a `style={{ fontVariationSettings: ... }}` on the inner icon <span>
    // is an unrelated, pre-existing pattern (filled Material icon variant,
    // used the same way throughout this app) and is fine.
    const linkOpenTag = linkBlock.match(/<Link[\s\S]*?>/)[0];
    expect(linkOpenTag).not.toMatch(/style=\{/);
    expect(linkBlock).not.toMatch(/-m[tbxy]?-/);
  });
});

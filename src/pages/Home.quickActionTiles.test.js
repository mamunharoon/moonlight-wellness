// Regression guard for the Home "Or choose something quick" row: exactly
// three tiles, unchanged destinations, and the accessible hover/focus
// tooltip added alongside the bottom-nav clearance fix. Source-level
// checks - this repo's Vitest has no rendering engine (see
// Layout.safeArea.test.js's own header comment for why).
//
// Navigation simplification (Remove Routines from the Visible User Flow,
// follow-up) — the former fourth tile, "Explore Library"
// (/library?from=home), is removed: Library is already permanently
// available in the bottom nav (Layout.jsx), so this tile was a second,
// redundant path to the exact same destination. The remaining three
// tiles' own hrefs/labels/tooltips/touch-targets are completely
// unaffected - only TILES below shrank from four entries to three.
//
// Build 15 Phase B remediation (Task 4) - the Browse exercises/Sleep
// sounds hrefs each gained a trailing `&from=home`/`?from=home` marker,
// so Library.jsx knows to show its own contextual Back control - see
// libraryHomeReturnContext.test.js for the Library-side coverage. Every
// other destination/tooltip/touch-target guarantee below is unchanged.
//
// Build 15 Home refinement - Anytime Reset moved off this row onto its
// own "Today's Rhythm" card (see Home.greeting.test.js's selector
// coverage), freeing the first tile for a standalone Breathe entry point
// (-> /breathe-standalone; see standaloneBreathe.test.js).
//
// Self-Guided Meditation: the Meditate tile now opens the new self-guided
// setup screen (-> /self-guided-meditation?from=home) instead of the
// previous guided-video wizard (/meditate) - see SelfGuidedMeditation.jsx's
// own doc comment. /meditate itself is untouched and still fully reachable
// via that setup screen's own "Explore Guided Meditations" action or by
// direct URL - see selfGuidedMeditationSetup.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Home.jsx', import.meta.url)), 'utf-8');

const TILES = [
  { href: '/breathe-standalone', label: 'Breathe', tipId: 'quick-action-tip-breathe' },
  { href: '/self-guided-meditation?from=home', label: 'Meditate', tipId: 'quick-action-tip-meditate' },
  { href: '/library?category=sleep-soundscapes&from=home', label: 'Sleep &amp; Unwind', tipId: 'quick-action-tip-sleep-sounds' }
];

describe('Home — quick-action row stays exactly three tiles, unchanged destinations', () => {
  it('exactly three Link tiles route to the three approved destinations, in order', () => {
    const hrefs = [...source.matchAll(/<Link\s+to="([^"]+)"\s*\n\s*aria-describedby="quick-action-tip-/g)].map((m) => m[1]);
    expect(hrefs).toEqual(TILES.map((t) => t.href));
  });

  it('the section heading "Or choose something quick" is unchanged', () => {
    expect(source).toMatch(/Or choose something quick/);
  });

  it('the row is a 3-column grid, evenly sharing the available width - not a leftover 4-column grid with an empty cell', () => {
    expect(source).toMatch(/<div className="grid grid-cols-3 gap-2\.5">/);
    // Comments legitimately name "grid-cols-4" in prose explaining the
    // change (grid-cols-4 -> grid-cols-3) - only the real code matters.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/grid-cols-4/);
  });

  it('no replacement tile was added merely to keep the row at four - Explore Library is gone and nothing new stands in its place', () => {
    // Comments legitimately name "Explore Library" in prose explaining
    // what was removed - only the real code matters here.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/Explore Library/);
    expect(source).not.toMatch(/quick-action-tip-browse-exercises/);
    expect(source).not.toMatch(/to="\/library\?from=home"/);
  });

  it('Library remains fully reachable from Home - not via this row any more, but permanently via the bottom nav (Layout.jsx), unaffected by this change', () => {
    const layoutSource = readFileSync(fileURLToPath(new URL('../components/Layout.jsx', import.meta.url)), 'utf-8');
    expect(layoutSource).toMatch(/\{ label: 'Library', path: '\/library', icon: 'video_library' \}/);
  });
});

describe('Home — quick-action tile tooltips (desktop hover / keyboard focus)', () => {
  for (const tile of TILES) {
    describe(tile.href, () => {
      const tileBlock = (() => {
        const start = source.indexOf(`to="${tile.href}"`);
        expect(start, `tile for ${tile.href} not found`).toBeGreaterThan(-1);
        return source.slice(start, source.indexOf('</Link>', start));
      })();

      it('is wired via aria-describedby to its own tooltip id (a supplementary description, never the accessible name)', () => {
        expect(tileBlock).toMatch(new RegExp(`aria-describedby="${tile.tipId}"`));
        expect(tileBlock).toMatch(new RegExp(`id="${tile.tipId}"`));
      });

      it('the tooltip text exactly matches the tile\'s own permanently-visible label', () => {
        const tipMatch = tileBlock.match(new RegExp(`id="${tile.tipId}"[\\s\\S]*?>\\s*\\n\\s*${tile.label}\\s*\\n`));
        expect(tipMatch, `tooltip text for ${tile.href} should read "${tile.label}"`).not.toBeNull();
      });

      it('the permanently-visible label span is still present, unconditionally (the tooltip never replaces it)', () => {
        expect(tileBlock).toMatch(new RegExp(`text-\\[11px\\] font-semibold text-on-surface leading-tight">${tile.label}<`));
      });

      it('the tooltip is hidden by default and shown only on real hover or keyboard focus-visible - never on plain :focus (which a mouse click also triggers)', () => {
        expect(tileBlock).toMatch(/opacity-0[\s\S]{0,120}group-hover:opacity-100[\s\S]{0,40}group-focus-visible:opacity-100/);
        expect(tileBlock).not.toMatch(/group-focus:opacity-100/);
      });

      it('the tooltip never intercepts pointer events, so it can never obstruct a tap or a click reaching the tile underneath', () => {
        expect(tileBlock).toMatch(/pointer-events-none absolute[\s\S]{0,20}bottom-full/);
      });

      it('the 44x44 touch target is preserved', () => {
        expect(tileBlock).toMatch(/min-h-\[44px\]/);
      });

      it('keyboard focus gets a visible ring, independent of the tooltip (a focused-but-unstyled tile would be invisible to a sighted keyboard user)', () => {
        expect(tileBlock).toMatch(/focus-visible:ring-2 focus-visible:ring-primary/);
      });
    });
  }
});

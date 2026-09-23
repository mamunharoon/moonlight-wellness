// Regression guard for the Home "Or choose something quick" row: exactly
// four tiles, unchanged destinations, and the accessible hover/focus
// tooltip added alongside the bottom-nav clearance fix. Source-level
// checks - this repo's Vitest has no rendering engine (see
// Layout.safeArea.test.js's own header comment for why).
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
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Home.jsx', import.meta.url)), 'utf-8');

const TILES = [
  { href: '/breathe-standalone', label: 'Breathe', tipId: 'quick-action-tip-breathe' },
  { href: '/meditate', label: 'Meditate', tipId: 'quick-action-tip-meditate' },
  { href: '/library?from=home', label: 'Explore Library', tipId: 'quick-action-tip-browse-exercises' },
  { href: '/library?category=sleep-soundscapes&from=home', label: 'Sleep &amp; Unwind', tipId: 'quick-action-tip-sleep-sounds' }
];

describe('Home — quick-action row stays exactly four tiles, unchanged destinations', () => {
  it('exactly four Link tiles route to the four approved destinations, in order', () => {
    const hrefs = [...source.matchAll(/<Link\s+to="([^"]+)"\s*\n\s*aria-describedby="quick-action-tip-/g)].map((m) => m[1]);
    expect(hrefs).toEqual(TILES.map((t) => t.href));
  });

  it('the section heading "Or choose something quick" is unchanged', () => {
    expect(source).toMatch(/Or choose something quick/);
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

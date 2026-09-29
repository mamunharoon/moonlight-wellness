// WakeWise DEV — approved Morning pathway-fit correction, real execution.
// The previously-deployed tile redesign still clipped Affirm and required
// horizontal scrolling at every normal iPhone width - not the approved
// standard presentation. This file is the dedicated regression suite for
// the fix itself: a real 5-column CSS grid (Tailwind's `grid-cols-5`
// compiles to `grid-template-columns: repeat(5, minmax(0, 1fr))` - the
// `minmax(0, ...)` half is what actually prevents overflow, since a plain
// `1fr` column still refuses to shrink below its own content's intrinsic
// width by default), with the direction marker absolutely positioned
// inside each tile so it consumes zero grid layout width. This repo's
// Vitest runs with environment: 'node' (no DOM/layout engine), so the
// literal "does it fit at 320px" claim is verified here at the markup
// level (the CSS mechanism that fixes it is genuinely present, and the
// markup no longer contains the class that broke it) - real on-device/
// browser confirmation of the final rendered pixel fit is still required
// and is called out explicitly in this change's own final report.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MorningJourneyPathway } from './MorningJourneyPathway';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const morningSource = read('./MorningJourneyPathway.jsx');

const collectTiles = (element) => {
  const listItems = element.props.children.filter((child) => child?.props?.role === 'listitem');
  return listItems.map((item) => {
    const tile = item.props.children;
    const [iconRow] = tile.props.children;
    const [, marker] = iconRow.props.children;
    return { item, tile, marker };
  });
};

describe('9. The layout uses five responsive columns - a real CSS grid, never the old unbounded flex row', () => {
  it('the list container is a 5-column grid (grid-cols-5, i.e. Tailwind\'s repeat(5, minmax(0, 1fr))) with a minimal inter-column gap', () => {
    const element = MorningJourneyPathway().props.children;
    expect(element.props.className).toMatch(/\bgrid\b/);
    expect(element.props.className).toMatch(/grid-cols-5/);
    expect(element.props.className).toMatch(/\bgap-1\b/);
  });

  it('each stage column is min-w-0, the explicit override that lets a grid track shrink below its own content\'s intrinsic width (without it, a column would refuse to shrink and force the row to overflow - the actual mechanism of the original defect)', () => {
    const element = MorningJourneyPathway().props.children;
    const listItems = element.props.children.filter((c) => c?.props?.role === 'listitem');
    expect(listItems).toHaveLength(5);
    for (const item of listItems) {
      expect(item.props.className).toMatch(/\bmin-w-0\b/);
    }
  });

  it('the old unbounded flex row (min-w-max, which forced every column to its full intrinsic content width) is completely gone', () => {
    // Comments legitimately quote "min-w-max" in prose while explaining
    // the fix - strip comments first so this reflects only real code.
    const codeOnly = morningSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/min-w-max/);
    expect(codeOnly).not.toMatch(/justify-between/);
  });
});

describe('6. Each direction marker is associated with the preceding card specifically, not the row as a whole', () => {
  it('the marker for stage i is nested inside stage i\'s own tile (its icon row), not stage i+1\'s - so it always visually "emerges from" its true preceding card even if a neighbour\'s label wraps to a different height', () => {
    const element = MorningJourneyPathway().props.children;
    const tiles = collectTiles(element);
    expect(tiles).toHaveLength(5);
    // Stages 0-3 (Focus, Stretch, Breathe, Meditate) each carry their own marker.
    for (let i = 0; i < 4; i++) {
      expect(tiles[i].marker).toBeTruthy();
    }
    // Stage 4 (Affirm) carries none - there is no fifth card to point to.
    expect(tiles[4].marker).toBeFalsy();
  });

  it('the marker sits inside a `relative w-full` wrapper spanning the full card width (not just the icon circle\'s own centred width), so its `right` offset is anchored to the CARD\'s edge, matching "emerge from the right side of the preceding square"', () => {
    const element = MorningJourneyPathway().props.children;
    const tiles = collectTiles(element);
    for (const { tile } of tiles) {
      const [iconRow] = tile.props.children;
      expect(iconRow.props.className).toMatch(/\brelative\b/);
      expect(iconRow.props.className).toMatch(/\bw-full\b/);
    }
  });

  it('the marker\'s own negative right offset extends only slightly into the inter-column gap (a few pixels, not a floating arrow far from its card)', () => {
    const tiles = collectTiles(MorningJourneyPathway().props.children);
    const marker = tiles[0].marker;
    expect(marker.props.style.right).toBe('-8px');
  });
});

describe('8. No horizontal pathway scroller, scroll-snap behaviour, or trailing fade mask remains', () => {
  it('the component renders no overflow-x-auto/scroll-hide/scroll-snap classes and no CSS mask - the grid itself is the fit, not a scroll container', () => {
    expect(morningSource).not.toMatch(/overflow-x-auto/);
    expect(morningSource).not.toMatch(/scroll-hide/);
    expect(morningSource).not.toMatch(/snap-x|snap-mandatory|snap-start/);
    expect(morningSource).not.toMatch(/maskImage|WebkitMaskImage/);
  });

  it('the outermost element is a plain full-width div, not a scroll container (no overflow-* class at all)', () => {
    const outer = MorningJourneyPathway();
    expect(outer.props.className).toBe('w-full');
  });
});

describe('4. Affirm is present and fully part of the single-row layout, never a sixth "off-grid" extra', () => {
  it('the grid renders exactly 5 stage columns and Affirm is the 5th, inside the same grid as every other stage (not a separately-positioned element)', () => {
    const element = MorningJourneyPathway().props.children;
    const listItems = element.props.children.filter((c) => c?.props?.role === 'listitem');
    expect(listItems).toHaveLength(5);
    const tiles = collectTiles(element);
    const [, labelSpan] = tiles[4].tile.props.children;
    const [labelText] = labelSpan.props.children;
    expect(labelText).toBe('Affirm');
  });
});

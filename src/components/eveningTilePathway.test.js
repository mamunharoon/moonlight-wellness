// Evening pathway parity (Phase 13) — real execution. Mirrors
// morningTilePathway.test.js + morningPathwayFit.test.js's own combined
// coverage exactly, against the Evening pathway instead: a real 5-column
// CSS grid (Tailwind's `grid-cols-5` compiles to
// `grid-template-columns: repeat(5, minmax(0, 1fr))` - the `minmax(0,
// ...)` half is what actually prevents overflow, since a plain `1fr`
// column still refuses to shrink below its own content's intrinsic width
// by default), with the small standalone ">" direction marker absolutely
// positioned inside each tile so it consumes zero grid layout width. This
// repo's Vitest runs with environment: 'node' (no DOM/layout engine), so
// the literal "does it fit at 320-430px" claim is verified here at the
// markup level; real on-device/browser confirmation of the final
// rendered pixel fit is still required and is called out explicitly in
// this change's own final report.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EveningJourneyPathway } from './EveningJourneyPathway';
import { EVENING_PATHWAY_STAGES } from '../session/pathwayStages';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const eveningSource = read('./EveningJourneyPathway.jsx');

const REAL_ICONS = ['chat_bubble', 'favorite', 'air', 'self_improvement', 'bedtime'];
const REAL_LABELS = ['Reflect', 'Gratitude', 'Breathe', 'Meditate', 'Rest'];

const stagesWithStatus = (statuses) =>
  EVENING_PATHWAY_STAGES.map(({ id, label, icon }, idx) => ({ id, label, icon, status: statuses[idx] }));

// Walks the real returned element tree: item(listitem) > tile >
// [iconRow, labelSpan]; iconRow > [iconBadge, marker-or-false]; iconBadge
// > [iconSpan, outcomeBadgeEl].
const collectTiles = (element) => {
  const listItems = element.props.children.filter((child) => child?.props?.role === 'listitem');
  return listItems.map((item) => {
    const tile = item.props.children;
    const [iconRow, labelSpan] = tile.props.children;
    const [iconBadge, marker] = iconRow.props.children;
    const [iconSpan, outcomeBadgeEl] = iconBadge.props.children;
    const [labelText, srSpan] = labelSpan.props.children;
    return {
      tile,
      iconRow,
      marker,
      iconGlyph: iconSpan.props.children,
      iconStyle: iconSpan.props.style,
      iconContainerStyle: iconBadge.props.style,
      outcomeBadgeEl,
      label: labelText,
      srSuffix: Array.isArray(srSpan.props.children) ? srSpan.props.children.join('') : srSpan.props.children
    };
  });
};

describe('Five Evening stage tiles render, all five canonical icons visible, Rest present and discoverable', () => {
  const element = EveningJourneyPathway().props.children;
  const tiles = collectTiles(element);

  it('renders exactly five tiles, in the exact approved order, each with its real canonical icon', () => {
    expect(tiles).toHaveLength(5);
    expect(tiles.map((t) => t.label)).toEqual(REAL_LABELS);
    expect(tiles.map((t) => t.iconGlyph)).toEqual(REAL_ICONS);
  });

  it('the Rest tile is the fifth stage, has no trailing direction marker, and its label can wrap (break-words) rather than being cropped - never overflow-hidden on the tile', () => {
    const restItem = tiles[4];
    expect(restItem.label).toBe('Rest');
    expect(restItem.marker).toBeFalsy();
    expect(restItem.tile.props.className).not.toMatch(/overflow-hidden/);
    expect(restItem.tile.props.className).toMatch(/rounded-2xl/);
  });

  it('each tile is a compact rounded rectangle with a visible border/background (subtle, existing evening periwinkle tokens, never Morning gold) - the activity icon+label sit inside it, not floating loose', () => {
    for (const { tile } of tiles) {
      expect(tile.props.className).toMatch(/rounded-2xl/);
      expect(tile.props.className).toMatch(/\bborder\b/);
      expect(tile.props.className).toMatch(/evening-accent-tint/);
      expect(tile.props.className).not.toMatch(/morning-accent/);
    }
  });
});

describe('Direction markers: four small standalone ">" glyphs, never a line/dash/stem/oversized-arrow connector', () => {
  const element = EveningJourneyPathway().props.children;
  const tiles = collectTiles(element);

  it('exactly four direction markers render (one inside each of the first four tiles\' own icon row, none in the fifth)', () => {
    const markers = tiles.map((t) => t.marker).filter(Boolean);
    expect(markers).toHaveLength(4);
  });

  it('each marker is a small, standalone ">" (chevron_right) Material Symbol - aria-hidden, non-interactive, never conditioned on stage status', () => {
    const markers = tiles.map((t) => t.marker).filter(Boolean);
    for (const marker of markers) {
      expect(marker.props['aria-hidden']).toBe('true');
      expect(marker.props.children).toBe('chevron_right');
      expect(marker.props.onClick).toBeUndefined();
    }
  });

  it('the marker component itself has no status/journeyTone prop at all - it cannot communicate completion, unlike the real StageOutcomeBadge', () => {
    const markers = tiles.map((t) => t.marker).filter(Boolean);
    for (const marker of markers) {
      expect(marker.props.status).toBeUndefined();
      expect(marker.props.journeyTone).toBeUndefined();
      expect(marker.props.size).toBeUndefined();
    }
  });

  it('never renders JourneyConnector, an SVG <line>/<path>, or a literal dash/em-dash as a connector - source-level, no line-and-arrowhead treatment survives in this file', () => {
    expect(eveningSource).not.toMatch(/<JourneyConnector/);
    expect(eveningSource).not.toMatch(/import \{ JourneyConnector \}/);
    expect(eveningSource).not.toMatch(/<line\b/);
    expect(eveningSource).not.toMatch(/<svg\b/);
    expect(eveningSource).not.toMatch(/<path\b/);
  });

  it('the marker is absolutely positioned and vertically centred against the icon specifically (top-1/2 -translate-y-1/2) - never dependent on the whole card\'s height, and consumes no grid layout width', () => {
    const markers = tiles.map((t) => t.marker).filter(Boolean);
    for (const marker of markers) {
      expect(marker.props.className).toMatch(/\babsolute\b/);
      expect(marker.props.className).toMatch(/top-1\/2/);
      expect(marker.props.className).toMatch(/-translate-y-1\/2/);
    }
  });

  it('the marker for stage i is nested inside stage i\'s own tile (its icon row), not stage i+1\'s - so it always visually "emerges from" its true preceding card even if a neighbour\'s label wraps to a different height', () => {
    expect(tiles).toHaveLength(5);
    for (let i = 0; i < 4; i++) {
      expect(tiles[i].marker).toBeTruthy();
    }
    expect(tiles[4].marker).toBeFalsy();
  });

  it('the marker sits inside a `relative w-full` wrapper spanning the full card width (not just the icon circle\'s own centred width), so its `right` offset is anchored to the CARD\'s edge', () => {
    for (const { tile } of tiles) {
      const [iconRow] = tile.props.children;
      expect(iconRow.props.className).toMatch(/\brelative\b/);
      expect(iconRow.props.className).toMatch(/\bw-full\b/);
    }
  });

  it('the marker\'s own negative right offset extends only slightly into the inter-column gap (a few pixels, not a floating arrow far from its card)', () => {
    const marker = tiles[0].marker;
    expect(marker.props.style.right).toBe('-8px');
  });
});

describe('Truthful outcome states survive the tile redesign unchanged - genuine icon always primary, additive badge only, sr-only text preserved', () => {
  it('a fully completed run still shows every real activity icon, never "check" as the main glyph', () => {
    const tiles = collectTiles(EveningJourneyPathway({ stages: stagesWithStatus(Array(5).fill('completed')) }).props.children);
    expect(tiles.map((t) => t.iconGlyph)).toEqual(REAL_ICONS);
    for (const { outcomeBadgeEl } of tiles) {
      expect(outcomeBadgeEl.props.status).toBe('completed');
    }
  });

  it('skipped and ended-early each keep their own real icon too - never converted into completed, never converted into each other', () => {
    const tiles = collectTiles(
      EveningJourneyPathway({ stages: stagesWithStatus(['completed', 'skipped', 'ended_early', 'not_started', 'current']) }).props.children
    );
    expect(tiles.map((t) => t.iconGlyph)).toEqual(REAL_ICONS);
    expect(tiles[1].outcomeBadgeEl.props.status).toBe('skipped');
    expect(tiles[2].outcomeBadgeEl.props.status).toBe('ended_early');
    expect(tiles[3].outcomeBadgeEl.props.status).toBe('not_started');
    expect(tiles[4].outcomeBadgeEl.props.status).toBe('current');
  });

  it('not-reached (not_started) never infers completion merely from stage position - a stage after the current one stays honestly not_started', () => {
    const tiles = collectTiles(
      EveningJourneyPathway({ stages: stagesWithStatus(['completed', 'current', 'not_started', 'not_started', 'not_started']) }).props.children
    );
    expect(tiles[2].outcomeBadgeEl.props.status).toBe('not_started');
    expect(tiles[3].outcomeBadgeEl.props.status).toBe('not_started');
    expect(tiles[4].outcomeBadgeEl.props.status).toBe('not_started');
  });

  it('"current" highlights the tile itself (periwinkle border/background) in addition to the existing icon-circle ring - never the icon glyph swapped out', () => {
    const tiles = collectTiles(
      EveningJourneyPathway({ stages: stagesWithStatus(['current', 'not_started', 'not_started', 'not_started', 'not_started']) }).props.children
    );
    expect(tiles[0].iconGlyph).toBe('chat_bubble');
    expect(tiles[0].tile.props.className).toMatch(/border-evening-accent\b/);
    expect(tiles[0].tile.props.className).not.toMatch(/border-evening-accent-tint/);
    expect(tiles[1].tile.props.className).toMatch(/border-evening-accent-tint/);
  });
});

describe('No minutes, percentages, streaks, points or performance scoring anywhere in the redesigned pathway', () => {
  it('the file never renders duration/streak/score copy as visible text (comments and className/style values stripped first - "min-w"/"min-h" utility classes are not the word "minutes")', () => {
    const codeOnly = eveningSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/className=\{[^}]*\}/g, '')
      .replace(/className="[^"]*"/g, '')
      .replace(/style=\{\{[\s\S]*?\}\}/g, '');
    expect(codeOnly).not.toMatch(/\bminutes?\b/i);
    expect(codeOnly).not.toMatch(/\bstreak\b/i);
    expect(codeOnly).not.toMatch(/\bpoints?\b/i);
    expect(codeOnly).not.toMatch(/of 5/i);
  });
});

describe('The layout uses five responsive columns - a real CSS grid, never a horizontal scroller/carousel', () => {
  it('the list container is a 5-column grid (grid-cols-5, i.e. Tailwind\'s repeat(5, minmax(0, 1fr))) with a minimal inter-column gap', () => {
    const element = EveningJourneyPathway().props.children;
    expect(element.props.className).toMatch(/\bgrid\b/);
    expect(element.props.className).toMatch(/grid-cols-5/);
    expect(element.props.className).toMatch(/\bgap-1\b/);
  });

  it('each stage column is min-w-0, the explicit override that lets a grid track shrink below its own content\'s intrinsic width', () => {
    const element = EveningJourneyPathway().props.children;
    const listItems = element.props.children.filter((c) => c?.props?.role === 'listitem');
    expect(listItems).toHaveLength(5);
    for (const item of listItems) {
      expect(item.props.className).toMatch(/\bmin-w-0\b/);
    }
  });

  it('the old flex row (min-w-max, justify-between) and the old overflow-x-auto scroller/scroll-hide/scroll-snap/fade-mask are completely gone', () => {
    const codeOnly = eveningSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/min-w-max/);
    expect(codeOnly).not.toMatch(/justify-between/);
    expect(eveningSource).not.toMatch(/overflow-x-auto/);
    expect(eveningSource).not.toMatch(/scroll-hide/);
    expect(eveningSource).not.toMatch(/snap-x|snap-mandatory|snap-start/);
    expect(eveningSource).not.toMatch(/maskImage/);
  });

  it('the outermost element is a plain full-width div, not a scroll container (no overflow-* class at all)', () => {
    const outer = EveningJourneyPathway();
    expect(outer.props.className).toBe('w-full');
  });
});

describe('Rest is present and fully part of the single-row layout, never a sixth "off-grid" extra', () => {
  it('the grid renders exactly 5 stage columns and Rest is the 5th, inside the same grid as every other stage (not a separately-positioned element)', () => {
    const element = EveningJourneyPathway().props.children;
    const listItems = element.props.children.filter((c) => c?.props?.role === 'listitem');
    expect(listItems).toHaveLength(5);
    const tiles = collectTiles(element);
    const [, labelSpan] = tiles[4].tile.props.children;
    const [labelText] = labelSpan.props.children;
    expect(labelText).toBe('Rest');
  });
});

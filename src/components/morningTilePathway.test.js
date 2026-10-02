// WakeWise DEV — approved Morning pathway-tile redesign, real execution.
// This repo's Vitest runs with environment: 'node' (no DOM), but a React
// component is still a plain function: calling it directly returns a real
// element tree (plain objects from React.createElement) that can be
// inspected without any renderer - the same technique
// MorningJourneyPathway.test.js already established.
//
// Approved Morning pathway-fit correction — the direction marker moved
// from a sibling AFTER the tile (the earlier tile-redesign's own shape)
// to a child INSIDE the tile's own icon-row wrapper (so it can be
// absolutely positioned against that row specifically - see
// MorningJourneyPathway.jsx's own doc comment for why). This file's own
// collectTiles walks the NEW shape. morningPathwayFit.test.js covers the
// grid/no-scroller/marker-association requirements specific to this fit
// correction; MorningJourneyPathway.test.js's own suite (untouched, still
// passing) continues to cover the underlying Phase 9 honesty contract.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MorningJourneyPathway } from './MorningJourneyPathway';
import { EveningJourneyPathway } from './EveningJourneyPathway';
import { AnytimePathway } from './AnytimePathway';
import { MORNING_PATHWAY_STAGES } from '../session/pathwayStages';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const morningSource = read('./MorningJourneyPathway.jsx');

const REAL_ICONS = ['flag', 'accessibility_new', 'air', 'self_improvement', 'auto_awesome'];
const REAL_LABELS = ['Focus', 'Stretch', 'Breathe', 'Meditate', 'Affirm'];

const stagesWithStatus = (statuses) =>
  MORNING_PATHWAY_STAGES.map(({ id, label, icon }, idx) => ({ id, label, icon, status: statuses[idx] }));

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

describe('1/2/5. Five Morning stage tiles render, all five canonical icons visible, Affirm present and discoverable', () => {
  const element = MorningJourneyPathway().props.children;
  const tiles = collectTiles(element);

  it('renders exactly five tiles, in the exact approved order, each with its real canonical icon', () => {
    expect(tiles).toHaveLength(5);
    expect(tiles.map((t) => t.label)).toEqual(REAL_LABELS);
    expect(tiles.map((t) => t.iconGlyph)).toEqual(REAL_ICONS);
  });

  it('the Affirm tile is the fifth stage, has no trailing direction marker, and its label can wrap (break-words) rather than being cropped - never overflow-hidden on the tile', () => {
    const affirmItem = tiles[4];
    expect(affirmItem.label).toBe('Affirm');
    expect(affirmItem.marker).toBeFalsy();
    expect(affirmItem.tile.props.className).not.toMatch(/overflow-hidden/);
    expect(affirmItem.tile.props.className).toMatch(/rounded-2xl/);
  });

  it('each tile is a compact rounded rectangle with a visible border/background (subtle, existing morning tokens) - the activity icon+label sit inside it, not floating loose', () => {
    for (const { tile } of tiles) {
      expect(tile.props.className).toMatch(/rounded-2xl/);
      expect(tile.props.className).toMatch(/\bborder\b/);
      expect(tile.props.className).toMatch(/morning-accent-tint/);
    }
  });
});

describe('3/4. Direction markers: four small standalone ">" glyphs, never a line/dash/stem/oversized-arrow connector', () => {
  const element = MorningJourneyPathway().props.children;
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
    expect(morningSource).not.toMatch(/<JourneyConnector/);
    expect(morningSource).not.toMatch(/import \{ JourneyConnector \}/);
    expect(morningSource).not.toMatch(/<line\b/);
    expect(morningSource).not.toMatch(/<svg\b/);
    expect(morningSource).not.toMatch(/<path\b/);
  });

  it('the marker is absolutely positioned and vertically centred against the icon specifically (top-1/2 -translate-y-1/2) - never dependent on the whole card\'s height, and consumes no grid layout width', () => {
    const markers = tiles.map((t) => t.marker).filter(Boolean);
    for (const marker of markers) {
      expect(marker.props.className).toMatch(/\babsolute\b/);
      expect(marker.props.className).toMatch(/top-1\/2/);
      expect(marker.props.className).toMatch(/-translate-y-1\/2/);
    }
  });
});

describe('6/7/9. Truthful outcome states survive the tile redesign unchanged - genuine icon always primary, additive badge only, sr-only text preserved', () => {
  it('a fully completed run still shows every real activity icon, never "check" as the main glyph', () => {
    const tiles = collectTiles(MorningJourneyPathway({ stages: stagesWithStatus(Array(5).fill('completed')) }).props.children);
    expect(tiles.map((t) => t.iconGlyph)).toEqual(REAL_ICONS);
    for (const { outcomeBadgeEl } of tiles) {
      expect(outcomeBadgeEl.props.status).toBe('completed');
    }
  });

  it('skipped and ended-early each keep their own real icon too - never converted into completed, never converted into each other', () => {
    const tiles = collectTiles(
      MorningJourneyPathway({ stages: stagesWithStatus(['completed', 'skipped', 'ended_early', 'not_started', 'current']) }).props.children
    );
    expect(tiles.map((t) => t.iconGlyph)).toEqual(REAL_ICONS);
    expect(tiles[1].outcomeBadgeEl.props.status).toBe('skipped');
    expect(tiles[2].outcomeBadgeEl.props.status).toBe('ended_early');
    expect(tiles[3].outcomeBadgeEl.props.status).toBe('not_started');
    expect(tiles[4].outcomeBadgeEl.props.status).toBe('current');
  });

  it('not-reached (not_started) never infers completion merely from stage position - a stage after the current one stays honestly not_started', () => {
    const tiles = collectTiles(
      MorningJourneyPathway({ stages: stagesWithStatus(['completed', 'current', 'not_started', 'not_started', 'not_started']) }).props.children
    );
    expect(tiles[2].outcomeBadgeEl.props.status).toBe('not_started');
    expect(tiles[3].outcomeBadgeEl.props.status).toBe('not_started');
    expect(tiles[4].outcomeBadgeEl.props.status).toBe('not_started');
  });

  it('"current" highlights the tile itself (gold border/background) in addition to the existing icon-circle ring - never the icon glyph swapped out', () => {
    const tiles = collectTiles(
      MorningJourneyPathway({ stages: stagesWithStatus(['current', 'not_started', 'not_started', 'not_started', 'not_started']) }).props.children
    );
    expect(tiles[0].iconGlyph).toBe('flag');
    expect(tiles[0].tile.props.className).toMatch(/border-morning-accent\b/);
    expect(tiles[0].tile.props.className).not.toMatch(/border-morning-accent-tint/);
    expect(tiles[1].tile.props.className).toMatch(/border-morning-accent-tint/);
  });

  it('exact sr-only suffixes are preserved for screen readers, matching the Phase 9 spec\'s own named examples', () => {
    const tiles = collectTiles(
      MorningJourneyPathway({ stages: stagesWithStatus(['not_started', 'skipped', 'not_started', 'not_started', 'current']) }).props.children
    );
    expect(`${tiles[1].label}${tiles[1].srSuffix}`).toBe('Stretch, skipped');
    expect(`${tiles[4].label}${tiles[4].srSuffix}`).toBe('Affirm, current');
  });
});

describe('8. No minutes, percentages, streaks, points or performance scoring anywhere in the redesigned pathway', () => {
  it('the file never renders duration/streak/score copy as visible text (comments and className/style values stripped first - "min-w"/"min-h" utility classes are not the word "minutes")', () => {
    const codeOnly = morningSource
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

describe('10. Pathway overflow is contained locally - never the whole page (and, after the fit correction, never needs to be)', () => {
  // See morningPathwayFit.test.js's own dedicated coverage for the full
  // "no scroller at all" requirement - this describe block keeps the
  // original numbered-requirement anchor for traceability.
  it('the grid never overflows its own container - no overflow-x-auto/scroll-hide/scroll-snap/fade-mask remain, since grid-cols-5 (minmax(0,1fr)) fits by construction', () => {
    expect(morningSource).not.toMatch(/overflow-x-auto/);
    expect(morningSource).not.toMatch(/scroll-hide/);
    expect(morningSource).not.toMatch(/snap-x|snap-mandatory|snap-start/);
    expect(morningSource).not.toMatch(/maskImage/);
    expect(morningSource).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe('12. Anytime pathway rendering is unaffected by the Morning/Evening tile redesigns; Evening now shares Morning\'s own tile treatment', () => {
  // Evening pathway parity (Phase 13) — Evening was brought into the same
  // tile/grid/direction-marker treatment as Morning (see
  // eveningTilePathway.test.js's own dedicated coverage for the full
  // requirement set). It no longer renders JourneyConnector at all -
  // AnytimePathway/Home's Anytime preview row are the only remaining
  // JourneyConnector consumers (pathwayConnectors.test.js's own updated
  // assertions cover this split).
  it('EveningJourneyPathway now renders its own five stages via the same tile/grid + small standalone ">" marker treatment as Morning, not JourneyConnector', () => {
    const source = read('./EveningJourneyPathway.jsx');
    expect(source).not.toMatch(/import \{ JourneyConnector \}/);
    expect(source).not.toMatch(/<JourneyConnector/);
    const element = EveningJourneyPathway().props.children;
    const stages = element.props.children.filter((c) => c?.props?.role === 'listitem');
    expect(stages).toHaveLength(5);
  });

  // Anytime visual-choice uplift (Part 3) — AnytimePathway.jsx now joins
  // Morning/Evening's own approved tile treatment for its direction
  // markers too (a small standalone ">" / chevron_right, never the
  // line-and-arrowhead JourneyConnector) - see pathwayConnectors.test.js's
  // own dedicated coverage of this change. Its 3-stage structure and
  // honest badge-only-when-genuinely-selected contract are unaffected.
  it('AnytimePathway still renders its own three decision stages, now via the same small standalone chevron_right marker Morning/Evening use, never the old JourneyConnector', () => {
    const source = read('./AnytimePathway.jsx');
    expect(source).not.toMatch(/import \{ JourneyConnector \}/);
    expect(source).not.toMatch(/<JourneyConnector/);
    expect(source).toMatch(/chevron_right/);
    const element = AnytimePathway({}).props.children;
    const stages = element.props.children.filter((c) => c?.props?.role === 'listitem');
    expect(stages).toHaveLength(3);
  });
});

describe('11. Existing Home and completion actions are untouched by this redesign', () => {
  it('Home.jsx renders MorningJourneyPathway in all four card states, with the same buttons/handlers this component never touches', () => {
    const homeSource = read('../pages/Home.jsx');
    const renderMatches = homeSource.match(/<MorningJourneyPathway/g) ?? [];
    expect(renderMatches.length).toBe(4);
    expect(homeSource).toMatch(/onClick=\{handleMorningAction\}/);
    expect(homeSource).toMatch(/onClick=\{\(\) => setActiveDialog\(\{ kind: 'repeat', period: 'morning' \}\)\}/);
    expect(homeSource).toMatch(/onClick=\{\(\) => setActiveDialog\(\{ kind: 'start-over', period: 'morning' \}\)\}/);
  });

  it('SessionComplete.jsx still renders MorningJourneyPathway once, alongside the unchanged truthful Complete/Finished headline and Continue action', () => {
    const sessionCompleteSource = read('../pages/SessionComplete.jsx');
    const renderMatches = sessionCompleteSource.match(/<MorningJourneyPathway/g) ?? [];
    expect(renderMatches.length).toBe(1);
    expect(sessionCompleteSource).toMatch(/morningFullyCompleted \? 'Morning routine complete' : 'Morning Reset finished'/);
  });
});

// Physical-iPhone correction — Morning visual pathway icon/connector
// uplift, later recalibrated by the approved Morning pathway-fit
// correction (responsive clamp()-based icon/glyph sizing, a real 5-column
// grid, and a direction marker nested inside each tile's own icon row).
// This was originally a Morning-ONLY correction; Evening pathway parity
// (Phase 13) brought Evening into the exact same tile/grid/clamp()
// treatment (see eveningTilePathway.test.js's own dedicated coverage) -
// only Anytime still keeps its original 32px geometry and JourneyConnector
// tree shape (see pathwayConnectors.test.js's own untouched assertions).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MorningJourneyPathway } from './MorningJourneyPathway';
import { EveningJourneyPathway } from './EveningJourneyPathway';
import { MORNING_PATHWAY_STAGES } from '../session/pathwayStages';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

// Morning's own current shape: item(listitem) > tile > [iconRow,
// labelSpan]; iconRow > [iconBadge, marker-or-false].
const collectMorningStages = (element) => {
  const listItems = element.props.children.filter((child) => child?.props?.role === 'listitem');
  return listItems.map((item) => {
    const tile = item.props.children;
    const [iconRow] = tile.props.children;
    const [iconBadge, marker] = iconRow.props.children;
    return { iconBadge, marker };
  });
};

// Evening pathway parity (Phase 13) — Evening now shares Morning's own
// tile shape exactly: item(listitem) > tile > [iconRow, labelSpan];
// iconRow > [iconBadge, marker-or-false].
const collectEveningStages = (element) => {
  const listItems = element.props.children.filter((child) => child?.props?.role === 'listitem');
  return listItems.map((item) => {
    const tile = item.props.children;
    const [iconRow] = tile.props.children;
    const [iconBadge, marker] = iconRow.props.children;
    return { iconBadge, marker };
  });
};

describe('Morning pathway — substantially larger, visually meaningful, responsive icons (physical-iPhone correction, recalibrated by the pathway-fit correction)', () => {
  const element = MorningJourneyPathway().props.children;
  const stages = collectMorningStages(element);

  // Approved Morning pathway-fit correction — the icon circle/glyph now
  // scale with the viewport via CSS clamp() (approved target ranges:
  // container clamp(38px, 11vw, 46px), glyph clamp(20px, 5.5vw, 24px))
  // instead of a single fixed Tailwind size class, so the icon stays
  // clearly visible at every width from 320-430px without ever forcing
  // the row wider than the real available width - see
  // morningPathwayFit.test.js's own dedicated fit coverage. Still a real,
  // substantial increase over the pre-Phase-6 original 28px (w-7 h-7).
  it('every stage icon circle uses the approved responsive clamp() size, not a single fixed Tailwind class, and never the old 28px (w-7 h-7)', () => {
    for (const { iconBadge } of stages) {
      expect(iconBadge.props.style).toEqual({ width: 'clamp(38px, 11vw, 46px)', height: 'clamp(38px, 11vw, 46px)' });
      expect(iconBadge.props.className).not.toMatch(/\bw-7\b/);
    }
  });

  it('the glyph itself is rendered at the approved responsive clamp() size, substantially larger than the old fixed text-sm', () => {
    for (const { iconBadge } of stages) {
      const iconSpan = iconBadge.props.children[0];
      expect(iconSpan.props.style).toEqual({ fontSize: 'clamp(20px, 5.5vw, 24px)' });
    }
  });

  // Approved Morning pathway-tile redesign superseded the line-and-
  // arrowhead JourneyConnector for Morning specifically with a small
  // standalone ">" direction marker, now nested inside each tile's own
  // icon row (pathway-fit correction) - see morningTilePathway.test.js's
  // own dedicated coverage of the marker itself. Evening now shares this
  // exact same treatment (Phase 13 - see eveningTilePathway.test.js);
  // Anytime/Home's Anytime preview row are unaffected and keep rendering
  // the real JourneyConnector (pathwayConnectors.test.js).
  it('exactly 5 icons and 4 direction markers are rendered - never the JourneyConnector line-and-arrowhead', () => {
    const markers = stages.map((s) => s.marker).filter(Boolean);
    expect(stages).toHaveLength(5);
    expect(markers).toHaveLength(4);
    for (const marker of markers) {
      expect(marker.props.size).toBeUndefined();
      expect(marker.props.journeyTone).toBeUndefined();
    }
  });

  // Approved Morning pathway-fit correction — the corner badge is now
  // `size="md"` (~17px), recalibrated proportionally against the smaller
  // clamp(38-46px) icon circle (the earlier "lg" 20px badge was sized for
  // the pathway-tile redesign's own larger, fixed 56px/48px circles).
  it('the corner outcome badge uses the recalibrated "md" size to match the responsive icon, on every stage that renders one', () => {
    const withOutcome = MorningJourneyPathway({
      stages: MORNING_PATHWAY_STAGES.map(({ id, label, icon }) => ({ id, label, icon, status: 'completed' }))
    }).props.children;
    for (const { iconBadge } of collectMorningStages(withOutcome)) {
      const [, outcomeBadgeEl] = iconBadge.props.children;
      expect(outcomeBadgeEl.props.size).toBe('md');
    }
  });

  // Evening pathway parity (Phase 13) — Evening now shares the exact same
  // responsive clamp() icon sizing and direction-marker treatment as
  // Morning (see eveningTilePathway.test.js's own dedicated coverage for
  // the full requirement set); only Anytime is left with its original
  // fixed geometry.
  it('Evening now shares Morning\'s own responsive clamp() icon circle and small standalone ">" direction marker, in the same tile tree shape', () => {
    const eveningStages = collectEveningStages(EveningJourneyPathway().props.children);
    const markers = eveningStages.map((s) => s.marker).filter(Boolean);
    expect(eveningStages).toHaveLength(5);
    expect(markers).toHaveLength(4);
    for (const { iconBadge } of eveningStages) {
      expect(iconBadge.props.style).toEqual({ width: 'clamp(38px, 11vw, 46px)', height: 'clamp(38px, 11vw, 46px)' });
      expect(iconBadge.props.className).not.toMatch(/\bw-7\b/);
    }
    for (const marker of markers) {
      expect(marker.props.size).toBeUndefined();
      expect(marker.props.journeyTone).toBeUndefined();
    }
  });

  it('the approved Morning gold token system is reused, not replaced — no raw hex, no new colour', () => {
    const source = read('./MorningJourneyPathway.jsx');
    expect(source).toMatch(/morning-accent/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  // Approved Morning pathway-fit correction — the row no longer scrolls
  // at all (grid-cols-5 fits all five stages within the real viewport
  // width by construction); see morningPathwayFit.test.js's own dedicated
  // "no scroller" coverage. This assertion now proves the opposite of its
  // own original claim, on purpose - the fit correction's entire point was
  // that horizontal scrolling is no longer the fallback.
  it('no arbitrary small icon/text class was reintroduced, and the row no longer needs to scroll at all', () => {
    const source = read('./MorningJourneyPathway.jsx');
    expect(source).not.toMatch(/overflow-x-auto/);
    expect(source).not.toMatch(/text-\[9px\]|text-sm"|w-7 h-7/);
  });
});

// The "lg" variant below predates the approved Morning pathway-tile
// redesign (which replaced JourneyConnector with a small standalone ">"
// marker for Morning specifically - see morningTilePathway.test.js). It is
// no longer used by any caller, but is left in place, untouched and
// unremoved, since JourneyConnector.jsx itself is out of this
// redesign's scope and Evening/Anytime never used "lg" either.
describe('JourneyConnector — additive "lg" size variant (preserved, no longer used by Morning after the tile redesign)', () => {
  it('"lg" renders a visibly larger line+arrowhead than the default "sm" size, still one shared component (never separate Morning-only connector markup)', () => {
    const source = read('./journey/JourneyConnector.jsx');
    expect(source).toMatch(/lg:\s*\{[^}]*width:\s*28/);
    expect(source).toMatch(/sm:\s*\{[^}]*width:\s*22/);
  });

  it('every existing caller that omits `size` still gets the exact original "sm" geometry — additive, non-breaking', () => {
    const source = read('./journey/JourneyConnector.jsx');
    expect(source).toMatch(/size = 'sm'/);
  });
});

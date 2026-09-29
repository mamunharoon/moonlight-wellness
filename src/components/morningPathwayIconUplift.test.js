// Physical-iPhone correction — Morning visual pathway icon/connector
// uplift. The Home Morning card's five-stage pathway (Focus -> Stretch ->
// Breathe -> Meditate -> Affirm) read as "too small, no strong visual
// journey" on a real device against the approved Stitch-direction
// reference. This is a Morning-ONLY correction — Evening/Anytime keep
// their exact original 28px/32px geometry (see pathwayConnectors.test.js's
// own untouched assertions for those two).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MorningJourneyPathway } from './MorningJourneyPathway';
import { EveningJourneyPathway } from './EveningJourneyPathway';
import { MORNING_PATHWAY_STAGES } from '../session/pathwayStages';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const collectStages = (element) => {
  const listItems = element.props.children.filter((child) => child?.props?.role === 'listitem');
  return listItems.map((item) => {
    const [iconCol, connector] = item.props.children;
    const [iconBadge] = iconCol.props.children;
    return { iconBadge, connector };
  });
};

describe('Morning pathway — substantially larger, visually meaningful icons (physical-iPhone correction)', () => {
  const element = MorningJourneyPathway().props.children;
  const stages = collectStages(element);

  it('every stage icon circle is 56px (w-14 h-14) — a real, substantial increase over the old 28px (w-7 h-7)', () => {
    for (const { iconBadge } of stages) {
      expect(iconBadge.props.className).toMatch(/\bw-14\b/);
      expect(iconBadge.props.className).toMatch(/\bh-14\b/);
      expect(iconBadge.props.className).not.toMatch(/\bw-7\b/);
    }
  });

  it('the glyph itself is rendered at a substantially larger size (text-2xl, not the old text-sm)', () => {
    for (const { iconBadge } of stages) {
      const iconSpan = iconBadge.props.children[0];
      expect(iconSpan.props.className).toMatch(/text-2xl/);
    }
  });

  it('exactly 5 icons and 4 connectors are rendered, each connector using the "lg" JourneyConnector size to bridge the bigger circles', () => {
    const connectors = stages.map((s) => s.connector).filter(Boolean);
    expect(stages).toHaveLength(5);
    expect(connectors).toHaveLength(4);
    for (const connector of connectors) {
      expect(connector.props.size).toBe('lg');
      expect(connector.props.journeyTone).toBe('morning');
    }
  });

  it('the corner outcome badge also scales up (size="lg") to match the larger icon, on every stage that renders one', () => {
    const withOutcome = MorningJourneyPathway({
      stages: MORNING_PATHWAY_STAGES.map(({ id, label, icon }) => ({ id, label, icon, status: 'completed' }))
    }).props.children;
    for (const { iconBadge } of collectStages(withOutcome)) {
      const [, outcomeBadgeEl] = iconBadge.props.children;
      expect(outcomeBadgeEl.props.size).toBe('lg');
    }
  });

  it('Evening keeps its own original 28px icon circle and default ("sm") connector/badge size — this correction is Morning-only', () => {
    const eveningStages = collectStages(EveningJourneyPathway().props.children);
    for (const { iconBadge, connector } of eveningStages) {
      expect(iconBadge.props.className).toMatch(/\bw-7\b/);
      if (connector) expect(connector.props.size).toBeUndefined();
    }
  });

  it('the approved Morning gold token system is reused, not replaced — no raw hex, no new colour', () => {
    const source = read('./MorningJourneyPathway.jsx');
    expect(source).toMatch(/morning-accent/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('at narrow widths the row scrolls horizontally instead of shrinking below a legible size — no arbitrary small icon/text class was reintroduced', () => {
    const source = read('./MorningJourneyPathway.jsx');
    expect(source).toMatch(/overflow-x-auto scroll-hide/);
    expect(source).not.toMatch(/text-\[9px\]|text-sm"|w-7 h-7/);
  });
});

describe('JourneyConnector — additive "lg" size variant used only by the Morning pathway', () => {
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

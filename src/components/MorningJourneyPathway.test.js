// Morning Visual Uplift (Phase 6), Phase 9 — Truthful Journey Outcomes —
// MorningJourneyPathway, real execution. This repo's Vitest runs with
// environment: 'node' (no DOM/jsdom), but a React component is still a
// plain function: calling it directly returns a real element tree (plain
// objects from React.createElement), which can be inspected without any
// renderer.
//
// Phase 9 fix under test (problem #3): this component previously
// replaced a "completed" step's icon with a generic checkmark, inferred
// purely from `currentStepNumber` position - a SKIPPED step read
// identically to a genuinely completed one. It now accepts a `stages`
// prop (session/stageStatus.js's computeStageStatus() output shape) and
// NEVER swaps the real activity icon for anything else; completed/
// skipped/ended-early are each communicated only by an ADDITIVE
// StageOutcomeBadge in the icon's corner.
import { describe, it, expect } from 'vitest';
import { MorningJourneyPathway } from './MorningJourneyPathway';
import { MORNING_PATHWAY_STAGES } from '../session/pathwayStages';
import { StageOutcomeBadge } from './journey/StageOutcomeBadge';

const REAL_ICONS = ['flag', 'accessibility_new', 'air', 'self_improvement', 'auto_awesome'];
const REAL_LABELS = ['Focus', 'Stretch', 'Breathe', 'Meditate', 'Affirm'];

const stagesWithStatus = (statuses) =>
  MORNING_PATHWAY_STAGES.map(({ id, label, icon }, idx) => ({ id, label, icon, status: statuses[idx] }));

// Walk the real returned element tree and collect every stage's icon
// glyph, outcome-badge element, label text, and sr-only suffix, in DOM
// order, purely by structural shape. Approved Morning pathway-fit
// correction shape: item(listitem) > tile > [iconRow, labelSpan];
// iconRow > [iconBadge, marker-or-false]; iconBadge > [iconSpan,
// outcomeBadgeEl] (unchanged from before - the direction marker moved
// inside iconRow, but the icon/badge pairing itself is untouched).
const collectStages = (element) => {
  const listItems = element.props.children.filter((child) => child?.props?.role === 'listitem');
  return listItems.map((item) => {
    const tile = item.props.children;
    const [iconRow, labelSpan] = tile.props.children;
    const [iconBadge] = iconRow.props.children;
    const [iconSpan, outcomeBadgeEl] = iconBadge.props.children;
    const [labelText, srSpan] = labelSpan.props.children;
    return {
      iconGlyph: iconSpan.props.children,
      iconAriaHidden: iconSpan.props['aria-hidden'],
      badgeType: outcomeBadgeEl.type,
      badgeStatus: outcomeBadgeEl.props.status,
      badgeTone: outcomeBadgeEl.props.journeyTone,
      badgeClass: iconBadge.props.className,
      label: labelText,
      srSuffix: Array.isArray(srSpan.props.children) ? srSpan.props.children.join('') : srSpan.props.children
    };
  });
};

describe('MorningJourneyPathway — real execution, no-props default (byte-identical not-started look)', () => {
  const outer = MorningJourneyPathway();
  const element = outer.props.children;
  const stages = collectStages(element);

  it('renders exactly the five approved steps, in the exact approved order: Focus, Stretch, Breathe, Meditate, Affirm', () => {
    expect(stages.map((s) => s.label)).toEqual(REAL_LABELS);
    expect(stages.map((s) => s.iconGlyph)).toEqual(REAL_ICONS);
  });

  it('every stage defaults to not_started with the corresponding sr-only suffix', () => {
    for (const s of stages) {
      expect(s.badgeStatus).toBe('not_started');
      expect(s.srSuffix).toBe(', not started');
    }
  });

  it('every icon is a real Material Symbol name - never an emoji character', () => {
    for (const s of stages) expect(s.iconGlyph).toMatch(/^[a-z_]+$/);
  });

  it('is a real accessible list (role="list" on the root, role="listitem" per step) with an aria-label naming the full sequence', () => {
    expect(element.props.role).toBe('list');
    expect(element.props['aria-label']).toBe('Morning Reset steps: Focus, Stretch, Breathe, Meditate, Affirm');
  });

  // Approved Morning pathway-fit correction — the previous horizontal
  // scroller (which used to clip Affirm and require scrolling at every
  // normal iPhone width) is gone; the fix is a real 5-column CSS grid
  // (`grid-cols-5`, i.e. `repeat(5, minmax(0, 1fr))`) that fits all five
  // stages within the real viewport width by construction. See
  // morningPathwayFit.test.js's own dedicated fit/overflow coverage.
  it('320px structural safety: a real 5-column grid (never overflow-x-auto) is the fit mechanism, so there is nothing left to scroll', () => {
    expect(outer.props.className).not.toMatch(/overflow-x-auto/);
    expect(element.props.className).toMatch(/grid-cols-5/);
  });

  it('every icon is aria-hidden - the visible text label is the only accessible name for each step', () => {
    for (const s of stages) expect(s.iconAriaHidden).toBe('true');
  });

  it('called with no props at all (bare JSX usage) never throws', () => {
    expect(() => MorningJourneyPathway()).not.toThrow();
  });
});

describe('MorningJourneyPathway — Phase 9 fix: the genuine icon is ALWAYS the primary visual, never replaced by a checkmark', () => {
  it('a fully completed run still shows every real activity icon (flag/accessibility_new/air/self_improvement/auto_awesome), never "check" as the main glyph', () => {
    const stages = collectStages(MorningJourneyPathway({ stages: stagesWithStatus(Array(5).fill('completed')) }).props.children);
    expect(stages.map((s) => s.iconGlyph)).toEqual(REAL_ICONS);
  });

  it('a skipped stage keeps its own real icon too - Stretch skipped is never visually indistinguishable from Stretch completed at the icon level', () => {
    const stages = collectStages(
      MorningJourneyPathway({ stages: stagesWithStatus(['completed', 'skipped', 'not_started', 'not_started', 'not_started']) }).props.children
    );
    expect(stages[1].iconGlyph).toBe('accessibility_new');
    expect(stages[1].badgeStatus).toBe('skipped');
  });

  it('completed/skipped/ended-early each render the correct StageOutcomeBadge (additive, not a replacement) with journeyTone="morning"', () => {
    const stages = collectStages(
      MorningJourneyPathway({ stages: stagesWithStatus(['completed', 'skipped', 'ended_early', 'current', 'not_started']) }).props.children
    );
    expect(stages[0]).toMatchObject({ badgeType: StageOutcomeBadge, badgeStatus: 'completed', badgeTone: 'morning' });
    expect(stages[1]).toMatchObject({ badgeType: StageOutcomeBadge, badgeStatus: 'skipped', badgeTone: 'morning' });
    expect(stages[2]).toMatchObject({ badgeType: StageOutcomeBadge, badgeStatus: 'ended_early', badgeTone: 'morning' });
    expect(stages[3]).toMatchObject({ badgeType: StageOutcomeBadge, badgeStatus: 'current' });
  });

  it('exact sr-only suffixes match the Phase 9 spec\'s own named examples: "Stretch, skipped", "Affirm, current"', () => {
    const stages = collectStages(
      MorningJourneyPathway({ stages: stagesWithStatus(['not_started', 'skipped', 'not_started', 'not_started', 'current']) }).props.children
    );
    expect(`${stages[1].label}${stages[1].srSuffix}`).toBe('Stretch, skipped');
    expect(`${stages[4].label}${stages[4].srSuffix}`).toBe('Affirm, current');
  });

  it('"current" changes the main badge\'s ring/highlight class, never the icon glyph', () => {
    const stages = collectStages(
      MorningJourneyPathway({ stages: stagesWithStatus(['current', 'not_started', 'not_started', 'not_started', 'not_started']) }).props.children
    );
    expect(stages[0].iconGlyph).toBe('flag');
    expect(stages[0].badgeClass).toMatch(/border-morning-accent(?!-tint)/);
    expect(stages[1].badgeClass).not.toMatch(/border-morning-accent(?!-tint)/);
  });

  it('uses only existing morning-accent tokens - no raw hex', () => {
    const source = MorningJourneyPathway.toString();
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('MORNING_PATHWAY_STAGES names the real session step id(s) each display stage represents, for computeStageStatus callers', () => {
    expect(MORNING_PATHWAY_STAGES.map((s) => s.stepIds)).toEqual([
      ['intention'],
      ['stretch'],
      ['breathe'],
      ['meditate'],
      ['affirmation']
    ]);
  });
});

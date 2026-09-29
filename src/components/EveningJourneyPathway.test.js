// Evening Visual Uplift (Phase 7), Phase 9 — Truthful Journey Outcomes,
// Evening pathway parity (Phase 13) — EveningJourneyPathway, real
// execution. This repo's Vitest runs with environment: 'node' (no DOM/
// jsdom), but a React component is still a plain function: calling it
// directly returns a real element tree (plain objects from
// React.createElement), which can be inspected without any renderer.
//
// Phase 13 brought this component into exact structural parity with the
// approved MorningJourneyPathway.jsx tile redesign (see that file's own
// EveningJourneyPathway.test.js-equivalent, MorningJourneyPathway.test.js,
// for the identical honesty-contract pattern this file mirrors) - genuine
// icon always visible, completion/skip/ended-early each an ADDITIVE
// corner badge, never a replacement of the real icon. eveningTilePathway.
// test.js is the dedicated suite for the tile/grid/direction-marker
// structural requirements themselves; this file keeps the underlying
// Phase 9 honesty-contract coverage this component has always had.
import { describe, it, expect } from 'vitest';
import { EveningJourneyPathway } from './EveningJourneyPathway';
import { EVENING_PATHWAY_STAGES } from '../session/pathwayStages';
import { StageOutcomeBadge } from './journey/StageOutcomeBadge';

const REAL_ICONS = ['chat_bubble', 'favorite', 'air', 'self_improvement', 'bedtime'];
const REAL_LABELS = ['Reflect', 'Gratitude', 'Breathe', 'Meditate', 'Rest'];

const stagesWithStatus = (statuses) =>
  EVENING_PATHWAY_STAGES.map(({ id, label, icon }, idx) => ({ id, label, icon, status: statuses[idx] }));

// Walk the real returned element tree and collect every stage's icon
// glyph, outcome-badge element, label text, and sr-only suffix, in DOM
// order, purely by structural shape. Tile-redesign shape (matches
// MorningJourneyPathway.jsx exactly): item(listitem) > tile > [iconRow,
// labelSpan]; iconRow > [iconBadge, marker-or-false]; iconBadge >
// [iconSpan, outcomeBadgeEl].
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

describe('EveningJourneyPathway — real execution, no-props default (byte-identical not-started look)', () => {
  const outer = EveningJourneyPathway();
  const element = outer.props.children;
  const stages = collectStages(element);

  it('renders exactly the five approved stages, in the exact approved order: Reflect, Gratitude, Breathe, Meditate, Rest', () => {
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

  it('is a real accessible list (role="list" on the root, role="listitem" per stage) with an aria-label naming the full sequence', () => {
    expect(element.props.role).toBe('list');
    expect(element.props['aria-label']).toBe('Evening Wind-Down stages: Reflect, Gratitude, Breathe, Meditate, Rest');
  });

  // Evening pathway parity (Phase 13) — same fit mechanism as Morning's
  // own approved correction: a real 5-column CSS grid (`grid-cols-5`, i.e.
  // `repeat(5, minmax(0, 1fr))`) fits all five stages within 320-430px by
  // construction - no horizontal scroller needed. See eveningTilePathway.
  // test.js's own dedicated fit/overflow coverage.
  it('320px structural safety: a real 5-column grid (never overflow-x-auto) is the fit mechanism, so there is nothing left to scroll', () => {
    expect(outer.props.className).not.toMatch(/overflow-x-auto/);
    expect(element.props.className).toMatch(/grid-cols-5/);
  });

  it('every icon is aria-hidden - the visible text label is the only accessible name for each stage', () => {
    for (const s of stages) expect(s.iconAriaHidden).toBe('true');
  });

  it('called with no props at all (bare JSX usage) never throws', () => {
    expect(() => EveningJourneyPathway()).not.toThrow();
  });
});

describe('EveningJourneyPathway — genuine icons are ALWAYS the primary visual, never replaced by a checkmark', () => {
  it('the named Phase 9 Evening scenario: Reflection completed, Gratitude completed, Breathing ended early, Meditation skipped, Rest not reached', () => {
    const stages = collectStages(
      EveningJourneyPathway({ stages: stagesWithStatus(['completed', 'completed', 'ended_early', 'skipped', 'not_started']) }).props.children
    );
    expect(stages.map((s) => s.iconGlyph)).toEqual(REAL_ICONS); // every real icon still visible
    expect(stages.map((s) => s.badgeStatus)).toEqual(['completed', 'completed', 'ended_early', 'skipped', 'not_started']);
    expect(`${stages[2].label}${stages[2].srSuffix}`).toBe('Breathe, ended early');
    expect(`${stages[3].label}${stages[3].srSuffix}`).toBe('Meditate, skipped');
    expect(`${stages[4].label}${stages[4].srSuffix}`).toBe('Rest, not started');
  });

  it('completed/skipped/ended-early each render the correct StageOutcomeBadge (additive, not a replacement) with journeyTone="evening"', () => {
    const stages = collectStages(
      EveningJourneyPathway({ stages: stagesWithStatus(['completed', 'skipped', 'ended_early', 'current', 'not_started']) }).props.children
    );
    expect(stages[0]).toMatchObject({ badgeType: StageOutcomeBadge, badgeStatus: 'completed', badgeTone: 'evening' });
    expect(stages[1]).toMatchObject({ badgeType: StageOutcomeBadge, badgeStatus: 'skipped', badgeTone: 'evening' });
    expect(stages[2]).toMatchObject({ badgeType: StageOutcomeBadge, badgeStatus: 'ended_early', badgeTone: 'evening' });
    expect(stages[3]).toMatchObject({ badgeType: StageOutcomeBadge, badgeStatus: 'current' });
  });

  it('"current" changes the main badge\'s ring/highlight class, never the icon glyph', () => {
    const stages = collectStages(
      EveningJourneyPathway({ stages: stagesWithStatus(['not_started', 'not_started', 'not_started', 'not_started', 'current']) }).props.children
    );
    expect(stages[4].iconGlyph).toBe('bedtime');
    expect(stages[4].badgeClass).toMatch(/border-evening-accent(?!-tint)/);
    expect(stages[0].badgeClass).not.toMatch(/border-evening-accent(?!-tint)/);
  });

  it('uses only existing evening-accent tokens - no raw hex, never Morning gold', () => {
    const source = EveningJourneyPathway.toString();
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(source).not.toMatch(/morning-accent/);
  });

  it('exact sr-only suffixes are preserved for screen readers, matching the Phase 9 spec\'s own named examples', () => {
    const stages = collectStages(
      EveningJourneyPathway({ stages: stagesWithStatus(['not_started', 'skipped', 'not_started', 'not_started', 'current']) }).props.children
    );
    expect(`${stages[1].label}${stages[1].srSuffix}`).toBe('Gratitude, skipped');
    expect(`${stages[4].label}${stages[4].srSuffix}`).toBe('Rest, current');
  });

  it('EVENING_PATHWAY_STAGES names the real session step id(s) each display stage represents - "rest" covers both sleepPreparation and completion', () => {
    expect(EVENING_PATHWAY_STAGES.map((s) => s.stepIds)).toEqual([
      ['reflection'],
      ['gratitude'],
      ['breathing'],
      ['meditation'],
      ['sleepPreparation', 'completion']
    ]);
  });
});

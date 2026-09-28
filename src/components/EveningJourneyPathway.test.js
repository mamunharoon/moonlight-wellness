// Evening Visual Uplift (Phase 7), Phase 9 — Truthful Journey Outcomes —
// EveningJourneyPathway, real execution. This repo's Vitest runs with
// environment: 'node' (no DOM/jsdom), but a React component is still a
// plain function: calling it directly returns a real element tree.
//
// Phase 7 established the honesty contract (genuine icon always visible,
// completion/skip only ever an additive corner badge); Phase 9 makes it
// real by unifying on the shared `stages` prop (session/stageStatus.js's
// computeStageStatus() output shape, the same shape
// MorningJourneyPathway.jsx now also consumes) and adding 'ended_early'
// support.
import { describe, it, expect } from 'vitest';
import { EveningJourneyPathway } from './EveningJourneyPathway';
import { EVENING_PATHWAY_STAGES } from '../session/pathwayStages';
import { StageOutcomeBadge } from './journey/StageOutcomeBadge';

const REAL_ICONS = ['chat_bubble', 'favorite', 'air', 'self_improvement', 'bedtime'];
const REAL_LABELS = ['Reflect', 'Gratitude', 'Breathe', 'Meditate', 'Rest'];

const stagesWithStatus = (statuses) =>
  EVENING_PATHWAY_STAGES.map(({ id, label, icon }, idx) => ({ id, label, icon, status: statuses[idx] }));

const collectStages = (element) => {
  const listItems = element.props.children.filter((child) => child?.props?.role === 'listitem');
  return listItems.map((item) => {
    const [iconCol] = item.props.children;
    const [iconBadge, labelSpan] = iconCol.props.children;
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

  it('is a real accessible list (role="list" on the root, role="listitem" per stage) with an aria-label naming the full sequence', () => {
    expect(element.props.role).toBe('list');
    expect(element.props['aria-label']).toBe('Evening Wind-Down stages: Reflect, Gratitude, Breathe, Meditate, Rest');
  });

  it('320px structural safety: the outer wrapper is horizontally scrollable', () => {
    expect(outer.props.className).toMatch(/overflow-x-auto/);
  });

  it('every icon is aria-hidden - the visible text label is the only accessible name for each stage', () => {
    for (const s of stages) expect(s.iconAriaHidden).toBe('true');
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

  it('every outcome badge is the shared StageOutcomeBadge with journeyTone="evening" - additive, never a replacement of the icon', () => {
    const stages = collectStages(
      EveningJourneyPathway({ stages: stagesWithStatus(['completed', 'not_started', 'not_started', 'not_started', 'not_started']) }).props.children
    );
    expect(stages[0]).toMatchObject({ badgeType: StageOutcomeBadge, badgeStatus: 'completed', badgeTone: 'evening' });
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

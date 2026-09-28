// Phase 9 — Truthful Journey Outcomes: StageOutcomeBadge, real execution.
// This repo's Vitest runs with environment: 'node' - a React component is
// still a plain function, so calling it directly and inspecting the
// returned element tree (or null) proves real rendered behaviour, not
// just that a source string exists.
import { describe, it, expect } from 'vitest';
import { StageOutcomeBadge } from './StageOutcomeBadge';
import { STAGE_STATUS_SR_TEXT } from '../../session/stageStatus';

describe('StageOutcomeBadge - renders nothing for not_started/current (additive-only badge)', () => {
  it('not_started renders null - no corner glyph, no colour, nothing', () => {
    expect(StageOutcomeBadge({ status: 'not_started', journeyTone: 'morning' })).toBeNull();
  });

  it('current renders null - "current" is communicated by the caller\'s own ring/highlight on the main icon, never a corner badge', () => {
    expect(StageOutcomeBadge({ status: 'current', journeyTone: 'evening' })).toBeNull();
  });
});

describe('StageOutcomeBadge - completed/skipped/ended_early each render a distinct glyph, never colour alone', () => {
  it('completed renders a "check" glyph', () => {
    const el = StageOutcomeBadge({ status: 'completed', journeyTone: 'morning' });
    expect(el.props['aria-hidden']).toBe('true');
    expect(el.props.children.props.children).toBe('check');
  });

  it('skipped renders a "remove" (dash) glyph, never "check"', () => {
    const el = StageOutcomeBadge({ status: 'skipped', journeyTone: 'morning' });
    expect(el.props.children.props.children).toBe('remove');
  });

  it('ended_early renders a "pause" glyph, distinct from both completed and skipped', () => {
    const el = StageOutcomeBadge({ status: 'ended_early', journeyTone: 'morning' });
    expect(el.props.children.props.children).toBe('pause');
  });

  it('the three glyphs are all different from one another', () => {
    const glyphs = ['completed', 'skipped', 'ended_early'].map(
      (status) => StageOutcomeBadge({ status, journeyTone: 'morning' }).props.children.props.children
    );
    expect(new Set(glyphs).size).toBe(3);
  });
});

describe('StageOutcomeBadge - colour: completed uses the real journey accent token, skipped/ended_early stay muted/neutral', () => {
  it('morning completed uses bg-morning-accent (gold); evening completed uses bg-evening-accent (periwinkle) - no raw hex, never the other journey\'s colour', () => {
    const morning = StageOutcomeBadge({ status: 'completed', journeyTone: 'morning' });
    const evening = StageOutcomeBadge({ status: 'completed', journeyTone: 'evening' });
    expect(morning.props.className).toMatch(/bg-morning-accent\b/);
    expect(morning.props.className).not.toMatch(/bg-evening-accent|#[0-9a-fA-F]{3,8}/);
    expect(evening.props.className).toMatch(/bg-evening-accent\b/);
    expect(evening.props.className).not.toMatch(/bg-morning-accent|#[0-9a-fA-F]{3,8}/);
  });

  it('skipped and ended_early both render the same muted/neutral tone regardless of journeyTone - "muted but readable", not a bright accent', () => {
    const skipped = StageOutcomeBadge({ status: 'skipped', journeyTone: 'morning' });
    const endedEarly = StageOutcomeBadge({ status: 'ended_early', journeyTone: 'evening' });
    expect(skipped.props.className).toMatch(/surface-container-lowest/);
    expect(endedEarly.props.className).toMatch(/surface-container-lowest/);
    expect(skipped.props.className).not.toMatch(/bg-morning-accent|bg-evening-accent/);
    expect(endedEarly.props.className).not.toMatch(/bg-morning-accent|bg-evening-accent/);
  });
});

describe('STAGE_STATUS_SR_TEXT - exact screen-reader suffixes named by the Phase 9 spec', () => {
  it('matches every named example exactly: completed, skipped, ended early, current, not started', () => {
    expect(STAGE_STATUS_SR_TEXT).toEqual({
      completed: 'completed',
      current: 'current',
      skipped: 'skipped',
      ended_early: 'ended early',
      not_started: 'not started'
    });
  });
});

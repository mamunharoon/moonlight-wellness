// Evening Visual Uplift (Phase 7) — EveningJourneyPathway. No DOM
// rendering available in this repo's Vitest - source-level checks,
// matching this codebase's own established precedent (see e.g.
// AnswerOptionButton.test.js).
//
// These tests exist specifically to prove the mid-turn "Evening pathway
// state clarification" correction is honoured: genuine stage icons are
// ALWAYS the primary visual (never replaced by a checkmark), a secondary
// completed/skipped badge only ever appears from an EXPLICIT, externally-
// supplied `stageStatus` map, and completed/skipped is never inferred
// merely from `currentStageId`'s own position among the 5 stages.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const source = read('./EveningJourneyPathway.jsx');
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('EveningJourneyPathway - genuine stage icons are always the primary visual', () => {
  it('renders all 5 real stage icons unconditionally in STAGES, never behind a completed/current ternary', () => {
    expect(code).toMatch(/\{ id: 'reflect', label: 'Reflect', icon: 'chat_bubble' \}/);
    expect(code).toMatch(/\{ id: 'gratitude', label: 'Gratitude', icon: 'favorite' \}/);
    expect(code).toMatch(/\{ id: 'breathe', label: 'Breathe', icon: 'air' \}/);
    expect(code).toMatch(/\{ id: 'meditate', label: 'Meditate', icon: 'spa' \}/);
    expect(code).toMatch(/\{ id: 'rest', label: 'Rest', icon: 'bedtime' \}/);
  });

  it('the main badge always renders stage.icon - there is no conditional swapping it for a checkmark/tick icon', () => {
    // The main badge span renders {stage.icon} unconditionally; only an
    // ADDITIVE absolutely-positioned corner span (checked separately
    // below) ever renders a checkmark, never replacing this one.
    expect(code).toMatch(/<span className="material-symbols-outlined text-sm" aria-hidden="true">\{stage\.icon\}<\/span>/);
    // No ternary anywhere swaps the main icon for 'check' or 'check_circle'.
    expect(code).not.toMatch(/stage\.icon\s*:\s*'check/);
    expect(code).not.toMatch(/isCompleted\s*\?\s*'check/);
  });
});

describe('EveningJourneyPathway - completed/skipped are only ever driven by an explicit stageStatus prop', () => {
  it('isCompleted/isSkipped are derived only from stageStatus?.[stage.id], never from currentStageId or the stage\'s own index', () => {
    expect(code).toMatch(/const status = stageStatus\?\.\[stage\.id\] \?\? null;/);
    expect(code).toMatch(/const isCompleted = status === 'completed';/);
    expect(code).toMatch(/const isSkipped = status === 'skipped';/);
    // Neither derivation references idx, currentStageId, or STAGES
    // position - the one thing the mid-turn correction explicitly
    // forbids ("do not infer completion merely because the user
    // advanced to a later route").
    const isCompletedLine = code.match(/const isCompleted = .*/)?.[0] ?? '';
    const isSkippedLine = code.match(/const isSkipped = .*/)?.[0] ?? '';
    expect(isCompletedLine).not.toMatch(/currentStageId|idx/);
    expect(isSkippedLine).not.toMatch(/currentStageId|idx/);
  });

  it('stageStatus defaults to null - with no stageStatus supplied at all (today\'s real callers), no stage can ever show a completed/skipped badge', () => {
    expect(source).toMatch(/stageStatus = null/);
  });

  it('a genuine completion (stageStatus: { reflect: \'completed\' }) shows the secondary check badge as an ADDITIVE overlay, not a replacement', () => {
    const completedBlock = code.match(/\{isCompleted && \([\s\S]*?\)\}/)?.[0] ?? '';
    expect(completedBlock).toMatch(/check/);
    expect(completedBlock).toMatch(/absolute -bottom-1 -right-1/); // corner overlay, not the main badge
  });

  it('a reliably-known skipped stage (stageStatus: { breathe: \'skipped\' }) shows a muted dash/remove badge, never a checkmark', () => {
    const skippedBlock = code.match(/\{isSkipped && \([\s\S]*?\)\}/)?.[0] ?? '';
    expect(skippedBlock).toMatch(/remove/);
    expect(skippedBlock).not.toMatch(/check/);
  });

  it('accessible text announces completed/skipped/current distinctly, e.g. "Breathe, skipped" via sr-only suffixes on the real label', () => {
    expect(code).toMatch(/\{isCompleted && <span className="sr-only">, completed<\/span>\}/);
    expect(code).toMatch(/\{isSkipped && <span className="sr-only">, skipped<\/span>\}/);
    expect(code).toMatch(/\{isCurrent && <span className="sr-only">, current<\/span>\}/);
  });
});

describe('EveningJourneyPathway - currentStageId (the one genuinely reliable signal) drives the ring/highlight independently', () => {
  it('isCurrent is a simple equality check against currentStageId - the only position-derived signal this component trusts, and it never touches isCompleted/isSkipped', () => {
    expect(code).toMatch(/const isCurrent = stage\.id === currentStageId;/);
  });

  it('the current stage keeps its genuine icon too - isCurrent only changes badge/label CSS classes, never the rendered icon glyph', () => {
    const badgeClassBlock = code.match(/const badgeClass = isCurrent[\s\S]*?;/)?.[0] ?? '';
    expect(badgeClassBlock).not.toMatch(/icon:|stage\.icon/);
  });
});

describe('EveningJourneyPathway - structural safety', () => {
  it('wraps in overflow-x-auto scroll-hide, matching MorningJourneyPathway.jsx\'s own 320px safety pattern', () => {
    expect(source).toMatch(/overflow-x-auto scroll-hide/);
  });

  it('uses only existing evening-accent/on-evening-accent/surface tokens - no raw hex, no new colour tokens', () => {
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(code).toMatch(/evening-accent/);
  });

  it('exposes a real accessible list structure (role="list"/"listitem") with a descriptive aria-label naming all 5 stages', () => {
    expect(source).toMatch(/role="list" aria-label="Evening Wind-Down stages: Reflect, Gratitude, Breathe, Meditate, Rest"/);
    expect(source).toMatch(/role="listitem"/);
  });
});

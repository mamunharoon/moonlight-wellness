// "Your Momentum" foundation, Phase 3 — source-level regression guard for
// MomentumPanel.jsx (no DOM rendering available in this repo's Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./MomentumPanel.jsx', import.meta.url)), 'utf-8');
const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('MomentumPanel — renders nothing for an untracked activity (no insight, no milestone)', () => {
  it('returns null immediately when both insight and milestone are absent', () => {
    expect(source).toMatch(/if \(!insight && !milestone\) return null;/);
  });
});

describe('MomentumPanel — accessibility order: insight before milestone', () => {
  it('the insight paragraph appears before the milestone block in source order', () => {
    const insightIdx = source.indexOf('{insight &&');
    const milestoneIdx = source.indexOf('{milestone &&');
    expect(insightIdx).toBeGreaterThan(-1);
    expect(milestoneIdx).toBeGreaterThan(insightIdx);
  });
});

describe('MomentumPanel — no live region added (nothing to re-announce; avoids double-announcing alongside a caller\'s own status region)', () => {
  it('never sets aria-live or role="status" anywhere', () => {
    expect(codeOnly).not.toMatch(/aria-live|role="status"/);
  });
});

describe('MomentumPanel — factual insight meets the approved minimum text size', () => {
  it('uses text-base (16px), never a smaller text-xs/text-sm for the insight line itself', () => {
    const insightBlock = source.match(/\{insight && \([\s\S]*?\)\}/)?.[0] ?? '';
    expect(insightBlock).toMatch(/text-base/);
  });
});

describe('MomentumPanel — milestone label copy is exactly "A Gentle Milestone"', () => {
  it('renders the exact approved label text', () => {
    expect(source).toMatch(/A Gentle Milestone/);
  });

  it('the supporting line is optional - only rendered when the milestone actually provides one', () => {
    expect(source).toMatch(/\{milestone\.supportingLine && \(/);
  });
});

describe('MomentumPanel — journey tone reuses only existing, already-approved tokens', () => {
  it('the tone lookup covers morning/evening/anytime using the exact existing -tint border tokens, never a new colour', () => {
    expect(source).toMatch(/morning: \{ border: 'border-morning-accent-tint\/25', label: 'text-morning-accent' \}/);
    expect(source).toMatch(/evening: \{ border: 'border-evening-accent-tint\/25', label: 'text-evening-accent' \}/);
    expect(source).toMatch(/anytime: \{ border: 'border-tertiary-tint\/25', label: 'text-tertiary' \}/);
  });

  it('an unrecognised/missing journeyTone falls back to a safe default, never crashes', () => {
    expect(source).toMatch(/const DEFAULT_TONE = /);
    expect(source).toMatch(/MILESTONE_TONE_CLASSES\[milestone\.journeyTone\] \?\? DEFAULT_TONE/);
  });
});

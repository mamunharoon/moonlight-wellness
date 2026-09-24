// Morning Visual Uplift (Build 16) — Home.jsx's Morning card. Consolidates
// proof that the new gold/Playfair treatment applies to Morning's own
// four card states only, while Evening's and Anytime's cards (which
// share the same `nextStepCardBody` helper and the same card-shell
// className shape) are provably byte-for-byte unaffected.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./Home.jsx');

describe('Home.jsx — nextStepCardBody stays one shared function, isMorning is additive', () => {
  it('isMorning defaults to false - every pre-existing Evening call site that omits it renders exactly the original peach eyebrow/plain heading', () => {
    expect(source).toMatch(/const nextStepCardBody = \(card, stepProgressLabel, isMorning = false\) => \(/);
  });

  it('the eyebrow chip branches on isMorning between morning-accent gold and the original primary peach - never a third colour, never gold for the false branch', () => {
    expect(source).toMatch(/isMorning \? 'bg-morning-accent\/10 border border-morning-accent\/30 text-morning-accent' : 'bg-primary\/10 border border-primary\/20 text-primary'/);
  });

  it('the heading branches on isMorning between the new Playfair Display serif and the original plain sans - the sans branch is a genuine no-op (empty string), not a second explicit class list that could drift', () => {
    expect(source).toMatch(/\$\{isMorning \? 'font-morning-display italic' : ''\}/);
  });
});

describe('Home.jsx — Evening\'s three nextStepCardBody call sites never pass isMorning', () => {
  it('eveningNotStartedCard/eveningInProgressCard/eveningCompletedCard calls are exactly as before this phase - 1 or 2 arguments, never a third', () => {
    expect(source).toMatch(/nextStepCardBody\(eveningNotStartedCard\)/);
    expect(source).toMatch(/nextStepCardBody\(eveningInProgressCard, resolveStepLabel\(RITUAL_SESSION_IDS\.evening, eveningResolvedStepIndex\)\)/);
    expect(source).toMatch(/nextStepCardBody\(eveningCompletedCard\)/);
  });

  it('none of the three real evening card shells (checked by their own distinct style attribute) picked up morning-accent border/glow classes', () => {
    const eveningBlock = source.match(/\{activePeriod === 'evening' && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    expect(eveningBlock.length).toBeGreaterThan(0);
    expect(eveningBlock).not.toMatch(/morning-accent|morning-display|shadow-morning-glow/);
  });
});

describe('Home.jsx — Anytime\'s card never picked up Morning gold/Playfair either', () => {
  it('the Anytime block (a single, always-peach "available anytime" card, no start/pause/complete state) is untouched', () => {
    const anytimeBlock = source.match(/\{activePeriod === 'anytime' && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    expect(anytimeBlock.length).toBeGreaterThan(0);
    expect(anytimeBlock).toMatch(/border-primary\/20 shadow-sm/);
    expect(anytimeBlock).not.toMatch(/morning-accent|morning-display|shadow-morning-glow/);
  });
});

describe('Home.jsx — Morning\'s four card states all render the gold/Playfair treatment', () => {
  it('all three nextStepCardBody Morning call sites pass isMorning=true', () => {
    expect(source).toMatch(/nextStepCardBody\(morningNotStartedCard, undefined, true\)/);
    expect(source).toMatch(/nextStepCardBody\(morningInProgressCard, resolveStepLabel\(RITUAL_SESSION_IDS\.morning, morningResolvedStepIndex\), true\)/);
    expect(source).toMatch(/nextStepCardBody\(morningCompletedCard, undefined, true\)/);
  });

  it('all four Morning card shells (stale-choice, not-started, in-progress, completed) use the morning-accent border and the sparing morning-glow shadow, never the generic shadow-sm', () => {
    const morningBlock = source.match(/\{activePeriod === 'morning' && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    const shellMatches = morningBlock.match(/className="glass-panel p-6 rounded-3xl[^"]*"/g) ?? [];
    expect(shellMatches.length).toBe(4);
    for (const cls of shellMatches) {
      expect(cls).toMatch(/border-morning-accent\//);
      expect(cls).toMatch(/shadow-morning-glow/);
      expect(cls).not.toMatch(/shadow-sm\b/);
    }
  });

  it('the stale-choice card\'s own separate "Rise & Reset" badge and heading (outside nextStepCardBody) also use morning-accent gold and Playfair', () => {
    expect(source).toMatch(/bg-morning-accent\/10 border border-morning-accent\/30 text-morning-accent text-\[10px\] font-bold uppercase tracking-wider">\s*\n\s*Rise &amp; Reset/);
    expect(source).toMatch(/text-xl font-bold leading-tight text-on-surface pt-2 font-morning-display italic/);
  });

  it('every Morning primary CTA ("Resume Previous Routine", "Start Today\'s Routine", the not-started/in-progress buttonLabel) still uses bg-primary - the approved canonical tokens keep primary action buttons peach app-wide, gold is reserved for progress/icons/active highlights only', () => {
    const morningBlock = source.match(/\{activePeriod === 'morning' && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    const ctaButtons = morningBlock.match(/onClick=\{handle(ResumeStaleMorning|MorningAction)\}[\s\S]{0,300}?className="[^"]*"/g) ?? [];
    expect(ctaButtons.length).toBeGreaterThanOrEqual(2);
    for (const button of ctaButtons) {
      expect(button).toMatch(/bg-primary text-on-primary/);
    }
  });
});

describe('Home.jsx — Today\'s Rhythm pill row is untouched by this phase', () => {
  it('still the one shared role="tablist" block, Morning\'s active tab still the same bg-morning-accent token it already had from Build 15/16', () => {
    expect(source).toMatch(/role="tablist" aria-label="Today's rhythm"/);
    expect(source).toMatch(/bg-morning-accent text-on-morning-accent border-morning-accent shadow-sm/);
  });
});

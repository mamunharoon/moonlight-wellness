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

describe('Home.jsx — nextStepCardBody stays one shared function, period is additive (Home Visual Uplift: isMorning boolean generalised to a period string)', () => {
  it('period defaults to \'anytime\' - every pre-existing Evening call site that omitted a third arg keeps its own real, distinct evening treatment (not silently the anytime one) because every real Evening call site now explicitly passes \'evening\'', () => {
    expect(source).toMatch(/const nextStepCardBody = \(card, stepProgressLabel, period = 'anytime'\) => \{/);
  });

  it('the eyebrow chip branches three ways: morning-accent gold, evening-accent periwinkle, or the original primary peach default - never a fourth colour', () => {
    expect(source).toMatch(/isMorningPeriod\s*\n\s*\? 'bg-morning-accent\/10 border border-morning-accent\/30 text-morning-accent'\s*\n\s*: isEveningPeriod\s*\n\s*\? 'bg-evening-accent\/10 border border-evening-accent\/30 text-evening-accent'\s*\n\s*: 'bg-primary\/10 border border-primary\/20 text-primary'/);
  });

  it('the heading branches three ways: Playfair Display for Morning, Newsreader (font-serif) italic for Evening, plain sans (empty string) for anytime/default', () => {
    expect(source).toMatch(/isMorningPeriod \? 'font-morning-display italic' : isEveningPeriod \? 'font-serif italic' : ''/);
  });
});

describe('Home.jsx — Evening\'s three nextStepCardBody call sites now explicitly pass \'evening\' (Home Visual Uplift correction: Evening previously got no period at all, silently rendering the generic anytime/peach treatment)', () => {
  it('eveningNotStartedCard/eveningInProgressCard/eveningCompletedCard calls all pass a third \'evening\' argument', () => {
    expect(source).toMatch(/nextStepCardBody\(eveningNotStartedCard, undefined, 'evening'\)/);
    expect(source).toMatch(/nextStepCardBody\(eveningInProgressCard, resolveStepLabel\(RITUAL_SESSION_IDS\.evening, eveningResolvedStepIndex\), 'evening'\)/);
    expect(source).toMatch(/nextStepCardBody\(eveningCompletedCard, undefined, 'evening'\)/);
  });

  it('none of the three real evening card shells (checked by their own distinct style attribute) picked up morning-accent border/glow classes', () => {
    const eveningBlock = source.match(/\{activePeriod === 'evening' && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    expect(eveningBlock.length).toBeGreaterThan(0);
    expect(eveningBlock).not.toMatch(/morning-accent|morning-display|shadow-morning-glow/);
  });
});

describe('Home.jsx — Anytime\'s card never picked up Morning gold/Playfair either', () => {
  it('the Anytime block (a single "available anytime" card, no start/pause/complete state) never picks up Morning\'s own gold/Playfair/glow treatment - it now carries its own mint identity instead (Anytime Reset Visual Uplift, Phase 2, decision B)', () => {
    const anytimeBlock = source.match(/\{activePeriod === 'anytime' && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    expect(anytimeBlock.length).toBeGreaterThan(0);
    expect(anytimeBlock).toMatch(/border-tertiary-tint\/40 shadow-mint-glow/);
    // Comments (which legitimately name morning-accent/morning-tint in
    // prose explaining what this card no longer reuses) are stripped
    // first - only the real applied classNames/styles are checked.
    const codeOnly = anytimeBlock.replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/morning-accent|morning-display|shadow-morning-glow|--color-morning-tint/);
  });
});

describe('Home.jsx — Morning\'s four card states all render the gold/Playfair treatment', () => {
  it('all three nextStepCardBody Morning call sites pass period=\'morning\'', () => {
    expect(source).toMatch(/nextStepCardBody\(morningNotStartedCard, undefined, 'morning'\)/);
    expect(source).toMatch(/nextStepCardBody\(morningInProgressCard, resolveStepLabel\(RITUAL_SESSION_IDS\.morning, morningResolvedStepIndex\), 'morning'\)/);
    expect(source).toMatch(/nextStepCardBody\(morningCompletedCard, undefined, 'morning'\)/);
  });

  it('all four Morning card shells (stale-choice, not-started, in-progress, completed) use the morning-accent border and the sparing morning-glow shadow, never the generic shadow-sm', () => {
    const morningBlock = source.match(/\{activePeriod === 'morning' && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    const shellMatches = morningBlock.match(/className="glass-panel p-5 rounded-3xl[^"]*"/g) ?? [];
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

  // WakeWise DEV — journey-aware primary action colour: Morning's own
  // primary progress CTAs (Resume Previous Routine, the not-started/
  // in-progress buttonLabel) now use the shared getJourneyPrimaryActionClasses
  // helper resolved to 'morning' (bg-morning-accent text-on-morning-accent)
  // instead of the generic peach bg-primary - the earlier "primary action
  // buttons stay peach app-wide" decision this test used to pin is exactly
  // what the later approved journey-colour pass reversed. Secondary
  // actions in the same block ("Start Today's Routine", "Start Over") are
  // untouched - still glass-panel, checked separately below.
  it('every Morning primary CTA ("Resume Previous Routine", the not-started/in-progress buttonLabel) resolves to the shared journey-action helper with journey=\'morning\'', () => {
    const morningBlock = source.match(/\{activePeriod === 'morning' && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    const ctaButtons = morningBlock.match(/onClick=\{handle(ResumeStaleMorning|MorningAction)\}[\s\S]{0,300}?className=\{`[^`]*`\}/g) ?? [];
    expect(ctaButtons.length).toBeGreaterThanOrEqual(2);
    for (const button of ctaButtons) {
      expect(button).toMatch(/getJourneyPrimaryActionClasses\('morning'\)/);
    }
  });

  it('Morning\'s own secondary actions ("Start Today\'s Routine", "Start Over") stay the original neutral glass-panel treatment, never recoloured', () => {
    const morningBlock = source.match(/\{activePeriod === 'morning' && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    const secondaryButtons = morningBlock.match(/onClick=\{[^}]*(discard-stale|start-over)[^}]*\}[\s\S]{0,300}?className="[^"]*"/g) ?? [];
    expect(secondaryButtons.length).toBeGreaterThanOrEqual(2);
    for (const button of secondaryButtons) {
      expect(button).toMatch(/glass-panel text-on-surface-variant/);
      expect(button).not.toMatch(/getJourneyPrimaryActionClasses/);
    }
  });
});

describe('Home.jsx — Today\'s Rhythm pill row is untouched by this phase', () => {
  it('still the one shared role="tablist" block, Morning\'s active tab still the same bg-morning-accent token it already had from Build 15/16 (now with the sparing morning-glow shadow, Home Visual Uplift compact treatment, in place of the old generic shadow-sm)', () => {
    expect(source).toMatch(/role="tablist" aria-label="Today's rhythm"/);
    expect(source).toMatch(/bg-morning-accent text-on-morning-accent border-morning-accent shadow-morning-glow/);
  });
});

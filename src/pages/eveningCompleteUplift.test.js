// Evening Visual Uplift (Build 17) — EveningComplete.jsx gains a
// periwinkle icon-ring badge and eyebrow, mirroring SessionComplete.jsx's
// own Morning-gold circular treatment. This file proves the visual change
// is additive-only: the four real completion actions (order, labels,
// handlers, guest gating) and the Redo confirmation dialog are completely
// untouched.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./EveningComplete.jsx', import.meta.url)), 'utf-8');

describe('EveningComplete.jsx — periwinkle icon ring + eyebrow', () => {
  it('the bedtime icon is now wrapped in a circular evening-accent badge (bg-evening-accent/10 border-evening-accent-tint/25 shadow-evening-glow)', () => {
    expect(source).toMatch(
      /<span className="w-16 h-16 rounded-full bg-evening-accent\/10 border border-evening-accent-tint\/25 shadow-evening-glow flex items-center justify-center">\s*\n\s*<span className="material-symbols-outlined text-evening-accent text-3xl">bedtime<\/span>\s*\n\s*<\/span>/
    );
  });

  it('Evening Visual Uplift (Phase 7) — the former "Step 7 of 7" eyebrow is replaced by a "100% Complete" badge, still evening-accent, never the generic peach primary', () => {
    expect(source).not.toMatch(/Step 7 of 7/);
    expect(source).toMatch(/text-evening-accent uppercase font-bold tracking-wider">\s*\n\s*<span className="material-symbols-outlined text-xs" aria-hidden="true">check_circle<\/span>\s*\n\s*100% Complete/);
  });

  it('the heading still uses the exact original Newsreader italic styling; the text itself now rotates via outcomeMessages.js (WakeWise Phase 2, B6 - see eveningCompleteOutcomeMessages.test.js)', () => {
    expect(source).toMatch(/<h1 className="font-serif italic text-3xl text-on-surface">\{headline\}<\/h1>/);
  });
});

describe('EveningComplete.jsx — all four real actions are unchanged: order, labels, handlers, guest gating', () => {
  it('Evening Visual Uplift (Phase 7) — the four actions appear in the newly-approved order: Sleep Experience, Return Home, Review/Edit, Redo', () => {
    // Scoped to only the actual `return (` JSX block, not the whole file -
    // this file's own pre-existing doc comments (e.g. handleRedoTap's
    // JSDoc, which mentions "Redo Tonight's Wind-Down" in its own prose
    // well above the render) would otherwise give a false order.
    const jsxBlock = source.slice(source.indexOf('return (\n    <EveningSceneShell'));
    expect(jsxBlock.length).toBeGreaterThan(0);
    // The block's own leading doc comment names all four actions in prose
    // (explaining the reorder) before any of them actually renders -
    // each index below is searched starting just after the previous
    // action's real occurrence, so a comment mention can never be
    // mistaken for the real element.
    const sleepIdx = jsxBlock.indexOf('onClick={() => navigate(\'/library?category=sleep-soundscapes&from=evening-summary\')}');
    const homeIdx = jsxBlock.indexOf('handleReturnHome', sleepIdx);
    const reviewIdx = jsxBlock.indexOf('Review or Edit Tonight\'s Responses', homeIdx);
    const redoIdx = jsxBlock.indexOf('handleRedoTap', reviewIdx);
    expect(sleepIdx).toBeGreaterThan(-1);
    expect(homeIdx).toBeGreaterThan(sleepIdx);
    expect(reviewIdx).toBeGreaterThan(homeIdx);
    expect(redoIdx).toBeGreaterThan(reviewIdx);
  });

  it('Choose a Sleep Experience still navigates to the exact contextual Library URL', () => {
    expect(source).toMatch(/navigate\('\/library\?category=sleep-soundscapes&from=evening-summary'\)/);
  });

  it('Review/Edit and Redo remain gated behind !isGuest, exactly as before', () => {
    const guardedCount = (source.match(/\{!isGuest && \(/g) ?? []).length;
    expect(guardedCount).toBe(2); // Review/Edit block, Redo block
  });

  it('Review or Edit still opens read-only Review first (never a direct Edit link) at /review/reflection?q=1', () => {
    expect(source).toMatch(/navigate\('\/review\/reflection\?q=1'\)/);
  });

  it('the Redo confirmation dialog\'s destructive copy and handler are untouched', () => {
    expect(source).toMatch(/title="Redo tonight's Wind-Down\?"/);
    expect(source).toMatch(/confirmLabel="Delete Responses & Redo"/);
    expect(source).toMatch(/onConfirm=\{handleConfirmRedo\}/);
  });

  it('the completion-date write (shouldWriteCompletionDate guard) and its mount-effect condition are untouched', () => {
    expect(source).toMatch(/if \(state\.status === 'playing' && currentStep\?\.id === 'completion'\) \{/);
    expect(source).toMatch(/shouldWriteCompletionDate\(localStorage\.getItem\(eveningDoneKey\), attributionDateKey\)/);
  });

  // WakeWise DEV — journey-aware primary action colour: the later
  // approved journey-colour pass explicitly reversed this phase's own
  // "the primary button stays peach" decision - it now resolves to the
  // shared journey-action helper with journey='evening'. The two
  // glass-panel secondary buttons are genuinely unchanged.
  it('the primary action resolves to the evening journey-action helper; Return Home keeps its glass-panel treatment; Review/Edit is now a smaller/quieter text-only action (Evening Visual Uplift, Phase 7)', () => {
    expect(source).toMatch(/className=\{`w-full \$\{getJourneyPrimaryActionClasses\('evening'\)\} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg`\}/);
    expect(source).toMatch(/className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white\/10 active:scale-95 transition-all border-white\/10 focus-visible:ring-2 focus-visible:ring-primary"/);
    expect(source).toMatch(/className="w-full py-3 text-center text-sm font-semibold text-on-surface-variant hover:text-on-surface active:scale-95 transition-all"/);
  });
});

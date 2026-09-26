// Morning Visual Uplift (Build 16) — IntentionSetup.jsx (intro phase,
// unchanged by Phase 2). WakeWise Phase 2 (B1) then replaced the flat
// preset-selection phase with a guided two-stage ladder - the grid/
// summary assertions below were rewritten for that new structure; the
// intro-phase assertions are untouched, since the intro itself was never
// part of the ladder redesign.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./IntentionSetup.jsx');

describe('IntentionSetup — intro phase visual uplift (unchanged by the Phase 2 ladder redesign)', () => {
  it('the sun icon and "Step 1 of 5" label (Journey Embedding correction; was Step 1 of 4) use the morning-accent gold token, not the generic peach/muted tokens they used before', () => {
    expect(source).toMatch(/text-morning-accent text-3xl">wb_sunny/);
    expect(source).toMatch(/text-\[10px\] text-morning-accent uppercase font-bold tracking-wider">Step 1 of 5/);
  });

  it('the icon sits in a restrained glow circle (morning-glow shadow token, sparing per its own tailwind.config.js comment) - not an ambient/default shadow on the whole screen', () => {
    expect(source).toMatch(/bg-morning-accent\/10 border border-morning-accent\/25 shadow-morning-glow/);
  });

  it('the display heading now uses the new font-morning-display (Playfair Display) token, distinct from font-serif (Newsreader, Evening\'s own unchanged serif)', () => {
    expect(source).toMatch(/font-morning-display italic text-3xl text-on-surface">Start Your Day with Intention/);
  });

  it('the real copy is preserved exactly, byte for byte - no Stitch reword, no invented "Mindful Ground" step name, no fabricated duration estimate', () => {
    expect(source).toMatch(/We'll begin by setting an intention for today, then move gently through stretching, grounding, and a closing affirmation to carry with you\./);
    expect(source).toMatch(/Move at your own pace and skip anything that doesn't feel right this morning\./);
    expect(source).not.toMatch(/Mindful Ground/);
    expect(source).not.toMatch(/4–5 min|4-5 min/);
  });

  it('"Begin My Morning" resolves to the shared journey-action helper with journey=\'morning\' (gold, not peach), with the sparing glow kept', () => {
    expect(source).toMatch(/\$\{getJourneyPrimaryActionClasses\('morning'\)\} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-morning-glow/);
    expect(source).toMatch(/<span>Begin My Morning<\/span>/);
  });
});

describe('IntentionSetup — WakeWise Phase 2 guided ladder: morning-accent identity preserved across every stage', () => {
  it('the "Your Intentions" eyebrow and every stage heading use morning-accent/Playfair', () => {
    expect(source).toMatch(/text-xs text-morning-accent uppercase tracking-widest font-bold">Your Intentions/);
    const headings = source.match(/text-on-surface font-morning-display italic outline-none">\s*\n\s*[^\n]+\s*\n\s*<\/h2>/g) ?? [];
    expect(headings.length).toBe(3); // primary, supporting, summary
  });

  it('Stage 1/2 selection grids use SelectionChip with accent="morning" (the same already-approved gold tokens the former raw preset buttons used)', () => {
    const morningAccentUses = source.match(/accent="morning"/g) ?? [];
    expect(morningAccentUses.length).toBe(2); // one grid per stage
  });

  it('the Summary card and its icons keep the morning-accent identity (never recoloured peach/mint/generic)', () => {
    const summaryBlock = source.match(/<div className="glass-panel rounded-2xl p-6[\s\S]*?\n {8}<\/div>\s*\n {6}\)\}/)?.[0] ?? '';
    expect(summaryBlock).toMatch(/text-morning-accent/);
  });

  it('the custom-intention inputs and their Add buttons are untouched - controls stay in the established sans-serif/peach identity, not recoloured gold', () => {
    expect(source).toMatch(/focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent/);
    expect(source).toMatch(/bg-primary-container text-on-primary-container text-xs font-bold uppercase tracking-wider active:scale-95 disabled:opacity-40/);
  });

  it('Set My Intention/Skip/Exit controls are all still the plain bg-primary or glass-panel treatment - never gold, matching the approved canonical tokens', () => {
    const controlsBlock = source.match(/<div className="space-y-3 w-full">\s*\n\s*\{\/\*[\s\S]*?\n {6}<\/div>\s*\n {8}<\/>\s*\n {6}\)\}/)?.[0] ?? '';
    expect(controlsBlock.length).toBeGreaterThan(0);
    expect(controlsBlock).not.toMatch(/morning-accent|morning-display/);
  });
});

describe('IntentionSetup — real functional contract untouched by the Phase 2 ladder redesign', () => {
  it('Set My Intention (Summary) and Skip (Stage 1/2) both still call the same handleComplete (F1: with opposite explicit confirmed arguments), which always advances to Stretch next - the one canonical step order, no conditional skip branch reintroduced', () => {
    expect(source).toMatch(/onClick=\{\(\) => handleComplete\(true\)\}[\s\S]{0,80}disabled=\{isSaving \|\| intentions\.length === 0\}/);
    expect(source).toMatch(/onClick=\{\(\) => handleComplete\(false\)\}[\s\S]{0,40}disabled=\{isSaving\}/);
    expect(source).toMatch(/setJourneyStep\('stretch'\);\s*\n\s*navigate\('\/morning-flow'\);/);
  });

  it('Review Mode banner/return-to-step and Exit routine are still present, unchanged; BackButton fallback still points at Home directly', () => {
    expect(source).toMatch(/<ReviewModeBanner currentStepLabel=\{getStepLabel\(currentStep\.id\)\} onReturnToCurrentStep=\{\(\) => navigate\(routeForStep\(currentStep\.id\)\)\} \/>/);
    expect(source).toMatch(/<BackButton fallback="\/" \/>/);
  });
});

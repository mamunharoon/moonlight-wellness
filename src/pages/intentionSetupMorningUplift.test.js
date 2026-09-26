// Morning Visual Uplift (Build 16) — IntentionSetup.jsx (both phases:
// intro and the preset-selection grid). This file is Morning-exclusive
// (no other journey renders it), so every visual change here is a direct
// restyle, not a shared-component concern - this file mainly proves the
// real functional contract (copy, step order, one-or-two-item selection
// limit, custom intention, Continue/Skip/Exit) is untouched by the
// restyle, plus that the new gold/Playfair tokens are actually applied.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./IntentionSetup.jsx');

describe('IntentionSetup — intro phase visual uplift', () => {
  it('the sun icon and "Step 1 of 5" label (Journey Embedding correction; was Step 1 of 4) use the morning-accent gold token, not the generic peach/muted tokens they used before', () => {
    expect(source).toMatch(/text-morning-accent text-3xl">wb_sunny/);
    expect(source).toMatch(/text-\[10px\] text-morning-accent uppercase font-bold tracking-wider">Step 1 of 5/);
  });

  it('the icon sits in a restrained glow circle (morning-glow shadow token, sparing per its own tailwind.config.js comment) - not an ambient/default shadow on the whole screen', () => {
    expect(source).toMatch(/bg-morning-accent\/10 border border-morning-accent\/25 shadow-morning-glow/);
  });

  it('the display heading now uses the new font-morning-display (Playfair Display) token, distinct from font-serif (Newsreader, Evening\'s own unchanged serif)', () => {
    expect(source).toMatch(/font-morning-display italic text-3xl text-on-surface">Start Your Day with Intention/);
    expect(source).not.toMatch(/font-serif italic text-3xl/);
  });

  it('the real copy is preserved exactly, byte for byte - no Stitch reword, no invented "Mindful Ground" step name, no fabricated duration estimate', () => {
    expect(source).toMatch(/We'll begin by setting an intention for today, then move gently through stretching, grounding, and a closing affirmation to carry with you\./);
    expect(source).toMatch(/Move at your own pace and skip anything that doesn't feel right this morning\./);
    expect(source).not.toMatch(/Mindful Ground/);
    expect(source).not.toMatch(/4–5 min|4-5 min/);
  });

  // WakeWise DEV — journey-aware primary action colour: the later
  // approved journey-colour pass explicitly reversed this phase's own
  // "primary action buttons stay peach app-wide" decision - "Begin My
  // Morning" now resolves to the shared journey-action helper with
  // journey='morning' (bg-morning-accent text-on-morning-accent).
  it('"Begin My Morning" resolves to the shared journey-action helper with journey=\'morning\' (gold, not peach), with the sparing glow kept', () => {
    expect(source).toMatch(/\$\{getJourneyPrimaryActionClasses\('morning'\)\} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-morning-glow/);
    expect(source).toMatch(/<span>Begin My Morning<\/span>/);
  });
});

describe('IntentionSetup — preset-selection phase visual uplift', () => {
  it('the "Your Intentions" eyebrow and "Set your intention" heading use morning-accent/Playfair', () => {
    expect(source).toMatch(/text-xs text-morning-accent uppercase tracking-widest font-bold">Your Intentions/);
    expect(source).toMatch(/text-2xl font-bold text-on-surface font-morning-display italic">Set your intention/);
  });

  it('the real copy under the heading is preserved exactly', () => {
    expect(source).toMatch(/Choose one or two qualities you want to carry into today\./);
  });

  it('a selected preset card uses the warm gold selected-card treatment (bg-morning-accent tint + border + text), and its floating PRIMARY/SUPPORTING role badge is gold too', () => {
    expect(source).toMatch(/bg-morning-accent\/15 border-morning-accent text-morning-accent font-bold shadow-md shadow-morning-accent\/10/);
    expect(source).toMatch(/bg-morning-accent text-on-morning-accent text-\[9px\] font-bold uppercase tracking-wider shadow-sm/);
  });

  it('an unselected preset card is untouched - still the plain glass-panel treatment', () => {
    expect(source).toMatch(/glass-panel border-white\/5 text-on-surface-variant hover:bg-white\/10/);
  });

  it('the removable selected-intention summary chips below the grid match the same gold identity as the grid itself', () => {
    expect(source).toMatch(/bg-morning-accent\/15 border border-morning-accent text-morning-accent text-xs font-semibold/);
  });

  it('the custom-intention input and its Add button are untouched - controls stay in the established sans-serif/peach identity, not recoloured gold', () => {
    expect(source).toMatch(/focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent/);
    expect(source).toMatch(/bg-primary-container text-on-primary-container text-xs font-bold uppercase tracking-wider active:scale-95 disabled:opacity-40/);
  });

  it('Continue/Skip/Exit controls are all still the plain bg-primary or glass-panel treatment - never gold, matching the approved canonical tokens', () => {
    const controlsBlock = source.match(/<div className="space-y-3 w-full">\s*\n\s*\{\/\*[\s\S]*?\n {6}<\/div>/)?.[0] ?? '';
    expect(controlsBlock.length).toBeGreaterThan(0);
    expect(controlsBlock).not.toMatch(/morning-accent|morning-display/);
  });
});

describe('IntentionSetup — real functional contract untouched by the restyle', () => {
  it('the one-or-two-item chip-tap selection limit (toggleIntention/roleForIndex/LIMIT_MESSAGE) is still imported and used exactly as before; the custom-add path now also imports the ADD-only defect fix helper (see IntentionSetup.customIntentionFix.test.js)', () => {
    expect(source).toMatch(/import \{\s*\n\s*toggleIntention,\s*\n\s*addCustomIntention,\s*\n\s*roleForIndex,\s*\n\s*LIMIT_MESSAGE,\s*\n\s*CUSTOM_LIMIT_MESSAGE,\s*\n\s*DUPLICATE_INTENTION_MESSAGE\s*\n\s*\} from '\.\.\/lib\/intentionSelection';/);
    expect(source).toMatch(/const \{ intentions: next, limitReached \} = toggleIntention\(intentions, value\);/);
  });

  it('Continue and Skip both still call the same handleComplete (F1: with opposite explicit confirmed arguments), which always advances to Stretch next - the one canonical step order, no conditional skip branch reintroduced', () => {
    expect(source).toMatch(/onClick=\{\(\) => handleComplete\(true\)\}[\s\S]{0,80}disabled=\{isSaving \|\| intentions\.length === 0\}/);
    expect(source).toMatch(/onClick=\{\(\) => handleComplete\(false\)\}[\s\S]{0,40}disabled=\{isSaving\}/);
    expect(source).toMatch(/setJourneyStep\('stretch'\);\s*\n\s*navigate\('\/morning-flow'\);/);
  });

  it('Review Mode banner/return-to-step and Exit routine are still present, unchanged; BackButton fallback now points at Home directly (Remove Routines from the Visible User Flow - /routines/rise-reset itself just redirects to Home anyway)', () => {
    expect(source).toMatch(/<ReviewModeBanner currentStepLabel=\{getStepLabel\(currentStep\.id\)\} onReturnToCurrentStep=\{\(\) => navigate\(routeForStep\(currentStep\.id\)\)\} \/>/);
    expect(source).toMatch(/<BackButton fallback="\/" \/>/);
  });
});

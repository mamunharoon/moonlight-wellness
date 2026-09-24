// Source-level regression guard for ProgressIndicator.jsx's Journey
// Embedding additions: Meditate/Meditation added to both visible-step
// sets, the compact/full responsive presentation (narrow-screen crowding
// fix), and the non-reviewable-step mechanism.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./ProgressIndicator.jsx', import.meta.url)), 'utf-8');

describe('ProgressIndicator — Meditate/Meditation added to both visible-step sets, in the correct position', () => {
  it('Morning: intention, stretch, breathe, meditate, affirmation, complete - meditate immediately after breathe', () => {
    const visibleSetLine = source.match(/^const VISIBLE_STEP_IDS_BY_SESSION = \{[\s\S]*?\n\};$/m)?.[0] ?? '';
    expect(visibleSetLine).toMatch(/\['intention', 'stretch', 'breathe', 'meditate', 'affirmation', 'complete'\]/);
  });

  it('Evening: windDown, reflection, gratitude, breathing, meditation, sleepPreparation, completion - meditation immediately after breathing', () => {
    const visibleSetLine = source.match(/^const VISIBLE_STEP_IDS_BY_SESSION = \{[\s\S]*?\n\};$/m)?.[0] ?? '';
    expect(visibleSetLine).toMatch(/\['windDown', 'reflection', 'gratitude', 'breathing', 'meditation', 'sleepPreparation', 'completion'\]/);
  });

  it('the fallback arrays match the visible sets exactly (same order, same additions)', () => {
    const fallbackLine = source.match(/^const FALLBACK_STEP_IDS_BY_SESSION = \{[\s\S]*?\n\};$/m)?.[0] ?? '';
    expect(fallbackLine).toMatch(/\['intention', 'stretch', 'breathe', 'meditate', 'affirmation', 'complete'\]/);
    expect(fallbackLine).toMatch(/\['windDown', 'reflection', 'gratitude', 'breathing', 'meditation', 'sleepPreparation', 'completion'\]/);
  });
});

describe('ProgressIndicator — non-reviewable step mechanism (meditate/meditation shown, never clickable)', () => {
  it('NON_REVIEWABLE_STEP_IDS contains exactly meditate and meditation', () => {
    expect(source).toMatch(/const NON_REVIEWABLE_STEP_IDS = new Set\(\['meditate', 'meditation'\]\);/);
  });

  it('isReviewable is false whenever the step id is in that set, regardless of onReviewStep/isCompleted - a completed Meditate step still renders (✓ + label), just never as a <button>', () => {
    const body = source.match(/const renderStep = \(step, idx\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/const isReviewable = isCompleted && onReviewStep && !NON_REVIEWABLE_STEP_IDS\.has\(step\.key\);/);
    expect(body).toMatch(/isReviewable \? \(/);
    // The non-button (plain span) branch still shows the ✓ and label -
    // confirmed by the same ternary rendering isCompleted ? '✓' : '' in
    // the else branch, unconditionally (not gated on reviewability).
    expect(body).toMatch(/\{isCompleted \? '✓' : ''\} \{step\.label\}/);
  });

  it('every OTHER step id is unaffected - the Set only ever removes reviewability for the two named ids, never anything else', () => {
    expect(source).not.toMatch(/NON_REVIEWABLE_STEP_IDS\.has\('intention'\)/);
    // Structural proof: NON_REVIEWABLE_STEP_IDS is referenced exactly once
    // (inside isReviewable) - there is no second gate anywhere else that
    // could silently affect a different step id.
    const usages = source.match(/NON_REVIEWABLE_STEP_IDS/g) ?? [];
    expect(usages.length).toBe(2); // the declaration + the one read inside isReviewable
  });
});

describe('ProgressIndicator — compact presentation below sm (640px): current stage + Step X of Y, accessible full list', () => {
  it('a compact block is sm:hidden and shows the active step\'s own label plus "Step X of Y"', () => {
    expect(source).toMatch(/<div className="flex sm:hidden items-center justify-center gap-2">/);
    expect(source).toMatch(/Step \{displayStepNumbers\[activeStep\] \?\? activeIndex \+ 1\} of \{displayStepCount \?\? steps\.length\}/);
  });

  // Regression (found live in DEV deployed verification, corrected): the
  // compact label must read Morning/Evening's own MORNING_DISPLAY_STEP_
  // NUMBERS/COUNT and EVENING_DISPLAY_STEP_NUMBERS/COUNT (sessionConstants.js
  // - the same source every other "Step X of Y" surface in the app reads
  // from, e.g. Reflection.jsx/Gratitude.jsx's own hardcoded spans), never
  // `steps.length`/`activeIndex` (the raw visible-dot array). The two
  // silently disagree for Morning specifically: Morning's dot array
  // includes the terminal 'complete' step (6 entries) but
  // MORNING_DISPLAY_STEP_COUNT deliberately excludes it (5) - deriving the
  // compact count from `steps.length` produced a real "Step 5 of 6" for
  // Affirmation on the live DEV deployment instead of the required
  // "Step 5 of 5". Evening's dot array happens to equal
  // EVENING_DISPLAY_STEP_COUNT already (both count the terminal step), so
  // this was never visibly wrong there - asserted below anyway so both
  // sessions are pinned to the same correct source, not one by coincidence.
  it('reads displayStepNumbers/displayStepCount from sessionConstants.js, branching on isEvening exactly like every other session-aware value in this file', () => {
    expect(source).toMatch(/import \{\s*\n\s*MORNING_DISPLAY_STEP_NUMBERS,\s*\n\s*MORNING_DISPLAY_STEP_COUNT,\s*\n\s*EVENING_DISPLAY_STEP_NUMBERS,\s*\n\s*EVENING_DISPLAY_STEP_COUNT\s*\n\s*\} from '\.\.\/session\/sessionConstants';/);
    expect(source).toMatch(/const displayStepNumbers = isEvening \? EVENING_DISPLAY_STEP_NUMBERS : MORNING_DISPLAY_STEP_NUMBERS;/);
    expect(source).toMatch(/const displayStepCount = isEvening \? EVENING_DISPLAY_STEP_COUNT : MORNING_DISPLAY_STEP_COUNT;/);
  });

  it('required values match exactly: Morning Meditate 4 of 5, Morning Affirmation 5 of 5, Evening Meditation 5 of 7, Prepare for Rest 6 of 7', async () => {
    const {
      MORNING_DISPLAY_STEP_NUMBERS: morningNumbers,
      MORNING_DISPLAY_STEP_COUNT: morningCount,
      EVENING_DISPLAY_STEP_NUMBERS: eveningNumbers,
      EVENING_DISPLAY_STEP_COUNT: eveningCount
    } = await import('../session/sessionConstants');
    expect(`${morningNumbers.meditate} of ${morningCount}`).toBe('4 of 5');
    expect(`${morningNumbers.affirmation} of ${morningCount}`).toBe('5 of 5');
    expect(`${eveningNumbers.meditation} of ${eveningCount}`).toBe('5 of 7');
    expect(`${eveningNumbers.sleepPreparation} of ${eveningCount}`).toBe('6 of 7');
    expect(`${eveningNumbers.completion} of ${eveningCount}`).toBe('7 of 7');
  });

  it('the compact block preserves Morning gold / Evening periwinkle for the active step label, same ternary shape as the full row', () => {
    const compactBlock = source.match(/<div className="flex sm:hidden[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
    expect(compactBlock).toMatch(/isMorning \? 'text-morning-accent font-bold' : isEvening \? 'text-evening-accent font-bold' : 'text-primary font-bold'/);
  });

  it('a visually-hidden (sr-only) full step list is always present in the compact block, so screen-reader users get complete context even when only the compact summary is visible', () => {
    const compactBlock = source.match(/<div className="flex sm:hidden[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
    expect(compactBlock).toMatch(/className="sr-only"/);
    expect(compactBlock).toMatch(/steps\.map\(\(step, idx\) => `\$\{step\.label\}/);
  });
});

describe('ProgressIndicator — full dot-separated row at sm (640px) and above, unchanged markup', () => {
  it('a second block, hidden below sm and flex at sm and above, renders every step via the same renderStep used before this fix', () => {
    expect(source).toMatch(/<div className="hidden sm:flex justify-between items-center">/);
    expect(source).toMatch(/\{steps\.map\(\(step, idx\) => renderStep\(step, idx\)\)\}/);
  });
});

describe('ProgressIndicator — both blocks are always in the DOM; CSS alone decides visibility (no JS viewport check, no resize listener)', () => {
  it('no window.innerWidth/matchMedia/resize-listener anywhere in this file - the responsive split is pure Tailwind breakpoint classes', () => {
    expect(source).not.toMatch(/window\.innerWidth/);
    expect(source).not.toMatch(/matchMedia/);
    expect(source).not.toMatch(/addEventListener\('resize'/);
  });
});

describe('ProgressIndicator — Morning gold / Evening periwinkle preserved for the full row\'s active step (unchanged from before this fix)', () => {
  it('the full-row active-step ternary is byte-identical to the pre-Journey-Embedding source', () => {
    expect(source).toMatch(/isMorning \? 'text-morning-accent font-bold scale-110' : isEvening \? 'text-evening-accent font-bold scale-110' : 'text-primary font-bold scale-110'/);
  });
});

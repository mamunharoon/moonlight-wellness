// Regression guard for the Evening Wind-down flow's back/exit
// navigation. No DOM/component rendering is available in this repo's
// Vitest (see index.css.test.js's own note), so this locks in the source
// wiring: every step passes showBack with a backFallback that actually
// chains to the step before it (the router history itself is what makes
// "back" return to the previous step in the real app - see
// BackButton.jsx's goBack() - this only confirms the fallback used when
// no history exists, e.g. a direct URL visit, still points somewhere
// sane), and that EveningSceneShell gives the confirmation its
// evening-specific wording.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const shellSource = read('./EveningSceneShell.jsx');
const windDownSource = read('../../pages/EveningWindDown.jsx');
const reflectionSource = read('../../pages/Reflection.jsx');
const gratitudeSource = read('../../pages/Gratitude.jsx');
const breathingSource = read('../../pages/EveningBreathing.jsx');
const prepareSource = read('../../pages/PrepareForRest.jsx');
const completeSource = read('../../pages/EveningComplete.jsx');

describe('Evening Wind-down back-navigation chain', () => {
  it('every step shows the back control (showBack), each falling back to the step before it', () => {
    expect(windDownSource).toMatch(/showBack backFallback="\/"/);
    expect(reflectionSource).toMatch(/showBack backFallback="\/evening-wind-down"/);
    expect(gratitudeSource).toMatch(/showBack backFallback="\/reflection"/);
    expect(breathingSource).toMatch(/showBack backFallback="\/gratitude"/);
    expect(prepareSource).toMatch(/showBack backFallback="\/evening-breathing"/);
    expect(completeSource).toMatch(/showBack backFallback="\/"/);
  });

  it('EveningSceneShell renders the back control with a high-contrast panel, not the faint default glass-panel alone', () => {
    expect(shellSource).toMatch(/!bg-black\/55 !border-white\/40/);
  });

  it('EveningSceneShell uses the required evening-specific "leave routine" confirmation wording', () => {
    expect(shellSource).toMatch(/confirmTitle="Leave evening routine\?"/);
    expect(shellSource).toMatch(/confirmMessage="Your unsaved progress may be lost\."/);
  });

  it('BackButton keeps its original generic confirmation as the default, so every other caller is unaffected', () => {
    const backButtonSource = read('../BackButton.jsx');
    expect(backButtonSource).toMatch(/confirmTitle = 'Leave this routine\?'/);
    expect(backButtonSource).toMatch(/confirmMessage = 'Your current progress may be paused\.'/);
  });
});

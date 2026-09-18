// Regression guard for the Evening visual-consistency fix: Reflection
// previously used atmosphere={{ phase: 'dusk' }} - the same brown/orange
// sunset background as the opening Wind-Down screen - while every step
// after it already used 'moonlight', producing an abrupt background
// change between Reflection and Gratitude instead of a single, deliberate
// sunset-to-night transition at the very start of the routine. No DOM/
// component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - these are source-level checks,
// matching every other regression guard in this codebase for that reason.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('Evening routine — shared "moonlight" theme from Reflection through completion', () => {
  it('Wind-Down (the opening screen) keeps the sunset "dusk" transition', () => {
    expect(read('./EveningWindDown.jsx')).toMatch(/atmosphere=\{\{ phase: 'dusk' \}\}/);
  });

  it('Reflection uses "moonlight", not "dusk" - the exact defect this fixes', () => {
    const source = read('./Reflection.jsx');
    expect(source).toMatch(/atmosphere=\{\{ phase: 'moonlight' \}\}/);
    expect(source).not.toMatch(/atmosphere=\{\{ phase: 'dusk' \}\}/);
  });

  it('Gratitude uses "moonlight"', () => {
    expect(read('./Gratitude.jsx')).toMatch(/atmosphere=\{\{ phase: 'moonlight' \}\}/);
  });

  it('Evening Breathing uses "moonlight"', () => {
    expect(read('./EveningBreathing.jsx')).toMatch(/atmosphere=\{\{ phase: 'moonlight' \}\}/);
  });

  it('Prepare For Rest uses "moonlight"', () => {
    expect(read('./PrepareForRest.jsx')).toMatch(/atmosphere=\{\{ phase: 'moonlight' \}\}/);
  });

  it('Evening Complete uses "moonlight"', () => {
    expect(read('./EveningComplete.jsx')).toMatch(/atmosphere=\{\{ phase: 'moonlight' \}\}/);
  });

  it('none of Reflection/Gratitude/Breathing/Rest/Complete hardcode a page-specific background override - all five rely purely on the shared atmosphere phase', () => {
    for (const file of ['./Reflection.jsx', './Gratitude.jsx', './EveningBreathing.jsx', './PrepareForRest.jsx', './EveningComplete.jsx']) {
      const source = read(file);
      expect(source).not.toMatch(/from-\[#|to-\[#|bg-\[#/);
    }
  });

  it('the visible back control and "leave evening routine" unsaved-progress confirmation remain wired through the shared EveningSceneShell, unaffected by the theme fix', () => {
    for (const file of ['./Reflection.jsx', './Gratitude.jsx', './EveningBreathing.jsx', './PrepareForRest.jsx']) {
      const source = read(file);
      expect(source).toMatch(/showBack backFallback=/);
    }
  });
});

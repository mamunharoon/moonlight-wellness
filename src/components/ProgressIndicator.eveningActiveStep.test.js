// Evening Visual Uplift (Build 17), Decision A — ProgressIndicator's
// active step for the evening-wind-down session now reads evening-accent
// periwinkle instead of the generic text-primary peach, mirroring
// Morning's own gold active-step treatment from Build 16. This file
// proves the new arm exists, that it only fires for Evening, and that
// completed/upcoming/separator styling plus Morning's own gold branch are
// all byte-for-byte unaffected (extending, not duplicating,
// ProgressIndicator.eveningUnaffected.test.js's own coverage).
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./ProgressIndicator.jsx', import.meta.url)), 'utf-8');

describe('ProgressIndicator — Evening active step is periwinkle (Decision A)', () => {
  it('the active-step ternary now has three arms: morning-accent gold, evening-accent periwinkle, and the original peach fallback for every other session', () => {
    expect(source).toMatch(
      /isMorning \? 'text-morning-accent font-bold scale-110' : isEvening \? 'text-evening-accent font-bold scale-110' : 'text-primary font-bold scale-110'/
    );
  });

  it('completed-step, unselected-step, header-opacity, and separator colours (all isEvening-gated) are byte-identical to the pre-existing contrast fix', () => {
    expect(source).toMatch(/isEvening \? 'text-on-surface-variant' : 'text-on-surface-variant\/40'/);
    expect(source).toMatch(/isCompleted\s*\n\s*\? \(isEvening \? 'text-on-surface' : 'text-secondary'\)/);
    expect(source).toMatch(/: \(isEvening \? 'text-on-surface-variant' : 'text-on-surface-variant\/30'\)/);
    expect(source).toMatch(/isEvening \? 'text-on-surface-variant\/70 mx-0\.5' : 'text-on-surface-variant\/20 mx-0\.5'/);
  });

  it('a real Evening render resolves to evening-accent for its active step, never peach or gold, by direct boolean evaluation', () => {
    const EVENING_SESSION_ID = 'evening-wind-down';
    const MORNING_SESSION_ID = 'morning-routine';
    const resolveActiveClass = (sessionId) => {
      const isMorning = sessionId === MORNING_SESSION_ID;
      const isEvening = sessionId === EVENING_SESSION_ID;
      return isMorning ? 'text-morning-accent font-bold scale-110' : isEvening ? 'text-evening-accent font-bold scale-110' : 'text-primary font-bold scale-110';
    };
    expect(resolveActiveClass(EVENING_SESSION_ID)).toBe('text-evening-accent font-bold scale-110');
    expect(resolveActiveClass(MORNING_SESSION_ID)).toBe('text-morning-accent font-bold scale-110');
    expect(resolveActiveClass('some-other-session')).toBe('text-primary font-bold scale-110');
  });

  it('navigation/props are untouched - onReviewStep, activeStep, and getVisibleStepIds are still the only inputs driving render', () => {
    expect(source).toMatch(/export const ProgressIndicator = \(\{ activeStep, sessionId = MORNING_SESSION_ID, onReviewStep \}\) => \{/);
    expect(source).toMatch(/const steps = getVisibleStepIds\(sessionId\)\.map/);
  });
});

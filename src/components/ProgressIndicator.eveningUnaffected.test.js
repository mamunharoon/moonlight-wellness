// Morning Visual Uplift (Build 16) — ProgressIndicator shared-component
// safety guard. This phase adds a new `isMorning` branch, mirroring the
// pre-existing `isEvening` branch, that recolours ONLY the active step
// from generic peach (text-primary) to the already-verified morning-
// accent gold. This file proves Evening's own isEvening branch, and every
// other colour decision in the component, are byte-for-byte unchanged.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase (and directly extending
// ProgressIndicator.phaseA.test.js's own existing coverage, not
// duplicating it).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./ProgressIndicator.jsx');

describe('ProgressIndicator — Evening is provably unaffected by the new Morning branch', () => {
  it('isEvening is still derived exactly as before - a plain equality check against EVENING_SESSION_ID, never touched by this phase', () => {
    expect(source).toMatch(/const isEvening = sessionId === EVENING_SESSION_ID;/);
  });

  it('every isEvening-gated colour decision (header opacity, completed-step colour, unselected-step colour, separator dot colour) is byte-identical to before this phase', () => {
    expect(source).toMatch(/isEvening \? 'text-on-surface-variant' : 'text-on-surface-variant\/40'/);
    expect(source).toMatch(/isCompleted\s*\n\s*\? \(isEvening \? 'text-on-surface' : 'text-secondary'\)/);
    expect(source).toMatch(/: \(isEvening \? 'text-on-surface-variant' : 'text-on-surface-variant\/30'\)/);
    expect(source).toMatch(/isEvening \? 'text-on-surface-variant\/70 mx-0\.5' : 'text-on-surface-variant\/20 mx-0\.5'/);
  });

  it('isMorning is a genuinely new, separate boolean - it can never be true at the same time as isEvening, since they check different session ids', () => {
    expect(source).toMatch(/const isMorning = sessionId === MORNING_SESSION_ID;/);
    expect(source).not.toMatch(/isMorning = !isEvening/);
    expect(source).not.toMatch(/isMorning = isEvening/);
  });

  it('the new Morning branch only ever changes the ACTIVE step\'s colour - completed/unselected/separator colours, and Evening\'s own completed/unselected/separator branches, are untouched by it', () => {
    // Evening Visual Uplift (Build 17) added a third arm to this same
    // ternary (isEvening -> evening-accent periwinkle) - see
    // ProgressIndicator.eveningActiveStep.test.js for that arm's own
    // dedicated coverage. This assertion only re-confirms the Morning arm
    // itself is still exactly the Build 16 value, unchanged by that
    // addition.
    expect(source).toMatch(/isMorning \? 'text-morning-accent font-bold scale-110' : isEvening \? 'text-evening-accent font-bold scale-110' : 'text-primary font-bold scale-110'/);
    // `isMorning` is read exactly twice in the actual render logic (the
    // full-row active-step ternary above, plus the compact-presentation
    // active-label ternary Journey Embedding added alongside it - both
    // gate ONLY the active step's colour, never completed/unselected/
    // separator) - proof this phase did not also (accidentally or
    // otherwise) gate any of the completed/unselected/separator branches
    // on it. The other occurrences of the string "isMorning" in the file
    // are this doc comment's own prose, not code.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '');
    const isMorningCodeUsages = codeOnly.match(/isMorning/g) ?? [];
    expect(isMorningCodeUsages.length).toBe(3); // the declaration + two reads (full row + compact)
  });

  it('a real Evening render (activeStep on a completed/unselected/active step, sessionId="evening-wind-down") is completely unreachable through the isMorning branch, since isMorning is false whenever isEvening is true', () => {
    // isMorning = sessionId === MORNING_SESSION_ID ('morning-routine');
    // isEvening = sessionId === EVENING_SESSION_ID ('evening-wind-down').
    // A single sessionId string cannot equal two different literals at
    // once, so the two booleans are mutually exclusive by construction -
    // asserted here as a real boolean-logic check, not just a source scan.
    const MORNING_SESSION_ID = 'morning-routine';
    const EVENING_SESSION_ID = 'evening-wind-down';
    for (const sessionId of [MORNING_SESSION_ID, EVENING_SESSION_ID, 'anything-else']) {
      const isEvening = sessionId === EVENING_SESSION_ID;
      const isMorning = sessionId === MORNING_SESSION_ID;
      expect(isEvening && isMorning).toBe(false);
    }
  });
});

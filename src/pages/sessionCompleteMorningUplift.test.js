// Morning Visual Uplift (Build 16) — SessionComplete.jsx. Morning-
// exclusive file (no other journey renders it), so every visual change
// here is a direct restyle. This file proves the real completion-
// persistence logic (same-day-repeat/no-double-credit, stale-date
// pinning, user-scoped completion key, session-engine mirroring) is
// completely untouched, plus that the "more uplifting completion
// presentation" the brief asked for is actually applied.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./SessionComplete.jsx');

describe('SessionComplete.jsx — more uplifting completion presentation', () => {
  it('a new, purely decorative "Morning Flow" orienting badge sits beside BackButton - same established pill pattern Home\'s own "YOUR MORNING" badge already uses, not new data', () => {
    expect(source).toMatch(/bg-morning-accent\/10 border border-morning-accent-tint\/25 text-morning-accent text-\[10px\] font-bold uppercase tracking-wider">\s*\n\s*Morning Flow/);
  });

  it('the ring stroke is now the real gratitude-accent CSS variable (the same underlying colour morning-accent already points to) instead of the generic --color-primary it used before', () => {
    expect(source).toMatch(/stroke="var\(--color-gratitude-accent\)"/);
    expect(source).not.toMatch(/stroke="var\(--color-primary\)"/);
  });

  it('the ring sits in a restrained morning-glow shadow container - sparing, per that token\'s own comment', () => {
    expect(source).toMatch(/w-40 h-40 mx-auto flex items-center justify-center mt-6 rounded-full shadow-morning-glow/);
  });

  it('the checkmark icon and both intention-summary labels (eyebrow + PRIMARY/SUPPORTING role) use morning-accent gold, not the generic peach they used before', () => {
    expect(source).toMatch(/text-morning-accent text-2xl font-bold">check_circle/);
    expect(source).toMatch(/font-semibold uppercase text-morning-accent/);
    expect(source).toMatch(/text-\[9px\] not-italic font-bold uppercase tracking-wider text-morning-accent shrink-0/);
  });

  it('the completion headline now uses the new Playfair Display token (WakeWise Phase 2, B6: {headline} now rotates - see sessionCompleteOutcomeMessages.test.js)', () => {
    expect(source).toMatch(/text-2xl font-morning-display italic font-semibold text-on-surface leading-tight">\{headline\}<\/h2>/);
  });

  // WakeWise DEV — journey-aware primary action colour: the later
  // approved journey-colour pass explicitly reversed this phase's own
  // "primary action buttons stay peach app-wide" decision - "Continue to
  // Today" now resolves to the shared journey-action helper with
  // journey='morning' (bg-morning-accent text-on-morning-accent).
  it('"Continue to Today" resolves to the shared journey-action helper with journey=\'morning\' (gold, not peach), with the sparing glow kept', () => {
    expect(source).toMatch(/\$\{getJourneyPrimaryActionClasses\('morning'\)\} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-morning-glow/);
  });
});

describe('SessionComplete.jsx — real copy preserved exactly (CTA unchanged; headline/body now sourced from outcomeMessages.js, see its own test file)', () => {
  it('the CTA label is byte-identical to before this phase', () => {
    expect(source).toMatch(/<span>Continue to Today<\/span>/);
  });

  it('the former single fixed headline/body strings no longer live in this file - they moved to outcomeMessages.js as the first rotating variant (byte-identical content, see outcomeMessages.test.js)', () => {
    expect(source).not.toMatch(/You started today with intention\./);
    expect(source).not.toMatch(/Your direction is set\. Take this feeling with you into the day\./);
  });

  it('the "Your Morning Intention(s)" singular/plural eyebrow logic is unchanged', () => {
    expect(source).toMatch(/\{displayIntentions\.length > 1 \? 'Your Morning Intentions' : 'Your Morning Intention'\}/);
  });
});

describe('SessionComplete.jsx — real completion-persistence logic is completely untouched', () => {
  it('same-day-repeat/no-double-credit guard (shouldWriteCompletionDate) is still the one gate before writing the completion flag', () => {
    expect(source).toMatch(/if \(shouldWriteCompletionDate\(localStorage\.getItem\(morningDoneKey\), attributionDateKey\)\) \{/);
  });

  it('stale/pinned-date attribution still takes priority over "now" when present, and the user-scoped completion key is still real (getMorningCompletionKey(userId))', () => {
    expect(source).toMatch(/const attributionDateKey = pinnedDateKey \?\? getZonedParts\(effectiveTimezone, devNow\(\)\)\.dateKey;/);
    expect(source).toMatch(/const morningDoneKey = getMorningCompletionKey\(userId\);/);
  });

  it('the Session Engine mirror (completeSession on mount, resetSession on Return Home) is unchanged', () => {
    expect(source).toMatch(/if \(state\.status === 'playing' && currentStep\?\.id === 'complete'\) \{\s*\n\s*completeSession\(\);/);
    expect(source).toMatch(/resetSession\(\);/);
  });
});

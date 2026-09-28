// Anytime Visual Flow and Closing Handoff uplift (Part 2) —
// AnytimePathway. No DOM rendering available in this repo's Vitest -
// source-level checks, matching this codebase's own established
// precedent (see e.g. EveningJourneyPathway.test.js).
//
// Anytime is NOT a fixed routine - this is a 3-step DECISION pathway
// (Need -> Time -> Reset), never a sequence of practices to complete.
// These tests prove: genuine stage icons are ALWAYS visible; Need/Time
// only ever receive a secondary check when their own real, already-known
// value is genuinely set (never inferred from step position); Reset
// never receives a check at all (reaching/viewing a recommendation is
// not a completion); selecting Need or Time is never itself recorded as
// a wellbeing-practice completion (there is no completion-recording call
// anywhere in this file at all); and Anytime never shows a 100%
// indicator.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const source = read('./AnytimePathway.jsx');
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('AnytimePathway - genuine stage icons are always the primary visual', () => {
  it('renders all 3 real stage icons unconditionally in STAGES, never behind a selected/current ternary', () => {
    expect(code).toMatch(/\{ id: 'need', label: 'Need', icon: 'psychology' \}/);
    expect(code).toMatch(/\{ id: 'time', label: 'Time', icon: 'schedule' \}/);
    expect(code).toMatch(/\{ id: 'reset', label: 'Reset', icon: 'auto_awesome' \}/);
  });

  it('the main badge always renders stage.icon unconditionally - there is no conditional swapping it for a checkmark/tick icon', () => {
    expect(code).toMatch(/<span className="material-symbols-outlined text-base" aria-hidden="true">\{stage\.icon\}<\/span>/);
    expect(code).not.toMatch(/stage\.icon\s*:\s*'check/);
    expect(code).not.toMatch(/isCurrent\s*\?\s*'check/);
  });
});

describe('AnytimePathway - Need/Time selected badge is only ever driven by explicit, already-known real values', () => {
  it('accepts needSelected/timeSelected as plain boolean props, both defaulting to false', () => {
    expect(source).toMatch(/needSelected = false, timeSelected = false/);
  });

  it('Reset can never receive a selected badge - isSelected.reset is hardcoded false, never derived from currentStageId or step position', () => {
    expect(code).toMatch(/const isSelected = \{ need: needSelected, time: timeSelected, reset: false \};/);
  });

  it('the selected badge (check) is additive - the main icon span always renders stage.icon first, the badge is a separate, absolutely-positioned corner element', () => {
    const selectedBlock = code.match(/\{selected && \([\s\S]*?\)\}/)?.[0] ?? '';
    expect(selectedBlock).toMatch(/absolute -bottom-1 -right-1/);
    expect(selectedBlock).toMatch(/check/);
  });

  it('never infers "selected" from currentStageId or array index - only from the caller-supplied needSelected/timeSelected props', () => {
    const selectedLine = code.match(/const selected = isSelected\[stage\.id\];/)?.[0];
    expect(selectedLine).toBeTruthy();
  });
});

describe('AnytimePathway - currentStageId drives the mint highlight independently, and never fabricates a completion', () => {
  it('isCurrent is a simple equality check against currentStageId', () => {
    expect(code).toMatch(/const isCurrent = stage\.id === currentStageId;/);
  });

  it('the current stage keeps its genuine icon too - isCurrent only changes badge/label CSS classes, never the rendered icon glyph', () => {
    const badgeClassBlock = code.match(/const badgeClass = isCurrent[\s\S]*?;/)?.[0] ?? '';
    expect(badgeClassBlock).not.toMatch(/icon:|stage\.icon/);
  });

  it('never shows a 100%/completion indicator anywhere - no such string exists in this component', () => {
    expect(code).not.toMatch(/100%/);
    expect(code).not.toMatch(/[Cc]omplete/);
  });

  it('never calls a completion-recording function - selecting Need or Time is a plain UI navigation action, not a wellbeing-practice completion', () => {
    expect(code).not.toMatch(/recordPracticeCompletion|completionEventId|COMPLETE_SESSION/);
  });
});

describe('AnytimePathway - accessible names and VoiceOver announcements', () => {
  it('accessible text announces Need/Time as ", selected" when their own real value is set, and any current stage as ", current" - both purely additive sr-only suffixes on the real label', () => {
    expect(code).toMatch(/\{selected && <span className="sr-only">, selected<\/span>\}/);
    expect(code).toMatch(/\{isCurrent && <span className="sr-only">, current<\/span>\}/);
  });

  it('exposes a real accessible list structure (role="list"/"listitem") with a descriptive aria-label naming all 3 stages', () => {
    expect(source).toMatch(/role="list" aria-label="Anytime Reset steps: Need, Time, Reset"/);
    expect(source).toMatch(/role="listitem"/);
  });

  it('every visible label stays visible text, never hidden behind an icon-only presentation', () => {
    expect(code).toMatch(/\{stage\.label\}/);
  });
});

describe('AnytimePathway - structural safety and colour tokens', () => {
  it('wraps in overflow-x-auto scroll-hide, matching the established 320px safety pattern (EveningJourneyPathway.jsx/MorningJourneyPathway.jsx)', () => {
    expect(source).toMatch(/overflow-x-auto scroll-hide/);
  });

  it('uses only existing mint (tertiary) tokens - no raw hex, no new colour tokens, and never Morning gold or Evening periwinkle', () => {
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(code).toMatch(/tertiary/);
    expect(code).not.toMatch(/morning-accent|evening-accent/);
  });

  it('status is never conveyed by colour alone - the selected check badge and the sr-only text are both independent, non-colour channels alongside the badge/label colour change', () => {
    expect(code).toMatch(/material-symbols-outlined text-\[8px\] text-on-tertiary leading-none/);
  });
});

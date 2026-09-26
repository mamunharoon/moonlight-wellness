// Build 15 — MovementCheckboxRow. No DOM rendering available in this
// repo's Vitest, matching every other component test's own established
// precedent (see AnswerOptionButton.jsx's own construction, which this
// component's markup deliberately mirrors).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./MovementCheckboxRow.jsx');

describe('MovementCheckboxRow - real checkbox semantics, never switch/radio', () => {
  it('uses a real native type="checkbox" input, visually hidden via sr-only (never removed from the accessibility tree)', () => {
    expect(source).toMatch(/type="checkbox"/);
    expect(source).toMatch(/className="sr-only"/);
    expect(source).not.toMatch(/role="switch"|role="radio"|type="radio"/);
  });

  it('the entire row is one <label> wrapping the input - clicking anywhere activates it, never only the visible glyph', () => {
    const labelOpenIndex = source.indexOf('<label');
    const inputIndex = source.indexOf('<input');
    const labelCloseIndex = source.lastIndexOf('</label>');
    expect(labelOpenIndex).toBeGreaterThanOrEqual(0);
    expect(inputIndex).toBeGreaterThan(labelOpenIndex);
    expect(inputIndex).toBeLessThan(labelCloseIndex);
  });

  it('the row enforces a minimum 56px height', () => {
    expect(source).toMatch(/min-h-\[56px\]/);
  });

  it('checked/unchecked is driven by isSelected/onToggle - a controlled checkbox, never uncontrolled', () => {
    expect(source).toMatch(/checked=\{isSelected\}/);
    expect(source).toMatch(/onChange=\{onToggle\}/);
  });

  // Context-aware Meditation/Breathing theming consistency audit — a
  // dedicated local TOKENS map (default 'primary', byte-identical to the
  // original peach look) replaced the hardcoded bg-primary/text-primary
  // classes, so MorningFlow.jsx can pass journeyTone="morning" and get a
  // real gold selected state instead of always-peach.
  it('selected state uses a real filled checkmark glyph, border, subtle tint, AND bold text weight - never colour alone (via the TOKENS map, default primary byte-identical to before)', () => {
    expect(source).toMatch(/const TOKENS = \{/);
    expect(source).toMatch(/primary: \{\s*\n\s*selectedRow: 'bg-primary\/10 border-primary',/);
    expect(source).toMatch(/checkIconText: 'text-on-primary',/);
    expect(source).toMatch(/selectedLabel: 'text-primary font-bold',/);
    expect(source).toMatch(/isSelected && <span className=\{`material-symbols-outlined \$\{tokens\.checkIconText\} text-base leading-none`\}>check<\/span>/);
    expect(source).toMatch(/isSelected \? tokens\.selectedLabel : 'text-on-surface font-medium'/);
  });

  it('morning/anytime/evening tone entries reuse already-approved accent tokens - never a fresh hex value', () => {
    expect(source).toMatch(/morning: \{/);
    expect(source).toMatch(/selectedRow: 'bg-morning-accent-tint\/10 border-morning-accent',/);
    expect(source).toMatch(/anytime: \{/);
    expect(source).toMatch(/selectedRow: 'bg-tertiary-tint\/10 border-tertiary',/);
    expect(source).toMatch(/evening: \{/);
    expect(source).toMatch(/selectedRow: 'bg-evening-accent-tint\/10 border-evening-accent',/);
  });

  it('unselected state remains legible - a real border colour and body-weight text, never a blank/invisible row', () => {
    expect(source).toMatch(/unselectedRow: 'bg-surface-container border-primary\/50 hover:bg-white\/10'/);
    expect(source).toMatch(/border-on-surface-variant\/50 bg-transparent/);
  });

  it('never renders a sliding-knob element (no translate-x transform, no absolute-positioned knob span) - the old switch\'s own construction is gone', () => {
    expect(source).not.toMatch(/translate-x-5|translate-x-0/);
    expect(source).not.toMatch(/aria-hidden="true"[\s\S]{0,40}relative w-11 h-6/);
  });

  it('a keyboard focus on the hidden input shows a visible ring on the row - tone-driven (primary\'s own default is byte-identical to the original hardcoded ring-primary)', () => {
    expect(source).toMatch(/focusRing: 'has-\[:focus-visible\]:ring-primary'/);
    expect(source).toMatch(/has-\[:focus-visible\]:ring-2 \$\{tokens\.focusRing\}/);
  });

  it('title/description/durationLabel/icon are all passed through as props, never hard-coded inside the component', () => {
    expect(source).toMatch(/\{title\}/);
    expect(source).toMatch(/\{description\}/);
    expect(source).toMatch(/\{durationLabel\}/);
    expect(source).toMatch(/\{icon\}/);
  });
});

// Build 16 physical-iPhone correction (F2) — `compact` variant, added so
// all four movements can render directly on the Morning Stretch setup
// screen as a 2-column grid instead of hiding behind a collapsed
// disclosure. Same real checkbox/label/focus-ring contract as the full
// row, verified separately here since it's a genuinely different render
// branch, not just different classNames on the same markup.
describe('MovementCheckboxRow - compact grid-card variant', () => {
  const compactBlock = source.match(/if \(compact\) \{\s*\n\s*return \(([\s\S]*?)\n {4}\);\s*\n {2}\}/)?.[1] ?? '';

  it('defaults to false - existing callers with no `compact` prop keep rendering the original full-width row unchanged', () => {
    expect(source).toMatch(/compact = false/);
  });

  it('still uses a real native checkbox input inside one wrapping <label>, sr-only, never a role="switch"/"radio"', () => {
    expect(compactBlock).toMatch(/<label/);
    expect(compactBlock).toMatch(/type="checkbox"/);
    expect(compactBlock).toMatch(/className="sr-only"/);
    expect(compactBlock).not.toMatch(/role="switch"|role="radio"|type="radio"/);
  });

  it('checked/unchecked is still driven by isSelected/onToggle, a controlled checkbox', () => {
    expect(compactBlock).toMatch(/checked=\{isSelected\}/);
    expect(compactBlock).toMatch(/onChange=\{onToggle\}/);
  });

  it('keeps the same focus-visible ring pattern as the full row', () => {
    expect(compactBlock).toMatch(/has-\[:focus-visible\]:ring-2 \$\{tokens\.focusRing\}/);
  });

  it('enforces a minimum 76px card height - comfortably above the 44x44pt touch-target minimum even in a 2-column grid on a 320px-wide screen', () => {
    expect(compactBlock).toMatch(/min-h-\[76px\]/);
  });

  it('shows title, icon and durationLabel - the same real props as the full row, nothing hard-coded', () => {
    expect(compactBlock).toMatch(/\{title\}/);
    expect(compactBlock).toMatch(/\{icon\}/);
    expect(compactBlock).toMatch(/\{durationLabel\}/);
  });

  it('deliberately omits `description` - the compact card exists to fit all four movements on screen at once, not to repeat the long copy the full row already shows', () => {
    expect(compactBlock).not.toMatch(/\{description\}/);
  });

  it('selected state is still communicated by more than colour alone - a real checkmark glyph plus a border/tint change, matching the full row\'s own accessibility bar (tone-driven)', () => {
    expect(compactBlock).toMatch(/isSelected && <span className=\{`material-symbols-outlined \$\{tokens\.checkIconText\} text-sm leading-none`\}>check<\/span>/);
    expect(compactBlock).toMatch(/isSelected \? tokens\.selectedRow : tokens\.unselectedRow/);
  });
});

// Context-aware Meditation/Breathing theming consistency audit —
// journeyTone prop and MorningFlow.jsx's own real-caller wiring.
describe('MovementCheckboxRow — journeyTone', () => {
  it('defaults to \'primary\' and resolves via the local TOKENS map, falling back to primary for any unknown value', () => {
    expect(source).toMatch(/journeyTone = 'primary'/);
    expect(source).toMatch(/const tokens = TOKENS\[journeyTone\] \|\| TOKENS\.primary;/);
  });

  it('MorningFlow.jsx (the only real consumer today) passes journeyTone="morning" on its own MovementCheckboxRow call site', () => {
    const morningFlowSource = readFileSync(fileURLToPath(new URL('../pages/MorningFlow.jsx', import.meta.url)), 'utf-8');
    const callSite = morningFlowSource.match(/<MovementCheckboxRow[\s\S]*?\/>/)?.[0] ?? '';
    expect(callSite).toMatch(/journeyTone="morning"/);
  });
});

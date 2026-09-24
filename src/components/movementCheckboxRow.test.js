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

  it('selected state uses a real filled checkmark glyph, border, subtle tint, AND bold text weight - never colour alone', () => {
    expect(source).toMatch(/isSelected \? 'bg-primary\/10 border-primary'/);
    expect(source).toMatch(/isSelected && <span className="material-symbols-outlined text-on-primary text-base leading-none">check<\/span>/);
    expect(source).toMatch(/isSelected \? 'text-primary font-bold' : 'text-on-surface font-medium'/);
  });

  it('unselected state remains legible - a real border colour and body-weight text, never a blank/invisible row', () => {
    expect(source).toMatch(/bg-surface-container border-primary\/50/);
    expect(source).toMatch(/border-on-surface-variant\/50 bg-transparent/);
  });

  it('never renders a sliding-knob element (no translate-x transform, no absolute-positioned knob span) - the old switch\'s own construction is gone', () => {
    expect(source).not.toMatch(/translate-x-5|translate-x-0/);
    expect(source).not.toMatch(/aria-hidden="true"[\s\S]{0,40}relative w-11 h-6/);
  });

  it('a keyboard focus on the hidden input shows a visible ring on the row - the proven has-[:focus-visible] pattern already used by AnswerOptionButton.jsx', () => {
    expect(source).toMatch(/has-\[:focus-visible\]:ring-2 has-\[:focus-visible\]:ring-primary/);
  });

  it('title/description/durationLabel/icon are all passed through as props, never hard-coded inside the component', () => {
    expect(source).toMatch(/\{title\}/);
    expect(source).toMatch(/\{description\}/);
    expect(source).toMatch(/\{durationLabel\}/);
    expect(source).toMatch(/\{icon\}/);
  });
});

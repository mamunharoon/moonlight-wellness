// Phase 3 UX correction — AnswerOptionButton. Physical-device feedback:
// the original preset controls (checkmark + subtle tint, or a chevron
// row) read as small tick/navigation controls, not clear buttons, on a
// real iPhone. No DOM rendering in this repo's Vitest - source-level
// checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const source = read('./AnswerOptionButton.jsx');
const cssSource = read('../../index.css');
const tailwindConfigSource = read('../../../tailwind.config.js');

describe('AnswerOptionButton - button interaction contract', () => {
  it('the entire surface is one real <button> (never a <div> with an onClick), so the whole area is tappable and keyboard-activatable', () => {
    expect(source).toMatch(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{onClick\}/);
  });

  it('meets the 52px minimum height and full width, comfortably exceeding the 44x44 minimum hit area', () => {
    expect(source).toMatch(/min-h-\[52px\]/);
    expect(source).toMatch(/w-full/);
  });

  it('the complete label renders in a plain block span with no truncate/line-clamp/overflow-hidden - never clipped', () => {
    expect(source).not.toMatch(/truncate|line-clamp|overflow-hidden/);
    expect(source).toMatch(/<span className="block text-sm leading-snug">\{label\}<\/span>/);
  });

  it('never renders a navigation chevron or a separate checkmark/tick icon - selection is conveyed by the button\'s own fill/border/weight only', () => {
    expect(source).not.toMatch(/chevron_right|chevron_left|check_circle|check\b/);
  });

  it('keyboard focus gets a visible ring', () => {
    expect(source).toMatch(/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/);
  });
});

describe('AnswerOptionButton - unselected state', () => {
  it('deep surface-container background, a subtle white/blue-grey border, off-white readable label at regular/medium weight - no navigation-implying icon', () => {
    expect(source).toMatch(/'bg-surface-container border-white\/15 text-on-surface font-medium/);
  });
});

describe('AnswerOptionButton - selected state (never colour alone)', () => {
  it('Reflection reuses the app\'s own existing primary/on-primary tokens (WakeWise\'s established peach/coral, already contrast-paired) rather than a second near-duplicate peach', () => {
    expect(source).toMatch(/reflection: 'bg-primary border-primary text-on-primary'/);
  });

  it('Gratitude uses the new gratitude-accent/on-gratitude-accent pair (a warm sunrise gold with no prior token in this app)', () => {
    expect(source).toMatch(/gratitude: 'bg-gratitude-accent border-gratitude-accent text-on-gratitude-accent'/);
  });

  it('selected also gets bold weight and an inset/pressed shadow - never a checkmark - and aria-pressed carries the real accessible state', () => {
    expect(source).toMatch(/font-bold shadow-\[inset_0_2px_5px_rgba\(0,0,0,0\.22\)\]/);
    expect(source).toMatch(/aria-pressed=\{selected\}/);
  });
});

describe('New colour tokens - contrast-verified, additive only', () => {
  it('index.css defines gratitude-accent/on-gratitude-accent - not reusing or overwriting any existing token', () => {
    expect(cssSource).toMatch(/--color-gratitude-accent: #f4c56a;/);
    expect(cssSource).toMatch(/--color-on-gratitude-accent: #3a2408;/);
    // still exactly the original primary pair, unchanged
    expect(cssSource).toMatch(/--color-primary: #ffc5b7;/);
    expect(cssSource).toMatch(/--color-on-primary: #5a1c0c;/);
  });

  it('tailwind.config.js exposes gratitude-accent/on-gratitude-accent as real utility-generating colours, additive alongside every existing token', () => {
    expect(tailwindConfigSource).toMatch(/"gratitude-accent": "var\(--color-gratitude-accent\)"/);
    expect(tailwindConfigSource).toMatch(/"on-gratitude-accent": "var\(--color-on-gratitude-accent\)"/);
    expect(tailwindConfigSource).toMatch(/"primary": "var\(--color-primary\)"/);
  });

  it('#f4c56a text on #3a2408 (and vice versa) measures well above the 4.5:1 AA floor for normal text', () => {
    // Real WCAG relative-luminance contrast computation, not a source
    // regex - this is genuinely pure/computable, so it's executed for
    // real rather than merely asserted as a comment.
    const relLum = (hex) => {
      const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
      const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    };
    const contrast = (a, b) => {
      const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    expect(contrast('#f4c56a', '#3a2408')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('SelectionChip.jsx/SelectionRow.jsx are completely untouched - still used exactly as before by every other existing caller', () => {
  it('SelectionChip.jsx keeps its original checkmark/border/fill selected-state contract (ChangeIntention.jsx/AnytimeReset.jsx/Meditate.jsx are unaffected by this Phase 3 correction)', () => {
    const chipSource = read('../journey/SelectionChip.jsx');
    expect(chipSource).toMatch(/check_circle/);
  });

  it('SelectionRow.jsx keeps its original chevron/check_circle selected-state contract', () => {
    const rowSource = read('../journey/SelectionRow.jsx');
    expect(rowSource).toMatch(/chevron_right/);
    expect(rowSource).toMatch(/check_circle/);
  });
});

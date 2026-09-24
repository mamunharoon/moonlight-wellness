// Phase 3 UX correction, round 2 — AnswerOptionButton (radio selector).
// Physical-device feedback: the first correction (a fully filled coloured
// button) read as too bright/heavy; the intended pattern was a
// contrasting radio selector. No DOM rendering in this repo's Vitest -
// source-level checks, matching every other regression guard in this
// codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const source = read('./AnswerOptionButton.jsx');
const promptStepperSource = read('./PromptStepper.jsx');
const cssSource = read('../../index.css');
const tailwindConfigSource = read('../../../tailwind.config.js');

describe('AnswerOptionButton - semantic radio, not a styled button/switch', () => {
  it('a real native <input type="radio"> carries the actual selected state - never role="switch", never a hand-rolled role="radio" div needing manual aria-checked/keydown handling', () => {
    // Strip the file's own doc comment (which discusses, in prose, the
    // role="radio"/aria-checked approach this component deliberately did
    // NOT take) before asserting on the real code below it.
    const code = source.replace(/\/\*[\s\S]*?\*\//, '');
    expect(source).toMatch(/<input\s*\n\s*type="radio"/);
    expect(code).not.toMatch(/role="switch"/);
    expect(code).not.toMatch(/role="radio"/);
    expect(code).not.toMatch(/aria-checked/);
  });

  it('checked is driven directly by the `selected` prop, and the whole row is one <label> wrapping the input - clicking anywhere in the row activates it, not only the visual circle', () => {
    expect(source).toMatch(/checked=\{selected\}/);
    expect(source).toMatch(/onChange=\{readOnly \? undefined : onClick\}/);
    expect(source).toMatch(/<label\s*\n\s*className=/);
  });

  it('readOnly (Evening completed-review) is additive - default false, so every existing active-journey caller is unaffected - and drives the native `disabled` attribute, never a CSS-only trick', () => {
    expect(source).toMatch(/accent = 'reflection', groupName, readOnly = false/);
    expect(source).toMatch(/disabled=\{readOnly\}/);
  });

  it('the input carries the question\'s own groupName as its `name`, so every option for the SAME question shares one native radio group (real arrow-key cycling/Home/End, for free, per question) - never leaking across different questions', () => {
    expect(source).toMatch(/name=\{groupName\}/);
  });

  it('PromptStepper wraps the options container in role="radiogroup" (not role="group") and passes each option its own groupName', () => {
    expect(promptStepperSource).toMatch(/role="radiogroup"/);
    expect(promptStepperSource).not.toMatch(/role="group"/);
    expect(promptStepperSource).toMatch(/groupName=\{activePrompt\.id\}/);
  });
});

describe('AnswerOptionButton - button interaction contract', () => {
  it('meets the approved 64px minimum grid-card touch height (Build 16 compact two-column layout - was 52px as a full-width row) and full width, comfortably exceeding the 44x44 minimum hit area', () => {
    expect(source).toMatch(/min-h-\[64px\]/);
    // Strip the file's own doc comments before asserting the old value is
    // gone from the ACTUAL CODE - the Build 16 doc comment above
    // legitimately still mentions "min-h-[52px]" in prose, explaining
    // what the row-based sizing used to be before this phase.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/min-h-\[52px\]/);
    expect(source).toMatch(/w-full/);
  });

  it('the complete label renders in a plain span with no truncate/line-clamp/overflow-hidden - never clipped', () => {
    expect(source).not.toMatch(/truncate|line-clamp|overflow-hidden/);
    expect(source).toMatch(/\{label\}/);
  });

  it('never renders a navigation chevron or a separate checkmark/tick icon - selection is conveyed by the radio glyph\'s own fill/dot, plus row tint/border/weight, never any icon glyph', () => {
    expect(source).not.toMatch(/chevron_right|chevron_left|check_circle|material-symbols-outlined/);
  });

  it('keyboard focus gets a visible ring on the whole row (via :has(:focus-visible) on the label, since the actual input is visually hidden)', () => {
    expect(source).toMatch(/has-\[:focus-visible\]:ring-2 has-\[:focus-visible\]:ring-primary/);
  });
});

describe('AnswerOptionButton - unselected state (Build 15 visual refinement)', () => {
  it('deep surface-container background, a visible evening-accent/55 border (calculated ~3.4:1 against the row, clearing the 3:1 AA non-text floor - see the contrast-computation describe block below), off-white readable label at medium weight', () => {
    expect(source).toMatch(/bg-surface-container border-evening-accent\/55/);
    expect(source).toMatch(/text-on-surface font-medium/);
  });

  it('the radio glyph is a strong evening-accent ring with an explicit dark navy centre (surface-container-lowest) - not the old pale border-on-surface-variant outline, no inner dot', () => {
    const unselectedRadio = source.match(/selected \? tokens\.radioFill : ('[^']*')/)?.[1] ?? '';
    expect(unselectedRadio).toBe("'border-evening-accent bg-surface-container-lowest'");
    expect(source).not.toMatch(/border-on-surface-variant/);
    expect(source).toMatch(/\{selected && <span/); // the inner dot only ever renders when selected
  });
});

describe('AnswerOptionButton - readOnly mode (Evening completed-review)', () => {
  it('drops the interactive hover/press affordances (cursor-pointer, active:scale, hover:bg-white/10) since nothing happens on press', () => {
    expect(source).toMatch(/readOnly \? 'cursor-default' : 'cursor-pointer active:scale-\[0\.98\]'/);
    expect(source).toMatch(/readOnly \? '' : 'hover:bg-white\/10'/);
  });

  it('selected/unselected colour treatment is identical in readOnly mode to the live journey - the same tokens/classes are reused, never a separate dimmed palette, so legibility and contrast are unchanged', () => {
    // The selected/unselected branch that decides colour classes does not
    // itself branch on `readOnly` at all - only the interactive-affordance
    // classes above do. Same tokens, same contrast, in both modes.
    const colourBranch = source.match(/\$\{\s*selected\s*\?\s*`\$\{tokens\.tint\} \$\{tokens\.border\}`\s*\n\s*: `bg-surface-container border-evening-accent\/55 \$\{readOnly \? '' : 'hover:bg-white\/10'\}`\s*\}/);
    expect(colourBranch).not.toBeNull();
  });

  it('the native `disabled` attribute is the only readOnly-specific change to the input itself - never removed from the DOM, never aria-hidden, so its checked/unchecked state stays in the accessibility tree', () => {
    expect(source).not.toMatch(/readOnly && null/);
    expect(source).not.toMatch(/aria-hidden=\{readOnly\}/);
  });
});

describe('AnswerOptionButton - selected state (subtle row tint, never a fully filled/bright block, never colour alone)', () => {
  it('the row itself only gets a SUBTLE colour tint (bg-*/10) and a full-strength border - never a fully filled/bright background', () => {
    expect(source).toMatch(/reflection: \{ text: 'text-primary', border: 'border-primary', tint: 'bg-primary\/10'/);
    expect(source).not.toMatch(/tint: 'bg-primary'[^/]/);
  });

  it('the radio glyph itself carries the strong, saturated colour when selected - filled circle plus a small, contrasting inner dot, never a tick/checkmark', () => {
    expect(source).toMatch(/radioFill: 'border-primary bg-primary', dot: 'bg-on-primary'/);
  });

  it('selected label text is bold and coloured (never colour alone - weight changes too), row border switches to the full-strength accent border', () => {
    expect(source).toMatch(/\$\{tokens\.text\} font-bold/);
    expect(source).toMatch(/\$\{tokens\.tint\} \$\{tokens\.border\}/);
  });

  // Build 15 Evening UX correction — Gratitude's selected state now
  // reuses Reflection's exact peach tokens, replacing the former gold
  // identity, so both sections share one selected-answer colour
  // throughout Evening (active, read-only Review, and Edit all consume
  // this same ACCENT_TOKENS map).
  it('gratitude reuses reflection\'s EXACT peach token values (text/border/tint/radioFill/dot) - not a second, near-identical peach', () => {
    const gratitudeLine = source.match(/gratitude: \{[^}]*\}/)?.[0] ?? '';
    expect(gratitudeLine).toBe(
      "gratitude: { text: 'text-primary', border: 'border-primary', tint: 'bg-primary/10', radioFill: 'border-primary bg-primary', dot: 'bg-on-primary' }"
    );
  });

  it('gold (gratitude-accent/on-gratitude-accent) is completely absent from the ACTUAL CODE - the doc comment above may still mention it in prose explaining the change, but no real class/token reference remains', () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/text-gratitude-accent|border-gratitude-accent|bg-gratitude-accent|on-gratitude-accent/);
  });
});

describe('gratitude-accent/on-gratitude-accent tokens - kept, but no longer consumed by Gratitude itself', () => {
  it('index.css still defines gratitude-accent/on-gratitude-accent - not deleted, since Home.jsx\'s Today\'s Rhythm Morning card (`morning-accent`) reuses this exact same CSS variable for its own, unrelated sunrise-gold identity', () => {
    expect(cssSource).toMatch(/--color-gratitude-accent: #f4c56a;/);
    expect(cssSource).toMatch(/--color-on-gratitude-accent: #3a2408;/);
    expect(cssSource).toMatch(/--color-primary: #ffc5b7;/);
    expect(cssSource).toMatch(/--color-on-primary: #5a1c0c;/);
  });

  it('tailwind.config.js still exposes gratitude-accent/on-gratitude-accent as real utility-generating colours, and morning-accent still points at the same underlying CSS variable', () => {
    expect(tailwindConfigSource).toMatch(/"gratitude-accent": "var\(--color-gratitude-accent\)"/);
    expect(tailwindConfigSource).toMatch(/"on-gratitude-accent": "var\(--color-on-gratitude-accent\)"/);
    expect(tailwindConfigSource).toMatch(/"morning-accent": "var\(--color-gratitude-accent\)"/);
  });

  it('#f4c56a text on #3a2408 (and vice versa) still measures well above the 4.5:1 AA floor for normal text - kept genuinely computed since Home\'s Morning card still relies on this exact pair', () => {
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

  // Build 15 Evening UX correction — required addition: a genuinely
  // computed contrast check for Reflection's own peach pair, which
  // Gratitude now also relies on for its selected state (previously this
  // pair was only existence-checked in this file, never contrast-computed).
  it('#ffc5b7 text on #5a1c0c (and vice versa) - the peach pair now shared by both Reflection and Gratitude - measures well above the 4.5:1 AA floor for normal text', () => {
    const relLum = (hex) => {
      const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
      const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    };
    const contrast = (a, b) => {
      const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    expect(contrast('#ffc5b7', '#5a1c0c')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Build 15 selectable-control visual refinement - real, computed WCAG contrast for the new unselected-state colours', () => {
  const relLum = (hex) => {
    const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
    const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const contrast = (a, b) => {
    const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const blend = (fgHex, alpha, bgHex) => {
    const fg = fgHex.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
    const bg = bgHex.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
    const out = fg.map((c, i) => Math.round(alpha * c + (1 - alpha) * bg[i]));
    return '#' + out.map((c) => c.toString(16).padStart(2, '0')).join('');
  };
  const surfaceContainer = '#171f33';
  const surfaceContainerLowest = '#060e20';
  const eveningAccent = '#9fb4f0';

  it('the unselected row border (evening-accent/55) clears the 3:1 AA non-text boundary against the row background', () => {
    const blended = blend(eveningAccent, 0.55, surfaceContainer);
    expect(contrast(blended, surfaceContainer)).toBeGreaterThanOrEqual(3);
  });

  it('the unselected radio\'s full-strength evening-accent ring clears the 3:1 AA non-text boundary against the row background', () => {
    expect(contrast(eveningAccent, surfaceContainer)).toBeGreaterThanOrEqual(3);
  });

  it('the unselected radio\'s dark centre (surface-container-lowest) clears the 3:1 AA non-text boundary against its own surrounding ring', () => {
    expect(contrast(surfaceContainerLowest, eveningAccent)).toBeGreaterThanOrEqual(3);
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

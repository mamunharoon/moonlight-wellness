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
    expect(source).toMatch(/journeyTone = 'primary', groupName, readOnly = false/);
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

  it('keyboard focus gets a visible ring on the whole row (via :has(:focus-visible) on the label, since the actual input is visually hidden) - the ring colour is journeyTone-driven (getJourneyToneTokens), \'primary\' resolving to the original ring-primary', () => {
    expect(source).toMatch(/has-\[:focus-visible\]:ring-2 \$\{tokens\.focusRing\}/);
    expect(read('../../lib/journeyTone.js')).toMatch(/focusRing: 'has-\[:focus-visible\]:ring-primary'/);
  });
});

// Evening journey-theme correction — ACCENT_TOKENS (peach-only, keyed by
// the old 'reflection'/'gratitude' accent prop, with a hardcoded
// evening-accent unselected state regardless of accent) is gone,
// replaced by the same shared journeyTone.js token map every other
// journey-aware selectable control in this app already uses. 'primary'
// is byte-identical to the old reflection/gratitude values, so every
// existing behaviour below is re-asserted against journeyTone.js's own
// real content instead of a local copy inside this file.
const journeyToneSource = read('../../lib/journeyTone.js');

describe('AnswerOptionButton - now driven by the shared journeyTone.js token map, not a local ACCENT_TOKENS copy', () => {
  it('imports getJourneyToneTokens and resolves tokens from journeyTone (default \'primary\'), never a local accent-keyed object', () => {
    expect(source).toMatch(/import \{ getJourneyToneTokens \} from '\.\.\/\.\.\/lib\/journeyTone';/);
    expect(source).toMatch(/const tokens = getJourneyToneTokens\(journeyTone\);/);
    expect(source).not.toMatch(/const ACCENT_TOKENS = \{/);
  });

  it('journeyTone.js\'s own \'primary\' entry is byte-identical to the original hardcoded peach values this component used before the correction', () => {
    expect(journeyToneSource).toMatch(/selectedRow: 'bg-primary\/10 border-primary',/);
    expect(journeyToneSource).toMatch(/unselectedRow: 'bg-surface-container border-primary\/50 hover:bg-white\/10',/);
    expect(journeyToneSource).toMatch(/selectedLabel: 'text-primary font-bold',/);
    expect(journeyToneSource).toMatch(/selectedRing: 'border-primary bg-primary',/);
    expect(journeyToneSource).toMatch(/dot: 'bg-on-primary',/);
  });

  it('journeyTone.js\'s own \'evening\' entry - what Reflection.jsx/Gratitude.jsx now explicitly opt into - is real periwinkle, not peach', () => {
    expect(journeyToneSource).toMatch(/selectedRow: 'bg-evening-accent-tint\/10 border-evening-accent',/);
    expect(journeyToneSource).toMatch(/selectedLabel: 'text-evening-accent font-bold',/);
    expect(journeyToneSource).toMatch(/selectedRing: 'border-evening-accent bg-evening-accent',/);
    expect(journeyToneSource).toMatch(/dot: 'bg-on-evening-accent',/);
  });
});

describe('AnswerOptionButton - unselected state (Build 15 visual refinement)', () => {
  it('deep surface-container background, a visible border (calculated ~3.4:1 against the row, clearing the 3:1 AA non-text floor - see the contrast-computation describe block below), off-white readable label at medium weight - now resolved from tokens.unselectedRow (tone-driven) rather than a hardcoded evening-accent border, so a genuine non-Evening consumer (StressRelease.jsx, journeyTone="anytime") no longer incorrectly shows a periwinkle unselected border', () => {
    expect(source).toMatch(/text-on-surface font-medium/);
    expect(journeyToneSource).toMatch(/unselectedRow: 'bg-surface-container border-evening-accent\/55 hover:bg-white\/10',/);
  });

  it('the radio glyph is a strong accent ring with an explicit dark navy centre (surface-container-lowest) - not the old pale border-on-surface-variant outline, no inner dot; resolved from tokens.unselectedRing', () => {
    expect(source).toMatch(/selected \? tokens\.selectedRing : tokens\.unselectedRing/);
    expect(journeyToneSource).toMatch(/unselectedRing: 'border-evening-accent bg-surface-container-lowest',/);
    expect(source).not.toMatch(/border-on-surface-variant/);
    expect(source).toMatch(/\{selected && <span/); // the inner dot only ever renders when selected
  });
});

describe('AnswerOptionButton - readOnly mode (Evening completed-review)', () => {
  it('drops the interactive hover/press affordances (cursor-pointer, active:scale, hover:bg-white/10) since nothing happens on press - hover is stripped from tokens.unselectedRow\'s own bundled hover class specifically for the readOnly+unselected case', () => {
    expect(source).toMatch(/readOnly \? 'cursor-default' : 'cursor-pointer active:scale-\[0\.98\]'/);
    expect(source).toMatch(/tokens\.unselectedRow\.replace\(' hover:bg-white\/10', ''\)/);
  });

  it('selected/unselected colour treatment is identical in readOnly mode to the live journey - the same tokens are reused, never a separate dimmed palette, so legibility and contrast are unchanged', () => {
    // The selected/unselected branch that decides colour classes does not
    // itself branch on `readOnly` for the SELECTED case at all - only the
    // unselected branch strips hover (see the test above). Same tokens,
    // same contrast, in both modes.
    expect(source).toMatch(/selected\s*\n\s*\? tokens\.selectedRow/);
  });

  it('the native `disabled` attribute is the only readOnly-specific change to the input itself - never removed from the DOM, never aria-hidden, so its checked/unchecked state stays in the accessibility tree', () => {
    expect(source).not.toMatch(/readOnly && null/);
    expect(source).not.toMatch(/aria-hidden=\{readOnly\}/);
  });
});

describe('AnswerOptionButton - selected state (subtle row tint, never a fully filled/bright block, never colour alone)', () => {
  it('the row itself only gets a SUBTLE colour tint (bg-*/10) and a full-strength border - never a fully filled/bright background (tokens.selectedRow, from journeyTone.js)', () => {
    expect(journeyToneSource).toMatch(/selectedRow: 'bg-primary\/10 border-primary',/);
    expect(source).toMatch(/selected\s*\n\s*\? tokens\.selectedRow/);
  });

  it('the radio glyph itself carries the strong, saturated colour when selected - filled circle plus a small, contrasting inner dot, never a tick/checkmark (tokens.selectedRing/dot, from journeyTone.js)', () => {
    expect(journeyToneSource).toMatch(/selectedRing: 'border-primary bg-primary',/);
    expect(journeyToneSource).toMatch(/dot: 'bg-on-primary',/);
  });

  it('selected label text is bold and coloured (never colour alone - weight changes too), row border switches to the full-strength accent border', () => {
    expect(source).toMatch(/\{selected \? tokens\.selectedLabel : 'text-on-surface font-medium'\}/);
    expect(journeyToneSource).toMatch(/selectedLabel: 'text-primary font-bold',/);
  });

  // Evening journey-theme correction — journeyTone replaces the old
  // accent prop entirely; Reflection.jsx and Gratitude.jsx (both
  // formerly hardcoded to the same peach 'reflection'/'gratitude'
  // ACCENT_TOKENS entries) now both pass journeyTone="evening" at their
  // own call sites (see reflectionGratitudeTapFirst.test.js), so they
  // share one selected-answer colour throughout Evening exactly as
  // before, just resolved through the shared token map instead of a
  // local duplicate.
  it('gold (gratitude-accent/on-gratitude-accent) is completely absent from the ACTUAL CODE - the doc comment above may still mention it in prose explaining the change, but no real class/token reference remains', () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/text-gratitude-accent|border-gratitude-accent|bg-gratitude-accent|on-gratitude-accent/);
  });
});

describe('gratitude-accent/on-gratitude-accent tokens - kept, but no longer consumed by Gratitude itself', () => {
  it('index.css still defines gratitude-accent/on-gratitude-accent - not deleted, since Home.jsx\'s Today\'s Rhythm Morning card (`morning-accent`) reuses this exact same CSS variable for its own, unrelated sunrise-gold identity', () => {
    // WakeWise DEV — Morning colour consistency: value updated from
    // #f4c56a to the approved welcome design's dawn gold #fdba74.
    expect(cssSource).toMatch(/--color-gratitude-accent: #fdba74;/);
    expect(cssSource).toMatch(/--color-on-gratitude-accent: #3a2408;/);
    expect(cssSource).toMatch(/--color-primary: #ffc5b7;/);
    expect(cssSource).toMatch(/--color-on-primary: #5a1c0c;/);
  });

  it('tailwind.config.js still exposes gratitude-accent/on-gratitude-accent as real utility-generating colours, and morning-accent still points at the same underlying CSS variable', () => {
    expect(tailwindConfigSource).toMatch(/"gratitude-accent": "var\(--color-gratitude-accent\)"/);
    expect(tailwindConfigSource).toMatch(/"on-gratitude-accent": "var\(--color-on-gratitude-accent\)"/);
    expect(tailwindConfigSource).toMatch(/"morning-accent": "var\(--color-gratitude-accent\)"/);
  });

  it('#fdba74 text on #3a2408 (and vice versa) still measures well above the 4.5:1 AA floor for normal text - kept genuinely computed since Home\'s Morning card still relies on this exact pair', () => {
    const relLum = (hex) => {
      const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
      const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    };
    const contrast = (a, b) => {
      const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    // WakeWise DEV — Morning colour consistency: recomputed for the
    // approved welcome design's dawn gold #fdba74 (was #f4c56a) - still
    // ~8.7:1, comfortably above the 4.5:1 AA floor.
    expect(contrast('#fdba74', '#3a2408')).toBeGreaterThanOrEqual(4.5);
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

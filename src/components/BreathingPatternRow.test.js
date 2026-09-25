// F7 (pre-Build-15 usability pass) — compact breathing-card structure:
// duration moves from its own third line onto the same row as the
// cadence (was previously a stacked "Inhale/Hold/Exhale" line then a
// separate duration line below it). No DOM rendering is available in
// this repo's Vitest (environment: 'node') - source-level checks,
// matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./BreathingPatternRow.jsx', import.meta.url)), 'utf-8');

describe('BreathingPatternRow — F7 compact structure: duration beside cadence, not its own line', () => {
  it('imports formatBreathingDuration (the new compact "56 sec"/"1 min" format), not formatTotalDuration (the shared Stretch-summary formatter, deliberately untouched)', () => {
    expect(source).toMatch(/import \{ formatCadence, formatBreathingDuration \} from '\.\.\/lib\/breathingPatterns';/);
    expect(source).not.toMatch(/formatTotalDuration/);
    expect(source).not.toMatch(/from '\.\.\/lib\/formatDuration';/);
  });

  it('cadence and duration share one flex-wrap row (justify-between so duration right-aligns when there\'s room, wraps to its own line at narrow widths rather than overlapping)', () => {
    const cardBlock = source.match(/<span className="flex-1 min-w-0">[\s\S]*?<\/span>\s*\n\s*<\/span>\s*\n\s*<span\s*\n\s*aria-hidden/)?.[0] ?? '';
    expect(cardBlock).toMatch(/flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0\.5 mt-1/);
    expect(cardBlock).toMatch(/\{formatCadence\(pattern\)\}/);
    expect(cardBlock).toMatch(/\{formatBreathingDuration\(pattern\.totalSeconds\)\}/);
  });

  it('the card no longer has a third stacked text line - exactly two text rows inside the label content (name, then the cadence+duration row)', () => {
    const cardBlock = source.match(/<span className="flex-1 min-w-0">[\s\S]*?<\/span>\s*\n\s*<\/span>\s*\n\s*<span\s*\n\s*aria-hidden/)?.[0] ?? '';
    // pattern.label, formatCadence, formatBreathingDuration - three
    // pieces of content, but only two visual "lines" (name; cadence+duration).
    expect((cardBlock.match(/\{pattern\.label\}|\{formatCadence\(pattern\)\}|\{formatBreathingDuration\(pattern\.totalSeconds\)\}/g) ?? []).length).toBe(3);
  });

  it('min-h reduced from 56px to the 44px minimum, with modestly reduced vertical padding (py-2.5, was py-3) - still meets the touch-target floor', () => {
    expect(source).toMatch(/min-h-\[44px\] px-5 py-2\.5/);
    // Only the actual className is asserted absent, not this file's own
    // doc comment (which legitimately mentions the old value in prose).
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/min-h-\[56px\]/);
  });

  it('the whole card is still one <label> wrapping a real native radio input - selectable as a whole, exactly as before', () => {
    expect(source).toMatch(/<label\s*\n\s*className=\{`flex items-center justify-between/);
    expect(source).toMatch(/<input\s*\n\s*type="radio"/);
  });

  it('the selected/unselected radio indicator markup is completely untouched by this pass', () => {
    expect(source).toMatch(/aria-hidden="true"/);
    expect(source).toMatch(/w-5 h-5 rounded-full border-2 shrink-0/);
  });

  it('accent tokens (primary/evening/morning) are completely untouched - only the card layout changed', () => {
    expect(source).toMatch(/const ACCENT_TOKENS = \{/);
    expect(source).toMatch(/primary: \{/);
    expect(source).toMatch(/evening: \{/);
    expect(source).toMatch(/morning: \{/);
  });

  // Correction (acceptance review) — live verification showed "56 SEC"/
  // "~1 MIN" despite the approved copy reading "56 sec"/"1 min" in real
  // sentence case. Root cause: this span had carried `uppercase` since
  // before this pass's own layout change - removed here so the rendered
  // text matches formatBreathingDuration's own real output casing
  // exactly, with no CSS transform altering it.
  it('the duration span no longer carries uppercase - the visible rendered text matches the approved sentence-case copy ("56 sec"/"1 min"), not an all-caps transform', () => {
    const durationSpanBlock = source.match(/<span className="text-\[10px\] text-on-surface-variant\/70[^"]*">\s*\n\s*\{formatBreathingDuration\(pattern\.totalSeconds\)\}/)?.[0] ?? '';
    expect(durationSpanBlock.length).toBeGreaterThan(0);
    expect(durationSpanBlock).not.toMatch(/uppercase/);
  });
});

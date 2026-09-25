// Build 16 physical-iPhone correction (F5) — BreathingPatternDescription:
// the shared "selected pattern's full cadence + exact duration, shown
// once" area below the compact pattern grid. No DOM rendering available
// in this repo's Vitest - source-level checks, matching this codebase's
// established pattern.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const descriptionSource = read('./BreathingPatternDescription.jsx');
const rowSource = read('./BreathingPatternRow.jsx');
const breatheSource = read('../pages/Breathe.jsx');
const eveningBreathingSource = read('../pages/EveningBreathing.jsx');
const quietBreathingSource = read('../pages/QuietBreathing.jsx');

describe('BreathingPatternDescription — real cadence/duration formatters, nothing hard-coded', () => {
  it('imports the same formatCadence/formatBreathingDuration BreathingPatternRow itself uses - can never drift to different wording/rounding', () => {
    expect(descriptionSource).toMatch(/import \{ formatCadence, formatBreathingDuration \} from '\.\.\/lib\/breathingPatterns';/);
    expect(descriptionSource).toMatch(/\{formatCadence\(pattern\)\}/);
    expect(descriptionSource).toMatch(/\{formatBreathingDuration\(pattern\.totalSeconds\)\}/);
  });

  it('also shows the pattern\'s full label - the complete name is never dropped even though the grid card above already showed it', () => {
    expect(descriptionSource).toMatch(/\{pattern\.label\}/);
  });

  it('announces itself as a live status region, since it changes every time the selection changes', () => {
    expect(descriptionSource).toMatch(/role="status" aria-live="polite"/);
  });
});

describe('BreathingPatternRow — compact grid-card variant (F5)', () => {
  const compactBlock = rowSource.match(/if \(compact\) \{\s*\n\s*return \(([\s\S]*?)\n {4}\);\s*\n {2}\}/)?.[1] ?? '';

  it('defaults to false - existing full-width-row callers are unaffected', () => {
    expect(rowSource).toMatch(/compact = false/);
  });

  it('accepts an optional className passthrough, defaulting to empty string, so a caller can span the last card across both grid columns', () => {
    expect(rowSource).toMatch(/className = ''/);
    expect(compactBlock).toMatch(/\$\{className\}/);
  });

  it('still uses a real native radio input inside one wrapping <label>, sr-only', () => {
    expect(compactBlock).toMatch(/<label/);
    expect(compactBlock).toMatch(/type="radio"/);
    expect(compactBlock).toMatch(/className="sr-only"/);
  });

  it('keeps the 44px minimum touch target', () => {
    expect(compactBlock).toMatch(/min-h-\[44px\]/);
  });

  it('shows the pattern\'s full, complete name - never abbreviated or truncated', () => {
    expect(compactBlock).toMatch(/\{pattern\.label\}/);
  });

  it('deliberately omits cadence/duration - that information now lives once in the shared BreathingPatternDescription below the grid, not repeated in every card', () => {
    expect(compactBlock).not.toMatch(/formatCadence|formatBreathingDuration/);
  });

  it('selected state is still communicated by more than colour alone - filled ring + dot, plus bold label text', () => {
    expect(compactBlock).toMatch(/selected \? tokens\.selectedRing : tokens\.unselectedRing/);
    expect(compactBlock).toMatch(/selected && <span className=\{`absolute inset-0 m-auto w-1\.5 h-1\.5 rounded-full \$\{tokens\.dot\}`\}/);
    expect(compactBlock).toMatch(/selected \? tokens\.selectedLabel : 'text-on-surface font-medium'/);
  });
});

describe('Standalone Breathe / Morning Breathe / Evening Breathing — compact grid + shared description, consistently applied', () => {
  const pages = [
    ['Breathe.jsx (Morning)', breatheSource],
    ['EveningBreathing.jsx', eveningBreathingSource],
    ['QuietBreathing.jsx (standalone)', quietBreathingSource]
  ];

  it.each(pages)('%s imports BreathingPatternDescription and renders it with the live activePattern', (_name, source) => {
    expect(source).toMatch(/import \{ BreathingPatternDescription \} from '\.\.\/components\/BreathingPatternDescription';/);
    expect(source).toMatch(/<BreathingPatternDescription pattern=\{activePattern\} \/>/);
  });

  it.each(pages)('%s renders the pattern grid as a real 2-column CSS grid (grid-cols-2), not a stacked list of full-width rows', (_name, source) => {
    expect(source).toMatch(/className="grid grid-cols-2 gap-3" role="radiogroup"/);
  });

  it.each(pages)('%s passes compact to every BreathingPatternRow in the grid', (_name, source) => {
    const mapBlock = source.match(/\{BREATHING_PATTERNS\.map\(\(pattern, idx\) => \([\s\S]*?<BreathingPatternRow[\s\S]*?\/>/)?.[0] ?? '';
    expect(mapBlock).toMatch(/\bcompact\b/);
  });

  it.each(pages)('%s spans only the LAST pattern (Coherent Breathing, index 4) across both grid columns - the first four stay in their 2x2 arrangement', (_name, source) => {
    expect(source).toMatch(/className=\{idx === BREATHING_PATTERNS\.length - 1 \? 'col-span-2' : undefined\}/);
  });

  it.each(pages)('%s: the shared description renders immediately after the grid', (_name, source) => {
    const gridIndex = source.indexOf('className="grid grid-cols-2 gap-3" role="radiogroup"');
    const descriptionIndex = source.indexOf('<BreathingPatternDescription pattern={activePattern} />');
    expect(gridIndex).toBeGreaterThan(-1);
    expect(descriptionIndex).toBeGreaterThan(gridIndex);
    // Nothing but the grid's own closing markup sits between them.
    expect(descriptionIndex - gridIndex).toBeLessThan(700);
  });
});

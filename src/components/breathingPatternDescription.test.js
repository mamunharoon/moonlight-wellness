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

// Anytime Visual Flow and Closing Handoff uplift (Part 7) — QuietBreathing.jsx's
// standalone branch now matches Breathe.jsx's/EveningBreathing.jsx's own
// corrected structure below (vertically stacked full-width rows with a
// real icon, no separate shared description) - superseding the former
// compact-grid describe block for this file.
describe('QuietBreathing.jsx (standalone) — Anytime Visual Flow and Closing Handoff uplift: vertically stacked rows replace the compact grid + shared description', () => {
  it('no longer imports or renders BreathingPatternDescription - each stacked row already shows its own full cadence/duration inline', () => {
    expect(quietBreathingSource).not.toMatch(/import \{ BreathingPatternDescription \}/);
    expect(quietBreathingSource).not.toMatch(/<BreathingPatternDescription/);
  });

  it('renders BREATHING_PATTERNS as a vertically stacked list (space-y-2), not a 2-column grid', () => {
    expect(quietBreathingSource).toMatch(/className="space-y-2" role="radiogroup" aria-label="Choose your breathing practice"/);
    expect(quietBreathingSource).not.toMatch(/grid grid-cols-2 gap-3/);
  });

  it('no BreathingPatternRow call site passes compact - every row is the full, non-compact row (with an icon)', () => {
    const mapBlock = quietBreathingSource.match(/\{BREATHING_PATTERNS\.map\(\(pattern\) => \([\s\S]*?<BreathingPatternRow[\s\S]*?\/>/)?.[0] ?? '';
    expect(mapBlock).not.toBe('');
    expect(mapBlock).not.toMatch(/\bcompact\b/);
    expect(mapBlock).toMatch(/icon=\{BREATHING_PATTERN_ICONS\[pattern\.id\]\}/);
  });
});

// Evening Visual Uplift (Phase 7) — EveningBreathing.jsx now matches
// Breathe.jsx's own corrected structure below (vertically stacked
// full-width rows with a real icon, no separate shared description) -
// superseding the compact-grid describe block above, which now covers
// only QuietBreathing.jsx (untouched by this phase).
describe('EveningBreathing.jsx — Evening Visual Uplift (Phase 7): vertically stacked rows replace the compact grid + shared description', () => {
  it('no longer imports or renders BreathingPatternDescription - each stacked row already shows its own full cadence/duration inline', () => {
    expect(eveningBreathingSource).not.toMatch(/import \{ BreathingPatternDescription \}/);
    expect(eveningBreathingSource).not.toMatch(/<BreathingPatternDescription/);
  });

  it('renders BREATHING_PATTERNS as a vertically stacked list (space-y-2), not a 2-column grid', () => {
    expect(eveningBreathingSource).toMatch(/className="space-y-2" role="radiogroup" aria-label="Choose your breathing practice"/);
    expect(eveningBreathingSource).not.toMatch(/grid grid-cols-2 gap-3/);
  });

  it('no BreathingPatternRow call site passes compact - every row is the full, non-compact row (with an icon)', () => {
    const mapBlock = eveningBreathingSource.match(/\{BREATHING_PATTERNS\.map\(\(pattern\) => \([\s\S]*?<BreathingPatternRow[\s\S]*?\/>/)?.[0] ?? '';
    expect(mapBlock).not.toBe('');
    expect(mapBlock).not.toMatch(/\bcompact\b/);
    expect(mapBlock).toMatch(/icon=\{BREATHING_PATTERN_ICONS\[pattern\.id\]\}/);
  });
});

describe('Morning Breathe.jsx — Morning Visual Uplift (Phase 6): vertically stacked rows replace the compact grid + shared description', () => {
  it('no longer imports or renders BreathingPatternDescription - each stacked row already shows its own full cadence/duration inline', () => {
    expect(breatheSource).not.toMatch(/import \{ BreathingPatternDescription \}/);
    expect(breatheSource).not.toMatch(/<BreathingPatternDescription/);
  });

  it('renders BREATHING_PATTERNS as a vertically stacked list (space-y-2), not a 2-column grid', () => {
    expect(breatheSource).toMatch(/className="space-y-2" role="radiogroup" aria-label="Choose your breathing practice"/);
    expect(breatheSource).not.toMatch(/grid grid-cols-2 gap-3/);
  });

  it('no BreathingPatternRow call site passes compact - every row is the full, non-compact row (with an icon)', () => {
    const mapBlock = breatheSource.match(/\{BREATHING_PATTERNS\.map\(\(pattern\) => \([\s\S]*?<BreathingPatternRow[\s\S]*?\/>/)?.[0] ?? '';
    expect(mapBlock).not.toBe('');
    expect(mapBlock).not.toMatch(/\bcompact\b/);
    expect(mapBlock).toMatch(/icon=\{BREATHING_PATTERN_ICONS\[pattern\.id\]\}/);
  });
});
